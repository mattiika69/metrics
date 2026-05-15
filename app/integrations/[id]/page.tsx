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
      <AppShell active="integrations" tenantName={tenant.name}>
        <section className="page-header compact">
          <p className="eyebrow">Integrations</p>
          <h1>Not found</h1>
          <Link href="/integrations">Back to integrations</Link>
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
  const lastError = typeof connectionRecord?.last_error === "string" ? connectionRecord.last_error : null;
  const { data: syncRuns } = definition.group === "Messaging"
    ? { data: [] }
    : await supabase
      .from("metric_sync_runs")
      .select("id, status, rows_read, rows_written, error, started_at, completed_at")
      .eq("tenant_id", tenant.id)
      .eq("provider", definition.id)
      .order("started_at", { ascending: false })
      .limit(5);

  return (
    <AppShell active="integrations" tenantName={tenant.name}>
      <section className="page-header compact">
        <p className="eyebrow">{definition.group}</p>
        <div className="header-row">
          <div>
            <h1>{definition.name}</h1>
            <p className="lede">{definition.description}</p>
          </div>
          <Link href="/integrations" className="button-secondary">All integrations</Link>
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
              <p><strong>Last sync:</strong> {new Date(lastSyncAt).toLocaleString()}</p>
            ) : null}
            {lastError ? (
              <p><strong>Last error:</strong> {lastError}</p>
            ) : null}
          </div>
        </article>

        <aside className="compact-card">
          {definition.id === "slack" ? (
            <>
              <h2>Connect Slack</h2>
              <p className="muted">Install Slack to ask for metrics and constraints from your workspace.</p>
              <Link href="/api/integrations/slack/oauth/start" className="button-primary">Connect Slack</Link>
            </>
          ) : definition.id === "telegram" ? (
            <>
              <h2>Connect Telegram</h2>
              <p className="muted">Generate a link code, then send it to the bot to connect this workspace.</p>
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
                {definition.fields.length === 0 ? <p className="muted">No credentials are required for this connection.</p> : null}
                <button type="submit">Save connection</button>
              </form>
              <form action={syncIntegrationAction} className="card-action">
                <input type="hidden" name="provider" value={definition.id} />
                <button type="submit" className="button-secondary">Sync now</button>
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
                      placeholder="date,description,amount,category,cost_type,is_acquisition"
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

      {definition.group === "Messaging" ? null : (
        <section className="table-panel">
          <div className="report-table-title">Recent Sync Runs</div>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Rows Read</th>
                <th>Rows Written</th>
                <th>Started</th>
                <th>Completed</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {(syncRuns ?? []).length ? syncRuns?.map((run) => (
                <tr key={run.id}>
                  <td>{run.status}</td>
                  <td>{run.rows_read}</td>
                  <td>{run.rows_written}</td>
                  <td>{run.started_at ? new Date(run.started_at).toLocaleString() : "Never"}</td>
                  <td>{run.completed_at ? new Date(run.completed_at).toLocaleString() : "Pending"}</td>
                  <td>{run.error ?? ""}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6}>No sync runs yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </AppShell>
  );
}
