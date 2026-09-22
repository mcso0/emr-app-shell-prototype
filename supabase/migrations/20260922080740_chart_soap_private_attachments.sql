-- CHART-PR-040: private, encounter-scoped SOAP image/video references.
-- Local candidate; apply only after CHART-PR-030, CHART-PR-033, the
-- user-permission helper, and CHART-PR-037 multi-chart migrations.

do $$
begin
  if pg_catalog.to_regprocedure('private.clair_user_has_workspace_permission(text,uuid,text)') is null
    or pg_catalog.to_regprocedure('private.clair_require_legacy_single_chart(text,text,uuid)') is null
    or pg_catalog.to_regprocedure('public.clair_save_chart_soap_note_v3_single_chart_base(text,text,uuid,jsonb,timestamptz,text,text)') is null
    or pg_catalog.to_regprocedure('public.clair_save_chart_soap_note_v4(text,text,uuid,uuid,jsonb,timestamptz,text,text,text)') is null
  then raise exception 'soap_attachment_prerequisite_missing'; end if;
end;
$$;

create table public.chart_soap_attachments (
  id uuid primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  actor_user_id uuid not null references public.users(id),
  storage_path text not null unique,
  pending_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 20971520),
  file_name text not null check (length(file_name) between 1 and 200),
  ready_at timestamptz,
  cancelled_at timestamptz,
  pending_cleaned_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chart_soap_attachments_single_terminal_state check (ready_at is null or cancelled_at is null),
  constraint chart_soap_attachments_image_size check (mime_type not like 'image/%' or byte_size <= 5242880),
  constraint chart_soap_attachments_path check (
    storage_path = workspace_id || '/' || encounter_id::text || '/ready/' || id::text || '.' ||
      case mime_type
        when 'image/jpeg' then 'jpg'
        when 'image/png' then 'png'
        when 'image/webp' then 'webp'
        when 'video/mp4' then 'mp4'
        when 'video/webm' then 'webm'
      end
  ),
  constraint chart_soap_attachments_pending_path check (
    pending_path = workspace_id || '/' || encounter_id::text || '/pending/' || id::text || '.' ||
      case mime_type
        when 'image/jpeg' then 'jpg'
        when 'image/png' then 'png'
        when 'image/webp' then 'webp'
        when 'video/mp4' then 'mp4'
        when 'video/webm' then 'webm'
      end
  ),
  constraint chart_soap_attachments_encounter_workspace_fk
    foreign key (workspace_id, encounter_id) references public.encounters(workspace_id, id)
);

create index chart_soap_attachments_encounter_idx
  on public.chart_soap_attachments(workspace_id, encounter_id, ready_at);
create index chart_soap_attachments_expiry_idx
  on public.chart_soap_attachments(created_at) where pending_cleaned_at is null;

alter table public.chart_soap_attachments enable row level security;

create or replace function public.clair_get_chart_soap_attachment_encounter_status(
  p_workspace_id text, p_encounter_id uuid
) returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_status text;
begin
  if (select auth.uid()) is null
    or not private.clair_is_active_workspace_member(p_workspace_id)
    or not (
      private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view')
      or private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update')
    ) then
    raise exception 'permission_missing' using errcode = '42501';
  end if;
  select e.status into v_status from public.encounters e
  where e.workspace_id = p_workspace_id and e.id = p_encounter_id;
  return v_status;
end;
$$;

revoke all on function public.clair_get_chart_soap_attachment_encounter_status(text, uuid)
  from public, anon;
grant execute on function public.clair_get_chart_soap_attachment_encounter_status(text, uuid)
  to authenticated;

