-- Execution holds are independent of the last recorded execution state.
-- They apply to one instruction (set root + queue), preserving its tasks and owners.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create table private.order_work_holds (
  workspace_id text not null,
  root_task_id uuid not null,
  queue_type text not null,
  order_id uuid not null,
  reason text not null check (reason in ('order_edit')),
  actor_id uuid not null,
  session_id uuid not null,
  expires_at timestamptz not null,
  primary key (workspace_id, root_task_id, queue_type),
  foreign key (workspace_id, root_task_id) references public.order_tasks(workspace_id, id) on delete cascade
);

alter table private.order_work_holds enable row level security;
revoke all on table private.order_work_holds from public, anon, authenticated, service_role;

create function private.clair_active_work_hold(p_workspace_id text, p_task_id uuid, p_queue_type text)
returns private.order_work_holds
language sql stable set search_path = '' as $$
  select held.*
  from public.order_tasks task
  join private.order_work_holds held on held.workspace_id = task.workspace_id
    and held.root_task_id = coalesce(task.parent_task_id, task.id)
    and held.queue_type = p_queue_type
  where task.workspace_id = p_workspace_id and task.id = p_task_id
    and held.expires_at > statement_timestamp()
$$;

create function private.clair_assert_order_work_available(p_workspace_id text, p_order_id uuid)
returns void
language plpgsql stable set search_path = '' as $$
begin
  if exists (
    select 1 from public.order_fulfillment_work_items item
    where item.workspace_id = p_workspace_id and item.order_id = p_order_id
      and (private.clair_active_work_hold(item.workspace_id, item.task_id, item.queue_type)).reason is not null
  ) then raise exception 'order_work_on_hold'; end if;
end
$$;

-- Bump the normal queue revision to refresh already-open instructions and
-- invalidate commands captured before the hold. Don't modify business fields.
create function private.clair_refresh_held_instruction(p_workspace_id text, p_root_task_id uuid, p_queue_type text)
returns void
language sql set search_path = '' as $$
  update public.order_fulfillment_work_items item
  set row_revision = item.row_revision + 1
  from public.order_tasks task
  where item.workspace_id = p_workspace_id and item.queue_type = p_queue_type
    and task.workspace_id = item.workspace_id and task.id = item.task_id
    and coalesce(task.parent_task_id, task.id) = p_root_task_id
$$;

