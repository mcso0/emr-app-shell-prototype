\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values
 ('93000000-0000-4000-8000-000000000001','waiting-desk@example.test'),
 ('93000000-0000-4000-8000-000000000002','waiting-other@example.test'),
 ('93000000-0000-4000-8000-000000000003','waiting-vet@example.test'),
 ('93000000-0000-4000-8000-000000000004','waiting-inactive@example.test');
insert into public.users(id,display_name,status) values
 ('93000000-0000-4000-8000-000000000001','Synthetic desk','active'),
 ('93000000-0000-4000-8000-000000000002','Synthetic other','active'),
 ('93000000-0000-4000-8000-000000000003','Synthetic vet','active'),
 ('93000000-0000-4000-8000-000000000004','Synthetic inactive','active') on conflict(id) do nothing;
insert into public.workspaces(id,display_name) values
 ('waiting-alpha','Synthetic waiting alpha'),('waiting-beta','Synthetic waiting beta');
insert into public.user_memberships(workspace_id,user_id,roles,status) values
 ('waiting-alpha','93000000-0000-4000-8000-000000000001',array['front_desk'],'active'),
 ('waiting-beta','93000000-0000-4000-8000-000000000001',array['front_desk'],'active'),
 ('waiting-alpha','93000000-0000-4000-8000-000000000002',array['front_desk'],'active'),
 ('waiting-alpha','93000000-0000-4000-8000-000000000003',array['vet'],'active'),
 ('waiting-alpha','93000000-0000-4000-8000-000000000004',array['front_desk'],'inactive');

create function pg_temp.waiting_event(p_priority text default 'high', p_key text default 'synthetic-queue-waiting_over_30m')
returns jsonb language sql as $$ select jsonb_build_object(
 'eventKey','waiting_over_30m','dedupeKey',p_key,'domain','reception',
 'priority',p_priority,'toastPolicy','role_active','title','Synthetic waiting alert',
 'preview','Synthetic preview','detail','Synthetic detail','workTypeLabel','접수',
 'sourceLabel','Synthetic queue','sourceActionLabel','접수 대기 열기',
 'recipient',jsonb_build_object('kind','role_queue','id','desk','label','Synthetic desk'),
 'source',jsonb_build_object('kind','reception_queue','entity_id','synthetic-queue','route','/w/waiting-alpha/reception'),
 'requiresAction',true,'badgeCount',true,'occurredAt','2026-10-03T00:30:00Z'
); $$;
create function pg_temp.assert(p_ok boolean, p_message text) returns void language plpgsql as $$
begin if p_ok is distinct from true then raise exception '%',p_message; end if; end; $$;
create temp table waiting_writes(kind text);
create function pg_temp.record_waiting_write() returns trigger language plpgsql as $$
begin insert into pg_temp.waiting_writes values(TG_TABLE_NAME||':'||TG_OP); return null; end; $$;
create trigger test_waiting_event_writes after insert or update or delete on public.notification_events
 for each row execute function pg_temp.record_waiting_write();
create trigger test_waiting_state_writes after insert or update or delete on public.notification_user_states
 for each row execute function pg_temp.record_waiting_write();

set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000001',true);
select pg_temp.assert(public.clair_emit_notification_event('waiting-alpha',auth.uid(),pg_temp.waiting_event())->>'action'='created','initial create failed');
reset role;
insert into public.notification_user_states(workspace_id,actor_user_id,state_scope_id,notification_id,read_at,archived_at)
 select workspace_id,u.id,u.id::text,notification_id,'2026-10-03T00:35:00Z','2026-10-03T00:36:00Z'
 from public.notification_events cross join public.users u where workspace_id='waiting-alpha' and u.id in
 ('93000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002');
