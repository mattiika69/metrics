create table public.billing_customers (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  stripe_price_id text,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index billing_subscriptions_tenant_id_idx
  on public.billing_subscriptions (tenant_id);

create index billing_subscriptions_status_idx
  on public.billing_subscriptions (status);

alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;

create policy "Tenant members can read billing customers"
  on public.billing_customers
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant members can read billing subscriptions"
  on public.billing_subscriptions
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));
