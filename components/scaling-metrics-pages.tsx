import Link from "next/link";
import { AppShell, type ActiveRoute } from "@/components/app-shell";
import { requireTenant } from "@/lib/auth/session";
import { integrationCatalog } from "@/lib/integrations/catalog";
import { buildConstraintsDigest, formatConstraintValue } from "@/lib/metrics/constraints";
import { metricDefinitions } from "@/lib/metrics/definitions";
import { formatMetricValue } from "@/lib/metrics/format";
import { buildForecastContext } from "@/lib/metrics/forecasting";
import { loadMetricSnapshotPayload } from "@/lib/metrics/server";

type MetricTabKey =
  | "most-important"
  | "reverse-engineering"
  | "financial"
  | "churn-ltv"
  | "sales"
  | "cost-per-call"
  | "inputs"
  | "quality-assurance";

type TablePageKind = "financial" | "churn-ltv" | "sales" | "cost-per-call" | "inputs";

type TableColumn = {
  label: string;
  align?: "left" | "right";
};

type TableRow = {
  label: string;
  cells: string[];
  total?: boolean;
};

const metricTabs: Array<{ key: MetricTabKey; label: string; href: string }> = [
  { key: "most-important", label: "Most Important", href: "/dashboard" },
  { key: "reverse-engineering", label: "Reverse Engineering", href: "/forecasting" },
  { key: "financial", label: "Financial", href: "/finance" },
  { key: "churn-ltv", label: "Churn & LTV", href: "/retention" },
  { key: "sales", label: "Sales", href: "/sales" },
  { key: "cost-per-call", label: "Cost/Call", href: "/metrics/cost-per-call" },
  { key: "inputs", label: "Inputs", href: "/marketing" },
  { key: "quality-assurance", label: "Quality Assurance", href: "/metrics/quality-assurance" },
];

const subTabs: Record<MetricTabKey, string[]> = {
  "most-important": ["Most Important"],
  "reverse-engineering": ["Current", "Goal", "% Difference"],
  financial: ["Overview", "Transactions In", "Transactions Out", "Categories", "Cost Per Category"],
  "churn-ltv": ["Overview", "Client Data", "Client Payments"],
  sales: ["Overview", "Calls"],
  "cost-per-call": ["Overview"],
  inputs: ["Overview", "Paid Ads", "Cold Email", "Newsletter", "Accounts"],
  "quality-assurance": ["Overview"],
};

const weeklyRowsDescending = [
  "May 10 - May 15, 2026",
  "May 3 - May 9, 2026",
  "Apr 26 - May 2, 2026",
  "Apr 19 - Apr 25, 2026",
  "Apr 12 - Apr 18, 2026",
];

const weeklyRowsAscending = [
  "Apr 16 - Apr 18, 2026",
  "Apr 19 - Apr 25, 2026",
  "Apr 26 - May 2, 2026",
  "May 3 - May 9, 2026",
  "May 10 - May 15, 2026",
];

const metricById = new Map(metricDefinitions.map((definition) => [definition.id, definition]));

function metricNumber(
  payload: Awaited<ReturnType<typeof loadMetricSnapshotPayload>>,
  metricId: string,
) {
  const value = payload.metrics[metricId]?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metricDisplay(
  payload: Awaited<ReturnType<typeof loadMetricSnapshotPayload>>,
  metricId: string,
  fallback = "—",
) {
  const definition = metricById.get(metricId);
  if (!definition) return fallback;
  const value = metricNumber(payload, metricId);
  return value === null ? fallback : formatMetricValue(definition.format, value);
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
  }).format(value);
}

function numberValue(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString();
}

