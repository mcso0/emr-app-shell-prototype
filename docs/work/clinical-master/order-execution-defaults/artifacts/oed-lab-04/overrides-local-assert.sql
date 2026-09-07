do $override$
declare profile master.lab_result_profile_versions; binding public.workspace_lab_result_profile_bindings; intervals jsonb; first jsonb; retry jsonb; frozen jsonb;
  result jsonb; c public.order_catalog_items; o public.orders; wi public.order_fulfillment_work_items; actor uuid:=(select user_id from wp01b_actor); etag text;
  old_result jsonb; old_id uuid; version_id uuid:='97050000-0000-4000-8000-000000000071';
begin
  select * into strict profile from master.lab_result_profile_versions where profile_key='cm.lab-profile.clair-demo-cbc.dog';
  select * into strict c from public.order_catalog_items where workspace_id='clair-demo' and source_master_record_id=(select id from master.master_records where master_key='cm.order.lab.test.cbc-wbc');
  select * into strict binding from public.workspace_lab_result_profile_bindings where workspace_id='clair-demo' and order_catalog_item_id=c.id and species='dog';
  select e.id,to_jsonb(e) into strict old_id,old_result from public.lab_result_entries e where workspace_id='clair-demo' and order_id='97050000-0000-4000-8000-000000000002';
  select jsonb_agg(jsonb_build_object('testMasterKey',r->>'testMasterKey','referenceInterval',case when r->>'code'='WBC' then
    '{"low":2,"high":8,"lowInclusive":true,"highInclusive":true}'::jsonb else r->'referenceInterval' end)) into intervals
    from jsonb_array_elements(profile.definition->'rules') r where r->>'resultValueKind'='numeric';
  first:=public.clair_save_lab_profile_intervals('clair-demo',c.id,profile.id,binding.row_revision,version_id,intervals);
  retry:=public.clair_save_lab_profile_intervals('clair-demo',c.id,profile.id,binding.row_revision,version_id,intervals);
  if retry is distinct from first then raise exception 'Local interval retry differs'; end if;
  begin perform public.clair_save_lab_profile_intervals('clair-demo',c.id,profile.id,binding.row_revision,'97050000-0000-4000-8000-000000000075',intervals);
    raise exception 'Stale local binding revision accepted'; exception when others then if sqlerrm<>'lab_profile_binding_revision_conflict' then raise; end if; end;
  begin perform public.clair_save_lab_profile_intervals('clair-demo',null,profile.id,binding.row_revision,version_id,intervals);
    raise exception 'Null catalog replay accepted'; exception when others then if sqlerrm<>'invalid_lab_profile_intervals' then raise; end if; end;
  begin perform public.clair_save_lab_profile_intervals('clair-demo',c.id,profile.id,binding.row_revision,version_id,intervals||intervals);
    raise exception 'Duplicate intervals accepted'; exception when others then if sqlerrm<>'invalid_lab_profile_intervals' then raise; end if; end;
  if not exists(select 1 from public.lab_result_entries e where e.id=old_id and to_jsonb(e)=old_result) then raise exception 'Local interval edit changed prior result'; end if;
  insert into public.orders(id,workspace_id,encounter_id,order_type,display_name,status,requested_by_user_id,requested_at,
    clinical_order_type,destination_module,execution_mode,detail_schema_version,detail_inputs,applied_snapshot,billing_eligible,
    billing_reflection_enabled,quantity,unit_price_snapshot,workspace_catalog_item_id,workspace_catalog_revision,source_master_record_id,source_master_revision)
  values('97050000-0000-4000-8000-000000000072','clair-demo','97030000-0000-4000-8000-000000000002','lab','Workspace range WBC','requested',actor,now(),
    'clinical_lab','lab','routed',1,c.default_detail_inputs,private.clair_build_catalog_order_snapshot('clair-demo',c.id,1),c.billing_eligible,false,1,0,c.id,c.catalog_revision,c.source_master_record_id,c.source_master_revision);
  select * into strict o from public.orders where id='97050000-0000-4000-8000-000000000072';
  if o.selected_lab_profile_override_id is distinct from version_id or o.selected_lab_profile_version_id is distinct from profile.id then raise exception 'New order did not seed exact local binding'; end if;
  etag:=private.clair_b3_order_draft_etag('clair-demo',o.encounter_id);
  perform public.clair_confirm_chart_order_candidates('clair-demo',actor,o.encounter_id,array[o.id],etag,'lab04-override-confirm-001');
  select * into strict wi from public.order_fulfillment_work_items where order_id=o.id;
  result:=public.clair_get_lab_result_entry('clair-demo',actor,null,wi.id,o.id); frozen:=result->'resultDefinitionSnapshot';
  if frozen#>>'{resultProfile,workspaceOverride,id}' is distinct from version_id::text or frozen#>>'{rows,0,interpretationRule,referenceInterval,high}' is distinct from '8' then raise exception 'Local range freeze missing: %',frozen; end if;
  perform private.clair_assert_lab_result_profile_snapshot('clair-demo',frozen);
  begin update public.orders set selected_lab_profile_override_id=null where id=o.id; raise exception 'Confirmed local pin mutable';
    exception when others then if sqlerrm<>'confirmed_lab_profile_immutable' then raise; end if; end;
  begin perform private.clair_lab_profile_with_override('clair-foreign-demo',c.id,profile.id,version_id); raise exception 'Foreign local profile leaked';
    exception when others then if sqlerrm<>'lab_profile_override_scope_mismatch' then raise; end if; end;
  select * into strict binding from public.workspace_lab_result_profile_bindings where workspace_id='clair-demo' and order_catalog_item_id=c.id and species='dog';
  select jsonb_agg(jsonb_build_object('testMasterKey',r->>'testMasterKey','referenceInterval',null)) into intervals from jsonb_array_elements(profile.definition->'rules') r where r->>'resultValueKind'='numeric';
  perform public.clair_save_lab_profile_intervals('clair-demo',c.id,profile.id,binding.row_revision,'97050000-0000-4000-8000-000000000073',intervals);
  begin perform public.clair_save_lab_profile_intervals('clair-demo',c.id,profile.id,1,version_id,intervals);
    raise exception 'Divergent interval replay accepted'; exception when others then if sqlerrm<>'lab_profile_override_request_conflict' then raise; end if; end;
  select * into strict binding from public.workspace_lab_result_profile_bindings where workspace_id='clair-demo' and order_catalog_item_id=c.id and species='dog';
  perform public.clair_bind_workspace_lab_result_profile('clair-demo',c.id,profile.id,binding.device_id,binding.row_revision);
  if not exists(select 1 from public.workspace_lab_result_profile_bindings b join public.workspace_lab_profile_override_versions v on v.workspace_id=b.workspace_id and v.id=b.override_version_id
    where b.workspace_id='clair-demo' and b.order_catalog_item_id=c.id and b.species='dog' and v.id='97050000-0000-4000-8000-000000000073'
      and not exists(select 1 from jsonb_array_elements(v.rules) r where r->'referenceInterval' is distinct from 'null'::jsonb)) then raise exception 'Same profile rebind discarded explicit null intervals'; end if;
  perform private.clair_assert_lab_result_profile_snapshot('clair-demo',frozen);
  result:=public.clair_get_lab_result_entry('clair-demo',actor,null,wi.id,o.id);
  if result->'resultDefinitionSnapshot' is distinct from frozen then raise exception 'Later interval clear changed frozen result'; end if;
  raise notice 'PASS workspace interval override/CAS/retry/clear/new-request pin/confirmed and foreign guards/immutable prior result';
end $override$;
