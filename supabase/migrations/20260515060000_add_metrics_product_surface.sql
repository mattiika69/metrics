create table public.metric_definitions (
  id text primary key,
  name text not null,
  category text not null,
  format text not null,
  formula text not null,
  formula_type text not null default 'raw',
  dependencies text[] not null default '{}',
  source_description text,
  is_inverse boolean not null default false,
  display_order integer not null default 999,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  metric_id text not null references public.metric_definitions(id) on delete cascade,
  period_key text not null,
  period_start date not null,
  period_end date not null,
  value numeric,
  raw_inputs jsonb not null default '{}'::jsonb,
  sources jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  is_stale boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, metric_id, period_key, period_start, period_end)
);

create table public.metric_overrides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  metric_id text not null references public.metric_definitions(id) on delete cascade,
  period_key text not null,
  period_end date not null,
  override_value numeric not null,
  original_value numeric,
  reason text,
  overridden_by uuid not null references auth.users(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.metric_benchmark_targets (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  benchmark_id text not null,
  target_value numeric not null,
  show_percent_diff boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, benchmark_id)
);

create table public.metric_principles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  description text not null,
  video_url text,
  links jsonb not null default '[]'::jsonb,
  display_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.metric_quality_checklists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  week_start_date date not null,
  items jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, week_start_date)
);

create table public.normalized_payments (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source text not null,
  source_id text not null,
  customer_email text,
  customer_name text,
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null,
  payment_date timestamptz not null,
  description text,
  is_subscription boolean not null default false,
  refunded_amount_cents integer not null default 0,
  provider_customer_id text,
  provider_subscription_id text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source, source_id)
);

create table public.client_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  name text,
  excluded boolean not null default false,
  first_payment_date date,
  call_booked_date date,
  churn_date date,
  status_start text not null default 'active',
  status_end text not null default 'active',
  retainer_price_cents integer,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table public.bank_transactions (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source text not null,
  transaction_id text not null,
  amount numeric not null,
  direction text not null,
  transaction_date date not null,
  name text,
  category text,
  cost_type text,
  is_acquisition boolean not null default false,
  is_waste boolean not null default false,
  is_recurring boolean not null default false,
  is_new_client_revenue boolean not null default false,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source, transaction_id)
);

create table public.sales_events (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source text not null,
  source_id text not null,
  event_date timestamptz not null,
  contact_email text,
  contact_name text,
  status text not null default 'booked',
  is_qualified boolean not null default true,
  offer_sent boolean not null default false,
  closer text,
  channel text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source, source_id)
);

create table public.form_leads (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source text not null,
  source_id text not null,
  submitted_at timestamptz not null,
  name text,
  email text,
  phone text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source, source_id)
);

create table public.call_recordings (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source text not null,
  source_id text not null,
  recorded_at timestamptz not null,
  title text,
  summary text,
  recording_url text,
  contact_email text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source, source_id)
);

create table public.social_posts (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source text not null,
  source_id text not null,
  posted_at timestamptz not null,
  content text,
  views integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source, source_id)
);

create table public.metric_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  status text not null default 'not_connected',
  display_name text,
  external_account_id text,
  settings jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_event_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider)
);

create table public.metric_integration_secrets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  metric_integration_id uuid references public.metric_integrations(id) on delete cascade,
  tenant_integration_id uuid references public.tenant_integrations(id) on delete cascade,
  provider text not null,
  secret_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (metric_integration_id is not null or tenant_integration_id is not null)
);

create table public.telegram_link_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_chat_id text,
  created_at timestamptz not null default now()
);

create index metric_snapshots_tenant_period_idx
  on public.metric_snapshots (tenant_id, period_key, period_end desc);

create index metric_overrides_tenant_period_idx
  on public.metric_overrides (tenant_id, period_key, period_end desc);

create index metric_principles_tenant_order_idx
  on public.metric_principles (tenant_id, display_order);

create index normalized_payments_tenant_date_idx
  on public.normalized_payments (tenant_id, payment_date desc);

create index bank_transactions_tenant_date_idx
  on public.bank_transactions (tenant_id, transaction_date desc);

create index sales_events_tenant_date_idx
  on public.sales_events (tenant_id, event_date desc);

create index metric_integrations_tenant_provider_idx
  on public.metric_integrations (tenant_id, provider);

