-- CHART-PR-033: isolate SOAP editor content by diagnosis-system scope while
-- preserving one active note row, V1 readers/writers, default projections,
-- workspace authorization, optimistic concurrency, and transactional audit.

alter table public.soap_notes
  drop constraint if exists soap_notes_block_document_pair_check;

alter table public.soap_notes
  add constraint soap_notes_block_document_pair_check
  check (
    (block_document is null and block_document_schema_version is null)
    or (
      block_document is not null
      and block_document_schema_version in (1, 2)
      and pg_catalog.jsonb_typeof(block_document) = 'array'
      and pg_catalog.jsonb_array_length(block_document) > 0
      and pg_catalog.octet_length(block_document::text) <= 262144
    )
  ) not valid;

alter table public.soap_notes
  validate constraint soap_notes_block_document_pair_check;

do $$
begin
  if pg_catalog.to_regprocedure('private.clair_soap_v1_document_is_valid(jsonb)') is null then
    alter function private.clair_soap_document_is_valid(jsonb)
      rename to clair_soap_v1_document_is_valid;
  end if;
end;
$$;

create or replace function private.clair_soap_document_is_valid(p_document jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_default_scope_count integer := 0;
  v_scope jsonb;
  v_scope_block_count integer;
  v_scope_key text;
  v_scope_kind text;
  v_scope_keys text[] := array[]::text[];
  v_system_id text;
  v_system_ids text[] := array[]::text[];
  v_system_label text;
  v_total_block_count integer := 0;
begin
  if pg_catalog.jsonb_typeof(p_document) is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_document->'schemaVersion') is distinct from 'number'
    or p_document->>'schemaVersion' not in ('1', '2')
    or pg_catalog.octet_length(p_document::text) > 262144
  then
    return false;
  end if;

  if p_document->>'schemaVersion' = '1' then
    return private.clair_soap_v1_document_is_valid(p_document);
  end if;

  if pg_catalog.jsonb_typeof(p_document->'scopes') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_document->'scopes') = 0
    or pg_catalog.jsonb_array_length(p_document->'scopes') > 50
  then
    return false;
  end if;

  for v_scope in
    select value from pg_catalog.jsonb_array_elements(p_document->'scopes') scope(value)
  loop
    if pg_catalog.jsonb_typeof(v_scope) is distinct from 'object'
      or exists (
        select 1
        from pg_catalog.jsonb_object_keys(v_scope) key
        where key not in ('scopeKey', 'scope', 'systemId', 'systemLabel', 'blocks')
      )
    then
      return false;
    end if;

    v_scope_key := v_scope->>'scopeKey';
    v_scope_kind := v_scope->>'scope';
    v_system_id := v_scope->>'systemId';
    v_system_label := v_scope->>'systemLabel';

    if v_scope_kind not in ('default', 'system')
      or nullif(private.clair_soap_trim_boundary_whitespace(v_scope_key), '') is null
      or pg_catalog.char_length(v_scope_key) > 240
      or v_scope_key = any(v_scope_keys)
      or nullif(private.clair_soap_trim_boundary_whitespace(v_system_label), '') is null
      or pg_catalog.char_length(v_system_label) > 100
      or pg_catalog.jsonb_typeof(v_scope->'blocks') is distinct from 'array'
      or pg_catalog.jsonb_array_length(v_scope->'blocks') = 0
    then
      return false;
    end if;
    v_scope_keys := pg_catalog.array_append(v_scope_keys, v_scope_key);

    if v_scope_kind = 'default' then
      if v_scope_key <> 'default' or v_scope ? 'systemId' then
        return false;
      end if;
      v_default_scope_count := v_default_scope_count + 1;
    else
      if nullif(private.clair_soap_trim_boundary_whitespace(v_system_id), '') is null
        or pg_catalog.char_length(v_system_id) > 200
        or v_scope_key <> 'system:' || v_system_id
        or v_system_id = any(v_system_ids)
      then
        return false;
      end if;
      v_system_ids := pg_catalog.array_append(v_system_ids, v_system_id);
    end if;

    if not private.clair_soap_v1_document_is_valid(
      pg_catalog.jsonb_build_object(
        'schemaVersion', 1,
        'blocks', v_scope->'blocks'
      )
    ) then
      return false;
    end if;

    if exists (
      select 1
      from pg_catalog.jsonb_array_elements(v_scope->'blocks') block(value)
      where block.value->>'type' = 'soapSection'
        and (
          block.value->'props'->>'scope' <> v_scope_kind
          or (
            v_scope_kind = 'system'
            and block.value->'props'->>'systemLabel' <> v_system_label
          )
        )
    ) then
      return false;
    end if;

    if exists (
      select 1
      from pg_catalog.jsonb_array_elements(v_scope->'blocks') block(value)
      where block.value->>'type' = 'soapSection'
      group by block.value->'props'->>'kind'
      having pg_catalog.count(*) > 1
    ) then
      return false;
    end if;

    select pg_catalog.count(*)
      into v_scope_block_count
    from (
      with recursive block_tree(block, depth) as (
        select block.value, 0
        from pg_catalog.jsonb_array_elements(v_scope->'blocks') block(value)
        union all
        select child.value, tree.depth + 1
        from block_tree tree
        cross join lateral pg_catalog.jsonb_array_elements(
          case
            when pg_catalog.jsonb_typeof(tree.block->'children') = 'array'
              then tree.block->'children'
            else '[]'::jsonb
          end
        ) child(value)
      )
      select 1 from block_tree
    ) counted;
    v_total_block_count := v_total_block_count + v_scope_block_count;
    if v_total_block_count > 400 then
      return false;
    end if;
  end loop;

  return v_default_scope_count = 1;
