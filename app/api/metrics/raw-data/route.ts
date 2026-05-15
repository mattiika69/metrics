import { requireApiTenant } from "@/lib/auth/api";
import { loadRawDataCounts } from "@/lib/metrics/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await requireApiTenant();
  if ("error" in context) return context.error;

  const sources = await loadRawDataCounts(context.supabase, context.tenant.id);
  return Response.json({ sources });
}
