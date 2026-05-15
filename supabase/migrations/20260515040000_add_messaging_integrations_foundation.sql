create type public.integration_provider as enum ('slack', 'telegram');
create type public.integration_status as enum ('active', 'disabled', 'error');
create type public.integration_message_direction as enum ('inbound', 'outbound');

create table public.tenant_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider public.integration_provider not null,
  status public.integration_status not null default 'active',
  external_team_id text,
  external_channel_id text,
  external_bot_id text,
  external_user_id text,
  display_name text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_team_id, external_channel_id)
);

create table public.integration_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  integration_id uuid references public.tenant_integrations(id) on delete set null,
  provider public.integration_provider not null,
  external_event_id text,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.integration_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  integration_id uuid references public.tenant_integrations(id) on delete set null,
  provider public.integration_provider not null,
  direction public.integration_message_direction not null,
  external_message_id text,
  external_channel_id text,
  external_user_id text,
  body text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index tenant_integrations_tenant_provider_idx
  on public.tenant_integrations (tenant_id, provider);

create index tenant_integrations_external_lookup_idx
  on public.tenant_integrations (provider, external_team_id, external_channel_id);

create index integration_events_tenant_provider_idx
  on public.integration_events (tenant_id, provider, created_at desc);

create index integration_messages_tenant_provider_idx
  on public.integration_messages (tenant_id, provider, created_at desc);

alter table public.tenant_integrations enable row level security;
alter table public.integration_events enable row level security;
alter table public.integration_messages enable row level security;

create policy "Tenant members can read integrations"
  on public.tenant_integrations
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can manage integrations"
  on public.tenant_integrations
  for all
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant members can read integration events"
  on public.integration_events
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant members can read integration messages"
  on public.integration_messages
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));
