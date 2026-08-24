-- Clinical master release-scoped workspace adoption.
--
-- Existing releases retain the historical cumulative adopter behavior.  New
-- payload releases may opt into the exact included order-owner set staged by
-- the publisher.  This migration is additive: the public/private RPC
-- signatures, lock order, security-definer boundaries, and wrapper contracts
-- remain unchanged.

alter table master.master_releases
  add column if not exists adoption_scope text not null default 'cumulative';

-- The immutable-release trigger intentionally rejects row UPDATEs.  A
-- pre-existing nullable/incorrect column is therefore a migration mismatch,
-- not something this additive migration may repair in place.
do $$
declare
  v_not_null boolean;
  v_default text;
begin
  select attribute.attnotnull
    into v_not_null
  from pg_catalog.pg_attribute attribute
  where attribute.attrelid = 'master.master_releases'::pg_catalog.regclass
    and attribute.attname = 'adoption_scope'
    and not attribute.attisdropped;
  select pg_catalog.pg_get_expr(definition.adbin, definition.adrelid)
    into v_default
  from pg_catalog.pg_attrdef definition
  where definition.adrelid = 'master.master_releases'::pg_catalog.regclass
    and definition.adnum = (
      select attribute.attnum
      from pg_catalog.pg_attribute attribute
      where attribute.attrelid = 'master.master_releases'::pg_catalog.regclass
        and attribute.attname = 'adoption_scope'
        and not attribute.attisdropped
    );
  if v_not_null is distinct from true
     or v_default is null
     or pg_catalog.btrim(v_default) not in ('''cumulative''::text', '''cumulative''::character varying') then
    raise exception 'clinical_master_release_adoption_scope_column_state_invalid'
      using errcode = '55000', detail = coalesce(v_default, '<missing>');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'master.master_releases'::regclass
      and conname = 'master_releases_adoption_scope_check'
  ) then
    alter table master.master_releases
      add constraint master_releases_adoption_scope_check
      check (adoption_scope in ('cumulative', 'payload'));
  end if;
end
$$;

-- The compatibility and specialized stage tables are publisher evidence, but
-- they remain operational tables that an internal repair could accidentally
-- edit.  Persist the exact payload-derived owner/snapshot manifest once at
-- publish time; payload adoption binds both stage views back to this
-- append-only source before any workspace/catalog DML.
create table if not exists private.clinical_master_release_payload_owner_manifest (
  release_id uuid not null references master.master_releases(id) on delete restrict,
  master_record_id uuid not null references master.master_records(id) on delete restrict,
  master_key text not null,
  record_type text not null,
  included boolean not null,
  base_content jsonb not null,
  relation_content jsonb not null,
  effective_revision integer not null check (effective_revision > 0),
  content_sha256 text not null,
  created_at timestamptz not null default now(),
  primary key (release_id, master_record_id),
  unique (release_id, master_key)
);
revoke all on private.clinical_master_release_payload_owner_manifest
  from public, anon, authenticated, service_role;

create or replace function private.clinical_master_payload_manifest_content_sha256(
  p_master_record_id uuid,
  p_master_key text,
  p_record_type text,
  p_included boolean,
  p_effective_revision integer,
  p_base_content jsonb,
  p_relation_content jsonb
)
returns text
language sql
immutable
set search_path = ''
as $$
select private.clinical_master_sha256(pg_catalog.jsonb_build_object(
  'masterRecordId', p_master_record_id,
  'masterKey', p_master_key,
  'recordType', p_record_type,
  'included', p_included,
  'effectiveRevision', p_effective_revision,
  'baseContent', p_base_content,
  'relationContent', p_relation_content
))
$$;
revoke all on function private.clinical_master_payload_manifest_content_sha256(
  uuid, text, text, boolean, integer, jsonb, jsonb
) from public, anon, authenticated, service_role;

create or replace function private.clinical_master_release_payload_owner_manifest_immutable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'clinical_master_release_payload_owner_manifest_immutable'
      using errcode = '55000';
  end if;
  if pg_catalog.current_setting('clinical_master.manifest_write_release_id', true)
     is distinct from new.release_id::text then
    raise exception 'clinical_master_release_payload_owner_manifest_immutable'
      using errcode = '55000';
  end if;
  return new;
end
$$;
revoke all on function private.clinical_master_release_payload_owner_manifest_immutable()
  from public, anon, authenticated, service_role;
drop trigger if exists clinical_master_release_payload_owner_manifest_immutable
  on private.clinical_master_release_payload_owner_manifest;
create trigger clinical_master_release_payload_owner_manifest_immutable
before insert or update or delete on private.clinical_master_release_payload_owner_manifest
for each row execute function private.clinical_master_release_payload_owner_manifest_immutable();

create or replace function private.clinical_master_assert_contract_keys(
  p_contract text,
  p_value jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_key text;
  v_allowed text[];
  v_scope text;
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value) <> 'object' then
    raise exception 'clinical_master_contract_object_required'
      using errcode = '22023', detail = p_contract;
  end if;
  v_allowed := case p_contract
    when 'payload' then array['releaseKey','releaseNotes','publishedByLabel','adoptionScope','records','classificationPaths','labPanelItems','labOrderProfiles']
    when 'record' then array['masterKey','recordType','lifecycleStatus','safetyStatus','safetyReason','names','source','detail']
    when 'name' then array['languageCode','nameKind','name','searchable','sortOrder']
    when 'source' then array['sourceType','title','referenceUri','sourceVersion','accessedAt','licenseNotes']
    else array[]::text[]
  end;
  for v_key in select key from pg_catalog.jsonb_object_keys(p_value) as keys(key) loop
    if not (v_key = any(v_allowed)) then
      raise exception 'clinical_master_unknown_contract_field'
        using errcode = '22023', detail = p_contract || ':' || v_key;
    end if;
  end loop;
  if p_contract = 'payload' then
    v_scope := coalesce(nullif(pg_catalog.btrim(p_value->>'adoptionScope'), ''), 'cumulative');
    if v_scope not in ('cumulative', 'payload') then
      raise exception 'clinical_master_adoption_scope_invalid'
        using errcode = '22023', detail = v_scope;
    end if;
  end if;
end
$$;

