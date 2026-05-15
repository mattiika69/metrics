create table public.ai_context_docs (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  content text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_context_docs enable row level security;

create policy "Tenant members can read AI context docs"
  on public.ai_context_docs
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

create policy "Tenant members can manage AI context docs"
  on public.ai_context_docs
  for all
  to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));
