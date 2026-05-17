alter table public.user_profiles
  add column if not exists is_admin boolean not null default false;

create index if not exists user_profiles_global_admin_idx
  on public.user_profiles (user_id)
  where is_admin = true;

comment on column public.user_profiles.is_admin is
  'Global product-admin flag. Server-side only for MVP admin access.';

revoke select on public.user_profiles from anon, authenticated;
grant select (user_id, email, full_name, created_at, updated_at)
  on public.user_profiles
  to authenticated;

revoke update on public.user_profiles from anon, authenticated;
grant update (full_name, updated_at)
  on public.user_profiles
  to authenticated;

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
    is_admin,
    updated_at
  )
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    lower(coalesce(new.email, '')) = 'matt@1000xleads.com',
    now()
  )
  on conflict (user_id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.user_profiles.full_name),
    is_admin = public.user_profiles.is_admin or excluded.is_admin,
    updated_at = now();

  return new;
end;
$$;

update public.user_profiles
set
  is_admin = true,
  updated_at = now()
where lower(email) = 'matt@1000xleads.com';

insert into public.user_profiles (
  user_id,
  email,
  full_name,
  is_admin,
  updated_at
)
select
  users.id,
  lower(users.email),
  coalesce(users.raw_user_meta_data->>'full_name', users.raw_user_meta_data->>'name'),
  true,
  now()
from auth.users
where lower(coalesce(users.email, '')) = 'matt@1000xleads.com'
on conflict (user_id) do update set
  email = excluded.email,
  full_name = coalesce(excluded.full_name, public.user_profiles.full_name),
  is_admin = true,
  updated_at = now();
