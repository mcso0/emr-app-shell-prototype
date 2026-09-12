\set ON_ERROR_STOP on
-- Run only in an isolated, migrated database with synthetic supabase/seed.sql fixtures.
begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';
insert into public.patients(id, workspace_id, patient_no, name, species, sex)
values ('96370000-0000-4000-8000-000000000001', 'workspace-clair-cheongdam',
  'MULTI-CHART-037', 'Synthetic multi chart patient', 'dog', 'unknown'),
  ('96370000-0000-4000-8000-000000000101', 'workspace-clair-cheongdam',
  'MULTI-CHART-037-LIMIT', 'Synthetic multi chart limit patient', 'dog', 'unknown');
insert into public.encounters(id, workspace_id, patient_id, primary_veterinarian_id,
  encounter_no, reception_type, status, started_at)
values ('96370000-0000-4000-8000-000000000002', 'workspace-clair-cheongdam',
  '96370000-0000-4000-8000-000000000001', '49110000-0000-4000-8000-000000000003',
  'MULTI-CHART-037', 'walk_in', 'in_consultation', now()),
  ('96370000-0000-4000-8000-000000000102', 'workspace-clair-cheongdam',
  '96370000-0000-4000-8000-000000000101', '49110000-0000-4000-8000-000000000003',
  'MULTI-CHART-037-LIMIT', 'walk_in', 'in_consultation', now());
insert into public.diagnosis_catalog(id, workspace_id, name)
values ('96370000-0000-4000-8000-000000000003', 'workspace-clair-cheongdam',
  'Synthetic stable diagnosis');
update public.workspace_permission_roles role
set permissions = '{"allowed":["chart:view","chart:update"]}'::jsonb
from public.workspace_membership_permission_role_assignments assignment
join public.user_memberships membership on membership.workspace_id = assignment.workspace_id
  and membership.id = assignment.membership_id
where role.workspace_id = assignment.workspace_id and role.id = assignment.permission_role_id
  and membership.workspace_id = 'workspace-clair-cheongdam'
  and membership.user_id in (
    '49110000-0000-4000-8000-000000000001',
    '49110000-0000-4000-8000-000000000003'
  );
