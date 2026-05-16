import { requireApiTenant } from "@/lib/auth/api";
import { calculateAndStoreMetricSnapshots, periodFromSearch } from "@/lib/metrics/server";
import { logAuditEvent } from "@/lib/security/audit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = await requireApiTenant();
  if ("error" in context) return context.error;

  const url = new URL(request.url);
  const periodKey = periodFromSearch(url.searchParams.get("period"));

  try {
    const result = await calculateAndStoreMetricSnapshots({
      tenantId: context.tenant.id,
      periodKey,
    });

    await logAuditEvent({
      tenantId: context.tenant.id,
      actorUserId: context.user.id,
      eventType: "metrics_recalculated",
      targetType: "metric_snapshots",
      metadata: {
        periodKey,
        periodStart: result.window.startDate,
        periodEnd: result.window.endDate,
      },
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    const auditMessage = error instanceof Error ? error.message : "Unable to refresh metrics.";
    const message = "Unable to refresh metrics.";
    await logAuditEvent({
      tenantId: context.tenant.id,
      actorUserId: context.user.id,
      eventType: "metrics_recalculate_failed",
      targetType: "metric_snapshots",
      metadata: { periodKey, error: auditMessage },
    });
    return Response.json({ error: message }, { status: 500 });
  }
}
