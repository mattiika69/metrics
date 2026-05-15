# HyperOptimal SaaS App Architecture Standard

Last updated: May 15, 2026.

This is the shared standard for every HyperOptimal single-use app. Treat it as authoritative project instruction. `ARCHITECTURE.md` records this app's implementation of the standard, and `docs/architecture-rls-source-of-truth.md` is the local org/user/RLS source of truth.

## Default Operating Rules

- Read `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, this standard, and relevant testing docs before modifying code.
- Keep useful product-specific code.
- Standardize the shared SaaS foundation across the app.
- Do not ask discovery questions unless a missing credential, destructive operation, or ambiguous product identity blocks progress.
- Use Supabase migrations for persistent data.
- Add RLS for every application table.
- Use server-side routes/actions for writes.
- Keep client-facing pages free of internal notes, engineering status, and unnecessary explainers.
- Run the smallest relevant checks before reporting completion.
- Commit as `mattiika69 <matt@1000xleads.com>`.
- Push to GitHub `main`.
- Verify Vercel production deployment from GitHub `main`.
- Verify Supabase migration state when schema changed.

## Universal App Contract

Every app must be a real client-facing, cloud-backed, multi-tenant SaaS app from the first step.

Every app must include Next.js, TypeScript, Tailwind, Montserrat, Supabase Auth, Supabase database, Supabase RLS, multi-tenant org/workspace model, team members and invites, Stripe-compatible billing, Resend email, Roezan SMS, Claude API, Slack integration, Telegram integration, Settings, database-first persistence, GitHub source control, Vercel deployment, desktop-first responsive UI, and mobile usable fallback.

Every product feature must support authenticated users, organization/workspace ownership, team membership, tenant isolation, RLS-protected persistence, auditability for sensitive actions, Stripe-compatible billing checks, Slack and Telegram access when relevant, and no local-only durable state.

## Data Persistence Rule

Supabase is the durable source of truth.

Do not use any of the following as canonical product storage:

- `localStorage`.
- `sessionStorage`.
- IndexedDB.
- Browser-only state.
- In-memory arrays.
- Temporary files.
- Generated JSON files.
- Unsynced client cache.
- CLI output.

Allowed local state:

- Temporary form input before save.
- UI-only state such as a modal being open.
- Short-lived loading state.
- Local development files while actively implementing.

Every create, edit, delete, import, generation, send, receive, sync, schedule, billing, team, Slack, Telegram, email, SMS, AI, or admin action must write to Supabase or the correct cloud provider before showing durable success.

If persistence fails, surface the failure, do not show fake success, preserve user input where possible, retry only when idempotent, and reconcile optimistic UI with the persisted server state.

## Cloud Identity Contract

Required GitHub setup:

- Repository is filled per app.
- Default branch is `main`.
- Commit author is `mattiika69 <matt@1000xleads.com>`.
- Durable work pushes to `main` unless explicitly requested otherwise.
- Production deploys originate from GitHub `main`.

Required Vercel setup:

- Vercel project linked to the GitHub repo.
- Production branch set to `main`.
- Environment variables configured in Vercel.
- Production deployments tied to GitHub commit metadata.
- Manual production deploys are fallback-only.

Required Supabase setup:

- Supabase project linked to the app.
- Migrations stored in the repo.
- Migrations applied to the cloud database.
- Auth configured for production URLs.
- RLS enabled on every application table.

## Multi-Tenant Data Architecture

Canonical shared tables:

- `tenants`.
- `user_profiles`.
- `tenant_memberships`.
- `tenant_invitations`.
- `admin_audit_log`.

Every workspace-owned app table must include `id`, `tenant_id`, `created_at`, `updated_at` when mutable, `created_by_user_id` where relevant, `updated_by_user_id` where relevant, and `archived_at` or `deleted_at` for reversible destructive actions.

Default access flow:

- Authenticate the user.
- Resolve the active tenant.
- Verify tenant membership.
- Check role when the action is admin/owner-only.
- Read or write only rows for that tenant.
- Audit sensitive actions.

Default tenant roles are `owner`, `admin`, `member`, and `viewer` when needed.

## RLS Architecture

Every application table must have RLS enabled.

Default helper functions:

- `public.is_tenant_member(tenant_id uuid)`.
- `public.has_tenant_role(tenant_id uuid, roles public.app_role[])`.

Tenant authorization must be enforced by Supabase policies, not only application code. User identity must come from Supabase Auth (`auth.uid()`), not request-provided user IDs.

## Service Role Rule

Service-role access is allowed only in trusted server code after one condition is true:

- The user was authenticated and tenant-checked.
- A provider webhook signature or secret was verified.
- A controlled system job is running intentionally.

Never expose service-role keys to the client.

## Auth Architecture

Production auth uses Supabase Auth.

Required surfaces:

- Sign up.
- Log in.
- Log out.
- Reset password.
- Update password.
- Auth callback.
- Invite acceptance.
- Privacy policy.
- Terms of service.

Temporary login bypass may exist only as a development switch:

- `DISABLE_LOGIN_AUTH`.
- `AUTH_BYPASS_EMAIL`.
- `AUTH_BYPASS_TENANT_ID`.
- `AUTH_BYPASS_USER_ID`.

Auth bypass must not remove tenant resolution, RLS-aware data design, or server-side authorization checks.

## Team Architecture

Team lives under Settings.

Owners/admins can invite team members by email, choose the invited role, view pending invites, see failed email delivery, cancel invites, change roles, and remove members. Invite records must be created in Supabase before email delivery is attempted. Invite emails send through Resend. Raw invite tokens are never stored; only token hashes are stored. Invite links expire. Invite acceptance requires the invited email address. Accepting an invite creates or updates `tenant_memberships`. Team invite, accept, cancel, role change, and removal actions are audited. Team seats must be compatible with Stripe billing.

Required team tables:

- `tenant_memberships`.
- `tenant_invitations`.
- `user_profiles`.
- `admin_audit_log`.

## Billing Architecture

Stripe is the billing source of truth.

Required billing tables:

- `billing_customers`.
- `billing_subscriptions`.
- `billing_subscription_items`.
- `billing_events`.
- `billing_usage_records` when usage limits exist.

Required billing behavior:

- Stripe customers map to tenants.
- Stripe subscriptions map to tenant plan access.
- Seats map to team membership when the plan is seat-based.
- Webhooks update billing state.
- Server-side checks gate paid functionality.
- Client UI can display billing state but cannot authorize access by itself.
- Billing-sensitive changes are audited.

Required billing routes:

- `GET /billing/checkout`.
- `POST /api/billing/webhook`.
- `GET /api/billing/status`.
- `POST /api/billing/portal`.
- `GET /api/billing/plans`.

## Settings Architecture

Every app must have Settings.

Required Settings tabs:

- Account.
- Team.
- Billing.
- Integrations.
- Scheduling.
- Slack.
- Telegram.

Optional Settings tabs include Profile, Security, Notifications, API keys, Webhooks, and owner/admin-only developer diagnostics.

Settings screens must be client-facing and action-oriented. Do not expose implementation notes, provider setup instructions, architecture language, or internal engineering status in normal client-facing Settings pages.

## Slack and Telegram Architecture

Slack and Telegram must have parity. Both providers must use the same tenant-scoped business services. Do not create separate Slack-only or Telegram-only business logic.

Required integration tables:

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

Required integration behavior:

- Store provider secrets encrypted server-side.
- Verify Slack signatures.
- Verify Telegram webhook secrets.
- Dedupe provider events.
- Persist inbound events.
- Persist outbound messages.
- Link Slack users/channels to tenants.
- Link Telegram users/chats to tenants.
- Support group/channel use.
- Respect tenant membership and role permissions.
- Return clear success/failure messages.
- Prevent cross-provider loops.
- Audit sensitive actions.

Required shared command families include menu/help, save records, generate outputs, repurpose inputs, add learnings/feedback, search/read records, update records, review queues, ops transactions/rules/snapshots, calendar/event capture, scheduled workflows, and disconnect/cancel/skip.

## Scheduled Workflow Architecture

Every app must include Settings Scheduling where owners/admins can make Slack and Telegram run workflows on a schedule.

Required scheduling tables:

- `integration_workflow_schedules`.
- `integration_workflow_runs`.
- `integration_workflow_run_events`.

Required UI:

- Schedule list.
- Create/edit schedule.
- Enable/disable schedule.
- Archive schedule.
- Run now.
- Run history.
- Failure state.
- Target selector for Slack, Telegram, or both.
- Slack channel selector.
- Telegram chat selector.
- Cadence selector.
- Timezone selector.
- Workflow/action selector.
- Message/template fields.

Required APIs:

- `GET /api/integrations/schedules`.
- `POST /api/integrations/schedules`.
- `PATCH /api/integrations/schedules/:id`.
- `DELETE /api/integrations/schedules/:id`.
- `POST /api/integrations/schedules/:id/run`.
- `GET /api/integrations/schedule-runs`.
- `POST /api/workflows/scheduled`.

## Agent Operator Architecture

Slack and Telegram agents may read, write, edit, and operate the app only through authorized, controlled workflows. Owners/admins can request app-editing operations. High-risk commands require confirmation. Every request and tool action is stored in Supabase. Every code change is tied to GitHub commit metadata. Production deploys come from GitHub `main`. Secrets are never exposed in Slack or Telegram. Arbitrary shell commands from chat are not allowed without an allowlist and approval flow.

Required agent tables:

- `agent_requests`.
- `agent_actions`.
- `agent_approvals`.
- `agent_code_tasks`.
- `agent_deployments`.
- `agent_tool_runs`.

## Email, SMS, and AI

Email provider is Resend. Team invites use Resend by default. Email sends are server-side, tenant-scoped where relevant, audited for sensitive workflows, and failures are surfaced.

SMS provider is Roezan. SMS sends are server-side, tenant-checked, billing-checked where relevant, consent-aware, quiet-hour-aware where relevant, rate limited, and audited.

AI provider is Claude via Anthropic. AI calls happen server-side. AI outputs that affect product state are persisted to Supabase before success is reported. AI failures are surfaced. Deterministic fallback is required when AI config is missing.

## Required API Architecture

Health and diagnostics:

- `GET /api/health`.

Navigation:

- `GET /api/navigation/sidebar-order`.
- `POST /api/navigation/sidebar-order`.

Auth and team:

- `GET /auth/callback`.
- `GET /invite/accept`.
- `POST /api/team/invitations`.
- `DELETE /api/team/invitations`.
- `GET /api/team/members`.
- `PATCH /api/team/members/:id`.
- `DELETE /api/team/members/:id`.

Billing:

- `GET /billing/checkout`.
- `POST /api/billing/webhook`.
- `GET /api/billing/status`.
- `POST /api/billing/portal`.
- `GET /api/billing/plans`.

Integrations:

- `GET /api/integrations`.
- `GET /api/integrations/slack/oauth/start`.
- `GET /api/integrations/slack/oauth/callback`.
- `GET /api/integrations/slack/status`.
- `POST /api/integrations/slack/disconnect`.
- `POST /api/integrations/slack/commands`.
- `POST /api/integrations/slack/events`.
- `POST /api/integrations/slack/interactions`.
- `GET /api/integrations/telegram/status`.
- `POST /api/integrations/telegram/link-code`.
- `POST /api/integrations/telegram/disconnect`.
- `POST /api/integrations/telegram/delivery-test`.
- `POST /api/integrations/telegram/webhook`.

Scheduling, audit, and agent APIs are defined in the scheduling and agent sections above.

App-specific APIs must authenticate the user, resolve tenant, verify membership/role, write to Supabase before returning success, reuse shared web/Slack/Telegram services where relevant, and audit sensitive actions.

## Required Environment Variables

Supabase:

- `NEXT_PUBLIC_SUPABASE_URL`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY`.

