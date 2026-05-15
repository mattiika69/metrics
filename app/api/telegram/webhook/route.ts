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

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit({
    route: "webhook:telegram",
    key: await getRequestIp(),
    limit: 120,
    windowSeconds: 60,
    metadata: {
      provider: "telegram",
    },
  });

  if (!rateLimit.allowed) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return Response.json(
      { error: "Missing TELEGRAM_WEBHOOK_SECRET." },
      { status: 500 },
    );
  }

  const headerStore = await headers();

  if (headerStore.get("x-telegram-bot-api-secret-token") !== webhookSecret) {
    return Response.json({ error: "Invalid Telegram secret." }, { status: 401 });
  }

  const payload = await request.json();
  const externalEventId = payload.update_id
    ? String(payload.update_id)
    : `unknown:${Date.now()}`;
  const webhook = await recordWebhookEvent({
    provider: "telegram",
    externalEventId,
    eventType: "telegram_update",
    payload: {
      update_id: payload.update_id ?? null,
      chat_id:
        payload.message?.chat?.id ??
        payload.edited_message?.chat?.id ??
        payload.channel_post?.chat?.id ??
        null,
    },
  });

  if (webhook.duplicate) {
    return Response.json({ received: true, duplicate: true });
  }

  await logAuditEvent({
    eventType: "telegram_webhook_received",
    targetType: "webhook_event",
    targetId: webhook.id,
    metadata: {
      updateId: payload.update_id ?? null,
    },
  });

  const chatId = String(
    payload.message?.chat?.id ??
      payload.edited_message?.chat?.id ??
      payload.channel_post?.chat?.id ??
      "",
  );

  if (!chatId) {
    await markWebhookUnmapped(webhook.id);
    await logAuditEvent({
      eventType: "telegram_webhook_unmapped",
      targetType: "webhook_event",
      targetId: webhook.id,
      metadata: {
        reason: "missing_chat_id",
      },
    });
    return Response.json({ received: true, mapped: false });
  }

  const supabase = createAdminClient();
  const { data: integration } = await supabase
    .from("tenant_integrations")
    .select("id, tenant_id")
    .eq("provider", "telegram")
    .eq("external_channel_id", chatId)
    .maybeSingle();

  if (!integration) {
    await markWebhookUnmapped(webhook.id);
    await logAuditEvent({
      eventType: "telegram_webhook_unmapped",
      targetType: "webhook_event",
      targetId: webhook.id,
      metadata: {
        chatId,
      },
    });
    return Response.json({ received: true, mapped: false });
  }

  try {
    await supabase.from("integration_events").insert({
      tenant_id: integration.tenant_id,
      integration_id: integration.id,
      provider: "telegram",
      external_event_id: payload.update_id ? String(payload.update_id) : null,
      event_type: "telegram_update",
      payload,
    });

    await markWebhookProcessed(webhook.id, integration.tenant_id);
    await logAuditEvent({
      tenantId: integration.tenant_id,
      eventType: "telegram_webhook_mapped",
      targetType: "webhook_event",
      targetId: webhook.id,
      metadata: {
        chatId,
      },
    });
    await logAuditEvent({
      tenantId: integration.tenant_id,
      eventType: "integration_event_saved",
      targetType: "integration_event",
      metadata: {
        provider: "telegram",
        chatId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await markWebhookFailed(webhook.id, message);
    await logAuditEvent({
      tenantId: integration.tenant_id,
      eventType: "telegram_webhook_failed",
      targetType: "webhook_event",
      targetId: webhook.id,
      metadata: {
        chatId,
        error: message,
      },
    });
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return Response.json({ received: true, mapped: true });
}
