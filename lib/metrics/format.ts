import type { MetricFormat } from "@/lib/metrics/definitions";

const integerMetrics = new Set([
  "active_clients",
  "churned_clients",
  "new_clients",
  "calls_booked",
  "calls_shown",
  "calls_closed",
  "calls_unqualified",
  "qualified_calls",
  "offers_sent",
]);

export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function roundMetricValue(metricId: string, value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = integerMetrics.has(metricId) ? 1 : 100;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function safeDivide(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

export function formatMetricValue(format: MetricFormat, value: number | null) {
  if (value === null || !Number.isFinite(value)) return "No data";

  if (format === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
    }).format(value);
  }

  if (format === "percent") return `${value.toFixed(1)}%`;
  if (format === "ratio") return `${value.toFixed(2)}x`;
  if (format === "months") return `${value.toFixed(1)} mo`;
  if (format === "days") return `${value.toFixed(1)} d`;
  return Math.round(value).toLocaleString();
}

export function dateOnly(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function isDateWithin(date: string | null, startDate: string, endDate: string) {
  return Boolean(date && date >= startDate && date <= endDate);
}
