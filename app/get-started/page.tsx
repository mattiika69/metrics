import Link from "next/link";
import {
  createTenantAction,
  signOutAction,
  skipOnboardingAction,
  startStripeCheckoutAction,
} from "@/lib/auth/actions";
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

export default async function GetStartedPage({ searchParams }: PageProps) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const error = getParam(params, "error");
  const message = getParam(params, "message");
  const billing = getParam(params, "billing");
  const checkoutSessionId = getParam(params, "session_id");
  const { data: memberships } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role, tenants(id, name)")
    .order("created_at", { ascending: true })
    .limit(1);
  const membership = memberships?.[0];
  const tenant = Array.isArray(membership?.tenants)
    ? membership.tenants[0]
    : membership?.tenants;
  const { data: subscription } = tenant
    ? await supabase
        .from("billing_subscriptions")
        .select("status, current_period_end")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    <main className="app-shell">
      <nav className="top-nav">
        <Link href="/dashboard" className="brand">
          HyperOptimal Metrics
        </Link>
        <div className="nav-links">
          <Link href="/dashboard">Dashboard</Link>
          <form action={signOutAction}>
            <button type="submit" className="link-button">
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <section className="page-header">
        <p className="eyebrow">Get started</p>
        <h1>Set up your account</h1>
        <p className="lede">
          Finish the first account, billing, and workspace steps.
        </p>
        {message ? <p className="notice">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
        {billing === "success" ? (
          <p className="notice">
            Stripe returned successfully
            {checkoutSessionId ? ` for ${checkoutSessionId}` : ""}.
          </p>
        ) : null}
        {billing === "cancelled" ? (
          <p className="notice">Stripe checkout was cancelled.</p>
        ) : null}
      </section>
      <section className="dashboard-grid">
        <article className="compact-card">
          <p className="step-label">Step 1</p>
          <h2>Account</h2>
          <p>{user.email}</p>
          <span className="muted">Signed in</span>
        </article>
        <article className="compact-card">
          <p className="step-label">Step 2</p>
          <h2>Billing</h2>
          {subscription ? (
            <>
              <p>Stripe subscription: {subscription.status}</p>
              <span className="muted">Webhook-managed billing state</span>
            </>
          ) : tenant ? (
            <>
              <p>Stripe checkout placeholder</p>
              <form action={startStripeCheckoutAction} className="card-action">
                <button type="submit">Continue to Stripe</button>
              </form>
            </>
          ) : (
            <>
              <p>Stripe will return here after checkout.</p>
              <span className="muted">Create a workspace first.</span>
            </>
          )}
        </article>
        <article className="compact-card">
          <p className="step-label">Step 3</p>
          <h2>Workspace</h2>
          {tenant ? (
            <>
              <p>{tenant.name}</p>
              <span className="muted">Role: {membership?.role}</span>
              <Link href="/dashboard">Open dashboard</Link>
            </>
          ) : (
            <>
              <form action={createTenantAction} className="form-stack compact">
                <label>
                  Workspace name
                  <input
                    name="name"
                    type="text"
                    placeholder="Acme Growth"
                    autoComplete="organization"
                    required
                  />
                </label>
                <button type="submit">Create workspace</button>
              </form>
              <form action={skipOnboardingAction} className="skip-form">
                <button type="submit" className="button-secondary">
                  Skip
                </button>
              </form>
            </>
          )}
        </article>
      </section>
    </main>
  );
}
