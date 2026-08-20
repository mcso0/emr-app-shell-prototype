-- CLINICAL-MASTER-PR-002 / Phase 1A-2
-- Workspace adoption, source-lineage review, and admin CAS mutation boundary.
-- Synthetic/local Supabase only.  The private master publisher remains the
-- sole authority for canonical master records and fingerprints.

create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;

-- The fallback is a reviewed, type-specific path.  It is deliberately not a
-- name/source/price heuristic and is used only by synthetic seed/create paths.
create or replace function private.clinical_master_fallback_path_for_item_type(
  p_item_type text
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select path.id
  from master.classification_paths path
  join master.clinical_actions action_record
    on action_record.master_record_id = path.clinical_action_id
  join master.master_records action_master
    on action_master.id = action_record.master_record_id
  join master.chart_groups chart_record
    on chart_record.master_record_id = path.chart_group_id
  join master.task_routes route_record
    on route_record.master_record_id = path.task_route_id
  join master.master_records chart_master
    on chart_master.id = chart_record.master_record_id
  join master.master_records route_master
    on route_master.id = route_record.master_record_id
  where action_record.item_type = p_item_type
    and action_record.is_other_unclassified
    and path.retired_in_release_id is null
    and action_master.lifecycle_status = 'published'
    and action_master.safety_status = 'normal'
    and chart_master.lifecycle_status = 'published'
    and chart_master.safety_status = 'normal'
    and route_master.lifecycle_status = 'published'
    and route_master.safety_status = 'normal'
    and route_record.runtime_status = 'active'
  order by path.path_key
  limit 1;
$$;

revoke all on function private.clinical_master_fallback_path_for_item_type(text)
  from public, anon, authenticated, service_role;

create or replace function private.clinical_master_assign_fallback_path()
returns trigger
language plpgsql
security definer
set search_path = public, private, master, pg_temp
as $$
begin
  if new.classification_path_id is null then
    new.classification_path_id := private.clinical_master_fallback_path_for_item_type(new.category_group);
  end if;
  if new.classification_path_id is null then
    raise exception 'clinical_master_classification_fallback_missing:%', new.category_group
      using errcode = '23503';
  end if;
  return new;
end;
$$;

revoke all on function private.clinical_master_assign_fallback_path()
  from public, anon, authenticated, service_role;

alter table public.order_catalog_items
  add column if not exists origin_type text not null default 'workspace_custom',
  add column if not exists source_master_record_id uuid,
  add column if not exists source_master_revision integer,
  add column if not exists initial_imported_revision integer,
  add column if not exists last_auto_merged_revision integer,
  add column if not exists classification_path_id uuid,
  add column if not exists catalog_revision integer not null default 1,
  add column if not exists source_projection_snapshot jsonb,
  add column if not exists source_projection_fingerprint text;

alter table public.order_catalog_items
  alter column price_krw drop not null,
  alter column price_krw drop default;

-- The old staging checks are intentionally replaced, not layered beside the
-- Phase 1A-2 contract.
alter table public.order_catalog_items
  drop constraint if exists order_catalog_items_availability_status_check,
  drop constraint if exists order_catalog_items_price_krw_check,
  drop constraint if exists order_catalog_items_customization_state_check,
  drop constraint if exists order_catalog_items_preset_merge_status_check,
  drop constraint if exists order_catalog_items_origin_type_check,
  drop constraint if exists order_catalog_items_source_lineage_check,
  drop constraint if exists order_catalog_items_catalog_revision_check,
  drop constraint if exists order_catalog_items_source_projection_check,
  drop constraint if exists order_catalog_items_active_price_check;

alter table public.order_catalog_items
  add constraint order_catalog_items_origin_type_check
    check (origin_type in ('clair_master', 'workspace_custom')),
  add constraint order_catalog_items_source_lineage_check
    check (
      (origin_type = 'clair_master'
        and source_master_record_id is not null
        and source_master_revision is not null
        and source_master_revision > 0
        and initial_imported_revision is not null
        and initial_imported_revision > 0
        and source_projection_snapshot is not null
        and jsonb_typeof(source_projection_snapshot) = 'object'
        and source_projection_fingerprint is not null
        and source_projection_fingerprint ~ '^[0-9a-f]{64}$'
        and source_projection_fingerprint = lower(source_projection_fingerprint))
      or
      (origin_type = 'workspace_custom'
        and source_master_record_id is null
        and source_master_revision is null
        and initial_imported_revision is null
        and last_auto_merged_revision is null
        and source_projection_snapshot is null
        and source_projection_fingerprint is null)
    ),
  add constraint order_catalog_items_catalog_revision_check
    check (catalog_revision > 0),
  add constraint order_catalog_items_price_krw_check
    check (price_krw is null or price_krw >= 0),
  add constraint order_catalog_items_availability_status_check
    check (availability_status in ('pending_activation', 'active', 'paused', 'inactive')),
  add constraint order_catalog_items_preset_merge_status_check
    check (preset_merge_status in ('current', 'update_available', 'conflict', 'deprecated_source', 'detached')),
  add constraint order_catalog_items_source_projection_check
    check (source_projection_snapshot is null or jsonb_typeof(source_projection_snapshot) = 'object'),
  add constraint order_catalog_items_active_price_check
    check (not (availability_status = 'active' and billing_reflection_enabled and price_krw is null));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_catalog_items'::regclass
      and conname = 'order_catalog_items_workspace_id_id_key'
  ) then
    alter table public.order_catalog_items
      add constraint order_catalog_items_workspace_id_id_key unique (workspace_id, id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_catalog_items'::regclass
      and conname = 'order_catalog_items_source_master_record_fk'
  ) then
    alter table public.order_catalog_items
      add constraint order_catalog_items_source_master_record_fk
      foreign key (source_master_record_id)
      references master.master_records(id)
      on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_catalog_items'::regclass
      and conname = 'order_catalog_items_classification_path_fk'
  ) then
    alter table public.order_catalog_items
      add constraint order_catalog_items_classification_path_fk
      foreign key (classification_path_id)
      references master.classification_paths(id)
      on delete restrict;
  end if;
end;
$$;

create unique index if not exists order_catalog_items_workspace_source_key
  on public.order_catalog_items (workspace_id, source_master_record_id)
  where source_master_record_id is not null;
create index if not exists order_catalog_items_source_master_record_idx
  on public.order_catalog_items (source_master_record_id);
create index if not exists order_catalog_items_classification_path_idx
  on public.order_catalog_items (classification_path_id);
create index if not exists order_catalog_items_workspace_merge_status_idx
  on public.order_catalog_items (workspace_id, preset_merge_status);
create index if not exists order_catalog_items_workspace_status_idx
  on public.order_catalog_items (workspace_id, availability_status, category_group);

-- Install the deterministic fallback vocabulary before any populated-table
-- upgrade/backfill.  This is intentionally defined before the backfill block
-- so a forward upgrade does not depend on a prior seed invocation.
create or replace function private.clinical_master_seed_fallback_paths()
returns jsonb
language plpgsql
security definer
set search_path = public, private, master, pg_temp
as $$
declare
  v_source jsonb := jsonb_build_object(
    'sourceType', 'synthetic',
    'title', 'Phase 1A-2 reviewed fallback paths',
    'sourceVersion', 'phase1a2-fallback-v1'
  );
  v_records jsonb := '[]'::jsonb;
  v_paths jsonb := '[]'::jsonb;
  v_names jsonb;
  v_types text[] := array['consultation', 'medication', 'treatment', 'lab', 'imaging', 'hospitalization', 'misc'];
  v_group_codes text[] := array['CG_CONSULTATION', 'CG_MEDICATION_SUPPLY', 'CG_PROCEDURE', 'CG_EXAM', 'CG_EXAM', 'CG_INPATIENT', 'CG_EXAM'];
  v_route_codes text[] := array['NT_CHART_ONLY', 'NT_DISPENSING', 'NT_TREATMENT', 'NT_LAB', 'NT_IMAGING', 'NT_BILLING_ONLY', 'NT_CHART_ONLY'];
  v_destinations text[] := array['chart_only', 'dispensing', 'treatment', 'lab', 'imaging', 'billing_only', 'chart_only'];
  v_task_required boolean[] := array[false, true, true, true, true, false, false];
  v_result jsonb;
  i integer;
