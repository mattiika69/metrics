# HyperOptimal Metrics Infrastructure Status

Verified on 2026-05-15.

## Source of Truth Rule

HyperOptimal Metrics is database-first. Product data, user data, tenant data, integration data, billing state, audit records, generated AI outputs, uploads, messages, and operational state must be persisted to Supabase before any workflow reports success.

Do not save product state only to local files, browser storage, memory, or build artifacts. Local files are allowed only for source code, migrations, documentation, dependency installs, build output, caches, and temporary tooling required to develop and deploy the product.

## Cloud Connections

- GitHub: connected to `mattiika69/metrics`, default branch `main`.
- Supabase: linked to project `fuxwmwdtuppcmrsjcgzt` named `Metrics`; local and remote migrations match through `20260515183000`.
- Vercel: connected to project `metrics`, production deployment `dpl_3CnyQVff5mpaU5LEihuJ9c4uZd3x`, primary alias `https://metrics-ten-lovat.vercel.app`.

## Auth, Multi-Tenancy, and RLS

- Supabase Auth is the identity provider.
- Tenant state is modeled with `tenants`, `tenant_memberships`, `user_profiles`, and `tenant_invitations`.
- Protected app routes resolve the authenticated user and tenant before reading or writing tenant data.
- Tenant-owned tables use `tenant_id`.
- Application tables have RLS enabled through Supabase migrations.
- Service-role access is server-only and reserved for trusted admin, webhook, and integration paths.

## Data Persistence and Security

- Durable user and tenant data persists in Supabase Postgres.
- RLS policies restrict tenant data to tenant members.
- Audit logs are stored in `audit_events`.
- Webhook idempotency is stored in `webhook_events`.
- Rate-limit counters are stored in `rate_limit_buckets`.
- Integration secrets are stored server-side in `metric_integration_secrets` and are never returned to the browser.
- Browser code must never receive Supabase service-role, Stripe secret, Slack, Telegram, Resend, Roezan, or Anthropic secret keys.

## Stripe Billing

Stripe billing is implemented as a tenant-scoped foundation.

- Data model: `billing_customers`, `billing_subscriptions`.
- Checkout flow: `startStripeCheckoutAction()`.
- Webhook route: `POST /api/stripe/webhook`.
- Webhook handling verifies Stripe signatures, records idempotency, and syncs tenant subscription state.

Required before live billing:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_ID`

## Team Members

Team management is implemented.

- Page: `/settings/team`.
- Invitation acceptance: `/settings/team/accept`.
- Data model: `tenant_invitations`, `tenant_memberships`, `user_profiles`.
- Tenant admins can invite team members as admin or member.
- Invitations are tenant-scoped, expire, and can only be accepted by the invited email.

## Page Shell and Design System

The app shell is implemented to match the Scaling Metrics design system.

- Shell component: `components/app-shell.tsx`.
- Styling: `app/globals.css`, section `Scaling Metrics design system shell`.
- Sidebar uses the app name `HyperOptimal Metrics`.
- No org switcher is shown.
- No `Most Viewed` section is shown.
- The sidebar only includes built app pages: Dashboard, AI Context Doc, Integrations, Constraints, Metrics pages, and Team.
- The top utility chip bar is not present.

## Internal APIs Implemented

- `POST /api/email/send`
- `GET /api/integrations`
- `GET /api/integrations/[id]`
- `POST /api/integrations/[id]`
- `DELETE /api/integrations/[id]`
- `POST /api/integrations/[id]/sync`
- `GET /api/integrations/slack/oauth/start`
- `GET /api/integrations/slack/oauth/callback`
- `POST /api/integrations/slack/events`
- `POST /api/integrations/slack/commands`
- `POST /api/integrations/slack/interactions`
- `GET /api/integrations/telegram/status`
- `POST /api/integrations/telegram/link-code`
- `POST /api/integrations/telegram/delivery-test`
- `POST /api/integrations/telegram/webhook`
- `GET /api/metrics/audit`
- `GET /api/metrics/detail/[metricId]`
- `POST /api/metrics/override`
- `GET /api/metrics/raw-data`
- `POST /api/metrics/recalculate`
- `GET /api/metrics/snapshots`
- `POST /api/slack/events`
- `POST /api/sms/send`
- `POST /api/stripe/webhook`
- `POST /api/telegram/webhook`

## External APIs and Configuration Present

Configured in Vercel as of verification:

- Supabase URL, anon key, and service-role key.
- Resend API key and sender email.
- Roezan API key and API base URL.
- Site URL.
- Temporary auth bypass variables.

## External APIs Still Needed Before Full Production Use

- Stripe live or test keys: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_ID`.
- Slack OAuth and event verification: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`.
- Telegram bot and webhook verification: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`.
- Claude API: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`.
- App URL alias for OAuth callbacks if different from site URL: `NEXT_PUBLIC_APP_URL`.

