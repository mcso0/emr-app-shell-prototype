-- DEN follow-up: make OTP-backed invite acceptance create/link the app user row.
-- Local-first migration only; remote staging application remains approval-gated.

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
  v_claim_email extensions.citext := nullif(
    lower(trim(coalesce(auth.jwt() ->> 'email', ''))),
    ''
  )::extensions.citext;
  v_app_user_email extensions.citext;
  v_actor_email extensions.citext;
  v_display_name text;
  v_invitation public.workspace_invitations%rowtype;
  v_membership public.user_memberships%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'unauthenticated';
  end if;

  v_invitation := private.clair_get_pending_workspace_invitation(p_workspace_id, p_invitation_id);

  select email
  into v_app_user_email
  from public.users
  where id = v_actor_user_id;

  if v_app_user_email is not null and v_app_user_email <> v_invitation.email then
    raise exception 'target_invitation_missing';
  end if;

  v_actor_email := coalesce(v_app_user_email, v_claim_email);

  if v_actor_email is null then
    raise exception 'unauthenticated';
  end if;

  if v_actor_email <> v_invitation.email then
    raise exception 'target_invitation_missing';
  end if;

  v_display_name := coalesce(nullif(split_part(v_actor_email::text, '@', 1), ''), 'Invited user');

  insert into public.users as app_user (
    id,
    display_name,
    initial,
    email,
    status
  )
  values (
    v_actor_user_id,
    v_display_name,
    upper(left(v_display_name, 1)),
    v_actor_email,
    'active'
  )
  on conflict (id) do update
  set email = coalesce(app_user.email, excluded.email),
      status = case
        when app_user.status = 'invited' then 'active'
        else app_user.status
      end,
      updated_at = now();

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

revoke all on function public.clair_accept_workspace_invitation(text, uuid) from public, anon;
grant execute on function public.clair_accept_workspace_invitation(text, uuid) to authenticated;

comment on function public.clair_accept_workspace_invitation(text, uuid) is
  'Accepts a pending workspace invitation for the verified email identity, upserts the app user row, and activates membership in one transaction.';
