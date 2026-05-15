import { metricDefinitions } from "@/lib/metrics/definitions";
import { dateOnly, isDateWithin, roundMetricValue, safeDivide, toNumber } from "@/lib/metrics/format";
import type { ResolvedPeriod } from "@/lib/metrics/period";

type PaymentRow = {
  customer_email: string | null;
  amount_cents: number;
  refunded_amount_cents: number | null;
  status: string;
  payment_date: string;
  is_subscription: boolean | null;
};

type ClientRow = {
  email: string;
  excluded: boolean | null;
  first_payment_date: string | null;
  churn_date: string | null;
  status_start: string | null;
  status_end: string | null;
};

type BankRow = {
  amount: number | string;
  direction: string;
  transaction_date: string;
  category: string | null;
  cost_type: string | null;
  is_acquisition: boolean | null;
  is_waste: boolean | null;
  is_recurring: boolean | null;
  is_new_client_revenue: boolean | null;
};

type SalesRow = {
  event_date: string;
  status: string | null;
  is_qualified: boolean | null;
  offer_sent: boolean | null;
};

type SocialPostRow = {
  posted_at: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
};

export type MetricsComputeInputs = {
  window: ResolvedPeriod;
  payments: PaymentRow[];
  clients: ClientRow[];
  bankTransactions: BankRow[];
  salesEvents: SalesRow[];
  socialPosts: SocialPostRow[];
  teamHeadcount: number;
};

export type MetricSnapshotValue = {
  metric_id: string;
  value: number | null;
  raw_inputs: Record<string, unknown>;
  sources: Record<string, unknown>;
};

function centsToDollars(cents: number) {
  return cents / 100;
}

function paymentNetCents(payment: PaymentRow) {
  return payment.amount_cents - (payment.refunded_amount_cents ?? 0);
}

