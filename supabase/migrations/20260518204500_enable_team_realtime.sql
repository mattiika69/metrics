alter table public.tenant_memberships replica identity full;
alter table public.tenant_invitations replica identity full;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'tenant_memberships'
    ) then
      alter publication supabase_realtime add table public.tenant_memberships;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'tenant_invitations'
    ) then
      alter publication supabase_realtime add table public.tenant_invitations;
    end if;
  end if;
end $$;
