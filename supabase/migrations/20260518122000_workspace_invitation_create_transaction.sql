alter table public.workspace_invitations
  add column if not exists title text,
  add column if not exists department text,
  add column if not exists canceled_at timestamptz,
  add column if not exists resent_at timestamptz,
  add column if not exists resend_count integer not null default 0 check (resend_count >= 0);

create or replace function public.clair_create_workspace_invitation(
  p_workspace_id text,
  p_email text,
  p_invited_roles text[],
  p_title text default null,
  p_department text default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_email extensions.citext := lower(trim(p_email))::extensions.citext;
  v_roles text[] := array(select distinct unnest(p_invited_roles));
  v_now timestamptz := now();
  v_invitation public.workspace_invitations%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'unauthenticated';
  end if;

  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'role_permission:manage required';
  end if;

  if v_email is null or v_email::text = '' or v_email::text !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_invitation_email';
  end if;

  if cardinality(v_roles) = 0 or not (v_roles <@ public.clair_workspace_role_values()) then
    raise exception 'invalid_invitation_roles';
  end if;

  if exists (
    select 1
    from public.workspace_invitations
    where workspace_id = p_workspace_id
      and email = v_email
      and status = 'pending'
  ) then
    raise exception 'duplicate_pending_invitation';
  end if;

  if exists (
    select 1
    from public.user_memberships memberships
    join public.users users on users.id = memberships.user_id
    where memberships.workspace_id = p_workspace_id
      and memberships.status = 'active'
      and users.email = v_email
  ) then
    raise exception 'active_membership_exists';
  end if;

  insert into public.workspace_invitations (
    workspace_id,
    email,
    invited_roles,
    status,
    invited_by_user_id,
    expires_at,
    title,
    department,
    resend_count
  )
  values (
    p_workspace_id,
    v_email,
    v_roles,
    'pending',
    v_actor_user_id,
    coalesce(p_expires_at, v_now + interval '7 days'),
    nullif(trim(coalesce(p_title, '')), ''),
    nullif(trim(coalesce(p_department, '')), ''),
    0
  )
  returning * into v_invitation;

  return jsonb_build_object(
    'id', v_invitation.id::text,
    'workspaceId', v_invitation.workspace_id,
    'email', v_invitation.email::text,
    'invitedRoles', to_jsonb(v_invitation.invited_roles),
    'title', v_invitation.title,
    'department', v_invitation.department,
    'status', v_invitation.status,
    'invitedBySessionId', v_invitation.invited_by_user_id::text,
    'acceptedBySessionId', v_invitation.accepted_by_user_id::text,
    'expiresAt', v_invitation.expires_at,
    'acceptedAt', v_invitation.accepted_at,
    'canceledAt', v_invitation.canceled_at,
    'resentAt', v_invitation.resent_at,
    'resendCount', v_invitation.resend_count,
    'createdAt', v_invitation.created_at,
    'updatedAt', v_invitation.updated_at
  );
end;
$$;

revoke all on function public.clair_create_workspace_invitation(
  text,
  text,
  text[],
  text,
  text,
  timestamptz
) from public, anon;

grant execute on function public.clair_create_workspace_invitation(
  text,
  text,
  text[],
  text,
  text,
  timestamptz
) to authenticated;
