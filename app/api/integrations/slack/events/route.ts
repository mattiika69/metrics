import { headers } from "next/headers";
import {
  buildAgentHelpResponse,
  buildAgentStatusResponse,
  createChannelAgentRequest,
  isAgentHelpRequest,
  isAgentStatusRequest,
  resolveAgentRequestText,
} from "@/lib/agent/channel";
import { envErrorResponse, getRequiredServerEnv } from "@/lib/env/server";
import { verifySlackSignature } from "@/lib/integrations/slack";
import { sendSlackMessage } from "@/lib/integrations/slack-oauth";
import { decodeMetricIntegrationSecret } from "@/lib/integrations/secret-store";
import { buildChannelCommandResponse, resolveChannelCommand } from "@/lib/metrics/channel";
import { getRequestIp } from "@/lib/request/ip";
import { logAuditEvent } from "@/lib/security/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  markWebhookFailed,
  markWebhookProcessed,
  markWebhookUnmapped,
  recordWebhookEvent,
} from "@/lib/security/webhooks";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SlackEventsPayload = {
  type?: string;
  challenge?: string;
  event_id?: string;
  team_id?: string;
  authorizations?: Array<{ team_id?: string }>;
  event?: {
    type?: string;
    event_ts?: string;
    ts?: string;
    channel?: string;
    user?: string;
    username?: string;
    text?: string;
    subtype?: string;
    bot_id?: string;
  };
};

function commandFromText(text: unknown) {
  if (typeof text !== "string") return null;
  return resolveChannelCommand(text);
}

