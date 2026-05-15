# Stripe Billing

Billing is tenant-scoped. A Stripe customer represents a tenant workspace, and subscription state is stored against that tenant.

## Environment Variables

- `STRIPE_SECRET_KEY`: server-only Stripe API key.
- `STRIPE_WEBHOOK_SECRET`: server-only webhook signing secret.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: browser-safe publishable key.
- `STRIPE_PRICE_ID`: default subscription price used by checkout flows.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key used by trusted webhook/admin paths.

## Data Model

- `billing_customers`: maps a tenant to a Stripe customer.
- `billing_subscriptions`: stores the current subscription state for a tenant.

Both tables have RLS enabled. Authenticated tenant members may read billing state for their tenant. Writes are reserved for trusted server-side Stripe webhook and admin flows.

## Implementation Rules

- Create Stripe customers for tenants, not individual users.
- Gate paid features by tenant subscription status.
- Treat Stripe webhooks as the source of truth for subscription state.
- Never expose Stripe secret keys or Supabase service-role credentials to the browser.