function percent(value: number | null | undefined, decimals = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${value.toFixed(decimals)}%`;
}

function ratioMoney(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator === 0) return "—";
  return money(numerator / denominator);
}

function ratioPercent(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator === 0) return "—";
  return percent((numerator / denominator) * 100, 1);
}

function Header({
  title,
}: {
  title: string;
}) {
  return (
    <header className="scaling-header">
      <div>
        <h1>{title}</h1>
        <p>MEMBER SINCE MARCH 2026</p>
      </div>
    </header>
  );
}

function MetricTabsRow({ activeTab }: { activeTab: MetricTabKey }) {
  return (
      <nav className="scaling-tabs" aria-label="Metrics sections">
        {metricTabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={tab.key === activeTab ? "active" : ""}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
  );
}

function SubTabs({ activeTab }: { activeTab: MetricTabKey }) {
  return (
    <div className="scaling-subtabs">
      {subTabs[activeTab].map((label, index) => (
        <span key={label} className={index === 0 ? "active" : ""}>
          {label}
        </span>
      ))}
    </div>
  );
}

function PeriodToolbar({
  leading,
  includeAccount = false,
  includeCloser = false,
  includeSource = false,
}: {
  leading?: React.ReactNode;
  includeAccount?: boolean;
  includeCloser?: boolean;
  includeSource?: boolean;
}) {
  return (
    <div className="period-toolbar">
      <div className="period-toolbar-left">{leading}</div>
      <div className="period-toolbar-right">
        {includeAccount ? (
          <select aria-label="Account">
            <option>All Accounts</option>
          </select>
        ) : null}
        {includeSource ? (
          <select aria-label="Source">
            <option>All Sources</option>
          </select>
        ) : null}
        {includeCloser ? (
          <select aria-label="Closer">
            <option>All Closers</option>
          </select>
        ) : null}
        <select aria-label="Year">
          <option>2026</option>
        </select>
        <div className="period-segment" aria-label="Period">
          <span>Monthly</span>
          <span className="active">Last X</span>
          <span>Quarterly</span>
          <span>To Date</span>
        </div>
        {["Last 7", "Last 14", "Last 30", "Last 90", "Last 180", "Last 365"].map((label) => (
          <span key={label} className={label === "Last 30" ? "period-pill active" : "period-pill"}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function GranularityTabs() {
  return (
    <div className="granularity-tabs">
      <span>All</span>
      <span>Day</span>
      <span className="active">Week</span>
      <span>Month</span>
    </div>
  );
}

function DataTable({
  columns,
  rows,
  note,
}: {
  columns: TableColumn[];
  rows: TableRow[];
  note?: React.ReactNode;
}) {
  return (
    <>
      <section className="scaling-table-panel">
        <div className="scaling-table-title">
          <span>Period Breakdown</span>
          <GranularityTabs />
        </div>
        <div className="scaling-table-scroll">
          <table className="scaling-table">
            <thead>
              <tr>
                <th>Period</th>
                {columns.map((column) => (
                  <th key={column.label} className={column.align === "left" ? "left" : ""}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className={row.total ? "total" : ""}>
                  <td>{row.label}</td>
                  {row.cells.map((cell, index) => (
                    <td key={`${row.label}-${columns[index]?.label ?? index}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {note ? <div className="scaling-note">{note}</div> : null}
    </>
  );
}

function buildFinancialTable(
  payload: Awaited<ReturnType<typeof loadMetricSnapshotPayload>>,
) {
  const revenue = metricNumber(payload, "revenue") ?? metricNumber(payload, "cash_in") ?? 0;
  const cashOut = metricNumber(payload, "cash_out") ?? metricNumber(payload, "expenses") ?? 0;
  const netCashFlow = metricNumber(payload, "net_cash_flow") ?? revenue - cashOut;
  const grossMargin = metricNumber(payload, "gross_margin");
  const netMargin = metricNumber(payload, "net_margin");
  const fixedCosts = metricNumber(payload, "fixed_costs");
  const variableCosts = metricNumber(payload, "variable_costs");
  const cac = metricNumber(payload, "cac");
  const fulfillment = metricNumber(payload, "fulfillment_costs");
  const empty = weeklyRowsDescending.map((label) => ({
    label,
    cells: ["$0", "$0", "$0", "-", "$0", "-", "$0", "-", "-", "-", "-"],
  }));

  return {
    columns: [
      "Revenue",
      "Cash Out",
      "Net Cash Flow",
      "Gross Margin %",
      "Gross Margin $",
      "Net Margin %",
      "Net Margin $",
      "Fixed %",
      "Variable %",
      "CAC %",
      "Fulfillment %",
    ].map((label) => ({ label })),
    rows: [
      ...empty,
      {
        label: "Total",
        total: true,
        cells: [
          money(revenue),
          money(cashOut),
          money(netCashFlow),
          percent(grossMargin),
          money(revenue * ((grossMargin ?? 0) / 100)),
          percent(netMargin),
          money(metricNumber(payload, "net_profit") ?? netCashFlow),
          fixedCosts ? percent((fixedCosts / Math.max(cashOut, 1)) * 100) : "-",
          variableCosts ? percent((variableCosts / Math.max(cashOut, 1)) * 100) : "-",
          cac ? percent((cac / Math.max(revenue, 1)) * 100) : "-",
          fulfillment ? percent((fulfillment / Math.max(revenue, 1)) * 100) : "-",
        ],
      },
    ],
  };
}