export async function POST(request: Request) {
  let signingSecret: string;
  try {
    signingSecret = getRequiredServerEnv("SLACK_SIGNING_SECRET");
  } catch (error) {
    return envErrorResponse(error);
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

  let payload: SlackEventsPayload;
  try {
    payload = JSON.parse(body) as SlackEventsPayload;
  } catch {
    return Response.json({ error: "Invalid Slack payload." }, { status: 400 });
  }
  if (payload.type === "url_verification" && typeof payload.challenge === "string") {
    return new Response(payload.challenge, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const rateLimit = await checkRateLimit({
    route: "webhook:slack:events",
    key: `slack:events:${await getRequestIp()}`,
    limit: 120,
    windowSeconds: 60,
    metadata: { provider: "slack" },
  });

  if (!rateLimit.allowed) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  const externalEventId = payload.event_id ?? `${payload.team_id ?? "unknown"}:${payload.event?.event_ts ?? Date.now()}`;
  const eventType = payload.event?.type ?? payload.type ?? "unknown";
  const webhook = await recordWebhookEvent({
    provider: "slack",
    externalEventId,
    eventType,
    payload: {
      event_id: payload.event_id ?? null,
      team_id: payload.team_id ?? null,
      event_type: payload.event?.type ?? null,
    },
  });
  if (webhook.duplicate) return Response.json({ received: true, duplicate: true });

  const admin = createAdminClient();
  await admin.from("integration_inbound_events").insert({
    provider: "slack",
    external_event_id: externalEventId,
    event_type: eventType,
    payload: {
      event_id: payload.event_id ?? null,
      team_id: payload.team_id ?? null,
      event_type: payload.event?.type ?? null,
    },
  });

  const teamId = payload.team_id ?? payload.authorizations?.[0]?.team_id;
  if (!teamId) {
    await markWebhookUnmapped(webhook.id);
    return Response.json({ received: true, mapped: false });
  }

  if (payload.event?.bot_id || payload.event?.subtype === "bot_message") {
    await markWebhookProcessed(webhook.id);
    return Response.json({ received: true, ignored: true });
  }

  const { data: integration } = await admin
    .from("tenant_integrations")
    .select("id, tenant_id, external_channel_id")
    .eq("provider", "slack")
    .eq("external_team_id", teamId)
    .neq("status", "disabled")
    .maybeSingle();

  if (!integration) {
    await markWebhookUnmapped(webhook.id);
    return Response.json({ received: true, mapped: false });
  }

  const incomingChannel = payload.event?.channel ?? null;
  let approvedChannel = integration.external_channel_id;
  if (!approvedChannel && incomingChannel) {
    const { data: channelRow, error: channelError } = await admin
      .from("tenant_integrations")
      .update({ external_channel_id: incomingChannel, updated_at: new Date().toISOString() })
      .eq("id", integration.id)
      .is("external_channel_id", null)
      .select("external_channel_id")
      .maybeSingle();

    if (!channelError && channelRow?.external_channel_id === incomingChannel) {
      approvedChannel = channelRow.external_channel_id;
      await logAuditEvent({
        tenantId: integration.tenant_id,
        eventType: "slack_channel_connected",
        targetType: "slack",
        targetId: incomingChannel,
        metadata: { teamId },
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

  if (approvedChannel && incomingChannel && approvedChannel !== incomingChannel) {
    await markWebhookUnmapped(webhook.id);
    return Response.json({ received: true, mapped: false, reason: "channel_not_connected" });
  }

  try {
    await admin
      .from("integration_inbound_events")
      .update({ tenant_id: integration.tenant_id, status: "mapped" })
      .eq("provider", "slack")
      .eq("external_event_id", externalEventId);

    await admin.from("integration_events").insert({
      tenant_id: integration.tenant_id,
      integration_id: integration.id,
      provider: "slack",
      external_event_id: payload.event_id,
      event_type: eventType,
      payload,
    });
    await admin.from("integration_messages").insert({
      tenant_id: integration.tenant_id,
      integration_id: integration.id,
      provider: "slack",
      direction: "inbound",
      external_message_id: payload.event?.ts ?? null,
      external_channel_id: payload.event?.channel ?? null,
      external_user_id: payload.event?.user ?? null,
      body: typeof payload.event?.text === "string" ? payload.event.text : "",
      payload,
    });

    const eventText = payload.event?.text;
    const command = commandFromText(eventText);
    const channel = payload.event?.channel;
    const agentRequestText = command
      ? null
      : resolveAgentRequestText({ text: eventText, allowNaturalLanguage: true });

    if ((agentRequestText !== null || command || isAgentHelpRequest(eventText) || isAgentStatusRequest(eventText)) && channel) {
      let responseText: string;
      if (isAgentHelpRequest(eventText)) {
        responseText = buildAgentHelpResponse();
      } else if (isAgentStatusRequest(eventText)) {
        responseText = await buildAgentStatusResponse({
          tenantId: integration.tenant_id,
          provider: "slack",
          channelId: channel,
        });
      } else if (agentRequestText !== null) {
        responseText = (await createChannelAgentRequest({
          tenantId: integration.tenant_id,
          provider: "slack",
          channelId: channel,
          externalUserId: payload.event?.user ?? null,
          externalUserName: payload.event?.username ?? null,
          requestText: agentRequestText,
          metadata: { teamId, eventType },
        })).message;
      } else {
        responseText = await buildChannelCommandResponse(integration.tenant_id, command!);
      }
      const { data: secret } = await admin
        .from("metric_integration_secrets")
        .select("secret_values")
        .eq("tenant_id", integration.tenant_id)
        .eq("tenant_integration_id", integration.id)
        .eq("provider", "slack")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const secretValues = decodeMetricIntegrationSecret(secret?.secret_values);
      const botToken = secretValues?.botToken;
      if (typeof botToken === "string") {
        await sendSlackMessage({ botToken, channel, text: responseText });
      }
      await admin.from("integration_messages").insert({
        tenant_id: integration.tenant_id,
        integration_id: integration.id,
        provider: "slack",
        direction: "outbound",
        external_channel_id: channel,
        body: responseText,
        payload: { command, agent: agentRequestText !== null },
      });
      await admin.from("integration_outbound_messages").insert({
        tenant_id: integration.tenant_id,
        provider: "slack",
        target_id: channel,
        body: responseText,
        payload: { command, agent: agentRequestText !== null },
        status: "sent",
      });
    }

    await markWebhookProcessed(webhook.id, integration.tenant_id);
    await logAuditEvent({
      tenantId: integration.tenant_id,
      eventType: "slack_webhook_mapped",
      targetType: "slack",
      targetId: webhook.id,
      metadata: { teamId, eventType },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Slack webhook failed.";
    await markWebhookFailed(webhook.id, message);
    return Response.json({ error: message }, { status: 500 });
  }

  return Response.json({ received: true, mapped: true });
}
