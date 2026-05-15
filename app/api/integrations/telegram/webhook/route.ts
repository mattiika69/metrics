import { headers } from "next/headers";
import { sendTelegramMessage } from "@/lib/integrations/telegram";
import { buildChannelCommandResponse, resolveChannelCommand } from "@/lib/metrics/channel";
import { logAuditEvent } from "@/lib/security/audit";
import {
  markWebhookFailed,
  markWebhookProcessed,
  markWebhookUnmapped,
  recordWebhookEvent,
} from "@/lib/security/webhooks";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type TelegramPayload = {
  update_id?: number | string;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
};

type TelegramMessage = {
  message_id?: number | string;
  text?: string;
  chat?: {
    id?: number | string;
    title?: string;
    username?: string;
  };
  from?: {
    id?: number | string;
  };
};

function messageFromPayload(payload: TelegramPayload) {
  return payload.message ?? payload.edited_message ?? payload.channel_post ?? null;
}

function commandFromText(text: string) {
  const trimmed = text.trim();
  if (/^\/start(?:@\S+)?/i.test(trimmed)) return "start";
  if (/^\/link(?:@\S+)?/i.test(trimmed)) return "link";
  return resolveChannelCommand(trimmed);
}

function codeFromText(text: string) {
  const trimmed = text.trim();
  const parts = trimmed.split(/\s+/);
  if (/^\/start/i.test(parts[0]) || /^\/link/i.test(parts[0])) return parts[1]?.toUpperCase() ?? null;
  if (/^[A-F0-9]{8}$/i.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

async function consumeLinkCode({
  code,
  chatId,
  chatTitle,
  fromUserId,
}: {
  code: string;
  chatId: string;
  chatTitle: string | null;
  fromUserId: string | null;
}) {
  const admin = createAdminClient();
  const { data: link } = await admin
    .from("telegram_link_codes")
    .select("id, tenant_id, expires_at, consumed_at")
    .eq("code", code)
    .maybeSingle();

  if (!link || link.consumed_at || new Date(link.expires_at).getTime() < Date.now()) {
    return { ok: false as const, message: "That Telegram link code is invalid or expired." };
  }

  const { data: existing } = await admin
    .from("tenant_integrations")
    .select("id")
    .eq("tenant_id", link.tenant_id)
    .eq("provider", "telegram")
    .eq("external_channel_id", chatId)
    .maybeSingle();

  const row = {
    tenant_id: link.tenant_id,
    provider: "telegram",
    status: "active",
    external_channel_id: chatId,
    external_user_id: fromUserId,
    display_name: chatTitle ?? "Telegram",
    settings: { linkedBy: "code" },
    updated_at: new Date().toISOString(),
  };

  const result = existing
    ? await admin.from("tenant_integrations").update(row).eq("id", existing.id).select("id").single()
    : await admin.from("tenant_integrations").insert(row).select("id").single();

  if (result.error) return { ok: false as const, message: result.error.message };

  await admin
    .from("telegram_link_codes")
    .update({ consumed_at: new Date().toISOString(), consumed_chat_id: chatId })
    .eq("id", link.id);
  await admin.from("telegram_links").upsert(
    {
      tenant_id: link.tenant_id,
      telegram_chat_id: chatId,
      telegram_user_id: fromUserId,
      display_name: chatTitle ?? "Telegram",
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,telegram_chat_id" },
  );

  await logAuditEvent({
    tenantId: link.tenant_id,
    eventType: "telegram_connected",
    targetType: "telegram",
    targetId: chatId,
    metadata: { chatTitle },
  });

  return {
    ok: true as const,
    tenantId: link.tenant_id,
    integrationId: result.data.id,
    message: "Telegram is linked. Try /metrics, /constraints, /forecast, /marketing, /sales, /retention, or /finance.",
  };
}

export async function POST(request: Request) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!webhookSecret) return Response.json({ error: "Missing TELEGRAM_WEBHOOK_SECRET." }, { status: 500 });

  const headerStore = await headers();
  if (headerStore.get("x-telegram-bot-api-secret-token") !== webhookSecret) {
    return Response.json({ error: "Invalid Telegram secret." }, { status: 401 });
  }

  const payload = (await request.json()) as TelegramPayload;
  const message = messageFromPayload(payload);
  const chatId = message?.chat?.id ? String(message.chat.id) : "";
  const text = typeof message?.text === "string" ? message.text : "";
  const externalEventId = payload.update_id ? String(payload.update_id) : `unknown:${Date.now()}`;
  const webhook = await recordWebhookEvent({
    provider: "telegram",
    externalEventId,
    eventType: "telegram_update",
    payload: { update_id: payload.update_id ?? null, chat_id: chatId || null },
  });
  if (webhook.duplicate) return Response.json({ received: true, duplicate: true });

  const admin = createAdminClient();
  await admin.from("integration_inbound_events").insert({
    provider: "telegram",
    external_event_id: externalEventId,
    event_type: "telegram_update",
    payload: { update_id: payload.update_id ?? null, chat_id: chatId || null },
  });

  if (!chatId) {
    await markWebhookUnmapped(webhook.id);
    return Response.json({ received: true, mapped: false });
  }

  const linkCode = codeFromText(text);
  if (linkCode) {
    const result = await consumeLinkCode({
      code: linkCode,
      chatId,
      chatTitle: message?.chat?.title ?? message?.chat?.username ?? null,
      fromUserId: message?.from?.id ? String(message.from.id) : null,
    });
    await sendTelegramMessage({ chatId, text: result.message });
    if (result.ok) {
      await admin.from("integration_outbound_messages").insert({
        tenant_id: result.tenantId,
        provider: "telegram",
        target_id: chatId,
        body: result.message,
        payload: { linkCode },
        status: "sent",
      });
    }
    if (result.ok) {
      await markWebhookProcessed(webhook.id, result.tenantId);
      return Response.json({ received: true, linked: true });
    }
    await markWebhookUnmapped(webhook.id);
    return Response.json({ received: true, linked: false });
  }

  const { data: integration } = await admin
    .from("tenant_integrations")
    .select("id, tenant_id")
    .eq("provider", "telegram")
    .eq("external_channel_id", chatId)
    .neq("status", "disabled")
    .maybeSingle();

  if (!integration) {
    await markWebhookUnmapped(webhook.id);
    if (commandFromText(text) === "start") {
      await sendTelegramMessage({
        chatId,
        text: "Open HyperOptimal Metrics > Settings > Telegram, generate a link code, then send /link CODE here.",
      });
    }
    return Response.json({ received: true, mapped: false });
  }

  try {
    await admin
      .from("integration_inbound_events")
      .update({ tenant_id: integration.tenant_id, status: "mapped" })
      .eq("provider", "telegram")
      .eq("external_event_id", externalEventId);

    await admin.from("integration_events").insert({
      tenant_id: integration.tenant_id,
      integration_id: integration.id,
      provider: "telegram",
      external_event_id: externalEventId,
      event_type: "telegram_update",
      payload,
    });
    await admin.from("integration_messages").insert({
      tenant_id: integration.tenant_id,
      integration_id: integration.id,
      provider: "telegram",
      direction: "inbound",
      external_message_id: message?.message_id ? String(message.message_id) : null,
      external_channel_id: chatId,
      external_user_id: message?.from?.id ? String(message.from.id) : null,
      body: text,
      payload,
    });

    const command = commandFromText(text);
    let responseText: string | null = null;
    if (command && command !== "start" && command !== "link") {
      responseText = await buildChannelCommandResponse(integration.tenant_id, command);
    }
    if (command === "start") {
      responseText = "Telegram is linked. Try /metrics, /constraints, /forecast, /marketing, /sales, /retention, or /finance.";
    }

    if (responseText) {
      await sendTelegramMessage({ chatId, text: responseText });
      await admin.from("integration_messages").insert({
        tenant_id: integration.tenant_id,
        integration_id: integration.id,
        provider: "telegram",
        direction: "outbound",
        external_channel_id: chatId,
        body: responseText,
        payload: { command },
      });
      await admin.from("integration_outbound_messages").insert({
        tenant_id: integration.tenant_id,
        provider: "telegram",
        target_id: chatId,
        body: responseText,
        payload: { command },
        status: "sent",
      });
    }

    await markWebhookProcessed(webhook.id, integration.tenant_id);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Telegram webhook failed.";
    await markWebhookFailed(webhook.id, errorMessage);
    return Response.json({ error: errorMessage }, { status: 500 });
  }

  return Response.json({ received: true, mapped: true });
}
