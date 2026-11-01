-- Local candidate. Additive chart instructions and explicit performer review.
-- Historical PO revisions/snapshots retain their original meaning.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create function private.clair_instruction_text_length(value text)
returns integer language sql immutable strict set search_path='' as $$
 select coalesce(sum(case when ascii(ch)>65535 then 2 else 1 end),0)::integer
 from regexp_split_to_table(value,'') ch;
$$;

-- Same whitespace definition as String.trim() in the authoring contract.
create function private.clair_instruction_has_text(value text)
returns boolean language sql immutable strict set search_path='' as $$
 select length(btrim(value,chr(9)||chr(10)||chr(11)||chr(12)||chr(13)||chr(32)||chr(160)||chr(5760)
  ||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)
  ||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279)))>0;
$$;

create table private.chart_instruction_revisions (
 workspace_id text not null, chart_id uuid not null references public.soap_notes(id),
 scope text not null check(scope in ('overall','consultation','clinical_lab','imaging','external_lab','dispensing','treatment','hospitalization','system_exam','other')),
 revision integer not null check(revision>0), instruction text not null check(private.clair_instruction_text_length(instruction)<=5000),
 deleted boolean not null default false, actor_id uuid not null references public.users(id),
 apply_id uuid not null, created_at timestamptz not null default clock_timestamp(),
 primary key(workspace_id,chart_id,scope,revision),
 check((deleted and instruction='') or (not deleted and private.clair_instruction_has_text(instruction)))
);
create table private.chart_instruction_applies (
 workspace_id text not null, command_id uuid not null, chart_id uuid not null references public.soap_notes(id),
 actor_id uuid not null references public.users(id), request jsonb not null, response jsonb not null,
 created_at timestamptz not null default clock_timestamp(), primary key(workspace_id,command_id)
);
create table private.task_instruction_snapshots (
 id uuid primary key default gen_random_uuid(), workspace_id text not null,
 task_id uuid not null references public.order_tasks(id), request_cycle integer not null,
 phase text not null check(phase in ('requested','completed')),
 chart_id uuid not null references public.soap_notes(id), document jsonb not null,
 captured_at timestamptz not null default clock_timestamp()
);
create unique index task_instruction_request_once on private.task_instruction_snapshots(workspace_id,task_id,request_cycle) where phase='requested';
create table private.chart_instruction_acknowledgements (
 workspace_id text not null, chart_id uuid not null references public.soap_notes(id),
 actor_id uuid not null references public.users(id), scope text not null, version_key text not null,
 document jsonb not null, acknowledged_at timestamptz not null default clock_timestamp(),
 primary key(workspace_id,chart_id,actor_id,version_key)
);
revoke all on private.chart_instruction_revisions,private.chart_instruction_applies,
 private.task_instruction_snapshots,private.chart_instruction_acknowledgements from public,anon,authenticated,service_role;

create function private.clair_instruction_chart_for_order(p_workspace_id text,p_order_id uuid)
returns uuid language sql stable set search_path='' as $$
 select coalesce(o.origin_chart_id,parent.origin_chart_id) from public.orders o
 left join public.orders parent on parent.workspace_id=o.workspace_id and parent.id=o.parent_chart_order_line_id
 where o.workspace_id=p_workspace_id and o.id=p_order_id;
$$;

create function private.clair_chart_instruction_document(p_workspace_id text,p_chart_id uuid)
returns jsonb language sql stable set search_path='' as $$
 with revisions as (
  select r.scope,r.revision,r.instruction,r.deleted,r.actor_id,r.created_at,r.apply_id,false legacy
  from private.chart_instruction_revisions r where r.workspace_id=p_workspace_id and r.chart_id=p_chart_id
  union all
  select 'dispensing',r.revision,r.instruction,r.instruction='',r.actor_id,r.created_at,null::uuid,true
  from private.chart_oral_instruction_revisions r where r.workspace_id=p_workspace_id and r.chart_id=p_chart_id
 ), serialized as (
  select scope,revision,legacy,jsonb_build_object('scope',scope,'revision',revision,'instruction',instruction,
    'deleted',deleted,'actorId',actor_id,'actorName',(select display_name from public.users where id=actor_id),
    'createdAt',created_at,'applyId',apply_id,'legacy',legacy) value from revisions
 ), current_values as (select distinct on(scope) * from serialized order by scope,legacy,revision desc)
 select jsonb_build_object('chartId',p_chart_id,
  'current',coalesce((select jsonb_agg(value order by case when scope='overall' then 0 else 1 end,scope) from current_values),'[]'::jsonb),
  'history',coalesce((select jsonb_agg(value order by (value->>'createdAt') desc,revision desc) from serialized),'[]'::jsonb));
$$;

