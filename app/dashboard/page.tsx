import Link from "next/link";
import { signOutAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";

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
  const { supabase, user } = await requireUser();
  const { data: memberships } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role, tenants(id, name)")
    .order("created_at", { ascending: true })
    .limit(1);
  const membership = memberships?.[0];
  const tenant = Array.isArray(membership?.tenants)
    ? membership.tenants[0]
    : membership?.tenants;
  const params = await searchParams;
  const message = getParam(params, "message");

  return (
    <main className="app-shell">
      <nav className="top-nav">
        <Link href="/dashboard" className="brand">
          HyperOptimal Metrics
        </Link>
        <div className="nav-links">
          {tenant ? (
            <>
              <Link href="/admin">Admin</Link>
              <Link href="/account">Account</Link>
            </>
          ) : (
            <Link href="/onboarding">Create workspace</Link>
          )}
          <form action={signOutAction}>
            <button type="submit" className="link-button">
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <section className="page-header">
        <p className="eyebrow">{tenant?.name ?? "Personal dashboard"}</p>
        <h1>Today</h1>
        <p className="lede">
          Secure workspace for metrics, messaging, billing, and reporting.
        </p>
        {message ? <p className="notice">{message}</p> : null}
      </section>
      <section className="dashboard-grid">
        <article className="compact-card">
          <h2>Workspace</h2>
          {tenant ? (
            <>
              <p>{tenant.name}</p>
              <span className="muted">Role: {membership?.role}</span>
            </>
          ) : (
            <>
              <p>No workspace connected yet.</p>
              <span className="muted">
                You can create a tenant-scoped workspace when you are ready.
              </span>
              <Link href="/onboarding">Create workspace</Link>
            </>
          )}
        </article>
        <article className="compact-card">
          <h2>User</h2>
          <p>{user.email}</p>
          <span className="muted">Authenticated with Supabase Auth</span>
        </article>
        <article className="compact-card">
          <h2>Admin readiness</h2>
          <p>RLS, tenant boundaries, billing, email, SMS, Slack, and Telegram.</p>
          {tenant ? (
            <Link href="/admin">Open admin</Link>
          ) : (
            <span className="muted">Create a workspace to enable admin.</span>
          )}
        </article>
      </section>
    </main>
  );
}
