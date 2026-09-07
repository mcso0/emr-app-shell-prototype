-- Parent harness supplies wp07_remaining_payload; same transaction as WP03/06 fixtures.
-- Entire file is synthetic local validation and must be followed by ROLLBACK.
do $defaults$
declare p jsonb:=(select payload from wp07_remaining_payload); result jsonb; release_id uuid; r jsonb; c public.order_catalog_items; before_retry text;
  original_path jsonb:=(select to_jsonb(path) from master.classification_paths path where path_key='cm.path.inpatient');
begin
  if (select count(*) from jsonb_array_elements(p->'records') where value->>'recordType'='order')<>136 then raise exception 'WP07 expected136'; end if;
  for r in select value from jsonb_array_elements(p->'records') where value->>'recordType'='order' loop
    if not private.clair_order_execution_preset_contract_is_valid(r#>>'{detail,executionPreset,clinicalOrderType}',1,
      r#>'{detail,executionPreset,defaultDetailInputs}',r#>'{detail,executionPreset,fieldPolicies}') then raise exception 'WP07 preset invalid %',r->>'masterKey'; end if;
  end loop;
  result:=private.publish_clinical_master_release(p); release_id:=(result->>'releaseId')::uuid;
  if (private.publish_clinical_master_release(p)->>'releaseId')::uuid is distinct from release_id then raise exception 'WP07 publish retry changed'; end if;
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  for r in select value from jsonb_array_elements(p->'records') where value->>'recordType'='order' loop
    select * into strict c from public.order_catalog_items where workspace_id='clair-demo' and source_master_record_id=
      (select id from master.master_records where master_key=r->>'masterKey');
    if c.default_detail_inputs is distinct from r#>'{detail,executionPreset,defaultDetailInputs}' then raise exception 'WP07 default copy mismatch %',r->>'masterKey'; end if;
    if c.clinical_order_type='hospitalization' and (c.destination_module<>'treatment' or c.execution_mode<>'routed'
      or c.classification_path_id is distinct from (select id from master.classification_paths where path_key='cm.path.inpatient-care-runtime')) then raise exception 'WP07 inpatient source route mismatch'; end if;
  end loop;
  before_retry:=md5((select jsonb_agg(to_jsonb(x) order by id)::text from public.order_catalog_items x where workspace_id='clair-demo'));
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  if before_retry is distinct from md5((select jsonb_agg(to_jsonb(x) order by id)::text from public.order_catalog_items x where workspace_id='clair-demo')) then raise exception 'WP07 adopt retry changed'; end if;
  if exists(select 1 from public.order_catalog_items f where f.workspace_id='clair-foreign-demo' and not exists(
    select 1 from taxonomy_foreign_before b where b.row=to_jsonb(f))) then raise exception 'WP07 foreign catalog changed'; end if;
  if original_path is distinct from (select to_jsonb(path) from master.classification_paths path where path_key='cm.path.inpatient') then
    raise notice 'WP07 legacy path diff %',(select jsonb_object_agg(key,jsonb_build_object('before',original_path->key,'after',to_jsonb(path)->key))
      from master.classification_paths path cross join jsonb_object_keys(original_path) key where path.path_key='cm.path.inpatient' and original_path->key is distinct from to_jsonb(path)->key);
    raise exception 'WP07 shared legacy path changed'; end if;
  raise notice 'WP07 all136 exact identities/species/presets publish/adopt/retry; foreign catalog preserved';
end $defaults$;

do $location$
declare actor uuid:=(select user_id from wp01b_actor); result jsonb; retry jsonb; c public.order_catalog_items; o public.orders;
  wi public.order_fulfillment_work_items; etag text; ctx jsonb; frozen jsonb; stamp timestamptz:=now(); command jsonb;
begin
  if has_table_privilege('authenticated','public.workspace_inpatient_locations','INSERT')
    or has_table_privilege('authenticated','public.workspace_inpatient_location_events','UPDATE')
    or has_function_privilege('anon','public.clair_get_workspace_inpatient_locations(text)','EXECUTE') then raise exception 'WP07 direct/anonymous privilege leak'; end if;
  result:=public.clair_get_workspace_inpatient_locations('clair-demo');
  if jsonb_array_length(result->'locations')<>0 then raise exception 'WP07 fallback room seeded'; end if;
  perform set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
  begin perform public.clair_get_workspace_inpatient_locations('clair-demo'); raise exception 'WP07 foreign actor accepted';
    exception when others then if sqlerrm<>'workspace_membership_missing' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  command:='{"id":"97070000-0000-4000-8000-000000000001","label":"Synthetic registered cage A","kind":"cage","active":true,"expectedRevision":0}'::jsonb;
  result:=public.clair_save_workspace_inpatient_location('clair-demo',command);
  retry:=public.clair_save_workspace_inpatient_location('clair-demo',command);
  if result is distinct from retry or jsonb_array_length(result->'locations')<>1 then raise exception 'WP07 register exact retry changed'; end if;
  begin perform public.clair_save_workspace_inpatient_location('clair-demo',command||'{"label":"stale overwrite"}'); raise exception 'WP07 stale update accepted';
    exception when others then if sqlerrm<>'inpatient_location_revision_conflict' then raise; end if; end;
  if (select count(*) from public.workspace_inpatient_location_events where location_id=(command->>'id')::uuid)<>1 then raise exception 'WP07 retry duplicate audit'; end if;
  -- Registered foreign control is explicitly inserted only in this rollback fixture.
  insert into public.workspace_inpatient_locations(id,workspace_id,label,kind,created_by_user_id,updated_by_user_id)
    values('97070000-0000-4000-8000-000000000002','clair-foreign-demo','Synthetic foreign cage','cage',actor,actor);
  select * into strict c from public.order_catalog_items where workspace_id='clair-demo' and source_master_record_id=
    (select id from master.master_records where master_key='cm.order.v4.inpatient.02');
  update public.order_catalog_items set availability_status='active',billing_reflection_enabled=false where id=c.id returning * into c;
  insert into public.orders(id,workspace_id,encounter_id,order_type,display_name,status,requested_by_user_id,requested_at,
    clinical_order_type,destination_module,execution_mode,detail_schema_version,detail_inputs,applied_snapshot,billing_eligible,
    billing_reflection_enabled,quantity,unit_price_snapshot,workspace_catalog_item_id,workspace_catalog_revision)
  values('97070000-0000-4000-8000-000000000003','clair-demo','97030000-0000-4000-8000-000000000002',
    'treatment','WP07 synthetic inpatient observation','requested',actor,now(),c.clinical_order_type,c.destination_module,c.execution_mode,c.detail_schema_version,
    c.default_detail_inputs||'{"wardOrCage":"97070000-0000-4000-8000-000000000002"}',
    private.clair_build_catalog_order_snapshot('clair-demo',c.id,1),c.billing_eligible,false,1,0,c.id,c.catalog_revision);
  select * into o from public.orders where id='97070000-0000-4000-8000-000000000003';
  if o.clinical_order_type<>'hospitalization' or o.destination_module<>'treatment' or o.execution_mode<>'routed' then raise exception 'WP07 care route not active'; end if;
  etag:=private.clair_b3_order_draft_etag('clair-demo',o.encounter_id);
  begin perform public.clair_confirm_chart_order_candidates('clair-demo',actor,o.encounter_id,array[o.id],etag,'wp07-foreign'); raise exception 'WP07 foreign location accepted';
    exception when others then if sqlerrm<>'inpatient_location_unavailable' then raise; end if; end;
  update public.orders set detail_inputs=detail_inputs||jsonb_build_object('wardOrCage',command->>'id') where id=o.id;
  perform public.clair_save_workspace_inpatient_location('clair-demo',command||'{"active":false,"expectedRevision":1}');
  etag:=private.clair_b3_order_draft_etag('clair-demo',o.encounter_id);
  begin perform public.clair_confirm_chart_order_candidates('clair-demo',actor,o.encounter_id,array[o.id],etag,'wp07-inactive'); raise exception 'WP07 inactive location accepted';
    exception when others then if sqlerrm<>'inpatient_location_unavailable' then raise; end if; end;
  perform public.clair_save_workspace_inpatient_location('clair-demo',command||'{"expectedRevision":2}');
  result:=public.clair_confirm_chart_order_candidates('clair-demo',actor,o.encounter_id,array[o.id],etag,'wp07-confirm-1');
  select confirmed_snapshot into frozen from public.orders where id=o.id;
  if frozen#>>'{inpatientLocation,id}' is distinct from command->>'id' or frozen#>>'{inpatientLocation,label}'<>'Synthetic registered cage A'
    or frozen#>>'{inpatientLocation,rowRevision}'<>'3' then raise exception 'WP07 frozen location missing'; end if;
  select * into strict wi from public.order_fulfillment_work_items where order_id=o.id;
  if not exists(select 1 from public.order_tasks where id=wi.task_id and effective_snapshot->'inpatientLocation'=frozen->'inpatientLocation') then raise exception 'WP07 task lost location snapshot'; end if;
  -- Later management changes must not rewrite a confirmed plan or block its history.
  perform public.clair_save_workspace_inpatient_location('clair-demo',command||'{"label":"Synthetic renamed cage","active":false,"expectedRevision":3}');
  perform public.clair_transition_fulfillment_work_item('clair-demo',actor,wi.id,'start',wi.row_revision,
    '97070000-0000-4000-8000-000000000004',null,null,null);
  select * into wi from public.order_fulfillment_work_items where id=wi.id;
  ctx:=public.clair_get_order_execution_context('clair-demo',wi.id);
  if jsonb_array_length(ctx->'results')<>0 then raise exception 'WP07 fabricated actual'; end if;
  result:=public.clair_record_order_execution_result('clair-demo',actor,wi.id,wi.row_revision,ctx->>'planSha256',0,
    '97070000-0000-4000-8000-000000000005',stamp,'{"performedActivity":"Synthetic manually documented observation","outcome":"Synthetic manual handoff completed"}',null,null);
  if result->>'status'<>'completed' or (select confirmed_snapshot from public.orders where id=o.id) is distinct from frozen then raise exception 'WP07 actual changed frozen plan'; end if;
  if exists(select 1 from public.order_billing_candidates where order_id=o.id) then raise exception 'WP07 nonbillable order billed'; end if;
  raise notice 'WP07 real resource register/CAS/retry/audit; foreign+inactive confirm denied; ID/label frozen; actual complete; billing unchanged';
end $location$;
