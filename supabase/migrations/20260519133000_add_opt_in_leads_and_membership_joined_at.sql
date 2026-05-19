alter table public.tenant_memberships
  add column if not exists joined_at timestamptz;

update public.tenant_memberships
set joined_at = coalesce(joined_at, created_at, now())
where joined_at is null;

alter table public.tenant_memberships
  alter column joined_at set default now(),
  alter column joined_at set not null;

create index if not exists tenant_memberships_tenant_joined_idx
  on public.tenant_memberships (tenant_id, joined_at desc);

create table if not exists public.opt_in_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text,
  last_name text,
  source text not null default 'opt-in',
  asset_key text not null default 'metrics-source-of-truth',
  status text not null default 'captured',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opt_in_leads_email_lower_check check (email = lower(trim(email))),
  constraint opt_in_leads_status_check check (
    status in ('captured', 'confirmed', 'disqualified')
  )
);

create unique index if not exists opt_in_leads_email_asset_idx
  on public.opt_in_leads (email, asset_key);

create index if not exists opt_in_leads_created_at_idx
  on public.opt_in_leads (created_at desc);

alter table public.opt_in_leads enable row level security;

comment on column public.tenant_memberships.joined_at is
  'Timestamp when a user joined a tenant. Accepted memberships must have this set.';

comment on table public.opt_in_leads is
  'Public opt-in lead captures. Writes happen only through trusted server actions.';
