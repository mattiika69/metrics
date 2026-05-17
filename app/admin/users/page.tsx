import { AdminNotices, AdminShell, EmptyAdminState } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminUsers } from "@/lib/admin/data";
import { formatAdminDateTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const context = await requireAdmin();
  const { users, notices } = await getAdminUsers(context);

  return (
    <AdminShell active="users" title="Users" subtitle={context.profile.email}>
      <AdminNotices notices={notices} />
      <section className="admin-panel">
        <header>
          <h2>Users</h2>
        </header>
        {users.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Last sign in</th>
                  <th>Organization</th>
                  <th>Subscription</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.userId}>
                    <td>{user.email}</td>
                    <td>{user.fullName ?? "Not set"}</td>
                    <td>{user.role}</td>
                    <td>{formatAdminDateTime(user.createdAt)}</td>
                    <td>{formatAdminDateTime(user.lastSignInAt)}</td>
                    <td>{user.tenantNames.join(", ") || "None"}</td>
                    <td>{user.subscriptionStatus ?? "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyAdminState>No users found.</EmptyAdminState>
        )}
      </section>
    </AdminShell>
  );
}
