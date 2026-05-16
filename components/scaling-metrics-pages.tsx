import Link from "next/link";
import { saveBenchmarkTargetAction } from "@/app/metrics/actions";
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
  | "inputs";

type TablePageKind = "financial" | "churn-ltv" | "sales" | "cost-per-call" | "inputs";

export type InputsChannelPageKind = "paid-ads" | "cold-email" | "newsletter";

type TableColumn = {
  label: string;
  align?: "left" | "right";
};

type TableRow = {
  label: string;
  cells: string[];
  total?: boolean;
};

type PageTab = {
  key: string;
  label: string;
  href: string;
};

type TenantSupabase = Awaited<ReturnType<typeof requireTenant>>["supabase"];

type BankTransactionRow = {
  id: string;
  source: string;
  transaction_id: string;
  amount: number | string;
  direction: string;
  transaction_date: string;
  name: string | null;
  category: string | null;
  cost_type: string | null;
  is_acquisition: boolean | null;
  is_waste: boolean | null;
  is_recurring: boolean | null;
  is_new_client_revenue: boolean | null;
  raw_data: unknown;
};

type ClientRecordRow = {
  id: string;
  email: string;
  name: string | null;
  excluded: boolean | null;
  first_payment_date: string | null;
  call_booked_date: string | null;
  churn_date: string | null;
  status_start: string | null;
  status_end: string | null;
  retainer_price_cents: number | null;
  raw_data: unknown;
};

type NormalizedPaymentRow = {
  id: string;
  source: string;
  source_id: string;
  customer_email: string | null;
  customer_name: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  payment_date: string;
  description: string | null;
  is_subscription: boolean | null;
  refunded_amount_cents: number | null;
  raw_data: unknown;
};

