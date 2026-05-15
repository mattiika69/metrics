import { requireAdminContext } from "@/lib/api/context";
import { logAuditEvent } from "@/lib/security/audit";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const { id } = await params;
  const { error } = await context.supabase
    .from("agent_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("tenant_id", context.tenant.id)
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "agent_request_cancelled",
    targetType: "agent_requests",
    targetId: id,
  });

  return Response.json({ ok: true });
}
