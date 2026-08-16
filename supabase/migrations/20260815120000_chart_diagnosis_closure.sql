-- CHART-PR-024: durable diagnosis closure state on the existing chart diagnosis boundary.
-- Remote application is intentionally outside this local implementation slice.

alter table public.diagnoses
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by_user_id uuid references public.users(id) on delete set null;

create or replace function public.clair_get_chart_diagnoses(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_diagnosis_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if not private.clair_current_user_has_workspace_permission(
    p_workspace_id,
    'chart:view'
  ) then
    raise exception 'permission_missing';
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
        'isClosed', d.closed_at is not null,
        'closedAt', d.closed_at,
        'closedByUserId', d.closed_by_user_id::text,
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
set search_path = ''
as $$
declare
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_existing_closure jsonb := '{}'::jsonb;
  v_now timestamptz := pg_catalog.now();
  v_diagnosis_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if v_actor_user_id is null or v_actor_user_id is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if not private.clair_current_user_has_workspace_permission(
    p_workspace_id,
    'chart:update'
  ) then
    raise exception 'permission_missing';
  end if;

  if jsonb_typeof(coalesce(p_diagnoses, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_diagnosis_rows';
  end if;

  if jsonb_array_length(coalesce(p_diagnoses, '[]'::jsonb)) > 30 then
    raise exception 'too_many_diagnosis_rows';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) as row_data(value)
    where coalesce((row_data.value->>'isPrimary')::boolean, false)
  ) > 1 then
    raise exception 'multiple_primary_diagnoses';
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

  select coalesce(
    jsonb_object_agg(
      d.id::text,
      jsonb_build_object(
        'closedAt', d.closed_at,
        'closedByUserId', d.closed_by_user_id::text
      )
    ),
    '{}'::jsonb
  )
    into v_existing_closure
  from public.diagnoses d
  where d.workspace_id = p_workspace_id
    and d.encounter_id = p_encounter_id;

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
    closed_at,
    closed_by_user_id,
    is_primary,
    sort_order,
    created_by_user_id,
    updated_by_user_id,
    created_at,
    updated_at
  )
  select
    coalesce(nullif(row_data.value->>'id', '')::uuid, pg_catalog.gen_random_uuid()),
    p_workspace_id,
    p_encounter_id,
    nullif(row_data.value->>'diagnosisCatalogId', '')::uuid,
    btrim(row_data.value->>'diagnosisText'),
    coalesce(nullif(row_data.value->>'diagnosisType', ''), 'suspected'),
    case
      when coalesce((row_data.value->>'isClosed')::boolean, false)
      then coalesce(
        nullif(
          v_existing_closure -> (row_data.value->>'id') ->> 'closedAt',
          ''
        )::timestamptz,
        v_now
      )
      else null
    end,
    case
      when coalesce((row_data.value->>'isClosed')::boolean, false)
      then coalesce(
        nullif(
          v_existing_closure -> (row_data.value->>'id') ->> 'closedByUserId',
          ''
        )::uuid,
        v_actor_user_id
      )
      else null
    end,
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

comment on column public.diagnoses.closed_at is
  'Diagnosis workflow closure timestamp. Null means the diagnosis remains open.';
comment on column public.diagnoses.closed_by_user_id is
  'Workspace user who most recently closed the diagnosis through the chart writer.';
comment on function public.clair_get_chart_diagnoses(text, uuid) is
  'CHART-PR-024 diagnosis reader including primary, confirmation, and closure state; requires active membership and chart:view.';
comment on function public.clair_save_chart_diagnoses(text, text, uuid, jsonb) is
  'CHART-PR-024 diagnosis writer preserving one primary and closure audit fields; requires actor/session equality and chart:update.';
