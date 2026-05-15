import { requireTenantContext } from "@/lib/api/context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const result = await requireTenantContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const scheduleId = new URL(request.url).searchParams.get("scheduleId");
  let query = context.supabase
    .from("integration_workflow_runs")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (scheduleId) query = query.eq("schedule_id", scheduleId);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ runs: data ?? [] });
}
