import { AdminNotices, AdminShell, EmptyAdminState } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminOrgs } from "@/lib/admin/data";
import { formatAdminDateTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export default async function AdminOrgsPage() {
  const context = await requireAdmin();
  const { orgs, notices } = await getAdminOrgs(context);

  return (
    <AdminShell active="orgs" title="Organizations" subtitle={context.profile.email}>
      <AdminNotices notices={notices} />
      <section className="admin-panel">
        <header>
          <h2>Organizations</h2>
        </header>
        {orgs.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Owner</th>
                  <th>Plan</th>
                  <th>Created</th>
                  <th>Members</th>
                  <th>Integrations</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.tenantId}>
                    <td>{org.name}</td>
                    <td>{org.ownerEmail ?? "Not available"}</td>
                    <td>{org.plan ?? "None"}</td>
                    <td>{formatAdminDateTime(org.createdAt)}</td>
                    <td>{org.memberCount}</td>
                    <td>{org.integrationStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyAdminState>No organizations found.</EmptyAdminState>
        )}
      </section>
    </AdminShell>
  );
}
