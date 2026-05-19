create or replace function public.accept_tenant_invitation(invitation_token text)
returns table (
  accepted_tenant_id uuid,
  invitation_id uuid,
  accepted_role public.app_role
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.tenant_invitations%rowtype;
  current_email text;
  current_email_confirmed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if nullif(trim(invitation_token), '') is null then
    raise exception 'Invitation token is required.';
  end if;

  select lower(email), email_confirmed_at
  into current_email, current_email_confirmed_at
  from auth.users
  where id = auth.uid();

  if current_email is null then
    raise exception 'Authenticated account email is required.';
  end if;

  if current_email_confirmed_at is null then
    raise exception 'Verify your email address before accepting this invitation.';
  end if;

  select *
  into invitation
  from public.tenant_invitations
  where token_hash = encode(extensions.digest(invitation_token, 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'Invitation not found.';
  end if;

  if invitation.status <> 'pending' then
    raise exception 'Invitation is no longer pending.';
  end if;

  if invitation.expires_at < now() then
    update public.tenant_invitations
    set
      status = 'expired',
      updated_at = now()
    where id = invitation.id;

    raise exception 'Invitation has expired.';
  end if;

  if invitation.email <> current_email then
    raise exception 'Invitation email does not match the signed-in account.';
  end if;

  insert into public.tenant_memberships (
    tenant_id,
    user_id,
    role
  )
  values (
    invitation.tenant_id,
    auth.uid(),
    invitation.role
  )
  on conflict (tenant_id, user_id) do update set
    role = case
      when public.tenant_memberships.role = 'owner'::public.app_role
        then public.tenant_memberships.role
      else excluded.role
    end,
    updated_at = now();

  update public.tenant_invitations
  set
    status = 'accepted',
    accepted_by_user_id = auth.uid(),
    accepted_at = now(),
    updated_at = now()
  where id = invitation.id
    and status = 'pending';

  return query
    select invitation.tenant_id, invitation.id, invitation.role;
end;
$$;

revoke execute on function public.accept_tenant_invitation(text)
  from public, anon;

grant execute on function public.accept_tenant_invitation(text)
  to authenticated;