create policy chart_soap_attachments_select on public.chart_soap_attachments
for select to authenticated using (
  cancelled_at is null
  and
  private.clair_is_active_workspace_member(workspace_id)
  and public.clair_get_chart_soap_attachment_encounter_status(workspace_id, encounter_id)
    is distinct from 'cancelled'
  and public.clair_get_chart_soap_attachment_encounter_status(workspace_id, encounter_id)
    is not null
  and (
    (ready_at is null and actor_user_id = (select auth.uid())
      and private.clair_current_user_has_workspace_permission(workspace_id, 'chart:update'))
    or (ready_at is not null and (
      private.clair_current_user_has_workspace_permission(workspace_id, 'chart:view')
      or (actor_user_id = (select auth.uid())
        and private.clair_current_user_has_workspace_permission(workspace_id, 'chart:update'))
    ))
  )
);

create policy chart_soap_attachments_insert on public.chart_soap_attachments
for insert to authenticated with check (
  actor_user_id = (select auth.uid())
  and ready_at is null
  and cancelled_at is null
  and pending_cleaned_at is null
  and created_at = pg_catalog.now()
  and private.clair_is_active_workspace_member(workspace_id)
  and private.clair_current_user_has_workspace_permission(workspace_id, 'chart:update')
  and public.clair_get_chart_soap_attachment_encounter_status(workspace_id, encounter_id)
    in ('in_consultation', 'ordered')
);

create or replace function private.clair_guard_soap_attachment_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_object storage.objects%rowtype;
begin
  if new.id is distinct from old.id
    or new.workspace_id is distinct from old.workspace_id
    or new.encounter_id is distinct from old.encounter_id
    or new.actor_user_id is distinct from old.actor_user_id
    or new.storage_path is distinct from old.storage_path
    or new.pending_path is distinct from old.pending_path
    or new.mime_type is distinct from old.mime_type
    or new.byte_size is distinct from old.byte_size
    or new.file_name is distinct from old.file_name
    or new.created_at is distinct from old.created_at
    or old.pending_cleaned_at is not null
    or (new.pending_cleaned_at is not null and
      (old.pending_cleaned_at is not null
        or (old.ready_at is null and old.cancelled_at is null)
        or new.ready_at is distinct from old.ready_at
        or new.cancelled_at is distinct from old.cancelled_at))
    or (new.pending_cleaned_at is null and (old.ready_at is not null or old.cancelled_at is not null))
    or (new.ready_at is null and new.cancelled_at is null)
    or (new.ready_at is not null and new.cancelled_at is not null)
  then
    raise exception 'soap_attachment_immutable' using errcode = '42501';
  end if;
  if new.pending_cleaned_at is not null then
    if coalesce(old.ready_at, old.cancelled_at) >= pg_catalog.now() - interval '3 hours'
      or new.pending_cleaned_at < coalesce(old.ready_at, old.cancelled_at)
    then raise exception 'soap_attachment_cleanup_too_early' using errcode = '23514'; end if;
    return new;
  end if;
  -- Cancellation is an irreversible tombstone. It deliberately remains
  -- possible after encounter closure or permission revocation for expiry cleanup.
  if new.cancelled_at is not null then return new; end if;
  if not exists (
    select 1 from public.encounters e
    where e.workspace_id = new.workspace_id
      and e.id = new.encounter_id
      and e.status in ('in_consultation', 'ordered')
  ) then
    raise exception 'stale_status' using errcode = '23514';
  end if;
  if not private.clair_user_has_workspace_permission(
    new.workspace_id, new.actor_user_id, 'chart:update'
  ) then
    raise exception 'permission_missing' using errcode = '42501';
  end if;
  select * into v_object from storage.objects
  where bucket_id = 'chart-soap-attachments' and name = new.storage_path
  for key share;
  if v_object.id is null
    or v_object.metadata->>'mimetype' is distinct from new.mime_type
    or (v_object.metadata->>'size')::bigint is distinct from new.byte_size::bigint
  then
    raise exception 'soap_attachment_upload_missing' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger guard_soap_attachment_update
before update on public.chart_soap_attachments
for each row execute function private.clair_guard_soap_attachment_update();

