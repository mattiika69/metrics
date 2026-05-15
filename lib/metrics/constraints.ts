import { benchmarks, type Benchmark } from "@/lib/metrics/benchmarks";
import { formatMetricValue } from "@/lib/metrics/format";
import { loadMetricSnapshotPayload } from "@/lib/metrics/server";
import type { PeriodKey } from "@/lib/metrics/period";
import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseLike = SupabaseClient;

export type ConstraintRow = {
  benchmark: Benchmark;
  actual: number | null;
  minimum: number;
  scale: number;
  gapPercent: number | null;
  status: "scale_met" | "minimum_met" | "missing" | "constrained";
  suggestions: string[];
};

function gapPercent(benchmark: Benchmark, actual: number | null, target: number) {
  if (actual === null || !Number.isFinite(actual) || target === 0) return null;
  const rawGap = benchmark.inverse
    ? ((actual - target) / target) * 100
    : ((target - actual) / target) * 100;
  return Math.max(0, rawGap);
}

function statusFor(benchmark: Benchmark, actual: number | null, minimum: number, scale: number): ConstraintRow["status"] {
  if (actual === null) return "missing";
  if (benchmark.inverse) {
    if (actual <= scale) return "scale_met";
    if (actual <= minimum) return "minimum_met";
    return "constrained";
  }
  if (actual >= scale) return "scale_met";
  if (actual >= minimum) return "minimum_met";
  return "constrained";
}

function suggestionsFor(name: string) {
  return [
    `Audit the last 20 data points tied to ${name} and label the top three root causes.`,
    `Assign one owner and one weekly target for ${name}.`,
    `Run one focused experiment this week to improve ${name}.`,
    `Review what changed on the best-performing weeks for ${name} and repeat those conditions.`,
    `Document one process change that directly supports ${name}.`,
  ];
}

export async function buildConstraintsDigest({
  supabase,
  tenantId,
  periodKey = "30d",
}: {
  supabase: SupabaseLike;
  tenantId: string;
  periodKey?: PeriodKey;
}) {
  const [payload, targets] = await Promise.all([
    loadMetricSnapshotPayload({ supabase, tenantId, periodKey }),
    supabase
      .from("metric_benchmark_targets")
      .select("benchmark_id, target_value")
      .eq("tenant_id", tenantId),
  ]);

  const targetById = new Map<string, number>();
  for (const target of targets.data ?? []) {
    targetById.set(target.benchmark_id, Number(target.target_value));
  }

  const rows: ConstraintRow[] = benchmarks
    .map((benchmark) => {
      const actual = payload.metrics[benchmark.metricId]?.value ?? null;
      const scale = targetById.get(benchmark.id) ?? benchmark.target;
      const minimum = benchmark.minimum;
      const gap = gapPercent(benchmark, actual, scale);

      return {
        benchmark,
        actual,
        minimum,
        scale,
        gapPercent: gap,
        status: statusFor(benchmark, actual, minimum, scale),
        suggestions: suggestionsFor(benchmark.name),
      };
    })
    .sort((left, right) => {
      const leftGap = left.gapPercent ?? Number.MAX_SAFE_INTEGER;
      const rightGap = right.gapPercent ?? Number.MAX_SAFE_INTEGER;
      if (left.status === "missing" && right.status !== "missing") return 1;
      if (right.status === "missing" && left.status !== "missing") return -1;
      return rightGap - leftGap;
    });

  return {
    period: payload.window,
    rows,
    topConstraints: rows.slice(0, 3),
  };
}

export function formatConstraintValue(row: ConstraintRow, value: number | null) {
  return formatMetricValue(row.benchmark.format, value);
}

export function formatConstraintsForChannel(rows: ConstraintRow[]) {
  if (rows.length === 0) {
    return "No metric constraints are available yet. Connect integrations, sync data, and recalculate metrics first.";
  }

  const lines = ["Top 3 metric constraints"];
  rows.slice(0, 3).forEach((row, index) => {
    lines.push(
      `${index + 1}. ${row.benchmark.name}: yours ${formatConstraintValue(row, row.actual)} | minimum ${formatConstraintValue(row, row.minimum)} | scale ${formatConstraintValue(row, row.scale)} | gap ${row.gapPercent === null ? "not available" : `${row.gapPercent.toFixed(1)}%`}`,
    );
  });

  const first = rows[0];
  if (first) {
    lines.push("");
    lines.push(`Suggestions for ${first.benchmark.name}`);
    first.suggestions.slice(0, 3).forEach((suggestion, index) => {
      lines.push(`${index + 1}. ${suggestion}`);
    });
  }

  return lines.join("\n");
}