create function public.clair_manage_confirmed_order_edit_session(
  p_workspace_id text, p_chart_id uuid, p_order_id uuid, p_session_id uuid, p_action text
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  context jsonb;
  held private.order_work_holds;
  target public.order_fulfillment_work_items;
  root_id uuid;
  actor uuid := auth.uid();
  lease_interval constant interval := interval '5 minutes';
begin
  if p_session_id is null or p_action is null or p_action not in ('begin','renew','release') then
    raise exception 'invalid_input';
  end if;
  context := public.clair_get_confirmed_order_edit(p_workspace_id, p_chart_id, p_order_id);
  perform private.clair_lock_work_ownership(p_workspace_id, p_order_id);

  if p_action = 'release' then
    delete from private.order_work_holds
    where workspace_id = p_workspace_id and order_id = p_order_id and reason = 'order_edit'
      and actor_id = actor and session_id = p_session_id
    returning * into held;
    if found then
      perform private.clair_refresh_held_instruction(p_workspace_id, held.root_task_id, held.queue_type);
    end if;
    return jsonb_build_object('editSessionId', null);
  end if;

  -- Re-read under the same ownership lock used by execution and chart writes.
  context := public.clair_get_confirmed_order_edit(p_workspace_id, p_chart_id, p_order_id);
  if not (context->>'canEditClinical')::boolean then
    if p_action = 'renew' then
      raise exception 'permission_missing' using errcode = '42501';
    end if;
    return jsonb_build_object('context', context, 'editSessionId', null);
  end if;
  select * into target from public.order_fulfillment_work_items
  where workspace_id = p_workspace_id and order_id = p_order_id
  order by request_cycle desc, created_at desc limit 1;
  select coalesce(parent_task_id, id) into root_id from public.order_tasks
  where workspace_id = p_workspace_id and id = target.task_id;
  held := private.clair_active_work_hold(p_workspace_id, target.task_id, target.queue_type);

  if held.reason is not null then
    if held.actor_id is distinct from actor or held.session_id is distinct from p_session_id
       or held.order_id is distinct from p_order_id or held.reason <> 'order_edit' then
      raise exception 'order_work_on_hold';
    end if;
    update private.order_work_holds
    set expires_at = clock_timestamp() + lease_interval
    where workspace_id = held.workspace_id and root_task_id = held.root_task_id and queue_type = held.queue_type;
  elsif p_action = 'renew' then
    raise exception 'order_edit_session_expired';
  elsif root_id is not null and target.status in ('requested','in_progress','paused')
    and exists (
      select 1 from public.order_fulfillment_work_items item
      join public.order_tasks task on task.workspace_id = item.workspace_id and task.id = item.task_id
      where item.workspace_id = p_workspace_id and item.queue_type = target.queue_type
        and coalesce(task.parent_task_id, task.id) = root_id
        and item.status in ('in_progress','paused') and item.assigned_to_user_id is not null
    ) then
    insert into private.order_work_holds as existing
      (workspace_id, root_task_id, queue_type, order_id, reason, actor_id, session_id, expires_at)
    values (p_workspace_id, root_id, target.queue_type, p_order_id, 'order_edit', actor,
      p_session_id, clock_timestamp() + lease_interval)
    on conflict (workspace_id, root_task_id, queue_type) do update
    set order_id = excluded.order_id, reason = excluded.reason, actor_id = excluded.actor_id,
        session_id = excluded.session_id, expires_at = excluded.expires_at
    where existing.expires_at <= statement_timestamp()
    returning * into held;
    if not found then raise exception 'order_work_on_hold'; end if;
    perform private.clair_refresh_held_instruction(p_workspace_id, root_id, target.queue_type);
  end if;

  return jsonb_build_object('context', context, 'editSessionId', held.session_id);
end
$$;

-- Called inside the save transaction. A failed save rolls the release back.
create function private.clair_finish_order_edit_hold(p_workspace_id text, p_order_id uuid, p_session_id uuid)
returns void
language plpgsql set search_path = '' as $$
declare
  held private.order_work_holds;
begin
  select active.* into held
  from public.order_fulfillment_work_items item
  cross join lateral private.clair_active_work_hold(item.workspace_id, item.task_id, item.queue_type) active
  where item.workspace_id = p_workspace_id and item.order_id = p_order_id
    and active.reason is not null
  limit 1;
  if held.reason is null then
    if p_session_id is not null then raise exception 'order_edit_session_expired'; end if;
    return;
  end if;
  if held.reason <> 'order_edit' or held.session_id is distinct from p_session_id
    or held.actor_id is distinct from auth.uid() or held.order_id is distinct from p_order_id then
    raise exception 'order_work_on_hold';
  end if;
  delete from private.order_work_holds
  where workspace_id = held.workspace_id and root_task_id = held.root_task_id and queue_type = held.queue_type;
  perform private.clair_refresh_held_instruction(p_workspace_id, held.root_task_id, held.queue_type);
end
$$;

-- Covers legacy fulfillment entry points as well as the instruction commands.
create function private.clair_guard_held_work_item()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status or new.assigned_to_user_id is distinct from old.assigned_to_user_id
     or new.task_id is distinct from old.task_id or new.detailed_phase is distinct from old.detailed_phase then
    perform private.clair_assert_order_work_available(old.workspace_id, old.order_id);
  end if;
  return new;
end
$$;

create trigger clair_guard_held_work_item
before update of status, assigned_to_user_id, task_id, detailed_phase on public.order_fulfillment_work_items
for each row execute function private.clair_guard_held_work_item();

revoke all on function private.clair_active_work_hold(text,uuid,text),
  private.clair_assert_order_work_available(text,uuid), private.clair_refresh_held_instruction(text,uuid,text),
  private.clair_finish_order_edit_hold(text,uuid,uuid), private.clair_guard_held_work_item()
from public, anon, authenticated, service_role;
revoke all on function public.clair_manage_confirmed_order_edit_session(text,uuid,uuid,uuid,text)
from public, anon, service_role;
grant execute on function public.clair_manage_confirmed_order_edit_session(text,uuid,uuid,uuid,text) to authenticated;

create function pg_temp.patch_work_hold(signature text, anchor text, replacement text)
returns void language plpgsql as $$
declare definition text := pg_get_functiondef(signature::regprocedure);
begin
  if (length(definition) - length(replace(definition, anchor, ''))) / length(anchor) <> 1 then
    raise exception 'order_work_hold_anchor_mismatch: %', signature;
  end if;
  execute replace(definition, anchor, replacement);
end
$$;

select pg_temp.patch_work_hold('public.clair_edit_confirmed_order(text,uuid,uuid,jsonb)',
  $old$'commandId','expectedVersion','clinical','financial','reason'$old$,
  $new$'commandId','expectedVersion','clinical','financial','reason','editSessionId'$new$);
select pg_temp.patch_work_hold('public.clair_edit_confirmed_order(text,uuid,uuid,jsonb)',
  $old$ if not clinical_changed and not financial_changed then return before_context; end if;$old$,
  $new$ perform private.clair_finish_order_edit_hold(p_workspace_id,p_order_id,(p_command->>'editSessionId')::uuid);
 if not clinical_changed and not financial_changed then return before_context; end if;$new$);

select pg_temp.patch_work_hold('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
  $old$  perform private.clair_lock_work_ownership(p_workspace_id,p_order_id);$old$,
  $new$  perform private.clair_lock_work_ownership(p_workspace_id,p_order_id);
  perform private.clair_assert_order_work_available(p_workspace_id,p_order_id);$new$);

-- Add the same paused status and reason to the common scoped queue projection.
select pg_temp.patch_work_hold('public.clair_list_fulfillment_work_items_v2(text,text,uuid,uuid,text,date,uuid,uuid)',
  $old$    'status', item.status, 'priority', item.priority,$old$,
  $new$    'status', case when hold.reason is not null then 'paused' else item.status end,
    'pauseReason', hold.reason, 'pauseUntil', hold.expires_at, 'priority', item.priority,$new$);
select pg_temp.patch_work_hold('public.clair_list_fulfillment_work_items_v2(text,text,uuid,uuid,text,date,uuid,uuid)',
  $old$  left join public.user_memberships requester_membership$old$,
  $new$  left join lateral private.clair_active_work_hold(item.workspace_id,item.task_id,item.queue_type) hold
    on item.status in ('requested','in_progress','paused')
  left join public.user_memberships requester_membership$new$);
select pg_temp.patch_work_hold('public.clair_list_fulfillment_work_items_v2(text,text,uuid,uuid,text,date,uuid,uuid)',
  $old$and (p_status is null or item.status = p_status)$old$,
  $new$and (p_status is null or (case when hold.reason is not null then 'paused' else item.status end) = p_status)$new$);

-- Plan/Order can show the shared hold without changing task status or billing rules.
select pg_temp.patch_work_hold('public.clair_get_chart_order_execution_read_model(text,uuid)',
  $old$'destinationModule', task.destination_module, 'status', task.status,$old$,
  $new$'destinationModule', task.destination_module, 'status', task.status,
      'pauseReason', case when task.status in ('pending','in_progress','paused','partial_complete') then
        (private.clair_active_work_hold(task.workspace_id,task.id,task.destination_module)).reason end,$new$);

select pg_temp.patch_work_hold('public.clair_get_fulfillment_instruction(text,uuid)',
  $old$ 'firstStartedAt',($old$,
  $new$ 'pauseReason',(private.clair_active_work_hold(p_workspace_id,wi.task_id,wi.queue_type)).reason,
 'firstStartedAt',($new$);
select pg_temp.patch_work_hold('public.clair_mutate_fulfillment_instruction(text,uuid,jsonb)',
  $old$ if action='edit_instruction' then$old$,
  $new$ if doc->>'pauseReason' is not null then raise exception 'order_work_on_hold'; end if;
 if action='edit_instruction' then$new$);

-- Result writers and direct transitions use the same authority check after
-- obtaining the encounter lock, so stale clients cannot race a hold.
select pg_temp.patch_work_hold('private.clair_assert_work_owner(text,uuid,uuid,boolean)',
  $old$ perform private.clair_lock_work_ownership(p_workspace_id,p_order_id);$old$,
  $new$ perform private.clair_lock_work_ownership(p_workspace_id,p_order_id);
 perform private.clair_assert_order_work_available(p_workspace_id,p_order_id);$new$);
select pg_temp.patch_work_hold('public.clair_transition_fulfillment_work_item(text,uuid,uuid,text,bigint,uuid,uuid,text,text)',
  $old$  v_next_status := v_item.status;$old$,
  $new$  perform private.clair_assert_order_work_available(p_workspace_id,v_item.order_id);
  v_next_status := v_item.status;$new$);

commit;
