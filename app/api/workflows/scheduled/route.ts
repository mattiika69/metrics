import { timingSafeEqualString } from "@/lib/security/constant-time";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function POST(request: Request) {
  const secret = process.env.SCHEDULE_WORKER_SECRET;
  const authorization = request.headers.get("authorization");
  const workerSecret = request.headers.get("x-schedule-worker-secret");

  const authorized =
    timingSafeEqualString(authorization, `Bearer ${secret}`) ||
    timingSafeEqualString(workerSecret, secret);

  if (!secret || !authorized) {
    return unauthorized();
  }

  const payload = await request.json().catch(() => ({}));
  const scheduleId = typeof payload.scheduleId === "string" ? payload.scheduleId : null;
  const tenantId = typeof payload.tenantId === "string" ? payload.tenantId : null;

  if (!scheduleId || !tenantId || !isUuid(scheduleId) || !isUuid(tenantId)) {
    return Response.json({ error: "tenantId and scheduleId are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: schedule, error: scheduleError } = await admin
    .from("integration_workflow_schedules")
    .select("id, enabled, archived_at")
    .eq("id", scheduleId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (scheduleError) {
    return Response.json({ error: "Unable to verify schedule." }, { status: 500 });
  }

  if (!schedule) {
    return Response.json({ error: "Schedule not found." }, { status: 404 });
  }

  if (!schedule.enabled || schedule.archived_at) {
    return Response.json({ error: "Schedule is not active." }, { status: 409 });
  }

  const idempotencyKey =
    typeof payload.idempotencyKey === "string"
      ? payload.idempotencyKey
      : `${scheduleId}:${new Date().toISOString().slice(0, 13)}`;
  const { data: run, error } = await admin
    .from("integration_workflow_runs")
    .insert({
      tenant_id: tenantId,
      schedule_id: schedule.id,
      status: "queued",
      idempotency_key: idempotencyKey,
      output_metadata: { source: "scheduled_worker" },
    })
    .select("*")
    .single();

  if (error?.code === "23505") {
    return Response.json({ duplicate: true });
  }

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await admin
    .from("integration_workflow_runs")
    .update({
      status: "completed",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id);

  await admin.from("integration_workflow_run_events").insert({
    tenant_id: tenantId,
    run_id: run.id,
    event_type: "scheduled_run_completed",
    metadata: { scheduleId: schedule.id },
  });

  return Response.json({ runId: run.id });
}
