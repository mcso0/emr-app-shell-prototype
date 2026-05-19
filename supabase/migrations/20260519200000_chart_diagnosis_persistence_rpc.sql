-- DEN-71: local-first chart diagnosis persistence RPC boundary.
-- Created manually because the Supabase CLI is not installed in this workspace.
-- Remote Supabase application remains approval-gated.

create or replace function public.clair_get_chart_diagnoses(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_diagnosis_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if not exists (
    select 1
    from public.encounters e
    where e.workspace_id = p_workspace_id
      and e.id = p_encounter_id
      and e.status <> 'cancelled'
  ) then
    raise exception 'encounter_unavailable';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id::text,
        'encounterId', d.encounter_id::text,
        'diagnosisCatalogId', d.diagnosis_catalog_id::text,
        'diagnosisText', d.diagnosis_text,
        'diagnosisType', d.diagnosis_type,
        'isPrimary', d.is_primary,
        'sortOrder', d.sort_order,
        'createdByUserId', d.created_by_user_id::text,
        'updatedByUserId', d.updated_by_user_id::text,
        'createdAt', d.created_at,
        'updatedAt', d.updated_at
      )
      order by d.sort_order, d.created_at, d.id
    ),
    '[]'::jsonb
  )
    into v_diagnosis_rows
  from public.diagnoses d
  where d.workspace_id = p_workspace_id
    and d.encounter_id = p_encounter_id;

  return v_diagnosis_rows;
end;
$$;

create or replace function public.clair_save_chart_diagnoses(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_diagnoses jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_now timestamptz := now();
  v_diagnosis_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if jsonb_typeof(coalesce(p_diagnoses, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_diagnosis_rows';
  end if;

  if jsonb_array_length(coalesce(p_diagnoses, '[]'::jsonb)) > 30 then
    raise exception 'too_many_diagnosis_rows';
  end if;

  if not exists (
    select 1
    from public.encounters e
    where e.workspace_id = p_workspace_id
      and e.id = p_encounter_id
      and e.status <> 'cancelled'
    for update
  ) then
    raise exception 'encounter_unavailable';
  end if;

  delete from public.diagnoses
  where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id;

  insert into public.diagnoses (
    id,
    workspace_id,
    encounter_id,
    diagnosis_catalog_id,
    diagnosis_text,
    diagnosis_type,
    is_primary,
    sort_order,
    created_by_user_id,
    updated_by_user_id,
    created_at,
    updated_at
  )
  select
    coalesce(nullif(row_data.value->>'id', '')::uuid, gen_random_uuid()),
    p_workspace_id,
    p_encounter_id,
    nullif(row_data.value->>'diagnosisCatalogId', '')::uuid,
    btrim(row_data.value->>'diagnosisText'),
    coalesce(nullif(row_data.value->>'diagnosisType', ''), 'suspected'),
    coalesce((row_data.value->>'isPrimary')::boolean, false),
    coalesce((row_data.value->>'sortOrder')::integer, row_data.ordinality::integer - 1),
    v_actor_user_id,
    v_actor_user_id,
    v_now,
    v_now
  from jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) with ordinality as row_data(value, ordinality)
  where length(btrim(row_data.value->>'diagnosisText')) > 0
    and coalesce(nullif(row_data.value->>'diagnosisType', ''), 'suspected') in ('suspected', 'confirmed', 'differential');

  update public.encounters
  set
    status = case when status = 'waiting' then 'in_consultation' else status end,
    started_at = coalesce(started_at, v_now),
    updated_at = v_now
  where workspace_id = p_workspace_id
    and id = p_encounter_id
    and status <> 'cancelled';

  select public.clair_get_chart_diagnoses(p_workspace_id, p_encounter_id)
    into v_diagnosis_rows;

  return v_diagnosis_rows;
end;
$$;

revoke all on function public.clair_get_chart_diagnoses(text, uuid) from public;
revoke all on function public.clair_save_chart_diagnoses(text, text, uuid, jsonb) from public;
grant execute on function public.clair_get_chart_diagnoses(text, uuid) to authenticated;
grant execute on function public.clair_save_chart_diagnoses(text, text, uuid, jsonb) to authenticated;

comment on function public.clair_get_chart_diagnoses(text, uuid) is
  'DEN-71 local-first route-owned diagnosis reader scoped by active workspace membership and encounter workspace.';
comment on function public.clair_save_chart_diagnoses(text, text, uuid, jsonb) is
  'DEN-71 local-first route-owned diagnosis writer for catalog-linked and free-text chart rows.';