begin
  v_names := jsonb_build_array(
    jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', '진료'),
    jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'Clinical Care')
  );
  v_records := v_records || jsonb_build_array(jsonb_build_object(
    'masterKey', 'phase1a2.fallback.category.x', 'recordType', 'order_category',
    'names', v_names, 'source', v_source,
    'detail', jsonb_build_object('categoryCode', 'X_PHASE1A2', 'categoryLevel', 'X', 'sortOrder', 900)
  ));
  v_names := jsonb_build_array(
    jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', '기타 임상 주문'),
    jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'Other Clinical Orders')
  );
  v_records := v_records || jsonb_build_array(jsonb_build_object(
    'masterKey', 'phase1a2.fallback.category.t', 'recordType', 'order_category',
    'names', v_names, 'source', v_source,
    'detail', jsonb_build_object('categoryCode', 'T_PHASE1A2', 'categoryLevel', 'T', 'parentMasterKey', 'phase1a2.fallback.category.x', 'sortOrder', 900)
  ));
  for i in 1..7 loop
    v_names := jsonb_build_array(
      jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', v_types[i] || ' 기타'),
      jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', initcap(v_types[i]) || ' Other')
    );
    v_records := v_records || jsonb_build_array(jsonb_build_object(
      'masterKey', 'phase1a2.fallback.action.' || v_types[i], 'recordType', 'clinical_action',
      'names', v_names, 'source', v_source,
      'detail', jsonb_build_object('tCategoryKey', 'phase1a2.fallback.category.t', 'itemType', v_types[i], 'isOtherUnclassified', true)
    ));
    if i = 1 or not v_group_codes[i] = any(v_group_codes[1:i - 1]) then
      v_names := jsonb_build_array(
        jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', v_group_codes[i]),
        jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', v_group_codes[i])
      );
      v_records := v_records || jsonb_build_array(jsonb_build_object(
        'masterKey', 'phase1a2.fallback.chart.' || v_group_codes[i], 'recordType', 'chart_group',
        'names', v_names, 'source', v_source,
        'detail', jsonb_build_object('groupCode', v_group_codes[i], 'sortOrder', 900 + i)
      ));
    end if;
    if i = 1 or not v_route_codes[i] = any(v_route_codes[1:i - 1]) then
      v_names := jsonb_build_array(
        jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', v_route_codes[i]),
        jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', v_route_codes[i])
      );
      v_records := v_records || jsonb_build_array(jsonb_build_object(
        'masterKey', 'phase1a2.fallback.route.' || v_route_codes[i], 'recordType', 'task_route',
        'names', v_names, 'source', v_source,
        'detail', jsonb_build_object('routeCode', v_route_codes[i], 'destinationModule', v_destinations[i], 'taskRequired', v_task_required[i], 'runtimeStatus', 'active')
      ));
    end if;
    v_paths := v_paths || jsonb_build_array(jsonb_build_object(
      'pathKey', 'phase1a2.fallback.path.' || v_types[i],
      'clinicalActionKey', 'phase1a2.fallback.action.' || v_types[i],
      'chartGroupKey', 'phase1a2.fallback.chart.' || v_group_codes[i],
      'taskRouteKey', 'phase1a2.fallback.route.' || v_route_codes[i]
    ));
  end loop;
  v_names := jsonb_build_array(
    jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', '개'),
    jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'Dog')
  );
  v_records := v_records || jsonb_build_array(jsonb_build_object(
    'masterKey', 'phase1a2.fallback.species.dog', 'recordType', 'species', 'names', v_names,
    'source', v_source, 'detail', jsonb_build_object('speciesCode', 'dog')
  ));
  v_names := jsonb_build_array(
    jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', '고양이'),
    jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'Cat')
  );
  v_records := v_records || jsonb_build_array(jsonb_build_object(
    'masterKey', 'phase1a2.fallback.species.cat', 'recordType', 'species', 'names', v_names,
    'source', v_source, 'detail', jsonb_build_object('speciesCode', 'cat')
  ));
  v_names := jsonb_build_array(
    jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', '개'),
    jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'Each')
  );
  v_records := v_records || jsonb_build_array(jsonb_build_object(
    'masterKey', 'phase1a2.fallback.unit.each', 'recordType', 'unit', 'names', v_names,
    'source', v_source, 'detail', jsonb_build_object('unitCode', 'EA', 'symbol', 'ea', 'decimalScale', 0)
  ));
  v_result := private.publish_clinical_master_release(jsonb_build_object(
    'releaseKey', 'phase-1a-2-fallback-v1',
    'releaseNotes', 'Phase 1A-2 local reviewed fallback paths; non-authoritative.',
    'publishedByLabel', 'Phase 1A-2 synthetic seed',
    'records', v_records,
    'classificationPaths', v_paths
  ), null);
  return v_result;
end;
$$;

revoke all on function private.clinical_master_seed_fallback_paths()
  from public, anon, authenticated, service_role;

select private.clinical_master_seed_fallback_paths();

-- Backfill is explicit and conservative: only rows that have not received a
-- classification path yet are touched.  Reapplying this migration after an
-- adoption must never erase source lineage or rewrite an adopted row as local.
do $$
declare
  v_item record;
  v_path_id uuid;
  v_unresolved integer := 0;
begin
  for v_item in
    select id, category_group, origin_type, source_master_record_id
    from public.order_catalog_items
    where classification_path_id is null
    order by id
    for update
  loop
    if v_item.origin_type = 'clair_master' or v_item.source_master_record_id is not null then
      raise exception 'clinical_master_adopted_lineage_missing_classification:%', v_item.id
        using errcode = '23514';
    end if;
    v_path_id := private.clinical_master_fallback_path_for_item_type(v_item.category_group);
    if v_path_id is null then
      v_unresolved := v_unresolved + 1;
    else
      update public.order_catalog_items
      set origin_type = 'workspace_custom',
          classification_path_id = v_path_id,
          catalog_revision = greatest(coalesce(catalog_revision, 1), 1)
      where id = v_item.id;
    end if;
  end loop;
  if v_unresolved <> 0 then
    raise exception 'clinical_master_classification_fallback_unresolved:%', v_unresolved
      using errcode = '23514';
  end if;
  if exists (select 1 from public.order_catalog_items where classification_path_id is null) then
    raise exception 'clinical_master_classification_path_backfill_incomplete'
      using errcode = '23514';
  end if;
end;
$$;

alter table public.order_catalog_items
  alter column classification_path_id set not null,
  alter column origin_type set default 'workspace_custom',
  alter column catalog_revision set default 1;

drop trigger if exists order_catalog_items_fallback_path_assign on public.order_catalog_items;
create trigger order_catalog_items_fallback_path_assign
before insert on public.order_catalog_items
for each row execute function private.clinical_master_assign_fallback_path();

-- The old staging DML policies/grants are removed.  The table is still
-- readable to active same-workspace members, but writes are RPC/private-writer
-- only.
alter table public.order_catalog_items enable row level security;
drop policy if exists order_catalog_items_workspace_admin_insert on public.order_catalog_items;
drop policy if exists order_catalog_items_workspace_admin_update on public.order_catalog_items;
drop policy if exists order_catalog_items_workspace_admin_delete on public.order_catalog_items;
drop policy if exists order_catalog_items_workspace_member_write on public.order_catalog_items;
revoke insert, update, delete on public.order_catalog_items from authenticated;
grant select on public.order_catalog_items to authenticated;

create or replace function private.clinical_master_projection_fingerprint(p_projection jsonb)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_projection::text, 'UTF8'), 'sha256'),
    'hex'
  );
$$;

revoke all on function private.clinical_master_projection_fingerprint(jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.clinical_master_order_source_projection(
  p_master_record_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'masterRecordId', record_row.id,
    'masterKey', record_row.master_key,
    'recordType', record_row.record_type,
    'revision', record_row.current_revision,
    'lifecycleStatus', record_row.lifecycle_status,
    'safetyStatus', record_row.safety_status,
    'replacementRecordId', record_row.replacement_record_id,
    'names', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'languageCode', name_row.language_code,
          'nameKind', name_row.name_kind,
          'name', name_row.name,
          'sortOrder', name_row.sort_order
        ) order by name_row.language_code, name_row.name_kind, name_row.sort_order, name_row.id
      )
      from master.master_record_names name_row
      where name_row.master_record_id = record_row.id
        and name_row.name_kind in ('preferred', 'alias')
    ), '[]'::jsonb),
    'classification', (
      select pg_catalog.jsonb_build_object(
        'pathKey', path.path_key,
        'clinicalActionKey', action_record.master_key,
        'itemType', action.item_type,
        'isOtherUnclassified', action.is_other_unclassified,
        'chartGroupCode', chart.group_code,
        'taskRouteCode', route.route_code,
        'destinationModule', route.destination_module,
        'taskRequired', route.task_required,
        'runtimeStatus', route.runtime_status
      )
      from master.orders order_row
      join master.classification_paths path on path.id = order_row.classification_path_id
      join master.clinical_actions action on action.master_record_id = path.clinical_action_id
      join master.master_records action_record on action_record.id = action.master_record_id
      join master.chart_groups chart on chart.master_record_id = path.chart_group_id
      join master.task_routes route on route.master_record_id = path.task_route_id
      where order_row.master_record_id = record_row.id
    ),
    'order', (
      select pg_catalog.jsonb_build_object(
        'defaultSalesUnitCode', unit.unit_code,
        'defaultQuantity', order_row.default_quantity,
        'defaultBillingReflectionEnabled', order_row.default_billing_reflection_enabled,
        'species', coalesce((
          select pg_catalog.jsonb_agg(species.species_code order by species.species_code)
          from master.order_species_links link
          join master.species species on species.master_record_id = link.species_record_id
          where link.order_record_id = order_row.master_record_id
        ), '[]'::jsonb)
      )
      from master.orders order_row
      left join master.units unit on unit.master_record_id = order_row.default_sales_unit_id
      where order_row.master_record_id = record_row.id
    )
  )
  from master.master_records record_row
  where record_row.id = p_master_record_id;
