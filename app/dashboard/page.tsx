import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireTenant } from "@/lib/auth/session";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { user, tenant, membership } = await requireTenant();
  const params = await searchParams;
  const message = getParam(params, "message");

  return (
    <AppShell active="dashboard" tenantName={tenant.name}>
      <section className="page-header planner-header">
        <div>
          <h1>Today</h1>
          <p className="lede">Metrics work for the day</p>
        </div>
        <div className="date-controls" aria-label="Date controls">
          <button type="button" className="icon-button" aria-label="Previous day">
            ‹
          </button>
          <button type="button" className="button-secondary compact-control">
            Today
          </button>
          <button type="button" className="icon-button" aria-label="Next day">
            ›
          </button>
        </div>
        {message ? <p className="notice">{message}</p> : null}
      </section>

      <section className="planner-board" aria-label="Today workspace">
        <div className="planner-column">
          <article className="person-card selected">
            <span className="avatar hot" aria-hidden="true">
              M
            </span>
            <div>
              <h2>{tenant.name}</h2>
              <p>{user.email}</p>
            </div>
          </article>

          <div className="empty-map">
            <span aria-hidden="true">▥</span>
            <p>Nothing on the map for this day.</p>
          </div>

          <Link href="/metrics/most-important" className="add-row">
            <span aria-hidden="true">＋</span>
            Add metric focus
          </Link>
        </div>

        <div className="planner-column">
          <article className="person-card">
            <span className="avatar brown" aria-hidden="true">
              H
            </span>
            <div>
              <h2>HyperOptimal</h2>
              <p>Workspace role: {membership.role}</p>
            </div>
            <span className="progress-count">0/3</span>
          </article>
          <div className="progress-track" aria-hidden="true">
            <span />
          </div>

          <div className="task-list">
            <Link href="/integrations" className="task-row">
              <span className="circle" aria-hidden="true" />
              Connect metric sources
            </Link>
            <Link href="/metrics/most-important" className="task-row">
              <span className="circle" aria-hidden="true" />
              Review important metrics
            </Link>
            <Link href="/constraints" className="task-row">
              <span className="circle" aria-hidden="true" />
              Check top constraints
            </Link>
            <Link href="/integrations" className="add-row">
              <span aria-hidden="true">＋</span>
              Add source
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
