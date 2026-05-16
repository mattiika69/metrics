import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  connectIntegrationAction,
  createTelegramLinkCodeAction,
  importCsvBankingAction,
  syncIntegrationAction,
} from "@/app/metrics/actions";
import { requireTenant } from "@/lib/auth/session";
import { getIntegrationDefinition } from "@/lib/integrations/catalog";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function IntegrationDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const message = param(query, "message") ?? param(query, "error");
  const code = param(query, "code");
  const expires = param(query, "expires");
  const definition = getIntegrationDefinition(id);
  const { supabase, tenant } = await requireTenant();

  if (!definition) {
    return (
      <AppShell active="settings-integrations" tenantName={tenant.name}>
        <section className="page-header compact">
          <p className="eyebrow">Integrations</p>
          <h1>Not found</h1>
          <Link href="/settings/integrations">Back to integrations</Link>
        </section>
      </AppShell>
    );
  }

  const table = definition.group === "Messaging" ? "tenant_integrations" : "metric_integrations";
  const { data: connection } = definition.group === "Messaging"
    ? await supabase
      .from(table)
      .select("id, status, display_name, external_team_id, external_channel_id, settings, updated_at")
      .eq("tenant_id", tenant.id)
      .eq("provider", definition.id)
      .neq("status", "disabled")
      .maybeSingle()
    : await supabase
      .from(table)
      .select("id, status, display_name, external_account_id, settings, last_sync_at, last_event_at, last_error, updated_at")
      .eq("tenant_id", tenant.id)
      .eq("provider", definition.id)
      .maybeSingle();
  const connectionRecord = connection as Record<string, unknown> | null;
  const lastSyncAt = typeof connectionRecord?.last_sync_at === "string" ? connectionRecord.last_sync_at : null;

  return (
    <AppShell active="settings-integrations" tenantName={tenant.name}>
      <section className="page-header compact">
        <p className="eyebrow">{definition.group}</p>
        <div className="header-row">
          <div>
            <h1>{definition.name}</h1>
            <p className="lede">{definition.description}</p>
          </div>
          <Link href="/settings/integrations" className="button-secondary">All integrations</Link>
        </div>
        {message ? <p className="notice">{message}</p> : null}
      </section>

      <section className="split-layout">
        <article className="wide-panel">
          <h2>Status</h2>
          <div className="status-list">
            <p><strong>Connection:</strong> {definition.comingSoon ? "Coming soon" : connection ? connection.status : "Not connected"}</p>
            <p><strong>Last updated:</strong> {connection?.updated_at ? new Date(connection.updated_at).toLocaleString() : "Never"}</p>
            {lastSyncAt !== null ? (
              <p><strong>Last refreshed:</strong> {new Date(lastSyncAt).toLocaleString()}</p>
            ) : null}
          </div>
        </article>

        <aside className="compact-card">
          {definition.id === "slack" ? (
            <>
              <h2>Connect Slack</h2>
              <p className="muted">Use Slack to ask for metrics, constraints, and forecasts.</p>
              <Link href="/api/integrations/slack/oauth/start" className="button-primary">Connect Slack</Link>
            </>
          ) : definition.id === "telegram" ? (
            <>
              <h2>Connect Telegram</h2>
              <p className="muted">Generate a link code, then send it to the Telegram bot.</p>
              {code ? (
                <p className="notice">
                  Code: <strong>{code}</strong>
                  {expires ? ` | expires ${new Date(expires).toLocaleString()}` : null}
                </p>
              ) : null}
              <form action={createTelegramLinkCodeAction}>
                <button type="submit">Generate link code</button>
              </form>
            </>
          ) : definition.comingSoon ? (
            <>
              <h2>Coming Soon</h2>
              <p className="muted">This connection will be available soon.</p>
            </>
          ) : (
            <>
              <h2>Connect</h2>
              <form action={connectIntegrationAction} className="form-stack compact">
                <input type="hidden" name="provider" value={definition.id} />
                {definition.fields.map((field) => (
                  <label key={field.name}>
                    {field.label}
                    <input name={field.name} type={field.type} placeholder={field.placeholder} required />
                  </label>
                ))}
                {definition.fields.length === 0 ? <p className="muted">No extra details are needed for this connection.</p> : null}
                <button type="submit">Save connection</button>
              </form>
              <form action={syncIntegrationAction} className="card-action">
                <input type="hidden" name="provider" value={definition.id} />
                <button type="submit" className="button-secondary">Refresh data</button>
              </form>
              {definition.id === "csv-banking" ? (
                <form action={importCsvBankingAction} className="form-stack compact">
                  <label>
                    Banking CSV
                    <input name="csvFile" type="file" accept=".csv,text/csv" />
                  </label>
                  <label>
                    Paste CSV
                    <textarea
                      name="csvText"
                      placeholder="Paste CSV rows here"
                      rows={8}
                    />
                  </label>
                  <button type="submit">Import CSV</button>
                </form>
              ) : null}
            </>
          )}
        </aside>
      </section>

    </AppShell>
  );
}
