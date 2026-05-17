"use server";

import { redirect } from "next/navigation";
import { classifyAgentOperation } from "@/lib/agent/channel";
import { requireTenant } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/security/audit";

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

  redirect("/settings/agent?message=agent_request_saved");
}
