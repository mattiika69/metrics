import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireTenant } from "@/lib/auth/session";
import { integrationCatalog, integrationGroups } from "@/lib/integrations/catalog";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function IntegrationsPage({ searchParams }: PageProps) {
  const { supabase, tenant } = await requireTenant();
  const params = await searchParams;
  const message = param(params, "message");
  const [{ data: metricConnections }, { data: messagingConnections }] = await Promise.all([
    supabase
      .from("metric_integrations")
      .select("provider, status, last_sync_at, last_error")
      .eq("tenant_id", tenant.id),
    supabase
      .from("tenant_integrations")
      .select("provider, status, updated_at")
      .eq("tenant_id", tenant.id),
  ]);
  const metricByProvider = new Map((metricConnections ?? []).map((connection) => [connection.provider, connection]));
  const messageByProvider = new Map((messagingConnections ?? []).map((connection) => [connection.provider, connection]));

  return (
    <AppShell active="integrations" tenantName={tenant.name}>
      <section className="page-header compact">
        <p className="eyebrow">Integrations</p>
        <h1>Connections</h1>
        <p className="lede">Connect only the providers that feed metrics, constraints, Slack, and Telegram.</p>
        {message ? <p className="notice">{message}</p> : null}
      </section>

      <div className="integration-sections">
        {integrationGroups.map((group) => (
          <section className="wide-panel" key={group}>
            <h2>{group}</h2>
            <div className="integration-grid">
              {integrationCatalog.filter((integration) => integration.group === group).map((integration) => {
                const row = group === "Messaging"
                  ? messageByProvider.get(integration.id)
                  : metricByProvider.get(integration.id);
                const rowRecord = row as Record<string, unknown> | undefined;
                const lastSyncAt = typeof rowRecord?.last_sync_at === "string" ? rowRecord.last_sync_at : null;
                const connected = Boolean(row && row.status !== "disabled");
                return (
                  <Link href={`/integrations/${integration.id}`} className="integration-card" key={integration.id}>
                    <div className="card-topline">
                      <span>{integration.group}</span>
                      <strong>{integration.comingSoon ? "Coming soon" : connected ? "Connected" : "Not connected"}</strong>
                    </div>
                    <h2>{integration.name}</h2>
                    <p>{integration.description}</p>
                    {lastSyncAt ? (
                      <span className="muted">Last sync {new Date(lastSyncAt).toLocaleString()}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
