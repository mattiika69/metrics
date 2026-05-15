create table public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  provider text not null default 'roezan',
  provider_message_id text,
  to_phone text not null,
  body text not null,
  status text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index sms_messages_tenant_created_at_idx
  on public.sms_messages (tenant_id, created_at desc);

alter table public.sms_messages enable row level security;

create policy "Tenant members can read sms messages"
  on public.sms_messages
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));
