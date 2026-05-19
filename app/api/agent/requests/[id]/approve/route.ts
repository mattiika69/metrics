import { requireAdminContext } from "@/lib/api/context";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const { id } = await params;
  const payload = await request.json().catch(() => ({}));
  const admin = createAdminClient();

  const { data: requestRow, error: requestReadError } = await admin
    .from("agent_requests")
    .select("id, status")
    .eq("tenant_id", context.tenant.id)
    .eq("id", id)
    .maybeSingle();

  if (requestReadError) {
    return Response.json({ error: requestReadError.message }, { status: 400 });
  }

  if (!requestRow) {
    return Response.json({ error: "Agent request not found." }, { status: 404 });
  }

  const { error: approvalError } = await admin.from("agent_approvals").insert({
    tenant_id: context.tenant.id,
    agent_request_id: id,
    approved_by_user_id: context.user.id,
    status: "approved",
    decision_notes: payload.notes ?? null,
  });

  if (approvalError) {
    return Response.json({ error: approvalError.message }, { status: 400 });
  }

  const { data: approvedRequest, error } = await admin
    .from("agent_requests")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("tenant_id", context.tenant.id)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  if (!approvedRequest) {
    return Response.json({ error: "Agent request not found." }, { status: 404 });
  }

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "agent_request_approved",
    targetType: "agent_requests",
    targetId: id,
  });

  return Response.json({ ok: true });
}
