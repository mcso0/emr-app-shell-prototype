\set ON_ERROR_STOP on
-- Local-only replay for the additive sales-unit adopter hotfix.
-- Run from the repository root with a local database connection:
--   psql --dbname "$LOCAL_DATABASE_URL" --file supabase/snippets/clinical_master_sales_unit_adopter_hotfix_replay.sql
--
-- The migration is deliberately reapplied twice before the synthetic flow.
-- All data work is inside one transaction and is rolled back at the end.

begin;

\ir ../migrations/20260823142511_clinical_master_sales_unit_adopter_hotfix.sql
\ir ../migrations/20260823142511_clinical_master_sales_unit_adopter_hotfix.sql

do $replay$
declare
  v_admin uuid := '00000000-0000-4000-8000-000000000001';
  v_workspace text := 'sales-unit-hotfix-replay';
  v_path_id uuid;
  v_release_id uuid;
  v_source_id uuid;
  v_item_id text := 'master-sales-unit-hotfix-replay-salesunit.hotfix.order.case';
  v_update_id uuid;
  v_result jsonb;
  v_snapshot jsonb;
  v_revision integer;
  v_before_revision integer;
  v_payload jsonb;
begin
  -- The accepted vocabulary and fallback must never leak an invalid value to
  -- the order_catalog_items.sales_unit constraint.
  if private.clinical_master_normalize_sales_unit(' ea ', 'per_order') <> 'per_each'
    or private.clinical_master_normalize_sales_unit('cAsE', 'per_each') <> 'per_order'
    or private.clinical_master_normalize_sales_unit('DAY', 'per_each') <> 'per_day'
    or private.clinical_master_normalize_sales_unit('ml', 'per_each') <> 'per_ml'
    or private.clinical_master_normalize_sales_unit('Kg', 'per_each') <> 'per_kg'
    or private.clinical_master_normalize_sales_unit(null, 'per_frequency') <> 'per_frequency'
    or private.clinical_master_normalize_sales_unit('unsupported', 'unsupported') <> 'per_each' then
    raise exception 'clinical_master_sales_unit_normalizer_matrix_failed';
  end if;

  perform private.clinical_master_seed_fallback_paths();
  select id into v_path_id
  from master.classification_paths
  where path_key = 'phase1a2.fallback.path.consultation'
    and retired_in_release_id is null;
  if v_path_id is null then
    raise exception 'clinical_master_sales_unit_replay_path_missing';
  end if;

  insert into public.workspaces (id, display_name, status, created_by_user_id)
  values (v_workspace, 'Sales-unit adopter hotfix replay', 'active', v_admin);
  insert into public.user_memberships (
    id, workspace_id, user_id, roles, status, activated_at
  ) values (
    'a5a00000-0000-4000-8000-000000000001', v_workspace, v_admin,
    array['hospital_admin'], 'active', now()
  );

  -- Fresh CASE adoption proves both the source projection and pricing_rule
  -- use the canonical per_order value.
  v_payload := jsonb_build_object(
    'releaseKey', 'sales-unit-hotfix-replay-case-v1',
    'releaseNotes', 'Synthetic CASE sales-unit adopter hotfix replay.',
    'publishedByLabel', 'Sales-unit adopter hotfix replay',
    'records', jsonb_build_array(
      jsonb_build_object(
        'masterKey', 'salesunit.hotfix.unit.case',
        'recordType', 'unit',
        'names', jsonb_build_array(
          jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', '케이스'),
          jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'Case')
        ),
        'source', jsonb_build_object(
          'sourceType', 'synthetic', 'title', 'Sales-unit adopter hotfix replay',
          'sourceVersion', 'sales-unit-hotfix-v1'
        ),
        'detail', jsonb_build_object(
          'unitCode', 'CASE', 'symbol', 'case', 'decimalScale', 0
        )
      ),
      jsonb_build_object(
        'masterKey', 'salesunit.hotfix.order.case',
        'recordType', 'order',
        'names', jsonb_build_array(
          jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', '케이스 상담'),
          jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'Case Consultation'),
          jsonb_build_object('languageCode', 'ko', 'nameKind', 'alias', 'name', '케이스')
        ),
        'source', jsonb_build_object(
          'sourceType', 'synthetic', 'title', 'Sales-unit adopter hotfix replay',
          'sourceVersion', 'sales-unit-hotfix-v1'
        ),
        'detail', jsonb_build_object(
          'classificationPathKey', 'phase1a2.fallback.path.consultation',
          'defaultSalesUnitCode', 'CASE',
          'defaultBillingReflectionEnabled', true,
          'defaultQuantity', 1,
          'species', jsonb_build_array('dog', 'cat')
        )
      )
    ),
    'classificationPaths', jsonb_build_array(jsonb_build_object(
      'pathKey', 'phase1a2.fallback.path.consultation',
      'clinicalActionKey', 'phase1a2.fallback.action.consultation',
      'chartGroupKey', 'phase1a2.fallback.chart.CG_CONSULTATION',
      'taskRouteKey', 'phase1a2.fallback.route.NT_CHART_ONLY'
    ))
  );
  v_result := private.publish_clinical_master_release(v_payload, null);
  if coalesce(v_result ->> 'idempotent', 'true') <> 'false' then
    raise exception 'clinical_master_sales_unit_replay_release_unexpectedly_idempotent:%', v_result;
  end if;
  v_release_id := (v_result ->> 'releaseId')::uuid;

  v_result := private.clair_adopt_master_release_to_workspace_a2_base(v_workspace, v_release_id);
  if coalesce((v_result ->> 'createdCount')::integer, 0) <> 1
    or coalesce((v_result ->> 'reviewCount')::integer, 0) <> 1 then
    raise exception 'clinical_master_sales_unit_replay_fresh_case_adoption_failed:%', v_result;
  end if;
  select id into v_source_id
  from master.master_records
  where master_key = 'salesunit.hotfix.order.case';
  if (select sales_unit from public.order_catalog_items where id = v_item_id and workspace_id = v_workspace) <> 'per_order'
    or (select pricing_rule ->> 'salesUnit' from public.order_catalog_items where id = v_item_id and workspace_id = v_workspace) <> 'per_order'
    or (select source_projection_snapshot -> 'order' ->> 'defaultSalesUnitCode'
        from public.order_catalog_items where id = v_item_id and workspace_id = v_workspace) <> 'CASE' then
    raise exception 'clinical_master_sales_unit_replay_fresh_case_not_canonical';
  end if;

  -- Turn the newly-created row into an existing customized per_each row while
  -- retaining its pending new review. The public CAS update and accept flow
  -- must restore per_order without overwriting custom semantic state.
  update public.order_catalog_items
  set sales_unit = 'per_each',
      pricing_rule = jsonb_set(coalesce(pricing_rule, '{}'::jsonb), '{salesUnit}', to_jsonb('per_each'::text), true),
      customization_state = 'customized',
      customized_fields = array['price_krw', 'in_hospital_order_name'],
      in_hospital_order_name = '병원 케이스 맞춤명',
      billing_name = '병원 케이스 청구명',
      price_krw = 2500,
      catalog_revision = catalog_revision + 1,
      updated_at = now()
  where id = v_item_id and workspace_id = v_workspace;
  select id into v_update_id
  from public.workspace_master_updates
  where workspace_id = v_workspace
    and release_id = v_release_id
    and source_master_record_id = v_source_id
    and update_type = 'new'
    and status = 'pending';
  if v_update_id is null then
    raise exception 'clinical_master_sales_unit_replay_pending_new_review_missing';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin::text, 'role', 'authenticated')::text,
    true
  );
  select catalog_revision into v_before_revision
  from public.order_catalog_items
  where id = v_item_id and workspace_id = v_workspace;
  v_result := public.clair_update_order_catalog_item(
    v_workspace, v_item_id, v_before_revision,
    jsonb_build_object('priceKrw', 2600)
  );
  select catalog_revision into v_revision
  from public.order_catalog_items
  where id = v_item_id and workspace_id = v_workspace;
  if v_revision <> v_before_revision + 1
    or (select price_krw from public.order_catalog_items where id = v_item_id and workspace_id = v_workspace) <> 2600 then
    raise exception 'clinical_master_sales_unit_replay_price_cas_failed:%', v_result;
  end if;

  v_result := public.clair_resolve_workspace_master_update(
    v_workspace, v_update_id, v_revision, 'accept_source'
  );
  reset role;

  if (select status from public.workspace_master_updates where id = v_update_id) <> 'accepted'
    or (select availability_status from public.order_catalog_items where id = v_item_id and workspace_id = v_workspace) <> 'active'
    or (select sales_unit from public.order_catalog_items where id = v_item_id and workspace_id = v_workspace) <> 'per_order'
    or (select pricing_rule ->> 'salesUnit' from public.order_catalog_items where id = v_item_id and workspace_id = v_workspace) <> 'per_order'
    or (select price_krw from public.order_catalog_items where id = v_item_id and workspace_id = v_workspace) <> 2600
    or (select in_hospital_order_name from public.order_catalog_items where id = v_item_id and workspace_id = v_workspace) <> '병원 케이스 맞춤명'
    or (select billing_name from public.order_catalog_items where id = v_item_id and workspace_id = v_workspace) <> '병원 케이스 청구명'
    or (select customization_state from public.order_catalog_items where id = v_item_id and workspace_id = v_workspace) <> 'customized'
    or not ((select customized_fields from public.order_catalog_items where id = v_item_id and workspace_id = v_workspace) @> array['price_krw', 'in_hospital_order_name'])
    or (select source_projection_snapshot -> 'order' ->> 'defaultSalesUnitCode'
        from public.order_catalog_items where id = v_item_id and workspace_id = v_workspace) <> 'CASE'
    or (select source_projection_fingerprint from public.order_catalog_items where id = v_item_id and workspace_id = v_workspace)
       is distinct from private.clinical_master_projection_fingerprint(
         (select source_projection_snapshot from public.order_catalog_items where id = v_item_id and workspace_id = v_workspace)
       ) then
    raise exception 'clinical_master_sales_unit_replay_customized_accept_failed:%', v_result;
  end if;

  -- Exact security/search_path contract: private writers remain private, and
  -- only the authenticated resolver is callable by the public API role.
  if not exists (
      select 1
      from pg_proc p
      where p.oid = 'private.clair_adopt_master_release_to_workspace_a2_base(text,uuid)'::regprocedure
        and p.prosecdef
        and array_to_string(p.proconfig, E'\n') like '%search_path=public, private, master, extensions, pg_temp%'
        and not has_function_privilege('authenticated', p.oid, 'execute')
        and not has_function_privilege('anon', p.oid, 'execute')
    )
    or not exists (
      select 1
      from pg_proc p
      where p.oid = 'public.clair_resolve_workspace_master_update(text,uuid,integer,text)'::regprocedure
        and p.prosecdef
        and array_to_string(p.proconfig, E'\n') like '%search_path=public, private, master, pg_temp%'
        and has_function_privilege('authenticated', p.oid, 'execute')
        and not has_function_privilege('anon', p.oid, 'execute')
    )
    or not exists (
      select 1
      from pg_proc p
      where p.oid = 'private.clinical_master_normalize_sales_unit(text,text)'::regprocedure
        and array_to_string(p.proconfig, E'\n') like '%search_path=pg_catalog%'
        and not has_function_privilege('authenticated', p.oid, 'execute')
    ) then
    raise exception 'clinical_master_sales_unit_replay_acl_or_search_path_failed';
  end if;

  raise notice 'clinical_master_sales_unit_adopter_hotfix_replay_ok';
end;
$replay$;

rollback;

-- Fresh-connection zero-residual verification (run separately after this
-- script exits; the transaction above has already rolled back):
-- select count(*) = 0 as rollback_zero_residual
-- from public.workspaces where id = 'sales-unit-hotfix-replay';
