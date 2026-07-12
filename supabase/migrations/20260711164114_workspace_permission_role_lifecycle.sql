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

revoke insert, update, delete on table public.workspace_permission_roles from authenticated;
grant select on table public.workspace_permission_roles to authenticated;
revoke insert, update, delete on table public.workspace_membership_permission_role_assignments from authenticated;
revoke insert, update, delete on table public.workspace_invitation_permission_role_assignments from authenticated;

create or replace function public.clair_update_workspace_permission_role_lifecycle(
  p_workspace_id text,
  p_role_id uuid,
  p_action text,
  p_replacement_role_id uuid default null,
  p_request_id text default null
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
  v_actor_allowed jsonb;
begin
  perform set_config('clair.permission_role_lifecycle_rpc', 'on', true);
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'role_permission:manage required';
  end if;

  select * into v_role
    from public.workspace_permission_roles
   where workspace_id = p_workspace_id and id = p_role_id
   for update;
  if v_role.id is null then raise exception 'cross_workspace_target'; end if;

  if v_role.role_type = 'owner' and not private.clair_is_canonical_workspace_owner(p_workspace_id) then
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
    if v_replacement.role_type = 'owner' and not private.clair_is_canonical_workspace_owner(p_workspace_id) then
      raise exception 'owner_scope_required';
    end if;
    select actor_role.permissions->'allowed' into v_actor_allowed
      from public.user_memberships membership
      join public.workspace_membership_permission_role_assignments a on a.membership_id=membership.id and a.workspace_id=membership.workspace_id
      join public.workspace_permission_roles actor_role on actor_role.id=a.permission_role_id and actor_role.workspace_id=a.workspace_id
     where membership.workspace_id=p_workspace_id and membership.user_id=auth.uid() and membership.status='active';
    if not (coalesce(v_actor_allowed,'[]'::jsonb) ? '*')
       and not (v_replacement.permissions->'allowed' <@ coalesce(v_actor_allowed,'[]'::jsonb)) then
      raise exception 'grant_ceiling_violation';
    end if;

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

  perform public.clair_append_audit_event(
    'permission-role-lifecycle-' || gen_random_uuid()::text,
    p_workspace_id, auth.uid(), null,
    case when p_action = 'deactivate'
      then 'workspace.permission_role_deactivated'
      else 'workspace.permission_role_reactivated' end,
    'workspace', p_role_id::text,
    null, null, null, p_request_id, null,
    jsonb_build_object('status', v_role.status),
    jsonb_build_object('status', case when p_action = 'deactivate' then 'inactive' else 'active' end),
    jsonb_build_object(
      'replacementRoleId', p_replacement_role_id::text,
      'affectedMembershipCount', v_member_count,
      'pendingInvitationCount', v_invitation_count
    ),
    now()
  );

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

revoke all on function public.clair_update_workspace_permission_role_lifecycle(text, uuid, text, uuid, text)
  from public, anon;
grant execute on function public.clair_update_workspace_permission_role_lifecycle(text, uuid, text, uuid, text)
  to authenticated;

create or replace function public.clair_list_workspace_permission_roles(p_workspace_id text)
returns jsonb language plpgsql security definer
set search_path = public, private, extensions
as $$
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not private.clair_is_workspace_admin(p_workspace_id) then raise exception 'role_permission:view required'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', role.id::text, 'workspaceId', role.workspace_id, 'roleKey', role.role_key,
    'label', role.label, 'description', role.description, 'roleType', role.role_type,
    'permissionIds', role.permissions->'allowed', 'status', role.status,
    'isSystem', role.is_system, 'isAssignable', role.is_assignable,
    'affectedMembershipCount', (select count(*) from public.workspace_membership_permission_role_assignments a where a.workspace_id = role.workspace_id and a.permission_role_id = role.id),
    'pendingInvitationCount', (select count(*) from public.workspace_invitation_permission_role_assignments a join public.workspace_invitations i on i.id=a.invitation_id and i.workspace_id=a.workspace_id where a.workspace_id=role.workspace_id and a.permission_role_id=role.id and i.status='pending')
  ) order by role.sort_order, role.label) from public.workspace_permission_roles role where role.workspace_id=p_workspace_id), '[]'::jsonb);
end; $$;

