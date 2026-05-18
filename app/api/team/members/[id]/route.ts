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

type TeamRole = "owner" | "admin" | "member";

type TeamMembershipRow = {
  tenant_id: string;
  user_id: string;
  role: TeamRole;
};

async function getTargetMembership(tenantId: string, userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenant_memberships")
    .select("tenant_id, user_id, role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { error: Response.json({ error: error.message }, { status: 400 }) };
  if (!data) return { error: Response.json({ error: "Team member was not found." }, { status: 404 }) };
  return { membership: data as TeamMembershipRow };
}

async function getOwnerCount(tenantId: string) {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("tenant_memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("role", "owner");

  if (error) return { error: Response.json({ error: error.message }, { status: 400 }) };
  return { count: count ?? 0 };
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const { id } = await params;
  const payload = await request.json().catch(() => ({}));
  const role = requestedRole(payload.role);

  if (!role) return Response.json({ error: "Valid role is required." }, { status: 400 });
  if (id === context.user.id) {
    return Response.json({ error: "You cannot change your own role." }, { status: 400 });
  }

  if (role === "owner" && context.membership.role !== "owner") {
    return Response.json({ error: "Only owners can grant owner access." }, { status: 403 });
  }

  const admin = createAdminClient();
  const targetResult = await getTargetMembership(context.tenant.id, id);
  if ("error" in targetResult) return targetResult.error;
  const target = targetResult.membership;

  if (target.role === "owner" && context.membership.role !== "owner") {
    return Response.json(
      { error: "Only owners can change owner permissions." },
      { status: 403 },
    );
  }

  if (target.role === "owner" && role !== "owner") {
    const ownerCount = await getOwnerCount(context.tenant.id);
    if ("error" in ownerCount) return ownerCount.error;
    if (ownerCount.count <= 1) {
      return Response.json(
        { error: "Workspace must keep at least one owner." },
        { status: 400 },
      );
    }
  }

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
    metadata: { previousRole: target.role, role },
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
  const targetResult = await getTargetMembership(context.tenant.id, id);
  if ("error" in targetResult) return targetResult.error;
  const target = targetResult.membership;

  if (target.role === "owner" && context.membership.role !== "owner") {
    return Response.json({ error: "Only owners can remove owners." }, { status: 403 });
  }

  if (target.role === "owner") {
    const ownerCount = await getOwnerCount(context.tenant.id);
    if ("error" in ownerCount) return ownerCount.error;
    if (ownerCount.count <= 1) {
      return Response.json(
        { error: "Workspace must keep at least one owner." },
        { status: 400 },
      );
    }
  }

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
    metadata: { previousRole: target.role },
  });

  return Response.json({ ok: true });
}
