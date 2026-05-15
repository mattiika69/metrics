import { AppShell } from "@/components/app-shell";
import { requireTenant } from "@/lib/auth/session";
import { formatMetricValue } from "@/lib/metrics/format";
import { metricDefinitions, type MetricFormat } from "@/lib/metrics/definitions";
import { loadMetricSnapshotPayload, periodFromSearch } from "@/lib/metrics/server";
import type { PeriodKey } from "@/lib/metrics/period";

type MetricReportColumn = {
  label: string;
  metricId: string;
};

type MetricSummarySection = {
  title: string;
  rows: {
    label: string;
    metricId: string;
    editable?: boolean;
  }[];
};

type MetricsReportPageProps = {
  active:
    | "metrics-reverse-engineering"
    | "metrics-financial"
    | "metrics-churn-ltv"
    | "metrics-sales"
    | "metrics-cost-per-call"
    | "metrics-inputs";
  title: string;
  description: string;
  columns: MetricReportColumn[];
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  summarySections?: MetricSummarySection[];
};

const periodRows: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "90d", label: "Last 90 Days" },
  { key: "mtd", label: "Month to Date" },
  { key: "qtd", label: "Quarter to Date" },
  { key: "ytd", label: "Year to Date" },
];

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function metricFormat(metricId: string): MetricFormat {
  return metricDefinitions.find((definition) => definition.id === metricId)?.format ?? "number";
}

function displayValue(format: MetricFormat, value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return formatMetricValue(format, value);
}

export async function MetricsReportPage({
  active,
  title,
  description,
  columns,
  searchParams,
  summarySections,
}: MetricsReportPageProps) {
  const { supabase, tenant } = await requireTenant();
  const params = await searchParams;
  const selectedPeriod = periodFromSearch(param(params, "period"));
  const payloads = await Promise.all(
    periodRows.map(async (period) => ({
      period,
      payload: await loadMetricSnapshotPayload({
        supabase,
        tenantId: tenant.id,
        periodKey: period.key,
      }),
    })),
  );
  const selectedPayload =
    payloads.find((row) => row.period.key === selectedPeriod)?.payload ?? payloads[1]?.payload;

  return (
    <AppShell active={active} tenantName={tenant.name}>
      <section className="page-header compact">
        <h1>{title}</h1>
        <p className="eyebrow">Member since March 2026</p>
        <p className="lede">{description}</p>
      </section>

      <section className="report-grid">
        {summarySections?.length && selectedPayload ? (
          <div className="report-summary">
            {summarySections.map((section) => (
              <article className="report-box" key={section.title}>
                <h2>{section.title}</h2>
                {section.rows.map((row) => {
                  const format = metricFormat(row.metricId);
                  return (
                    <div className={row.editable ? "report-box-row editable" : "report-box-row"} key={row.metricId}>
                      <span>{row.label}</span>
                      <strong>{displayValue(format, selectedPayload.metrics[row.metricId]?.value)}</strong>
                    </div>
                  );
                })}
              </article>
            ))}
          </div>
        ) : null}

        <div>
          <div className="report-controls">
            {["7d", "30d", "90d", "mtd", "qtd", "ytd"].map((option) => (
              <a
                key={option}
                href={`?period=${option}`}
                className={selectedPeriod === option ? "filter-pill active" : "filter-pill"}
              >
                {option.toUpperCase()}
              </a>
            ))}
          </div>
          <section className="table-panel">
            <div className="report-table-title">
              <span>Period Breakdown</span>
              <span>Week</span>
            </div>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Period</th>
                  {columns.map((column) => (
                    <th key={column.metricId}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payloads.map(({ period, payload }) => (
                  <tr key={period.key}>
                    <td>{period.label}</td>
                    {columns.map((column) => {
                      const format = metricFormat(column.metricId);
                      return (
                        <td key={column.metricId}>
                          {displayValue(format, payload.metrics[column.metricId]?.value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
