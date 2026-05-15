create type public.webhook_event_status as enum (
  'processing',
  'processed',
  'failed',
  'duplicate',
  'unmapped'
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  status public.webhook_event_status not null default 'processing',
  payload jsonb not null default '{}'::jsonb,
  error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_event_id)
);

create table public.rate_limit_buckets (
  route text not null,
  key_hash text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (route, key_hash, window_start)
);

create index audit_events_tenant_created_at_idx
  on public.audit_events (tenant_id, created_at desc);

create index audit_events_actor_created_at_idx
  on public.audit_events (actor_user_id, created_at desc);

create index webhook_events_tenant_created_at_idx
  on public.webhook_events (tenant_id, created_at desc);

create index webhook_events_provider_status_idx
  on public.webhook_events (provider, status, created_at desc);

alter table public.audit_events enable row level security;
alter table public.webhook_events enable row level security;
alter table public.rate_limit_buckets enable row level security;

create policy "Tenant members can read tenant audit events"
  on public.audit_events
  for select
  to authenticated
  using (
    tenant_id is not null
    and public.is_tenant_member(tenant_id)
  );

create policy "Users can read own user audit events"
  on public.audit_events
  for select
  to authenticated
  using (
    tenant_id is null
    and actor_user_id = auth.uid()
  );

create policy "Tenant members can read tenant webhook events"
  on public.webhook_events
  for select
  to authenticated
  using (
    tenant_id is not null
    and public.is_tenant_member(tenant_id)
  );

create or replace function public.increment_rate_limit(
  target_route text,
  target_key_hash text,
  max_requests integer,
  window_seconds integer
)
returns table (
  allowed boolean,
  current_count integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket_start timestamptz;
  bucket_count integer;
begin
  if max_requests < 1 then
    raise exception 'max_requests must be positive';
  end if;

  if window_seconds < 1 then
    raise exception 'window_seconds must be positive';
  end if;

  bucket_start :=
    to_timestamp(
      floor(extract(epoch from now()) / window_seconds) * window_seconds
    );

  insert into public.rate_limit_buckets (
    route,
    key_hash,
    window_start,
    count,
    updated_at
  )
  values (
    target_route,
    target_key_hash,
    bucket_start,
    1,
    now()
  )
  on conflict (route, key_hash, window_start)
  do update set
    count = public.rate_limit_buckets.count + 1,
    updated_at = now()
  returning count into bucket_count;

  return query
    select
      bucket_count <= max_requests,
      bucket_count,
      bucket_start + make_interval(secs => window_seconds);
end;
$$;

revoke execute on function public.increment_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;

grant execute on function public.increment_rate_limit(text, text, integer, integer)
  to service_role;