-- Extend the existing audit event constraint without replacing unrelated
-- event types introduced by earlier migrations.
do $$
declare
  v_expression text;
begin
  select pg_catalog.pg_get_expr(c.conbin, c.conrelid) into v_expression
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.audit_events'::pg_catalog.regclass
    and c.conname = 'audit_events_event_type_check';
  if v_expression is null then raise exception 'audit_event_contract_missing'; end if;
  alter table public.audit_events drop constraint audit_events_event_type_check;
  execute pg_catalog.format(
    'alter table public.audit_events add constraint audit_events_event_type_check check ((%s) or event_type = %L)',
    v_expression, 'chart.soap_attachment_uploaded'
  );
end;
$$;

create or replace function private.clair_audit_soap_attachment_ready()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_membership_id uuid;
begin
  select m.id into v_membership_id from public.user_memberships m
  where m.workspace_id = new.workspace_id and m.user_id = new.actor_user_id
    and m.status = 'active' order by m.created_at limit 1;
  if v_membership_id is null then
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;
  insert into public.audit_events (
    id, workspace_id, actor_user_id, actor_membership_id,
    event_type, target_type, target_id, encounter_id,
    after_snapshot, metadata
  ) values (
    'chart-soap-attachment-' || extensions.gen_random_uuid()::text,
    new.workspace_id, new.actor_user_id, v_membership_id,
    'chart.soap_attachment_uploaded', 'soap_attachment', new.id::text, new.encounter_id,
    pg_catalog.jsonb_build_object('mimeType', new.mime_type, 'byteSize', new.byte_size),
    pg_catalog.jsonb_build_object('source', 'chart-soap-attachment-finalize')
  );
  return new;
end;
$$;

create trigger audit_soap_attachment_ready
after update of ready_at on public.chart_soap_attachments
for each row when (old.ready_at is null and new.ready_at is not null)
execute function private.clair_audit_soap_attachment_ready();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chart-soap-attachments', 'chart-soap-attachments', false, 20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy chart_soap_attachments_storage_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'chart-soap-attachments'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1 from public.chart_soap_attachments a
    where a.pending_path = storage.objects.name
      and a.actor_user_id = (select auth.uid())
      and a.ready_at is null
      and a.cancelled_at is null
  )
);

create policy chart_soap_attachments_storage_select on storage.objects
for select to authenticated using (
  bucket_id = 'chart-soap-attachments'
  and exists (
    select 1 from public.chart_soap_attachments a
    where (
      (a.pending_path = storage.objects.name and a.ready_at is null
        and a.cancelled_at is null
        and a.actor_user_id = (select auth.uid()))
      or (a.storage_path = storage.objects.name and a.ready_at is not null
        and a.cancelled_at is null)
    )
  )
);

create policy chart_soap_attachments_storage_delete_pending on storage.objects
for delete to authenticated using (
  bucket_id = 'chart-soap-attachments'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1 from public.chart_soap_attachments a
    where a.pending_path = storage.objects.name
      and a.actor_user_id = (select auth.uid())
      and a.ready_at is null
      and a.cancelled_at is null
  )
);

-- Preserve the established V1/V2 validator by normalizing validated media
-- leaves to divider leaves before invoking its original traversal.
alter function private.clair_soap_v1_document_is_valid(jsonb)
  rename to clair_soap_v1_document_is_valid_without_media;