create temp table waiting_before as select to_jsonb(e) as event from public.notification_events e;
create temp table states_before as select to_jsonb(s) as state from public.notification_user_states s;
truncate pg_temp.waiting_writes;
set local role authenticated;
-- Changing poll text/actor does not constitute a new threshold.
do $$ declare i integer; r jsonb; begin for i in 1..20 loop
 r:=public.clair_emit_notification_event('waiting-alpha',auth.uid(),pg_temp.waiting_event()||jsonb_build_object('title','Synthetic minute '||i,'detail','Poll '||i));
 perform pg_temp.assert(r->>'action'='unchanged','repeat waiting poll performed a bump');
end loop; end $$;
reset role;
select pg_temp.assert((select count(*)=0 from pg_temp.waiting_writes),'repeat poll physically wrote rows');
select pg_temp.assert((select event from waiting_before)=(select to_jsonb(e) from public.notification_events e),'unchanged event mutated');
set local role authenticated;
select pg_temp.assert(public.clair_emit_notification_event('waiting-alpha',auth.uid(),pg_temp.waiting_event('urgent'))->>'action'='bumped','60m escalation failed');
select pg_temp.assert(public.clair_emit_notification_event('waiting-alpha',auth.uid(),pg_temp.waiting_event('urgent'))->>'action'='unchanged','urgent repeat bumped');
select pg_temp.assert(public.clair_emit_notification_event('waiting-alpha',auth.uid(),pg_temp.waiting_event('high'))->>'action'='unchanged','stale high downgraded urgent');
reset role;
select pg_temp.assert((select count(*)=1 from waiting_writes where kind='notification_events:UPDATE'),'expected exactly one escalation update');
select pg_temp.assert((select count(*)=0 from waiting_writes where kind like 'notification_user_states:%'),'acknowledgement rewritten');
select pg_temp.assert(not exists((select state from states_before except select to_jsonb(s) from public.notification_user_states s) union all (select to_jsonb(s) from public.notification_user_states s except select state from states_before)),'read/archive state changed');
select pg_temp.assert((select priority='urgent' and bump_count=2 from public.notification_events where workspace_id='waiting-alpha'),'wrong threshold bump count');
set local role authenticated;
-- A fresh queue entry is independent; a restored same entry remains unchanged.
select pg_temp.assert(public.clair_emit_notification_event('waiting-alpha',auth.uid(),pg_temp.waiting_event('high','synthetic-new-queue-waiting_over_30m'))->>'action'='created','new queue suppressed');
select pg_temp.assert(public.clair_emit_notification_event('waiting-alpha',auth.uid(),pg_temp.waiting_event('high'))->>'action'='unchanged','same queue restore reset acknowledgement');
select pg_temp.assert(public.clair_emit_notification_event('waiting-alpha',auth.uid(),pg_temp.waiting_event()||'{"eventScopeId":"second-scope"}')->>'action'='created','event scope isolation failed');
select pg_temp.assert(public.clair_emit_notification_event('waiting-beta',auth.uid(),pg_temp.waiting_event()||'{"source":{"kind":"reception_queue","route":"/w/waiting-beta/reception"}}')->>'action'='created','workspace isolation failed');

-- Same-key no-op still executes procedural checks and INSERT constraint/casts.
do $$ declare patch jsonb; denied boolean; begin
 for patch in select value from jsonb_array_elements('[
 {"domain":"chart"},{"priority":"invalid"},{"toastPolicy":"invalid"},{"title":""},
 {"preview":""},{"detail":""},{"workTypeLabel":""},{"sourceLabel":""},{"sourceActionLabel":""},
 {"requiresAction":"invalid"},{"badgeCount":"invalid"},{"occurredAt":"invalid"},
 {"recipient":{"kind":"invalid","id":"desk"}},
 {"recipient":{"kind":"user","id":"93000000-0000-4000-8000-000000000004"}},
 {"source":{"kind":"reception_queue","route":"/w/waiting-beta/reception"}},
 {"source":{"kind":"invalid"}},{"eventScopeId":"order-set-review"}
 ]'::jsonb) loop
  denied:=false;
  begin perform public.clair_emit_notification_event('waiting-alpha',auth.uid(),pg_temp.waiting_event()||patch);
  exception when others then denied:=true; end;
  perform pg_temp.assert(denied,'invalid same-key payload accepted: '||patch::text);
 end loop;
 denied:=false;
 begin perform public.clair_emit_notification_event('waiting-alpha','93000000-0000-4000-8000-000000000002',pg_temp.waiting_event());
 exception when others then denied:=true; end;
 perform pg_temp.assert(denied,'wrong actor allowed');
