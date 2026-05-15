# HyperOptimal Metrics Architecture

Last updated: May 15, 2026.

This repo follows the shared HyperOptimal SaaS standard in `docs/hyperoptimal-saas-standard.md`. That standard is authoritative for future work. This file is the project-local architecture reference for HyperOptimal Metrics.

## Cloud Source of Truth

Supabase is the durable source of truth for product state.

Nothing durable may be saved only in local files, browser storage, generated JSON, memory, IndexedDB, temporary files, or unsynced caches. Local files are allowed only for source code, migrations, documentation, dependency installs, build output, and short-lived implementation work.

Every create, edit, delete, import, generation, send, receive, sync, schedule, billing, team, Slack, Telegram, email, SMS, AI, or admin action must persist to Supabase or the appropriate cloud provider before showing durable success.

## Cloud Identity

- GitHub repository: `mattiika69/metrics`.
- Default branch: `main`.
- Commit author: `mattiika69 <matt@1000xleads.com>`.
- Vercel project: `metrics`.
- Production branch: `main`.
- Supabase project ref: `fuxwmwdtuppcmrsjcgzt`.
- Product name: `HyperOptimal Metrics`.

## Stack

- Next.js App Router.
- TypeScript.
- Tailwind.
- Montserrat everywhere.
- Supabase Auth, Postgres, and RLS.
- Stripe-compatible tenant billing.
- Resend email.
- Roezan SMS.
- Claude through Anthropic for AI.
- Slack and Telegram tenant integrations.
- Vercel deployment from GitHub `main`.

## Auth

Production auth uses Supabase Auth.

Required surfaces:

- Sign up: `/signup`.
- Log in: `/login`.
- Log out: `signOutAction`.
- Reset password: `/forgot-password`.
- Update password: `/reset-password`.
- Auth callback: `/auth/callback`.
- Invite acceptance: `/invite/accept` and `/settings/team/accept`.
- Privacy policy: `/privacy`.
- Terms of service: `/terms`.

Temporary bypass is allowed only through:

- `DISABLE_LOGIN_AUTH`.
- `AUTH_BYPASS_EMAIL`.
- `AUTH_BYPASS_TENANT_ID`.
- `AUTH_BYPASS_USER_ID`.

Bypass must still resolve a tenant and cannot remove RLS-aware data design or server-side authorization.

## Tenant Model

The tenant model is the source of truth for org/workspace access. Do not introduce `org_id`, `organization_id`, or duplicate organization tables.

Canonical tables:

- `tenants`.
- `user_profiles`.
- `tenant_memberships`.
- `tenant_invitations`.
- `admin_audit_log`.

Tenant roles:

- `owner`.
- `admin`.
- `member`.

Every tenant-owned table includes `tenant_id`, RLS, timestamps, and user attribution where relevant.

## RLS

Every application table must have RLS enabled.

Default helpers:

- `public.is_tenant_member(tenant_id uuid)`.
- `public.has_tenant_role(tenant_id uuid, roles public.app_role[])`.
- `public.shares_tenant_with_user(user_id uuid)`.

Server code still checks user and tenant context, but the database must enforce tenant isolation through RLS.

## Service Role

Service-role access is allowed only in trusted server code after one condition is true:

- The user was authenticated and tenant-checked.
- A provider webhook signature or secret was verified.
- A controlled system job is running intentionally.

Never expose service-role keys to the client.

## Team

Team lives under Settings.

Required behavior:

- Owners/admins invite team members by email and role.
- Invite records are created in Supabase before email delivery.
- Invite emails send through Resend.
- Raw tokens are never stored; only token hashes are stored.
- Invite links expire.
- Invite acceptance requires the invited email address.
- Accepting an invite writes `tenant_memberships`.
- Pending and failed invitations are visible to owners/admins.
- Cancelling invites, changing roles, and removing members are owner/admin actions.
- Team actions are audited.
- Team seats are compatible with Stripe billing.

## Billing

Stripe is the billing source of truth.

Required tables:

- `billing_customers`.
- `billing_subscriptions`.
- `billing_subscription_items`.
- `billing_events`.
- `billing_usage_records`.

Required routes:

- `GET /billing/checkout`.
- `POST /api/billing/webhook`.
- `GET /api/billing/status`.
- `POST /api/billing/portal`.
- `GET /api/billing/plans`.

