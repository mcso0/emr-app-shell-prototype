-- Release-only suffix paired with
-- clinical_master_dispensing_set_confirmation_compatibility_remote_apply_preflight.sql.
-- The final COMMIT occurs only after schema, function, grant, and preserved-row
-- postconditions all pass.

do $remote_apply_postflight$
declare
  v_order_count bigint;
  v_existing_field_fingerprint text;
  v_nonempty_candidate_row_count bigint;
  v_candidate_column_count bigint;
  v_candidate_constraint_count bigint;
  v_candidate_trigger_count bigint;
  v_candidate_helper_count bigint;
  v_writer text;
  v_b3_constraint text;
  v_projection text;
  v_lineage text;
  v_confirmation_snapshot text;
  v_billing_authority text;
  v_confirmation_billing text;
  v_runtime_row text;
begin
  select count(*),
    md5(coalesce(jsonb_agg(
      to_jsonb(orders)
        - 'set_pricing_calculation_outputs'
        - 'dispensing_authority_snapshot'
        - 'dispensing_lineage_snapshot'
      order by orders.id
    )::text, '[]')),
    count(*) filter (
      where orders.set_pricing_calculation_outputs <> '{}'::jsonb
        or orders.dispensing_authority_snapshot <> '{}'::jsonb
        or orders.dispensing_lineage_snapshot <> '{}'::jsonb
    )
  into v_order_count,
    v_existing_field_fingerprint,
    v_nonempty_candidate_row_count
  from public.orders;

  select count(*)
  into v_candidate_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'orders'
    and column_name in (
      'set_pricing_calculation_outputs',
      'dispensing_authority_snapshot',
      'dispensing_lineage_snapshot'
    );

  select count(*)
  into v_candidate_constraint_count
  from pg_constraint constraint_row
  where constraint_row.conrelid = 'public.orders'::regclass
    and constraint_row.conname in (
      'orders_set_pricing_calculation_outputs_object_check',
      'orders_dispensing_authority_snapshot_object_check',
      'orders_dispensing_lineage_snapshot_object_check'
    );

  select count(*)
  into v_candidate_trigger_count
  from pg_trigger trigger_row
  where trigger_row.tgrelid = 'public.orders'::regclass
    and not trigger_row.tgisinternal
    and trigger_row.tgname in (
      'orders_execution_contract_zz_set_dispensing_capture_trg',
      'orders_zz_dispensing_set_lineage_copy_trg',
      'orders_dispensing_set_contract_copy_trg'
    );

  select count(*)
  into v_candidate_helper_count
  from pg_proc function_row
  join pg_namespace schema_row on schema_row.oid = function_row.pronamespace
  where schema_row.nspname = 'private'
    and function_row.proname in (
      'clair_is_set_pricing_calculation_outputs',
      'clair_b3_pricing_calculation_outputs',
      'clair_order_dispensing_authority',
      'clair_order_dispensing_lineage',
      'clair_capture_set_dispensing_contracts',
      'clair_sync_set_dispensing_lineage_copy',
      'clair_sync_set_dispensing_lineage_after',
      'clair_assert_dispensing_set_contract_copy'
    );

  if v_order_count <> 162
    or v_existing_field_fingerprint
      is distinct from '3dae85d3e90453ba69e681eb4129681a'
    or v_nonempty_candidate_row_count <> 0
    or v_candidate_column_count <> 3
    or v_candidate_constraint_count <> 3
    or v_candidate_trigger_count <> 3
    or v_candidate_helper_count <> 8
  then
    raise exception 'dispensing_set_compatibility_remote_postflight_drift'
      using detail = jsonb_build_object(
        'orderCount', v_order_count,
        'existingFieldFingerprint', v_existing_field_fingerprint,
        'nonemptyCandidateRowCount', v_nonempty_candidate_row_count,
        'candidateColumnCount', v_candidate_column_count,
        'candidateConstraintCount', v_candidate_constraint_count,
        'candidateTriggerCount', v_candidate_trigger_count,
        'candidateHelperCount', v_candidate_helper_count
      )::text;
  end if;

  v_writer := pg_get_functiondef(
    'public.clair_save_chart_order_draft_phase2_base(text,text,uuid,jsonb)'::regprocedure
  );
  v_b3_constraint := pg_get_functiondef(
    'private.clair_b3_assert_set_child_lineage()'::regprocedure
  );
  v_projection := pg_get_functiondef(
    'private.clair_compute_plan_order_dispense_projection(public.orders,timestamptz)'::regprocedure
  );
  v_lineage := pg_get_functiondef(
    'private.clair_set_dispensing_order_lineage()'::regprocedure
  );
  v_confirmation_snapshot := pg_get_functiondef(
    'public.clair_confirm_chart_order_candidates_billing_summary_base(text,uuid,uuid,uuid[],text,text)'::regprocedure
  );
  v_billing_authority := pg_get_functiondef(
    'private.clair_snapshot_order_billing_authority()'::regprocedure
  );
  v_confirmation_billing := pg_get_functiondef(
    'public.clair_confirm_chart_order_candidates_origin_base(text,uuid,uuid,uuid[],text,text)'::regprocedure
  );
  v_runtime_row := pg_get_functiondef(
    'private.clair_b3_runtime_row_json(public.orders)'::regprocedure
  );

  if encode(digest(v_writer, 'sha256'), 'hex')
      is distinct from '1bacf55f8ef7886c7729dcf54d46b1e107c9e81d9862e051f7ff5f95660008dc'
    or encode(digest(v_b3_constraint, 'sha256'), 'hex')
      is distinct from '2d966e28eb8e8f60eb97765e6e1807ddc3ed922382c1dea33ee8e9d03fe7709b'
    or encode(digest(v_projection, 'sha256'), 'hex')
      is distinct from '76a817fffa69e4721261f353ce834e5bf91ca23413c3d047378b4b74a1c52c6b'
    or encode(digest(v_lineage, 'sha256'), 'hex')
      is distinct from '0d045bea458e4b4e9358ca680f71712ac73ed1be4ff0badea2c0caff95333079'
    or encode(digest(v_confirmation_snapshot, 'sha256'), 'hex')
      is distinct from '772d3042977beb75c8f685498982ce700aa6dcd7762bb66f8ad26282552b144b'
    or encode(digest(v_billing_authority, 'sha256'), 'hex')
      is distinct from '887fcfb012e38a9e72cf93249fc7f26a99cbfcb6e5ffff87b09843edd7243721'
    or encode(digest(v_confirmation_billing, 'sha256'), 'hex')
      is distinct from '117e71a2689568f392cbfbe0e4e324d4443af795a822d9420b60dd9a8e042b81'
    or encode(digest(v_runtime_row, 'sha256'), 'hex')
      is distinct from 'afb2b2065bb1809aacad45414d3e60ecebfb457626440ef70d088d0dd85d5d98'
  then
    raise exception 'dispensing_set_compatibility_remote_candidate_definition_drift';
  end if;

  if (length(v_writer) - length(replace(
      v_writer,
      'set_pricing_calculation_outputs = case',
      ''
    ))) / length('set_pricing_calculation_outputs = case') <> 3
    or (length(v_b3_constraint) - length(replace(
      v_b3_constraint,
      'private.clair_b3_pricing_calculation_outputs(new)',
      ''
    ))) / length('private.clair_b3_pricing_calculation_outputs(new)') <> 31
    or (length(v_projection) - length(replace(
      v_projection,
      'a jsonb:=private.clair_order_dispensing_authority(p_order);',
      ''
    ))) / length(
      'a jsonb:=private.clair_order_dispensing_authority(p_order);'
    ) <> 1
    or (length(v_confirmation_snapshot) - length(replace(
      v_confirmation_snapshot,
      '''dispensingAuthoritySnapshot'',',
      ''
    ))) / length('''dispensingAuthoritySnapshot'',') <> 1
    or (length(v_confirmation_billing) - length(replace(
      v_confirmation_billing,
      'private.clair_order_dispensing_authority(orders) ->> ''priceBasis''',
      ''
    ))) / length(
      'private.clair_order_dispensing_authority(orders) ->> ''priceBasis'''
    ) <> 4
  then
    raise exception 'dispensing_set_compatibility_remote_postflight_anchor_drift';
  end if;

  if has_function_privilege(
      'anon',
      'private.clair_order_dispensing_authority(public.orders)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'private.clair_order_dispensing_authority(public.orders)',
      'execute'
    )
    or has_function_privilege(
      'service_role',
      'private.clair_order_dispensing_authority(public.orders)',
      'execute'
    )
    or has_function_privilege(
      'anon',
      'private.clair_sync_set_dispensing_lineage_copy(text,uuid,uuid,jsonb,text)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'private.clair_sync_set_dispensing_lineage_copy(text,uuid,uuid,jsonb,text)',
      'execute'
    )
    or has_function_privilege(
      'service_role',
      'private.clair_sync_set_dispensing_lineage_copy(text,uuid,uuid,jsonb,text)',
      'execute'
    )
  then
    raise exception 'dispensing_set_compatibility_remote_private_grant_drift';
  end if;
end;
$remote_apply_postflight$;

commit;
