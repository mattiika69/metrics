import { AppShell } from "@/components/app-shell";
import {
  MetricCard,
  MetricRequestPanel,
  MetricSelectionPanel,
  getPageMessage,
} from "@/components/launch-metric-view";
import { saveForecastModelAction } from "@/app/metrics/actions";
import { requireTenant } from "@/lib/auth/session";
import { formatMetricValue } from "@/lib/metrics/format";
import { buildForecastContext } from "@/lib/metrics/forecasting";
import { loadMetricViewPayload } from "@/lib/metrics/views";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function assumptionInput({
  name,
  label,
  value,
  prefix,
  suffix,
}: {
  name: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label>
      {label}
      <span className="input-with-affix">
        {prefix ? <em>{prefix}</em> : null}
        <input name={name} type="number" step="0.01" defaultValue={value} required />
        {suffix ? <em>{suffix}</em> : null}
      </span>
    </label>
  );
}

export default async function ForecastingPage({ searchParams }: PageProps) {
  const { supabase, tenant } = await requireTenant();
  const params = await searchParams;
  const message = getPageMessage(params);
  const [forecast, payload] = await Promise.all([
    buildForecastContext({ supabase, tenantId: tenant.id }),
    loadMetricViewPayload({ supabase, tenantId: tenant.id, viewKey: "forecasting" }),
  ]);
  const assumptions = forecast.model.assumptions;
  const outputs = forecast.model.outputs;

  return (
    <AppShell active="forecasting" tenantName={tenant.name}>
      <section className="page-header compact">
        <div>
          <h1>Forecasting</h1>
          <p className="eyebrow">Reverse engineering</p>
          <p className="lede">Translate a profit goal into required revenue, clients, calls, conversion rates, and spend.</p>
        </div>
        {message ? <p className="notice">{message}</p> : null}
      </section>

      <section className="launch-grid">
        <div className="forecast-output-grid">
          <article className="metric-card launch-metric-card">
            <h2>Revenue Required</h2>
            <p className="metric-value">{formatMetricValue("currency", outputs.revenueRequired)}</p>
          </article>
          <article className="metric-card launch-metric-card">
            <h2>Clients Required</h2>
            <p className="metric-value">{formatMetricValue("number", outputs.clientsRequired)}</p>
          </article>
          <article className="metric-card launch-metric-card">
            <h2>New Clients Required</h2>
            <p className="metric-value">{formatMetricValue("number", outputs.newClientsRequired)}</p>
          </article>
          <article className="metric-card launch-metric-card">
            <h2>Booked Calls Required</h2>
            <p className="metric-value">{formatMetricValue("number", outputs.bookedCallsRequired)}</p>
          </article>
          <article className="metric-card launch-metric-card">
            <h2>Acquisition Spend</h2>
            <p className="metric-value">{formatMetricValue("currency", outputs.acquisitionSpendRequired)}</p>
          </article>
          <article className="metric-card launch-metric-card">
            <h2>Daily Spend</h2>
            <p className="metric-value">{formatMetricValue("currency", outputs.dailySpendRequired)}</p>
          </article>
        </div>

        <div className="launch-two-column">
          <article className="wide-panel launch-panel">
            <h2>Forecast Inputs</h2>
            <form action={saveForecastModelAction} className="forecast-form">
              <input type="hidden" name="next" value="/forecasting" />
              <label>
                Forecast name
                <input name="name" type="text" defaultValue={forecast.model.name} required />
              </label>
              {assumptionInput({ name: "netProfitGoal", label: "Net profit goal", value: assumptions.netProfitGoal, prefix: "$" })}
              {assumptionInput({ name: "netMarginPercent", label: "Net margin", value: assumptions.netMarginPercent, suffix: "%" })}
              {assumptionInput({ name: "monthlyClientPayment", label: "Monthly client payment", value: assumptions.monthlyClientPayment, prefix: "$" })}
              {assumptionInput({ name: "churnPercent", label: "Monthly churn", value: assumptions.churnPercent, suffix: "%" })}
              {assumptionInput({ name: "showRatePercent", label: "Show rate", value: assumptions.showRatePercent, suffix: "%" })}
              {assumptionInput({ name: "closeRatePercent", label: "Close rate", value: assumptions.closeRatePercent, suffix: "%" })}
              {assumptionInput({ name: "costPerCall", label: "Cost per booked call", value: assumptions.costPerCall, prefix: "$" })}
              <div className="panel-actions">
                <button type="submit">Save forecast</button>
              </div>
            </form>
          </article>

          <article className="wide-panel launch-panel">
            <h2>Current Operating Baseline</h2>
            <div className="forecast-grid">
              <div>
                <span>Revenue</span>
                <strong>{formatMetricValue("currency", forecast.current.revenue)}</strong>
              </div>
              <div>
                <span>Net Profit</span>
                <strong>{formatMetricValue("currency", forecast.current.netProfit)}</strong>
              </div>
              <div>
                <span>Active Clients</span>
                <strong>{formatMetricValue("number", forecast.current.activeClients)}</strong>
              </div>
              <div>
                <span>Calls Booked</span>
                <strong>{formatMetricValue("number", forecast.current.callsBooked)}</strong>
              </div>
            </div>
          </article>
        </div>

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

        <MetricSelectionPanel
          viewKey="forecasting"
          next="/forecasting"
          allDefinitions={payload.allDefinitions}
          selectedIds={payload.selectedIds}
        />
        <MetricRequestPanel next="/forecasting" />
      </section>
    </AppShell>
  );
}