end;
$$;

create or replace function private.clair_soap_document_field_v2(
  p_document jsonb,
  p_kind text
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_blocks jsonb;
  v_section jsonb;
  v_section_count integer;
begin
  if p_document->>'schemaVersion' = '1' then
    v_blocks := p_document->'blocks';
  else
    select scope.value->'blocks'
      into v_blocks
    from pg_catalog.jsonb_array_elements(p_document->'scopes') scope(value)
    where scope.value->>'scopeKey' = 'default'
      and scope.value->>'scope' = 'default'
    limit 1;
  end if;

  if pg_catalog.jsonb_typeof(v_blocks) is distinct from 'array' then
    raise exception 'invalid_soap_document';
  end if;

  select pg_catalog.count(*)
    into v_section_count
  from pg_catalog.jsonb_array_elements(v_blocks) section(value)
  where section.value->>'type' = 'soapSection'
    and section.value->'props'->>'scope' = 'default'
    and section.value->'props'->>'kind' = p_kind;

  if v_section_count > 1 then
    raise exception 'invalid_soap_document';
  end if;
  if v_section_count = 0 then
    return '';
  end if;

  select section.value
    into v_section
  from pg_catalog.jsonb_array_elements(v_blocks) section(value)
  where section.value->>'type' = 'soapSection'
    and section.value->'props'->>'scope' = 'default'
    and section.value->'props'->>'kind' = p_kind
  limit 1;

  return private.clair_soap_blocks_text(v_section->'children');
end;
$$;

create or replace function private.clair_guard_legacy_soap_projection_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.block_document_schema_version = 2
    and new.block_document_schema_version is distinct from 2
  then
    raise exception 'soap_client_upgrade_required';
  end if;

  if old.block_document is not null
    and new.block_document is not distinct from old.block_document
    and (
      new.subjective is distinct from old.subjective
      or new.objective is distinct from old.objective
      or new.assessment is distinct from old.assessment
      or new.plan is distinct from old.plan
    )
  then
    raise exception 'soap_client_upgrade_required';
  end if;

  return new;
end;
$$;

create or replace function public.clair_get_chart_soap_note(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note_row jsonb;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view') then
    raise exception 'permission_missing' using errcode = '42501';
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

  select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'id', s.id::text,
    'encounterId', s.encounter_id::text,
    'authorUserId', s.author_user_id::text,
    'subjective', s.subjective,
    'objective', s.objective,
    'assessment', s.assessment,
    'plan', s.plan,
    'blockDocument', case
      when s.block_document_schema_version = 2 then pg_catalog.jsonb_build_object(
        'schemaVersion', 2,
        'scopes', s.block_document
      )
      when s.block_document_schema_version = 1 then pg_catalog.jsonb_build_object(
        'schemaVersion', 1,
        'blocks', s.block_document
      )
      else null
    end,
    'status', s.status,
    'autosavedAt', s.autosaved_at,
    'signedAt', s.signed_at,
    'createdAt', s.created_at,
    'updatedAt', s.updated_at
  ))
    into v_note_row
  from public.soap_notes s
  where s.workspace_id = p_workspace_id
    and s.encounter_id = p_encounter_id
    and s.status <> 'voided'
  order by s.updated_at desc
  limit 1;

  return v_note_row;
