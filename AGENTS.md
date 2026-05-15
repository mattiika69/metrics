# Repository Operating Rules

## Cloud Source of Truth

Everything durable must be written to and synced with the cloud.

- Do not treat local files as the source of truth.
- Do not leave completed work only on the local machine.
- Commit and push every finished code, configuration, documentation, migration, and design change to `main`.
- Sync deployment configuration and environment variables to the appropriate cloud service when credentials permit it.
- Use local files only as temporary working state required by editors, build tools, package managers, or CLIs.
- If a change cannot be synced because credentials or permissions are missing, state the blocker clearly and do not claim the work is complete.
- Before finishing a task, verify the relevant cloud destination is updated or explicitly report what remains unsynced.

## Default Workflow

- Keep changes small and task-scoped.
- Preserve user work and avoid overwriting unrelated changes.
- Run the smallest relevant verification before pushing.
- Prefer cloud-connected workflows: GitHub for source, Vercel for deployment, and Supabase for database/configuration.

## Auth, RLS, Multi-Tenancy, Billing, Messaging, and Email

Every durable feature must support user authentication, row-level security, multi-tenancy, Stripe-ready billing, Slack/Telegram-ready messaging, and Resend-ready email from day one.

- Do not add user-facing functionality that assumes anonymous access unless the task explicitly requires a public surface.
- Do not add application tables without enabling RLS.
- Every tenant-owned table must include a `tenant_id` column and policies that restrict access to members of that tenant.
- User identity must come from Supabase Auth (`auth.uid()`), not request-provided user IDs.
- Tenant authorization must be enforced in Supabase policies, not only in application code.
- Service-role access must only be used for trusted server-side administration paths and must never be exposed to the browser.
- If a feature cannot be made tenant-aware in the current task, document the blocker and do not treat the feature as complete.

## Billing

Every tenant-facing feature must be compatible with Stripe billing.

- Billing state belongs to a tenant, not only to an individual user.
- Stripe customer and subscription identifiers must be stored server-side only.
- Stripe webhook handling must use trusted server-side code and the Supabase service-role key.
- Browser code must never receive `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or the Supabase service-role key.
- Features that will eventually be plan-gated must include a clear tenant-level billing check point, even if plans are not enforced yet.

## Slack and Telegram

Every workflow must be designed so it can eventually be used from the web app, Slack, and Telegram.

- Slack and Telegram connections belong to tenants.
- Bot tokens, signing secrets, webhook secrets, and service-role credentials are server-only.
- Inbound events must be verified before being processed.
- Read/write actions performed from Slack or Telegram must resolve the tenant and authenticated/authorized actor before touching tenant data.
- Persisted messages, events, commands, and integration state must be tenant-scoped and protected by RLS.
- If an event cannot be mapped to a tenant, acknowledge safely and do not persist private data.

## Email

Every workflow that sends email must be tenant-scoped and logged.

- Resend API keys and sender configuration are server-only unless explicitly documented as public.
- Email sends must resolve an authenticated user and tenant membership before sending tenant-owned email.
- Email delivery records must include `tenant_id` and have RLS enabled.
- Do not expose `RESEND_API_KEY` to the browser.
- If a tenant-specific sender/domain is required later, store that configuration server-side and protect it with tenant RLS.
