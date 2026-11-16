-- Run only in an isolated local verification database with the candidate applied.
-- All identities and clinical records below are synthetic. Roll back by default.
begin;
insert into auth.users(id,aud,role) values('28100000-0000-4000-8000-000000000001','authenticated','authenticated'),('28100000-0000-4000-8000-000000000002','authenticated','authenticated');
insert into public.users(id,display_name) values('28100000-0000-4000-8000-000000000001','합성 작성자'),('28100000-0000-4000-8000-000000000002','합성 읽기 담당자');
insert into public.workspaces(id,display_name) values('workspace-instruction-qa','합성 지시 검증'),('workspace-instruction-other','합성 다른 병원');
insert into public.user_memberships(workspace_id,user_id,roles,status) values
('workspace-instruction-qa','28100000-0000-4000-8000-000000000001',array['hospital_admin'],'active');
insert into public.patients(id,workspace_id,patient_no,name,species) values('28110000-0000-4000-8000-000000000001','workspace-instruction-qa','QA-ORAL','합성 환자','dog');
insert into public.encounters(id,workspace_id,patient_id,encounter_no,reception_type,status) values('28120000-0000-4000-8000-000000000001','workspace-instruction-qa','28110000-0000-4000-8000-000000000001','QA-ORAL','walk_in','in_consultation');
insert into public.soap_notes(id,workspace_id,encounter_id,status) values
('28130000-0000-4000-8000-000000000001','workspace-instruction-qa','28120000-0000-4000-8000-000000000001','draft'),
('28130000-0000-4000-8000-000000000002','workspace-instruction-qa','28120000-0000-4000-8000-000000000001','draft');
select set_config('request.jwt.claim.sub','28100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.clair_save_chart_oral_instruction('workspace-instruction-qa','28130000-0000-4000-8000-000000000001',0,'요청 당시 경구제 전체 지시');
reset role;
insert into public.orders(id,workspace_id,encounter_id,order_type,display_name,clinical_order_type,execution_mode,destination_module,origin_chart_id,order_confirmation_status,detail_inputs) values
('28140000-0000-4000-8000-000000000001','workspace-instruction-qa','28120000-0000-4000-8000-000000000001','dispensing','합성 경구제','dispensing','routed','dispensing','28130000-0000-4000-8000-000000000001','confirmed','{"route":"PO"}'),
('28140000-0000-4000-8000-000000000002','workspace-instruction-qa','28120000-0000-4000-8000-000000000001','dispensing','합성 외용제','dispensing','routed','dispensing','28130000-0000-4000-8000-000000000001','confirmed','{"route":"topical"}');
insert into public.order_tasks(id,workspace_id,encounter_id,order_id,task_role,clinical_order_type,destination_module,execution_result_schema_version,effective_snapshot,created_by_user_id) values
('28150000-0000-4000-8000-000000000001','workspace-instruction-qa','28120000-0000-4000-8000-000000000001','28140000-0000-4000-8000-000000000001','execution','dispensing','dispensing',0,'{"detailInputs":{"route":"PO"}}','28100000-0000-4000-8000-000000000001'),
('28150000-0000-4000-8000-000000000002','workspace-instruction-qa','28120000-0000-4000-8000-000000000001','28140000-0000-4000-8000-000000000002','execution','dispensing','dispensing',0,'{"detailInputs":{"route":"topical"}}','28100000-0000-4000-8000-000000000001');
insert into public.order_fulfillment_work_items(id,workspace_id,encounter_id,order_id,order_type,queue_type,destination_module,clinical_order_type,task_id,task_attempt_no,source_snapshot)
select case when o.detail_inputs->>'route'='PO' then '28160000-0000-4000-8000-000000000001'::uuid else '28160000-0000-4000-8000-000000000002'::uuid end,
o.workspace_id,o.encounter_id,o.id,'dispensing','dispensing','dispensing','dispensing',t.id,1,jsonb_build_object('displayName',o.display_name,'detailInputs',o.detail_inputs)
from public.orders o join public.order_tasks t on t.order_id=o.id and t.workspace_id=o.workspace_id where o.workspace_id='workspace-instruction-qa';
set local role authenticated;
select public.clair_save_chart_oral_instruction('workspace-instruction-qa','28130000-0000-4000-8000-000000000001',1,'완료 당시 지시');
reset role;
update public.order_tasks set status='complete',started_at=now(),started_by_user_id='28100000-0000-4000-8000-000000000001',completed_at=now() where id='28150000-0000-4000-8000-000000000001';
set local role authenticated;
select public.clair_save_chart_oral_instruction('workspace-instruction-qa','28130000-0000-4000-8000-000000000001',2,'현재 경구제 전체 지시');
do $test$
declare d jsonb;
begin
 d:=public.clair_get_chart_oral_instruction('workspace-instruction-qa','28130000-0000-4000-8000-000000000001');
 if d->>'instruction'<>'현재 경구제 전체 지시' or jsonb_array_length(d->'history')<>3 then raise exception 'readback_failed'; end if;
 d:=public.clair_get_fulfillment_instruction('workspace-instruction-qa','28160000-0000-4000-8000-000000000001');
 if d#>>'{oralInstruction,instruction}'<>'현재 경구제 전체 지시' or jsonb_array_length(d#>'{oralInstruction,snapshots}')<>2 then raise exception 'fulfillment_readback_failed'; end if;
 d:=public.clair_get_chart_oral_instruction('workspace-instruction-qa','28130000-0000-4000-8000-000000000002');
 if d->>'instruction'<>'' or (d->>'revision')::int<>0 then raise exception 'chart_scope_leaked'; end if;
 begin
  perform public.clair_save_chart_oral_instruction('workspace-instruction-qa','28130000-0000-4000-8000-000000000001',1,'충돌');
  raise exception 'missing_conflict';
 exception when others then if sqlerrm<>'revision_conflict' then raise; end if; end;
 begin
  perform public.clair_get_chart_oral_instruction('workspace-instruction-other','28130000-0000-4000-8000-000000000001');
  raise exception 'missing_workspace_guard';
 exception when insufficient_privilege then null; end;
end $test$;
reset role;
do $test$ begin
 if (select instruction from private.task_oral_instruction_snapshots where task_id='28150000-0000-4000-8000-000000000001' and phase='requested') is distinct from '요청 당시 경구제 전체 지시' then raise exception 'request_snapshot_failed'; end if;
 if (select revision from private.task_oral_instruction_snapshots where task_id='28150000-0000-4000-8000-000000000001' and phase='completed') is distinct from 2 then raise exception 'completion_snapshot_failed'; end if;
 if exists(select 1 from private.task_oral_instruction_snapshots where task_id='28150000-0000-4000-8000-000000000002') then raise exception 'non_oral_leak'; end if;
end $test$;
update public.soap_notes set status='signed' where id='28130000-0000-4000-8000-000000000001';
set local role authenticated;
do $test$ begin
 begin
  perform public.clair_save_chart_oral_instruction('workspace-instruction-qa','28130000-0000-4000-8000-000000000001',3,'서명 후 수정');
  raise exception 'missing_signed_guard';
 exception when insufficient_privilege then null; end;
end $test$;
select set_config('request.jwt.claim.sub','28100000-0000-4000-8000-000000000002',true);
do $test$ begin
 begin
  perform public.clair_save_chart_oral_instruction('workspace-instruction-qa','28130000-0000-4000-8000-000000000002',0,'권한 없는 수정');
  raise exception 'missing_permission_guard';
 exception when insufficient_privilege then null; end;
end $test$;
reset role;
select 'chart_oral_instruction_checks_passed' as result;
rollback;
