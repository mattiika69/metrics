import { requireApiTenant } from "@/lib/auth/api";
import { integrationCatalog } from "@/lib/integrations/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await requireApiTenant();
  if ("error" in context) return context.error;

  const [{ data: metricRows }, { data: channelRows }] = await Promise.all([
    context.supabase
      .from("metric_integrations")
      .select("provider, status, display_name, external_account_id, last_sync_at, last_event_at, last_error")
      .eq("tenant_id", context.tenant.id),
    context.supabase
      .from("tenant_integrations")
      .select("provider, status, display_name, external_team_id, external_channel_id, updated_at")
      .eq("tenant_id", context.tenant.id),
  ]);

  const metricByProvider = new Map((metricRows ?? []).map((row) => [row.provider, row]));
  const channelByProvider = new Map((channelRows ?? []).map((row) => [row.provider, row]));

  const integrations = integrationCatalog.map((definition) => {
    const channel = channelByProvider.get(definition.id);
    const metric = metricByProvider.get(definition.id);
    const row = definition.group === "Messaging" ? channel : metric;
    const rowRecord = row as Record<string, unknown> | undefined;
    return {
      ...definition,
      connected: Boolean(row && row.status !== "disabled" && !definition.comingSoon),
      status: row?.status ?? (definition.comingSoon ? "coming_soon" : "not_connected"),
      displayName: row?.display_name ?? null,
      lastSyncAt: typeof rowRecord?.last_sync_at === "string" ? rowRecord.last_sync_at : null,
      lastEventAt: typeof rowRecord?.last_event_at === "string" ? rowRecord.last_event_at : null,
      lastError: typeof rowRecord?.last_error === "string" ? rowRecord.last_error : null,
    };
  });

  return Response.json({ integrations });
}