function buildSalesTable(payload: Awaited<ReturnType<typeof loadMetricSnapshotPayload>>) {
  const booked = metricNumber(payload, "calls_booked") ?? 0;
  const shown = metricNumber(payload, "calls_shown") ?? 0;
  const qualified = metricNumber(payload, "qualified_calls") ?? 0;
  const offers = metricNumber(payload, "offers_sent") ?? 0;
  const closed = metricNumber(payload, "calls_closed") ?? 0;
  const revenue = metricNumber(payload, "revenue") ?? 0;

  return {
    columns: [
      "Booked",
      "Shown",
      "Qualified",
      "Offers",
      "Closed",
      "Revenue",
      "Shown %",
      "Qual %",
      "Offer %",
      "Close %",
      "Rev/Call",
      "Rev/Qual",
    ].map((label) => ({ label })),
    rows: [
      ...weeklyRowsAscending.map((label) => ({
        label,
        cells: ["0", "0", "0", "0", "0", "$0", "—", "—", "—", "—", "—", "—"],
      })),
      {
        label: "Total",
        total: true,
        cells: [
          numberValue(booked),
          numberValue(shown),
          numberValue(qualified),
          numberValue(offers),
          numberValue(closed),
          money(revenue),
          ratioPercent(shown, booked),
          ratioPercent(qualified, booked),
          ratioPercent(offers, shown),
          ratioPercent(closed, booked),
          ratioMoney(revenue, booked),
          ratioMoney(revenue, qualified),
        ],
      },
    ],
  };
}

function buildChurnTable(payload: Awaited<ReturnType<typeof loadMetricSnapshotPayload>>) {
  const revenue = metricNumber(payload, "revenue") ?? 0;
  const active = metricNumber(payload, "active_clients") ?? 0;
  const newClients = metricNumber(payload, "new_clients") ?? 0;
  const churned = metricNumber(payload, "churned_clients") ?? 0;
  const churn = metricNumber(payload, "churn") ?? (active ? (churned / active) * 100 : null);

  return {
    columns: ["Revenue", "Active", "New", "Cancel", "Churn %", "Churn Revenue"].map((label) => ({ label })),
    rows: [
      ...weeklyRowsAscending.map((label) => ({
        label,
        cells: ["$0", numberValue(active), "0", "0", "0.00%", "$0"],
      })),
      {
        label: "Total",
        total: true,
        cells: [money(revenue), numberValue(active), numberValue(newClients), numberValue(churned), percent(churn, 2), "$0"],
      },
    ],
  };
}

