-- Tenant memberships are security-sensitive. Browser clients may read their
-- own tenant memberships through RLS, but membership creation, role changes,
-- and removals must go through trusted server actions or vetted SECURITY
-- DEFINER flows such as invite acceptance.

drop policy if exists "Tenant admins can add memberships"
  on public.tenant_memberships;

drop policy if exists "Tenant admins can update memberships"
  on public.tenant_memberships;

drop policy if exists "Tenant owners can remove memberships"
  on public.tenant_memberships;

drop policy if exists "Tenant admins can create invitations"
  on public.tenant_invitations;

drop policy if exists "Tenant admins can update invitations"
  on public.tenant_invitations;

revoke insert, update, delete on public.tenant_memberships
  from anon, authenticated;

revoke insert, update, delete on public.tenant_invitations
  from anon, authenticated;

create index if not exists tenant_memberships_user_created_idx
  on public.tenant_memberships (user_id, created_at);

create index if not exists tenant_memberships_tenant_role_idx
  on public.tenant_memberships (tenant_id, role);

comment on table public.tenant_memberships is
  'Tenant access records. Direct client mutations are intentionally blocked; membership changes are handled by trusted server actions, tenant creation triggers, and invite-acceptance RPCs.';

comment on table public.tenant_invitations is
  'Tenant invitation records. Direct client mutations are intentionally blocked so invites are created, delivered, accepted, and revoked through audited server-side flows.';