create function public.clair_get_overall_instructions(p_workspace_id text,p_chart_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n public.soap_notes; scopes jsonb; reason text;
begin
 if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id)
   or not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view') then
   raise exception 'permission_missing' using errcode='42501'; end if;
 select * into n from public.soap_notes where workspace_id=p_workspace_id and id=p_chart_id and status<>'voided';
 if not found then raise exception 'chart_unavailable'; end if;
 perform private.clair_require_chart_encounter(p_workspace_id,n.encounter_id,auth.uid()::text,false);
 select coalesce(jsonb_agg(s order by s),'[]'::jsonb) into scopes from (
  select distinct o.clinical_order_type s from public.orders o
  where o.workspace_id=p_workspace_id and private.clair_instruction_chart_for_order(p_workspace_id,o.id)=p_chart_id
   and o.order_confirmation_status='confirmed'
 ) q;
 if not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:update') then reason:='permission_missing';
 elsif n.status not in ('draft','autosaved') then reason:='signed_chart_read_only';
 elsif not exists(select 1 from public.encounters where workspace_id=p_workspace_id and id=n.encounter_id and status in ('in_consultation','ordered')) then reason:='encounter_read_only';
 elsif jsonb_array_length(scopes)=0 then reason:='no_confirmed_orders';
 elsif not exists(select 1 from public.orders o where o.workspace_id=p_workspace_id
   and private.clair_instruction_chart_for_order(p_workspace_id,o.id)=p_chart_id and o.order_confirmation_status='confirmed'
   and o.status not in ('completed','cancelled','returned')) then reason:='terminal_orders'; end if;
 return private.clair_chart_instruction_document(p_workspace_id,p_chart_id)
   || jsonb_build_object('canEdit',reason is null,'readOnlyReason',reason,'eligibleScopes',case when jsonb_array_length(scopes)>0 then '["overall"]'::jsonb||scopes else scopes end);
end $$;

-- This producer has no callable client entry. Save and notification insert are
-- one transaction. A failed insert rolls back the apply, never losing delivery.
create function private.clair_notify_overall_instructions(p_workspace_id text,p_chart_id uuid,p_apply_id uuid,p_scopes text[])
returns void language plpgsql security definer set search_path='' as $$
declare row record; event_id text; route text; source jsonb;
begin
 for row in
  select distinct on(recipient) recipient,wi.* from public.order_fulfillment_work_items wi
  join public.order_tasks t on t.workspace_id=wi.workspace_id and t.id=wi.task_id
  left join private.fulfillment_instruction_state state on state.workspace_id=t.workspace_id
   and state.root_task_id=coalesce(t.parent_task_id,t.id) and state.queue_type=wi.queue_type
  cross join lateral unnest(array[wi.assigned_to_user_id,state.main_assignee_id]) recipient
  where wi.workspace_id=p_workspace_id and private.clair_instruction_chart_for_order(p_workspace_id,wi.order_id)=p_chart_id
   and wi.status not in ('completed','cancelled','returned') and recipient is not null
   and ('overall'=any(p_scopes) or t.clinical_order_type=any(p_scopes))
   and not exists(select 1 from public.order_tasks newer where newer.workspace_id=t.workspace_id and newer.order_id=t.order_id and newer.attempt_no>t.attempt_no)
   and private.clair_notification_is_active_workspace_user(p_workspace_id,recipient::text)
  order by recipient,wi.id
 loop
  event_id:='overall-instruction:'||p_chart_id||':'||p_apply_id||':'||row.recipient;
  route:='/w/'||p_workspace_id||'/'||case when row.queue_type='treatment' then 'dispensing' else row.queue_type end
    ||'?modulePanel=open&date='||to_char(coalesce(row.due_at,row.created_at) at time zone 'Asia/Seoul','YYYY-MM-DD')||'&encounterId='||row.encounter_id||case when row.queue_type='lab' then '&labResultId=live-lab-' when row.queue_type='imaging' then '&imagingStudyId=live-imaging-' else '&queueItemId=live-fulfillment-' end||row.id;
  source:=jsonb_build_object('kind','order','entity_id',row.order_id,'route',route,'order_id',row.order_id,'encounter_id',row.encounter_id);
  insert into public.notification_events(workspace_id,notification_id,event_scope_id,event_key,dedupe_key,domain,priority,toast_policy,
   title,preview,detail,work_type_label,source_label,source_action_label,recipient_kind,recipient_id,recipient_label,recipient_payload,
   source_kind,source_entity_id,source_route,source_payload,requires_action,badge_count,actor_user_id,issued_at_label,occurred_at,created_at,updated_at)
  values(p_workspace_id,event_id,'','overall_instruction_changed',event_id,
   case when row.queue_type='lab' then 'lab' when row.queue_type='imaging' then 'imaging' else 'dispensing_treatment' end,
   'normal','role_active','총괄 지시사항이 변경되었습니다','최신 지시를 확인해 주세요.','수행 전 변경 내용을 확인해 주세요.',
   '지시사항','총괄 지시사항','변경 내용 확인','user',row.recipient::text,'담당자',jsonb_build_object('kind','user','id',row.recipient,'label','담당자'),
   'order',row.order_id::text,route,source,true,true,auth.uid(),'방금 전',now(),now(),now())
  on conflict(workspace_id,event_scope_id,dedupe_key) do nothing;
 end loop;
