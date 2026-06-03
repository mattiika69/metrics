import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  connectIntegrationAction,
  disconnectIntegrationAction,
  importCsvBankingAction,
  syncIntegrationAction,
} from "@/app/metrics/actions";
import { requireTenant } from "@/lib/auth/session";
import { getIntegrationDefinition, getIntegrationDetailCopy } from "@/lib/integrations/catalog";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: unknown) {
  return typeof value === "string" && value
    ? new Date(value).toLocaleDateString()
    : "Never";
}

function formatDateTime(value: unknown) {
  return typeof value === "string" && value
    ? new Date(value).toLocaleString()
    : "Never";
}

function statusLabel(connection: Record<string, unknown> | null, comingSoon?: boolean) {
  if (comingSoon) return "Coming soon";
  if (!connection) return "Not connected";
  if (connection.status === "error") return "Needs attention";
  return "Connected";
}

function statusClass(connection: Record<string, unknown> | null, comingSoon?: boolean) {
  if (comingSoon) return "integration-detail-status soon";
  if (!connection) return "integration-detail-status idle";
  if (connection.status === "error") return "integration-detail-status error";
  return "integration-detail-status connected";
}

export default async function IntegrationDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const message = param(query, "message");
  const pageError = param(query, "error");
  const definition = getIntegrationDefinition(id);

  if (definition?.group === "Messaging") {
    redirect("/settings/integrations");
  }

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

  const detail = getIntegrationDetailCopy(definition);
  const { data: connection } = await supabase
    .from("metric_integrations")
    .select("id, status, display_name, external_account_id, settings, last_sync_at, last_event_at, last_error, updated_at")
    .eq("tenant_id", tenant.id)
    .eq("provider", definition.id)
    .maybeSingle();
  const connectionRecord = connection as Record<string, unknown> | null;
  const lastSyncAt = typeof connectionRecord?.last_sync_at === "string" ? connectionRecord.last_sync_at : null;
  const lastError = typeof connectionRecord?.last_error === "string" ? connectionRecord.last_error : null;
  const connected = Boolean(connectionRecord && connectionRecord.status !== "disabled" && !definition.comingSoon);
  const primaryActionLabel = connected ? "Update connection" : "Save connection";

  return (
    <AppShell active="settings-integrations" tenantName={tenant.name}>
      <section className="integration-detail-page">
        <div className="integration-detail-back-row">
          <Link href="/settings/integrations" className="integration-back-link">&larr; Back to Integrations</Link>
          <Link href="/settings/integrations" className="button-secondary integration-all-link">All integrations</Link>
        </div>

        <header className="integration-detail-hero">
          <span
            className="integration-detail-logo"
            style={{ backgroundColor: detail.accent }}
            aria-hidden="true"
          >
            {detail.icon}
          </span>
          <div>
            <p className="integration-detail-eyebrow">{definition.group}</p>
            <h1>{definition.name}</h1>
            <p>{definition.description}</p>
          </div>
        </header>

        {message ? <p className="notice integration-message">{message}</p> : null}
        {pageError ? <p className="notice error integration-message">{pageError}</p> : null}
        {lastError ? <p className="notice error integration-message">{lastError}</p> : null}

        <section className={statusClass(connectionRecord, definition.comingSoon)}>
          <div>
            <strong>{statusLabel(connectionRecord, definition.comingSoon)}</strong>
            <span>
              {connected
                ? `Connected on ${formatDate(connectionRecord?.updated_at)}`
                : definition.comingSoon
                  ? "This connection will be available soon."
                  : "Add the connection details to start syncing data."}
            </span>
          </div>
          {lastSyncAt ? <span>Last refreshed {formatDateTime(lastSyncAt)}</span> : null}
        </section>

        <section className="integration-detail-grid">
          <article className="integration-detail-card">
            <h2>Configuration</h2>
            {definition.comingSoon ? (
              <p>This connection is not available yet.</p>
            ) : definition.id === "csv-banking" ? (
              <>
                <form action={importCsvBankingAction} className="integration-config-form">
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
                  <button type="submit">{connected ? "Import more data" : "Import CSV"}</button>
                </form>
                <div className="integration-button-row">
                  <form action={syncIntegrationAction}>
                    <input type="hidden" name="provider" value={definition.id} />
                    <button type="submit" className="button-secondary">Refresh data</button>
                  </form>
                  {connected ? (
                    <form action={disconnectIntegrationAction}>
                      <input type="hidden" name="provider" value={definition.id} />
                      <button type="submit" className="button-danger">Disconnect</button>
                    </form>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <form action={connectIntegrationAction} className="integration-config-form">
                  <input type="hidden" name="provider" value={definition.id} />
                  {definition.fields.map((field) => (
                    <label key={field.name}>
                      {field.label}
                      <input
                        name={field.name}
                        type={field.type}
                        placeholder={connected ? "Saved securely" : field.placeholder}
                        required={!connected && field.required !== false}
                        autoComplete="off"
                      />
                    </label>
                  ))}
                  <button type="submit">{primaryActionLabel}</button>
                </form>
                <div className="integration-button-row">
                  <form action={syncIntegrationAction}>
                    <input type="hidden" name="provider" value={definition.id} />
                    <button type="submit" className="button-secondary">Refresh data</button>
                  </form>
                  {connected ? (
                    <form action={disconnectIntegrationAction}>
                      <input type="hidden" name="provider" value={definition.id} />
                      <button type="submit" className="button-danger">Disconnect</button>
                    </form>
                  ) : null}
                </div>
              </>
            )}
          </article>

          <article className="integration-detail-card">
            <h2>{detail.setupTitle}</h2>
            <ol className="integration-steps">
              {detail.setupSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {detail.links.length ? (
              <div className="integration-link-row">
                {detail.links.map((link) => (
                  <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}
          </article>

          <article className="integration-detail-card full-span">
            <h2>What data we read</h2>
            <ul className="integration-data-list">
              {detail.dataRead.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="integration-destination">
              <strong>Where it goes:</strong> {detail.destination}
            </p>
          </article>
        </section>
      </section>
    </AppShell>
  );
}
