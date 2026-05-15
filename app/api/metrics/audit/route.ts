import { requireApiTenant } from "@/lib/auth/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await requireApiTenant();
  if ("error" in context) return context.error;

  const { data, error } = await context.supabase
    .from("audit_events")
    .select("id, event_type, target_type, target_id, metadata, created_at, actor_user_id")
    .eq("tenant_id", context.tenant.id)
    .in("target_type", ["metric", "metric_snapshots", "integration", "slack", "telegram"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ events: data ?? [] });
}