revoke all on function private.clinical_master_assert_contract_keys(text, jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.clinical_master_canonicalize_payload(p_payload jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
with normalized_records as (
  select pg_catalog.jsonb_build_object(
    'masterKey', pg_catalog.btrim(value->>'masterKey'),
    'recordType', pg_catalog.btrim(value->>'recordType'),
    'lifecycleStatus', coalesce(pg_catalog.btrim(value->>'lifecycleStatus'), 'published'),
    'safetyStatus', coalesce(pg_catalog.btrim(value->>'safetyStatus'), 'normal'),
    'safetyReason', nullif(pg_catalog.btrim(value->>'safetyReason'), ''),
    'names', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('languageCode',pg_catalog.btrim(name->>'languageCode'),'nameKind',pg_catalog.btrim(name->>'nameKind'),'name',pg_catalog.btrim(name->>'name'),'searchable',coalesce((name->>'searchable')::boolean,true),'sortOrder',coalesce((name->>'sortOrder')::integer,0)) order by pg_catalog.btrim(name->>'languageCode'),pg_catalog.btrim(name->>'nameKind'),pg_catalog.lower(pg_catalog.btrim(name->>'name')),coalesce((name->>'sortOrder')::integer,0)) from pg_catalog.jsonb_array_elements(coalesce(value->'names','[]'::jsonb)) names(name)), '[]'::jsonb),
    'source', pg_catalog.jsonb_build_object('sourceType',pg_catalog.btrim(value->'source'->>'sourceType'),'title',pg_catalog.btrim(value->'source'->>'title'),'referenceUri',nullif(pg_catalog.btrim(value->'source'->>'referenceUri'),''),'sourceVersion',nullif(pg_catalog.btrim(value->'source'->>'sourceVersion'),''),'accessedAt',nullif(pg_catalog.btrim(value->'source'->>'accessedAt'),''),'licenseNotes',nullif(pg_catalog.btrim(value->'source'->>'licenseNotes'),'')),
    'detail', private.clinical_master_canonicalize_detail(value->>'recordType', value->'detail')
  ) as value
  from pg_catalog.jsonb_array_elements(coalesce(p_payload->'records','[]'::jsonb)) records(value)
), normalized_panel_items as (
  select pg_catalog.jsonb_build_object('panelMasterKey',pg_catalog.btrim(value->>'panelMasterKey'),'testMasterKey',pg_catalog.btrim(value->>'testMasterKey'),'sortOrder',(value->>'sortOrder')::integer,'required',coalesce((value->>'required')::boolean,true),'displayGroup',nullif(pg_catalog.btrim(value->>'displayGroup'),'')) as value
  from pg_catalog.jsonb_array_elements(coalesce(p_payload->'labPanelItems','[]'::jsonb)) items(value)
), normalized_profiles as (
  select pg_catalog.jsonb_build_object('orderMasterKey',pg_catalog.btrim(value->>'orderMasterKey'),'labTestMasterKey',nullif(pg_catalog.btrim(value->>'labTestMasterKey'),''),'labPanelMasterKey',nullif(pg_catalog.btrim(value->>'labPanelMasterKey'),''),'specimenMasterKey',nullif(pg_catalog.btrim(value->>'specimenMasterKey'),'')) as value
  from pg_catalog.jsonb_array_elements(coalesce(p_payload->'labOrderProfiles','[]'::jsonb)) profiles(value)
), normalized_paths as (
  select pg_catalog.jsonb_build_object('pathKey',pg_catalog.btrim(value->>'pathKey'),'clinicalActionKey',pg_catalog.btrim(value->>'clinicalActionKey'),'chartGroupKey',pg_catalog.btrim(value->>'chartGroupKey'),'taskRouteKey',pg_catalog.btrim(value->>'taskRouteKey')) as value
  from pg_catalog.jsonb_array_elements(coalesce(p_payload->'classificationPaths','[]'::jsonb)) paths(value)
), normalized_scope as (
  select coalesce(nullif(pg_catalog.btrim(p_payload->>'adoptionScope'),''),'cumulative') as value
)
select (case when p_payload ? 'labPanelItems' or p_payload ? 'labOrderProfiles' then pg_catalog.jsonb_build_object(
  'releaseKey',nullif(pg_catalog.btrim(p_payload->>'releaseKey'),''),
  'releaseNotes',nullif(pg_catalog.btrim(p_payload->>'releaseNotes'),''),
  'publishedByLabel',pg_catalog.btrim(p_payload->>'publishedByLabel'),
  'records',coalesce((select pg_catalog.jsonb_agg(value order by value->>'masterKey') from normalized_records),'[]'::jsonb),
  'classificationPaths',coalesce((select pg_catalog.jsonb_agg(value order by value->>'pathKey') from normalized_paths),'[]'::jsonb),
  'labPanelItems',coalesce((select pg_catalog.jsonb_agg(value order by value->>'panelMasterKey', (value->>'sortOrder')::integer, value->>'testMasterKey') from normalized_panel_items),'[]'::jsonb),
  'labOrderProfiles',coalesce((select pg_catalog.jsonb_agg(value order by value->>'orderMasterKey') from normalized_profiles),'[]'::jsonb)
  ) else pg_catalog.jsonb_build_object(
    'releaseKey',nullif(pg_catalog.btrim(p_payload->>'releaseKey'),''),
    'releaseNotes',nullif(pg_catalog.btrim(p_payload->>'releaseNotes'),''),
    'publishedByLabel',pg_catalog.btrim(p_payload->>'publishedByLabel'),
    'records',coalesce((select pg_catalog.jsonb_agg(value order by value->>'masterKey') from normalized_records),'[]'::jsonb),
    'classificationPaths',coalesce((select pg_catalog.jsonb_agg(value order by value->>'pathKey') from normalized_paths),'[]'::jsonb)
  ) end)
  || case when p_payload ? 'adoptionScope'
    then pg_catalog.jsonb_build_object('adoptionScope',(select value from normalized_scope))
    else '{}'::jsonb
  end
$$;

