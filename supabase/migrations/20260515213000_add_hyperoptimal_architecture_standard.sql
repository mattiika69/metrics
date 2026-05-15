alter table public.tenant_memberships
  add column if not exists updated_at timestamptz not null default now();

alter table public.tenant_invitations
  add column if not exists email_delivery_status text not null default 'pending',
  add column if not exists email_delivery_error text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by_user_id uuid references auth.users(id) on delete set null;

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_log_tenant_created_idx
  on public.admin_audit_log (tenant_id, created_at desc);

create index admin_audit_log_actor_created_idx
  on public.admin_audit_log (actor_user_id, created_at desc);

create table public.billing_subscription_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  billing_subscription_id uuid references public.billing_subscriptions(id) on delete cascade,
  stripe_subscription_item_id text not null unique,
  stripe_subscription_id text not null,
  stripe_product_id text,
  stripe_price_id text,
  quantity integer not null default 1,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index billing_subscription_items_tenant_idx
  on public.billing_subscription_items (tenant_id, created_at desc);

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  stripe_event_id text not null unique,
  event_type text not null,
  status text not null default 'processed',
  payload jsonb not null default '{}'::jsonb,
  error text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index billing_events_tenant_created_idx
  on public.billing_events (tenant_id, created_at desc);

create table public.billing_usage_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  billing_subscription_item_id uuid references public.billing_subscription_items(id) on delete set null,
  usage_key text not null,
  quantity numeric not null default 0,
  period_start timestamptz not null,
  period_end timestamptz not null,
  stripe_usage_record_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, usage_key, period_start, period_end)
);

create index billing_usage_records_tenant_period_idx
  on public.billing_usage_records (tenant_id, period_start desc, period_end desc);

create table public.slack_installations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  tenant_integration_id uuid references public.tenant_integrations(id) on delete set null,
  slack_team_id text not null,
  slack_team_name text,
  slack_bot_user_id text,
  slack_app_id text,
  status text not null default 'active',
  settings jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slack_team_id)
);

create index slack_installations_team_idx
  on public.slack_installations (slack_team_id);

create table public.slack_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slack_team_id text not null,
  slack_user_id text,
  slack_channel_id text,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'active',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slack_team_id, slack_user_id, slack_channel_id)
);

create table public.telegram_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  telegram_chat_id text not null,
  telegram_user_id text,
  display_name text,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'active',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, telegram_chat_id)
);

create index telegram_links_chat_idx
  on public.telegram_links (telegram_chat_id);

create table public.integration_inbound_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received',
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, external_event_id)
);

create index integration_inbound_events_tenant_idx
  on public.integration_inbound_events (tenant_id, created_at desc);

create table public.integration_outbound_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  target_id text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  provider_message_id text,
  status text not null default 'queued',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index integration_outbound_messages_tenant_idx
  on public.integration_outbound_messages (tenant_id, created_at desc);

create table public.integration_processed_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  provider text not null,
  external_event_id text not null,
  processed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (provider, external_event_id)
);

create table public.integration_command_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  external_session_id text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  channel_id text,
  status text not null default 'active',
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_session_id)
);

create table public.integration_secrets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  secret_name text not null,
  secret_ciphertext jsonb not null,
  key_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider, secret_name)
);

create table public.integration_channel_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  external_channel_id text not null,
  display_name text,
  linked_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider, external_channel_id)
);

create table public.integration_routing_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_provider text not null,
  source_channel_id text not null,
  target_provider text not null,
  target_channel_id text not null,
  active boolean not null default true,
  prevent_loops boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.integration_delivery_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  external_channel_id text,
  enabled boolean not null default true,
  quiet_hours jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider, external_channel_id)
);

create table public.integration_workflow_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  workflow_key text not null,
  target_providers text[] not null default '{}'::text[],
  slack_channel_id text,
  telegram_chat_id text,
  cadence text not null default 'weekly',
  cron_expression text,
  timezone text not null default 'America/New_York',
  message_template text,
  enabled boolean not null default true,
  archived_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index integration_workflow_schedules_tenant_idx
  on public.integration_workflow_schedules (tenant_id, created_at desc);

create table public.integration_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  schedule_id uuid references public.integration_workflow_schedules(id) on delete set null,
  status text not null default 'queued',
  target_provider text,
  target_channel_id text,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  output_metadata jsonb not null default '{}'::jsonb,
  provider_delivery_ids jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create index integration_workflow_runs_tenant_idx
  on public.integration_workflow_runs (tenant_id, created_at desc);

