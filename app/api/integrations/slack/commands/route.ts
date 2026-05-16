import { headers } from "next/headers";
import { verifySlackSignature } from "@/lib/integrations/slack";
import { buildChannelCommandResponse, resolveChannelCommand } from "@/lib/metrics/channel";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function parseCommand(commandName: string | null, text: string | null) {
  return resolveChannelCommand(text) ?? resolveChannelCommand(commandName) ?? "metrics";
}

export async function POST(request: Request) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return Response.json({ error: "Missing SLACK_SIGNING_SECRET." }, { status: 500 });

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
  const command = parseCommand(params.get("command"), params.get("text"));

  if (!teamId) return Response.json({ response_type: "ephemeral", text: "Slack team could not be resolved." });

  const admin = createAdminClient();
  const { data: integration } = await admin
    .from("tenant_integrations")
    .select("id, tenant_id")
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

  const text = await buildChannelCommandResponse(integration.tenant_id, command);

  await admin.from("integration_messages").insert({
    tenant_id: integration.tenant_id,
    integration_id: integration.id,
    provider: "slack",
    direction: "outbound",
    external_channel_id: channelId,
    body: text,
    payload: { command },
  });
  await admin.from("integration_outbound_messages").insert({
    tenant_id: integration.tenant_id,
    provider: "slack",
    target_id: channelId ?? "unknown",
    body: text,
    payload: { command },
    status: "sent",
  });

  await logAuditEvent({
    tenantId: integration.tenant_id,
    eventType: `slack_${command}`,
    targetType: "slack",
    metadata: { teamId, channelId, userId },
  });

  return Response.json({ response_type: "ephemeral", text });
}
