import Link from "next/link";
import { signOutAction } from "@/lib/auth/actions";
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
    <main className="app-shell">
      <nav className="top-nav">
        <Link href="/dashboard" className="brand">
          HyperOptimal Metrics
        </Link>
        <div className="nav-links">
          <Link href="/admin">Admin</Link>
          <Link href="/account">Account</Link>
          <form action={signOutAction}>
            <button type="submit" className="link-button">
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <section className="page-header">
        <p className="eyebrow">{tenant.name}</p>
        <h1>Today</h1>
        <p className="lede">
          Secure, tenant-scoped workspace for metrics, messaging, billing, and
          reporting.
        </p>
        {message ? <p className="notice">{message}</p> : null}
      </section>
      <section className="dashboard-grid">
        <article className="compact-card">
          <h2>Workspace</h2>
          <p>{tenant.name}</p>
          <span className="muted">Role: {membership.role}</span>
        </article>
        <article className="compact-card">
          <h2>User</h2>
          <p>{user.email}</p>
          <span className="muted">Authenticated with Supabase Auth</span>
        </article>
        <article className="compact-card">
          <h2>Admin readiness</h2>
          <p>RLS, tenant boundaries, billing, email, SMS, Slack, and Telegram.</p>
          <Link href="/admin">Open admin</Link>
        </article>
      </section>
    </main>
  );
}