set local role authenticated;
select set_config('request.jwt.claim.sub','49110000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $test$
declare
  w text := 'workspace-clair-cheongdam';
  actor text := '49110000-0000-4000-8000-000000000003';
  second_actor text := '49110000-0000-4000-8000-000000000001';
  e uuid := '96370000-0000-4000-8000-000000000002';
  e_limit uuid := '96370000-0000-4000-8000-000000000102';
  a jsonb; b jsonb; state jsonb; first_snapshot jsonb; diagnosis_id text;
  limit_a jsonb; limit_b jsonb; limit_state jsonb;
  rows_20 jsonb; rows_11 jsonb; rows_31 jsonb;
  preserved_diagnosis_id uuid; preserved_updater uuid; preserved_updated_at timestamptz;
  after_updater uuid; after_updated_at timestamptz;
  catalog_id uuid := '96370000-0000-4000-8000-000000000003'; denied boolean;
begin
  a := public.clair_create_encounter_chart(w,actor,e,gen_random_uuid());
  b := public.clair_create_encounter_chart(w,actor,e,gen_random_uuid());
  state := public.clair_get_chart_diagnosis_assessments(w,e,(a->>'id')::uuid);
  state := public.clair_save_chart_diagnoses_v2(w,actor,e,(a->>'id')::uuid,
    jsonb_build_array(jsonb_build_object('diagnosisCatalogId',catalog_id,
      'diagnosisType','suspected','isPrimary',true)),state->>'version');
  diagnosis_id := state->'diagnoses'->0->>'id';
  first_snapshot := state->'assessments';
  denied := false;
  begin perform public.clair_sign_encounter_chart(w,actor,e,(a->>'id')::uuid,(a->>'updatedAt')::timestamptz);
  exception when others then if sqlerrm = 'soap_note_conflict' then denied := true; else raise; end if; end;
  if not denied then raise exception 'sign_accepted_stale_assessment'; end if;
  a := state->'chart';
  perform public.clair_sign_encounter_chart(w,actor,e,(a->>'id')::uuid,(a->>'updatedAt')::timestamptz);
  state := public.clair_save_chart_diagnoses_v2(w,actor,e,(b->>'id')::uuid,
    jsonb_build_array(jsonb_build_object('diagnosisCatalogId',catalog_id,
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
  if jsonb_array_length(state->'diagnoses') <> 1 then raise exception 'other_chart_diagnosis_removed'; end if;
  if state->'assessments' <> '[]'::jsonb then raise exception 'selected_chart_assessment_not_cleared'; end if;
  if public.clair_get_chart_diagnosis_assessments(w,e,(a->>'id')::uuid)->'assessments' <> first_snapshot then
    raise exception 'assessment_clear_removed_history'; end if;

  -- The 30-row contract belongs to each selected chart input, not to the
  -- encounter aggregate. Saving chart B must not update chart A's untouched
  -- diagnosis attribution while the encounter grows beyond 30 active rows.
  limit_a := public.clair_create_encounter_chart(w,actor,e_limit,gen_random_uuid());
  limit_b := public.clair_create_encounter_chart(w,actor,e_limit,gen_random_uuid());
  limit_state := public.clair_get_chart_diagnosis_assessments(
    w,e_limit,(limit_a->>'id')::uuid
  );
  select jsonb_agg(jsonb_build_object(
    'diagnosisText', 'Synthetic chart A diagnosis ' || item_no,
    'diagnosisType', 'suspected',
    'isPrimary', false
  ) order by item_no)
  into rows_20
  from generate_series(1,20) item_no;
  limit_state := public.clair_save_chart_diagnoses_v2(
    w,actor,e_limit,(limit_a->>'id')::uuid,rows_20,limit_state->>'version'
  );
  select
    (row.value->>'id')::uuid,
    (row.value->>'updatedByUserId')::uuid,
    (row.value->>'updatedAt')::timestamptz
  into preserved_diagnosis_id, preserved_updater, preserved_updated_at
  from jsonb_array_elements(limit_state->'diagnoses') row(value)
  where row.value->>'diagnosisText' = 'Synthetic chart A diagnosis 1';

  perform set_config('request.jwt.claim.sub',second_actor,true);
  select jsonb_agg(jsonb_build_object(
    'diagnosisText', 'Synthetic chart B diagnosis ' || item_no,
    'diagnosisType', 'suspected',
    'isPrimary', false
  ) order by item_no)
  into rows_11
  from generate_series(1,11) item_no;
  limit_state := public.clair_save_chart_diagnoses_v2(
    w,second_actor,e_limit,(limit_b->>'id')::uuid,rows_11,limit_state->>'version'
  );
  if jsonb_array_length(limit_state->'diagnoses') <> 31 then
    raise exception 'encounter_aggregate_over_30_rejected'; end if;
  select
    (row.value->>'updatedByUserId')::uuid,
    (row.value->>'updatedAt')::timestamptz
  into after_updater, after_updated_at
  from jsonb_array_elements(limit_state->'diagnoses') row(value)
  where (row.value->>'id')::uuid = preserved_diagnosis_id;
  if after_updater is distinct from preserved_updater
    or after_updated_at is distinct from preserved_updated_at
  then
    raise exception 'untouched_chart_diagnosis_attribution_changed';
  end if;

  select jsonb_agg(jsonb_build_object(
    'diagnosisText', 'Synthetic oversized diagnosis ' || item_no,
    'diagnosisType', 'suspected',
    'isPrimary', false
  ) order by item_no)
  into rows_31
  from generate_series(1,31) item_no;
  denied := false;
  begin
    perform public.clair_save_chart_diagnoses_v2(
      w,second_actor,e_limit,(limit_b->>'id')::uuid,rows_31,limit_state->>'version'
    );
  exception when others then
    if sqlerrm = 'too_many_diagnosis_rows' then denied := true; else raise; end if;
  end;
  if not denied then raise exception 'selected_chart_over_30_accepted'; end if;
end;
$test$;
reset role;
do $assert$
begin
  if (select count(*) from public.diagnoses where encounter_id = '96370000-0000-4000-8000-000000000002') <> 1 then
    raise exception 'diagnosis_deleted_or_duplicated'; end if;
  if not exists(select 1 from public.diagnoses where encounter_id = '96370000-0000-4000-8000-000000000002'
    and retired_at is null and diagnosis_type = 'confirmed' and closed_at is not null) then
    raise exception 'active_encounter_diagnosis_not_preserved'; end if;
end;
$assert$;
select 'PASS encounter_multi_chart_diagnosis_contract' as result;
rollback;
