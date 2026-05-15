import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { recalculateMetricsAction } from "@/app/metrics/actions";
import { requireTenant } from "@/lib/auth/session";
import { buildConstraintsDigest, formatConstraintValue } from "@/lib/metrics/constraints";

export const dynamic = "force-dynamic";

function statusLabel(status: string) {
  if (status === "scale_met") return "Scale met";
  if (status === "minimum_met") return "Minimum met";
  if (status === "missing") return "Missing metric";
  return "Constrained";
}

export default async function ConstraintsPage() {
  const { supabase, tenant } = await requireTenant();
  const digest = await buildConstraintsDigest({
    supabase,
    tenantId: tenant.id,
    periodKey: "30d",
  });

  return (
    <AppShell active="constraints" tenantName={tenant.name}>
      <section className="page-header compact">
        <p className="eyebrow">Constraints</p>
        <div className="header-row">
          <div>
            <h1>Top Constraints</h1>
            <p className="lede">The three biggest metric gaps for the last 30 days.</p>
          </div>
          <form action={recalculateMetricsAction} className="toolbar-form">
            <input type="hidden" name="period" value="30d" />
            <button type="submit">Recalculate</button>
          </form>
        </div>
      </section>

      {digest.topConstraints.length ? (
        <section className="constraint-grid">
          {digest.topConstraints.map((row, index) => (
            <article className="metric-card constraint-card" key={row.benchmark.id}>
              <div className="card-topline">
                <span>#{index + 1} Constraint</span>
                <strong>{statusLabel(row.status)}</strong>
              </div>
              <h2>{row.benchmark.name}</h2>
              <p className="metric-value">{formatConstraintValue(row, row.actual)}</p>
              <div className="mini-stats">
                <span>Minimum {formatConstraintValue(row, row.minimum)}</span>
                <span>Scale {formatConstraintValue(row, row.scale)}</span>
                <span>Gap {row.gapPercent === null ? "No data" : `${row.gapPercent.toFixed(1)}%`}</span>
              </div>
              <ul>
                {row.suggestions.slice(0, 3).map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
              <Link href="/metrics/benchmarking">Edit target</Link>
            </article>
          ))}
        </section>
      ) : (
        <p className="empty-state">No constraints are available yet. Connect integrations and recalculate metrics.</p>
      )}
    </AppShell>
  );
}
