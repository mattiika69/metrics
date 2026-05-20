import { headers } from "next/headers";
import {
  buildAgentHelpResponse,
  buildAgentStatusResponse,
  createChannelAgentRequest,
  isAgentHelpRequest,
  isAgentStatusRequest,
  resolveAgentRequestText,
} from "@/lib/agent/channel";
import { hashTelegramLinkCode, sendTelegramMessage } from "@/lib/integrations/telegram";
import { buildChannelCommandResponse, resolveChannelCommand } from "@/lib/metrics/channel";
import { getRequestIp } from "@/lib/request/ip";
import { logAuditEvent } from "@/lib/security/audit";
import { timingSafeEqualString } from "@/lib/security/constant-time";
import { checkRateLimit } from "@/lib/security/rate-limit";
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
    username?: string;
    first_name?: string;
    last_name?: string;
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

function objectSettings(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function telegramUserName(message: TelegramMessage | null) {
  const from = message?.from;
  if (!from) return null;
  if (from.username) return `@${from.username}`;
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ").trim();
  return name || null;
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
    .select("id, tenant_id, created_by, expires_at, consumed_at")
    .eq("code", hashTelegramLinkCode(code))
    .maybeSingle();

  if (!link || link.consumed_at || new Date(link.expires_at).getTime() < Date.now()) {
    return { ok: false as const, message: "That Telegram link code is invalid or expired." };
  }

  const { data: existing } = await admin
    .from("tenant_integrations")
    .select("id, settings")
    .eq("tenant_id", link.tenant_id)
    .eq("provider", "telegram")
    .eq("external_channel_id", chatId)
    .maybeSingle();
  const { data: fallbackRows } = existing
    ? { data: [] }
    : await admin
        .from("tenant_integrations")
        .select("id, settings")
        .eq("tenant_id", link.tenant_id)
        .eq("provider", "telegram")
        .order("updated_at", { ascending: false })
        .limit(1);
  const fallback = fallbackRows?.[0] ?? null;
  const baseSettings = objectSettings(existing?.settings ?? fallback?.settings);

  const row = {
    tenant_id: link.tenant_id,
    provider: "telegram",
    status: "active",
    external_channel_id: chatId,
    external_user_id: fromUserId,
    display_name: chatTitle ?? "Telegram",
    settings: { ...baseSettings, linkedBy: "code", linkedByUserId: link.created_by },
    updated_at: new Date().toISOString(),
  };

  const targetRow = existing ?? fallback;
  const result = targetRow
    ? await admin.from("tenant_integrations").update(row).eq("id", targetRow.id).select("id").single()
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
      user_id: link.created_by,
      status: "active",
      settings: { linkedBy: "code" },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,telegram_chat_id" },
  );

  await logAuditEvent({
    tenantId: link.tenant_id,
    actorUserId: link.created_by,
    eventType: "telegram_connected",
    targetType: "telegram",
    targetId: chatId,
    metadata: { chatTitle },
  });

  return {
    ok: true as const,
    tenantId: link.tenant_id,
    integrationId: result.data.id,
    message: "Telegram is linked. Try /metrics, /constraints, /forecast, /inputs, /sales, /retention, or /finance.",
  };
}

export async function POST(request: Request) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!webhookSecret) return Response.json({ error: "Missing TELEGRAM_WEBHOOK_SECRET." }, { status: 500 });

  const rateLimit = await checkRateLimit({
    route: "webhook:telegram",
    key: `telegram:${await getRequestIp()}`,
    limit: 120,
    windowSeconds: 60,
    metadata: { provider: "telegram" },
  });

  if (!rateLimit.allowed) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  const headerStore = await headers();
  if (!timingSafeEqualString(headerStore.get("x-telegram-bot-api-secret-token"), webhookSecret)) {
    return Response.json({ error: "Invalid Telegram secret." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as TelegramPayload | null;
  if (!payload) {
    return Response.json({ error: "Invalid Telegram payload." }, { status: 400 });
  }
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
        payload: { linked: true },
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
    const agentRequestText = command && command !== "start" && command !== "link"
      ? null
      : resolveAgentRequestText({ text, allowNaturalLanguage: true });
    let responseText: string | null = null;
    if (isAgentHelpRequest(text)) {
      responseText = buildAgentHelpResponse();
    } else if (isAgentStatusRequest(text)) {
      responseText = await buildAgentStatusResponse({
        tenantId: integration.tenant_id,
        provider: "telegram",
        channelId: chatId,
      });
    } else if (agentRequestText !== null) {
      responseText = (await createChannelAgentRequest({
        tenantId: integration.tenant_id,
        provider: "telegram",
        channelId: chatId,
        externalUserId: message?.from?.id ? String(message.from.id) : null,
        externalUserName: telegramUserName(message),
        requestText: agentRequestText,
        metadata: { messageId: message?.message_id ?? null },
      })).message;
    }
    if (agentRequestText === null && command && command !== "start" && command !== "link") {
      responseText = await buildChannelCommandResponse(integration.tenant_id, command);
    }
    if (command === "start") {
      responseText = "Telegram is linked. Try /metrics, /constraints, /forecast, /inputs, /sales, /retention, or /finance.";
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
        payload: { command, agent: agentRequestText !== null },
      });
      await admin.from("integration_outbound_messages").insert({
        tenant_id: integration.tenant_id,
        provider: "telegram",
        target_id: chatId,
        body: responseText,
        payload: { command, agent: agentRequestText !== null },
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
