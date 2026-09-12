-- Explicit RPC-only boundary also converges older local ACL snapshots.
revoke select,insert,update,delete on public.soap_notes,public.soap_note_revisions
  from public,anon,authenticated,service_role;

-- CHART-PR-037: chart identity reuses soap_notes.id. No clinical rows are fabricated.
-- Roll forward or disable creation after adoption; never restore the encounter unique index.
alter table public.soap_notes
  add column clinical_at timestamptz,
  add column creation_request_id uuid;
-- The backfill is metadata only; preserve the historical updated_at timestamp.
drop trigger set_soap_notes_updated_at on public.soap_notes;
update public.soap_notes set clinical_at = created_at where clinical_at is null;
alter table public.soap_notes alter column clinical_at set default now();
alter table public.soap_notes alter column clinical_at set not null;
drop index public.soap_notes_workspace_encounter_active_key;
create unique index soap_notes_workspace_encounter_id_key
  on public.soap_notes(workspace_id, encounter_id, id);
create unique index soap_notes_creation_request_key
  on public.soap_notes(workspace_id, encounter_id, creation_request_id)
  where creation_request_id is not null;
create index soap_notes_encounter_clinical_at_idx
  on public.soap_notes(workspace_id, encounter_id, clinical_at desc, id)
  where status <> 'voided';

-- Transaction timestamps can repeat across consecutive saves. Use a strictly increasing note revision time.
create function private.clair_set_chart_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.workspace_id is distinct from old.workspace_id
    or new.encounter_id is distinct from old.encounter_id or new.created_at is distinct from old.created_at
    or new.creation_request_id is distinct from old.creation_request_id then
    raise exception 'chart_identity_immutable';
  end if;
  new.updated_at := greatest(pg_catalog.clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
create trigger set_soap_notes_updated_at before update on public.soap_notes
  for each row execute function private.clair_set_chart_updated_at();
revoke all on function private.clair_set_chart_updated_at() from public, anon, authenticated, service_role;

-- All mutators take the encounter lock before the note lock, serializing creation/finalization.
create function private.clair_require_chart_encounter(
  p_workspace_id text, p_encounter_id uuid, p_actor_user_id text,
  p_mutating boolean default true
) returns void language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  if auth.uid() is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  if p_mutating and p_actor_user_id is distinct from auth.uid()::text then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id,
    case when p_mutating then 'chart:update' else 'chart:view' end) then
    raise exception 'permission_missing' using errcode = '42501';
  end if;
  if p_mutating then
    select status into v_status from public.encounters
    where workspace_id = p_workspace_id and id = p_encounter_id for update;
  else
    select status into v_status from public.encounters
    where workspace_id = p_workspace_id and id = p_encounter_id;
  end if;
  if v_status is null or v_status = 'cancelled' then raise exception 'encounter_unavailable'; end if;
  if p_mutating and v_status not in ('in_consultation', 'ordered') then raise exception 'stale_status'; end if;
end;
$$;

create function private.clair_chart_note_json(p_note public.soap_notes)
returns jsonb language sql stable set search_path = '' as $$
  select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'id', p_note.id, 'encounterId', p_note.encounter_id, 'authorUserId', p_note.author_user_id,
    'authorDisplayName', (select display_name from public.users where id = p_note.author_user_id),
    'subjective', p_note.subjective, 'objective', p_note.objective,
    'assessment', p_note.assessment, 'plan', p_note.plan,
    'blockDocument', case when p_note.block_document_schema_version = 2 then
      pg_catalog.jsonb_build_object('schemaVersion', 2, 'scopes', p_note.block_document)
      when p_note.block_document_schema_version = 1 then
      pg_catalog.jsonb_build_object('schemaVersion', 1, 'blocks', p_note.block_document) else null end,
    'status', p_note.status, 'autosavedAt', p_note.autosaved_at, 'signedAt', p_note.signed_at,
    'clinicalAt', p_note.clinical_at, 'createdAt', p_note.created_at, 'updatedAt', p_note.updated_at
  ));
$$;

