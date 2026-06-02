# Stripe Billing

Billing is tenant-scoped. A Stripe customer represents a tenant workspace, and subscription state is stored against that tenant.

## Environment Variables

- `STRIPE_SECRET_KEY`: server-only Stripe API key.
- `STRIPE_WEBHOOK_SECRET`: server-only webhook signing secret.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: browser-safe publishable key.
- `STRIPE_PRICE_BASIC`: default subscription price used by checkout flows.
- `STRIPE_PRICE_PRO`: Pro subscription price. Add this manually when the Pro plan is defined in Stripe.
- `STRIPE_PRICE_BUSINESS`: Business subscription price. Add this manually when the Business plan is defined in Stripe.
- `STRIPE_ONBOARDING_PRICE_ID`: legacy default subscription price alias.
- `STRIPE_PRICE_ID`: legacy default subscription price alias.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key used by trusted webhook/admin paths.

The default paid plan is `$1/mo`. The app prefers `STRIPE_PRICE_BASIC` and falls back to the legacy aliases for existing deployments.

## Data Model

- `billing_customers`: maps a tenant to a Stripe customer.
- `billing_subscriptions`: stores the current subscription state for a tenant.
- `billing_subscription_items`: stores subscription item and seat/price details.
- `billing_events`: stores verified Stripe webhook processing records.
- `billing_usage_records`: stores tenant usage when plan limits or metering exist.

Both tables have RLS enabled. Authenticated tenant members may read billing state for their tenant. Writes are reserved for trusted server-side Stripe webhook and admin flows.

## Implementation Rules

- Create Stripe customers for tenants, not individual users.
- Gate paid features by tenant subscription status.
- Treat Stripe webhooks as the source of truth for subscription state.
- Use Stripe Customer Portal for upgrades, downgrades, cancellations, invoices, and payment method changes.
- Sync seat quantity only from trusted server-side code or verified Stripe webhooks.
- Never expose Stripe secret keys or Supabase service-role credentials to the browser.

## Onboarding Handoff

- New signups land in `/get-started` after Supabase confirmation.
- Stripe Checkout success returns to `/get-started?billing=success&session_id={CHECKOUT_SESSION_ID}`.
- Stripe Checkout cancellation returns to `/get-started?billing=cancelled`.
- The MVP onboarding screen keeps a visible Stripe placeholder until live Stripe keys and a price ID are configured.