type SalesEventRow = {
  id: string;
  source: string;
  source_id: string;
  event_date: string;
  contact_email: string | null;
  contact_name: string | null;
  status: string | null;
  is_qualified: boolean | null;
  offer_sent: boolean | null;
  closer: string | null;
  channel: string | null;
  raw_data: unknown;
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

const pageTabs: Partial<Record<MetricTabKey, PageTab[]>> = {
  financial: [
    { key: "overview", label: "Overview", href: "/finance" },
    { key: "transactions-in", label: "Transactions In", href: "/finance/transactions-in" },
    { key: "transactions-out", label: "Transactions Out", href: "/finance/transactions-out" },
    { key: "categories", label: "Categories", href: "/finance/categories" },
    { key: "cost-per-category", label: "Cost Per Category", href: "/finance/cost-per-category" },
  ],
  "churn-ltv": [
    { key: "overview", label: "Overview", href: "/retention" },
    { key: "client-data", label: "Client Data", href: "/retention/client-data" },
    { key: "client-payments", label: "Client Payments", href: "/retention/client-payments" },
  ],
  sales: [
    { key: "overview", label: "Overview", href: "/sales" },
    { key: "calls", label: "Calls", href: "/sales/calls" },
  ],
  inputs: [
    { key: "overview", label: "Overview", href: "/inputs" },
    { key: "cost-per-call", label: "Cost Per Call", href: "/inputs?tab=cost-per-call" },
    { key: "paid-ads", label: "Paid Ads", href: "/inputs?tab=paid-ads" },
    { key: "cold-email", label: "Cold Email", href: "/inputs?tab=cold-email" },
    { key: "newsletter", label: "Newsletter", href: "/inputs?tab=newsletter" },
    { key: "accounts", label: "Accounts", href: "/inputs?tab=accounts" },
  ],
  "cost-per-call": [
    { key: "overview", label: "Overview", href: "/inputs" },
    { key: "cost-per-call", label: "Cost Per Call", href: "/inputs?tab=cost-per-call" },
  ],
};

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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringFrom(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function rawString(raw: unknown, keys: string[]) {
  const record = asRecord(raw);
  for (const key of keys) {
    const value = stringFrom(record[key]);
    if (value) return value;
  }
  return null;
}

function titleCase(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dateInputValue(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function amountNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function centsToMoney(value: number | null | undefined) {
  return money((value ?? 0) / 100);
}

function accountName(row: BankTransactionRow) {
  return rawString(row.raw_data, ["account_name", "account", "accountName", "official_name"]) ?? "CSV Banking Account";
}

function transactionSource(row: BankTransactionRow) {
  return row.name ?? rawString(row.raw_data, ["merchant_name", "source", "description"]) ?? titleCase(row.source);
}

function paymentProduct(row: NormalizedPaymentRow) {
  return row.description ?? rawString(row.raw_data, ["product", "product_name", "plan_name", "name"]) ?? "Subscription update";
}

function paymentLeadSource(row: NormalizedPaymentRow) {
  return rawString(row.raw_data, ["lead_source", "leadSource", "channel"]) ?? titleCase(row.source);
}

function cycleDays(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));
}

function monthsBetween(start: string | null, end: string | null) {
  if (!start) return 1;
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 1;
  const months = Math.max(1, (endDate.getTime() - startDate.getTime()) / (86400000 * 30));
  return months;
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

function PageTabs({ tabs, activeKey }: { tabs?: PageTab[]; activeKey?: string }) {
  if (!tabs?.length) return null;
  const selectedKey = activeKey ?? tabs[0]?.key;
  return (
    <nav className="scaling-subtabs page-child-tabs" aria-label="Page sections">
      {tabs.map((tab) => (
        <Link key={tab.key} href={tab.href} className={tab.key === selectedKey ? "active" : ""}>
          {tab.label}
        </Link>
      ))}
    </nav>
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
  activeChild?: string;
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
    title: "Retention Overview",
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
    activeRoute: "metrics-inputs",
    activeTab: "inputs",
    activeChild: "cost-per-call",
    includeSource: true,
  },
  inputs: {
    title: "Inputs",
    activeRoute: "metrics-inputs",
    activeTab: "inputs",
    activeChild: "overview",
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
        <PageTabs tabs={pageTabs[config.activeTab]} activeKey={config.activeChild ?? "overview"} />
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

const inputChannelConfigs: Record<InputsChannelPageKind, {
  title: string;
  columns: TableColumn[];
}> = {
  "paid-ads": {
    title: "Paid Ads",
    columns: [
      { label: "Spend" },
      { label: "Leads" },
      { label: "Calls" },
      { label: "CAC" },
      { label: "Revenue" },
    ],
  },
  "cold-email": {
    title: "Cold Email",
    columns: [
      { label: "Sent" },
      { label: "Replies" },
      { label: "Booked" },
      { label: "Clients" },
      { label: "Revenue" },
    ],
  },
  newsletter: {
    title: "Newsletter",
    columns: [
      { label: "Sent" },
      { label: "Opens" },
      { label: "Clicks" },
      { label: "Booked" },
      { label: "Revenue" },
    ],
  },
};

export async function ScalingInputsChannelPage({ kind }: { kind: InputsChannelPageKind }) {
  const { tenant } = await requireTenant();
  const config = inputChannelConfigs[kind];
  const rows = [
    ...weeklyRowsDescending.map((label) => ({
      label,
      cells: config.columns.map((column) => column.label === "Spend" || column.label === "Revenue" || column.label === "CAC" ? "$0" : "0"),
    })),
    {
      label: "Total",
      total: true,
      cells: config.columns.map((column) => column.label === "Spend" || column.label === "Revenue" || column.label === "CAC" ? "$0" : "0"),
    },
  ];

  return (
    <AppShell active="metrics-inputs" tenantName={tenant.name}>
      <section className="scaling-page">
        <Header title={config.title} />
        <PageTabs tabs={pageTabs.inputs} activeKey={kind} />
        <PeriodToolbar includeSource />
        <DataTable columns={config.columns} rows={rows} />
      </section>
    </AppShell>
  );
}

export async function ScalingInputsAccountsPage() {
  const { supabase, tenant } = await requireTenant();
  const { data: connections } = await supabase
    .from("metric_integrations")
    .select("provider, status, last_sync_at, last_error")
    .eq("tenant_id", tenant.id);
  const connectionByProvider = new Map((connections ?? []).map((connection) => [connection.provider, connection]));
  const accountIntegrations = integrationCatalog.filter((integration) =>
    ["Forms/Leads", "Social Inputs", "Sales Calls"].includes(integration.group),
  );

  return (
    <AppShell active="metrics-inputs" tenantName={tenant.name}>
      <section className="scaling-page">
        <Header title="Accounts" />
        <PageTabs tabs={pageTabs.inputs} activeKey="accounts" />
        <section className="input-account-grid">
          {accountIntegrations.map((integration) => {
            const connection = connectionByProvider.get(integration.id);
            const connected = Boolean(connection && connection.status !== "disabled");

            return (
              <Link href={`/integrations/${integration.id}`} className="input-account-card" key={integration.id}>
                <div>
                  <strong>{integration.name}</strong>
                  <span>{integration.group}</span>
                </div>
                <p>{integration.description}</p>
                <div className="input-account-footer">
                  <span className={connected ? "status-badge ok" : "status-badge"}>
                    {connected ? "Connected" : "Not connected"}
                  </span>
                  <span>{connected ? "Manage" : "Connect"}</span>
                </div>
              </Link>
            );
          })}
        </section>
      </section>
    </AppShell>
  );
}

async function loadBankRows(supabase: TenantSupabase, tenantId: string, direction?: "inbound" | "outbound") {
  let query = supabase
    .from("bank_transactions")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("transaction_date", { ascending: false })
    .limit(120);

  if (direction) {
    query = query.eq("direction", direction);
  }

  const { data } = await query;
  return (data ?? []) as BankTransactionRow[];
}

async function loadClientRows(supabase: TenantSupabase, tenantId: string) {
  const { data } = await supabase
    .from("client_records")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true })
    .limit(120);

  return (data ?? []) as ClientRecordRow[];
}

async function loadPaymentRows(supabase: TenantSupabase, tenantId: string) {
  const { data } = await supabase
    .from("normalized_payments")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("payment_date", { ascending: false })
    .limit(120);

  return (data ?? []) as NormalizedPaymentRow[];
}

async function loadSalesRows(supabase: TenantSupabase, tenantId: string) {
  const { data } = await supabase
    .from("sales_events")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("event_date", { ascending: false })
    .limit(120);

  return (data ?? []) as SalesEventRow[];
}

function SourcePageChrome({
  activeRoute,
  tenantName,
  title,
  tabGroup,
  activeChild,
  children,
}: {
  activeRoute: ActiveRoute;
  tenantName: string | null;
  title: string;
  tabGroup?: MetricTabKey;
  activeChild?: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell active={activeRoute} tenantName={tenantName}>
      <section className="scaling-page">
        <Header title={title} />
        <PageTabs tabs={tabGroup ? pageTabs[tabGroup] : undefined} activeKey={activeChild} />
        {children}
      </section>
    </AppShell>
  );
}

function StaticCheckbox({ checked = false }: { checked?: boolean | null }) {
  return <input className="source-checkbox" type="checkbox" defaultChecked={Boolean(checked)} aria-label="Selected" />;
}

function ShowExcludedStrip({ title }: { title?: string }) {
  return (
    <div className={title ? "source-header-strip with-title" : "source-header-strip"}>
      {title ? <h2>{title}</h2> : null}
      <label>
        <input type="checkbox" defaultChecked={false} />
        Show Excluded
      </label>
    </div>
  );
}

function MetricSourceToolbar({
  account = false,
  source = false,
  closer = false,
  range = "Last 365 Days",
}: {
  account?: boolean;
  source?: boolean;
  closer?: boolean;
  range?: string;
}) {
  return (
    <div className="source-filter-row">
      <div />
      <div className="source-filter-controls">
        {account ? (
          <select aria-label="Account">
            <option>All Accounts</option>
          </select>
        ) : null}
        {source ? (
          <select aria-label="Source">
            <option>All Sources</option>
          </select>
        ) : null}
        {closer ? (
          <select aria-label="Closer">
            <option>All Closers</option>
          </select>
        ) : null}
        <select aria-label="Year">
          <option>2026</option>
        </select>
        <select aria-label="Range">
          <option>{range}</option>
        </select>
      </div>
    </div>
  );
}

function EmptySourceRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td className="source-empty-cell" colSpan={colSpan}>{label}</td>
    </tr>
  );
}

export async function ScalingTransactionsInPage() {
  const { supabase, tenant } = await requireTenant();
  const transactions = await loadBankRows(supabase, tenant.id, "inbound");

  return (
    <SourcePageChrome
      activeRoute="metrics-financial"
      tenantName={tenant.name}
      title="Transactions In"
      tabGroup="financial"
      activeChild="transactions-in"
    >
      <MetricSourceToolbar account />
      <section className="source-table-panel">
        <ShowExcludedStrip />
        <div className="source-table-scroll">
          <table className="source-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Source</th>
                <th>Account</th>
                <th className="numeric">Amount</th>
                <th className="center">ACH/Wire Revenue</th>
                <th className="center">New Client Revenue</th>
                <th className="center">Exclude</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <EmptySourceRow colSpan={7} label="No revenue transactions found for this period." />
              ) : (
                transactions.map((row) => (
                  <tr key={row.id}>
                    <td>{dateLabel(row.transaction_date)}</td>
                    <td className="strong">{transactionSource(row)}</td>
                    <td className="muted">{accountName(row)}</td>
                    <td className="numeric green">{money(Math.abs(amountNumber(row.amount)))}</td>
                    <td className="center"><StaticCheckbox checked={row.is_recurring} /></td>
                    <td className="center"><StaticCheckbox checked={row.is_new_client_revenue} /></td>
                    <td className="center"><StaticCheckbox checked={false} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </SourcePageChrome>
  );
}

export async function ScalingTransactionsOutPage() {
  const { supabase, tenant } = await requireTenant();
  const transactions = await loadBankRows(supabase, tenant.id, "outbound");

  return (
    <SourcePageChrome
      activeRoute="metrics-financial"
      tenantName={tenant.name}
      title="Transactions Out"
      tabGroup="financial"
      activeChild="transactions-out"
    >
      <MetricSourceToolbar account />
      <section className="source-table-panel">
        <ShowExcludedStrip title="Transactions Out" />
        <div className="source-table-scroll">
          <table className="source-table compact">
            <thead>
              <tr>
                <th>Date</th>
                <th>Source</th>
                <th>Account</th>
                <th>Category</th>
                <th className="numeric">Amount</th>
                <th className="center">Waste?</th>
                <th className="center">Exclude</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <EmptySourceRow colSpan={7} label="No expense transactions found for this period." />
              ) : (
                transactions.map((row) => (
                  <tr key={row.id} className={row.is_waste ? "waste-row" : ""}>
                    <td>{dateLabel(row.transaction_date)}</td>
                    <td>{transactionSource(row)}</td>
                    <td className="muted">{accountName(row)}</td>
                    <td><span className="category-pill">{row.category || "Uncategorized"}</span></td>
                    <td className="numeric">{money(Math.abs(amountNumber(row.amount)))}</td>
                    <td className="center"><StaticCheckbox checked={row.is_waste} /></td>
                    <td className="center"><StaticCheckbox checked={false} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </SourcePageChrome>
  );
}

export async function ScalingCategoriesPage() {
  const { supabase, tenant } = await requireTenant();
  const transactions = await loadBankRows(supabase, tenant.id, "outbound");
  const grouped = new Map<string, BankTransactionRow[]>();
  for (const row of transactions) {
    const source = transactionSource(row);
    grouped.set(source, [...(grouped.get(source) ?? []), row]);
  }
  const sources = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <SourcePageChrome
      activeRoute="metrics-financial"
      tenantName={tenant.name}
      title="Categories"
      tabGroup="financial"
      activeChild="categories"
    >
      <MetricSourceToolbar />
      <p className="source-help-text">Assign categories to transaction sources. These assignments apply to all transactions with the same source.</p>
      <section className="source-table-panel">
        <ShowExcludedStrip />
        <div className="source-table-scroll">
          <table className="source-table category-table">
            <thead>
              <tr>
                <th>Transaction Source</th>
                <th>Category</th>
                <th>Cost Type</th>
                <th>Acquisition</th>
                <th>Status</th>
                <th className="center">Exclude</th>
              </tr>
            </thead>
            <tbody>
              {sources.length === 0 ? (
                <EmptySourceRow colSpan={6} label="No transaction sources found." />
              ) : (
                sources.map(([source, rows]) => {
                  const first = rows[0];
                  const category = first.category || "Uncategorized";
                  const costType = titleCase(first.cost_type || null);
                  const needsCategory = category === "Uncategorized";
                  const needsCostType = !first.cost_type;
                  return (
                    <tr key={source}>
                      <td>
                        <div className="source-name-cell">
                          <span>›</span>
                          <div>
                            <strong>{source}</strong>
                            <small>{rows.length} {rows.length === 1 ? "payment" : "payments"} in current filter</small>
                          </div>
                        </div>
                      </td>
                      <td><span className="source-select">{category}</span></td>
                      <td><span className={first.cost_type ? "source-select active" : "source-select"}>{first.cost_type ? costType : "Select..."}</span></td>
                      <td><label className="source-inline-check"><StaticCheckbox checked={first.is_acquisition} /> CAC</label></td>
                      <td>
                        <span className={needsCategory || needsCostType ? "status-badge warn" : "status-badge ok"}>
                          {needsCategory && needsCostType ? "Needs Both" : needsCategory ? "Needs Category" : needsCostType ? "Needs Cost Type" : "Categorized"}
                        </span>
                      </td>
                      <td className="center"><StaticCheckbox checked={false} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </SourcePageChrome>
  );
}

type CategorySummary = {
  key: string;
  label: string;
  amount: number;
  count: number;
  costType: "Fixed" | "Variable" | "";
};

const defaultCategoryCards = [
  "Customer Acquisition Cost",
  "Fulfillment Cost",
  "Wasted Cost",
  "Paid Ads",
  "Content",
  "Outreach",
  "Partnerships",
  "Appt Setting",
  "Closing",
  "Finance",
  "Admin",
  "Executive Team",
];

function categoryLabel(row: BankTransactionRow) {
  return row.category || "Uncategorized";
}

function summarizeCategories(rows: BankTransactionRow[]) {
  const byLabel = new Map<string, CategorySummary>();
  for (const label of defaultCategoryCards) {
    byLabel.set(label, { key: label, label, amount: 0, count: 0, costType: "" });
  }

  for (const row of rows) {
    const label = categoryLabel(row);
    const mappedLabel = label === "CAC" ? "Customer Acquisition Cost" : label === "Fulfillment" ? "Fulfillment Cost" : label;
    const existing = byLabel.get(mappedLabel) ?? { key: mappedLabel, label: mappedLabel, amount: 0, count: 0, costType: "" };
    existing.amount += Math.abs(amountNumber(row.amount));
    existing.count += 1;
    existing.costType = row.cost_type === "fixed" ? "Fixed" : row.cost_type === "variable" ? "Variable" : existing.costType;
    byLabel.set(mappedLabel, existing);
  }

  return [...byLabel.values()];
}

export async function ScalingCostPerCategoryPage() {
  const { supabase, tenant } = await requireTenant();
  const transactions = await loadBankRows(supabase, tenant.id, "outbound");
  const categories = summarizeCategories(transactions);
  const selectedCategory = "Paid Ads";
  const selectedRows = transactions.filter((row) => categoryLabel(row) === selectedCategory);
  const totalRevenue = Math.max(1, transactions.filter((row) => row.direction === "inbound").reduce((sum, row) => sum + Math.abs(amountNumber(row.amount)), 0));

  return (
    <SourcePageChrome
      activeRoute="metrics-financial"
      tenantName={tenant.name}
      title="Cost Per Category"
      tabGroup="financial"
      activeChild="cost-per-category"
    >
      <MetricSourceToolbar />
      <section className="category-breakdown-panel">
        <div className="source-panel-title">Category Breakdown</div>
        <div className="category-card-grid">
          {categories.map((category) => (
            <article className={category.label === selectedCategory ? "cost-category-card selected" : "cost-category-card"} key={category.key}>
              <div>
                <h3>{category.label}</h3>
                {category.costType ? <span className={category.costType === "Fixed" ? "cost-type fixed" : "cost-type variable"}>{category.costType}</span> : null}
              </div>
              <strong>{money(category.amount)}</strong>
              <p>{category.count} entries</p>
              <p>{((category.amount / totalRevenue) * 100).toFixed(1)}% of revenue</p>
            </article>
          ))}
        </div>
      </section>
      <section className="source-table-panel cost-detail-panel">
        <div className="source-panel-title detail-title">
          <span>{selectedCategory} Transactions</span>
          <div>
            <span>{selectedRows.length} entries</span>
            <select aria-label="Category">
              <option>{selectedCategory}</option>
            </select>
          </div>
        </div>
        <div className="source-table-scroll">
          <table className="source-table compact">
            <thead>
              <tr>
                <th>Date</th>
                <th>Source</th>
                <th className="numeric">Amount</th>
              </tr>
            </thead>
            <tbody>
              {selectedRows.length === 0 ? (
                <EmptySourceRow colSpan={3} label="No transactions in this category yet. Assign categories on the Categories page." />
              ) : (
                selectedRows.map((row) => (
                  <tr key={row.id}>
                    <td>{dateLabel(row.transaction_date)}</td>
                    <td>{transactionSource(row)}</td>
                    <td className="numeric">{money(Math.abs(amountNumber(row.amount)))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </SourcePageChrome>
  );
}

export async function ScalingClientDataPage() {
  const { supabase, tenant } = await requireTenant();
  const [clients, payments] = await Promise.all([
    loadClientRows(supabase, tenant.id),
    loadPaymentRows(supabase, tenant.id),
  ]);
  const paymentsByEmail = new Map<string, NormalizedPaymentRow[]>();
  for (const payment of payments) {
    const email = payment.customer_email?.toLowerCase();
    if (!email) continue;
    paymentsByEmail.set(email, [...(paymentsByEmail.get(email) ?? []), payment]);
  }

  return (
    <SourcePageChrome
      activeRoute="metrics-churn-ltv"
      tenantName={tenant.name}
      title="Client Data"
      tabGroup="churn-ltv"
      activeChild="client-data"
    >
      <MetricSourceToolbar range="Full Year" />
      <div className="client-data-heading">
        <div>
          <h2>Client Data</h2>
          <p>All client information and status</p>
        </div>
        <div className="source-filter-controls">
          <select aria-label="Sort">
            <option>Sort: Name</option>
          </select>
          <select aria-label="Clients">
            <option>All Clients</option>
          </select>
        </div>
      </div>
      <section className="source-table-panel">
        <ShowExcludedStrip />
        <div className="source-table-scroll">
          <table className="source-table client-data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Booked</th>
                <th>Closed</th>
                <th className="numeric">Cycle (d)</th>
                <th>Churned</th>
                <th className="numeric">Mo</th>
                <th className="numeric">Ret.</th>
                <th className="center">Type</th>
                <th className="numeric">Pay #</th>
                <th className="numeric">Paid</th>
                <th className="center">Status</th>
                <th>Reason</th>
                <th className="center">Exclude</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <EmptySourceRow colSpan={14} label="No clients found for this period." />
              ) : (
                clients.map((client) => {
                  const email = client.email.toLowerCase();
                  const clientPayments = paymentsByEmail.get(email) ?? [];
                  const paid = clientPayments.reduce((sum, payment) => sum + ((payment.amount_cents - (payment.refunded_amount_cents ?? 0)) / 100), 0);
                  const isActive = (client.status_end ?? "active") === "active" && !client.churn_date;
                  const monthly = (client.retainer_price_cents ?? 0) / 100;
                  const firstPayment = client.first_payment_date;
                  const cycle = cycleDays(client.call_booked_date, firstPayment);
                  return (
                    <tr key={client.id} className={client.excluded ? "muted-row" : ""}>
                      <td className="strong">{client.name || client.email}</td>
                      <td className="muted">{client.email}</td>
                      <td><input className="source-date-input" type="date" defaultValue={dateInputValue(client.call_booked_date)} /></td>
                      <td><input className="source-date-input" type="date" defaultValue={dateInputValue(firstPayment)} /></td>
                      <td className="numeric">{cycle === null ? "—" : `${cycle} days`}</td>
                      <td><input className="source-date-input" type="date" defaultValue={dateInputValue(client.churn_date)} /></td>
                      <td className="numeric">{monthsBetween(firstPayment, client.churn_date).toFixed(1)}</td>
                      <td className="numeric">{money(monthly)}</td>
                      <td className="center"><span className="source-select small">{clientPayments.some((payment) => payment.is_subscription) ? "Recurring" : "One-Time"}</span></td>
                      <td className="numeric">{clientPayments.length}</td>
                      <td className="numeric green">{money(paid)}</td>
                      <td className="center"><span className={isActive ? "status-badge ok" : "status-badge danger"}>{isActive ? "Active" : "Cancelled"}</span></td>
                      <td><span className="source-select reason">{rawString(client.raw_data, ["churn_reason", "reason"]) ?? "Select reason..."}</span></td>
                      <td className="center"><StaticCheckbox checked={client.excluded} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </SourcePageChrome>
  );
}

export async function ScalingClientPaymentsPage() {
  const { supabase, tenant } = await requireTenant();
  const payments = await loadPaymentRows(supabase, tenant.id);

  return (
    <SourcePageChrome
      activeRoute="metrics-churn-ltv"
      tenantName={tenant.name}
      title="Client Payments"
      tabGroup="churn-ltv"
      activeChild="client-payments"
    >
      <div className="client-payment-toolbar">
        <div className="source-filter-controls">
          <select aria-label="Customers">
            <option>All Customers</option>
          </select>
          <select aria-label="Types">
            <option>All Types</option>
          </select>
          <span>Edit Lead Sources</span>
          <select aria-label="Year"><option>2026</option></select>
          <select aria-label="Range"><option>Last 30 Days</option></select>
        </div>
        <div className="client-payment-actions">
          <span>Import CSV</span>
          <span className="purple">+ Add Payment</span>
        </div>
      </div>
      <section className="source-table-panel">
        <ShowExcludedStrip />
        <div className="source-table-scroll">
          <table className="source-table client-payments-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Email</th>
                <th>Product</th>
                <th className="numeric">Amount</th>
                <th className="numeric">Net</th>
                <th>Lead Source</th>
                <th className="center">Type</th>
                <th className="center">Exclude</th>
                <th className="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <EmptySourceRow colSpan={10} label="No payments found." />
              ) : (
                payments.map((payment) => {
                  const net = payment.amount_cents - (payment.refunded_amount_cents ?? 0);
                  return (
                    <tr key={payment.id}>
                      <td>{payment.payment_date}</td>
                      <td className="strong">{payment.customer_name || "Customer"}</td>
                      <td className="muted">{payment.customer_email || "—"}</td>
                      <td className="muted">{paymentProduct(payment)}</td>
                      <td className="numeric">{centsToMoney(payment.amount_cents)}</td>
                      <td className="numeric green">{centsToMoney(net)}</td>
                      <td><span className="category-pill">{paymentLeadSource(payment)}</span></td>
                      <td className="center"><span className="type-pill">{payment.is_subscription ? "Recurring" : "One-Time"}</span></td>
                      <td className="center"><StaticCheckbox checked={false} /></td>
                      <td className="center"><span className="row-actions">Edit Link Del</span></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </SourcePageChrome>
  );
}

function salesStatus(row: SalesEventRow, status: string) {
  const normalized = (row.status ?? "").toLowerCase();
  if (status === "shown") return ["shown", "qualified", "offered", "closed"].includes(normalized);
  if (status === "offer") return Boolean(row.offer_sent) || ["offered", "closed"].includes(normalized);
  if (status === "closed") return normalized === "closed";
  if (status === "unqualified") return row.is_qualified === false || normalized === "unqualified";
  if (status === "lost") return ["lost", "closed_lost"].includes(normalized);
  return false;
}

function StatusToggle({ active, negative = false }: { active: boolean; negative?: boolean }) {
  if (active) {
    return <span className={negative ? "status-toggle negative" : "status-toggle positive"}>✓</span>;
  }
  return <span className="status-toggle neutral">−</span>;
}

export async function ScalingSalesCallsPage() {
  const { supabase, tenant } = await requireTenant();
  const [calls, schedulerConnections] = await Promise.all([
    loadSalesRows(supabase, tenant.id),
    supabase
      .from("metric_integrations")
      .select("provider, status")
      .eq("tenant_id", tenant.id)
      .in("provider", ["calendly", "calcom", "iclosed"])
      .neq("status", "disabled"),
  ]);
  const connectedSchedulerCount = schedulerConnections.data?.length ?? 0;
  const eventTypeNames = [...new Set(
    calls
      .map((call) => rawString(call.raw_data, ["event_type_name", "event_name", "title"]))
      .filter((value): value is string => Boolean(value)),
  )];

  return (
    <SourcePageChrome
      activeRoute="metrics-sales"
      tenantName={tenant.name}
      title="Sales Calls"
      tabGroup="sales"
      activeChild="calls"
    >
      <div className="sales-call-toolbar">
        <div className="sales-call-status">
          <span>Individual call records</span>
          {connectedSchedulerCount > 0 ? (
            <span className="connected-dot"><i /> {connectedSchedulerCount} scheduler{connectedSchedulerCount === 1 ? "" : "s"} connected</span>
          ) : null}
          {eventTypeNames.length > 0 ? (
            <span className="event-types">{eventTypeNames.length} event type{eventTypeNames.length === 1 ? "" : "s"}</span>
          ) : null}
        </div>
        <div className="source-filter-controls">
          {eventTypeNames.length > 0 ? (
            <select aria-label="Event type">
              <option>All Event Types</option>
              {eventTypeNames.map((eventTypeName) => (
                <option key={eventTypeName}>{eventTypeName}</option>
              ))}
            </select>
          ) : null}
          <select aria-label="Closer"><option>All Closers</option></select>
          <select aria-label="Source"><option>All Sources</option></select>
          <select aria-label="Year"><option>2026</option></select>
          <select aria-label="Range"><option>Last 30 Days</option></select>
        </div>
      </div>
      <section className="source-table-panel sales-calls-panel">
        <ShowExcludedStrip />
        <div className="source-table-scroll">
          <table className="source-table sales-calls-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Call Date</th>
                <th>Source</th>
                <th>Closer</th>
                <th className="center">Shown</th>
                <th className="center">Offer</th>
                <th className="center">Closed</th>
                <th className="center">Unqualified</th>
                <th className="center">Closed Lost</th>
                <th>Lost Reason</th>
                <th className="center">Do Not Count</th>
              </tr>
            </thead>
            <tbody>
              {calls.length === 0 ? (
                <EmptySourceRow colSpan={12} label="No sales calls found." />
              ) : (
                calls.map((call) => (
                  <tr key={call.id}>
                    <td className="strong">{call.contact_name || "Unknown"}</td>
                    <td className="muted">{call.contact_email || "—"}</td>
                    <td>
                      <span>{dateLabel(call.event_date)}</span>
                      <small>{rawString(call.raw_data, ["event_type_name", "event_name", "title"]) ?? ""}</small>
                    </td>
                    <td className="muted">{titleCase(call.source)}</td>
                    <td><span className="blue-link">{call.closer || "Closer 1"}</span></td>
                    <td className="center"><StatusToggle active={salesStatus(call, "shown")} /></td>
                    <td className="center"><StatusToggle active={salesStatus(call, "offer")} /></td>
                    <td className="center"><StatusToggle active={salesStatus(call, "closed")} /></td>
                    <td className="center"><StatusToggle active={salesStatus(call, "unqualified")} negative /></td>
                    <td className="center"><StatusToggle active={salesStatus(call, "lost")} negative /></td>
                    <td>{rawString(call.raw_data, ["lost_reason", "reason"]) ?? "-"}</td>
                    <td className="center"><StaticCheckbox checked={false} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </SourcePageChrome>
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
        <div className="most-important-toolbar">
          <div className="most-important-date-controls">
            <select aria-label="Year">
              <option>2026</option>
            </select>
            <select aria-label="Range">
              <option>Last 30 Days</option>
              <option>Last 7 Days</option>
              <option>Last 14 Days</option>
              <option>Last 90 Days</option>
              <option>Last 180 Days</option>
              <option>Last 365 Days</option>
            </select>
            <span className="light-button">Refresh</span>
          </div>
          <div className="most-important-filter-controls">
            <span>Sort</span>
            <select aria-label="Sort">
              <option>Default</option>
            </select>
            <span>Tag</span>
            <select aria-label="Tag">
              <option>All tags</option>
            </select>
          </div>
        </div>
        <div className="scaling-metric-grid">
          {definitions.map((definition, index) => (
            <article className="scaling-metric-card" key={`${definition.id}-${index}`}>
              <div className="metric-card-head">
                <span>{definition.name}</span>
                <span className="info-dot">i</span>
              </div>
              <strong>{metricDisplay(payload, definition.id, definition.format === "currency" ? "$0" : "—")}</strong>
            </article>
          ))}
        </div>
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

function benchmarkTargetCopy(row: Awaited<ReturnType<typeof buildConstraintsDigest>>["rows"][number]) {
  if (row.scale === null) return "Add a target for this metric.";
  const scale = formatConstraintValue(row, row.scale);
  const minimum = formatConstraintValue(row, row.minimum);
  return row.benchmark.inverse
    ? `Scale target: at or below ${scale}. Minimum: at or below ${minimum}.`
    : `Scale target: at or above ${scale}. Minimum: at or above ${minimum}.`;
}

function benchmarkStatusCopy(row: Awaited<ReturnType<typeof buildConstraintsDigest>>["rows"][number]) {
  if (row.scale === null) return "Needs target";
  if (row.status === "scale_met") return "Scale target met";
  if (row.status === "minimum_met") return "Minimum met";
  if (row.status === "missing") return "Needs data";
  return "Constraint";
}

function benchmarkInputValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : String(value);
}

export async function ScalingBenchmarksPage() {
  const { supabase, tenant } = await requireTenant();
  const [digest, savedTargets] = await Promise.all([
    buildConstraintsDigest({ supabase, tenantId: tenant.id, periodKey: "30d" }),
    supabase
      .from("metric_benchmark_targets")
      .select("benchmark_id, notes")
      .eq("tenant_id", tenant.id),
  ]);
  const notesByBenchmarkId = new Map((savedTargets.data ?? []).map((row) => [row.benchmark_id, row.notes ?? ""]));
  const mostImportantIds = Array.from(new Set(mostImportantMetricIds));
  const rows = digest.rows.filter((row) => mostImportantIds.includes(row.benchmark.metricId));
  const biggest =
    rows.find((row) => row.status === "constrained" && row.gapPercent !== null) ??
    rows.find((row) => row.scale === null) ??
    rows.find((row) => row.status === "missing") ??
    rows[0] ??
    null;

  return (
    <AppShell active="metrics-benchmarking" tenantName={tenant.name}>
      <section className="scaling-page">
        <Header title="Benchmarks" />
        {biggest ? (
          <section className="benchmark-focus-panel">
            <div>
              <span>Biggest constraint</span>
              <h2>{biggest.benchmark.name}</h2>
              <p>
                Current: {formatConstraintValue(biggest, biggest.actual)} · Target:{" "}
                {formatConstraintValue(biggest, biggest.scale)} · Gap:{" "}
                {biggest.gapPercent === null ? "Needs data" : `${biggest.gapPercent.toFixed(1)}%`}
              </p>
            </div>
            <ol>
              {biggest.suggestions.slice(0, 5).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        ) : null}
        <section className="source-table-panel benchmarks-panel">
          <div className="source-table-scroll">
            <table className="source-table">
              <thead>
                <tr>
                  <th>Benchmark</th>
                  <th>Category</th>
                  <th>Actual</th>
                  <th>Minimum</th>
                  <th>Scale Target</th>
                  <th>Status</th>
                  <th>What You Should Have</th>
                  <th>Notes</th>
                  <th>Save</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const formId = `benchmark-${row.benchmark.id}`;
                  return (
                  <tr key={row.benchmark.id}>
                    <td className="strong">{row.benchmark.name}</td>
                    <td className="muted">{row.benchmark.category}</td>
                    <td>{formatConstraintValue(row, row.actual)}</td>
                    <td>
                      <input
                        form={formId}
                        className="benchmark-input"
                        name="minimumValue"
                        defaultValue={benchmarkInputValue(row.minimum)}
                        aria-label={`${row.benchmark.name} minimum`}
                      />
                    </td>
                    <td>
                      <input
                        form={formId}
                        className="benchmark-input"
                        name="targetValue"
                        defaultValue={benchmarkInputValue(row.scale)}
                        aria-label={`${row.benchmark.name} target`}
                      />
                    </td>
                    <td>{benchmarkStatusCopy(row)}</td>
                    <td>{benchmarkTargetCopy(row)}</td>
                    <td>
                      <input
                        form={formId}
                        className="benchmark-notes-input"
                        name="notes"
                        defaultValue={notesByBenchmarkId.get(row.benchmark.id) ?? ""}
                        aria-label={`${row.benchmark.name} notes`}
                      />
                    </td>
                    <td>
                      <form id={formId} action={saveBenchmarkTargetAction}>
                        <input type="hidden" name="benchmarkId" value={row.benchmark.id} />
                        <input type="hidden" name="next" value="/benchmarks" />
                        <button className="mini-save-button" type="submit">Save</button>
                      </form>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        </section>
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

const integrationDisplayNames: Record<string, string> = {
  calcom: "Cal.com",
  iclosed: "iClosed",
  readai: "Read.ai",
  twitter: "X (Twitter)",
  facebook: "Facebook Page",
};

const integrationDescriptions: Record<string, string> = {
  calendly: "Track calls booked, show rate, and scheduling",
  calcom: "Track calls booked from Cal.com bookings",
  iclosed: "AI scheduler and CRM for high-ticket sales teams",
  readai: "AI meeting notes, transcripts, and call analytics",
  fathom: "AI note-taker for call recordings and summaries",
  fireflies: "AI meeting transcripts and summaries from Fireflies",
  typeform: "Ingest application form submissions into the sales pipeline",
  heyflow: "Ingest Heyflow application submissions into the sales pipeline",
  linkedin: "Track posts and engagement (requires API access)",
  twitter: "Track posts and engagement for your X account",
  instagram: "Track posts/reels and engagement (business/creator)",
  facebook: "Track page posts and engagement",
  stripe: "Track payments, revenue, churn, and median client payment",
  fanbasis: "Track payments and revenue from Fanbasis",
  whop: "Track membership payments and revenue from Whop",
  plaid: "Connect bank accounts to track revenue and expenses",
  "csv-banking": "Upload monthly bank CSVs with overlap-safe dedupe to track cash in and cash out",
  quickbooks: "Banking sync is coming soon",
  slack: "Ask for metrics, constraints, forecasts, and department views from Slack",
  telegram: "Ask for metrics, constraints, forecasts, and department views from Telegram",
};

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

  return (
    <AppShell active={active} tenantName={tenant.name}>
      <section className="scaling-page integrations-page">
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
                  const displayName = integrationDisplayNames[id] ?? integration.name;
                  const description = integrationDescriptions[id] ?? integration.description;
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
                        {integrationInitials(displayName)}
                      </span>
                      <div className="integration-card-body">
                        <div className="integration-name-row">
                          <h3>{displayName}</h3>
                          {integration.comingSoon ? (
                            <span className="status-badge soon">Coming soon</span>
                          ) : connected ? (
                            <span className="status-badge">Connected</span>
                          ) : null}
                        </div>
                        <p className="integration-description">{description}</p>
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
