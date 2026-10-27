begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

alter table public.notification_events drop constraint notification_events_event_key_check;
alter table public.notification_events add constraint notification_events_event_key_check check (event_key in (
 'order_urgent_handoff','order_recheck_requested','assigned_order_completed','clinical_result_completed',
 'device_result_received','imaging_result_completed','waiting_over_30m','dispensing_treatment_completed',
 'billing_waiting_ready','inpatient_care_delayed','clinical_master_update_available',
 'order_assigned','order_assignment_cancelled','order_cancelled'));

create function private.clair_emit_instruction_notifications(wi public.order_fulfillment_work_items,event_key text,title text,recipients uuid[],event_token text)
returns void language plpgsql security definer set search_path='' as $$
declare recipient uuid; recipient_name text; domain text; event_id text; source jsonb; requester uuid;
begin
 requester:=wi.requested_by_user_id;
 for recipient in select distinct x from unnest(recipients) x where x is not null loop
   if not private.clair_notification_is_active_workspace_user(wi.workspace_id,recipient::text) then continue; end if;
   select display_name into recipient_name from public.users where id=recipient;
   domain:=case when recipient=requester then 'chart' else 'dispensing_treatment' end;
   event_id:='instruction:'||event_token||':'||event_key||':'||recipient;
   source:=jsonb_build_object('kind','order','entity_id',wi.order_id,
     'route','/w/'||wi.workspace_id||'/dispensing?modulePanel=open&encounterId='||wi.encounter_id||'&queueItemId=live-fulfillment-'||wi.id,
     'order_id',wi.order_id,'encounter_id',wi.encounter_id);
   insert into public.notification_events(workspace_id,notification_id,event_scope_id,event_key,dedupe_key,domain,priority,toast_policy,
     title,preview,detail,work_type_label,source_label,source_action_label,recipient_kind,recipient_id,recipient_label,recipient_payload,
     source_kind,source_entity_id,source_route,source_payload,requires_action,badge_count,actor_user_id,issued_at_label,occurred_at,created_at,updated_at)
   values(wi.workspace_id,event_id,'',event_key,event_id,domain,'normal','role_active',title,
     left(coalesce(nullif(wi.source_snapshot->>'orderDisplayName',''),'오더'),240),
     '지시서에서 최신 상태와 변경 내용을 확인해 주세요.',case when wi.queue_type='dispensing' then '조제' else '처치' end,
     left(coalesce(nullif(wi.source_snapshot->>'orderDisplayName',''),'오더'),160),'오더 보기','user',recipient::text,
     coalesce(recipient_name,'담당자'),jsonb_build_object('kind','user','id',recipient,'label',coalesce(recipient_name,'담당자')),
     'order',wi.order_id::text,source->>'route',source,true,true,auth.uid(),'방금 전',now(),now(),now())
   on conflict(workspace_id,event_scope_id,dedupe_key) do nothing;
 end loop;
end $$;
revoke all on function private.clair_emit_instruction_notifications(public.order_fulfillment_work_items,text,text,uuid[],text) from public,anon,authenticated,service_role;

-- Called only by the canonical queue trigger. No new public emission authority.
create function private.clair_notify_instruction_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare event_key text; title text; recipient uuid; recipients uuid[]; requester uuid;
 event_id text; recipient_name text; domain text; source jsonb; main uuid;
begin
 if new.queue_type not in ('dispensing','treatment') or auth.uid() is null then return new; end if;
 if tg_op='UPDATE' and old.status='completed' and new.status='in_progress' then return new; end if;
 requester:=new.requested_by_user_id;
 select s.main_assignee_id into main from public.order_tasks t join private.fulfillment_instruction_state s
 on s.workspace_id=t.workspace_id and s.root_task_id=coalesce(t.parent_task_id,t.id) and s.queue_type=new.queue_type
 where t.workspace_id=new.workspace_id and t.id=new.task_id;
 if tg_op='INSERT' then
   if new.assigned_to_user_id is null and main is null then return new; end if;
   if new.request_cycle>1 then event_key:='order_recheck_requested'; title:='담당 오더가 다시 요청되었습니다';
   else event_key:='order_assigned'; title:='담당 오더가 요청되었습니다'; end if;
   recipients:=array[new.assigned_to_user_id,main];
 elsif new.status='cancelled' and old.status is distinct from new.status then
   event_key:='order_cancelled'; title:='담당 오더가 취소되었습니다'; recipients:=array[old.assigned_to_user_id,new.assigned_to_user_id,main];
 elsif new.status='completed' and old.status is distinct from new.status then
   event_key:='assigned_order_completed'; title:='오더가 완료되었습니다'; recipients:=array[requester,new.assigned_to_user_id,main];
 elsif new.request_cycle is distinct from old.request_cycle or
   new.source_snapshot->'detailInputs' is distinct from old.source_snapshot->'detailInputs' or
   new.source_snapshot->'instruction' is distinct from old.source_snapshot->'instruction' then
   event_key:='order_recheck_requested'; title:='담당 오더가 수정되었습니다'; recipients:=array[old.assigned_to_user_id,new.assigned_to_user_id,main];
 elsif new.assigned_to_user_id is null and old.assigned_to_user_id is not null then
   event_key:='order_assignment_cancelled'; title:='오더의 담당이 취소되었습니다'; recipients:=array[requester];
 elsif new.assigned_to_user_id is distinct from old.assigned_to_user_id and new.assigned_to_user_id is not null then
   event_key:='order_assigned'; title:='담당 오더가 지정되었습니다'; recipients:=array[new.assigned_to_user_id];
 else return new; end if;
 perform private.clair_emit_instruction_notifications(new,event_key,title,recipients,new.id||':'||new.row_revision);
 return new;
