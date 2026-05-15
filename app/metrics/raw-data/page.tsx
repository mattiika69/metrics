import { AppShell } from "@/components/app-shell";
import { requireTenant } from "@/lib/auth/session";
import { loadRawDataCounts } from "@/lib/metrics/server";

export const dynamic = "force-dynamic";

export default async function MetricsRawDataPage() {
  const { supabase, tenant } = await requireTenant();
  const sources = await loadRawDataCounts(supabase, tenant.id);

  return (
    <AppShell active="metrics-most-important" tenantName={tenant.name}>
      <section className="page-header compact">
        <p className="eyebrow">Metrics</p>
        <h1>Raw Data</h1>
        <p className="lede">Review source coverage from connected systems.</p>
      </section>

      <section className="table-panel">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Data</th>
              <th>Rows</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.table}>
                <td>{source.label}</td>
                <td>{source.label}</td>
                <td>{source.count ?? "Unavailable"}</td>
                <td>{source.error ? "Needs attention" : source.count ? "Ready" : "Waiting for first sync"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
