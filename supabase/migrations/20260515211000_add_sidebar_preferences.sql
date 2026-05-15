create table public.tenant_sidebar_preferences (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

alter table public.tenant_sidebar_preferences enable row level security;

create policy "Tenant members can manage their sidebar preferences"
  on public.tenant_sidebar_preferences
  for all
  to authenticated
  using (
    user_id = auth.uid()
    and public.is_tenant_member(tenant_id)
  )
  with check (
    user_id = auth.uid()
    and public.is_tenant_member(tenant_id)
  );
