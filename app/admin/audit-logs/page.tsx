import { AdminNotices, AdminShell, EmptyAdminState } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/admin/auth";
import { getAuditEvents } from "@/lib/admin/data";
import { formatAdminDateTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage() {
  const context = await requireAdmin();
  const { events, notices } = await getAuditEvents(context);

  return (
    <AdminShell active="audit-logs" title="Audit Logs" subtitle={context.profile.email}>
      <AdminNotices notices={notices} />
      <section className="admin-panel">
        <header>
          <h2>Audit events</h2>
        </header>
        {events.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Created</th>
                  <th>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{event.actor ?? "System"}</td>
                    <td>{event.action}</td>
                    <td>{event.target ?? "None"}</td>
                    <td>{formatAdminDateTime(event.createdAt)}</td>
                    <td>{event.metadataPreview || "None"}</td>
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
