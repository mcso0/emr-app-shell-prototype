-- DEN-44: workspace creation transaction boundary.
-- Local-first only. Remote Supabase execution remains approval-gated.

create or replace function public.clair_create_workspace_with_creator(
  p_workspace_id text,
  p_display_name text,
  p_admin_display_name text,
  p_contact_email text default null,
  p_contact_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_membership public.user_memberships;
  v_now timestamptz := now();
begin
  if v_actor_user_id is null then
    raise exception 'unauthenticated'
      using errcode = '28000';
  end if;

  if p_workspace_id is null
    or p_workspace_id !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'
    or nullif(trim(p_display_name), '') is null
    or nullif(trim(p_admin_display_name), '') is null
  then
    raise exception 'invalid_workspace_creation_input'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.workspaces workspace
    where workspace.id = p_workspace_id
  ) then
    raise exception 'workspace_already_exists'
      using errcode = '23505';
  end if;

  insert into public.users (
    id,
    display_name,
    initial,
    email,
    phone,
    status,
    created_at,
    updated_at
  )
  values (
    v_actor_user_id,
    trim(p_admin_display_name),
    upper(left(trim(p_admin_display_name), 1)),
    nullif(trim(p_contact_email), '')::extensions.citext,
    nullif(trim(p_contact_phone), ''),
    'active',
    v_now,
    v_now
  )
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    initial = excluded.initial,
    email = coalesce(excluded.email, public.users.email),
    phone = coalesce(excluded.phone, public.users.phone),
    status = 'active',
    updated_at = v_now;

  insert into public.workspaces (
    id,
    display_name,
    status,
    created_by_user_id,
    created_at,
    updated_at
  )
  values (
    p_workspace_id,
    trim(p_display_name),
    'active',
    v_actor_user_id,
    v_now,
    v_now
  );

  insert into public.user_memberships (
    workspace_id,
    user_id,
    roles,
    department,
    title,
    status,
    activated_at,
    created_at,
    updated_at
  )
  values (
    p_workspace_id,
    v_actor_user_id,
    array['hospital_admin']::text[],
    '병원관리',
    '워크스페이스 생성자',
    'active',
    v_now,
    v_now,
    v_now
  )
  returning * into v_membership;

  return jsonb_build_object(
    'workspace',
    jsonb_build_object(
      'id', p_workspace_id,
      'displayName', trim(p_display_name),
      'representativeName', trim(p_admin_display_name),
      'contactEmail', nullif(trim(p_contact_email), ''),
      'contactPhone', nullif(trim(p_contact_phone), ''),
      'subscriptionStatus', 'trialing',
      'createdBySessionId', v_actor_user_id::text,
      'createdAt', v_now
    ),
    'membership',
    jsonb_build_object(
      'id', v_membership.id::text,
      'workspaceId', v_membership.workspace_id,
      'userSessionId', v_membership.user_id::text,
      'displayName', trim(p_admin_display_name),
      'email', nullif(trim(p_contact_email), ''),
      'roles', v_membership.roles,
      'status', v_membership.status,
      'title', v_membership.title,
      'department', v_membership.department,
      'createdAt', v_membership.created_at,
      'activatedAt', v_membership.activated_at,
      'deactivatedAt', v_membership.deactivated_at
    )
  );
end;
$$;

revoke all on function public.clair_create_workspace_with_creator(text, text, text, text, text)
  from public;
revoke all on function public.clair_create_workspace_with_creator(text, text, text, text, text)
  from anon;
grant execute on function public.clair_create_workspace_with_creator(text, text, text, text, text)
  to authenticated;

comment on function public.clair_create_workspace_with_creator(text, text, text, text, text) is
  'Creates a workspace and creator active hospital_admin membership in one local-first transaction. Remote execution is approval-gated.';