create or replace function public.clair_create_workspace_permission_role(
  p_workspace_id text, p_label text, p_description text, p_permission_ids text[], p_request_id text default null
) returns jsonb language plpgsql security definer
set search_path = public, private, extensions
as $$
declare v_role public.workspace_permission_roles%rowtype; v_actor_allowed jsonb;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not private.clair_is_workspace_admin(p_workspace_id) then raise exception 'role_permission:manage required'; end if;
  if nullif(btrim(p_label),'') is null or cardinality(p_permission_ids)=0 then raise exception 'invalid_input'; end if;
  select role.permissions->'allowed' into v_actor_allowed
    from public.user_memberships membership
    join public.workspace_membership_permission_role_assignments a on a.membership_id=membership.id and a.workspace_id=membership.workspace_id
    join public.workspace_permission_roles role on role.id=a.permission_role_id and role.workspace_id=a.workspace_id
   where membership.workspace_id=p_workspace_id and membership.user_id=auth.uid() and membership.status='active';
  if not (coalesce(v_actor_allowed,'[]'::jsonb) ? '*')
     and not (to_jsonb(p_permission_ids) <@ coalesce(v_actor_allowed,'[]'::jsonb)) then
    raise exception 'grant_ceiling_violation';
  end if;
  insert into public.workspace_permission_roles(workspace_id,role_key,label,description,role_type,permissions,is_system,is_assignable,status,created_by_user_id)
  values(p_workspace_id,'custom_'||substr(replace(gen_random_uuid()::text,'-',''),1,20),btrim(p_label),nullif(btrim(p_description),''),'custom',jsonb_build_object('allowed',to_jsonb(p_permission_ids)),false,true,'active',auth.uid())
  returning * into v_role;
  perform public.clair_append_audit_event(
    'permission-role-created-'||gen_random_uuid()::text,p_workspace_id,auth.uid(),null,
    'workspace.permission_role_created','workspace',v_role.id::text,
    null,null,null,p_request_id,null,'{}'::jsonb,
    jsonb_build_object('label',v_role.label,'permissionIds',v_role.permissions->'allowed'),
    '{}'::jsonb,now()
  );
  return jsonb_build_object('id',v_role.id::text,'workspaceId',v_role.workspace_id,'roleKey',v_role.role_key,'label',v_role.label,'description',v_role.description,'roleType',v_role.role_type,'permissionIds',v_role.permissions->'allowed','status',v_role.status,'isSystem',v_role.is_system,'isAssignable',v_role.is_assignable,'affectedMembershipCount',0,'pendingInvitationCount',0);
end; $$;

create or replace function public.clair_update_workspace_permission_role_definition(
  p_workspace_id text, p_role_id uuid, p_label text, p_description text, p_permission_ids text[], p_request_id text default null
) returns jsonb language plpgsql security definer
set search_path = public, private, extensions
as $$
declare v_role public.workspace_permission_roles%rowtype; v_before public.workspace_permission_roles%rowtype; v_actor_allowed jsonb;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not private.clair_is_workspace_admin(p_workspace_id) then raise exception 'role_permission:manage required'; end if;
  select * into v_role from public.workspace_permission_roles where workspace_id=p_workspace_id and id=p_role_id for update;
  if v_role.id is null then raise exception 'cross_workspace_target'; end if;
  if v_role.is_system then raise exception 'system_role_protected'; end if;
  v_before := v_role;
  select actor_role.permissions->'allowed' into v_actor_allowed
    from public.user_memberships membership
    join public.workspace_membership_permission_role_assignments a on a.membership_id=membership.id and a.workspace_id=membership.workspace_id
    join public.workspace_permission_roles actor_role on actor_role.id=a.permission_role_id and actor_role.workspace_id=a.workspace_id
   where membership.workspace_id=p_workspace_id and membership.user_id=auth.uid() and membership.status='active';
  if not (coalesce(v_actor_allowed,'[]'::jsonb) ? '*')
     and not (to_jsonb(p_permission_ids) <@ coalesce(v_actor_allowed,'[]'::jsonb)) then
    raise exception 'grant_ceiling_violation';
  end if;
  update public.workspace_permission_roles set label=btrim(p_label),description=nullif(btrim(p_description),''),permissions=jsonb_build_object('allowed',to_jsonb(p_permission_ids)),updated_at=now() where id=p_role_id returning * into v_role;
  perform public.clair_append_audit_event(
    'permission-role-updated-'||gen_random_uuid()::text,p_workspace_id,auth.uid(),null,
    'workspace.permission_role_updated','workspace',v_role.id::text,
    null,null,null,p_request_id,null,
    jsonb_build_object('label',v_before.label,'permissionIds',v_before.permissions->'allowed'),
    jsonb_build_object('label',v_role.label,'permissionIds',v_role.permissions->'allowed'),
    '{}'::jsonb,now()
  );
  return jsonb_build_object('id',v_role.id::text,'workspaceId',v_role.workspace_id,'roleKey',v_role.role_key,'label',v_role.label,'description',v_role.description,'roleType',v_role.role_type,'permissionIds',v_role.permissions->'allowed','status',v_role.status,'isSystem',v_role.is_system,'isAssignable',v_role.is_assignable);
end; $$;

revoke all on function public.clair_list_workspace_permission_roles(text) from public, anon;
revoke all on function public.clair_create_workspace_permission_role(text,text,text,text[],text) from public, anon;
revoke all on function public.clair_update_workspace_permission_role_definition(text,uuid,text,text,text[],text) from public, anon;
grant execute on function public.clair_list_workspace_permission_roles(text) to authenticated;
grant execute on function public.clair_create_workspace_permission_role(text,text,text,text[],text) to authenticated;
grant execute on function public.clair_update_workspace_permission_role_definition(text,uuid,text,text,text[],text) to authenticated;

-- Retire the lower-level public assignment writer; all role changes use the audited composite RPC below.
revoke all on function public.clair_update_workspace_membership_permission_role(text,uuid,uuid)
  from authenticated;