create table public.integration_workflow_run_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  run_id uuid not null references public.integration_workflow_runs(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index integration_workflow_run_events_run_idx
  on public.integration_workflow_run_events (run_id, created_at desc);

create table public.agent_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  provider text,
  channel_id text,
  request_text text not null,
  status text not null default 'requested',
  risk_level text not null default 'normal',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent_request_id uuid references public.agent_requests(id) on delete cascade,
  action_type text not null,
  status text not null default 'queued',
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent_request_id uuid references public.agent_requests(id) on delete cascade,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending',
  decision_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_code_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent_request_id uuid references public.agent_requests(id) on delete set null,
  github_repo text not null default 'mattiika69/metrics',
  branch_name text,
  commit_sha text,
  pull_request_url text,
  status text not null default 'queued',
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_deployments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent_request_id uuid references public.agent_requests(id) on delete set null,
  github_commit_sha text,
  vercel_deployment_id text,
  deployment_url text,
  status text not null default 'queued',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_tool_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent_request_id uuid references public.agent_requests(id) on delete set null,
  tool_name text not null,
  status text not null default 'queued',
  input_metadata jsonb not null default '{}'::jsonb,
  output_metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;
alter table public.billing_subscription_items enable row level security;
alter table public.billing_events enable row level security;
alter table public.billing_usage_records enable row level security;
alter table public.slack_installations enable row level security;
alter table public.slack_links enable row level security;
alter table public.telegram_links enable row level security;
alter table public.integration_inbound_events enable row level security;
alter table public.integration_outbound_messages enable row level security;
alter table public.integration_processed_events enable row level security;
alter table public.integration_command_sessions enable row level security;
alter table public.integration_secrets enable row level security;
alter table public.integration_channel_links enable row level security;
alter table public.integration_routing_rules enable row level security;
alter table public.integration_delivery_preferences enable row level security;
alter table public.integration_workflow_schedules enable row level security;
alter table public.integration_workflow_runs enable row level security;
alter table public.integration_workflow_run_events enable row level security;
alter table public.agent_requests enable row level security;
alter table public.agent_actions enable row level security;
alter table public.agent_approvals enable row level security;
alter table public.agent_code_tasks enable row level security;
alter table public.agent_deployments enable row level security;
alter table public.agent_tool_runs enable row level security;

create policy "Tenant members can read admin audit log"
  on public.admin_audit_log
  for select
  to authenticated
  using (
    (tenant_id is not null and public.is_tenant_member(tenant_id))
    or (tenant_id is null and actor_user_id = auth.uid())
  );

create policy "Tenant members can read billing subscription items"
  on public.billing_subscription_items
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant members can read billing events"
  on public.billing_events
  for select
  to authenticated
  using (tenant_id is not null and public.is_tenant_member(tenant_id));

create policy "Tenant members can read billing usage records"
  on public.billing_usage_records
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant members can read slack installations"
  on public.slack_installations
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can manage slack installations"
  on public.slack_installations
  for all
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant members can read slack links"
  on public.slack_links
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can manage slack links"
  on public.slack_links
  for all
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant members can read telegram links"
  on public.telegram_links
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can manage telegram links"
  on public.telegram_links
  for all
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant members can read integration inbound events"
  on public.integration_inbound_events
  for select
  to authenticated
  using (tenant_id is not null and public.is_tenant_member(tenant_id));

create policy "Tenant members can read integration outbound messages"
  on public.integration_outbound_messages
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant members can read integration processed events"
  on public.integration_processed_events
  for select
  to authenticated
  using (tenant_id is not null and public.is_tenant_member(tenant_id));

create policy "Tenant members can read integration command sessions"
  on public.integration_command_sessions
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can manage integration command sessions"
  on public.integration_command_sessions
  for all
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant members can read integration channel links"
  on public.integration_channel_links
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can manage integration channel links"
  on public.integration_channel_links
  for all
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant members can read integration routing rules"
  on public.integration_routing_rules
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can manage integration routing rules"
  on public.integration_routing_rules
  for all
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant members can read integration delivery preferences"
  on public.integration_delivery_preferences
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can manage integration delivery preferences"
  on public.integration_delivery_preferences
  for all
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant members can read workflow schedules"
  on public.integration_workflow_schedules
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can manage workflow schedules"
  on public.integration_workflow_schedules
  for all
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant members can read workflow runs"
  on public.integration_workflow_runs
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant members can read workflow run events"
  on public.integration_workflow_run_events
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can read agent requests"
  on public.agent_requests
  for select
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant admins can create agent requests"
  on public.agent_requests
  for insert
  to authenticated
  with check (
    requested_by_user_id = auth.uid()
    and public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[])
  );

create policy "Tenant admins can update agent requests"
  on public.agent_requests
  for update
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant admins can read agent actions"
  on public.agent_actions
  for select
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant admins can read agent approvals"
  on public.agent_approvals
  for select
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant admins can manage agent approvals"
  on public.agent_approvals
  for all
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant admins can read agent code tasks"
  on public.agent_code_tasks
  for select
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant admins can read agent deployments"
  on public.agent_deployments
  for select
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant admins can read agent tool runs"
  on public.agent_tool_runs
  for select
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));
