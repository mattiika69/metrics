import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  MetricCard,
  MetricRequestPanel,
  MetricSelectionPanel,
  SourceFreshnessPanel,
  getPageMessage,
} from "@/components/launch-metric-view";
import { refreshRecommendationAction } from "@/app/metrics/actions";
import { requireTenant } from "@/lib/auth/session";
import { buildConstraintsDigest, formatConstraintValue } from "@/lib/metrics/constraints";
import { formatMetricValue } from "@/lib/metrics/format";
import { buildForecastContext } from "@/lib/metrics/forecasting";
import { loadLatestRecommendation } from "@/lib/metrics/recommendations";
import { loadRawDataCounts } from "@/lib/metrics/server";
import { loadMetricViewPayload } from "@/lib/metrics/views";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const liveProviders = ["stripe", "csv-banking", "calendly", "typeform"];

export default async function DashboardPage({ searchParams }: PageProps) {
  const { supabase, tenant } = await requireTenant();
  const params = await searchParams;
  const message = getPageMessage(params);
  const [
    payload,
    counts,
    constraints,
    forecast,
    recommendation,
    metricConnections,
    messagingConnections,
    metricRequests,
  ] = await Promise.all([
    loadMetricViewPayload({ supabase, tenantId: tenant.id, viewKey: "ceo" }),
    loadRawDataCounts(supabase, tenant.id),
    buildConstraintsDigest({ supabase, tenantId: tenant.id, periodKey: "30d" }),
    buildForecastContext({ supabase, tenantId: tenant.id }),
    loadLatestRecommendation({ supabase, tenantId: tenant.id }),
    supabase
      .from("metric_integrations")
      .select("provider, status, last_sync_at, last_error")
      .eq("tenant_id", tenant.id),
    supabase
      .from("tenant_integrations")
      .select("provider, status, updated_at")
      .eq("tenant_id", tenant.id)
      .in("provider", ["slack", "telegram"]),
    supabase
      .from("metric_requests")
      .select("id, requested_metric, status, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const metricConnectionRows = metricConnections.data ?? [];
  const messagingConnectionRows = messagingConnections.data ?? [];
  const connectedCount = [
    ...metricConnectionRows.filter((row) => row.status === "active"),
    ...messagingConnectionRows.filter((row) => row.status === "active"),
  ].length;
  const providerStatus = new Map(metricConnectionRows.map((row) => [row.provider, row]));

  return (
    <AppShell active="dashboard" tenantName={tenant.name}>
      <section className="page-header compact">
        <div className="header-row">
          <div>
            <h1>CEO Dashboard</h1>
            <p className="eyebrow">Last 30 days</p>
            <p className="lede">Executive source of truth for growth, sales, retention, cash, constraints, and forecast targets.</p>
          </div>
          <Link href="/integrations" className="button-secondary">Connect sources</Link>
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

        <div className="launch-two-column">
          <article className="wide-panel launch-panel">
            <div className="panel-heading">
              <div>
                <h2>Top 3 Constraints</h2>
                <p className="muted">Ranked against current benchmark targets.</p>
              </div>
              <Link href="/constraints" className="button-secondary">Open constraints</Link>
            </div>
            <div className="constraint-stack">
              {constraints.topConstraints.map((row, index) => (
                <div key={row.benchmark.id} className="constraint-line">
                  <span>{index + 1}</span>
                  <div>
                    <strong>{row.benchmark.name}</strong>
                    <p>
                      Actual {formatConstraintValue(row, row.actual)} / target {formatConstraintValue(row, row.scale)}
                    </p>
                  </div>
                  <em>{row.gapPercent === null ? "No data" : `${row.gapPercent.toFixed(1)}% gap`}</em>
                </div>
              ))}
            </div>
          </article>

          <article className="wide-panel launch-panel">
            <div className="panel-heading">
              <div>
                <h2>Forecast Summary</h2>
                <p className="muted">Goal model translated into operating requirements.</p>
              </div>
              <Link href="/forecasting" className="button-secondary">Open forecast</Link>
            </div>
            <div className="forecast-grid">
              <div>
                <span>Revenue Required</span>
                <strong>{formatMetricValue("currency", forecast.model.outputs.revenueRequired)}</strong>
              </div>
              <div>
                <span>Clients Required</span>
                <strong>{formatMetricValue("number", forecast.model.outputs.clientsRequired)}</strong>
              </div>
              <div>
                <span>Booked Calls</span>
                <strong>{formatMetricValue("number", forecast.model.outputs.bookedCallsRequired)}</strong>
              </div>
              <div>
                <span>Daily Spend</span>
                <strong>{formatMetricValue("currency", forecast.model.outputs.dailySpendRequired)}</strong>
              </div>
            </div>
          </article>
        </div>

        <div className="launch-two-column">
          <article className="wide-panel launch-panel">
            <div className="panel-heading">
              <div>
                <h2>Integration Health</h2>
                <p className="muted">{connectedCount} active connections</p>
              </div>
              <Link href="/integrations" className="button-secondary">Manage</Link>
            </div>
            <div className="integration-health-grid">
              {liveProviders.map((provider) => {
                const row = providerStatus.get(provider);
                return (
                  <Link href={`/integrations/${provider}`} key={provider} className="integration-health-row">
                    <span>{provider.replace("-", " ")}</span>
                    <strong>{row?.status === "active" ? "Connected" : "Not connected"}</strong>
                  </Link>
                );
              })}
              {["slack", "telegram"].map((provider) => {
                const row = messagingConnectionRows.find((connection) => connection.provider === provider);
                return (
                  <Link href={`/integrations/${provider}`} key={provider} className="integration-health-row">
                    <span>{provider}</span>
                    <strong>{row?.status === "active" ? "Connected" : "Not connected"}</strong>
                  </Link>
                );
              })}
            </div>
          </article>

          <article className="wide-panel launch-panel">
            <div className="panel-heading">
              <div>
                <h2>Recommendations</h2>
                <p className="muted">Generated from current constraints and benchmark gaps.</p>
              </div>
              <form action={refreshRecommendationAction}>
                <input type="hidden" name="next" value="/dashboard" />
                <button type="submit" className="button-secondary">Refresh</button>
              </form>
            </div>
            {recommendation ? (
              <div className="recommendation-body">
                <strong>{recommendation.title}</strong>
                {String(recommendation.body).split("\n").filter(Boolean).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : (
              <p className="muted">Generate a recommendation after syncing the current metrics.</p>
            )}
          </article>
        </div>

        <SourceFreshnessPanel calculatedAt={payload.calculatedAt} counts={counts} />
        <article className="wide-panel launch-panel">
          <h2>Metric Requests</h2>
          <div className="settings-list">
            {(metricRequests.data ?? []).length ? metricRequests.data?.map((request) => (
              <div key={request.id}>
                <span>{request.requested_metric}</span>
                <strong>{request.status}</strong>
              </div>
            )) : (
              <div>
                <span>No metric requests yet.</span>
                <strong>Ready</strong>
              </div>
            )}
          </div>
        </article>
        <MetricSelectionPanel
          viewKey="ceo"
          next="/dashboard"
          allDefinitions={payload.allDefinitions}
          selectedIds={payload.selectedIds}
        />
        <MetricRequestPanel next="/dashboard" />
      </section>
    </AppShell>
  );
}
