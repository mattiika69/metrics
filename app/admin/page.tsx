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
          Tenant-level controls for access, billing, compliance, and
          integrations.
        </p>
      </section>
      <section className="dashboard-grid">
        <article className="compact-card">
          <h2>Users and roles</h2>
          <p>Memberships are tenant-scoped and enforced by Supabase RLS.</p>
          <span className="muted">Your role: {membership.role}</span>
        </article>
        <article className="compact-card">
          <h2>Billing</h2>
          <p>Stripe customer and subscription records belong to this tenant.</p>
          <span className="muted">Ready for plan gating</span>
        </article>
        <article className="compact-card">
          <h2>Integrations</h2>
          <p>Slack, Telegram, Resend, and Roezan credentials stay server-side.</p>
          <span className="muted">Events and messages are tenant logged</span>
        </article>
        <article className="compact-card">
          <h2>Legal and compliance</h2>
          <p>Privacy, terms, authentication, reset password, and audit records.</p>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </article>
      </section>
    </AppShell>
  );
}
