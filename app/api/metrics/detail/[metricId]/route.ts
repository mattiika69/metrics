import { requireApiTenant } from "@/lib/auth/api";
import { getMetricDefinition } from "@/lib/metrics/definitions";
import { loadMetricSnapshotPayload, periodFromSearch } from "@/lib/metrics/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ metricId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireApiTenant();
  if ("error" in auth) return auth.error;

  const { metricId } = await context.params;
  const definition = getMetricDefinition(metricId);
  if (!definition) {
    return Response.json({ error: "Metric not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const periodKey = periodFromSearch(url.searchParams.get("period"));
  const payload = await loadMetricSnapshotPayload({
    supabase: auth.supabase,
    tenantId: auth.tenant.id,
    periodKey,
  });

  const { data: audit } = await auth.supabase
    .from("audit_events")
    .select("id, event_type, metadata, created_at, actor_user_id")
    .eq("tenant_id", auth.tenant.id)
    .eq("target_type", "metric")
    .eq("target_id", metricId)
    .order("created_at", { ascending: false })
    .limit(20);

  return Response.json({
    window: payload.window,
    definition,
    snapshot: payload.metrics[metricId] ?? null,
    audit: audit ?? [],
  });
}
