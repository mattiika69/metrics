import { AdminNotices, AdminShell, EmptyAdminState } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/admin/auth";
import { getWebhookEvents } from "@/lib/admin/data";
import { formatAdminDateTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export default async function AdminWebhookEventsPage() {
  const context = await requireAdmin();
  const { events, notices } = await getWebhookEvents(context);

  return (
    <AdminShell active="webhook-events" title="Webhook Events" subtitle={context.profile.email}>
      <AdminNotices notices={notices} />
      <section className="admin-panel">
        <header>
          <h2>Recent webhook events</h2>
        </header>
        {events.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Event type</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{event.provider}</td>
                    <td>{event.eventType}</td>
                    <td>{event.status}</td>
                    <td>{formatAdminDateTime(event.createdAt)}</td>
                    <td>{event.errorMessage ?? "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyAdminState>No webhook events found.</EmptyAdminState>
        )}
      </section>
    </AdminShell>
  );
}
