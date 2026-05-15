import { AppShell, type ActiveRoute } from "@/components/app-shell";
import {
  createMetricRequestAction,
  recalculateMetricsAction,
  saveMetricSelectionsAction,
} from "@/app/metrics/actions";
import { requireTenant } from "@/lib/auth/session";
import { loadRawDataCounts } from "@/lib/metrics/server";
import { labelForFreshness, loadMetricViewPayload, type MetricViewKey } from "@/lib/metrics/views";

function getActiveRoute(viewKey: MetricViewKey): ActiveRoute {
  if (viewKey === "ceo") return "dashboard";
  return viewKey;
}

function paramValue(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export function getPageMessage(params: Record<string, string | string[] | undefined>) {
  return paramValue(params, "message") ?? paramValue(params, "error") ?? null;
}

export function MetricCard({
  name,
  category,
  displayValue,
  sourceDescription,
}: {
  name: string;
  category: string;
  displayValue: string;
  sourceDescription: string;
}) {
  return (
    <article className="metric-card launch-metric-card">
      <div className="card-topline">
        <span>{category}</span>
        <strong>source</strong>
      </div>
      <h2>{name}</h2>
      <p className="metric-value">{displayValue}</p>
      <p className="metric-source">{sourceDescription}</p>
    </article>
  );
}

export function MetricSelectionPanel({
  viewKey,
  next,
  allDefinitions,
  selectedIds,
}: {
  viewKey: MetricViewKey;
  next: string;
  allDefinitions: Array<{ id: string; name: string; category: string }>;
  selectedIds: Set<string>;
}) {
  const grouped = new Map<string, Array<{ id: string; name: string }>>();
  for (const definition of allDefinitions) {
    const rows = grouped.get(definition.category) ?? [];
    rows.push({ id: definition.id, name: definition.name });
    grouped.set(definition.category, rows);
  }

  return (
    <article className="wide-panel launch-panel">
      <div className="panel-heading">
        <div>
          <h2>Important Metrics</h2>
          <p className="muted">Choose what appears on this view.</p>
        </div>
        <form action={recalculateMetricsAction}>
          <input type="hidden" name="period" value="30d" />
          <input type="hidden" name="next" value={next} />
          <button type="submit" className="button-secondary">Recalculate</button>
        </form>
      </div>
      <form action={saveMetricSelectionsAction} className="metric-selector-form">
        <input type="hidden" name="viewKey" value={viewKey} />
        <input type="hidden" name="next" value={next} />
        <div className="metric-selector-grid">
          {Array.from(grouped.entries()).map(([category, definitions]) => (
            <fieldset key={category} className="metric-selector-group">
              <legend>{category}</legend>
              {definitions.map((definition) => (
                <label key={definition.id} className="metric-checkbox-row">
                  <input
                    type="checkbox"
                    name="metricId"
                    value={definition.id}
                    defaultChecked={selectedIds.has(definition.id)}
                  />
                  <span>{definition.name}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <div className="panel-actions">
          <button type="submit">Save metrics</button>
        </div>
      </form>
    </article>
  );
}

export function MetricRequestPanel({ next }: { next: string }) {
  return (
    <article className="wide-panel launch-panel">
      <h2>Request A Metric</h2>
      <form action={createMetricRequestAction} className="inline-form launch-request-form">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="source" value="web" />
        <label>
          Metric
          <input name="requestedMetric" type="text" placeholder="Net revenue retention by cohort" required />
        </label>
        <label>
          Context
          <input name="context" type="text" placeholder="Where it should appear or how it is measured" />
        </label>
        <button type="submit">Request</button>
      </form>
    </article>
  );
}

export function SourceFreshnessPanel({
  calculatedAt,
  counts,
}: {
  calculatedAt: string | null;
  counts: Awaited<ReturnType<typeof loadRawDataCounts>>;
}) {
  return (
    <article className="wide-panel launch-panel">
      <div className="panel-heading">
        <div>
          <h2>Source Freshness</h2>
          <p className="muted">{labelForFreshness(calculatedAt)}</p>
        </div>
        <span className="pill">{calculatedAt ? new Date(calculatedAt).toLocaleString() : "No snapshot"}</span>
      </div>
      <div className="source-freshness-grid">
        {counts.map((count) => (
          <div key={count.table} className="source-freshness-item">
            <span>{count.label}</span>
            <strong>{count.count ?? 0}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

export async function DepartmentMetricPage({
  viewKey,
  searchParams,
}: {
  viewKey: MetricViewKey;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, tenant } = await requireTenant();
  const params = await searchParams;
  const message = getPageMessage(params);
  const [payload, counts] = await Promise.all([
    loadMetricViewPayload({ supabase, tenantId: tenant.id, viewKey }),
    loadRawDataCounts(supabase, tenant.id),
  ]);

  return (
    <AppShell active={getActiveRoute(viewKey)} tenantName={tenant.name}>
      <section className="page-header compact">
        <div className="header-row">
          <div>
            <h1>{payload.view.title}</h1>
            <p className="eyebrow">Last 30 days</p>
            <p className="lede">{payload.view.description}</p>
          </div>
          <form action={recalculateMetricsAction}>
            <input type="hidden" name="period" value="30d" />
            <input type="hidden" name="next" value={payload.view.href} />
            <button type="submit" className="button-secondary">Recalculate</button>
          </form>
        </div>
        {message ? <p className="notice">{message}</p> : null}
      </section>

      <section className="launch-grid">
        <div className="metrics-grid launch-metrics-grid">
          {payload.rows.map((row) => (
            <MetricCard
              key={row.metricId}
              name={row.name}
              category={row.category}
              displayValue={row.displayValue}
              sourceDescription={row.sourceDescription}
            />
          ))}
        </div>

        <SourceFreshnessPanel calculatedAt={payload.calculatedAt} counts={counts} />
        <MetricSelectionPanel
          viewKey={viewKey}
          next={payload.view.href}
          allDefinitions={payload.allDefinitions}
          selectedIds={payload.selectedIds}
        />
        <MetricRequestPanel next={payload.view.href} />
      </section>
    </AppShell>
  );
}
