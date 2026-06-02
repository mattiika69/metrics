import { requireAdminContext } from "@/lib/api/context";
import { logAuditEvent } from "@/lib/security/audit";
import { createApprovedTeamInvitation } from "@/lib/settings/team-invite-service";
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
    .select("id, status, metadata")
    .eq("tenant_id", context.tenant.id)
    .eq("id", id)
    .maybeSingle();

  if (requestReadError) {
    return Response.json({ error: requestReadError.message }, { status: 400 });
  }

  if (!requestRow) {
    return Response.json({ error: "Agent request not found." }, { status: 404 });
  }

  const { data: pendingApproval } = await admin
    .from("agent_approvals")
    .select("id, action_type, action_payload")
    .eq("tenant_id", context.tenant.id)
    .eq("agent_request_id", id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const approvalMutation = pendingApproval
    ? await admin
      .from("agent_approvals")
      .update({
        approved_by_user_id: context.user.id,
        status: "approved",
        decision_notes: payload.notes ?? null,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", pendingApproval.id)
    : await admin.from("agent_approvals").insert({
      tenant_id: context.tenant.id,
      agent_request_id: id,
      approved_by_user_id: context.user.id,
      status: "approved",
      decision_notes: payload.notes ?? null,
      decided_at: new Date().toISOString(),
    });

  if (approvalMutation.error) {
    return Response.json({ error: approvalMutation.error.message }, { status: 400 });
  }

  let executedAction: Record<string, unknown> | null = null;
  if (pendingApproval?.action_type === "team_invite") {
    const actionPayload = pendingApproval.action_payload && typeof pendingApproval.action_payload === "object"
      ? pendingApproval.action_payload as { email?: unknown; role?: unknown }
      : {};
    const email = typeof actionPayload.email === "string" ? actionPayload.email : "";
    const role = actionPayload.role === "admin" ? "admin" : "member";
    try {
      executedAction = await createApprovedTeamInvitation({
        tenantId: context.tenant.id,
        tenantName: context.tenant.name,
        actorUserId: context.user.id,
        email,
        role,
        source: "agent",
      });
    } catch (error) {
      return Response.json({
        error: error instanceof Error ? error.message : "Approved action could not be completed.",
      }, { status: 400 });
    }
  }

  const { data: approvedRequest, error } = await admin
    .from("agent_requests")
    .update({
      status: executedAction ? "completed" : "approved",
      updated_at: new Date().toISOString(),
      metadata: {
        ...(requestRow.metadata && typeof requestRow.metadata === "object" ? requestRow.metadata : {}),
        approvedBy: context.user.id,
        executedAction,
      },
    })
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
    metadata: { executedAction },
  });

  return Response.json({ ok: true });
}
