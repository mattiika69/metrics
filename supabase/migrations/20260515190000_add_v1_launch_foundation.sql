create table public.tenant_business_profiles (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  business_type text not null default 'service',
  offer_model text not null default 'high_ticket',
  stage text not null default 'mvp',
  revenue_band text not null default 'unknown',
  team_size integer,
  timezone text not null default 'America/New_York',
  benchmark_opt_in boolean not null default false,
  onboarding_completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_metric_selections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  view_key text not null,
  metric_id text not null references public.metric_definitions(id) on delete cascade,
  display_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, view_key, metric_id)
);

create table public.metric_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requested_metric text not null,
  context text,
  source text not null default 'web',
  status text not null default 'requested',
  requested_by uuid references auth.users(id) on delete set null,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.metric_recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  period_key text not null default '30d',
  recommendation_type text not null default 'constraints',
  title text not null,
  body text not null,
  constraints jsonb not null default '[]'::jsonb,
  source_metrics jsonb not null default '{}'::jsonb,
  model text,
  generated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.metric_forecast_models (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null default 'Default forecast',
  period_key text not null default '30d',
  assumptions jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.metric_sync_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  status text not null default 'started',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  rows_read integer not null default 0,
  rows_written integer not null default 0,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null
);

create table public.benchmark_cohorts (
  id text primary key,
  name text not null,
  business_type text not null,
  stage text not null,
  revenue_band text not null default 'any',
  source text not null default 'curated',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.benchmark_cohort_targets (
  id uuid primary key default gen_random_uuid(),
  cohort_id text not null references public.benchmark_cohorts(id) on delete cascade,
  metric_id text not null references public.metric_definitions(id) on delete cascade,
  minimum_value numeric,
  target_value numeric not null,
  scale_value numeric,
  source text not null default 'curated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cohort_id, metric_id)
);

create index tenant_metric_selections_tenant_view_idx
  on public.tenant_metric_selections (tenant_id, view_key, display_order);

create index metric_requests_tenant_status_idx
  on public.metric_requests (tenant_id, status, created_at desc);

create index metric_recommendations_tenant_created_idx
  on public.metric_recommendations (tenant_id, created_at desc);

create index metric_forecast_models_tenant_active_idx
  on public.metric_forecast_models (tenant_id, active, updated_at desc);

create index metric_sync_runs_tenant_provider_idx
  on public.metric_sync_runs (tenant_id, provider, started_at desc);

alter table public.tenant_business_profiles enable row level security;
alter table public.tenant_metric_selections enable row level security;
alter table public.metric_requests enable row level security;
alter table public.metric_recommendations enable row level security;
alter table public.metric_forecast_models enable row level security;
alter table public.metric_sync_runs enable row level security;
alter table public.benchmark_cohorts enable row level security;
alter table public.benchmark_cohort_targets enable row level security;

create policy "Tenant members can manage business profiles"
  on public.tenant_business_profiles
  for all
  to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy "Tenant members can manage metric selections"
  on public.tenant_metric_selections
  for all
  to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy "Tenant members can manage metric requests"
  on public.metric_requests
  for all
  to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy "Tenant members can read recommendations"
  on public.metric_recommendations
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant members can manage forecast models"
  on public.metric_forecast_models
  for all
  to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy "Tenant members can read sync runs"
  on public.metric_sync_runs
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Authenticated users can read benchmark cohorts"
  on public.benchmark_cohorts
  for select
  to authenticated
  using (active = true);

create policy "Authenticated users can read benchmark cohort targets"
  on public.benchmark_cohort_targets
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.benchmark_cohorts c
      where c.id = benchmark_cohort_targets.cohort_id
      and c.active = true
    )
  );

insert into public.benchmark_cohorts (id, name, business_type, stage, revenue_band, source) values
  ('service-mvp', 'Service Business MVP', 'service', 'mvp', 'any', 'curated'),
  ('high-ticket-growth', 'High-Ticket Growth', 'service', 'growth', 'any', 'curated'),
  ('subscription-growth', 'Subscription Growth', 'subscription', 'growth', 'any', 'curated')
on conflict (id) do update set
  name = excluded.name,
  business_type = excluded.business_type,
  stage = excluded.stage,
  revenue_band = excluded.revenue_band,
  source = excluded.source,
  active = true,
  updated_at = now();

insert into public.benchmark_cohort_targets (cohort_id, metric_id, minimum_value, target_value, scale_value, source) values
  ('service-mvp', 'call_show_rate', 65, 80, 90, 'curated'),
  ('service-mvp', 'call_close_rate', 20, 30, 40, 'curated'),
  ('service-mvp', 'cac', 3000, 2000, 1200, 'curated'),
  ('service-mvp', 'net_margin', 15, 30, 45, 'curated'),
  ('service-mvp', 'churn', 8, 5, 3, 'curated'),
  ('high-ticket-growth', 'call_show_rate', 70, 85, 92, 'curated'),
  ('high-ticket-growth', 'call_close_rate', 25, 35, 45, 'curated'),
  ('high-ticket-growth', 'revenue_ltv', 8000, 15000, 30000, 'curated'),
  ('high-ticket-growth', 'ltv_cac', 1.5, 3, 5, 'curated'),
  ('high-ticket-growth', 'payback', 6, 3, 1.5, 'curated'),
  ('subscription-growth', 'mrr', 10000, 50000, 200000, 'curated'),
  ('subscription-growth', 'nrr', 95, 110, 130, 'curated'),
  ('subscription-growth', 'churn', 8, 5, 3, 'curated'),
  ('subscription-growth', 'gross_margin', 60, 75, 85, 'curated')
on conflict (cohort_id, metric_id) do update set
  minimum_value = excluded.minimum_value,
  target_value = excluded.target_value,
  scale_value = excluded.scale_value,
  source = excluded.source,
  updated_at = now();