function buildCostPerCallTable(payload: Awaited<ReturnType<typeof loadMetricSnapshotPayload>>) {
  const booked = metricNumber(payload, "calls_booked") ?? 0;
  const shown = metricNumber(payload, "calls_shown") ?? 0;
  const qualified = metricNumber(payload, "qualified_calls") ?? 0;
  const offers = metricNumber(payload, "offers_sent") ?? 0;
  const closed = metricNumber(payload, "calls_closed") ?? 0;
  const costs = metricNumber(payload, "acquisition_costs") ?? 0;

  return {
    columns: [
      "Calls Booked",
      "Calls Shown",
      "Qualified Calls",
      "Offers Sent",
      "Calls Closed",
      "Costs",
      "Cost/Booked",
      "Cost/Shown",
      "Cost/Qualified",
      "Cost/Offer",
      "Cost/Close",
    ].map((label) => ({ label })),
    rows: [
      ...weeklyRowsAscending.map((label) => ({
        label,
        cells: ["0", "0", "0", "0", "0", "$0", "-", "-", "-", "-", "-"],
      })),
      {
        label: "Total",
        total: true,
        cells: [
          numberValue(booked),
          numberValue(shown),
          numberValue(qualified),
          numberValue(offers),
          numberValue(closed),
          money(costs),
          ratioMoney(costs, booked),
          ratioMoney(costs, shown),
          ratioMoney(costs, qualified),
          ratioMoney(costs, offers),
          ratioMoney(costs, closed),
        ],
      },
    ],
  };
}

function buildInputsTable() {
  return {
    columns: ["Paid Ads", "Cold Email", "Newsletter"].map((label) => ({ label })),
    rows: [
      ...weeklyRowsDescending.map((label) => ({
        label,
        cells: ["0", "0", label === "Apr 15 - Apr 18, 2026" ? "3" : "0"],
      })),
      { label: "Total", total: true, cells: ["0", "0", "0"] },
    ],
  };
}

const tableConfigs: Record<TablePageKind, {
  title: string;
  activeRoute: ActiveRoute;
  activeTab: MetricTabKey;
  includeAccount?: boolean;
  includeCloser?: boolean;
  includeSource?: boolean;
  note?: React.ReactNode;
}> = {
  financial: {
    title: "Financial Overview",
    activeRoute: "metrics-financial",
    activeTab: "financial",
    includeAccount: true,
    note: (
      <>
        Fixed and Variable costs are assigned on the <span>Categories page</span>. Mark transactions as wasted on <span>Transactions Out</span>.
      </>
    ),
  },
  "churn-ltv": {
    title: "Churn and LTV Overview",
    activeRoute: "metrics-churn-ltv",
    activeTab: "churn-ltv",
  },
  sales: {
    title: "Sales Overview",
    activeRoute: "metrics-sales",
    activeTab: "sales",
    includeCloser: true,
    includeSource: true,
  },
  "cost-per-call": {
    title: "Cost Per Call",
    activeRoute: "metrics-cost-per-call",
    activeTab: "cost-per-call",
    includeSource: true,
  },
  inputs: {
    title: "Inputs Overview",
    activeRoute: "metrics-inputs",
    activeTab: "inputs",
  },
};

function getTable(kind: TablePageKind, payload: Awaited<ReturnType<typeof loadMetricSnapshotPayload>>) {
  if (kind === "financial") return buildFinancialTable(payload);
  if (kind === "sales") return buildSalesTable(payload);
  if (kind === "churn-ltv") return buildChurnTable(payload);
  if (kind === "cost-per-call") return buildCostPerCallTable(payload);
  return buildInputsTable();
}

export async function ScalingMetricsTablePage({ kind }: { kind: TablePageKind }) {
  const { supabase, tenant } = await requireTenant();
  const payload = await loadMetricSnapshotPayload({ supabase, tenantId: tenant.id, periodKey: "30d" });
  const config = tableConfigs[kind];
  const table = getTable(kind, payload);

  return (
    <AppShell active={config.activeRoute} tenantName={tenant.name}>
      <section className="scaling-page">
        <Header title={config.title} />
        <MetricTabsRow activeTab={config.activeTab} />
        <SubTabs activeTab={config.activeTab} />
        <PeriodToolbar
          includeAccount={config.includeAccount}
          includeCloser={config.includeCloser}
          includeSource={config.includeSource}
          leading={
            kind === "inputs" ? (
              <>
                <select aria-label="Input source">
                  <option>All</option>
                </select>
                <span className="dark-chip">Accounts</span>
              </>
            ) : undefined
          }
        />
        <DataTable columns={table.columns} rows={table.rows} note={config.note} />
      </section>
    </AppShell>
  );
}

