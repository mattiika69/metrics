import { requireAdminContext } from "@/lib/api/context";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function requestedRole(value: unknown) {
  if (value === "owner" || value === "admin" || value === "member") return value;
  return null;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const { id } = await params;
  const payload = await request.json().catch(() => ({}));
  const role = requestedRole(payload.role);

  if (!role) return Response.json({ error: "Valid role is required." }, { status: 400 });
  if (role === "owner" && context.membership.role !== "owner") {
    return Response.json({ error: "Only owners can grant owner access." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("tenant_memberships")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("tenant_id", context.tenant.id)
    .eq("user_id", id);

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "team_member_role_changed",
    targetType: "tenant_membership",
    targetId: id,
    metadata: { role },
  });

  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const { id } = await params;

  if (id === context.user.id) {
    return Response.json({ error: "You cannot remove yourself." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("tenant_memberships")
    .delete()
    .eq("tenant_id", context.tenant.id)
    .eq("user_id", id);

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "team_member_removed",
    targetType: "tenant_membership",
    targetId: id,
  });

  return Response.json({ ok: true });
}
