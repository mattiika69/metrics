# Auth, RLS, and Multi-Tenancy

HyperOptimal Metrics is built as a multi-tenant SaaS product. Authentication, row-level security, and tenant scoping are required for every durable feature.

## Core Rules

- Supabase Auth is the source of user identity.
- Every application table must have RLS enabled.
- Tenant-owned tables must include `tenant_id`.
- A user can only access tenant data through membership in `tenant_memberships`.
- Authorization must be enforced by database policies, with application checks used only as additional guardrails.
- Browser code must only use the anon key. The service-role key is server-only.

## Base Data Model

- `tenants`: one row per customer workspace/account.
- `tenant_memberships`: maps authenticated users to tenants with a role.
- Tenant-scoped feature tables: include `tenant_id` and policies based on `is_tenant_member(tenant_id)`.

## Feature Checklist

Before shipping a feature:

- The UI requires an authenticated user when data is private.
- Every new table has RLS enabled.
- Tenant tables include `tenant_id`.
- Policies cover select, insert, update, and delete as appropriate.
- The implementation never trusts a client-provided tenant or user ID without policy enforcement.
- Migrations are pushed to Supabase and committed to GitHub.
