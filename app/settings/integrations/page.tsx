import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { requireTenant } from "@/lib/auth/session";
import { integrationCatalog } from "@/lib/integrations/catalog";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

const integrationSections = [
  { title: "Payment Processors", ids: ["stripe", "fanbasis", "whop"] },
  { title: "Banking", ids: ["plaid", "csv-banking", "quickbooks"] },
  { title: "Sales Calls", ids: ["calendly", "calcom", "iclosed", "readai", "fathom", "fireflies"] },
  { title: "Forms/Leads", ids: ["typeform", "heyflow"] },
  { title: "Social Inputs", ids: ["linkedin", "twitter", "instagram", "facebook"] },
] as const;

const logoColors: Record<string, string> = {
  stripe: "#635bff",
  fanbasis: "#7138e8",
  whop: "#f45d48",
  plaid: "#4fd26b",
  "csv-banking": "#1f2937",
  quickbooks: "#98a2b3",
  calendly: "#146ef5",
  calcom: "#111827",
  iclosed: "#635bff",
  readai: "#7c3aed",
  fathom: "#319795",
  fireflies: "#ff7816",
  typeform: "#111827",
  heyflow: "#3867e8",
  linkedin: "#0a66c2",
  twitter: "#000000",
  instagram: "#e4405f",
  facebook: "#1877f2",
};

function initials(name: string) {
  return name
    .split(/[\s./-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default async function SettingsIntegrationsPage({ searchParams }: PageProps) {
  const { supabase, tenant } = await requireTenant();
  const params = await searchParams;
  const message = param(params, "message");
  const [{ data: metricConnections }] = await Promise.all([
    supabase
      .from("metric_integrations")
      .select("provider, status, last_sync_at, last_error")
      .eq("tenant_id", tenant.id),
  ]);
  const metricByProvider = new Map((metricConnections ?? []).map((connection) => [connection.provider, connection]));
  const connectedCount = [...metricByProvider.values()].filter((connection) => connection.status !== "disabled").length;
  const catalogById = new Map(integrationCatalog.map((integration) => [integration.id, integration]));
  const shownCount = integrationSections.reduce((total, section) => total + section.ids.length, 0);

  return (
    <AppShell active="settings-integrations" tenantName={tenant.name}>
      <section className="page-header compact">
        <p className="eyebrow">{tenant.name}</p>
        <h1>Settings</h1>
        <p className="lede">Connect the data sources that keep your dashboards current.</p>
        {message ? <p className="notice">{message}</p> : null}
      </section>
      <SettingsTabs active="integrations" />

      <section className="integration-toolbar">
        <input className="integration-search" placeholder="Search integrations..." readOnly />
        <span className="integration-count">{connectedCount} connected</span>
        <span className="integration-count muted-count">{shownCount} shown</span>
      </section>

      <div className="integration-sections">
        {integrationSections.map((section) => (
          <section className="integration-section" key={section.title}>
            <h2>{section.title}</h2>
            <div className="integration-grid">
              {section.ids.map((id) => {
                const integration = catalogById.get(id);
                if (!integration) return null;
                const row = metricByProvider.get(integration.id);
                const rowRecord = row as Record<string, unknown> | undefined;
                const lastSyncAt = typeof rowRecord?.last_sync_at === "string" ? rowRecord.last_sync_at : null;
                const connected = Boolean(row && row.status !== "disabled");
                const cardClass = integration.comingSoon
                  ? "integration-card disabled"
                  : connected
                    ? "integration-card connected"
                    : "integration-card";
                return (
                  <Link href={`/integrations/${integration.id}`} className={cardClass} key={integration.id}>
                    <span
                      className="integration-logo"
                      style={{ background: logoColors[integration.id] ?? "#2f7dff" }}
                      aria-hidden="true"
                    >
                      {initials(integration.name)}
                    </span>
                    <div className="integration-card-body">
                      <div className="integration-name-row">
                        <h3>{integration.name}</h3>
                        {integration.comingSoon ? (
                          <span className="status-badge soon">Coming soon</span>
                        ) : connected ? (
                          <span className="status-badge">Connected</span>
                        ) : null}
                      </div>
                      <p className="integration-description">{integration.description}</p>
                      {connected ? (
                        <p className="integration-meta">
                          Connected {new Date(lastSyncAt ?? Date.now()).toLocaleDateString()}
                        </p>
                      ) : null}
                    </div>
                    <span className="integration-category">{section.title}</span>
                    <span className="integration-action">
                      {integration.comingSoon ? "Unavailable" : connected ? "Manage" : "Connect"}
                    </span>
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
