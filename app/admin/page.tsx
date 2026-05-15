import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireTenant } from "@/lib/auth/session";

export default async function AdminPage() {
  const { tenant, membership } = await requireTenant();

  return (
    <AppShell active="admin" tenantName={tenant.name}>
      <section className="page-header">
        <p className="eyebrow">{tenant.name}</p>
        <h1>Admin</h1>
        <p className="lede">
          Manage access, billing, integrations, and account controls.
        </p>
      </section>
      <section className="dashboard-grid">
        <article className="compact-card">
          <h2>Users and roles</h2>
          <p>Review who can access the workspace and adjust permissions.</p>
          <span className="muted">Your access: {membership.role === "owner" ? "Owner" : membership.role}</span>
        </article>
        <article className="compact-card">
          <h2>Billing</h2>
          <p>Manage the workspace plan, payment method, and subscription status.</p>
          <span className="muted">Plans and invoices</span>
        </article>
        <article className="compact-card">
          <h2>Integrations</h2>
          <p>Connect the tools your team uses to keep metrics current.</p>
          <span className="muted">Data and messaging channels</span>
        </article>
        <article className="compact-card">
          <h2>Legal and compliance</h2>
          <p>Review policies and account controls for the workspace.</p>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </article>
      </section>
    </AppShell>
  );
}