end $$;
revoke all on function private.clair_notify_instruction_change() from public,anon,authenticated,service_role;
create trigger instruction_notification_after_change after insert or update on public.order_fulfillment_work_items
for each row execute function private.clair_notify_instruction_change();
-- Root events cover annotation-only changes and explicit set finalization even
-- when no child row changes. Command IDs make retries deterministic.
create function private.clair_notify_instruction_root_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare root public.order_tasks; wi public.order_fulfillment_work_items; recipients uuid[];
 action text; token text; event_key text; title text;
begin
 if auth.uid() is null then return new; end if;
 if tg_table_name='order_events' then
   action:=new.payload->>'action'; token:=new.payload->>'commandId';
   if action is distinct from 'instruction_text_changed' then return new; end if;
   select * into root from public.order_tasks where workspace_id=new.workspace_id and order_id=new.order_id and task_role='aggregate' order by attempt_no desc limit 1;
 else
   action:=new.after_values->>'action'; token:=new.after_values->>'commandId';
   if action is null or action not in ('claim','unassign','complete_all') then return new; end if;
   select * into root from public.order_tasks where workspace_id=new.workspace_id and id=new.task_id and task_role='aggregate';
 end if;
 if root.id is null then return new; end if;
 for wi in select distinct on(w.queue_type) w.* from public.order_fulfillment_work_items w join public.order_tasks t on t.workspace_id=w.workspace_id and t.id=w.task_id
   where t.workspace_id=root.workspace_id and t.parent_task_id=root.id and w.queue_type in ('dispensing','treatment') order by w.queue_type,t.attempt_no desc,w.id loop
   if action='instruction_text_changed' then
     event_key:='order_recheck_requested'; title:='공통 지시가 수정되었습니다';
     select array_agg(distinct executor) into recipients from (
       select w.assigned_to_user_id executor from public.order_fulfillment_work_items w join public.order_tasks t on t.workspace_id=w.workspace_id and t.id=w.task_id
       where t.workspace_id=root.workspace_id and t.parent_task_id=root.id and w.queue_type=wi.queue_type and w.status not in ('cancelled','returned')
         and not exists(select 1 from public.order_tasks newer where newer.workspace_id=t.workspace_id and newer.order_id=t.order_id and newer.attempt_no>t.attempt_no)
       union select s.main_assignee_id from private.fulfillment_instruction_state s where s.workspace_id=root.workspace_id and s.root_task_id=root.id and s.queue_type=wi.queue_type
     ) assigned;
   elsif action='claim' then
     event_key:='order_assigned'; title:='세트 오더의 담당자가 되었습니다'; recipients:=array[auth.uid()];
   elsif action='unassign' then
     event_key:='order_assignment_cancelled'; title:='세트 오더의 담당이 취소되었습니다'; recipients:=array[wi.requested_by_user_id];
   else
     event_key:='assigned_order_completed'; title:='세트 오더가 완료되었습니다'; recipients:=array[wi.requested_by_user_id,(select main_assignee_id from private.fulfillment_instruction_state where workspace_id=root.workspace_id and root_task_id=root.id and queue_type=wi.queue_type)];
   end if;
   perform private.clair_emit_instruction_notifications(wi,event_key,title,recipients,'root:'||root.id||':'||wi.queue_type||':'||token);
 end loop;
 return new;
end $$;
revoke all on function private.clair_notify_instruction_root_event() from public,anon,authenticated,service_role;
create trigger instruction_annotation_notification after insert on public.order_events for each row execute function private.clair_notify_instruction_root_event();
create trigger instruction_root_notification after insert on public.order_task_events for each row execute function private.clair_notify_instruction_root_event();
commit;
