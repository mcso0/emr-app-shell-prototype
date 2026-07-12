alter table public.workspace_job_positions
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by_user_id uuid references public.users(id) on delete set null;

revoke insert, update, delete on table public.workspace_job_positions from authenticated;
grant select on table public.workspace_job_positions to authenticated;
revoke insert, update, delete on table public.workspace_membership_job_position_assignments from authenticated;
revoke insert, update, delete on table public.workspace_invitation_job_position_assignments from authenticated;
revoke all on function public.clair_update_workspace_membership_job_position(text,uuid,uuid)
  from public,anon,authenticated;

create or replace function public.clair_update_workspace_job_position_lifecycle(
  p_workspace_id text,
  p_position_id uuid,
  p_action text,
  p_pending_invitation_replacement_position_id uuid default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_position public.workspace_job_positions%rowtype;
  v_replacement public.workspace_job_positions%rowtype;
  v_retained_member_count integer := 0;
  v_pending_count integer := 0;
begin
  perform set_config('clair.job_position_lifecycle_rpc', 'on', true);
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'role_permission:manage required';
  end if;

  select * into v_position
    from public.workspace_job_positions
   where workspace_id = p_workspace_id and id = p_position_id
   for update;
  if v_position.id is null then raise exception 'cross_workspace_target'; end if;

  select count(*)::integer into v_retained_member_count
    from public.workspace_membership_job_position_assignments assignment
   where assignment.workspace_id = p_workspace_id
     and assignment.job_position_id = p_position_id;

  select count(*)::integer into v_pending_count
    from public.workspace_invitation_job_position_assignments assignment
    join public.workspace_invitations invitation
      on invitation.workspace_id = assignment.workspace_id
     and invitation.id = assignment.invitation_id
   where assignment.workspace_id = p_workspace_id
     and assignment.job_position_id = p_position_id
     and invitation.status = 'pending';

  if p_action = 'deactivate' then
    if not v_position.is_active then raise exception 'state_conflict'; end if;
    if v_pending_count > 0 and p_pending_invitation_replacement_position_id is null then
      raise exception 'replacement_position_required';
    end if;

    if p_pending_invitation_replacement_position_id is not null then
      if p_pending_invitation_replacement_position_id = p_position_id then
        raise exception 'replacement_position_invalid';
      end if;
      select * into v_replacement
        from public.workspace_job_positions
       where workspace_id = p_workspace_id
         and id = p_pending_invitation_replacement_position_id
         and is_active;
      if v_replacement.id is null then raise exception 'replacement_position_invalid'; end if;

      update public.workspace_invitation_job_position_assignments assignment
         set job_position_id = p_pending_invitation_replacement_position_id,
             assigned_by_user_id = auth.uid(),
             updated_at = now()
        from public.workspace_invitations invitation
       where assignment.workspace_id = p_workspace_id
         and assignment.job_position_id = p_position_id
         and invitation.workspace_id = assignment.workspace_id
         and invitation.id = assignment.invitation_id
         and invitation.status = 'pending';
    end if;

    update public.workspace_job_positions
       set is_active = false,
           deactivated_at = now(),
           deactivated_by_user_id = auth.uid(),
           updated_at = now()
     where id = p_position_id;
  elsif p_action = 'reactivate' then
    if v_position.is_active then raise exception 'state_conflict'; end if;
    update public.workspace_job_positions
       set is_active = true,
           deactivated_at = null,
           deactivated_by_user_id = null,
           updated_at = now()
     where id = p_position_id;
  else
    raise exception 'invalid_lifecycle_action';
  end if;

  perform public.clair_append_audit_event(
    'job-position-lifecycle-' || gen_random_uuid()::text,
    p_workspace_id, auth.uid(), null,
    case when p_action = 'deactivate'
      then 'workspace.job_position_deactivated'
      else 'workspace.job_position_reactivated' end,
    'workspace', p_position_id::text,
    null, null, null, p_request_id, null,
    jsonb_build_object('isActive', v_position.is_active),
    jsonb_build_object('isActive', p_action = 'reactivate'),
    jsonb_build_object(
      'replacementPositionId', p_pending_invitation_replacement_position_id::text,
      'retainedMembershipCount', v_retained_member_count,
      'pendingInvitationCount', v_pending_count
    ),
    now()
  );

  return jsonb_build_object(
    'id', p_position_id::text,
    'workspaceId', p_workspace_id,
    'isActive', p_action = 'reactivate',
    'replacementPositionId', p_pending_invitation_replacement_position_id::text,
    'retainedMembershipCount', v_retained_member_count,
    'pendingInvitationCount', v_pending_count
  );
end;
$$;

revoke all on function public.clair_update_workspace_job_position_lifecycle(text, uuid, text, uuid, text)
  from public, anon;
grant execute on function public.clair_update_workspace_job_position_lifecycle(text, uuid, text, uuid, text)
  to authenticated;

create or replace function public.clair_list_workspace_job_positions(p_workspace_id text)
returns jsonb language plpgsql security definer set search_path=public,private,extensions as $$
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not private.clair_is_workspace_admin(p_workspace_id) then raise exception 'role_permission:view required'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',position.id::text,'workspaceId',position.workspace_id,'positionKey',position.position_key,
    'label',position.label,'description',position.description,'isSystem',position.is_system,'isActive',position.is_active,
    'retainedMembershipCount',(select count(*) from public.workspace_membership_job_position_assignments a where a.workspace_id=position.workspace_id and a.job_position_id=position.id),
    'pendingInvitationCount',(select count(*) from public.workspace_invitation_job_position_assignments a join public.workspace_invitations i on i.id=a.invitation_id and i.workspace_id=a.workspace_id where a.workspace_id=position.workspace_id and a.job_position_id=position.id and i.status='pending')
  ) order by position.sort_order,position.label) from public.workspace_job_positions position where position.workspace_id=p_workspace_id),'[]'::jsonb);
