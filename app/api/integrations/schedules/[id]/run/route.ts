import { requireAdminContext } from "@/lib/api/context";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const { id } = await params;
  const admin = createAdminClient();
  const { data: schedule, error: readError } = await admin
    .from("integration_workflow_schedules")
    .select("id, workflow_key, target_providers, slack_channel_id, telegram_chat_id")
    .eq("tenant_id", context.tenant.id)
    .eq("id", id)
    .maybeSingle();

  if (readError || !schedule) {
    return Response.json({ error: readError?.message ?? "Schedule not found." }, { status: 404 });
  }

  const { data: run, error } = await admin
    .from("integration_workflow_runs")
    .insert({
      tenant_id: context.tenant.id,
      schedule_id: id,
      status: "completed",
      target_provider: Array.isArray(schedule.target_providers)
        ? schedule.target_providers.join(",")
        : null,
      target_channel_id: schedule.slack_channel_id ?? schedule.telegram_chat_id ?? null,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      output_metadata: { workflowKey: schedule.workflow_key, runMode: "manual" },
      idempotency_key: `${id}:api:${Date.now()}`,
    })
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await admin.from("integration_workflow_run_events").insert({
    tenant_id: context.tenant.id,
    run_id: run.id,
    event_type: "manual_run_completed",
    metadata: { workflowKey: schedule.workflow_key },
  });

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "workflow_schedule_run_now",
    targetType: "integration_workflow_schedules",
    targetId: id,
    metadata: { runId: run.id },
  });

  return Response.json({ run });
}