const mostImportantMetricIds = [
  "revenue",
  "recurring_revenue",
  "mrr",
  "arr",
  "bank_balance",
  "runway",
  "active_clients",
  "new_clients",
  "churned_clients",
  "median_payment",
  "churn",
  "avg_relationship",
  "payback",
  "fixed_costs",
  "variable_costs",
  "wasted_money",
  "fulfillment_costs",
  "gross_margin",
  "expenses",
  "revenue_per_employee",
  "calls_booked",
  "new_client_revenue",
  "cac",
  "cost_per_call",
  "call_show_rate",
  "call_offer_rate",
  "call_close_rate",
  "call_unqualified_rate",
  "sales_cycle",
  "revenue_ltv",
  "ltv_cac",
  "gross_margin",
  "gross_margin_ltv",
  "net_margin_ltv",
  "net_profit",
  "net_margin",
  "nrr",
  "gross_ltv_cac",
  "net_ltv_cac",
  "cash_in",
  "cash_out",
];

function cardTone(category: string, index: number) {
  const categoryTone: Record<string, string> = {
    Revenue: "blue",
    Cash: "blue",
    Clients: "violet",
    Costs: "green",
    Sales: "gray",
    Performance: "yellow",
  };
  return categoryTone[category] ?? ["blue", "green", "red", "yellow", "violet", "gray"][index % 6];
}

export async function ScalingMostImportantPage() {
  const { supabase, tenant } = await requireTenant();
  const payload = await loadMetricSnapshotPayload({ supabase, tenantId: tenant.id, periodKey: "30d" });
  const definitions = mostImportantMetricIds
    .map((id) => metricById.get(id))
    .filter((definition): definition is NonNullable<typeof definition> => Boolean(definition));

  return (
    <AppShell active="metrics-most-important" tenantName={tenant.name}>
      <section className="scaling-page">
        <Header title="Most Important Metrics" />
        <MetricTabsRow activeTab="most-important" />
        <SubTabs activeTab="most-important" />
        <div className="most-important-toolbar">
          <div className="period-toolbar-left">
            <select aria-label="Year">
              <option>2026</option>
            </select>
            <select aria-label="Range">
              <option>Last 30 Days</option>
            </select>
            <span className="light-button">Refresh</span>
          </div>
          <div className="period-toolbar-right compact">
            <span>Sort</span>
            <select aria-label="Sort">
              <option>Default</option>
            </select>
            <span>Tag</span>
            <select aria-label="Tag">
              <option>All tags</option>
            </select>
            <span>Edit</span>
            <span className="toggle-off" aria-hidden="true" />
          </div>
        </div>
        <div className="scaling-metric-grid">
          {definitions.map((definition, index) => (
            <article className={`scaling-metric-card ${cardTone(definition.category, index)}`} key={`${definition.id}-${index}`}>
              <div className="metric-card-head">
                <span>{definition.name}</span>
                <span className="info-dot">i</span>
                <span className="override-pill">override</span>
              </div>
              <strong>{metricDisplay(payload, definition.id, definition.format === "currency" ? "$0" : "—")}</strong>
              <p>OWNER : Unassigned</p>
            </article>
          ))}
        </div>
        <details className="how-this-works">
          <summary>How this works</summary>
        </details>
      </section>
    </AppShell>
  );
}