create or replace function private.clair_soap_media_block_is_valid(p_block jsonb)
returns boolean language sql immutable set search_path = '' as $$
select coalesce((pg_catalog.jsonb_typeof(p_block) = 'object'
  and p_block->>'type' in ('image', 'video')
  and pg_catalog.jsonb_typeof(p_block->'props') = 'object'
  and not exists (
    select 1 from pg_catalog.jsonb_object_keys(
      case when pg_catalog.jsonb_typeof(p_block->'props') = 'object'
        then p_block->'props' else '{}'::jsonb end
    ) key
    where key not in ('backgroundColor', 'textAlignment', 'name', 'url', 'caption', 'showPreview', 'previewWidth')
  )
  and pg_catalog.jsonb_typeof(p_block->'children') = 'array'
  and p_block->'children' = '[]'::jsonb
  and not (p_block ? 'content')
  and not exists (
    select 1 from pg_catalog.jsonb_object_keys(
      case when pg_catalog.jsonb_typeof(p_block) = 'object'
        then p_block else '{}'::jsonb end
    ) key
    where key not in ('id', 'type', 'props', 'children')
  )
  and p_block->'props'->>'url' ~
    '^/api/workspaces/[A-Za-z0-9_-]{1,100}/chart/soap-attachments/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\?encounterId=[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and pg_catalog.jsonb_typeof(p_block->'props'->'name') = 'string'
  and pg_catalog.char_length(p_block->'props'->>'name') <= 200
  and pg_catalog.jsonb_typeof(p_block->'props'->'caption') = 'string'
  and pg_catalog.char_length(p_block->'props'->>'caption') <= 1000
  and pg_catalog.jsonb_typeof(p_block->'props'->'backgroundColor') = 'string'
  and pg_catalog.char_length(p_block->'props'->>'backgroundColor') <= 50
  and p_block->'props'->>'textAlignment' in ('left', 'center', 'right', 'justify')
  and pg_catalog.jsonb_typeof(p_block->'props'->'showPreview') = 'boolean'
  and (
    not (p_block->'props' ? 'previewWidth')
    or (
      pg_catalog.jsonb_typeof(p_block->'props'->'previewWidth') = 'number'
      and p_block->'props'->>'previewWidth' ~ '^[1-9][0-9]{0,3}$'
      and (p_block->'props'->>'previewWidth')::integer <= 2000
    )
  )), false);
$$;

create or replace function private.clair_soap_table_text(p_block jsonb)
returns text language plpgsql immutable set search_path = '' as $$
declare
  v_content jsonb := p_block->'content';
  v_row jsonb;
  v_cell jsonb;
  v_width jsonb;
  v_columns integer;
  v_rows integer;
  v_cells text[];
  v_lines text[] := array[]::text[];
