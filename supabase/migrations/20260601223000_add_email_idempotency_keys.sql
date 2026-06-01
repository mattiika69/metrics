alter table public.email_messages
  add column if not exists idempotency_key text;

create unique index if not exists email_messages_tenant_idempotency_key_idx
  on public.email_messages (tenant_id, idempotency_key)
  where tenant_id is not null and idempotency_key is not null;

create unique index if not exists email_messages_system_idempotency_key_idx
  on public.email_messages (idempotency_key)
  where tenant_id is null and idempotency_key is not null;
