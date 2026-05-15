import { requireAdminContext } from "@/lib/api/context";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const { data, error } = await context.supabase
    .from("agent_deployments")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ deployments: data ?? [] });
}
