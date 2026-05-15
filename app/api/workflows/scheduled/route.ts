import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}

export async function POST(request: Request) {
  const secret = process.env.SCHEDULE_WORKER_SECRET;
  const authorization = request.headers.get("authorization");
  const workerSecret = request.headers.get("x-schedule-worker-secret");

  if (!secret || (authorization !== `Bearer ${secret}` && workerSecret !== secret)) {
    return unauthorized();
  }

  const payload = await request.json().catch(() => ({}));
  const scheduleId = typeof payload.scheduleId === "string" ? payload.scheduleId : null;
  const tenantId = typeof payload.tenantId === "string" ? payload.tenantId : null;

  if (!scheduleId || !tenantId) {
    return Response.json({ error: "tenantId and scheduleId are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const idempotencyKey =
    typeof payload.idempotencyKey === "string"
      ? payload.idempotencyKey
      : `${scheduleId}:${new Date().toISOString().slice(0, 13)}`;
  const { data: run, error } = await admin
    .from("integration_workflow_runs")
    .insert({
      tenant_id: tenantId,
      schedule_id: scheduleId,
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
    metadata: { scheduleId },
  });

  return Response.json({ runId: run.id });
}