Tenant plan access comes from server-side billing state. Client UI may display billing status but cannot authorize paid access by itself.

## Settings

Required Settings tabs:

- Account.
- Team.
- Billing.
- Integrations.
- Scheduling.
- Slack.
- Telegram.

Settings pages must be client-facing and action-oriented. They must not expose implementation notes, provider setup internals, architecture language, or engineering status.

## Slack and Telegram

Slack and Telegram have parity and share tenant-scoped business services.

Required tables:

- `slack_installations`.
- `slack_links`.
- `telegram_link_codes`.
- `telegram_links`.
- `integration_inbound_events`.
- `integration_outbound_messages`.
- `integration_processed_events`.
- `integration_command_sessions`.
- `integration_secrets`.
- `integration_channel_links`.
- `integration_routing_rules`.
- `integration_delivery_preferences`.

Both providers must verify inbound requests, dedupe events, persist inbound/outbound messages, resolve the tenant, respect membership and role permissions, and prevent cross-provider loops.

## Scheduling

Scheduling lives under Settings.

Required tables:

- `integration_workflow_schedules`.
- `integration_workflow_runs`.
- `integration_workflow_run_events`.

Required APIs:

- `GET /api/integrations/schedules`.
- `POST /api/integrations/schedules`.
- `PATCH /api/integrations/schedules/:id`.
- `DELETE /api/integrations/schedules/:id`.
- `POST /api/integrations/schedules/:id/run`.
- `GET /api/integrations/schedule-runs`.
- `POST /api/workflows/scheduled`.

Runs must write a durable run record before execution and update status after execution.

## Agent Operations

Slack and Telegram agent operations must go through controlled workflows. Arbitrary shell commands from chat are not allowed.

Required tables:

- `agent_requests`.
- `agent_actions`.
- `agent_approvals`.
- `agent_code_tasks`.
- `agent_deployments`.
- `agent_tool_runs`.

Required APIs:

- `POST /api/agent/requests`.
- `GET /api/agent/requests`.
- `GET /api/agent/requests/:id`.
- `POST /api/agent/requests/:id/approve`.
- `POST /api/agent/requests/:id/cancel`.
- `GET /api/agent/actions`.
- `POST /api/agent/code-tasks`.
- `GET /api/agent/deployments`.

## Environment Variables

Required names:

- `NEXT_PUBLIC_SUPABASE_URL`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY`.
- `DISABLE_LOGIN_AUTH`.
- `AUTH_BYPASS_EMAIL`.
- `AUTH_BYPASS_TENANT_ID`.
- `AUTH_BYPASS_USER_ID`.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- `STRIPE_SECRET_KEY`.
- `STRIPE_WEBHOOK_SECRET`.
- `STRIPE_ONBOARDING_PRICE_ID`.
- `RESEND_API_KEY`.
- `RESEND_FROM_EMAIL`.
- `RESEND_FROM_NAME`.
- `ROEZAN_API_KEY`.
- `ROEZAN_API_BASE_URL`.
- `ANTHROPIC_API_KEY`.
- `CLAUDE_MODEL`.
- `INTEGRATION_SECRET_KEY`.
- `SCHEDULE_WORKER_SECRET`.
- `SLACK_BOT_TOKEN`.
- `SLACK_SIGNING_SECRET`.
- `SLACK_CLIENT_ID`.
- `SLACK_CLIENT_SECRET`.
- `TELEGRAM_BOT_TOKEN`.
- `TELEGRAM_WEBHOOK_SECRET`.
- `TELEGRAM_BOT_USERNAME`.

The app supports current legacy env aliases where already deployed, but new setup must use the required names.

## UI

- Use Montserrat everywhere.
- Use the shared Scaling Metrics shell/sidebar pattern.
- Put every app page in the sidebar.
- Put Billing, Team, Integrations, Scheduling, Slack, and Telegram inside Settings.
- Do not show org switching unless explicitly required.
- Do not show pages that are not part of HyperOptimal Metrics.
- Do not show internal notes on client-facing pages.
- Desktop is the canonical layout; mobile must remain usable.

## Verification

Before reporting completion:

- Build passes.
- Migrations are pushed when schema changed.
- Latest work is pushed to GitHub `main`.
- Vercel production deployment is tied to GitHub `main`.
- RLS exists for every application table.
- Server writes authenticate, resolve tenant, and verify role where needed.
- No durable product state relies on local-only storage.