Temporary auth bypass:

- `DISABLE_LOGIN_AUTH`.
- `AUTH_BYPASS_EMAIL`.
- `AUTH_BYPASS_TENANT_ID`.
- `AUTH_BYPASS_USER_ID`.

Stripe:

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- `STRIPE_SECRET_KEY`.
- `STRIPE_WEBHOOK_SECRET`.
- `STRIPE_ONBOARDING_PRICE_ID`.

Email:

- `RESEND_API_KEY`.
- `RESEND_FROM_EMAIL`.
- `RESEND_FROM_NAME`.

SMS:

- `ROEZAN_API_KEY`.
- `ROEZAN_API_BASE_URL`.

AI:

- `ANTHROPIC_API_KEY`.
- `CLAUDE_MODEL`.

Integration security:

- `INTEGRATION_SECRET_KEY`.
- `SCHEDULE_WORKER_SECRET`.
- `SLACK_BOT_TOKEN`.
- `SLACK_SIGNING_SECRET`.
- `SLACK_CLIENT_ID`.
- `SLACK_CLIENT_SECRET`.
- `TELEGRAM_BOT_TOKEN`.
- `TELEGRAM_WEBHOOK_SECRET`.
- `TELEGRAM_BOT_USERNAME`.

## UI Architecture

Use Montserrat everywhere. Use a desktop-first layout with mobile usable fallback. Use the shared sidebar pattern. Put every app page in the sidebar. Put Billing, Team, Integrations, Scheduling, Slack, and Telegram inside Settings. Do not show org switching unless the product explicitly needs it. Do not show pages that are not part of the app. Do not show internal notes on client-facing pages. Do not show engineering explainers unless explicitly requested.

## New Feature Checklist

Before building any durable feature:

- Define the tenant-owned data model.
- Add Supabase migration.
- Add indexes.
- Add RLS.
- Add soft-delete/archive when destructive.
- Add audit logging where appropriate.
- Add server-side route/action.
- Reuse the same service from web, Slack, and Telegram where relevant.
- Add billing compatibility if usage, seats, limits, or paid access are involved.
- Surface persistence failures.
- Keep product pages free of internal notes.
- Run the smallest relevant checks.
- Push to GitHub `main`.
- Verify Vercel production deploy.
- Verify Supabase migration state if schema changed.
