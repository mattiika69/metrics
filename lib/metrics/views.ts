import { metricDefinitions } from "@/lib/metrics/definitions";
import { formatMetricValue } from "@/lib/metrics/format";
import { loadMetricSnapshotPayload } from "@/lib/metrics/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseLike = SupabaseClient;

export type MetricViewKey =
  | "ceo"
  | "marketing"
  | "sales"
  | "retention"
  | "finance"
  | "constraints"
  | "forecasting";

export type MetricViewDefinition = {
  key: MetricViewKey;
  title: string;
  href: string;
  description: string;
  defaultMetricIds: string[];
};

export const metricViewDefinitions: MetricViewDefinition[] = [
  {
    key: "ceo",
    title: "CEO Dashboard",
    href: "/dashboard",
    description: "The executive source of truth across growth, cash, clients, and constraints.",
    defaultMetricIds: ["revenue", "mrr", "arr", "net_profit", "net_margin", "runway", "active_clients", "churn", "calls_booked", "call_close_rate", "cac", "ltv_cac"],
  },
  {
    key: "marketing",
    title: "Marketing",
    href: "/marketing",
    description: "Lead flow, acquisition costs, CAC, and source performance.",
    defaultMetricIds: ["acquisition_costs", "cac", "cost_per_call", "calls_booked", "new_clients", "new_client_revenue", "call_show_rate", "wasted_money"],
  },
  {
    key: "sales",
    title: "Sales",
    href: "/sales",
    description: "Booked calls, show rate, qualified calls, offers, closes, and revenue per call.",
    defaultMetricIds: ["calls_booked", "calls_shown", "qualified_calls", "offers_sent", "calls_closed", "call_show_rate", "call_offer_rate", "call_close_rate", "revenue", "cost_per_call"],
  },
  {
    key: "retention",
    title: "Retention",
    href: "/retention",
    description: "Active clients, churn, NRR, LTV, and relationship health.",
    defaultMetricIds: ["active_clients", "new_clients", "churned_clients", "churn", "nrr", "monthly_client_payment", "revenue_ltv", "ltv_cac", "avg_relationship"],
  },
  {
    key: "finance",
    title: "Finance",
    href: "/finance",
    description: "Revenue, cash movement, expenses, margins, and runway.",
    defaultMetricIds: ["revenue", "mrr", "arr", "cash_in", "cash_out", "net_cash_flow", "expenses", "gross_margin", "net_margin", "bank_balance", "runway"],
  },
  {
    key: "constraints",
    title: "Constraints",
    href: "/constraints",
    description: "The top operating constraints ranked against minimum, target, and scale benchmarks.",
    defaultMetricIds: ["call_show_rate", "call_close_rate", "cost_per_call", "churn", "revenue_ltv", "net_margin", "ltv_cac", "payback"],
  },
  {
    key: "forecasting",
    title: "Forecasting",
    href: "/forecasting",
    description: "Reverse-engineer goals into required revenue, clients, calls, conversion rates, and spend.",
    defaultMetricIds: ["net_profit", "net_margin", "revenue", "monthly_client_payment", "active_clients", "calls_booked", "call_show_rate", "call_close_rate", "cost_per_call"],
  },
];

const viewByKey = new Map(metricViewDefinitions.map((view) => [view.key, view]));
const definitionById = new Map(metricDefinitions.map((definition) => [definition.id, definition]));

export function getMetricViewDefinition(viewKey: MetricViewKey) {
  return viewByKey.get(viewKey) ?? metricViewDefinitions[0];
}

export function allMetricViewKeys() {
  return metricViewDefinitions.map((view) => view.key);
}

export async function loadSelectedMetricIds({
  supabase,
  tenantId,
  viewKey,
}: {
  supabase: SupabaseLike;
  tenantId: string;
  viewKey: MetricViewKey;
}) {
  const { data } = await supabase
    .from("tenant_metric_selections")
    .select("metric_id")
    .eq("tenant_id", tenantId)
    .eq("view_key", viewKey)
    .order("display_order", { ascending: true });

  const selected = (data ?? [])
    .map((row) => row.metric_id as string)
    .filter((metricId) => definitionById.has(metricId));

  return selected.length ? selected : getMetricViewDefinition(viewKey).defaultMetricIds;
}

export async function loadMetricViewPayload({
  supabase,
  tenantId,
  viewKey,
}: {
  supabase: SupabaseLike;
  tenantId: string;
  viewKey: MetricViewKey;
}) {
  const [payload, metricIds] = await Promise.all([
    loadMetricSnapshotPayload({ supabase, tenantId, periodKey: "30d" }),
    loadSelectedMetricIds({ supabase, tenantId, viewKey }),
  ]);

  const rows = metricIds
    .map((metricId) => {
      const definition = definitionById.get(metricId);
      if (!definition) return null;
      const snapshot = payload.metrics[metricId];
      return {
        metricId,
        name: definition.name,
        category: definition.category,
        format: definition.format,
        value: snapshot?.value ?? null,
        displayValue: formatMetricValue(definition.format, snapshot?.value ?? null),
        sourceDescription: definition.sourceDescription,
        formula: definition.formula,
        isInverse: definition.isInverse,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return {
    view: getMetricViewDefinition(viewKey),
    window: payload.window,
    calculatedAt: payload.calculatedAt,
    rows,
    allDefinitions: metricDefinitions,
    selectedIds: new Set(metricIds),
  };
}

export function labelForFreshness(value: string | null) {
  if (!value) return "No snapshot yet";
  const ageHours = Math.max(0, (Date.now() - new Date(value).getTime()) / 36e5);
  if (ageHours < 24) return "Fresh";
  if (ageHours < 72) return "Needs review";
  return "Stale";
}
