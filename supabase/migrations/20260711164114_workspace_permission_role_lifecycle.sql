alter table public.workspace_permission_roles
  add column if not exists status text not null default 'active',
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by_user_id uuid references public.users(id) on delete set null;

alter table public.workspace_permission_roles
  drop constraint if exists workspace_permission_roles_status_check;
alter table public.workspace_permission_roles
  add constraint workspace_permission_roles_status_check
  check (status in ('active', 'inactive'));

update public.workspace_permission_roles
set status = case when is_assignable then 'active' else 'inactive' end;

create or replace function public.clair_update_workspace_permission_role_lifecycle(
  p_workspace_id text,
  p_role_id uuid,
  p_action text,
  p_replacement_role_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_role public.workspace_permission_roles%rowtype;
  v_replacement public.workspace_permission_roles%rowtype;
  v_member_count integer := 0;
  v_invitation_count integer := 0;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'role_permission:manage required';
  end if;

  select * into v_role
    from public.workspace_permission_roles
   where workspace_id = p_workspace_id and id = p_role_id
   for update;
  if v_role.id is null then raise exception 'cross_workspace_target'; end if;

  if v_role.role_type = 'owner' and not private.clair_is_workspace_owner(p_workspace_id) then
    raise exception 'owner_scope_required';
  end if;

  if p_action = 'deactivate' then
    if v_role.is_system then raise exception 'system_role_protected'; end if;
    if v_role.status <> 'active' then raise exception 'state_conflict'; end if;
    if p_replacement_role_id is null or p_replacement_role_id = p_role_id then
      raise exception 'replacement_role_invalid';
    end if;

    select * into v_replacement
      from public.workspace_permission_roles
     where workspace_id = p_workspace_id
       and id = p_replacement_role_id
       and status = 'active'
       and is_assignable;
    if v_replacement.id is null then raise exception 'replacement_role_invalid'; end if;

    update public.workspace_membership_permission_role_assignments assignment
       set permission_role_id = p_replacement_role_id,
           assigned_by_user_id = auth.uid(),
           updated_at = now()
      from public.user_memberships membership
     where assignment.workspace_id = p_workspace_id
       and assignment.permission_role_id = p_role_id
       and membership.workspace_id = assignment.workspace_id
       and membership.id = assignment.membership_id
       and membership.status in ('active', 'inactive');
    get diagnostics v_member_count = row_count;

    update public.workspace_invitation_permission_role_assignments assignment
       set permission_role_id = p_replacement_role_id,
           assigned_by_user_id = auth.uid(),
           updated_at = now()
      from public.workspace_invitations invitation
     where assignment.workspace_id = p_workspace_id
       and assignment.permission_role_id = p_role_id
       and invitation.workspace_id = assignment.workspace_id
       and invitation.id = assignment.invitation_id
       and invitation.status = 'pending';
    get diagnostics v_invitation_count = row_count;

    update public.workspace_permission_roles
       set status = 'inactive',
           is_assignable = false,
           deactivated_at = now(),
           deactivated_by_user_id = auth.uid(),
           updated_at = now()
     where id = p_role_id;
  elsif p_action = 'reactivate' then
    if v_role.status <> 'inactive' then raise exception 'state_conflict'; end if;
    update public.workspace_permission_roles
       set status = 'active',
           is_assignable = true,
           deactivated_at = null,
           deactivated_by_user_id = null,
           updated_at = now()
     where id = p_role_id;
  else
    raise exception 'invalid_lifecycle_action';
  end if;

  return jsonb_build_object(
    'id', p_role_id::text,
    'workspaceId', p_workspace_id,
    'status', case when p_action = 'deactivate' then 'inactive' else 'active' end,
    'replacementRoleId', p_replacement_role_id::text,
    'affectedMembershipCount', v_member_count,
    'pendingInvitationCount', v_invitation_count
  );
end;
$$;

revoke all on function public.clair_update_workspace_permission_role_lifecycle(text, uuid, text, uuid)
  from public, anon;
grant execute on function public.clair_update_workspace_permission_role_lifecycle(text, uuid, text, uuid)
  to authenticated;
