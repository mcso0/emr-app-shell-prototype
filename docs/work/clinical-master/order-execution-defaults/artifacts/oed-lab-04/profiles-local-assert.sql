do $cbc$
declare p jsonb:=(select payload from lab04_cbc_payload); result jsonb; retry jsonb; first jsonb; v_release_id uuid; actor uuid:=(select user_id from wp01b_actor);
  profile master.lab_result_profile_versions; c public.order_catalog_items; o public.orders; wi public.order_fulfillment_work_items;
  stamp timestamptz; etag text; entry jsonb; row_id text; rule jsonb; frozen jsonb; low text; high text;
  retest_input jsonb; retest_order uuid; prior_fingerprint text;
  composition master.lab_composition_versions; set_id text; set_revision uuid; comp_result jsonb;
begin
  result:=private.publish_clinical_master_release(p); v_release_id:=(result->>'releaseId')::uuid;
  if (select count(*) from master.lab_result_profile_versions where release_id=v_release_id) < 6 then raise exception 'CBC six profiles missing'; end if;
  retry:=private.publish_clinical_master_release(p);
  if result->>'releaseId' is distinct from retry->>'releaseId' or retry->>'labResultProfileCount'<>'6'
    or (select count(*) from master.lab_result_profile_versions where release_id=v_release_id)<>6 then raise exception 'CBC publish retry differs'; end if;
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',v_release_id);
  select * into strict profile from master.lab_result_profile_versions where profile_key='cm.lab-profile.clair-demo-cbc.dog';
  select value into strict rule from jsonb_array_elements(profile.definition->'rules') r where value->>'code'='WBC';
  select * into strict c from public.order_catalog_items where workspace_id='clair-demo' and source_master_record_id=
    (select id from master.master_records where master_key='cm.order.lab.test.cbc-wbc');
  -- Rollback-only activation; separate production activation acceptance remains.
  update public.order_catalog_items set availability_status='active',billing_reflection_enabled=false where id=c.id;
  result:=public.clair_register_workspace_lab_device('clair-demo','97050000-0000-4000-8000-000000000001','Explicit synthetic CBC manual registration',profile.id);
  insert into public.orders(id,workspace_id,encounter_id,order_type,display_name,status,requested_by_user_id,requested_at,
    clinical_order_type,destination_module,execution_mode,detail_schema_version,detail_inputs,applied_snapshot,billing_eligible,
    billing_reflection_enabled,quantity,unit_price_snapshot,workspace_catalog_item_id,workspace_catalog_revision,source_master_record_id,source_master_revision)
  values('97050000-0000-4000-8000-000000000002','clair-demo','97030000-0000-4000-8000-000000000002',
    'lab','CBC synthetic WBC','requested',actor,now(),'clinical_lab','lab','routed',1,c.default_detail_inputs,
    private.clair_build_catalog_order_snapshot('clair-demo',c.id,1),false,false,1,0,c.id,c.catalog_revision,c.source_master_record_id,c.source_master_revision);
  select * into strict o from public.orders where id='97050000-0000-4000-8000-000000000002';
  begin
    update public.orders set selected_lab_profile_version_id=(select id from master.lab_result_profile_versions where profile_key='cm.lab-profile.clair-demo-cbc.cat'),
      selected_lab_device_id='97050000-0000-4000-8000-000000000001' where id=o.id;
    raise exception 'CBC direct unbound profile bypass accepted';
  exception when others then if sqlerrm<>'lab_result_profile_binding_required' then raise; end if; end;
  etag:=private.clair_b3_order_draft_etag('clair-demo',o.encounter_id);
  begin
    perform public.clair_confirm_chart_order_candidates('clair-demo',actor,o.encounter_id,array[o.id],etag,'lab04-confirm-missing');
    raise exception 'CBC missing profile confirmation accepted';
  exception when others then if sqlerrm<>'lab_result_profile_selection_required' then raise; end if; end;
  result:=public.clair_bind_workspace_lab_result_profile('clair-demo',c.id,profile.id,'97050000-0000-4000-8000-000000000001',0);
  retry:=public.clair_bind_workspace_lab_result_profile('clair-demo',c.id,profile.id,'97050000-0000-4000-8000-000000000001',0);
  if result is distinct from retry then raise exception 'CBC binding retry mutated'; end if;
  result:=public.clair_select_lab_order_result_profile('clair-demo',o.id,o.updated_at,profile.id,'97050000-0000-4000-8000-000000000001');
  etag:=private.clair_b3_order_draft_etag('clair-demo',o.encounter_id);
  result:=public.clair_confirm_chart_order_candidates('clair-demo',actor,o.encounter_id,array[o.id],etag,'lab04-confirm-0001');
  select * into strict wi from public.order_fulfillment_work_items where order_id=o.id;
  entry:=public.clair_get_lab_result_entry('clair-demo',actor,null,wi.id,o.id);
  frozen:=entry->'resultDefinitionSnapshot'; row_id:=entry#>>'{rows,0,id}';
  begin
    update public.orders set selected_lab_profile_version_id=null,selected_lab_device_id=null where id=o.id;
    raise exception 'CBC confirmed profile changed';
  exception when others then if sqlerrm<>'confirmed_lab_profile_immutable' then raise; end if; end;
  if frozen->>'schemaVersion'<>'2' or frozen#>>'{resultProfile,versionId}'<>profile.id::text
    or frozen#>'{rows,0,interpretationRule}' is distinct from rule or entry#>>'{rows,0,value}' is not null then raise exception 'CBC profile freeze mismatch: %',entry; end if;
  perform public.clair_transition_fulfillment_work_item('clair-demo',actor,wi.id,'start',wi.row_revision,'97050000-0000-4000-8000-000000000003',null,null,null);
  entry:=public.clair_save_lab_result_entry_v2('clair-demo',actor,entry->>'resultId',o.encounter_id,o.id,wi.id,0,
    '97050000-0000-4000-8000-000000000004',jsonb_build_array(jsonb_build_object('rowId',row_id,'value','  ','note',null)));
  if entry#>>'{rows,0,value}' is not null or entry#>>'{rows,0,resultState}'<>'not_entered' or entry#>>'{rows,0,judgment}'<>'not_judged' then raise exception 'CBC blank became zero'; end if;
  if private.clair_evaluate_lab_profile_value(rule,'0')->>'judgment'<>'low'
    or private.clair_evaluate_lab_profile_value(rule,'4','less_than')->>'judgment'<>'not_judged'
    or private.clair_evaluate_lab_profile_value(rule,'4','exact','Review smear')->>'state'<>'flagged_result'
    or private.clair_evaluate_lab_profile_value(rule,null,'exact',null,'instrument_no_result')->>'state'<>'instrument_no_result' then
    raise exception 'CBC typed result semantics mismatch'; end if;
  begin perform private.clair_evaluate_lab_profile_value(rule,'-1'); raise exception 'CBC negative accepted';
    exception when others then if sqlerrm<>'invalid_number' then raise; end if; end;
  select * into wi from public.order_fulfillment_work_items where id=wi.id;
  begin
    perform public.clair_transition_fulfillment_work_item('clair-demo',actor,wi.id,'complete',wi.row_revision,'97050000-0000-4000-8000-000000000005',null,null,null);
    raise exception 'CBC empty required completion accepted';
  exception when others then if sqlerrm<>'required_lab_results_incomplete' then raise; end if; end;
  low:=rule#>>'{referenceInterval,low}'; high:=rule#>>'{referenceInterval,high}';
  first:=public.clair_save_lab_result_entry_v2('clair-demo',actor,entry->>'resultId',o.encounter_id,o.id,wi.id,1,
    '97050000-0000-4000-8000-000000000006',jsonb_build_array(jsonb_build_object('rowId',row_id,'value',low,'note',null)));
  if first#>>'{rows,0,judgment}'<>'normal' then raise exception 'CBC low inclusive boundary wrong: %',first; end if;
  entry:=public.clair_save_lab_result_entry_v2('clair-demo',actor,entry->>'resultId',o.encounter_id,o.id,wi.id,2,
    '97050000-0000-4000-8000-000000000007',jsonb_build_array(jsonb_build_object('rowId',row_id,'value',((high::numeric)+0.01)::text,'note',null)));
  if entry#>>'{rows,0,judgment}'<>'high' or entry->>'abnormalFlag'<>'high' then raise exception 'CBC high flag missing: %',entry; end if;
  retry:=public.clair_save_lab_result_entry_v2('clair-demo',actor,entry->>'resultId',o.encounter_id,o.id,wi.id,1,
    '97050000-0000-4000-8000-000000000006',jsonb_build_array(jsonb_build_object('rowId',row_id,'value',low,'note',null)));
  if retry is distinct from first then raise exception 'CBC old write retry did not return exact outcome'; end if;
  if entry->'resultDefinitionSnapshot' is distinct from frozen then raise exception 'CBC result rewrite altered profile freeze'; end if;
  perform private.clair_assert_lab_result_definition_snapshot('clair-demo',(entry->>'resultEntryId')::uuid);
  perform public.clair_transition_fulfillment_work_item('clair-demo',actor,wi.id,'complete',wi.row_revision,'97050000-0000-4000-8000-000000000008',null,null,null);
  prior_fingerprint:=private.clinical_master_sha256(to_jsonb((select e from public.lab_result_entries e where e.workspace_id='clair-demo' and e.order_id=o.id)));
  -- No-charge is a request reflection choice, not a change to master eligibility.
  update public.order_catalog_items set billing_eligible=true where workspace_id='clair-demo' and id=c.id;
  retest_input:=jsonb_build_object('requestId','97050000-0000-4000-8000-000000000009','resultId',entry->>'resultId','rowId',row_id,
    'expectedEntryWriteRevision',3,'reason','Explicit synthetic WBC repeat','specimenDecision','new_specimen','specimenReference','synthetic-new-edta-002',
    'billingPolicy','no_charge','profileVersionId',profile.id,'deviceId','97050000-0000-4000-8000-000000000001');
  result:=public.clair_create_lab_atomic_retest('clair-demo',retest_input);
  retry:=public.clair_create_lab_atomic_retest('clair-demo',retest_input);
  if retry is distinct from result then raise exception 'CBC atomic retest retry differs'; end if;
  retest_order:=(result->>'orderId')::uuid;
  if retest_order=o.id or not exists(select 1 from public.orders where id=retest_order and workspace_id='clair-demo' and order_confirmation_status='draft'
    and billing_eligible and not billing_reflection_enabled and selected_lab_profile_version_id=profile.id)
    or exists(select 1 from public.lab_result_entries where workspace_id='clair-demo' and order_id=retest_order) then raise exception 'CBC retest did not create independent unperformed draft'; end if;
  if private.clinical_master_sha256(to_jsonb((select e from public.lab_result_entries e where e.workspace_id='clair-demo' and e.order_id=o.id)))<>prior_fingerprint then raise exception 'CBC retest overwrote prior result'; end if;
  begin perform public.clair_create_lab_atomic_retest('clair-demo',retest_input||jsonb_build_object('reason','Changed retry'));
    raise exception 'CBC retest divergent retry accepted'; exception when others then if sqlerrm<>'lab_retest_idempotency_conflict' then raise; end if; end;
  etag:=private.clair_b3_order_draft_etag('clair-demo',o.encounter_id);
  perform public.clair_confirm_chart_order_candidates('clair-demo',actor,o.encounter_id,array[retest_order],etag,'lab04-retest-confirm-001');
  if exists(select 1 from public.order_billing_candidates where workspace_id='clair-demo' and order_id=retest_order) then raise exception 'CBC no-charge retest generated billing candidate'; end if;
  if not exists(select 1 from public.lab_result_entries where workspace_id='clair-demo' and order_id=retest_order and entry_write_revision=0
    and id<>(entry->>'resultEntryId')::uuid) then raise exception 'CBC retest new result freeze missing'; end if;
  begin update master.lab_result_profile_versions set definition=definition where id=profile.id;
    raise exception 'CBC profile mutable'; exception when sqlstate '55000' then null; end;
  select * into strict composition from master.lab_composition_versions where master_key='cm.lab-composition.synthetic-cbc-checkup';
  if jsonb_array_length(composition.expanded_leaves)<>26 or jsonb_array_length(composition.expanded_leaves#>'{0,path}')<>3 then raise exception 'CBC checkup hierarchy lost'; end if;
  -- Rollback-only availability fixture, never an activation/publish claim.
  update public.order_catalog_items set availability_status='active',billing_reflection_enabled=false where workspace_id='clair-demo' and source_master_record_id in (
    select (leaf->>'sourceMasterOrderRecordId')::uuid from jsonb_array_elements(composition.expanded_leaves) leaf);
  comp_result:=public.clair_apply_lab_composition('clair-demo',composition.id,'no_charge',null,'97050000-0000-4000-8000-000000000041');
  retry:=public.clair_apply_lab_composition('clair-demo',composition.id,'no_charge',null,'97050000-0000-4000-8000-000000000041');
  if retry is distinct from comp_result then raise exception 'CBC composition retry differs'; end if;
  set_id:=comp_result->>'orderSetId'; set_revision:=(comp_result->>'orderSetRevisionId')::uuid;
  if (select count(*) from public.order_set_revision_items where workspace_id='clair-demo' and revision_id=set_revision)<>26
    or (select count(*) from public.order_set_revision_items where workspace_id='clair-demo' and revision_id=set_revision and default_selected)<>20 then raise exception 'CBC leaf selection mismatch'; end if;
  if exists(select 1 from public.order_set_revision_items where workspace_id='clair-demo' and revision_id=set_revision and billing_reflection_default) then raise exception 'CBC no-charge composition billed child'; end if;
  perform private.clair_assert_order_set_revision_integrity('clair-demo',set_id,set_revision);
  raise notice 'OED-LAB04 CBC profile publish/explicit choice/freeze/blank/flags/required completion/write retry verified locally';
end $cbc$;
