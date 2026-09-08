\set ON_ERROR_STOP on
-- Run only in an isolated, migrated database with synthetic supabase/seed.sql fixtures.
begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';
insert into public.patients(id, workspace_id, patient_no, name, species, sex)
values ('96370000-0000-4000-8000-000000000001', 'workspace-clair-cheongdam',
  'MULTI-CHART-037', 'Synthetic multi chart patient', 'dog', 'unknown');
insert into public.encounters(id, workspace_id, patient_id, primary_veterinarian_id,
  encounter_no, reception_type, status, started_at)
values ('96370000-0000-4000-8000-000000000002', 'workspace-clair-cheongdam',
  '96370000-0000-4000-8000-000000000001', '49110000-0000-4000-8000-000000000003',
  'MULTI-CHART-037', 'walk_in', 'in_consultation', now());
update public.workspace_permission_roles role
set permissions = '{"allowed":["chart:view","chart:update"]}'::jsonb
from public.workspace_membership_permission_role_assignments assignment
join public.user_memberships membership on membership.workspace_id = assignment.workspace_id
  and membership.id = assignment.membership_id
where role.workspace_id = assignment.workspace_id and role.id = assignment.permission_role_id
  and membership.workspace_id = 'workspace-clair-cheongdam'
  and membership.user_id = '49110000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub','49110000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $test$
declare
  w text := 'workspace-clair-cheongdam';
  actor text := '49110000-0000-4000-8000-000000000003';
  e uuid := '96370000-0000-4000-8000-000000000002';
  a jsonb; b jsonb; state jsonb; first_snapshot jsonb; diagnosis_id text; denied boolean;
begin
  a := public.clair_create_encounter_chart(w,actor,e,gen_random_uuid());
  b := public.clair_create_encounter_chart(w,actor,e,gen_random_uuid());
  state := public.clair_get_chart_diagnosis_assessments(w,e,(a->>'id')::uuid);
  state := public.clair_save_chart_diagnoses_v2(w,actor,e,(a->>'id')::uuid,
    '[{"diagnosisText":"Synthetic diagnosis","diagnosisType":"suspected","isPrimary":true}]',state->>'version');
  diagnosis_id := state->'diagnoses'->0->>'id';
  first_snapshot := state->'assessments';
  denied := false;
  begin perform public.clair_sign_encounter_chart(w,actor,e,(a->>'id')::uuid,(a->>'updatedAt')::timestamptz);
  exception when others then if sqlerrm = 'soap_note_conflict' then denied := true; else raise; end if; end;
  if not denied then raise exception 'sign_accepted_stale_assessment'; end if;
  a := state->'chart';
  perform public.clair_sign_encounter_chart(w,actor,e,(a->>'id')::uuid,(a->>'updatedAt')::timestamptz);
  state := public.clair_save_chart_diagnoses_v2(w,actor,e,(b->>'id')::uuid,
    jsonb_build_array(jsonb_build_object('id',diagnosis_id,'diagnosisText','Synthetic diagnosis revised',
      'diagnosisType','confirmed','isClosed',true,'isPrimary',true)),state->>'version');
  if state->'diagnoses'->0->>'id' <> diagnosis_id then raise exception 'diagnosis_identity_changed'; end if;
  if public.clair_get_chart_diagnosis_assessments(w,e,(a->>'id')::uuid)->'assessments' <> first_snapshot then
    raise exception 'historical_assessment_rewritten'; end if;
  denied := false;
  begin perform public.clair_save_chart_diagnoses_v2(w,actor,e,(a->>'id')::uuid,'[]',state->>'version');
  exception when others then if sqlerrm = 'signed_chart_read_only' then denied := true; else raise; end if; end;
  if not denied then raise exception 'signed_assessment_mutated'; end if;
  denied := false;
  begin perform public.clair_save_chart_diagnoses_v2(w,actor,e,(b->>'id')::uuid,'[]','stale');
  exception when others then if sqlerrm = 'diagnoses_conflict' then denied := true; else raise; end if; end;
  if not denied then raise exception 'stale_diagnoses_accepted'; end if;
  state := public.clair_save_chart_diagnoses_v2(w,actor,e,(b->>'id')::uuid,'[]',state->>'version');
  if state->'diagnoses' <> '[]'::jsonb then raise exception 'diagnosis_not_retired'; end if;
  if public.clair_get_chart_diagnosis_assessments(w,e,(a->>'id')::uuid)->'assessments' <> first_snapshot then
    raise exception 'retirement_removed_history'; end if;
end;
$test$;
reset role;
do $assert$
begin
  if (select count(*) from public.diagnoses where encounter_id = '96370000-0000-4000-8000-000000000002') <> 1 then
    raise exception 'diagnosis_deleted_or_duplicated'; end if;
  if not exists(select 1 from public.diagnoses where encounter_id = '96370000-0000-4000-8000-000000000002'
    and retired_at is not null and diagnosis_type = 'confirmed' and closed_at is not null) then
    raise exception 'retired_diagnosis_not_preserved'; end if;
end;
$assert$;
select 'PASS encounter_multi_chart_diagnosis_contract' as result;
rollback;