function successfulPayment(payment: PaymentRow) {
  return ["succeeded", "paid", "complete", "completed", "success"].includes(
    payment.status.toLowerCase(),
  );
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function put(
  metrics: Record<string, MetricSnapshotValue>,
  metricId: string,
  value: number | null,
  rawInputs: Record<string, unknown>,
  sources: Record<string, unknown>,
) {
  metrics[metricId] = {
    metric_id: metricId,
    value: roundMetricValue(metricId, value),
    raw_inputs: rawInputs,
    sources,
  };
}

function get(metrics: Record<string, MetricSnapshotValue>, metricId: string) {
  return metrics[metricId]?.value ?? null;
}

export function computeMetrics(inputs: MetricsComputeInputs) {
  const { startDate, endDate } = inputs.window;
  const metrics: Record<string, MetricSnapshotValue> = {};

  const clients = inputs.clients.filter((client) => client.excluded !== true);
  const clientEmails = new Set(clients.map((client) => client.email.toLowerCase()).filter(Boolean));
  const newClientEmails = new Set(
    clients
      .filter((client) => isDateWithin(client.first_payment_date, startDate, endDate))
      .map((client) => client.email.toLowerCase()),
  );
  const churnedClients = clients.filter((client) => isDateWithin(client.churn_date, startDate, endDate)).length;
  const activeClients = clients.filter((client) => (client.status_end ?? "active") === "active").length;
  const startActiveClients = clients.filter((client) => (client.status_start ?? "active") === "active").length || activeClients;

  const payments = inputs.payments.filter((payment) => {
    const paidAt = dateOnly(payment.payment_date);
    if (!isDateWithin(paidAt, startDate, endDate)) return false;
    if (!successfulPayment(payment)) return false;
    const email = payment.customer_email?.toLowerCase();
    return !email || clientEmails.size === 0 || clientEmails.has(email);
  });
  const paymentDollars = payments.map((payment) => centsToDollars(paymentNetCents(payment)));
  const revenueFromPayments = paymentDollars.reduce((sum, value) => sum + value, 0);
  const recurringRevenueFromPayments = payments
    .filter((payment) => payment.is_subscription)
    .reduce((sum, payment) => sum + centsToDollars(paymentNetCents(payment)), 0);
  const newClientRevenueFromPayments = payments.reduce((sum, payment) => {
    const email = payment.customer_email?.toLowerCase();
    return email && newClientEmails.has(email) ? sum + centsToDollars(paymentNetCents(payment)) : sum;
  }, 0);

  const bankRows = inputs.bankTransactions.filter((row) =>
    isDateWithin(row.transaction_date, startDate, endDate),
  );
  const inboundRows = bankRows.filter((row) => row.direction === "inbound");
  const outboundRows = bankRows.filter((row) => row.direction === "outbound");
  const sumRows = (rows: BankRow[]) => rows.reduce((sum, row) => sum + Math.abs(toNumber(row.amount) ?? 0), 0);
  const cashIn = sumRows(inboundRows);
  const cashOut = sumRows(outboundRows);
  const revenueFromBank = inboundRows
    .filter((row) => row.category?.toLowerCase() === "revenue")
    .reduce((sum, row) => sum + Math.abs(toNumber(row.amount) ?? 0), 0);
  const recurringRevenueFromBank = inboundRows
    .filter((row) => row.is_recurring)
    .reduce((sum, row) => sum + Math.abs(toNumber(row.amount) ?? 0), 0);
  const newClientRevenueFromBank = inboundRows
    .filter((row) => row.is_new_client_revenue)
    .reduce((sum, row) => sum + Math.abs(toNumber(row.amount) ?? 0), 0);
  const expenses = cashOut;
  const fixedCosts = sumRows(outboundRows.filter((row) => row.cost_type === "fixed"));
  const variableCosts = sumRows(outboundRows.filter((row) => row.cost_type === "variable"));
  const fulfillmentCosts = sumRows(outboundRows.filter((row) => row.cost_type === "fulfillment" || row.category === "fulfillment"));
  const wastedMoney = sumRows(outboundRows.filter((row) => row.is_waste));
  const acquisitionCosts = sumRows(outboundRows.filter((row) => row.is_acquisition));

  const salesRows = inputs.salesEvents.filter((row) => isDateWithin(dateOnly(row.event_date), startDate, endDate));
  const callsBooked = salesRows.length;
  const callsShown = salesRows.filter((row) => ["shown", "closed", "qualified", "offered"].includes((row.status ?? "").toLowerCase())).length;
  const callsClosed = salesRows.filter((row) => (row.status ?? "").toLowerCase() === "closed").length;
  const callsUnqualified = salesRows.filter((row) => row.is_qualified === false).length;
  const offersSent = salesRows.filter((row) => row.offer_sent).length;

  const revenue = revenueFromPayments + revenueFromBank;
  const recurringRevenue = recurringRevenueFromPayments + recurringRevenueFromBank;
  const newClientRevenue = newClientRevenueFromPayments + newClientRevenueFromBank;
  const mrr = recurringRevenue;
  const netCashFlow = cashIn - cashOut;
  const netProfit = revenue - expenses;
  const monthlyClientPayment = safeDivide(recurringRevenue, activeClients);
  const churn = startActiveClients > 0 ? (churnedClients / startActiveClients) * 100 : null;
  const avgRelationship = churn && churn > 0 ? 100 / churn : null;
  const revenueLtv = monthlyClientPayment !== null && avgRelationship !== null
    ? monthlyClientPayment * avgRelationship
    : null;
  const grossMargin = revenue > 0 ? ((revenue - fulfillmentCosts) / revenue) * 100 : null;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : null;
  const grossMarginLtv = revenueLtv !== null && grossMargin !== null ? revenueLtv * (grossMargin / 100) : null;
  const netMarginLtv = revenueLtv !== null && netMargin !== null ? revenueLtv * (netMargin / 100) : null;
  const cac = safeDivide(acquisitionCosts, newClientEmails.size);
  const averageMonthlyExpenses = expenses;
  const bankBalance = cashIn - cashOut;

  put(metrics, "mrr", mrr, { recurring_revenue: recurringRevenue }, { payments: payments.length, bank_rows: inboundRows.length });
  put(metrics, "arr", mrr * 12, { mrr }, { derived_from: ["mrr"] });
  put(metrics, "revenue", revenue, { revenue_from_payments: revenueFromPayments, revenue_from_bank: revenueFromBank }, { payments: payments.length, bank_rows: inboundRows.length });
  put(metrics, "new_client_revenue", newClientRevenue, { new_client_count: newClientEmails.size }, { derived_from: ["new_clients", "revenue"] });
  put(metrics, "recurring_revenue", recurringRevenue, { recurring_revenue_from_payments: recurringRevenueFromPayments, recurring_revenue_from_bank: recurringRevenueFromBank }, { payments: payments.length, bank_rows: inboundRows.length });
  put(metrics, "cash_in", cashIn, { inbound_rows: inboundRows.length }, { bank_transactions: inboundRows.length });
  put(metrics, "cash_out", cashOut, { outbound_rows: outboundRows.length }, { bank_transactions: outboundRows.length });
  put(metrics, "net_cash_flow", netCashFlow, { cash_in: cashIn, cash_out: cashOut }, { derived_from: ["cash_in", "cash_out"] });
  put(metrics, "cash_margin", cashIn > 0 ? (netCashFlow / cashIn) * 100 : null, { net_cash_flow: netCashFlow, cash_in: cashIn }, { derived_from: ["net_cash_flow", "cash_in"] });
  put(metrics, "expenses", expenses, { outbound_rows: outboundRows.length }, { bank_transactions: outboundRows.length });
  put(metrics, "net_profit", netProfit, { revenue, expenses }, { derived_from: ["revenue", "expenses"] });
  put(metrics, "net_margin", netMargin, { net_profit: netProfit, revenue }, { derived_from: ["net_profit", "revenue"] });
  put(metrics, "gross_margin", grossMargin, { revenue, fulfillment_costs: fulfillmentCosts }, { derived_from: ["revenue", "fulfillment_costs"] });
  put(metrics, "fixed_costs", fixedCosts, { outbound_rows: outboundRows.length }, { bank_transactions: outboundRows.length });
  put(metrics, "variable_costs", variableCosts, { outbound_rows: outboundRows.length }, { bank_transactions: outboundRows.length });
  put(metrics, "fulfillment_costs", fulfillmentCosts, { outbound_rows: outboundRows.length }, { bank_transactions: outboundRows.length });
  put(metrics, "wasted_money", wastedMoney, { outbound_rows: outboundRows.length }, { bank_transactions: outboundRows.length });
  put(metrics, "acquisition_costs", acquisitionCosts, { outbound_rows: outboundRows.length }, { bank_transactions: outboundRows.length });
  put(metrics, "cac", cac, { acquisition_costs: acquisitionCosts, new_clients: newClientEmails.size }, { derived_from: ["acquisition_costs", "new_clients"] });
  put(metrics, "cost_per_call", safeDivide(acquisitionCosts, callsBooked), { acquisition_costs: acquisitionCosts, calls_booked: callsBooked }, { derived_from: ["acquisition_costs", "calls_booked"] });
  put(metrics, "bank_balance", bankBalance, { cash_in: cashIn, cash_out: cashOut }, { bank_transactions: bankRows.length });
  put(metrics, "runway", averageMonthlyExpenses > 0 ? bankBalance / averageMonthlyExpenses : null, { bank_balance: bankBalance, expenses }, { derived_from: ["bank_balance", "expenses"] });
  put(metrics, "active_clients", activeClients, { clients: clients.length }, { client_records: clients.length });
  put(metrics, "churned_clients", churnedClients, { clients: clients.length }, { client_records: clients.length });
  put(metrics, "new_clients", newClientEmails.size, { clients: clients.length }, { client_records: clients.length });
  put(metrics, "churn", churn, { churned_clients: churnedClients, active_clients_start: startActiveClients }, { derived_from: ["churned_clients", "active_clients"] });
  put(metrics, "nrr", null, { reason: "Cohort retention sync not connected yet" }, { required_sources: ["payment_subscriptions"] });
  put(metrics, "avg_relationship", avgRelationship, { churn }, { derived_from: ["churn"] });
  put(metrics, "median_payment", median(paymentDollars), { payment_count: payments.length }, { payments: payments.length });
  put(metrics, "monthly_client_payment", monthlyClientPayment, { recurring_revenue: recurringRevenue, active_clients: activeClients }, { derived_from: ["recurring_revenue", "active_clients"] });
  put(metrics, "revenue_ltv", revenueLtv, { monthly_client_payment: monthlyClientPayment, avg_relationship: avgRelationship }, { derived_from: ["monthly_client_payment", "avg_relationship"] });
  put(metrics, "gross_margin_ltv", grossMarginLtv, { revenue_ltv: revenueLtv, gross_margin: grossMargin }, { derived_from: ["revenue_ltv", "gross_margin"] });
  put(metrics, "net_margin_ltv", netMarginLtv, { revenue_ltv: revenueLtv, net_margin: netMargin }, { derived_from: ["revenue_ltv", "net_margin"] });
  put(metrics, "ltv_cac", safeDivide(revenueLtv, cac), { revenue_ltv: revenueLtv, cac }, { derived_from: ["revenue_ltv", "cac"] });
  put(metrics, "gross_ltv_cac", safeDivide(grossMarginLtv, cac), { gross_margin_ltv: grossMarginLtv, cac }, { derived_from: ["gross_margin_ltv", "cac"] });
  put(metrics, "net_ltv_cac", safeDivide(netMarginLtv, cac), { net_margin_ltv: netMarginLtv, cac }, { derived_from: ["net_margin_ltv", "cac"] });
  put(metrics, "payback", cac !== null && monthlyClientPayment !== null && grossMargin !== null && monthlyClientPayment > 0 ? cac / (monthlyClientPayment * (grossMargin / 100)) : null, { cac, monthly_client_payment: monthlyClientPayment, gross_margin: grossMargin }, { derived_from: ["cac", "monthly_client_payment", "gross_margin"] });
  put(metrics, "revenue_per_employee", safeDivide(revenue, inputs.teamHeadcount || null), { revenue, team_headcount: inputs.teamHeadcount }, { derived_from: ["revenue", "tenant_memberships"] });
  put(metrics, "calls_booked", callsBooked, { sales_events: salesRows.length }, { sales_events: salesRows.length });
  put(metrics, "calls_shown", callsShown, { sales_events: salesRows.length }, { sales_events: salesRows.length });
  put(metrics, "calls_closed", callsClosed, { sales_events: salesRows.length }, { sales_events: salesRows.length });
  put(metrics, "calls_unqualified", callsUnqualified, { sales_events: salesRows.length }, { sales_events: salesRows.length });
  put(metrics, "qualified_calls", Math.max(0, callsShown - callsUnqualified), { calls_shown: callsShown, calls_unqualified: callsUnqualified }, { derived_from: ["calls_shown", "calls_unqualified"] });
  put(metrics, "offers_sent", offersSent, { sales_events: salesRows.length }, { sales_events: salesRows.length });
  put(metrics, "call_show_rate", callsBooked > 0 ? (callsShown / callsBooked) * 100 : null, { calls_shown: callsShown, calls_booked: callsBooked }, { derived_from: ["calls_shown", "calls_booked"] });
  put(metrics, "call_close_rate", callsBooked > 0 ? (callsClosed / callsBooked) * 100 : null, { calls_closed: callsClosed, calls_booked: callsBooked }, { derived_from: ["calls_closed", "calls_booked"] });
  put(metrics, "no_show_rate", callsBooked > 0 ? ((callsBooked - callsShown) / callsBooked) * 100 : null, { calls_booked: callsBooked, calls_shown: callsShown }, { derived_from: ["calls_booked", "calls_shown"] });
  put(metrics, "call_offer_rate", callsShown > 0 ? (offersSent / callsShown) * 100 : null, { offers_sent: offersSent, calls_shown: callsShown }, { derived_from: ["offers_sent", "calls_shown"] });
  put(metrics, "call_unqualified_rate", callsShown > 0 ? (callsUnqualified / callsShown) * 100 : null, { calls_unqualified: callsUnqualified, calls_shown: callsShown }, { derived_from: ["calls_unqualified", "calls_shown"] });
  put(metrics, "sales_cycle", null, { reason: "Sales cycle requires linked booked call and first payment dates" }, { required_sources: ["sales_events", "client_records"] });

  for (const definition of metricDefinitions) {
    if (!metrics[definition.id]) {
      put(metrics, definition.id, get(metrics, definition.id), {}, { definition_only: true });
    }
  }

  return metrics;
}
