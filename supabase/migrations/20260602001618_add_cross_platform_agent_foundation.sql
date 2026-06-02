alter table public.agent_approvals
  add column if not exists action_type text,
  add column if not exists target_type text,
  add column if not exists target_id text,
  add column if not exists action_payload jsonb not null default '{}'::jsonb,
  add column if not exists requested_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists decided_at timestamptz;

create index if not exists agent_approvals_action_idx
  on public.agent_approvals (tenant_id, status, action_type, created_at desc);

create table if not exists public.platform_installations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  platform text not null check (platform in ('web', 'slack', 'telegram')),
  tenant_integration_id uuid references public.tenant_integrations(id) on delete set null,
  external_workspace_id text,
  external_workspace_name text,
  external_bot_user_id text,
  installed_by_user_id uuid references auth.users(id) on delete set null,
  scopes text[] not null default '{}'::text[],
  status text not null default 'active',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists platform_installations_unique_idx
  on public.platform_installations (
    tenant_id,
    platform,
    coalesce(external_workspace_id, 'web')
  );

create index if not exists platform_installations_lookup_idx
  on public.platform_installations (platform, external_workspace_id, status);

create table if not exists public.platform_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  platform text not null check (platform in ('web', 'slack', 'telegram')),
  platform_installation_id uuid references public.platform_installations(id) on delete set null,
  external_workspace_id text,
  external_user_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  display_name text,
  status text not null default 'active',
  linked_at timestamptz not null default now(),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists platform_accounts_unique_idx
  on public.platform_accounts (
    tenant_id,
    platform,
    coalesce(external_workspace_id, 'web'),
    external_user_id
  );

create index if not exists platform_accounts_user_idx
  on public.platform_accounts (tenant_id, user_id, platform)
  where user_id is not null;

create table if not exists public.platform_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  platform text not null check (platform in ('web', 'slack', 'telegram')),
  platform_installation_id uuid references public.platform_installations(id) on delete set null,
  external_conversation_id text not null,
  external_thread_id text,
  conversation_type text not null default 'channel',
  title text,
  status text not null default 'active',
  linked_by_user_id uuid references auth.users(id) on delete set null,
  last_message_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists platform_conversations_unique_idx
  on public.platform_conversations (
    tenant_id,
    platform,
    external_conversation_id,
    coalesce(external_thread_id, '')
  );

create index if not exists platform_conversations_recent_idx
  on public.platform_conversations (tenant_id, platform, last_message_at desc);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  platform_conversation_id uuid references public.platform_conversations(id) on delete set null,
  agent_request_id uuid references public.agent_requests(id) on delete set null,
  platform text not null check (platform in ('web', 'slack', 'telegram')),
  direction text not null check (direction in ('inbound', 'outbound', 'tool')),
  actor_user_id uuid references auth.users(id) on delete set null,
  external_user_id text,
  external_message_id text,
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_messages_conversation_idx
  on public.agent_messages (tenant_id, platform_conversation_id, created_at desc);

create index if not exists agent_messages_request_idx
  on public.agent_messages (agent_request_id, created_at);

create table if not exists public.agent_memories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  source_platform text check (source_platform in ('web', 'slack', 'telegram')),
  title text not null,
  body text not null,
  memory_type text not null default 'preference',
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists agent_memories_tenant_idx
  on public.agent_memories (tenant_id, status, updated_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  platform text check (platform in ('web', 'slack', 'telegram')),
  action text not null,
  target_type text,
  target_id text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_tenant_created_idx
  on public.audit_logs (tenant_id, created_at desc);

create index if not exists audit_logs_actor_created_idx
  on public.audit_logs (actor_user_id, created_at desc);

create table if not exists public.capability_checks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  platform text not null check (platform in ('web', 'slack', 'telegram')),
  platform_account_id uuid references public.platform_accounts(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  capability text not null,
  allowed boolean not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists capability_checks_tenant_idx
  on public.capability_checks (tenant_id, platform, created_at desc);

alter table public.platform_installations enable row level security;
alter table public.platform_accounts enable row level security;
alter table public.platform_conversations enable row level security;
alter table public.agent_messages enable row level security;
alter table public.agent_memories enable row level security;
alter table public.audit_logs enable row level security;
alter table public.capability_checks enable row level security;

grant select, insert, update, delete on public.platform_installations to authenticated;
grant select, insert, update, delete on public.platform_accounts to authenticated;
grant select, insert, update, delete on public.platform_conversations to authenticated;
grant select, insert, update, delete on public.agent_messages to authenticated;
grant select, insert, update, delete on public.agent_memories to authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.capability_checks to authenticated;

create policy "Tenant admins can read platform installations"
  on public.platform_installations
  for select
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant admins can manage platform installations"
  on public.platform_installations
  for all
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant admins can read platform accounts"
  on public.platform_accounts
  for select
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant admins can manage platform accounts"
  on public.platform_accounts
  for all
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant admins can read platform conversations"
  on public.platform_conversations
  for select
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant members can read own platform conversations"
  on public.platform_conversations
  for select
  to authenticated
  using (
    public.is_tenant_member(tenant_id)
    and linked_by_user_id = auth.uid()
  );

create policy "Tenant admins can manage platform conversations"
  on public.platform_conversations
  for all
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant admins can read agent messages"
  on public.agent_messages
  for select
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant members can read own agent messages"
  on public.agent_messages
  for select
  to authenticated
  using (
    public.is_tenant_member(tenant_id)
    and (
      actor_user_id = auth.uid()
      or external_user_id = auth.uid()::text
      or exists (
        select 1
        from public.platform_conversations conversation
        where conversation.id = platform_conversation_id
          and conversation.tenant_id = agent_messages.tenant_id
          and conversation.linked_by_user_id = auth.uid()
      )
    )
  );

create policy "Tenant admins can read agent memories"
  on public.agent_memories
  for select
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant admins can manage agent memories"
  on public.agent_memories
  for all
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));

create policy "Tenant members can read audit logs"
  on public.audit_logs
  for select
  to authenticated
  using (
    (tenant_id is not null and public.is_tenant_member(tenant_id))
    or (tenant_id is null and actor_user_id = auth.uid())
  );

create policy "Tenant admins can read capability checks"
  on public.capability_checks
  for select
  to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'admin']::public.app_role[]));
