import { loadMetricSnapshotPayload } from "@/lib/metrics/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseLike = SupabaseClient;

export type ForecastAssumptions = {
  netProfitGoal: number;
  netMarginPercent: number;
  monthlyClientPayment: number;
  churnPercent: number;
  showRatePercent: number;
  closeRatePercent: number;
  costPerCall: number;
};

export type ForecastOutputs = {
  revenueRequired: number;
  clientsRequired: number;
  newClientsRequired: number;
  callsRequired: number;
  bookedCallsRequired: number;
  acquisitionSpendRequired: number;
  dailySpendRequired: number;
};

export const defaultForecastAssumptions: ForecastAssumptions = {
  netProfitGoal: 100000,
  netMarginPercent: 30,
  monthlyClientPayment: 3000,
  churnPercent: 5,
  showRatePercent: 80,
  closeRatePercent: 30,
  costPerCall: 150,
};

function numberFrom(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeForecastAssumptions(input: Record<string, unknown>): ForecastAssumptions {
  return {
    netProfitGoal: numberFrom(input.netProfitGoal, defaultForecastAssumptions.netProfitGoal),
    netMarginPercent: numberFrom(input.netMarginPercent, defaultForecastAssumptions.netMarginPercent),
    monthlyClientPayment: numberFrom(input.monthlyClientPayment, defaultForecastAssumptions.monthlyClientPayment),
    churnPercent: numberFrom(input.churnPercent, defaultForecastAssumptions.churnPercent),
    showRatePercent: numberFrom(input.showRatePercent, defaultForecastAssumptions.showRatePercent),
    closeRatePercent: numberFrom(input.closeRatePercent, defaultForecastAssumptions.closeRatePercent),
    costPerCall: numberFrom(input.costPerCall, defaultForecastAssumptions.costPerCall),
  };
}

export function calculateForecast(assumptions: ForecastAssumptions): ForecastOutputs {
  const netMargin = Math.max(1, assumptions.netMarginPercent) / 100;
  const monthlyClientPayment = Math.max(1, assumptions.monthlyClientPayment);
  const churn = Math.max(0, assumptions.churnPercent) / 100;
  const showRate = Math.max(1, assumptions.showRatePercent) / 100;
  const closeRate = Math.max(1, assumptions.closeRatePercent) / 100;
  const revenueRequired = assumptions.netProfitGoal / netMargin;
  const clientsRequired = revenueRequired / monthlyClientPayment;
  const newClientsRequired = Math.max(0, clientsRequired * churn);
  const callsRequired = newClientsRequired / closeRate;
  const bookedCallsRequired = callsRequired / showRate;
  const acquisitionSpendRequired = bookedCallsRequired * Math.max(0, assumptions.costPerCall);

  return {
    revenueRequired,
    clientsRequired,
    newClientsRequired,
    callsRequired,
    bookedCallsRequired,
    acquisitionSpendRequired,
    dailySpendRequired: acquisitionSpendRequired / 30,
  };
}

export async function loadForecastModel({
  supabase,
  tenantId,
}: {
  supabase: SupabaseLike;
  tenantId: string;
}) {
  const { data } = await supabase
    .from("metric_forecast_models")
    .select("id, name, assumptions, outputs, updated_at")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const assumptions = normalizeForecastAssumptions(
    data?.assumptions && typeof data.assumptions === "object"
      ? data.assumptions as Record<string, unknown>
      : {},
  );
  const outputs = calculateForecast(assumptions);

  return {
    id: data?.id ?? null,
    name: data?.name ?? "Default forecast",
    assumptions,
    outputs,
    updatedAt: data?.updated_at ?? null,
  };
}

export async function buildForecastContext({
  supabase,
  tenantId,
}: {
  supabase: SupabaseLike;
  tenantId: string;
}) {
  const [model, payload] = await Promise.all([
    loadForecastModel({ supabase, tenantId }),
    loadMetricSnapshotPayload({ supabase, tenantId, periodKey: "30d" }),
  ]);

  return {
    model,
    current: {
      revenue: payload.metrics.revenue?.value ?? null,
      netProfit: payload.metrics.net_profit?.value ?? null,
      netMargin: payload.metrics.net_margin?.value ?? null,
      activeClients: payload.metrics.active_clients?.value ?? null,
      callsBooked: payload.metrics.calls_booked?.value ?? null,
      closeRate: payload.metrics.call_close_rate?.value ?? null,
      costPerCall: payload.metrics.cost_per_call?.value ?? null,
    },
  };
}
