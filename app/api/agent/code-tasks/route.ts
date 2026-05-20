import { requireAdminContext } from "@/lib/api/context";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const payload = await request.json().catch(() => ({}));
  const agentRequestId =
    typeof payload.agentRequestId === "string" && payload.agentRequestId.trim()
      ? payload.agentRequestId.trim()
      : null;

  if (agentRequestId && !isUuid(agentRequestId)) {
    return Response.json({ error: "Invalid agent request id." }, { status: 400 });
  }

  const admin = createAdminClient();

  if (agentRequestId) {
    const { data: agentRequest, error: agentRequestError } = await admin
      .from("agent_requests")
      .select("id")
      .eq("id", agentRequestId)
      .eq("tenant_id", context.tenant.id)
      .maybeSingle();

    if (agentRequestError) {
      return Response.json({ error: "Unable to verify agent request." }, { status: 500 });
    }

    if (!agentRequest) {
      return Response.json({ error: "Agent request not found." }, { status: 404 });
    }
  }

  const { data, error } = await admin
    .from("agent_code_tasks")
    .insert({
      tenant_id: context.tenant.id,
      agent_request_id: agentRequestId,
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