end;
$$;

drop function if exists public.clair_save_chart_soap_note_v3(
  text, text, uuid, jsonb, timestamptz, text, text
);

create function public.clair_save_chart_soap_note_v3(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_note jsonb,
  p_expected_updated_at timestamptz default null,
  p_mode text default 'autosave',
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_actor_membership_id uuid;
  v_assessment text;
  v_audit_event jsonb;
  v_document jsonb := p_note->'blockDocument';
  v_encounter_status text;
  v_existing_id uuid;
  v_existing_schema_version smallint;
  v_existing_updated_at timestamptz;
  v_has_document boolean := p_note ? 'blockDocument';
  v_now timestamptz := pg_catalog.now();
  v_note_row jsonb;
  v_objective text;
  v_plan text;
  v_schema_version smallint;
  v_status text := case when p_mode = 'manual_save' then 'draft' else 'autosaved' end;
  v_storage_document jsonb;
  v_subjective text;
  v_top_level_block_count integer;
begin
  if p_mode is null or p_mode not in ('autosave', 'manual_save') then
    raise exception 'invalid_save_mode';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;
  if auth.uid() is null
    or v_actor_user_id is null
    or v_actor_user_id is distinct from auth.uid()
  then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing' using errcode = '42501';
  end if;

  select m.id
    into v_actor_membership_id
  from public.user_memberships m
  where m.workspace_id = p_workspace_id
    and m.user_id = v_actor_user_id
    and m.status = 'active'
  order by m.created_at
  limit 1;
  if v_actor_membership_id is null then
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;

  select e.status
    into v_encounter_status
  from public.encounters e
  where e.workspace_id = p_workspace_id
    and e.id = p_encounter_id
    and e.status <> 'cancelled';
  if v_encounter_status is null then
    raise exception 'encounter_unavailable';
  end if;
  if v_encounter_status not in ('in_consultation', 'ordered') then
    raise exception 'stale_status';
  end if;

  if not v_has_document then
    raise exception 'block_document_required';
  end if;
  if not private.clair_soap_document_is_valid(v_document) then
    raise exception 'invalid_soap_document';
  end if;

  v_schema_version := (v_document->>'schemaVersion')::smallint;
  v_storage_document := case
    when v_schema_version = 2 then v_document->'scopes'
    else v_document->'blocks'
  end;
  v_subjective := private.clair_soap_document_field_v2(v_document, 'subjective');
  v_objective := private.clair_soap_document_field_v2(v_document, 'objective');
  v_assessment := private.clair_soap_document_field_v2(v_document, 'assessment');
  v_plan := private.clair_soap_document_field_v2(v_document, 'plan');

  if pg_catalog.char_length(v_subjective) > 10000
    or pg_catalog.char_length(v_objective) > 10000
    or pg_catalog.char_length(v_assessment) > 10000
    or pg_catalog.char_length(v_plan) > 10000
  then
    raise exception 'invalid_soap_document';
  end if;
  if private.clair_soap_trim_boundary_whitespace(p_note->>'subjective') is distinct from v_subjective
    or private.clair_soap_trim_boundary_whitespace(p_note->>'objective') is distinct from v_objective
    or private.clair_soap_trim_boundary_whitespace(p_note->>'assessment') is distinct from v_assessment
    or private.clair_soap_trim_boundary_whitespace(p_note->>'plan') is distinct from v_plan
  then
    raise exception 'soap_document_projection_mismatch';
  end if;

  select s.id, s.updated_at, s.block_document_schema_version
    into v_existing_id, v_existing_updated_at, v_existing_schema_version
  from public.soap_notes s
  where s.workspace_id = p_workspace_id
    and s.encounter_id = p_encounter_id
    and s.status <> 'voided'
  order by s.updated_at desc
  limit 1
  for update;

  if v_existing_id is not null
    and p_expected_updated_at is not null
    and v_existing_updated_at is distinct from p_expected_updated_at
  then
    raise exception 'soap_note_conflict';
  end if;
  if v_existing_id is not null and p_expected_updated_at is null then
    raise exception 'soap_note_conflict';
  end if;
  if v_existing_id is null and p_expected_updated_at is not null then
    raise exception 'soap_note_conflict';
  end if;
  if v_existing_schema_version = 2 and v_schema_version <> 2 then
    raise exception 'soap_client_upgrade_required';
  end if;

  if v_existing_id is null then
    insert into public.soap_notes (
      workspace_id,
      encounter_id,
      author_user_id,
      subjective,
      objective,
      assessment,
      plan,
      block_document,
      block_document_schema_version,
      status,
      autosaved_at,
      created_at,
      updated_at
    ) values (
      p_workspace_id,
      p_encounter_id,
      v_actor_user_id,
      nullif(v_subjective, ''),
      nullif(v_objective, ''),
      nullif(v_assessment, ''),
      nullif(v_plan, ''),
      v_storage_document,
      v_schema_version,
      v_status,
      case when p_mode = 'autosave' then v_now else null end,
      v_now,
      v_now
    ) returning id into v_existing_id;
  else
    update public.soap_notes
    set
      author_user_id = coalesce(author_user_id, v_actor_user_id),
      subjective = nullif(v_subjective, ''),
      objective = nullif(v_objective, ''),
      assessment = nullif(v_assessment, ''),
      plan = nullif(v_plan, ''),
      block_document = v_storage_document,
      block_document_schema_version = v_schema_version,
      status = v_status,
      autosaved_at = case when p_mode = 'autosave' then v_now else autosaved_at end,
      updated_at = v_now
    where id = v_existing_id
      and workspace_id = p_workspace_id;
  end if;

  select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'id', s.id::text,
    'encounterId', s.encounter_id::text,
    'authorUserId', s.author_user_id::text,
    'subjective', s.subjective,
    'objective', s.objective,
    'assessment', s.assessment,
    'plan', s.plan,
    'blockDocument', case
      when s.block_document_schema_version = 2 then pg_catalog.jsonb_build_object(
        'schemaVersion', 2,
        'scopes', s.block_document
      )
      else pg_catalog.jsonb_build_object(
        'schemaVersion', 1,
        'blocks', s.block_document
      )
    end,
    'status', s.status,
    'autosavedAt', s.autosaved_at,
    'signedAt', s.signed_at,
    'createdAt', s.created_at,
    'updatedAt', s.updated_at
  ))
    into v_note_row
  from public.soap_notes s
  where s.workspace_id = p_workspace_id
    and s.id = v_existing_id;

  if v_schema_version = 2 then
    select coalesce(pg_catalog.sum(pg_catalog.jsonb_array_length(scope.value->'blocks')), 0)::integer
      into v_top_level_block_count
    from pg_catalog.jsonb_array_elements(v_document->'scopes') scope(value);
  else
    v_top_level_block_count := pg_catalog.jsonb_array_length(v_document->'blocks');
  end if;

  v_audit_event := public.clair_append_audit_event(
    p_id => 'chart-soap-save-' || extensions.gen_random_uuid()::text,
    p_workspace_id => p_workspace_id,
    p_actor_user_id => v_actor_user_id,
    p_actor_membership_id => v_actor_membership_id,
    p_event_type => 'chart.soap_saved',
    p_target_type => 'soap_note',
    p_target_id => v_existing_id::text,
    p_encounter_id => p_encounter_id,
    p_request_id => nullif(pg_catalog.btrim(coalesce(p_request_id, '')), ''),
    p_after_snapshot => pg_catalog.jsonb_build_object(
      'mode', p_mode,
      'noteStatus', v_status,
      'updatedAt', v_now,
      'documentSchemaVersion', v_schema_version,
      'scopeCount', case
        when v_schema_version = 2 then pg_catalog.jsonb_array_length(v_document->'scopes')
        else 1
      end,
      'topLevelBlockCount', v_top_level_block_count
    ),
    p_metadata => pg_catalog.jsonb_build_object(
      'source', 'chart-soap-note-database-transaction'
    ),
    p_occurred_at => v_now
  );

  return v_note_row || pg_catalog.jsonb_build_object(
    'auditHandledBy', 'database_transaction',
    'auditRecorded', true,
    'auditEventId', v_audit_event->>'id'
  );