end $$;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000003',true);
do $$ declare denied boolean:=false; begin
 begin perform public.clair_emit_notification_event('waiting-alpha',auth.uid(),pg_temp.waiting_event()); exception when others then denied:=true; end;
 perform pg_temp.assert(denied,'vet emitter allowed'); end $$;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000004',true);
do $$ declare denied boolean:=false; begin
 begin perform public.clair_emit_notification_event('waiting-alpha',auth.uid(),pg_temp.waiting_event()); exception when others then denied:=true; end;
 perform pg_temp.assert(denied,'inactive member allowed'); end $$;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000002',true);
do $$ declare denied boolean:=false; begin
 begin perform public.clair_emit_notification_event('waiting-beta',auth.uid(),pg_temp.waiting_event()); exception when others then denied:=true; end;
 perform pg_temp.assert(denied,'foreign workspace allowed');
 begin perform 1 from public.notification_events; raise exception 'direct table access allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Non-waiting notifications retain the legacy bump/reset policy.
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000003',true);
select pg_temp.assert(public.clair_emit_notification_event('waiting-alpha',auth.uid(),
 pg_temp.waiting_event()||'{"eventKey":"order_recheck_requested","domain":"chart","dedupeKey":"synthetic-recheck","source":{"kind":"order","route":"/w/waiting-alpha/chart"},"recipient":{"kind":"user","id":"93000000-0000-4000-8000-000000000003"}}')->>'action'='created','non-waiting create failed');
reset role;
insert into public.notification_user_states(workspace_id,actor_user_id,state_scope_id,notification_id,read_at)
 select workspace_id,'93000000-0000-4000-8000-000000000003','93000000-0000-4000-8000-000000000003',notification_id,now()
 from public.notification_events where dedupe_key='synthetic-recheck';
set local role authenticated;
select pg_temp.assert(public.clair_emit_notification_event('waiting-alpha',auth.uid(),
 pg_temp.waiting_event()||'{"eventKey":"order_recheck_requested","domain":"chart","dedupeKey":"synthetic-recheck","source":{"kind":"order","route":"/w/waiting-alpha/chart"},"recipient":{"kind":"user","id":"93000000-0000-4000-8000-000000000003"}}')->>'action'='bumped','non-waiting repeat policy changed');
reset role;
select pg_temp.assert(not exists(select 1 from public.notification_user_states where actor_user_id='93000000-0000-4000-8000-000000000003'),'non-waiting reset changed');
select pg_temp.assert(has_function_privilege('authenticated','public.clair_emit_notification_event(text,uuid,jsonb)','execute'),'authenticated grant missing');
select pg_temp.assert(not has_function_privilege('anon','public.clair_emit_notification_event(text,uuid,jsonb)','execute'),'anon grant added');
select pg_temp.assert(not has_function_privilege('service_role','public.clair_emit_notification_event(text,uuid,jsonb)','execute'),'service role grant added');
select pg_temp.assert((select relrowsecurity from pg_class where oid='public.notification_events'::regclass),'event RLS disabled');
select pg_temp.assert((select relrowsecurity from pg_class where oid='public.notification_user_states'::regclass),'state RLS disabled');
rollback;
select 'PASS: repeated row mutations=0; escalation updates=1; acknowledgement writes=0; scopes, lifecycle, validation and permissions preserved' as result;
