import { metricDefinitions, type MetricDefinition, type MetricFormat } from "@/lib/metrics/definitions";

export type Benchmark = {
  id: string;
  metricId: string;
  name: string;
  target: number;
  minimum: number;
  unit: string;
  format: MetricFormat;
  category: string;
  inverse: boolean;
};

const curatedTargets: Benchmark[] = [
  { id: "call_show_rate", metricId: "call_show_rate", name: "Meeting Show Rate", target: 80, minimum: 65, unit: "%", format: "percent", category: "Sales", inverse: false },
  { id: "call_close_rate", metricId: "call_close_rate", name: "Close Rate", target: 30, minimum: 20, unit: "%", format: "percent", category: "Sales", inverse: false },
  { id: "cost_per_call", metricId: "cost_per_call", name: "Cost Per Call", target: 150, minimum: 250, unit: "$", format: "currency", category: "Sales", inverse: true },
  { id: "churn", metricId: "churn", name: "Monthly Churn", target: 5, minimum: 8, unit: "%", format: "percent", category: "Clients", inverse: true },
  { id: "revenue_ltv", metricId: "revenue_ltv", name: "Revenue LTV", target: 15000, minimum: 8000, unit: "$", format: "currency", category: "Clients", inverse: false },
  { id: "net_margin", metricId: "net_margin", name: "Net Margin", target: 30, minimum: 15, unit: "%", format: "percent", category: "Financial", inverse: false },
  { id: "gross_margin", metricId: "gross_margin", name: "Gross Margin", target: 60, minimum: 40, unit: "%", format: "percent", category: "Financial", inverse: false },
  { id: "cac", metricId: "cac", name: "CAC", target: 2000, minimum: 3000, unit: "$", format: "currency", category: "Financial", inverse: true },
  { id: "ltv_cac", metricId: "ltv_cac", name: "Revenue LTV:CAC", target: 3, minimum: 1.5, unit: "x", format: "ratio", category: "Performance", inverse: false },
  { id: "payback", metricId: "payback", name: "Payback Period", target: 3, minimum: 6, unit: "mo", format: "months", category: "Performance", inverse: true },
  { id: "calls_booked", metricId: "calls_booked", name: "Calls Booked", target: 100, minimum: 40, unit: "", format: "number", category: "Sales", inverse: false },
  { id: "new_clients", metricId: "new_clients", name: "New Clients", target: 20, minimum: 8, unit: "", format: "number", category: "Clients", inverse: false },
];

const curatedByMetricId = new Map(curatedTargets.map((benchmark) => [benchmark.metricId, benchmark]));

function unitFor(format: MetricFormat) {
  if (format === "percent") return "%";
  if (format === "currency") return "$";
  if (format === "ratio") return "x";
  if (format === "months") return "mo";
  if (format === "days") return "d";
  return "";
}

function defaultBenchmark(definition: MetricDefinition): Benchmark {
  const curated = curatedByMetricId.get(definition.id);
  return {
    id: definition.id,
    metricId: definition.id,
    name: curated?.name ?? definition.name,
    target: curated?.target ?? 0,
    minimum: curated?.minimum ?? 0,
    unit: curated?.unit ?? unitFor(definition.format),
    format: definition.format,
    category: definition.category,
    inverse: definition.isInverse,
  };
}

export const benchmarks: Benchmark[] = metricDefinitions.map(defaultBenchmark);

export const constraintMetricIds = benchmarks.map((benchmark) => benchmark.metricId);
