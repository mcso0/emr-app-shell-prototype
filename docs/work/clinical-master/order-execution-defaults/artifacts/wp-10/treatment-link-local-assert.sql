-- Only named synthetic fixture, under enclosing rollback. Exercise real APIs.
do $medication$
declare actor uuid:=(select user_id from wp01b_actor); c public.order_catalog_items; o public.orders;
  wi public.order_fulfillment_work_items; etag text; result jsonb; ctx jsonb; plan jsonb;
  medication uuid:='97081000-0000-4000-8000-000000000031'; target_order uuid:='97081000-0000-4000-8000-000000000030';
  before_count integer; rev integer;
begin
  plan:='{"procedureKind":"administration","method":"Synthetic planned treatment","plannedProcedureCount":1,"procedureCountUnit":"session","frequency":"once","schedule":"Synthetic planned time","administrationPolicy":"separate_medication_order","stagedInstructions":"Synthetic instruction","exceptions":"Hold if medication unresolved"}';
  if not private.clair_order_detail_inputs_are_valid('treatment',3,plan,true)
    or private.clair_order_detail_inputs_are_valid('treatment',2,plan,true) then raise exception 'test V3 planning or V2 history invalid'; end if;
  select * into strict c from public.order_catalog_items where workspace_id='clair-demo' and clinical_order_type='treatment' and detail_schema_version=2 order by id limit 1;
  insert into public.order_catalog_items(id,workspace_id,standard_order_id,source_preset_version,
    category_group,category_label,standard_order_name,in_hospital_order_name,billing_name,availability_status,
    billing_reflection_enabled,price_krw,default_destination_module,default_task_required,classification_path_id,clinical_order_type,
    destination_module,execution_mode,detail_schema_version,detail_field_schema,billing_eligible)
  values('wp10-treatment-link','clair-demo','wp10-treatment-link','synthetic-wp10','treatment','Synthetic treatment',
    'WP10 synthetic treatment','WP10 synthetic treatment','WP10 synthetic treatment','active',false,0,'treatment',true,c.classification_path_id,
    'treatment','treatment','routed',3,private.clair_order_detail_field_schema('treatment',3),false) returning * into c;
  insert into public.orders(id,workspace_id,encounter_id,order_type,display_name,status,requested_by_user_id,requested_at,
    clinical_order_type,destination_module,execution_mode,detail_schema_version,detail_inputs,applied_snapshot,billing_eligible,
    billing_reflection_enabled,quantity,unit_price_snapshot,workspace_catalog_item_id,workspace_catalog_revision)
  values(target_order,'clair-demo','97030000-0000-4000-8000-000000000002','treatment','WP10 synthetic medication-linked treatment','requested',actor,now(),
    'treatment','treatment','routed',3,plan,private.clair_build_catalog_order_snapshot('clair-demo',c.id,1),false,false,1,0,c.id,c.catalog_revision);
  insert into public.order_catalog_items(id,workspace_id,standard_order_id,source_preset_version,
    category_group,category_label,standard_order_name,in_hospital_order_name,billing_name,availability_status,
    billing_reflection_enabled,price_krw,default_destination_module,default_task_required,classification_path_id,clinical_order_type,
    destination_module,execution_mode,detail_schema_version,detail_field_schema,billing_eligible)
  select 'wp10-medication','clair-demo','wp10-medication','synthetic-wp10','medication','Synthetic medication',
    'WP10 synthetic medication','WP10 synthetic medication','WP10 synthetic medication','active',false,0,'dispensing',true,id,
    'dispensing','dispensing','routed',1,private.clair_order_detail_field_schema('dispensing',1),false
    from master.classification_paths where path_key='cm.path.dispensing';
  select * into strict c from public.order_catalog_items where id='wp10-medication';
  insert into public.orders(id,workspace_id,encounter_id,order_type,display_name,status,requested_by_user_id,requested_at,
    clinical_order_type,destination_module,execution_mode,detail_schema_version,detail_inputs,applied_snapshot,billing_eligible,
    billing_reflection_enabled,quantity,unit_price_snapshot,workspace_catalog_item_id,workspace_catalog_revision)
  values(medication,'clair-demo','97030000-0000-4000-8000-000000000002','dispensing','WP10 synthetic medication','requested',actor,now(),
    'dispensing','dispensing','routed',1,'{"doseBasis":"patient","dose":1,"doseUnit":"tablet","route":"PO","frequency":"once","durationDays":1,"totalQuantity":1}',
    private.clair_build_catalog_order_snapshot('clair-demo',c.id,1)||'{"planOrderAuthority":{"schemaVersion":2,"calculationMode":"product_unit","dispenseUnit":"tablet","preparationPolicy":{"quantityScope":"course_total","increment":0.5,"roundingMode":"up","displayPrecision":1,"noReasonTolerance":0.1},"priceBasis":"per_product_unit","billingUnit":"tablet","taxClass":"taxable"}}'::jsonb,
    false,false,1,0,c.id,c.catalog_revision);
  select count(*) into before_count from public.orders;
  etag:=private.clair_b3_order_draft_etag('clair-demo','97030000-0000-4000-8000-000000000002');
  perform public.clair_confirm_chart_order_candidates('clair-demo',actor,'97030000-0000-4000-8000-000000000002',array[target_order],etag,'wp10-treatment-plan');
  if (select count(*) from public.orders)<>before_count then raise exception 'test companion drug auto-created'; end if;
  select * into strict wi from public.order_fulfillment_work_items where order_id=target_order;
  begin
    perform public.clair_transition_fulfillment_work_item('clair-demo',actor,wi.id,'start',wi.row_revision,extensions.gen_random_uuid(),null,null,null);
    raise exception 'test unlinked start accepted';
  exception when others then if sqlerrm<>'treatment_medication_link_required' then raise; end if; end;
  select * into strict o from public.orders where id=target_order;
  begin
    perform public.clair_mutate_chart_order_execution('clair-demo',actor,o.id,'amend','Synthetic downgrade attempt',o.revision_no,
      jsonb_build_object('detailSchemaVersion',2,'detailInputs',plan||jsonb_build_object('linkedMedicationOrderId',medication)),'wp10-treatment-downgrade');
    raise exception 'test V3 downgrade accepted';
  exception when others then if sqlerrm<>'treatment_plan_version_downgrade' then raise; end if; end;
  begin
    perform public.clair_mutate_chart_order_execution('clair-demo',actor,o.id,'amend','Synthetic wrong type link',o.revision_no,
      jsonb_build_object('detailSchemaVersion',3,'detailInputs',plan||jsonb_build_object('linkedMedicationOrderId','97081000-0000-4000-8000-000000000001')),'wp10-treatment-invalid-link');
    raise exception 'test wrong link accepted';
  exception when others then if sqlerrm<>'treatment_medication_link_invalid' then raise; end if; end;
  perform public.clair_mutate_chart_order_execution('clair-demo',actor,o.id,'amend','Synthetic explicit medication linkage',o.revision_no,
    jsonb_build_object('detailSchemaVersion',3,'detailInputs',plan||jsonb_build_object('linkedMedicationOrderId',medication)),'wp10-treatment-link');
  select * into strict wi from public.order_fulfillment_work_items item where item.id=wi.id;
  begin
    perform public.clair_transition_fulfillment_work_item('clair-demo',actor,wi.id,'start',wi.row_revision,extensions.gen_random_uuid(),null,null,null);
    raise exception 'test draft medication start accepted';
  exception when others then if sqlerrm<>'treatment_medication_link_invalid' then raise; end if; end;
  perform public.clair_save_order_actual_dispense_override('clair-demo',actor,medication,(select updated_at from public.orders where id=medication),1,'Synthetic explicit preparation','wp10-medication-prepare');
  etag:=private.clair_b3_order_draft_etag('clair-demo',o.encounter_id);
  perform public.clair_confirm_chart_order_candidates('clair-demo',actor,o.encounter_id,array[medication],etag,'wp10-medication-confirm');
  perform public.clair_transition_fulfillment_work_item('clair-demo',actor,wi.id,'start',wi.row_revision,extensions.gen_random_uuid(),null,null,null);
  -- Cancel only inside a savepoint so a valid execution can also be proven.
  begin
    select revision_no into rev from public.orders where id=medication;
    perform public.clair_mutate_chart_order_execution('clair-demo',actor,medication,'cancel','Synthetic medication cancellation',rev,'{}','wp10-medication-cancel');
    select * into strict wi from public.order_fulfillment_work_items item where item.id=wi.id;
    ctx:=public.clair_get_order_execution_context('clair-demo',wi.id);
    begin
      perform public.clair_record_order_execution_result('clair-demo',actor,wi.id,wi.row_revision,ctx->>'planSha256',0,extensions.gen_random_uuid(),now(),
        '{"performedProcedure":"Synthetic manual treatment","outcome":"Synthetic outcome","performedCount":1,"performedCountUnit":"session"}',null,null);
      raise exception 'test cancelled medication completion accepted';
    exception when others then if sqlerrm<>'treatment_medication_link_invalid' then raise; end if; end;
    select revision_no into rev from public.orders where id=target_order;
    perform public.clair_mutate_chart_order_execution('clair-demo',actor,target_order,'cancel','Synthetic safe treatment cancel',rev,'{}','wp10-treatment-cancel');
    raise exception 'test savepoint restore';
  exception when others then if sqlerrm<>'test savepoint restore' then raise; end if; end;
  select * into strict wi from public.order_fulfillment_work_items item where item.id=wi.id;
  ctx:=public.clair_get_order_execution_context('clair-demo',wi.id);
  result:=public.clair_record_order_execution_result('clair-demo',actor,wi.id,wi.row_revision,ctx->>'planSha256',0,extensions.gen_random_uuid(),now(),
    '{"performedProcedure":"Synthetic manual treatment","outcome":"Synthetic outcome","performedCount":1,"performedCountUnit":"session"}',null,null);
  if result->>'status'<>'completed' then raise exception 'test linked treatment not completed'; end if;
  raise notice 'WP10 V3 unlinked confirm, blocked start/downgrade/invalid link, explicit amendment/start/actual, cancelled drug blocks completion but allows cancellation passed';
end $medication$;
