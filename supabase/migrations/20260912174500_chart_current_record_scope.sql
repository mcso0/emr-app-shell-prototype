-- Keep chart assessment edits scoped to the selected chart while preserving
-- encounter-owned diagnosis identities and historical chart snapshots.

create or replace function public.clair_save_chart_diagnoses_v2(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_chart_id uuid,
  p_diagnoses jsonb,
  p_expected_version text,
  p_assessed_diagnosis_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_rows jsonb;
  v_result jsonb;
  v_before jsonb;
  v_note public.soap_notes;
  v_member uuid;
  v_assessment_input jsonb;
  v_merged_input jsonb;
  v_assessment_ids uuid[];
begin
  perform private.clair_require_chart_encounter(
    p_workspace_id,
    p_encounter_id,
    p_actor_user_id
  );

  select status
  into v_status
  from public.soap_notes
  where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id
    and id = p_chart_id
    and status <> 'voided'
  for update;

  if v_status is null then
    raise exception 'chart_unavailable';
  end if;
  if v_status not in ('draft', 'autosaved') then
    raise exception 'signed_chart_read_only';
  end if;
  if p_expected_version is distinct from
    private.clair_encounter_diagnoses_version(p_workspace_id, p_encounter_id)
  then
    raise exception 'diagnoses_conflict';
  end if;
  if pg_catalog.jsonb_typeof(coalesce(p_diagnoses, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_diagnosis_rows' using errcode = '22023';
  end if;

  -- Assign identity before merging so a chart-local addition can be selected
  -- for its snapshot without guessing from text or timestamps. Reuse the
  -- encounter's stable identity when the same catalog diagnosis already
  -- exists; only a genuinely new diagnosis receives a new UUID.
  select coalesce(
    pg_catalog.jsonb_agg(
      case
        when nullif(input.value->>'id', '') is null then
          input.value || pg_catalog.jsonb_build_object(
            'id', coalesce(existing.id, extensions.gen_random_uuid())
          )
        else input.value
      end
      order by input.ordinality
    ),
    '[]'::jsonb
  )
  into v_assessment_input
  from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb))
    with ordinality input(value, ordinality)
  left join public.diagnoses existing
    on existing.workspace_id = p_workspace_id
    and existing.encounter_id = p_encounter_id
    and existing.diagnosis_catalog_id =
      nullif(input.value->>'diagnosisCatalogId', '')::uuid;

  -- The stable encounter writer is intentionally still the authority for
  -- catalog snapshots, closure metadata, permissions and audit. Supply a full
  -- active encounter set so removing a diagnosis from one chart assessment
  -- never retires diagnoses owned by another chart.
  with incoming as (
    select
      input.value,
      input.ordinality,
      nullif(input.value->>'id', '')::uuid as id,
      nullif(input.value->>'diagnosisCatalogId', '')::uuid as catalog_id
    from pg_catalog.jsonb_array_elements(v_assessment_input)
      with ordinality input(value, ordinality)
  ), merged as (
    select
      pg_catalog.jsonb_build_object(
        'id', diagnosis.id,
        'diagnosisCatalogId', diagnosis.diagnosis_catalog_id,
        'diagnosisText', diagnosis.diagnosis_text,
        'diagnosisType', diagnosis.diagnosis_type,
        'isClosed', diagnosis.closed_at is not null,
        'isPrimary', diagnosis.is_primary,
        'sortOrder', diagnosis.sort_order
      ) as value,
      diagnosis.sort_order::bigint as sort_key,
      0 as source_rank,
      diagnosis.id::text as tie_breaker
    from public.diagnoses diagnosis
    where diagnosis.workspace_id = p_workspace_id
      and diagnosis.encounter_id = p_encounter_id
      and diagnosis.retired_at is null
      and not exists (
        select 1
        from incoming
        where incoming.id = diagnosis.id
          or (
            incoming.catalog_id is not null
            and incoming.catalog_id = diagnosis.diagnosis_catalog_id
          )
      )

    union all

    select
      incoming.value,
      coalesce(
        existing_by_id.sort_order,
        existing_by_catalog.sort_order,
        1000000 + incoming.ordinality
      )::bigint as sort_key,
      1 as source_rank,
      incoming.ordinality::text as tie_breaker
    from incoming
    left join public.diagnoses existing_by_id
      on existing_by_id.workspace_id = p_workspace_id
      and existing_by_id.encounter_id = p_encounter_id
      and existing_by_id.id = incoming.id
    left join public.diagnoses existing_by_catalog
      on existing_by_catalog.workspace_id = p_workspace_id
      and existing_by_catalog.encounter_id = p_encounter_id
      and incoming.catalog_id is not null
      and existing_by_catalog.diagnosis_catalog_id = incoming.catalog_id
  )
  select coalesce(
    pg_catalog.jsonb_agg(value order by sort_key, source_rank, tie_breaker),
    '[]'::jsonb
  )
  into v_merged_input
  from merged;

  v_rows := private.clair_save_encounter_diagnoses_stable(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id,
    v_merged_input
  );

  if p_assessed_diagnosis_ids is null then
    select coalesce(
      pg_catalog.array_agg((input.value->>'id')::uuid order by input.ordinality),
      array[]::uuid[]
    )
    into v_assessment_ids
    from pg_catalog.jsonb_array_elements(v_assessment_input)
      with ordinality input(value, ordinality);
  else
    v_assessment_ids := p_assessed_diagnosis_ids;
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(v_assessment_ids) selected(id)
    where not exists (
      select 1
      from public.diagnoses diagnosis
      where diagnosis.workspace_id = p_workspace_id
        and diagnosis.encounter_id = p_encounter_id
        and diagnosis.id = selected.id
        and diagnosis.retired_at is null
    )
  ) then
    raise exception 'diagnosis_id_outside_target_encounter';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      assessment.assessment_snapshot
      order by
        coalesce((assessment.assessment_snapshot->>'sortOrder')::integer, 0),
        assessment.diagnosis_id
    ),
    '[]'::jsonb
  )
  into v_before
  from public.chart_diagnosis_assessments assessment
  where assessment.workspace_id = p_workspace_id
    and assessment.encounter_id = p_encounter_id
    and assessment.chart_id = p_chart_id;

  delete from public.chart_diagnosis_assessments
  where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id
    and chart_id = p_chart_id;

  insert into public.chart_diagnosis_assessments(
    workspace_id,
    encounter_id,
    chart_id,
    diagnosis_id,
    assessment_snapshot,
    assessed_by_user_id
  )
  select
    p_workspace_id,
    p_encounter_id,
    p_chart_id,
    (saved.value->>'id')::uuid,
    saved.value || pg_catalog.jsonb_build_object(
      'sortOrder', coalesce(input_row.ordinality::integer - 1,
        (saved.value->>'sortOrder')::integer)
    ),
    auth.uid()
  from pg_catalog.jsonb_array_elements(v_rows) saved(value)
  left join lateral (
    select input.ordinality
    from pg_catalog.jsonb_array_elements(v_assessment_input)
      with ordinality input(value, ordinality)
    where input.value->>'id' = saved.value->>'id'
    limit 1
  ) input_row on true
  where (saved.value->>'id')::uuid = any(v_assessment_ids);

  update public.soap_notes
  set updated_at = pg_catalog.clock_timestamp()
  where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id
    and id = p_chart_id
  returning * into v_note;

  select pg_catalog.jsonb_build_object(
    'diagnoses', v_rows,
    'assessments', coalesce(
      pg_catalog.jsonb_agg(
        assessment.assessment_snapshot
        order by
          coalesce((assessment.assessment_snapshot->>'sortOrder')::integer, 0),
          assessment.diagnosis_id
      ),
      '[]'::jsonb
    ),
    'chart', private.clair_chart_note_json(v_note),
    'version', private.clair_encounter_diagnoses_version(
      p_workspace_id,
      p_encounter_id
    )
  )
  into v_result
  from public.chart_diagnosis_assessments assessment
  where assessment.workspace_id = p_workspace_id
    and assessment.encounter_id = p_encounter_id
    and assessment.chart_id = p_chart_id;

  select id
  into v_member
  from public.user_memberships
  where workspace_id = p_workspace_id
    and user_id = auth.uid()
    and status = 'active'
  order by created_at
  limit 1;

  perform public.clair_append_audit_event(
    p_id => 'chart-assessment-' || extensions.gen_random_uuid()::text,
    p_workspace_id => p_workspace_id,
    p_actor_user_id => auth.uid(),
    p_actor_membership_id => v_member,
    p_event_type => 'diagnosis.changed',
    p_target_type => 'soap_note',
    p_target_id => p_chart_id::text,
    p_encounter_id => p_encounter_id,
    p_before_snapshot => pg_catalog.jsonb_build_object(
      'chartId', p_chart_id,
      'assessments', v_before
    ),
    p_after_snapshot => pg_catalog.jsonb_build_object(
      'chartId', p_chart_id,
      'assessments', v_result->'assessments'
    ),
    p_metadata => pg_catalog.jsonb_build_object(
      'source', 'chart-diagnosis-assessment'
    ),
    p_occurred_at => pg_catalog.clock_timestamp()
  );

  return v_result;
end;
$$;

revoke all on function public.clair_save_chart_diagnoses_v2(
  text,
  text,
  uuid,
  uuid,
  jsonb,
  text,
  uuid[]
) from public, anon;
grant execute on function public.clair_save_chart_diagnoses_v2(
  text,
  text,
  uuid,
  uuid,
  jsonb,
  text,
  uuid[]
) to authenticated;

comment on function public.clair_save_chart_diagnoses_v2(
  text,
  text,
  uuid,
  uuid,
  jsonb,
  text,
  uuid[]
) is
  'Saves only the selected chart assessment set while preserving other encounter diagnoses and immutable historical chart snapshots.';
