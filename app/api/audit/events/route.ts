import { requireTenantContext } from "@/lib/api/context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const result = await requireTenantContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 50), 200);
  const { data, error } = await context.supabase
    .from("admin_audit_log")
    .select("id, action, target_type, target_id, metadata, actor_user_id, created_at")
    .eq("tenant_id", context.tenant.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ events: data ?? [] });
}
