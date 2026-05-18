create or replace function private.clair_get_pending_workspace_invitation(
  p_workspace_id text,
  p_invitation_id uuid
)
returns public.workspace_invitations
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_invitation public.workspace_invitations%rowtype;
begin
  select *
  into v_invitation
  from public.workspace_invitations
  where id = p_invitation_id
    and workspace_id = p_workspace_id;

  if v_invitation.id is null then
    raise exception 'target_invitation_missing';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'invitation_not_pending';
  end if;

  if v_invitation.expires_at is not null and v_invitation.expires_at <= now() then
    update public.workspace_invitations
    set status = 'expired',
        updated_at = now()
    where id = v_invitation.id;

    raise exception 'invitation_not_pending';
  end if;

  return v_invitation;
end;
$$;

create or replace function private.clair_workspace_invitation_lifecycle_json(
  p_invitation public.workspace_invitations,
  p_membership public.user_memberships default null
)
returns jsonb
language sql
stable
set search_path = public, private, extensions
as $$
  select jsonb_build_object(
    'status', p_invitation.status,
    'resentAt', p_invitation.resent_at,
    'resendCount', p_invitation.resend_count,
    'canceledAt', p_invitation.canceled_at,
    'acceptedAt', p_invitation.accepted_at,
    'membership',
      case
        when p_membership.id is null then null
        else jsonb_build_object(
          'id', p_membership.id::text,
          'workspaceId', p_membership.workspace_id,
          'userSessionId', p_membership.user_id::text,
          'roles', to_jsonb(p_membership.roles),
          'status', p_membership.status,
          'title', p_membership.title,
          'department', p_membership.department,
          'createdAt', p_membership.created_at,
          'activatedAt', p_membership.activated_at,
          'deactivatedAt', p_membership.deactivated_at
        )
      end
  );
$$;

create or replace function public.clair_resend_workspace_invitation(
  p_workspace_id text,
  p_invitation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_invitation public.workspace_invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'role_permission:manage required';
  end if;

  v_invitation := private.clair_get_pending_workspace_invitation(p_workspace_id, p_invitation_id);

  update public.workspace_invitations
  set resent_at = now(),
      resend_count = resend_count + 1,
      expires_at = now() + interval '7 days',
      updated_at = now()
  where id = v_invitation.id
  returning * into v_invitation;

  return private.clair_workspace_invitation_lifecycle_json(v_invitation);
end;
$$;

create or replace function public.clair_cancel_workspace_invitation(
  p_workspace_id text,
  p_invitation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_invitation public.workspace_invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'role_permission:manage required';
  end if;

  v_invitation := private.clair_get_pending_workspace_invitation(p_workspace_id, p_invitation_id);

  update public.workspace_invitations
  set status = 'canceled',
      canceled_at = now(),
      updated_at = now()
  where id = v_invitation.id
  returning * into v_invitation;

  return private.clair_workspace_invitation_lifecycle_json(v_invitation);
end;
$$;

create or replace function public.clair_accept_workspace_invitation(
  p_workspace_id text,
  p_invitation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_email extensions.citext;
  v_invitation public.workspace_invitations%rowtype;
  v_membership public.user_memberships%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'unauthenticated';
  end if;

  v_invitation := private.clair_get_pending_workspace_invitation(p_workspace_id, p_invitation_id);

  select email
  into v_actor_email
  from public.users
  where id = v_actor_user_id;

  if v_actor_email is null then
    raise exception 'unauthenticated';
  end if;

  if v_actor_email <> v_invitation.email then
    raise exception 'target_invitation_missing';
  end if;

  if exists (
    select 1
    from public.user_memberships
    where workspace_id = p_workspace_id
      and user_id = v_actor_user_id
      and status = 'active'
  ) then
    raise exception 'active_membership_exists';
  end if;

  insert into public.user_memberships (
    workspace_id,
    user_id,
    roles,
    status,
    title,
    department,
    activated_at
  )
  values (
    p_workspace_id,
    v_actor_user_id,
    v_invitation.invited_roles,
    'active',
    v_invitation.title,
    v_invitation.department,
    now()
  )
  on conflict (workspace_id, user_id) do update
  set roles = excluded.roles,
      status = 'active',
      title = excluded.title,
      department = excluded.department,
      activated_at = now(),
      deactivated_at = null,
      updated_at = now()
  returning * into v_membership;

  update public.workspace_invitations
  set status = 'accepted',
      accepted_by_user_id = v_actor_user_id,
      accepted_at = now(),
      updated_at = now()
  where id = v_invitation.id
  returning * into v_invitation;

  return private.clair_workspace_invitation_lifecycle_json(v_invitation, v_membership);
end;
$$;

revoke all on function public.clair_resend_workspace_invitation(text, uuid) from public, anon;
revoke all on function public.clair_cancel_workspace_invitation(text, uuid) from public, anon;
revoke all on function public.clair_accept_workspace_invitation(text, uuid) from public, anon;

grant execute on function public.clair_resend_workspace_invitation(text, uuid) to authenticated;
grant execute on function public.clair_cancel_workspace_invitation(text, uuid) to authenticated;
grant execute on function public.clair_accept_workspace_invitation(text, uuid) to authenticated;