revoke all on function private.clinical_master_canonicalize_payload(jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.clinical_master_set_release_adoption_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_scope text;
begin
  v_scope := coalesce(
    nullif(pg_catalog.btrim(pg_catalog.current_setting('clinical_master.adoption_scope', true)), ''),
    nullif(pg_catalog.btrim(new.adoption_scope), ''),
    'cumulative'
  );
  if v_scope not in ('cumulative', 'payload') then
    raise exception 'clinical_master_adoption_scope_invalid'
      using errcode = '22023', detail = v_scope;
  end if;
  new.adoption_scope := v_scope;
  return new;
end
$$;

revoke all on function private.clinical_master_set_release_adoption_scope()
  from public, anon, authenticated, service_role;

drop trigger if exists master_releases_set_adoption_scope on master.master_releases;
create trigger master_releases_set_adoption_scope
before insert on master.master_releases
for each row execute function private.clinical_master_set_release_adoption_scope();

-- Keep the already-reviewed publisher body as the cumulative implementation;
-- the wrapper below supplies the explicit scope and lets the existing body
-- retain its canonical fingerprint/idempotency behavior.
alter function private.publish_clinical_master_release(jsonb, uuid)
  rename to publish_clinical_master_release_cumulative;

revoke all on function private.publish_clinical_master_release_cumulative(jsonb, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.publish_clinical_master_release(
  p_payload jsonb,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, master, extensions, pg_catalog
as $$
declare
  v_payload jsonb;
  v_scope text;
  v_result jsonb;
  v_release_scope text;
begin
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'clinical_master_payload_object_required' using errcode = '22023';
  end if;
  perform private.clinical_master_assert_contract_keys('payload', p_payload);
  v_payload := private.clinical_master_canonicalize_payload(p_payload);
  v_scope := coalesce(nullif(pg_catalog.btrim(v_payload->>'adoptionScope'), ''), 'cumulative');
  perform pg_catalog.set_config('clinical_master.adoption_scope', v_scope, true);
  begin
    v_result := private.publish_clinical_master_release_cumulative(v_payload, p_actor_user_id);
  exception when others then
    perform pg_catalog.set_config('clinical_master.adoption_scope', '', true);
    raise;
  end;
  perform pg_catalog.set_config('clinical_master.adoption_scope', '', true);
  select adoption_scope into v_release_scope
  from master.master_releases
  where id = (v_result->>'releaseId')::uuid;
  if v_release_scope is distinct from v_scope then
    raise exception 'clinical_master_release_adoption_scope_persist_failed'
      using errcode = '55000';
  end if;
  if v_scope = 'payload' then
    perform pg_catalog.set_config(
      'clinical_master.manifest_write_release_id',
      v_result->>'releaseId',
      true
    );
    begin
      insert into private.clinical_master_release_payload_owner_manifest(
        release_id, master_record_id, master_key, record_type, included,
        base_content, relation_content, effective_revision, content_sha256
      )
      select stage.release_id, stage.master_record_id, stage.master_key,
        stage.record_type, stage.included, stage.base_content,
        stage.relation_content, stage.effective_revision,
        private.clinical_master_payload_manifest_content_sha256(
          stage.master_record_id, stage.master_key, stage.record_type,
          stage.included, stage.effective_revision,
          stage.base_content, stage.relation_content
        )
      from private.clinical_master_lab_publish_stage stage
      where stage.release_id = (v_result->>'releaseId')::uuid
      on conflict (release_id, master_record_id) do nothing;
    exception when others then
      perform pg_catalog.set_config('clinical_master.manifest_write_release_id', '', true);
      raise;
    end;
    perform pg_catalog.set_config('clinical_master.manifest_write_release_id', '', true);
    if (select count(*) from private.clinical_master_release_payload_owner_manifest manifest
        where manifest.release_id = (v_result->>'releaseId')::uuid)
       is distinct from (select record_count from master.master_releases
        where id = (v_result->>'releaseId')::uuid)
       or exists (
         select 1
         from private.clinical_master_lab_publish_stage stage
         left join private.clinical_master_release_payload_owner_manifest manifest
           on manifest.release_id = stage.release_id
          and manifest.master_record_id = stage.master_record_id
         where stage.release_id = (v_result->>'releaseId')::uuid
           and (
             manifest.master_record_id is null
             or manifest.master_key is distinct from stage.master_key
             or manifest.record_type is distinct from stage.record_type
             or manifest.included is distinct from stage.included
             or manifest.base_content is distinct from stage.base_content
             or manifest.relation_content is distinct from stage.relation_content
             or manifest.effective_revision is distinct from stage.effective_revision
             or manifest.content_sha256 is distinct from
               private.clinical_master_payload_manifest_content_sha256(
                 stage.master_record_id, stage.master_key, stage.record_type,
                 stage.included, stage.effective_revision,
                 stage.base_content, stage.relation_content
               )
           )
       ) then
      raise exception 'clinical_master_release_payload_owner_manifest_invalid'
        using errcode = '23503';
    end if;
  end if;
  return v_result || pg_catalog.jsonb_build_object('adoptionScope', v_scope);
end
$$;

revoke all on function private.publish_clinical_master_release(jsonb, uuid)
  from public, anon, authenticated, service_role;

-- Preserve the exact cumulative A2 implementation for existing releases.
alter function private.clair_adopt_master_release_to_workspace_a2_base(text, uuid)
  rename to clair_adopt_master_release_to_workspace_a2_cumulative;

revoke all on function private.clair_adopt_master_release_to_workspace_a2_cumulative(text, uuid)
  from public, anon, authenticated, service_role;

-- Payload-scoped adoption visits every included order owner staged for the
-- release. Existing nonpayload workspace rows are intentionally handled by
-- the separate lab helper's pinned-profile traversal. The stage is the
-- durable owner manifest: unchanged owners have an effective_revision even
-- when no master_record_versions row is tagged with this release.
create or replace function private.clair_adopt_master_release_to_workspace_payload(
  p_workspace_id text,
  p_release_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, master, extensions, pg_temp
as $$
declare
  v_release master.master_releases%rowtype;
  v_source record;
  v_item public.order_catalog_items%rowtype;
  v_path master.classification_paths%rowtype;
  v_action master.clinical_actions%rowtype;
  v_chart master.chart_groups%rowtype;
  v_route master.task_routes%rowtype;
  v_projection jsonb;
  v_fingerprint text;
  v_normalized_sales_unit text;
  v_existing_update public.workspace_master_updates%rowtype;
  v_update_id uuid;
  v_standard_name text;
  v_aliases text[];
  v_species text[];
  v_source_revision integer;
  v_stage_revision integer;
  v_payload_owner_count integer := 0;
  v_payload_owner_traversed integer := 0;
  v_stage_record_count integer := 0;
  v_general_order_stage_count integer := 0;
  v_specialized_order_stage_count integer := 0;
  v_manifest_record_count integer := 0;
  v_manifest_order_count integer := 0;
  v_stage_owner_found boolean;
  v_unmodified boolean;
  v_requires_review boolean;
  v_item_found boolean;
  v_created integer := 0;
  v_auto_applied integer := 0;
  v_reviews integer := 0;
  v_notifications integer := 0;
  v_update_type text;
  v_status text;
  v_merge_status text;
begin
  if p_workspace_id is null or length(pg_catalog.btrim(p_workspace_id)) = 0 then
    raise exception 'workspace_id_required' using errcode = '22023';
  end if;

  -- Keep the approved lock order: publication first, then workspace.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('clinical_master_phase_1a1_publication', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('clinical_master_workspace_adoption:' || p_workspace_id, 0)
  );

  select * into v_release
  from master.master_releases
  where id = p_release_id
  for update;
  if not found or v_release.status <> 'published' then
    raise exception 'clinical_master_release_not_published' using errcode = '22023';
  end if;
  if v_release.adoption_scope is distinct from 'payload' then
    raise exception 'clinical_master_payload_adoption_scope_required' using errcode = '22023';
  end if;
  if exists (
    select 1 from master.master_releases newer
    where newer.status = 'published' and newer.release_no > v_release.release_no
  ) then
    raise exception 'clinical_master_release_not_latest' using errcode = '40001';
  end if;

  -- The included order-owner set must be non-empty and every staged identity
  -- must resolve to its exact current order and immutable effective version.
  select count(*) into v_payload_owner_count
  from private.clinical_master_lab_publish_stage stage
  where stage.release_id = p_release_id
    and stage.included
    and stage.record_type = 'order';
  if v_payload_owner_count <= 0 then
    raise exception 'clinical_master_payload_adoption_owner_count_invalid'
      using errcode = '23503';
  end if;
  if exists (
    select 1
    from private.clinical_master_lab_publish_stage stage
    left join master.master_records owner on owner.id = stage.master_record_id
    where stage.release_id = p_release_id
      and stage.included
      and stage.record_type = 'order'
      and (
        owner.id is null
        or owner.master_key is distinct from stage.master_key
        or owner.record_type is distinct from stage.record_type
        or owner.current_revision is distinct from stage.effective_revision
        or not exists (
          select 1
          from master.master_record_versions version
          where version.master_record_id = stage.master_record_id
            and version.revision = stage.effective_revision
        )
      )
  ) then
    raise exception 'clinical_master_payload_adoption_owner_identity_invalid'
      using errcode = '23503';
  end if;
  select count(*) into v_payload_owner_count
  from private.clinical_master_lab_publish_stage stage
  join master.master_records owner
    on owner.id = stage.master_record_id
   and owner.master_key = stage.master_key
   and owner.record_type = stage.record_type
   and owner.current_revision = stage.effective_revision
  join master.master_record_versions version
    on version.master_record_id = stage.master_record_id
   and version.revision = stage.effective_revision
  where stage.release_id = p_release_id
    and stage.included
    and stage.record_type = 'order';
  if v_payload_owner_count <= 0 then
    raise exception 'clinical_master_payload_adoption_owner_count_invalid'
      using errcode = '23503';
  end if;

  -- Bind the included order-owner set to the publisher's immutable record
  -- count and require exact bidirectional parity between the compatibility
  -- stage and the specialized order stage before any workspace/catalog DML.
  -- The snapshot and effective revision are compared in both directions so
  -- an omitted, duplicated, retargeted, or independently tampered stage
  -- fails closed with zero adopter mutation.
  select count(*)
    into v_stage_record_count
  from private.clinical_master_lab_publish_stage stage
  where stage.release_id = p_release_id;
  select count(*)
    into v_general_order_stage_count
  from private.clinical_master_lab_publish_stage stage
  where stage.release_id = p_release_id
    and stage.included
    and stage.record_type = 'order';
  select count(*)
    into v_specialized_order_stage_count
  from private.clinical_master_lab_order_publish_stage stage
  where stage.release_id = p_release_id
    and stage.included;
  select count(*), count(*) filter (where manifest.included and manifest.record_type = 'order')
    into v_manifest_record_count, v_manifest_order_count
  from private.clinical_master_release_payload_owner_manifest manifest
  where manifest.release_id = p_release_id;
  if v_stage_record_count is distinct from v_release.record_count
     or v_manifest_record_count is distinct from v_release.record_count
     or v_general_order_stage_count <= 0
     or v_manifest_order_count is distinct from v_general_order_stage_count
     or v_general_order_stage_count is distinct from v_specialized_order_stage_count then
    raise exception 'clinical_master_payload_adoption_stage_parity_invalid'
      using errcode = '23503',
        detail = format('record_count=%s:%s general_order=%s specialized_order=%s',
          v_stage_record_count, v_release.record_count,
          v_general_order_stage_count, v_specialized_order_stage_count);
  end if;
  if exists (
    select 1
    from private.clinical_master_release_payload_owner_manifest manifest
    left join private.clinical_master_lab_publish_stage general_stage
      on general_stage.release_id = manifest.release_id
     and general_stage.master_record_id = manifest.master_record_id
    left join master.master_record_versions version
      on version.master_record_id = manifest.master_record_id
     and version.revision = manifest.effective_revision
    where manifest.release_id = p_release_id
      and (
        general_stage.master_record_id is null
        or general_stage.master_key is distinct from manifest.master_key
        or general_stage.record_type is distinct from manifest.record_type
        or general_stage.included is distinct from manifest.included
        or general_stage.base_content is distinct from manifest.base_content
        or general_stage.relation_content is distinct from manifest.relation_content
        or general_stage.effective_revision is distinct from manifest.effective_revision
        or manifest.content_sha256 is distinct from
          private.clinical_master_payload_manifest_content_sha256(
            manifest.master_record_id, manifest.master_key, manifest.record_type,
            manifest.included, manifest.effective_revision,
            manifest.base_content, manifest.relation_content
          )
        or version.snapshot is null
        or (version.snapshot - 'revision') is distinct from
          (manifest.base_content || manifest.relation_content)
      )
  ) or exists (
    select 1
    from private.clinical_master_lab_publish_stage general_stage
    left join private.clinical_master_release_payload_owner_manifest manifest
      on manifest.release_id = general_stage.release_id
     and manifest.master_record_id = general_stage.master_record_id
    where general_stage.release_id = p_release_id
      and manifest.master_record_id is null
  ) then
    raise exception 'clinical_master_payload_adoption_manifest_parity_invalid'
      using errcode = '23503';
  end if;
  if exists (
    select 1
    from private.clinical_master_lab_publish_stage general_stage
    left join private.clinical_master_lab_order_publish_stage specialized_stage
      on specialized_stage.release_id = general_stage.release_id
     and specialized_stage.owner_record_id = general_stage.master_record_id
    left join master.master_records owner
      on owner.id = general_stage.master_record_id
    left join master.master_record_versions version
      on version.master_record_id = general_stage.master_record_id
     and version.revision = general_stage.effective_revision
    where general_stage.release_id = p_release_id
      and general_stage.included
      and general_stage.record_type = 'order'
      and (
        specialized_stage.owner_record_id is null
        or specialized_stage.master_key is distinct from general_stage.master_key
        or specialized_stage.included is distinct from general_stage.included
        or specialized_stage.base_content is distinct from general_stage.base_content
        or specialized_stage.relation_content is distinct from general_stage.relation_content
        or specialized_stage.effective_revision is distinct from general_stage.effective_revision
        or specialized_stage.content_sha256 is distinct from private.clinical_master_sha256(
          general_stage.base_content || general_stage.relation_content
        )
        or not exists (
          select 1
          from private.clinical_master_release_payload_owner_manifest manifest
          where manifest.release_id = general_stage.release_id
            and manifest.master_record_id = general_stage.master_record_id
            and manifest.master_key = general_stage.master_key
            and manifest.record_type = general_stage.record_type
            and manifest.included = general_stage.included
            and manifest.base_content = general_stage.base_content
            and manifest.relation_content = general_stage.relation_content
            and manifest.effective_revision = general_stage.effective_revision
        )
        or owner.record_type is distinct from 'order'
        or owner.master_key is distinct from general_stage.master_key
        or owner.current_revision is distinct from general_stage.effective_revision
        or version.snapshot is null
        or (version.snapshot - 'revision') is distinct from (
          general_stage.base_content || general_stage.relation_content
        )
      )
  ) or exists (
    select 1
    from private.clinical_master_lab_order_publish_stage specialized_stage
    left join private.clinical_master_lab_publish_stage general_stage
      on general_stage.release_id = specialized_stage.release_id
     and general_stage.master_record_id = specialized_stage.owner_record_id
    left join master.master_records owner
      on owner.id = specialized_stage.owner_record_id
    where specialized_stage.release_id = p_release_id
      and specialized_stage.included
      and (
        general_stage.master_record_id is null
        or general_stage.included is distinct from specialized_stage.included
        or general_stage.record_type is distinct from 'order'
        or general_stage.master_key is distinct from specialized_stage.master_key
        or general_stage.base_content is distinct from specialized_stage.base_content
        or general_stage.relation_content is distinct from specialized_stage.relation_content
        or general_stage.effective_revision is distinct from specialized_stage.effective_revision
        or owner.record_type is distinct from 'order'
        or owner.master_key is distinct from specialized_stage.master_key
        or not exists (
          select 1
          from private.clinical_master_release_payload_owner_manifest manifest
          where manifest.release_id = specialized_stage.release_id
            and manifest.master_record_id = specialized_stage.owner_record_id
            and manifest.master_key = specialized_stage.master_key
            and manifest.record_type = 'order'
            and manifest.included = specialized_stage.included
            and manifest.base_content = specialized_stage.base_content
            and manifest.relation_content = specialized_stage.relation_content
            and manifest.effective_revision = specialized_stage.effective_revision
        )
      )
  ) then
    raise exception 'clinical_master_payload_adoption_stage_parity_invalid'
      using errcode = '23503';
  end if;

  -- Payload mode traverses the exact release owner stage only.  Existing
  -- nonpayload catalog rows are intentionally left for the lab helper's
  -- separate pinned-profile traversal; an absent legacy initial/metabolic
  -- order cannot be created in payload mode.
  perform 1
  from public.order_catalog_items item
  where item.workspace_id = p_workspace_id
  order by item.id
  for update;

  for v_source in
    select record_row.*, order_row.classification_path_id as source_path_id,
      order_row.default_sales_unit_id, order_row.default_billing_reflection_enabled,
      order_row.default_quantity, unit.unit_code as default_sales_unit_code
    from master.master_records record_row
    join master.orders order_row on order_row.master_record_id = record_row.id
    left join master.units unit on unit.master_record_id = order_row.default_sales_unit_id
    where record_row.record_type = 'order'
      and record_row.safety_status = 'normal'
      and record_row.lifecycle_status in ('published', 'deprecation_pending', 'deprecated')
      and exists (
        select 1
        from private.clinical_master_release_payload_owner_manifest owner_manifest
        where owner_manifest.release_id = p_release_id
          and owner_manifest.included
          and owner_manifest.record_type = 'order'
          and owner_manifest.master_record_id = record_row.id
          and owner_manifest.master_key = record_row.master_key
      )
    order by record_row.master_key
    for update of record_row, order_row
  loop
    v_stage_revision := null;
    select owner_manifest.effective_revision
      into v_stage_revision
    from private.clinical_master_release_payload_owner_manifest owner_manifest
    where owner_manifest.release_id = p_release_id
      and owner_manifest.included
      and owner_manifest.record_type = 'order'
      and owner_manifest.master_record_id = v_source.id
      and owner_manifest.master_key = v_source.master_key;
    v_stage_owner_found := found;
    if v_stage_owner_found then
      v_payload_owner_traversed := v_payload_owner_traversed + 1;
    end if;

    select * into v_path
    from master.classification_paths
    where id = v_source.source_path_id
    for update;
    select * into v_action from master.clinical_actions where master_record_id = v_path.clinical_action_id;
    select * into v_chart from master.chart_groups where master_record_id = v_path.chart_group_id;
    select * into v_route from master.task_routes where master_record_id = v_path.task_route_id;
    v_projection := private.clinical_master_order_source_projection(v_source.id);
    v_source_revision := case when v_stage_owner_found then v_stage_revision else v_source.current_revision end;
    select coalesce((
      select name_row.name from master.master_record_names name_row
      where name_row.master_record_id = v_source.id
        and name_row.language_code = 'ko' and name_row.name_kind = 'preferred'
      order by name_row.sort_order, name_row.id limit 1
    ), v_source.master_key) into v_standard_name;
    select coalesce(array_agg(name_row.name order by name_row.language_code, name_row.name_kind, name_row.sort_order, name_row.id), '{}')
      into v_aliases
    from master.master_record_names name_row
    where name_row.master_record_id = v_source.id and name_row.name_kind = 'alias';
    select coalesce(array_agg(species.species_code order by species.species_code), '{dog,cat}')
      into v_species
    from master.order_species_links link
    join master.species species on species.master_record_id = link.species_record_id
    where link.order_record_id = v_source.id;

    select * into v_item
    from public.order_catalog_items item
    where item.workspace_id = p_workspace_id
      and item.source_master_record_id = v_source.id
    for update;
    v_item_found := found;
    v_normalized_sales_unit := private.clinical_master_normalize_sales_unit(
      v_source.default_sales_unit_code,
      case when v_item_found then v_item.sales_unit else 'per_each' end
    );
    v_fingerprint := private.clinical_master_projection_fingerprint(v_projection);

    if not v_item_found then
      v_update_type := case
        when v_source.replacement_record_id is not null then 'replacement'
        when v_source.lifecycle_status in ('deprecated', 'deprecation_pending') then 'deprecated'
        else 'new'
      end;
      v_status := 'pending';
      v_merge_status := case
        when v_source.lifecycle_status in ('deprecated', 'deprecation_pending') then 'deprecated_source'
        else 'current'
      end;
      insert into public.order_catalog_items (
        id, workspace_id, standard_order_id, source_preset_version,
        initial_imported_preset_version, last_auto_merged_preset_version,
        customization_state, customized_fields, preset_merge_status,
        category_group, category_label, standard_order_name,
        in_hospital_order_name, billing_name, aliases, availability_status,
        price_krw, sales_unit, target_species, default_destination_module,
        default_task_required, billing_reflection_enabled, care_guide_delivery_enabled,
        internal_instruction_delivery_enabled, tax_included, rounding_rule,
        pricing_rule, medication_metadata, vaccine_metadata, origin_type,
        source_master_record_id, source_master_revision, initial_imported_revision,
        last_auto_merged_revision, classification_path_id, catalog_revision,
        source_projection_snapshot, source_projection_fingerprint
      ) values (
        'master-' || p_workspace_id || '-' || v_source.master_key, p_workspace_id, v_source.master_key,
        'master-r' || v_source_revision, v_source_revision, v_source_revision,
        'unmodified', '{}', v_merge_status, v_action.item_type,
        coalesce(v_chart.group_code, v_action.item_type), v_standard_name,
        v_standard_name, v_standard_name, v_aliases, 'pending_activation', null,
        v_normalized_sales_unit, v_species,
        case v_route.destination_module when 'inpatient' then 'billing_only' else v_route.destination_module end,
        v_route.task_required, v_source.default_billing_reflection_enabled,
        false, false, true, 'as_is',
        jsonb_build_object('priceBasis', 'fixed_order_price', 'priceKrw', null,
          'salesUnit', v_normalized_sales_unit,
          'taxIncluded', true, 'roundingRule', 'as_is',
          'billingReflectionEnabled', v_source.default_billing_reflection_enabled),
        '{}'::jsonb, '{}'::jsonb, 'clair_master', v_source.id, v_source_revision,
        v_source_revision, v_source_revision, v_path.id, 1, v_projection, v_fingerprint
      )
      returning * into v_item;
      v_created := v_created + 1;
    else
      if v_item.origin_type <> 'clair_master' then
        continue;
      end if;
      v_existing_update := null;
      select * into v_existing_update
      from public.workspace_master_updates update_row
      where update_row.workspace_id = p_workspace_id
        and update_row.source_master_record_id = v_source.id
        and update_row.status in ('pending', 'dismissed')
        and update_row.source_snapshot = v_projection
        and private.clinical_master_projection_fingerprint(update_row.source_snapshot) = v_fingerprint
      order by update_row.created_at desc, update_row.id desc
      limit 1;
      if (
        v_item.source_projection_fingerprint = v_fingerprint
        and (
          v_item.source_master_revision = v_source_revision
          or v_item.source_projection_snapshot = v_projection
        )
      ) or v_existing_update.id is not null then
        continue;
      end if;
      v_requires_review := v_source.lifecycle_status <> 'published'
        or v_source.replacement_record_id is not null;
      v_unmodified := private.clinical_master_catalog_source_matches_snapshot(
        v_item, v_item.source_projection_snapshot
      ) and not v_requires_review
        and v_item.source_projection_fingerprint = private.clinical_master_projection_fingerprint(v_item.source_projection_snapshot)
        and v_item.customization_state = 'unmodified'
        and coalesce(cardinality(v_item.customized_fields), 0) = 0;
      if v_unmodified then
        if v_item.source_master_revision = v_source_revision
          and v_item.source_projection_fingerprint = v_fingerprint then
          continue;
        end if;
        update public.order_catalog_items
        set source_preset_version = 'master-r' || v_source_revision,
            last_auto_merged_preset_version = 'master-r' || v_source_revision,
            standard_order_id = v_source.master_key,
            standard_order_name = v_standard_name,
            category_group = v_action.item_type,
            category_label = coalesce(v_chart.group_code, v_action.item_type),
            aliases = v_aliases,
            sales_unit = v_normalized_sales_unit,
            pricing_rule = jsonb_set(
              coalesce(pricing_rule, '{}'::jsonb), '{salesUnit}',
              to_jsonb(v_normalized_sales_unit), true
            ),
            target_species = v_species,
            default_destination_module = case v_route.destination_module when 'inpatient' then 'billing_only' else v_route.destination_module end,
            default_task_required = v_route.task_required,
            billing_reflection_enabled = v_source.default_billing_reflection_enabled,
            classification_path_id = v_path.id,
            source_master_revision = v_source_revision,
            last_auto_merged_revision = v_source_revision,
            source_projection_snapshot = v_projection,
            source_projection_fingerprint = v_fingerprint,
            catalog_revision = catalog_revision + 1,
            preset_merge_status = 'current',
            updated_at = now()
        where workspace_id = p_workspace_id and id = v_item.id;
        v_auto_applied := v_auto_applied + 1;
        v_update_type := 'changed';
        v_status := 'auto_applied';
        v_merge_status := 'current';
      else
        v_update_type := case when v_source.replacement_record_id is not null then 'replacement'
          when v_source.lifecycle_status = 'deprecated' then 'deprecated' else 'changed' end;
        v_status := 'pending';
        v_merge_status := case when v_source.lifecycle_status = 'deprecated' then 'deprecated_source'
          else 'update_available' end;
        update public.order_catalog_items
        set preset_merge_status = v_merge_status, updated_at = now()
        where workspace_id = p_workspace_id and id = v_item.id;
      end if;
    end if;

    if v_status = 'auto_applied' then
      insert into public.workspace_master_updates (
        workspace_id, release_id, source_master_record_id, order_catalog_item_id,
        update_type, status, previous_source_revision, source_revision,
        changed_fields, source_snapshot, workspace_snapshot
      ) values (
        p_workspace_id, v_release.id, v_source.id, v_item.id, v_update_type,
        v_status, v_item.source_master_revision, v_source_revision,
        array['source_projection'], v_projection, null
      ) on conflict (workspace_id, release_id, source_master_record_id, update_type)
        do nothing;
    else
      insert into public.workspace_master_updates (
        workspace_id, release_id, source_master_record_id, order_catalog_item_id,
        update_type, status, previous_source_revision, source_revision,
        changed_fields, source_snapshot, workspace_snapshot
      ) values (
        p_workspace_id, v_release.id, v_source.id, v_item.id, v_update_type,
        v_status, case when v_item_found then v_item.source_master_revision else null end,
        v_source_revision,
        case when v_update_type = 'new' then array['source_projection'] else array['source_projection', 'lifecycle'] end,
        v_projection, case when v_item_found then private.clinical_master_workspace_snapshot(v_item) else null end
      ) on conflict (workspace_id, release_id, source_master_record_id, update_type)
        do nothing
        returning id into v_update_id;
      if v_update_id is not null then
        v_reviews := v_reviews + 1;
        perform private.clinical_master_emit_update_notification(p_workspace_id, v_update_id);
        v_notifications := v_notifications + 1;
      end if;
    end if;
    v_update_id := null;
  end loop;

  if v_payload_owner_traversed <> v_payload_owner_count then
    raise exception 'clinical_master_payload_adoption_owner_traversal_count_invalid'
      using errcode = '23503', detail = v_payload_owner_traversed::text || ':' || v_payload_owner_count::text;
  end if;
  return jsonb_build_object(
    'ok', true, 'workspaceId', p_workspace_id, 'releaseId', p_release_id,
    'createdCount', v_created, 'autoAppliedCount', v_auto_applied,
    'reviewCount', v_reviews, 'notificationCount', v_notifications,
    'enforcedBy', 'clinical-master-workspace-adoption'
  );
end;
$$;

revoke all on function private.clair_adopt_master_release_to_workspace_payload(text, uuid)
  from public, anon, authenticated, service_role;

-- Payload lab adoption is a separate exact-owner implementation.  It never
-- enters the cumulative helper's global catalog traversal, so nonpayload
-- catalog rows, lab projections, pinned versions/links, review ledgers, and
-- notification rows are outside its write set.
create or replace function private.clair_adopt_lab_master_projection_to_workspace_payload(
  p_workspace_id text,
  p_release_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, master, extensions, pg_temp, pg_catalog
as $$
declare
  v_catalog record;
  v_order_version record;
  v_panel_version record;
  v_profile jsonb;
  v_member jsonb;
  v_projection jsonb;
  v_item_id text;
  v_link_id text;
  v_category_id text;
  v_snapshot jsonb;
  v_members jsonb;
  v_item_revision integer;
  v_source_revision integer;
  v_order_key text;
  v_panel_id uuid;
  v_panel_revision integer;
  v_test_id uuid;
  v_test_revision integer;
  v_catalogs integer := 0;
  v_created_items integer := 0;
  v_created_links integer := 0;
begin
  if p_workspace_id is null or pg_catalog.length(pg_catalog.btrim(p_workspace_id)) = 0 then
    raise exception 'workspace_id_required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from master.master_releases
    where id = p_release_id and status = 'published' and adoption_scope = 'payload'
  ) then
    raise exception 'clinical_master_payload_adoption_scope_required' using errcode = '22023';
  end if;
  insert into public.lab_test_categories(id, workspace_id, category_name, sort_order)
  values(
    'lab-category:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':unclassified','UTF8'),'sha256'),'hex')),
    p_workspace_id, '카테고리 미설정', 2147483647
  ) on conflict(workspace_id,id) do nothing;
  select id into v_category_id
  from public.lab_test_categories
  where workspace_id = p_workspace_id
    and id = 'lab-category:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':unclassified','UTF8'),'sha256'),'hex'));
  if v_category_id is null then raise exception 'deterministic_category_id_collision'; end if;

  for v_catalog in
    select catalog.*
    from public.order_catalog_items catalog
    join private.clinical_master_release_payload_owner_manifest manifest
      on manifest.release_id = p_release_id
     and manifest.master_record_id = catalog.source_master_record_id
     and manifest.effective_revision = catalog.source_master_revision
     and manifest.record_type = 'order'
     and manifest.included
    where catalog.workspace_id = p_workspace_id
      and catalog.category_group = 'lab'
      and catalog.source_master_record_id is not null
    order by catalog.id
    for update of catalog
  loop
    v_source_revision := v_catalog.source_master_revision;
    select version.snapshot, owner.master_key into v_order_version
    from master.master_record_versions version
    join master.master_records owner on owner.id = version.master_record_id
    where version.master_record_id = v_catalog.source_master_record_id
      and version.revision = v_source_revision
      and owner.record_type = 'order';
    if not found then raise exception 'catalog_source_version_missing'; end if;
    v_order_key := v_order_version.master_key;
    select value into v_profile
    from pg_catalog.jsonb_array_elements(coalesce(v_order_version.snapshot->'labOrderProfiles','[]'::jsonb)) profiles(value)
    where value->>'orderMasterKey' = v_order_key
    limit 1;
    if not found then continue; end if;
    v_panel_id := nullif(v_profile->>'labPanelMasterRecordId','')::uuid;
    v_panel_revision := nullif(v_profile->>'labPanelMasterRevision','')::integer;
    v_test_id := nullif(v_profile->>'labTestMasterRecordId','')::uuid;
    v_test_revision := nullif(v_profile->>'labTestMasterRevision','')::integer;
    if (v_panel_id is null) = (v_test_id is null) then
      raise exception 'clinical_master_lab_order_profile_target_exactly_one';
    end if;
    v_members := '[]'::jsonb;
    if v_panel_id is not null then
      select version.snapshot into v_panel_version
      from master.master_record_versions version
      where version.master_record_id = v_panel_id and version.revision = v_panel_revision;
      if not found then raise exception 'catalog_source_panel_version_missing'; end if;
      for v_member in
        select value
        from pg_catalog.jsonb_array_elements(coalesce(v_panel_version.snapshot->'labPanelItems','[]'::jsonb)) items(value)
        order by (value->>'sortOrder')::integer, value->>'testMasterKey'
      loop
        v_test_id := nullif(v_member->>'testMasterRecordId','')::uuid;
        v_test_revision := nullif(v_member->>'testMasterRevision','')::integer;
        if v_test_id is null or v_test_revision is null then raise exception 'catalog_source_panel_link_pin_missing'; end if;
        v_projection := private.clinical_master_lab_test_projection(v_test_id, v_test_revision);
        v_item_id := 'lab-item:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':' || v_test_id::text,'UTF8'),'sha256'),'hex'));
        insert into public.lab_test_items(
          id,workspace_id,category_id,test_item_name,result_input_type,result_unit,sort_order,
          availability_status,definition_origin,source_master_record_id,source_master_revision,
          result_value_kind,decimal_scale,workspace_result_revision,local_settings_revision,
          customization_state,source_projection_schema_version,source_projection_snapshot,
          source_projection_sha256,local_definition_snapshot,local_definition_sha256
        ) values(
          v_item_id,p_workspace_id,v_category_id,v_projection->>'testItemName',v_projection->>'resultInputType',v_projection->>'resultUnit',(v_member->>'sortOrder')::integer,
          'active','clair_master',v_test_id,v_test_revision,v_projection->>'resultValueKind',nullif(v_projection->>'decimalScale','')::integer,
          1,1,'unmodified',1,
          pg_catalog.jsonb_build_object('schemaVersion',1,'sourceMasterRecordId',v_test_id,'sourceMasterRevision',v_test_revision,'testItemName',v_projection->>'testItemName','resultInputType',v_projection->>'resultInputType','resultValueKind',v_projection->>'resultValueKind','resultUnit',v_projection->>'resultUnit','decimalScale',nullif(v_projection->>'decimalScale','')::integer),null,
          pg_catalog.jsonb_build_object('schemaVersion',1,'testItemName',v_projection->>'testItemName','resultInputType',v_projection->>'resultInputType','resultValueKind',v_projection->>'resultValueKind','resultUnit',v_projection->>'resultUnit','decimalScale',nullif(v_projection->>'decimalScale','')::integer),null
        ) on conflict(workspace_id,id) do nothing;
        update public.lab_test_items
        set source_projection_sha256 = private.clinical_master_sha256(source_projection_snapshot),
            local_definition_sha256 = private.clinical_master_sha256(local_definition_snapshot)
        where workspace_id = p_workspace_id and id = v_item_id;
        select coalesce(max(version_row.workspace_result_revision),0) into v_item_revision
        from public.lab_test_item_versions version_row
        where version_row.workspace_id = p_workspace_id and version_row.lab_test_item_id = v_item_id;
        if v_item_revision = 0 then
          insert into public.lab_test_item_versions(
            workspace_id,lab_test_item_id,workspace_result_revision,test_item_name,result_input_type,
            result_value_kind,result_unit,decimal_scale,definition_origin,customization_state,
            source_master_record_id,source_master_revision,source_projection_schema_version,
            source_projection_snapshot,source_projection_sha256,local_definition_snapshot,local_definition_sha256
          )
          select item.workspace_id,item.id,item.workspace_result_revision,item.test_item_name,item.result_input_type,
            item.result_value_kind,item.result_unit,item.decimal_scale,'clair_master','unmodified',
            item.source_master_record_id,item.source_master_revision,item.source_projection_schema_version,
            item.source_projection_snapshot,item.source_projection_sha256,item.local_definition_snapshot,item.local_definition_sha256
          from public.lab_test_items item where item.workspace_id = p_workspace_id and item.id = v_item_id;
          v_created_items := v_created_items + 1;
        end if;
        v_link_id := 'lab-link:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':' || v_catalog.id || ':' || v_item_id,'UTF8'),'sha256'),'hex'));
        v_snapshot := pg_catalog.jsonb_build_object('schemaVersion',2,'linkOrigin','clair_master','profileKind','panel','workspaceCatalogItemId',v_catalog.id,'masterOrderRecordId',v_catalog.source_master_record_id,'masterOrderRevision',v_source_revision,'masterPanelRecordId',v_panel_id,'masterPanelRevision',v_panel_revision,'masterTestRecordId',v_test_id,'ownerPinnedSourceTestRevision',v_test_revision,'itemVersionSourceMasterRecordId',v_test_id,'itemVersionSourceTestRevision',v_test_revision,'labTestItemId',v_item_id,'pinnedWorkspaceResultRevision',1,'required',coalesce((v_member->>'required')::boolean,true),'displayGroup',nullif(v_member->>'displayGroup',''),'sourceOrdinal',(v_member->>'sortOrder')::integer,'effectiveSortOrder',(v_member->>'sortOrder')::integer);
        insert into public.order_catalog_lab_test_item_links(
          id,workspace_id,order_catalog_item_id,lab_test_item_id,sort_order,link_revision,link_origin,
          profile_kind,source_master_order_record_id,source_master_order_revision,
          source_master_panel_record_id,source_master_panel_revision,source_master_test_record_id,
          owner_pinned_source_test_revision,source_ordinal,effective_sort_order,
          pinned_workspace_result_revision,required,display_group,snapshot_metadata,
          snapshot_metadata_schema_version,snapshot_metadata_sha256
        ) values(
          v_link_id,p_workspace_id,v_catalog.id,v_item_id,(v_member->>'sortOrder')::integer,1,'clair_master','panel',
          v_catalog.source_master_record_id,v_source_revision,v_panel_id,v_panel_revision,v_test_id,v_test_revision,
          (v_member->>'sortOrder')::integer,(v_member->>'sortOrder')::integer,1,
          coalesce((v_member->>'required')::boolean,true),nullif(v_member->>'displayGroup',''),v_snapshot,2,
          private.clinical_master_sha256(v_snapshot)
        ) on conflict(workspace_id,id) do nothing;
        v_members := v_members || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('linkOrigin','clair_master','profileKind','panel','sourceMasterTestRecordId',v_test_id,'ownerPinnedSourceTestRevision',v_test_revision,'itemVersionSourceMasterRecordId',v_test_id,'itemVersionSourceTestRevision',v_test_revision,'labTestItemId',v_item_id,'pinnedWorkspaceResultRevision',1,'sourceOrdinal',(v_member->>'sortOrder')::integer,'effectiveSortOrder',(v_member->>'sortOrder')::integer,'required',coalesce((v_member->>'required')::boolean,true),'displayGroup',nullif(v_member->>'displayGroup','')));
        v_created_links := v_created_links + 1;
      end loop;
    else
      v_projection := private.clinical_master_lab_test_projection(v_test_id, v_test_revision);
      v_item_id := 'lab-item:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':' || v_test_id::text,'UTF8'),'sha256'),'hex'));
      insert into public.lab_test_items(
        id,workspace_id,category_id,test_item_name,result_input_type,result_unit,sort_order,
        availability_status,definition_origin,source_master_record_id,source_master_revision,
        result_value_kind,decimal_scale,workspace_result_revision,local_settings_revision,
        customization_state,source_projection_schema_version,source_projection_snapshot,
        source_projection_sha256,local_definition_snapshot,local_definition_sha256
      ) values(
        v_item_id,p_workspace_id,v_category_id,v_projection->>'testItemName',v_projection->>'resultInputType',v_projection->>'resultUnit',0,
        'active','clair_master',v_test_id,v_test_revision,v_projection->>'resultValueKind',nullif(v_projection->>'decimalScale','')::integer,
        1,1,'unmodified',1,
        pg_catalog.jsonb_build_object('schemaVersion',1,'sourceMasterRecordId',v_test_id,'sourceMasterRevision',v_test_revision,'testItemName',v_projection->>'testItemName','resultInputType',v_projection->>'resultInputType','resultValueKind',v_projection->>'resultValueKind','resultUnit',v_projection->>'resultUnit','decimalScale',nullif(v_projection->>'decimalScale','')::integer),null,
        pg_catalog.jsonb_build_object('schemaVersion',1,'testItemName',v_projection->>'testItemName','resultInputType',v_projection->>'resultInputType','resultValueKind',v_projection->>'resultValueKind','resultUnit',v_projection->>'resultUnit','decimalScale',nullif(v_projection->>'decimalScale','')::integer),null
      ) on conflict(workspace_id,id) do nothing;
      update public.lab_test_items
      set source_projection_sha256 = private.clinical_master_sha256(source_projection_snapshot),
          local_definition_sha256 = private.clinical_master_sha256(local_definition_snapshot)
      where workspace_id = p_workspace_id and id = v_item_id;
      if not exists(
        select 1 from public.lab_test_item_versions
        where workspace_id = p_workspace_id and lab_test_item_id = v_item_id and workspace_result_revision = 1
      ) then
        insert into public.lab_test_item_versions(
          workspace_id,lab_test_item_id,workspace_result_revision,test_item_name,result_input_type,
          result_value_kind,result_unit,decimal_scale,definition_origin,customization_state,
          source_master_record_id,source_master_revision,source_projection_schema_version,
          source_projection_snapshot,source_projection_sha256,local_definition_snapshot,local_definition_sha256
        )
        select item.workspace_id,item.id,1,item.test_item_name,item.result_input_type,item.result_value_kind,
          item.result_unit,item.decimal_scale,'clair_master','unmodified',item.source_master_record_id,
          item.source_master_revision,item.source_projection_schema_version,item.source_projection_snapshot,
          item.source_projection_sha256,item.local_definition_snapshot,item.local_definition_sha256
        from public.lab_test_items item where item.workspace_id = p_workspace_id and item.id = v_item_id;
        v_created_items := v_created_items + 1;
      end if;
      v_link_id := 'lab-link:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':' || v_catalog.id || ':' || v_item_id,'UTF8'),'sha256'),'hex'));
      v_snapshot := pg_catalog.jsonb_build_object('schemaVersion',2,'linkOrigin','clair_master','profileKind','standalone_test','workspaceCatalogItemId',v_catalog.id,'masterOrderRecordId',v_catalog.source_master_record_id,'masterOrderRevision',v_source_revision,'masterPanelRecordId',null,'masterPanelRevision',null,'masterTestRecordId',v_test_id,'ownerPinnedSourceTestRevision',v_test_revision,'itemVersionSourceMasterRecordId',v_test_id,'itemVersionSourceTestRevision',v_test_revision,'labTestItemId',v_item_id,'pinnedWorkspaceResultRevision',1,'required',true,'displayGroup',null,'sourceOrdinal',null,'effectiveSortOrder',0);
      insert into public.order_catalog_lab_test_item_links(
        id,workspace_id,order_catalog_item_id,lab_test_item_id,sort_order,link_revision,link_origin,
        profile_kind,source_master_order_record_id,source_master_order_revision,
        source_master_test_record_id,owner_pinned_source_test_revision,source_ordinal,effective_sort_order,
        pinned_workspace_result_revision,required,display_group,snapshot_metadata,
        snapshot_metadata_schema_version,snapshot_metadata_sha256
      ) values(
        v_link_id,p_workspace_id,v_catalog.id,v_item_id,0,1,'clair_master','standalone_test',
        v_catalog.source_master_record_id,v_source_revision,v_test_id,v_test_revision,null,0,1,true,null,
        v_snapshot,2,private.clinical_master_sha256(v_snapshot)
      ) on conflict(workspace_id,id) do nothing;
      v_members := pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('linkOrigin','clair_master','profileKind','standalone_test','sourceMasterTestRecordId',v_test_id,'ownerPinnedSourceTestRevision',v_test_revision,'itemVersionSourceMasterRecordId',v_test_id,'itemVersionSourceTestRevision',v_test_revision,'labTestItemId',v_item_id,'pinnedWorkspaceResultRevision',1,'sourceOrdinal',null,'effectiveSortOrder',0,'required',true,'displayGroup',null));
      v_created_links := v_created_links + 1;
    end if;
    v_snapshot := pg_catalog.jsonb_build_object('schemaVersion',1,'sourceMasterOrderRecordId',v_catalog.source_master_record_id,'sourceMasterOrderRevision',v_source_revision,'targetType',case when v_panel_id is not null then 'panel' else 'test' end,'sourceMasterPanelRecordId',v_panel_id,'sourceMasterPanelRevision',v_panel_revision,'members',v_members);
    update public.order_catalog_items
    set last_applied_lab_membership_projection_snapshot = v_snapshot,
        last_applied_lab_membership_projection_sha256 = private.clinical_master_lab_membership_source_fingerprint(v_snapshot),
        last_applied_lab_membership_projection_schema_version = 1
    where workspace_id = p_workspace_id and id = v_catalog.id;
    v_catalogs := v_catalogs + 1;
  end loop;
  return pg_catalog.jsonb_build_object(
    'ok',true,'workspaceId',p_workspace_id,'releaseId',p_release_id,
    'catalogCount',v_catalogs,'createdItemCount',v_created_items,
    'createdLinkCount',v_created_links,'reviewCount',0,'notificationCount',0,
    'enforcedBy','clinical-master-lab-adoption-payload-exact'
  );
end
$$;
revoke all on function private.clair_adopt_lab_master_projection_to_workspace_payload(text, uuid)
  from public, anon, authenticated, service_role;

-- Keep the public private-wrapper signature unchanged while dispatching only
-- by the persisted release scope.  Cumulative remains byte-for-byte behavior
-- of the prior A2 body; payload is the stage-owner implementation above.
create or replace function private.clair_adopt_master_release_to_workspace_a2_base(
  p_workspace_id text,
  p_release_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, master, extensions, pg_temp
as $$
declare
  v_scope text;
  v_result jsonb;
begin
  select adoption_scope into v_scope
  from master.master_releases
  where id = p_release_id;
  if v_scope is null then
    raise exception 'clinical_master_release_not_published' using errcode = '22023';
  end if;
  if v_scope = 'cumulative' then
    v_result := private.clair_adopt_master_release_to_workspace_a2_cumulative(p_workspace_id, p_release_id);
  elsif v_scope = 'payload' then
    v_result := private.clair_adopt_master_release_to_workspace_payload(p_workspace_id, p_release_id);
  else
    raise exception 'clinical_master_adoption_scope_invalid' using errcode = '22023';
  end if;
  return v_result || pg_catalog.jsonb_build_object('adoptionScope', v_scope);
end
$$;

revoke all on function private.clair_adopt_master_release_to_workspace_a2_base(text, uuid)
  from public, anon, authenticated, service_role;

-- Preserve the outer adopter signature while dispatching the payload-scoped
-- lab guard.  Cumulative releases retain the existing global lab helper.
create or replace function private.clair_adopt_master_release_to_workspace(
  p_workspace_id text,
  p_release_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, master, extensions, pg_catalog
as $$
declare
  v_scope text;
  v_base jsonb;
  v_lab jsonb;
begin
  select adoption_scope into v_scope
  from master.master_releases
  where id = p_release_id;
  if v_scope is null then
    raise exception 'clinical_master_release_not_published' using errcode = '22023';
  end if;
  v_base := private.clair_adopt_master_release_to_workspace_a2_base(p_workspace_id, p_release_id);
  if v_scope = 'payload' then
    v_lab := private.clair_adopt_lab_master_projection_to_workspace_payload(p_workspace_id, p_release_id);
  elsif v_scope = 'cumulative' then
    v_lab := private.clair_adopt_lab_master_projection_to_workspace(p_workspace_id, p_release_id);
  else
    raise exception 'clinical_master_adoption_scope_invalid' using errcode = '22023';
  end if;
  return v_base || pg_catalog.jsonb_build_object('labProjection', v_lab);
end
$$;
revoke all on function private.clair_adopt_master_release_to_workspace(text, uuid)
  from public, anon, authenticated, service_role;
