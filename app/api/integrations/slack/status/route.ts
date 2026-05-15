import { requireTenantContext } from "@/lib/api/context";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await requireTenantContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const { data } = await context.supabase
    .from("tenant_integrations")
    .select("id, provider, status, external_team_id, external_channel_id, display_name, updated_at")
    .eq("tenant_id", context.tenant.id)
    .eq("provider", "slack")
    .neq("status", "disabled");

  return Response.json({
    connected: Boolean(data?.length),
    installations: data ?? [],
  });
}