begin
  if pg_catalog.jsonb_typeof(p_block) is distinct from 'object'
    or p_block->>'type' is distinct from 'table'
    or pg_catalog.jsonb_typeof(p_block->'props') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_block->'props'->'textColor') is distinct from 'string'
    or pg_catalog.char_length(p_block->'props'->>'textColor') > 50
    or exists (select 1 from pg_catalog.jsonb_object_keys(p_block->'props') key where key <> 'textColor')
    or pg_catalog.jsonb_typeof(p_block->'children') is distinct from 'array'
    or p_block->'children' <> '[]'::jsonb
    or exists (select 1 from pg_catalog.jsonb_object_keys(p_block) key where key not in ('id','type','props','content','children'))
    or pg_catalog.jsonb_typeof(v_content) is distinct from 'object'
    or v_content->>'type' is distinct from 'tableContent'
    or exists (select 1 from pg_catalog.jsonb_object_keys(v_content) key where key not in ('type','rows','columnWidths','headerRows','headerCols'))
    or pg_catalog.jsonb_typeof(v_content->'rows') is distinct from 'array'
    or pg_catalog.jsonb_typeof(v_content->'columnWidths') is distinct from 'array'
  then return null; end if;
  v_rows := pg_catalog.jsonb_array_length(v_content->'rows');
  v_columns := pg_catalog.jsonb_array_length(v_content->'columnWidths');
  if v_rows not between 1 and 20 or v_columns not between 1 and 10
    or v_rows * v_columns > 100 then return null; end if;
  if (v_content ? 'headerRows' and (pg_catalog.jsonb_typeof(v_content->'headerRows') is distinct from 'number'
      or v_content->>'headerRows' !~ '^(0|[1-9][0-9]?)$'
      or (v_content->>'headerRows')::integer > v_rows))
    or (v_content ? 'headerCols' and (pg_catalog.jsonb_typeof(v_content->'headerCols') is distinct from 'number'
      or v_content->>'headerCols' !~ '^(0|[1-9][0-9]?)$'
      or (v_content->>'headerCols')::integer > v_columns)) then return null; end if;
  for v_width in select value from pg_catalog.jsonb_array_elements(v_content->'columnWidths') item(value) loop
    if v_width <> 'null'::jsonb and (pg_catalog.jsonb_typeof(v_width) is distinct from 'number'
      or v_width::text !~ '^[1-9][0-9]{1,3}$' or v_width::text::integer not between 40 and 2000)
    then return null; end if;
  end loop;
  for v_row in select value from pg_catalog.jsonb_array_elements(v_content->'rows') item(value) loop
    if pg_catalog.jsonb_typeof(v_row) is distinct from 'object'
      or exists (select 1 from pg_catalog.jsonb_object_keys(v_row) key where key <> 'cells')
      or pg_catalog.jsonb_typeof(v_row->'cells') is distinct from 'array'
      or pg_catalog.jsonb_array_length(v_row->'cells') <> v_columns then return null; end if;
    v_cells := array[]::text[];
    for v_cell in select value from pg_catalog.jsonb_array_elements(v_row->'cells') item(value) loop
      if pg_catalog.jsonb_typeof(v_cell) is distinct from 'object'
        or v_cell->>'type' is distinct from 'tableCell'
        or exists (select 1 from pg_catalog.jsonb_object_keys(v_cell) key where key not in ('type','content','props'))
        or pg_catalog.jsonb_typeof(v_cell->'props') is distinct from 'object'
        or exists (select 1 from pg_catalog.jsonb_object_keys(v_cell->'props') key
          where key not in ('backgroundColor','textColor','textAlignment','colspan','rowspan'))
        or pg_catalog.jsonb_typeof(v_cell->'props'->'backgroundColor') is distinct from 'string'
        or pg_catalog.char_length(v_cell->'props'->>'backgroundColor') > 50
        or pg_catalog.jsonb_typeof(v_cell->'props'->'textColor') is distinct from 'string'
        or pg_catalog.char_length(v_cell->'props'->>'textColor') > 50
        or coalesce(v_cell->'props'->>'textAlignment' in ('left','center','right','justify'), false) is distinct from true
        or pg_catalog.jsonb_typeof(v_cell->'props'->'colspan') is distinct from 'number'
        or v_cell->'props'->>'colspan' is distinct from '1'
        or pg_catalog.jsonb_typeof(v_cell->'props'->'rowspan') is distinct from 'number'
        or v_cell->'props'->>'rowspan' is distinct from '1'
        or private.clair_soap_inline_is_valid(v_cell->'content') is distinct from true
      then return null; end if;
      v_cells := pg_catalog.array_append(v_cells, private.clair_soap_inline_text(v_cell->'content'));
    end loop;
    v_lines := pg_catalog.array_append(v_lines, pg_catalog.array_to_string(v_cells, E'\t'));
  end loop;
  return pg_catalog.array_to_string(v_lines, E'\n');
end;
$$;

create or replace function private.clair_soap_normalize_media_blocks(p_blocks jsonb, p_depth integer default 0)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  v_block jsonb;
  v_table_text text;
  v_result jsonb := '[]'::jsonb;
