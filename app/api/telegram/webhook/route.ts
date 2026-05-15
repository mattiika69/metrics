import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
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
  const chatId = String(
    payload.message?.chat?.id ??
      payload.edited_message?.chat?.id ??
      payload.channel_post?.chat?.id ??
      "",
  );

  if (!chatId) {
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
    return Response.json({ received: true, mapped: false });
  }

  await supabase.from("integration_events").insert({
    tenant_id: integration.tenant_id,
    integration_id: integration.id,
    provider: "telegram",
    external_event_id: payload.update_id ? String(payload.update_id) : null,
    event_type: "telegram_update",
    payload,
  });

  return Response.json({ received: true, mapped: true });
}
