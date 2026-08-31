\set ON_ERROR_STOP on

-- PR-022 synthetic/demo workspace rollout.
--
-- This packet resolves only the exact published execution-preset release into
-- the three allowlisted synthetic/demo workspaces. It intentionally keeps
-- clinically unreviewed dispensing profiles in the existing service-review
-- state and never changes master.order_execution_presets.clinical_use_allowed.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '300s';
set local role postgres;

do $rollout$
declare
  v_release_id constant uuid := '647629e9-41fe-4d75-a572-99f34bf428ea';
  v_release_key constant text := 'cm.release.execution-presets.v1.2026-08-31.1';
  v_source_fingerprint constant text := '8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0';
  v_target_workspaces constant text[] := array[
    'clair-demo',
    'workspace-clair-cheongdam',
    'workspace-clinical-master-pilot-v1'
  ];
  v_foreign_workspace constant text := 'clair-foreign-demo';
  v_workspace text;
  v_actor uuid;
  v_item record;
  v_update record;
  v_result jsonb;
  v_resolution_action text;
  v_price integer;
  v_released_count integer;
  v_release_master_keys text[];
  v_chart_count integer;
  v_service_review_count integer;
begin
  if not exists (
    select 1
    from master.master_releases release_row
    where release_row.id = v_release_id
      and release_row.release_key = v_release_key
      and release_row.release_no = 50
      and release_row.record_count = 689
      and release_row.source_fingerprint = v_source_fingerprint
      and release_row.status = 'published'
      and release_row.adoption_scope = 'payload'
  ) then
    raise exception 'clinical_master_pr022_release_preflight_failed';
  end if;

  select count(*) into v_released_count
  from private.clinical_master_release_payload_owner_manifest manifest
  where manifest.release_id = v_release_id
    and manifest.record_type = 'order'
    and manifest.included;
  if v_released_count <> 522 then
    raise exception 'clinical_master_pr022_release_order_count_invalid:%', v_released_count;
  end if;
  select array_agg(source_record.master_key order by source_record.master_key)
    into v_release_master_keys
  from private.clinical_master_release_payload_owner_manifest manifest
  join master.master_records source_record
    on source_record.id = manifest.master_record_id
  where manifest.release_id = v_release_id
    and manifest.record_type = 'order'
    and manifest.included;

  if exists (
    select 1
    from master.order_execution_presets preset
    join master.order_execution_preset_current current_preset
      on current_preset.order_record_id = preset.order_record_id
     and current_preset.preset_id = preset.id
     and current_preset.preset_revision = preset.preset_revision
    join private.clinical_master_release_payload_owner_manifest manifest
      on manifest.release_id = v_release_id
     and manifest.master_record_id = preset.order_record_id
     and manifest.record_type = 'order'
     and manifest.included
    where preset.preset_status <> 'synthetic_unreviewed'
       or preset.clinical_use_allowed
  ) then
    raise exception 'clinical_master_pr022_clinical_boundary_changed';
  end if;

  -- Negative-control workspace is deliberately empty and must stay untouched.
  if exists (select 1 from public.order_catalog_items where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.workspace_master_updates where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.workspace_lab_item_updates where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.workspace_lab_catalog_updates where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.lab_test_categories where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.lab_test_items where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.lab_test_item_versions where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.order_catalog_lab_test_item_links where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.order_sets where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.notification_events where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.audit_events where workspace_id = v_foreign_workspace) then
    raise exception 'clinical_master_pr022_foreign_workspace_preflight_failed';
  end if;

  foreach v_workspace in array v_target_workspaces loop
    if not exists (
      select 1 from public.workspaces workspace_row
      where workspace_row.id = v_workspace and workspace_row.status = 'active'
    ) then
      raise exception 'clinical_master_pr022_target_workspace_missing:%', v_workspace;
    end if;

    select membership.user_id into v_actor
    from public.user_memberships membership
    where membership.workspace_id = v_workspace
      and membership.status = 'active'
      and membership.archived_at is null
      and membership.roles @> array['hospital_admin']::text[]
    order by (membership.roles @> array['owner']::text[]) desc,
      membership.created_at, membership.user_id
    limit 1;
    if v_actor is null then
      raise exception 'clinical_master_pr022_workspace_admin_missing:%', v_workspace;
    end if;

    perform set_config('request.jwt.claim.sub', v_actor::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', v_actor::text, 'role', 'authenticated')::text,
      true
    );
    execute 'set local role authenticated';
    if not private.clair_current_user_has_workspace_permission(
      v_workspace, 'service_catalog:manage'
    ) then
      execute 'set local role postgres';
      raise exception 'clinical_master_pr022_workspace_permission_missing:%', v_workspace;
    end if;
    execute 'set local role postgres';

    if (
      select count(*)
      from public.order_catalog_items item
      join private.clinical_master_release_payload_owner_manifest manifest
        on manifest.release_id = v_release_id
       and manifest.master_record_id = item.source_master_record_id
       and manifest.record_type = 'order'
       and manifest.included
      where item.workspace_id = v_workspace
        and item.origin_type = 'clair_master'
    ) <> 522 then
      raise exception 'clinical_master_pr022_workspace_catalog_preflight_failed:%', v_workspace;
    end if;

    -- A newly accepted billable source row must already have a workspace-owned
    -- price. Fill only missing prices with deterministic synthetic demo values;
    -- never replace an existing workspace price.
    for v_item in
      select item.id, item.catalog_revision, item.standard_order_id,
        coalesce(
          item.clinical_order_type,
          update_row.source_snapshot -> 'executionPreset' ->> 'clinicalOrderType',
          'other'
        ) as clinical_order_type
      from public.workspace_master_updates update_row
      join public.order_catalog_items item
        on item.workspace_id = update_row.workspace_id
       and item.id = update_row.order_catalog_item_id
      where update_row.workspace_id = v_workspace
        and update_row.release_id = v_release_id
        and update_row.status = 'pending'
        and update_row.update_type = 'new'
        and item.origin_type = 'clair_master'
        and item.price_krw is null
        and coalesce(
          (update_row.source_snapshot -> 'order' ->> 'defaultBillingReflectionEnabled')::boolean,
          item.billing_reflection_enabled,
          false
        )
      order by item.id
    loop
      v_price := case v_item.clinical_order_type
        when 'consultation' then 28000
        when 'clinical_lab' then 36000
        when 'imaging' then 42000
        when 'dispensing' then 52000
        when 'treatment' then 48000
        when 'hospitalization' then 76000
        when 'system_exam' then 62000
        else 96000
      end + (mod(abs(hashtext(v_item.standard_order_id)::bigint), 100)::integer + 1) * 100;

      perform set_config('request.jwt.claim.sub', v_actor::text, true);
      perform set_config('request.jwt.claim.role', 'authenticated', true);
      perform set_config(
        'request.jwt.claims',
        jsonb_build_object('sub', v_actor::text, 'role', 'authenticated')::text,
        true
      );
      execute 'set local role authenticated';
      v_result := public.clair_update_order_catalog_item(
        v_workspace,
        v_item.id,
        v_item.catalog_revision,
        jsonb_build_object('priceKrw', v_price)
      );
      execute 'set local role postgres';
      if coalesce(v_result ->> 'ok', 'false') <> 'true' then
        raise exception 'clinical_master_pr022_workspace_price_failed:%:%',
          v_workspace, v_item.id;
      end if;
    end loop;

    -- The authenticated CAS resolver is the only authority that may accept or
    -- dismiss a source update. Dispensing rows whose immutable clinical profile
    -- still targets the previous order revision retain their already-present
    -- profile-matched preset until the deferred clinical profile republish;
    -- every other row accepts the exact current source preset.
    for v_update in
      select update_row.id, item.catalog_revision,
        item.source_dispensing_profile_id,
        item.source_master_revision,
        update_row.source_revision
      from public.workspace_master_updates update_row
      join public.order_catalog_items item
        on item.workspace_id = update_row.workspace_id
       and item.id = update_row.order_catalog_item_id
      where update_row.workspace_id = v_workspace
        and update_row.release_id = v_release_id
        and update_row.status = 'pending'
      order by update_row.created_at, update_row.id
    loop
      v_resolution_action := case
        when v_update.source_dispensing_profile_id is not null
          and v_update.source_master_revision is distinct from v_update.source_revision
          then 'dismiss'
        else 'accept_source'
      end;
      perform set_config('request.jwt.claim.sub', v_actor::text, true);
      perform set_config('request.jwt.claim.role', 'authenticated', true);
      perform set_config(
        'request.jwt.claims',
        jsonb_build_object('sub', v_actor::text, 'role', 'authenticated')::text,
        true
      );
      execute 'set local role authenticated';
      v_result := public.clair_resolve_workspace_master_update(
        v_workspace,
        v_update.id,
        v_update.catalog_revision,
        v_resolution_action
      );
      execute 'set local role postgres';
      if coalesce(v_result ->> 'ok', 'false') <> 'true' then
        raise exception 'clinical_master_pr022_workspace_resolution_failed:%:%:%',
          v_workspace, v_update.id, v_resolution_action;
      end if;
    end loop;

    -- Clinical validation is explicitly deferred. Keep unreviewed dispensing
    -- profiles in the existing service-review-only chart path after the source
    -- review was accepted and the preset copy was made.
    for v_item in
      select item.id, item.catalog_revision
      from public.order_catalog_items item
      join private.clinical_master_release_payload_owner_manifest manifest
        on manifest.release_id = v_release_id
       and manifest.master_record_id = item.source_master_record_id
       and manifest.record_type = 'order'
       and manifest.included
      join master.dispensing_order_profiles profile
        on profile.id = item.source_dispensing_profile_id
       and profile.profile_revision = item.source_dispensing_profile_revision
      where item.workspace_id = v_workspace
        and item.clinical_order_type = 'dispensing'
        and item.availability_status = 'active'
        and not item.clinical_use_allowed
        and private.clair_dispensing_service_review_allowed(
          v_workspace, profile.source_release_id
        )
      order by item.id
    loop
      perform set_config('request.jwt.claim.sub', v_actor::text, true);
      perform set_config('request.jwt.claim.role', 'authenticated', true);
      perform set_config(
        'request.jwt.claims',
        jsonb_build_object('sub', v_actor::text, 'role', 'authenticated')::text,
        true
      );
      execute 'set local role authenticated';
      v_result := public.clair_update_order_catalog_item(
        v_workspace,
        v_item.id,
        v_item.catalog_revision,
        jsonb_build_object('availabilityStatus', 'pending_activation')
      );
      execute 'set local role postgres';
      if coalesce(v_result ->> 'ok', 'false') <> 'true' then
        raise exception 'clinical_master_pr022_service_review_restore_failed:%:%',
          v_workspace, v_item.id;
      end if;
    end loop;

    if exists (
      select 1
      from public.workspace_master_updates update_row
      where update_row.workspace_id = v_workspace
        and update_row.release_id = v_release_id
        and update_row.status = 'pending'
    ) then
      raise exception 'clinical_master_pr022_pending_review_residue:%', v_workspace;
    end if;

    if (
      select count(*)
      from public.workspace_master_updates update_row
      join public.order_catalog_items item
        on item.workspace_id = update_row.workspace_id
       and item.id = update_row.order_catalog_item_id
      where update_row.workspace_id = v_workspace
        and update_row.release_id = v_release_id
        and update_row.status = 'dismissed'
        and item.source_dispensing_profile_id is not null
        and item.source_master_revision is distinct from update_row.source_revision
    ) <> 108 then
      raise exception 'clinical_master_pr022_deferred_dispensing_review_count_failed:%',
        v_workspace;
    end if;

    if exists (
      select 1
      from public.order_catalog_items item
      join private.clinical_master_release_payload_owner_manifest manifest
        on manifest.release_id = v_release_id
       and manifest.master_record_id = item.source_master_record_id
       and manifest.record_type = 'order'
       and manifest.included
      join master.order_execution_preset_current current_preset
        on current_preset.order_record_id = item.source_master_record_id
      join master.order_execution_presets preset
        on preset.id = current_preset.preset_id
       and preset.preset_revision = current_preset.preset_revision
      where item.workspace_id = v_workspace
        and item.source_dispensing_profile_id is null
        and (
          item.source_execution_preset_id is distinct from preset.id
          or item.source_execution_preset_revision is distinct from preset.preset_revision
          or item.source_execution_preset_sha256 is distinct from preset.content_sha256
          or item.default_detail_inputs is distinct from preset.default_detail_inputs
          or item.default_detail_input_policies is distinct from preset.field_policies
          or item.clinical_order_type is distinct from preset.clinical_order_type
          or item.detail_schema_version is distinct from preset.detail_schema_version
        )
    ) then
      raise exception 'clinical_master_pr022_workspace_preset_copy_mismatch:%', v_workspace;
    end if;

    if exists (
      select 1
      from public.order_catalog_items item
      join private.clinical_master_release_payload_owner_manifest manifest
        on manifest.release_id = v_release_id
       and manifest.master_record_id = item.source_master_record_id
       and manifest.record_type = 'order'
       and manifest.included
      join master.dispensing_order_profiles profile
        on profile.id = item.source_dispensing_profile_id
       and profile.profile_revision = item.source_dispensing_profile_revision
      left join master.order_execution_presets preset
        on preset.id = item.source_execution_preset_id
       and preset.preset_revision = item.source_execution_preset_revision
      where item.workspace_id = v_workspace
        and (
          item.source_master_record_id is distinct from profile.order_record_id
          or item.source_master_revision is distinct from profile.order_record_revision
          or preset.order_record_id is distinct from profile.order_record_id
          or preset.order_record_revision is distinct from profile.order_record_revision
          or item.source_execution_preset_sha256 is distinct from preset.content_sha256
          or item.default_detail_inputs is distinct from preset.default_detail_inputs
          or item.default_detail_input_policies is distinct from preset.field_policies
          or item.default_detail_inputs = '{}'::jsonb
        )
    ) then
      raise exception 'clinical_master_pr022_deferred_dispensing_preset_mismatch:%',
        v_workspace;
    end if;

    select count(*) into v_service_review_count
    from public.order_catalog_items item
    join private.clinical_master_release_payload_owner_manifest manifest
      on manifest.release_id = v_release_id
     and manifest.master_record_id = item.source_master_record_id
     and manifest.record_type = 'order'
     and manifest.included
    join master.dispensing_order_profiles profile
      on profile.id = item.source_dispensing_profile_id
     and profile.profile_revision = item.source_dispensing_profile_revision
    where item.workspace_id = v_workspace
      and item.clinical_order_type = 'dispensing'
      and item.availability_status = 'pending_activation'
      and not item.clinical_use_allowed
      and private.clair_dispensing_service_review_allowed(
        v_workspace, profile.source_release_id
      );
    if v_service_review_count <> 108 then
      raise exception 'clinical_master_pr022_service_review_count_failed:%:%',
        v_workspace, v_service_review_count;
    end if;

    perform set_config('request.jwt.claim.sub', v_actor::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', v_actor::text, 'role', 'authenticated')::text,
      true
    );
    execute 'set local role authenticated';
    select count(*) into v_chart_count
    from public.clair_list_order_catalog_chart_search_v2(v_workspace) chart_row
    where chart_row.row_type = 'individual'
      and chart_row.source_preset_id = any(v_release_master_keys)
      and chart_row.applied_snapshot -> 'executionPresetLineage' is not null
      and chart_row.applied_snapshot -> 'defaultDetailInputs' <> '{}'::jsonb;
    execute 'set local role postgres';
    if v_chart_count < 510 then
      raise exception 'clinical_master_pr022_chart_search_coverage_failed:%:%',
        v_workspace, v_chart_count;
    end if;

    execute 'set local role authenticated';
    select count(*) into v_service_review_count
    from public.clair_list_order_catalog_chart_search_v2(v_workspace) chart_row
    where chart_row.row_type = 'individual'
      and chart_row.source_preset_id = any(v_release_master_keys)
      and coalesce(
        (chart_row.applied_snapshot -> 'dispensingLineage' ->> 'serviceReviewOnly')::boolean,
        false
      );
    if v_service_review_count <> 108 then
      execute 'set local role postgres';
      raise exception 'clinical_master_pr022_service_review_chart_count_failed:%:%',
        v_workspace, v_service_review_count;
    end if;

    if exists (
      with released_chart as (
        select distinct chart_row.applied_snapshot ->> 'clinicalOrderType' as clinical_order_type
        from public.clair_list_order_catalog_chart_search_v2(v_workspace) chart_row
        where chart_row.row_type = 'individual'
          and chart_row.source_preset_id = any(v_release_master_keys)
      ), required(clinical_order_type) as (
        values ('consultation'), ('clinical_lab'), ('imaging'), ('dispensing'),
          ('treatment'), ('hospitalization'), ('system_exam'), ('other')
      )
      select 1
      from required
      where not exists (
        select 1 from released_chart
        where released_chart.clinical_order_type = required.clinical_order_type
      )
    ) then
      execute 'set local role postgres';
      raise exception 'clinical_master_pr022_chart_category_coverage_failed:%', v_workspace;
    end if;
    execute 'set local role postgres';
  end loop;

  if exists (
    select 1
    from master.order_execution_presets preset
    join master.order_execution_preset_current current_preset
      on current_preset.order_record_id = preset.order_record_id
     and current_preset.preset_id = preset.id
     and current_preset.preset_revision = preset.preset_revision
    join private.clinical_master_release_payload_owner_manifest manifest
      on manifest.release_id = v_release_id
     and manifest.master_record_id = preset.order_record_id
     and manifest.record_type = 'order'
     and manifest.included
    where preset.preset_status <> 'synthetic_unreviewed'
       or preset.clinical_use_allowed
  ) then
    raise exception 'clinical_master_pr022_clinical_boundary_postcondition_failed';
  end if;

  if exists (select 1 from public.order_catalog_items where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.workspace_master_updates where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.workspace_lab_item_updates where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.workspace_lab_catalog_updates where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.lab_test_categories where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.lab_test_items where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.lab_test_item_versions where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.order_catalog_lab_test_item_links where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.order_sets where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.notification_events where workspace_id = v_foreign_workspace)
     or exists (select 1 from public.audit_events where workspace_id = v_foreign_workspace) then
    raise exception 'clinical_master_pr022_foreign_workspace_postcondition_failed';
  end if;

  raise notice 'clinical_master_pr022_workspace_rollout_ok';
end;
$rollout$;

commit;