begin
  if p_blocks = '[]'::jsonb then return p_blocks; end if;
  if p_depth > 4 then return null; end if;
  if pg_catalog.jsonb_typeof(p_blocks) is distinct from 'array' then return p_blocks; end if;
  for v_block in select value from pg_catalog.jsonb_array_elements(p_blocks) item(value) loop
    if v_block->>'type' = 'table' then
      v_table_text := private.clair_soap_table_text(v_block);
      if v_table_text is null then return null; end if;
      v_result := v_result || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'id', v_block->'id', 'type', 'paragraph',
        'props', pg_catalog.jsonb_build_object('backgroundColor', 'default', 'textColor', 'default', 'textAlignment', 'left'),
        'content', pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'type', 'text', 'text', v_table_text, 'styles', '{}'::jsonb)),
        'children', '[]'::jsonb
      ));
    elsif v_block->>'type' in ('image', 'video') then
      if private.clair_soap_media_block_is_valid(v_block) is distinct from true then return null; end if;
      v_result := v_result || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'id', v_block->'id', 'type', 'divider', 'props', '{}'::jsonb, 'children', '[]'::jsonb
      ));
    elsif pg_catalog.jsonb_typeof(v_block) = 'object'
      and pg_catalog.jsonb_typeof(v_block->'children') = 'array' then
      v_block := pg_catalog.jsonb_set(v_block, '{children}',
        private.clair_soap_normalize_media_blocks(v_block->'children', p_depth + 1));
      if v_block is null then return null; end if;
      v_result := v_result || pg_catalog.jsonb_build_array(v_block);
    else
      v_result := v_result || pg_catalog.jsonb_build_array(v_block);
    end if;
  end loop;
  return v_result;
end;
$$;

create or replace function private.clair_soap_v1_document_is_valid(p_document jsonb)
returns boolean language sql immutable set search_path = '' as $$
select pg_catalog.octet_length(p_document::text) <= 262144
  and coalesce(private.clair_soap_v1_document_is_valid_without_media(
  pg_catalog.jsonb_set(
    p_document, '{blocks}',
    private.clair_soap_normalize_media_blocks(p_document->'blocks')
  )
), false);
$$;

-- The existing projection traverser must also skip media leaves while keeping
-- all text, list, link, depth, and field-length behavior unchanged.
alter function private.clair_soap_blocks_text(jsonb, integer)
  rename to clair_soap_blocks_text_without_media;

create or replace function private.clair_soap_blocks_text(p_blocks jsonb, p_depth integer default 0)
returns text language plpgsql immutable set search_path = '' as $$
declare
  v_normalized jsonb;
begin
  v_normalized := private.clair_soap_normalize_media_blocks(p_blocks, p_depth);
  if v_normalized is null then raise exception 'invalid_soap_document'; end if;
  return private.clair_soap_blocks_text_without_media(v_normalized, p_depth);
end;
$$;

create or replace function private.clair_guard_soap_attachment_references()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_block jsonb;
  v_url text;
  v_attachment_id uuid;
  v_prefix text;
  v_suffix text;
begin
  if new.block_document is null then return new; end if;
  for v_block in
    with recursive blocks(block) as (
      select item.value
      from pg_catalog.jsonb_array_elements(
        case when new.block_document_schema_version = 2 then
          (select pg_catalog.jsonb_agg(item.value) from pg_catalog.jsonb_array_elements(new.block_document) scope(value)
            cross join lateral pg_catalog.jsonb_array_elements(scope.value->'blocks') item(value))
        else new.block_document end
      ) item(value)
      union all
      select child.value from blocks parent
      cross join lateral pg_catalog.jsonb_array_elements(
        case when pg_catalog.jsonb_typeof(parent.block->'children') = 'array'
          then parent.block->'children' else '[]'::jsonb end
      ) child(value)
    ) select block from blocks
  loop
    if v_block->>'type' not in ('image', 'video') then continue; end if;
    if private.clair_soap_media_block_is_valid(v_block) is distinct from true then
      raise exception 'invalid_soap_attachment_reference' using errcode = '23514';
    end if;
    v_url := v_block->'props'->>'url';
    v_prefix := '/api/workspaces/' || new.workspace_id || '/chart/soap-attachments/';
    v_suffix := '?encounterId=' || new.encounter_id::text;
    if pg_catalog.left(v_url, pg_catalog.length(v_prefix)) <> v_prefix
      or pg_catalog.right(v_url, pg_catalog.length(v_suffix)) <> v_suffix then
      raise exception 'invalid_soap_attachment_reference' using errcode = '23514';
    end if;
    v_attachment_id := pg_catalog.substr(v_url, pg_catalog.length(v_prefix) + 1, 36)::uuid;
    if not exists (
      select 1 from public.chart_soap_attachments a
      join storage.objects object on object.bucket_id = 'chart-soap-attachments'
        and object.name = a.storage_path
      where a.id = v_attachment_id
        and a.workspace_id = new.workspace_id
        and a.encounter_id = new.encounter_id
        and a.ready_at is not null
        and a.cancelled_at is null
        and ((v_block->>'type' = 'image' and a.mime_type like 'image/%')
          or (v_block->>'type' = 'video' and a.mime_type like 'video/%'))
    ) then
      raise exception 'invalid_soap_attachment_reference' using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;