create index telegram_link_codes_tenant_created_idx
  on public.telegram_link_codes (tenant_id, created_at desc);

alter table public.metric_definitions enable row level security;
alter table public.metric_snapshots enable row level security;
alter table public.metric_overrides enable row level security;
alter table public.metric_benchmark_targets enable row level security;
alter table public.metric_principles enable row level security;
alter table public.metric_quality_checklists enable row level security;
alter table public.normalized_payments enable row level security;
alter table public.client_records enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.sales_events enable row level security;
alter table public.form_leads enable row level security;
alter table public.call_recordings enable row level security;
alter table public.social_posts enable row level security;
alter table public.metric_integrations enable row level security;
alter table public.metric_integration_secrets enable row level security;
alter table public.telegram_link_codes enable row level security;

create policy "Authenticated users can read metric definitions"
  on public.metric_definitions
  for select
  to authenticated
  using (true);

create policy "Tenant members can read metric snapshots"
  on public.metric_snapshots
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant members can read metric overrides"
  on public.metric_overrides
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant members can manage benchmark targets"
  on public.metric_benchmark_targets
  for all
  to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy "Tenant members can manage metric principles"
  on public.metric_principles
  for all
  to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy "Tenant members can manage metric quality checklists"
  on public.metric_quality_checklists
  for all
  to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy "Tenant members can read normalized payments"
  on public.normalized_payments
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant members can read client records"
  on public.client_records
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant members can read bank transactions"
  on public.bank_transactions
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant members can read sales events"
  on public.sales_events
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant members can read form leads"
  on public.form_leads
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant members can read call recordings"
  on public.call_recordings
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant members can read social posts"
  on public.social_posts
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant members can read metric integrations"
  on public.metric_integrations
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can manage metric integrations"
  on public.metric_integrations
  for all
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant members can read telegram link codes"
  on public.telegram_link_codes
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can create telegram link codes"
  on public.telegram_link_codes
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[])
  );

