# HyperOptimal Metrics Infrastructure Status

Verified on 2026-05-15.

## Source of Truth Rule

HyperOptimal Metrics is database-first. Product data, user data, tenant data, integration data, billing state, audit records, generated AI outputs, uploads, messages, and operational state must be persisted to Supabase before any workflow reports success.

Do not save product state only to local files, browser storage, memory, or build artifacts. Local files are allowed only for source code, migrations, documentation, dependency installs, build output, caches, and temporary tooling required to develop and deploy the product.

## Cloud Connections

- GitHub: connected to `mattiika69/metrics`, default branch `main`.
- Supabase: linked to project `fuxwmwdtuppcmrsjcgzt` named `Metrics`; schema changes are tracked in `supabase/migrations`.
- Vercel: connected to project `metrics`; production deploys originate from GitHub `main`, primary alias `https://metrics-ten-lovat.vercel.app`.
- Architecture standard: [docs/hyperoptimal-saas-standard.md](hyperoptimal-saas-standard.md), referenced by [ARCHITECTURE.md](../ARCHITECTURE.md) and [AGENTS.md](../AGENTS.md).

## Auth, Multi-Tenancy, and RLS

- Supabase Auth is the identity provider.
- Tenant state is modeled with `tenants`, `tenant_memberships`, `user_profiles`, and `tenant_invitations`.
- Canonical audit state is modeled with `admin_audit_log`.
- Protected app routes resolve the authenticated user and tenant before reading or writing tenant data.
- Tenant-owned tables use `tenant_id`.
- Application tables have RLS enabled through Supabase migrations.
- Service-role access is server-only and reserved for trusted admin, webhook, and integration paths.
- Temporary auth bypass is restricted to `DISABLE_LOGIN_AUTH`, `AUTH_BYPASS_EMAIL`, `AUTH_BYPASS_TENANT_ID`, and `AUTH_BYPASS_USER_ID`, with backwards-compatible legacy aliases still accepted.

## Data Persistence and Security

- Durable user and tenant data persists in Supabase Postgres.
- RLS policies restrict tenant data to tenant members.
- Audit logs are stored in `audit_events` and `admin_audit_log`.
- Webhook idempotency is stored in `webhook_events`.
- Rate-limit counters are stored in `rate_limit_buckets`.
- Integration secrets are stored server-side in `metric_integration_secrets` and are never returned to the browser.
- Browser code must never receive Supabase service-role, Stripe secret, Slack, Telegram, Resend, Roezan, or Anthropic secret keys.

## Stripe Billing

Stripe billing is implemented as a tenant-scoped foundation.

- Data model: `billing_customers`, `billing_subscriptions`, `billing_subscription_items`, `billing_events`, `billing_usage_records`.
- Checkout flow: `startStripeCheckoutAction()`.
- Webhook route: `POST /api/stripe/webhook`.
- Standard webhook alias: `POST /api/billing/webhook`.
- Billing APIs: `GET /api/billing/status`, `POST /api/billing/portal`, `GET /api/billing/plans`, `GET /billing/checkout`.
- Webhook handling verifies Stripe signatures, records idempotency, and syncs tenant subscription state.

Required before live billing:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_ONBOARDING_PRICE_ID`

## Team Members

Team management is implemented.

- Page: `/settings/team`.
- Invitation acceptance: `/invite/accept` and `/settings/team/accept`.
- Data model: `tenant_invitations`, `tenant_memberships`, `user_profiles`.
- Tenant admins can invite team members as admin or member.
- Invitations are tenant-scoped, expire, and can only be accepted by the invited email.
- Invite email delivery status is stored with the invitation.
- Team APIs are available at `/api/team/invitations`, `/api/team/members`, and `/api/team/members/:id`.

## Settings and Scheduling

Settings includes:

- Account.
- Team.
- Billing.
- Integrations.
- Scheduling.
- Slack.
- Telegram.

Scheduling is tenant-scoped and RLS-protected.

- Data model: `integration_workflow_schedules`, `integration_workflow_runs`, `integration_workflow_run_events`.
- Page: `/settings/scheduling`.
- APIs: `GET/POST /api/integrations/schedules`, `PATCH/DELETE /api/integrations/schedules/:id`, `POST /api/integrations/schedules/:id/run`, `GET /api/integrations/schedule-runs`, `POST /api/workflows/scheduled`.

## Page Shell and Design System

The app shell is implemented to match the Scaling Metrics design system.

- Shell component: `components/app-shell.tsx`.
- Styling: `app/globals.css`, section `Scaling Metrics design system shell`.
- Tailwind config: `tailwind.config.ts`, `postcss.config.js`.
- Font: Montserrat through `next/font/google` and CSS variables.
- Sidebar uses the app name `HyperOptimal Metrics`.
- No org switcher is shown.
- No `Most Viewed` section is shown.
- The sidebar only includes built app pages: CEO Dashboard, Reverse Engineering, Financials, Retention, Sales, Inputs, Benchmarks, Constraints, and Settings.
- The top utility chip bar is not present.

## Internal APIs Implemented

- `GET /api/health`
- `GET /api/navigation/sidebar-order`
- `POST /api/navigation/sidebar-order`
- `GET /auth/callback`
- `GET /invite/accept`
- `POST /api/email/send`
- `GET /api/audit/events`
- `POST /api/team/invitations`
- `DELETE /api/team/invitations`
- `GET /api/team/members`
- `PATCH /api/team/members/:id`
- `DELETE /api/team/members/:id`
- `GET /billing/checkout`
- `POST /api/billing/webhook`
- `GET /api/billing/status`
- `POST /api/billing/portal`
- `GET /api/billing/plans`
- `GET /api/integrations`
- `GET /api/integrations/[id]`
- `POST /api/integrations/[id]`
- `DELETE /api/integrations/[id]`
- `POST /api/integrations/[id]/sync`
- `GET /api/integrations/slack/oauth/start`
- `GET /api/integrations/slack/oauth/callback`
- `GET /api/integrations/slack/status`
- `POST /api/integrations/slack/disconnect`
- `POST /api/integrations/slack/events`
- `POST /api/integrations/slack/commands`
- `POST /api/integrations/slack/interactions`
- `GET /api/integrations/telegram/status`
- `POST /api/integrations/telegram/link-code`
- `POST /api/integrations/telegram/disconnect`
- `POST /api/integrations/telegram/delivery-test`
- `POST /api/integrations/telegram/webhook`
- `GET /api/integrations/schedules`
- `POST /api/integrations/schedules`
- `PATCH /api/integrations/schedules/:id`
- `DELETE /api/integrations/schedules/:id`
- `POST /api/integrations/schedules/:id/run`
- `GET /api/integrations/schedule-runs`
- `POST /api/workflows/scheduled`
- `GET /api/agent/requests`
- `POST /api/agent/requests`
- `GET /api/agent/requests/:id`
- `POST /api/agent/requests/:id/approve`
- `POST /api/agent/requests/:id/cancel`
- `GET /api/agent/actions`
- `POST /api/agent/code-tasks`
- `GET /api/agent/deployments`
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

- Supabase publishable alias if not already set: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Stripe live or test keys: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_ONBOARDING_PRICE_ID`.
- Slack OAuth and event verification: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`.
- Telegram bot and webhook verification: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME`.
- Claude API: `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`.
- Encrypted integration secrets: `INTEGRATION_SECRET_KEY`.
- Scheduled workflow worker: `SCHEDULE_WORKER_SECRET`.
- App URL alias for OAuth callbacks if different from site URL: `NEXT_PUBLIC_APP_URL`.
