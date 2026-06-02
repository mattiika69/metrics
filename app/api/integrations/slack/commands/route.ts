import { headers } from "next/headers";
import {
  buildAgentHelpResponse,
  buildAgentStatusResponse,
  createChannelAgentRequest,
  extractAgentRequestText,
  isAgentHelpRequest,
  isAgentStatusRequest,
} from "@/lib/agent/channel";
import { envErrorResponse, getRequiredServerEnv } from "@/lib/env/server";
import { upsertIntegrationChannelLink } from "@/lib/integrations/channel-links";
import { verifySlackSignature } from "@/lib/integrations/slack";
import { buildChannelCommandResponse, resolveChannelCommand } from "@/lib/metrics/channel";
import { getRequestIp } from "@/lib/request/ip";
import { logAuditEvent } from "@/lib/security/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function parseCommand(commandName: string | null, text: string | null) {
  return resolveChannelCommand(text) ?? resolveChannelCommand(commandName) ?? "metrics";
}

export async function POST(request: Request) {
  let signingSecret: string;
  try {
    signingSecret = getRequiredServerEnv("SLACK_SIGNING_SECRET");
  } catch (error) {
    return envErrorResponse(error);
  }

  const rateLimit = await checkRateLimit({
    route: "webhook:slack:commands",
    key: `slack:commands:${await getRequestIp()}`,
    limit: 120,
    windowSeconds: 60,
    metadata: { provider: "slack" },
  });

  if (!rateLimit.allowed) {
    return Response.json({ response_type: "ephemeral", text: "Too many requests. Try again later." }, { status: 429 });
  }

  const body = await request.text();
  const headerStore = await headers();
  const verified = verifySlackSignature({
    body,
    signature: headerStore.get("x-slack-signature"),
    timestamp: headerStore.get("x-slack-request-timestamp"),
    signingSecret,
  });
  if (!verified) return Response.json({ error: "Invalid Slack signature." }, { status: 401 });

  const params = new URLSearchParams(body);
  const teamId = params.get("team_id");
  const channelId = params.get("channel_id");
  const userId = params.get("user_id");
  const userName = params.get("user_name");
  const commandName = params.get("command");
  const commandText = params.get("text");
  const channelName = params.get("channel_name");
  const command = parseCommand(params.get("command"), params.get("text"));

  if (!teamId) return Response.json({ response_type: "ephemeral", text: "Slack team could not be resolved." });

  const admin = createAdminClient();
  const { data: integration } = await admin
    .from("tenant_integrations")
    .select("id, tenant_id, external_channel_id")
    .eq("provider", "slack")
    .eq("external_team_id", teamId)
    .neq("status", "disabled")
    .maybeSingle();

  if (!integration) {
    return Response.json({
      response_type: "ephemeral",
      text: "Slack is not connected to HyperOptimal Metrics yet.",
    });
  }

  let approvedChannel = integration.external_channel_id;
  if (!approvedChannel && channelId) {
    const { data: channelRow, error: channelError } = await admin
      .from("tenant_integrations")
      .update({ external_channel_id: channelId, updated_at: new Date().toISOString() })
      .eq("id", integration.id)
      .is("external_channel_id", null)
      .select("external_channel_id")
      .maybeSingle();

    if (!channelError && channelRow?.external_channel_id === channelId) {
      approvedChannel = channelRow.external_channel_id;
      await logAuditEvent({
        tenantId: integration.tenant_id,
        eventType: "slack_channel_connected",
        targetType: "slack",
        targetId: channelId,
        metadata: { teamId, userId },
      });
      await upsertIntegrationChannelLink({
        admin,
        tenantId: integration.tenant_id,
        provider: "slack",
        externalChannelId: channelId,
        displayName: channelName ? `#${channelName}` : "Slack channel",
        linkedByUserId: null,
        metadata: {
          teamId,
          userId,
          source: "slack_command",
        },
      });
    } else {
      const { data: latestIntegration } = await admin
        .from("tenant_integrations")
        .select("external_channel_id")
        .eq("id", integration.id)
        .maybeSingle();
      approvedChannel = latestIntegration?.external_channel_id ?? null;
    }
  }

  if (approvedChannel && channelId && approvedChannel !== channelId) {
    return Response.json({
      response_type: "ephemeral",
      text: "This Slack channel is not connected to HyperOptimal Metrics.",
    });
  }

  await admin.from("integration_messages").insert({
    tenant_id: integration.tenant_id,
    integration_id: integration.id,
    provider: "slack",
    direction: "inbound",
    external_channel_id: channelId,
    external_user_id: userId,
    body,
    payload: Object.fromEntries(params.entries()),
  });
  await admin.from("integration_inbound_events").insert({
    tenant_id: integration.tenant_id,
    provider: "slack",
    external_event_id: `${teamId}:${channelId}:${userId}:${Date.now()}`,
    event_type: "slash_command",
    payload: {
      command: params.get("command"),
      team_id: teamId,
      channel_id: channelId,
      user_id: userId,
    },
    status: "mapped",
  });

  const agentRequestText = extractAgentRequestText({
    commandName,
    text: commandText,
  });
  let text: string;
  if (isAgentHelpRequest(commandText ?? commandName)) {
    text = buildAgentHelpResponse();
  } else if (isAgentStatusRequest(commandText ?? commandName)) {
    text = await buildAgentStatusResponse({
      tenantId: integration.tenant_id,
      provider: "slack",
      channelId,
    });
  } else if (agentRequestText !== null) {
    text = (await createChannelAgentRequest({
      tenantId: integration.tenant_id,
      provider: "slack",
      channelId,
      externalWorkspaceId: teamId,
      externalMessageId: params.get("trigger_id") ?? null,
      externalUserId: userId,
      externalUserName: userName,
      requestText: agentRequestText,
      metadata: { teamId, command: commandName },
    })).message;
  } else {
    text = await buildChannelCommandResponse(integration.tenant_id, command);
  }

  await admin.from("integration_messages").insert({
    tenant_id: integration.tenant_id,
    integration_id: integration.id,
    provider: "slack",
    direction: "outbound",
    external_channel_id: channelId,
    body: text,
    payload: { command, agent: agentRequestText !== null },
  });
  await admin.from("integration_outbound_messages").insert({
    tenant_id: integration.tenant_id,
    provider: "slack",
    target_id: channelId ?? "unknown",
    body: text,
    payload: { command, agent: agentRequestText !== null },
    status: "sent",
  });

  await logAuditEvent({
    tenantId: integration.tenant_id,
    eventType: agentRequestText !== null ? "slack_agent" : `slack_${command}`,
    targetType: "slack",
    metadata: { teamId, channelId, userId },
  });

  return Response.json({ response_type: "ephemeral", text });
}
