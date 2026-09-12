-- Keep chart assessment edits scoped to the selected chart while preserving
-- encounter-owned diagnosis identities and historical chart snapshots.

alter table public.soap_notes
  add column if not exists diagnosis_assessment_revision bigint not null default 0;

comment on column public.soap_notes.diagnosis_assessment_revision is
  'Monotonic revision for this chart diagnosis assessment snapshot.';

create or replace function private.clair_chart_diagnoses_version(
  p_workspace_id text,
  p_encounter_id uuid,
  p_chart_id uuid
)
returns text
language sql
stable
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      p_workspace_id || ':' ||
      p_encounter_id::text || ':' ||
      p_chart_id::text || ':' ||
      private.clair_encounter_diagnoses_version(
        p_workspace_id,
        p_encounter_id
      ) || ':' ||
      coalesce(
        (
          select note.diagnosis_assessment_revision::text
          from public.soap_notes note
          where note.workspace_id = p_workspace_id
            and note.encounter_id = p_encounter_id
            and note.id = p_chart_id
            and note.status <> 'voided'
        ),
        'missing'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function private.clair_chart_diagnoses_version(
  text,
  uuid,
  uuid
) from public, anon, authenticated;

comment on function private.clair_chart_diagnoses_version(text, uuid, uuid) is
  'Opaque concurrency token for encounter diagnoses and one chart assessment revision.';

create or replace function public.clair_get_chart_diagnosis_assessments(
  p_workspace_id text,
  p_encounter_id uuid,
  p_chart_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assessments jsonb;
begin
  perform public.clair_get_chart_soap_note_by_id(
    p_workspace_id,
    p_encounter_id,
    p_chart_id
  );

  select coalesce(
    pg_catalog.jsonb_agg(
      assessment.assessment_snapshot
      order by
        coalesce((assessment.assessment_snapshot->>'sortOrder')::integer, 0),
        assessment.diagnosis_id
    ),
    '[]'::jsonb
  )
  into v_assessments
  from public.chart_diagnosis_assessments assessment
  where assessment.workspace_id = p_workspace_id
    and assessment.encounter_id = p_encounter_id
    and assessment.chart_id = p_chart_id;

  return pg_catalog.jsonb_build_object(
    'diagnoses', public.clair_get_chart_diagnoses(
      p_workspace_id,
      p_encounter_id
    ),
    'assessments', v_assessments,
    'version', private.clair_chart_diagnoses_version(
      p_workspace_id,
      p_encounter_id,
      p_chart_id
    )
  );
end;
$$;

revoke all on function public.clair_get_chart_diagnosis_assessments(
  text,
  uuid,
  uuid
) from public, anon;
grant execute on function public.clair_get_chart_diagnosis_assessments(
  text,
  uuid,
  uuid
) to authenticated;

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
  v_after jsonb;
  v_note public.soap_notes;
  v_member uuid;
  v_assessment_input jsonb;
  v_assessment_ids uuid[];
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_input jsonb;
  v_existing_state jsonb := '{}'::jsonb;
  v_patient_id uuid;
  v_guardian_id uuid;
  v_before_diagnoses_audit jsonb;
  v_after_diagnoses_audit jsonb;
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
    private.clair_chart_diagnoses_version(
      p_workspace_id,
      p_encounter_id,
      p_chart_id
    )
  then
    raise exception 'diagnoses_conflict';
  end if;
  if pg_catalog.jsonb_typeof(coalesce(p_diagnoses, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_diagnosis_rows' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(coalesce(p_diagnoses, '[]'::jsonb)) > 30 then
    raise exception 'too_many_diagnosis_rows' using errcode = '22023';
  end if;

  -- Validate only the selected chart's rows. Other charts can take the
  -- encounter above 30 diagnoses without consuming this chart's own limit.
  for v_input in
    select value
    from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) rows(value)
  loop
    if pg_catalog.jsonb_typeof(v_input) <> 'object'
      or exists (
        select 1
        from pg_catalog.jsonb_object_keys(v_input) key
        where key not in (
          'id',
          'diagnosisCatalogId',
          'diagnosisText',
          'diagnosisType',
          'isClosed',
          'isPrimary',
          'sortOrder'
        )
      )
    then
      raise exception 'invalid_diagnosis_row_contract' using errcode = '22023';
    end if;
    if coalesce(nullif(v_input->>'diagnosisType', ''), 'suspected') not in (
      'suspected',
      'confirmed',
      'differential'
    ) then
      raise exception 'invalid_diagnosis_type' using errcode = '22023';
    end if;
    if nullif(v_input->>'diagnosisCatalogId', '') is null
      and (
        pg_catalog.length(pg_catalog.btrim(coalesce(v_input->>'diagnosisText', ''))) < 1
        or pg_catalog.length(pg_catalog.btrim(coalesce(v_input->>'diagnosisText', ''))) > 500
      )
    then
      raise exception 'invalid_free_text_diagnosis' using errcode = '22023';
    end if;
    if nullif(v_input->>'id', '') is not null and exists (
      select 1
      from public.diagnoses existing
      where existing.id = (v_input->>'id')::uuid
        and (
          existing.workspace_id <> p_workspace_id
          or existing.encounter_id <> p_encounter_id
        )
    ) then
      raise exception 'diagnosis_id_outside_target_encounter' using errcode = '42501';
    end if;
  end loop;

  if exists (
    select 1
    from (
      select value->>'id' as id
      from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) rows(value)
      where nullif(value->>'id', '') is not null
      group by value->>'id'
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'duplicate_diagnosis_id' using errcode = '23505';
  end if;
  if exists (
    select 1
    from (
      select value->>'diagnosisCatalogId' as catalog_id
      from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) rows(value)
      where nullif(value->>'diagnosisCatalogId', '') is not null
      group by value->>'diagnosisCatalogId'
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'duplicate_diagnosis_catalog_id' using errcode = '23505';
  end if;

  select patient_id, guardian_id
  into v_patient_id, v_guardian_id
  from public.encounters
  where workspace_id = p_workspace_id
    and id = p_encounter_id;

  -- Serialize catalog availability with the adopter before validating, then
  -- lock the encounter diagnosis identities before assigning reused IDs.
  perform catalog.id
  from public.diagnosis_catalog catalog
  join (
    select distinct (value->>'diagnosisCatalogId')::uuid as id
    from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) rows(value)
    where nullif(value->>'diagnosisCatalogId', '') is not null
  ) requested on requested.id = catalog.id
  where catalog.workspace_id = p_workspace_id
  order by catalog.id
  for update of catalog;

  perform 1
  from public.diagnoses
  where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id
  for update;

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

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_assessment_input) rows(value)
    where nullif(value->>'diagnosisCatalogId', '') is not null
      and not exists (
        select 1
        from public.diagnosis_catalog catalog
        where catalog.id = (rows.value->>'diagnosisCatalogId')::uuid
          and catalog.workspace_id = p_workspace_id
          and catalog.is_active
          and catalog.availability_state = 'active'
      )
      and not exists (
        select 1
        from public.diagnoses existing
        where existing.workspace_id = p_workspace_id
          and existing.encounter_id = p_encounter_id
          and existing.id = nullif(rows.value->>'id', '')::uuid
          and existing.diagnosis_catalog_id =
            (rows.value->>'diagnosisCatalogId')::uuid
      )
  ) then
    raise exception 'diagnosis_catalog_item_unavailable' using errcode = '23503';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_assessment_input) rows(value)
    join public.diagnoses existing
      on existing.workspace_id = p_workspace_id
      and existing.encounter_id = p_encounter_id
      and existing.id = nullif(rows.value->>'id', '')::uuid
    where existing.diagnosis_catalog_id is distinct from
      nullif(rows.value->>'diagnosisCatalogId', '')::uuid
  ) then
    raise exception 'diagnosis_catalog_identity_immutable' using errcode = '23514';
  end if;

  select coalesce(
    pg_catalog.jsonb_object_agg(
      id::text,
      pg_catalog.jsonb_build_object(
        'catalogId', diagnosis_catalog_id,
        'catalogRevision', diagnosis_catalog_revision,
        'snapshot', diagnosis_snapshot,
        'closedAt', closed_at,
        'closedByUserId', closed_by_user_id,
        'createdAt', created_at,
        'createdByUserId', created_by_user_id
      )
    ),
    '{}'::jsonb
  )
  into v_existing_state
  from public.diagnoses
  where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id;

  select pg_catalog.jsonb_build_object(
    'count', count(*),
    'rows', coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', id,
          'catalogId', diagnosis_catalog_id,
          'catalogRevision', diagnosis_catalog_revision,
          'diagnosisMode', case
            when diagnosis_catalog_id is null then 'free_text'
            else 'catalog'
          end,
          'diagnosisTextFingerprint', pg_catalog.encode(
            extensions.digest(coalesce(diagnosis_text, ''), 'sha256'),
            'hex'
          ),
          'diagnosisType', diagnosis_type,
          'isClosed', closed_at is not null,
          'retiredAt', retired_at,
          'isPrimary', is_primary,
          'sortOrder', sort_order
        )
        order by sort_order, id
      ),
      '[]'::jsonb
    )
  )
  into v_before_diagnoses_audit
  from public.diagnoses
  where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id;

  -- Only selected-chart input rows are written. Existing rows absent from this
  -- input keep their updater, timestamps, closure state and retirement state.
  insert into public.diagnoses(
    id,
    workspace_id,
    encounter_id,
    diagnosis_catalog_id,
    diagnosis_catalog_revision,
    diagnosis_snapshot,
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
    (input.value->>'id')::uuid,
    p_workspace_id,
    p_encounter_id,
    catalog.id,
    case
      when catalog.id is not null
        and v_existing_state -> (input.value->>'id') ->> 'catalogId' = catalog.id::text
      then (v_existing_state -> (input.value->>'id') ->> 'catalogRevision')::integer
      else catalog.catalog_revision
    end,
    case
      when catalog.id is null then null
      when v_existing_state -> (input.value->>'id') ->> 'catalogId' = catalog.id::text
      then v_existing_state -> (input.value->>'id') -> 'snapshot'
      else pg_catalog.jsonb_build_object(
        'catalogId', catalog.id,
        'catalogRevision', catalog.catalog_revision,
        'sourceMasterRevision', catalog.last_applied_revision,
        'diagnosisName', catalog.name,
        'systemId', catalog.system_master_record_id,
        'systemLabel', catalog.system_name,
        'diseaseGroupId', catalog.disease_group_master_record_id,
        'diseaseGroupLabel', catalog.disease_group_name,
        'sourceMasterRecordId', catalog.source_master_record_id
      )
    end,
    case
      when catalog.id is null then pg_catalog.btrim(input.value->>'diagnosisText')
      when v_existing_state -> (input.value->>'id') ->> 'catalogId' = catalog.id::text
      then coalesce(
        v_existing_state -> (input.value->>'id') -> 'snapshot' ->> 'diagnosisName',
        catalog.name
      )
      else catalog.name
    end,
    coalesce(nullif(input.value->>'diagnosisType', ''), 'suspected'),
    case
      when coalesce((input.value->>'isClosed')::boolean, false)
      then coalesce(
        nullif(v_existing_state -> (input.value->>'id') ->> 'closedAt', '')::timestamptz,
        v_now
      )
      else null
    end,
    case
      when coalesce((input.value->>'isClosed')::boolean, false)
      then coalesce(
        nullif(v_existing_state -> (input.value->>'id') ->> 'closedByUserId', '')::uuid,
        v_actor_user_id
      )
      else null
    end,
    coalesce((input.value->>'isPrimary')::boolean, false),
    input.ordinality::integer - 1,
    coalesce(
      nullif(v_existing_state -> (input.value->>'id') ->> 'createdByUserId', '')::uuid,
      v_actor_user_id
    ),
    v_actor_user_id,
    coalesce(
      nullif(v_existing_state -> (input.value->>'id') ->> 'createdAt', '')::timestamptz,
      v_now
    ),
    v_now
  from pg_catalog.jsonb_array_elements(v_assessment_input)
    with ordinality input(value, ordinality)
  left join public.diagnosis_catalog catalog
    on catalog.id = nullif(input.value->>'diagnosisCatalogId', '')::uuid
    and catalog.workspace_id = p_workspace_id
    and (
      (catalog.is_active and catalog.availability_state = 'active')
      or v_existing_state -> (input.value->>'id') ->> 'catalogId' = catalog.id::text
    )
  on conflict (id) do update set
    diagnosis_text = excluded.diagnosis_text,
    diagnosis_type = excluded.diagnosis_type,
    closed_at = excluded.closed_at,
    closed_by_user_id = excluded.closed_by_user_id,
    is_primary = excluded.is_primary,
    sort_order = excluded.sort_order,
    updated_by_user_id = excluded.updated_by_user_id,
    updated_at = excluded.updated_at,
    retired_at = null
  where public.diagnoses.workspace_id = p_workspace_id
    and public.diagnoses.encounter_id = p_encounter_id;

  update public.encounters
  set updated_at = v_now
  where workspace_id = p_workspace_id
    and id = p_encounter_id
    and status <> 'cancelled';

  select pg_catalog.jsonb_build_object(
    'count', count(*),
    'rows', coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', id,
          'catalogId', diagnosis_catalog_id,
          'catalogRevision', diagnosis_catalog_revision,
          'diagnosisMode', case
            when diagnosis_catalog_id is null then 'free_text'
            else 'catalog'
          end,
          'diagnosisTextFingerprint', pg_catalog.encode(
            extensions.digest(coalesce(diagnosis_text, ''), 'sha256'),
            'hex'
          ),
          'diagnosisType', diagnosis_type,
          'isClosed', closed_at is not null,
          'retiredAt', retired_at,
          'isPrimary', is_primary,
          'sortOrder', sort_order
        )
        order by sort_order, id
      ),
      '[]'::jsonb
    )
  )
  into v_after_diagnoses_audit
  from public.diagnoses
  where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id;

  select id
  into v_member
  from public.user_memberships
  where workspace_id = p_workspace_id
    and user_id = v_actor_user_id
    and status = 'active'
  order by created_at
  limit 1;

  insert into public.audit_events(
    id,
    workspace_id,
    actor_user_id,
    actor_membership_id,
    event_type,
    target_type,
    target_id,
    encounter_id,
    patient_id,
    guardian_id,
    before_snapshot,
    after_snapshot,
    metadata,
    occurred_at,
    created_at
  ) values (
    'audit_rpc_diagnosis_' || pg_catalog.substr(
      pg_catalog.encode(
        extensions.digest(
          p_workspace_id || ':' || p_encounter_id::text || ':' || v_now::text || ':' ||
            extensions.gen_random_uuid()::text,
          'sha256'
        ),
        'hex'
      ),
      1,
      24
    ),
    p_workspace_id,
    v_actor_user_id,
    v_member,
    'diagnosis.changed',
    'encounter_diagnoses',
    p_encounter_id::text,
    p_encounter_id,
    v_patient_id,
    v_guardian_id,
    v_before_diagnoses_audit,
    v_after_diagnoses_audit,
    pg_catalog.jsonb_build_object('rpc', 'clair_save_chart_diagnoses'),
    v_now,
    v_now
  );

  select public.clair_get_chart_diagnoses(p_workspace_id, p_encounter_id)
  into v_rows;

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

  select coalesce(
    pg_catalog.jsonb_agg(
      assessment.assessment_snapshot
      order by
        coalesce((assessment.assessment_snapshot->>'sortOrder')::integer, 0),
        assessment.diagnosis_id
    ),
    '[]'::jsonb
  )
  into v_after
  from public.chart_diagnosis_assessments assessment
  where assessment.workspace_id = p_workspace_id
    and assessment.encounter_id = p_encounter_id
    and assessment.chart_id = p_chart_id;

  update public.soap_notes
  set diagnosis_assessment_revision = diagnosis_assessment_revision +
        case when v_before is distinct from v_after then 1 else 0 end,
      updated_at = pg_catalog.clock_timestamp()
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
    'version', private.clair_chart_diagnoses_version(
      p_workspace_id,
      p_encounter_id,
      p_chart_id
    )
  )
  into v_result
  from public.chart_diagnosis_assessments assessment
  where assessment.workspace_id = p_workspace_id
    and assessment.encounter_id = p_encounter_id
    and assessment.chart_id = p_chart_id;

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
