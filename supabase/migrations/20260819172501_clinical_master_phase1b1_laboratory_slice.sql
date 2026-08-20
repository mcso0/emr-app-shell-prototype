-- CLINICAL-MASTER-PR-004: Phase 1B-1 laboratory slice.
--
-- This is a forward-only extension of the approved A1/A2/A3 contracts.  It
-- deliberately keeps the existing result-entry tables as the value model and
-- adds only immutable definition/provenance columns and the server-owned
-- confirmation/save boundaries described by the PR-004 work item.

set check_function_bodies = off;

do $$
begin
  if to_regclass('master.master_records') is null
    or to_regclass('master.master_record_versions') is null
    or to_regclass('master.orders') is null then
    raise exception 'clinical_master_phase1b1_preflight_a1_master_missing';
  end if;
  if to_regclass('public.order_catalog_items') is null
    or to_regclass('public.order_catalog_lab_test_item_links') is null then
    raise exception 'clinical_master_phase1b1_preflight_a2_catalog_missing';
  end if;
  if to_regclass('public.lab_result_entries') is null
    or to_regclass('public.lab_result_entry_rows') is null then
    raise exception 'clinical_master_phase1b1_preflight_lab_result_tables_missing';
  end if;
  if to_regprocedure('private.clair_is_active_workspace_member(text)') is null
    or to_regprocedure('private.clair_current_user_has_workspace_permission(text,text)') is null then
    raise exception 'clinical_master_phase1b1_preflight_permission_helpers_missing';
  end if;
end
$$;

-- B1 exact stored-definition validator.  The validator intentionally follows
-- the frozen header/row payload only: it never resolves a current master,
-- profile, catalog link, or result range while checking a saved definition.
create or replace function private.clair_assert_lab_result_definition_snapshot(
  p_workspace_id text,
  p_result_entry_id uuid
)
returns void language plpgsql security definer
set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_entry public.lab_result_entries%rowtype;
  v_source jsonb;
  v_profile jsonb;
  v_row jsonb;
  v_stored public.lab_result_entry_rows%rowtype;
  v_row_count integer;
  v_key text;
  v_expected_keys text[];
begin
  select * into v_entry
  from public.lab_result_entries entry
  where entry.workspace_id=p_workspace_id and entry.id=p_result_entry_id
  for update;
  if not found then raise exception 'lab_result_not_found'; end if;
  if v_entry.result_definition_origin <> 'canonical' then return; end if;
  if v_entry.result_definition_snapshot_sha256 is distinct from
     private.clinical_master_sha256(v_entry.result_definition_snapshot) then
    raise exception 'lab_result_definition_snapshot_invalid';
  end if;
  if jsonb_typeof(v_entry.result_definition_snapshot) <> 'object'
     or (select array_agg(key order by key) from jsonb_object_keys(v_entry.result_definition_snapshot) keys(key))
        is distinct from array['rows','schemaVersion','source']::text[]
     or v_entry.result_definition_snapshot->>'schemaVersion' <> '1'
     or jsonb_typeof(v_entry.result_definition_snapshot->'source') <> 'object'
     or jsonb_typeof(v_entry.result_definition_snapshot->'rows') <> 'array' then
    raise exception 'lab_result_definition_snapshot_invalid';
  end if;
  v_source := v_entry.result_definition_snapshot->'source';
  if (select array_agg(key order by key) from jsonb_object_keys(v_source) keys(key))
       is distinct from array['masterOrderRecordId','masterOrderRevision','profile','workspaceCatalogItemId','workspaceCatalogRevision']::text[] then
    raise exception 'lab_result_definition_snapshot_invalid';
  end if;
  if v_source->>'workspaceCatalogItemId' is distinct from v_entry.source_workspace_catalog_item_id::text
     or nullif(v_source->>'workspaceCatalogRevision','')::integer is distinct from v_entry.source_workspace_catalog_revision
     or v_source->>'masterOrderRecordId' is distinct from v_entry.source_master_order_record_id::text
     or nullif(v_source->>'masterOrderRevision','')::integer is distinct from v_entry.source_master_order_revision then
    raise exception 'lab_result_definition_snapshot_invalid';
  end if;
  v_profile := v_source->'profile';
  if jsonb_typeof(v_profile) <> 'object'
     or (select array_agg(key order by key) from jsonb_object_keys(v_profile) keys(key))
       is distinct from array['labPanelRecordId','labPanelRevision','labTestRecordId','labTestRevision','orderRecordId','specimenTypeRecordId','specimenTypeRevision','targetType']::text[]
     or v_profile->>'orderRecordId' is distinct from v_entry.source_master_order_record_id::text
     or ((v_profile->>'targetType'='panel') is distinct from (v_entry.source_master_panel_record_id is not null))
     or v_profile->>'labPanelRecordId' is distinct from v_entry.source_master_panel_record_id::text
     or nullif(v_profile->>'labPanelRevision','')::integer is distinct from v_entry.source_master_panel_revision
     or v_profile->>'labTestRecordId' is distinct from v_entry.source_master_test_record_id::text
     or nullif(v_profile->>'labTestRevision','')::integer is distinct from v_entry.source_master_test_revision then
    raise exception 'lab_result_definition_snapshot_invalid';
  end if;
  v_expected_keys := array['analyteName','decimalScale','displayGroup','effectiveSortOrder','itemVersionSourceMasterRecordId','itemVersionSourceTestRevision','labTestItemId','ordinal','ownerPinnedSourceTestRevision','referenceRange','required','resultInputType','resultValueKind','rowDefinitionOrigin','rowId','sourceMasterTestRecordId','sourceOrdinal','unit','workspaceResultRevision'];
  select count(*) into v_row_count
  from public.lab_result_entry_rows row
  where row.workspace_id=p_workspace_id and row.lab_result_entry_id=p_result_entry_id;
  if v_row_count <> jsonb_array_length(v_entry.result_definition_snapshot->'rows')
     or v_row_count <> (select count(distinct value->>'rowId') from jsonb_array_elements(v_entry.result_definition_snapshot->'rows') rows(value)) then
    raise exception 'lab_result_definition_snapshot_invalid';
  end if;
  for v_row in select value from jsonb_array_elements(v_entry.result_definition_snapshot->'rows') rows(value) loop
    if jsonb_typeof(v_row) <> 'object'
       or (select array_agg(key order by key) from jsonb_object_keys(v_row) keys(key)) is distinct from v_expected_keys
       or v_row->>'rowId' !~ '^[0-9a-f]{64}$'
       or v_row->>'referenceRange' is not null
       or v_row->>'resultInputType' not in ('number','text','select','positive_negative','grade')
       or v_row->>'resultValueKind' not in ('numeric','text','coded')
       or v_row->>'rowDefinitionOrigin' not in ('clair_master','workspace_custom')
       or (v_row->>'ordinal')::integer < 1
       or (v_row->>'effectiveSortOrder')::integer < 0
       or (v_row->>'sourceOrdinal') is not null and (v_row->>'sourceOrdinal')::integer < 0
       or (v_row->>'workspaceResultRevision')::integer < 1
       or (v_row->>'ownerPinnedSourceTestRevision') is not null and (v_row->>'ownerPinnedSourceTestRevision')::integer < 1
       or (v_row->>'itemVersionSourceTestRevision') is not null and (v_row->>'itemVersionSourceTestRevision')::integer < 1
       or (v_row->>'decimalScale') is not null and (v_row->>'decimalScale')::integer < 0 then
      raise exception 'lab_result_definition_snapshot_invalid';
    end if;
    select * into v_stored
    from public.lab_result_entry_rows row
    where row.workspace_id=p_workspace_id and row.lab_result_entry_id=p_result_entry_id and row.row_id=v_row->>'rowId';
    if not found
       or v_stored.row_definition_origin is distinct from v_row->>'rowDefinitionOrigin'
       or v_stored.lab_test_item_id is distinct from v_row->>'labTestItemId'
       or v_stored.analyte_name is distinct from v_row->>'analyteName'
       or v_stored.result_input_type is distinct from v_row->>'resultInputType'
       or v_stored.result_value_kind is distinct from v_row->>'resultValueKind'
       or v_stored.result_unit is distinct from nullif(v_row->>'unit','')
       or v_stored.reference_range is not null
       or v_stored.sort_order is distinct from (v_row->>'ordinal')::integer
       or v_stored.effective_sort_order is distinct from (v_row->>'effectiveSortOrder')::integer
       or v_stored.source_ordinal is distinct from nullif(v_row->>'sourceOrdinal','')::integer
       or v_stored.required is distinct from (v_row->>'required')::boolean
       or v_stored.display_group is distinct from nullif(v_row->>'displayGroup','')
       or v_stored.workspace_result_revision is distinct from (v_row->>'workspaceResultRevision')::integer
       or v_stored.source_master_test_record_id is distinct from nullif(v_row->>'sourceMasterTestRecordId','')::uuid
       or v_stored.owner_pinned_source_test_revision is distinct from nullif(v_row->>'ownerPinnedSourceTestRevision','')::integer
       or v_stored.item_version_source_master_record_id is distinct from nullif(v_row->>'itemVersionSourceMasterRecordId','')::uuid
       or v_stored.item_version_source_test_revision is distinct from nullif(v_row->>'itemVersionSourceTestRevision','')::integer
       or v_stored.decimal_scale is distinct from nullif(v_row->>'decimalScale','')::integer
       or v_stored.judgment is distinct from 'not_judged' then
      raise exception 'lab_result_definition_snapshot_invalid';
    end if;
  end loop;
end
$$;
revoke all on function private.clair_assert_lab_result_definition_snapshot(text,uuid) from public,anon,authenticated,service_role;

create or replace function private.clair_guard_canonical_lab_result_definition()
returns trigger language plpgsql security definer set search_path = public, private, pg_catalog as $$
begin
  if OLD.result_definition_origin = 'canonical' then
    if TG_OP = 'DELETE' then raise exception 'lab_result_definition_immutable'; end if;
    if NEW.result_id is distinct from OLD.result_id
       or NEW.encounter_id is distinct from OLD.encounter_id
       or NEW.order_id is distinct from OLD.order_id
       or NEW.result_payload is distinct from OLD.result_payload
       or NEW.source_workspace_catalog_item_id is distinct from OLD.source_workspace_catalog_item_id
       or NEW.source_workspace_catalog_revision is distinct from OLD.source_workspace_catalog_revision
       or NEW.source_master_order_record_id is distinct from OLD.source_master_order_record_id
       or NEW.source_master_order_revision is distinct from OLD.source_master_order_revision
       or NEW.source_master_panel_record_id is distinct from OLD.source_master_panel_record_id
       or NEW.source_master_panel_revision is distinct from OLD.source_master_panel_revision
       or NEW.source_master_test_record_id is distinct from OLD.source_master_test_record_id
       or NEW.source_master_test_revision is distinct from OLD.source_master_test_revision
       or NEW.result_definition_snapshot is distinct from OLD.result_definition_snapshot
       or NEW.result_definition_snapshot_sha256 is distinct from OLD.result_definition_snapshot_sha256
       or NEW.result_definition_origin is distinct from OLD.result_definition_origin
       or NEW.result_quarantine_reason is distinct from OLD.result_quarantine_reason then
      raise exception 'lab_result_definition_immutable';
    end if;
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end
$$;
revoke all on function private.clair_guard_canonical_lab_result_definition() from public,anon,authenticated,service_role;
drop trigger if exists lab_result_entries_canonical_definition_guard on public.lab_result_entries;
create trigger lab_result_entries_canonical_definition_guard
before update or delete on public.lab_result_entries
for each row execute function private.clair_guard_canonical_lab_result_definition();

create or replace function private.clair_guard_canonical_lab_result_row_definition()
returns trigger language plpgsql security definer set search_path = public, private, pg_catalog as $$
declare v_origin text;
begin
  select result_definition_origin into v_origin
  from public.lab_result_entries entry
  where entry.workspace_id=OLD.workspace_id and entry.id=OLD.lab_result_entry_id;
  if v_origin = 'canonical' then
    if TG_OP = 'DELETE' then raise exception 'lab_result_definition_immutable'; end if;
    if NEW.row_id is distinct from OLD.row_id
       or NEW.lab_result_entry_id is distinct from OLD.lab_result_entry_id
       or NEW.lab_test_item_id is distinct from OLD.lab_test_item_id
       or NEW.analyte_name is distinct from OLD.analyte_name
       or NEW.result_unit is distinct from OLD.result_unit
       or NEW.reference_range is distinct from OLD.reference_range
       or NEW.judgment is distinct from OLD.judgment
       or NEW.sort_order is distinct from OLD.sort_order
       or NEW.row_definition_origin is distinct from OLD.row_definition_origin
       or NEW.workspace_result_revision is distinct from OLD.workspace_result_revision
       or NEW.source_master_test_record_id is distinct from OLD.source_master_test_record_id
       or NEW.owner_pinned_source_test_revision is distinct from OLD.owner_pinned_source_test_revision
       or NEW.item_version_source_master_record_id is distinct from OLD.item_version_source_master_record_id
       or NEW.item_version_source_test_revision is distinct from OLD.item_version_source_test_revision
       or NEW.result_value_kind is distinct from OLD.result_value_kind
       or NEW.result_input_type is distinct from OLD.result_input_type
       or NEW.decimal_scale is distinct from OLD.decimal_scale
       or NEW.source_ordinal is distinct from OLD.source_ordinal
       or NEW.effective_sort_order is distinct from OLD.effective_sort_order
       or NEW.required is distinct from OLD.required
       or NEW.display_group is distinct from OLD.display_group then
      raise exception 'lab_result_definition_immutable';
    end if;
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end
$$;
revoke all on function private.clair_guard_canonical_lab_result_row_definition() from public,anon,authenticated,service_role;
drop trigger if exists lab_result_entry_rows_canonical_definition_guard on public.lab_result_entry_rows;
create trigger lab_result_entry_rows_canonical_definition_guard
before update or delete on public.lab_result_entry_rows
for each row execute function private.clair_guard_canonical_lab_result_row_definition();

create or replace function private.clair_validate_lab_result_definition_deferred()
returns trigger language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
begin
  if TG_TABLE_NAME='lab_result_entries' then
    if coalesce(NEW.result_definition_origin, OLD.result_definition_origin) = 'canonical' then
      perform private.clair_assert_lab_result_definition_snapshot(
        coalesce(NEW.workspace_id,OLD.workspace_id), coalesce(NEW.id,OLD.id)
      );
    end if;
  elsif TG_TABLE_NAME='lab_result_entry_rows' then
    if exists (
      select 1 from public.lab_result_entries entry
      where entry.workspace_id=coalesce(NEW.workspace_id,OLD.workspace_id)
        and entry.id=coalesce(NEW.lab_result_entry_id,OLD.lab_result_entry_id)
        and entry.result_definition_origin='canonical'
    ) then
      perform private.clair_assert_lab_result_definition_snapshot(
        coalesce(NEW.workspace_id,OLD.workspace_id), coalesce(NEW.lab_result_entry_id,OLD.lab_result_entry_id)
      );
    end if;
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end
$$;
revoke all on function private.clair_validate_lab_result_definition_deferred() from public,anon,authenticated,service_role;
drop trigger if exists lab_result_entries_canonical_definition_deferred on public.lab_result_entries;
create constraint trigger lab_result_entries_canonical_definition_deferred
after insert or update on public.lab_result_entries
deferrable initially deferred for each row
execute function private.clair_validate_lab_result_definition_deferred();
drop trigger if exists lab_result_entry_rows_canonical_definition_deferred on public.lab_result_entry_rows;
create constraint trigger lab_result_entry_rows_canonical_definition_deferred
after insert or update on public.lab_result_entry_rows
deferrable initially deferred for each row
execute function private.clair_validate_lab_result_definition_deferred();

-- Workspace lab projection columns.  Every source/projection pair is nullable
-- because the migration retains old service-backed rows as explicit legacy or
-- quarantine evidence instead of inventing lineage for them.
alter table public.order_catalog_items
  add column if not exists last_applied_lab_membership_projection_snapshot jsonb,
  add column if not exists last_applied_lab_membership_projection_sha256 text,
  add column if not exists last_applied_lab_membership_projection_schema_version integer;

alter table public.lab_test_items
  add column if not exists definition_origin text,
  add column if not exists source_master_record_id uuid,
  add column if not exists source_master_revision integer,
  add column if not exists result_value_kind text,
  add column if not exists decimal_scale integer,
  add column if not exists workspace_result_revision integer,
  add column if not exists local_settings_revision integer,
  add column if not exists customization_state text,
  add column if not exists source_projection_schema_version integer,
  add column if not exists source_projection_snapshot jsonb,
  add column if not exists source_projection_sha256 text,
  add column if not exists local_definition_snapshot jsonb,
  add column if not exists local_definition_sha256 text,
  add column if not exists historical_unattributed_usage_residual integer,
  add column if not exists canonical_saved_result_usage_count integer,
  add column if not exists legacy_saved_result_usage_count integer,
  add column if not exists quarantine_saved_result_usage_count integer,
  add column if not exists quarantine_reason text;

alter table public.order_catalog_lab_test_item_links
  add column if not exists link_revision integer,
  add column if not exists link_origin text,
  add column if not exists profile_kind text,
  add column if not exists source_master_order_record_id uuid,
  add column if not exists source_master_order_revision integer,
  add column if not exists source_master_panel_record_id uuid,
  add column if not exists source_master_panel_revision integer,
  add column if not exists source_master_test_record_id uuid,
  add column if not exists owner_pinned_source_test_revision integer,
  add column if not exists source_ordinal integer,
  add column if not exists effective_sort_order integer,
  add column if not exists pinned_workspace_result_revision integer,
  add column if not exists required boolean,
  add column if not exists display_group text,
  add column if not exists snapshot_metadata_schema_version integer,
  add column if not exists snapshot_metadata_sha256 text,
  add column if not exists link_quarantine_reason text;

-- Existing rows are a compatibility surface.  They are not canonical just
-- because an old JSON field happens to look similar to a B1 projection.
update public.lab_test_items
set definition_origin = coalesce(nullif(pg_catalog.btrim(definition_origin), ''), 'workspace_custom'),
    result_value_kind = coalesce(result_value_kind,
      case result_input_type when 'number' then 'numeric' when 'text' then 'text' else 'coded' end),
    decimal_scale = coalesce(decimal_scale, null),
    workspace_result_revision = coalesce(workspace_result_revision, 1),
    local_settings_revision = coalesce(local_settings_revision, 1),
    customization_state = coalesce(customization_state, 'unmodified'),
    source_projection_schema_version = case
      when coalesce(nullif(pg_catalog.btrim(definition_origin), ''), 'workspace_custom') = 'workspace_custom' then null
      else coalesce(source_projection_schema_version, 1)
    end,
    local_definition_snapshot = coalesce(local_definition_snapshot,
      jsonb_build_object(
        'schemaVersion', 1,
        'testItemName', test_item_name,
        'resultInputType', result_input_type,
        'resultValueKind', case result_input_type when 'number' then 'numeric' when 'text' then 'text' else 'coded' end,
        'resultUnit', result_unit,
        'decimalScale', null
      )),
    historical_unattributed_usage_residual = coalesce(historical_unattributed_usage_residual, 0),
    canonical_saved_result_usage_count = coalesce(canonical_saved_result_usage_count, 0),
    legacy_saved_result_usage_count = coalesce(legacy_saved_result_usage_count, 0),
    quarantine_saved_result_usage_count = coalesce(quarantine_saved_result_usage_count, 0),
    updated_at = updated_at;

update public.lab_test_items item
set local_definition_sha256 = lower(encode(extensions.digest(convert_to(item.local_definition_snapshot::text, 'UTF8'), 'sha256'), 'hex'))
where item.local_definition_snapshot is not null
  and item.local_definition_sha256 is null;

-- Canonical/current item lineage is typed and source-null workspace custom
-- rows remain detached from master authority.  Legacy result/link evidence is
-- intentionally kept outside this item-origin predicate.
update public.lab_test_items
set source_projection_schema_version = null
where definition_origin = 'workspace_custom';

do $$
begin
  alter table public.lab_test_items drop constraint if exists lab_test_items_origin_projection_check;
  alter table public.lab_test_items add constraint lab_test_items_origin_projection_check check (
    (definition_origin='quarantined'
      and quarantine_reason is not null and pg_catalog.btrim(quarantine_reason) <> ''
      and source_master_record_id is null and source_master_revision is null)
    or (definition_origin='clair_master'
      and quarantine_reason is null
      and source_master_record_id is not null and source_master_revision > 0
      and result_input_type is not null and result_value_kind is not null
      and source_projection_schema_version=1
      and source_projection_snapshot is not null
      and source_projection_sha256 ~ '^[0-9a-f]{64}$')
    or (definition_origin='workspace_custom'
      and quarantine_reason is null
      and source_master_record_id is null and source_master_revision is null
      and source_projection_schema_version is null
      and source_projection_snapshot is null and source_projection_sha256 is null)
  );
  if not exists (select 1 from pg_constraint where conrelid='public.lab_test_items'::regclass and conname='lab_test_items_definition_origin_check') then
    alter table public.lab_test_items add constraint lab_test_items_definition_origin_check check (definition_origin in ('clair_master','workspace_custom','quarantined'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lab_test_items'::regclass and conname='lab_test_items_source_pair_check') then
    alter table public.lab_test_items add constraint lab_test_items_source_pair_check check ((source_master_record_id is null) = (source_master_revision is null));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lab_test_items'::regclass and conname='lab_test_items_workspace_result_revision_check') then
    alter table public.lab_test_items add constraint lab_test_items_workspace_result_revision_check check (workspace_result_revision is null or workspace_result_revision > 0);
  end if;
end
$$;

-- The compatibility update above has classified every pre-B1 item.  Make the
-- mutable projection's identity/revision fields explicit so later writes
-- cannot silently fall back to a legacy NULL shape.  Source lineage remains
-- nullable for the workspace_custom/quarantined branches by design.
alter table public.lab_test_items
  alter column definition_origin set default 'workspace_custom',
  alter column definition_origin set not null,
  alter column result_value_kind set default 'coded',
  alter column result_value_kind set not null,
  alter column workspace_result_revision set default 1,
  alter column workspace_result_revision set not null,
  alter column local_settings_revision set default 1,
  alter column local_settings_revision set not null,
  alter column customization_state set default 'unmodified',
  alter column customization_state set not null,
  alter column historical_unattributed_usage_residual set default 0,
  alter column historical_unattributed_usage_residual set not null,
  alter column canonical_saved_result_usage_count set default 0,
  alter column canonical_saved_result_usage_count set not null,
  alter column legacy_saved_result_usage_count set default 0,
  alter column legacy_saved_result_usage_count set not null,
  alter column quarantine_saved_result_usage_count set default 0,
  alter column quarantine_saved_result_usage_count set not null,
  alter column local_definition_snapshot set not null,
  alter column local_definition_sha256 set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.lab_test_items'::regclass and conname='lab_test_items_result_value_kind_check') then
    alter table public.lab_test_items add constraint lab_test_items_result_value_kind_check check (result_value_kind in ('numeric','text','coded'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lab_test_items'::regclass and conname='lab_test_items_local_settings_revision_check') then
    alter table public.lab_test_items add constraint lab_test_items_local_settings_revision_check check (local_settings_revision > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lab_test_items'::regclass and conname='lab_test_items_customization_state_check') then
    alter table public.lab_test_items add constraint lab_test_items_customization_state_check check (customization_state in ('unmodified','customized'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lab_test_items'::regclass and conname='lab_test_items_decimal_scale_check') then
    alter table public.lab_test_items add constraint lab_test_items_decimal_scale_check check (decimal_scale is null or decimal_scale >= 0);
  end if;
end
$$;

update public.order_catalog_lab_test_item_links
set link_revision = coalesce(link_revision, 1),
    link_origin = coalesce(nullif(pg_catalog.btrim(link_origin), ''), 'legacy');

-- Only the explicit legacy/quarantine compatibility buckets get NULL B1
-- lineage fields.  Reapplying the forward migration after a local replay must
-- preserve already-authored canonical links and their immutable pins.
update public.order_catalog_lab_test_item_links
set snapshot_metadata_schema_version = null,
    snapshot_metadata_sha256 = null,
    link_quarantine_reason = null,
    profile_kind = null,
    source_master_order_record_id = null,
    source_master_order_revision = null,
    source_master_panel_record_id = null,
    source_master_panel_revision = null,
    source_master_test_record_id = null,
    owner_pinned_source_test_revision = null,
    source_ordinal = null,
    effective_sort_order = null,
    pinned_workspace_result_revision = null,
    required = null,
    display_group = null
where link_origin in ('legacy','quarantined');

-- The repository seed is applied after migrations and intentionally remains an
-- A3-owned fixture.  These insert classifiers keep future seed/legacy inserts
-- in the same explicit compatibility buckets without inferring lineage.
create or replace function private.clair_classify_lab_test_item_insert()
returns trigger language plpgsql security definer set search_path = public, private, pg_catalog as $$
begin
  if nullif(pg_catalog.btrim(new.definition_origin), '') is null then new.definition_origin := 'workspace_custom'; end if;
  if new.result_value_kind is null then new.result_value_kind := case new.result_input_type when 'number' then 'numeric' when 'text' then 'text' else 'coded' end; end if;
  if new.workspace_result_revision is null then new.workspace_result_revision := 1; end if;
  if new.local_settings_revision is null then new.local_settings_revision := 1; end if;
  if new.customization_state is null or new.customization_state = '' then new.customization_state := 'unmodified'; end if;
  if new.definition_origin = 'workspace_custom' then
    new.source_master_record_id := null;
    new.source_master_revision := null;
    new.source_projection_schema_version := null;
    new.source_projection_snapshot := null;
    new.source_projection_sha256 := null;
  end if;
  if new.local_definition_snapshot is null then
    new.local_definition_snapshot := jsonb_build_object('schemaVersion',1,'testItemName',new.test_item_name,'resultInputType',new.result_input_type,'resultValueKind',new.result_value_kind,'resultUnit',new.result_unit,'decimalScale',new.decimal_scale);
  end if;
  if new.local_definition_sha256 is null then new.local_definition_sha256 := lower(encode(extensions.digest(convert_to(new.local_definition_snapshot::text,'UTF8'),'sha256'),'hex')); end if;
  new.historical_unattributed_usage_residual := coalesce(new.historical_unattributed_usage_residual,0);
  new.canonical_saved_result_usage_count := coalesce(new.canonical_saved_result_usage_count,0);
  new.legacy_saved_result_usage_count := coalesce(new.legacy_saved_result_usage_count,0);
  new.quarantine_saved_result_usage_count := coalesce(new.quarantine_saved_result_usage_count,0);
  return new;
end
$$;
revoke all on function private.clair_classify_lab_test_item_insert() from public,anon,authenticated,service_role;
drop trigger if exists clair_classify_lab_test_item_insert on public.lab_test_items;
create trigger clair_classify_lab_test_item_insert before insert on public.lab_test_items for each row execute function private.clair_classify_lab_test_item_insert();

create or replace function private.clair_classify_lab_link_insert()
returns trigger language plpgsql security definer set search_path = public, private, pg_catalog as $$
begin
  if nullif(pg_catalog.btrim(new.link_origin), '') is null then new.link_origin := 'legacy'; end if;
  if new.link_revision is null then new.link_revision := 1; end if;
  return new;
end
$$;
revoke all on function private.clair_classify_lab_link_insert() from public,anon,authenticated,service_role;
drop trigger if exists clair_classify_lab_link_insert on public.order_catalog_lab_test_item_links;
create trigger clair_classify_lab_link_insert before insert on public.order_catalog_lab_test_item_links for each row execute function private.clair_classify_lab_link_insert();

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.lab_test_categories'::regclass and conname = 'lab_test_categories_workspace_id_id_key') then
    alter table public.lab_test_categories add constraint lab_test_categories_workspace_id_id_key unique (workspace_id,id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.lab_test_items'::regclass and conname = 'lab_test_items_workspace_id_id_key') then
    alter table public.lab_test_items add constraint lab_test_items_workspace_id_id_key unique (workspace_id,id);
  end if;
end
$$;

-- Immutable workspace definition versions.  The table is the pin owner for a
-- link/result snapshot; the mutable current item remains only the latest
-- projection and local-settings owner.
create table if not exists public.lab_test_item_versions (
  workspace_id text not null,
  lab_test_item_id text not null,
  workspace_result_revision integer not null check (workspace_result_revision > 0),
  test_item_name text not null check (length(pg_catalog.btrim(test_item_name)) > 0),
  result_input_type text check (result_input_type is null or result_input_type in ('number','text','select','positive_negative','grade')),
  result_value_kind text check (result_value_kind is null or result_value_kind in ('numeric','text','coded')),
  result_unit text,
  decimal_scale integer check (decimal_scale is null or decimal_scale >= 0),
  definition_origin text not null check (definition_origin in ('clair_master','workspace_custom','quarantined')),
  quarantine_reason text,
  customization_state text not null check (customization_state in ('unmodified','customized')),
  source_master_record_id uuid,
  source_master_revision integer,
  source_projection_schema_version integer not null default 1,
  source_projection_snapshot jsonb,
  source_projection_sha256 text,
  local_definition_snapshot jsonb,
  local_definition_sha256 text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, lab_test_item_id, workspace_result_revision),
  foreign key (workspace_id, lab_test_item_id) references public.lab_test_items(workspace_id, id) on delete restrict,
  check ((source_master_record_id is null) = (source_master_revision is null)),
  check ((definition_origin = 'quarantined' and quarantine_reason is not null and length(pg_catalog.btrim(quarantine_reason)) > 0)
    or (definition_origin <> 'quarantined' and quarantine_reason is null)),
  check ((definition_origin = 'clair_master' and source_master_record_id is not null and source_projection_snapshot is not null and source_projection_sha256 ~ '^[0-9a-f]{64}$')
    or (definition_origin = 'workspace_custom' and source_master_record_id is null and source_projection_snapshot is null and source_projection_sha256 is null)
    or (definition_origin = 'quarantined'))
);

alter table public.lab_test_item_versions enable row level security;
revoke all on public.lab_test_item_versions from public, anon, authenticated;
grant select on public.lab_test_item_versions to authenticated;
drop policy if exists lab_test_item_versions_workspace_catalog_view on public.lab_test_item_versions;
create policy lab_test_item_versions_workspace_catalog_view
on public.lab_test_item_versions for select to authenticated
using (
  private.clair_is_active_workspace_member(workspace_id)
  and private.clair_current_user_has_workspace_permission(workspace_id, 'service_catalog:view')
);

create or replace function private.clair_reject_lab_test_item_version_mutation()
returns trigger language plpgsql security definer set search_path = public, private, pg_catalog as $$
begin
  raise exception 'lab_test_item_version_immutable';
end
$$;
revoke all on function private.clair_reject_lab_test_item_version_mutation() from public,anon,authenticated,service_role;
drop trigger if exists lab_test_item_versions_immutable on public.lab_test_item_versions;
create trigger lab_test_item_versions_immutable
before update or delete on public.lab_test_item_versions
for each row execute function private.clair_reject_lab_test_item_version_mutation();

-- Durable B1 review targets are separate from A2's order-only update queue.
-- Adoption/replay writers own inserts; authenticated catalog viewers may only
-- inspect their same-workspace status.
create table if not exists public.workspace_lab_item_updates (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id text not null,
  lab_test_item_id text not null,
  source_release_id uuid not null,
  source_release_no bigint not null,
  source_owner_record_id uuid not null,
  source_owner_revision integer not null,
  target_key text not null,
  replay_key text not null,
  source_master_record_id uuid not null,
  source_master_revision integer not null,
  update_type text not null check (update_type in ('source_changed','source_added','source_removed')),
  status text not null default 'pending' check (status in ('pending','accepted','dismissed','superseded','quarantined')),
  superseded_by_update_id uuid,
  expected_workspace_result_revision integer not null,
  changed_source_fields text[] not null default '{}',
  source_projection_snapshot jsonb not null,
  source_projection_sha256 text not null check (source_projection_sha256 ~ '^[0-9a-f]{64}$'),
  workspace_projection_snapshot jsonb not null,
  affected_catalog_item_ids text[] not null default '{}',
  created_by uuid,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (workspace_id, id),
  unique (workspace_id, replay_key),
  foreign key (workspace_id, lab_test_item_id) references public.lab_test_items(workspace_id,id) on delete restrict,
  foreign key (source_release_id) references master.master_releases(id) on delete restrict,
  foreign key (source_owner_record_id, source_owner_revision) references master.master_record_versions(master_record_id,revision) on delete restrict,
  foreign key (source_master_record_id, source_master_revision) references master.master_record_versions(master_record_id,revision) on delete restrict,
  foreign key (workspace_id, superseded_by_update_id) references public.workspace_lab_item_updates(workspace_id,id) on delete restrict
);

create table if not exists public.workspace_lab_catalog_updates (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id text not null,
  order_catalog_item_id text not null,
  source_release_id uuid not null,
  source_release_no bigint not null,
  source_owner_record_id uuid not null,
  source_owner_revision integer not null,
  target_key text not null,
  replay_key text not null,
  source_master_order_record_id uuid not null,
  source_master_order_revision integer not null,
  update_type text not null check (update_type in ('membership_changed','profile_changed')),
  status text not null default 'pending' check (status in ('pending','accepted','dismissed','superseded','quarantined')),
  superseded_by_update_id uuid,
  expected_catalog_revision integer not null,
  source_membership_projection_snapshot jsonb not null,
  source_membership_projection_sha256 text not null check (source_membership_projection_sha256 ~ '^[0-9a-f]{64}$'),
  workspace_membership_projection_snapshot jsonb not null,
  affected_lab_test_item_ids text[] not null default '{}',
  created_by uuid,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (workspace_id, id),
  unique (workspace_id, replay_key),
  foreign key (workspace_id, order_catalog_item_id) references public.order_catalog_items(workspace_id,id) on delete restrict,
  foreign key (source_release_id) references master.master_releases(id) on delete restrict,
  foreign key (source_owner_record_id, source_owner_revision) references master.master_record_versions(master_record_id,revision) on delete restrict,
  foreign key (source_master_order_record_id, source_master_order_revision) references master.master_record_versions(master_record_id,revision) on delete restrict,
  foreign key (workspace_id, superseded_by_update_id) references public.workspace_lab_catalog_updates(workspace_id,id) on delete restrict
);

alter table public.workspace_lab_item_updates enable row level security;
alter table public.workspace_lab_catalog_updates enable row level security;
revoke all on public.workspace_lab_item_updates, public.workspace_lab_catalog_updates from public,anon,authenticated;
grant select on public.workspace_lab_item_updates, public.workspace_lab_catalog_updates to authenticated;
drop policy if exists workspace_lab_item_updates_workspace_catalog_view on public.workspace_lab_item_updates;
drop policy if exists workspace_lab_catalog_updates_workspace_catalog_view on public.workspace_lab_catalog_updates;
create policy workspace_lab_item_updates_workspace_catalog_view on public.workspace_lab_item_updates
  for select to authenticated using (private.clair_is_active_workspace_member(workspace_id) and private.clair_current_user_has_workspace_permission(workspace_id,'service_catalog:view'));
create policy workspace_lab_catalog_updates_workspace_catalog_view on public.workspace_lab_catalog_updates
  for select to authenticated using (private.clair_is_active_workspace_member(workspace_id) and private.clair_current_user_has_workspace_permission(workspace_id,'service_catalog:view'));
create unique index if not exists workspace_lab_item_updates_pending_target_key
  on public.workspace_lab_item_updates(workspace_id,target_key) where status='pending';
create unique index if not exists workspace_lab_catalog_updates_pending_target_key
  on public.workspace_lab_catalog_updates(workspace_id,target_key) where status='pending';

insert into public.lab_test_item_versions (
  workspace_id, lab_test_item_id, workspace_result_revision, test_item_name,
  result_input_type, result_value_kind, result_unit, decimal_scale,
  definition_origin, customization_state, source_master_record_id,
  source_master_revision, source_projection_schema_version,
  source_projection_snapshot, source_projection_sha256,
  local_definition_snapshot, local_definition_sha256
)
select item.workspace_id, item.id, item.workspace_result_revision, item.test_item_name,
  item.result_input_type, item.result_value_kind, item.result_unit, item.decimal_scale,
  case when item.definition_origin in ('clair_master','workspace_custom') then item.definition_origin else 'quarantined' end,
  case when item.customization_state = 'customized' then 'customized' else 'unmodified' end,
  item.source_master_record_id, item.source_master_revision,
  coalesce(item.source_projection_schema_version, 1), item.source_projection_snapshot,
  item.source_projection_sha256,
  item.local_definition_snapshot,
  coalesce(item.local_definition_sha256, lower(encode(extensions.digest(convert_to(item.local_definition_snapshot::text, 'UTF8'), 'sha256'), 'hex')))
from public.lab_test_items item
where item.definition_origin in ('clair_master','workspace_custom')
on conflict (workspace_id, lab_test_item_id, workspace_result_revision) do nothing;

-- Replace the old category-only FK with a tenant-safe composite FK.
do $$
begin
  if exists (select 1 from pg_constraint where conrelid = 'public.lab_test_items'::regclass and conname = 'lab_test_items_category_id_fkey') then
    alter table public.lab_test_items drop constraint lab_test_items_category_id_fkey;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.lab_test_items'::regclass and conname = 'lab_test_items_category_workspace_fk') then
    alter table public.lab_test_items add constraint lab_test_items_category_workspace_fk
      foreign key (workspace_id, category_id) references public.lab_test_categories(workspace_id, id) on delete restrict;
  end if;
end
$$;

create unique index if not exists lab_test_items_workspace_source_unique
  on public.lab_test_items (workspace_id, source_master_record_id)
  where definition_origin = 'clair_master' and source_master_record_id is not null;

-- Authored links use typed columns as authority.  Existing links remain
-- legacy-compatible and keep their arbitrary historical snapshot JSON.
alter table public.order_catalog_lab_test_item_links
  alter column link_revision set default 1,
  alter column link_revision set not null,
  alter column link_origin set default 'legacy',
  alter column link_origin set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.order_catalog_lab_test_item_links'::regclass and conname='order_catalog_lab_link_origin_check') then
    alter table public.order_catalog_lab_test_item_links add constraint order_catalog_lab_link_origin_check check (link_origin in ('clair_master','workspace_custom','legacy','quarantined'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.order_catalog_lab_test_item_links'::regclass and conname='order_catalog_lab_profile_kind_check') then
    alter table public.order_catalog_lab_test_item_links add constraint order_catalog_lab_profile_kind_check check (profile_kind is null or profile_kind in ('panel','standalone_test'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.order_catalog_lab_test_item_links'::regclass and conname='order_catalog_lab_link_revision_check') then
    alter table public.order_catalog_lab_test_item_links add constraint order_catalog_lab_link_revision_check check (link_revision > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.order_catalog_lab_test_item_links'::regclass and conname='order_catalog_lab_source_order_pair_check') then
    alter table public.order_catalog_lab_test_item_links add constraint order_catalog_lab_source_order_pair_check check ((source_master_order_record_id is null) = (source_master_order_revision is null));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.order_catalog_lab_test_item_links'::regclass and conname='order_catalog_lab_source_panel_pair_check') then
    alter table public.order_catalog_lab_test_item_links add constraint order_catalog_lab_source_panel_pair_check check ((source_master_panel_record_id is null) = (source_master_panel_revision is null));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.order_catalog_lab_test_item_links'::regclass and conname='order_catalog_lab_source_test_pair_check') then
    alter table public.order_catalog_lab_test_item_links add constraint order_catalog_lab_source_test_pair_check check ((source_master_test_record_id is null) = (owner_pinned_source_test_revision is null));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.order_catalog_lab_test_item_links'::regclass and conname='order_catalog_lab_quarantine_reason_check') then
    alter table public.order_catalog_lab_test_item_links add constraint order_catalog_lab_quarantine_reason_check check ((link_origin = 'quarantined' and link_quarantine_reason is not null and length(pg_catalog.btrim(link_quarantine_reason)) > 0) or (link_origin in ('clair_master','workspace_custom','legacy') and link_quarantine_reason is null));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.order_catalog_items'::regclass and conname='order_catalog_lab_membership_projection_schema_check') then
    alter table public.order_catalog_items add constraint order_catalog_lab_membership_projection_schema_check check (last_applied_lab_membership_projection_schema_version is null or last_applied_lab_membership_projection_schema_version = 1);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.order_catalog_items'::regclass and conname='order_catalog_lab_membership_projection_hash_check') then
    alter table public.order_catalog_items add constraint order_catalog_lab_membership_projection_hash_check check (last_applied_lab_membership_projection_sha256 is null or last_applied_lab_membership_projection_sha256 ~ '^[0-9a-f]{64}$');
  end if;
end
$$;

create unique index if not exists order_catalog_lab_test_item_links_canonical_sort_unique
  on public.order_catalog_lab_test_item_links (workspace_id, order_catalog_item_id, effective_sort_order)
  where link_origin in ('clair_master','workspace_custom');
create unique index if not exists order_catalog_lab_test_item_links_canonical_item_unique
  on public.order_catalog_lab_test_item_links (workspace_id, order_catalog_item_id, lab_test_item_id)
  where link_origin in ('clair_master','workspace_custom');

alter table public.lab_test_categories enable row level security;
alter table public.lab_test_items enable row level security;
alter table public.order_catalog_lab_test_item_links enable row level security;
revoke all on public.lab_test_categories, public.lab_test_items, public.order_catalog_lab_test_item_links from public, anon, authenticated;
grant select on public.lab_test_categories, public.lab_test_items, public.order_catalog_lab_test_item_links to authenticated;
drop policy if exists lab_test_categories_workspace_member_select on public.lab_test_categories;
drop policy if exists lab_test_items_workspace_member_select on public.lab_test_items;
drop policy if exists order_catalog_lab_links_workspace_member_select on public.order_catalog_lab_test_item_links;
drop policy if exists lab_test_categories_workspace_catalog_view on public.lab_test_categories;
drop policy if exists lab_test_items_workspace_catalog_view on public.lab_test_items;
drop policy if exists order_catalog_lab_links_workspace_catalog_view on public.order_catalog_lab_test_item_links;
create policy lab_test_categories_workspace_catalog_view on public.lab_test_categories
  for select to authenticated using (private.clair_is_active_workspace_member(workspace_id) and private.clair_current_user_has_workspace_permission(workspace_id,'service_catalog:view'));
create policy lab_test_items_workspace_catalog_view on public.lab_test_items
  for select to authenticated using (private.clair_is_active_workspace_member(workspace_id) and private.clair_current_user_has_workspace_permission(workspace_id,'service_catalog:view'));
create policy order_catalog_lab_links_workspace_catalog_view on public.order_catalog_lab_test_item_links
  for select to authenticated using (private.clair_is_active_workspace_member(workspace_id) and private.clair_current_user_has_workspace_permission(workspace_id,'service_catalog:view'));

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.order_catalog_lab_test_item_links'::regclass and conname='order_catalog_lab_links_workspace_id_id_key') then
    alter table public.order_catalog_lab_test_item_links add constraint order_catalog_lab_links_workspace_id_id_key unique (workspace_id,id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.order_catalog_lab_test_item_links'::regclass and conname='order_catalog_lab_links_workspace_catalog_item_fk') then
    alter table public.order_catalog_lab_test_item_links add constraint order_catalog_lab_links_workspace_catalog_item_fk foreign key (workspace_id,order_catalog_item_id) references public.order_catalog_items(workspace_id,id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.order_catalog_lab_test_item_links'::regclass and conname='order_catalog_lab_links_workspace_item_fk') then
    alter table public.order_catalog_lab_test_item_links add constraint order_catalog_lab_links_workspace_item_fk foreign key (workspace_id,lab_test_item_id) references public.lab_test_items(workspace_id,id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.order_catalog_lab_test_item_links'::regclass and conname='order_catalog_lab_links_workspace_category_fk') then
    alter table public.order_catalog_lab_test_item_links add constraint order_catalog_lab_links_workspace_category_fk foreign key (workspace_id,lab_test_category_id) references public.lab_test_categories(workspace_id,id) on delete restrict not valid;
  end if;
  alter table public.order_catalog_lab_test_item_links drop constraint if exists order_catalog_lab_test_item_links_order_catalog_item_id_fkey;
  alter table public.order_catalog_lab_test_item_links drop constraint if exists order_catalog_lab_test_item_links_lab_test_item_id_fkey;
  alter table public.order_catalog_lab_test_item_links drop constraint if exists order_catalog_lab_test_item_links_lab_test_category_id_fkey;
  alter table public.order_catalog_lab_test_item_links drop constraint if exists order_catalog_lab_authored_projection_check;
  alter table public.order_catalog_lab_test_item_links add constraint order_catalog_lab_authored_projection_check check (
    (
      link_origin in ('legacy','quarantined')
      and profile_kind is null
      and source_master_order_record_id is null and source_master_order_revision is null
      and source_master_panel_record_id is null and source_master_panel_revision is null
      and source_master_test_record_id is null and owner_pinned_source_test_revision is null
      and source_ordinal is null and effective_sort_order is null
      and pinned_workspace_result_revision is null and required is null and display_group is null
      and snapshot_metadata_schema_version is null and snapshot_metadata_sha256 is null
      and ((link_origin='legacy' and link_quarantine_reason is null)
        or (link_origin='quarantined' and link_quarantine_reason is not null and pg_catalog.btrim(link_quarantine_reason) <> ''))
    )
    or (
      link_origin in ('clair_master','workspace_custom')
      and profile_kind in ('panel','standalone_test')
      and source_master_order_record_id is not null and source_master_order_revision is not null
      and effective_sort_order is not null and effective_sort_order >= 0
      and pinned_workspace_result_revision is not null and required is not null
      and snapshot_metadata_schema_version = 2 and snapshot_metadata_sha256 ~ '^[0-9a-f]{64}$'
      and (
        (link_origin='clair_master'
          and source_master_test_record_id is not null and owner_pinned_source_test_revision is not null
          and ((profile_kind='panel' and source_master_panel_record_id is not null and source_master_panel_revision is not null and source_ordinal is not null)
            or (profile_kind='standalone_test' and source_master_panel_record_id is null and source_master_panel_revision is null and source_ordinal is null)))
        or (link_origin='workspace_custom'
          and profile_kind='panel'
          and source_master_panel_record_id is not null and source_master_panel_revision is not null
          and source_master_test_record_id is null and owner_pinned_source_test_revision is null and source_ordinal is null)
      )
    )
  );
end
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.order_catalog_lab_test_item_links'::regclass and conname='order_catalog_lab_links_workspace_item_version_fk') then
    alter table public.order_catalog_lab_test_item_links add constraint order_catalog_lab_links_workspace_item_version_fk
      foreign key (workspace_id,lab_test_item_id,pinned_workspace_result_revision)
      references public.lab_test_item_versions(workspace_id,lab_test_item_id,workspace_result_revision)
      on delete restrict not valid;
  end if;
end
$$;

-- Frozen result-definition header/row columns.  Defaults are removed after
-- the one-time classifier below; a runtime write must choose canonical,
-- legacy, or quarantine explicitly.
alter table public.lab_result_entries
  add column if not exists entry_write_revision integer,
  add column if not exists source_workspace_catalog_item_id text,
  add column if not exists source_workspace_catalog_revision integer,
  add column if not exists source_master_order_record_id uuid,
  add column if not exists source_master_order_revision integer,
  add column if not exists source_master_panel_record_id uuid,
  add column if not exists source_master_panel_revision integer,
  add column if not exists source_master_test_record_id uuid,
  add column if not exists source_master_test_revision integer,
  add column if not exists result_definition_snapshot jsonb,
  add column if not exists result_definition_snapshot_sha256 text,
  add column if not exists result_definition_origin text,
  add column if not exists result_quarantine_reason text;

alter table public.lab_result_entry_rows
  add column if not exists row_definition_origin text,
  add column if not exists workspace_result_revision integer,
  add column if not exists source_master_test_record_id uuid,
  add column if not exists owner_pinned_source_test_revision integer,
  add column if not exists item_version_source_master_record_id uuid,
  add column if not exists item_version_source_test_revision integer,
  add column if not exists result_value_kind text,
  add column if not exists result_input_type text,
  add column if not exists decimal_scale integer,
  add column if not exists source_ordinal integer,
  add column if not exists effective_sort_order integer,
  add column if not exists required boolean,
  add column if not exists display_group text;

update public.lab_result_entries
set entry_write_revision = coalesce(entry_write_revision, 0),
    result_definition_snapshot = coalesce(result_definition_snapshot, '{}'::jsonb),
    result_definition_origin = coalesce(result_definition_origin, 'legacy'),
    result_definition_snapshot_sha256 = case
      when coalesce(result_definition_origin, 'legacy') in ('canonical', 'quarantined')
        then result_definition_snapshot_sha256
      else null
    end,
    result_quarantine_reason = case
      when coalesce(result_definition_origin, 'legacy') = 'quarantined'
        then result_quarantine_reason
      else null
    end;

update public.lab_result_entry_rows row
set row_definition_origin = coalesce(row_definition_origin, 'legacy'),
    workspace_result_revision = case
      when coalesce(row_definition_origin, 'legacy') in ('clair_master', 'workspace_custom')
        then workspace_result_revision
      else null
    end,
    source_master_test_record_id = case
      when coalesce(row_definition_origin, 'legacy') in ('clair_master', 'workspace_custom')
        then source_master_test_record_id
      else null
    end,
    owner_pinned_source_test_revision = case
      when coalesce(row_definition_origin, 'legacy') in ('clair_master', 'workspace_custom')
        then owner_pinned_source_test_revision
      else null
    end,
    item_version_source_master_record_id = case
      when coalesce(row_definition_origin, 'legacy') in ('clair_master', 'workspace_custom')
        then item_version_source_master_record_id
      else null
    end,
    item_version_source_test_revision = case
      when coalesce(row_definition_origin, 'legacy') in ('clair_master', 'workspace_custom')
        then item_version_source_test_revision
      else null
    end,
    result_value_kind = case
      when coalesce(row_definition_origin, 'legacy') in ('clair_master', 'workspace_custom')
        then result_value_kind
      else null
    end,
    result_input_type = case
      when coalesce(row_definition_origin, 'legacy') in ('clair_master', 'workspace_custom')
        then result_input_type
      else null
    end,
    decimal_scale = case
      when coalesce(row_definition_origin, 'legacy') in ('clair_master', 'workspace_custom')
        then decimal_scale
      else null
    end,
    source_ordinal = case
      when coalesce(row_definition_origin, 'legacy') in ('clair_master', 'workspace_custom')
        then source_ordinal
      else null
    end,
    effective_sort_order = case
      when coalesce(row_definition_origin, 'legacy') in ('clair_master', 'workspace_custom')
        then effective_sort_order
      else null
    end,
    required = case
      when coalesce(row_definition_origin, 'legacy') in ('clair_master', 'workspace_custom')
        then required
      else null
    end,
    display_group = case
      when coalesce(row_definition_origin, 'legacy') in ('clair_master', 'workspace_custom')
        then display_group
      else null
    end;

-- Existing result rows are classified by immutable parent scope only.  Direct
-- lineage with a missing/invalid snapshot is quarantined; no old service/name
-- or JSON field is promoted to canonical.
do $$
declare
  v_entry record;
  v_reason text;
begin
  for v_entry in
    select entry.*,
      order_row.workspace_catalog_item_id as parent_catalog_item_id,
      order_row.workspace_catalog_revision as parent_catalog_revision,
      order_row.service_item_id as parent_service_item_id,
      order_row.encounter_id as parent_encounter_id
    from public.lab_result_entries entry
    left join public.orders order_row
      on order_row.workspace_id = entry.workspace_id and order_row.id = entry.order_id
  loop
    v_reason := null;
    if v_entry.result_definition_origin = 'canonical'
       and v_entry.parent_encounter_id = v_entry.encounter_id
       and v_entry.parent_catalog_item_id is not null
       and v_entry.parent_catalog_revision is not null
       and v_entry.source_workspace_catalog_item_id = v_entry.parent_catalog_item_id
       and v_entry.source_workspace_catalog_revision = v_entry.parent_catalog_revision
       and v_entry.result_definition_snapshot <> '{}'::jsonb
       and v_entry.result_definition_snapshot_sha256 = private.clinical_master_sha256(v_entry.result_definition_snapshot)
       and v_entry.result_quarantine_reason is null then
      update public.lab_result_entries
      set result_definition_origin = 'canonical', result_quarantine_reason = null
      where id = v_entry.id;
    elsif v_entry.parent_catalog_item_id is null
       -- Service-backed rows are a permitted pre-B1 legacy branch.  The
       -- absence of a workspace catalog pin is the classification boundary;
       -- service_item_id is retained as historical evidence and must not be
       -- treated as an invented master lineage.
       and v_entry.result_definition_snapshot = '{}'::jsonb
       and v_entry.result_definition_snapshot_sha256 is null
       and v_entry.source_workspace_catalog_item_id is null
       and v_entry.source_master_order_record_id is null
       and v_entry.source_master_panel_record_id is null
       and v_entry.source_master_test_record_id is null
       and v_entry.parent_encounter_id = v_entry.encounter_id then
      update public.lab_result_entries
      set result_definition_origin = 'legacy', result_quarantine_reason = null
      where id = v_entry.id;
      update public.lab_result_entry_rows
      set row_definition_origin = 'legacy',
          workspace_result_revision = null,
          source_master_test_record_id = null,
          owner_pinned_source_test_revision = null,
          item_version_source_master_record_id = null,
          item_version_source_test_revision = null,
          result_value_kind = null,
          result_input_type = null,
          decimal_scale = null,
          source_ordinal = null,
          effective_sort_order = null,
          required = null,
          display_group = null
      where lab_result_entry_id = v_entry.id;
    else
      v_reason := case
        when v_entry.parent_encounter_id is null then 'cross_workspace_parent'
        when v_entry.parent_encounter_id is distinct from v_entry.encounter_id then 'parent_mismatch'
        when v_entry.parent_catalog_item_id is not null and (v_entry.result_definition_snapshot = '{}'::jsonb or v_entry.result_definition_snapshot_sha256 is null) then 'direct_lineage_missing_snapshot'
        when v_entry.result_definition_origin not in ('canonical','legacy','quarantined') then 'origin_conflict'
        else 'preexisting_definition_invalid'
      end;
      update public.lab_result_entries
      set result_definition_origin = 'quarantined', result_quarantine_reason = v_reason
      where id = v_entry.id;
      update public.lab_result_entry_rows
      set row_definition_origin = 'quarantined',
          workspace_result_revision = null,
          source_master_test_record_id = null,
          owner_pinned_source_test_revision = null,
          item_version_source_master_record_id = null,
          item_version_source_test_revision = null,
          result_value_kind = null,
          result_input_type = null,
          decimal_scale = null,
          source_ordinal = null,
          effective_sort_order = null,
          required = null,
          display_group = null
      where lab_result_entry_id = v_entry.id;
    end if;
  end loop;
end
$$;

alter table public.lab_result_entries alter column entry_write_revision set default 0;
alter table public.lab_result_entries alter column entry_write_revision set not null;
alter table public.lab_result_entries alter column result_definition_snapshot set default '{}'::jsonb;
alter table public.lab_result_entries alter column result_definition_snapshot set not null;
alter table public.lab_result_entries alter column result_definition_origin set default 'legacy';
alter table public.lab_result_entries alter column result_definition_origin set not null;
-- Classification above is the one-time compatibility decision.  New writes
-- must name their origin/snapshot explicitly; a runtime NULL/{} default would
-- silently manufacture legacy evidence around the canonical writer.
alter table public.lab_result_entries alter column result_definition_snapshot drop default;
alter table public.lab_result_entries alter column result_definition_origin drop default;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.lab_result_entries'::regclass and conname='lab_result_entries_origin_check') then
    alter table public.lab_result_entries add constraint lab_result_entries_origin_check check (result_definition_origin in ('canonical','legacy','quarantined'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lab_result_entries'::regclass and conname='lab_result_entries_snapshot_object_check') then
    alter table public.lab_result_entries add constraint lab_result_entries_snapshot_object_check check (jsonb_typeof(result_definition_snapshot) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lab_result_entries'::regclass and conname='lab_result_entries_source_order_pair_check') then
    alter table public.lab_result_entries add constraint lab_result_entries_source_order_pair_check check ((source_master_order_record_id is null) = (source_master_order_revision is null));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lab_result_entries'::regclass and conname='lab_result_entries_source_panel_pair_check') then
    alter table public.lab_result_entries add constraint lab_result_entries_source_panel_pair_check check ((source_master_panel_record_id is null) = (source_master_panel_revision is null));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lab_result_entries'::regclass and conname='lab_result_entries_source_test_pair_check') then
    alter table public.lab_result_entries add constraint lab_result_entries_source_test_pair_check check ((source_master_test_record_id is null) = (source_master_test_revision is null));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lab_result_entries'::regclass and conname='lab_result_entries_origin_snapshot_check') then
    alter table public.lab_result_entries add constraint lab_result_entries_origin_snapshot_check check (
      (result_definition_origin = 'legacy' and source_workspace_catalog_item_id is null and source_workspace_catalog_revision is null and source_master_order_record_id is null and source_master_order_revision is null and source_master_panel_record_id is null and source_master_panel_revision is null and source_master_test_record_id is null and source_master_test_revision is null and result_definition_snapshot = '{}'::jsonb and result_definition_snapshot_sha256 is null and result_quarantine_reason is null)
      or (result_definition_origin = 'canonical' and source_workspace_catalog_item_id is not null and source_workspace_catalog_revision is not null and source_master_order_record_id is not null and source_master_order_revision is not null and result_definition_snapshot <> '{}'::jsonb and result_definition_snapshot_sha256 ~ '^[0-9a-f]{64}$' and result_quarantine_reason is null)
      or (result_definition_origin = 'quarantined' and result_quarantine_reason is not null and length(pg_catalog.btrim(result_quarantine_reason)) > 0)
    );
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lab_result_entry_rows'::regclass and conname='lab_result_entry_rows_origin_check') then
    alter table public.lab_result_entry_rows add constraint lab_result_entry_rows_origin_check check (row_definition_origin in ('clair_master','workspace_custom','legacy','quarantined'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lab_result_entry_rows'::regclass and conname='lab_result_entry_rows_value_kind_check') then
    alter table public.lab_result_entry_rows add constraint lab_result_entry_rows_value_kind_check check (result_value_kind is null or result_value_kind in ('numeric','text','coded'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lab_result_entry_rows'::regclass and conname='lab_result_entry_rows_input_type_check') then
    alter table public.lab_result_entry_rows add constraint lab_result_entry_rows_input_type_check check (result_input_type is null or result_input_type in ('number','text','select','positive_negative','grade'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lab_result_entry_rows'::regclass and conname='lab_result_entry_rows_decimal_scale_check') then
    alter table public.lab_result_entry_rows add constraint lab_result_entry_rows_decimal_scale_check check (decimal_scale is null or decimal_scale >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lab_result_entry_rows'::regclass and conname='lab_result_entry_rows_source_test_pair_check') then
    alter table public.lab_result_entry_rows add constraint lab_result_entry_rows_source_test_pair_check check ((item_version_source_master_record_id is null) = (item_version_source_test_revision is null));
  end if;
end
$$;

create unique index if not exists lab_result_entries_canonical_order_unique
  on public.lab_result_entries (workspace_id, order_id)
  where result_definition_origin = 'canonical';

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.lab_result_entries'::regclass and conname='lab_result_entries_workspace_id_id_key') then
    alter table public.lab_result_entries add constraint lab_result_entries_workspace_id_id_key unique (workspace_id,id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.orders'::regclass and conname='orders_workspace_id_id_key') then
    alter table public.orders add constraint orders_workspace_id_id_key unique (workspace_id,id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.encounters'::regclass and conname='encounters_workspace_id_id_key') then
    alter table public.encounters add constraint encounters_workspace_id_id_key unique (workspace_id,id);
  end if;
end
$$;

-- New canonical parent/row keys.  Existing incompatible rows remain visible in
-- the preflight report; these constraints enforce every future write.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.lab_result_entries'::regclass and conname = 'lab_result_entries_workspace_order_fk') then
    alter table public.lab_result_entries add constraint lab_result_entries_workspace_order_fk
      foreign key (workspace_id, order_id) references public.orders(workspace_id, id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.lab_result_entries'::regclass and conname = 'lab_result_entries_workspace_encounter_fk') then
    alter table public.lab_result_entries add constraint lab_result_entries_workspace_encounter_fk
      foreign key (workspace_id, encounter_id) references public.encounters(workspace_id, id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.lab_result_entry_rows'::regclass and conname = 'lab_result_entry_rows_workspace_entry_fk') then
    alter table public.lab_result_entry_rows add constraint lab_result_entry_rows_workspace_entry_fk
      foreign key (workspace_id, lab_result_entry_id) references public.lab_result_entries(workspace_id, id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.lab_result_entry_rows'::regclass and conname = 'lab_result_entry_rows_workspace_item_fk') then
    alter table public.lab_result_entry_rows add constraint lab_result_entry_rows_workspace_item_fk
      foreign key (workspace_id, lab_test_item_id) references public.lab_test_items(workspace_id, id) on delete restrict not valid;
  end if;
  alter table public.lab_result_entries drop constraint if exists lab_result_entries_order_id_fkey;
  alter table public.lab_result_entries drop constraint if exists lab_result_entries_encounter_id_fkey;
  alter table public.lab_result_entry_rows drop constraint if exists lab_result_entry_rows_lab_result_entry_id_fkey;
  alter table public.lab_result_entry_rows drop constraint if exists lab_result_entry_rows_lab_test_item_id_fkey;
end
$$;

-- Classify usage once before installing the exact persisted-count invariant.
-- The old aggregate is retained as a fixed residual; current origin buckets
-- are counted from mutually exclusive classified row references and never
-- absorb or shrink that historical baseline during normal runtime writes.
do $$
declare
  v_item record;
  v_canonical integer;
  v_legacy integer;
  v_quarantine integer;
  v_attributable integer;
begin
  for v_item in
    select workspace_id,id,saved_result_usage_count,historical_unattributed_usage_residual
    from public.lab_test_items
    order by workspace_id,id
    for update
  loop
    with classified_refs as (
      select distinct row.workspace_id, row.lab_result_entry_id, row.lab_test_item_id,
        entry.result_definition_origin
      from public.lab_result_entry_rows row
      join public.lab_result_entries entry
        on entry.workspace_id=row.workspace_id and entry.id=row.lab_result_entry_id
      where row.workspace_id=v_item.workspace_id and row.lab_test_item_id=v_item.id
        and (
          (entry.result_definition_origin='canonical' and row.row_definition_origin in ('clair_master','workspace_custom'))
          or (entry.result_definition_origin='legacy' and row.row_definition_origin='legacy')
          or (entry.result_definition_origin='quarantined' and row.row_definition_origin='quarantined')
        )
    )
    select count(*) filter (where result_definition_origin='canonical')::integer,
           count(*) filter (where result_definition_origin='legacy')::integer,
           count(*) filter (where result_definition_origin='quarantined')::integer
      into v_canonical,v_legacy,v_quarantine
    from classified_refs;
    if exists (
      select 1
      from public.lab_result_entry_rows row
      join public.lab_result_entries entry
        on entry.workspace_id=row.workspace_id and entry.id=row.lab_result_entry_id
      where row.workspace_id=v_item.workspace_id and row.lab_test_item_id=v_item.id
        and not (
          (entry.result_definition_origin='canonical' and row.row_definition_origin in ('clair_master','workspace_custom'))
          or (entry.result_definition_origin='legacy' and row.row_definition_origin='legacy')
          or (entry.result_definition_origin='quarantined' and row.row_definition_origin='quarantined')
        )
    ) then
      raise exception 'lab_result_usage_classification_invalid'
        using errcode='23514', detail=v_item.workspace_id || ':' || v_item.id;
    end if;
    v_attributable := coalesce(v_canonical,0)+coalesce(v_legacy,0)+coalesce(v_quarantine,0);
    update public.lab_test_items
    set historical_unattributed_usage_residual = greatest(
          coalesce(v_item.saved_result_usage_count,0)-v_attributable,0),
        canonical_saved_result_usage_count=coalesce(v_canonical,0),
        legacy_saved_result_usage_count=coalesce(v_legacy,0),
        quarantine_saved_result_usage_count=coalesce(v_quarantine,0),
        saved_result_usage_count=greatest(coalesce(v_item.saved_result_usage_count,0),v_attributable),
        updated_at=updated_at
    where workspace_id=v_item.workspace_id and id=v_item.id;
  end loop;
end
$$;

alter table public.lab_test_items
  alter column historical_unattributed_usage_residual set default 0,
  alter column historical_unattributed_usage_residual set not null,
  alter column canonical_saved_result_usage_count set default 0,
  alter column canonical_saved_result_usage_count set not null,
  alter column legacy_saved_result_usage_count set default 0,
  alter column legacy_saved_result_usage_count set not null,
  alter column quarantine_saved_result_usage_count set default 0,
  alter column quarantine_saved_result_usage_count set not null;

do $$
begin
  alter table public.lab_test_items drop constraint if exists lab_test_items_saved_result_usage_count_check;
  alter table public.lab_test_items add constraint lab_test_items_saved_result_usage_count_check
    check (saved_result_usage_count >= 0);
  if not exists (select 1 from pg_constraint where conrelid='public.lab_test_items'::regclass and conname='lab_test_items_saved_result_usage_components_check') then
    alter table public.lab_test_items add constraint lab_test_items_saved_result_usage_components_check
      check (historical_unattributed_usage_residual >= 0
        and canonical_saved_result_usage_count >= 0
        and legacy_saved_result_usage_count >= 0
        and quarantine_saved_result_usage_count >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lab_test_items'::regclass and conname='lab_test_items_saved_result_usage_sum_check') then
    alter table public.lab_test_items add constraint lab_test_items_saved_result_usage_sum_check
      check (saved_result_usage_count = historical_unattributed_usage_residual
        + legacy_saved_result_usage_count + canonical_saved_result_usage_count
        + quarantine_saved_result_usage_count);
  end if;
end
$$;

-- Patient result tables are never a direct authenticated Data API surface.  A
-- security-definer getter/save RPC below is the only new-flow boundary.
revoke all on public.lab_result_entries, public.lab_result_entry_rows from anon, authenticated;
alter table public.lab_result_entries enable row level security;
alter table public.lab_result_entry_rows enable row level security;
drop policy if exists lab_result_entries_workspace_member_select on public.lab_result_entries;
drop policy if exists lab_result_entries_workspace_member_write on public.lab_result_entries;
drop policy if exists lab_result_entry_rows_workspace_member_select on public.lab_result_entry_rows;
drop policy if exists lab_result_entry_rows_workspace_member_write on public.lab_result_entry_rows;

create or replace function private.clinical_master_sha256(p_value jsonb)
returns text language sql immutable set search_path = '' as $$
  select lower(encode(extensions.digest(convert_to(p_value::text, 'UTF8'), 'sha256'), 'hex'))
$$;
revoke all on function private.clinical_master_sha256(jsonb) from public, anon, authenticated, service_role;

create or replace function private.clair_recompute_lab_test_item_saved_result_usage(
  p_workspace_id text,
  p_lab_test_item_id text
)
returns integer language plpgsql security definer set search_path = public, private, pg_catalog as $$
declare
  v_canonical integer := 0;
  v_legacy integer := 0;
  v_quarantine integer := 0;
  v_total integer := 0;
  v_residual integer := 0;
begin
  perform 1 from public.lab_test_items item
  where item.workspace_id=p_workspace_id and item.id=p_lab_test_item_id
  for update;
  if not found then raise exception 'lab_test_item_not_found'; end if;
  if exists (
    select 1
    from public.lab_result_entry_rows row
    join public.lab_result_entries entry on entry.workspace_id=row.workspace_id and entry.id=row.lab_result_entry_id
    where row.workspace_id=p_workspace_id and row.lab_test_item_id=p_lab_test_item_id
      and not (
        (entry.result_definition_origin='canonical' and row.row_definition_origin in ('clair_master','workspace_custom'))
        or (entry.result_definition_origin='legacy' and row.row_definition_origin='legacy')
        or (entry.result_definition_origin='quarantined' and row.row_definition_origin='quarantined')
      )
  ) then
    raise exception 'lab_result_usage_classification_invalid'
      using errcode='23514', detail=p_workspace_id || ':' || p_lab_test_item_id;
  end if;
  with classified_refs as (
    select distinct row.workspace_id, row.lab_result_entry_id, row.lab_test_item_id,
      entry.result_definition_origin
    from public.lab_result_entry_rows row
    join public.lab_result_entries entry on entry.workspace_id = row.workspace_id and entry.id = row.lab_result_entry_id
    where row.workspace_id = p_workspace_id and row.lab_test_item_id = p_lab_test_item_id
      and (
        (entry.result_definition_origin='canonical' and row.row_definition_origin in ('clair_master','workspace_custom'))
        or (entry.result_definition_origin='legacy' and row.row_definition_origin='legacy')
        or (entry.result_definition_origin='quarantined' and row.row_definition_origin='quarantined')
      )
  )
  select count(*) filter (where result_definition_origin = 'canonical'),
         count(*) filter (where result_definition_origin = 'legacy'),
         count(*) filter (where result_definition_origin = 'quarantined')
    into v_canonical, v_legacy, v_quarantine
  from classified_refs;
  select coalesce(historical_unattributed_usage_residual, 0) into v_residual
  from public.lab_test_items where workspace_id = p_workspace_id and id = p_lab_test_item_id;
  v_total := v_residual + v_canonical + v_legacy + v_quarantine;
  update public.lab_test_items
  set canonical_saved_result_usage_count = v_canonical,
      legacy_saved_result_usage_count = v_legacy,
      quarantine_saved_result_usage_count = v_quarantine,
      saved_result_usage_count = v_total,
      updated_at = now()
  where workspace_id = p_workspace_id and id = p_lab_test_item_id;
  return v_total;
end
$$;
revoke all on function private.clair_recompute_lab_test_item_saved_result_usage(text,text) from public, anon, authenticated, service_role;

create or replace function private.clair_recompute_lab_test_item_saved_result_usage_batch(
  p_workspace_id text,
  p_lab_test_item_ids text[]
)
returns jsonb language plpgsql security definer set search_path = public, private, pg_catalog as $$
declare
  v_id text;
  v_rows jsonb := '[]'::jsonb;
begin
  for v_id in select distinct value from unnest(coalesce(p_lab_test_item_ids, '{}')) values(value) order by value loop
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'labTestItemId', v_id,
      'savedResultUsageCount', private.clair_recompute_lab_test_item_saved_result_usage(p_workspace_id, v_id)
    ));
  end loop;
  return v_rows;
end
$$;
revoke all on function private.clair_recompute_lab_test_item_saved_result_usage_batch(text,text[]) from public, anon, authenticated, service_role;

-- New canonical rows are checked against the stored snapshot, never against a
-- mutable current catalog/master row.  This helper is intentionally private;
-- getter/save invoke it only after their actor/permission checks.
create or replace function private.clair_assert_lab_result_definition_snapshot(
  p_workspace_id text,
  p_result_entry_id uuid
)
returns void language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_entry public.lab_result_entries%rowtype;
  v_snapshot jsonb;
  v_row jsonb;
  v_actual_count integer;
  v_expected_count integer;
  v_id text;
  v_ordinal integer;
begin
  select * into v_entry
  from public.lab_result_entries
  where workspace_id = p_workspace_id and id = p_result_entry_id
  for update;
  if not found then raise exception 'lab_result_not_found'; end if;
  if v_entry.result_definition_origin <> 'canonical' then return; end if;
  if v_entry.result_definition_snapshot_sha256 is distinct from private.clinical_master_sha256(v_entry.result_definition_snapshot) then
    raise exception 'lab_result_definition_snapshot_invalid';
  end if;
  if v_entry.result_definition_snapshot->>'schemaVersion' <> '1' then
    raise exception 'lab_result_definition_snapshot_invalid';
  end if;
  v_expected_count := jsonb_array_length(coalesce(v_entry.result_definition_snapshot->'rows', '[]'::jsonb));
  select count(*) into v_actual_count
  from public.lab_result_entry_rows row
  where row.workspace_id = p_workspace_id and row.lab_result_entry_id = p_result_entry_id;
  if v_actual_count <> v_expected_count then raise exception 'lab_result_definition_snapshot_invalid'; end if;
  for v_row in select value from jsonb_array_elements(v_entry.result_definition_snapshot->'rows') as rows(value) loop
    v_id := v_row->>'rowId';
    select count(*) into v_actual_count from public.lab_result_entry_rows row
      where row.workspace_id = p_workspace_id and row.lab_result_entry_id = p_result_entry_id and row.row_id = v_id;
    if v_actual_count <> 1 then raise exception 'lab_result_definition_snapshot_invalid'; end if;
    select row.sort_order into v_ordinal
    from public.lab_result_entry_rows row
    where row.workspace_id = p_workspace_id and row.lab_result_entry_id = p_result_entry_id and row.row_id = v_id
      and row.row_definition_origin in ('clair_master','workspace_custom')
      and row.workspace_result_revision = nullif(v_row->>'workspaceResultRevision','')::integer
      and row.lab_test_item_id = v_row->>'labTestItemId'
      and row.analyte_name = v_row->>'analyteName'
      and row.result_input_type = v_row->>'resultInputType'
      and row.result_value_kind = v_row->>'resultValueKind'
      and row.result_unit is not distinct from nullif(v_row->>'unit','')
      and row.reference_range is null
      and row.sort_order = nullif(v_row->>'ordinal','')::integer
      and row.effective_sort_order = nullif(v_row->>'effectiveSortOrder','')::integer
      and row.source_ordinal is not distinct from nullif(v_row->>'sourceOrdinal','')::integer
      and row.required = (v_row->>'required')::boolean
      and row.display_group is not distinct from nullif(v_row->>'displayGroup','');
    if not found then raise exception 'lab_result_definition_snapshot_invalid'; end if;
  end loop;
end
$$;
revoke all on function private.clair_assert_lab_result_definition_snapshot(text,uuid) from public, anon, authenticated, service_role;

-- Forward publisher contract.  Relation arrays are separate from typed detail
-- and are included in the PostgreSQL fingerprint/revision content.
create or replace function private.clinical_master_assert_detail_keys(p_record_type text, p_detail jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare
  v_key text;
  v_allowed text[];
begin
  if pg_catalog.jsonb_typeof(p_detail) <> 'object' then
    raise exception 'clinical_master_detail_object_required' using errcode = '22023';
  end if;
  v_allowed := case p_record_type
    when 'order_category' then array['categoryCode','categoryLevel','parentMasterKey','sortOrder']
    when 'clinical_action' then array['tCategoryKey','itemType','isOtherUnclassified']
    when 'chart_group' then array['groupCode','sortOrder']
    when 'task_route' then array['routeCode','destinationModule','taskRequired','runtimeStatus']
    when 'order' then array['classificationPathKey','defaultSalesUnitCode','defaultBillingReflectionEnabled','defaultQuantity','species']
    when 'species' then array['speciesCode']
    when 'unit' then array['unitCode','symbol','decimalScale']
    when 'specimen_type' then array['specimenCode']
    when 'result_input_type' then array['inputCode','valueKind','supportsUnit']
    when 'lab_test' then array['testCode','resultInputTypeKey','canonicalUnitKey','decimalScale']
    when 'lab_panel' then array['panelCode']
    else array[]::text[]
  end;
  for v_key in select key from pg_catalog.jsonb_object_keys(p_detail) as keys(key) loop
    if not (v_key = any(v_allowed)) then
      raise exception 'clinical_master_unknown_detail_field' using errcode = '22023', detail = v_key;
    end if;
  end loop;
end
$$;

create or replace function private.clinical_master_canonicalize_detail(p_record_type text, p_detail jsonb)
returns jsonb language sql immutable set search_path = '' as $$
select case p_record_type
  when 'lab_test' then pg_catalog.jsonb_build_object(
    'testCode', pg_catalog.btrim(p_detail->>'testCode'),
    'resultInputTypeKey', pg_catalog.btrim(p_detail->>'resultInputTypeKey'),
    'canonicalUnitKey', nullif(pg_catalog.btrim(p_detail->>'canonicalUnitKey'), ''),
    'decimalScale', case when p_detail ? 'decimalScale' and p_detail->>'decimalScale' is not null then (p_detail->>'decimalScale')::integer else null end
  )
  when 'lab_panel' then pg_catalog.jsonb_build_object('panelCode', pg_catalog.btrim(p_detail->>'panelCode'))
  when 'order_category' then pg_catalog.jsonb_build_object('categoryCode', pg_catalog.btrim(p_detail->>'categoryCode'), 'categoryLevel', pg_catalog.btrim(p_detail->>'categoryLevel'), 'parentMasterKey', nullif(pg_catalog.btrim(p_detail->>'parentMasterKey'), ''), 'sortOrder', coalesce((p_detail->>'sortOrder')::integer, 0))
  when 'clinical_action' then pg_catalog.jsonb_build_object('tCategoryKey', pg_catalog.btrim(p_detail->>'tCategoryKey'), 'itemType', pg_catalog.btrim(p_detail->>'itemType'), 'isOtherUnclassified', coalesce((p_detail->>'isOtherUnclassified')::boolean, false))
  when 'chart_group' then pg_catalog.jsonb_build_object('groupCode', pg_catalog.btrim(p_detail->>'groupCode'), 'sortOrder', coalesce((p_detail->>'sortOrder')::integer, 0))
  when 'task_route' then pg_catalog.jsonb_build_object('routeCode', pg_catalog.btrim(p_detail->>'routeCode'), 'destinationModule', nullif(pg_catalog.btrim(p_detail->>'destinationModule'), ''), 'taskRequired', (p_detail->>'taskRequired')::boolean, 'runtimeStatus', nullif(pg_catalog.btrim(p_detail->>'runtimeStatus'), ''))
  when 'order' then pg_catalog.jsonb_build_object('classificationPathKey', pg_catalog.btrim(p_detail->>'classificationPathKey'), 'defaultSalesUnitCode', nullif(pg_catalog.btrim(p_detail->>'defaultSalesUnitCode'), ''), 'defaultBillingReflectionEnabled', coalesce((p_detail->>'defaultBillingReflectionEnabled')::boolean, true), 'defaultQuantity', coalesce((p_detail->>'defaultQuantity')::numeric, 1), 'species', coalesce((select pg_catalog.jsonb_agg(value order by value #>> '{}') from pg_catalog.jsonb_array_elements(coalesce(p_detail->'species','[]'::jsonb)) as species(value)), '[]'::jsonb))
  when 'species' then pg_catalog.jsonb_build_object('speciesCode', pg_catalog.btrim(p_detail->>'speciesCode'))
  when 'unit' then pg_catalog.jsonb_build_object('unitCode', pg_catalog.btrim(p_detail->>'unitCode'), 'symbol', pg_catalog.btrim(p_detail->>'symbol'), 'decimalScale', coalesce((p_detail->>'decimalScale')::integer, 0))
  when 'specimen_type' then pg_catalog.jsonb_build_object('specimenCode', pg_catalog.btrim(p_detail->>'specimenCode'))
  when 'result_input_type' then pg_catalog.jsonb_build_object('inputCode', pg_catalog.btrim(p_detail->>'inputCode'), 'valueKind', pg_catalog.btrim(p_detail->>'valueKind'), 'supportsUnit', coalesce((p_detail->>'supportsUnit')::boolean, false))
  else coalesce(p_detail, '{}'::jsonb)
end
$$;

create or replace function private.clinical_master_assert_contract_keys(p_contract text, p_value jsonb)
returns void language plpgsql set search_path = '' as $$
declare v_key text; v_allowed text[];
begin
  if pg_catalog.jsonb_typeof(p_value) <> 'object' then raise exception 'clinical_master_contract_object_required' using errcode = '22023', detail = p_contract; end if;
  v_allowed := case p_contract
    when 'payload' then array['releaseKey','releaseNotes','publishedByLabel','records','classificationPaths','labPanelItems','labOrderProfiles']
    when 'record' then array['masterKey','recordType','lifecycleStatus','safetyStatus','safetyReason','names','source','detail']
    when 'name' then array['languageCode','nameKind','name','searchable','sortOrder']
    when 'source' then array['sourceType','title','referenceUri','sourceVersion','accessedAt','licenseNotes']
    when 'path' then array['pathKey','clinicalActionKey','chartGroupKey','taskRouteKey']
    else array[]::text[] end;
  for v_key in select key from pg_catalog.jsonb_object_keys(p_value) as keys(key) loop
    if not (v_key = any(v_allowed)) then raise exception 'clinical_master_unknown_contract_field' using errcode = '22023', detail = p_contract || ':' || v_key; end if;
  end loop;
end
$$;

create or replace function private.clinical_master_canonicalize_payload(p_payload jsonb)
returns jsonb language sql immutable set search_path = '' as $$
with normalized_records as (
  select pg_catalog.jsonb_build_object(
    'masterKey', pg_catalog.btrim(value->>'masterKey'),
    'recordType', pg_catalog.btrim(value->>'recordType'),
    'lifecycleStatus', coalesce(pg_catalog.btrim(value->>'lifecycleStatus'),'published'),
    'safetyStatus', coalesce(pg_catalog.btrim(value->>'safetyStatus'),'normal'),
    'safetyReason', nullif(pg_catalog.btrim(value->>'safetyReason'),''),
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
)
select case when p_payload ? 'labPanelItems' or p_payload ? 'labOrderProfiles' then pg_catalog.jsonb_build_object(
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
  ) end
$$;

create or replace function private.clinical_master_record_content(p_record jsonb, p_action_code text default null)
returns jsonb language sql immutable set search_path = '' as $$
select case when p_action_code is null then p_record else pg_catalog.jsonb_set(p_record, '{detail,actionCode}', to_jsonb(p_action_code), true) end - 'revision';
$$;

create or replace function private.clinical_master_lab_relation_content(p_payload jsonb, p_master_key text, p_record_type text)
returns jsonb language sql immutable set search_path = '' as $$
select case when p_record_type = 'lab_panel' then
  pg_catalog.jsonb_build_object('labPanelItems', coalesce((select pg_catalog.jsonb_agg(value order by (value->>'sortOrder')::integer, value->>'testMasterKey') from pg_catalog.jsonb_array_elements(coalesce(p_payload->'labPanelItems','[]'::jsonb)) items(value) where pg_catalog.btrim(value->>'panelMasterKey') = pg_catalog.btrim(p_master_key)), '[]'::jsonb))
 when p_record_type = 'order' then
  pg_catalog.jsonb_build_object('labOrderProfiles', coalesce((select pg_catalog.jsonb_agg(value order by value->>'orderMasterKey') from pg_catalog.jsonb_array_elements(coalesce(p_payload->'labOrderProfiles','[]'::jsonb)) profiles(value) where pg_catalog.btrim(value->>'orderMasterKey') = pg_catalog.btrim(p_master_key)), '[]'::jsonb))
 else '{}'::jsonb end
$$;

create or replace function private.publish_clinical_master_release(
  p_payload jsonb,
  p_actor_user_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_payload jsonb;
  v_fingerprint text;
  v_release_key text;
  v_existing master.master_releases%rowtype;
  v_release master.master_releases%rowtype;
  v_record jsonb;
  v_rel jsonb;
  v_path jsonb;
  v_detail jsonb;
  v_source jsonb;
  v_names jsonb;
  v_master_key text;
  v_record_type text;
  v_record_id uuid;
  v_revision integer;
  v_latest_revision integer;
  v_existing_snapshot jsonb;
  v_incoming_content jsonb;
  v_snapshot jsonb;
  v_action_code text;
  v_record_count integer;
  v_preferred_ko_count integer;
  v_preferred_en_count integer;
  v_unit_id uuid;
  v_input_id uuid;
  v_specimen_id uuid;
  v_panel_id uuid;
  v_test_id uuid;
  v_order_id uuid;
  v_path_id uuid;
  v_species_id uuid;
  v_action_id uuid;
  v_chart_id uuid;
  v_route_id uuid;
  v_existing_code text;
  v_relation_changed boolean;
  v_profile_test_key text;
  v_profile_panel_key text;
  v_profile_specimen_key text;
  v_relation jsonb := '[]'::jsonb;
  v_target_id uuid;
  v_target_revision integer;
  v_input_revision integer;
  v_unit_revision integer;
  v_input_key text;
  v_unit_key text;
  v_input_value_kind text;
  v_input_supports_unit boolean;
  v_unit_code text;
  v_test_vocabulary jsonb;
  v_vocabulary_snapshot jsonb;
  v_dependency_key text;
  v_dependency_type text;
  v_dependency_record_id uuid;
  v_dependency_revision integer;
  v_dependency_snapshot jsonb;
begin
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then raise exception 'clinical_master_payload_object_required' using errcode = '22023'; end if;
  if pg_catalog.jsonb_typeof(p_payload->'records') <> 'array' or jsonb_array_length(coalesce(p_payload->'records','[]'::jsonb)) = 0 then raise exception 'clinical_master_records_required' using errcode = '22023'; end if;
  if length(pg_catalog.btrim(coalesce(p_payload->>'publishedByLabel',''))) = 0 then raise exception 'clinical_master_published_by_label_required' using errcode = '22023'; end if;
  perform private.clinical_master_assert_contract_keys('payload', p_payload);

  for v_record in select value from jsonb_array_elements(p_payload->'records') records(value) loop
    perform private.clinical_master_assert_contract_keys('record', v_record);
    v_record_type := pg_catalog.btrim(v_record->>'recordType');
    if v_record_type not in ('order_category','clinical_action','chart_group','task_route','order','species','unit','specimen_type','result_input_type','lab_test','lab_panel') then raise exception 'clinical_master_record_type_not_allowed' using errcode = '22023'; end if;
    perform private.clinical_master_assert_detail_keys(v_record_type, coalesce(v_record->'detail','{}'::jsonb));
    if private.clinical_master_has_forbidden_key(v_record) then raise exception 'clinical_master_canonical_price_forbidden' using errcode = '22023'; end if;
    perform private.clinical_master_assert_contract_keys('source', coalesce(v_record->'source','{}'::jsonb));
    for v_names in select value from jsonb_array_elements(coalesce(v_record->'names','[]'::jsonb)) names(value) loop perform private.clinical_master_assert_contract_keys('name', v_names); end loop;
  end loop;
  for v_rel in select value from jsonb_array_elements(coalesce(p_payload->'labPanelItems','[]'::jsonb)) items(value) loop
    if jsonb_typeof(v_rel) <> 'object' or (select count(*) from jsonb_object_keys(v_rel)) not between 4 and 5
       or exists (select 1 from jsonb_object_keys(v_rel) key where key not in ('panelMasterKey','testMasterKey','sortOrder','required','displayGroup')) then raise exception 'clinical_master_lab_panel_item_contract_failed' using errcode = '22023'; end if;
    if length(btrim(coalesce(v_rel->>'panelMasterKey',''))) = 0 or length(btrim(coalesce(v_rel->>'testMasterKey',''))) = 0 or (v_rel->>'sortOrder')::integer < 0 then raise exception 'clinical_master_lab_panel_item_invalid' using errcode = '22023'; end if;
  end loop;
  for v_rel in select value from jsonb_array_elements(coalesce(p_payload->'labOrderProfiles','[]'::jsonb)) profiles(value) loop
    if jsonb_typeof(v_rel) <> 'object' or (select count(*) from jsonb_object_keys(v_rel)) <> 4
       or exists (select 1 from jsonb_object_keys(v_rel) key where key not in ('orderMasterKey','labTestMasterKey','labPanelMasterKey','specimenMasterKey')) then raise exception 'clinical_master_lab_order_profile_contract_failed' using errcode = '22023'; end if;
    if length(btrim(coalesce(v_rel->>'orderMasterKey',''))) = 0 then raise exception 'clinical_master_lab_order_profile_invalid' using errcode = '22023'; end if;
  end loop;
  -- Relation owners are the only records whose content can be replaced by a
  -- relation declaration.  A relation for an owner omitted from this
  -- release would otherwise disappear silently and leave a false revision
  -- snapshot.  Referenced vocabulary/test/panel records may be omitted and
  -- are pinned to their immutable current revision below.
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_payload->'labPanelItems','[]'::jsonb)) items(value)
    where not exists (
      select 1 from jsonb_array_elements(p_payload->'records') records(value)
      where value->>'masterKey'=items.value->>'panelMasterKey' and value->>'recordType'='lab_panel'
    )
  ) then
    raise exception 'clinical_master_lab_panel_owner_not_included' using errcode='23503';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_payload->'labOrderProfiles','[]'::jsonb)) profiles(value)
    where not exists (
      select 1 from jsonb_array_elements(p_payload->'records') records(value)
      where value->>'masterKey'=profiles.value->>'orderMasterKey' and value->>'recordType'='order'
    )
  ) then
    raise exception 'clinical_master_lab_order_profile_owner_not_included' using errcode='23503';
  end if;

  v_payload := private.clinical_master_canonicalize_payload(p_payload);
  v_fingerprint := lower(encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex'));
  v_release_key := nullif(btrim(v_payload->>'releaseKey'),'');
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_phase_1a_1_publication',0));
  select * into v_existing from master.master_releases where source_fingerprint = v_fingerprint for update;
  if found then
    if v_existing.status = 'published' then return jsonb_build_object('releaseId',v_existing.id,'releaseNo',v_existing.release_no,'sourceFingerprint',v_existing.source_fingerprint,'idempotent',true,'recordCount',v_existing.record_count); end if;
    raise exception 'clinical_master_release_incomplete_conflict' using errcode = '40001';
  end if;
  if v_release_key is not null then
    select * into v_existing from master.master_releases where release_key = v_release_key for update;
    if found then raise exception 'clinical_master_release_key_conflict' using errcode = '40001'; end if;
  end if;
  v_record_count := jsonb_array_length(v_payload->'records');
  insert into master.master_releases (release_key,record_count,source_fingerprint,status,release_notes,published_by_user_id,published_by_label)
  values (v_release_key,v_record_count,v_fingerprint,'publishing',v_payload->>'releaseNotes',p_actor_user_id,v_payload->>'publishedByLabel') returning * into v_release;

  if exists (select 1 from jsonb_array_elements(v_payload->'records') records(value) group by value->>'masterKey' having btrim(value->>'masterKey') = '' or count(*) > 1) then raise exception 'clinical_master_duplicate_or_empty_master_key' using errcode = '22023'; end if;

  -- Materialize owner identities before the effective pass.  This lets the
  -- four stage rows resolve both included and omitted referenced owners while
  -- keeping the existing A1 identity/revision loop as the final authority.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) loop
    v_master_key := btrim(v_record->>'masterKey');
    v_record_type := btrim(v_record->>'recordType');
    select id into v_record_id from master.master_records where master_key=v_master_key for update;
    if not found then
      v_record_id := extensions.gen_random_uuid();
      insert into master.master_records(id,master_key,record_type,lifecycle_status,safety_status,safety_reason,current_revision,current_release_id,published_at)
      values(v_record_id,v_master_key,v_record_type,'published','normal',null,1,v_release.id,now());
    elsif (select record_type from master.master_records where id=v_record_id) is distinct from v_record_type then
      raise exception 'clinical_master_record_type_change_forbidden' using errcode='23514';
    end if;
  end loop;
  delete from private.clinical_master_lab_publish_stage where release_id=v_release.id;
  insert into private.clinical_master_lab_publish_stage(
    release_id,master_record_id,master_key,record_type,included,base_content,effective_revision
  )
  select v_release.id,owner.id,owner.master_key,owner.record_type,true,
    private.clinical_master_record_content(records.value,null),
    coalesce(latest.revision,1) + case
      when latest.snapshot is null then 0
      when (latest.snapshot-'revision') is distinct from private.clinical_master_record_content(records.value,null) then 1
      else 0
    end
  from jsonb_array_elements(v_payload->'records') records(value)
  join master.master_records owner on owner.master_key=records.value->>'masterKey'
  left join lateral (
    select version.snapshot,version.revision
    from master.master_record_versions version
    where version.master_record_id=owner.id
    order by version.revision desc
    limit 1
  ) latest on true;
  -- The test pass is self-contained as well as the panel/order relation
  -- passes.  Resolve the vocabulary owners once from the immutable stage
  -- rows (or their latest immutable version when omitted), then carry the
  -- effective UUID/revision and typed vocabulary facts in a separate test
  -- relation object.  This is deliberately independent of the mutable
  -- current_revision columns and keeps omitted vocabulary owners pinned.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType'='lab_test' loop
    v_input_key := nullif(btrim(v_record->'detail'->>'resultInputTypeKey'),'');
    v_unit_key := nullif(btrim(v_record->'detail'->>'canonicalUnitKey'),'');
    select owner.id into v_input_id
    from master.master_records owner
    where owner.master_key=v_input_key and owner.record_type='result_input_type';
    if v_input_id is null then raise exception 'clinical_master_lab_test_result_input_missing' using errcode='23503'; end if;
    select stage.effective_revision, stage.base_content->'detail'
      into v_input_revision, v_vocabulary_snapshot
    from private.clinical_master_lab_publish_stage stage
    where stage.release_id=v_release.id and stage.master_record_id=v_input_id;
    if v_input_revision is null then
      select version.revision, version.snapshot->'detail'
        into v_input_revision, v_vocabulary_snapshot
      from master.master_record_versions version
      where version.master_record_id=v_input_id
      order by version.revision desc limit 1;
    end if;
    if v_input_revision is null or v_vocabulary_snapshot is null then raise exception 'clinical_master_lab_test_result_input_version_missing' using errcode='23503'; end if;
    v_input_value_kind := nullif(btrim(v_vocabulary_snapshot->>'valueKind'),'');
    v_input_supports_unit := coalesce((v_vocabulary_snapshot->>'supportsUnit')::boolean,false);
    if v_input_value_kind not in ('numeric','text','coded') then raise exception 'clinical_master_result_value_kind_invalid' using errcode='22023'; end if;
    v_unit_id := null;
    v_unit_revision := null;
    v_unit_code := null;
    if v_unit_key is not null then
      select owner.id into v_unit_id
      from master.master_records owner
      where owner.master_key=v_unit_key and owner.record_type='unit';
      if v_unit_id is null then raise exception 'clinical_master_lab_test_unit_missing' using errcode='23503'; end if;
      select stage.effective_revision, stage.base_content->'detail'
        into v_unit_revision, v_vocabulary_snapshot
      from private.clinical_master_lab_publish_stage stage
      where stage.release_id=v_release.id and stage.master_record_id=v_unit_id;
      if v_unit_revision is null then
        select version.revision, version.snapshot->'detail'
          into v_unit_revision, v_vocabulary_snapshot
        from master.master_record_versions version
        where version.master_record_id=v_unit_id
        order by version.revision desc limit 1;
      end if;
      if v_unit_revision is null or v_vocabulary_snapshot is null then raise exception 'clinical_master_lab_test_unit_version_missing' using errcode='23503'; end if;
      v_unit_code := nullif(btrim(v_vocabulary_snapshot->>'unitCode'),'');
      if not v_input_supports_unit then raise exception 'clinical_master_lab_test_unit_not_supported' using errcode='22023'; end if;
    end if;
    v_test_vocabulary := jsonb_build_object(
      'resultInputTypeKey',v_input_key,
      'resultInputTypeMasterRecordId',v_input_id,
      'resultInputTypeRevision',v_input_revision,
      'resultInputTypeValueKind',v_input_value_kind,
      'resultInputTypeSupportsUnit',v_input_supports_unit,
      'canonicalUnitKey',v_unit_key,
      'canonicalUnitMasterRecordId',v_unit_id,
      'canonicalUnitRevision',v_unit_revision,
      'canonicalUnitCode',v_unit_code
    );
    update private.clinical_master_lab_publish_stage
    set relation_content=jsonb_build_object('labTestVocabulary',v_test_vocabulary)
    where release_id=v_release.id and master_key=v_record->>'masterKey';
  end loop;
  -- Close the vocabulary -> test pass before panel relations read test pins.
  -- A same-release vocabulary change therefore advances the test owner first,
  -- even when the lab-test typed detail itself is unchanged.
  update private.clinical_master_lab_publish_stage stage
  set effective_revision=case
    when not exists(select 1 from master.master_record_versions version where version.master_record_id=stage.master_record_id) then 1
    when (select version.snapshot from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)-'revision' is distinct from stage.base_content || stage.relation_content then
      (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)+1
    else (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)
  end
  where stage.release_id=v_release.id and stage.record_type in ('result_input_type','unit','specimen_type','lab_test');
  -- A relation's effective content is self-contained: every referenced
  -- record carries its UUID and immutable effective revision, including an
  -- omitted owner that remains at its existing revision.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType'='lab_panel' loop
    v_relation := '[]'::jsonb;
    for v_rel in select value from jsonb_array_elements(coalesce(v_payload->'labPanelItems','[]'::jsonb)) items(value) where value->>'panelMasterKey'=v_record->>'masterKey' order by (value->>'sortOrder')::integer,value->>'testMasterKey' loop
      select owner.id,coalesce(stage.effective_revision,latest.revision)
        into v_target_id,v_target_revision
      from master.master_records owner
      left join private.clinical_master_lab_publish_stage stage on stage.release_id=v_release.id and stage.master_record_id=owner.id
      left join lateral (
        select version.revision
        from master.master_record_versions version
        where version.master_record_id=owner.id
        order by version.revision desc
        limit 1
      ) latest on true
      where owner.master_key=v_rel->>'testMasterKey' and owner.record_type='lab_test';
      if v_target_id is null or v_target_revision is null then raise exception 'clinical_master_lab_panel_test_version_missing' using errcode='23503'; end if;
      v_relation := v_relation || jsonb_build_array(v_rel || jsonb_build_object('testMasterRecordId',v_target_id,'testMasterRevision',v_target_revision));
    end loop;
    update private.clinical_master_lab_publish_stage set relation_content=jsonb_build_object('labPanelItems',v_relation) where release_id=v_release.id and master_key=v_record->>'masterKey';
  end loop;
  -- Close the test -> panel pass before order profiles read panel pins.
  update private.clinical_master_lab_publish_stage stage
  set effective_revision=case
    when not exists(select 1 from master.master_record_versions version where version.master_record_id=stage.master_record_id) then 1
    when (select version.snapshot from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)-'revision' is distinct from stage.base_content || stage.relation_content then
      (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)+1
    else (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)
  end
  where stage.release_id=v_release.id and stage.record_type='lab_panel';
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType'='order' loop
    v_relation := '[]'::jsonb;
    for v_rel in select value from jsonb_array_elements(coalesce(v_payload->'labOrderProfiles','[]'::jsonb)) profiles(value) where value->>'orderMasterKey'=v_record->>'masterKey' loop
      v_target_id := null; v_target_revision := null;
      if nullif(btrim(v_rel->>'labTestMasterKey'),'') is not null then
        select owner.id,coalesce(stage.effective_revision,latest.revision) into v_target_id,v_target_revision
        from master.master_records owner
        left join private.clinical_master_lab_publish_stage stage on stage.release_id=v_release.id and stage.master_record_id=owner.id
        left join lateral (
          select version.revision
          from master.master_record_versions version
          where version.master_record_id=owner.id
          order by version.revision desc
          limit 1
        ) latest on true
        where owner.master_key=v_rel->>'labTestMasterKey' and owner.record_type='lab_test';
        if v_target_id is null or v_target_revision is null then raise exception 'clinical_master_lab_order_profile_reference_version_missing' using errcode='23503'; end if;
        v_relation := v_relation || jsonb_build_array(v_rel || jsonb_build_object('labTestMasterRecordId',v_target_id,'labTestMasterRevision',v_target_revision));
      else
        select owner.id,coalesce(stage.effective_revision,latest.revision) into v_target_id,v_target_revision
        from master.master_records owner
        left join private.clinical_master_lab_publish_stage stage on stage.release_id=v_release.id and stage.master_record_id=owner.id
        left join lateral (
          select version.revision
          from master.master_record_versions version
          where version.master_record_id=owner.id
          order by version.revision desc
          limit 1
        ) latest on true
        where owner.master_key=v_rel->>'labPanelMasterKey' and owner.record_type='lab_panel';
        if v_target_id is null or v_target_revision is null then raise exception 'clinical_master_lab_order_profile_reference_version_missing' using errcode='23503'; end if;
        v_relation := v_relation || jsonb_build_array(v_rel || jsonb_build_object('labPanelMasterRecordId',v_target_id,'labPanelMasterRevision',v_target_revision));
      end if;
      if nullif(btrim(v_rel->>'specimenMasterKey'),'') is not null then
        select owner.id,coalesce(stage.effective_revision,latest.revision)
          into v_target_id,v_target_revision
        from master.master_records owner
        left join private.clinical_master_lab_publish_stage stage
          on stage.release_id=v_release.id and stage.master_record_id=owner.id
        left join lateral (
          select version.revision
          from master.master_record_versions version
          where version.master_record_id=owner.id
          order by version.revision desc
          limit 1
        ) latest on true
        where owner.master_key=v_rel->>'specimenMasterKey' and owner.record_type='specimen_type';
        if v_target_id is null or v_target_revision is null then raise exception 'clinical_master_lab_order_profile_reference_version_missing' using errcode='23503'; end if;
        v_relation := jsonb_set(
          v_relation,
          array[(jsonb_array_length(v_relation)-1)::text],
          (v_relation->-1) || jsonb_build_object('specimenMasterRecordId',v_target_id,'specimenMasterRevision',v_target_revision)
        );
      end if;
    end loop;
    update private.clinical_master_lab_publish_stage set relation_content=jsonb_build_object('labOrderProfiles',v_relation) where release_id=v_release.id and master_key=v_record->>'masterKey';
  end loop;
  update private.clinical_master_lab_publish_stage stage
  set effective_revision=case
    when not exists(select 1 from master.master_record_versions version where version.master_record_id=stage.master_record_id) then 1
    when (
      (select version.snapshot from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)-'revision'
    ) is distinct from stage.base_content || stage.relation_content then
      (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)+1
    else (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)
  end;
  -- Order profiles pin the panel/test effective revision computed by the
  -- preceding owner stages.  Refresh those embedded pins before the final
  -- owner pass so a panel-only relation revision is visible to its order
  -- profile without advancing the referenced test owners.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType'='order' loop
    v_relation := '[]'::jsonb;
    for v_rel in select value from jsonb_array_elements(coalesce((select stage.relation_content->'labOrderProfiles' from private.clinical_master_lab_publish_stage stage where stage.release_id=v_release.id and stage.master_key=v_record->>'masterKey'),'[]'::jsonb)) profiles(value) loop
      if nullif(v_rel->>'labPanelMasterRecordId','') is not null then
        select stage.effective_revision into v_target_revision from private.clinical_master_lab_publish_stage stage where stage.release_id=v_release.id and stage.master_record_id=(v_rel->>'labPanelMasterRecordId')::uuid;
        v_rel := v_rel || jsonb_build_object('labPanelMasterRevision',v_target_revision);
      elsif nullif(v_rel->>'labTestMasterRecordId','') is not null then
        select stage.effective_revision into v_target_revision from private.clinical_master_lab_publish_stage stage where stage.release_id=v_release.id and stage.master_record_id=(v_rel->>'labTestMasterRecordId')::uuid;
        v_rel := v_rel || jsonb_build_object('labTestMasterRevision',v_target_revision);
      end if;
      v_relation := v_relation || jsonb_build_array(v_rel);
    end loop;
    update private.clinical_master_lab_publish_stage set relation_content=jsonb_build_object('labOrderProfiles',v_relation) where release_id=v_release.id and master_key=v_record->>'masterKey';
  end loop;
  update private.clinical_master_lab_publish_stage stage
  set effective_revision=case
    when not exists(select 1 from master.master_record_versions version where version.master_record_id=stage.master_record_id) then 1
    when (select version.snapshot from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)-'revision' is distinct from stage.base_content || stage.relation_content then
      (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)+1
    else (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)
  end
  where stage.release_id=v_release.id and stage.record_type='order';

  -- Materialize the same effective pass into the four contract-named stage
  -- tables.  The publisher body above keeps its compact compatibility stage,
  -- but these rows are the durable, independently queryable evidence used by
  -- adoption/review diagnostics and make omitted dependency pins explicit.
  delete from private.clinical_master_lab_vocabulary_publish_stage where release_id=v_release.id;
  delete from private.clinical_master_lab_test_publish_stage where release_id=v_release.id;
  delete from private.clinical_master_lab_panel_publish_stage where release_id=v_release.id;
  delete from private.clinical_master_lab_order_publish_stage where release_id=v_release.id;
  insert into private.clinical_master_lab_vocabulary_publish_stage(
    release_id,owner_record_id,master_key,record_type,included,base_content,effective_revision,
    value_kind,supports_unit,canonical_code,content_sha256
  )
  select stage.release_id,stage.master_record_id,stage.master_key,stage.record_type,stage.included,
    stage.base_content,stage.effective_revision,
    case when stage.record_type='result_input_type' then stage.base_content->'detail'->>'valueKind' end,
    case when stage.record_type='result_input_type' then coalesce((stage.base_content->'detail'->>'supportsUnit')::boolean,false) end,
    case stage.record_type
      when 'result_input_type' then stage.base_content->'detail'->>'inputCode'
      when 'unit' then stage.base_content->'detail'->>'unitCode'
      when 'specimen_type' then stage.base_content->'detail'->>'specimenCode'
    end,
    private.clinical_master_sha256(stage.base_content)
  from private.clinical_master_lab_publish_stage stage
  where stage.release_id=v_release.id and stage.record_type in ('result_input_type','unit','specimen_type');
  -- Omitted vocabulary owners are pinned to the immutable latest version,
  -- never synthesized from a mutable typed row or current_revision.
  insert into private.clinical_master_lab_vocabulary_publish_stage(
    release_id,owner_record_id,master_key,record_type,included,base_content,effective_revision,
    value_kind,supports_unit,canonical_code,content_sha256
  )
  with dependencies as (
    select distinct pg_catalog.btrim(value->'detail'->>'resultInputTypeKey') as master_key,'result_input_type'::text as record_type
    from pg_catalog.jsonb_array_elements(v_payload->'records') records(value)
    where value->>'recordType'='lab_test'
    union
    select distinct nullif(pg_catalog.btrim(value->'detail'->>'canonicalUnitKey'),'') as master_key,'unit'::text
    from pg_catalog.jsonb_array_elements(v_payload->'records') records(value)
    where value->>'recordType'='lab_test' and nullif(pg_catalog.btrim(value->'detail'->>'canonicalUnitKey'),'') is not null
    union
    select distinct nullif(pg_catalog.btrim(value->>'specimenMasterKey'),'') as master_key,'specimen_type'::text
    from pg_catalog.jsonb_array_elements(coalesce(v_payload->'labOrderProfiles','[]'::jsonb)) profiles(value)
    where nullif(pg_catalog.btrim(value->>'specimenMasterKey'),'') is not null
  ), resolved as (
    select owner.id,owner.master_key,owner.record_type,
      coalesce(stage.included,false) as included,
      coalesce(stage.base_content,latest.snapshot-'revision') as base_content,
      coalesce(stage.effective_revision,latest.revision) as effective_revision
    from dependencies dependency
    join master.master_records owner on owner.master_key=dependency.master_key and owner.record_type=dependency.record_type
    left join private.clinical_master_lab_publish_stage stage on stage.release_id=v_release.id and stage.master_record_id=owner.id
    left join lateral (
      select version.snapshot,version.revision
      from master.master_record_versions version
      where version.master_record_id=owner.id
      order by version.revision desc limit 1
    ) latest on true
  )
  select v_release.id,resolved.id,resolved.master_key,resolved.record_type,resolved.included,
    resolved.base_content,resolved.effective_revision,
    case when resolved.record_type='result_input_type' then resolved.base_content->'detail'->>'valueKind' end,
    case when resolved.record_type='result_input_type' then coalesce((resolved.base_content->'detail'->>'supportsUnit')::boolean,false) end,
    case resolved.record_type
      when 'result_input_type' then resolved.base_content->'detail'->>'inputCode'
      when 'unit' then resolved.base_content->'detail'->>'unitCode'
      when 'specimen_type' then resolved.base_content->'detail'->>'specimenCode'
    end,
    private.clinical_master_sha256(resolved.base_content)
  from resolved
  where not exists (
    select 1 from private.clinical_master_lab_vocabulary_publish_stage existing
    where existing.release_id=v_release.id and existing.owner_record_id=resolved.id
  ) and resolved.effective_revision is not null;
  insert into private.clinical_master_lab_test_publish_stage(
    release_id,owner_record_id,master_key,included,base_content,relation_content,effective_revision,
    result_input_type_master_record_id,result_input_type_revision,result_input_type_key,
    result_input_type_value_kind,result_input_type_supports_unit,canonical_unit_master_record_id,
    canonical_unit_revision,canonical_unit_key,canonical_unit_code,decimal_scale,content_sha256
  )
  select stage.release_id,stage.master_record_id,stage.master_key,stage.included,stage.base_content,
    stage.relation_content,stage.effective_revision,
    (stage.relation_content->'labTestVocabulary'->>'resultInputTypeMasterRecordId')::uuid,
    (stage.relation_content->'labTestVocabulary'->>'resultInputTypeRevision')::integer,
    stage.relation_content->'labTestVocabulary'->>'resultInputTypeKey',
    stage.relation_content->'labTestVocabulary'->>'resultInputTypeValueKind',
    (stage.relation_content->'labTestVocabulary'->>'resultInputTypeSupportsUnit')::boolean,
    nullif(stage.relation_content->'labTestVocabulary'->>'canonicalUnitMasterRecordId','')::uuid,
    nullif(stage.relation_content->'labTestVocabulary'->>'canonicalUnitRevision','')::integer,
    nullif(stage.relation_content->'labTestVocabulary'->>'canonicalUnitKey',''),
    nullif(stage.relation_content->'labTestVocabulary'->>'canonicalUnitCode',''),
    nullif(stage.base_content->'detail'->>'decimalScale','')::integer,
    private.clinical_master_sha256(stage.base_content || stage.relation_content)
  from private.clinical_master_lab_publish_stage stage
  where stage.release_id=v_release.id and stage.record_type='lab_test';
  insert into private.clinical_master_lab_panel_publish_stage(
    release_id,owner_record_id,master_key,included,base_content,relation_content,effective_revision,content_sha256
  )
  select stage.release_id,stage.master_record_id,stage.master_key,stage.included,stage.base_content,
    stage.relation_content,stage.effective_revision,private.clinical_master_sha256(stage.base_content || stage.relation_content)
  from private.clinical_master_lab_publish_stage stage
  where stage.release_id=v_release.id and stage.record_type='lab_panel';
  insert into private.clinical_master_lab_order_publish_stage(
    release_id,owner_record_id,master_key,included,base_content,relation_content,effective_revision,
    specimen_master_record_id,specimen_revision,content_sha256
  )
  select stage.release_id,stage.master_record_id,stage.master_key,stage.included,stage.base_content,
    stage.relation_content,stage.effective_revision,
    nullif((select value->>'specimenMasterRecordId' from pg_catalog.jsonb_array_elements(coalesce(stage.relation_content->'labOrderProfiles','[]'::jsonb)) profiles(value) limit 1),'')::uuid,
    nullif((select value->>'specimenMasterRevision' from pg_catalog.jsonb_array_elements(coalesce(stage.relation_content->'labOrderProfiles','[]'::jsonb)) profiles(value) limit 1),'')::integer,
    private.clinical_master_sha256(stage.base_content || stage.relation_content)
  from private.clinical_master_lab_publish_stage stage
  where stage.release_id=v_release.id and stage.record_type='order';

  -- Resolve identity/revision once for every owner.  Relation declarations are
  -- folded into the owning snapshot so a relation-only change advances that
  -- owner exactly once and cannot cascade to an omitted owner.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) loop
    v_master_key := btrim(v_record->>'masterKey');
    v_record_type := btrim(v_record->>'recordType');
    select id,current_revision into v_record_id,v_revision from master.master_records where master_key = v_master_key for update;
    v_incoming_content := private.clinical_master_record_content(v_record,null);
    if v_record_type in ('lab_test','lab_panel','order') then v_incoming_content := v_incoming_content || private.clinical_master_lab_relation_content(v_payload,v_master_key,v_record_type); end if;
    if found then
      if (select record_type from master.master_records where id = v_record_id) is distinct from v_record_type then raise exception 'clinical_master_record_type_change_forbidden' using errcode = '23514'; end if;
      select snapshot,revision into v_existing_snapshot,v_latest_revision from master.master_record_versions where master_record_id = v_record_id order by revision desc limit 1;
      if v_existing_snapshot is not null and (v_existing_snapshot - 'revision') is distinct from v_incoming_content then
        update master.master_records set current_revision = v_latest_revision + 1, current_release_id = v_release.id, updated_at = now() where id = v_record_id;
      end if;
    else
      v_record_id := extensions.gen_random_uuid();
      insert into master.master_records (id,master_key,record_type,lifecycle_status,safety_status,safety_reason,current_revision,current_release_id,published_at)
      values (v_record_id,v_master_key,v_record_type,'published','normal',null,1,v_release.id,now());
    end if;
  end loop;

  -- Vocabulary and typed rows.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType' = 'species' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey'; v_detail := v_record->'detail';
    insert into master.species(master_record_id,species_code) values(v_record_id,btrim(v_detail->>'speciesCode')) on conflict(master_record_id) do update set species_code=excluded.species_code;
  end loop;
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType' = 'unit' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey'; v_detail := v_record->'detail';
    insert into master.units(master_record_id,unit_code,symbol,decimal_scale) values(v_record_id,btrim(v_detail->>'unitCode'),btrim(v_detail->>'symbol'),coalesce((v_detail->>'decimalScale')::integer,0)) on conflict(master_record_id) do update set unit_code=excluded.unit_code,symbol=excluded.symbol,decimal_scale=excluded.decimal_scale;
  end loop;
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType' = 'specimen_type' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey'; v_detail := v_record->'detail';
    insert into master.specimen_types(master_record_id,specimen_code) values(v_record_id,btrim(v_detail->>'specimenCode')) on conflict(master_record_id) do update set specimen_code=excluded.specimen_code;
  end loop;
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType' = 'result_input_type' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey'; v_detail := v_record->'detail';
    if v_detail->>'valueKind' not in ('numeric','text','coded') then raise exception 'clinical_master_result_value_kind_invalid' using errcode='22023'; end if;
    insert into master.result_input_types(master_record_id,input_code,value_kind,supports_unit) values(v_record_id,btrim(v_detail->>'inputCode'),btrim(v_detail->>'valueKind'),coalesce((v_detail->>'supportsUnit')::boolean,false)) on conflict(master_record_id) do update set input_code=excluded.input_code,value_kind=excluded.value_kind,supports_unit=excluded.supports_unit;
  end loop;
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType' = 'lab_test' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey'; v_detail := v_record->'detail';
    select id into v_input_id from master.master_records where master_key = v_detail->>'resultInputTypeKey' and record_type='result_input_type';
    if v_input_id is null then raise exception 'clinical_master_lab_test_result_input_missing' using errcode='23503'; end if;
    select id into v_unit_id from master.master_records where master_key = v_detail->>'canonicalUnitKey' and record_type='unit';
    if nullif(btrim(v_detail->>'canonicalUnitKey'),'') is not null and v_unit_id is null then raise exception 'clinical_master_lab_test_unit_missing' using errcode='23503'; end if;
    if exists(select 1 from master.result_input_types where master_record_id=v_input_id and not supports_unit and v_unit_id is not null) then raise exception 'clinical_master_lab_test_unit_not_supported' using errcode='22023'; end if;
    insert into master.lab_tests(master_record_id,test_code,result_input_type_id,canonical_unit_id,decimal_scale)
    values(v_record_id,btrim(v_detail->>'testCode'),v_input_id,v_unit_id,(v_detail->>'decimalScale')::integer)
    on conflict(master_record_id) do update set test_code=excluded.test_code,result_input_type_id=excluded.result_input_type_id,canonical_unit_id=excluded.canonical_unit_id,decimal_scale=excluded.decimal_scale;
  end loop;
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType' = 'lab_panel' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey';
    insert into master.lab_panels(master_record_id,panel_code) values(v_record_id,btrim(v_record->'detail'->>'panelCode')) on conflict(master_record_id) do update set panel_code=excluded.panel_code;
  end loop;

  -- Paths must exist before the order/profile pass resolves the lab action.
  for v_path in select value from jsonb_array_elements(coalesce(v_payload->'classificationPaths','[]'::jsonb)) paths(value) loop
    select action.master_record_id into v_action_id from master.clinical_actions action join master.master_records r on r.id=action.master_record_id where r.master_key=v_path->>'clinicalActionKey';
    select chart.master_record_id into v_chart_id from master.chart_groups chart join master.master_records r on r.id=chart.master_record_id where r.master_key=v_path->>'chartGroupKey';
    select route.master_record_id into v_route_id from master.task_routes route join master.master_records r on r.id=route.master_record_id where r.master_key=v_path->>'taskRouteKey';
    if v_action_id is null or v_chart_id is null or v_route_id is null then raise exception 'clinical_master_classification_path_reference_missing' using errcode='23503'; end if;
    if not exists(select 1 from master.classification_paths where path_key=v_path->>'pathKey') then
      update master.classification_paths set retired_in_release_id=v_release.id where clinical_action_id=v_action_id and retired_in_release_id is null;
      insert into master.classification_paths(path_key,clinical_action_id,chart_group_id,task_route_id,active_from_release_id) values(v_path->>'pathKey',v_action_id,v_chart_id,v_route_id,v_release.id);
    end if;
  end loop;

  -- Existing A1 typed order/path handling is retained for all order rows.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType' = 'order' loop
    select id into v_order_id from master.master_records where master_key = v_record->>'masterKey'; v_detail := v_record->'detail';
    select id into v_path_id from master.classification_paths where path_key=v_detail->>'classificationPathKey' and retired_in_release_id is null;
    if v_path_id is null then raise exception 'clinical_master_order_classification_path_required' using errcode='23503'; end if;
    v_unit_id := null;
    if nullif(btrim(v_detail->>'defaultSalesUnitCode'),'') is not null then select master_record_id into v_unit_id from master.units where unit_code=btrim(v_detail->>'defaultSalesUnitCode'); if v_unit_id is null then raise exception 'clinical_master_order_sales_unit_missing' using errcode='23503'; end if; end if;
    insert into master.orders(master_record_id,classification_path_id,default_sales_unit_id,default_billing_reflection_enabled,default_quantity)
    values(v_order_id,v_path_id,v_unit_id,coalesce((v_detail->>'defaultBillingReflectionEnabled')::boolean,true),coalesce((v_detail->>'defaultQuantity')::numeric,1))
    on conflict(master_record_id) do update set classification_path_id=excluded.classification_path_id,default_sales_unit_id=excluded.default_sales_unit_id,default_billing_reflection_enabled=excluded.default_billing_reflection_enabled,default_quantity=excluded.default_quantity;
    delete from master.order_species_links where order_record_id=v_order_id;
    for v_species_id in select master_record_id from master.species where species_code in(select value#>>'{}' from jsonb_array_elements(v_detail->'species') species(value)) loop insert into master.order_species_links(order_record_id,species_record_id) values(v_order_id,v_species_id); end loop;
    if (select count(*) from master.order_species_links where order_record_id=v_order_id) <> jsonb_array_length(v_detail->'species') then raise exception 'clinical_master_order_species_reference_missing' using errcode='23503'; end if;
  end loop;

  -- Full-set panel relation replacement, with deterministic duplicate/order
  -- checks and no implicit owner cascade.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType'='lab_panel' loop
    v_master_key := v_record->>'masterKey'; select id into v_panel_id from master.master_records where master_key=v_master_key;
    if not exists(select 1 from jsonb_array_elements(v_payload->'labPanelItems') items(value) where value->>'panelMasterKey'=v_master_key) then raise exception 'clinical_master_lab_panel_items_required' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements(v_payload->'labPanelItems') items(value) where value->>'panelMasterKey'=v_master_key group by value->>'testMasterKey' having count(*)>1) then raise exception 'clinical_master_lab_panel_item_duplicate' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements(v_payload->'labPanelItems') items(value) where value->>'panelMasterKey'=v_master_key group by (value->>'sortOrder')::integer having count(*)>1) then raise exception 'clinical_master_lab_panel_sort_duplicate' using errcode='22023'; end if;
    delete from master.lab_panel_items where lab_panel_id=v_panel_id;
    for v_rel in select value from jsonb_array_elements(v_payload->'labPanelItems') items(value) where value->>'panelMasterKey'=v_master_key order by (value->>'sortOrder')::integer,value->>'testMasterKey' loop
      select id into v_test_id from master.master_records where master_key=v_rel->>'testMasterKey' and record_type='lab_test';
      if v_test_id is null then raise exception 'clinical_master_lab_panel_test_missing' using errcode='23503'; end if;
      insert into master.lab_panel_items(lab_panel_id,lab_test_id,sort_order,required,display_group) values(v_panel_id,v_test_id,(v_rel->>'sortOrder')::integer,coalesce((v_rel->>'required')::boolean,true),nullif(btrim(v_rel->>'displayGroup'),''));
    end loop;
  end loop;

  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType'='order' loop
    v_master_key := v_record->>'masterKey';
    if exists(select 1 from master.classification_paths path join master.task_routes route on route.master_record_id=path.task_route_id where path.id=(select classification_path_id from master.orders where master_record_id=(select id from master.master_records where master_key=v_master_key)) and route.route_code='NT_LAB') then
      if (select count(*) from jsonb_array_elements(v_payload->'labOrderProfiles') profiles(value) where value->>'orderMasterKey'=v_master_key) <> 1 then raise exception 'clinical_master_lab_order_profile_exactly_one' using errcode='22023'; end if;
      select id into v_order_id from master.master_records where master_key=v_master_key;
      select nullif(btrim(value->>'labTestMasterKey'),''),nullif(btrim(value->>'labPanelMasterKey'),''),nullif(btrim(value->>'specimenMasterKey'),'') into v_profile_test_key,v_profile_panel_key,v_profile_specimen_key from jsonb_array_elements(v_payload->'labOrderProfiles') profiles(value) where value->>'orderMasterKey'=v_record->>'masterKey';
      if (v_profile_test_key is null) = (v_profile_panel_key is null) then raise exception 'clinical_master_lab_order_profile_target_exactly_one' using errcode='22023'; end if;
      v_test_id := null; v_panel_id := null; v_specimen_id := null;
      if v_profile_test_key is not null then select id into v_test_id from master.master_records where master_key=v_profile_test_key and record_type='lab_test'; else select id into v_panel_id from master.master_records where master_key=v_profile_panel_key and record_type='lab_panel'; end if;
      if v_profile_specimen_key is not null then select id into v_specimen_id from master.master_records where master_key=v_profile_specimen_key and record_type='specimen_type'; end if;
      if (v_profile_test_key is not null and v_test_id is null) or (v_profile_panel_key is not null and v_panel_id is null) or (v_profile_specimen_key is not null and v_specimen_id is null) then raise exception 'clinical_master_lab_order_profile_reference_missing' using errcode='23503'; end if;
      insert into master.lab_order_profiles(order_record_id,lab_test_id,lab_panel_id,specimen_type_id) values(v_order_id,v_test_id,v_panel_id,v_specimen_id) on conflict(order_record_id) do update set lab_test_id=excluded.lab_test_id,lab_panel_id=excluded.lab_panel_id,specimen_type_id=excluded.specimen_type_id;
    end if;
  end loop;

  -- Classification paths are the same A1 identity boundary.
  for v_path in select value from jsonb_array_elements(coalesce(v_payload->'classificationPaths','[]'::jsonb)) paths(value) loop
    select action.master_record_id into v_action_id from master.clinical_actions action join master.master_records r on r.id=action.master_record_id where r.master_key=v_path->>'clinicalActionKey';
    select chart.master_record_id into v_chart_id from master.chart_groups chart join master.master_records r on r.id=chart.master_record_id where r.master_key=v_path->>'chartGroupKey';
    select route.master_record_id into v_route_id from master.task_routes route join master.master_records r on r.id=route.master_record_id where r.master_key=v_path->>'taskRouteKey';
    if v_action_id is null or v_chart_id is null or v_route_id is null then raise exception 'clinical_master_classification_path_reference_missing' using errcode='23503'; end if;
    select id into v_path_id from master.classification_paths where path_key=v_path->>'pathKey' for update;
    if v_path_id is null then update master.classification_paths set retired_in_release_id=v_release.id where clinical_action_id=v_action_id and retired_in_release_id is null; insert into master.classification_paths(path_key,clinical_action_id,chart_group_id,task_route_id,active_from_release_id) values(v_path->>'pathKey',v_action_id,v_chart_id,v_route_id,v_release.id); end if;
  end loop;

  -- Names, provenance, immutable version rows, and publication events.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) loop
    v_master_key := v_record->>'masterKey'; select id,current_revision into v_record_id,v_revision from master.master_records where master_key=v_master_key;
    v_incoming_content := private.clinical_master_record_content(v_record,null) || private.clinical_master_lab_relation_content(v_payload,v_master_key,v_record->>'recordType');
    select snapshot,revision into v_existing_snapshot,v_latest_revision from master.master_record_versions where master_record_id=v_record_id order by revision desc limit 1;
    if v_existing_snapshot is not null and (v_existing_snapshot-'revision') is not distinct from v_incoming_content then continue; end if;
    delete from master.master_record_names where master_record_id=v_record_id;
    for v_names in select value from jsonb_array_elements(v_record->'names') names(value) loop
      insert into master.master_record_names(master_record_id,language_code,name_kind,name,normalized_name,searchable,sort_order) values(v_record_id,v_names->>'languageCode',v_names->>'nameKind',v_names->>'name',lower(regexp_replace(btrim(v_names->>'name'),'[[:space:]]+',' ','g')),coalesce((v_names->>'searchable')::boolean,true),coalesce((v_names->>'sortOrder')::integer,0));
    end loop;
    v_source := v_record->'source';
    insert into master.master_sources(source_type,title,reference_uri,source_version,accessed_at,license_notes) values(v_source->>'sourceType',v_source->>'title',v_source->>'referenceUri',v_source->>'sourceVersion',nullif(v_source->>'accessedAt','')::timestamptz,v_source->>'licenseNotes') returning id into v_unit_id;
    insert into master.master_record_sources(master_record_id,source_id,assertion_scope,notes) values(v_record_id,v_unit_id,'record','Validated Phase 1B-1 synthetic publisher source.');
    v_snapshot := jsonb_set(v_incoming_content,'{revision}',to_jsonb(v_revision),true);
    insert into master.master_record_versions(master_record_id,revision,release_id,snapshot,change_summary,authored_by_label,reviewed_by_label) values(v_record_id,v_revision,v_release.id,v_snapshot,'Phase 1B-1 validated synthetic publish.',v_payload->>'publishedByLabel',v_payload->>'publishedByLabel');
    insert into master.master_review_events(master_record_id,revision,event_type,actor_user_id,actor_label,source_surface) values(v_record_id,v_revision,'validated',p_actor_user_id,v_payload->>'publishedByLabel','publisher'),(v_record_id,v_revision,'published',p_actor_user_id,v_payload->>'publishedByLabel','publisher');
  end loop;
  update master.master_releases set status='published',published_at=now() where id=v_release.id;
  return jsonb_build_object('releaseId',v_release.id,'releaseNo',v_release.release_no,'sourceFingerprint',v_fingerprint,'idempotent',false,'recordCount',v_release.record_count);
end
$$;

revoke all on function private.publish_clinical_master_release(jsonb,uuid) from public, anon, authenticated, service_role;

create or replace function private.clair_adopt_lab_master_projection_to_workspace(
  p_workspace_id text,
  p_release_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_catalog record;
  v_profile record;
  v_member record;
  v_test record;
  v_input record;
  v_unit record;
  v_category_id text;
  v_item_id text;
  v_link_id text;
  v_name text;
  v_result_kind text;
  v_input_type text;
  v_source_revision integer;
  v_item_revision integer;
  v_snapshot jsonb;
  v_members jsonb := '[]'::jsonb;
  v_created_items integer := 0;
  v_created_links integer := 0;
  v_catalogs integer := 0;
begin
  if p_workspace_id is null or length(btrim(p_workspace_id)) = 0 then raise exception 'workspace_id_required'; end if;
  if p_release_id is not null and not exists(select 1 from master.master_releases where id=p_release_id and status='published') then raise exception 'clinical_master_release_not_published'; end if;

  -- Caller (the A2 adoption wrapper) already owns the global publication and
  -- workspace locks.  This helper never acquires a second lock or reverses
  -- the catalog -> item -> link order.
  insert into public.lab_test_categories(id,workspace_id,category_name,sort_order)
  values(
    'lab-category:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':unclassified','UTF8'),'sha256'),'hex')),
    p_workspace_id, '카테고리 미설정', 2147483647
  ) on conflict (workspace_id,id) do nothing;
  select id into v_category_id from public.lab_test_categories where workspace_id=p_workspace_id and id='lab-category:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':unclassified','UTF8'),'sha256'),'hex'));
  if v_category_id is null then raise exception 'deterministic_category_id_collision'; end if;

  for v_catalog in
    select c.* from public.order_catalog_items c
    where c.workspace_id=p_workspace_id and c.category_group='lab' and c.source_master_record_id is not null
    order by c.id for update
  loop
    v_source_revision := v_catalog.source_master_revision;
    select profile.*, order_row.master_record_id as order_record_id,
      order_record.current_revision as order_current_revision
    into v_profile
    from master.lab_order_profiles profile
    join master.orders order_row on order_row.master_record_id=profile.order_record_id
    join master.master_records order_record on order_record.id=order_row.master_record_id
    where profile.order_record_id=v_catalog.source_master_record_id;
    if not found then continue; end if;
    if v_profile.order_current_revision <> v_source_revision then
      -- The catalog source pin is trusted; a stale source is reported to the
      -- caller and confirmation will reject until adoption is retried.
      continue;
    end if;
    v_members := '[]'::jsonb;
    if v_profile.lab_panel_id is not null then
      for v_member in select panel_item.* from master.lab_panel_items panel_item where panel_item.lab_panel_id=v_profile.lab_panel_id order by panel_item.sort_order,panel_item.lab_test_id loop
        select test.*, record_row.current_revision, record_row.master_key into v_test
        from master.lab_tests test join master.master_records record_row on record_row.id=test.master_record_id
        where test.master_record_id=v_member.lab_test_id;
        if not found then raise exception 'clinical_master_lab_test_projection_missing'; end if;
        select input_code,value_kind into v_input from master.result_input_types where master_record_id=v_test.result_input_type_id;
        select unit_code,symbol into v_unit from master.units where master_record_id=v_test.canonical_unit_id;
        v_item_id := 'lab-item:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':' || v_test.master_record_id::text,'UTF8'),'sha256'),'hex'));
        v_name := coalesce((select name from master.master_record_names where master_record_id=v_test.master_record_id and language_code='ko' and name_kind='preferred' order by sort_order,id limit 1),v_test.test_code);
        v_result_kind := v_input.value_kind;
        v_input_type := case v_result_kind when 'numeric' then 'number' when 'text' then 'text' when 'coded' then 'text' else 'text' end;
        insert into public.lab_test_items(id,workspace_id,category_id,test_item_name,result_input_type,result_unit,sort_order,availability_status,definition_origin,source_master_record_id,source_master_revision,result_value_kind,decimal_scale,workspace_result_revision,local_settings_revision,customization_state,source_projection_schema_version,source_projection_snapshot,source_projection_sha256,local_definition_snapshot,local_definition_sha256)
        values(v_item_id,p_workspace_id,v_category_id,v_name,v_input_type,v_unit.symbol,v_member.sort_order,'active','clair_master',v_test.master_record_id,v_test.current_revision,v_result_kind,v_test.decimal_scale,1,1,'unmodified',1,
          jsonb_build_object('schemaVersion',1,'sourceMasterRecordId',v_test.master_record_id,'sourceMasterRevision',v_test.current_revision,'testItemName',v_name,'resultInputType',v_input_type,'resultValueKind',v_result_kind,'resultUnit',v_unit.symbol,'decimalScale',v_test.decimal_scale),
          null,
          jsonb_build_object('schemaVersion',1,'testItemName',v_name,'resultInputType',v_input_type,'resultValueKind',v_result_kind,'resultUnit',v_unit.symbol,'decimalScale',v_test.decimal_scale),
          null)
        on conflict (workspace_id,id) do nothing;
        update public.lab_test_items set source_projection_sha256=lower(encode(extensions.digest(convert_to(source_projection_snapshot::text,'UTF8'),'sha256'),'hex')),local_definition_sha256=lower(encode(extensions.digest(convert_to(local_definition_snapshot::text,'UTF8'),'sha256'),'hex')) where workspace_id=p_workspace_id and id=v_item_id;
        select coalesce(max(workspace_result_revision),0) into v_item_revision from public.lab_test_item_versions where workspace_id=p_workspace_id and lab_test_item_id=v_item_id;
        if v_item_revision=0 then
          insert into public.lab_test_item_versions(workspace_id,lab_test_item_id,workspace_result_revision,test_item_name,result_input_type,result_value_kind,result_unit,decimal_scale,definition_origin,customization_state,source_master_record_id,source_master_revision,source_projection_schema_version,source_projection_snapshot,source_projection_sha256,local_definition_snapshot,local_definition_sha256)
          select workspace_id,id,workspace_result_revision,test_item_name,result_input_type,result_value_kind,result_unit,decimal_scale,'clair_master','unmodified',source_master_record_id,source_master_revision,source_projection_schema_version,source_projection_snapshot,source_projection_sha256,local_definition_snapshot,local_definition_sha256 from public.lab_test_items where workspace_id=p_workspace_id and id=v_item_id;
          v_created_items := v_created_items + 1;
        end if;
        v_link_id := 'lab-link:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':' || v_catalog.id || ':' || v_item_id,'UTF8'),'sha256'),'hex'));
        v_snapshot := jsonb_build_object('schemaVersion',2,'linkOrigin','clair_master','profileKind','panel','workspaceCatalogItemId',v_catalog.id,'masterOrderRecordId',v_profile.order_record_id,'masterOrderRevision',v_source_revision,'masterPanelRecordId',v_profile.lab_panel_id,'masterPanelRevision',(select current_revision from master.master_records where id=v_profile.lab_panel_id),'masterTestRecordId',v_test.master_record_id,'ownerPinnedSourceTestRevision',v_test.current_revision,'itemVersionSourceMasterRecordId',v_test.master_record_id,'itemVersionSourceTestRevision',v_test.current_revision,'labTestItemId',v_item_id,'pinnedWorkspaceResultRevision',1,'required',v_member.required,'displayGroup',v_member.display_group,'sourceOrdinal',v_member.sort_order,'effectiveSortOrder',v_member.sort_order);
        insert into public.order_catalog_lab_test_item_links(id,workspace_id,order_catalog_item_id,lab_test_item_id,sort_order,link_revision,link_origin,profile_kind,source_master_order_record_id,source_master_order_revision,source_master_panel_record_id,source_master_panel_revision,source_master_test_record_id,owner_pinned_source_test_revision,source_ordinal,effective_sort_order,pinned_workspace_result_revision,required,display_group,snapshot_metadata,snapshot_metadata_schema_version,snapshot_metadata_sha256)
        values(v_link_id,p_workspace_id,v_catalog.id,v_item_id,v_member.sort_order,1,'clair_master','panel',v_profile.order_record_id,v_source_revision,v_profile.lab_panel_id,(select current_revision from master.master_records where id=v_profile.lab_panel_id),v_test.master_record_id,v_test.current_revision,v_member.sort_order,v_member.sort_order,1,v_member.required,v_member.display_group,v_snapshot,2,private.clinical_master_sha256(v_snapshot))
        on conflict (workspace_id,id) do nothing;
        v_members := v_members || jsonb_build_array(jsonb_build_object('linkOrigin','clair_master','profileKind','panel','sourceMasterTestRecordId',v_test.master_record_id,'ownerPinnedSourceTestRevision',v_test.current_revision,'itemVersionSourceMasterRecordId',v_test.master_record_id,'itemVersionSourceTestRevision',v_test.current_revision,'labTestItemId',v_item_id,'pinnedWorkspaceResultRevision',1,'sourceOrdinal',v_member.sort_order,'effectiveSortOrder',v_member.sort_order,'required',v_member.required,'displayGroup',v_member.display_group));
        v_created_links := v_created_links + 1;
      end loop;
    else
      select test.*, record_row.current_revision, record_row.master_key into v_test
      from master.lab_tests test join master.master_records record_row on record_row.id=test.master_record_id where test.master_record_id=v_profile.lab_test_id;
      if not found then raise exception 'clinical_master_lab_test_projection_missing'; end if;
      select input_code,value_kind into v_input from master.result_input_types where master_record_id=v_test.result_input_type_id;
      select unit_code,symbol into v_unit from master.units where master_record_id=v_test.canonical_unit_id;
      v_item_id := 'lab-item:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':' || v_test.master_record_id::text,'UTF8'),'sha256'),'hex'));
      v_name := coalesce((select name from master.master_record_names where master_record_id=v_test.master_record_id and language_code='ko' and name_kind='preferred' order by sort_order,id limit 1),v_test.test_code);
      v_result_kind := v_input.value_kind; v_input_type := case v_result_kind when 'numeric' then 'number' when 'text' then 'text' when 'coded' then 'text' else 'text' end;
      insert into public.lab_test_items(id,workspace_id,category_id,test_item_name,result_input_type,result_unit,sort_order,availability_status,definition_origin,source_master_record_id,source_master_revision,result_value_kind,decimal_scale,workspace_result_revision,local_settings_revision,customization_state,source_projection_schema_version,source_projection_snapshot,source_projection_sha256,local_definition_snapshot,local_definition_sha256)
      values(v_item_id,p_workspace_id,v_category_id,v_name,v_input_type,v_unit.symbol,0,'active','clair_master',v_test.master_record_id,v_test.current_revision,v_result_kind,v_test.decimal_scale,1,1,'unmodified',1,jsonb_build_object('schemaVersion',1,'sourceMasterRecordId',v_test.master_record_id,'sourceMasterRevision',v_test.current_revision,'testItemName',v_name,'resultInputType',v_input_type,'resultValueKind',v_result_kind,'resultUnit',v_unit.symbol,'decimalScale',v_test.decimal_scale),null,jsonb_build_object('schemaVersion',1,'testItemName',v_name,'resultInputType',v_input_type,'resultValueKind',v_result_kind,'resultUnit',v_unit.symbol,'decimalScale',v_test.decimal_scale),null)
      on conflict (workspace_id,id) do update set updated_at=now();
      update public.lab_test_items set source_projection_sha256=lower(encode(extensions.digest(convert_to(source_projection_snapshot::text,'UTF8'),'sha256'),'hex')),local_definition_sha256=lower(encode(extensions.digest(convert_to(local_definition_snapshot::text,'UTF8'),'sha256'),'hex')) where workspace_id=p_workspace_id and id=v_item_id;
      if not exists(select 1 from public.lab_test_item_versions where workspace_id=p_workspace_id and lab_test_item_id=v_item_id and workspace_result_revision=1) then insert into public.lab_test_item_versions select workspace_id,id,1,test_item_name,result_input_type,result_value_kind,result_unit,decimal_scale,'clair_master',null,'unmodified',source_master_record_id,source_master_revision,source_projection_schema_version,source_projection_snapshot,source_projection_sha256,local_definition_snapshot,local_definition_sha256,null,now() from public.lab_test_items where workspace_id=p_workspace_id and id=v_item_id; end if;
      v_link_id := 'lab-link:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':' || v_catalog.id || ':' || v_item_id,'UTF8'),'sha256'),'hex'));
      v_snapshot := jsonb_build_object('schemaVersion',2,'linkOrigin','clair_master','profileKind','standalone_test','workspaceCatalogItemId',v_catalog.id,'masterOrderRecordId',v_profile.order_record_id,'masterOrderRevision',v_source_revision,'masterPanelRecordId',null,'masterPanelRevision',null,'masterTestRecordId',v_test.master_record_id,'ownerPinnedSourceTestRevision',v_test.current_revision,'itemVersionSourceMasterRecordId',v_test.master_record_id,'itemVersionSourceTestRevision',v_test.current_revision,'labTestItemId',v_item_id,'pinnedWorkspaceResultRevision',1,'required',true,'displayGroup',null,'sourceOrdinal',null,'effectiveSortOrder',0);
      insert into public.order_catalog_lab_test_item_links(id,workspace_id,order_catalog_item_id,lab_test_item_id,sort_order,link_revision,link_origin,profile_kind,source_master_order_record_id,source_master_order_revision,source_master_test_record_id,owner_pinned_source_test_revision,source_ordinal,effective_sort_order,pinned_workspace_result_revision,required,display_group,snapshot_metadata,snapshot_metadata_schema_version,snapshot_metadata_sha256)
      values(v_link_id,p_workspace_id,v_catalog.id,v_item_id,0,1,'clair_master','standalone_test',v_profile.order_record_id,v_source_revision,v_test.master_record_id,v_test.current_revision,null,0,1,true,null,v_snapshot,2,private.clinical_master_sha256(v_snapshot)) on conflict (workspace_id,id) do nothing;
      v_members := jsonb_build_array(jsonb_build_object('linkOrigin','clair_master','profileKind','standalone_test','sourceMasterTestRecordId',v_test.master_record_id,'ownerPinnedSourceTestRevision',v_test.current_revision,'itemVersionSourceMasterRecordId',v_test.master_record_id,'itemVersionSourceTestRevision',v_test.current_revision,'labTestItemId',v_item_id,'pinnedWorkspaceResultRevision',1,'sourceOrdinal',null,'effectiveSortOrder',0,'required',true,'displayGroup',null));
      v_created_links := v_created_links + 1;
    end if;
    v_snapshot := jsonb_build_object('schemaVersion',1,'sourceMasterOrderRecordId',v_profile.order_record_id,'sourceMasterOrderRevision',v_source_revision,'targetType',case when v_profile.lab_panel_id is not null then 'panel' else 'test' end,'sourceMasterPanelRecordId',v_profile.lab_panel_id,'sourceMasterPanelRevision',(select current_revision from master.master_records where id=v_profile.lab_panel_id),'members',v_members);
    update public.order_catalog_items set last_applied_lab_membership_projection_snapshot=v_snapshot,last_applied_lab_membership_projection_sha256=private.clinical_master_sha256(v_snapshot),last_applied_lab_membership_projection_schema_version=1 where workspace_id=p_workspace_id and id=v_catalog.id;
    v_catalogs := v_catalogs + 1;
  end loop;
  return jsonb_build_object('ok',true,'workspaceId',p_workspace_id,'releaseId',p_release_id,'catalogCount',v_catalogs,'createdItemCount',v_created_items,'createdLinkCount',v_created_links,'enforcedBy','clinical-master-lab-adoption');
end
$$;
revoke all on function private.clair_adopt_lab_master_projection_to_workspace(text,uuid) from public, anon, authenticated, service_role;

-- Membership source fingerprints exclude workspace-owned effective ordering and
-- the selected immutable item pin.  Those fields remain in the evidence
-- snapshot, but changing them locally must not manufacture a source review.
create or replace function private.clinical_master_lab_membership_source_fingerprint(p_snapshot jsonb)
returns text language sql immutable set search_path = public, private, pg_catalog as $$
  select case
    when p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then null
    else private.clinical_master_sha256(jsonb_build_object(
      'schemaVersion', p_snapshot->'schemaVersion',
      'sourceMasterOrderRecordId', p_snapshot->'sourceMasterOrderRecordId',
      'sourceMasterOrderRevision', p_snapshot->'sourceMasterOrderRevision',
      'targetType', p_snapshot->'targetType',
      'sourceMasterPanelRecordId', p_snapshot->'sourceMasterPanelRecordId',
      'sourceMasterPanelRevision', p_snapshot->'sourceMasterPanelRevision',
      'members', coalesce((
        select jsonb_agg(
          value - 'effectiveSortOrder' - 'pinnedWorkspaceResultRevision'
          order by (value->>'sourceOrdinal')::integer nulls last,
                   value->>'sourceMasterTestRecordId', value->>'labTestItemId'
        )
        from jsonb_array_elements(coalesce(p_snapshot->'members','[]'::jsonb)) members(value)
      ), '[]'::jsonb)
    ))
  end
$$;
revoke all on function private.clinical_master_lab_membership_source_fingerprint(jsonb) from public,anon,authenticated,service_role;

create or replace function private.clair_emit_lab_definition_update_notification(
  p_workspace_id text,
  p_update_id uuid
)
returns void language plpgsql security definer set search_path = public, private, pg_catalog as $$
declare
  v_route text := '/w/' || p_workspace_id || '/hospital-admin/order-catalog?labUpdate=' || p_update_id::text;
begin
  insert into public.notification_events (
    workspace_id, notification_id, event_scope_id, event_key, dedupe_key,
    domain, priority, toast_policy, title, preview, detail, work_type_label,
    source_label, source_action_label, recipient_kind, recipient_id,
    recipient_label, recipient_payload, source_kind, source_entity_id,
    source_route, source_payload, fallback_reason, requires_action, badge_count,
    actor_user_id, issued_at_label, occurred_at, created_at, updated_at
  )
  values (
    p_workspace_id,
    'notif-clinical-master-lab-' || p_update_id::text,
    '', 'clinical_master_update_available', 'clinical-master-lab-update:' || p_update_id::text,
    'hospital_admin', 'normal', 'role_active', '임상 검사 정의 업데이트 검토',
    '임상 검사 정의 또는 패널 구성을 검토해 주세요.',
    'workspace_lab_item_updates / workspace_lab_catalog_updates 검토 큐에서 변경 내용을 확인할 수 있습니다.',
    '임상 검사 업데이트', '임상 마스터', '검토 필요', 'active_role', 'hospital_admin',
    '병원 관리자', jsonb_build_object('kind','active_role','id','hospital_admin'),
    'fallback_detail', p_update_id::text, v_route,
    jsonb_build_object('kind','fallback_detail','entity_id',p_update_id::text,'route',v_route),
    'missing_source', true, true, null, '방금 전', now(), now(), now()
  )
  on conflict (workspace_id,event_scope_id,dedupe_key) do nothing;
end
$$;
revoke all on function private.clair_emit_lab_definition_update_notification(text,uuid) from public,anon,authenticated,service_role;

create or replace function private.clair_create_lab_item_update_target(
  p_workspace_id text,
  p_release_id uuid,
  p_item_id text,
  p_source_record_id uuid,
  p_source_revision integer,
  p_source_snapshot jsonb,
  p_workspace_snapshot jsonb,
  p_affected_catalog_item_ids text[]
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_release_no bigint;
  v_target_key text := 'lab_item:' || p_workspace_id || ':' || p_item_id || ':source_changed';
  v_replay_key text;
  v_id uuid;
  v_existing public.workspace_lab_item_updates%rowtype;
  v_created boolean := false;
begin
  select release_no into v_release_no from master.master_releases where id=p_release_id;
  if v_release_no is null then raise exception 'clinical_master_release_not_published'; end if;
  v_replay_key := v_target_key || ':' || v_release_no::text || ':' || p_source_revision::text || ':' || p_release_id::text;
  select * into v_existing
  from public.workspace_lab_item_updates
  where workspace_id=p_workspace_id and replay_key=v_replay_key
  for update;
  if found then return jsonb_build_object('id',v_existing.id,'created',false); end if;
  select * into v_existing
  from public.workspace_lab_item_updates
  where workspace_id=p_workspace_id and target_key=v_target_key and status='pending'
  order by created_at desc,id desc limit 1
  for update;
  if found and (v_existing.source_release_no,v_existing.source_owner_revision,v_existing.source_release_id::text)
      >= (v_release_no,p_source_revision,p_release_id::text) then
    return jsonb_build_object('id',v_existing.id,'created',false);
  end if;
  v_id := extensions.gen_random_uuid();
  if found then
    update public.workspace_lab_item_updates
    set status='superseded',superseded_by_update_id=v_id
    where workspace_id=p_workspace_id and id=v_existing.id;
  end if;
  insert into public.workspace_lab_item_updates(
    id,workspace_id,lab_test_item_id,source_release_id,source_release_no,
    source_owner_record_id,source_owner_revision,target_key,replay_key,
    source_master_record_id,source_master_revision,update_type,status,
    expected_workspace_result_revision,changed_source_fields,
    source_projection_snapshot,source_projection_sha256,workspace_projection_snapshot,
    affected_catalog_item_ids
  )
  select v_id,p_workspace_id,p_item_id,p_release_id,v_release_no,
    p_source_record_id,p_source_revision,v_target_key,v_replay_key,
    p_source_record_id,p_source_revision,'source_changed','pending',
    item.workspace_result_revision,array['test_item_name','result_input_type','result_value_kind','result_unit','decimal_scale','source_revision'],
    p_source_snapshot,private.clinical_master_sha256(p_source_snapshot),p_workspace_snapshot,
    coalesce(p_affected_catalog_item_ids,'{}'::text[])
  from public.lab_test_items item
  where item.workspace_id=p_workspace_id and item.id=p_item_id;
  if not found then raise exception 'lab_test_item_not_found'; end if;
  perform private.clair_emit_lab_definition_update_notification(p_workspace_id,v_id);
  v_created := true;
  return jsonb_build_object('id',v_id,'created',v_created);
end
$$;
revoke all on function private.clair_create_lab_item_update_target(text,uuid,text,uuid,integer,jsonb,jsonb,text[]) from public,anon,authenticated,service_role;

create or replace function private.clair_create_lab_catalog_update_target(
  p_workspace_id text,
  p_release_id uuid,
  p_catalog_id text,
  p_source_order_id uuid,
  p_source_order_revision integer,
  p_update_type text,
  p_source_snapshot jsonb,
  p_workspace_snapshot jsonb,
  p_affected_item_ids text[]
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_release_no bigint;
  v_target_key text := 'lab_catalog:' || p_workspace_id || ':' || p_catalog_id || ':' || p_update_type;
  v_replay_key text;
  v_id uuid;
  v_existing public.workspace_lab_catalog_updates%rowtype;
begin
  select release_no into v_release_no from master.master_releases where id=p_release_id;
  if v_release_no is null then raise exception 'clinical_master_release_not_published'; end if;
  v_replay_key := v_target_key || ':' || v_release_no::text || ':' || p_source_order_revision::text || ':' || p_release_id::text;
  select * into v_existing from public.workspace_lab_catalog_updates where workspace_id=p_workspace_id and replay_key=v_replay_key for update;
  if found then return jsonb_build_object('id',v_existing.id,'created',false); end if;
  select * into v_existing from public.workspace_lab_catalog_updates
  where workspace_id=p_workspace_id and target_key=v_target_key and status='pending'
  order by created_at desc,id desc limit 1 for update;
  if found and (v_existing.source_release_no,v_existing.source_owner_revision,v_existing.source_release_id::text)
      >= (v_release_no,p_source_order_revision,p_release_id::text) then
    return jsonb_build_object('id',v_existing.id,'created',false);
  end if;
  v_id := extensions.gen_random_uuid();
  if found then
    update public.workspace_lab_catalog_updates set status='superseded',superseded_by_update_id=v_id
    where workspace_id=p_workspace_id and id=v_existing.id;
  end if;
  insert into public.workspace_lab_catalog_updates(
    id,workspace_id,order_catalog_item_id,source_release_id,source_release_no,
    source_owner_record_id,source_owner_revision,target_key,replay_key,
    source_master_order_record_id,source_master_order_revision,update_type,status,
    expected_catalog_revision,source_membership_projection_snapshot,
    source_membership_projection_sha256,workspace_membership_projection_snapshot,
    affected_lab_test_item_ids
  )
  select v_id,p_workspace_id,p_catalog_id,p_release_id,v_release_no,
    p_source_order_id,p_source_order_revision,v_target_key,v_replay_key,
    p_source_order_id,p_source_order_revision,p_update_type,'pending',
    item.catalog_revision,p_source_snapshot,private.clinical_master_lab_membership_source_fingerprint(p_source_snapshot),
    p_workspace_snapshot,coalesce(p_affected_item_ids,'{}'::text[])
  from public.order_catalog_items item
  where item.workspace_id=p_workspace_id and item.id=p_catalog_id;
  if not found then raise exception 'order_catalog_item_not_found'; end if;
  perform private.clair_emit_lab_definition_update_notification(p_workspace_id,v_id);
  return jsonb_build_object('id',v_id,'created',true);
end
$$;
revoke all on function private.clair_create_lab_catalog_update_target(text,uuid,text,uuid,integer,text,jsonb,jsonb,text[]) from public,anon,authenticated,service_role;

-- Preserve the narrow projection writer as a private base, then add only the
-- B1 source-mismatch/review bookkeeping around it.  The base keeps its
-- deterministic creation logic; this wrapper restores the full local set when
-- a source membership mismatch requires review.
do $$
begin
  if to_regprocedure('private.clair_adopt_lab_master_projection_to_workspace(text,uuid)') is not null
     and to_regprocedure('private.clair_adopt_lab_master_projection_to_workspace_base(text,uuid)') is null then
    alter function private.clair_adopt_lab_master_projection_to_workspace(text,uuid)
      rename to clair_adopt_lab_master_projection_to_workspace_base;
  end if;
end
$$;

create or replace function private.clair_adopt_lab_master_projection_to_workspace(
  p_workspace_id text,
  p_release_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_base jsonb;
  v_catalog record;
  v_after record;
  v_item record;
  v_test record;
  v_input record;
  v_unit record;
  v_snapshot jsonb;
  v_workspace_snapshot jsonb;
  v_review jsonb;
  v_review_count integer := 0;
  v_notification_count integer := 0;
  v_source_hash text;
  v_old_ids text[];
  v_new_ids text[];
  v_affected text[];
  v_update_type text;
begin
  create temp table if not exists pg_temp.clair_b1_lab_catalog_before (
    catalog_id text primary key,
    snapshot jsonb,
    snapshot_sha256 text,
    snapshot_schema_version integer,
    authored_link_ids text[] not null default '{}'
  ) on commit drop;
  truncate pg_temp.clair_b1_lab_catalog_before;
  insert into pg_temp.clair_b1_lab_catalog_before(catalog_id,snapshot,snapshot_sha256,snapshot_schema_version,authored_link_ids)
  select c.id,c.last_applied_lab_membership_projection_snapshot,
         c.last_applied_lab_membership_projection_sha256,
         c.last_applied_lab_membership_projection_schema_version,
         coalesce(array_agg(link.id order by link.id) filter (where link.id is not null),'{}'::text[])
  from public.order_catalog_items c
  left join public.order_catalog_lab_test_item_links link
    on link.workspace_id=c.workspace_id and link.order_catalog_item_id=c.id
   and link.link_origin in ('clair_master','workspace_custom')
  where c.workspace_id=p_workspace_id and c.category_group='lab'
  group by c.id,c.last_applied_lab_membership_projection_snapshot,
           c.last_applied_lab_membership_projection_sha256,
           c.last_applied_lab_membership_projection_schema_version;

  v_base := private.clair_adopt_lab_master_projection_to_workspace_base(p_workspace_id,p_release_id);

  -- Full membership/profile comparison.  A source match is left to the base
  -- writer; a mismatch restores the prior projection and authored set before
  -- creating one durable catalog review target.
  for v_catalog in select before_row.*, release.release_no
    from pg_temp.clair_b1_lab_catalog_before before_row
    join master.master_releases release on release.id=p_release_id
    order by before_row.catalog_id
  loop
    select c.last_applied_lab_membership_projection_snapshot,
           c.last_applied_lab_membership_projection_sha256,
           c.source_master_record_id,
           c.source_master_revision,
           c.catalog_revision
      into v_after
    from public.order_catalog_items c
    where c.workspace_id=p_workspace_id and c.id=v_catalog.catalog_id;
    if not found or v_after.last_applied_lab_membership_projection_snapshot is null then continue; end if;
    if v_catalog.snapshot is null and cardinality(v_catalog.authored_link_ids)=0 then continue; end if;
    if private.clinical_master_lab_membership_source_fingerprint(v_catalog.snapshot)
       is not distinct from private.clinical_master_lab_membership_source_fingerprint(v_after.last_applied_lab_membership_projection_snapshot) then
      continue;
    end if;
    v_workspace_snapshot := coalesce(v_catalog.snapshot,'{}'::jsonb);
    v_update_type := case when (v_catalog.snapshot->>'targetType') is distinct from (v_after.last_applied_lab_membership_projection_snapshot->>'targetType')
                           or (v_catalog.snapshot->>'sourceMasterPanelRecordId') is distinct from (v_after.last_applied_lab_membership_projection_snapshot->>'sourceMasterPanelRecordId')
                           then 'profile_changed' else 'membership_changed' end;
    select coalesce(array_agg(value->>'labTestItemId' order by value->>'labTestItemId'),'{}'::text[])
      into v_affected
    from jsonb_array_elements(coalesce(v_after.last_applied_lab_membership_projection_snapshot->'members','[]'::jsonb)) members(value)
    where value->>'labTestItemId' is not null;
    v_review := private.clair_create_lab_catalog_update_target(
      p_workspace_id,p_release_id,v_catalog.catalog_id,v_after.source_master_record_id,
      v_after.source_master_revision,v_update_type,
      v_after.last_applied_lab_membership_projection_snapshot,v_workspace_snapshot,v_affected
    );
    if coalesce((v_review->>'created')::boolean,false) then
      v_review_count := v_review_count + 1;
      v_notification_count := v_notification_count + 1;
    end if;
    update public.order_catalog_items
    set last_applied_lab_membership_projection_snapshot=v_catalog.snapshot,
        last_applied_lab_membership_projection_sha256=v_catalog.snapshot_sha256,
        last_applied_lab_membership_projection_schema_version=v_catalog.snapshot_schema_version
    where workspace_id=p_workspace_id and id=v_catalog.catalog_id;
    select coalesce(array_agg(link.id order by link.id),'{}'::text[]) into v_new_ids
    from public.order_catalog_lab_test_item_links link
    where link.workspace_id=p_workspace_id and link.order_catalog_item_id=v_catalog.catalog_id
      and link.link_origin in ('clair_master','workspace_custom');
    delete from public.order_catalog_lab_test_item_links link
    where link.workspace_id=p_workspace_id and link.order_catalog_item_id=v_catalog.catalog_id
      and link.link_origin in ('clair_master','workspace_custom')
      and not (link.id = any(v_catalog.authored_link_ids));
  end loop;

  -- A changed source test is evaluated independently of catalog membership so
  -- one shared workspace item produces one target and reports all references.
  for v_item in
    select item.*,
           record_row.current_revision as source_revision,
           record_row.master_key
    from public.lab_test_items item
    join master.master_records record_row on record_row.id=item.source_master_record_id
    where item.workspace_id=p_workspace_id
      and item.definition_origin='clair_master'
      and exists(select 1 from master.master_record_versions version_row
                 where version_row.release_id=p_release_id
                   and version_row.master_record_id=item.source_master_record_id
                   and version_row.revision=record_row.current_revision)
    order by item.id
  loop
    select test.*, input.input_code, input.value_kind, input.supports_unit,
           unit.unit_code, unit.symbol,
           coalesce((select name_row.name from master.master_record_names name_row
                     where name_row.master_record_id=test.master_record_id
                       and name_row.language_code='ko' and name_row.name_kind='preferred'
                     order by name_row.sort_order,name_row.id limit 1),test.test_code) as preferred_name
      into v_test
    from master.lab_tests test
    join master.result_input_types input on input.master_record_id=test.result_input_type_id
    left join master.units unit on unit.master_record_id=test.canonical_unit_id
    where test.master_record_id=v_item.source_master_record_id;
    if not found then continue; end if;
    v_snapshot := jsonb_build_object(
      'schemaVersion',1,
      'sourceMasterRecordId',v_test.master_record_id,
      'sourceMasterRevision',v_item.source_revision,
      'testItemName',v_test.preferred_name,
      'resultInputType',case v_test.value_kind when 'numeric' then 'number' when 'text' then 'text' when 'coded' then 'text' else null end,
      'resultValueKind',v_test.value_kind,
      'resultUnit',v_test.symbol,
      'decimalScale',v_test.decimal_scale
    );
    v_source_hash := private.clinical_master_sha256(v_snapshot);
    if v_item.source_master_revision = v_item.source_revision
       and v_item.source_projection_schema_version=1
       and v_item.source_projection_snapshot is not distinct from v_snapshot
       and v_item.source_projection_sha256 = v_source_hash
       and v_item.customization_state='unmodified' then
      continue;
    end if;
    select coalesce(array_agg(link.order_catalog_item_id order by link.order_catalog_item_id),'{}'::text[])
      into v_affected
    from public.order_catalog_lab_test_item_links link
    where link.workspace_id=p_workspace_id and link.lab_test_item_id=v_item.id
      and link.link_origin in ('clair_master','workspace_custom');
    v_workspace_snapshot := jsonb_build_object(
      'schemaVersion',1,'sourceMasterRecordId',v_item.source_master_record_id,
      'sourceMasterRevision',v_item.source_master_revision,
      'testItemName',v_item.test_item_name,'resultInputType',v_item.result_input_type,
      'resultValueKind',v_item.result_value_kind,'resultUnit',v_item.result_unit,
      'decimalScale',v_item.decimal_scale,'workspaceResultRevision',v_item.workspace_result_revision,
      'customizationState',v_item.customization_state
    );
    v_review := private.clair_create_lab_item_update_target(
      p_workspace_id,p_release_id,v_item.id,v_test.master_record_id,v_item.source_revision,
      v_snapshot,v_workspace_snapshot,v_affected
    );
    if coalesce((v_review->>'created')::boolean,false) then
      v_review_count := v_review_count + 1;
      v_notification_count := v_notification_count + 1;
    end if;
  end loop;

  return v_base || jsonb_build_object('reviewCount',v_review_count,'notificationCount',v_notification_count);
end
$$;
revoke all on function private.clair_adopt_lab_master_projection_to_workspace(text,uuid) from public,anon,authenticated,service_role;

-- Keep the immutable writer as the only projection writer, then add the
-- durable review boundary around it.  A later release is compared from the
-- order version published in that release; mutable master current_revision is
-- never used to manufacture the source snapshot.
do $$
begin
  if to_regprocedure('private.clair_adopt_lab_master_projection_to_workspace(text,uuid)') is not null
     and to_regprocedure('private.clair_adopt_lab_master_projection_to_workspace_immutable_base(text,uuid)') is null then
    alter function private.clair_adopt_lab_master_projection_to_workspace(text,uuid)
      rename to clair_adopt_lab_master_projection_to_workspace_immutable_base;
  end if;
end
$$;

create or replace function private.clair_adopt_lab_master_projection_to_workspace(
  p_workspace_id text,
  p_release_id uuid
)
returns jsonb language plpgsql security definer
set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_base jsonb;
  v_before record;
  v_order_version record;
  v_panel_version record;
  v_profile jsonb;
  v_member jsonb;
  v_members jsonb;
  v_source_snapshot jsonb;
  v_workspace_snapshot jsonb;
  v_review jsonb;
  v_item public.lab_test_items%rowtype;
  v_link public.order_catalog_lab_test_item_links%rowtype;
  v_projection jsonb;
  v_test_id uuid;
  v_test_revision integer;
  v_source_revision integer;
  v_panel_id uuid;
  v_panel_revision integer;
  v_item_id text;
  v_update_type text;
  v_affected text[];
  v_review_count integer := 0;
  v_notification_count integer := 0;
begin
  create temp table if not exists pg_temp.clair_b1_lab_review_before (
    catalog_id text primary key,
    source_master_record_id uuid not null,
    source_master_revision integer not null,
    snapshot jsonb not null
  ) on commit drop;
  truncate pg_temp.clair_b1_lab_review_before;
  insert into pg_temp.clair_b1_lab_review_before(catalog_id,source_master_record_id,source_master_revision,snapshot)
  select item.id,item.source_master_record_id,item.source_master_revision,
         item.last_applied_lab_membership_projection_snapshot
  from public.order_catalog_items item
  where item.workspace_id=p_workspace_id
    and item.category_group='lab'
    and item.source_master_record_id is not null
    and item.last_applied_lab_membership_projection_snapshot is not null;

  v_base := private.clair_adopt_lab_master_projection_to_workspace_immutable_base(p_workspace_id,p_release_id);

  for v_before in select * from pg_temp.clair_b1_lab_review_before order by catalog_id loop
    select version.snapshot,version.revision,owner.master_key
      into v_order_version
    from master.master_record_versions version
    join master.master_records owner on owner.id=version.master_record_id
    where version.release_id=p_release_id
      and version.master_record_id=v_before.source_master_record_id
      and owner.record_type='order'
    order by version.revision desc
    limit 1;
    if not found or v_order_version.revision <= v_before.source_master_revision then continue; end if;

    select value into v_profile
    from jsonb_array_elements(coalesce(v_order_version.snapshot->'labOrderProfiles','[]'::jsonb)) profiles(value)
    where value->>'orderMasterKey'=v_order_version.master_key
    limit 1;
    if not found then continue; end if;
    v_panel_id := nullif(v_profile->>'labPanelMasterRecordId','')::uuid;
    v_panel_revision := nullif(v_profile->>'labPanelMasterRevision','')::integer;
    v_test_id := nullif(v_profile->>'labTestMasterRecordId','')::uuid;
    v_test_revision := nullif(v_profile->>'labTestMasterRevision','')::integer;
    if (v_panel_id is null) = (v_test_id is null) then raise exception 'clinical_master_lab_order_profile_target_exactly_one'; end if;
    v_members := '[]'::jsonb;

    if v_panel_id is not null then
      select version.snapshot into v_panel_version
      from master.master_record_versions version
      where version.master_record_id=v_panel_id and version.revision=v_panel_revision;
      if not found then raise exception 'catalog_source_panel_version_missing'; end if;
      for v_member in
        select value from jsonb_array_elements(coalesce(v_panel_version.snapshot->'labPanelItems','[]'::jsonb)) items(value)
        order by (value->>'sortOrder')::integer,value->>'testMasterKey'
      loop
        v_test_id := nullif(v_member->>'testMasterRecordId','')::uuid;
        v_test_revision := nullif(v_member->>'testMasterRevision','')::integer;
        if v_test_id is null or v_test_revision is null then raise exception 'catalog_source_panel_link_pin_missing'; end if;
        v_item_id := 'lab-item:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':' || v_test_id::text,'UTF8'),'sha256'),'hex'));
        select * into v_item from public.lab_test_items item where item.workspace_id=p_workspace_id and item.id=v_item_id;
        select * into v_link from public.order_catalog_lab_test_item_links link
        where link.workspace_id=p_workspace_id and link.order_catalog_item_id=v_before.catalog_id and link.lab_test_item_id=v_item_id
        order by link.id limit 1;
        if not found or v_item.id is null then raise exception 'catalog_review_member_projection_missing'; end if;
        v_members := v_members || jsonb_build_array(jsonb_build_object(
          'linkOrigin',coalesce(v_link.link_origin,'clair_master'),
          'profileKind','panel',
          'sourceMasterTestRecordId',v_test_id,
          'ownerPinnedSourceTestRevision',v_test_revision,
          'itemVersionSourceMasterRecordId',v_item.source_master_record_id,
          'itemVersionSourceTestRevision',v_item.source_master_revision,
          'labTestItemId',v_item_id,
          'pinnedWorkspaceResultRevision',v_link.pinned_workspace_result_revision,
          'sourceOrdinal',(v_member->>'sortOrder')::integer,
          'effectiveSortOrder',v_link.effective_sort_order,
          'required',coalesce((v_member->>'required')::boolean,true),
          'displayGroup',nullif(v_member->>'displayGroup','')
        ));
      end loop;
    else
      v_item_id := 'lab-item:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':' || v_test_id::text,'UTF8'),'sha256'),'hex'));
      select * into v_item from public.lab_test_items item where item.workspace_id=p_workspace_id and item.id=v_item_id;
      select * into v_link from public.order_catalog_lab_test_item_links link
      where link.workspace_id=p_workspace_id and link.order_catalog_item_id=v_before.catalog_id and link.lab_test_item_id=v_item_id
      order by link.id limit 1;
      if not found or v_item.id is null then raise exception 'catalog_review_member_projection_missing'; end if;
      v_members := jsonb_build_array(jsonb_build_object(
        'linkOrigin',coalesce(v_link.link_origin,'clair_master'),
        'profileKind','standalone_test',
        'sourceMasterTestRecordId',v_test_id,
        'ownerPinnedSourceTestRevision',v_test_revision,
        'itemVersionSourceMasterRecordId',v_item.source_master_record_id,
        'itemVersionSourceTestRevision',v_item.source_master_revision,
        'labTestItemId',v_item_id,
        'pinnedWorkspaceResultRevision',v_link.pinned_workspace_result_revision,
        'sourceOrdinal',null,
        'effectiveSortOrder',v_link.effective_sort_order,
        'required',true,
        'displayGroup',null
      ));
    end if;

    v_source_snapshot := jsonb_build_object(
      'schemaVersion',1,
      'sourceMasterOrderRecordId',v_before.source_master_record_id,
      'sourceMasterOrderRevision',v_order_version.revision,
      'targetType',case when v_panel_id is not null then 'panel' else 'test' end,
      'sourceMasterPanelRecordId',v_panel_id,
      'sourceMasterPanelRevision',v_panel_revision,
      'members',v_members
    );
    if private.clinical_master_lab_membership_source_fingerprint(v_before.snapshot)
       is not distinct from private.clinical_master_lab_membership_source_fingerprint(v_source_snapshot) then continue; end if;
    v_workspace_snapshot := v_before.snapshot;
    v_update_type := case
      when v_before.snapshot->>'targetType' is distinct from v_source_snapshot->>'targetType'
        or v_before.snapshot->>'sourceMasterPanelRecordId' is distinct from v_source_snapshot->>'sourceMasterPanelRecordId'
        or v_before.snapshot->>'sourceMasterPanelRevision' is distinct from v_source_snapshot->>'sourceMasterPanelRevision'
      then 'profile_changed' else 'membership_changed' end;
    select coalesce(array_agg(value->>'labTestItemId' order by value->>'labTestItemId'),'{}'::text[])
      into v_affected
    from jsonb_array_elements(coalesce(v_before.snapshot->'members','[]'::jsonb)) members(value)
    where value->>'labTestItemId' is not null;
    v_review := private.clair_create_lab_catalog_update_target(
      p_workspace_id,p_release_id,v_before.catalog_id,v_before.source_master_record_id,
      v_order_version.revision,v_update_type,v_source_snapshot,v_workspace_snapshot,v_affected
    );
    if coalesce((v_review->>'created')::boolean,false) then
      v_review_count := v_review_count + 1;
      v_notification_count := v_notification_count + 1;
    end if;
  end loop;

  -- A changed source test is reviewed independently of catalog membership so
  -- one shared workspace item produces one durable target.  The source
  -- revision and projection come only from the immutable version published in
  -- this release; mutable master current_revision/name rows are not read.
  for v_item in
    select item.*
    from public.lab_test_items item
    join master.master_record_versions version_row
      on version_row.master_record_id=item.source_master_record_id
     and version_row.release_id=p_release_id
    where item.workspace_id=p_workspace_id
      and item.definition_origin='clair_master'
    order by item.id
  loop
    select version_row.revision
      into v_source_revision
    from master.master_record_versions version_row
    where version_row.master_record_id=v_item.source_master_record_id
      and version_row.release_id=p_release_id
    order by version_row.revision desc
    limit 1;
    v_projection := private.clinical_master_lab_test_projection(
      v_item.source_master_record_id,
      v_source_revision
    );
    if v_projection is null then continue; end if;
    v_source_snapshot := jsonb_build_object(
      'schemaVersion',1,
      'sourceMasterRecordId',v_item.source_master_record_id,
      'sourceMasterRevision',v_source_revision,
      'testItemName',v_projection->>'testItemName',
      'resultInputType',v_projection->>'resultInputType',
      'resultValueKind',v_projection->>'resultValueKind',
      'resultUnit',v_projection->>'resultUnit',
      'decimalScale',nullif(v_projection->>'decimalScale','')::integer
    );
    if v_item.source_master_revision = v_source_revision
       and v_item.source_projection_schema_version=1
       and v_item.source_projection_snapshot is not distinct from v_source_snapshot
       and v_item.source_projection_sha256 = private.clinical_master_sha256(v_source_snapshot)
       and v_item.customization_state='unmodified' then
      continue;
    end if;
    -- Only report links whose stored immutable owner version is the latest
    -- published owner before this release and whose next owner projection
    -- actually carries this test at the incoming revision.  An independent
    -- pending catalog removal is the one exception: retain the old link in
    -- the item target so item-first and catalog-first can share one CAS
    -- sequence, while the resolver leaves the delete/revision to the catalog
    -- target. A stale or independently authored link sharing the workspace
    -- item is not part of this review target.
    select coalesce(array_agg(distinct link.order_catalog_item_id order by link.order_catalog_item_id),'{}'::text[])
      into v_affected
    from public.order_catalog_lab_test_item_links link
    where link.workspace_id=p_workspace_id
      and link.lab_test_item_id=v_item.id
      and link.link_origin='clair_master'
      and link.source_master_test_record_id=v_item.source_master_record_id
      and link.owner_pinned_source_test_revision=v_item.source_master_revision
      and (
        (
          link.profile_kind='panel'
          and link.source_master_order_revision = (
            select max(old_order.revision)
            from master.master_record_versions old_order
            join master.master_releases old_release on old_release.id=old_order.release_id
            where old_order.master_record_id=link.source_master_order_record_id
              and old_release.release_no < (select release.release_no from master.master_releases release where release.id=p_release_id)
          )
          and link.source_master_panel_revision = (
            select max(old_panel.revision)
            from master.master_record_versions old_panel
            join master.master_releases old_release on old_release.id=old_panel.release_id
            where old_panel.master_record_id=link.source_master_panel_record_id
              and old_release.release_no < (select release.release_no from master.master_releases release where release.id=p_release_id)
          )
          and exists (
            select 1
            from master.master_record_versions old_panel
            where old_panel.master_record_id=link.source_master_panel_record_id
              and old_panel.revision=link.source_master_panel_revision
              and exists (
                select 1
                from jsonb_array_elements(coalesce(old_panel.snapshot->'labPanelItems','[]'::jsonb)) old_member(value)
                where nullif(old_member.value->>'testMasterRecordId','')::uuid=link.source_master_test_record_id
                  and nullif(old_member.value->>'testMasterRevision','')::integer=v_item.source_master_revision
                  and nullif(old_member.value->>'sortOrder','')::integer=link.source_ordinal
              )
          )
          and exists (
            select 1
            from master.master_record_versions new_order
            join lateral jsonb_array_elements(coalesce(new_order.snapshot->'labOrderProfiles','[]'::jsonb)) new_profile(value) on true
            join master.master_record_versions new_panel
              on new_panel.release_id=p_release_id
             and new_panel.master_record_id=link.source_master_panel_record_id
            where new_order.release_id=p_release_id
              and new_order.master_record_id=link.source_master_order_record_id
              and new_profile.value->>'labPanelMasterRecordId'=link.source_master_panel_record_id::text
              and nullif(new_profile.value->>'labPanelMasterRevision','')::integer=new_panel.revision
              and exists (
                select 1
                from jsonb_array_elements(coalesce(new_panel.snapshot->'labPanelItems','[]'::jsonb)) new_member(value)
                where nullif(new_member.value->>'testMasterRecordId','')::uuid=link.source_master_test_record_id
                  and nullif(new_member.value->>'testMasterRevision','')::integer=v_source_revision
                  and nullif(new_member.value->>'sortOrder','')::integer=link.source_ordinal
              )
          )
        )
        or (
          link.profile_kind='standalone_test'
          and link.source_master_order_revision = (
            select max(old_order.revision)
            from master.master_record_versions old_order
            join master.master_releases old_release on old_release.id=old_order.release_id
            where old_order.master_record_id=link.source_master_order_record_id
              and old_release.release_no < (select release.release_no from master.master_releases release where release.id=p_release_id)
          )
          and exists (
            select 1
            from master.master_record_versions old_order
            join lateral jsonb_array_elements(coalesce(old_order.snapshot->'labOrderProfiles','[]'::jsonb)) old_profile(value) on true
            where old_order.master_record_id=link.source_master_order_record_id
              and old_order.revision=link.source_master_order_revision
              and old_profile.value->>'labTestMasterRecordId'=link.source_master_test_record_id::text
              and nullif(old_profile.value->>'labTestMasterRevision','')::integer=v_item.source_master_revision
          )
          and exists (
            select 1
            from master.master_record_versions new_order
            join lateral jsonb_array_elements(coalesce(new_order.snapshot->'labOrderProfiles','[]'::jsonb)) new_profile(value) on true
            where new_order.release_id=p_release_id
              and new_order.master_record_id=link.source_master_order_record_id
              and new_profile.value->>'labTestMasterRecordId'=link.source_master_test_record_id::text
              and nullif(new_profile.value->>'labTestMasterRevision','')::integer=v_source_revision
              )
          )
        or exists (
          select 1
          from public.workspace_lab_catalog_updates removing_catalog
          where removing_catalog.workspace_id=p_workspace_id
            and removing_catalog.order_catalog_item_id=link.order_catalog_item_id
            and removing_catalog.source_release_id=p_release_id
            and removing_catalog.status='pending'
            and removing_catalog.update_type in ('membership_changed','profile_changed')
            and not exists (
              select 1
              from jsonb_array_elements(
                coalesce(removing_catalog.source_membership_projection_snapshot->'members','[]'::jsonb)
              ) removing_member(value)
              where removing_member.value->>'labTestItemId'=link.lab_test_item_id
            )
        )
      );
    v_workspace_snapshot := jsonb_build_object(
      'schemaVersion',1,
      'sourceMasterRecordId',v_item.source_master_record_id,
      'sourceMasterRevision',v_item.source_master_revision,
      'testItemName',v_item.test_item_name,
      'resultInputType',v_item.result_input_type,
      'resultValueKind',v_item.result_value_kind,
      'resultUnit',v_item.result_unit,
      'decimalScale',v_item.decimal_scale,
      'workspaceResultRevision',v_item.workspace_result_revision,
      'customizationState',v_item.customization_state
    );
    v_review := private.clair_create_lab_item_update_target(
      p_workspace_id,p_release_id,v_item.id,v_item.source_master_record_id,
      v_source_revision,v_source_snapshot,v_workspace_snapshot,v_affected
    );
    if coalesce((v_review->>'created')::boolean,false) then
      v_review_count := v_review_count + 1;
      v_notification_count := v_notification_count + 1;
    end if;
  end loop;

  return v_base || jsonb_build_object('reviewCount',v_review_count,'notificationCount',v_notification_count);
end
$$;
revoke all on function private.clair_adopt_lab_master_projection_to_workspace(text,uuid) from public,anon,authenticated,service_role;

-- Re-assert the exact validator after all earlier compatibility definitions;
-- the deferred triggers installed near the result-table setup resolve this
-- final function body at statement/transaction end.
create or replace function private.clair_assert_lab_result_definition_snapshot(
  p_workspace_id text,
  p_result_entry_id uuid
)
returns void language plpgsql security definer
set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_entry public.lab_result_entries%rowtype;
  v_source jsonb;
  v_profile jsonb;
  v_row jsonb;
  v_stored public.lab_result_entry_rows%rowtype;
  v_expected_keys text[] := array['analyteName','decimalScale','displayGroup','effectiveSortOrder','itemVersionSourceMasterRecordId','itemVersionSourceTestRevision','labTestItemId','ordinal','ownerPinnedSourceTestRevision','referenceRange','required','resultInputType','resultValueKind','rowDefinitionOrigin','rowId','sourceMasterTestRecordId','sourceOrdinal','unit','workspaceResultRevision'];
  v_row_count integer;
begin
  select * into v_entry from public.lab_result_entries entry where entry.workspace_id=p_workspace_id and entry.id=p_result_entry_id for update;
  if not found then raise exception 'lab_result_not_found'; end if;
  if v_entry.result_definition_origin <> 'canonical' then return; end if;
  if v_entry.result_definition_snapshot_sha256 is distinct from private.clinical_master_sha256(v_entry.result_definition_snapshot) then raise exception 'lab_result_definition_snapshot_invalid'; end if;
  if (select array_agg(key order by key) from jsonb_object_keys(v_entry.result_definition_snapshot) keys(key)) is distinct from array['rows','schemaVersion','source']::text[]
     or jsonb_typeof(v_entry.result_definition_snapshot->'schemaVersion') <> 'number'
     or v_entry.result_definition_snapshot->>'schemaVersion' <> '1'
     or jsonb_typeof(v_entry.result_definition_snapshot->'source') <> 'object'
     or jsonb_typeof(v_entry.result_definition_snapshot->'rows') <> 'array' then raise exception 'lab_result_definition_snapshot_invalid'; end if;
  v_source := v_entry.result_definition_snapshot->'source';
  if (select array_agg(key order by key) from jsonb_object_keys(v_source) keys(key)) is distinct from array['masterOrderRecordId','masterOrderRevision','profile','workspaceCatalogItemId','workspaceCatalogRevision']::text[] then raise exception 'lab_result_definition_snapshot_invalid'; end if;
  if v_source->>'workspaceCatalogItemId' is distinct from v_entry.source_workspace_catalog_item_id::text
     or nullif(v_source->>'workspaceCatalogRevision','')::integer is distinct from v_entry.source_workspace_catalog_revision
     or v_source->>'masterOrderRecordId' is distinct from v_entry.source_master_order_record_id::text
     or nullif(v_source->>'masterOrderRevision','')::integer is distinct from v_entry.source_master_order_revision then raise exception 'lab_result_definition_snapshot_invalid'; end if;
  if v_entry.source_workspace_catalog_item_id is null
     or v_entry.source_workspace_catalog_revision is null
     or v_entry.source_workspace_catalog_revision < 1
     or v_entry.source_master_order_record_id is null
     or v_entry.source_master_order_revision is null
     or v_entry.source_master_order_revision < 1
     or (v_entry.source_master_panel_record_id is null) = (v_entry.source_master_test_record_id is null) then
    raise exception 'lab_result_definition_snapshot_invalid';
  end if;
  v_profile := v_source->'profile';
  if coalesce(jsonb_typeof(v_source->'workspaceCatalogItemId'),'missing') <> 'string'
     or coalesce(jsonb_typeof(v_source->'workspaceCatalogRevision'),'missing') <> 'number'
     or coalesce(jsonb_typeof(v_source->'masterOrderRecordId'),'missing') <> 'string'
     or coalesce(jsonb_typeof(v_source->'masterOrderRevision'),'missing') <> 'number'
     or coalesce(jsonb_typeof(v_profile->'targetType'),'missing') <> 'string'
     or coalesce(jsonb_typeof(v_profile->'orderRecordId'),'missing') <> 'string'
     or coalesce(jsonb_typeof(v_profile->'labPanelRecordId'),'missing') not in ('string','null')
     or coalesce(jsonb_typeof(v_profile->'labPanelRevision'),'missing') not in ('number','null')
     or coalesce(jsonb_typeof(v_profile->'labTestRecordId'),'missing') not in ('string','null')
     or coalesce(jsonb_typeof(v_profile->'labTestRevision'),'missing') not in ('number','null')
     or coalesce(jsonb_typeof(v_profile->'specimenTypeRecordId'),'missing') not in ('string','null')
     or coalesce(jsonb_typeof(v_profile->'specimenTypeRevision'),'missing') not in ('number','null') then
    raise exception 'lab_result_definition_snapshot_invalid';
  end if;
  if (select array_agg(key order by key) from jsonb_object_keys(v_profile) keys(key)) is distinct from array['labPanelRecordId','labPanelRevision','labTestRecordId','labTestRevision','orderRecordId','specimenTypeRecordId','specimenTypeRevision','targetType']::text[] then raise exception 'lab_result_definition_snapshot_invalid'; end if;
  if coalesce(v_profile->>'targetType','') not in ('panel','test')
     or v_profile->>'orderRecordId' is distinct from v_entry.source_master_order_record_id::text
     or ((v_profile->>'targetType'='panel') is distinct from (v_entry.source_master_panel_record_id is not null))
     or v_profile->>'labPanelRecordId' is distinct from v_entry.source_master_panel_record_id::text
     or nullif(v_profile->>'labPanelRevision','')::integer is distinct from v_entry.source_master_panel_revision
     or v_profile->>'labTestRecordId' is distinct from v_entry.source_master_test_record_id::text
     or nullif(v_profile->>'labTestRevision','')::integer is distinct from v_entry.source_master_test_revision then raise exception 'lab_result_definition_snapshot_invalid'; end if;
  if (nullif(v_profile->>'specimenTypeRecordId','') is null) <> (nullif(v_profile->>'specimenTypeRevision','') is null) then
    raise exception 'lab_result_definition_snapshot_invalid';
  end if;
  if nullif(v_profile->>'specimenTypeRecordId','') is not null
     and (
       nullif(v_profile->>'specimenTypeRevision','') is null
       or not exists (
         select 1
         from master.master_record_versions version
         join master.master_records owner on owner.id=version.master_record_id
         where version.master_record_id=(v_profile->>'specimenTypeRecordId')::uuid
           and version.revision=(v_profile->>'specimenTypeRevision')::integer
           and owner.record_type='specimen_type'
       )
     ) then
    raise exception 'lab_result_definition_snapshot_invalid';
  end if;
  select count(*) into v_row_count from public.lab_result_entry_rows row where row.workspace_id=p_workspace_id and row.lab_result_entry_id=p_result_entry_id;
  if v_row_count < 1
     or (v_entry.source_master_panel_record_id is null and v_row_count <> 1)
     or v_row_count <> jsonb_array_length(v_entry.result_definition_snapshot->'rows')
     or v_row_count <> (select count(distinct value->>'rowId') from jsonb_array_elements(v_entry.result_definition_snapshot->'rows') rows(value))
     or (select count(distinct (value->>'ordinal')::integer) from jsonb_array_elements(v_entry.result_definition_snapshot->'rows') rows(value)) <> v_row_count
     or (select min((value->>'ordinal')::integer) from jsonb_array_elements(v_entry.result_definition_snapshot->'rows') rows(value)) <> 1
     or (select max((value->>'ordinal')::integer) from jsonb_array_elements(v_entry.result_definition_snapshot->'rows') rows(value)) <> v_row_count
     or exists (select 1 from jsonb_array_elements(v_entry.result_definition_snapshot->'rows') with ordinality rows(value,position) where (value->>'ordinal')::integer <> position::integer) then
    raise exception 'lab_result_definition_snapshot_invalid';
  end if;
  for v_row in select value from jsonb_array_elements(v_entry.result_definition_snapshot->'rows') rows(value) loop
    if coalesce(jsonb_typeof(v_row->'rowId'),'missing') <> 'string'
       or coalesce(jsonb_typeof(v_row->'rowDefinitionOrigin'),'missing') <> 'string'
       or coalesce(jsonb_typeof(v_row->'ordinal'),'missing') <> 'number'
       or coalesce(jsonb_typeof(v_row->'labTestItemId'),'missing') <> 'string'
       or coalesce(jsonb_typeof(v_row->'sourceMasterTestRecordId'),'missing') not in ('string','null')
       or coalesce(jsonb_typeof(v_row->'ownerPinnedSourceTestRevision'),'missing') not in ('number','null')
       or coalesce(jsonb_typeof(v_row->'itemVersionSourceMasterRecordId'),'missing') not in ('string','null')
       or coalesce(jsonb_typeof(v_row->'itemVersionSourceTestRevision'),'missing') not in ('number','null')
       or coalesce(jsonb_typeof(v_row->'workspaceResultRevision'),'missing') <> 'number'
       or coalesce(jsonb_typeof(v_row->'sourceOrdinal'),'missing') not in ('number','null')
       or coalesce(jsonb_typeof(v_row->'effectiveSortOrder'),'missing') <> 'number'
       or coalesce(jsonb_typeof(v_row->'analyteName'),'missing') <> 'string'
       or coalesce(jsonb_typeof(v_row->'resultValueKind'),'missing') <> 'string'
       or coalesce(jsonb_typeof(v_row->'resultInputType'),'missing') <> 'string'
       or coalesce(jsonb_typeof(v_row->'unit'),'missing') not in ('string','null')
       or coalesce(jsonb_typeof(v_row->'decimalScale'),'missing') not in ('number','null')
       or coalesce(jsonb_typeof(v_row->'referenceRange'),'missing') <> 'null'
       or coalesce(jsonb_typeof(v_row->'required'),'missing') <> 'boolean'
       or coalesce(jsonb_typeof(v_row->'displayGroup'),'missing') not in ('string','null') then
      raise exception 'lab_result_definition_snapshot_invalid';
    end if;
    if jsonb_typeof(v_row) <> 'object'
       or (select array_agg(key order by key) from jsonb_object_keys(v_row) keys(key)) is distinct from v_expected_keys
       or v_row->>'rowId' !~ '^[0-9a-f]{64}$'
       or v_row->>'referenceRange' is not null
       or v_row->>'rowDefinitionOrigin' not in ('clair_master','workspace_custom')
       or v_row->>'resultInputType' not in ('number','text','select','positive_negative','grade')
       or v_row->>'resultValueKind' not in ('numeric','text','coded')
       or nullif(v_row->>'ordinal','') is null
       or (v_row->>'ordinal')::integer < 1
       or nullif(v_row->>'effectiveSortOrder','') is null
       or (v_row->>'effectiveSortOrder')::integer < 0
       or nullif(v_row->>'workspaceResultRevision','') is null
       or (v_row->>'workspaceResultRevision')::integer < 1
       or (v_row->>'sourceOrdinal') is not null and (v_row->>'sourceOrdinal')::integer < 0
       or (v_row->>'ownerPinnedSourceTestRevision') is not null and (v_row->>'ownerPinnedSourceTestRevision')::integer < 1
       or (v_row->>'itemVersionSourceTestRevision') is not null and (v_row->>'itemVersionSourceTestRevision')::integer < 1
       or (v_row->>'decimalScale') is not null and (v_row->>'decimalScale')::integer < 0
       or v_row->>'required' is null then raise exception 'lab_result_definition_snapshot_invalid'; end if;
    if v_entry.source_master_panel_record_id is not null then
      if v_row->>'rowDefinitionOrigin' = 'clair_master'
         and (nullif(v_row->>'sourceMasterTestRecordId','') is null
           or nullif(v_row->>'ownerPinnedSourceTestRevision','') is null
           or nullif(v_row->>'sourceOrdinal','') is null) then
        raise exception 'lab_result_definition_snapshot_invalid';
      elsif v_row->>'rowDefinitionOrigin' = 'workspace_custom'
         and (nullif(v_row->>'sourceMasterTestRecordId','') is not null
           or nullif(v_row->>'ownerPinnedSourceTestRevision','') is not null
           or nullif(v_row->>'sourceOrdinal','') is not null) then
        raise exception 'lab_result_definition_snapshot_invalid';
      end if;
    elsif v_row->>'rowDefinitionOrigin' <> 'clair_master'
       or nullif(v_row->>'sourceMasterTestRecordId','') is null
       or nullif(v_row->>'ownerPinnedSourceTestRevision','') is null
       or nullif(v_row->>'sourceOrdinal','') is not null then
      raise exception 'lab_result_definition_snapshot_invalid';
    end if;
    if (nullif(v_row->>'itemVersionSourceMasterRecordId','') is null) <> (nullif(v_row->>'itemVersionSourceTestRevision','') is null) then
      raise exception 'lab_result_definition_snapshot_invalid';
    end if;
    select * into v_stored from public.lab_result_entry_rows row where row.workspace_id=p_workspace_id and row.lab_result_entry_id=p_result_entry_id and row.row_id=v_row->>'rowId';
    if not found
       or v_stored.row_definition_origin is distinct from v_row->>'rowDefinitionOrigin'
       or v_stored.lab_test_item_id is distinct from v_row->>'labTestItemId'
       or v_stored.analyte_name is distinct from v_row->>'analyteName'
       or v_stored.result_input_type is distinct from v_row->>'resultInputType'
       or v_stored.result_value_kind is distinct from v_row->>'resultValueKind'
       or v_stored.result_unit is distinct from nullif(v_row->>'unit','')
       or v_stored.reference_range is not null
       or v_stored.sort_order is distinct from nullif(v_row->>'ordinal','')::integer
       or v_stored.effective_sort_order is distinct from nullif(v_row->>'effectiveSortOrder','')::integer
       or v_stored.source_ordinal is distinct from nullif(v_row->>'sourceOrdinal','')::integer
       or v_stored.required is distinct from (v_row->>'required')::boolean
       or v_stored.display_group is distinct from nullif(v_row->>'displayGroup','')
       or v_stored.workspace_result_revision is distinct from nullif(v_row->>'workspaceResultRevision','')::integer
       or v_stored.source_master_test_record_id is distinct from nullif(v_row->>'sourceMasterTestRecordId','')::uuid
       or v_stored.owner_pinned_source_test_revision is distinct from nullif(v_row->>'ownerPinnedSourceTestRevision','')::integer
       or v_stored.item_version_source_master_record_id is distinct from nullif(v_row->>'itemVersionSourceMasterRecordId','')::uuid
       or v_stored.item_version_source_test_revision is distinct from nullif(v_row->>'itemVersionSourceTestRevision','')::integer
       or v_stored.decimal_scale is distinct from nullif(v_row->>'decimalScale','')::integer
       or v_stored.judgment is distinct from 'not_judged' then raise exception 'lab_result_definition_snapshot_invalid'; end if;
  end loop;
end
$$;
revoke all on function private.clair_assert_lab_result_definition_snapshot(text,uuid) from public,anon,authenticated,service_role;

do $$
begin
  if to_regprocedure('private.clair_create_lab_result_entry_for_confirmed_order(text,uuid,uuid,uuid)') is not null
     and to_regprocedure('private.clair_create_lab_result_entry_for_confirmed_order_mutable_base(text,uuid,uuid,uuid)') is null then
    alter function private.clair_create_lab_result_entry_for_confirmed_order(text,uuid,uuid,uuid)
      rename to clair_create_lab_result_entry_for_confirmed_order_mutable_base;
  end if;
end
$$;

-- Confirmation freezes the exact order-pinned catalog/profile/link/item
-- versions.  Optional inactive links are filtered before assigning the
-- one-based ordinal; the row identity binds the stable link ID and frozen
-- ordinal together.
create or replace function private.clair_create_lab_result_entry_for_confirmed_order(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_order_id uuid,
  p_encounter_id uuid
)
returns jsonb language plpgsql security definer
set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_order public.orders%rowtype;
  v_catalog public.order_catalog_items%rowtype;
  v_entry public.lab_result_entries%rowtype;
  v_order_version record;
  v_profile jsonb;
  v_panel_version record;
  v_link public.order_catalog_lab_test_item_links%rowtype;
  v_item public.lab_test_items%rowtype;
  v_version public.lab_test_item_versions%rowtype;
  v_row jsonb;
  v_snapshot jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_members jsonb := '[]'::jsonb;
  v_active_link_ids text[] := '{}';
  v_item_ids text[] := '{}';
  v_header_id uuid;
  v_result_id text := 'lab-order:' || p_order_id::text;
  v_row_id text;
  v_ordinal integer;
  v_active_count integer := 0;
  v_source_panel_id uuid;
  v_source_panel_revision integer;
  v_source_test_id uuid;
  v_source_test_revision integer;
  v_expected_catalog_hash text;
begin
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:' || p_workspace_id,0));
  select * into v_order from public.orders where workspace_id=p_workspace_id and id=p_order_id and encounter_id=p_encounter_id for update;
  if not found then raise exception 'order_unavailable'; end if;
  if v_order.order_type <> 'lab' or v_order.workspace_catalog_item_id is null then
    return jsonb_build_object('ok',true,'status',200,'savedResult',null,'enforcedBy','lab-result-freeze-compatibility');
  end if;
  if v_order.service_item_id is not null then raise exception 'catalog_service_dual'; end if;
  if not exists(select 1 from public.encounters where workspace_id=p_workspace_id and id=p_encounter_id and status <> 'cancelled') then raise exception 'encounter_unavailable'; end if;
  select * into v_entry from public.lab_result_entries entry where entry.workspace_id=p_workspace_id and entry.order_id=p_order_id and entry.result_definition_origin='canonical' for update;
  if found then
    if v_entry.encounter_id is distinct from p_encounter_id or v_entry.result_id is distinct from v_result_id then raise exception 'lab_result_identity_mismatch'; end if;
    return jsonb_build_object('ok',true,'status',200,'resultId',v_entry.result_id,'resultEntryId',v_entry.id,'created',false,'enforcedBy','lab-result-freeze');
  end if;
  select * into v_catalog from public.order_catalog_items item
  where item.workspace_id=p_workspace_id and item.id=v_order.workspace_catalog_item_id for update;
  if not found or v_catalog.catalog_revision <> v_order.workspace_catalog_revision then raise exception 'catalog_projection_stale'; end if;
  if v_catalog.last_applied_lab_membership_projection_snapshot is null
     or v_catalog.last_applied_lab_membership_projection_schema_version <> 1
     or v_catalog.last_applied_lab_membership_projection_sha256 is distinct from private.clinical_master_lab_membership_source_fingerprint(v_catalog.last_applied_lab_membership_projection_snapshot) then
    raise exception 'catalog_projection_stale';
  end if;
  if v_catalog.last_applied_lab_membership_projection_snapshot->>'sourceMasterOrderRecordId' is distinct from v_order.source_master_record_id::text
     or nullif(v_catalog.last_applied_lab_membership_projection_snapshot->>'sourceMasterOrderRevision','')::integer is distinct from v_order.source_master_revision then
    raise exception 'catalog_projection_stale';
  end if;
  select version.snapshot into v_order_version
  from master.master_record_versions version
  where version.master_record_id=v_order.source_master_record_id and version.revision=v_order.source_master_revision;
  if not found then raise exception 'catalog_source_version_missing'; end if;
  select value into v_profile
  from jsonb_array_elements(coalesce(v_order_version.snapshot->'labOrderProfiles','[]'::jsonb)) profiles(value)
  where value->>'orderMasterKey'=(select master_key from master.master_records where id=v_order.source_master_record_id)
  limit 1;
  if not found then raise exception 'lab_result_profile_missing'; end if;
  v_source_panel_id := nullif(v_profile->>'labPanelMasterRecordId','')::uuid;
  v_source_panel_revision := nullif(v_profile->>'labPanelMasterRevision','')::integer;
  v_source_test_id := nullif(v_profile->>'labTestMasterRecordId','')::uuid;
  v_source_test_revision := nullif(v_profile->>'labTestMasterRevision','')::integer;
  if (v_source_panel_id is null) = (v_source_test_id is null) then raise exception 'lab_result_profile_missing'; end if;
  if nullif(v_profile->>'specimenMasterRecordId','') is not null
     and (
       nullif(v_profile->>'specimenMasterRevision','') is null
       or not exists (
         select 1
         from master.master_record_versions version
         join master.master_records owner on owner.id=version.master_record_id
         where version.master_record_id=(v_profile->>'specimenMasterRecordId')::uuid
           and version.revision=(v_profile->>'specimenMasterRevision')::integer
           and owner.record_type='specimen_type'
       )
     ) then
    raise exception 'catalog_source_specimen_version_missing';
  end if;
  if v_source_panel_id is not null then
    select version.snapshot into v_panel_version from master.master_record_versions version where version.master_record_id=v_source_panel_id and version.revision=v_source_panel_revision;
    if not found then raise exception 'catalog_source_panel_version_missing'; end if;
  end if;

  -- Lock and validate the complete stored link projection first.  No ordinal
  -- is assigned until optional inactive links have been excluded.
  for v_link in
    select link.* from public.order_catalog_lab_test_item_links link
    where link.workspace_id=p_workspace_id and link.order_catalog_item_id=v_catalog.id
      and link.link_origin in ('clair_master','workspace_custom')
    order by link.effective_sort_order nulls last,link.id
    for update
  loop
    if v_link.effective_sort_order is null or v_link.pinned_workspace_result_revision is null then raise exception 'catalog_projection_stale'; end if;
    if v_link.source_master_order_record_id is distinct from v_order.source_master_record_id
       or v_link.source_master_order_revision is distinct from v_order.source_master_revision then raise exception 'catalog_projection_stale'; end if;
    if v_link.snapshot_metadata is null or v_link.snapshot_metadata_schema_version <> 2
       or v_link.snapshot_metadata_sha256 is distinct from private.clinical_master_sha256(v_link.snapshot_metadata)
       or v_link.snapshot_metadata->>'workspaceCatalogItemId' is distinct from v_catalog.id
       or v_link.snapshot_metadata->>'labTestItemId' is distinct from v_link.lab_test_item_id
       or nullif(v_link.snapshot_metadata->>'pinnedWorkspaceResultRevision','')::integer is distinct from v_link.pinned_workspace_result_revision then raise exception 'catalog_projection_stale'; end if;
    select * into v_version from public.lab_test_item_versions version_row
    where version_row.workspace_id=p_workspace_id and version_row.lab_test_item_id=v_link.lab_test_item_id and version_row.workspace_result_revision=v_link.pinned_workspace_result_revision;
    if not found then raise exception 'catalog_projection_stale'; end if;
    if v_version.definition_origin='quarantined' then raise exception 'catalog_projection_stale'; end if;
    if v_version.source_master_record_id is distinct from nullif(v_link.snapshot_metadata->>'itemVersionSourceMasterRecordId','')::uuid
       or v_version.source_master_revision is distinct from nullif(v_link.snapshot_metadata->>'itemVersionSourceTestRevision','')::integer then raise exception 'catalog_projection_stale'; end if;
    if v_link.profile_kind='panel' then
      if v_source_panel_id is null or v_link.source_master_panel_record_id is distinct from v_source_panel_id or v_link.source_master_panel_revision is distinct from v_source_panel_revision then raise exception 'catalog_projection_stale'; end if;
      if not exists(select 1 from jsonb_array_elements(coalesce(v_panel_version.snapshot->'labPanelItems','[]'::jsonb)) items(value) where nullif(value->>'testMasterRecordId','')::uuid=v_link.source_master_test_record_id and nullif(value->>'testMasterRevision','')::integer=v_link.owner_pinned_source_test_revision and (value->>'sortOrder')::integer=v_link.source_ordinal) then raise exception 'catalog_projection_stale'; end if;
    elsif v_link.profile_kind='standalone_test' then
      if v_source_test_id is null or v_link.source_master_test_record_id is distinct from v_source_test_id or v_link.owner_pinned_source_test_revision is distinct from v_source_test_revision then raise exception 'catalog_projection_stale'; end if;
    else
      raise exception 'catalog_projection_stale';
    end if;
    if not exists(select 1 from public.lab_test_items item where item.workspace_id=p_workspace_id and item.id=v_link.lab_test_item_id and item.availability_status='active') then
      if coalesce(v_link.required,true) then raise exception 'required_lab_item_inactive'; else continue; end if;
    end if;
    v_active_link_ids := array_append(v_active_link_ids,v_link.id);
    v_active_count := v_active_count + 1;
  end loop;
  if v_active_count=0 then raise exception 'no_active_lab_items'; end if;
  if v_source_panel_id is null and v_active_count <> 1 then raise exception 'standalone_lab_item_count_invalid'; end if;

  for v_link in
    select link.* from public.order_catalog_lab_test_item_links link
    where link.workspace_id=p_workspace_id and link.order_catalog_item_id=v_catalog.id
      and link.id=any(v_active_link_ids)
    order by link.effective_sort_order nulls last,link.id
  loop
    v_ordinal := array_position(v_active_link_ids,v_link.id);
    select * into v_version from public.lab_test_item_versions version_row where version_row.workspace_id=p_workspace_id and version_row.lab_test_item_id=v_link.lab_test_item_id and version_row.workspace_result_revision=v_link.pinned_workspace_result_revision;
    v_row_id := lower(encode(extensions.digest(convert_to(format('lab-result-row:v1:%s:%s:%s',p_order_id::text,v_link.id::text,v_ordinal::text),'UTF8'),'sha256'),'hex'));
    v_row := jsonb_build_object('rowId',v_row_id,'rowDefinitionOrigin',v_link.link_origin,'ordinal',v_ordinal,'labTestItemId',v_link.lab_test_item_id,'sourceMasterTestRecordId',v_link.source_master_test_record_id,'ownerPinnedSourceTestRevision',v_link.owner_pinned_source_test_revision,'itemVersionSourceMasterRecordId',v_version.source_master_record_id,'itemVersionSourceTestRevision',v_version.source_master_revision,'workspaceResultRevision',v_version.workspace_result_revision,'sourceOrdinal',v_link.source_ordinal,'effectiveSortOrder',v_link.effective_sort_order,'analyteName',v_version.test_item_name,'resultValueKind',v_version.result_value_kind,'resultInputType',v_version.result_input_type,'unit',v_version.result_unit,'decimalScale',v_version.decimal_scale,'referenceRange',null,'required',coalesce(v_link.required,true),'displayGroup',v_link.display_group);
    v_rows := v_rows || jsonb_build_array(v_row);
    v_members := v_members || jsonb_build_array(jsonb_build_object('linkOrigin',v_link.link_origin,'profileKind',v_link.profile_kind,'sourceMasterTestRecordId',v_link.source_master_test_record_id,'ownerPinnedSourceTestRevision',v_link.owner_pinned_source_test_revision,'itemVersionSourceMasterRecordId',v_version.source_master_record_id,'itemVersionSourceTestRevision',v_version.source_master_revision,'labTestItemId',v_link.lab_test_item_id,'pinnedWorkspaceResultRevision',v_link.pinned_workspace_result_revision,'sourceOrdinal',v_link.source_ordinal,'effectiveSortOrder',v_link.effective_sort_order,'required',coalesce(v_link.required,true),'displayGroup',v_link.display_group));
    v_item_ids := array_append(v_item_ids,v_link.lab_test_item_id);
  end loop;
  if v_catalog.last_applied_lab_membership_projection_snapshot->'members' is distinct from v_members then
    -- Compare via the approved source fingerprint so local effective ordering
    -- and the selected workspace item pin remain local-only choices.
    v_expected_catalog_hash := private.clinical_master_lab_membership_source_fingerprint(jsonb_build_object('schemaVersion',1,'sourceMasterOrderRecordId',v_order.source_master_record_id,'sourceMasterOrderRevision',v_order.source_master_revision,'targetType',case when v_source_panel_id is not null then 'panel' else 'test' end,'sourceMasterPanelRecordId',v_source_panel_id,'sourceMasterPanelRevision',v_source_panel_revision,'members',v_members));
    if v_expected_catalog_hash is distinct from v_catalog.last_applied_lab_membership_projection_sha256 then raise exception 'catalog_projection_stale'; end if;
  end if;
  v_snapshot := jsonb_build_object('schemaVersion',1,'source',jsonb_build_object('workspaceCatalogItemId',v_order.workspace_catalog_item_id,'workspaceCatalogRevision',v_order.workspace_catalog_revision,'masterOrderRecordId',v_order.source_master_record_id,'masterOrderRevision',v_order.source_master_revision,'profile',jsonb_build_object('orderRecordId',v_order.source_master_record_id,'targetType',case when v_source_panel_id is not null then 'panel' else 'test' end,'labPanelRecordId',v_source_panel_id,'labPanelRevision',v_source_panel_revision,'labTestRecordId',v_source_test_id,'labTestRevision',v_source_test_revision,'specimenTypeRecordId',nullif(v_profile->>'specimenMasterRecordId','')::uuid,'specimenTypeRevision',nullif(v_profile->>'specimenMasterRevision','')::integer)),'rows',v_rows);
  insert into public.lab_result_entries(workspace_id,result_id,encounter_id,order_id,result_status,result_payload,abnormal_flag,entry_write_revision,source_workspace_catalog_item_id,source_workspace_catalog_revision,source_master_order_record_id,source_master_order_revision,source_master_panel_record_id,source_master_panel_revision,source_master_test_record_id,source_master_test_revision,result_definition_snapshot,result_definition_snapshot_sha256,result_definition_origin,result_quarantine_reason,created_at,updated_at)
  values(p_workspace_id,v_result_id,p_encounter_id,p_order_id,'received','{}'::jsonb,'not_judged',0,v_order.workspace_catalog_item_id,v_order.workspace_catalog_revision,v_order.source_master_record_id,v_order.source_master_revision,v_source_panel_id,v_source_panel_revision,v_source_test_id,v_source_test_revision,v_snapshot,private.clinical_master_sha256(v_snapshot),'canonical',null,now(),now())
  on conflict (workspace_id,order_id) where (result_definition_origin='canonical') do nothing returning id into v_header_id;
  if v_header_id is null then
    select id into v_header_id from public.lab_result_entries where workspace_id=p_workspace_id and order_id=p_order_id and result_definition_origin='canonical' for update;
    return jsonb_build_object('ok',true,'status',200,'resultId',v_result_id,'resultEntryId',v_header_id,'created',false,'enforcedBy','lab-result-freeze');
  end if;
  for v_row in select value from jsonb_array_elements(v_rows) rows(value) loop
    insert into public.lab_result_entry_rows(workspace_id,lab_result_entry_id,row_id,lab_test_item_id,analyte_name,result_value,result_unit,reference_range,judgment,note,sort_order,row_definition_origin,workspace_result_revision,source_master_test_record_id,owner_pinned_source_test_revision,item_version_source_master_record_id,item_version_source_test_revision,result_value_kind,result_input_type,decimal_scale,source_ordinal,effective_sort_order,required,display_group,created_at,updated_at)
    values(p_workspace_id,v_header_id,v_row->>'rowId',v_row->>'labTestItemId',v_row->>'analyteName',null,v_row->>'unit',null,'not_judged',null,(v_row->>'ordinal')::integer,v_row->>'rowDefinitionOrigin',nullif(v_row->>'workspaceResultRevision','')::integer,nullif(v_row->>'sourceMasterTestRecordId','')::uuid,nullif(v_row->>'ownerPinnedSourceTestRevision','')::integer,nullif(v_row->>'itemVersionSourceMasterRecordId','')::uuid,nullif(v_row->>'itemVersionSourceTestRevision','')::integer,v_row->>'resultValueKind',v_row->>'resultInputType',nullif(v_row->>'decimalScale','')::integer,nullif(v_row->>'sourceOrdinal','')::integer,(v_row->>'effectiveSortOrder')::integer,(v_row->>'required')::boolean,v_row->>'displayGroup',now(),now());
  end loop;
  perform private.clair_recompute_lab_test_item_saved_result_usage_batch(p_workspace_id,v_item_ids);
  return jsonb_build_object('ok',true,'status',200,'resultId',v_result_id,'resultEntryId',v_header_id,'created',true,'enforcedBy','lab-result-freeze');
end
$$;
revoke all on function private.clair_create_lab_result_entry_for_confirmed_order(text,uuid,uuid,uuid) from public,anon,authenticated,service_role;

-- Keep the approved A2 implementation as a private base and expose the same
-- signature with the B1 lab projection extension.  This avoids a second
-- adoption authority while allowing direct A2 replay to exercise B1.
do $$
begin
  if to_regprocedure('private.clair_adopt_master_release_to_workspace(text,uuid)') is not null
     and to_regprocedure('private.clair_adopt_master_release_to_workspace_a2_base(text,uuid)') is null then
    alter function private.clair_adopt_master_release_to_workspace(text,uuid)
      rename to clair_adopt_master_release_to_workspace_a2_base;
  end if;
end
$$;

create or replace function private.clair_adopt_master_release_to_workspace(
  p_workspace_id text,
  p_release_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_base jsonb;
  v_lab jsonb;
begin
  v_base := private.clair_adopt_master_release_to_workspace_a2_base(p_workspace_id,p_release_id);
  v_lab := private.clair_adopt_lab_master_projection_to_workspace(p_workspace_id,p_release_id);
  return v_base || jsonb_build_object('labProjection',v_lab);
end
$$;
revoke all on function private.clair_adopt_master_release_to_workspace(text,uuid) from public, anon, authenticated, service_role;

create or replace function private.clair_apply_order_catalog_lab_definition_patch(
  p_workspace_id text,
  p_item_id text,
  p_expected_catalog_revision integer,
  p_patch jsonb
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_item public.order_catalog_items%rowtype;
  v_link jsonb;
  v_existing public.order_catalog_lab_test_item_links%rowtype;
  v_item_row public.lab_test_items%rowtype;
  v_catalog public.order_catalog_items%rowtype;
  v_item_version public.lab_test_item_versions%rowtype;
  v_profile jsonb;
  v_order_revision integer;
  v_panel_revision integer;
  v_link_id text;
  v_new_revision integer;
  v_status text;
  v_links jsonb;
  v_seen text[] := '{}';
  v_id text;
  v_sort integer;
  v_required boolean;
  v_group text;
  v_expected_link_revision integer;
  v_expected_item_revision integer;
  v_profile_kind text;
  v_source_test uuid;
  v_source_test_revision integer;
  v_source_ordinal integer;
  v_owner_order uuid;
  v_owner_panel uuid;
  v_catalog_changed boolean := false;
  v_removed_count integer := 0;
  v_membership_snapshot jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
     or not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage') then
    raise exception 'permission_missing' using errcode='42501';
  end if;
  if p_expected_catalog_revision is null or p_expected_catalog_revision <= 0 then raise exception 'catalog_revision_required' using errcode='22023'; end if;
  if jsonb_typeof(p_patch) <> 'object' or not (p_patch ? 'labDefinition') or (select count(*) from jsonb_object_keys(p_patch)) <> 1 then raise exception 'catalog_patch_field_rejected:labDefinition' using errcode='22023'; end if;
  if jsonb_typeof(p_patch->'labDefinition') <> 'object' then raise exception 'lab_definition_object_required' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(p_patch->'labDefinition') key where key not in ('availabilityStatus','links')) then raise exception 'lab_definition_field_rejected' using errcode='22023'; end if;
  v_status := p_patch->'labDefinition'->>'availabilityStatus';
  if v_status not in ('active','paused','inactive') or jsonb_typeof(p_patch->'labDefinition'->'links') <> 'array' then raise exception 'lab_definition_invalid' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:' || p_workspace_id,0));
  select * into v_item from public.order_catalog_items where workspace_id=p_workspace_id and id=p_item_id for update;
  if not found then raise exception 'order_catalog_item_not_found' using errcode='P0002'; end if;
  if v_item.category_group <> 'lab' then raise exception 'lab_definition_requires_lab_catalog' using errcode='22023'; end if;
  if v_item.catalog_revision <> p_expected_catalog_revision then raise exception 'catalog_revision_conflict' using errcode='40001'; end if;
  select * into v_catalog from public.order_catalog_items where workspace_id=p_workspace_id and id=p_item_id for update;

  v_links := p_patch->'labDefinition'->'links';
  if exists(select 1 from jsonb_array_elements(v_links) items(value) group by value->>'labTestItemId' having count(*)>1) then raise exception 'lab_definition_duplicate_item' using errcode='22023'; end if;
  if v_status = 'active' and jsonb_array_length(v_links)=0 then raise exception 'lab_definition_active_item_required' using errcode='23514'; end if;
  -- Resolve the catalog's pinned order version and its embedded immutable
  -- profile.  The mutable master projection is deliberately not consulted;
  -- an omitted profile target therefore leaves existing local link pins alone.
  select version.snapshot into v_profile
  from master.master_record_versions version
  where version.master_record_id=v_catalog.source_master_record_id
    and version.revision=v_catalog.source_master_revision;
  if not found then raise exception 'lab_catalog_master_profile_missing' using errcode='23503'; end if;
  v_owner_order := v_catalog.source_master_record_id;
  v_order_revision := v_catalog.source_master_revision;
  select nullif(v_profile->'labOrderProfiles'->0->>'labPanelMasterRecordId','')::uuid,
         nullif(v_profile->'labOrderProfiles'->0->>'labPanelMasterRevision','')::integer
    into v_owner_panel,v_panel_revision;
  if v_owner_panel is null then
    select nullif(v_profile->'labOrderProfiles'->0->>'labTestMasterRecordId','')::uuid,
           nullif(v_profile->'labOrderProfiles'->0->>'labTestMasterRevision','')::integer
      into v_source_test,v_source_test_revision;
  end if;
  if v_owner_order is null or (v_owner_panel is null and v_source_test is null) then
    raise exception 'lab_catalog_master_profile_missing' using errcode='23503';
  end if;

  for v_link in select value from jsonb_array_elements(v_links) links(value) loop
    v_id := nullif(btrim(v_link->>'labTestItemId'),'');
    if v_id is null or jsonb_typeof(v_link->'effectiveSortOrder') <> 'number' or (v_link->>'effectiveSortOrder')::integer < 0 or jsonb_typeof(v_link->'required') <> 'boolean' then raise exception 'lab_definition_link_invalid' using errcode='22023'; end if;
    select * into v_item_row from public.lab_test_items where workspace_id=p_workspace_id and id=v_id for update;
    if not found or v_item_row.definition_origin = 'quarantined' then raise exception 'lab_test_item_not_found' using errcode='P0002'; end if;
    select * into v_item_version
    from public.lab_test_item_versions
    where workspace_id=p_workspace_id and lab_test_item_id=v_id
      and workspace_result_revision=v_item_row.workspace_result_revision;
    if not found then raise exception 'lab_item_revision_conflict' using errcode='40001'; end if;
    v_sort := (v_link->>'effectiveSortOrder')::integer; v_required := (v_link->>'required')::boolean; v_group := nullif(btrim(v_link->>'displayGroup'),'');
    v_expected_link_revision := nullif(v_link->>'expectedLinkRevision','')::integer;
    v_expected_item_revision := nullif(v_link->>'expectedWorkspaceResultRevision','')::integer;
    if v_expected_link_revision is not null and v_expected_link_revision <= 0 then raise exception 'lab_definition_link_invalid' using errcode='22023'; end if;
    if v_expected_item_revision is not null and (v_expected_item_revision <= 0 or v_expected_item_revision <> v_item_row.workspace_result_revision) then raise exception 'lab_item_revision_conflict' using errcode='40001'; end if;
    if v_owner_panel is null and jsonb_array_length(v_links) <> 1 then raise exception 'lab_standalone_exactly_one_link' using errcode='22023'; end if;
    if v_owner_panel is null and v_item_row.definition_origin <> 'clair_master' then raise exception 'lab_standalone_master_member_required' using errcode='22023'; end if;
    v_profile_kind := case when v_owner_panel is null then 'standalone_test' else 'panel' end;
    v_source_test := case when v_item_row.definition_origin='clair_master' then v_item_row.source_master_record_id else null end;
    v_source_test_revision := case when v_item_row.definition_origin='clair_master' then v_item_row.source_master_revision else null end;
    v_source_ordinal := case when v_profile_kind='panel' and v_source_test is not null then (select sort_order from master.lab_panel_items where lab_panel_id=v_owner_panel and lab_test_id=v_source_test) else null end;
    if v_source_test is not null and v_owner_panel is not null and v_source_ordinal is null then raise exception 'lab_item_profile_membership_invalid' using errcode='22023'; end if;
    if v_source_test is null and v_profile_kind='standalone_test' then raise exception 'lab_standalone_source_required' using errcode='22023'; end if;
    v_link_id := 'lab-link:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':' || p_item_id || ':' || v_id,'UTF8'),'sha256'),'hex'));
    select * into v_existing from public.order_catalog_lab_test_item_links where workspace_id=p_workspace_id and id=v_link_id for update;
    -- A workspace-custom member has no fabricated master source.  If the
    -- caller did not provide a replacement source identity, retain the
    -- already stored immutable pin instead of silently nulling it.
    if v_source_test is null and found and v_existing.source_master_test_record_id is not null then
      v_source_test := v_existing.source_master_test_record_id;
      v_source_test_revision := v_existing.owner_pinned_source_test_revision;
      v_source_ordinal := v_existing.source_ordinal;
    end if;
    if v_expected_link_revision is null and found then raise exception 'lab_link_revision_conflict' using errcode='40001'; end if;
    if v_expected_link_revision is not null and (not found or v_existing.link_revision <> v_expected_link_revision) then raise exception 'lab_link_revision_conflict' using errcode='40001'; end if;
    if not found and v_expected_item_revision is not null then raise exception 'lab_item_revision_conflict' using errcode='40001'; end if;
    if found and v_expected_item_revision is null then raise exception 'lab_item_revision_conflict' using errcode='40001'; end if;
    if not found or v_existing.effective_sort_order is distinct from v_sort or v_existing.required is distinct from v_required or v_existing.display_group is distinct from v_group then
      v_catalog_changed := true;
    end if;
    v_new_revision := case when found and v_existing.effective_sort_order=v_sort and v_existing.required=v_required and v_existing.display_group is not distinct from v_group then v_existing.link_revision else coalesce(v_existing.link_revision,0)+1 end;
    if v_source_test is not null then v_profile_kind := v_profile_kind; end if;
    insert into public.order_catalog_lab_test_item_links(id,workspace_id,order_catalog_item_id,lab_test_item_id,sort_order,link_revision,link_origin,profile_kind,source_master_order_record_id,source_master_order_revision,source_master_panel_record_id,source_master_panel_revision,source_master_test_record_id,owner_pinned_source_test_revision,source_ordinal,effective_sort_order,pinned_workspace_result_revision,required,display_group,snapshot_metadata,snapshot_metadata_schema_version,snapshot_metadata_sha256)
    values(v_link_id,p_workspace_id,p_item_id,v_id,v_sort,v_new_revision,case when v_source_test is null then 'workspace_custom' else 'clair_master' end,v_profile_kind,v_owner_order,v_order_revision,v_owner_panel,v_panel_revision,v_source_test,v_source_test_revision,v_source_ordinal,v_sort,v_item_row.workspace_result_revision,v_required,v_group,
      jsonb_build_object('schemaVersion',2,'linkOrigin',case when v_source_test is null then 'workspace_custom' else 'clair_master' end,'profileKind',v_profile_kind,'workspaceCatalogItemId',p_item_id,'masterOrderRecordId',v_owner_order,'masterOrderRevision',v_order_revision,'masterPanelRecordId',v_owner_panel,'masterPanelRevision',v_panel_revision,'masterTestRecordId',v_source_test,'ownerPinnedSourceTestRevision',v_source_test_revision,'itemVersionSourceMasterRecordId',v_item_version.source_master_record_id,'itemVersionSourceTestRevision',v_item_version.source_master_revision,'labTestItemId',v_id,'pinnedWorkspaceResultRevision',v_item_row.workspace_result_revision,'sourceOrdinal',v_source_ordinal,'effectiveSortOrder',v_sort,'required',v_required,'displayGroup',v_group),2,
      private.clinical_master_sha256(jsonb_build_object('schemaVersion',2,'linkOrigin',case when v_source_test is null then 'workspace_custom' else 'clair_master' end,'profileKind',v_profile_kind,'workspaceCatalogItemId',p_item_id,'masterOrderRecordId',v_owner_order,'masterOrderRevision',v_order_revision,'masterPanelRecordId',v_owner_panel,'masterPanelRevision',v_panel_revision,'masterTestRecordId',v_source_test,'ownerPinnedSourceTestRevision',v_source_test_revision,'itemVersionSourceMasterRecordId',v_item_version.source_master_record_id,'itemVersionSourceTestRevision',v_item_version.source_master_revision,'labTestItemId',v_id,'pinnedWorkspaceResultRevision',v_item_row.workspace_result_revision,'sourceOrdinal',v_source_ordinal,'effectiveSortOrder',v_sort,'required',v_required,'displayGroup',v_group)))
    on conflict (workspace_id,id) do update set sort_order=excluded.sort_order,link_revision=excluded.link_revision,link_origin=excluded.link_origin,profile_kind=excluded.profile_kind,source_master_order_record_id=excluded.source_master_order_record_id,source_master_order_revision=excluded.source_master_order_revision,source_master_panel_record_id=excluded.source_master_panel_record_id,source_master_panel_revision=excluded.source_master_panel_revision,source_master_test_record_id=excluded.source_master_test_record_id,owner_pinned_source_test_revision=excluded.owner_pinned_source_test_revision,source_ordinal=excluded.source_ordinal,effective_sort_order=excluded.effective_sort_order,pinned_workspace_result_revision=excluded.pinned_workspace_result_revision,required=excluded.required,display_group=excluded.display_group,snapshot_metadata=excluded.snapshot_metadata,snapshot_metadata_schema_version=excluded.snapshot_metadata_schema_version,snapshot_metadata_sha256=excluded.snapshot_metadata_sha256;
    v_seen := array_append(v_seen,v_link_id);
  end loop;
  select count(*) into v_removed_count
  from public.order_catalog_lab_test_item_links link
  where link.workspace_id=p_workspace_id and link.order_catalog_item_id=p_item_id
    and link.link_origin in ('clair_master','workspace_custom') and not (link.id=any(v_seen));
  if v_removed_count > 0 then v_catalog_changed := true; end if;
  if v_item.availability_status is distinct from v_status then v_catalog_changed := true; end if;
  delete from public.order_catalog_lab_test_item_links where workspace_id=p_workspace_id and order_catalog_item_id=p_item_id and link_origin in ('clair_master','workspace_custom') and not (id=any(v_seen));
  if v_status = 'active' and not exists(
    select 1 from public.order_catalog_lab_test_item_links link
    join public.lab_test_items item on item.workspace_id=link.workspace_id and item.id=link.lab_test_item_id
    where link.workspace_id=p_workspace_id and link.order_catalog_item_id=p_item_id
      and link.link_origin in ('clair_master','workspace_custom') and item.availability_status='active'
  ) then raise exception 'lab_definition_active_item_required' using errcode='23514'; end if;
  if v_catalog_changed then
    update public.order_catalog_items set availability_status=v_status,catalog_revision=catalog_revision+1,updated_at=now() where workspace_id=p_workspace_id and id=p_item_id;
  end if;
  select jsonb_build_object(
    'schemaVersion',1,
    'sourceMasterOrderRecordId',v_owner_order,
    'sourceMasterOrderRevision',v_order_revision,
    'targetType',case when v_owner_panel is not null then 'panel' else 'test' end,
    'sourceMasterPanelRecordId',v_owner_panel,
    'sourceMasterPanelRevision',v_panel_revision,
    'members',coalesce(jsonb_agg(jsonb_build_object(
      'linkOrigin',link.link_origin,
      'profileKind',link.profile_kind,
      'sourceMasterTestRecordId',link.source_master_test_record_id,
      'ownerPinnedSourceTestRevision',link.owner_pinned_source_test_revision,
      'itemVersionSourceMasterRecordId',version_row.source_master_record_id,
      'itemVersionSourceTestRevision',version_row.source_master_revision,
      'labTestItemId',link.lab_test_item_id,
      'pinnedWorkspaceResultRevision',link.pinned_workspace_result_revision,
      'sourceOrdinal',link.source_ordinal,
      'effectiveSortOrder',link.effective_sort_order,
      'required',link.required,
      'displayGroup',link.display_group
    ) order by link.effective_sort_order,link.id) filter (where link.id is not null),'[]'::jsonb)
  )
    into v_membership_snapshot
  from public.order_catalog_lab_test_item_links link
  join public.lab_test_item_versions version_row
    on version_row.workspace_id=link.workspace_id
   and version_row.lab_test_item_id=link.lab_test_item_id
   and version_row.workspace_result_revision=link.pinned_workspace_result_revision
  where link.workspace_id=p_workspace_id
    and link.order_catalog_item_id=p_item_id
    and link.link_origin in ('clair_master','workspace_custom');
  update public.order_catalog_items
  set last_applied_lab_membership_projection_snapshot=v_membership_snapshot,
      last_applied_lab_membership_projection_sha256=private.clinical_master_lab_membership_source_fingerprint(v_membership_snapshot),
      last_applied_lab_membership_projection_schema_version=1,
      updated_at=updated_at
  where workspace_id=p_workspace_id and id=p_item_id;
  select * into v_item from public.order_catalog_items where workspace_id=p_workspace_id and id=p_item_id;
  return jsonb_build_object('ok',true,'status',200,'item',to_jsonb(v_item),'links',coalesce((select jsonb_agg(to_jsonb(link) order by effective_sort_order,id) from public.order_catalog_lab_test_item_links link where link.workspace_id=p_workspace_id and link.order_catalog_item_id=p_item_id and link.link_origin in ('clair_master','workspace_custom')),'[]'::jsonb),'enforcedBy','clair_update_order_catalog_item_lab_definition');
end
$$;
revoke all on function private.clair_apply_order_catalog_lab_definition_patch(text,text,integer,jsonb) from public,anon,authenticated,service_role;

do $$
begin
  if to_regprocedure('public.clair_update_order_catalog_item(text,text,integer,jsonb)') is not null
     and to_regprocedure('public.clair_update_order_catalog_item_a2_base(text,text,integer,jsonb)') is null then
    alter function public.clair_update_order_catalog_item(text,text,integer,jsonb)
      rename to clair_update_order_catalog_item_a2_base;
  end if;
end
$$;

create or replace function public.clair_update_order_catalog_item(
  p_workspace_id text,
  p_item_id text,
  p_expected_catalog_revision integer,
  p_patch jsonb
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
begin
  if p_patch ? 'labDefinition' then
    return private.clair_apply_order_catalog_lab_definition_patch(p_workspace_id,p_item_id,p_expected_catalog_revision,p_patch);
  end if;
  return public.clair_update_order_catalog_item_a2_base(p_workspace_id,p_item_id,p_expected_catalog_revision,p_patch);
end
$$;
revoke all on function public.clair_update_order_catalog_item(text,text,integer,jsonb) from public,anon,service_role;
grant execute on function public.clair_update_order_catalog_item(text,text,integer,jsonb) to authenticated;

create or replace function public.clair_update_workspace_lab_test_item(
  p_workspace_id text,
  p_item_id text,
  p_actor_user_id uuid,
  p_expected_workspace_result_revision integer,
  p_expected_local_settings_revision integer,
  p_action text,
  p_patch jsonb,
  p_target_link_ids text[]
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_item public.lab_test_items%rowtype;
  v_next_revision integer;
  v_input_type text;
  v_value_kind text;
  v_unit text;
  v_scale integer;
  v_name text;
  v_link record;
  v_metadata jsonb;
  v_catalog_id text;
  v_changed_catalogs text[] := '{}';
  v_target_catalogs text[] := '{}';
  v_previous_active boolean;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then raise exception 'actor_mismatch' using errcode='42501'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) or not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage') then raise exception 'permission_missing' using errcode='42501'; end if;
  if p_action not in ('local_settings','customize') or jsonb_typeof(p_patch) <> 'object' then raise exception 'lab_item_patch_invalid' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:' || p_workspace_id,0));
  select coalesce(array_agg(distinct link.order_catalog_item_id order by link.order_catalog_item_id),'{}'::text[])
    into v_target_catalogs
  from public.order_catalog_lab_test_item_links link
  where link.workspace_id=p_workspace_id and link.lab_test_item_id=p_item_id
    and link.link_origin in ('clair_master','workspace_custom');
  foreach v_catalog_id in array v_target_catalogs loop
    perform 1 from public.order_catalog_items where workspace_id=p_workspace_id and id=v_catalog_id for update;
  end loop;
  select * into v_item from public.lab_test_items where workspace_id=p_workspace_id and id=p_item_id for update;
  if not found then raise exception 'lab_test_item_not_found' using errcode='P0002'; end if;
  if v_item.definition_origin='quarantined' then raise exception 'lab_item_quarantined' using errcode='42501'; end if;
  if p_action='local_settings' then
    if p_expected_local_settings_revision is null or p_expected_workspace_result_revision is not null or coalesce(array_length(p_target_link_ids,1),0) <> 0 then raise exception 'lab_item_revision_conflict' using errcode='40001'; end if;
    if p_expected_local_settings_revision <> v_item.local_settings_revision then raise exception 'lab_item_local_settings_revision_conflict' using errcode='40001'; end if;
    if (select count(*) from jsonb_object_keys(p_patch)) <> 3 or exists(select 1 from jsonb_object_keys(p_patch) key where key not in ('categoryId','localSortOrder','isActive')) then raise exception 'lab_item_local_settings_patch_invalid' using errcode='22023'; end if;
    if jsonb_typeof(p_patch->'categoryId') <> 'string' or length(btrim(p_patch->>'categoryId'))=0 or jsonb_typeof(p_patch->'localSortOrder') <> 'number' or (p_patch->>'localSortOrder')::integer < 0 or jsonb_typeof(p_patch->'isActive') <> 'boolean' then raise exception 'lab_item_local_settings_patch_invalid' using errcode='22023'; end if;
    if not exists(select 1 from public.lab_test_categories where workspace_id=p_workspace_id and id=p_patch->>'categoryId') then raise exception 'lab_category_not_found' using errcode='P0002'; end if;
    v_previous_active := v_item.availability_status='active';
    update public.lab_test_items set category_id=p_patch->>'categoryId',sort_order=(p_patch->>'localSortOrder')::integer,availability_status=case when (p_patch->>'isActive')::boolean then 'active' else 'inactive' end,local_settings_revision=local_settings_revision+1,updated_at=now() where workspace_id=p_workspace_id and id=p_item_id;
    if v_previous_active is distinct from ((p_patch->>'isActive')::boolean) then
      foreach v_catalog_id in array v_target_catalogs loop
        update public.order_catalog_items set catalog_revision=catalog_revision+1,updated_at=now() where workspace_id=p_workspace_id and id=v_catalog_id;
      end loop;
      v_changed_catalogs := v_target_catalogs;
    end if;
  else
    if p_expected_workspace_result_revision is null or p_expected_local_settings_revision is not null then raise exception 'lab_item_revision_conflict' using errcode='40001'; end if;
    if p_target_link_ids is not null and cardinality(p_target_link_ids) <> (select count(distinct value) from unnest(p_target_link_ids) values(value)) then raise exception 'lab_item_target_link_duplicate' using errcode='22023'; end if;
    if p_target_link_ids is not null and exists(select 1 from unnest(p_target_link_ids) values(value) where not exists(select 1 from public.order_catalog_lab_test_item_links link where link.workspace_id=p_workspace_id and link.id=value and link.lab_test_item_id=p_item_id and link.link_origin in ('clair_master','workspace_custom'))) then raise exception 'lab_item_target_link_invalid' using errcode='22023'; end if;
    if p_expected_workspace_result_revision <> v_item.workspace_result_revision then raise exception 'lab_item_revision_conflict' using errcode='40001'; end if;
    if (select count(*) from jsonb_object_keys(p_patch)) <> 5 or exists(select 1 from jsonb_object_keys(p_patch) key where key not in ('displayName','inputType','resultValueKind','unit','decimalScale')) then raise exception 'lab_item_customize_patch_invalid' using errcode='22023'; end if;
    v_name := nullif(btrim(p_patch->>'displayName'),''); v_input_type := p_patch->>'inputType'; v_value_kind := p_patch->>'resultValueKind'; v_unit := nullif(btrim(p_patch->>'unit'),''); v_scale := nullif(p_patch->>'decimalScale','')::integer;
    if v_name is null or length(v_name)>256 or v_input_type not in ('number','text','select','positive_negative','grade') or v_value_kind not in ('numeric','text','coded') or (v_value_kind='numeric' and v_input_type <> 'number') or (v_value_kind='text' and v_input_type <> 'text') or (v_value_kind='coded' and v_input_type <> 'text') or (v_scale is not null and v_scale < 0) or (v_unit is not null and length(v_unit)>128) then raise exception 'lab_item_customize_patch_invalid' using errcode='22023'; end if;
    v_next_revision := v_item.workspace_result_revision + 1;
    update public.lab_test_items set test_item_name=v_name,result_input_type=v_input_type,result_value_kind=v_value_kind,result_unit=v_unit,decimal_scale=v_scale,workspace_result_revision=v_next_revision,customization_state=case when definition_origin='clair_master' then 'customized' else customization_state end,local_definition_snapshot=jsonb_build_object('schemaVersion',1,'testItemName',v_name,'resultInputType',v_input_type,'resultValueKind',v_value_kind,'resultUnit',v_unit,'decimalScale',v_scale),local_definition_sha256=private.clinical_master_sha256(jsonb_build_object('schemaVersion',1,'testItemName',v_name,'resultInputType',v_input_type,'resultValueKind',v_value_kind,'resultUnit',v_unit,'decimalScale',v_scale)),updated_at=now() where workspace_id=p_workspace_id and id=p_item_id;
    select * into v_item from public.lab_test_items where workspace_id=p_workspace_id and id=p_item_id;
    insert into public.lab_test_item_versions(workspace_id,lab_test_item_id,workspace_result_revision,test_item_name,result_input_type,result_value_kind,result_unit,decimal_scale,definition_origin,customization_state,source_master_record_id,source_master_revision,source_projection_schema_version,source_projection_snapshot,source_projection_sha256,local_definition_snapshot,local_definition_sha256,created_by)
    select workspace_id,id,workspace_result_revision,test_item_name,result_input_type,result_value_kind,result_unit,decimal_scale,definition_origin,case when customization_state='customized' then 'customized' else 'unmodified' end,source_master_record_id,source_master_revision,coalesce(source_projection_schema_version,1),source_projection_snapshot,source_projection_sha256,local_definition_snapshot,local_definition_sha256,p_actor_user_id from public.lab_test_items where workspace_id=p_workspace_id and id=p_item_id;
    for v_link in select link.* from public.order_catalog_lab_test_item_links link where link.workspace_id=p_workspace_id and link.lab_test_item_id=p_item_id and link.link_origin in ('clair_master','workspace_custom') order by link.id for update loop
      -- An explicit empty target set creates the immutable item version but
      -- intentionally repins zero links.  Only IDs named by the caller are
      -- eligible for a pin refresh; omitted targets never mean "all".
      if p_target_link_ids is not null and cardinality(p_target_link_ids) > 0 and v_link.id=any(p_target_link_ids) then
        v_metadata := jsonb_build_object(
          'schemaVersion',2,
          'linkOrigin',v_link.link_origin,
          'profileKind',v_link.profile_kind,
          'workspaceCatalogItemId',v_link.order_catalog_item_id,
          'masterOrderRecordId',v_link.source_master_order_record_id,
          'masterOrderRevision',v_link.source_master_order_revision,
          'masterPanelRecordId',v_link.source_master_panel_record_id,
          'masterPanelRevision',v_link.source_master_panel_revision,
          'masterTestRecordId',v_link.source_master_test_record_id,
          'ownerPinnedSourceTestRevision',v_link.owner_pinned_source_test_revision,
          'itemVersionSourceMasterRecordId',v_item.source_master_record_id,
          'itemVersionSourceTestRevision',v_item.source_master_revision,
          'labTestItemId',v_item.id,
          'pinnedWorkspaceResultRevision',v_next_revision,
          'required',coalesce(v_link.required,true),
          'displayGroup',v_link.display_group,
          'sourceOrdinal',v_link.source_ordinal,
          'effectiveSortOrder',v_link.effective_sort_order
        );
        update public.order_catalog_lab_test_item_links
        set pinned_workspace_result_revision=v_next_revision,
            link_revision=link_revision+1,
            snapshot_metadata=v_metadata,
            snapshot_metadata_schema_version=2,
            snapshot_metadata_sha256=private.clinical_master_sha256(v_metadata)
        where workspace_id=p_workspace_id and id=v_link.id;
        if not (v_link.order_catalog_item_id=any(v_changed_catalogs)) then v_changed_catalogs := array_append(v_changed_catalogs,v_link.order_catalog_item_id); end if;
      end if;
    end loop;
    foreach v_catalog_id in array v_changed_catalogs loop update public.order_catalog_items set catalog_revision=catalog_revision+1,updated_at=now() where workspace_id=p_workspace_id and id=v_catalog_id; end loop;
  end if;
  select * into v_item from public.lab_test_items where workspace_id=p_workspace_id and id=p_item_id;
  return jsonb_build_object('ok',true,'status',200,'item',to_jsonb(v_item),'affectedCatalogItemIds',to_jsonb(v_changed_catalogs),'enforcedBy','clair_update_workspace_lab_test_item');
end
$$;
revoke all on function public.clair_update_workspace_lab_test_item(text,text,uuid,integer,integer,text,jsonb,text[]) from public,anon,service_role;
grant execute on function public.clair_update_workspace_lab_test_item(text,text,uuid,integer,integer,text,jsonb,text[]) to authenticated;

-- One authenticated resolver owns both durable B1 review target kinds.  It
-- consumes only the server-stored source projection; source IDs, revisions,
-- snapshots, hashes, and replacement definitions never come from the caller.
create or replace function private.clair_resolve_workspace_lab_definition_update_target(
  p_workspace_id text,
  p_update_id uuid,
  p_actor_user_id uuid,
  p_expected_revision integer,
  p_decision text
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_item_update public.workspace_lab_item_updates%rowtype;
  v_catalog_update public.workspace_lab_catalog_updates%rowtype;
  v_item public.lab_test_items%rowtype;
  v_catalog public.order_catalog_items%rowtype;
  v_link public.order_catalog_lab_test_item_links%rowtype;
  v_existing public.order_catalog_lab_test_item_links%rowtype;
  v_version public.lab_test_item_versions%rowtype;
  v_member jsonb;
  v_member_ids text[] := '{}';
  v_item_ids text[] := '{}';
  v_catalog_ids text[] := '{}';
  v_changed_catalog_ids text[] := '{}';
  v_kind text;
  v_catalog_id text;
  v_item_id text;
  v_link_id text;
  v_source_test uuid;
  v_source_test_revision integer;
  v_source_ordinal integer;
  v_effective_sort integer;
  v_required boolean;
  v_group text;
  v_profile_kind text;
  v_link_origin text;
  v_new_item_revision integer;
  v_member_revision integer;
  v_catalog_revision_delta integer := 0;
  v_metadata jsonb;
  v_source_snapshot jsonb;
  v_applied_snapshot jsonb;
  v_applied_members jsonb;
  v_owner_version jsonb;
  v_source_hash text;
  v_changed boolean;
  v_overlap_item_target boolean;
  v_catalog_target_is_independent boolean;
  v_new_order_revision integer;
  v_new_panel_revision integer;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_actor_user_id is distinct from auth.uid() then raise exception 'actor_mismatch' using errcode='42501'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
     or not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage') then
    raise exception 'permission_missing' using errcode='42501';
  end if;
  if p_update_id is null or p_expected_revision is null or p_expected_revision <= 0 then
    raise exception 'lab_update_revision_required' using errcode='22023';
  end if;
  if p_decision not in ('accept','reject') then raise exception 'lab_update_decision_invalid' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:' || p_workspace_id,0));
  select * into v_item_update from public.workspace_lab_item_updates
  where workspace_id=p_workspace_id and id=p_update_id;
  if found then
    v_kind := 'item';
    v_item_ids := array[v_item_update.lab_test_item_id];
    v_catalog_ids := coalesce(v_item_update.affected_catalog_item_ids,'{}'::text[]);
  else
    select * into v_catalog_update from public.workspace_lab_catalog_updates
    where workspace_id=p_workspace_id and id=p_update_id;
    if not found then raise exception 'lab_update_target_not_found' using errcode='P0002'; end if;
    v_kind := 'catalog';
    v_catalog_ids := array[v_catalog_update.order_catalog_item_id];
    v_source_snapshot := v_catalog_update.source_membership_projection_snapshot;
    select coalesce(array_agg(distinct value->>'labTestItemId' order by value->>'labTestItemId'),'{}'::text[])
      into v_item_ids
    from jsonb_array_elements(coalesce(v_source_snapshot->'members','[]'::jsonb)) members(value)
    where nullif(value->>'labTestItemId','') is not null;
    select coalesce(array_agg(distinct item_id order by item_id),'{}'::text[])
      into v_item_ids
    from (
      select value->>'labTestItemId' as item_id
      from jsonb_array_elements(coalesce(v_source_snapshot->'members','[]'::jsonb)) members(value)
      where nullif(value->>'labTestItemId','') is not null
      union
      select link.lab_test_item_id
      from public.order_catalog_lab_test_item_links link
      where link.workspace_id=p_workspace_id and link.order_catalog_item_id=v_catalog_update.order_catalog_item_id
        and link.link_origin in ('clair_master','workspace_custom')
    ) item_ids;
  end if;

  -- Shared lock order: catalog rows, item rows, then authored links and the
  -- durable target.  Every B1 writer uses the same workspace advisory key.
  foreach v_catalog_id in array v_catalog_ids loop
    perform 1 from public.order_catalog_items where workspace_id=p_workspace_id and id=v_catalog_id for update;
    if not found then raise exception 'order_catalog_item_not_found' using errcode='P0002'; end if;
  end loop;
  foreach v_item_id in array v_item_ids loop
    perform 1 from public.lab_test_items where workspace_id=p_workspace_id and id=v_item_id for update;
    if not found then raise exception 'lab_test_item_not_found' using errcode='P0002'; end if;
  end loop;
  for v_link in
    select link.* from public.order_catalog_lab_test_item_links link
    where link.workspace_id=p_workspace_id
      and cardinality(v_catalog_ids)>0
      and link.order_catalog_item_id=any(v_catalog_ids)
    order by link.workspace_id,link.id
    for update
  loop
    null;
  end loop;
  if v_kind='item' then
    select * into v_item_update from public.workspace_lab_item_updates
    where workspace_id=p_workspace_id and id=p_update_id for update;
    select * into v_item from public.lab_test_items
    where workspace_id=p_workspace_id and id=v_item_update.lab_test_item_id for update;
    if p_expected_revision <> v_item_update.expected_workspace_result_revision
       or v_item.workspace_result_revision <> p_expected_revision then
      raise exception 'lab_item_revision_conflict' using errcode='40001';
    end if;
  else
    select * into v_catalog_update from public.workspace_lab_catalog_updates
    where workspace_id=p_workspace_id and id=p_update_id for update;
    select * into v_catalog from public.order_catalog_items
    where workspace_id=p_workspace_id and id=v_catalog_update.order_catalog_item_id for update;
    -- An item target may be accepted first for the same source release.  That
    -- target owns only the immutable item/link cascade, so the catalog target
    -- remains valid at the intervening revision and still applies its own
    -- membership/profile delta.  Count only accepted item targets that
    -- explicitly targeted this catalog; unrelated item accepts cannot weaken
    -- the catalog CAS.
    select count(*)
      into v_catalog_revision_delta
    from public.workspace_lab_item_updates item_update
    where item_update.workspace_id=p_workspace_id
      and item_update.status='accepted'
      and item_update.source_release_id=v_catalog_update.source_release_id
      and v_catalog_update.order_catalog_item_id=any(item_update.affected_catalog_item_ids)
      and item_update.lab_test_item_id=any(v_catalog_update.affected_lab_test_item_ids)
      and exists (
        select 1
        from public.order_catalog_lab_test_item_links accepted_link
        where accepted_link.workspace_id=p_workspace_id
          and accepted_link.order_catalog_item_id=v_catalog_update.order_catalog_item_id
          and accepted_link.lab_test_item_id=item_update.lab_test_item_id
          and accepted_link.pinned_workspace_result_revision=item_update.expected_workspace_result_revision+1
          and accepted_link.owner_pinned_source_test_revision=item_update.source_master_revision
      );
    if p_expected_revision <> v_catalog_update.expected_catalog_revision + v_catalog_revision_delta
       or v_catalog.catalog_revision <> p_expected_revision then
      raise exception 'catalog_revision_conflict' using errcode='40001';
    end if;
  end if;

  if v_kind='item' then
    if v_item_update.status <> 'pending' or v_item_update.superseded_by_update_id is not null then
      raise exception 'lab_update_target_obsolete' using errcode='40001';
    end if;
    if p_decision='reject' then
      update public.workspace_lab_item_updates
      set status='dismissed',resolved_by=p_actor_user_id,resolved_at=now()
      where workspace_id=p_workspace_id and id=p_update_id;
      return jsonb_build_object('ok',true,'status',200,'decision','reject','updateId',p_update_id,'targetKind','item','enforcedBy','clair-resolve-workspace-lab-definition-update');
    end if;
    if exists (
      select 1
      from public.workspace_lab_item_updates newer
      where newer.workspace_id=p_workspace_id
        and newer.lab_test_item_id=v_item_update.lab_test_item_id
        and newer.status='pending'
        and newer.id<>v_item_update.id
        and (newer.source_release_no,newer.source_owner_revision,newer.source_release_id::text)
          > (v_item_update.source_release_no,v_item_update.source_owner_revision,v_item_update.source_release_id::text)
    ) or exists (
      select 1
      from master.master_record_versions newer_version
      join master.master_releases newer_release on newer_release.id=newer_version.release_id
      where newer_version.master_record_id=v_item_update.source_owner_record_id
        and (newer_release.release_no,newer_version.revision,newer_release.id::text)
          > (v_item_update.source_release_no,v_item_update.source_owner_revision,v_item_update.source_release_id::text)
    ) then
      raise exception 'lab_update_target_obsolete' using errcode='40001';
    end if;
    select version.snapshot into v_owner_version
    from master.master_record_versions version
    where version.master_record_id=v_item_update.source_owner_record_id
      and version.revision=v_item_update.source_owner_revision;
    if not found then
      raise exception 'lab_update_target_obsolete' using errcode='40001';
    end if;
    v_source_snapshot := v_item_update.source_projection_snapshot;
    v_source_hash := private.clinical_master_sha256(v_source_snapshot);
    if v_source_hash <> v_item_update.source_projection_sha256
       or v_source_snapshot->>'sourceMasterRecordId' <> v_item_update.source_master_record_id::text
       or (v_source_snapshot->>'sourceMasterRevision')::integer <> v_item_update.source_master_revision then
      raise exception 'lab_update_target_obsolete' using errcode='40001';
    end if;
    if v_item.definition_origin <> 'clair_master'
       or v_item.source_master_record_id is distinct from v_item_update.source_master_record_id then
      raise exception 'lab_update_target_obsolete' using errcode='40001';
    end if;
    v_new_item_revision := v_item.workspace_result_revision + 1;
    v_metadata := jsonb_build_object(
      'schemaVersion',1,
      'testItemName',v_source_snapshot->>'testItemName',
      'resultInputType',v_source_snapshot->>'resultInputType',
      'resultValueKind',v_source_snapshot->>'resultValueKind',
      'resultUnit',v_source_snapshot->'resultUnit',
      'decimalScale',v_source_snapshot->'decimalScale'
    );
    update public.lab_test_items
    set test_item_name=v_source_snapshot->>'testItemName',
        result_input_type=v_source_snapshot->>'resultInputType',
        result_value_kind=v_source_snapshot->>'resultValueKind',
        result_unit=nullif(v_source_snapshot->>'resultUnit',''),
        decimal_scale=nullif(v_source_snapshot->>'decimalScale','')::integer,
        source_master_record_id=v_item_update.source_master_record_id,
        source_master_revision=v_item_update.source_master_revision,
        source_projection_schema_version=1,
        source_projection_snapshot=v_source_snapshot,
        source_projection_sha256=v_item_update.source_projection_sha256,
        customization_state='unmodified',
        workspace_result_revision=v_new_item_revision,
        local_definition_snapshot=v_metadata,
        local_definition_sha256=private.clinical_master_sha256(v_metadata),
        updated_at=now()
    where workspace_id=p_workspace_id and id=v_item.id;
    insert into public.lab_test_item_versions(
      workspace_id,lab_test_item_id,workspace_result_revision,test_item_name,
      result_input_type,result_value_kind,result_unit,decimal_scale,definition_origin,
      customization_state,source_master_record_id,source_master_revision,
      source_projection_schema_version,source_projection_snapshot,source_projection_sha256,
      local_definition_snapshot,local_definition_sha256,created_by
    ) values (
      p_workspace_id,v_item.id,v_new_item_revision,v_source_snapshot->>'testItemName',
      v_source_snapshot->>'resultInputType',v_source_snapshot->>'resultValueKind',
      nullif(v_source_snapshot->>'resultUnit',''),nullif(v_source_snapshot->>'decimalScale','')::integer,
      'clair_master','unmodified',v_item_update.source_master_record_id,v_item_update.source_master_revision,
      1,v_source_snapshot,v_item_update.source_projection_sha256,v_metadata,
      private.clinical_master_sha256(v_metadata),p_actor_user_id
    );
    for v_link in
      select link.* from public.order_catalog_lab_test_item_links link
      where link.workspace_id=p_workspace_id and link.lab_test_item_id=v_item.id
        and cardinality(v_catalog_ids)>0 and link.order_catalog_item_id=any(v_catalog_ids)
        and link.link_origin='clair_master'
        and link.source_master_test_record_id=v_item_update.source_master_record_id
        -- An independent catalog target in the same release may remove this
        -- member. Let that target own the delete and its single catalog
        -- revision; otherwise item-first acceptance would repin the soon-to-
        -- be-removed link and count a revision that catalog-first does not.
        and not exists (
          select 1
          from public.workspace_lab_catalog_updates removing_catalog
          where removing_catalog.workspace_id=p_workspace_id
            and removing_catalog.order_catalog_item_id=link.order_catalog_item_id
            and removing_catalog.source_release_id=v_item_update.source_release_id
            and removing_catalog.status='pending'
            and removing_catalog.update_type in ('membership_changed','profile_changed')
            and not exists (
              select 1
              from jsonb_array_elements(
                coalesce(removing_catalog.source_membership_projection_snapshot->'members','[]'::jsonb)
              ) removing_member(value)
              where removing_member.value->>'labTestItemId'=link.lab_test_item_id
            )
        )
        and (
          (
            link.owner_pinned_source_test_revision=v_item.source_master_revision
            and (
              link.profile_kind='panel'
            and link.source_master_order_revision = (
              select max(old_order.revision)
              from master.master_record_versions old_order
              join master.master_releases old_release on old_release.id=old_order.release_id
              where old_order.master_record_id=link.source_master_order_record_id
                and old_release.release_no < (select release.release_no from master.master_releases release where release.id=v_item_update.source_release_id)
            )
            and link.source_master_panel_revision = (
              select max(old_panel.revision)
              from master.master_record_versions old_panel
              join master.master_releases old_release on old_release.id=old_panel.release_id
              where old_panel.master_record_id=link.source_master_panel_record_id
                and old_release.release_no < (select release.release_no from master.master_releases release where release.id=v_item_update.source_release_id)
            )
            and exists (
              select 1
              from master.master_record_versions old_panel
              where old_panel.master_record_id=link.source_master_panel_record_id
                and old_panel.revision=link.source_master_panel_revision
                and exists (
                  select 1
                  from jsonb_array_elements(coalesce(old_panel.snapshot->'labPanelItems','[]'::jsonb)) old_member(value)
                  where nullif(old_member.value->>'testMasterRecordId','')::uuid=link.source_master_test_record_id
                    and nullif(old_member.value->>'testMasterRevision','')::integer=v_item.source_master_revision
                    and nullif(old_member.value->>'sortOrder','')::integer=link.source_ordinal
                )
            )
            and exists (
              select 1
              from master.master_record_versions new_order
              join lateral jsonb_array_elements(coalesce(new_order.snapshot->'labOrderProfiles','[]'::jsonb)) new_profile(value) on true
              join master.master_record_versions new_panel
                on new_panel.release_id=v_item_update.source_release_id
               and new_panel.master_record_id=link.source_master_panel_record_id
              where new_order.release_id=v_item_update.source_release_id
                and new_order.master_record_id=link.source_master_order_record_id
                and new_profile.value->>'labPanelMasterRecordId'=link.source_master_panel_record_id::text
                and nullif(new_profile.value->>'labPanelMasterRevision','')::integer=new_panel.revision
                and exists (
                  select 1
                  from jsonb_array_elements(coalesce(new_panel.snapshot->'labPanelItems','[]'::jsonb)) new_member(value)
                  where nullif(new_member.value->>'testMasterRecordId','')::uuid=link.source_master_test_record_id
                    and nullif(new_member.value->>'testMasterRevision','')::integer=v_item_update.source_master_revision
                    and nullif(new_member.value->>'sortOrder','')::integer=link.source_ordinal
                )
            )
          )
          or (
            link.owner_pinned_source_test_revision=v_item.source_master_revision
            and link.profile_kind='standalone_test'
            and link.source_master_order_revision = (
              select max(old_order.revision)
              from master.master_record_versions old_order
              join master.master_releases old_release on old_release.id=old_order.release_id
              where old_order.master_record_id=link.source_master_order_record_id
                and old_release.release_no < (select release.release_no from master.master_releases release where release.id=v_item_update.source_release_id)
            )
            and exists (
              select 1
              from master.master_record_versions old_order
              join lateral jsonb_array_elements(coalesce(old_order.snapshot->'labOrderProfiles','[]'::jsonb)) old_profile(value) on true
              where old_order.master_record_id=link.source_master_order_record_id
                and old_order.revision=link.source_master_order_revision
                and old_profile.value->>'labTestMasterRecordId'=link.source_master_test_record_id::text
                and nullif(old_profile.value->>'labTestMasterRevision','')::integer=v_item.source_master_revision
            )
            and exists (
              select 1
              from master.master_record_versions new_order
              join lateral jsonb_array_elements(coalesce(new_order.snapshot->'labOrderProfiles','[]'::jsonb)) new_profile(value) on true
              where new_order.release_id=v_item_update.source_release_id
                and new_order.master_record_id=link.source_master_order_record_id
                and new_profile.value->>'labTestMasterRecordId'=link.source_master_test_record_id::text
                and nullif(new_profile.value->>'labTestMasterRevision','')::integer=v_item_update.source_master_revision
            )
              )
          )
          or exists (
            -- A membership/profile target accepted first may have already
            -- advanced the immutable owner pin and order/panel revision.  Its
            -- stored target member is the explicit overlap proof; do not lose
            -- that link merely because the item CAS's old-owner predicate is
            -- no longer true.
            select 1
            from public.workspace_lab_catalog_updates accepted_catalog
            cross join lateral jsonb_array_elements(
              coalesce(accepted_catalog.source_membership_projection_snapshot->'members','[]'::jsonb)
            ) accepted_member(value)
            where accepted_catalog.workspace_id=p_workspace_id
              and accepted_catalog.order_catalog_item_id=link.order_catalog_item_id
              and accepted_catalog.source_release_id=v_item_update.source_release_id
              and accepted_catalog.status='accepted'
              and accepted_member.value->>'labTestItemId'=link.lab_test_item_id
              and accepted_member.value->>'sourceMasterTestRecordId'=v_item_update.source_master_record_id::text
              and nullif(accepted_member.value->>'ownerPinnedSourceTestRevision','')::integer=v_item_update.source_master_revision
          )
        )
      order by link.workspace_id,link.id
    loop
      select max(version.revision)
        into v_new_order_revision
      from master.master_record_versions version
      where version.release_id=v_item_update.source_release_id
        and version.master_record_id=v_link.source_master_order_record_id;
      select max(version.revision)
        into v_new_panel_revision
      from master.master_record_versions version
      where version.release_id=v_item_update.source_release_id
        and version.master_record_id=v_link.source_master_panel_record_id;
      v_metadata := jsonb_build_object(
        'schemaVersion',2,'linkOrigin',v_link.link_origin,'profileKind',v_link.profile_kind,
        'workspaceCatalogItemId',v_link.order_catalog_item_id,
        'masterOrderRecordId',v_link.source_master_order_record_id,
        'masterOrderRevision',v_new_order_revision,
        'masterPanelRecordId',v_link.source_master_panel_record_id,
        'masterPanelRevision',v_new_panel_revision,
        'masterTestRecordId',v_link.source_master_test_record_id,
        'ownerPinnedSourceTestRevision',v_item_update.source_master_revision,
        'itemVersionSourceMasterRecordId',v_item_update.source_master_record_id,
        'itemVersionSourceTestRevision',v_item_update.source_master_revision,
        'labTestItemId',v_link.lab_test_item_id,
        'pinnedWorkspaceResultRevision',v_new_item_revision,
        'sourceOrdinal',v_link.source_ordinal,'effectiveSortOrder',v_link.effective_sort_order,
        'required',v_link.required,'displayGroup',v_link.display_group
      );
      update public.order_catalog_lab_test_item_links
      set pinned_workspace_result_revision=v_new_item_revision,
          source_master_order_revision=v_new_order_revision,
          source_master_panel_revision=v_new_panel_revision,
          owner_pinned_source_test_revision=v_item_update.source_master_revision,
          link_revision=link_revision+1,
          snapshot_metadata=v_metadata,
          snapshot_metadata_schema_version=2,
          snapshot_metadata_sha256=private.clinical_master_sha256(v_metadata)
      where workspace_id=p_workspace_id and id=v_link.id;
      if not (v_link.order_catalog_item_id=any(v_changed_catalog_ids)) then
        v_changed_catalog_ids := array_append(v_changed_catalog_ids,v_link.order_catalog_item_id);
      end if;
    end loop;
    foreach v_catalog_id in array v_changed_catalog_ids loop
      -- Keep the stored membership projection's immutable item pin in sync
      -- when this item CAS follows (or precedes) a catalog target.  The source
      -- fingerprint intentionally ignores this effective pin; the snapshot
      -- itself must nevertheless describe the exact link state.
      select item.last_applied_lab_membership_projection_snapshot
        into v_applied_snapshot
      from public.order_catalog_items item
      where item.workspace_id=p_workspace_id and item.id=v_catalog_id;
      if v_applied_snapshot is not null
         and exists (
           select 1
           from jsonb_array_elements(coalesce(v_applied_snapshot->'members','[]'::jsonb)) members(value)
           where members.value->>'labTestItemId'=v_item.id
         ) then
        select jsonb_agg(
                 case when members.value->>'labTestItemId'=v_item.id
                   then members.value || jsonb_build_object(
                     'itemVersionSourceMasterRecordId',v_item_update.source_master_record_id,
                     'itemVersionSourceTestRevision',v_item_update.source_master_revision,
                     'pinnedWorkspaceResultRevision',v_new_item_revision
                   )
                   else members.value end
                 order by coalesce(nullif(members.value->>'sourceOrdinal','')::integer,2147483647),
                          coalesce(nullif(members.value->>'effectiveSortOrder','')::integer,2147483647),
                          members.value->>'labTestItemId'
               )
          into v_applied_members
        from jsonb_array_elements(coalesce(v_applied_snapshot->'members','[]'::jsonb)) members(value);
        v_applied_snapshot := jsonb_set(v_applied_snapshot,'{members}',coalesce(v_applied_members,'[]'::jsonb),false);
        update public.order_catalog_items
        set last_applied_lab_membership_projection_snapshot=v_applied_snapshot,
            last_applied_lab_membership_projection_sha256=private.clinical_master_lab_membership_source_fingerprint(v_applied_snapshot),
            last_applied_lab_membership_projection_schema_version=1,
            updated_at=now()
        where workspace_id=p_workspace_id and id=v_catalog_id;
      end if;
      update public.order_catalog_items set catalog_revision=catalog_revision+1,updated_at=now()
      where workspace_id=p_workspace_id and id=v_catalog_id;
    end loop;
    update public.workspace_lab_item_updates
    set status='accepted',resolved_by=p_actor_user_id,resolved_at=now()
    where workspace_id=p_workspace_id and id=p_update_id;
    return jsonb_build_object('ok',true,'status',200,'decision','accept','updateId',p_update_id,
      'targetKind','item','labTestItemId',v_item.id,'workspaceResultRevision',v_new_item_revision,
      'affectedCatalogItemIds',to_jsonb(v_changed_catalog_ids),'enforcedBy','clair-resolve-workspace-lab-definition-update');
  end if;

  if v_catalog_update.status <> 'pending' or v_catalog_update.superseded_by_update_id is not null then
    raise exception 'lab_update_target_obsolete' using errcode='40001';
  end if;
  if p_decision='reject' then
    update public.workspace_lab_catalog_updates
    set status='dismissed',resolved_by=p_actor_user_id,resolved_at=now()
    where workspace_id=p_workspace_id and id=p_update_id;
    return jsonb_build_object('ok',true,'status',200,'decision','reject','updateId',p_update_id,'targetKind','catalog','enforcedBy','clair-resolve-workspace-lab-definition-update');
  end if;
  select version.snapshot into v_owner_version
  from master.master_record_versions version
  where version.master_record_id=v_catalog_update.source_owner_record_id
    and version.revision=v_catalog_update.source_owner_revision;
  if not found
     or v_catalog_update.source_membership_projection_snapshot->>'sourceMasterOrderRecordId' is distinct from v_catalog_update.source_owner_record_id::text
     or nullif(v_catalog_update.source_membership_projection_snapshot->>'sourceMasterOrderRevision','')::integer is distinct from v_catalog_update.source_owner_revision then
    raise exception 'lab_update_target_obsolete' using errcode='40001';
  end if;
  v_source_snapshot := v_catalog_update.source_membership_projection_snapshot;
  v_source_hash := private.clinical_master_lab_membership_source_fingerprint(v_source_snapshot);
  if v_source_hash <> v_catalog_update.source_membership_projection_sha256 then
    raise exception 'lab_update_target_obsolete' using errcode='40001';
  end if;
  -- A catalog target can be emitted solely because a member's immutable item
  -- owner revision changed.  That pure cascade belongs to the item target;
  -- only a structural membership/profile difference owns catalog link DML and
  -- a second catalog revision.  Compare the explicit stored projections,
  -- ignoring only effective item-version/source revision fields.
  select v_catalog_update.update_type='profile_changed'
      or v_source_snapshot->>'targetType' is distinct from v_catalog_update.workspace_membership_projection_snapshot->>'targetType'
      or v_source_snapshot->>'sourceMasterPanelRecordId' is distinct from v_catalog_update.workspace_membership_projection_snapshot->>'sourceMasterPanelRecordId'
      or exists (
        select 1
        from (
          select source_member.value as source_value, workspace_member.value as workspace_value
          from jsonb_array_elements(coalesce(v_source_snapshot->'members','[]'::jsonb)) source_member(value)
          full join jsonb_array_elements(coalesce(v_catalog_update.workspace_membership_projection_snapshot->'members','[]'::jsonb)) workspace_member(value)
            on source_member.value->>'labTestItemId'=workspace_member.value->>'labTestItemId'
        ) projection_pair
        where projection_pair.source_value->>'labTestItemId' is distinct from projection_pair.workspace_value->>'labTestItemId'
           or jsonb_build_object(
                'linkOrigin',projection_pair.source_value->>'linkOrigin',
                'profileKind',projection_pair.source_value->>'profileKind',
                'sourceMasterTestRecordId',projection_pair.source_value->>'sourceMasterTestRecordId',
                'labTestItemId',projection_pair.source_value->>'labTestItemId',
                'sourceOrdinal',projection_pair.source_value->>'sourceOrdinal',
                'effectiveSortOrder',projection_pair.source_value->>'effectiveSortOrder',
                'required',projection_pair.source_value->>'required',
                'displayGroup',projection_pair.source_value->>'displayGroup'
              ) is distinct from jsonb_build_object(
                'linkOrigin',projection_pair.workspace_value->>'linkOrigin',
                'profileKind',projection_pair.workspace_value->>'profileKind',
                'sourceMasterTestRecordId',projection_pair.workspace_value->>'sourceMasterTestRecordId',
                'labTestItemId',projection_pair.workspace_value->>'labTestItemId',
                'sourceOrdinal',projection_pair.workspace_value->>'sourceOrdinal',
                'effectiveSortOrder',projection_pair.workspace_value->>'effectiveSortOrder',
                'required',projection_pair.workspace_value->>'required',
                'displayGroup',projection_pair.workspace_value->>'displayGroup'
              )
      )
    into v_catalog_target_is_independent;
  if not v_catalog_target_is_independent then
    -- Pure item-revision cascade: publish the immutable source projection and
    -- current link pins, but leave link/catalog revision ownership to the
    -- item target.  This makes catalog-first and item-first equivalent.
    select coalesce(jsonb_agg(
             members.value || jsonb_build_object(
               'itemVersionSourceMasterRecordId',version.source_master_record_id,
               'itemVersionSourceTestRevision',version.source_master_revision,
               'pinnedWorkspaceResultRevision',link.pinned_workspace_result_revision
             )
             order by coalesce(nullif(members.value->>'sourceOrdinal','')::integer,2147483647),
                      coalesce(nullif(members.value->>'effectiveSortOrder','')::integer,2147483647),
                      members.value->>'labTestItemId'
           ),'[]'::jsonb)
      into v_applied_members
    from jsonb_array_elements(coalesce(v_source_snapshot->'members','[]'::jsonb)) members(value)
    join public.order_catalog_lab_test_item_links link
      on link.workspace_id=p_workspace_id
     and link.order_catalog_item_id=v_catalog_update.order_catalog_item_id
     and link.lab_test_item_id=members.value->>'labTestItemId'
    join public.lab_test_item_versions version
      on version.workspace_id=link.workspace_id
     and version.lab_test_item_id=link.lab_test_item_id
     and version.workspace_result_revision=link.pinned_workspace_result_revision;
    v_applied_snapshot := jsonb_set(v_source_snapshot,'{members}',v_applied_members,false);
    update public.order_catalog_items
    set last_applied_lab_membership_projection_snapshot=v_applied_snapshot,
        last_applied_lab_membership_projection_sha256=private.clinical_master_lab_membership_source_fingerprint(v_applied_snapshot),
        last_applied_lab_membership_projection_schema_version=1,
        updated_at=now()
    where workspace_id=p_workspace_id and id=v_catalog_update.order_catalog_item_id;
    update public.workspace_lab_catalog_updates
    set status='accepted',resolved_by=p_actor_user_id,resolved_at=now()
    where workspace_id=p_workspace_id and id=p_update_id;
    return jsonb_build_object('ok',true,'status',200,'decision','accept','updateId',p_update_id,
      'targetKind','catalog','orderCatalogItemId',v_catalog_update.order_catalog_item_id,
      'catalogRevision',v_catalog.catalog_revision,'cascadeOnly',true,
      'enforcedBy','clair-resolve-workspace-lab-definition-update');
  end if;
  v_member_ids := '{}';
  for v_member in select value from jsonb_array_elements(coalesce(v_source_snapshot->'members','[]'::jsonb)) members(value) loop
    v_item_id := nullif(btrim(v_member->>'labTestItemId'),'');
    if v_item_id is null then raise exception 'lab_update_target_obsolete' using errcode='40001'; end if;
    select * into v_item from public.lab_test_items where workspace_id=p_workspace_id and id=v_item_id for update;
    if not found or v_item.definition_origin='quarantined' then raise exception 'lab_update_target_obsolete' using errcode='40001'; end if;
    v_source_test := nullif(v_member->>'sourceMasterTestRecordId','')::uuid;
    v_source_test_revision := nullif(v_member->>'ownerPinnedSourceTestRevision','')::integer;
    v_link_origin := v_member->>'linkOrigin';
    v_profile_kind := v_member->>'profileKind';
    v_source_ordinal := nullif(v_member->>'sourceOrdinal','')::integer;
    v_effective_sort := nullif(v_member->>'effectiveSortOrder','')::integer;
    v_required := (v_member->>'required')::boolean;
    v_group := nullif(v_member->>'displayGroup','');
    if v_link_origin not in ('clair_master','workspace_custom')
       or v_profile_kind not in ('panel','standalone_test')
       or v_effective_sort is null or v_effective_sort < 0
       or v_required is null then
      raise exception 'lab_update_target_obsolete' using errcode='40001';
    end if;
    v_member_revision := nullif(v_member->>'pinnedWorkspaceResultRevision','')::integer;
    v_link_id := 'lab-link:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':' || v_catalog_update.order_catalog_item_id || ':' || v_item_id,'UTF8'),'sha256'),'hex'));
    select * into v_existing from public.order_catalog_lab_test_item_links
    where workspace_id=p_workspace_id and id=v_link_id for update;
    select exists (
      select 1
      from public.workspace_lab_item_updates item_target
      where item_target.workspace_id=p_workspace_id
        and item_target.lab_test_item_id=v_item_id
        and item_target.source_release_id=v_catalog_update.source_release_id
        and item_target.status in ('pending','accepted')
        and v_catalog_update.order_catalog_item_id=any(item_target.affected_catalog_item_ids)
    ) into v_overlap_item_target;
    if found and v_source_test is not null
       and v_existing.owner_pinned_source_test_revision=v_source_test_revision
       and v_existing.pinned_workspace_result_revision > v_member_revision then
      -- The item target may already have produced the immutable N+1 owner.
      -- Preserve that pin while this target applies its independent catalog
      -- membership/profile projection.
      v_member_revision := v_existing.pinned_workspace_result_revision;
    end if;
    select * into v_version from public.lab_test_item_versions
    where workspace_id=p_workspace_id and lab_test_item_id=v_item_id
      and workspace_result_revision=v_member_revision;
    if not found then raise exception 'lab_update_target_obsolete' using errcode='40001'; end if;
    if found and v_existing.source_master_order_revision not in (v_catalog_update.source_owner_revision - 1,v_catalog_update.source_owner_revision) then
      raise exception 'lab_update_target_obsolete' using errcode='40001';
    end if;
    if found and v_source_test is not null
       and v_existing.owner_pinned_source_test_revision not in (v_source_test_revision - 1,v_source_test_revision) then
      raise exception 'lab_update_target_obsolete' using errcode='40001';
    end if;
    v_changed := not found
      or v_existing.lab_test_item_id is distinct from v_item_id
      or v_existing.link_origin is distinct from v_link_origin
      or v_existing.profile_kind is distinct from v_profile_kind
      or v_existing.source_master_test_record_id is distinct from v_source_test
      or v_existing.owner_pinned_source_test_revision is distinct from v_source_test_revision
      or v_existing.source_ordinal is distinct from v_source_ordinal
      or v_existing.effective_sort_order is distinct from v_effective_sort
      or v_existing.pinned_workspace_result_revision is distinct from v_member_revision
      or v_existing.required is distinct from v_required
      or v_existing.display_group is distinct from v_group;
    v_metadata := jsonb_build_object(
      'schemaVersion',2,'linkOrigin',v_link_origin,'profileKind',v_profile_kind,
      'workspaceCatalogItemId',v_catalog_update.order_catalog_item_id,
      'masterOrderRecordId',(v_source_snapshot->>'sourceMasterOrderRecordId')::uuid,
      'masterOrderRevision',(v_source_snapshot->>'sourceMasterOrderRevision')::integer,
      'masterPanelRecordId',nullif(v_source_snapshot->>'sourceMasterPanelRecordId','')::uuid,
      'masterPanelRevision',nullif(v_source_snapshot->>'sourceMasterPanelRevision','')::integer,
      'masterTestRecordId',v_source_test,
      'ownerPinnedSourceTestRevision',v_source_test_revision,
      'itemVersionSourceMasterRecordId',v_version.source_master_record_id,
      'itemVersionSourceTestRevision',v_version.source_master_revision,
      'labTestItemId',v_item_id,
      'pinnedWorkspaceResultRevision',v_version.workspace_result_revision,
      'sourceOrdinal',v_source_ordinal,'effectiveSortOrder',v_effective_sort,
      'required',v_required,'displayGroup',v_group
    );
    insert into public.order_catalog_lab_test_item_links(
      id,workspace_id,order_catalog_item_id,lab_test_item_id,lab_test_category_id,sort_order,
      link_revision,link_origin,profile_kind,source_master_order_record_id,source_master_order_revision,
      source_master_panel_record_id,source_master_panel_revision,source_master_test_record_id,
      owner_pinned_source_test_revision,source_ordinal,effective_sort_order,pinned_workspace_result_revision,
      required,display_group,snapshot_metadata,snapshot_metadata_schema_version,snapshot_metadata_sha256
    ) values (
      v_link_id,p_workspace_id,v_catalog_update.order_catalog_item_id,v_item_id,
      coalesce(v_existing.lab_test_category_id,v_item.category_id),v_effective_sort,
      case when found and v_overlap_item_target then v_existing.link_revision
           when found and not v_changed then v_existing.link_revision
           else coalesce(v_existing.link_revision,0)+1 end,
      v_link_origin,v_profile_kind,(v_source_snapshot->>'sourceMasterOrderRecordId')::uuid,
      (v_source_snapshot->>'sourceMasterOrderRevision')::integer,
      nullif(v_source_snapshot->>'sourceMasterPanelRecordId','')::uuid,
      nullif(v_source_snapshot->>'sourceMasterPanelRevision','')::integer,
      v_source_test,v_source_test_revision,v_source_ordinal,v_effective_sort,v_version.workspace_result_revision,
      v_required,v_group,v_metadata,2,private.clinical_master_sha256(v_metadata)
    ) on conflict (workspace_id,id) do update set
      lab_test_item_id=excluded.lab_test_item_id,lab_test_category_id=excluded.lab_test_category_id,
      sort_order=excluded.sort_order,link_revision=excluded.link_revision,link_origin=excluded.link_origin,
      profile_kind=excluded.profile_kind,source_master_order_record_id=excluded.source_master_order_record_id,
      source_master_order_revision=excluded.source_master_order_revision,
      source_master_panel_record_id=excluded.source_master_panel_record_id,
      source_master_panel_revision=excluded.source_master_panel_revision,
      source_master_test_record_id=excluded.source_master_test_record_id,
      owner_pinned_source_test_revision=excluded.owner_pinned_source_test_revision,
      source_ordinal=excluded.source_ordinal,effective_sort_order=excluded.effective_sort_order,
      pinned_workspace_result_revision=excluded.pinned_workspace_result_revision,required=excluded.required,
      display_group=excluded.display_group,snapshot_metadata=excluded.snapshot_metadata,
      snapshot_metadata_schema_version=excluded.snapshot_metadata_schema_version,
      snapshot_metadata_sha256=excluded.snapshot_metadata_sha256,link_quarantine_reason=null;
    v_member_ids := array_append(v_member_ids,v_item_id);
  end loop;
  delete from public.order_catalog_lab_test_item_links link
  where link.workspace_id=p_workspace_id and link.order_catalog_item_id=v_catalog_update.order_catalog_item_id
    and link.link_origin in ('clair_master','workspace_custom')
    and not (link.lab_test_item_id=any(v_member_ids));
  -- Rebuild only the effective item-version fields in the trusted source
  -- snapshot from the rows just written.  This makes catalog-first and
  -- item-first acceptance produce the same stored snapshot/hash without
  -- rereading mutable master definitions.
  select coalesce(jsonb_agg(
           members.value || jsonb_build_object(
             'itemVersionSourceMasterRecordId',version.source_master_record_id,
             'itemVersionSourceTestRevision',version.source_master_revision,
             'pinnedWorkspaceResultRevision',link.pinned_workspace_result_revision
           )
           order by coalesce(nullif(members.value->>'sourceOrdinal','')::integer,2147483647),
                    coalesce(nullif(members.value->>'effectiveSortOrder','')::integer,2147483647),
                    members.value->>'labTestItemId'
         ),'[]'::jsonb)
    into v_applied_members
  from jsonb_array_elements(coalesce(v_source_snapshot->'members','[]'::jsonb)) members(value)
  join public.order_catalog_lab_test_item_links link
    on link.workspace_id=p_workspace_id
   and link.order_catalog_item_id=v_catalog_update.order_catalog_item_id
   and link.lab_test_item_id=members.value->>'labTestItemId'
  join public.lab_test_item_versions version
    on version.workspace_id=link.workspace_id
   and version.lab_test_item_id=link.lab_test_item_id
   and version.workspace_result_revision=link.pinned_workspace_result_revision;
  v_applied_snapshot := jsonb_set(v_source_snapshot,'{members}',v_applied_members,false);
  update public.order_catalog_items
  set catalog_revision=catalog_revision+1,
      last_applied_lab_membership_projection_snapshot=v_applied_snapshot,
      last_applied_lab_membership_projection_sha256=private.clinical_master_lab_membership_source_fingerprint(v_applied_snapshot),
      last_applied_lab_membership_projection_schema_version=1,
      updated_at=now()
  where workspace_id=p_workspace_id and id=v_catalog_update.order_catalog_item_id;
  update public.workspace_lab_catalog_updates
  set status='accepted',resolved_by=p_actor_user_id,resolved_at=now()
  where workspace_id=p_workspace_id and id=p_update_id;
  return jsonb_build_object('ok',true,'status',200,'decision','accept','updateId',p_update_id,
    'targetKind','catalog','orderCatalogItemId',v_catalog_update.order_catalog_item_id,
    'catalogRevision',v_catalog.catalog_revision+1,'enforcedBy','clair-resolve-workspace-lab-definition-update');
end
$$;
revoke all on function private.clair_resolve_workspace_lab_definition_update_target(text,uuid,uuid,integer,text) from public,anon,authenticated,service_role;

create or replace function public.clair_resolve_workspace_lab_definition_update(
  p_workspace_id text,
  p_update_id uuid,
  p_actor_user_id uuid,
  p_expected_revision integer,
  p_decision text
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
begin
  return private.clair_resolve_workspace_lab_definition_update_target(
    p_workspace_id,p_update_id,p_actor_user_id,p_expected_revision,p_decision
  );
end
$$;
revoke all on function public.clair_resolve_workspace_lab_definition_update(text,uuid,uuid,integer,text) from public,anon,service_role;
grant execute on function public.clair_resolve_workspace_lab_definition_update(text,uuid,uuid,integer,text) to authenticated;

-- Retain the pre-B1 compatibility body for reference only; the immutable
-- freeze writer above remains the callable authority.
create or replace function private.clair_create_lab_result_entry_for_confirmed_order_legacy_base(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_order_id uuid,
  p_encounter_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_order public.orders%rowtype;
  v_entry public.lab_result_entries%rowtype;
  v_profile record;
  v_link record;
  v_version public.lab_test_item_versions%rowtype;
  v_snapshot jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_item_ids text[] := '{}';
  v_header_id uuid;
  v_result_id text := 'lab-order:' || p_order_id::text;
  v_ordinal integer;
  v_row_id text;
  v_row jsonb;
  v_active_count integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:' || p_workspace_id,0));
  select * into v_order from public.orders where workspace_id=p_workspace_id and id=p_order_id and encounter_id=p_encounter_id for update;
  if not found then raise exception 'order_unavailable'; end if;
  if v_order.order_type <> 'lab' or v_order.workspace_catalog_item_id is null then return jsonb_build_object('ok',true,'status',200,'savedResult',null,'enforcedBy','lab-result-freeze-compatibility'); end if;
  if v_order.service_item_id is not null then raise exception 'catalog_service_dual'; end if;
  if not exists(select 1 from public.encounters where workspace_id=p_workspace_id and id=p_encounter_id and status <> 'cancelled') then raise exception 'encounter_unavailable'; end if;
  select entry.* into v_entry from public.lab_result_entries entry where entry.workspace_id=p_workspace_id and entry.order_id=p_order_id and entry.result_definition_origin='canonical' for update;
  if found then
    if v_entry.encounter_id is distinct from p_encounter_id or v_entry.result_id is distinct from v_result_id then raise exception 'lab_result_identity_mismatch'; end if;
    return jsonb_build_object('ok',true,'status',200,'resultId',v_entry.result_id,'resultEntryId',v_entry.id,'created',false,'enforcedBy','lab-result-freeze');
  end if;
  select profile.*, order_record.current_revision as current_order_revision
  into v_profile
  from master.lab_order_profiles profile
  join master.master_records order_record on order_record.id=profile.order_record_id
  where profile.order_record_id=v_order.source_master_record_id;
  if not found or v_order.source_master_revision is null then raise exception 'lab_result_not_frozen'; end if;
  if v_profile.current_order_revision < v_order.source_master_revision then raise exception 'catalog_projection_stale'; end if;
  if v_profile.lab_panel_id is null and v_profile.lab_test_id is null then raise exception 'lab_result_profile_missing'; end if;

  for v_link in
    select link.*,
      (
        select count(*)::integer
        from public.order_catalog_lab_test_item_links prior_link
        where prior_link.workspace_id=link.workspace_id
          and prior_link.order_catalog_item_id=link.order_catalog_item_id
          and prior_link.link_origin in ('clair_master','workspace_custom')
          and prior_link.effective_sort_order is not null
          and (
            prior_link.effective_sort_order < link.effective_sort_order
            or (prior_link.effective_sort_order = link.effective_sort_order and prior_link.id <= link.id)
          )
      ) as frozen_ordinal
    from public.order_catalog_lab_test_item_links link
    where link.workspace_id=p_workspace_id and link.order_catalog_item_id=v_order.workspace_catalog_item_id
      and link.link_origin in ('clair_master','workspace_custom')
      and link.effective_sort_order is not null
    order by link.effective_sort_order,link.id
    for update of link
  loop
    select * into v_version from public.lab_test_item_versions version
    where version.workspace_id=p_workspace_id and version.lab_test_item_id=v_link.lab_test_item_id and version.workspace_result_revision=v_link.pinned_workspace_result_revision;
    if not found then raise exception 'catalog_projection_stale'; end if;
    if not exists(select 1 from public.lab_test_items item where item.workspace_id=p_workspace_id and item.id=v_link.lab_test_item_id and item.availability_status='active') then
      if coalesce(v_link.required,true) then raise exception 'required_lab_item_inactive'; else continue; end if;
    end if;
    v_active_count := v_active_count + 1;
    v_row_id := lower(encode(extensions.digest(convert_to(format('lab-result-row:v1:%s:%s:%s',p_order_id::text,v_link.id::text,v_link.frozen_ordinal::text),'UTF8'),'sha256'),'hex'));
    v_row := jsonb_build_object(
      'rowId',v_row_id,
      'rowDefinitionOrigin',v_link.link_origin,
      'ordinal',v_link.frozen_ordinal,
      'labTestItemId',v_link.lab_test_item_id,
      'sourceMasterTestRecordId',v_link.source_master_test_record_id,
      'ownerPinnedSourceTestRevision',v_link.owner_pinned_source_test_revision,
      'itemVersionSourceMasterRecordId',v_version.source_master_record_id,
      'itemVersionSourceTestRevision',v_version.source_master_revision,
      'workspaceResultRevision',v_version.workspace_result_revision,
      'sourceOrdinal',v_link.source_ordinal,
      'effectiveSortOrder',v_link.effective_sort_order,
      'analyteName',v_version.test_item_name,
      'resultValueKind',v_version.result_value_kind,
      'resultInputType',v_version.result_input_type,
      'unit',v_version.result_unit,
      'decimalScale',v_version.decimal_scale,
      'referenceRange',null,
      'required',coalesce(v_link.required,true),
      'displayGroup',v_link.display_group
    );
    v_rows := v_rows || jsonb_build_array(v_row);
    v_item_ids := array_append(v_item_ids,v_link.lab_test_item_id);
  end loop;
  if v_active_count=0 then raise exception 'no_active_lab_items'; end if;
  if v_profile.lab_panel_id is null and v_active_count <> 1 then raise exception 'standalone_lab_item_count_invalid'; end if;
  v_snapshot := jsonb_build_object(
    'schemaVersion',1,
    'source',jsonb_build_object('workspaceCatalogItemId',v_order.workspace_catalog_item_id,'workspaceCatalogRevision',v_order.workspace_catalog_revision,'masterOrderRecordId',v_order.source_master_record_id,'masterOrderRevision',v_order.source_master_revision,'profile',jsonb_build_object('orderRecordId',v_profile.order_record_id,'targetType',case when v_profile.lab_panel_id is not null then 'panel' else 'test' end,'labPanelRecordId',v_profile.lab_panel_id,'labPanelRevision',(select current_revision from master.master_records where id=v_profile.lab_panel_id),'labTestRecordId',v_profile.lab_test_id,'labTestRevision',(select current_revision from master.master_records where id=v_profile.lab_test_id),'specimenTypeRecordId',v_profile.specimen_type_id,'specimenTypeRevision',(select current_revision from master.master_records where id=v_profile.specimen_type_id))),
    'rows',v_rows
  );
  insert into public.lab_result_entries(workspace_id,result_id,encounter_id,order_id,result_status,result_payload,abnormal_flag,entry_write_revision,source_workspace_catalog_item_id,source_workspace_catalog_revision,source_master_order_record_id,source_master_order_revision,source_master_panel_record_id,source_master_panel_revision,source_master_test_record_id,source_master_test_revision,result_definition_snapshot,result_definition_snapshot_sha256,result_definition_origin,result_quarantine_reason,created_at,updated_at)
  values(p_workspace_id,v_result_id,p_encounter_id,p_order_id,'received','{}'::jsonb,'not_judged',0,v_order.workspace_catalog_item_id,v_order.workspace_catalog_revision,v_order.source_master_record_id,v_order.source_master_revision,v_profile.lab_panel_id,(select current_revision from master.master_records where id=v_profile.lab_panel_id),v_profile.lab_test_id,(select current_revision from master.master_records where id=v_profile.lab_test_id),v_snapshot,private.clinical_master_sha256(v_snapshot),'canonical',null,now(),now())
  on conflict (workspace_id,order_id) where (result_definition_origin='canonical') do nothing
  returning id into v_header_id;
  if v_header_id is null then select id into v_header_id from public.lab_result_entries where workspace_id=p_workspace_id and order_id=p_order_id and result_definition_origin='canonical' for update; return jsonb_build_object('ok',true,'status',200,'resultId',v_result_id,'resultEntryId',v_header_id,'created',false,'enforcedBy','lab-result-freeze'); end if;
  for v_row in select value from jsonb_array_elements(v_rows) rows(value) loop
    insert into public.lab_result_entry_rows(workspace_id,lab_result_entry_id,row_id,lab_test_item_id,analyte_name,result_value,result_unit,reference_range,judgment,note,sort_order,row_definition_origin,workspace_result_revision,source_master_test_record_id,owner_pinned_source_test_revision,item_version_source_master_record_id,item_version_source_test_revision,result_value_kind,result_input_type,decimal_scale,source_ordinal,effective_sort_order,required,display_group,created_at,updated_at)
    values(p_workspace_id,v_header_id,v_row->>'rowId',v_row->>'labTestItemId',v_row->>'analyteName',null,v_row->>'unit',null,'not_judged',null,(v_row->>'ordinal')::integer,v_row->>'rowDefinitionOrigin',(v_row->>'workspaceResultRevision')::integer,nullif(v_row->>'sourceMasterTestRecordId','')::uuid,nullif(v_row->>'ownerPinnedSourceTestRevision','')::integer,nullif(v_row->>'itemVersionSourceMasterRecordId','')::uuid,nullif(v_row->>'itemVersionSourceTestRevision','')::integer,v_row->>'resultValueKind',v_row->>'resultInputType',nullif(v_row->>'decimalScale','')::integer,nullif(v_row->>'sourceOrdinal','')::integer,(v_row->>'effectiveSortOrder')::integer,(v_row->>'required')::boolean,v_row->>'displayGroup',now(),now());
  end loop;
  perform private.clair_recompute_lab_test_item_saved_result_usage_batch(p_workspace_id,v_item_ids);
  return jsonb_build_object('ok',true,'status',200,'resultId',v_result_id,'resultEntryId',v_header_id,'created',true,'enforcedBy','lab-result-freeze');
end
$$;
revoke all on function private.clair_create_lab_result_entry_for_confirmed_order_legacy_base(text,uuid,uuid,uuid) from public,anon,authenticated,service_role;

do $$
begin
  if to_regprocedure('public.clair_save_chart_order_action(text,uuid,uuid,text,uuid[])') is not null
     and to_regprocedure('public.clair_save_chart_order_action_a3_base(text,uuid,uuid,text,uuid[])') is null then
    alter function public.clair_save_chart_order_action(text,uuid,uuid,text,uuid[])
      rename to clair_save_chart_order_action_a3_base;
  end if;
end
$$;

create or replace function public.clair_save_chart_order_action(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_action text,
  p_order_ids uuid[]
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_base jsonb;
  v_order_id uuid;
  v_freeze jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:' || p_workspace_id,0));
  v_base := public.clair_save_chart_order_action_a3_base(p_workspace_id,p_actor_user_id,p_encounter_id,p_action,p_order_ids);
  if p_action = 'confirm' then
    for v_order_id in select distinct value from unnest(coalesce(p_order_ids,'{}')) values(value) order by value loop
      v_freeze := private.clair_create_lab_result_entry_for_confirmed_order(p_workspace_id,p_actor_user_id,v_order_id,p_encounter_id);
    end loop;
  end if;
  return v_base;
end
$$;
revoke all on function public.clair_save_chart_order_action(text,uuid,uuid,text,uuid[]) from public,anon,service_role;
grant execute on function public.clair_save_chart_order_action(text,uuid,uuid,text,uuid[]) to authenticated;

-- Fulfillment remains the A3 owner of work-item creation.  B1 only attaches
-- the already-created same-order lab work item to the frozen result header;
-- it never refreshes a definition or reparents a result.
create or replace function private.clair_attach_lab_result_work_item(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_order_id uuid,
  p_work_item_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_order public.orders%rowtype;
  v_encounter public.encounters%rowtype;
  v_entry public.lab_result_entries%rowtype;
  v_work_item public.order_fulfillment_work_items%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:' || p_workspace_id,0));
  select * into v_order from public.orders where workspace_id=p_workspace_id and id=p_order_id for update;
  if not found then raise exception 'order_unavailable'; end if;
  select * into v_encounter from public.encounters where workspace_id=p_workspace_id and id=v_order.encounter_id for update;
  if not found then raise exception 'encounter_unavailable'; end if;
  select * into v_entry from public.lab_result_entries where workspace_id=p_workspace_id and order_id=p_order_id and result_definition_origin='canonical' for update;
  if not found then
    return jsonb_build_object('ok',true,'status',200,'attached',false,'enforcedBy','lab-result-work-item-attach');
  end if;
  select * into v_work_item from public.order_fulfillment_work_items where workspace_id=p_workspace_id and id=p_work_item_id for update;
  if not found or v_work_item.order_id is distinct from p_order_id or v_work_item.encounter_id is distinct from v_order.encounter_id or v_work_item.queue_type <> 'lab' then
    raise exception 'work_item_unavailable';
  end if;
  if v_entry.work_item_id is not null and v_entry.work_item_id is distinct from p_work_item_id then
    raise exception 'lab_result_work_item_conflict';
  end if;
  if v_entry.work_item_id is null then
    update public.lab_result_entries set work_item_id=p_work_item_id,updated_at=now() where workspace_id=p_workspace_id and id=v_entry.id;
  end if;
  return jsonb_build_object('ok',true,'status',200,'attached',true,'resultEntryId',v_entry.id,'workItemId',p_work_item_id,'enforcedBy','lab-result-work-item-attach');
end
$$;
revoke all on function private.clair_attach_lab_result_work_item(text,uuid,uuid,uuid) from public,anon,authenticated,service_role;

do $$
begin
  if to_regprocedure('public.clair_sync_fulfillment_work_items_from_orders(text,uuid,uuid,uuid[])') is not null
     and to_regprocedure('public.clair_sync_fulfillment_work_items_from_orders_a3_base(text,uuid,uuid,uuid[])') is null then
    alter function public.clair_sync_fulfillment_work_items_from_orders(text,uuid,uuid,uuid[])
      rename to clair_sync_fulfillment_work_items_from_orders_a3_base;
  end if;
end
$$;

create or replace function public.clair_sync_fulfillment_work_items_from_orders(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_order_ids uuid[]
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_base jsonb;
  v_order_id uuid;
  v_work_item_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:' || p_workspace_id,0));
  v_base := public.clair_sync_fulfillment_work_items_from_orders_a3_base(p_workspace_id,p_actor_user_id,p_encounter_id,p_order_ids);
  for v_order_id in select distinct value from unnest(coalesce(p_order_ids,'{}')) values(value) order by value loop
    select id into v_work_item_id
    from public.order_fulfillment_work_items
    where workspace_id=p_workspace_id and order_id=v_order_id and encounter_id=p_encounter_id and queue_type='lab'
    order by id
    limit 1
    for update;
    if v_work_item_id is not null then
      perform private.clair_attach_lab_result_work_item(p_workspace_id,p_actor_user_id,v_order_id,v_work_item_id);
    end if;
  end loop;
  return v_base;
end
$$;
revoke all on function public.clair_sync_fulfillment_work_items_from_orders(text,uuid,uuid,uuid[]) from public,anon,service_role;
grant execute on function public.clair_sync_fulfillment_work_items_from_orders(text,uuid,uuid,uuid[]) to authenticated;

create table if not exists public.lab_result_entry_write_requests (
  workspace_id text not null,
  lab_result_entry_id uuid not null,
  request_id uuid not null,
  normalized_payload_sha256 text not null check (normalized_payload_sha256 ~ '^[0-9a-f]{64}$'),
  base_entry_write_revision integer not null check (base_entry_write_revision >= 0),
  resulting_entry_write_revision integer not null check (resulting_entry_write_revision >= 0),
  outcome jsonb not null check (jsonb_typeof(outcome)='object'),
  actor_user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (workspace_id,lab_result_entry_id,request_id),
  foreign key (workspace_id,lab_result_entry_id) references public.lab_result_entries(workspace_id,id) on delete restrict
);
alter table public.lab_result_entry_write_requests enable row level security;
revoke all on public.lab_result_entry_write_requests from public,anon,authenticated;

create or replace function private.clair_serialize_lab_result_entry(
  p_workspace_id text,
  p_result_entry_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_entry public.lab_result_entries%rowtype;
  v_rows jsonb;
begin
  select * into v_entry from public.lab_result_entries where workspace_id=p_workspace_id and id=p_result_entry_id;
  if not found then raise exception 'lab_result_not_found'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',row.row_id,
    'labTestItemId',row.lab_test_item_id,
    'analyteName',row.analyte_name,
    'value',row.result_value,
    'unit',row.result_unit,
    'referenceRange',row.reference_range,
    'judgment',row.judgment,
    'note',row.note,
    'resultValueKind',row.result_value_kind,
    'resultInputType',row.result_input_type,
    'decimalScale',row.decimal_scale,
    'required',row.required,
    'displayGroup',row.display_group,
    'sourceOrdinal',row.source_ordinal,
    'effectiveSortOrder',row.effective_sort_order,
    'workspaceResultRevision',row.workspace_result_revision
  ) order by row.sort_order,row.row_id),'[]'::jsonb) into v_rows
  from public.lab_result_entry_rows row where row.workspace_id=p_workspace_id and row.lab_result_entry_id=p_result_entry_id;
  return jsonb_build_object(
    'workspaceId',v_entry.workspace_id,
    'resultId',v_entry.result_id,
    'resultEntryId',v_entry.id,
    'encounterId',v_entry.encounter_id,
    'orderId',v_entry.order_id,
    'workItemId',v_entry.work_item_id,
    'resultStatus',v_entry.result_status,
    'entryWriteRevision',v_entry.entry_write_revision,
    'abnormalFlag','not_judged',
    'createdAt',v_entry.created_at,
    'updatedAt',v_entry.updated_at,
    'actorUserId',v_entry.entered_by_user_id,
    'sourceWorkspaceCatalogItemId',v_entry.source_workspace_catalog_item_id,
    'sourceWorkspaceCatalogRevision',v_entry.source_workspace_catalog_revision,
    'sourceMasterOrderRecordId',v_entry.source_master_order_record_id,
    'sourceMasterOrderRevision',v_entry.source_master_order_revision,
    'sourceMasterPanelRecordId',v_entry.source_master_panel_record_id,
    'sourceMasterPanelRevision',v_entry.source_master_panel_revision,
    'sourceMasterTestRecordId',v_entry.source_master_test_record_id,
    'sourceMasterTestRevision',v_entry.source_master_test_revision,
    'resultDefinitionSnapshot',v_entry.result_definition_snapshot,
    'resultDefinitionSnapshotSha256',v_entry.result_definition_snapshot_sha256,
    'rows',v_rows,
    'ok',true,'status',200,'savedResult',jsonb_build_object('workspaceId',v_entry.workspace_id,'resultId',v_entry.result_id,'resultEntryId',v_entry.id,'encounterId',v_entry.encounter_id,'orderId',v_entry.order_id,'workItemId',v_entry.work_item_id,'resultStatus',v_entry.result_status,'entryWriteRevision',v_entry.entry_write_revision,'createdAt',v_entry.created_at,'updatedAt',v_entry.updated_at,'actorUserId',v_entry.entered_by_user_id,'rows',v_rows)
  );
end
$$;
revoke all on function private.clair_serialize_lab_result_entry(text,uuid) from public,anon,authenticated,service_role;

create or replace function public.clair_save_lab_result_entry_v2(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_result_id text,
  p_encounter_id uuid,
  p_order_id uuid,
  p_work_item_id uuid,
  p_expected_entry_write_revision integer,
  p_request_id uuid,
  p_rows jsonb
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_entry public.lab_result_entries%rowtype;
  v_work_item public.order_fulfillment_work_items%rowtype;
  v_row jsonb;
  v_normalized jsonb := '[]'::jsonb;
  v_hash text;
  v_existing public.lab_result_entry_write_requests%rowtype;
  v_result jsonb;
  v_next_revision integer;
  v_found integer;
  v_id text;
  v_value text;
  v_note text;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then raise exception 'actor_mismatch' using errcode='42501'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing'; end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id,'lab:complete') then raise exception 'permission_missing'; end if;
  if p_request_id is null then raise exception 'invalid_request_id' using errcode='22023'; end if;
  if p_expected_entry_write_revision is null or p_expected_entry_write_revision < 0 then raise exception 'entry_write_revision_required' using errcode='22023'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows)=0 or jsonb_array_length(p_rows)>200 then raise exception 'invalid_lab_result_entry_payload' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:' || p_workspace_id,0));
  perform 1 from public.encounters where workspace_id=p_workspace_id and id=p_encounter_id and status <> 'cancelled' for update;
  if not found then raise exception 'encounter_unavailable'; end if;
  perform 1 from public.orders where workspace_id=p_workspace_id and id=p_order_id and encounter_id=p_encounter_id for update;
  if not found then raise exception 'order_unavailable'; end if;
  select * into v_entry from public.lab_result_entries where workspace_id=p_workspace_id and order_id=p_order_id and result_definition_origin='canonical' for update;
  if not found then raise exception 'lab_result_not_frozen'; end if;
  if p_result_id is not null and btrim(p_result_id) <> '' and p_result_id <> v_entry.result_id then raise exception 'lab_result_identity_mismatch'; end if;
  if v_entry.encounter_id is distinct from p_encounter_id then raise exception 'lab_result_identity_mismatch'; end if;
  perform private.clair_assert_lab_result_definition_snapshot(p_workspace_id,v_entry.id);
  if p_work_item_id is not null then
    select * into v_work_item from public.order_fulfillment_work_items where workspace_id=p_workspace_id and id=p_work_item_id and order_id=p_order_id and encounter_id=p_encounter_id for update;
    if not found then raise exception 'work_item_unavailable'; end if;
    if v_entry.work_item_id is not null and v_entry.work_item_id is distinct from p_work_item_id then raise exception 'lab_result_work_item_conflict'; end if;
    if v_entry.work_item_id is null then update public.lab_result_entries set work_item_id=p_work_item_id,updated_at=now() where workspace_id=p_workspace_id and id=v_entry.id; end if;
  elsif v_entry.work_item_id is not null then null;
  end if;
  for v_row in select value from jsonb_array_elements(p_rows) rows(value) loop
    if jsonb_typeof(v_row) <> 'object' or (select count(*) from jsonb_object_keys(v_row)) <> 3 or exists(select 1 from jsonb_object_keys(v_row) key where key not in ('rowId','value','note')) then raise exception 'invalid_lab_result_entry_payload'; end if;
    v_id := v_row->>'rowId';
    if v_id !~ '^[0-9a-f]{64}$' or (jsonb_typeof(v_row->'value') not in ('string','null')) or (jsonb_typeof(v_row->'note') not in ('string','null')) or length(coalesce(v_row->>'value','')) > 4096 or length(coalesce(v_row->>'note','')) > 4096 then raise exception 'invalid_lab_result_entry_payload'; end if;
    select count(*) into v_found from public.lab_result_entry_rows where workspace_id=p_workspace_id and lab_result_entry_id=v_entry.id and row_id=v_id;
    if v_found <> 1 then raise exception 'lab_result_row_not_found'; end if;
    if exists(select 1 from jsonb_array_elements(v_normalized) rows(value) where value->>'rowId'=v_id) then raise exception 'invalid_lab_result_entry_payload'; end if;
    v_normalized := v_normalized || jsonb_build_array(jsonb_build_object('rowId',v_id,'value',case when jsonb_typeof(v_row->'value')='null' then null else v_row->>'value' end,'note',case when jsonb_typeof(v_row->'note')='null' then null else v_row->>'note' end));
  end loop;
  select jsonb_agg(value order by value->>'rowId') into v_normalized from jsonb_array_elements(v_normalized) rows(value);
  v_hash := private.clinical_master_sha256(jsonb_build_object('baseEntryWriteRevision',p_expected_entry_write_revision,'rows',v_normalized));
  select * into v_existing from public.lab_result_entry_write_requests where workspace_id=p_workspace_id and lab_result_entry_id=v_entry.id and request_id=p_request_id for update;
  if found then
    if v_existing.actor_user_id is distinct from p_actor_user_id or v_existing.normalized_payload_sha256 is distinct from v_hash or v_existing.base_entry_write_revision is distinct from p_expected_entry_write_revision then raise exception 'entry_request_id_conflict'; end if;
    -- Request identity is a durable ledger key.  A retry returns the exact
    -- stored outcome even if a later read observes a newer entry revision.
    return v_existing.outcome;
  end if;
  if v_entry.result_status not in ('received','entered') then
    raise exception 'lab_result_status_read_only';
  end if;
  if v_entry.entry_write_revision <> p_expected_entry_write_revision then raise exception 'entry_write_revision_conflict' using errcode='40001'; end if;
  v_next_revision := v_entry.entry_write_revision + 1;
  for v_row in select value from jsonb_array_elements(v_normalized) rows(value) loop
    update public.lab_result_entry_rows set result_value=case when jsonb_typeof(v_row->'value')='null' then null else v_row->>'value' end,note=case when jsonb_typeof(v_row->'note')='null' then null else v_row->>'note' end,judgment='not_judged',updated_at=now() where workspace_id=p_workspace_id and lab_result_entry_id=v_entry.id and row_id=v_row->>'rowId';
  end loop;
  update public.lab_result_entries set result_status=case when result_status='received' then 'entered' else result_status end,entered_by_user_id=case when result_status='received' then p_actor_user_id else entered_by_user_id end,entered_at=case when result_status='received' then now() else entered_at end,entry_write_revision=v_next_revision,abnormal_flag='not_judged',updated_at=now() where workspace_id=p_workspace_id and id=v_entry.id;
  v_result := private.clair_serialize_lab_result_entry(p_workspace_id,v_entry.id);
  insert into public.lab_result_entry_write_requests(workspace_id,lab_result_entry_id,request_id,normalized_payload_sha256,base_entry_write_revision,resulting_entry_write_revision,outcome,actor_user_id)
  values(p_workspace_id,v_entry.id,p_request_id,v_hash,p_expected_entry_write_revision,v_next_revision,v_result,p_actor_user_id);
  return v_result;
end
$$;
revoke all on function public.clair_save_lab_result_entry_v2(text,uuid,text,uuid,uuid,uuid,integer,uuid,jsonb) from public,anon,service_role;
grant execute on function public.clair_save_lab_result_entry_v2(text,uuid,text,uuid,uuid,uuid,integer,uuid,jsonb) to authenticated;

do $$
begin
  if to_regprocedure('public.clair_get_lab_result_entry(text,text,uuid,uuid)') is not null
     and to_regprocedure('public.clair_get_lab_result_entry_legacy_base(text,text,uuid,uuid)') is null then
    alter function public.clair_get_lab_result_entry(text,text,uuid,uuid)
      rename to clair_get_lab_result_entry_legacy_base;
  end if;
  if to_regprocedure('public.clair_save_lab_result_entry(text,uuid,text,uuid,uuid,uuid,jsonb)') is not null
     and to_regprocedure('public.clair_save_lab_result_entry_legacy_base(text,uuid,text,uuid,uuid,uuid,jsonb)') is null then
    alter function public.clair_save_lab_result_entry(text,uuid,text,uuid,uuid,uuid,jsonb)
      rename to clair_save_lab_result_entry_legacy_base;
  end if;
end
$$;

create or replace function public.clair_save_lab_result_entry(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_result_id text,
  p_encounter_id uuid,
  p_order_id uuid,
  p_work_item_id uuid,
  p_rows jsonb
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_entry public.lab_result_entries%rowtype;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then raise exception 'actor_mismatch' using errcode='42501'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing'; end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id,'lab:complete') then raise exception 'permission_missing'; end if;
  select * into v_entry from public.lab_result_entries where workspace_id=p_workspace_id and result_id=p_result_id for update;
  if not found or v_entry.result_definition_origin <> 'legacy' then raise exception 'lab_result_legacy_writer_forbidden' using errcode='42501'; end if;
  return public.clair_save_lab_result_entry_legacy_base(p_workspace_id,p_actor_user_id,p_result_id,p_encounter_id,p_order_id,p_work_item_id,p_rows);
end
$$;
revoke all on function public.clair_save_lab_result_entry(text,uuid,text,uuid,uuid,uuid,jsonb) from public,anon,service_role;
grant execute on function public.clair_save_lab_result_entry(text,uuid,text,uuid,uuid,uuid,jsonb) to authenticated;

-- Actor-bound getter.  It reads the stored header/rows only; patient-linked
-- selectors cannot reach the current catalog/master/profile projection.
create or replace function public.clair_get_lab_result_entry(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_result_id text default null,
  p_work_item_id uuid default null,
  p_order_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_entry public.lab_result_entries%rowtype;
  v_count integer;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then raise exception 'actor_mismatch' using errcode='42501'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing'; end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id,'lab:view') then raise exception 'permission_missing'; end if;
  if p_result_id is null and p_work_item_id is null and p_order_id is null then raise exception 'lab_result_selector_required' using errcode='22023'; end if;
  if p_result_id is not null then
    select * into v_entry
    from public.lab_result_entries entry
    where entry.workspace_id=p_workspace_id and entry.result_id=p_result_id
    limit 1;
    if not found then
      return jsonb_build_object('ok',true,'status',200,'savedResult',null,'enforcedBy','lab-result-getter');
    end if;
    if (p_work_item_id is not null and v_entry.work_item_id is distinct from p_work_item_id)
       or (p_order_id is not null and v_entry.order_id is distinct from p_order_id) then
      raise exception 'lab_result_selector_mismatch' using errcode='22023';
    end if;
    perform private.clair_assert_lab_result_definition_snapshot(p_workspace_id,v_entry.id);
    return private.clair_serialize_lab_result_entry(p_workspace_id,v_entry.id);
  end if;
  select count(*) into v_count from public.lab_result_entries entry
  where entry.workspace_id=p_workspace_id
    and (p_result_id is null or entry.result_id=p_result_id)
    and (p_work_item_id is null or entry.work_item_id=p_work_item_id)
    and (p_order_id is null or entry.order_id=p_order_id);
  if v_count=0 then return jsonb_build_object('ok',true,'status',200,'savedResult',null,'enforcedBy','lab-result-getter'); end if;
  if v_count<>1 then raise exception 'lab_result_selector_ambiguous'; end if;
  select * into v_entry from public.lab_result_entries entry where entry.workspace_id=p_workspace_id and (p_result_id is null or entry.result_id=p_result_id) and (p_work_item_id is null or entry.work_item_id=p_work_item_id) and (p_order_id is null or entry.order_id=p_order_id) limit 1;
  perform private.clair_assert_lab_result_definition_snapshot(p_workspace_id,v_entry.id);
  return private.clair_serialize_lab_result_entry(p_workspace_id,v_entry.id);
end
$$;
revoke all on function public.clair_get_lab_result_entry(text,uuid,text,uuid,uuid) from public,anon,service_role;
grant execute on function public.clair_get_lab_result_entry(text,uuid,text,uuid,uuid) to authenticated;

-- Compatibility getter used only by the pre-B1 legacy writer.  Browser callers
-- receive the same actor/permission boundary as the new getter.
create or replace function public.clair_get_lab_result_entry(
  p_workspace_id text,
  p_result_id text default null,
  p_work_item_id uuid default null,
  p_order_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare v_actor uuid := auth.uid();
begin
  return public.clair_get_lab_result_entry(p_workspace_id,v_actor,p_result_id,p_work_item_id,p_order_id);
end
$$;
revoke all on function public.clair_get_lab_result_entry(text,text,uuid,uuid) from public, anon, authenticated, service_role;

-- A1's inline type check is replaced only by this forward migration.  The
-- actual preflight is intentionally strict: unexpected old types abort rather
-- than being silently reclassified as a laboratory record.
do $$
declare
  v_unexpected integer;
begin
  select count(*) into v_unexpected
  from master.master_records
  where record_type not in (
    'order_category','clinical_action','chart_group','task_route','order',
    'species','unit','specimen_type','result_input_type','lab_test','lab_panel'
  );
  if v_unexpected > 0 then
    raise exception 'clinical_master_phase1b1_preflight_unexpected_master_record_type count=%', v_unexpected;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'master.master_records'::regclass and conname = 'master_records_record_type_check') then
    alter table master.master_records drop constraint master_records_record_type_check;
  end if;
  alter table master.master_records
    add constraint master_records_record_type_check
    check (record_type = any (array[
      'order_category','clinical_action','chart_group','task_route','order',
      'species','unit','specimen_type','result_input_type','lab_test','lab_panel'
    ]));
end
$$;

create table if not exists master.lab_tests (
  master_record_id uuid primary key references master.master_records(id) on delete restrict,
  test_code text not null check (length(pg_catalog.btrim(test_code)) > 0),
  result_input_type_id uuid not null references master.result_input_types(master_record_id) on delete restrict,
  canonical_unit_id uuid references master.units(master_record_id) on delete restrict,
  decimal_scale integer check (decimal_scale is null or decimal_scale >= 0),
  unique (test_code)
);

create table if not exists master.lab_panels (
  master_record_id uuid primary key references master.master_records(id) on delete restrict,
  panel_code text not null check (length(pg_catalog.btrim(panel_code)) > 0),
  unique (panel_code)
);

create table if not exists master.lab_panel_items (
  id uuid primary key default extensions.gen_random_uuid(),
  lab_panel_id uuid not null references master.lab_panels(master_record_id) on delete restrict,
  lab_test_id uuid not null references master.lab_tests(master_record_id) on delete restrict,
  sort_order integer not null check (sort_order >= 0),
  required boolean not null default true,
  display_group text,
  unique (lab_panel_id, lab_test_id),
  unique (lab_panel_id, sort_order)
);

create table if not exists master.lab_order_profiles (
  order_record_id uuid primary key references master.orders(master_record_id) on delete restrict,
  lab_test_id uuid references master.lab_tests(master_record_id) on delete restrict,
  lab_panel_id uuid references master.lab_panels(master_record_id) on delete restrict,
  specimen_type_id uuid references master.specimen_types(master_record_id) on delete restrict,
  check ((lab_test_id is not null) <> (lab_panel_id is not null))
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'master_lab_tests_record_type_guard') then
    create trigger master_lab_tests_record_type_guard before insert or update on master.lab_tests
      for each row execute function master.assert_record_type();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'master_lab_panels_record_type_guard') then
    create trigger master_lab_panels_record_type_guard before insert or update on master.lab_panels
      for each row execute function master.assert_record_type();
  end if;
end
$$;

-- The generic A1 trigger reads TG_TABLE_NAME and the parent record ID.  Keep a
-- small explicit guard as a second line of defense because these tables are
-- private and have no browser grants.
create or replace function master.assert_lab_record_type()
returns trigger language plpgsql set search_path = master, pg_catalog as $$
declare
  v_expected text := case when TG_TABLE_NAME = 'lab_tests' then 'lab_test' else 'lab_panel' end;
begin
  if not exists (select 1 from master.master_records where id = new.master_record_id and record_type = v_expected) then
    raise exception 'clinical_master_lab_record_type_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;
create or replace function master.reject_lab_identity_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'clinical_master_lab_typed_projection_immutable' using errcode = '55000';
  end if;
  if new.master_record_id is distinct from old.master_record_id then
    raise exception 'clinical_master_lab_typed_identity_immutable' using errcode = '55000';
  end if;
  if tg_table_name = 'lab_tests'
     and pg_catalog.to_jsonb(new)->>'test_code' is distinct from pg_catalog.to_jsonb(old)->>'test_code' then
    raise exception 'clinical_master_lab_test_identity_immutable' using errcode = '55000';
  elsif tg_table_name = 'lab_panels'
     and pg_catalog.to_jsonb(new)->>'panel_code' is distinct from pg_catalog.to_jsonb(old)->>'panel_code' then
    raise exception 'clinical_master_lab_panel_identity_immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function master.reject_lab_identity_mutation() from public, anon, authenticated, service_role;
drop trigger if exists master_lab_tests_record_type_guard on master.lab_tests;
create trigger master_lab_tests_record_type_guard before insert or update on master.lab_tests
  for each row execute function master.assert_lab_record_type();
drop trigger if exists master_lab_panels_record_type_guard on master.lab_panels;
create trigger master_lab_panels_record_type_guard before insert or update on master.lab_panels
  for each row execute function master.assert_lab_record_type();
drop trigger if exists master_lab_tests_identity_guard on master.lab_tests;
create trigger master_lab_tests_identity_guard before update or delete on master.lab_tests
  for each row execute function master.reject_lab_identity_mutation();
drop trigger if exists master_lab_panels_identity_guard on master.lab_panels;
create trigger master_lab_panels_identity_guard before update or delete on master.lab_panels
  for each row execute function master.reject_lab_identity_mutation();

alter table master.lab_tests enable row level security;
alter table master.lab_panels enable row level security;
alter table master.lab_panel_items enable row level security;
alter table master.lab_order_profiles enable row level security;
revoke all on master.lab_tests, master.lab_panels, master.lab_panel_items, master.lab_order_profiles
  from public, anon, authenticated, service_role;

-- Tenant keys required by every new B1 composite foreign key.  The keys are
-- additive and harmless for the old local/dev rows.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.lab_test_categories'::regclass and conname = 'lab_test_categories_workspace_id_id_key') then
    alter table public.lab_test_categories add constraint lab_test_categories_workspace_id_id_key unique (workspace_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.lab_test_items'::regclass and conname = 'lab_test_items_workspace_id_id_key') then
    alter table public.lab_test_items add constraint lab_test_items_workspace_id_id_key unique (workspace_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.orders'::regclass and conname = 'orders_workspace_id_id_key') then
    alter table public.orders add constraint orders_workspace_id_id_key unique (workspace_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.encounters'::regclass and conname = 'encounters_workspace_id_id_key') then
    alter table public.encounters add constraint encounters_workspace_id_id_key unique (workspace_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.order_fulfillment_work_items'::regclass and conname = 'work_items_workspace_id_id_key') then
    alter table public.order_fulfillment_work_items add constraint work_items_workspace_id_id_key unique (workspace_id, id);
  end if;
end
$$;

-- Durable four-stage publisher evidence.  Each owner is staged once with its
-- effective immutable revision; omitted referenced owners are represented by
-- their already-published revision and never receive a cascading revision.
create table if not exists private.clinical_master_lab_publish_stage (
  release_id uuid not null references master.master_releases(id) on delete restrict,
  master_record_id uuid not null references master.master_records(id) on delete restrict,
  master_key text not null,
  record_type text not null check (record_type in ('result_input_type','unit','specimen_type','lab_test','lab_panel','order')),
  included boolean not null,
  base_content jsonb not null,
  relation_content jsonb not null default '{}'::jsonb,
  effective_revision integer not null check (effective_revision > 0),
  created_at timestamptz not null default now(),
  primary key (release_id, master_record_id),
  unique (release_id, master_key)
);
revoke all on private.clinical_master_lab_publish_stage from public,anon,authenticated,service_role;

-- Keep the four dependency passes independently inspectable.  The combined
-- compatibility stage above is retained for the existing publisher body,
-- while these release-scoped rows carry the approved vocabulary -> test ->
-- panel -> order effective-pass evidence and immutable owner pins.
create table if not exists private.clinical_master_lab_vocabulary_publish_stage (
  release_id uuid not null references master.master_releases(id) on delete restrict,
  owner_record_id uuid not null references master.master_records(id) on delete restrict,
  master_key text not null,
  record_type text not null check (record_type in ('result_input_type','unit','specimen_type')),
  included boolean not null,
  base_content jsonb not null,
  effective_revision integer not null check (effective_revision > 0),
  value_kind text,
  supports_unit boolean,
  canonical_code text,
  content_sha256 text,
  created_at timestamptz not null default now(),
  primary key (release_id, owner_record_id),
  unique (release_id, master_key)
);
create table if not exists private.clinical_master_lab_test_publish_stage (
  release_id uuid not null references master.master_releases(id) on delete restrict,
  owner_record_id uuid not null references master.master_records(id) on delete restrict,
  master_key text not null,
  included boolean not null,
  base_content jsonb not null,
  relation_content jsonb not null default '{}'::jsonb,
  effective_revision integer not null check (effective_revision > 0),
  result_input_type_master_record_id uuid not null,
  result_input_type_revision integer not null check (result_input_type_revision > 0),
  result_input_type_key text not null,
  result_input_type_value_kind text not null,
  result_input_type_supports_unit boolean not null,
  canonical_unit_master_record_id uuid,
  canonical_unit_revision integer check (canonical_unit_revision is null or canonical_unit_revision > 0),
  canonical_unit_key text,
  canonical_unit_code text,
  decimal_scale integer,
  content_sha256 text,
  created_at timestamptz not null default now(),
  primary key (release_id, owner_record_id),
  unique (release_id, master_key)
);
create table if not exists private.clinical_master_lab_panel_publish_stage (
  release_id uuid not null references master.master_releases(id) on delete restrict,
  owner_record_id uuid not null references master.master_records(id) on delete restrict,
  master_key text not null,
  included boolean not null,
  base_content jsonb not null,
  relation_content jsonb not null default '{}'::jsonb,
  effective_revision integer not null check (effective_revision > 0),
  content_sha256 text,
  created_at timestamptz not null default now(),
  primary key (release_id, owner_record_id),
  unique (release_id, master_key)
);
create table if not exists private.clinical_master_lab_order_publish_stage (
  release_id uuid not null references master.master_releases(id) on delete restrict,
  owner_record_id uuid not null references master.master_records(id) on delete restrict,
  master_key text not null,
  included boolean not null,
  base_content jsonb not null,
  relation_content jsonb not null default '{}'::jsonb,
  effective_revision integer not null check (effective_revision > 0),
  specimen_master_record_id uuid,
  specimen_revision integer check (specimen_revision is null or specimen_revision > 0),
  content_sha256 text,
  created_at timestamptz not null default now(),
  primary key (release_id, owner_record_id),
  unique (release_id, master_key)
);
revoke all on private.clinical_master_lab_vocabulary_publish_stage,
  private.clinical_master_lab_test_publish_stage,
  private.clinical_master_lab_panel_publish_stage,
  private.clinical_master_lab_order_publish_stage
  from public,anon,authenticated,service_role;

create or replace function private.clinical_master_lab_relation_content(
  p_payload jsonb,
  p_master_key text,
  p_record_type text
)
returns jsonb language sql stable set search_path = public, private, master, pg_catalog as $$
select coalesce(
  (
    select stage.relation_content
    from private.clinical_master_lab_publish_stage stage
    join master.master_releases release_row on release_row.id=stage.release_id
    where stage.master_key=pg_catalog.btrim(p_master_key)
    order by (release_row.status='publishing') desc,release_row.release_no desc,stage.created_at desc
    limit 1
  ),
  case when p_record_type='lab_panel' then
    pg_catalog.jsonb_build_object('labPanelItems',coalesce((select pg_catalog.jsonb_agg(value order by (value->>'sortOrder')::integer,value->>'testMasterKey') from pg_catalog.jsonb_array_elements(coalesce(p_payload->'labPanelItems','[]'::jsonb)) items(value) where pg_catalog.btrim(value->>'panelMasterKey')=pg_catalog.btrim(p_master_key)),'[]'::jsonb))
  when p_record_type='order' then
    pg_catalog.jsonb_build_object('labOrderProfiles',coalesce((select pg_catalog.jsonb_agg(value order by value->>'orderMasterKey') from pg_catalog.jsonb_array_elements(coalesce(p_payload->'labOrderProfiles','[]'::jsonb)) profiles(value) where pg_catalog.btrim(value->>'orderMasterKey')=pg_catalog.btrim(p_master_key)),'[]'::jsonb))
  else '{}'::jsonb end
)
$$;
revoke all on function private.clinical_master_lab_relation_content(jsonb,text,text) from public,anon,authenticated,service_role;

create or replace function private.clinical_master_lab_test_projection(
  p_master_record_id uuid,
  p_revision integer
)
returns jsonb language plpgsql security definer stable
set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_test_version record;
  v_detail jsonb;
  v_input_key text;
  v_unit_key text;
  v_input_snapshot jsonb;
  v_unit_snapshot jsonb;
  v_test_vocabulary jsonb;
  v_input_id uuid;
  v_input_revision integer;
  v_unit_id uuid;
  v_unit_revision integer;
  v_kind text;
  v_name text;
begin
  select version.snapshot,version.release_id into v_test_version
  from master.master_record_versions version
  where version.master_record_id=p_master_record_id and version.revision=p_revision;
  if not found then raise exception 'clinical_master_lab_test_version_missing'; end if;
  v_detail := v_test_version.snapshot->'detail';
  v_test_vocabulary := v_test_version.snapshot->'labTestVocabulary';
  v_input_key := nullif(pg_catalog.btrim(v_detail->>'resultInputTypeKey'),'');
  v_unit_key := nullif(pg_catalog.btrim(v_detail->>'canonicalUnitKey'),'');
  v_input_id := nullif(v_test_vocabulary->>'resultInputTypeMasterRecordId','')::uuid;
  v_input_revision := nullif(v_test_vocabulary->>'resultInputTypeRevision','')::integer;
  v_unit_id := nullif(v_test_vocabulary->>'canonicalUnitMasterRecordId','')::uuid;
  v_unit_revision := nullif(v_test_vocabulary->>'canonicalUnitRevision','')::integer;
  if v_input_id is not null and v_input_revision is not null then
    select version.snapshot into v_input_snapshot
    from master.master_records owner
    join master.master_record_versions version on version.master_record_id=owner.id
    where owner.id=v_input_id and owner.record_type='result_input_type'
      and version.revision=v_input_revision;
  end if;
  -- Legacy A1 test snapshots have no B1 vocabulary pin.  Resolve those only
  -- from the immutable source release, never from mutable current rows.
  if v_input_snapshot is null then
    select version.snapshot into v_input_snapshot
    from master.master_records owner
    join master.master_record_versions version on version.master_record_id=owner.id
    where owner.master_key=v_input_key and owner.record_type='result_input_type'
      and version.release_id=v_test_version.release_id
    order by version.revision desc limit 1;
  end if;
  if v_input_snapshot is null then
    select version.snapshot into v_input_snapshot
    from master.master_records owner
    join master.master_record_versions version on version.master_record_id=owner.id
    where owner.master_key=v_input_key and owner.record_type='result_input_type'
    order by version.revision desc limit 1;
  end if;
  if v_input_snapshot is null then raise exception 'clinical_master_lab_input_version_missing'; end if;
  if v_unit_key is not null then
    if v_unit_id is not null and v_unit_revision is not null then
      select version.snapshot into v_unit_snapshot
      from master.master_records owner
      join master.master_record_versions version on version.master_record_id=owner.id
      where owner.id=v_unit_id and owner.record_type='unit'
        and version.revision=v_unit_revision;
    end if;
    if v_unit_snapshot is null then
      select version.snapshot into v_unit_snapshot
      from master.master_records owner
      join master.master_record_versions version on version.master_record_id=owner.id
      where owner.master_key=v_unit_key and owner.record_type='unit'
        and version.release_id=v_test_version.release_id
      order by version.revision desc limit 1;
    end if;
    if v_unit_snapshot is null then
      select version.snapshot into v_unit_snapshot
      from master.master_records owner
      join master.master_record_versions version on version.master_record_id=owner.id
      where owner.master_key=v_unit_key and owner.record_type='unit'
      order by version.revision desc limit 1;
    end if;
    if v_unit_snapshot is null then raise exception 'clinical_master_lab_unit_version_missing'; end if;
  end if;
  v_kind := v_input_snapshot->'detail'->>'valueKind';
  if v_kind not in ('numeric','text','coded') then
    raise exception 'clinical_master_result_value_kind_invalid' using errcode='22023';
  end if;
  select value->>'name' into v_name
  from jsonb_array_elements(coalesce(v_test_version.snapshot->'names','[]'::jsonb)) names(value)
  where value->>'languageCode'='ko' and value->>'nameKind'='preferred'
  order by coalesce((value->>'sortOrder')::integer,0),value->>'name'
  limit 1;
  return jsonb_build_object(
    'masterRecordId',p_master_record_id,
    'masterRevision',p_revision,
    'testItemName',coalesce(v_name,v_detail->>'testCode'),
    'resultInputType',case v_kind when 'numeric' then 'number' when 'text' then 'text' when 'coded' then 'text' else null end,
    'resultValueKind',v_kind,
    'resultUnit',case when v_unit_snapshot is null then null else v_unit_snapshot->'detail'->>'symbol' end,
    'decimalScale',nullif(v_detail->>'decimalScale','')::integer
  );
end
$$;
revoke all on function private.clinical_master_lab_test_projection(uuid,integer) from public,anon,authenticated,service_role;

do $$
begin
  if to_regprocedure('private.clair_adopt_lab_master_projection_to_workspace(text,uuid)') is not null
     and to_regprocedure('private.clair_adopt_lab_master_projection_to_workspace_immutable_base(text,uuid)') is null then
    alter function private.clair_adopt_lab_master_projection_to_workspace(text,uuid)
      rename to clair_adopt_lab_master_projection_to_workspace_immutable_base;
  end if;
end
$$;

-- Adoption reads one immutable order version, then immutable panel/test
-- versions pinned by that order.  It never resolves the mutable current
-- master projection while creating a workspace item or link.
create or replace function private.clair_adopt_lab_master_projection_to_workspace_immutable_base(
  p_workspace_id text,
  p_release_id uuid
)
returns jsonb language plpgsql security definer
set search_path = public, private, master, extensions, pg_catalog as $$
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
  if p_workspace_id is null or pg_catalog.length(pg_catalog.btrim(p_workspace_id))=0 then raise exception 'workspace_id_required'; end if;
  if p_release_id is not null and not exists(select 1 from master.master_releases where id=p_release_id and status='published') then raise exception 'clinical_master_release_not_published'; end if;
  insert into public.lab_test_categories(id,workspace_id,category_name,sort_order)
  values('lab-category:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':unclassified','UTF8'),'sha256'),'hex')),p_workspace_id,'카테고리 미설정',2147483647)
  on conflict(workspace_id,id) do nothing;
  select id into v_category_id from public.lab_test_categories where workspace_id=p_workspace_id and id='lab-category:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':unclassified','UTF8'),'sha256'),'hex'));
  if v_category_id is null then raise exception 'deterministic_category_id_collision'; end if;

  for v_catalog in
    select c.* from public.order_catalog_items c
    where c.workspace_id=p_workspace_id and c.category_group='lab' and c.source_master_record_id is not null
    order by c.id for update
  loop
    v_source_revision := v_catalog.source_master_revision;
    select version.snapshot,owner.master_key into v_order_version
    from master.master_record_versions version
    join master.master_records owner on owner.id=version.master_record_id
    where version.master_record_id=v_catalog.source_master_record_id
      and version.revision=v_source_revision and owner.record_type='order';
    if not found then raise exception 'catalog_source_version_missing'; end if;
    v_order_key := v_order_version.master_key;
    select value into v_profile
    from jsonb_array_elements(coalesce(v_order_version.snapshot->'labOrderProfiles','[]'::jsonb)) profiles(value)
    where value->>'orderMasterKey'=v_order_key
    limit 1;
    if not found then continue; end if;
    v_panel_id := nullif(v_profile->>'labPanelMasterRecordId','')::uuid;
    v_panel_revision := nullif(v_profile->>'labPanelMasterRevision','')::integer;
    v_test_id := nullif(v_profile->>'labTestMasterRecordId','')::uuid;
    v_test_revision := nullif(v_profile->>'labTestMasterRevision','')::integer;
    if (v_panel_id is null) = (v_test_id is null) then raise exception 'clinical_master_lab_order_profile_target_exactly_one'; end if;
    v_members := '[]'::jsonb;
    if v_panel_id is not null then
      select version.snapshot into v_panel_version
      from master.master_record_versions version
      where version.master_record_id=v_panel_id and version.revision=v_panel_revision;
      if not found then raise exception 'catalog_source_panel_version_missing'; end if;
      for v_member in select value from jsonb_array_elements(coalesce(v_panel_version.snapshot->'labPanelItems','[]'::jsonb)) items(value) order by (value->>'sortOrder')::integer,value->>'testMasterKey' loop
        v_test_id := nullif(v_member->>'testMasterRecordId','')::uuid;
        v_test_revision := nullif(v_member->>'testMasterRevision','')::integer;
        if v_test_id is null or v_test_revision is null then raise exception 'catalog_source_panel_link_pin_missing'; end if;
        v_projection := private.clinical_master_lab_test_projection(v_test_id,v_test_revision);
        v_item_id := 'lab-item:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':' || v_test_id::text,'UTF8'),'sha256'),'hex'));
        insert into public.lab_test_items(id,workspace_id,category_id,test_item_name,result_input_type,result_unit,sort_order,availability_status,definition_origin,source_master_record_id,source_master_revision,result_value_kind,decimal_scale,workspace_result_revision,local_settings_revision,customization_state,source_projection_schema_version,source_projection_snapshot,source_projection_sha256,local_definition_snapshot,local_definition_sha256)
        values(v_item_id,p_workspace_id,v_category_id,v_projection->>'testItemName',v_projection->>'resultInputType',v_projection->>'resultUnit',(v_member->>'sortOrder')::integer,'active','clair_master',v_test_id,v_test_revision,v_projection->>'resultValueKind',nullif(v_projection->>'decimalScale','')::integer,1,1,'unmodified',1,jsonb_build_object('schemaVersion',1,'sourceMasterRecordId',v_test_id,'sourceMasterRevision',v_test_revision,'testItemName',v_projection->>'testItemName','resultInputType',v_projection->>'resultInputType','resultValueKind',v_projection->>'resultValueKind','resultUnit',v_projection->>'resultUnit','decimalScale',nullif(v_projection->>'decimalScale','')::integer),null,jsonb_build_object('schemaVersion',1,'testItemName',v_projection->>'testItemName','resultInputType',v_projection->>'resultInputType','resultValueKind',v_projection->>'resultValueKind','resultUnit',v_projection->>'resultUnit','decimalScale',nullif(v_projection->>'decimalScale','')::integer),null)
        on conflict(workspace_id,id) do nothing;
        update public.lab_test_items set source_projection_sha256=private.clinical_master_sha256(source_projection_snapshot),local_definition_sha256=private.clinical_master_sha256(local_definition_snapshot) where workspace_id=p_workspace_id and id=v_item_id;
        select coalesce(max(version_row.workspace_result_revision),0) into v_item_revision from public.lab_test_item_versions version_row where version_row.workspace_id=p_workspace_id and version_row.lab_test_item_id=v_item_id;
        if v_item_revision=0 then
          insert into public.lab_test_item_versions(workspace_id,lab_test_item_id,workspace_result_revision,test_item_name,result_input_type,result_value_kind,result_unit,decimal_scale,definition_origin,customization_state,source_master_record_id,source_master_revision,source_projection_schema_version,source_projection_snapshot,source_projection_sha256,local_definition_snapshot,local_definition_sha256)
          select item.workspace_id,item.id,item.workspace_result_revision,item.test_item_name,item.result_input_type,item.result_value_kind,item.result_unit,item.decimal_scale,'clair_master','unmodified',item.source_master_record_id,item.source_master_revision,item.source_projection_schema_version,item.source_projection_snapshot,item.source_projection_sha256,item.local_definition_snapshot,item.local_definition_sha256 from public.lab_test_items item where item.workspace_id=p_workspace_id and item.id=v_item_id;
          v_created_items := v_created_items + 1;
        end if;
        v_link_id := 'lab-link:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':' || v_catalog.id || ':' || v_item_id,'UTF8'),'sha256'),'hex'));
        v_snapshot := jsonb_build_object('schemaVersion',2,'linkOrigin','clair_master','profileKind','panel','workspaceCatalogItemId',v_catalog.id,'masterOrderRecordId',v_catalog.source_master_record_id,'masterOrderRevision',v_source_revision,'masterPanelRecordId',v_panel_id,'masterPanelRevision',v_panel_revision,'masterTestRecordId',v_test_id,'ownerPinnedSourceTestRevision',v_test_revision,'itemVersionSourceMasterRecordId',v_test_id,'itemVersionSourceTestRevision',v_test_revision,'labTestItemId',v_item_id,'pinnedWorkspaceResultRevision',1,'required',coalesce((v_member->>'required')::boolean,true),'displayGroup',nullif(v_member->>'displayGroup',''),'sourceOrdinal',(v_member->>'sortOrder')::integer,'effectiveSortOrder',(v_member->>'sortOrder')::integer);
        insert into public.order_catalog_lab_test_item_links(id,workspace_id,order_catalog_item_id,lab_test_item_id,sort_order,link_revision,link_origin,profile_kind,source_master_order_record_id,source_master_order_revision,source_master_panel_record_id,source_master_panel_revision,source_master_test_record_id,owner_pinned_source_test_revision,source_ordinal,effective_sort_order,pinned_workspace_result_revision,required,display_group,snapshot_metadata,snapshot_metadata_schema_version,snapshot_metadata_sha256)
        values(v_link_id,p_workspace_id,v_catalog.id,v_item_id,(v_member->>'sortOrder')::integer,1,'clair_master','panel',v_catalog.source_master_record_id,v_source_revision,v_panel_id,v_panel_revision,v_test_id,v_test_revision,(v_member->>'sortOrder')::integer,(v_member->>'sortOrder')::integer,1,coalesce((v_member->>'required')::boolean,true),nullif(v_member->>'displayGroup',''),v_snapshot,2,private.clinical_master_sha256(v_snapshot))
        on conflict(workspace_id,id) do nothing;
        v_members := v_members || jsonb_build_array(jsonb_build_object('linkOrigin','clair_master','profileKind','panel','sourceMasterTestRecordId',v_test_id,'ownerPinnedSourceTestRevision',v_test_revision,'itemVersionSourceMasterRecordId',v_test_id,'itemVersionSourceTestRevision',v_test_revision,'labTestItemId',v_item_id,'pinnedWorkspaceResultRevision',1,'sourceOrdinal',(v_member->>'sortOrder')::integer,'effectiveSortOrder',(v_member->>'sortOrder')::integer,'required',coalesce((v_member->>'required')::boolean,true),'displayGroup',nullif(v_member->>'displayGroup','')));
        v_created_links := v_created_links + 1;
      end loop;
    else
      v_projection := private.clinical_master_lab_test_projection(v_test_id,v_test_revision);
      v_item_id := 'lab-item:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':' || v_test_id::text,'UTF8'),'sha256'),'hex'));
      insert into public.lab_test_items(id,workspace_id,category_id,test_item_name,result_input_type,result_unit,sort_order,availability_status,definition_origin,source_master_record_id,source_master_revision,result_value_kind,decimal_scale,workspace_result_revision,local_settings_revision,customization_state,source_projection_schema_version,source_projection_snapshot,source_projection_sha256,local_definition_snapshot,local_definition_sha256)
      values(v_item_id,p_workspace_id,v_category_id,v_projection->>'testItemName',v_projection->>'resultInputType',v_projection->>'resultUnit',0,'active','clair_master',v_test_id,v_test_revision,v_projection->>'resultValueKind',nullif(v_projection->>'decimalScale','')::integer,1,1,'unmodified',1,jsonb_build_object('schemaVersion',1,'sourceMasterRecordId',v_test_id,'sourceMasterRevision',v_test_revision,'testItemName',v_projection->>'testItemName','resultInputType',v_projection->>'resultInputType','resultValueKind',v_projection->>'resultValueKind','resultUnit',v_projection->>'resultUnit','decimalScale',nullif(v_projection->>'decimalScale','')::integer),null,jsonb_build_object('schemaVersion',1,'testItemName',v_projection->>'testItemName','resultInputType',v_projection->>'resultInputType','resultValueKind',v_projection->>'resultValueKind','resultUnit',v_projection->>'resultUnit','decimalScale',nullif(v_projection->>'decimalScale','')::integer),null)
      on conflict(workspace_id,id) do nothing;
      update public.lab_test_items set source_projection_sha256=private.clinical_master_sha256(source_projection_snapshot),local_definition_sha256=private.clinical_master_sha256(local_definition_snapshot) where workspace_id=p_workspace_id and id=v_item_id;
      if not exists(select 1 from public.lab_test_item_versions where workspace_id=p_workspace_id and lab_test_item_id=v_item_id and workspace_result_revision=1) then
        insert into public.lab_test_item_versions(workspace_id,lab_test_item_id,workspace_result_revision,test_item_name,result_input_type,result_value_kind,result_unit,decimal_scale,definition_origin,customization_state,source_master_record_id,source_master_revision,source_projection_schema_version,source_projection_snapshot,source_projection_sha256,local_definition_snapshot,local_definition_sha256)
        select item.workspace_id,item.id,1,item.test_item_name,item.result_input_type,item.result_value_kind,item.result_unit,item.decimal_scale,'clair_master','unmodified',item.source_master_record_id,item.source_master_revision,item.source_projection_schema_version,item.source_projection_snapshot,item.source_projection_sha256,item.local_definition_snapshot,item.local_definition_sha256 from public.lab_test_items item where item.workspace_id=p_workspace_id and item.id=v_item_id;
        v_created_items := v_created_items + 1;
      end if;
      v_link_id := 'lab-link:v1:' || lower(encode(extensions.digest(convert_to(p_workspace_id || ':' || v_catalog.id || ':' || v_item_id,'UTF8'),'sha256'),'hex'));
      v_snapshot := jsonb_build_object('schemaVersion',2,'linkOrigin','clair_master','profileKind','standalone_test','workspaceCatalogItemId',v_catalog.id,'masterOrderRecordId',v_catalog.source_master_record_id,'masterOrderRevision',v_source_revision,'masterPanelRecordId',null,'masterPanelRevision',null,'masterTestRecordId',v_test_id,'ownerPinnedSourceTestRevision',v_test_revision,'itemVersionSourceMasterRecordId',v_test_id,'itemVersionSourceTestRevision',v_test_revision,'labTestItemId',v_item_id,'pinnedWorkspaceResultRevision',1,'required',true,'displayGroup',null,'sourceOrdinal',null,'effectiveSortOrder',0);
      insert into public.order_catalog_lab_test_item_links(id,workspace_id,order_catalog_item_id,lab_test_item_id,sort_order,link_revision,link_origin,profile_kind,source_master_order_record_id,source_master_order_revision,source_master_test_record_id,owner_pinned_source_test_revision,source_ordinal,effective_sort_order,pinned_workspace_result_revision,required,display_group,snapshot_metadata,snapshot_metadata_schema_version,snapshot_metadata_sha256)
      values(v_link_id,p_workspace_id,v_catalog.id,v_item_id,0,1,'clair_master','standalone_test',v_catalog.source_master_record_id,v_source_revision,v_test_id,v_test_revision,null,0,1,true,null,v_snapshot,2,private.clinical_master_sha256(v_snapshot)) on conflict(workspace_id,id) do nothing;
      v_members := jsonb_build_array(jsonb_build_object('linkOrigin','clair_master','profileKind','standalone_test','sourceMasterTestRecordId',v_test_id,'ownerPinnedSourceTestRevision',v_test_revision,'itemVersionSourceMasterRecordId',v_test_id,'itemVersionSourceTestRevision',v_test_revision,'labTestItemId',v_item_id,'pinnedWorkspaceResultRevision',1,'sourceOrdinal',null,'effectiveSortOrder',0,'required',true,'displayGroup',null));
      v_created_links := v_created_links + 1;
    end if;
    v_snapshot := jsonb_build_object('schemaVersion',1,'sourceMasterOrderRecordId',v_catalog.source_master_record_id,'sourceMasterOrderRevision',v_source_revision,'targetType',case when v_panel_id is not null then 'panel' else 'test' end,'sourceMasterPanelRecordId',v_panel_id,'sourceMasterPanelRevision',v_panel_revision,'members',v_members);
    update public.order_catalog_items set last_applied_lab_membership_projection_snapshot=v_snapshot,last_applied_lab_membership_projection_sha256=private.clinical_master_lab_membership_source_fingerprint(v_snapshot),last_applied_lab_membership_projection_schema_version=1 where workspace_id=p_workspace_id and id=v_catalog.id;
    v_catalogs := v_catalogs + 1;
  end loop;
  return jsonb_build_object('ok',true,'workspaceId',p_workspace_id,'releaseId',p_release_id,'catalogCount',v_catalogs,'createdItemCount',v_created_items,'createdLinkCount',v_created_links,'enforcedBy','clinical-master-lab-adoption-immutable');
end
$$;
revoke all on function private.clair_adopt_lab_master_projection_to_workspace(text,uuid) from public,anon,authenticated,service_role;