end;
$$;

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
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view') then
    raise exception 'permission_missing' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.encounters
    where workspace_id = p_workspace_id
      and id = p_encounter_id
      and status <> 'cancelled'
  ) then
    raise exception 'encounter_unavailable';
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', diagnosis.id,
    'encounterId', diagnosis.encounter_id,
    'diagnosisCatalogId', diagnosis.diagnosis_catalog_id,
    'diagnosisCatalogRevision', diagnosis.diagnosis_catalog_revision,
    'diagnosisText', diagnosis.diagnosis_text,
    'diagnosisType', diagnosis.diagnosis_type,
    'systemId', diagnosis.diagnosis_snapshot->>'systemId',
    'systemLabel', diagnosis.diagnosis_snapshot->>'systemLabel',
    'diseaseGroupLabel', diagnosis.diagnosis_snapshot->>'diseaseGroupLabel',
    'isClosed', diagnosis.closed_at is not null,
    'closedAt', diagnosis.closed_at,
    'closedByUserId', diagnosis.closed_by_user_id,
    'isPrimary', diagnosis.is_primary,
    'sortOrder', diagnosis.sort_order,
    'createdByUserId', diagnosis.created_by_user_id,
    'updatedByUserId', diagnosis.updated_by_user_id,
    'createdAt', diagnosis.created_at,
    'updatedAt', diagnosis.updated_at
  ) order by diagnosis.sort_order, diagnosis.created_at, diagnosis.id), '[]'::jsonb)
    into v_diagnosis_rows
  from public.diagnoses diagnosis
  where diagnosis.workspace_id = p_workspace_id
    and diagnosis.encounter_id = p_encounter_id;

  return v_diagnosis_rows;