$$;

revoke all on function private.clinical_master_order_source_projection(uuid)
  from public, anon, authenticated, service_role;

-- Existing notification storage is reused.  The new event/domain remain
-- visible only to active hospital administrators; source payloads stay label
-- and route-only, never a master/workspace snapshot.
alter table public.notification_events
  drop constraint if exists notification_events_event_key_check,
  drop constraint if exists notification_events_domain_check;
alter table public.notification_events
  add constraint notification_events_event_key_check check (
    event_key in (
      'order_urgent_handoff', 'order_recheck_requested',
      'assigned_order_completed', 'clinical_result_completed',
      'device_result_received', 'imaging_result_completed',
      'waiting_over_30m', 'dispensing_treatment_completed',
      'billing_waiting_ready', 'inpatient_care_delayed',
      'clinical_master_update_available'
    )
  ),
  add constraint notification_events_domain_check check (
    domain in (
      'reception', 'chart', 'lab', 'imaging', 'dispensing_treatment',
      'billing', 'inpatient', 'hospital_admin'
    )
  );

create or replace function private.clair_notification_active_role_ids_for_actor(
  p_workspace_id text
)
returns text[]
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select coalesce(array_agg(distinct role_id), array[]::text[])
  from public.user_memberships membership
  join public.users app_user on app_user.id = membership.user_id
  cross join lateral unnest(
    case
      when membership.roles @> array['hospital_admin']::text[] then
        array['hospital_admin', 'vet', 'lab', 'desk', 'billing', 'imaging',
          'dispensing_treatment', 'inpatient']::text[]
      when membership.roles @> array['technician']::text[] then
        array['lab', 'imaging', 'dispensing_treatment', 'inpatient']::text[]
      when membership.roles @> array['front_desk']::text[] then
        array['desk', 'billing']::text[]
      when membership.roles @> array['vet']::text[] then
        array['vet']::text[]
      else array[]::text[]
    end
  ) as role_id
  where membership.workspace_id = p_workspace_id
    and membership.user_id = auth.uid()
    and membership.status = 'active'
    and app_user.status = 'active';
$$;

