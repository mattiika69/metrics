import { requireApiTenant } from "@/lib/auth/api";
import { getTelegramBotStatus, getTelegramWebhookStatus } from "@/lib/integrations/telegram";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await requireApiTenant();
  if ("error" in context) return context.error;

  const { data: connection } = await context.supabase
    .from("tenant_integrations")
    .select("id, status, external_channel_id, display_name, updated_at")
    .eq("tenant_id", context.tenant.id)
    .eq("provider", "telegram")
    .neq("status", "disabled")
    .maybeSingle();

  let bot = null;
  let webhook = null;
  try {
    [bot, webhook] = await Promise.all([
      getTelegramBotStatus(),
      getTelegramWebhookStatus(),
    ]);
  } catch {
    const message = "Telegram is unavailable right now.";
    return Response.json({ connection: connection ?? null, bot: { ok: false, error: message }, webhook: null });
  }

  return Response.json({ connection: connection ?? null, bot, webhook });
}