end; $$;

create or replace function public.clair_create_workspace_job_position(p_workspace_id text,p_label text,p_description text)
returns jsonb language plpgsql security definer set search_path=public,private,extensions as $$
declare v_position public.workspace_job_positions%rowtype;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not private.clair_is_workspace_admin(p_workspace_id) then raise exception 'role_permission:manage required'; end if;
  if nullif(btrim(p_label),'') is null then raise exception 'invalid_input'; end if;
  insert into public.workspace_job_positions(workspace_id,position_key,label,description,is_system,is_active,created_by_user_id)
  values(p_workspace_id,'custom_'||substr(replace(gen_random_uuid()::text,'-',''),1,20),btrim(p_label),nullif(btrim(p_description),''),false,true,auth.uid()) returning * into v_position;
  return jsonb_build_object('id',v_position.id::text,'workspaceId',v_position.workspace_id,'positionKey',v_position.position_key,'label',v_position.label,'description',v_position.description,'isSystem',v_position.is_system,'isActive',v_position.is_active,'retainedMembershipCount',0,'pendingInvitationCount',0);
end; $$;

create or replace function public.clair_update_workspace_job_position_definition(p_workspace_id text,p_position_id uuid,p_label text,p_description text)
returns jsonb language plpgsql security definer set search_path=public,private,extensions as $$
declare v_position public.workspace_job_positions%rowtype;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not private.clair_is_workspace_admin(p_workspace_id) then raise exception 'role_permission:manage required'; end if;
  update public.workspace_job_positions set label=btrim(p_label),description=nullif(btrim(p_description),''),updated_at=now()
   where workspace_id=p_workspace_id and id=p_position_id returning * into v_position;
  if v_position.id is null then raise exception 'cross_workspace_target'; end if;
  return jsonb_build_object('id',v_position.id::text,'workspaceId',v_position.workspace_id,'positionKey',v_position.position_key,'label',v_position.label,'description',v_position.description,'isSystem',v_position.is_system,'isActive',v_position.is_active);
end; $$;

revoke all on function public.clair_list_workspace_job_positions(text) from public,anon;
revoke all on function public.clair_create_workspace_job_position(text,text,text) from public,anon;
revoke all on function public.clair_update_workspace_job_position_definition(text,uuid,text,text) from public,anon;
grant execute on function public.clair_list_workspace_job_positions(text) to authenticated;
grant execute on function public.clair_create_workspace_job_position(text,text,text) to authenticated;
grant execute on function public.clair_update_workspace_job_position_definition(text,uuid,text,text) to authenticated;
