import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import {
  createTenantAction,
  skipOnboardingAction,
  startStripeCheckoutAction,
} from "@/lib/auth/actions";
import { saveBusinessProfileAction, saveMetricSelectionsAction } from "@/app/metrics/actions";
import { isAuthBypassEnabled } from "@/lib/auth/bypass";
import { requireUser } from "@/lib/auth/session";
import { metricDefinitions } from "@/lib/metrics/definitions";
import { getMetricViewDefinition } from "@/lib/metrics/views";

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

function SetupCard({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="wide-panel launch-panel">
      <p className="step-label">{step}</p>
      <h2>{title}</h2>
      {children}
    </article>
  );
}

export default async function GetStartedPage({ searchParams }: PageProps) {
  if (isAuthBypassEnabled()) {
    redirect("/dashboard");
  }

  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const error = getParam(params, "error");
  const message = getParam(params, "message");
  const billing = getParam(params, "billing");
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
  const { data: profile } = tenant
    ? await supabase
        .from("tenant_business_profiles")
        .select("business_type, offer_model, stage, revenue_band, team_size, timezone, benchmark_opt_in")
        .eq("tenant_id", tenant.id)
        .maybeSingle()
    : { data: null };
  const ceoView = getMetricViewDefinition("ceo");
  const { data: selections } = tenant
    ? await supabase
        .from("tenant_metric_selections")
        .select("metric_id")
        .eq("tenant_id", tenant.id)
        .eq("view_key", "ceo")
    : { data: null };
  const selectedMetricIds = new Set((selections?.length ? selections.map((row) => row.metric_id) : ceoView.defaultMetricIds) as string[]);

  if (!tenant) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <p className="eyebrow">Get started</p>
          <h1>Create Account</h1>
          <p className="lede">Set up HyperOptimal Metrics for {user.email}.</p>
          {message ? <p className="notice">{message}</p> : null}
          {error ? <p className="notice error">{error}</p> : null}
          <form action={createTenantAction} className="form-stack compact">
            <label>
              Company name
              <input name="name" type="text" placeholder="HyperOptimal Metrics" autoComplete="organization" required />
            </label>
            <button type="submit">Create account</button>
          </form>
          <form action={skipOnboardingAction} className="skip-form">
            <button type="submit" className="button-secondary">Skip</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <AppShell active="dashboard" tenantName={tenant.name}>
      <section className="page-header compact">
        <div className="header-row">
          <div>
            <h1>Get Started</h1>
            <p className="eyebrow">Account setup</p>
            <p className="lede">Choose your metrics, connect data sources, and add messaging channels.</p>
          </div>
          <form action={skipOnboardingAction}>
            <button type="submit" className="button-secondary">Skip</button>
          </form>
        </div>
        {message ? <p className="notice">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
        {billing === "success" ? (
          <p className="notice">
            Billing setup is complete.
          </p>
        ) : null}
        {billing === "cancelled" ? (
          <p className="notice">Billing setup was cancelled.</p>
        ) : null}
      </section>

      <section className="onboarding-grid">
        <SetupCard step="Step 1" title="Account">
          <p>{user.email}</p>
          <p className="muted">{membership?.role === "owner" ? "Owner access" : "Team access"}</p>
        </SetupCard>

        <SetupCard step="Step 2" title="Billing">
          {subscription ? (
            <>
              <p>Subscription: {subscription.status}</p>
              <p className="muted">Billing is active.</p>
            </>
          ) : (
            <>
              <p>Set up billing.</p>
              <form action={startStripeCheckoutAction} className="card-action">
                <button type="submit">Continue to billing</button>
              </form>
            </>
          )}
        </SetupCard>

        <SetupCard step="Step 3" title="Business Profile">
          <form action={saveBusinessProfileAction} className="forecast-form">
            <input type="hidden" name="next" value="/get-started" />
            <label>
              Business type
              <select name="businessType" defaultValue={profile?.business_type ?? "service"}>
                <option value="service">Service</option>
                <option value="subscription">Subscription</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
            <label>
              Offer model
              <select name="offerModel" defaultValue={profile?.offer_model ?? "high_ticket"}>
                <option value="high_ticket">High ticket</option>
                <option value="recurring">Recurring</option>
                <option value="one_time">One time</option>
              </select>
            </label>
            <label>
              Stage
              <select name="stage" defaultValue={profile?.stage ?? "mvp"}>
                <option value="mvp">MVP</option>
                <option value="growth">Growth</option>
                <option value="scale">Scale</option>
              </select>
            </label>
            <label>
              Revenue band
              <select name="revenueBand" defaultValue={profile?.revenue_band ?? "unknown"}>
                <option value="unknown">Unknown</option>
                <option value="0-10k">$0 - $10k monthly</option>
                <option value="10k-50k">$10k - $50k monthly</option>
                <option value="50k-250k">$50k - $250k monthly</option>
                <option value="250k+">$250k+ monthly</option>
              </select>
            </label>
            <label>
              Team size
              <input name="teamSize" type="number" min="1" defaultValue={profile?.team_size ?? ""} />
            </label>
            <label>
              Timezone
              <input name="timezone" type="text" defaultValue={profile?.timezone ?? "America/New_York"} required />
            </label>
            <label className="metric-checkbox-row">
              <input name="benchmarkOptIn" type="checkbox" defaultChecked={profile?.benchmark_opt_in ?? false} />
              <span>Use benchmark comparisons</span>
            </label>
            <button type="submit">Save profile</button>
          </form>
        </SetupCard>

        <SetupCard step="Step 4" title="Data Sources">
          <div className="integration-health-grid">
            {[
              ["Stripe", "/integrations/stripe"],
              ["CSV Banking", "/integrations/csv-banking"],
              ["Calendly", "/integrations/calendly"],
              ["Typeform", "/integrations/typeform"],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="integration-health-row">
                <span>{label}</span>
                <strong>Connect</strong>
              </Link>
            ))}
          </div>
        </SetupCard>

        <SetupCard step="Step 5" title="Most Important Metrics">
          <form action={saveMetricSelectionsAction} className="metric-selector-form compact-selector">
            <input type="hidden" name="viewKey" value="ceo" />
            <input type="hidden" name="next" value="/get-started" />
            <div className="metric-selector-grid compact-selector-grid">
              {metricDefinitions.map((definition) => (
                <label key={definition.id} className="metric-checkbox-row">
                  <input
                    type="checkbox"
                    name="metricId"
                    value={definition.id}
                    defaultChecked={selectedMetricIds.has(definition.id)}
                  />
                  <span>{definition.name}</span>
                </label>
              ))}
            </div>
            <button type="submit">Save metrics</button>
          </form>
        </SetupCard>

        <SetupCard step="Step 6" title="Messaging">
          <div className="integration-health-grid">
            <Link href="/settings/slack" className="integration-health-row">
              <span>Slack</span>
              <strong>Connect</strong>
            </Link>
            <Link href="/settings/telegram" className="integration-health-row">
              <span>Telegram</span>
              <strong>Connect</strong>
            </Link>
          </div>
          <Link href="/dashboard" className="button-primary card-action">Open Metrics</Link>
        </SetupCard>
      </section>
    </AppShell>
  );
}
