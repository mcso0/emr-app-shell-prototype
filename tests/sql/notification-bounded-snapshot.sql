\set ON_ERROR_STOP on
-- Dedicated local synthetic DB only. All fixtures roll back.
begin;
do $$ begin
  if current_database() <> 'notification_bounded_local' then raise exception 'wrong test database'; end if;
  if exists(select 1 from public.notification_events) or exists(select 1 from public.users) or exists(select 1 from auth.users) or exists(select 1 from public.workspaces) then
    raise exception 'test database must be empty'; end if;
end $$;
insert into auth.users(id,email) select ('94000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
  'notification-'||i||'@example.test' from generate_series(1,5) i;
insert into public.users(id,display_name,status) select id,'Synthetic actor','active' from auth.users;
insert into public.workspaces(id,display_name) values ('notification-alpha','Synthetic alpha'),('notification-beta','Synthetic beta');
insert into public.user_memberships(workspace_id,user_id,roles,status)
  select 'notification-alpha',id,case right(id::text,1) when '1' then array['hospital_admin']
    when '4' then array['technician','vet'] else array['front_desk'] end,
    case right(id::text,1) when '5' then 'inactive' else 'active' end from public.users;
insert into public.user_memberships(workspace_id,user_id,roles,status)
  values ('notification-beta','94000000-0000-4000-8000-000000000001',array['hospital_admin'],'active');
insert into public.permission_policies(workspace_id,name,scope,target_role,permissions)
  values ('notification-alpha','Synthetic desk','role','front_desk','{"allowed":["reception:view"]}'),
    ('notification-alpha','Synthetic tech','role','technician','{"allowed":["reception:view","lab:view"]}');
insert into public.workspace_permission_roles(id,workspace_id,role_key,label,role_type,permissions)
  values ('94000000-1000-4000-8000-000000000001','notification-alpha','synthetic_deny','Synthetic deny','custom','{"allowed":["chart:view"]}');
delete from public.workspace_membership_permission_role_assignments where workspace_id in ('notification-alpha','notification-beta');
insert into public.workspace_membership_permission_role_assignments(membership_id,workspace_id,permission_role_id)
  select id,workspace_id,'94000000-1000-4000-8000-000000000001' from public.user_memberships
  where workspace_id='notification-alpha' and user_id in
    ('94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000003');
insert into public.notification_events(workspace_id,notification_id,event_key,dedupe_key,domain,priority,
  title,preview,detail,work_type_label,source_label,source_action_label,recipient_kind,recipient_id,
  recipient_label,recipient_payload,source_kind,source_payload,requires_action,updated_at)
  select 'notification-alpha','synthetic-'||lpad(i::text,4,'0'),'waiting_over_30m','synthetic-'||i,'reception','high',
    'Synthetic alert','Synthetic preview',repeat('Synthetic detail ',40),'접수','Synthetic queue','접수 대기 열기',
    'role_queue','desk','Synthetic desk','{"kind":"role_queue","id":"desk"}',
    'reception_queue','{"kind":"reception_queue","route":"/w/notification-alpha/reception"}',i%2=0,'2026-10-04T00:00:00Z'
    from generate_series(1,250) i;
insert into public.notification_user_states(workspace_id,actor_user_id,state_scope_id,notification_id,read_at,archived_at)
 values ('notification-alpha','94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','synthetic-0230','2026-10-03T00:00:00Z',null),
 ('notification-alpha','94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','synthetic-0231','2026-10-03T00:00:00Z','2026-10-03T00:00:00Z'),
 ('notification-alpha','94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','synthetic-0249',null,'2026-10-03T00:00:00Z');
-- FIXTURE_END: concurrency runner commits only the setup above in this guarded DB.
create function pg_temp.assert(p_ok boolean,p_message text) returns void language plpgsql as $$
begin if p_ok is distinct from true then raise exception '%',p_message; end if; end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; f text; begin
  foreach f in array array['snapshot','all','unread','important','archived'] loop
    r:=public.clair_read_notification_snapshot_v2('notification-alpha',auth.uid(),auth.uid()::text,null,f,99999);
    perform pg_temp.assert(r->'counts'='{"badge":247,"unread":247,"important":125,"archived":2}'::jsonb,'global counts changed with filter/limit');
    perform pg_temp.assert(jsonb_array_length(r->'notifications')=case f when 'snapshot' then 100 when 'archived' then 2 else 50 end,'DB body is not bounded');
    perform pg_temp.assert(jsonb_array_length(r->'states')<=jsonb_array_length(r->'notifications'),'states not page scoped');
    perform pg_temp.assert(not (r->'notifications'->0 ? 'unread') and not (r->'notifications'->0 ? 'read_state_key'),'redundant fields returned');
  end loop;
  r:=public.clair_read_notification_snapshot_v2('notification-alpha',auth.uid(),auth.uid()::text,null,'snapshot',100);
  perform pg_temp.assert(r->'notifications'->0->>'id'='synthetic-0001' and r->'notifications'->99->>'id'='synthetic-0100','equal timestamp ordering unstable');
  r:=public.clair_read_notification_snapshot_v2('notification-beta',auth.uid(),auth.uid()::text,null,'snapshot',100);
  perform pg_temp.assert(jsonb_array_length(r->'notifications')=0 and r->'counts'->>'unread'='0','workspace isolation');
  r:=public.clair_mutate_notification_user_state_v2('notification-alpha',auth.uid(),auth.uid()::text,'read','synthetic-0051');
  perform pg_temp.assert(r->'counts'->>'unread'='246' and r->'states'->0->>'readAt' is not null,'rank51 read failed');
  r:=public.clair_mutate_notification_user_state_v2('notification-alpha',auth.uid(),auth.uid()::text,'read','synthetic-0200');
  perform pg_temp.assert(r->'counts'->>'unread'='245','rank200 read failed');
  r:=public.clair_mutate_notification_user_state_v2('notification-alpha',auth.uid(),auth.uid()::text,'restore','synthetic-0231');
  perform pg_temp.assert(r->'states'->0->>'readAt' is not null and r->'states'->0->>'archivedAt' is null and r->'counts'->>'unread'='245','restore did not preserve read');
  r:=public.clair_mutate_notification_user_state_v2('notification-alpha',auth.uid(),auth.uid()::text,'read-all');
  perform pg_temp.assert(r->>'updatedCount'='245' and r->'counts'->>'unread'='0' and r->'counts'->>'archived'='1','complete read-all failed');
  r:=public.clair_mutate_notification_user_state_v2('notification-alpha',auth.uid(),auth.uid()::text,'read-all');
  perform pg_temp.assert(r->>'updatedCount'='0','read-all not idempotent');
end $$;
-- DB CASE priority must still hide desk recipient for technician+vet.
select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000004',true);
select pg_temp.assert(public.clair_read_notification_snapshot_v2('notification-alpha',auth.uid(),auth.uid()::text)->'counts'->>'unread'='0','multi-role visibility broadened');
-- Assigned deny overrides role policy; admin still bypasses its deny assignment.
select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000003',true);
select pg_temp.assert(public.clair_read_notification_snapshot_v2('notification-alpha',auth.uid(),auth.uid()::text)->'counts'->>'unread'='0','assignment precedence broken');
do $$ declare denied boolean:=false; begin
  begin perform public.clair_mutate_notification_user_state_v2('notification-alpha',auth.uid(),auth.uid()::text,'read','synthetic-0001');
  exception when others then denied:=sqlerrm='notification_not_found'; end;
  perform pg_temp.assert(denied,'invisible ID mutation allowed');
end $$;
reset role;
-- Next does not gate valid permission assignments on role status.
update public.workspace_permission_roles set permissions='{"allowed":["reception:view"]}',status='inactive'
 where role_key='synthetic_deny';
set local role authenticated;
select pg_temp.assert(public.clair_read_notification_snapshot_v2('notification-alpha',auth.uid(),auth.uid()::text)->'counts'->>'unread'='250','inactive valid assignment differs from Next');
select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000002',true);
select pg_temp.assert(public.clair_read_notification_snapshot_v2('notification-alpha',auth.uid(),auth.uid()::text)->'counts'->>'unread'='250','actor states leaked');
do $$ declare denied boolean; begin
  denied:=false; begin perform public.clair_read_notification_snapshot_v2('notification-beta',auth.uid(),auth.uid()::text);
    exception when others then denied:=sqlerrm='workspace_membership_missing'; end; perform pg_temp.assert(denied,'cross-workspace allowed');
  denied:=false; begin perform public.clair_read_notification_snapshot_v2('notification-alpha','94000000-0000-4000-8000-000000000001',auth.uid()::text);
    exception when others then denied:=sqlerrm='notification_actor_mismatch'; end; perform pg_temp.assert(denied,'spoofed actor allowed');
  denied:=false; begin perform public.clair_read_notification_snapshot_v2('notification-alpha',auth.uid(),'another-scope');
    exception when others then denied:=sqlerrm='notification_actor_mismatch'; end; perform pg_temp.assert(denied,'spoofed state scope allowed');
end $$;
reset role;
select pg_temp.assert(not has_table_privilege('authenticated','public.notification_events','SELECT') and
  not has_table_privilege('authenticated','public.notification_user_states','UPDATE'),'direct table grants widened');
select pg_temp.assert(not has_function_privilege('anon','public.clair_read_notification_snapshot_v2(text,uuid,text,text,text,integer,text)','EXECUTE') and
  not has_function_privilege('anon','public.clair_mutate_notification_user_state_v2(text,uuid,text,text,text,text)','EXECUTE'),'anon RPC execute');
select pg_temp.assert(not has_function_privilege('service_role','public.clair_read_notification_snapshot_v2(text,uuid,text,text,text,integer,text)','EXECUTE'),'service-role RPC execute');
-- Event scope isolation: shared history plus only the requested scoped event.
insert into public.notification_events select (jsonb_populate_record(null::public.notification_events,
 to_jsonb(e)||jsonb_build_object('id',gen_random_uuid(),'event_scope_id',scope,'notification_id',scope,'dedupe_key',scope))).*
 from public.notification_events e cross join (values('scope-a'),('scope-b')) scopes(scope)
 where e.notification_id='synthetic-0001';
set local role authenticated;
select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000001',true);
select pg_temp.assert(public.clair_read_notification_snapshot_v2('notification-alpha',auth.uid(),auth.uid()::text,null,'snapshot',100)->'counts'->>'unread'='0','scoped event leaked into shared snapshot');
select pg_temp.assert(public.clair_read_notification_snapshot_v2('notification-alpha',auth.uid(),auth.uid()::text,'scope-a','snapshot',100)->'counts'->>'unread'='1','requested scope missing');
select pg_temp.assert(public.clair_mutate_notification_user_state_v2('notification-alpha',auth.uid(),auth.uid()::text,'read-all',null,'scope-a')->>'updatedCount'='1','scope full read-all wrong');
select pg_temp.assert(public.clair_read_notification_snapshot_v2('notification-alpha',auth.uid(),auth.uid()::text,'scope-b','snapshot',100)->'counts'->>'unread'='1','scope-b state changed');
reset role;
-- Remove assignment and role policies; a user-scope policy must not create Next-visible notifications.
delete from public.workspace_membership_permission_role_assignments where membership_id in
  (select id from public.user_memberships where user_id='94000000-0000-4000-8000-000000000003');
delete from public.permission_policies;
insert into public.permission_policies(workspace_id,name,scope,target_user_id,permissions)
 values('notification-alpha','Synthetic user-only','user','94000000-0000-4000-8000-000000000003','{"allowed":["*"]}');
set local role authenticated;
select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000003',true);
select pg_temp.assert(public.clair_read_notification_snapshot_v2('notification-alpha',auth.uid(),auth.uid()::text)->'counts'->>'unread'='0','user-only policy broadened Next visibility');
select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000005',true);
do $$ declare denied boolean:=false; begin
 begin perform public.clair_read_notification_snapshot_v2('notification-alpha',auth.uid(),auth.uid()::text);
 exception when others then denied:=sqlerrm='workspace_membership_missing'; end;
 perform pg_temp.assert(denied,'inactive membership allowed'); end $$;
select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000001',true);
select jsonb_build_object('fixture_events',252,'old_pg_json_text_bytes',
  octet_length(public.clair_list_notification_events('notification-alpha')::text) +
  octet_length(public.clair_list_notification_user_states('notification-alpha',auth.uid(),auth.uid()::text)::text),
  'bounded_pg_json_text_bytes',octet_length(public.clair_read_notification_snapshot_v2('notification-alpha',auth.uid(),auth.uid()::text,null,'snapshot',100)::text),
  'unit','UTF-8 bytes of PostgreSQL JSONB text, not wire/egress');
select 'PASS: bounded SQL counts, state, roles, actor/workspace isolation, privileges';
rollback;
