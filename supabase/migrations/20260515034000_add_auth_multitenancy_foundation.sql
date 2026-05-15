create type public.app_role as enum ('owner', 'admin', 'member');

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;

create or replace function public.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships
    where tenant_id = target_tenant_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_tenant_role(
  target_tenant_id uuid,
  allowed_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships
    where tenant_id = target_tenant_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

create or replace function public.add_tenant_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenant_memberships (tenant_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (tenant_id, user_id) do nothing;

  return new;
end;
$$;

create trigger add_tenant_owner_membership
after insert on public.tenants
for each row
execute function public.add_tenant_owner_membership();

create policy "Authenticated users can create tenants"
  on public.tenants
  for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "Tenant members can read tenants"
  on public.tenants
  for select
  to authenticated
  using (public.is_tenant_member(id));

create policy "Tenant admins can update tenants"
  on public.tenants
  for update
  to authenticated
  using (public.has_tenant_role(id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant owners can delete tenants"
  on public.tenants
  for delete
  to authenticated
  using (public.has_tenant_role(id, array['owner']::public.app_role[]));

create policy "Tenant members can read memberships"
  on public.tenant_memberships
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can add memberships"
  on public.tenant_memberships
  for insert
  to authenticated
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant admins can update memberships"
  on public.tenant_memberships
  for update
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant owners can remove memberships"
  on public.tenant_memberships
  for delete
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner']::public.app_role[]));

drop policy if exists "Allow public health reads" on public._health;

alter table public._health
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

create policy "Tenant members can read health checks"
  on public._health
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));