end;
$$;

revoke all on function private.clair_soap_v1_document_is_valid(jsonb)
  from public, anon, authenticated;
revoke all on function private.clair_soap_document_is_valid(jsonb)
  from public, anon, authenticated;
revoke all on function private.clair_soap_document_field_v2(jsonb, text)
  from public, anon, authenticated;
revoke all on function private.clair_guard_legacy_soap_projection_update()
  from public, anon, authenticated;

revoke all on function public.clair_get_chart_soap_note(text, uuid)
  from public, anon;
grant execute on function public.clair_get_chart_soap_note(text, uuid)
  to authenticated;
revoke all on function public.clair_save_chart_soap_note_v3(
  text, text, uuid, jsonb, timestamptz, text, text
) from public, anon;
grant execute on function public.clair_save_chart_soap_note_v3(
  text, text, uuid, jsonb, timestamptz, text, text
) to authenticated;
revoke all on function public.clair_get_chart_diagnoses(text, uuid)
  from public, anon;
grant execute on function public.clair_get_chart_diagnoses(text, uuid)
  to authenticated;

comment on column public.soap_notes.block_document is
  'CHART-PR-033 canonical SOAP payload: V1 BlockNote blocks or V2 scope envelopes.';
comment on column public.soap_notes.block_document_schema_version is
  'CHART-PR-033 canonical SOAP schema version. V1 and diagnosis-system-scoped V2 are accepted.';
comment on function public.clair_get_chart_soap_note(text, uuid) is
  'CHART-PR-033 SOAP reader with V1 blocks or V2 diagnosis-system scopes and unchanged chart:view authorization.';
comment on function public.clair_save_chart_soap_note_v3(
  text, text, uuid, jsonb, timestamptz, text, text
) is
  'CHART-PR-033 dual-version SOAP writer with default-only legacy projections, chart:update authorization, optimistic concurrency, downgrade protection, and transactional audit.';
comment on function public.clair_get_chart_diagnoses(text, uuid) is
  'CHART-PR-033 diagnosis reader including stable systemId from the persisted catalog snapshot.';