end $$;

create function public.clair_apply_overall_instructions(p_workspace_id text,p_chart_id uuid,p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n public.soap_notes; d jsonb; item jsonb; current_value jsonb; receipt private.chart_instruction_applies;
 command uuid; changed text[]:='{}'; revision integer; body text; is_delete boolean;
begin
 d:=public.clair_get_overall_instructions(p_workspace_id,p_chart_id);
 if jsonb_typeof(p_command) is distinct from 'object' or jsonb_typeof(p_command->'changes') is distinct from 'array'
   or jsonb_array_length(p_command->'changes') not between 1 and 10
   or exists(select 1 from jsonb_object_keys(p_command) k where k not in ('commandId','changes')) then raise exception 'invalid_input'; end if;
 begin command:=(p_command->>'commandId')::uuid; exception when invalid_text_representation then raise exception 'invalid_input'; end;
 if command is null then raise exception 'invalid_input'; end if;
 select * into n from public.soap_notes where workspace_id=p_workspace_id and id=p_chart_id;
 -- Match ownership/confirmation: encounter, work rows, then chart. All chart
 -- edits and acknowledgements use the same encounter lock before chart locks.
 perform pg_advisory_xact_lock(hashtextextended('clinical_billing:'||p_workspace_id||':'||n.encounter_id::text,0));
 perform 1 from public.encounters where workspace_id=p_workspace_id and id=n.encounter_id for update;
 perform wi.id from public.order_fulfillment_work_items wi where wi.workspace_id=p_workspace_id
   and private.clair_instruction_chart_for_order(p_workspace_id,wi.order_id)=p_chart_id order by wi.id for update;
 perform 1 from public.soap_notes where workspace_id=p_workspace_id and id=p_chart_id for update;
 select * into receipt from private.chart_instruction_applies where workspace_id=p_workspace_id and command_id=command;
 if found then
  if receipt.chart_id<>p_chart_id or receipt.actor_id<>auth.uid() or receipt.request<>p_command then raise exception 'idempotency_conflict'; end if;
  return receipt.response;
 end if;
 d:=public.clair_get_overall_instructions(p_workspace_id,p_chart_id);
 if not (d->>'canEdit')::boolean then raise exception '%',d->>'readOnlyReason'; end if;
 perform private.clair_require_chart_encounter(p_workspace_id,n.encounter_id,auth.uid()::text,true);
 if (select count(*) from jsonb_array_elements(p_command->'changes'))<>(select count(distinct x->>'scope') from jsonb_array_elements(p_command->'changes') x) then raise exception 'invalid_input'; end if;
 for item in select x from jsonb_array_elements(p_command->'changes') x loop
  if jsonb_typeof(item) is distinct from 'object' or not (d->'eligibleScopes' ? (item->>'scope'))
   or coalesce(item->>'operation','') not in ('set','delete')
   or jsonb_typeof(item->'expectedRevision') is distinct from 'number'
   or coalesce(item->>'expectedRevision','')!~'^[0-9]+$'
   or exists(select 1 from jsonb_object_keys(item) k where k not in ('scope','expectedRevision','operation','instruction')) then raise exception 'invalid_input'; end if;
  select x into current_value from jsonb_array_elements(d->'current') x where x->>'scope'=item->>'scope';
  revision:=coalesce((current_value->>'revision')::integer,0);
  if revision<>(item->>'expectedRevision')::numeric then raise exception 'revision_conflict'; end if;
  is_delete:=item->>'operation'='delete'; body:=case when is_delete then '' else item->>'instruction' end;
  if (is_delete and item ? 'instruction') or (not is_delete and (jsonb_typeof(item->'instruction') is distinct from 'string' or not private.clair_instruction_has_text(body) or private.clair_instruction_text_length(body)>5000)) then raise exception 'invalid_input'; end if;
  if (is_delete and (current_value is null or (current_value->>'deleted')::boolean))
    or (not is_delete and not coalesce((current_value->>'legacy')::boolean,false) and not coalesce((current_value->>'deleted')::boolean,false) and current_value->>'instruction'=body) then continue; end if;
  insert into private.chart_instruction_revisions(workspace_id,chart_id,scope,revision,instruction,deleted,actor_id,apply_id)
   values(p_workspace_id,p_chart_id,item->>'scope',revision+1,body,is_delete,auth.uid(),command);
  changed:=array_append(changed,item->>'scope');
 end loop;
 if cardinality(changed)>0 then
  update public.order_fulfillment_work_items wi set row_revision=row_revision+1,updated_at=clock_timestamp()
  where wi.workspace_id=p_workspace_id and private.clair_instruction_chart_for_order(p_workspace_id,wi.order_id)=p_chart_id
   and wi.status not in ('completed','cancelled','returned')
   and ('overall'=any(changed) or exists(select 1 from public.order_tasks t where t.workspace_id=wi.workspace_id and t.id=wi.task_id and t.clinical_order_type=any(changed)));
  perform private.clair_notify_overall_instructions(p_workspace_id,p_chart_id,command,changed);
 end if;
 d:=public.clair_get_overall_instructions(p_workspace_id,p_chart_id);
 insert into private.chart_instruction_applies(workspace_id,command_id,chart_id,actor_id,request,response) values(p_workspace_id,command,p_chart_id,auth.uid(),p_command,d);
 return d;
end $$;

-- Resolve only the task's overall + canonical category scopes. Queue names do
-- not determine clinical applicability. Legacy PO is never applied to non-PO.
create function private.clair_order_effective_instructions(p_workspace_id text,p_order_id uuid,p_scope text,p_snapshot jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
declare o public.orders; chart uuid; entries jsonb; versions jsonb; legacy jsonb; scope_revision integer;
begin
 select * into o from public.orders where workspace_id=p_workspace_id and id=p_order_id;
 chart:=private.clair_instruction_chart_for_order(p_workspace_id,p_order_id);
 if chart is null then return null; end if;
 select coalesce(jsonb_agg(jsonb_build_object('scope',r.scope,'revision',r.revision,'instruction',r.instruction,'deleted',r.deleted,
   'actorName',(select display_name from public.users where id=r.actor_id),'createdAt',r.created_at,'legacy',false) order by r.scope),'[]'::jsonb),
   coalesce(jsonb_object_agg(r.scope,r.revision),'{}'::jsonb)
 into entries,versions from (select distinct on(scope) * from private.chart_instruction_revisions
   where workspace_id=p_workspace_id and chart_id=chart and scope in ('overall',p_scope) order by scope,revision desc) r;
 -- Absent category instructions add no version: the same overall-only review
 -- can be reused across categories. A category revision/tombstone adds its key.
 versions:=jsonb_build_object('overall',0)||versions;
 scope_revision:=coalesce((versions->>p_scope)::integer,0);
 if p_scope='dispensing' and scope_revision=0
   and coalesce(p_snapshot#>>'{detailInputs,route}',p_snapshot#>>'{detailInputs,administrationRoute}',o.detail_inputs->>'route',o.detail_inputs->>'administrationRoute','')='PO' then
   select jsonb_build_object('scope','dispensing','revision',r.revision,'instruction',r.instruction,'deleted',r.instruction='',
     'actorName',(select display_name from public.users where id=r.actor_id),'createdAt',r.created_at,'legacy',true) into legacy
   from private.chart_oral_instruction_revisions r where workspace_id=p_workspace_id and chart_id=chart order by revision desc limit 1;
   if legacy is not null then entries:=entries||jsonb_build_array(legacy); versions:=versions||jsonb_build_object('legacyPO',(legacy->>'revision')::integer); end if;
 end if;
 return jsonb_build_object('chartId',chart,'scope',p_scope,'entries',entries,'versions',versions,
   'versionKey',encode(extensions.digest(versions::text,'sha256'),'hex'));
end $$;

create function private.clair_task_effective_instructions(p_workspace_id text,p_task_id uuid)
returns jsonb language sql stable set search_path='' as $$
 select private.clair_order_effective_instructions(p_workspace_id,t.order_id,t.clinical_order_type,t.effective_snapshot)
 from public.order_tasks t where t.workspace_id=p_workspace_id and t.id=p_task_id;
$$;

-- A chart-only V1 order can complete at confirmation, before a task exists.
-- Give the author the same explicit review using the persisted draft order.
create function public.clair_get_order_instruction_review(p_workspace_id text,p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders; d jsonb; previous jsonb; acknowledged boolean;
begin
 if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id)
   or not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view') then
   raise exception 'permission_missing' using errcode='42501'; end if;
 select * into o from public.orders where workspace_id=p_workspace_id and id=p_order_id;
 if not found then raise exception 'task_unavailable'; end if;
 perform private.clair_require_chart_encounter(p_workspace_id,o.encounter_id,auth.uid()::text,false);
 d:=private.clair_order_effective_instructions(p_workspace_id,o.id,o.clinical_order_type,'{}'::jsonb);
 if d is null then return jsonb_build_object('orderId',p_order_id,'current',null,'previous',null,'snapshots','[]'::jsonb,'requiresAcknowledgement',false); end if;
 select document into previous from private.chart_instruction_acknowledgements
 where workspace_id=p_workspace_id and chart_id=(d->>'chartId')::uuid and actor_id=auth.uid() and (scope=o.clinical_order_type or version_key=d->>'versionKey')
 order by (version_key=d->>'versionKey') desc,acknowledged_at desc limit 1;
 acknowledged:=exists(select 1 from private.chart_instruction_acknowledgements where workspace_id=p_workspace_id
 and chart_id=(d->>'chartId')::uuid and actor_id=auth.uid() and version_key=d->>'versionKey');
 return jsonb_build_object('orderId',p_order_id,'current',d,'previous',previous,'snapshots','[]'::jsonb,
 'requiresAcknowledgement',not acknowledged and exists(select 1 from jsonb_each_text(d->'versions') v where v.value::integer>0));
end $$;

create function public.clair_acknowledge_order_instructions(p_workspace_id text,p_order_id uuid,p_version_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb; o public.orders;
begin
 d:=public.clair_get_order_instruction_review(p_workspace_id,p_order_id);
 select * into o from public.orders where workspace_id=p_workspace_id and id=p_order_id;
 perform private.clair_lock_work_ownership(p_workspace_id,o.id);
 perform 1 from public.encounters where workspace_id=p_workspace_id and id=o.encounter_id for update;
 perform 1 from public.soap_notes where workspace_id=p_workspace_id and id=private.clair_instruction_chart_for_order(p_workspace_id,o.id) for update;
 d:=public.clair_get_order_instruction_review(p_workspace_id,p_order_id);
 if d->'current'='null'::jsonb or d#>>'{current,versionKey}' is distinct from p_version_key then raise exception 'instruction_version_conflict'; end if;
 insert into private.chart_instruction_acknowledgements(workspace_id,chart_id,actor_id,scope,version_key,document)
 values(p_workspace_id,(d#>>'{current,chartId}')::uuid,auth.uid(),d#>>'{current,scope}',p_version_key,d->'current') on conflict do nothing;
 return public.clair_get_order_instruction_review(p_workspace_id,p_order_id);
end $$;

create function public.clair_get_order_instruction_reviews(p_workspace_id text,p_order_ids uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid; result jsonb:='[]';
begin
 if p_order_ids is null or cardinality(p_order_ids) not between 1 and 100 then raise exception 'invalid_input'; end if;
 for target in select distinct unnest(p_order_ids) loop
 result:=result||jsonb_build_array(public.clair_get_order_instruction_review(p_workspace_id,target));
 end loop;
 return result;
end $$;

-- Present old PO evidence with its original applicability; never backfill it
-- as an overall or all-dispensing instruction.
create function private.clair_legacy_instruction_snapshot_document(s private.task_oral_instruction_snapshots)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('chartId',s.chart_id,'scope','dispensing',
  'versions',jsonb_build_object('legacyPO',s.revision),
  'versionKey',encode(extensions.digest(jsonb_build_object('legacyPO',s.revision)::text,'sha256'),'hex'),
  'entries',jsonb_build_array(jsonb_build_object('scope','dispensing','revision',s.revision,'instruction',s.instruction,
    'deleted',s.instruction='','legacy',true,'actorName',u.display_name,'createdAt',r.created_at)))
 from (select 1) seed left join private.chart_oral_instruction_revisions r
   on r.workspace_id=s.workspace_id and r.chart_id=s.chart_id and r.revision=s.revision
 left join public.users u on u.id=r.actor_id;
$$;

create function public.clair_get_task_instruction_review(p_workspace_id text,p_task_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.order_tasks; d jsonb; previous jsonb; history jsonb; acknowledged boolean;
begin
 if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'permission_missing' using errcode='42501'; end if;
 select * into t from public.order_tasks where workspace_id=p_workspace_id and id=p_task_id and task_role='execution';
 if not found then raise exception 'task_unavailable'; end if;
 if not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view')
   and (t.destination_module is null or not private.clair_current_user_has_workspace_permission(p_workspace_id,private.clair_queue_permission_for_destination(t.destination_module,'read'))) then
   raise exception 'permission_missing' using errcode='42501'; end if;
 if t.destination_module is null then perform private.clair_require_chart_encounter(p_workspace_id,t.encounter_id,auth.uid()::text,false); end if;
 d:=private.clair_task_effective_instructions(p_workspace_id,p_task_id);
 if d is null then return jsonb_build_object('taskId',p_task_id,'current',null,'previous',null,'snapshots','[]'::jsonb,'requiresAcknowledgement',false); end if;
 select document into previous from private.chart_instruction_acknowledgements
   where workspace_id=p_workspace_id and chart_id=(d->>'chartId')::uuid and actor_id=auth.uid() and (scope=t.clinical_order_type or version_key=d->>'versionKey')
   order by (version_key=d->>'versionKey') desc,acknowledged_at desc limit 1;
 acknowledged:=exists(select 1 from private.chart_instruction_acknowledgements where workspace_id=p_workspace_id
   and chart_id=(d->>'chartId')::uuid and actor_id=auth.uid() and version_key=d->>'versionKey');
 if previous is null then select document into previous from private.task_instruction_snapshots
   where workspace_id=p_workspace_id and task_id=t.id and request_cycle=t.request_cycle and phase='requested' order by captured_at limit 1; end if;
 select coalesce(jsonb_agg(value order by captured_at),'[]'::jsonb) into history from (
  select s.captured_at,jsonb_build_object('phase',s.phase,'document',s.document,'capturedAt',s.captured_at,
    'taskId',s.task_id,'attemptNo',previous_task.attempt_no,'requestCycle',s.request_cycle) value
  from private.task_instruction_snapshots s join public.order_tasks previous_task on previous_task.workspace_id=s.workspace_id and previous_task.id=s.task_id
  where s.workspace_id=p_workspace_id and previous_task.order_id=t.order_id
  union all
  select s.captured_at,jsonb_build_object('phase',s.phase,'document',private.clair_legacy_instruction_snapshot_document(s),
    'capturedAt',s.captured_at,'taskId',s.task_id,'attemptNo',previous_task.attempt_no,'legacy',true)
  from private.task_oral_instruction_snapshots s join public.order_tasks previous_task on previous_task.workspace_id=s.workspace_id and previous_task.id=s.task_id
  where s.workspace_id=p_workspace_id and previous_task.order_id=t.order_id
 ) snapshots;
 if previous is null then select value->'document' into previous from jsonb_array_elements(history) value
   where value->>'taskId'=t.id::text and value->>'phase'='requested' order by value->>'capturedAt' desc limit 1; end if;
 return jsonb_build_object('taskId',p_task_id,'current',d,'previous',previous,'snapshots',history,
   'requiresAcknowledgement',not acknowledged and not exists(select 1 from public.order_tasks newer where newer.workspace_id=t.workspace_id and newer.order_id=t.order_id and newer.attempt_no>t.attempt_no) and exists(select 1 from jsonb_each_text(d->'versions') v where v.value::integer>0));
end $$;

create function public.clair_acknowledge_task_instructions(p_workspace_id text,p_task_id uuid,p_version_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb; t public.order_tasks;
begin
 d:=public.clair_get_task_instruction_review(p_workspace_id,p_task_id);
 select * into t from public.order_tasks where workspace_id=p_workspace_id and id=p_task_id;
 if exists(select 1 from public.order_tasks newer where newer.workspace_id=t.workspace_id and newer.order_id=t.order_id and newer.attempt_no>t.attempt_no) then raise exception 'task_unavailable'; end if;
 perform private.clair_lock_work_ownership(p_workspace_id,t.order_id);
 if exists(select 1 from public.order_tasks newer where newer.workspace_id=t.workspace_id and newer.order_id=t.order_id and newer.attempt_no>t.attempt_no) then raise exception 'task_unavailable'; end if;
 perform 1 from public.encounters where workspace_id=p_workspace_id and id=t.encounter_id for update;
 perform 1 from public.soap_notes where workspace_id=p_workspace_id and id=private.clair_instruction_chart_for_order(p_workspace_id,t.order_id) for update;
 d:=public.clair_get_task_instruction_review(p_workspace_id,p_task_id);
 if d->'current'='null'::jsonb or d#>>'{current,versionKey}' is distinct from p_version_key then raise exception 'instruction_version_conflict'; end if;
 insert into private.chart_instruction_acknowledgements(workspace_id,chart_id,actor_id,scope,version_key,document)
 values(p_workspace_id,(d#>>'{current,chartId}')::uuid,auth.uid(),d#>>'{current,scope}',p_version_key,d->'current') on conflict do nothing;
 return public.clair_get_task_instruction_review(p_workspace_id,p_task_id);
end $$;

-- Bound the batch to this workspace; each task applies its own read authority.
create function public.clair_get_instruction_reviews(p_workspace_id text,p_task_ids uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare task uuid; result jsonb:='[]';
begin
 if p_task_ids is null or cardinality(p_task_ids) not between 1 and 100 then raise exception 'invalid_input'; end if;
 for task in select distinct unnest(p_task_ids) loop
  result:=result||jsonb_build_array(public.clair_get_task_instruction_review(p_workspace_id,task));
 end loop;
 return result;
end $$;
revoke all on function public.clair_get_instruction_reviews(text,uuid[]) from public,anon,service_role;
grant execute on function public.clair_get_instruction_reviews(text,uuid[]) to authenticated;

-- Called only after each canonical writer has checked its own authorization.
-- Lock the chart until the surrounding transition/snapshot transaction commits.
create function private.clair_require_task_instruction_ack(p_workspace_id text,p_task_id uuid,p_actor_id uuid)
returns void language plpgsql set search_path='' as $$
declare chart uuid; d jsonb;
begin
 if p_actor_id is distinct from auth.uid() then raise exception 'actor_mismatch' using errcode='42501'; end if;
 select private.clair_instruction_chart_for_order(p_workspace_id,order_id) into chart from public.order_tasks where workspace_id=p_workspace_id and id=p_task_id;
 if chart is null then return; end if;
 perform 1 from public.soap_notes where workspace_id=p_workspace_id and id=chart for update;
 d:=private.clair_task_effective_instructions(p_workspace_id,p_task_id);
 if exists(select 1 from jsonb_each_text(d->'versions') v where v.value::integer>0)
   and not exists(select 1 from private.chart_instruction_acknowledgements where workspace_id=p_workspace_id and chart_id=chart
     and actor_id=p_actor_id and version_key=d->>'versionKey') then raise exception 'instruction_ack_required'; end if;
end $$;

create function private.clair_capture_task_instructions()
returns trigger language plpgsql security definer set search_path='' as $$
declare chart uuid; phase text; d jsonb;
begin
 if new.task_role='aggregate' then return new; end if;
 if tg_op='INSERT' and new.status in ('in_progress','complete') then
  perform private.clair_require_task_instruction_ack(new.workspace_id,new.id,auth.uid());
 end if;
 phase:=case when tg_op='INSERT' or (tg_op='UPDATE' and new.request_cycle is distinct from old.request_cycle) then 'requested'
   when new.status='complete' and old.status is distinct from new.status then 'completed' end;
 if phase is null then return new; end if;
 chart:=private.clair_instruction_chart_for_order(new.workspace_id,new.order_id);
 if chart is null then return new; end if;
 perform 1 from public.soap_notes where workspace_id=new.workspace_id and id=chart for update;
 d:=private.clair_task_effective_instructions(new.workspace_id,new.id);
 insert into private.task_instruction_snapshots(workspace_id,task_id,request_cycle,phase,chart_id,document)
 values(new.workspace_id,new.id,new.request_cycle,phase,chart,d) on conflict do nothing;
 -- An immediately-completed task has both request and completion evidence.
 if tg_op='INSERT' and new.status='complete' then
  insert into private.task_instruction_snapshots(workspace_id,task_id,request_cycle,phase,chart_id,document)
  values(new.workspace_id,new.id,new.request_cycle,'completed',chart,d);
 end if;
 return new;
end $$;
-- The composite snapshots now own new evidence. Keep the old table and read
-- API intact, but stop the old PO trigger from recording superseded content.
drop trigger capture_task_oral_instruction on public.order_tasks;
create trigger capture_task_instructions after insert or update of status,request_cycle on public.order_tasks
 for each row execute function private.clair_capture_task_instructions();

-- Chart confirmation and execution wrappers previously locked encounter/chart
-- before their underlying writer acquired the ownership advisory. Use one order
-- for both sides of instruction review and performing/confirming work.
do $patch$
declare d text; anchor text:=$a$  if p_editable then$a$;
begin
 d:=pg_get_functiondef('private.clair_require_order_chart(text,text,uuid,uuid,boolean)'::regprocedure);
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'overall_chart_lock_anchor'; end if;
 execute replace(d,anchor,$b$  perform pg_advisory_xact_lock(hashtextextended('clinical_billing:'||p_workspace_id||':'||p_encounter_id::text,0));
  if p_editable then$b$);
end $patch$;

-- Freeze the old writer only after explicit scope promotion. Existing reads and
-- immutable historical PO records stay available. No backfill notifications.
do $patch$
declare d text; old text; replacement text;
begin
 d:=pg_get_functiondef('public.clair_save_chart_oral_instruction(text,uuid,integer,text)'::regprocedure);
 old:=$a$ d:=public.clair_get_chart_oral_instruction(p_workspace_id,p_chart_id);$a$;
 replacement:=$b$ perform pg_advisory_xact_lock(hashtextextended('clinical_billing:'||p_workspace_id||':'||(select encounter_id::text from public.soap_notes where workspace_id=p_workspace_id and id=p_chart_id),0));
 perform 1 from public.encounters where workspace_id=p_workspace_id and id=(select encounter_id from public.soap_notes where workspace_id=p_workspace_id and id=p_chart_id) for update;
 if exists(select 1 from private.chart_instruction_revisions where workspace_id=p_workspace_id and chart_id=p_chart_id and scope='dispensing') then raise exception 'legacy_instruction_retired'; end if;
 d:=public.clair_get_chart_oral_instruction(p_workspace_id,p_chart_id);$b$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'overall_legacy_writer_anchor'; end if;
 execute replace(d,old,replacement);
end $patch$;

do $patch$
declare d text; old text; replacement text;
begin
 d:=pg_get_functiondef('public.clair_mutate_fulfillment_instruction(text,uuid,jsonb)'::regprocedure);
 old:=$a$   update public.order_tasks set result_snapshot=case when next_status='completed'$a$;
 replacement:=$b$   if action in ('claim','start','resume','start_item','reopen','complete','complete_all') and next_status in ('in_progress','completed') then
     perform private.clair_require_task_instruction_ack(p_workspace_id,task.id,actor);
   end if;
   update public.order_tasks set result_snapshot=case when next_status='completed'$b$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'overall_instruction_guard_anchor'; end if;
 execute replace(d,old,replacement);
 d:=pg_get_functiondef('public.clair_transition_fulfillment_work_item(text,uuid,uuid,text,bigint,uuid,uuid,text,text)'::regprocedure);
 old:=$a$  update public.order_tasks task
  set
    status = v_next_task_status,$a$;
 replacement:=$b$  if p_action in ('start','resume','complete') then
    perform private.clair_require_task_instruction_ack(p_workspace_id,v_task.id,p_actor_user_id);
  end if;
  update public.order_tasks task
  set
    status = v_next_task_status,$b$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'overall_transition_guard_anchor'; end if;
 execute replace(d,old,replacement);
 d:=pg_get_functiondef('public.clair_record_order_execution_result(text,uuid,uuid,bigint,text,integer,uuid,timestamptz,jsonb,text,text)'::regprocedure);
 old:=$a$  insert into public.order_execution_result_versions($a$;
 replacement:=$b$  if head.id is null then perform private.clair_require_task_instruction_ack(p_workspace_id,t.id,p_actor_user_id); end if;
  insert into public.order_execution_result_versions($b$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'overall_result_guard_anchor'; end if;
 execute replace(d,old,replacement);
 d:=pg_get_functiondef('public.clair_record_chart_actual_result(text,uuid,uuid,text,uuid,timestamptz,jsonb,boolean)'::regprocedure);
 old:=$a$  insert into public.order_execution_result_versions($a$;
 replacement:=$b$  perform private.clair_require_task_instruction_ack(p_workspace_id,t.id,p_actor_user_id);
  insert into public.order_execution_result_versions($b$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'overall_chart_result_guard_anchor'; end if;
 execute replace(d,old,replacement);
end $patch$;

alter table public.notification_events drop constraint notification_events_event_key_check;
alter table public.notification_events add constraint notification_events_event_key_check check(event_key in (
 'order_urgent_handoff','order_recheck_requested','assigned_order_completed','clinical_result_completed',
 'device_result_received','imaging_result_completed','waiting_over_30m','dispensing_treatment_completed',
 'billing_waiting_ready','inpatient_care_delayed','clinical_master_update_available',
 'order_assigned','order_assignment_cancelled','order_cancelled','overall_instruction_changed'));

revoke all on function private.clair_legacy_instruction_snapshot_document(private.task_oral_instruction_snapshots),private.clair_instruction_has_text(text),private.clair_instruction_text_length(text),private.clair_order_effective_instructions(text,uuid,text,jsonb),private.clair_instruction_chart_for_order(text,uuid),private.clair_chart_instruction_document(text,uuid),
 private.clair_notify_overall_instructions(text,uuid,uuid,text[]),private.clair_task_effective_instructions(text,uuid),
 private.clair_require_task_instruction_ack(text,uuid,uuid),private.clair_capture_task_instructions()
 from public,anon,authenticated,service_role;
revoke all on function public.clair_get_order_instruction_review(text,uuid),public.clair_get_order_instruction_reviews(text,uuid[]),public.clair_acknowledge_order_instructions(text,uuid,text),public.clair_get_overall_instructions(text,uuid),public.clair_apply_overall_instructions(text,uuid,jsonb),
 public.clair_get_task_instruction_review(text,uuid),public.clair_acknowledge_task_instructions(text,uuid,text)
 from public,anon,service_role;
grant execute on function public.clair_get_order_instruction_review(text,uuid),public.clair_get_order_instruction_reviews(text,uuid[]),public.clair_acknowledge_order_instructions(text,uuid,text),public.clair_get_overall_instructions(text,uuid),public.clair_apply_overall_instructions(text,uuid,jsonb),
 public.clair_get_task_instruction_review(text,uuid),public.clair_acknowledge_task_instructions(text,uuid,text) to authenticated;
commit;
