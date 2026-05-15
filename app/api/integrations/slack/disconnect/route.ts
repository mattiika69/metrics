import { requireAdminContext } from "@/lib/api/context";
import { logAuditEvent } from "@/lib/security/audit";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const { error } = await context.supabase
    .from("tenant_integrations")
    .update({ status: "disabled", updated_at: new Date().toISOString() })
    .eq("tenant_id", context.tenant.id)
    .eq("provider", "slack");

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "slack_disconnected",
    targetType: "tenant_integrations",
  });

  return Response.json({ ok: true });
}
