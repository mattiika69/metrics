import { headers } from "next/headers";
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
import { verifySlackSignature } from "@/lib/integrations/slack";

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit({
    route: "webhook:slack",
    key: await getRequestIp(),
    limit: 120,
    windowSeconds: 60,
    metadata: {
      provider: "slack",
    },
  });

  if (!rateLimit.allowed) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!signingSecret) {
    return Response.json({ error: "Missing SLACK_SIGNING_SECRET." }, { status: 500 });
  }

  const body = await request.text();
  const headerStore = await headers();
  const isVerified = verifySlackSignature({
    body,
    signature: headerStore.get("x-slack-signature"),
    timestamp: headerStore.get("x-slack-request-timestamp"),
    signingSecret,
  });

  if (!isVerified) {
    return Response.json({ error: "Invalid Slack signature." }, { status: 401 });
  }

  const payload = JSON.parse(body);

  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }

  const externalEventId =
    payload.event_id ??
    `${payload.team_id ?? "unknown"}:${payload.event?.event_ts ?? Date.now()}`;
  const eventType = payload.event?.type ?? payload.type ?? "unknown";
  const webhook = await recordWebhookEvent({
    provider: "slack",
    externalEventId,
    eventType,
    payload: {
      event_id: payload.event_id ?? null,
      team_id: payload.team_id ?? null,
      type: payload.type ?? null,
      event_type: payload.event?.type ?? null,
    },
  });

  if (webhook.duplicate) {
    return Response.json({ received: true, duplicate: true });
  }

  await logAuditEvent({
    eventType: "slack_webhook_received",
    targetType: "webhook_event",
    targetId: webhook.id,
    metadata: {
      teamId: payload.team_id ?? null,
      eventType,
    },
  });

  const teamId = payload.team_id ?? payload.authorizations?.[0]?.team_id;

  if (!teamId) {
    await markWebhookUnmapped(webhook.id);
    await logAuditEvent({
      eventType: "slack_webhook_unmapped",
      targetType: "webhook_event",
      targetId: webhook.id,
      metadata: {
        reason: "missing_team_id",
        eventType,
      },
    });
    return Response.json({ received: true, mapped: false });
  }

  const supabase = createAdminClient();
  const { data: integration } = await supabase
    .from("tenant_integrations")
    .select("id, tenant_id")
    .eq("provider", "slack")
    .eq("external_team_id", teamId)
    .maybeSingle();

  if (!integration) {
    await markWebhookUnmapped(webhook.id);
    await logAuditEvent({
      eventType: "slack_webhook_unmapped",
      targetType: "webhook_event",
      targetId: webhook.id,
      metadata: {
        teamId,
        eventType,
      },
    });
    return Response.json({ received: true, mapped: false });
  }

  try {
    await supabase.from("integration_events").insert({
      tenant_id: integration.tenant_id,
      integration_id: integration.id,
      provider: "slack",
      external_event_id: payload.event_id,
      event_type: eventType,
      payload,
    });

    await markWebhookProcessed(webhook.id, integration.tenant_id);
    await logAuditEvent({
      tenantId: integration.tenant_id,
      eventType: "slack_webhook_mapped",
      targetType: "webhook_event",
      targetId: webhook.id,
      metadata: {
        teamId,
        eventType,
      },
    });
    await logAuditEvent({
      tenantId: integration.tenant_id,
      eventType: "integration_event_saved",
      targetType: "integration_event",
      metadata: {
        provider: "slack",
        teamId,
        eventType,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await markWebhookFailed(webhook.id, message);
    await logAuditEvent({
      tenantId: integration.tenant_id,
      eventType: "slack_webhook_failed",
      targetType: "webhook_event",
      targetId: webhook.id,
      metadata: {
        teamId,
        eventType,
        error: message,
      },
    });
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return Response.json({ received: true, mapped: true });
}
