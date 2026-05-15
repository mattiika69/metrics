create extension if not exists pgcrypto with schema extensions;

create type public.tenant_invitation_status as enum (
  'pending',
  'accepted',
  'revoked',
  'expired'
);

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'member',
  token_hash text not null unique,
  status public.tenant_invitation_status not null default 'pending',
  invited_by_user_id uuid not null references auth.users(id) on delete restrict,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role <> 'owner'::public.app_role),
  check (email = lower(trim(email)))
);

create unique index tenant_invitations_pending_email_idx
  on public.tenant_invitations (tenant_id, email)
  where status = 'pending';

create index tenant_invitations_tenant_created_at_idx
  on public.tenant_invitations (tenant_id, created_at desc);

create index user_profiles_email_idx
  on public.user_profiles (email);

alter table public.user_profiles enable row level security;
alter table public.tenant_invitations enable row level security;

create or replace function public.shares_tenant_with_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships mine
    join public.tenant_memberships teammate
      on teammate.tenant_id = mine.tenant_id
    where mine.user_id = auth.uid()
      and teammate.user_id = target_user_id
  );
$$;

create policy "Users can read own profile"
  on public.user_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Tenant members can read teammate profiles"
  on public.user_profiles
  for select
  to authenticated
  using (public.shares_tenant_with_user(user_id));

create policy "Users can update own profile"
  on public.user_profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Tenant admins can read invitations"
  on public.tenant_invitations
  for select
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant admins can create invitations"
  on public.tenant_invitations
  for insert
  to authenticated
  with check (
    invited_by_user_id = auth.uid()
    and public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[])
  );

create policy "Tenant admins can update invitations"
  on public.tenant_invitations
  for update
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create or replace function public.sync_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (
    user_id,
    email,
    full_name,
    updated_at
  )
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    now()
  )
  on conflict (user_id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.user_profiles.full_name),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists sync_user_profile on auth.users;

create trigger sync_user_profile
after insert or update of email, raw_user_meta_data on auth.users
for each row
execute function public.sync_user_profile();

insert into public.user_profiles (
  user_id,
  email,
  full_name,
  created_at,
  updated_at
)
select
  id,
  lower(email),
  coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name'),
  created_at,
  now()
from auth.users
where email is not null
on conflict (user_id) do update set
  email = excluded.email,
  full_name = coalesce(excluded.full_name, public.user_profiles.full_name),
  updated_at = now();

create or replace function public.accept_tenant_invitation(invitation_token text)
returns table (
  accepted_tenant_id uuid,
  invitation_id uuid,
  accepted_role public.app_role
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.tenant_invitations%rowtype;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if nullif(trim(invitation_token), '') is null then
    raise exception 'Invitation token is required.';
  end if;

  current_email := lower(coalesce(auth.jwt()->>'email', ''));

  select *
  into invitation
  from public.tenant_invitations
  where token_hash = encode(extensions.digest(invitation_token, 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'Invitation not found.';
  end if;

  if invitation.status <> 'pending' then
    raise exception 'Invitation is no longer pending.';
  end if;

  if invitation.expires_at < now() then
    update public.tenant_invitations
    set
      status = 'expired',
      updated_at = now()
    where id = invitation.id;

    raise exception 'Invitation has expired.';
  end if;

  if invitation.email <> current_email then
    raise exception 'Invitation email does not match the signed-in account.';
  end if;

  insert into public.tenant_memberships (
    tenant_id,
    user_id,
    role
  )
  values (
    invitation.tenant_id,
    auth.uid(),
    invitation.role
  )
  on conflict (tenant_id, user_id) do update set
    role = case
      when public.tenant_memberships.role = 'owner'::public.app_role
        then public.tenant_memberships.role
      else excluded.role
    end;

  update public.tenant_invitations
  set
    status = 'accepted',
    accepted_by_user_id = auth.uid(),
    accepted_at = now(),
    updated_at = now()
  where id = invitation.id;

  return query
    select invitation.tenant_id, invitation.id, invitation.role;
end;
$$;

revoke execute on function public.accept_tenant_invitation(text)
  from public, anon;

grant execute on function public.accept_tenant_invitation(text)
  to authenticated;
