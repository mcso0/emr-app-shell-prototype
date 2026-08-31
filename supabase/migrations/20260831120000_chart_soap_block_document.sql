-- CHART-PR-030: persist BlockNote JSON as the canonical SOAP document while
-- retaining server-derived S/O/A/P projections for existing chart consumers.
-- Remote application remains approval-gated.

alter table public.soap_notes
  add column if not exists block_document jsonb,
  add column if not exists block_document_schema_version smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'soap_notes_block_document_pair_check'
      and conrelid = 'public.soap_notes'::regclass
  ) then
    alter table public.soap_notes
      add constraint soap_notes_block_document_pair_check
      check (
        (block_document is null and block_document_schema_version is null)
        or (
          block_document is not null
          and
          block_document_schema_version = 1
          and jsonb_typeof(block_document) = 'array'
          and jsonb_array_length(block_document) > 0
          and octet_length(block_document::text) <= 262144
        )
      );
  end if;
end;
$$;

create or replace function private.clair_soap_trim_boundary_whitespace(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(coalesce(p_value, ''), E' \t\n\r\f\v');
$$;

create or replace function private.clair_soap_styles_are_valid(p_styles jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_value jsonb;
begin
  if jsonb_typeof(p_styles) is distinct from 'object' then
    return false;
  end if;

  for v_key, v_value in select key, value from jsonb_each(p_styles)
  loop
    if v_key in ('bold', 'italic', 'underline', 'strike', 'code') then
      if jsonb_typeof(v_value) is distinct from 'boolean' then
        return false;
      end if;
    elsif v_key in ('textColor', 'backgroundColor') then
      if jsonb_typeof(v_value) is distinct from 'string'
        or length(v_value #>> '{}') > 50
      then
        return false;
      end if;
    else
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create or replace function private.clair_soap_link_is_valid(p_href text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    char_length(p_href) <= 2048
    and p_href !~ '[\x00-\x20\x7f-\x9f\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]'
    and (
      p_href ~* '^https?://([a-z0-9]|[a-z0-9][a-z0-9.-]*[a-z0-9])(:[0-9]{1,5})?([/?#].*)?$'
      or p_href ~* '^mailto:.+$'
      or p_href ~* '^tel:\+?[0-9().-]+$'
    ),
    false
  );
$$;

create or replace function private.clair_soap_inline_is_valid(p_content jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_inline jsonb;
  v_link_text jsonb;
begin
  if jsonb_typeof(p_content) is distinct from 'array' then
    return false;
  end if;

  for v_inline in select value from jsonb_array_elements(p_content)
  loop
    if jsonb_typeof(v_inline) is distinct from 'object' then
      return false;
    end if;

    if v_inline->>'type' = 'text' then
      if jsonb_typeof(v_inline->'text') is distinct from 'string'
        or not private.clair_soap_styles_are_valid(v_inline->'styles')
      then
        return false;
      end if;
    elsif v_inline->>'type' = 'link' then
      if jsonb_typeof(v_inline->'href') is distinct from 'string'
        or not private.clair_soap_link_is_valid(v_inline->>'href')
        or jsonb_typeof(v_inline->'content') is distinct from 'array'
      then
        return false;
      end if;

      for v_link_text in
        select value from jsonb_array_elements(v_inline->'content')
      loop
        if jsonb_typeof(v_link_text) is distinct from 'object'
          or v_link_text->>'type' is distinct from 'text'
          or jsonb_typeof(v_link_text->'text') is distinct from 'string'
          or not private.clair_soap_styles_are_valid(v_link_text->'styles')
        then
          return false;
        end if;
      end loop;
    else
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create or replace function private.clair_soap_document_is_valid(p_document jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_block jsonb;
  v_block_count integer := 0;
  v_depth integer;
  v_id text;
  v_ids text[] := array[]::text[];
  v_props jsonb;
  v_type text;
begin
  if jsonb_typeof(p_document) is distinct from 'object'
    or jsonb_typeof(p_document->'schemaVersion') is distinct from 'number'
    or p_document->>'schemaVersion' is distinct from '1'
    or jsonb_typeof(p_document->'blocks') is distinct from 'array'
  then
    return false;
  end if;
  if jsonb_array_length(p_document->'blocks') = 0
    or octet_length(p_document::text) > 262144
  then
    return false;
  end if;

  for v_block, v_depth in
    with recursive block_tree(block, depth) as (
      select item.value, 0
      from jsonb_array_elements(p_document->'blocks') as item(value)
      union all
      select child.value, tree.depth + 1
      from block_tree as tree
      cross join lateral jsonb_array_elements(
        case
          when jsonb_typeof(tree.block->'children') = 'array'
            then tree.block->'children'
          else '[]'::jsonb
        end
      ) as child(value)
    )
    select block, depth from block_tree
  loop
    v_block_count := v_block_count + 1;
    if v_block_count > 400
      or v_depth > 4
      or jsonb_typeof(v_block) is distinct from 'object'
      or jsonb_typeof(v_block->'props') is distinct from 'object'
      or jsonb_typeof(v_block->'children') is distinct from 'array'
    then
      return false;
    end if;

    v_id := v_block->>'id';
    v_type := v_block->>'type';
    v_props := v_block->'props';

    if nullif(private.clair_soap_trim_boundary_whitespace(v_id), '') is null
      or char_length(v_id) > 200
      or v_id = any(v_ids)
      or v_type is null
      or v_type not in (
        'soapSection',
        'paragraph',
        'heading',
        'bulletListItem',
        'numberedListItem',
        'checkListItem',
        'quote',
        'divider'
      )
    then
      return false;
    end if;
    v_ids := array_append(v_ids, v_id);

    if v_type = 'soapSection' then
      if v_depth <> 0
        or v_block ? 'content'
        or v_props->>'scope' is null
        or v_props->>'scope' not in ('default', 'system')
        or v_props->>'kind' is null
        or v_props->>'kind' not in ('subjective', 'objective', 'assessment', 'plan')
        or nullif(private.clair_soap_trim_boundary_whitespace(v_props->>'label'), '') is null
        or char_length(v_props->>'label') > 100
        or nullif(private.clair_soap_trim_boundary_whitespace(v_props->>'systemLabel'), '') is null
        or char_length(v_props->>'systemLabel') > 100
      then
        return false;
      end if;
    elsif v_type = 'divider' then
      if v_block ? 'content' or v_props <> '{}'::jsonb then
        return false;
      end if;
    else
      if not private.clair_soap_inline_is_valid(v_block->'content')
        or jsonb_typeof(v_props->'backgroundColor') is distinct from 'string'
        or length(v_props->>'backgroundColor') > 50
        or jsonb_typeof(v_props->'textColor') is distinct from 'string'
        or length(v_props->>'textColor') > 50
      then
        return false;
      end if;

      if v_type <> 'quote'
        and (
          v_props->>'textAlignment' is null
          or v_props->>'textAlignment' not in ('left', 'center', 'right', 'justify')
        )
      then
        return false;
      end if;
      if v_type = 'heading'
        and (
          jsonb_typeof(v_props->'level') is distinct from 'number'
          or v_props->>'level' !~ '^[1-6]$'
        )
      then
        return false;
      end if;
      if v_type = 'checkListItem'
        and jsonb_typeof(v_props->'checked') is distinct from 'boolean'
      then
        return false;
      end if;
      if v_type = 'numberedListItem'
        and v_props ? 'start'
        and (
          jsonb_typeof(v_props->'start') is distinct from 'number'
          or v_props->>'start' !~ '^-?[0-9]+$'
        )
      then
        return false;
      end if;
    end if;
  end loop;

  return true;
end;
$$;

create or replace function private.clair_soap_inline_text(p_content jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    string_agg(
      case
        when item.value->>'type' = 'text' then coalesce(item.value->>'text', '')
        when item.value->>'type' = 'link' then coalesce((
          select string_agg(coalesce(link_text.value->>'text', ''), '' order by link_text.ordinality)
          from jsonb_array_elements(
            case
              when jsonb_typeof(item.value->'content') = 'array' then item.value->'content'
              else '[]'::jsonb
            end
          ) with ordinality as link_text(value, ordinality)
        ), '')
        else ''
      end,
      '' order by item.ordinality
    ),
    ''
  )
  from jsonb_array_elements(
    case when jsonb_typeof(p_content) = 'array' then p_content else '[]'::jsonb end
  ) with ordinality as item(value, ordinality);
$$;

create or replace function private.clair_soap_blocks_text(
  p_blocks jsonb,
  p_depth integer default 0
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_block jsonb;
  v_inline jsonb;
  v_piece text;
  v_result text := '';
begin
  if p_depth > 4 or jsonb_typeof(p_blocks) is distinct from 'array' then
    raise exception 'invalid_soap_document';
  end if;

  for v_block in select value from jsonb_array_elements(p_blocks)
  loop
    if nullif(btrim(v_block->>'id'), '') is null
      or v_block->>'type' not in (
        'soapSection',
        'paragraph',
        'heading',
        'bulletListItem',
        'numberedListItem',
        'checkListItem',
        'quote',
        'divider'
      )
      or jsonb_typeof(v_block->'props') is distinct from 'object'
      or jsonb_typeof(v_block->'children') is distinct from 'array'
      or (v_block->>'type' = 'soapSection' and p_depth <> 0)
    then
      raise exception 'invalid_soap_document';
    end if;

    if v_block->>'type' = 'soapSection' then
      if v_block ? 'content'
        or v_block->'props'->>'scope' not in ('default', 'system')
        or v_block->'props'->>'kind' not in ('subjective', 'objective', 'assessment', 'plan')
      then
        raise exception 'invalid_soap_document';
      end if;
    elsif v_block->>'type' = 'divider' then
      if v_block ? 'content' then
        raise exception 'invalid_soap_document';
      end if;
    elsif jsonb_typeof(v_block->'content') <> 'array' then
      raise exception 'invalid_soap_document';
    else
      for v_inline in select value from jsonb_array_elements(v_block->'content')
      loop
        if v_inline->>'type' = 'text' then
          if jsonb_typeof(v_inline->'text') is distinct from 'string'
            or jsonb_typeof(v_inline->'styles') is distinct from 'object'
          then
            raise exception 'invalid_soap_document';
          end if;
        elsif v_inline->>'type' = 'link' then
          if jsonb_typeof(v_inline->'href') is distinct from 'string'
            or not private.clair_soap_link_is_valid(v_inline->>'href')
            or jsonb_typeof(v_inline->'content') is distinct from 'array'
          then
            raise exception 'invalid_soap_document';
          end if;
        else
          raise exception 'invalid_soap_document';
        end if;
      end loop;
    end if;

    v_piece := private.clair_soap_inline_text(v_block->'content');
    if jsonb_typeof(v_block->'children') = 'array'
      and jsonb_array_length(v_block->'children') > 0
    then
      v_piece := concat_ws(
        E'\n',
        nullif(v_piece, ''),
        nullif(private.clair_soap_blocks_text(v_block->'children', p_depth + 1), '')
      );
    end if;

    if v_piece <> '' then
      v_result := concat_ws(E'\n', nullif(v_result, ''), v_piece);
    end if;
  end loop;

  if p_depth = 0 then
    return private.clair_soap_trim_boundary_whitespace(v_result);
  end if;

  return v_result;
end;
$$;

create or replace function private.clair_soap_document_field(
  p_document jsonb,
  p_kind text
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_section jsonb;
  v_section_count integer;
begin
  select count(*)
    into v_section_count
  from jsonb_array_elements(p_document->'blocks') as section(value)
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
  from jsonb_array_elements(p_document->'blocks') as section(value)
  where section.value->>'type' = 'soapSection'
    and section.value->'props'->>'scope' = 'default'
    and section.value->'props'->>'kind' = p_kind
  limit 1;

  return private.clair_soap_blocks_text(v_section->'children');
end;
$$;

revoke all on function private.clair_soap_inline_text(jsonb) from public, anon, authenticated;
revoke all on function private.clair_soap_blocks_text(jsonb, integer) from public, anon, authenticated;
revoke all on function private.clair_soap_document_field(jsonb, text) from public, anon, authenticated;
revoke all on function private.clair_soap_trim_boundary_whitespace(text) from public, anon, authenticated;
revoke all on function private.clair_soap_styles_are_valid(jsonb) from public, anon, authenticated;
revoke all on function private.clair_soap_link_is_valid(text) from public, anon, authenticated;
revoke all on function private.clair_soap_inline_is_valid(jsonb) from public, anon, authenticated;
revoke all on function private.clair_soap_document_is_valid(jsonb) from public, anon, authenticated;

create or replace function private.clair_guard_legacy_soap_projection_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
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

revoke all on function private.clair_guard_legacy_soap_projection_update()
  from public, anon, authenticated;

drop trigger if exists guard_legacy_soap_projection_update on public.soap_notes;
create trigger guard_legacy_soap_projection_update
before update on public.soap_notes
for each row execute function private.clair_guard_legacy_soap_projection_update();

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

  select jsonb_strip_nulls(jsonb_build_object(
    'id', s.id::text,
    'encounterId', s.encounter_id::text,
    'authorUserId', s.author_user_id::text,
    'subjective', s.subjective,
    'objective', s.objective,
    'assessment', s.assessment,
    'plan', s.plan,
    'blockDocument', case
      when s.block_document is not null and s.block_document_schema_version is not null
        then jsonb_build_object(
          'schemaVersion', s.block_document_schema_version,
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

create or replace function public.clair_save_chart_soap_note(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_note jsonb,
  p_expected_updated_at timestamptz default null,
  p_mode text default 'autosave'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_encounter_status text;
  v_existing_id uuid;
  v_existing_updated_at timestamptz;
  v_now timestamptz := now();
  v_status text := case when p_mode = 'manual_save' then 'draft' else 'autosaved' end;
  v_note_row jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;

  if auth.uid() is null or v_actor_user_id is null or v_actor_user_id is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;

  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing' using errcode = '42501';
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

  select s.id, s.updated_at
    into v_existing_id, v_existing_updated_at
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

  if v_existing_id is null then
    insert into public.soap_notes (
      workspace_id,
      encounter_id,
      author_user_id,
      subjective,
      objective,
      assessment,
      plan,
      status,
      autosaved_at,
      created_at,
      updated_at
    )
    values (
      p_workspace_id,
      p_encounter_id,
      v_actor_user_id,
      nullif(btrim(p_note->>'subjective'), ''),
      nullif(btrim(p_note->>'objective'), ''),
      nullif(btrim(p_note->>'assessment'), ''),
      nullif(btrim(p_note->>'plan'), ''),
      v_status,
      case when p_mode = 'autosave' then v_now else null end,
      v_now,
      v_now
    )
    returning id into v_existing_id;
  else
    update public.soap_notes
    set
      author_user_id = coalesce(author_user_id, v_actor_user_id),
      subjective = nullif(btrim(p_note->>'subjective'), ''),
      objective = nullif(btrim(p_note->>'objective'), ''),
      assessment = nullif(btrim(p_note->>'assessment'), ''),
      plan = nullif(btrim(p_note->>'plan'), ''),
      status = v_status,
      autosaved_at = case when p_mode = 'autosave' then v_now else autosaved_at end,
      updated_at = v_now
    where id = v_existing_id
      and workspace_id = p_workspace_id;
  end if;

  select jsonb_strip_nulls(jsonb_build_object(
    'id', s.id::text,
    'encounterId', s.encounter_id::text,
    'authorUserId', s.author_user_id::text,
    'subjective', s.subjective,
    'objective', s.objective,
    'assessment', s.assessment,
    'plan', s.plan,
    'blockDocument', case
      when s.block_document is not null and s.block_document_schema_version is not null
        then jsonb_build_object(
          'schemaVersion', s.block_document_schema_version,
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
    and s.id = v_existing_id;

  return v_note_row;
end;
$$;

drop function if exists public.clair_save_chart_soap_note_v2(text, text, uuid, jsonb, timestamptz, text, text);

create function public.clair_save_chart_soap_note_v2(
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
  v_encounter_status text;
  v_existing_id uuid;
  v_existing_updated_at timestamptz;
  v_now timestamptz := now();
  v_status text := case when p_mode = 'manual_save' then 'draft' else 'autosaved' end;
  v_note_row jsonb;
  v_document jsonb := p_note->'blockDocument';
  v_has_document boolean := p_note ? 'blockDocument';
  v_subjective text;
  v_objective text;
  v_assessment text;
  v_plan text;
  v_audit_event jsonb;
begin
  if p_mode is null or p_mode not in ('autosave', 'manual_save') then
    raise exception 'invalid_save_mode';
  end if;

  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;

  if auth.uid() is null or v_actor_user_id is null or v_actor_user_id is distinct from auth.uid() then
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

  perform private.clair_soap_blocks_text(v_document->'blocks');

  v_subjective := private.clair_soap_document_field(v_document, 'subjective');
  v_objective := private.clair_soap_document_field(v_document, 'objective');
  v_assessment := private.clair_soap_document_field(v_document, 'assessment');
  v_plan := private.clair_soap_document_field(v_document, 'plan');

  if char_length(v_subjective) > 10000
    or char_length(v_objective) > 10000
    or char_length(v_assessment) > 10000
    or char_length(v_plan) > 10000
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

  select s.id, s.updated_at
    into v_existing_id, v_existing_updated_at
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
    )
    values (
      p_workspace_id,
      p_encounter_id,
      v_actor_user_id,
      nullif(v_subjective, ''),
      nullif(v_objective, ''),
      nullif(v_assessment, ''),
      nullif(v_plan, ''),
      v_document->'blocks',
      1,
      v_status,
      case when p_mode = 'autosave' then v_now else null end,
      v_now,
      v_now
    )
    returning id into v_existing_id;
  else
    update public.soap_notes
    set
      author_user_id = coalesce(author_user_id, v_actor_user_id),
      subjective = nullif(v_subjective, ''),
      objective = nullif(v_objective, ''),
      assessment = nullif(v_assessment, ''),
      plan = nullif(v_plan, ''),
      block_document = v_document->'blocks',
      block_document_schema_version = 1,
      status = v_status,
      autosaved_at = case when p_mode = 'autosave' then v_now else autosaved_at end,
      updated_at = v_now
    where id = v_existing_id
      and workspace_id = p_workspace_id;
  end if;

  select jsonb_strip_nulls(jsonb_build_object(
    'id', s.id::text,
    'encounterId', s.encounter_id::text,
    'authorUserId', s.author_user_id::text,
    'subjective', s.subjective,
    'objective', s.objective,
    'assessment', s.assessment,
    'plan', s.plan,
    'blockDocument', jsonb_build_object(
      'schemaVersion', s.block_document_schema_version,
      'blocks', s.block_document
    ),
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

  v_audit_event := public.clair_append_audit_event(
    p_id => 'chart-soap-save-' || extensions.gen_random_uuid()::text,
    p_workspace_id => p_workspace_id,
    p_actor_user_id => v_actor_user_id,
    p_actor_membership_id => v_actor_membership_id,
    p_event_type => 'chart.soap_saved',
    p_target_type => 'soap_note',
    p_target_id => v_existing_id::text,
    p_encounter_id => p_encounter_id,
    p_request_id => nullif(btrim(coalesce(p_request_id, '')), ''),
    p_after_snapshot => jsonb_build_object(
      'mode', p_mode,
      'noteStatus', v_status,
      'updatedAt', v_now,
      'documentSchemaVersion', 1,
      'topLevelBlockCount', jsonb_array_length(v_document->'blocks')
    ),
    p_metadata => jsonb_build_object(
      'source', 'chart-soap-note-database-transaction'
    ),
    p_occurred_at => v_now
  );

  return v_note_row || jsonb_build_object(
    'auditHandledBy', 'database_transaction',
    'auditRecorded', true,
    'auditEventId', v_audit_event->>'id'
  );
end;
$$;

revoke all on function public.clair_get_chart_soap_note(text, uuid) from public;
revoke all on function public.clair_get_chart_soap_note(text, uuid) from anon;
grant execute on function public.clair_get_chart_soap_note(text, uuid) to authenticated;

revoke all on function public.clair_save_chart_soap_note(text, text, uuid, jsonb, timestamptz, text) from public;
revoke all on function public.clair_save_chart_soap_note(text, text, uuid, jsonb, timestamptz, text) from anon;
grant execute on function public.clair_save_chart_soap_note(text, text, uuid, jsonb, timestamptz, text) to authenticated;

revoke all on function public.clair_save_chart_soap_note_v2(text, text, uuid, jsonb, timestamptz, text, text) from public;
revoke all on function public.clair_save_chart_soap_note_v2(text, text, uuid, jsonb, timestamptz, text, text) from anon;
grant execute on function public.clair_save_chart_soap_note_v2(text, text, uuid, jsonb, timestamptz, text, text) to authenticated;

comment on column public.soap_notes.block_document is
  'CHART-PR-030 canonical BlockNote block array. Null indicates a legacy four-field SOAP row.';
comment on column public.soap_notes.block_document_schema_version is
  'CHART-PR-030 canonical SOAP document schema version. V1 is the only accepted version.';
comment on function public.clair_get_chart_soap_note(text, uuid) is
  'CHART-PR-030 SOAP reader with authenticated membership, chart:view, encounter scope, and optional V1 block document.';
comment on function public.clair_save_chart_soap_note(text, text, uuid, jsonb, timestamptz, text) is
  'CHART-PR-030 migration-window legacy writer. Preserves the six-argument chart:update contract without acquiring chart:view, and rejects projection-only changes after canonical adoption.';
comment on function public.clair_save_chart_soap_note_v2(text, text, uuid, jsonb, timestamptz, text, text) is
  'CHART-PR-030 additive V2 SOAP writer with authenticated actor equality, chart:update, lifecycle, optimistic conflict, required canonical document, derived legacy projections, and database-transaction audit. The six-argument legacy writer remains during the two-phase rollout.';
