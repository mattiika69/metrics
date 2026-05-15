import { requireAdminContext } from "@/lib/api/context";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const { id } = await params;
  const { data, error } = await context.supabase
    .from("agent_requests")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .eq("id", id)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  if (!data) return Response.json({ error: "Agent request not found." }, { status: 404 });
  return Response.json({ request: data });
}
