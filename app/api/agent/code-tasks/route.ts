import { requireAdminContext } from "@/lib/api/context";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const payload = await request.json().catch(() => ({}));
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agent_code_tasks")
    .insert({
      tenant_id: context.tenant.id,
      agent_request_id: payload.agentRequestId ?? null,
      github_repo: payload.githubRepo ?? "mattiika69/metrics",
      branch_name: payload.branchName ?? null,
      status: "queued",
      summary: payload.summary ?? null,
    })
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "agent_code_task_created",
    targetType: "agent_code_tasks",
    targetId: data.id,
  });

  return Response.json({ codeTask: data }, { status: 201 });
}
