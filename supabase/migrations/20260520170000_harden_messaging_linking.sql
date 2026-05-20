create table if not exists public.integration_oauth_states (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  state_hash text not null,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, state_hash)
);

create index if not exists integration_oauth_states_tenant_provider_idx
  on public.integration_oauth_states (tenant_id, provider, created_at desc);

create index if not exists integration_oauth_states_active_idx
  on public.integration_oauth_states (provider, state_hash, expires_at)
  where consumed_at is null;

alter table public.integration_oauth_states enable row level security;

drop policy if exists "Tenant admins can read oauth states" on public.integration_oauth_states;
drop policy if exists "Tenant admins can create oauth states" on public.integration_oauth_states;

comment on table public.integration_oauth_states is
  'Short-lived provider OAuth state hashes. Trusted server code writes and consumes these with the service role after tenant authorization.';
