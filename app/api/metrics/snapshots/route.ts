import { requireApiTenant } from "@/lib/auth/api";
import { loadMetricSnapshotPayload, periodFromSearch } from "@/lib/metrics/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await requireApiTenant();
  if ("error" in context) return context.error;

  const url = new URL(request.url);
  const periodKey = periodFromSearch(url.searchParams.get("period"));
  const payload = await loadMetricSnapshotPayload({
    supabase: context.supabase,
    tenantId: context.tenant.id,
    periodKey,
  });

  return Response.json(payload);
}