create trigger guard_soap_attachment_references
before insert or update of block_document on public.soap_notes
for each row execute function private.clair_guard_soap_attachment_references();

revoke all on function private.clair_guard_soap_attachment_update() from public, anon, authenticated;
revoke all on function private.clair_audit_soap_attachment_ready() from public, anon, authenticated;
revoke all on function private.clair_soap_media_block_is_valid(jsonb) from public, anon, authenticated;
revoke all on function private.clair_soap_table_text(jsonb) from public, anon, authenticated;
revoke all on function private.clair_soap_normalize_media_blocks(jsonb, integer) from public, anon, authenticated;
revoke all on function private.clair_soap_v1_document_is_valid_without_media(jsonb) from public, anon, authenticated;
revoke all on function private.clair_soap_v1_document_is_valid(jsonb) from public, anon, authenticated;
revoke all on function private.clair_soap_blocks_text_without_media(jsonb, integer) from public, anon, authenticated;
revoke all on function private.clair_soap_blocks_text(jsonb, integer) from public, anon, authenticated;
revoke all on function private.clair_guard_soap_attachment_references() from public, anon, authenticated;

revoke all on public.chart_soap_attachments from public, anon, authenticated, service_role;
grant select, insert on public.chart_soap_attachments to authenticated;
grant select, insert, update, delete on public.chart_soap_attachments to service_role;

-- An older editor may understand schemaVersion 1/2 while omitting media/table
-- blocks during hydration. Protect the persisted target at the DB mutation
-- boundary, including direct calls to legacy chart-save RPCs.
create or replace function private.clair_soap_has_rich_blocks(p_blocks jsonb, p_schema_version smallint)
returns boolean language sql immutable set search_path = '' as $$
  with recursive blocks(block) as (
    select item.value from pg_catalog.jsonb_array_elements(
      case when p_schema_version = 2 then coalesce((
        select pg_catalog.jsonb_agg(item.value)
        from pg_catalog.jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) scope(value)
        cross join lateral pg_catalog.jsonb_array_elements(scope.value->'blocks') item(value)
      ), '[]'::jsonb) else coalesce(p_blocks, '[]'::jsonb) end
    ) item(value)
    union all
    select child.value from blocks parent
    cross join lateral pg_catalog.jsonb_array_elements(
      case when pg_catalog.jsonb_typeof(parent.block->'children') = 'array'
        then parent.block->'children' else '[]'::jsonb end
    ) child(value)
  )
  select exists(select 1 from blocks where block->>'type' in ('image','video','table'));
$$;

create or replace function private.clair_guard_soap_editor_capability()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (
    (tg_op = 'UPDATE' and private.clair_soap_has_rich_blocks(old.block_document, old.block_document_schema_version))
    or private.clair_soap_has_rich_blocks(new.block_document, new.block_document_schema_version)
  ) and pg_catalog.current_setting('clair.soap_editor_capability', true) is distinct from 'media_table_v1' then
    raise exception 'soap_editor_upgrade_required' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger guard_soap_editor_capability
