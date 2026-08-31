-- Rollback-only dynamic rehearsal for the final current-main consultation
-- draft wrapper. Run only after the PR-022, billing/realtime, SOAP, and final
-- compatibility migrations have been applied.

\set ON_ERROR_STOP on

begin;

insert into public.order_catalog_items (
  id,
  workspace_id,
  standard_order_id,
  source_preset_version,
  category_group,
  category_label,
  standard_order_name,
  in_hospital_order_name,
  billing_name,
  availability_status,
  price_krw,
  default_destination_module,
  default_task_required,
  billing_reflection_enabled,
  classification_path_id,
  clinical_order_type,
  is_external_lab,
  destination_module,
  execution_mode,
  detail_schema_version,
  detail_field_schema,
  billing_eligible
) values (
  'security-consultation-runtime',
  'clair-demo',
  'security-consultation-runtime',
  'security-v1',
  'consultation',
  '진료',
  '보안 리허설 진료',
  '보안 리허설 진료',
  '보안 리허설 진료',
  'active',
  null,
  'chart_only',
  false,
  false,
  '467e1864-ca04-4664-ac35-b19d0f0f76f5'::uuid,
  'consultation',
  false,
  null,
  'immediate_complete',
  1,
  private.clair_order_detail_field_schema_v1('consultation'),
  false
);

insert into public.order_set_revision_items (
  id,
  workspace_id,
  order_set_id,
  revision_id,
  child_kind,
  child_order_catalog_item_id,
  child_order_catalog_revision,
  sort_order,
  default_selected,
  billing_reflection_default,
  default_quantity,
  quantity_source
) values (
  '92000000-0000-4000-8000-000000000020'::uuid,
  'clair-demo',
  'den194-set-kong-vomit-compact',
  'cc79652f-639f-8827-a9c1-9afd5246c216'::uuid,
  'atomic',
  'security-consultation-runtime',
  1,
  1,
  true,
  false,
  1,
  'fixed_one'
);

insert into public.workspace_permission_roles (
  id,
  workspace_id,
  role_key,
  label,
  role_type,
  permissions,
  is_system,
  is_assignable,
  sort_order,
  status
) values (
  '92000000-0000-4000-8000-000000000010'::uuid,
  'clair-demo',
  'security_update_only',
  'Security update only',
  'custom',
  '{"allowed":["chart:update"]}'::jsonb,
  false,
  true,
  999,
  'active'
);

update public.workspace_membership_permission_role_assignments
set permission_role_id = '92000000-0000-4000-8000-000000000010'::uuid,
    owner_source = 'explicit'
where membership_id = '10000000-0000-4000-8000-000000000003'::uuid;

update public.encounters
set primary_veterinarian_id = null
where workspace_id = 'clair-demo'
  and id = '19426000-0000-4000-8000-000000000004'::uuid;

