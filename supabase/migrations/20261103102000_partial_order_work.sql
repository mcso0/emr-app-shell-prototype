begin;
create table private.order_partial_work_notes (
 workspace_id text not null, task_id uuid not null, order_id uuid not null, command_id uuid not null,
 actor_id uuid not null, note text not null check(length(btrim(note)) between 1 and 2000),
 expected_revision bigint not null, created_at timestamptz not null default now(),
 primary key(workspace_id,command_id)
);
revoke all on private.order_partial_work_notes from public,anon,authenticated,service_role;
alter table private.order_partial_work_notes enable row level security;

create function public.clair_get_partial_order_work(p_workspace_id text,p_task_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.order_tasks; wi public.order_fulfillment_work_items;
begin
 perform public.clair_get_task_instruction_review(p_workspace_id,p_task_id);
 select * into t from public.order_tasks where workspace_id=p_workspace_id and id=p_task_id;
 select * into wi from public.order_fulfillment_work_items where workspace_id=p_workspace_id and task_id=p_task_id;
 return jsonb_build_object('taskId',t.id,'revision',t.row_revision,
  'canRecord',coalesce(wi.assigned_to_user_id=auth.uid() and t.status in ('in_progress','paused')
    and private.clair_current_user_has_workspace_permission(p_workspace_id,private.clair_queue_permission_for_destination(t.destination_module,'write')),false),
  'notes',(select coalesce(jsonb_agg(jsonb_build_object('taskId',n.task_id,'note',n.note,'createdAt',n.created_at,
    'actorName',(select display_name from public.users where id=n.actor_id),'attemptNo',old_task.attempt_no) order by n.created_at),'[]'::jsonb)
    from private.order_partial_work_notes n join public.order_tasks old_task on old_task.workspace_id=n.workspace_id and old_task.id=n.task_id
    where n.workspace_id=p_workspace_id and n.order_id=t.order_id));
end $$;
create function public.clair_record_partial_order_work(p_workspace_id text,p_task_id uuid,p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.order_tasks; previous private.order_partial_work_notes; note text; cmd uuid;
begin
 select * into t from public.order_tasks where workspace_id=p_workspace_id and id=p_task_id and task_role='execution';
 if not found or t.destination_module not in ('dispensing','treatment') then raise exception 'task_unavailable'; end if;
 perform private.clair_assert_work_owner(p_workspace_id,t.order_id,auth.uid());
 select * into t from public.order_tasks where workspace_id=p_workspace_id and id=p_task_id for update;
 cmd:=(p_command->>'commandId')::uuid; note:=btrim(p_command->>'note');
 if cmd is null or length(coalesce(note,'')) not between 1 and 2000 or (p_command->>'expectedRevision')::bigint is null then raise exception 'invalid_input'; end if;
 select * into previous from private.order_partial_work_notes where workspace_id=p_workspace_id and command_id=cmd;
 if found then
  if previous.task_id<>t.id or previous.actor_id<>auth.uid() or previous.note<>note or previous.expected_revision<>(p_command->>'expectedRevision')::bigint then raise exception 'idempotency_conflict'; end if;
  return public.clair_get_partial_order_work(p_workspace_id,p_task_id);
 end if;
 if t.row_revision<>(p_command->>'expectedRevision')::bigint or exists(select 1 from public.order_tasks n where n.workspace_id=t.workspace_id and n.order_id=t.order_id and n.attempt_no>t.attempt_no) then raise exception 'revision_conflict'; end if;
 if t.status not in ('in_progress','paused') then raise exception 'invalid_transition'; end if;
 insert into private.order_partial_work_notes(workspace_id,task_id,order_id,command_id,actor_id,note,expected_revision)
 values(p_workspace_id,t.id,t.order_id,cmd,auth.uid(),note,t.row_revision);
 update public.order_tasks set row_revision=row_revision+1,updated_at=now() where workspace_id=p_workspace_id and id=t.id;
 return public.clair_get_partial_order_work(p_workspace_id,p_task_id);
end $$;

alter function private.clair_task_effective_instructions(text,uuid) rename to clair_task_effective_instructions_before_partial;
create function private.clair_task_effective_instructions(p_workspace_id text,p_task_id uuid)
returns jsonb language plpgsql stable set search_path='' as $$
declare d jsonb; notes jsonb;
begin
 d:=private.clair_task_effective_instructions_before_partial(p_workspace_id,p_task_id);
 if d is null then return null; end if;
 select coalesce(jsonb_agg(jsonb_build_object('taskId',n.task_id,'note',n.note,'createdAt',n.created_at,
    'actorName',(select display_name from public.users where id=n.actor_id),'attemptNo',old_task.attempt_no) order by n.created_at),'[]'::jsonb)
 into notes from private.order_partial_work_notes n join public.order_tasks old_task on old_task.workspace_id=n.workspace_id and old_task.id=n.task_id
 where n.workspace_id=p_workspace_id and n.order_id=(select order_id from public.order_tasks where workspace_id=p_workspace_id and id=p_task_id);
 d:=d||jsonb_build_object('partialWork',notes);
 if jsonb_array_length(notes)>0 and exists(select 1 from jsonb_array_elements(d->'entries') e where e->>'kind'='clinical_edit') then
  d:=jsonb_set(d,'{versionKey}',to_jsonb(encode(extensions.digest((d->>'versionKey')||notes::text,'sha256'),'hex')));
 end if;
 return d;
end $$;
revoke all on function private.clair_task_effective_instructions(text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.clair_get_partial_order_work(text,uuid),public.clair_record_partial_order_work(text,uuid,jsonb) from public,anon,service_role;
grant execute on function public.clair_get_partial_order_work(text,uuid),public.clair_record_partial_order_work(text,uuid,jsonb) to authenticated;
commit;