function reRow(label: string, value: string, tone: "editable" | "readonly" | "formula" = "formula") {
  return (
    <div className="re-row" key={label}>
      <span>{label}<em>ⓘ</em></span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

export async function ScalingReverseEngineeringPage() {
  const { supabase, tenant } = await requireTenant();
  const forecast = await buildForecastContext({ supabase, tenantId: tenant.id });
  const { assumptions, outputs } = forecast.model;
  const avgRelationship = assumptions.churnPercent > 0 ? 100 / assumptions.churnPercent : 0;
  const callsPerDay = outputs.bookedCallsRequired / 260;
  const callsPerWeek = outputs.bookedCallsRequired / 52;
  const callsPerMonth = outputs.bookedCallsRequired / 12;

  return (
    <AppShell active="metrics-reverse-engineering" tenantName={tenant.name}>
      <section className="scaling-page">
        <Header title="Reverse Engineering" />
        <MetricTabsRow activeTab="reverse-engineering" />
        <SubTabs activeTab="reverse-engineering" />
        <p className="reverse-note">Current tab: only Net Profit Goal is editable. Core inputs mirror Goal tab values.</p>
        <div className="reverse-legend">
          <strong>Legend:</strong>
          <span className="editable">Editable Here (Current)</span>
          <span className="readonly">Read-Only Here (Edit on Goal Tab)</span>
        </div>
        <div className="reverse-grid">
          <div className="reverse-stack">
            <section className="re-box">
              <h2 className="red">Major Goal</h2>
              {reRow("Net Profit Goal", money(assumptions.netProfitGoal), "editable")}
              {reRow("Net Margin", percent(assumptions.netMarginPercent, 0), "readonly")}
              {reRow("Revenue Required", money(outputs.revenueRequired))}
            </section>
            <section className="re-box">
              <h2>Churn</h2>
              {reRow("Monthly Churn Rate", percent(assumptions.churnPercent, 0), "readonly")}
              {reRow("Average Client Relationship in Months", avgRelationship.toFixed(2))}
            </section>
          </div>
          <section className="re-box">
            <h2>LTV</h2>
            {reRow("Revenue Required", money(outputs.revenueRequired))}
            {reRow("Median Monthly Retainer", money(assumptions.monthlyClientPayment), "readonly")}
            {reRow("Average Client Relationship in Months", avgRelationship.toFixed(2))}
            {reRow("Average LTV Per Client", money(assumptions.monthlyClientPayment * avgRelationship))}
            {reRow("Clients Required", outputs.clientsRequired.toFixed(2))}
          </section>
          <section className="re-box">
            <h2>Clients</h2>
            {reRow("Clients Required", outputs.clientsRequired.toFixed(2))}
            {reRow("Close Rate (Booked Call)", percent(assumptions.closeRatePercent, 0), "readonly")}
            {reRow("Calls Required", outputs.bookedCallsRequired.toFixed(2))}
            {reRow("Calls Per Day Required", callsPerDay.toFixed(2))}
            {reRow("Calls Per Week Required", callsPerWeek.toFixed(2))}
            {reRow("Calls Per Month Required", callsPerMonth.toFixed(2))}
            {reRow("Closers Required", (callsPerWeek / 25).toFixed(2))}
            {reRow("Appt Setters Required", (callsPerWeek / 50).toFixed(2))}
            <div className="re-row">
              <span>Acquisition Source</span>
              <strong className="source-toggle">Ads <em>Email</em> <em>Call</em> <em>DMs</em></strong>
            </div>
            {reRow("Cost Per Call (Ads)", money(assumptions.costPerCall), "readonly")}
            {reRow("Daily Ad Spend Required", money(outputs.dailySpendRequired), "editable")}
          </section>
        </div>
      </section>
    </AppShell>
  );
}

export async function ScalingConstraintsPage() {
  const { supabase, tenant } = await requireTenant();
  const digest = await buildConstraintsDigest({ supabase, tenantId: tenant.id, periodKey: "30d" });
  const rows = digest.topConstraints.map((row, index) => ({
    label: `#${index + 1} ${row.benchmark.name}`,
    cells: [
      formatConstraintValue(row, row.actual),
      formatConstraintValue(row, row.minimum),
      formatConstraintValue(row, row.scale),
      row.gapPercent === null ? "No data" : `${row.gapPercent.toFixed(1)}%`,
      row.suggestions[0] ?? "Review source data and benchmark target.",
    ],
  }));

  return (
    <AppShell active="constraints" tenantName={tenant.name}>
      <section className="scaling-page">
        <header className="scaling-header">
          <div>
            <h1>Constraints</h1>
            <p>MEMBER SINCE MARCH 2026</p>
          </div>
        </header>
        <div className="scaling-subtabs">
          <span className="active">Overview</span>
        </div>
        <DataTable
          columns={[
            { label: "Actual" },
            { label: "Minimum" },
            { label: "Scale" },
            { label: "Gap" },
            { label: "Action", align: "left" },
          ]}
          rows={rows.length ? rows : [{ label: "No constraints", cells: ["—", "—", "—", "—", "Connect data sources"] }]}
        />
      </section>
    </AppShell>
  );
}

function integrationInitials(name: string) {
  return name
    .split(/[\s./()-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const integrationColors: Record<string, string> = {
  stripe: "#635bff",
  fanbasis: "#7138e8",
  whop: "#f45d48",
  plaid: "#4ade80",
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
  slack: "#4a154b",
  telegram: "#229ed9",
};

const integrationSections = [
  { title: "Calendar", ids: ["calendly", "calcom", "iclosed"] },
  { title: "Call Notes & Recordings", ids: ["readai", "fathom", "fireflies"] },
  { title: "Sales", ids: ["typeform", "heyflow"] },
  { title: "Social", ids: ["linkedin", "twitter", "instagram", "facebook"] },
  { title: "Payment Processors", ids: ["stripe", "fanbasis", "whop"] },
  { title: "Banking", ids: ["plaid", "csv-banking", "quickbooks"] },
  { title: "Messaging", ids: ["slack", "telegram"] },
];

export async function ScalingIntegrationsPage({ active = "settings-integrations" }: { active?: ActiveRoute }) {
  const { supabase, tenant } = await requireTenant();
  const [{ data: metricConnections }, { data: tenantConnections }] = await Promise.all([
    supabase
      .from("metric_integrations")
      .select("provider, status, last_sync_at")
      .eq("tenant_id", tenant.id),
    supabase
      .from("tenant_integrations")
      .select("provider, status, updated_at")
      .eq("tenant_id", tenant.id),
  ]);
  const connectionRows = [...(metricConnections ?? []), ...(tenantConnections ?? [])] as Array<{
    provider: string;
    status: string | null;
    last_sync_at?: string | null;
    updated_at?: string | null;
  }>;
  const connectedProviders = new Map(connectionRows.map((row) => [row.provider, row]));
  const catalogById = new Map(integrationCatalog.map((integration) => [integration.id, integration]));
  const connectedCount = connectionRows.filter((row) => row.status === "active").length;
  const shownCount = integrationSections.reduce((sum, section) => sum + section.ids.length, 0);

  return (
    <AppShell active={active} tenantName={tenant.name}>
      <section className="scaling-page integrations-page">
        <div className="integration-toolbar scaling">
          <input className="integration-search" placeholder="Search integrations..." readOnly />
          <span className="integration-count">{connectedCount} connected</span>
          <span className="integration-count muted-count">{shownCount} shown</span>
        </div>
        <div className="integration-sections scaling">
          {integrationSections.map((section) => (
            <section className="integration-section" key={section.title}>
              <h2>{section.title}</h2>
              <div className="integration-grid scaling">
                {section.ids.map((id) => {
                  const integration = catalogById.get(id);
                  if (!integration) return null;
                  const row = connectedProviders.get(id);
                  const connected = row?.status === "active";
                  const dateValue = row?.last_sync_at ?? row?.updated_at ?? null;
                  return (
                    <Link
                      href={id === "slack" || id === "telegram" ? `/settings/${id}` : `/integrations/${id}`}
                      className={[
                        "integration-card",
                        connected ? "connected" : "",
                        integration.comingSoon ? "disabled" : "",
                      ].filter(Boolean).join(" ")}
                      key={id}
                    >
                      <span
                        className="integration-logo"
                        style={{ background: integrationColors[id] ?? "#2f7dff" }}
                        aria-hidden="true"
                      >
                        {integrationInitials(integration.name)}
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
                            Connected {new Date(dateValue ?? Date.now()).toLocaleDateString()}
                          </p>
                        ) : null}
                      </div>
                      <span className="integration-category">{section.title.toUpperCase()}</span>
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
      </section>
    </AppShell>
  );
}
