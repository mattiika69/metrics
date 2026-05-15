"use server";

import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/security/audit";

export async function saveAiContextDocAction(formData: FormData) {
  const { supabase, tenant, user } = await requireTenant();
  const content = String(formData.get("content") ?? "");
  const { error } = await supabase.from("ai_context_docs").upsert(
    {
      tenant_id: tenant.id,
      content,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "tenant_id",
    },
  );

  if (error) {
    redirect("/ai-context-doc?message=Unable to save");
  }

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "ai_context_doc_updated",
    targetType: "ai_context_doc",
  });
  redirect("/ai-context-doc?message=Saved");
}
