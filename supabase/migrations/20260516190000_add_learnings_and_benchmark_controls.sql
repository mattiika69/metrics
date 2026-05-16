alter table public.metric_benchmark_targets
  add column if not exists minimum_value numeric,
  add column if not exists notes text,
  add column if not exists updated_by_user_id uuid references auth.users(id) on delete set null;

create table if not exists public.metric_learnings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  source text not null default 'General',
  body text not null,
  source_provider text,
  source_channel text,
  external_message_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists metric_learnings_tenant_updated_idx
  on public.metric_learnings (tenant_id, archived_at, updated_at desc);

create index if not exists metric_learnings_tenant_source_idx
  on public.metric_learnings (tenant_id, source);

alter table public.metric_learnings enable row level security;

drop policy if exists "Tenant members can read metric learnings" on public.metric_learnings;
create policy "Tenant members can read metric learnings"
  on public.metric_learnings
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists "Tenant members can manage metric learnings" on public.metric_learnings;
create policy "Tenant members can manage metric learnings"
  on public.metric_learnings
  for all
  to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));
