import { AppShell } from "@/components/app-shell";
import {
  MetricRequestPanel,
  MetricSelectionPanel,
  getPageMessage,
} from "@/components/launch-metric-view";
import { recalculateMetricsAction, refreshRecommendationAction } from "@/app/metrics/actions";
import { requireTenant } from "@/lib/auth/session";
import { buildConstraintsDigest, formatConstraintValue } from "@/lib/metrics/constraints";
import { loadLatestRecommendation } from "@/lib/metrics/recommendations";
import { loadMetricViewPayload } from "@/lib/metrics/views";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function statusLabel(status: string) {
  if (status === "scale_met") return "Scale met";
  if (status === "minimum_met") return "Minimum met";
  if (status === "missing") return "Missing metric";
  return "Constrained";
}

export default async function ConstraintsPage({ searchParams }: PageProps) {
  const { supabase, tenant } = await requireTenant();
  const params = await searchParams;
  const message = getPageMessage(params);
  const [digest, recommendation, payload] = await Promise.all([
    buildConstraintsDigest({
      supabase,
      tenantId: tenant.id,
      periodKey: "30d",
    }),
    loadLatestRecommendation({ supabase, tenantId: tenant.id }),
    loadMetricViewPayload({ supabase, tenantId: tenant.id, viewKey: "constraints" }),
  ]);

  return (
    <AppShell active="constraints" tenantName={tenant.name}>
      <section className="page-header compact">
        <div className="header-row">
          <div>
            <h1>Constraints</h1>
            <p className="eyebrow">Last 30 days</p>
            <p className="lede">The biggest metric gaps ranked against current benchmark targets.</p>
          </div>
          <div className="row-actions">
            <form action={recalculateMetricsAction}>
              <input type="hidden" name="period" value="30d" />
              <input type="hidden" name="next" value="/constraints" />
              <button type="submit" className="button-secondary">Recalculate</button>
            </form>
            <form action={refreshRecommendationAction}>
              <input type="hidden" name="next" value="/constraints" />
              <button type="submit">Refresh recommendation</button>
            </form>
          </div>
        </div>
        {message ? <p className="notice">{message}</p> : null}
      </section>

      <section className="launch-grid">
        {digest.topConstraints.length ? (
          <div className="constraint-grid">
            {digest.topConstraints.map((row, index) => (
              <article className="metric-card constraint-card launch-constraint-card" key={row.benchmark.id}>
                <div className="card-topline">
                  <span>#{index + 1} Constraint</span>
                  <strong>{statusLabel(row.status)}</strong>
                </div>
                <h2>{row.benchmark.name}</h2>
                <p className="metric-value">{formatConstraintValue(row, row.actual)}</p>
                <div className="mini-stats">
                  <span>Minimum {formatConstraintValue(row, row.minimum)}</span>
                  <span>Scale {formatConstraintValue(row, row.scale)}</span>
                  <span>Gap {row.gapPercent === null ? "No data" : `${row.gapPercent.toFixed(1)}%`}</span>
                </div>
                <ul>
                  {row.suggestions.slice(0, 3).map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">No constraints are available yet. Connect integrations and recalculate metrics.</p>
        )}

        <article className="wide-panel launch-panel">
          <h2>Recommendation</h2>
          {recommendation ? (
            <div className="recommendation-body">
              <strong>{recommendation.title}</strong>
              {String(recommendation.body).split("\n").filter(Boolean).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : (
            <p className="muted">Refresh the recommendation after syncing source data.</p>
          )}
        </article>

        <MetricSelectionPanel
          viewKey="constraints"
          next="/constraints"
          allDefinitions={payload.allDefinitions}
          selectedIds={payload.selectedIds}
        />
        <MetricRequestPanel next="/constraints" />
      </section>
    </AppShell>
  );
}
