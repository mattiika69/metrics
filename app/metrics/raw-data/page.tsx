import { AppShell, MetricsSubnav } from "@/components/app-shell";
import { requireTenant } from "@/lib/auth/session";
import { loadRawDataCounts } from "@/lib/metrics/server";

export const dynamic = "force-dynamic";

export default async function MetricsRawDataPage() {
  const { supabase, tenant } = await requireTenant();
  const sources = await loadRawDataCounts(supabase, tenant.id);

  return (
    <AppShell active="metrics" tenantName={tenant.name}>
      <section className="page-header compact">
        <p className="eyebrow">Metrics</p>
        <h1>Raw Data</h1>
        <p className="lede">Read-only source trace for integration data used by the metrics engine.</p>
        <MetricsSubnav active="raw-data" />
      </section>

      <section className="table-panel">
        <table>
          <thead>
            <tr>
              <th>Source table</th>
              <th>Purpose</th>
              <th>Rows</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.table}>
                <td>{source.table}</td>
                <td>{source.label}</td>
                <td>{source.count ?? "Unavailable"}</td>
                <td>{source.error ? source.error : source.count ? "Ready" : "Waiting for integration sync"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
