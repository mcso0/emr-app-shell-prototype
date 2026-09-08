\set ON_ERROR_STOP on
-- Run only in an isolated, migrated database with synthetic supabase/seed.sql fixtures.
begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';
insert into public.patients(id, workspace_id, patient_no, name, species, sex)
values ('96374000-0000-4000-8000-000000000001', 'workspace-clair-cheongdam',
  'MULTI-CHART-SECURITY-037', 'Synthetic multi chart patient', 'dog', 'unknown');
insert into public.encounters(id, workspace_id, patient_id, primary_veterinarian_id,
  encounter_no, reception_type, status, started_at)
values ('96374000-0000-4000-8000-000000000002', 'workspace-clair-cheongdam',
  '96374000-0000-4000-8000-000000000001', '49110000-0000-4000-8000-000000000003',
  'MULTI-CHART-SECURITY-037', 'walk_in', 'in_consultation', now());
update public.workspace_permission_roles role
set permissions = '{"allowed":["chart:view","chart:update"]}'::jsonb
from public.workspace_membership_permission_role_assignments assignment
join public.user_memberships membership on membership.workspace_id = assignment.workspace_id
  and membership.id = assignment.membership_id
where role.workspace_id = assignment.workspace_id and role.id = assignment.permission_role_id
  and membership.workspace_id = 'workspace-clair-cheongdam'
  and membership.user_id = '49110000-0000-4000-8000-000000000003';

insert into public.workspaces(id,display_name) values('workspace-multi-chart-foreign','Synthetic foreign workspace');
insert into public.patients(id,workspace_id,patient_no,name,species) values('96374000-0000-4000-8000-000000000011','workspace-multi-chart-foreign','SYNTHETIC-FOREIGN','Synthetic foreign patient','dog');
insert into public.encounters(id,workspace_id,patient_id,encounter_no,reception_type,status)
values('96374000-0000-4000-8000-000000000012','workspace-multi-chart-foreign','96374000-0000-4000-8000-000000000011','SYNTHETIC-FOREIGN','walk_in','in_consultation'),
('96374000-0000-4000-8000-000000000022','workspace-clair-cheongdam','96374000-0000-4000-8000-000000000001','SYNTHETIC-OTHER-ENCOUNTER','walk_in','in_consultation');
insert into public.soap_notes(id,workspace_id,encounter_id,status,subjective)
values('96374000-0000-4000-8000-000000000013','workspace-multi-chart-foreign','96374000-0000-4000-8000-000000000012','draft','Synthetic foreign record'),
('96374000-0000-4000-8000-000000000023','workspace-clair-cheongdam','96374000-0000-4000-8000-000000000022','draft','Synthetic other encounter');
create temp table multi_chart_foreign_before as select to_jsonb(n) row from public.soap_notes n where workspace_id='workspace-multi-chart-foreign';
set local role authenticated;
select set_config('request.jwt.claim.sub','49110000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $test$
declare w text:='workspace-clair-cheongdam'; actor text:='49110000-0000-4000-8000-000000000003';
 e uuid:='96374000-0000-4000-8000-000000000002'; denied boolean; signature text; n jsonb;
begin
 foreach signature in array array[
 'public.clair_save_chart_soap_note_single_chart_base(text,text,uuid,jsonb,timestamptz,text)',
 'public.clair_save_chart_soap_note_v2_single_chart_base(text,text,uuid,jsonb,timestamptz,text,text)',
 'public.clair_save_chart_soap_note_v3_single_chart_base(text,text,uuid,jsonb,timestamptz,text,text)',
 'public.clair_complete_chart_encounter_base(text,text,uuid)',
 'public.clair_save_chart_order_draft_encounter_base(text,text,uuid,jsonb)',
 'public.clair_confirm_chart_order_candidates_origin_base(text,uuid,uuid,uuid[],text,text)',
 'public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
 'public.clair_save_chart_order_lifecycle_internal(text,uuid,uuid,uuid,text,text)'
 ] loop
 if has_function_privilege('authenticated',signature,'EXECUTE') then raise exception 'public_base_bypass: %',signature; end if;
 end loop;
 denied:=false;
 begin perform public.clair_list_encounter_charts('workspace-multi-chart-foreign','96374000-0000-4000-8000-000000000012');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'foreign_workspace_read'; end if;
 denied:=false;
 begin perform public.clair_get_chart_soap_note_by_id(w,e,'96374000-0000-4000-8000-000000000013');
 exception when others then if sqlerrm='chart_unavailable' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'foreign_chart_read'; end if;
 denied:=false;
 begin perform public.clair_get_chart_soap_note_by_id(w,e,'96374000-0000-4000-8000-000000000023');
 exception when others then if sqlerrm='chart_unavailable' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'cross_encounter_chart_read'; end if;
 denied:=false;
 begin perform public.clair_create_encounter_chart(w,'49110000-0000-4000-8000-000000000005',e,gen_random_uuid());
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'forged_actor'; end if;
 denied:=false;
 begin perform 1 from public.soap_notes;
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'direct_table_read'; end if;
 denied:=false;
 begin insert into public.soap_notes(workspace_id,encounter_id,status) values(w,e,'draft');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'direct_table_write'; end if;
end $test$;
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.workspace_permission_roles role set permissions='{"allowed":[]}'::jsonb
from public.workspace_membership_permission_role_assignments assignment join public.user_memberships membership
on membership.workspace_id=assignment.workspace_id and membership.id=assignment.membership_id
where role.workspace_id=assignment.workspace_id and role.id=assignment.permission_role_id
and membership.workspace_id='workspace-clair-cheongdam' and membership.user_id='49110000-0000-4000-8000-000000000005';
set local role authenticated;
select set_config('request.jwt.claim.sub','49110000-0000-4000-8000-000000000005',true);
do $permission$
declare w text:='workspace-clair-cheongdam'; e uuid:='96374000-0000-4000-8000-000000000002'; denied boolean;
begin

 denied:=false;
 begin perform public.clair_create_encounter_chart(w,'49110000-0000-4000-8000-000000000005',e,gen_random_uuid());
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'no_permission_create'; end if;
end $permission$;
reset role;
do $foreign$
begin
 if exists((select to_jsonb(n) from public.soap_notes n where workspace_id='workspace-multi-chart-foreign' except select row from multi_chart_foreign_before)
 union all(select row from multi_chart_foreign_before except select to_jsonb(n) from public.soap_notes n where workspace_id='workspace-multi-chart-foreign')) then raise exception 'foreign_records_changed'; end if;
end $foreign$;
select 'PASS encounter_multi_chart_security_contract';
rollback;