drop function if exists public.clair_update_workspace_membership_roles(text,uuid,text[],text,text);

create or replace function public.clair_update_workspace_membership_roles(
  p_workspace_id text,
  p_membership_id uuid,
  p_next_roles text[],
  p_permission_role_key text,
  p_job_position_key text,
  p_request_id text default null
)
returns jsonb language plpgsql security definer
set search_path=public,private,extensions
as $$
declare
  v_membership public.user_memberships%rowtype;
  v_before_role public.workspace_permission_roles%rowtype;
  v_next_role public.workspace_permission_roles%rowtype;
  v_actor_allowed jsonb;
  v_job_position public.workspace_job_positions%rowtype;
  v_payload jsonb;
  v_legacy_roles text[];
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not private.clair_is_workspace_admin(p_workspace_id) then raise exception 'role_permission:manage required'; end if;
  select * into v_membership from public.user_memberships
   where workspace_id=p_workspace_id and id=p_membership_id for update;
  if v_membership.id is null then raise exception 'workspace_membership_missing'; end if;
  if v_membership.user_id=auth.uid() then raise exception 'self_action_protected'; end if;

  select role.* into v_before_role
    from public.workspace_membership_permission_role_assignments a
    join public.workspace_permission_roles role on role.id=a.permission_role_id and role.workspace_id=a.workspace_id
   where a.workspace_id=p_workspace_id and a.membership_id=p_membership_id;
  if nullif(btrim(coalesce(p_permission_role_key,'')),'') is null then
    v_next_role:=v_before_role;
  else
    select * into v_next_role from public.workspace_permission_roles
     where workspace_id=p_workspace_id and role_key=p_permission_role_key
       and status='active' and is_assignable;
  end if;
  if v_next_role.id is null then raise exception 'workspace_permission_role_missing_or_unassignable'; end if;
  if v_before_role.role_type='owner' and not private.clair_is_canonical_workspace_owner(p_workspace_id) then raise exception 'owner_target_protected'; end if;
  if v_next_role.role_type='owner' and not private.clair_is_canonical_workspace_owner(p_workspace_id) then raise exception 'owner_scope_required'; end if;

  select actor_role.permissions->'allowed' into v_actor_allowed
    from public.user_memberships actor_membership
    join public.workspace_membership_permission_role_assignments a on a.membership_id=actor_membership.id and a.workspace_id=actor_membership.workspace_id
    join public.workspace_permission_roles actor_role on actor_role.id=a.permission_role_id and actor_role.workspace_id=a.workspace_id
   where actor_membership.workspace_id=p_workspace_id and actor_membership.user_id=auth.uid() and actor_membership.status='active';
  if not (coalesce(v_actor_allowed,'[]'::jsonb)?'*')
     and not (v_next_role.permissions->'allowed' <@ coalesce(v_actor_allowed,'[]'::jsonb)) then
    raise exception 'grant_ceiling_violation';
  end if;

  if nullif(btrim(coalesce(p_job_position_key,'')),'') is not null then
    select * into v_job_position from public.workspace_job_positions
     where workspace_id=p_workspace_id and position_key=p_job_position_key and is_active;
    if v_job_position.id is null then raise exception 'workspace_job_position_missing_or_inactive'; end if;
  end if;

  v_legacy_roles:=case when v_next_role.role_type in ('owner','admin') then array['hospital_admin']::text[]
    else array_remove(coalesce(p_next_roles,v_membership.roles),'hospital_admin') end;
  if cardinality(v_legacy_roles)=0 then v_legacy_roles:=v_membership.roles; end if;
  v_membership:=private.update_workspace_membership_roles(p_workspace_id,p_membership_id,v_legacy_roles,null);
  perform private.update_workspace_membership_permission_role(p_workspace_id,p_membership_id,v_next_role.id);
  if v_job_position.id is not null then
    perform private.update_workspace_membership_job_position(p_workspace_id,p_membership_id,v_job_position.id);
  end if;
  v_payload:=private.clair_membership_mutation_json(v_membership)||jsonb_build_object(
    'permissionRoleKey',v_next_role.role_key,
    'jobPositionKey',coalesce(v_job_position.position_key,p_job_position_key)
  );
  perform public.clair_append_audit_event(
    'membership-role-change-'||gen_random_uuid()::text,p_workspace_id,auth.uid(),null,
    'workspace.membership_roles_changed','membership',p_membership_id::text,
    null,null,null,p_request_id,null,
    jsonb_build_object('permissionRoleKey',v_before_role.role_key,'roles',v_membership.roles),
    jsonb_build_object('permissionRoleKey',v_next_role.role_key,'roles',v_legacy_roles,'jobPositionKey',v_job_position.position_key),
    '{}'::jsonb,now()
  );
  return v_payload;
end; $$;

revoke all on function public.clair_update_workspace_membership_roles(text,uuid,text[])
  from public,anon,authenticated;
revoke all on function public.clair_update_workspace_membership_roles(text,uuid,text[],text,text,text)
  from public,anon;
grant execute on function public.clair_update_workspace_membership_roles(text,uuid,text[],text,text,text)
  to authenticated;
