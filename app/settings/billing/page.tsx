import { AppShell } from "@/components/app-shell";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { startStripeCheckoutAction } from "@/lib/auth/actions";
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

export default async function BillingSettingsPage({ searchParams }: PageProps) {
  const { supabase, tenant } = await requireTenant();
  const params = await searchParams;
  const message = getParam(params, "message");
  const error = getParam(params, "error");
  const { data: customer } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id, updated_at")
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  const { data: subscription } = await supabase
    .from("billing_subscriptions")
    .select("status, stripe_subscription_id, current_period_end, cancel_at_period_end, updated_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <AppShell active="settings" tenantName={tenant.name}>
      <section className="page-header">
        <p className="eyebrow">{tenant.name}</p>
        <h1>Settings</h1>
        <p className="lede">Manage billing for this workspace.</p>
        {message ? <p className="notice">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
      </section>
      <SettingsTabs active="billing" />
      <section className="settings-layout">
        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Billing</p>
              <h2>Subscription</h2>
            </div>
            <span className="pill">{subscription?.status ?? "Not started"}</span>
          </div>
          <div className="settings-list">
            <div>
              <span>Billing account</span>
              <strong>{customer?.stripe_customer_id ? "Connected" : "Not connected"}</strong>
            </div>
            <div>
              <span>Subscription</span>
              <strong>{subscription?.stripe_subscription_id ? "Connected" : "Not connected"}</strong>
            </div>
            <div>
              <span>Current period end</span>
              <strong>{subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : "None"}</strong>
            </div>
            <div>
              <span>Cancel at period end</span>
              <strong>{subscription?.cancel_at_period_end ? "Yes" : "No"}</strong>
            </div>
          </div>
        </article>
        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Checkout</p>
              <h2>Checkout</h2>
            </div>
          </div>
          <p className="muted">Start or update billing for this workspace.</p>
          <form action={startStripeCheckoutAction} className="card-action">
            <button type="submit">Continue to billing</button>
          </form>
        </article>
      </section>
    </AppShell>
  );
}