create or replace function private.clair_notification_actor_can_view_domain(
  p_workspace_id text,
  p_domain text
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select case
    when p_domain = 'hospital_admin' then
      private.clair_notification_actor_has_any_role(
        p_workspace_id, array['hospital_admin']::text[])
    when p_domain = 'billing' then
      private.clair_notification_actor_has_any_role(
        p_workspace_id, array['hospital_admin', 'vet', 'technician', 'front_desk']::text[])
    when p_domain = 'reception' then
      private.clair_notification_actor_has_any_role(
        p_workspace_id, array['hospital_admin', 'vet', 'technician', 'front_desk']::text[])
    when p_domain in ('lab', 'imaging', 'dispensing_treatment') then
      private.clair_notification_actor_has_any_role(
        p_workspace_id, array['hospital_admin', 'vet', 'technician']::text[])
    when p_domain = 'chart' then
      private.clair_notification_actor_has_any_role(
        p_workspace_id, array['hospital_admin', 'vet', 'technician', 'front_desk']::text[])
    when p_domain = 'inpatient' then
      private.clair_notification_actor_has_any_role(
        p_workspace_id, array['hospital_admin', 'vet', 'technician']::text[])
    else false
  end;
$$;

create or replace function public.clair_emit_notification_event(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_event jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_action text;
  v_existing_id uuid;
  v_event_scope_id text;
  v_now timestamptz := now();
  v_saved_event public.notification_events;
  v_source jsonb;
  v_recipient jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing'; end if;
  if p_actor_user_id is null or p_actor_user_id <> auth.uid() then raise exception 'notification_actor_mismatch'; end if;
  if p_event is null or jsonb_typeof(p_event) <> 'object' then raise exception 'invalid_notification_event_payload'; end if;
  v_source := coalesce(p_event -> 'source', '{}'::jsonb);
  v_recipient := coalesce(p_event -> 'recipient', '{}'::jsonb);
  v_event_scope_id := private.clair_notification_scope_id(p_event ->> 'eventScopeId');
  if length(trim(coalesce(p_event ->> 'dedupeKey', ''))) = 0
    or length(trim(coalesce(p_event ->> 'eventKey', ''))) = 0
    or length(trim(coalesce(p_event ->> 'title', ''))) = 0
    or length(trim(coalesce(v_source ->> 'kind', ''))) = 0
    or length(trim(coalesce(v_recipient ->> 'kind', ''))) = 0
    or length(trim(coalesce(v_recipient ->> 'id', ''))) = 0 then
    raise exception 'invalid_notification_event_payload';
  end if;
  if coalesce(v_recipient ->> 'kind', '') not in ('user', 'active_role', 'role_queue') then raise exception 'invalid_notification_event_payload'; end if;
  if (v_recipient ->> 'kind') in ('active_role', 'role_queue')
    and (v_recipient ->> 'id') not in ('hospital_admin', 'vet', 'lab', 'desk', 'billing', 'imaging', 'dispensing_treatment', 'inpatient') then
    raise exception 'invalid_notification_event_payload';
  end if;
  if (p_event ->> 'eventKey') = 'clinical_master_update_available'
    and ((p_event ->> 'domain') <> 'hospital_admin' or (v_recipient ->> 'kind') <> 'active_role' or (v_recipient ->> 'id') <> 'hospital_admin' or (v_source ->> 'kind') <> 'fallback_detail') then
    raise exception 'invalid_notification_event_payload';
  end if;
  if (v_recipient ->> 'kind') = 'user'
    and not private.clair_notification_is_active_workspace_user(p_workspace_id, v_recipient ->> 'id') then
    raise exception 'invalid_notification_event_payload';
  end if;
  if nullif(v_source ->> 'route', '') is not null
    and ((v_source ->> 'route') not like ('/w/' || p_workspace_id || '/%')
      or position(chr(10) in (v_source ->> 'route')) > 0
      or position(chr(13) in (v_source ->> 'route')) > 0) then
    raise exception 'invalid_notification_event_payload';
  end if;
  if not private.clair_notification_actor_can_emit_event(p_workspace_id, p_event ->> 'eventKey', p_event ->> 'domain') then raise exception 'permission_missing'; end if;
  select id into v_existing_id from public.notification_events
  where workspace_id = p_workspace_id and event_scope_id = v_event_scope_id and dedupe_key = p_event ->> 'dedupeKey';
  insert into public.notification_events (
    workspace_id, notification_id, event_scope_id, event_key, dedupe_key, domain,
    priority, toast_policy, title, preview, detail, work_type_label, source_label,
    source_action_label, recipient_kind, recipient_id, recipient_label,
    recipient_payload, source_kind, source_entity_id, source_route, source_payload,
    fallback_reason, requires_action, badge_count, actor_user_id, issued_at_label,
    occurred_at, created_at, updated_at
  ) values (
    p_workspace_id,
    coalesce(nullif(trim(p_event ->> 'id'), ''), 'notif-db-' || replace(gen_random_uuid()::text, '-', '')),
    v_event_scope_id, p_event ->> 'eventKey', p_event ->> 'dedupeKey', p_event ->> 'domain',
    p_event ->> 'priority', coalesce(nullif(p_event ->> 'toastPolicy', ''), 'role_active'),
    p_event ->> 'title', p_event ->> 'preview', p_event ->> 'detail', p_event ->> 'workTypeLabel',
    p_event ->> 'sourceLabel', p_event ->> 'sourceActionLabel', v_recipient ->> 'kind', v_recipient ->> 'id',
    coalesce(nullif(v_recipient ->> 'label', ''), v_recipient ->> 'id'), v_recipient,
    v_source ->> 'kind', nullif(v_source ->> 'entity_id', ''), nullif(v_source ->> 'route', ''), v_source,
    nullif(p_event ->> 'fallbackReason', ''), coalesce((p_event ->> 'requiresAction')::boolean, true),
    coalesce((p_event ->> 'badgeCount')::boolean, true), p_actor_user_id,
    coalesce(nullif(p_event ->> 'issuedAtLabel', ''), '방금 전'),
    coalesce((nullif(p_event ->> 'occurredAt', ''))::timestamptz, v_now), v_now,
    coalesce((nullif(p_event ->> 'occurredAt', ''))::timestamptz, v_now)
  ) on conflict (workspace_id, event_scope_id, dedupe_key)
  do update set
    event_key = excluded.event_key, domain = excluded.domain, priority = excluded.priority,
    toast_policy = excluded.toast_policy, title = excluded.title, preview = excluded.preview,
    detail = excluded.detail, work_type_label = excluded.work_type_label, source_label = excluded.source_label,
    source_action_label = excluded.source_action_label, recipient_kind = excluded.recipient_kind,
    recipient_id = excluded.recipient_id, recipient_label = excluded.recipient_label,
    recipient_payload = excluded.recipient_payload, source_kind = excluded.source_kind,
    source_entity_id = excluded.source_entity_id, source_route = excluded.source_route,
    source_payload = excluded.source_payload, fallback_reason = excluded.fallback_reason,
    requires_action = excluded.requires_action, badge_count = excluded.badge_count,
    actor_user_id = excluded.actor_user_id, issued_at_label = excluded.issued_at_label,
    occurred_at = excluded.occurred_at, updated_at = excluded.updated_at,
    bump_count = public.notification_events.bump_count + 1
  returning * into v_saved_event;
  v_action := case when v_existing_id is null then 'created' else 'bumped' end;
  if v_action = 'bumped' then
    delete from public.notification_user_states where workspace_id = p_workspace_id and notification_id = v_saved_event.notification_id;
  end if;
  return jsonb_build_object('ok', true, 'status', 200, 'action', v_action,
    'notification', private.clair_notification_event_json(v_saved_event),
    'enforcedBy', 'notification-event-persistence');
end;
$$;

revoke all on function public.clair_emit_notification_event(text, uuid, jsonb)
  from public, anon, service_role;
grant execute on function public.clair_emit_notification_event(text, uuid, jsonb)
  to authenticated;

create table if not exists public.workspace_master_updates (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  release_id uuid not null references master.master_releases(id) on delete restrict,
  source_master_record_id uuid not null references master.master_records(id) on delete restrict,
  order_catalog_item_id text,
  update_type text not null check (update_type in ('new', 'changed', 'deprecated', 'replacement', 'emergency')),
  status text not null default 'pending' check (status in ('pending', 'auto_applied', 'accepted', 'dismissed', 'conflict')),
  previous_source_revision integer check (previous_source_revision is null or previous_source_revision > 0),
  source_revision integer not null check (source_revision > 0),
  changed_fields text[] not null default '{}',
  source_snapshot jsonb not null check (jsonb_typeof(source_snapshot) = 'object'),
  workspace_snapshot jsonb check (workspace_snapshot is null or jsonb_typeof(workspace_snapshot) = 'object'),
  resolved_by_user_id uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint workspace_master_updates_resolved_check check (
    (status in ('accepted', 'dismissed') and resolved_by_user_id is not null and resolved_at is not null)
    or (status not in ('accepted', 'dismissed') and resolved_by_user_id is null and resolved_at is null)
  ),
  constraint workspace_master_updates_workspace_item_fk
    foreign key (workspace_id, order_catalog_item_id)
    references public.order_catalog_items(workspace_id, id)
    on delete restrict,
  unique (workspace_id, release_id, source_master_record_id, update_type)
);

create index if not exists workspace_master_updates_review_queue_idx
  on public.workspace_master_updates (workspace_id, status, created_at desc);
create index if not exists workspace_master_updates_release_idx
  on public.workspace_master_updates (release_id);
create index if not exists workspace_master_updates_source_record_idx
  on public.workspace_master_updates (source_master_record_id);
create index if not exists workspace_master_updates_workspace_item_idx
  on public.workspace_master_updates (workspace_id, order_catalog_item_id)
  where order_catalog_item_id is not null;

alter table public.workspace_master_updates enable row level security;
revoke all on public.workspace_master_updates from public, anon, authenticated, service_role;
drop policy if exists workspace_master_updates_workspace_member_select on public.workspace_master_updates;
create policy workspace_master_updates_workspace_member_select
on public.workspace_master_updates
for select to authenticated
using (private.clair_is_active_workspace_member(workspace_id));
grant select on public.workspace_master_updates to authenticated;

create or replace function private.clinical_master_catalog_source_matches_snapshot(
  p_item public.order_catalog_items,
  p_snapshot jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, master, pg_temp
as $$
declare
  v_classification jsonb := coalesce(p_snapshot -> 'classification', '{}'::jsonb);
  v_order jsonb := coalesce(p_snapshot -> 'order', '{}'::jsonb);
  v_expected_species text[];
  v_actual_species text[];
  v_expected_aliases text[];
  v_actual_aliases text[];
  v_path_key text;
begin
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    return false;
  end if;
  select coalesce(array_agg(value ->> 'name' order by ordinality), '{}')
    into v_expected_aliases
  from jsonb_array_elements(coalesce(p_snapshot -> 'names', '[]'::jsonb)) with ordinality
  where value ->> 'nameKind' = 'alias';
  v_actual_aliases := coalesce(p_item.aliases, '{}');
  select coalesce(array_agg(value #>> '{}' order by value #>> '{}'), '{}')
    into v_expected_species
  from jsonb_array_elements(coalesce(v_order -> 'species', '[]'::jsonb));
  select coalesce(array_agg(species_code order by species_code), '{}')
    into v_actual_species
  from unnest(coalesce(p_item.target_species, '{}')) as species_code;
  select path_key into v_path_key
  from master.classification_paths
  where id = p_item.classification_path_id;

  return p_item.standard_order_id = coalesce(p_snapshot ->> 'masterKey', '')
    and p_item.category_group = coalesce(v_classification ->> 'itemType', '')
    and p_item.standard_order_name = coalesce((
      select value ->> 'name'
      from jsonb_array_elements(coalesce(p_snapshot -> 'names', '[]'::jsonb))
      where value ->> 'languageCode' = 'ko'
        and value ->> 'nameKind' = 'preferred'
      order by (value ->> 'sortOrder')::integer, value ->> 'name'
      limit 1
    ), '')
    and p_item.sales_unit = case v_order ->> 'defaultSalesUnitCode'
      when 'EA' then 'per_each' when 'DAY' then 'per_day' when 'ML' then 'per_ml' when 'KG' then 'per_kg'
      else coalesce(v_order ->> 'defaultSalesUnitCode', p_item.sales_unit)
    end
    and p_item.default_destination_module = case v_classification ->> 'destinationModule'
      when 'inpatient' then 'billing_only'
      else coalesce(v_classification ->> 'destinationModule', p_item.default_destination_module)
    end
    and p_item.default_task_required = coalesce((v_classification ->> 'taskRequired')::boolean, p_item.default_task_required)
    and p_item.billing_reflection_enabled = coalesce((v_order ->> 'defaultBillingReflectionEnabled')::boolean, p_item.billing_reflection_enabled)
    and v_path_key = v_classification ->> 'pathKey'
    and v_expected_aliases = v_actual_aliases
    and v_expected_species = v_actual_species;
end;
$$;

revoke all on function private.clinical_master_catalog_source_matches_snapshot(public.order_catalog_items, jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.clinical_master_workspace_snapshot(
  p_item public.order_catalog_items
)
returns jsonb
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select jsonb_build_object(
    'itemId', p_item.id,
    'catalogRevision', p_item.catalog_revision,
    'inHospitalOrderName', p_item.in_hospital_order_name,
    'billingName', p_item.billing_name,
    'aliases', to_jsonb(coalesce(p_item.aliases, '{}')),
    'availabilityStatus', p_item.availability_status,
    'priceKrw', p_item.price_krw,
    'salesUnit', p_item.sales_unit,
    'billingReflectionEnabled', p_item.billing_reflection_enabled,
    'careGuide', p_item.care_guide,
    'careGuideDeliveryEnabled', p_item.care_guide_delivery_enabled,
    'internalInstruction', p_item.internal_instruction,
    'internalInstructionDeliveryEnabled', p_item.internal_instruction_delivery_enabled,
    'taxIncluded', p_item.tax_included,
    'roundingRule', p_item.rounding_rule,
    'pricingRule', p_item.pricing_rule,
    'medicationMetadata', p_item.medication_metadata,
    'vaccineMetadata', p_item.vaccine_metadata
  );
$$;

revoke all on function private.clinical_master_workspace_snapshot(public.order_catalog_items)
  from public, anon, authenticated, service_role;

create or replace function private.clinical_master_emit_update_notification(
  p_workspace_id text,
  p_update_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_route text := '/w/' || p_workspace_id || '/hospital-admin/order-catalog?update=' || p_update_id::text;
begin
  insert into public.notification_events (
    workspace_id, notification_id, event_scope_id, event_key, dedupe_key,
    domain, priority, toast_policy, title, preview, detail, work_type_label,
    source_label, source_action_label, recipient_kind, recipient_id,
    recipient_label, recipient_payload, source_kind, source_entity_id,
    source_route, source_payload, fallback_reason, requires_action, badge_count,
    actor_user_id, issued_at_label, occurred_at, created_at, updated_at
  )
  select
    update_row.workspace_id,
    'notif-clinical-master-' || update_row.id::text,
    '',
    'clinical_master_update_available',
    'clinical-master-update:' || update_row.id::text,
    'hospital_admin', 'normal', 'role_active',
    '임상 마스터 업데이트 검토',
    case update_row.update_type
      when 'new' then '새 임상 마스터 주문을 검토해 주세요.'
      when 'deprecated' then '사용 중인 임상 마스터 주문의 폐기 상태를 검토해 주세요.'
      when 'replacement' then '임상 마스터 주문의 대체 관계를 검토해 주세요.'
      else '임상 마스터 주문 업데이트를 검토해 주세요.'
    end,
    'workspace_master_updates 검토 큐에서 변경 내용을 확인할 수 있습니다.',
    '임상 마스터 업데이트', '임상 마스터', '검토 필요', 'active_role', 'hospital_admin',
    '병원 관리자', jsonb_build_object('kind', 'active_role', 'id', 'hospital_admin'),
    'fallback_detail', update_row.id::text, v_route,
    jsonb_build_object('kind', 'fallback_detail', 'entity_id', update_row.id::text, 'route', v_route),
    'missing_source', true, true, null, '방금 전', now(), now(), now()
  from public.workspace_master_updates update_row
  where update_row.id = p_update_id
  on conflict (workspace_id, event_scope_id, dedupe_key) do nothing;
end;
$$;

revoke all on function private.clinical_master_emit_update_notification(text, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.clair_adopt_master_release_to_workspace(
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
  v_existing_update public.workspace_master_updates%rowtype;
  v_update_id uuid;
  v_standard_name text;
  v_aliases text[];
  v_species text[];
  v_source_revision integer;
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

  -- This order is part of the concurrency contract.  Do not move the
  -- workspace lock before the A1 publication lock.
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
  if exists (
    select 1 from master.master_releases newer
    where newer.status = 'published' and newer.release_no > v_release.release_no
  ) then
    raise exception 'clinical_master_release_not_latest' using errcode = '40001';
  end if;

  -- Lock every existing row before source upserts, in stable row-ID order.
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
    order by record_row.master_key
    for update of record_row, order_row
  loop
    select * into v_path
    from master.classification_paths
    where id = v_source.source_path_id
    for update;
    select * into v_action from master.clinical_actions where master_record_id = v_path.clinical_action_id;
    select * into v_chart from master.chart_groups where master_record_id = v_path.chart_group_id;
    select * into v_route from master.task_routes where master_record_id = v_path.task_route_id;
    v_projection := private.clinical_master_order_source_projection(v_source.id);
    v_fingerprint := private.clinical_master_projection_fingerprint(v_projection);
    v_source_revision := v_source.current_revision;
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
        case v_source.default_sales_unit_code when 'EA' then 'per_each' when 'DAY' then 'per_day' when 'ML' then 'per_ml' when 'KG' then 'per_kg' else 'per_each' end, v_species,
        case v_route.destination_module when 'inpatient' then 'billing_only' else v_route.destination_module end,
        v_route.task_required, v_source.default_billing_reflection_enabled,
        false, false, true, 'as_is',
        jsonb_build_object('priceBasis', 'fixed_order_price', 'priceKrw', null,
          'salesUnit', case v_source.default_sales_unit_code when 'EA' then 'per_each' when 'DAY' then 'per_day' when 'ML' then 'per_ml' when 'KG' then 'per_kg' else 'per_each' end,
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
            sales_unit = case v_source.default_sales_unit_code when 'EA' then 'per_each' when 'DAY' then 'per_day' when 'ML' then 'per_ml' when 'KG' then 'per_kg' else sales_unit end,
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

  return jsonb_build_object(
    'ok', true, 'workspaceId', p_workspace_id, 'releaseId', p_release_id,
    'createdCount', v_created, 'autoAppliedCount', v_auto_applied,
    'reviewCount', v_reviews, 'notificationCount', v_notifications,
    'enforcedBy', 'clinical-master-workspace-adoption'
  );
end;
$$;

revoke all on function private.clair_adopt_master_release_to_workspace(text, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.clair_update_order_catalog_item(
  p_workspace_id text,
  p_item_id text,
  p_expected_catalog_revision integer,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_item public.order_catalog_items%rowtype;
  v_next public.order_catalog_items%rowtype;
  v_key text;
  v_changed_fields text[] := '{}';
  v_known_keys text[] := array[
    'inHospitalOrderName', 'billingName', 'aliases', 'availabilityStatus',
    'priceKrw', 'salesUnit', 'targetSpecies', 'billingReflectionEnabled',
    'careGuide', 'careGuideDeliveryEnabled', 'internalInstruction',
    'internalInstructionDeliveryEnabled', 'taxIncluded', 'roundingRule',
    'pricingRule', 'medicationMetadata', 'vaccineMetadata',
    'in_hospital_order_name', 'billing_name', 'availability_status',
    'price_krw', 'sales_unit', 'target_species', 'billing_reflection_enabled',
    'care_guide', 'care_guide_delivery_enabled', 'internal_instruction',
    'internal_instruction_delivery_enabled', 'tax_included', 'rounding_rule',
    'pricing_rule', 'medication_metadata', 'vaccine_metadata'
  ];
  v_protected_keys text[] := array[
    'id', 'workspaceId', 'workspace_id', 'standardOrderId', 'standard_order_id',
    'sourcePresetVersion', 'source_preset_version', 'initialImportedPresetVersion',
    'initial_imported_preset_version', 'lastAutoMergedPresetVersion',
    'last_auto_merged_preset_version', 'customizationState', 'customization_state',
    'customizedFields', 'customized_fields', 'presetMergeStatus', 'preset_merge_status',
    'originType', 'origin_type', 'sourceMasterRecordId', 'source_master_record_id',
    'sourceMasterRevision', 'source_master_revision', 'initialImportedRevision',
    'initial_imported_revision', 'lastAutoMergedRevision', 'last_auto_merged_revision',
    'classificationPathId', 'classification_path_id', 'catalogRevision', 'catalog_revision',
    'sourceProjectionSnapshot', 'source_projection_snapshot',
    'sourceProjectionFingerprint', 'source_projection_fingerprint',
    'categoryGroup', 'category_group', 'categoryLabel', 'category_label', 'tCode',
    't_code', 'tCodeLabel', 't_code_label', 'standardOrderName', 'standard_order_name',
    'defaultDestinationModule', 'default_destination_module', 'defaultTaskRequired',
    'default_task_required', 'updatedAt', 'updated_at'
  ];
  v_has_price boolean := false;
  v_has_availability boolean := false;
  v_new_availability text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'catalog_patch_object_required' using errcode = '22023';
  end if;
  if p_expected_catalog_revision is null or p_expected_catalog_revision <= 0 then
    raise exception 'catalog_revision_required' using errcode = '22023';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'workspace_admin_required' using errcode = '42501';
  end if;

  select * into v_item
  from public.order_catalog_items
  where workspace_id = p_workspace_id and id = p_item_id
  for update;
  if not found then
    raise exception 'order_catalog_item_not_found' using errcode = 'P0002';
  end if;
  if v_item.catalog_revision <> p_expected_catalog_revision then
    raise exception 'catalog_revision_conflict' using errcode = '40001';
  end if;

  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key = any(v_protected_keys) then
      raise exception 'catalog_protected_field_rejected:%', v_key using errcode = '42501';
    end if;
    if not v_key = any(v_known_keys) then
      raise exception 'catalog_patch_field_rejected:%', v_key using errcode = '22023';
    end if;
    v_changed_fields := array_append(v_changed_fields, v_key);
  end loop;

  v_next := v_item;
  if p_patch ? 'inHospitalOrderName' or p_patch ? 'in_hospital_order_name' then
    v_next.in_hospital_order_name := coalesce(p_patch ->> 'inHospitalOrderName', p_patch ->> 'in_hospital_order_name');
  end if;
  if p_patch ? 'billingName' or p_patch ? 'billing_name' then
    v_next.billing_name := coalesce(p_patch ->> 'billingName', p_patch ->> 'billing_name');
  end if;
  if p_patch ? 'aliases' then
    if jsonb_typeof(p_patch -> 'aliases') <> 'array' then raise exception 'catalog_aliases_array_required' using errcode = '22023'; end if;
    select coalesce(array_agg(value #>> '{}' order by ordinality), '{}') into v_next.aliases
    from jsonb_array_elements(p_patch -> 'aliases') with ordinality;
  elsif p_patch ? 'aliases' then
    v_next.aliases := '{}';
  end if;
  if p_patch ? 'targetSpecies' then
    if jsonb_typeof(p_patch -> 'targetSpecies') <> 'array' then raise exception 'catalog_species_array_required' using errcode = '22023'; end if;
    select coalesce(array_agg(value #>> '{}' order by ordinality), '{}') into v_next.target_species
    from jsonb_array_elements(p_patch -> 'targetSpecies') with ordinality;
  elsif p_patch ? 'target_species' then
    if jsonb_typeof(p_patch -> 'target_species') <> 'array' then raise exception 'catalog_species_array_required' using errcode = '22023'; end if;
    select coalesce(array_agg(value #>> '{}' order by ordinality), '{}') into v_next.target_species
    from jsonb_array_elements(p_patch -> 'target_species') with ordinality;
  end if;
  if p_patch ? 'availabilityStatus' or p_patch ? 'availability_status' then
    v_has_availability := true;
    v_new_availability := coalesce(p_patch ->> 'availabilityStatus', p_patch ->> 'availability_status');
    v_next.availability_status := v_new_availability;
  end if;
  if p_patch ? 'priceKrw' or p_patch ? 'price_krw' then
    v_has_price := true;
    v_next.price_krw := case
      when coalesce(p_patch ->> 'priceKrw', p_patch ->> 'price_krw') is null then null
      else (coalesce(p_patch ->> 'priceKrw', p_patch ->> 'price_krw'))::integer
    end;
  end if;
  if p_patch ? 'salesUnit' or p_patch ? 'sales_unit' then v_next.sales_unit := coalesce(p_patch ->> 'salesUnit', p_patch ->> 'sales_unit'); end if;
  if p_patch ? 'billingReflectionEnabled' or p_patch ? 'billing_reflection_enabled' then v_next.billing_reflection_enabled := coalesce((p_patch ->> 'billingReflectionEnabled')::boolean, (p_patch ->> 'billing_reflection_enabled')::boolean); end if;
  if p_patch ? 'careGuide' or p_patch ? 'care_guide' then v_next.care_guide := coalesce(p_patch ->> 'careGuide', p_patch ->> 'care_guide'); end if;
  if p_patch ? 'careGuideDeliveryEnabled' or p_patch ? 'care_guide_delivery_enabled' then v_next.care_guide_delivery_enabled := coalesce((p_patch ->> 'careGuideDeliveryEnabled')::boolean, (p_patch ->> 'care_guide_delivery_enabled')::boolean); end if;
  if p_patch ? 'internalInstruction' or p_patch ? 'internal_instruction' then v_next.internal_instruction := coalesce(p_patch ->> 'internalInstruction', p_patch ->> 'internal_instruction'); end if;
  if p_patch ? 'internalInstructionDeliveryEnabled' or p_patch ? 'internal_instruction_delivery_enabled' then v_next.internal_instruction_delivery_enabled := coalesce((p_patch ->> 'internalInstructionDeliveryEnabled')::boolean, (p_patch ->> 'internal_instruction_delivery_enabled')::boolean); end if;
  if p_patch ? 'taxIncluded' or p_patch ? 'tax_included' then v_next.tax_included := coalesce((p_patch ->> 'taxIncluded')::boolean, (p_patch ->> 'tax_included')::boolean); end if;
  if p_patch ? 'roundingRule' or p_patch ? 'rounding_rule' then v_next.rounding_rule := coalesce(p_patch ->> 'roundingRule', p_patch ->> 'rounding_rule'); end if;
  if p_patch ? 'pricingRule' or p_patch ? 'pricing_rule' then
    v_next.pricing_rule := coalesce(p_patch -> 'pricingRule', p_patch -> 'pricing_rule');
    if jsonb_typeof(v_next.pricing_rule) <> 'object' then raise exception 'catalog_pricing_rule_object_required' using errcode = '22023'; end if;
  end if;
  if p_patch ? 'medicationMetadata' or p_patch ? 'medication_metadata' then v_next.medication_metadata := coalesce(p_patch -> 'medicationMetadata', p_patch -> 'medication_metadata'); end if;
  if p_patch ? 'vaccineMetadata' or p_patch ? 'vaccine_metadata' then v_next.vaccine_metadata := coalesce(p_patch -> 'vaccineMetadata', p_patch -> 'vaccine_metadata'); end if;

  if v_next.availability_status not in ('pending_activation', 'active', 'paused', 'inactive') then
    raise exception 'catalog_availability_invalid' using errcode = '22023';
  end if;
  if v_next.price_krw is not null and v_next.price_krw < 0 then
    raise exception 'catalog_price_invalid' using errcode = '22023';
  end if;
  if v_next.availability_status = 'active'
    and v_item.origin_type = 'clair_master'
    and not exists (
      select 1
      from public.workspace_master_updates accepted_new
      where accepted_new.workspace_id = p_workspace_id
        and accepted_new.order_catalog_item_id = v_item.id
        and accepted_new.source_master_record_id = v_item.source_master_record_id
        and accepted_new.update_type = 'new'
        and accepted_new.status = 'accepted'
    ) then
    raise exception 'pending_activation_requires_accepted_review' using errcode = '42501';
  end if;
  if v_next.availability_status = 'active'
    and v_next.billing_reflection_enabled
    and v_next.price_krw is null then
    raise exception 'active_billable_price_required' using errcode = '23514';
  end if;
  if v_next.pricing_rule ? 'priceKrw' then
    v_next.pricing_rule := jsonb_set(v_next.pricing_rule, '{priceKrw}', to_jsonb(v_next.price_krw), true);
  end if;

  v_next.catalog_revision := v_item.catalog_revision + 1;
  v_next.customization_state := case when v_item.customization_state = 'detached' then 'detached' else 'customized' end;
  select coalesce(array_agg(distinct field_name order by field_name), '{}') into v_next.customized_fields
  from unnest(coalesce(v_item.customized_fields, '{}') || v_changed_fields) as field_name;
  v_next.last_customized_at := now();
  v_next.last_customized_by_user_id := auth.uid()::text;
  v_next.updated_at := now();

  update public.order_catalog_items
  set in_hospital_order_name = v_next.in_hospital_order_name,
      billing_name = v_next.billing_name,
      aliases = v_next.aliases,
      availability_status = v_next.availability_status,
      price_krw = v_next.price_krw,
      sales_unit = v_next.sales_unit,
      target_species = v_next.target_species,
      billing_reflection_enabled = v_next.billing_reflection_enabled,
      care_guide = v_next.care_guide,
      care_guide_delivery_enabled = v_next.care_guide_delivery_enabled,
      internal_instruction = v_next.internal_instruction,
      internal_instruction_delivery_enabled = v_next.internal_instruction_delivery_enabled,
      tax_included = v_next.tax_included,
      rounding_rule = v_next.rounding_rule,
      pricing_rule = v_next.pricing_rule,
      medication_metadata = v_next.medication_metadata,
      vaccine_metadata = v_next.vaccine_metadata,
      catalog_revision = v_next.catalog_revision,
      customization_state = v_next.customization_state,
      customized_fields = v_next.customized_fields,
      last_customized_at = v_next.last_customized_at,
      last_customized_by_user_id = v_next.last_customized_by_user_id,
      updated_at = v_next.updated_at
  where workspace_id = p_workspace_id and id = p_item_id;

  return jsonb_build_object(
    'ok', true, 'status', 200, 'item', to_jsonb(v_next),
    'enforcedBy', 'clair_update_order_catalog_item'
  );
end;
$$;

revoke all on function public.clair_update_order_catalog_item(text, text, integer, jsonb)
  from public, anon, service_role;
grant execute on function public.clair_update_order_catalog_item(text, text, integer, jsonb)
  to authenticated;

-- Compatibility writer for the existing hospital-admin "create custom item"
-- flow.  It is explicit workspace_custom data and uses the reviewed fallback
-- mapping; it never accepts client-supplied master lineage.
-- Compatibility writer for the existing hospital-admin "create custom item"
-- flow.  It is explicit workspace_custom data.  Classification projections
-- are derived from a trusted active master path; only scalar workspace-owned
-- fields are accepted from the caller.
create or replace function public.clair_create_order_catalog_item(
  p_workspace_id text,
  p_item jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, master, extensions, pg_temp
as $$
declare
  v_item public.order_catalog_items%rowtype;
  v_id text := coalesce(nullif(trim(p_item ->> 'id'), ''), 'ord-' || replace(extensions.gen_random_uuid()::text, '-', ''));
  v_requested_category text := coalesce(p_item ->> 'categoryGroup', p_item ->> 'category_group');
  v_category text;
  v_path_id uuid;
  v_requested_path_id text := nullif(coalesce(p_item ->> 'classificationPathId', p_item ->> 'classification_path_id'), '');
  v_path master.classification_paths%rowtype;
  v_action master.clinical_actions%rowtype;
  v_chart master.chart_groups%rowtype;
  v_route master.task_routes%rowtype;
  v_t_category master.order_categories%rowtype;
  v_t_category_record master.master_records%rowtype;
  v_t_code_label text;
  v_price integer;
  v_sales_unit text := coalesce(p_item ->> 'salesUnit', p_item ->> 'sales_unit', 'per_each');
  v_target_species text[];
  v_tax_included boolean := coalesce((p_item ->> 'taxIncluded')::boolean, (p_item ->> 'tax_included')::boolean, true);
  v_rounding_rule text := coalesce(p_item ->> 'roundingRule', p_item ->> 'rounding_rule', 'as_is');
  v_availability text := coalesce(p_item ->> 'availabilityStatus', p_item ->> 'availability_status', 'active');
  v_billing boolean := coalesce((p_item ->> 'billingReflectionEnabled')::boolean, (p_item ->> 'billing_reflection_enabled')::boolean, true);
  v_pricing jsonb;
  v_source_key text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_item is null or jsonb_typeof(p_item) <> 'object' then raise exception 'catalog_item_object_required' using errcode = '22023'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'workspace_admin_required' using errcode = '42501';
  end if;
  if p_item ? 'originType' or p_item ? 'origin_type'
    or p_item ? 'sourceMasterRecordId' or p_item ? 'source_master_record_id'
    or p_item ? 'sourceMasterRevision' or p_item ? 'source_master_revision'
    or p_item ? 'initialImportedRevision' or p_item ? 'initial_imported_revision'
    or p_item ? 'lastAutoMergedRevision' or p_item ? 'last_auto_merged_revision'
    or p_item ? 'sourceProjectionSnapshot' or p_item ? 'source_projection_snapshot'
    or p_item ? 'sourceProjectionFingerprint' or p_item ? 'source_projection_fingerprint'
    or p_item ? 'catalogRevision' or p_item ? 'catalog_revision'
    or p_item ? 'customizationState' or p_item ? 'customization_state'
    or p_item ? 'customizedFields' or p_item ? 'customized_fields'
    or p_item ? 'presetMergeStatus' or p_item ? 'preset_merge_status' then
    raise exception 'catalog_lineage_client_write_rejected' using errcode = '42501';
  end if;

  if v_requested_path_id is not null then
    begin
      v_path_id := v_requested_path_id::uuid;
    exception when invalid_text_representation then
      raise exception 'catalog_classification_path_invalid' using errcode = '22023';
    end;
    select * into v_path
    from master.classification_paths
    where id = v_path_id and retired_in_release_id is null
    for update;
  else
    if v_requested_category not in ('consultation', 'medication', 'treatment', 'lab', 'imaging', 'hospitalization', 'misc') then
      raise exception 'catalog_category_invalid' using errcode = '22023';
    end if;
    v_path_id := private.clinical_master_fallback_path_for_item_type(v_requested_category);
    select * into v_path
    from master.classification_paths
    where id = v_path_id
    for update;
  end if;
  if not found or v_path.retired_in_release_id is not null then
    raise exception 'clinical_master_classification_fallback_missing' using errcode = '23503';
  end if;

  select * into v_action from master.clinical_actions where master_record_id = v_path.clinical_action_id;
  select * into v_chart from master.chart_groups where master_record_id = v_path.chart_group_id;
  select * into v_route from master.task_routes where master_record_id = v_path.task_route_id;
  select * into v_t_category from master.order_categories where master_record_id = v_action.t_category_id;
  select * into v_t_category_record from master.master_records where id = v_action.t_category_id;
  if v_route.runtime_status <> 'active' then
    raise exception 'clinical_master_held_task_route_rejected' using errcode = '23514';
  end if;
  if v_action.item_type is null or v_chart.group_code is null or v_route.destination_module is null then
    raise exception 'clinical_master_classification_path_unusable' using errcode = '23503';
  end if;
  v_category := v_action.item_type;
  v_t_code_label := coalesce((
    select name_row.name
    from master.master_record_names name_row
    where name_row.master_record_id = v_t_category_record.id
      and name_row.language_code = 'ko'
      and name_row.name_kind = 'preferred'
    order by name_row.sort_order, name_row.id
    limit 1
  ), v_t_category.category_code);

  if p_item ? 'targetSpecies' and jsonb_typeof(p_item -> 'targetSpecies') <> 'array'
    or p_item ? 'target_species' and jsonb_typeof(p_item -> 'target_species') <> 'array' then
    raise exception 'catalog_species_array_required' using errcode = '22023';
  end if;
  v_target_species := coalesce(
    array(select value #>> '{}' from jsonb_array_elements(coalesce(p_item -> 'targetSpecies', p_item -> 'target_species', '["dog","cat"]'::jsonb))),
    '{dog,cat}'
  );
  if exists (select 1 from unnest(v_target_species) species_code where species_code not in ('dog', 'cat', 'other')) then
    raise exception 'catalog_species_invalid' using errcode = '22023';
  end if;
  if v_sales_unit not in ('per_order', 'per_each', 'per_day', 'per_frequency', 'per_ml', 'per_kg') then
    raise exception 'catalog_sales_unit_invalid' using errcode = '22023';
  end if;
  if v_availability not in ('pending_activation', 'active', 'paused', 'inactive') then
    raise exception 'catalog_availability_invalid' using errcode = '22023';
  end if;
  v_price := case
    when coalesce(p_item ->> 'priceKrw', p_item ->> 'price_krw') is null then null
    else (coalesce(p_item ->> 'priceKrw', p_item ->> 'price_krw'))::integer
  end;
  if v_price is not null and v_price < 0 then raise exception 'catalog_price_invalid' using errcode = '22023'; end if;
  if v_availability = 'active' and v_billing and v_price is null then
    raise exception 'active_billable_price_required' using errcode = '23514';
  end if;

  -- Do not persist an arbitrary client JSON object.  The pricing projection is
  -- normalized only from scalar workspace-owned values.
  v_pricing := jsonb_build_object(
    'priceBasis', case when v_sales_unit = 'per_day' then 'unit_price' else 'fixed_order_price' end,
    'priceKrw', v_price,
    'salesUnit', v_sales_unit,
    'taxIncluded', v_tax_included,
    'roundingRule', v_rounding_rule,
    'billingReflectionEnabled', v_billing
  );
  v_source_key := coalesce(nullif(trim(p_item ->> 'standardOrderId'), ''), nullif(trim(p_item ->> 'standard_order_id'), ''), v_id);

  insert into public.order_catalog_items (
    id, workspace_id, standard_order_id, source_preset_version,
    initial_imported_preset_version, last_auto_merged_preset_version,
    customization_state, customized_fields, last_customized_at, last_customized_by_user_id,
    preset_merge_status, category_group, category_label, t_code, t_code_label,
    standard_order_name, in_hospital_order_name, billing_name, aliases,
    availability_status, price_krw, sales_unit, target_species,
    default_destination_module, default_task_required, billing_reflection_enabled,
    care_guide, care_guide_delivery_enabled, internal_instruction,
    internal_instruction_delivery_enabled, tax_included, rounding_rule,
    pricing_rule, medication_metadata, vaccine_metadata, origin_type,
    classification_path_id, catalog_revision
  ) values (
    v_id, p_workspace_id, v_source_key,
    coalesce(p_item ->> 'sourcePresetVersion', p_item ->> 'source_preset_version', 'workspace-custom-v1'),
    null, null, 'detached', array['*'], now(), auth.uid()::text, 'detached', v_category,
    v_chart.group_code, v_t_category.category_code, v_t_code_label,
    coalesce(p_item ->> 'standardOrderName', p_item ->> 'standard_order_name', v_source_key),
    coalesce(p_item ->> 'inHospitalOrderName', p_item ->> 'in_hospital_order_name', v_source_key),
    coalesce(p_item ->> 'billingName', p_item ->> 'billing_name', v_source_key),
    coalesce(array(select value #>> '{}' from jsonb_array_elements(coalesce(p_item -> 'aliases', '[]'::jsonb))), '{}'),
    v_availability, v_price, v_sales_unit, v_target_species,
    case v_route.destination_module when 'inpatient' then 'billing_only' else v_route.destination_module end,
    v_route.task_required, v_billing,
    p_item ->> 'careGuide', coalesce((p_item ->> 'careGuideDeliveryEnabled')::boolean, false),
    p_item ->> 'internalInstruction', coalesce((p_item ->> 'internalInstructionDeliveryEnabled')::boolean, false),
    v_tax_included, v_rounding_rule,
    v_pricing, coalesce(p_item -> 'medicationMetadata', '{}'::jsonb), coalesce(p_item -> 'vaccineMetadata', '{}'::jsonb),
    'workspace_custom', v_path_id, 1
  ) returning * into v_item;
  return jsonb_build_object('ok', true, 'status', 200, 'item', to_jsonb(v_item), 'enforcedBy', 'clair_create_order_catalog_item');
end;
$$;

revoke all on function public.clair_create_order_catalog_item(text, jsonb)
  from public, anon, service_role;
grant execute on function public.clair_create_order_catalog_item(text, jsonb)
  to authenticated;

-- Resolve a saved adoption review without accepting client-supplied source or
-- workspace snapshots.  The source projection captured by the adoption writer
-- is the only source of canonical fields for accept_source.
create or replace function public.clair_resolve_workspace_master_update(
  p_workspace_id text,
  p_update_id uuid,
  p_expected_catalog_revision integer,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, master, pg_temp
as $$
declare
  v_update public.workspace_master_updates%rowtype;
  v_item public.order_catalog_items%rowtype;
  v_snapshot jsonb;
  v_classification jsonb;
  v_order jsonb;
  v_path_id uuid;
  v_standard_name text;
  v_aliases text[];
  v_species text[];
  v_sales_unit text;
  v_source_revision integer;
  v_billing boolean;
  v_next_availability text;
  v_next_merge_status text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_expected_catalog_revision is null or p_expected_catalog_revision <= 0 then
    raise exception 'catalog_revision_required' using errcode = '22023';
  end if;
  if p_action not in ('accept_source', 'dismiss') then
    raise exception 'workspace_master_update_action_invalid' using errcode = '22023';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'workspace_admin_required' using errcode = '42501';
  end if;

  select * into v_update
  from public.workspace_master_updates
  where id = p_update_id and workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception 'workspace_master_update_not_found' using errcode = 'P0002';
  end if;
  if v_update.status <> 'pending' then
    raise exception 'workspace_master_update_already_resolved' using errcode = '40901';
  end if;
  if v_update.order_catalog_item_id is null then
    raise exception 'workspace_master_update_item_required' using errcode = '23503';
  end if;

  select * into v_item
  from public.order_catalog_items
  where workspace_id = p_workspace_id and id = v_update.order_catalog_item_id
  for update;
  if not found then
    raise exception 'order_catalog_item_not_found' using errcode = 'P0002';
  end if;
  if v_item.catalog_revision <> p_expected_catalog_revision then
    raise exception 'catalog_revision_conflict' using errcode = '40001';
  end if;

  if p_action = 'dismiss' then
    update public.workspace_master_updates
    set status = 'dismissed', resolved_by_user_id = auth.uid(), resolved_at = now()
    where id = v_update.id;
    return jsonb_build_object(
      'ok', true, 'status', 200, 'action', p_action,
      'item', to_jsonb(v_item), 'update', to_jsonb(v_update),
      'enforcedBy', 'clair_resolve_workspace_master_update'
    );
  end if;

  if v_item.origin_type <> 'clair_master'
    or v_item.source_master_record_id <> v_update.source_master_record_id then
    raise exception 'workspace_master_update_lineage_conflict' using errcode = '40901';
  end if;
  v_snapshot := v_update.source_snapshot;
  v_classification := coalesce(v_snapshot -> 'classification', '{}'::jsonb);
  v_order := coalesce(v_snapshot -> 'order', '{}'::jsonb);
  if v_snapshot ->> 'masterKey' is null
    or v_classification ->> 'pathKey' is null
    or v_classification ->> 'itemType' is null then
    raise exception 'workspace_master_update_snapshot_invalid' using errcode = '22023';
  end if;
  select id into v_path_id
  from master.classification_paths
  where path_key = v_classification ->> 'pathKey'
    and retired_in_release_id is null
  order by path_key
  limit 1;
  if v_path_id is null then
    raise exception 'workspace_master_classification_path_missing' using errcode = '23503';
  end if;
  v_source_revision := v_update.source_revision;
  v_standard_name := coalesce(
    (
      select value ->> 'name'
      from jsonb_array_elements(coalesce(v_snapshot -> 'names', '[]'::jsonb))
      where value ->> 'languageCode' = 'ko'
        and value ->> 'nameKind' = 'preferred'
      order by (value ->> 'sortOrder')::integer, value ->> 'name'
      limit 1
    ), v_snapshot ->> 'masterKey'
  );
  select coalesce(array_agg(value ->> 'name' order by (value ->> 'sortOrder')::integer, value ->> 'name'), '{}')
  into v_aliases
  from jsonb_array_elements(coalesce(v_snapshot -> 'names', '[]'::jsonb))
  where value ->> 'nameKind' = 'alias';
  v_species := coalesce(
    array(select value #>> '{}' from jsonb_array_elements(coalesce(v_order -> 'species', '[]'::jsonb))),
    '{dog,cat}'
  );
  v_sales_unit := case v_order ->> 'defaultSalesUnitCode'
    when 'EA' then 'per_each'
    when 'DAY' then 'per_day'
    when 'ML' then 'per_ml'
    when 'KG' then 'per_kg'
    else coalesce(v_order ->> 'defaultSalesUnitCode', v_item.sales_unit)
  end;
  v_billing := coalesce(
    (v_order ->> 'defaultBillingReflectionEnabled')::boolean,
    v_item.billing_reflection_enabled
  );
  v_next_availability := case
    when v_update.update_type = 'new' then 'active'
    else v_item.availability_status
  end;
  if v_next_availability = 'active' and v_billing and v_item.price_krw is null then
    raise exception 'active_billable_price_required' using errcode = '23514';
  end if;
  v_next_merge_status := case
    when v_snapshot ->> 'lifecycleStatus' in ('deprecated', 'deprecation_pending')
      then 'deprecated_source'
    else 'current'
  end;

  update public.order_catalog_items
  set standard_order_id = v_snapshot ->> 'masterKey',
      source_preset_version = 'master-r' || v_source_revision,
      last_auto_merged_preset_version = 'master-r' || v_source_revision,
      category_group = v_classification ->> 'itemType',
      category_label = coalesce(v_classification ->> 'chartGroupCode', v_item.category_label),
      standard_order_name = v_standard_name,
      aliases = v_aliases,
      availability_status = v_next_availability,
      sales_unit = v_sales_unit,
      target_species = v_species,
      default_destination_module = case v_classification ->> 'destinationModule'
        when 'inpatient' then 'billing_only'
        else coalesce(v_classification ->> 'destinationModule', v_item.default_destination_module)
      end,
      default_task_required = coalesce((v_classification ->> 'taskRequired')::boolean, v_item.default_task_required),
      billing_reflection_enabled = v_billing,
      source_master_revision = v_source_revision,
      last_auto_merged_revision = v_source_revision,
      classification_path_id = v_path_id,
      source_projection_snapshot = v_snapshot,
      source_projection_fingerprint = private.clinical_master_projection_fingerprint(v_snapshot),
      catalog_revision = catalog_revision + 1,
      preset_merge_status = v_next_merge_status,
      updated_at = now()
  where workspace_id = p_workspace_id and id = v_item.id;

  update public.workspace_master_updates
  set status = 'accepted', resolved_by_user_id = auth.uid(), resolved_at = now()
  where id = v_update.id;
  return jsonb_build_object(
    'ok', true, 'status', 200, 'action', p_action,
    'item', to_jsonb((select item from public.order_catalog_items item
      where item.workspace_id = p_workspace_id and item.id = v_item.id)),
    'update', to_jsonb(v_update),
    'enforcedBy', 'clair_resolve_workspace_master_update'
  );
end;
$$;

revoke all on function public.clair_resolve_workspace_master_update(text, uuid, integer, text)
  from public, anon, service_role;
grant execute on function public.clair_resolve_workspace_master_update(text, uuid, integer, text)
  to authenticated;

comment on function private.clair_adopt_master_release_to_workspace(text, uuid) is
  'Phase 1A-2 private adoption writer. Acquires A1 publication then workspace adoption locks and performs idempotent source/review/notification writes.';
comment on function public.clair_update_order_catalog_item(text, text, integer, jsonb) is
  'Phase 1A-2 hospital-admin CAS catalog writer; client lineage and source projections are protected.';
