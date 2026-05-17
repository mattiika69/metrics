"use server";

import { redirect } from "next/navigation";
import { runAgentReply } from "@/lib/agent/assistant";
import { classifyAgentOperation } from "@/lib/agent/channel";
import { requireTenant } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createWebAgentRequestAction(formData: FormData) {
  const { supabase, tenant, user, membership } = await requireTenant();

  if (membership.role !== "owner" && membership.role !== "admin") {
    redirect("/settings/agent?error=owner_or_admin_required");
  }

  const requestText = formText(formData, "requestText");
  const operation = formText(formData, "operation") || classifyAgentOperation(requestText);

  if (!requestText) {
    redirect("/settings/agent?error=request_required");
  }

  const { data, error } = await supabase
    .from("agent_requests")
    .insert({
      tenant_id: tenant.id,
      requested_by_user_id: user.id,
      provider: "web",
      channel_id: "app",
      request_text: requestText,
      risk_level: "normal",
      metadata: {
        source: "web",
        operation,
        capabilities: ["read", "write", "edit"],
      },
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/settings/agent?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "agent_request_created",
    targetType: "agent_requests",
    targetId: data.id,
    metadata: { provider: "web", operation },
  });

  await runAgentReply({
    supabase: createAdminClient(),
    tenantId: tenant.id,
    requestId: data.id,
    provider: "web",
    channelId: "app",
    externalUserId: user.id,
    requestText,
  });

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
