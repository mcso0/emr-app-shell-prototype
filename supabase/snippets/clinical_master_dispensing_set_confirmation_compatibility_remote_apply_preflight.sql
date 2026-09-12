-- Release-only prefix for the approved remote application of
-- 20260912113946_dispensing_set_confirmation_compatibility.sql.
-- Concatenate this file, the exact migration, and the matching postflight file
-- into one apply_migration query. Do not run the three parts separately.

begin;

lock table public.orders in access exclusive mode;

do $remote_apply_preflight$
declare
  v_order_count bigint;
  v_existing_field_fingerprint text;
  v_dispensing_set_child_count bigint;
  v_candidate_column_count bigint;
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
    md5(coalesce(jsonb_agg(to_jsonb(orders) order by orders.id)::text, '[]')),
    count(*) filter (
      where orders.row_type = 'set_child'
        and orders.clinical_order_type = 'dispensing'
    )
  into v_order_count,
    v_existing_field_fingerprint,
    v_dispensing_set_child_count
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
  into v_candidate_trigger_count
  from pg_trigger trigger_row
  join pg_class table_row on table_row.oid = trigger_row.tgrelid
  join pg_namespace schema_row on schema_row.oid = table_row.relnamespace
  where schema_row.nspname = 'public'
    and table_row.relname = 'orders'
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
    or v_dispensing_set_child_count <> 0
    or v_candidate_column_count <> 0
    or v_candidate_trigger_count <> 0
    or v_candidate_helper_count <> 0
  then
    raise exception 'dispensing_set_compatibility_remote_preflight_drift'
      using detail = jsonb_build_object(
        'orderCount', v_order_count,
        'existingFieldFingerprint', v_existing_field_fingerprint,
        'dispensingSetChildCount', v_dispensing_set_child_count,
        'candidateColumnCount', v_candidate_column_count,
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
      is distinct from 'bff6b9f029576b690267bfa3b4903f739c616ecd6e7b02526f1c3980d9d92415'
    or encode(digest(v_b3_constraint, 'sha256'), 'hex')
      is distinct from 'fc9276157eb42ddf3df01f28d748036526dc73c88fa26b79a4f9a451adf98832'
    or encode(digest(v_projection, 'sha256'), 'hex')
      is distinct from '45e7d833c3aac8fd6a95838c8b10d141ade4e5debdaab6b51602db53a0ed0ec7'
    or encode(digest(v_lineage, 'sha256'), 'hex')
      is distinct from 'a7bdc73f260867a90f72bbfcb06cb02e2c8e1ff0242fc962ec7561151980cb02'
    or encode(digest(v_confirmation_snapshot, 'sha256'), 'hex')
      is distinct from 'ef199a2e9df94783a7065a7d295ddf307f9281c31552b86ef03b5b93aa7749c0'
    or encode(digest(v_billing_authority, 'sha256'), 'hex')
      is distinct from '6a2ac1b735567d116932b20c8b9816557bcd1b20e7f9112112a55cdfc1bfb7cf'
    or encode(digest(v_confirmation_billing, 'sha256'), 'hex')
      is distinct from '06d6e61c633bee382dd53db84ccb8c2a5a2c0db1534918a9362ef35d78a7b683'
    or encode(digest(v_runtime_row, 'sha256'), 'hex')
      is distinct from '42b0427da929c84ae9b012de0c05b2717ed9c2d3c179c5a5c3e9c48049b47bb5'
  then
    raise exception 'dispensing_set_compatibility_remote_predecessor_definition_drift';
  end if;

  if (length(v_writer) - length(replace(
      v_writer,
      'calculation_outputs = excluded.calculation_outputs,',
      ''
    ))) / length('calculation_outputs = excluded.calculation_outputs,') <> 3
    or (length(v_b3_constraint) - length(replace(
      v_b3_constraint,
      'new.calculation_outputs',
      ''
    ))) / length('new.calculation_outputs') <> 31
    or (length(v_projection) - length(replace(
      v_projection,
      'a jsonb:=p_order.applied_snapshot->''planOrderAuthority'';',
      ''
    ))) / length(
      'a jsonb:=p_order.applied_snapshot->''planOrderAuthority'';'
    ) <> 1
    or (length(v_projection) - length(replace(
      v_projection,
      'private.clair_compute_dispense_before_preparation_v2(p_order,p_effective_at)',
      ''
    ))) / length(
      'private.clair_compute_dispense_before_preparation_v2(p_order,p_effective_at)'
    ) <> 2
    or (length(v_confirmation_snapshot) - length(replace(
      v_confirmation_snapshot,
      '''confirmedByUserId'', p_actor_user_id,',
      ''
    ))) / length('''confirmedByUserId'', p_actor_user_id,') <> 1
    or (length(v_confirmation_billing) - length(replace(
      v_confirmation_billing,
      'orders.applied_snapshot #>> ''{planOrderAuthority,priceBasis}''',
      ''
    ))) / length(
      'orders.applied_snapshot #>> ''{planOrderAuthority,priceBasis}'''
    ) <> 4
  then
    raise exception 'dispensing_set_compatibility_remote_anchor_drift';
  end if;
end;
$remote_apply_preflight$;