insert into public.metric_definitions (
  id,
  name,
  category,
  format,
  formula,
  formula_type,
  dependencies,
  source_description,
  is_inverse,
  display_order
) values
  ('mrr', 'MRR', 'revenue', 'currency', 'Current active subscription monthly recurring revenue from connected payment processors.', 'raw', '{}', 'Stripe, Whop, Fanbasis subscription payments', false, 1),
  ('arr', 'ARR', 'revenue', 'currency', 'ARR = current MRR x 12.', 'derived', '{mrr}', 'Derived from MRR', false, 2),
  ('revenue', 'Revenue', 'revenue', 'currency', 'Successful processor payments plus revenue-qualified bank inflows in the period.', 'raw', '{}', 'Payments and bank transactions', false, 3),
  ('new_client_revenue', 'New Client Revenue', 'revenue', 'currency', 'Revenue from clients whose first payment date falls in the period.', 'derived', '{new_clients,revenue}', 'Client records and payments', false, 4),
  ('recurring_revenue', 'Recurring Revenue', 'revenue', 'currency', 'Subscription and recurring-tagged revenue in the period.', 'derived', '{revenue}', 'Payments and recurring bank inflows', false, 5),
  ('cash_in', 'Cash In', 'cash', 'currency', 'Sum of inbound bank transactions in the period.', 'raw', '{}', 'Plaid or CSV Banking', false, 6),
  ('cash_out', 'Cash Out', 'cash', 'currency', 'Sum of outbound bank transactions in the period.', 'raw', '{}', 'Plaid or CSV Banking', true, 7),
  ('net_cash_flow', 'Net Cash Flow', 'cash', 'currency', 'Net Cash Flow = Cash In - Cash Out.', 'derived', '{cash_in,cash_out}', 'Bank transactions', false, 8),
  ('cash_margin', 'Cash Margin', 'cash', 'percent', 'Cash Margin = Net Cash Flow / Cash In x 100.', 'derived', '{net_cash_flow,cash_in}', 'Bank transactions', false, 9),
  ('expenses', 'Expenses', 'costs', 'currency', 'Sum of outbound expense transactions in the period.', 'raw', '{}', 'Plaid or CSV Banking', true, 10),
  ('net_profit', 'Net Profit', 'revenue', 'currency', 'Net Profit = Revenue - Expenses.', 'derived', '{revenue,expenses}', 'Revenue and expense sources', false, 11),
  ('net_margin', 'Net Margin', 'revenue', 'percent', 'Net Margin = Net Profit / Revenue x 100.', 'derived', '{net_profit,revenue}', 'Derived from net profit and revenue', false, 12),
  ('gross_margin', 'Gross Margin', 'revenue', 'percent', 'Gross Margin = (Revenue - Fulfillment Costs) / Revenue x 100.', 'derived', '{revenue,fulfillment_costs}', 'Revenue and fulfillment costs', false, 13),
  ('fixed_costs', 'Fixed Costs', 'costs', 'currency', 'Sum of expense transactions mapped to fixed costs.', 'raw', '{}', 'Bank transaction cost mappings', true, 20),
  ('variable_costs', 'Variable Costs', 'costs', 'currency', 'Sum of expense transactions mapped to variable costs.', 'raw', '{}', 'Bank transaction cost mappings', true, 21),
  ('fulfillment_costs', 'Fulfillment Costs', 'costs', 'currency', 'Sum of expense transactions mapped to fulfillment.', 'raw', '{}', 'Bank transaction category mappings', true, 22),
  ('wasted_money', 'Wasted Money', 'costs', 'currency', 'Sum of expense transactions tagged as waste.', 'raw', '{}', 'Bank transaction waste mappings', true, 23),
  ('acquisition_costs', 'Acquisition Costs', 'costs', 'currency', 'Sum of expense transactions tagged as acquisition spend.', 'raw', '{}', 'Bank transaction acquisition mappings', true, 24),
  ('cac', 'CAC', 'costs', 'currency', 'CAC = acquisition spend / new clients.', 'derived', '{acquisition_costs,new_clients}', 'Acquisition spend and new clients', true, 25),
  ('cost_per_call', 'Cost Per Call', 'costs', 'currency', 'Cost Per Call = acquisition spend / calls booked.', 'derived', '{acquisition_costs,calls_booked}', 'Acquisition spend and sales calls', true, 26),
  ('bank_balance', 'Bank Balance', 'cash', 'currency', 'Latest available connected account balance or net tracked cash.', 'raw', '{}', 'Bank integrations', false, 27),
  ('runway', 'Runway', 'cash', 'months', 'Runway = Bank Balance / average monthly expenses.', 'derived', '{bank_balance,expenses}', 'Bank balance and expenses', false, 28),
  ('active_clients', 'Active Clients', 'clients', 'number', 'Count of clients active at the end of the period.', 'raw', '{}', 'Client records and payment subscriptions', false, 30),
  ('churned_clients', 'Churned Clients', 'clients', 'number', 'Count of clients marked churned in the period.', 'raw', '{}', 'Client records', true, 31),
  ('new_clients', 'New Clients', 'clients', 'number', 'Count of clients whose first payment falls in the period.', 'raw', '{}', 'Client records and payments', false, 32),
  ('churn', 'Churn Rate', 'clients', 'percent', 'Churn = churned clients / active clients at period start x 100.', 'derived', '{churned_clients,active_clients}', 'Client records', true, 33),
  ('nrr', 'NRR', 'clients', 'percent', 'Net revenue retention for the selected cohort.', 'derived', '{mrr}', 'Payment processor subscription data', false, 34),
  ('avg_relationship', 'Average Client Relationship', 'clients', 'months', 'Average relationship = 100 / monthly churn rate.', 'derived', '{churn}', 'Derived from churn rate', false, 35),
  ('median_payment', 'Median Payment', 'performance', 'currency', 'Median successful payment amount in the period.', 'raw', '{}', 'Payment processors', false, 36),
  ('monthly_client_payment', 'Monthly Client Payment', 'performance', 'currency', 'Monthly Client Payment = Recurring Revenue / Active Clients.', 'derived', '{recurring_revenue,active_clients}', 'Recurring revenue and active clients', false, 37),
  ('revenue_ltv', 'Revenue LTV', 'performance', 'currency', 'Revenue LTV = Monthly Client Payment x Average Relationship.', 'derived', '{monthly_client_payment,avg_relationship}', 'Derived from payment and churn metrics', false, 38),
  ('gross_margin_ltv', 'Gross Margin LTV', 'performance', 'currency', 'Gross Margin LTV = Revenue LTV x Gross Margin.', 'derived', '{revenue_ltv,gross_margin}', 'Derived LTV metric', false, 39),
  ('net_margin_ltv', 'Net Margin LTV', 'performance', 'currency', 'Net Margin LTV = Revenue LTV x Net Margin.', 'derived', '{revenue_ltv,net_margin}', 'Derived LTV metric', false, 40),
  ('ltv_cac', 'Revenue LTV:CAC', 'performance', 'ratio', 'Revenue LTV:CAC = Revenue LTV / CAC.', 'derived', '{revenue_ltv,cac}', 'Derived ratio', false, 41),
  ('gross_ltv_cac', 'Gross LTV:CAC', 'performance', 'ratio', 'Gross LTV:CAC = Gross Margin LTV / CAC.', 'derived', '{gross_margin_ltv,cac}', 'Derived ratio', false, 42),
  ('net_ltv_cac', 'Net LTV:CAC', 'performance', 'ratio', 'Net LTV:CAC = Net Margin LTV / CAC.', 'derived', '{net_margin_ltv,cac}', 'Derived ratio', false, 43),
  ('payback', 'Payback Period', 'performance', 'months', 'Payback = CAC / monthly gross profit per client.', 'derived', '{cac,monthly_client_payment,gross_margin}', 'Derived payback metric', true, 44),
  ('revenue_per_employee', 'Revenue Per Employee', 'performance', 'currency', 'Revenue per employee = Revenue / tenant team members.', 'derived', '{revenue}', 'Revenue and tenant membership count', false, 45),
  ('calls_booked', 'Calls Booked', 'sales', 'number', 'Count of sales calls booked in the period.', 'raw', '{}', 'Calendly, Cal.com, iClosed', false, 50),
  ('calls_shown', 'Calls Shown', 'sales', 'number', 'Count of sales calls that showed in the period.', 'raw', '{}', 'Sales call integrations', false, 51),
  ('calls_closed', 'Calls Closed', 'sales', 'number', 'Count of sales calls closed in the period.', 'raw', '{}', 'Sales call integrations', false, 52),
  ('calls_unqualified', 'Calls Unqualified', 'sales', 'number', 'Count of shown calls marked unqualified.', 'raw', '{}', 'Sales call integrations', true, 53),
  ('qualified_calls', 'Qualified Calls', 'sales', 'number', 'Qualified Calls = Calls Shown - Calls Unqualified.', 'derived', '{calls_shown,calls_unqualified}', 'Sales call outcomes', false, 54),
  ('offers_sent', 'Offers Sent', 'sales', 'number', 'Count of sales calls where an offer was sent.', 'raw', '{}', 'Sales call outcomes', false, 55),
  ('call_show_rate', 'Meeting Show Rate', 'sales', 'percent', 'Show Rate = Calls Shown / Calls Booked x 100.', 'derived', '{calls_shown,calls_booked}', 'Sales call outcomes', false, 56),
  ('call_close_rate', 'Close Rate', 'sales', 'percent', 'Close Rate = Calls Closed / Calls Booked x 100.', 'derived', '{calls_closed,calls_booked}', 'Sales call outcomes', false, 57),
  ('no_show_rate', 'No-Show Rate', 'sales', 'percent', 'No-Show Rate = missed calls / calls booked x 100.', 'derived', '{calls_booked,calls_shown}', 'Sales call outcomes', true, 58),
  ('call_offer_rate', 'Offer Rate', 'sales', 'percent', 'Offer Rate = Offers Sent / Calls Shown x 100.', 'derived', '{offers_sent,calls_shown}', 'Sales call outcomes', false, 59),
  ('call_unqualified_rate', 'Unqualified Rate', 'sales', 'percent', 'Unqualified Rate = Calls Unqualified / Calls Shown x 100.', 'derived', '{calls_unqualified,calls_shown}', 'Sales call outcomes', true, 60),
  ('sales_cycle', 'Sales Cycle', 'sales', 'days', 'Average days from booked call to first payment for new clients.', 'derived', '{calls_booked,new_clients}', 'Sales calls and client payments', true, 61)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  format = excluded.format,
  formula = excluded.formula,
  formula_type = excluded.formula_type,
  dependencies = excluded.dependencies,
  source_description = excluded.source_description,
  is_inverse = excluded.is_inverse,
  display_order = excluded.display_order,
  updated_at = now();
