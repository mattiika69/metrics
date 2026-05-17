import { AdminNotices, AdminShell, EmptyAdminState } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminBilling } from "@/lib/admin/data";
import { formatAdminDateTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  const context = await requireAdmin();
  const { billing, notices } = await getAdminBilling(context);

  return (
    <AdminShell active="billing" title="Billing" subtitle={context.profile.email}>
      <AdminNotices notices={notices} />
      <section className="admin-panel">
        <header>
          <h2>Subscriptions</h2>
        </header>
        {billing.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Customer email</th>
                  <th>Organization</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Current period end</th>
                  <th>Stripe customer</th>
                  <th>Stripe subscription</th>
                </tr>
              </thead>
              <tbody>
                {billing.map((row) => (
                  <tr key={row.stripeSubscriptionId ?? `${row.tenantName}-${row.stripeCustomerId}`}>
                    <td>{row.customerEmail ?? "Not available"}</td>
                    <td>{row.tenantName ?? "Not available"}</td>
                    <td>{row.plan ?? "None"}</td>
                    <td>{row.status ?? "None"}</td>
                    <td>{formatAdminDateTime(row.currentPeriodEnd)}</td>
                    <td>{row.stripeCustomerId ?? "None"}</td>
                    <td>{row.stripeSubscriptionId ?? "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyAdminState>No subscriptions found.</EmptyAdminState>
        )}
      </section>
    </AdminShell>
  );
}
