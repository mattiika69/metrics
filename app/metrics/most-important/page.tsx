import { AppShell } from "@/components/app-shell";
import { requireTenant } from "@/lib/auth/session";
import { formatMetricValue } from "@/lib/metrics/format";
import { loadMetricSnapshotPayload, periodFromSearch } from "@/lib/metrics/server";
import { createMetricOverrideAction, recalculateMetricsAction } from "@/app/metrics/actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function MostImportantMetricsPage({ searchParams }: PageProps) {
  const { supabase, tenant } = await requireTenant();
  const params = await searchParams;
  const period = periodFromSearch(getParam(params, "period"));
  const message = getParam(params, "message");
  const payload = await loadMetricSnapshotPayload({
    supabase,
    tenantId: tenant.id,
    periodKey: period,
  });
  const visibleDefinitions = payload.definitions.slice(0, 48);

  return (
    <AppShell active="metrics-most-important" tenantName={tenant.name}>
      <section className="page-header compact">
        <div className="header-row">
          <div>
            <h1>Most Important Metrics</h1>
            <p className="eyebrow">Member since March 2026</p>
            <p className="lede">Your most important operating metrics from connected sources.</p>
          </div>
          <form action={recalculateMetricsAction} className="toolbar-form">
            <input type="hidden" name="period" value={period} />
            <button type="submit">Recalculate</button>
          </form>
        </div>
        {message ? <p className="notice">{message}</p> : null}
        <div className="filter-row">
          {["7d", "30d", "90d", "mtd", "qtd", "ytd", "all"].map((option) => (
            <a key={option} href={`/metrics/most-important?period=${option}`} className={period === option ? "filter-pill active" : "filter-pill"}>
              {option.toUpperCase()}
            </a>
          ))}
          <span className="muted">
            {payload.window.startDate} to {payload.window.endDate}
            {payload.calculatedAt ? ` | updated ${new Date(payload.calculatedAt).toLocaleString()}` : " | no data yet"}
          </span>
        </div>
      </section>

      <section className="metrics-grid">
        {visibleDefinitions.map((definition) => {
          const snapshot = payload.metrics[definition.id];
          const overridden = snapshot?.sources?.overridden === true;
          return (
            <article className="metric-card" key={definition.id}>
              <div className="card-topline">
                <span>{definition.category}</span>
                {overridden ? <strong>Adjusted</strong> : <span>{definition.formulaType === "derived" ? "Calculated" : "Synced"}</span>}
              </div>
              <h2>{definition.name}</h2>
              <p className="metric-value">{formatMetricValue(definition.format, snapshot?.value ?? null)}</p>
              <p className="muted">{definition.sourceDescription}</p>
              <details>
                <summary>Details</summary>
                <p>{definition.formula}</p>
              </details>
            </article>
          );
        })}
      </section>

      <section className="wide-panel">
        <h2>Adjust a metric</h2>
        <p className="muted">Use adjustments when a value needs a reviewed correction for the selected period.</p>
        <form action={createMetricOverrideAction} className="inline-form">
          <input type="hidden" name="period" value={period} />
          <label>
            Metric
            <select name="metricId" required>
              {payload.definitions.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Value
            <input name="value" type="number" step="0.01" required />
          </label>
          <label>
            Reason
            <input name="reason" placeholder="Add context for the adjustment" />
          </label>
          <button type="submit">Save adjustment</button>
        </form>
      </section>
    </AppShell>
  );
}