do $rehearsal$
declare
  v_body jsonb;
  v_current jsonb;
  v_child jsonb;
  v_function_definition text;
  v_denial_message text;
  v_denial_state text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.clair_save_chart_order_draft(text,text,uuid,jsonb)'::pg_catalog.regprocedure
  ) into v_function_definition;

  if pg_catalog.strpos(
    pg_catalog.lower(v_function_definition),
    'private.clair_pr022_resolve_consultation_detail_inputs'
  ) = 0 or pg_catalog.strpos(
    pg_catalog.lower(v_function_definition),
    'private.clair_broadcast_chart_billing_summary_changed'
  ) = 0 or pg_catalog.strpos(
    pg_catalog.lower(v_function_definition),
    '''chart:view'''
  ) > pg_catalog.strpos(
    pg_catalog.lower(v_function_definition),
    'select encounter.primary_veterinarian_id'
  ) then
    raise exception 'final_wrapper_definition_mismatch';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc proc
    where proc.oid =
      'public.clair_save_chart_order_draft(text,text,uuid,jsonb)'::pg_catalog.regprocedure
      and proc.prosecdef
      and proc.proconfig = array['search_path=""']
      and pg_catalog.pg_get_userbyid(proc.proowner) = (
        select pg_catalog.pg_get_userbyid(base.proowner)
        from pg_catalog.pg_proc base
        where base.oid =
          'private.clair_broadcast_chart_billing_summary_changed(text,uuid,text,text)'::pg_catalog.regprocedure
      )
  ) then
    raise exception 'final_wrapper_security_contract_mismatch';
  end if;

  if pg_catalog.has_function_privilege(
    'anon',
    'public.clair_save_chart_order_draft(text,text,uuid,jsonb)',
    'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'authenticated',
    'public.clair_save_chart_order_draft(text,text,uuid,jsonb)',
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'service_role',
    'public.clair_save_chart_order_draft(text,text,uuid,jsonb)',
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'authenticated',
    'public.clair_save_chart_order_draft_billing_summary_base(text,text,uuid,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'final_wrapper_acl_mismatch';
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000002',
    true
  );
  perform pg_catalog.set_config(
    'request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
    true
  );
  execute 'set local role authenticated';
  v_current := public.clair_get_chart_order_draft(
    'clair-demo',
    '19426000-0000-4000-8000-000000000002'::uuid
  );
  v_body := public.clair_save_chart_order_draft(
    'clair-demo',
    '00000000-0000-4000-8000-000000000002',
    '19426000-0000-4000-8000-000000000002'::uuid,
    pg_catalog.jsonb_build_object(
      'expectedEtag', v_current ->> 'etag',
      'removedOrderIds', '[]'::jsonb,
      'rows', pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'rowType', 'individual',
          'orderId', '92000000-0000-4000-8000-000000000001',
          'workspaceCatalogItemId', 'security-consultation-runtime',
          'quantity', 1,
          'detailInputs', pg_catalog.jsonb_build_object(
            'responsibleClinicianId',
            '99999999-9999-4999-8999-999999999999',
            'occurrenceCount', 1,
            'timing', 'now',
            'instructionSummary', '보안 리허설'
          ),
          'detailSchemaVersion', 1,
          'priority', 'normal'
        )
      )
    )
  );
  if v_body #>> '{rows,0,detailInputs,responsibleClinicianId}' <>
      '00000000-0000-4000-8000-000000000002'
    or not v_body ? 'billingSummary'
  then
    raise exception 'individual_runtime_resolution_mismatch';
  end if;
  execute 'reset role';

  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000006',
    true
  );
  perform pg_catalog.set_config(
    'request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-000000000006","role":"authenticated"}',
    true
  );
  execute 'set local role authenticated';
  v_current := public.clair_get_chart_order_draft(
    'clair-demo',
    '19426000-0000-4000-8000-000000000004'::uuid
  );
  v_body := public.clair_save_chart_order_draft(
    'clair-demo',
    '00000000-0000-4000-8000-000000000006',
    '19426000-0000-4000-8000-000000000004'::uuid,
    pg_catalog.jsonb_build_object(
      'expectedEtag', v_current ->> 'etag',
      'rows', pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'rowType', 'individual',
          'orderId', '92000000-0000-4000-8000-000000000004',
          'workspaceCatalogItemId', 'security-consultation-runtime',
          'quantity', 1,
          'detailInputs', pg_catalog.jsonb_build_object(
            'responsibleClinicianId',
            '99999999-9999-4999-8999-999999999999',
            'occurrenceCount', 1,
            'timing', 'now',
            'instructionSummary', '미지정 리허설'
          ),
          'detailSchemaVersion', 1,
          'priority', 'normal'
        )
      )
    )
  );
  if v_body #> '{rows,0,detailInputs}' ? 'responsibleClinicianId'
    or not v_body ? 'billingSummary'
  then
    raise exception 'missing_primary_veterinarian_resolution_mismatch';
  end if;
  execute 'reset role';

  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000005',
    true
  );
  perform pg_catalog.set_config(
    'request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}',
    true
  );
  execute 'set local role authenticated';
  v_current := public.clair_get_chart_order_draft(
    'clair-demo',
    '19426000-0000-4000-8000-000000000003'::uuid
  );
  v_body := public.clair_save_chart_order_draft(
    'clair-demo',
    '00000000-0000-4000-8000-000000000005',
    '19426000-0000-4000-8000-000000000003'::uuid,
    pg_catalog.jsonb_build_object(
      'expectedEtag', v_current ->> 'etag',
      'rows', pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'rowType', 'set',
          'orderId', '92000000-0000-4000-8000-000000000021',
          'sourceSetId', 'den194-set-kong-vomit-compact',
          'sourceSetRevisionId',
          'cc79652f-639f-8827-a9c1-9afd5246c216',
          'sourceSetRevisionNo', 1,
          'selectionIntent', pg_catalog.jsonb_build_object(
            'items', pg_catalog.jsonb_build_array(
              pg_catalog.jsonb_build_object(
                'revisionItemId',
                '92000000-0000-4000-8000-000000000020',
                'selected', true,
                'quantity', 1
              )
            )
          ),
          'childInputs', pg_catalog.jsonb_build_array(
            pg_catalog.jsonb_build_object(
              'revisionItemId',
              '92000000-0000-4000-8000-000000000020',
              'detailInputs', pg_catalog.jsonb_build_object(
                'responsibleClinicianId',
                '99999999-9999-4999-8999-999999999999',
                'occurrenceCount', 1,
                'timing', 'now',
                'instructionSummary', '세트 보안 리허설'
              ),
              'detailSchemaVersion', 1,
              'priority', 'normal'
            )
          ),
          'detailInputs', '{}'::jsonb,
          'detailSchemaVersion', 1,
          'priority', 'normal'
        )
      )
    )
  );
  select entry.value
    into v_child
  from pg_catalog.jsonb_array_elements(v_body -> 'rows') entry(value)
  where entry.value ->> 'rowType' = 'set_child';
  if v_child #>> '{detailInputs,responsibleClinicianId}' <>
      '00000000-0000-4000-8000-000000000005'
    or not v_body ? 'billingSummary'
  then
    raise exception 'set_child_runtime_resolution_mismatch';
  end if;
  execute 'reset role';

  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000003',
    true
  );
  perform pg_catalog.set_config(
    'request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',
    true
  );
  execute 'set local role authenticated';
  begin
    perform public.clair_save_chart_order_draft(
      'clair-demo',
      '00000000-0000-4000-8000-000000000003',
      '99999999-9999-4999-8999-999999999999'::uuid,
      '{}'::jsonb
    );
    raise exception 'update_only_rpc_unexpectedly_allowed';
  exception
    when others then
      v_denial_state := sqlstate;
      v_denial_message := sqlerrm;
  end;
  if v_denial_state <> '42501' or v_denial_message <> 'permission_missing' then
    raise exception 'update_only_denial_mismatch:%:%',
      v_denial_state,
      v_denial_message;
  end if;
  execute 'reset role';
end;
$rehearsal$;

rollback;

select 'clinical_master_consultation_runtime_compatibility_rehearsal_ok';
