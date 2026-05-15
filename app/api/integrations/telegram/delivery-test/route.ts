import { requireApiTenant } from "@/lib/auth/api";
import { sendTelegramMessage } from "@/lib/integrations/telegram";
import { logAuditEvent } from "@/lib/security/audit";

export const dynamic = "force-dynamic";

export async function POST() {
  const context = await requireApiTenant();
  if ("error" in context) return context.error;

  const { data: connection } = await context.supabase
    .from("tenant_integrations")
    .select("id, external_channel_id")
    .eq("tenant_id", context.tenant.id)
    .eq("provider", "telegram")
    .neq("status", "disabled")
    .maybeSingle();

  if (!connection?.external_channel_id) {
    return Response.json({ error: "Telegram is not linked yet." }, { status: 404 });
  }

  const result = await sendTelegramMessage({
    chatId: connection.external_channel_id,
    text: "HyperOptimal Metrics Telegram connection is working. Try /metrics or /constraints.",
  });

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: result.ok ? "telegram_delivery_test_sent" : "telegram_delivery_test_failed",
    targetType: "telegram",
    metadata: { status: result.status, error: result.error },
  });

  return Response.json(result, { status: result.ok ? 200 : 502 });
}
