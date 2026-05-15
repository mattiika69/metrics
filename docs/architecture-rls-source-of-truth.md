# Architecture and RLS Source of Truth

This document is the canonical org, user, tenant, and RLS architecture for HyperOptimal Metrics going forward.

## Naming

- Product/UI language may say org, workspace, team, account, or company when that is clearer for customers.
- Database and application code must use `tenant` terminology.
- The canonical org table is `public.tenants`.
- The canonical org foreign key is `tenant_id`.
- Do not introduce `org_id`, `organization_id`, or a separate organizations table unless a deliberate migration replaces the tenant model everywhere.

## Core Identity Model

- User identity comes from Supabase Auth: `auth.users`.
- Application-safe user profile fields live in `public.user_profiles`.
- Customer workspaces live in `public.tenants`.
- Access to a workspace is represented by `public.tenant_memberships`.
- Team invites are represented by `public.tenant_invitations`.

Core tables:

- `tenants`: one row per customer workspace/org.
- `tenant_memberships`: joins `auth.users` to `tenants` with role `owner`, `admin`, or `member`.
- `user_profiles`: profile fields safe to display inside the app.
- `tenant_invitations`: pending team invitations scoped to one tenant and one invited email.

## RLS Helper Functions

Use the existing Supabase helpers in policies:

- `public.is_tenant_member(target_tenant_id uuid)`: true when `auth.uid()` belongs to the tenant.
- `public.has_tenant_role(target_tenant_id uuid, allowed_roles public.app_role[])`: true when `auth.uid()` has one of the allowed roles for the tenant.
- `public.shares_tenant_with_user(target_user_id uuid)`: true when the current user shares at least one tenant with the target user.

Do not trust request-provided user IDs or tenant IDs for authorization. The database must enforce access through `auth.uid()` and these helpers.

## Required Table Pattern

Every durable tenant-owned feature table must include:

- `id uuid primary key default gen_random_uuid()` unless a natural key is explicitly required.
- `tenant_id uuid not null references public.tenants(id) on delete cascade`.
- `created_at timestamptz not null default now()`.
- `updated_at timestamptz` when records can change.
- `created_by_user_id uuid references auth.users(id)` when user attribution matters.
- RLS enabled before the feature is considered complete.

Server-only secret tables must still include `tenant_id`, must have RLS enabled, and must not expose read policies to browser clients unless there is a specific safe metadata view. Secrets should be written only by trusted server paths using the service-role key.

## Default Policy Pattern

Read policy for tenant data:

```sql
using (public.is_tenant_member(tenant_id))
```

Member-managed insert policy:

```sql
with check (public.is_tenant_member(tenant_id))
```

Admin-managed insert, update, and delete policy:

```sql
using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
```

Owner-only destructive policy:

```sql
using (public.has_tenant_role(tenant_id, array['owner']::public.app_role[]))
```

Use the least privilege role that fits the workflow. Admin-only is the default for billing, integrations, team access, secrets, and destructive actions.

## Application Access Pattern

Protected server-rendered app pages and server actions must use:

- `requireUser()` when only a signed-in user is needed.
- `requireTenant()` when tenant data is read or written.

API routes must use:

- `requireApiTenant()` for tenant-scoped APIs.

Client code must not decide the active tenant by sending arbitrary `tenant_id` or `user_id` values. If a route includes an object ID, server code must resolve the authenticated tenant and query with `tenant_id = resolvedTenant.id`; RLS must still enforce the boundary.

## Service Role Rules

The Supabase service-role key is server-only and may be used only for trusted operations:

- Stripe webhooks.
- Slack and Telegram webhook processing after signature or secret verification.
- Resend/Roezan delivery logging.
- Team invitation acceptance helpers that need controlled cross-table writes.
- Secret storage for integrations.
- Audit, webhook idempotency, and rate-limit infrastructure.

Never expose the service-role key to browser code. Never use service role to bypass tenant authorization for ordinary product reads or writes.

## Billing Architecture

Stripe billing belongs to the tenant, not only to a user.

- `billing_customers.tenant_id` maps a tenant to a Stripe customer.
- `billing_subscriptions.tenant_id` stores subscription state for the tenant.
- Stripe Checkout sessions must include tenant metadata.
- Stripe webhooks must verify signatures, record webhook idempotency, and write subscription state server-side.

## Team Architecture

Team membership belongs to a tenant.

- Only tenant `owner` and `admin` roles can invite team members.
- Invitations are scoped by `tenant_id` and normalized invited email.
- Users can accept only invitations matching their authenticated email.
- Accepted invites create or update `tenant_memberships`.
- Owner role cannot be granted through the standard invite flow.

## Data Persistence Rule

All durable product state must be persisted to Supabase before success is returned to the user or external system. This includes metrics, integrations, billing, team changes, AI outputs, audit logs, messages, webhook records, and configuration.

Do not use local files, browser storage, in-memory state, or generated build artifacts as the source of truth for product data. Local files are only for source code, migrations, documentation, dependency installs, build output, caches, and temporary tooling.

## Feature Checklist

Before shipping any new durable feature:

- The feature has an authenticated user path.
- Tenant data is scoped by `tenant_id`.
- Every new table has RLS enabled.
- Policies use `is_tenant_member()` or `has_tenant_role()`.
- Writes use the authenticated `auth.uid()` or resolved server context, not request-provided user IDs.
- Admin, billing, integration, email, SMS, AI, and destructive actions are audit-logged.
- Webhook mutations are idempotent through `webhook_events`.
- Rate limits exist for auth-adjacent, communication-send, and webhook endpoints.
- Secrets stay server-side.
- Migrations are pushed to Supabase and committed to GitHub.
- The completed work is pushed to `main`.

## Anti-Patterns

Do not introduce:

- `organization_id`, `org_id`, or duplicate organization tables.
- Anonymous tenant-owned data access.
- Product state saved only in `localStorage`, cookies, static JSON, markdown, local files, or memory.
- Browser-accessible service-role, Stripe secret, Slack, Telegram, Resend, Roezan, or Anthropic keys.
- Policies that rely on client-provided user IDs for authorization.
- Client-facing pages that show implementation notes, internal plans, TODOs, or developer commentary.
