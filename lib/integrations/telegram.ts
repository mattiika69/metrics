import { randomBytes } from "node:crypto";

export function createTelegramLinkCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

function telegramApiUrl(method: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN.");
  return `https://api.telegram.org/bot${token}/${method}`;
}

export async function getTelegramBotStatus() {
  const response = await fetch(telegramApiUrl("getMe"), { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  return {
    ok: response.ok && payload?.ok === true,
    status: response.status,
    username: payload?.result?.username ?? null,
    payload,
  };
}

export async function getTelegramWebhookStatus() {
  const response = await fetch(telegramApiUrl("getWebhookInfo"), { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  return {
    ok: response.ok && payload?.ok === true,
    status: response.status,
    url: payload?.result?.url ?? null,
    pendingUpdateCount: payload?.result?.pending_update_count ?? null,
    payload,
  };
}

export async function sendTelegramMessage({
  chatId,
  text,
}: {
  chatId: string;
  text: string;
}) {
  const response = await fetch(telegramApiUrl("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const payload = await response.json().catch(() => null);
  return {
    ok: response.ok && payload?.ok === true,
    status: response.status,
    error: payload?.description ?? null,
    payload,
  };
}
