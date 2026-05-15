import { requireApiTenant } from "@/lib/auth/api";
import { getMetricDefinition } from "@/lib/metrics/definitions";
import { loadMetricSnapshotPayload, periodFromSearch } from "@/lib/metrics/server";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = await requireApiTenant();
  if ("error" in context) return context.error;

  const body = await request.json().catch(() => null);
  const metricId = typeof body?.metricId === "string" ? body.metricId : "";
  const overrideValue = Number(body?.overrideValue);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : null;
  const periodKey = periodFromSearch(typeof body?.period === "string" ? body.period : "30d");

  if (!getMetricDefinition(metricId)) {
    return Response.json({ error: "Metric not found." }, { status: 404 });
  }

  if (!Number.isFinite(overrideValue)) {
    return Response.json({ error: "Override value must be numeric." }, { status: 400 });
  }

  const payload = await loadMetricSnapshotPayload({
    supabase: context.supabase,
    tenantId: context.tenant.id,
    periodKey,
  });
  const originalValue = payload.metrics[metricId]?.value ?? null;
  const admin = createAdminClient();

  await admin
    .from("metric_overrides")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("tenant_id", context.tenant.id)
    .eq("metric_id", metricId)
    .eq("period_key", payload.window.key)
    .eq("period_end", payload.window.endDate)
    .eq("active", true);

  const { error } = await admin.from("metric_overrides").insert({
    tenant_id: context.tenant.id,
    metric_id: metricId,
    period_key: payload.window.key,
    period_end: payload.window.endDate,
    override_value: overrideValue,
    original_value: originalValue,
    reason,
    overridden_by: context.user.id,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "metric_override_created",
    targetType: "metric",
    targetId: metricId,
    metadata: {
      periodKey: payload.window.key,
      periodEnd: payload.window.endDate,
      originalValue,
      overrideValue,
      reason,
    },
  });

  return Response.json({ ok: true });
}
