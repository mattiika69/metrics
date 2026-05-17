import { AdminNotices, AdminShell, EmptyAdminState } from "@/components/admin/admin-shell";
import { formatAdminDateTime } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminOverview } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const context = await requireAdmin();
  const overview = await getAdminOverview(context);

  return (
    <AdminShell active="overview" title="Overview" subtitle={context.profile.email}>
      <AdminNotices notices={overview.notices} />

      <section className="admin-stat-grid" aria-label="Admin totals">
        <article className="admin-stat-card">
          <span>Total users</span>
          <strong>{overview.totalUsers}</strong>
        </article>
        <article className="admin-stat-card">
          <span>Organizations</span>
          <strong>{overview.totalTenants}</strong>
        </article>
        <article className="admin-stat-card">
          <span>Active subscriptions</span>
          <strong>{overview.activeSubscriptions}</strong>
        </article>
      </section>

      <section className="admin-grid-two">
        <article className="admin-panel">
          <header>
            <h2>Recent signups</h2>
          </header>
          {overview.recentSignups.length ? (
            <div className="admin-list">
              {overview.recentSignups.map((user) => (
                <div key={user.userId}>
                  <strong>{user.email}</strong>
                  <span>{formatAdminDateTime(user.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyAdminState>No recent signups.</EmptyAdminState>
          )}
        </article>

        <article className="admin-panel">
          <header>
            <h2>Recent webhook events</h2>
          </header>
          {overview.recentWebhookEvents.length ? (
            <div className="admin-list">
              {overview.recentWebhookEvents.map((event) => (
                <div key={event.id}>
                  <strong>
                    {event.provider} · {event.eventType}
                  </strong>
                  <span>
                    {event.status} · {formatAdminDateTime(event.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyAdminState>No webhook events found.</EmptyAdminState>
          )}
        </article>
      </section>

      <section className="admin-panel">
        <header>
          <h2>Recent audit events</h2>
        </header>
        {overview.recentAuditEvents.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentAuditEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{event.actor ?? "System"}</td>
                    <td>{event.action}</td>
                    <td>{event.target ?? "None"}</td>
                    <td>{formatAdminDateTime(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyAdminState>No audit events found.</EmptyAdminState>
        )}
      </section>
    </AdminShell>
  );
}
