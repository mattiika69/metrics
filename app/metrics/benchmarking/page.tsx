import { AppShell } from "@/components/app-shell";
import { saveBenchmarkTargetAction } from "@/app/metrics/actions";
import { requireTenant } from "@/lib/auth/session";
import { benchmarks } from "@/lib/metrics/benchmarks";
import { formatMetricValue } from "@/lib/metrics/format";
import { loadMetricSnapshotPayload } from "@/lib/metrics/server";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function BenchmarkingPage({ searchParams }: PageProps) {
  const { supabase, tenant } = await requireTenant();
  const params = await searchParams;
  const message = param(params, "message");
  const [payload, targets] = await Promise.all([
    loadMetricSnapshotPayload({ supabase, tenantId: tenant.id, periodKey: "30d" }),
    supabase
      .from("metric_benchmark_targets")
      .select("benchmark_id, target_value")
      .eq("tenant_id", tenant.id),
  ]);
  const targetById = new Map((targets.data ?? []).map((target) => [target.benchmark_id, Number(target.target_value)]));

  return (
    <AppShell active="metrics-benchmarking" tenantName={tenant.name}>
      <section className="page-header compact">
        <p className="eyebrow">Metrics</p>
        <h1>Benchmarking</h1>
        <p className="lede">Compare current performance against recommended targets.</p>
        {message ? <p className="notice">{message}</p> : null}
      </section>

      <section className="table-panel">
        <table>
          <thead>
            <tr>
              <th>Benchmark</th>
              <th>Actual</th>
              <th>Recommended</th>
              <th>Your target</th>
              <th>Set target</th>
            </tr>
          </thead>
          <tbody>
            {benchmarks.map((benchmark) => {
              const actual = payload.metrics[benchmark.metricId]?.value ?? null;
              const tenantTarget = targetById.get(benchmark.id);
              return (
                <tr key={benchmark.id}>
                  <td>
                    <strong>{benchmark.name}</strong>
                    <span className="muted block">{benchmark.category}</span>
                  </td>
                  <td>{formatMetricValue(benchmark.format, actual)}</td>
                  <td>{formatMetricValue(benchmark.format, benchmark.target)}</td>
                  <td>{formatMetricValue(benchmark.format, tenantTarget ?? benchmark.target)}</td>
                  <td>
                    <form action={saveBenchmarkTargetAction} className="mini-form">
                      <input type="hidden" name="benchmarkId" value={benchmark.id} />
                      <input name="targetValue" type="number" step="0.01" placeholder={String(tenantTarget ?? benchmark.target)} />
                      <button type="submit">Save</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
