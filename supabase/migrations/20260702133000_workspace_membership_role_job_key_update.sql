create or replace function public.clair_update_workspace_membership_roles(
  p_workspace_id text,
  p_membership_id uuid,
  p_next_roles text[],
  p_permission_role_key text,
  p_job_position_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_membership public.user_memberships%rowtype;
  v_payload jsonb;
  v_permission_role_id uuid;
  v_permission_role_key text;
  v_job_position_id uuid;
  v_job_position_key text;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'role_permission:manage required';
  end if;

  v_membership := private.update_workspace_membership_roles(
    p_workspace_id,
    p_membership_id,
    p_next_roles,
    null
  );
  v_payload := private.clair_membership_mutation_json(v_membership);

  if nullif(trim(coalesce(p_permission_role_key, '')), '') is not null then
    select role.id, role.role_key
    into v_permission_role_id, v_permission_role_key
    from public.workspace_permission_roles role
    where role.workspace_id = p_workspace_id
      and role.role_key = p_permission_role_key
      and role.is_assignable = true;

    if v_permission_role_id is null then
      raise exception 'workspace_permission_role_missing_or_unassignable';
    end if;

    perform private.update_workspace_membership_permission_role(
      p_workspace_id,
      p_membership_id,
      v_permission_role_id
    );
    v_payload := v_payload || jsonb_build_object('permissionRoleKey', v_permission_role_key);
  end if;

  if nullif(trim(coalesce(p_job_position_key, '')), '') is not null then
    select position.id, position.position_key
    into v_job_position_id, v_job_position_key
    from public.workspace_job_positions position
    where position.workspace_id = p_workspace_id
      and position.position_key = p_job_position_key
      and position.is_active = true;

    if v_job_position_id is null then
      raise exception 'workspace_job_position_missing_or_inactive';
    end if;

    perform private.update_workspace_membership_job_position(
      p_workspace_id,
      p_membership_id,
      v_job_position_id
    );
    v_payload := v_payload || jsonb_build_object('jobPositionKey', v_job_position_key);
  end if;

  return v_payload;
end;
$$;

revoke all on function public.clair_update_workspace_membership_roles(
  text,
  uuid,
  text[],
  text,
  text
) from public, anon;

grant execute on function public.clair_update_workspace_membership_roles(
  text,
  uuid,
  text[],
  text,
  text
) to authenticated;
