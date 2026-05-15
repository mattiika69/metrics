import { headers } from "next/headers";
import { verifySlackSignature } from "@/lib/integrations/slack";
import { sendSlackMessage } from "@/lib/integrations/slack-oauth";
import { buildConstraintsCommandResponse, buildMetricsCommandResponse } from "@/lib/metrics/channel";
import { logAuditEvent } from "@/lib/security/audit";
import {
  markWebhookFailed,
  markWebhookProcessed,
  markWebhookUnmapped,
  recordWebhookEvent,
} from "@/lib/security/webhooks";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function commandFromText(text: unknown) {
  if (typeof text !== "string") return null;
  const lower = text.toLowerCase();
  if (lower.includes("/constraints") || lower.includes(" constraints")) return "constraints";
  if (lower.includes("/metrics") || lower.includes(" metrics")) return "metrics";
  return null;
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

  const payload = JSON.parse(body);
  if (payload.type === "url_verification") return Response.json({ challenge: payload.challenge });

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

  const teamId = payload.team_id ?? payload.authorizations?.[0]?.team_id;
  if (!teamId) {
    await markWebhookUnmapped(webhook.id);
    return Response.json({ received: true, mapped: false });
  }

  const admin = createAdminClient();
  const { data: integration } = await admin
    .from("tenant_integrations")
    .select("id, tenant_id")
    .eq("provider", "slack")
    .eq("external_team_id", teamId)
    .neq("status", "disabled")
    .maybeSingle();

  if (!integration) {
    await markWebhookUnmapped(webhook.id);
    return Response.json({ received: true, mapped: false });
  }

  try {
    await admin.from("integration_events").insert({
      tenant_id: integration.tenant_id,
      integration_id: integration.id,
      provider: "slack",
      external_event_id: payload.event_id,
      event_type: eventType,
      payload,
    });

    const eventText = payload.event?.text;
    const command = commandFromText(eventText);
    const channel = payload.event?.channel;

    if (command && channel) {
      const responseText = command === "constraints"
        ? await buildConstraintsCommandResponse(integration.tenant_id)
        : await buildMetricsCommandResponse(integration.tenant_id);
      const { data: secret } = await admin
        .from("metric_integration_secrets")
        .select("secret_values")
        .eq("tenant_id", integration.tenant_id)
        .eq("tenant_integration_id", integration.id)
        .eq("provider", "slack")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const botToken = secret?.secret_values?.botToken;
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
        payload: { command },
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
