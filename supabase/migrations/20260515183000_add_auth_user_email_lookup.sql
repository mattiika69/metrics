create or replace function public.find_auth_user_id_by_email(target_email text)
returns table(id uuid, email text)
language sql
security definer
set search_path = auth, public
as $$
  select users.id, users.email
  from auth.users
  where lower(users.email) = lower(target_email)
  order by users.created_at asc
  limit 1;
$$;

revoke all on function public.find_auth_user_id_by_email(text) from public;
revoke all on function public.find_auth_user_id_by_email(text) from anon;
revoke all on function public.find_auth_user_id_by_email(text) from authenticated;
grant execute on function public.find_auth_user_id_by_email(text) to service_role;
