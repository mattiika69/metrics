"use server";

import { redirect } from "next/navigation";
import { classifyAgentOperation } from "@/lib/agent/channel";
import { runUnifiedAgent } from "@/lib/agent/runner";
import { requireTenant } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/security/audit";
import { createApprovedTeamInvitation } from "@/lib/settings/team-invite-service";
import { createAdminClient } from "@/lib/supabase/admin";

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createWebAgentRequestAction(formData: FormData) {
  const { tenant, user, membership } = await requireTenant();

  const requestText = formText(formData, "requestText");
  const operation = formText(formData, "operation") || classifyAgentOperation(requestText);

  if (!requestText) {
    redirect("/settings/agent?error=request_required");
  }

  try {
    await runUnifiedAgent({
      tenantId: tenant.id,
      platform: "web",
      requestText,
      webUserId: user.id,
      webUserRole: membership.role,
      externalWorkspaceId: "web",
      externalConversationId: `web:${tenant.id}:${user.id}`,
      externalUserId: user.id,
      externalUserName: user.email ?? null,
      conversationType: "web_chat",
      metadata: {
        source: "web",
        operation,
        capabilities: ["read", "write", "edit", "delete"],
      },
    });
  } catch (error) {
    redirect(`/settings/agent?error=${encodeURIComponent(error instanceof Error ? error.message : "Agent request failed.")}`);
  }

  redirect("/settings/agent?message=agent_request_saved");
}

export async function saveAgentLearningAction(formData: FormData) {
  const { supabase, tenant, user, membership } = await requireTenant();

  if (membership.role !== "owner" && membership.role !== "admin") {
    redirect("/settings/agent?error=owner_or_admin_required");
  }

  const title = formText(formData, "title") || "Saved learning";
  const body = formText(formData, "body");

  if (!body) {
    redirect("/settings/agent?error=learning_required");
  }

  const { data, error } = await supabase
    .from("metric_learnings")
    .insert({
      tenant_id: tenant.id,
      title,
      source: "AI Agent",
      body,
      source_provider: "web",
      source_channel: "app",
      created_by_user_id: user.id,
      updated_by_user_id: user.id,
      metadata: { source: "manual" },
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/settings/agent?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "agent_learning_saved",
    targetType: "metric_learnings",
    targetId: data.id,
    metadata: { provider: "web" },
  });

  redirect("/settings/agent?message=learning_saved");
}

function requireAgentAdmin(role: string) {
  return role === "owner" || role === "admin";
}

export async function approveAgentApprovalAction(formData: FormData) {
  const { tenant, user, membership } = await requireTenant();
  if (!requireAgentAdmin(membership.role)) {
    redirect("/settings/agent?error=owner_or_admin_required");
  }

  const approvalId = formText(formData, "approvalId");
  if (!approvalId) redirect("/settings/agent?error=approval_required");

  const admin = createAdminClient();
  const { data: approval, error } = await admin
    .from("agent_approvals")
    .select("id, agent_request_id, action_type, action_payload")
    .eq("tenant_id", tenant.id)
    .eq("id", approvalId)
    .eq("status", "pending")
    .maybeSingle();
  if (error || !approval) {
    redirect(`/settings/agent?error=${encodeURIComponent(error?.message ?? "Approval not found.")}`);
  }

  let executedAction: Record<string, unknown> | null = null;
  if (approval.action_type === "team_invite") {
    const actionPayload = approval.action_payload && typeof approval.action_payload === "object"
      ? approval.action_payload as { email?: unknown; role?: unknown }
      : {};
    const email = typeof actionPayload.email === "string" ? actionPayload.email : "";
    const role = actionPayload.role === "admin" ? "admin" : "member";
    try {
      executedAction = await createApprovedTeamInvitation({
        tenantId: tenant.id,
        tenantName: tenant.name,
        actorUserId: user.id,
        email,
        role,
        source: "agent",
      });
    } catch (approvalError) {
      redirect(`/settings/agent?error=${encodeURIComponent(approvalError instanceof Error ? approvalError.message : "Approval failed.")}`);
    }
  }

  await admin
    .from("agent_approvals")
    .update({
      approved_by_user_id: user.id,
      status: "approved",
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", approval.id);

  if (approval.agent_request_id) {
    await admin
      .from("agent_requests")
      .update({
        status: executedAction ? "completed" : "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenant.id)
      .eq("id", approval.agent_request_id);
  }

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "agent_approval_approved",
    targetType: "agent_approvals",
    targetId: approval.id,
    metadata: { executedAction },
  });

  redirect("/settings/agent?message=approval_approved");
}

export async function rejectAgentApprovalAction(formData: FormData) {
  const { tenant, user, membership } = await requireTenant();
  if (!requireAgentAdmin(membership.role)) {
    redirect("/settings/agent?error=owner_or_admin_required");
  }

  const approvalId = formText(formData, "approvalId");
  if (!approvalId) redirect("/settings/agent?error=approval_required");

  const admin = createAdminClient();
  const { data: approval, error } = await admin
    .from("agent_approvals")
    .update({
      approved_by_user_id: null,
      status: "rejected",
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenant.id)
    .eq("id", approvalId)
    .eq("status", "pending")
    .select("id, agent_request_id")
    .maybeSingle();

  if (error || !approval) {
    redirect(`/settings/agent?error=${encodeURIComponent(error?.message ?? "Approval not found.")}`);
  }

  if (approval.agent_request_id) {
    await admin
      .from("agent_requests")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("tenant_id", tenant.id)
      .eq("id", approval.agent_request_id);
  }

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "agent_approval_rejected",
    targetType: "agent_approvals",
    targetId: approval.id,
  });

  redirect("/settings/agent?message=approval_rejected");
}