before insert or update of block_document on public.soap_notes
for each row execute function private.clair_guard_soap_editor_capability();

-- Keep v3/v4 signatures and their established permission, status, conflict,
-- amendment, revision, and transactional audit implementations. Only the
-- exact marker explicitly sent by the new editor activates this save.
create or replace function public.clair_save_chart_soap_note_v3(
  p_workspace_id text, p_actor_user_id text, p_encounter_id uuid, p_note jsonb,
  p_expected_updated_at timestamptz default null, p_mode text default 'autosave', p_request_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_prior text := pg_catalog.current_setting('clair.soap_editor_capability', true);
  v_result jsonb;
begin
  perform pg_catalog.set_config('clair.soap_editor_capability',
    case when p_note->>'editorCapability' = 'media_table_v1' then 'media_table_v1' else '' end, true);
  begin
    perform private.clair_require_legacy_single_chart(p_workspace_id, p_actor_user_id, p_encounter_id);
    v_result := public.clair_save_chart_soap_note_v3_single_chart_base(
      p_workspace_id, p_actor_user_id, p_encounter_id, p_note, p_expected_updated_at, p_mode, p_request_id);
  exception when others then
    perform pg_catalog.set_config('clair.soap_editor_capability', coalesce(v_prior, ''), true);
    raise;
  end;
  perform pg_catalog.set_config('clair.soap_editor_capability', coalesce(v_prior, ''), true);
  return v_result;
end;
$$;

alter function public.clair_save_chart_soap_note_v4(text,text,uuid,uuid,jsonb,timestamptz,text,text,text)
  rename to clair_save_chart_soap_note_v4_capability_base;
revoke all on function public.clair_save_chart_soap_note_v4_capability_base(text,text,uuid,uuid,jsonb,timestamptz,text,text,text)
  from public, anon, authenticated, service_role;

create function public.clair_save_chart_soap_note_v4(
  p_workspace_id text, p_actor_user_id text, p_encounter_id uuid, p_chart_id uuid, p_note jsonb,
  p_expected_updated_at timestamptz default null, p_mode text default 'autosave',
  p_request_id text default null, p_amendment_reason text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_prior text := pg_catalog.current_setting('clair.soap_editor_capability', true);
  v_result jsonb;
begin
  perform pg_catalog.set_config('clair.soap_editor_capability',
    case when p_note->>'editorCapability' = 'media_table_v1' then 'media_table_v1' else '' end, true);
  begin
    v_result := public.clair_save_chart_soap_note_v4_capability_base(
      p_workspace_id, p_actor_user_id, p_encounter_id, p_chart_id, p_note,
      p_expected_updated_at, p_mode, p_request_id, p_amendment_reason);
  exception when others then
    perform pg_catalog.set_config('clair.soap_editor_capability', coalesce(v_prior, ''), true);
    raise;
  end;
  perform pg_catalog.set_config('clair.soap_editor_capability', coalesce(v_prior, ''), true);
  return v_result;
end;
$$;

revoke all on function private.clair_soap_has_rich_blocks(jsonb,smallint) from public,anon,authenticated,service_role;
revoke all on function private.clair_guard_soap_editor_capability() from public,anon,authenticated,service_role;
revoke all on function public.clair_save_chart_soap_note_v3(text,text,uuid,jsonb,timestamptz,text,text) from public,anon;
grant execute on function public.clair_save_chart_soap_note_v3(text,text,uuid,jsonb,timestamptz,text,text) to authenticated;
revoke all on function public.clair_save_chart_soap_note_v4(text,text,uuid,uuid,jsonb,timestamptz,text,text,text) from public,anon;
grant execute on function public.clair_save_chart_soap_note_v4(text,text,uuid,uuid,jsonb,timestamptz,text,text,text) to authenticated;
