alter table public.email_messages
  alter column tenant_id drop not null;

create index if not exists email_messages_system_created_at_idx
  on public.email_messages (created_at desc)
  where tenant_id is null;