create function private.clair_record_chart_audit(
  p_workspace_id text, p_encounter_id uuid, p_chart_id uuid,
  p_mode text, p_request_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_membership_id uuid; v_event jsonb;
begin
  select id into v_membership_id from public.user_memberships
    where workspace_id = p_workspace_id and user_id = auth.uid() and status = 'active'
    order by created_at limit 1;
  if v_membership_id is null then raise exception 'workspace_membership_missing'; end if;
  v_event := public.clair_append_audit_event(
    p_id => 'chart-note-' || extensions.gen_random_uuid()::text,
    p_workspace_id => p_workspace_id, p_actor_user_id => auth.uid(),
    p_actor_membership_id => v_membership_id, p_event_type => 'chart.soap_saved',
    p_target_type => 'soap_note', p_target_id => p_chart_id::text,
    p_encounter_id => p_encounter_id, p_request_id => p_request_id,
    p_after_snapshot => pg_catalog.jsonb_build_object('mode', p_mode, 'chartId', p_chart_id),
    p_metadata => pg_catalog.jsonb_build_object('source', 'encounter-multi-chart-database-transaction'),
    p_occurred_at => pg_catalog.clock_timestamp()
  );
  return pg_catalog.jsonb_build_object('auditHandledBy', 'database_transaction',
    'auditRecorded', true, 'auditEventId', v_event->>'id');
end;
$$;

create function public.clair_list_encounter_charts(p_workspace_id text, p_encounter_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform private.clair_require_chart_encounter(p_workspace_id, p_encounter_id, null, false);
  select coalesce(pg_catalog.jsonb_agg(private.clair_chart_note_json(s)
    order by s.clinical_at desc, s.created_at desc, s.id), '[]'::jsonb)
    into v_result from public.soap_notes s
    where s.workspace_id = p_workspace_id and s.encounter_id = p_encounter_id and s.status <> 'voided';
  return v_result;
end;
$$;

create function public.clair_get_chart_soap_note_by_id(
  p_workspace_id text, p_encounter_id uuid, p_chart_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform private.clair_require_chart_encounter(p_workspace_id, p_encounter_id, null, false);
  select private.clair_chart_note_json(s) into v_result from public.soap_notes s
    where s.workspace_id = p_workspace_id and s.encounter_id = p_encounter_id
      and s.id = p_chart_id and s.status <> 'voided';
  if v_result is null then raise exception 'chart_unavailable'; end if;
  return v_result;
end;
$$;

create function public.clair_create_encounter_chart(
  p_workspace_id text, p_actor_user_id text, p_encounter_id uuid,
  p_creation_request_id uuid, p_clinical_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_note public.soap_notes; v_audit jsonb;
begin
  perform private.clair_require_chart_encounter(p_workspace_id, p_encounter_id, p_actor_user_id);
  if p_creation_request_id is null or (p_clinical_at is not null and not pg_catalog.isfinite(p_clinical_at)) then
    raise exception 'invalid_chart_input';
  end if;
  select * into v_note from public.soap_notes where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id and creation_request_id = p_creation_request_id;
  if found then
    if v_note.author_user_id is distinct from auth.uid() then raise exception 'actor_mismatch'; end if;
    return private.clair_chart_note_json(v_note) || pg_catalog.jsonb_build_object('idempotentReplay',true);
  end if;
  insert into public.soap_notes(workspace_id, encounter_id, author_user_id, clinical_at, creation_request_id)
    values(p_workspace_id, p_encounter_id, auth.uid(), coalesce(p_clinical_at, pg_catalog.clock_timestamp()), p_creation_request_id)
    returning * into v_note;
  v_audit := private.clair_record_chart_audit(p_workspace_id, p_encounter_id, v_note.id, 'created', p_creation_request_id::text);
  return private.clair_chart_note_json(v_note) || v_audit;
end;
$$;

create function public.clair_save_chart_soap_note_v4(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_chart_id uuid,
  p_note jsonb,
  p_expected_updated_at timestamptz default null,
  p_mode text default 'autosave',
  p_request_id text default null,
  p_amendment_reason text default null
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
  v_existing_status text;
  v_prior public.soap_notes;
  v_existing_schema_version smallint;
  v_existing_updated_at timestamptz;
  v_has_document boolean := p_note ? 'blockDocument';
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_note_row jsonb;
  v_objective text;
  v_plan text;
  v_schema_version smallint;
  v_status text := case when p_mode = 'manual_save' then 'draft' else 'autosaved' end;
  v_storage_document jsonb;
  v_subjective text;
  v_top_level_block_count integer;
begin
  perform private.clair_require_chart_encounter(p_workspace_id, p_encounter_id, p_actor_user_id);
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

  select s.id, s.updated_at, s.block_document_schema_version, s.status
    into v_existing_id, v_existing_updated_at, v_existing_schema_version, v_existing_status
  from public.soap_notes s
  where s.workspace_id = p_workspace_id
    and s.encounter_id = p_encounter_id
    and s.status <> 'voided'
    and s.id = p_chart_id
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

  if v_existing_id is null then raise exception 'chart_unavailable'; end if;
  if v_existing_status in ('signed', 'amended') then
    if p_mode <> 'manual_save' or nullif(pg_catalog.btrim(p_amendment_reason), '') is null
      or pg_catalog.char_length(p_amendment_reason) > 2000 then
      raise exception 'amendment_reason_required';
    end if;
    select * into v_prior from public.soap_notes where id = v_existing_id;
    insert into public.soap_note_revisions(workspace_id, soap_note_id, revision_no,
      changed_by_user_id, change_reason, snapshot)
    select p_workspace_id, v_existing_id, coalesce(max(revision_no), 0) + 1,
      v_actor_user_id, pg_catalog.btrim(p_amendment_reason), pg_catalog.to_jsonb(v_prior)
    from public.soap_note_revisions where workspace_id = p_workspace_id and soap_note_id = v_existing_id;
    v_status := 'amended';
  end if;
    update public.soap_notes
    set
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

  select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'id', s.id::text,
    'encounterId', s.encounter_id::text,
    'authorUserId', s.author_user_id::text,
    'authorDisplayName', (select display_name from public.users where id = s.author_user_id),
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
    'clinicalAt', s.clinical_at,
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


create function public.clair_sign_encounter_chart(
  p_workspace_id text, p_actor_user_id text, p_encounter_id uuid,
  p_chart_id uuid, p_expected_updated_at timestamptz, p_request_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_note public.soap_notes; v_audit jsonb;
begin
  perform private.clair_require_chart_encounter(p_workspace_id, p_encounter_id, p_actor_user_id);
  select * into v_note from public.soap_notes where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id and id = p_chart_id and status <> 'voided' for update;
  if not found then raise exception 'chart_unavailable'; end if;
  if v_note.status in ('signed', 'amended') then return private.clair_chart_note_json(v_note) || pg_catalog.jsonb_build_object('idempotentReplay',true); end if;
  if p_expected_updated_at is null or v_note.updated_at is distinct from p_expected_updated_at then
    raise exception 'soap_note_conflict';
  end if;
  update public.soap_notes set status = 'signed', signed_at = pg_catalog.clock_timestamp(),
    updated_at = pg_catalog.clock_timestamp()
    where workspace_id = p_workspace_id and id = p_chart_id returning * into v_note;
  v_audit := private.clair_record_chart_audit(p_workspace_id, p_encounter_id, p_chart_id, 'signed', p_request_id);
  return private.clair_chart_note_json(v_note) || v_audit;
end;
$$;

-- Compatibility access can select only an unambiguous note. A latest-row fallback is forbidden.
create or replace function public.clair_get_chart_soap_note(p_workspace_id text, p_encounter_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_notes jsonb;
begin
  v_notes := public.clair_list_encounter_charts(p_workspace_id, p_encounter_id);
  if pg_catalog.jsonb_array_length(v_notes) > 1 then raise exception 'chart_id_required'; end if;
  return v_notes->0;
end;
$$;

create function private.clair_require_legacy_single_chart(
  p_workspace_id text, p_actor_user_id text, p_encounter_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.clair_require_chart_encounter(p_workspace_id, p_encounter_id, p_actor_user_id);
  if (select count(*) from public.soap_notes where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id and status <> 'voided') > 1 then raise exception 'chart_id_required'; end if;
  if exists(select 1 from public.soap_notes where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id and status in ('signed', 'amended')) then
    raise exception 'amendment_reason_required';
  end if;
end;
$$;

alter function public.clair_save_chart_soap_note(text, text, uuid, jsonb, timestamptz, text) rename to clair_save_chart_soap_note_single_chart_base;
revoke all on function public.clair_save_chart_soap_note_single_chart_base(text, text, uuid, jsonb, timestamptz, text) from public, anon, authenticated, service_role;
create function public.clair_save_chart_soap_note(
  p_workspace_id text, p_actor_user_id text, p_encounter_id uuid, p_note jsonb,
  p_expected_updated_at timestamptz default null, p_mode text default 'autosave'
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.clair_require_legacy_single_chart(p_workspace_id, p_actor_user_id, p_encounter_id);
  return public.clair_save_chart_soap_note_single_chart_base(p_workspace_id, p_actor_user_id, p_encounter_id,
    p_note, p_expected_updated_at, p_mode);
end;
$$;

alter function public.clair_save_chart_soap_note_v2(text, text, uuid, jsonb, timestamptz, text, text) rename to clair_save_chart_soap_note_v2_single_chart_base;
revoke all on function public.clair_save_chart_soap_note_v2_single_chart_base(text, text, uuid, jsonb, timestamptz, text, text) from public, anon, authenticated, service_role;
create function public.clair_save_chart_soap_note_v2(
  p_workspace_id text, p_actor_user_id text, p_encounter_id uuid, p_note jsonb,
  p_expected_updated_at timestamptz default null, p_mode text default 'autosave', p_request_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.clair_require_legacy_single_chart(p_workspace_id, p_actor_user_id, p_encounter_id);
  return public.clair_save_chart_soap_note_v2_single_chart_base(p_workspace_id, p_actor_user_id, p_encounter_id,
    p_note, p_expected_updated_at, p_mode, p_request_id);
end;
$$;

alter function public.clair_save_chart_soap_note_v3(text, text, uuid, jsonb, timestamptz, text, text) rename to clair_save_chart_soap_note_v3_single_chart_base;
revoke all on function public.clair_save_chart_soap_note_v3_single_chart_base(text, text, uuid, jsonb, timestamptz, text, text) from public, anon, authenticated, service_role;
create function public.clair_save_chart_soap_note_v3(
  p_workspace_id text, p_actor_user_id text, p_encounter_id uuid, p_note jsonb,
  p_expected_updated_at timestamptz default null, p_mode text default 'autosave', p_request_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.clair_require_legacy_single_chart(p_workspace_id, p_actor_user_id, p_encounter_id);
  return public.clair_save_chart_soap_note_v3_single_chart_base(p_workspace_id, p_actor_user_id, p_encounter_id,
    p_note, p_expected_updated_at, p_mode, p_request_id);
end;
$$;

alter function public.clair_complete_chart(text, text, uuid) rename to clair_complete_chart_encounter_base;
revoke all on function public.clair_complete_chart_encounter_base(text, text, uuid) from public, anon, authenticated, service_role;
create function public.clair_complete_chart(p_workspace_id text, p_actor_user_id text, p_encounter_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_membership_id uuid; v_event jsonb; v_status text;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid()::text then
    raise exception 'actor_mismatch' using errcode = '42501'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing' using errcode = '42501'; end if;
  select status into v_status from public.encounters where workspace_id = p_workspace_id
    and id = p_encounter_id for update;
  if v_status in ('ready_for_billing', 'completed') then
    return public.clair_get_chart_completion(p_workspace_id, p_encounter_id);
  end if;
  perform private.clair_require_chart_encounter(p_workspace_id, p_encounter_id, p_actor_user_id);
  if exists(select 1 from public.soap_notes where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id and status in ('draft', 'autosaved')) then
    raise exception 'unfinished_charts';
  end if;
  v_result := public.clair_complete_chart_encounter_base(p_workspace_id, p_actor_user_id, p_encounter_id);
  select id into v_membership_id from public.user_memberships where workspace_id = p_workspace_id
    and user_id = auth.uid() and status = 'active' order by created_at limit 1;
  v_event := public.clair_append_audit_event(
    p_id => 'encounter-complete-' || extensions.gen_random_uuid()::text,
    p_workspace_id => p_workspace_id, p_actor_user_id => auth.uid(),
    p_actor_membership_id => v_membership_id, p_event_type => 'chart.completed',
    p_target_type => 'encounter', p_target_id => p_encounter_id::text, p_encounter_id => p_encounter_id,
    p_after_snapshot => v_result,
    p_metadata => pg_catalog.jsonb_build_object('source', 'encounter-multi-chart-database-transaction'),
    p_occurred_at => pg_catalog.clock_timestamp()
  );
  return v_result || pg_catalog.jsonb_build_object('auditHandledBy', 'database_transaction',
    'auditRecorded', true, 'auditEventId', v_event->>'id');
end;
$$;

revoke all on function private.clair_require_chart_encounter(text, uuid, text, boolean) from public, anon, authenticated, service_role;

revoke all on function private.clair_chart_note_json(public.soap_notes) from public, anon, authenticated, service_role;

revoke all on function private.clair_record_chart_audit(text, uuid, uuid, text, text) from public, anon, authenticated, service_role;

revoke all on function private.clair_require_legacy_single_chart(text, text, uuid) from public, anon, authenticated, service_role;

revoke all on function public.clair_list_encounter_charts(text, uuid) from public, anon;
grant execute on function public.clair_list_encounter_charts(text, uuid) to authenticated;

revoke all on function public.clair_get_chart_soap_note_by_id(text, uuid, uuid) from public, anon;
grant execute on function public.clair_get_chart_soap_note_by_id(text, uuid, uuid) to authenticated;

revoke all on function public.clair_create_encounter_chart(text, text, uuid, uuid, timestamptz) from public, anon;
grant execute on function public.clair_create_encounter_chart(text, text, uuid, uuid, timestamptz) to authenticated;

revoke all on function public.clair_save_chart_soap_note_v4(text, text, uuid, uuid, jsonb, timestamptz, text, text, text) from public, anon;
grant execute on function public.clair_save_chart_soap_note_v4(text, text, uuid, uuid, jsonb, timestamptz, text, text, text) to authenticated;

revoke all on function public.clair_sign_encounter_chart(text, text, uuid, uuid, timestamptz, text) from public, anon;
grant execute on function public.clair_sign_encounter_chart(text, text, uuid, uuid, timestamptz, text) to authenticated;

revoke all on function public.clair_get_chart_soap_note(text, uuid) from public, anon;
grant execute on function public.clair_get_chart_soap_note(text, uuid) to authenticated;

revoke all on function public.clair_save_chart_soap_note(text, text, uuid, jsonb, timestamptz, text) from public, anon;
grant execute on function public.clair_save_chart_soap_note(text, text, uuid, jsonb, timestamptz, text) to authenticated;

revoke all on function public.clair_save_chart_soap_note_v2(text, text, uuid, jsonb, timestamptz, text, text) from public, anon;
grant execute on function public.clair_save_chart_soap_note_v2(text, text, uuid, jsonb, timestamptz, text, text) to authenticated;

revoke all on function public.clair_save_chart_soap_note_v3(text, text, uuid, jsonb, timestamptz, text, text) from public, anon;
grant execute on function public.clair_save_chart_soap_note_v3(text, text, uuid, jsonb, timestamptz, text, text) to authenticated;

revoke all on function public.clair_complete_chart(text, text, uuid) from public, anon;
grant execute on function public.clair_complete_chart(text, text, uuid) to authenticated;

-- Stable encounter diagnoses; retired rows retain references from historical chart assessments.
alter table public.diagnoses add column retired_at timestamptz;
create unique index diagnoses_workspace_encounter_id_key on public.diagnoses(workspace_id, encounter_id, id);
create table public.chart_diagnosis_assessments (
  workspace_id text not null,
  encounter_id uuid not null,
  chart_id uuid not null,
  diagnosis_id uuid not null,
  assessment_snapshot jsonb not null check (pg_catalog.jsonb_typeof(assessment_snapshot) = 'object'),
  assessed_by_user_id uuid not null references public.users(id),
  assessed_at timestamptz not null default now(),
  primary key(workspace_id, chart_id, diagnosis_id),
  foreign key(workspace_id, encounter_id, chart_id) references public.soap_notes(workspace_id, encounter_id, id),
  foreign key(workspace_id, encounter_id, diagnosis_id) references public.diagnoses(workspace_id, encounter_id, id)
);
alter table public.chart_diagnosis_assessments enable row level security;
revoke all on public.chart_diagnosis_assessments from public, anon, authenticated;
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
    and diagnosis.encounter_id = p_encounter_id
    and diagnosis.retired_at is null;

  return v_diagnosis_rows;
end;
$$;

create function private.clair_save_encounter_diagnoses_stable(
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
  v_now timestamptz := pg_catalog.clock_timestamp();
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

  select coalesce(pg_catalog.jsonb_agg(case
    when nullif(input.value->>'id','') is null and existing.id is not null
      then input.value || pg_catalog.jsonb_build_object('id', existing.id)
    else input.value end order by input.ordinality), '[]'::jsonb) into p_diagnoses
  from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) with ordinality input(value, ordinality)
  left join public.diagnoses existing on existing.workspace_id = p_workspace_id
    and existing.encounter_id = p_encounter_id
    and existing.diagnosis_catalog_id = nullif(input.value->>'diagnosisCatalogId','')::uuid;

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
      'retiredAt', retired_at,
      'isPrimary', is_primary,
      'sortOrder', sort_order
    ) order by sort_order, id), '[]'::jsonb)
  ) into v_before_audit
  from public.diagnoses where workspace_id = p_workspace_id and encounter_id = p_encounter_id;

  update public.diagnoses set retired_at = v_now, updated_by_user_id = v_actor_user_id
  where workspace_id = p_workspace_id and encounter_id = p_encounter_id and retired_at is null
    and id not in (select nullif(value->>'id','')::uuid
      from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) rows(value)
      where nullif(value->>'id','') is not null);

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
  where public.diagnoses.workspace_id = p_workspace_id and public.diagnoses.encounter_id = p_encounter_id
  ;
  if exists(select 1 from pg_catalog.jsonb_array_elements(p_diagnoses) input(value)
    where nullif(input.value->>'id','') is not null and not exists(select 1 from public.diagnoses d
      where d.workspace_id = p_workspace_id and d.encounter_id = p_encounter_id
        and d.id = (input.value->>'id')::uuid and d.retired_at is null)) then
    raise exception 'diagnosis_id_outside_target_encounter' using errcode = '42501';
  end if;

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
      'retiredAt', retired_at,
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


revoke all on function private.clair_save_encounter_diagnoses_stable(text, text, uuid, jsonb)
  from public, anon, authenticated, service_role;
create or replace function public.clair_save_chart_diagnoses(
  p_workspace_id text, p_actor_user_id text, p_encounter_id uuid, p_diagnoses jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.clair_require_legacy_single_chart(p_workspace_id, p_actor_user_id, p_encounter_id);
  return private.clair_save_encounter_diagnoses_stable(p_workspace_id, p_actor_user_id, p_encounter_id, p_diagnoses);
end;
$$;

create function private.clair_encounter_diagnoses_version(p_workspace_id text, p_encounter_id uuid)
returns text language sql stable set search_path = '' as $$
  select pg_catalog.encode(extensions.digest(coalesce(pg_catalog.jsonb_agg(
    pg_catalog.to_jsonb(d) order by d.id)::text, '[]'), 'sha256'), 'hex')
  from public.diagnoses d where d.workspace_id = p_workspace_id and d.encounter_id = p_encounter_id;
$$;
revoke all on function private.clair_encounter_diagnoses_version(text, uuid) from public, anon, authenticated, service_role;

create function public.clair_get_chart_diagnosis_assessments(p_workspace_id text, p_encounter_id uuid, p_chart_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_assessments jsonb;
begin
  perform public.clair_get_chart_soap_note_by_id(p_workspace_id, p_encounter_id, p_chart_id);
  select coalesce(pg_catalog.jsonb_agg(a.assessment_snapshot order by a.assessed_at, a.diagnosis_id), '[]'::jsonb)
    into v_assessments from public.chart_diagnosis_assessments a
    where a.workspace_id = p_workspace_id and a.encounter_id = p_encounter_id and a.chart_id = p_chart_id;
  return pg_catalog.jsonb_build_object('diagnoses', public.clair_get_chart_diagnoses(p_workspace_id, p_encounter_id),
    'assessments', v_assessments, 'version', private.clair_encounter_diagnoses_version(p_workspace_id, p_encounter_id));
end;
$$;

create function public.clair_save_chart_diagnoses_v2(
  p_workspace_id text, p_actor_user_id text, p_encounter_id uuid, p_chart_id uuid,
  p_diagnoses jsonb, p_expected_version text, p_assessed_diagnosis_ids uuid[] default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_status text; v_rows jsonb; v_result jsonb; v_before jsonb; v_note public.soap_notes; v_member uuid;
begin
  perform private.clair_require_chart_encounter(p_workspace_id, p_encounter_id, p_actor_user_id);
  select status into v_status from public.soap_notes where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id and id = p_chart_id and status <> 'voided' for update;
  if v_status is null then raise exception 'chart_unavailable'; end if;
  if v_status not in ('draft', 'autosaved') then raise exception 'signed_chart_read_only'; end if;
  if p_expected_version is distinct from private.clair_encounter_diagnoses_version(p_workspace_id, p_encounter_id) then
    raise exception 'diagnoses_conflict'; end if;
  v_rows := private.clair_save_encounter_diagnoses_stable(p_workspace_id, p_actor_user_id, p_encounter_id, p_diagnoses);
  if p_assessed_diagnosis_ids is not null and exists (
    select 1 from pg_catalog.unnest(p_assessed_diagnosis_ids) selected(id)
    where not exists(select 1 from public.diagnoses d where d.workspace_id = p_workspace_id
      and d.encounter_id = p_encounter_id and d.id = selected.id and d.retired_at is null)
  ) then raise exception 'diagnosis_id_outside_target_encounter'; end if;
  select coalesce(pg_catalog.jsonb_agg(a.assessment_snapshot order by a.diagnosis_id), '[]'::jsonb)
    into v_before from public.chart_diagnosis_assessments a where a.workspace_id = p_workspace_id
      and a.encounter_id = p_encounter_id and a.chart_id = p_chart_id;
  delete from public.chart_diagnosis_assessments where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id and chart_id = p_chart_id;
  insert into public.chart_diagnosis_assessments(workspace_id, encounter_id, chart_id, diagnosis_id,
    assessment_snapshot, assessed_by_user_id)
  select p_workspace_id, p_encounter_id, p_chart_id, (row.value->>'id')::uuid, row.value, auth.uid()
  from pg_catalog.jsonb_array_elements(v_rows) row(value)
  where p_assessed_diagnosis_ids is null or (row.value->>'id')::uuid = any(p_assessed_diagnosis_ids);
  -- Assessment edits participate in the chart completion conflict token.
  update public.soap_notes set updated_at = pg_catalog.clock_timestamp()
    where workspace_id = p_workspace_id and id = p_chart_id returning * into v_note;
  -- Preserve the existing diagnosis writer's chart:view + chart:update permission contract.
  select pg_catalog.jsonb_build_object('diagnoses', v_rows,
    'assessments', coalesce(pg_catalog.jsonb_agg(a.assessment_snapshot order by a.assessed_at, a.diagnosis_id), '[]'::jsonb),
    'chart', private.clair_chart_note_json(v_note),
    'version', private.clair_encounter_diagnoses_version(p_workspace_id, p_encounter_id)) into v_result
  from public.chart_diagnosis_assessments a where a.workspace_id = p_workspace_id
    and a.encounter_id = p_encounter_id and a.chart_id = p_chart_id;
  select id into v_member from public.user_memberships where workspace_id = p_workspace_id
    and user_id = auth.uid() and status = 'active' order by created_at limit 1;
  perform public.clair_append_audit_event(
    p_id => 'chart-assessment-' || extensions.gen_random_uuid()::text,
    p_workspace_id => p_workspace_id, p_actor_user_id => auth.uid(), p_actor_membership_id => v_member,
    p_event_type => 'diagnosis.changed', p_target_type => 'soap_note', p_target_id => p_chart_id::text,
    p_encounter_id => p_encounter_id,
    p_before_snapshot => pg_catalog.jsonb_build_object('chartId',p_chart_id,'assessments',v_before),
    p_after_snapshot => pg_catalog.jsonb_build_object('chartId',p_chart_id,'assessments',v_result->'assessments'),
    p_metadata => pg_catalog.jsonb_build_object('source','chart-diagnosis-assessment'),
    p_occurred_at => pg_catalog.clock_timestamp()
  );
  return v_result;
end;
$$;
revoke all on function public.clair_get_chart_diagnosis_assessments(text, uuid, uuid) from public, anon;
grant execute on function public.clair_get_chart_diagnosis_assessments(text, uuid, uuid) to authenticated;
revoke all on function public.clair_save_chart_diagnoses_v2(text, text, uuid, uuid, jsonb, text, uuid[]) from public, anon;
grant execute on function public.clair_save_chart_diagnoses_v2(text, text, uuid, uuid, jsonb, text, uuid[]) to authenticated;

-- Legacy orders remain NULL: timestamps are not proof of authorship.
alter table public.orders add column origin_chart_id uuid;
alter table public.orders add constraint orders_origin_chart_scope_fk
  foreign key(workspace_id, encounter_id, origin_chart_id)
  references public.soap_notes(workspace_id, encounter_id, id);
create index orders_origin_chart_idx on public.orders(workspace_id, encounter_id, origin_chart_id);

create function private.clair_guard_order_chart_origin()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_context uuid := nullif(pg_catalog.current_setting('clair.order_origin_chart_id', true), '')::uuid;
  v_parent public.orders; v_chart_status text;
begin
  if tg_op = 'UPDATE' then
    if new.origin_chart_id is distinct from old.origin_chart_id
      or new.workspace_id is distinct from old.workspace_id
      or new.encounter_id is distinct from old.encounter_id
      or new.parent_chart_order_line_id is distinct from old.parent_chart_order_line_id then
      raise exception 'order_chart_origin_immutable';
    end if;
    return new;
  end if;
  if new.parent_chart_order_line_id is not null then
    select * into v_parent from public.orders where workspace_id = new.workspace_id
      and encounter_id = new.encounter_id and id = new.parent_chart_order_line_id;
    if not found then raise exception 'order_parent_unavailable'; end if;
    if v_context is not null and v_parent.origin_chart_id is distinct from v_context then
      raise exception 'order_chart_mismatch'; end if;
    new.origin_chart_id := v_parent.origin_chart_id;
  else
    -- The context carries identity only. Authorization and scope are checked below for every insertion.
    new.origin_chart_id := coalesce(v_context, new.origin_chart_id);
  end if;
  if new.origin_chart_id is not null then
    perform private.clair_require_chart_encounter(new.workspace_id, new.encounter_id, auth.uid()::text);
    select status into v_chart_status from public.soap_notes where workspace_id = new.workspace_id
      and encounter_id = new.encounter_id and id = new.origin_chart_id;
    if v_chart_status is null or v_chart_status not in ('draft', 'autosaved') then
      raise exception 'chart_unavailable'; end if;
  elsif not exists(select 1 from public.orders where id = new.id and workspace_id = new.workspace_id and encounter_id = new.encounter_id)
    and exists(select 1 from public.soap_notes where workspace_id = new.workspace_id
      and encounter_id = new.encounter_id and status <> 'voided') then
    raise exception 'chart_id_required';
  end if;
  return new;
end;
$$;
create trigger guard_order_chart_origin before insert or update on public.orders
  for each row execute function private.clair_guard_order_chart_origin();
revoke all on function private.clair_guard_order_chart_origin() from public, anon, authenticated, service_role;

-- Order-owned execution retains its existing encounter lifecycle rules; provenance does not close that path.
create function private.clair_require_order_encounter(p_workspace_id text,p_actor_user_id text,p_encounter_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid()::text then
    raise exception 'actor_mismatch' using errcode = '42501'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view') then
    raise exception 'permission_missing' using errcode = '42501'; end if;
  perform 1 from public.encounters where workspace_id = p_workspace_id and id = p_encounter_id
    and status <> 'cancelled' for update;
  if not found then raise exception 'encounter_unavailable'; end if;
end;
$$;
revoke all on function private.clair_require_order_encounter(text,text,uuid) from public,anon,authenticated,service_role;

create function private.clair_require_order_chart(
  p_workspace_id text, p_actor_user_id text, p_encounter_id uuid, p_chart_id uuid,
  p_editable boolean default true
) returns void language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  if p_editable then
    perform private.clair_require_chart_encounter(p_workspace_id, p_encounter_id, p_actor_user_id);
  else
    perform private.clair_require_order_encounter(p_workspace_id,p_actor_user_id,p_encounter_id);
  end if;
  select status into v_status from public.soap_notes where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id and id = p_chart_id and status <> 'voided' for update;
  if v_status is null then raise exception 'chart_unavailable'; end if;
  if p_editable and v_status not in ('draft', 'autosaved') then raise exception 'signed_chart_read_only'; end if;
end;
$$;
revoke all on function private.clair_require_order_chart(text, text, uuid, uuid, boolean)
  from public, anon, authenticated, service_role;

-- Preserve the consultation resolver, billing summary, CAS, explicit removals, and set expansion chain.
alter function public.clair_save_chart_order_draft(text, text, uuid, jsonb)
  rename to clair_save_chart_order_draft_encounter_base;
revoke all on function public.clair_save_chart_order_draft_encounter_base(text, text, uuid, jsonb)
  from public, anon, authenticated, service_role;
create function public.clair_save_chart_order_draft_for_chart(
  p_workspace_id text, p_actor_user_id text, p_encounter_id uuid, p_chart_id uuid, p_orders jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_previous text := pg_catalog.current_setting('clair.order_origin_chart_id', true);
begin
  perform private.clair_require_order_chart(p_workspace_id, p_actor_user_id, p_encounter_id, p_chart_id);
  if pg_catalog.jsonb_typeof(p_orders->'rows') is distinct from 'array'
    or pg_catalog.jsonb_typeof(coalesce(p_orders->'removedOrderIds','[]'::jsonb)) is distinct from 'array' then
    raise exception 'invalid_order_rows'; end if;
  if exists (
    select 1 from public.orders o join (
      select private.clair_b3_safe_uuid(value->>'orderId') id from pg_catalog.jsonb_array_elements(p_orders->'rows') row(value)
      union all
      select private.clair_b3_safe_uuid(value #>> '{}') from pg_catalog.jsonb_array_elements(coalesce(p_orders->'removedOrderIds','[]'::jsonb)) row(value)
    ) target on target.id = o.id
    where o.workspace_id is distinct from p_workspace_id or o.encounter_id is distinct from p_encounter_id
      or o.origin_chart_id is distinct from p_chart_id
  ) then raise exception 'order_chart_mismatch'; end if;
  if exists(select 1 from public.orders child join public.orders root on root.id = child.parent_chart_order_line_id
    where root.workspace_id = p_workspace_id and root.encounter_id = p_encounter_id and root.origin_chart_id = p_chart_id
      and child.origin_chart_id is distinct from root.origin_chart_id) then raise exception 'order_chart_mismatch'; end if;
  perform pg_catalog.set_config('clair.order_origin_chart_id', p_chart_id::text, true);
  v_result := public.clair_save_chart_order_draft_encounter_base(p_workspace_id, p_actor_user_id, p_encounter_id, p_orders);
  perform pg_catalog.set_config('clair.order_origin_chart_id', coalesce(v_previous,''), true);
  return v_result;
exception when others then
  perform pg_catalog.set_config('clair.order_origin_chart_id', coalesce(v_previous,''), true);
  raise;
end;
$$;
create function public.clair_save_chart_order_draft(
  p_workspace_id text, p_actor_user_id text, p_encounter_id uuid, p_orders jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_previous text := pg_catalog.current_setting('clair.order_origin_chart_id', true);
begin
  perform private.clair_require_chart_encounter(p_workspace_id,p_encounter_id,p_actor_user_id);
  if pg_catalog.jsonb_typeof(p_orders->'rows') is distinct from 'array'
    or pg_catalog.jsonb_typeof(coalesce(p_orders->'removedOrderIds','[]'::jsonb)) is distinct from 'array' then
    raise exception 'invalid_order_rows'; end if;
  if exists(select 1 from (
    select private.clair_b3_safe_uuid(value->>'orderId') id from pg_catalog.jsonb_array_elements(p_orders->'rows') row(value)
    union all select private.clair_b3_safe_uuid(value #>> '{}') from pg_catalog.jsonb_array_elements(coalesce(p_orders->'removedOrderIds','[]'::jsonb)) row(value)
  ) target left join public.orders o on o.id = target.id
  where (o.id is not null and (o.workspace_id is distinct from p_workspace_id
    or o.encounter_id is distinct from p_encounter_id or o.origin_chart_id is not null))
    or (o.id is null and exists(select 1 from public.soap_notes where workspace_id = p_workspace_id
      and encounter_id = p_encounter_id and status <> 'voided'))
  ) then raise exception 'chart_id_required'; end if;
  perform pg_catalog.set_config('clair.order_origin_chart_id','',true);
  v_result := public.clair_save_chart_order_draft_encounter_base(p_workspace_id,p_actor_user_id,p_encounter_id,p_orders);
  perform pg_catalog.set_config('clair.order_origin_chart_id',coalesce(v_previous,''),true);
  return v_result;
exception when others then
  perform pg_catalog.set_config('clair.order_origin_chart_id',coalesce(v_previous,''),true);
  raise;
end;
$$;

-- Every action readback retains provenance; billing and result identities remain order-owned.
alter function private.clair_b3_runtime_row_json(public.orders) rename to clair_b3_runtime_row_json_origin_base;
create function private.clair_b3_runtime_row_json(p_order public.orders)
returns jsonb language sql stable set search_path = '' as $$
  select private.clair_b3_runtime_row_json_origin_base(p_order)
    || pg_catalog.jsonb_build_object('originChartId',p_order.origin_chart_id);
$$;
revoke all on function private.clair_b3_runtime_row_json(public.orders) from public, anon, authenticated, service_role;
revoke all on function private.clair_b3_runtime_row_json_origin_base(public.orders) from public, anon, authenticated, service_role;

alter function public.clair_get_chart_order_draft(text, uuid) rename to clair_get_chart_order_draft_origin_base;
revoke all on function public.clair_get_chart_order_draft_origin_base(text, uuid) from public, anon, authenticated, service_role;
create function public.clair_get_chart_order_draft(p_workspace_id text, p_encounter_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_rows jsonb;
begin
  v_result := public.clair_get_chart_order_draft_origin_base(p_workspace_id,p_encounter_id);
  select coalesce(pg_catalog.jsonb_agg(row.value || pg_catalog.jsonb_build_object('originChartId',o.origin_chart_id)
    order by row.ordinality),'[]'::jsonb) into v_rows
  from pg_catalog.jsonb_array_elements(coalesce(v_result->'rows','[]'::jsonb)) with ordinality row(value,ordinality)
  join public.orders o on o.workspace_id = p_workspace_id and o.encounter_id = p_encounter_id
    and o.id = (row.value->>'orderId')::uuid;
  return pg_catalog.jsonb_set(v_result,'{rows}',v_rows);
end;
$$;

alter function public.clair_confirm_chart_order_candidates(text,uuid,uuid,uuid[],text,text)
  rename to clair_confirm_chart_order_candidates_origin_base;
revoke all on function public.clair_confirm_chart_order_candidates_origin_base(text,uuid,uuid,uuid[],text,text)
  from public, anon, authenticated, service_role;
create function public.clair_confirm_chart_order_candidates_for_chart(
  p_workspace_id text, p_actor_user_id uuid, p_encounter_id uuid, p_chart_id uuid,
  p_selected_root_order_ids uuid[], p_expected_draft_etag text, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.clair_require_order_chart(p_workspace_id,p_actor_user_id::text,p_encounter_id,p_chart_id,false);
  if exists(select 1 from pg_catalog.unnest(p_selected_root_order_ids) selected(id)
    where not exists(select 1 from public.orders o where o.workspace_id = p_workspace_id
      and o.encounter_id = p_encounter_id and o.id = selected.id and o.origin_chart_id = p_chart_id)) then
    raise exception 'order_chart_mismatch'; end if;
  return public.clair_confirm_chart_order_candidates_origin_base(p_workspace_id,p_actor_user_id,p_encounter_id,
    p_selected_root_order_ids,p_expected_draft_etag,p_idempotency_key);
end;
$$;
create function public.clair_confirm_chart_order_candidates(
  p_workspace_id text, p_actor_user_id uuid, p_encounter_id uuid,
  p_selected_root_order_ids uuid[], p_expected_draft_etag text, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_chart_id uuid := nullif(pg_catalog.current_setting('clair.order_confirm_chart_id',true),'')::uuid;
begin
  if v_chart_id is not null then
    return public.clair_confirm_chart_order_candidates_for_chart(p_workspace_id,p_actor_user_id,p_encounter_id,
      v_chart_id,p_selected_root_order_ids,p_expected_draft_etag,p_idempotency_key);
  end if;
  perform private.clair_require_order_encounter(p_workspace_id,p_actor_user_id::text,p_encounter_id);
  if exists(select 1 from public.orders where workspace_id = p_workspace_id and encounter_id = p_encounter_id
    and id = any(p_selected_root_order_ids) and origin_chart_id is not null) then raise exception 'chart_id_required'; end if;
  return public.clair_confirm_chart_order_candidates_origin_base(p_workspace_id,p_actor_user_id,p_encounter_id,
    p_selected_root_order_ids,p_expected_draft_etag,p_idempotency_key);
end;
$$;

alter function public.clair_mutate_chart_order_execution(text,uuid,uuid,text,text,integer,jsonb,text)
  rename to clair_mutate_chart_order_execution_origin_base;
revoke all on function public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)
  from public, anon, authenticated, service_role;
create function public.clair_mutate_chart_order_execution_for_chart(
  p_workspace_id text, p_actor_user_id uuid, p_chart_id uuid, p_order_id uuid,
  p_action text, p_reason text, p_expected_revision_no integer, p_changes jsonb, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_encounter_id uuid;
begin
  select encounter_id into v_encounter_id from public.orders where workspace_id = p_workspace_id
    and id = p_order_id and origin_chart_id = p_chart_id;
  if v_encounter_id is null then raise exception 'order_chart_mismatch'; end if;
  perform private.clair_require_order_chart(p_workspace_id,p_actor_user_id::text,v_encounter_id,p_chart_id,false);
  return public.clair_mutate_chart_order_execution_origin_base(p_workspace_id,p_actor_user_id,p_order_id,
    p_action,p_reason,p_expected_revision_no,p_changes,p_idempotency_key);
end;
$$;
create function public.clair_mutate_chart_order_execution(
  p_workspace_id text, p_actor_user_id uuid, p_order_id uuid,
  p_action text, p_reason text, p_expected_revision_no integer, p_changes jsonb, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_encounter_id uuid; v_origin uuid;
begin
  select encounter_id,origin_chart_id into v_encounter_id,v_origin from public.orders
    where workspace_id = p_workspace_id and id = p_order_id;
  perform private.clair_require_order_encounter(p_workspace_id,p_actor_user_id::text,v_encounter_id);
  if v_origin is not null then raise exception 'chart_id_required'; end if;
  return public.clair_mutate_chart_order_execution_origin_base(p_workspace_id,p_actor_user_id,p_order_id,
    p_action,p_reason,p_expected_revision_no,p_changes,p_idempotency_key);
end;
$$;

revoke all on function public.clair_save_chart_order_draft_for_chart(text,text,uuid,uuid,jsonb) from public,anon;
grant execute on function public.clair_save_chart_order_draft_for_chart(text,text,uuid,uuid,jsonb) to authenticated;
revoke all on function public.clair_save_chart_order_draft(text,text,uuid,jsonb) from public,anon;
grant execute on function public.clair_save_chart_order_draft(text,text,uuid,jsonb) to authenticated;
revoke all on function public.clair_get_chart_order_draft(text,uuid) from public,anon;
grant execute on function public.clair_get_chart_order_draft(text,uuid) to authenticated;
revoke all on function public.clair_confirm_chart_order_candidates_for_chart(text,uuid,uuid,uuid,uuid[],text,text) from public,anon;
grant execute on function public.clair_confirm_chart_order_candidates_for_chart(text,uuid,uuid,uuid,uuid[],text,text) to authenticated;
revoke all on function public.clair_confirm_chart_order_candidates(text,uuid,uuid,uuid[],text,text) from public,anon;
grant execute on function public.clair_confirm_chart_order_candidates(text,uuid,uuid,uuid[],text,text) to authenticated;
revoke all on function public.clair_mutate_chart_order_execution_for_chart(text,uuid,uuid,uuid,text,text,integer,jsonb,text) from public,anon;
grant execute on function public.clair_mutate_chart_order_execution_for_chart(text,uuid,uuid,uuid,text,text,integer,jsonb,text) to authenticated;
revoke all on function public.clair_mutate_chart_order_execution(text,uuid,uuid,text,text,integer,jsonb,text) from public,anon;
grant execute on function public.clair_mutate_chart_order_execution(text,uuid,uuid,text,text,integer,jsonb,text) to authenticated;

-- Retain current V1 actual attestation and V2 ready-plan behavior through the existing wrapper.
create function public.clair_confirm_chart_order_candidates_with_actual_for_chart(
  p_workspace_id text,p_actor_user_id uuid,p_encounter_id uuid,p_chart_id uuid,
  p_selected_root_order_ids uuid[],p_expected_draft_etag text,p_idempotency_key text,
  p_actual_records jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_previous text := pg_catalog.current_setting('clair.order_confirm_chart_id',true);
begin
  perform private.clair_require_order_chart(p_workspace_id,p_actor_user_id::text,p_encounter_id,p_chart_id,false);
  perform pg_catalog.set_config('clair.order_confirm_chart_id',p_chart_id::text,true);
  v_result := public.clair_confirm_chart_order_candidates_with_actual(p_workspace_id,p_actor_user_id,p_encounter_id,
    p_selected_root_order_ids,p_expected_draft_etag,p_idempotency_key,p_actual_records);
  perform pg_catalog.set_config('clair.order_confirm_chart_id',coalesce(v_previous,''),true);
  return v_result;
exception when others then
  perform pg_catalog.set_config('clair.order_confirm_chart_id',coalesce(v_previous,''),true);
  raise;
end;
$$;
revoke all on function public.clair_confirm_chart_order_candidates_with_actual_for_chart(text,uuid,uuid,uuid,uuid[],text,text,jsonb)
  from public,anon,service_role;
grant execute on function public.clair_confirm_chart_order_candidates_with_actual_for_chart(text,uuid,uuid,uuid,uuid[],text,text,jsonb)
  to authenticated;

-- Execution results own lifecycle transitions. The compatibility RPC may only
-- synchronize a transition already authorized and persisted by fulfillment.
alter function public.clair_save_chart_order_lifecycle(text,uuid,uuid,uuid,text,text)
  rename to clair_save_chart_order_lifecycle_internal;
revoke all on function public.clair_save_chart_order_lifecycle_internal(text,uuid,uuid,uuid,text,text)
  from public,anon,authenticated,service_role;

do $patch$
declare v_signature text; v_definition text; v_replaced text;
begin
  foreach v_signature in array array[
    'public.clair_record_order_execution_result(text,uuid,uuid,bigint,text,integer,uuid,timestamptz,jsonb,text,text)',
    'public.clair_record_chart_actual_result(text,uuid,uuid,text,uuid,timestamptz,jsonb,boolean)'
  ] loop
    -- Older isolated baselines do not expose these APIs. Existing deployed
    -- definitions are patched in place so intervening result fixes survive.
    if to_regprocedure(v_signature) is null then continue; end if;
    select pg_get_functiondef(to_regprocedure(v_signature)) into v_definition;
    if (length(v_definition)-length(replace(v_definition,'public.clair_save_chart_order_lifecycle(','')))
      /length('public.clair_save_chart_order_lifecycle(') <> 2 then
      raise exception 'unexpected_lifecycle_result_definition: %',v_signature;
    end if;
    v_replaced:=replace(v_definition,'public.clair_save_chart_order_lifecycle(',
      'public.clair_save_chart_order_lifecycle_internal(');
    execute v_replaced;
  end loop;
end $patch$;

create function public.clair_save_chart_order_lifecycle(
  p_workspace_id text,p_actor_user_id uuid,p_encounter_id uuid,p_order_id uuid,
  p_status text,p_cancellation_reason text default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_item public.order_fulfillment_work_items%rowtype; v_expected text; v_current text;
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_user_id
    or not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'permission_missing' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('clinical_billing:'||p_workspace_id||':'||p_encounter_id::text,0));
  perform 1 from public.orders root where root.workspace_id=p_workspace_id and root.encounter_id=p_encounter_id
    and root.id=(select coalesce(child.parent_chart_order_line_id,child.id) from public.orders child
      where child.workspace_id=p_workspace_id and child.encounter_id=p_encounter_id and child.id=p_order_id) for update;
  select status into v_current from public.orders
    where workspace_id=p_workspace_id and encounter_id=p_encounter_id and id=p_order_id for update;
  if not found then raise exception 'order_unavailable'; end if;
  select item.* into v_item from public.order_fulfillment_work_items item
    join public.order_tasks task on task.id=item.task_id and task.workspace_id=item.workspace_id
      and task.order_id=item.order_id and task.encounter_id=item.encounter_id
      and task.attempt_no=item.task_attempt_no
      and task.status=case item.status when 'completed' then 'complete' when 'requested' then 'pending' else item.status end
    where item.workspace_id=p_workspace_id and item.encounter_id=p_encounter_id and item.order_id=p_order_id
      and not exists(select 1 from public.order_tasks newer where newer.workspace_id=task.workspace_id
        and newer.order_id=task.order_id and newer.task_role='execution' and newer.attempt_no>task.attempt_no)
    order by item.task_attempt_no desc,item.updated_at desc,item.id desc limit 1 for update of item;
  if not found then raise exception 'lifecycle_transition_requires_fulfillment'; end if;
  perform 1 from public.order_tasks where workspace_id=p_workspace_id and id=v_item.task_id for update;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id,
    private.clair_queue_permission_for_destination(coalesce(v_item.destination_module,v_item.queue_type),'mutate')) then
    raise exception 'permission_missing' using errcode='42501';
  end if;
  v_expected:=case when v_item.status in ('in_progress','paused') then 'in_progress'
    when v_item.status='completed' then 'completed' when v_item.status='cancelled' then 'cancelled'
    when v_item.status='returned' then 're_requested' else null end;
  if v_expected is null or (p_status is distinct from v_expected and not (
    p_status='in_progress' and v_expected in ('completed','re_requested')
      and v_current in ('requested','re_requested','confirmed')
  )) then raise exception 'lifecycle_transition_requires_fulfillment'; end if;
  return public.clair_save_chart_order_lifecycle_internal(p_workspace_id,p_actor_user_id,p_encounter_id,p_order_id,
    p_status,case when p_status='cancelled' then coalesce(nullif(btrim(v_item.reason),''),'fulfillment_cancelled') else null end);
end $$;
revoke all on function public.clair_save_chart_order_lifecycle(text,uuid,uuid,uuid,text,text)
  from public,anon,service_role;
grant execute on function public.clair_save_chart_order_lifecycle(text,uuid,uuid,uuid,text,text) to authenticated;

-- A mixed legacy set can partially complete during confirmation. Keep its
-- aggregate start metadata consistent with the existing lifecycle constraints.
do $aggregate_start$
declare definition text; anchor text:='status = v_aggregate_status,';
begin
  definition:=pg_get_functiondef('public.clair_confirm_chart_order_candidates_billing_summary_base(text,uuid,uuid,uuid[],text,text)'::regprocedure);
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
    raise exception 'unexpected_confirmation_aggregate_definition'; end if;
  execute replace(definition,anchor,$replacement$status = v_aggregate_status,
        started_at = case when v_aggregate_status in ('in_progress','partial_complete','complete')
          then coalesce(task.started_at,v_now) else task.started_at end,
        started_by_user_id = case when v_aggregate_status in ('in_progress','partial_complete','complete')
          then coalesce(task.started_by_user_id,p_actor_user_id) else task.started_by_user_id end,$replacement$);
end $aggregate_start$;

-- Editing an imported/deleted-author note must not invent an original author.
-- Keep legacy INSERT attribution but preserve every existing UPDATE author.
do $legacy_author$
declare signature text; definition text; anchor text:='author_user_id = coalesce(author_user_id, v_actor_user_id),';
begin
 foreach signature in array array[
   'public.clair_save_chart_soap_note_single_chart_base(text,text,uuid,jsonb,timestamptz,text)',
   'public.clair_save_chart_soap_note_v2_single_chart_base(text,text,uuid,jsonb,timestamptz,text,text)',
   'public.clair_save_chart_soap_note_v3_single_chart_base(text,text,uuid,jsonb,timestamptz,text,text)'
 ] loop
   definition:=pg_get_functiondef(to_regprocedure(signature));
   if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
     raise exception 'unexpected_legacy_soap_author_definition: %',signature; end if;
   execute replace(definition,anchor,'');
 end loop;
end $legacy_author$;

-- Starting/completing a routed set child also advances its aggregate. Preserve
-- lifecycle timestamps required by the existing order_tasks constraints.
do $fulfillment_aggregate$
declare definition text; anchor text:=$anchor$set status = private.clair_calculate_aggregate_task_status(
      p_workspace_id, v_task.parent_task_id
    ), row_revision = aggregate_task.row_revision + 1, updated_at = v_now$anchor$;
begin
 definition:=pg_get_functiondef('public.clair_transition_fulfillment_work_item(text,uuid,uuid,text,bigint,uuid,uuid,text,text)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
   raise exception 'unexpected_fulfillment_aggregate_definition'; end if;
 execute replace(definition,anchor,$replacement$set status = private.clair_calculate_aggregate_task_status(p_workspace_id,v_task.parent_task_id),
      started_at = case when private.clair_calculate_aggregate_task_status(p_workspace_id,v_task.parent_task_id) in ('in_progress','partial_complete','complete')
        then coalesce(aggregate_task.started_at,v_now) else aggregate_task.started_at end,
      started_by_user_id = case when private.clair_calculate_aggregate_task_status(p_workspace_id,v_task.parent_task_id) in ('in_progress','partial_complete','complete')
        then coalesce(aggregate_task.started_by_user_id,p_actor_user_id) else aggregate_task.started_by_user_id end,
      completed_at = case when private.clair_calculate_aggregate_task_status(p_workspace_id,v_task.parent_task_id)='complete'
        then coalesce(aggregate_task.completed_at,v_now) else aggregate_task.completed_at end,
      cancelled_at = case when private.clair_calculate_aggregate_task_status(p_workspace_id,v_task.parent_task_id)='cancelled'
        then coalesce(aggregate_task.cancelled_at,v_now) else aggregate_task.cancelled_at end,
      row_revision = aggregate_task.row_revision + 1, updated_at = v_now$replacement$);
end $fulfillment_aggregate$;

-- Set roots and non-dispensing children have a canonical nine-key calculation
-- envelope. A non-applicable dispense projection must never replace it.
-- Dispensing children retain the existing readiness and lineage checks.
do $set_projection$
declare definition text; anchor text:='  if new.order_confirmation_status not in (''draft'',''pending'')';
begin
 definition:=pg_get_functiondef('private.clair_refresh_plan_order_dispense_projection()'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
   raise exception 'unexpected_dispense_projection_trigger_definition'; end if;
 execute replace(definition,anchor,$replacement$  if new.row_type='set'
     or (new.row_type='set_child' and new.clinical_order_type is distinct from 'dispensing')
  then return new; end if;
$replacement$||anchor);
end $set_projection$;

-- Set composition snapshots are immutable B3 envelopes. Clinical candidate
-- fields already have dedicated columns and are frozen into confirmed_snapshot
-- by confirmation; do not append them to the hashed composition envelope.
do $set_candidate_envelope$
declare definition text; root_anchor text:=$root$applied_snapshot = orders.applied_snapshot || jsonb_build_object(
        'clinicalOrderType', orders.clinical_order_type,
        'destinationModule', orders.destination_module,
        'executionMode', orders.execution_mode,
        'detailInputs', v_detail_inputs,
        'detailSchemaVersion', v_schema_version,
        'priority', v_priority
      ),$root$;
 child_anchor text:=$child$applied_snapshot = child.applied_snapshot || jsonb_build_object(
          'clinicalOrderType', child.clinical_order_type,
          'destinationModule', child.destination_module,
          'executionMode', child.execution_mode,
          'detailInputs', v_detail_inputs,
          'detailSchemaVersion', v_schema_version,
          'priority', v_priority
        ),$child$;
begin
 definition:=pg_get_functiondef('public.clair_save_chart_order_draft_candidate_base(text,text,uuid,jsonb)'::regprocedure);
 if (length(definition)-length(replace(definition,root_anchor,'')))/length(root_anchor)<>1
    or (length(definition)-length(replace(definition,child_anchor,'')))/length(child_anchor)<>1 then
   raise exception 'unexpected_candidate_set_envelope_definition'; end if;
 definition:=replace(definition,root_anchor,replace(replace(root_anchor,
   'applied_snapshot = orders.applied_snapshot ||',
   'applied_snapshot = case when orders.row_type=''individual'' then orders.applied_snapshot ||'),
   '      ),','      ) else orders.applied_snapshot end,'));
 definition:=replace(definition,child_anchor,'applied_snapshot = child.applied_snapshot,');
 execute definition;
end $set_candidate_envelope$;

-- Cancelled roots retain their immutable composition as history. They no longer
-- have an active-child membership set; still validate schema/hash/lineage above
-- and each child below, but do not require cancelled children to be active.
do $cancelled_set_membership$
declare definition text; start_anchor text:=$start$    if (
      select count(*)
      from jsonb_array_elements(new.applied_snapshot -> 'items') entry(item)
      where (entry.item ->> 'selected')::boolean
    ) is distinct from ($start$;
 end_anchor text:=$end$    return new;
  end if;

  if (select count(*) from jsonb_object_keys(new.applied_snapshot)) <> 52$end$;
begin
 definition:=pg_get_functiondef('private.clair_b3_assert_set_child_lineage()'::regprocedure);
 if (length(definition)-length(replace(definition,start_anchor,'')))/length(start_anchor)<>1
   or (length(definition)-length(replace(definition,end_anchor,'')))/length(end_anchor)<>1 then
   raise exception 'unexpected_set_membership_definition'; end if;
 definition:=replace(definition,start_anchor,$replacement$    if not exists(select 1 from public.orders current_root
      where current_root.workspace_id=new.workspace_id and current_root.id=new.id and current_root.status='cancelled') then
$replacement$||start_anchor);
 definition:=replace(definition,end_anchor,'    end if;'||E'\n'||end_anchor);
 execute definition;
end $cancelled_set_membership$;
