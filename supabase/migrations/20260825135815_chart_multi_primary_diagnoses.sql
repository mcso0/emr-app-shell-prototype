-- Follow-up to the chart diagnosis runtime adoption.
-- Multiple rows may be marked as primary; display order remains sort_order.
-- This migration is intentionally local until the production DB apply gate is approved.

drop index if exists public.diagnoses_workspace_encounter_primary_key;

create index if not exists diagnoses_workspace_encounter_primary_idx
  on public.diagnoses(workspace_id, encounter_id, sort_order)
  where is_primary = true;

create or replace function public.clair_save_chart_diagnoses(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_diagnoses jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_existing_state jsonb := '{}'::jsonb;
  v_now timestamptz := pg_catalog.now();
  v_rows jsonb;
  v_input jsonb;
  v_actor_membership_id uuid;
  v_patient_id uuid;
  v_guardian_id uuid;
  v_before_audit jsonb;
  v_after_audit jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;
  if v_actor_user_id is null or v_actor_user_id is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(coalesce(p_diagnoses, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_diagnosis_rows' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(coalesce(p_diagnoses, '[]'::jsonb)) > 30 then
    raise exception 'too_many_diagnosis_rows' using errcode = '22023';
  end if;
  for v_input in
    select value from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) rows(value)
  loop
    if pg_catalog.jsonb_typeof(v_input) <> 'object'
      or exists (
        select 1 from pg_catalog.jsonb_object_keys(v_input) key
        where key not in ('id','diagnosisCatalogId','diagnosisText','diagnosisType','isClosed','isPrimary','sortOrder')
      ) then
      raise exception 'invalid_diagnosis_row_contract' using errcode = '22023';
    end if;
    if coalesce(nullif(v_input->>'diagnosisType',''), 'suspected') not in ('suspected','confirmed','differential') then
      raise exception 'invalid_diagnosis_type' using errcode = '22023';
    end if;
    if nullif(v_input->>'diagnosisCatalogId','') is null
      and (pg_catalog.length(pg_catalog.btrim(coalesce(v_input->>'diagnosisText',''))) < 1
        or pg_catalog.length(pg_catalog.btrim(coalesce(v_input->>'diagnosisText',''))) > 500) then
      raise exception 'invalid_free_text_diagnosis' using errcode = '22023';
    end if;
    if nullif(v_input->>'id','') is not null and exists (
      select 1 from public.diagnoses existing
      where existing.id = (v_input->>'id')::uuid
        and (existing.workspace_id <> p_workspace_id or existing.encounter_id <> p_encounter_id)
    ) then
      raise exception 'diagnosis_id_outside_target_encounter' using errcode = '42501';
    end if;
  end loop;
  if exists (
    select 1 from (
      select value->>'id' id
      from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) rows(value)
      where nullif(value->>'id','') is not null
      group by value->>'id' having count(*) > 1
    ) duplicates
  ) then
    raise exception 'duplicate_diagnosis_id' using errcode = '23505';
  end if;
  if exists (
    select 1 from (
      select value->>'diagnosisCatalogId' catalog_id
      from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) rows(value)
      where nullif(value->>'diagnosisCatalogId','') is not null
      group by value->>'diagnosisCatalogId' having count(*) > 1
    ) duplicates
  ) then
    raise exception 'duplicate_diagnosis_catalog_id' using errcode = '23505';
  end if;
  select patient_id, guardian_id into v_patient_id, v_guardian_id
  from public.encounters
  where workspace_id = p_workspace_id and id = p_encounter_id and status <> 'cancelled'
  for update;
  if not found then
    raise exception 'encounter_unavailable';
  end if;

  -- Serialize catalog availability with the adopter before validating. The
  -- deterministic row order avoids lock-order inversions for multi-select
  -- saves, and FOR UPDATE conflicts with the adopter's availability updates.
  perform catalog.id
  from public.diagnosis_catalog catalog
  join (
    select distinct (value->>'diagnosisCatalogId')::uuid as id
    from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) rows(value)
    where nullif(value->>'diagnosisCatalogId','') is not null
  ) requested on requested.id = catalog.id
  where catalog.workspace_id = p_workspace_id
  order by catalog.id
  for update of catalog;

  if exists (
    select 1 from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) rows(value)
    where nullif(value->>'diagnosisCatalogId','') is not null
      and not exists (
        select 1 from public.diagnosis_catalog catalog
        where catalog.id = (rows.value->>'diagnosisCatalogId')::uuid
          and catalog.workspace_id = p_workspace_id
          and catalog.is_active and catalog.availability_state = 'active'
      )
      and not exists (
        select 1 from public.diagnoses existing
        where existing.workspace_id = p_workspace_id
          and existing.encounter_id = p_encounter_id
          and existing.id = nullif(rows.value->>'id','')::uuid
          and existing.diagnosis_catalog_id = (rows.value->>'diagnosisCatalogId')::uuid
      )
  ) then
    raise exception 'diagnosis_catalog_item_unavailable' using errcode = '23503';
  end if;

  perform 1 from public.diagnoses
  where workspace_id = p_workspace_id and encounter_id = p_encounter_id
  for update;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) rows(value)
    join public.diagnoses existing
      on existing.workspace_id = p_workspace_id
      and existing.encounter_id = p_encounter_id
      and existing.id = nullif(rows.value->>'id','')::uuid
    where existing.diagnosis_catalog_id is distinct from nullif(rows.value->>'diagnosisCatalogId','')::uuid
  ) then
    raise exception 'diagnosis_catalog_identity_immutable' using errcode = '23514';
  end if;

  select coalesce(pg_catalog.jsonb_object_agg(id::text, pg_catalog.jsonb_build_object(
    'catalogId', diagnosis_catalog_id,
    'catalogRevision', diagnosis_catalog_revision,
    'snapshot', diagnosis_snapshot,
    'closedAt', closed_at,
    'closedByUserId', closed_by_user_id,
    'createdAt', created_at,
    'createdByUserId', created_by_user_id
  )), '{}'::jsonb) into v_existing_state
  from public.diagnoses where workspace_id = p_workspace_id and encounter_id = p_encounter_id;

  select pg_catalog.jsonb_build_object(
    'count', count(*),
    'rows', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', id,
      'catalogId', diagnosis_catalog_id,
      'catalogRevision', diagnosis_catalog_revision,
      'diagnosisMode', case when diagnosis_catalog_id is null then 'free_text' else 'catalog' end,
      'diagnosisTextFingerprint', pg_catalog.encode(extensions.digest(
        coalesce(diagnosis_text, ''), 'sha256'
      ), 'hex'),
      'diagnosisType', diagnosis_type,
      'isClosed', closed_at is not null,
      'isPrimary', is_primary,
      'sortOrder', sort_order
    ) order by sort_order, id), '[]'::jsonb)
  ) into v_before_audit
  from public.diagnoses where workspace_id = p_workspace_id and encounter_id = p_encounter_id;

  delete from public.diagnoses where workspace_id = p_workspace_id and encounter_id = p_encounter_id;

  insert into public.diagnoses(
    id, workspace_id, encounter_id, diagnosis_catalog_id, diagnosis_catalog_revision,
    diagnosis_snapshot, diagnosis_text, diagnosis_type, closed_at, closed_by_user_id,
    is_primary, sort_order, created_by_user_id, updated_by_user_id, created_at, updated_at
  )
  select
    coalesce(nullif(input.value->>'id','')::uuid, extensions.gen_random_uuid()),
    p_workspace_id,
    p_encounter_id,
    catalog.id,
    case
      when catalog.id is not null
        and v_existing_state -> (input.value->>'id') ->> 'catalogId' = catalog.id::text
      then (v_existing_state -> (input.value->>'id') ->> 'catalogRevision')::integer
      else catalog.catalog_revision
    end,
    case when catalog.id is null then null
      when v_existing_state -> (input.value->>'id') ->> 'catalogId' = catalog.id::text
        then v_existing_state -> (input.value->>'id') -> 'snapshot'
      else pg_catalog.jsonb_build_object(
      'catalogId', catalog.id,
      'catalogRevision', catalog.catalog_revision,
      -- Customized workspace projections can intentionally lag behind a newer
      -- source revision. Persist the last revision actually reflected by the
      -- displayed labels, not merely the newest revision observed upstream.
      'sourceMasterRevision', catalog.last_applied_revision,
      'diagnosisName', catalog.name,
      'systemId', catalog.system_master_record_id,
      'systemLabel', catalog.system_name,
      'diseaseGroupId', catalog.disease_group_master_record_id,
      'diseaseGroupLabel', catalog.disease_group_name,
      'sourceMasterRecordId', catalog.source_master_record_id
    ) end,
    case when catalog.id is null then pg_catalog.btrim(input.value->>'diagnosisText')
      when v_existing_state -> (input.value->>'id') ->> 'catalogId' = catalog.id::text
        then coalesce(v_existing_state -> (input.value->>'id') -> 'snapshot' ->> 'diagnosisName', catalog.name)
      else catalog.name end,
    coalesce(nullif(input.value->>'diagnosisType',''), 'suspected'),
    case when coalesce((input.value->>'isClosed')::boolean, false)
      then coalesce(nullif(v_existing_state -> (input.value->>'id') ->> 'closedAt','')::timestamptz, v_now)
      else null end,
    case when coalesce((input.value->>'isClosed')::boolean, false)
      then coalesce(nullif(v_existing_state -> (input.value->>'id') ->> 'closedByUserId','')::uuid, v_actor_user_id)
      else null end,
    coalesce((input.value->>'isPrimary')::boolean, false),
    input.ordinality::integer - 1,
    coalesce(nullif(v_existing_state -> (input.value->>'id') ->> 'createdByUserId','')::uuid, v_actor_user_id),
    v_actor_user_id,
    coalesce(nullif(v_existing_state -> (input.value->>'id') ->> 'createdAt','')::timestamptz, v_now),
    v_now
  from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) with ordinality input(value, ordinality)
  left join public.diagnosis_catalog catalog
    on catalog.id = nullif(input.value->>'diagnosisCatalogId','')::uuid
    and catalog.workspace_id = p_workspace_id
    and (
      (catalog.is_active and catalog.availability_state = 'active')
      or v_existing_state -> (input.value->>'id') ->> 'catalogId' = catalog.id::text
    )
  ;

  update public.encounters
  set status = case when status = 'waiting' then 'in_consultation' else status end,
      started_at = coalesce(started_at, v_now), updated_at = v_now
  where workspace_id = p_workspace_id and id = p_encounter_id and status <> 'cancelled';

  select pg_catalog.jsonb_build_object(
    'count', count(*),
    'rows', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', id,
      'catalogId', diagnosis_catalog_id,
      'catalogRevision', diagnosis_catalog_revision,
      'diagnosisMode', case when diagnosis_catalog_id is null then 'free_text' else 'catalog' end,
      'diagnosisTextFingerprint', pg_catalog.encode(extensions.digest(
        coalesce(diagnosis_text, ''), 'sha256'
      ), 'hex'),
      'diagnosisType', diagnosis_type,
      'isClosed', closed_at is not null,
      'isPrimary', is_primary,
      'sortOrder', sort_order
    ) order by sort_order, id), '[]'::jsonb)
  ) into v_after_audit
  from public.diagnoses where workspace_id = p_workspace_id and encounter_id = p_encounter_id;

  select id into v_actor_membership_id
  from public.user_memberships
  where workspace_id = p_workspace_id and user_id = v_actor_user_id and status = 'active'
  limit 1;
  insert into public.audit_events(
    id, workspace_id, actor_user_id, actor_membership_id, event_type,
    target_type, target_id, encounter_id, patient_id, guardian_id,
    before_snapshot, after_snapshot, metadata, occurred_at, created_at
  ) values (
    'audit_rpc_diagnosis_' || pg_catalog.substr(pg_catalog.encode(extensions.digest(
      p_workspace_id || ':' || p_encounter_id::text || ':' || v_now::text || ':' || extensions.gen_random_uuid()::text,
      'sha256'
    ), 'hex'), 1, 24),
    p_workspace_id, v_actor_user_id, v_actor_membership_id, 'diagnosis.changed',
    'encounter_diagnoses', p_encounter_id::text, p_encounter_id, v_patient_id, v_guardian_id,
    v_before_audit, v_after_audit,
    pg_catalog.jsonb_build_object('rpc', 'clair_save_chart_diagnoses'),
    v_now, v_now
  );

  select public.clair_get_chart_diagnoses(p_workspace_id, p_encounter_id) into v_rows;
  return v_rows;
end;
$$;

revoke all on function public.clair_save_chart_diagnoses(text, text, uuid, jsonb) from public, anon;
grant execute on function public.clair_save_chart_diagnoses(text, text, uuid, jsonb) to authenticated;

comment on index public.diagnoses_workspace_encounter_primary_idx is
  'Supports ordered lookup of all primary diagnoses for one encounter; primary is intentionally non-unique.';
