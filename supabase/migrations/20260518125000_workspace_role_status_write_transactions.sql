create or replace function private.clair_membership_mutation_json(
  p_membership public.user_memberships
)
returns jsonb
language sql
stable
set search_path = public, private, extensions
as $$
  select jsonb_build_object(
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
  );
$$;

create or replace function public.clair_update_workspace_membership_roles(
  p_workspace_id text,
  p_membership_id uuid,
  p_next_roles text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_membership public.user_memberships%rowtype;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'role_permission:manage required';
  end if;

  -- last_admin guard is enforced by the existing protect_last_active_hospital_admin trigger.
  v_membership := private.update_workspace_membership_roles(
    p_workspace_id,
    p_membership_id,
    p_next_roles,
    null
  );

  -- audit hook: emit workspace.membership_roles_updated after audit persistence is introduced.
  return private.clair_membership_mutation_json(v_membership);
end;
$$;

create or replace function public.clair_update_workspace_membership_status(
  p_workspace_id text,
  p_membership_id uuid,
  p_next_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_current public.user_memberships%rowtype;
  v_membership public.user_memberships%rowtype;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'role_permission:manage required';
  end if;

  select *
  into v_current
  from public.user_memberships
  where workspace_id = p_workspace_id
    and id = p_membership_id;

  if v_current.id is null then
    raise exception 'workspace_membership_missing';
  end if;

  -- last_admin guard is enforced by the existing protect_last_active_hospital_admin trigger.
  v_membership := private.update_workspace_membership_roles(
    p_workspace_id,
    p_membership_id,
    v_current.roles,
    p_next_status
  );

  -- audit hook: emit workspace.membership_status_updated after audit persistence is introduced.
  return private.clair_membership_mutation_json(v_membership);
end;
$$;

revoke all on function public.clair_update_workspace_membership_roles(text, uuid, text[]) from public, anon;
revoke all on function public.clair_update_workspace_membership_status(text, uuid, text) from public, anon;

grant execute on function public.clair_update_workspace_membership_roles(text, uuid, text[]) to authenticated;
grant execute on function public.clair_update_workspace_membership_status(text, uuid, text) to authenticated;
