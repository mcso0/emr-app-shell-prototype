do $treatment$
declare p jsonb:=(select payload from wp04_treatment_payload); r jsonb; result jsonb; release_id uuid;
  c public.order_catalog_items; before_retry text; defaults jsonb; preserved jsonb;
begin
  for r in select value from jsonb_array_elements(p->'records') loop
    defaults:=r#>'{detail,executionPreset,defaultDetailInputs}';
    if not private.clair_order_execution_preset_contract_is_valid('treatment',2,defaults,r#>'{detail,executionPreset,fieldPolicies}') then
      raise exception 'treatment preset contract invalid: %',r->>'masterKey'; end if;
    if defaults ? 'administeredAmount' then raise exception 'actual amount in planned V2'; end if;
    if defaults->>'administrationPolicy'='separate_medication_order' then
      if private.clair_order_detail_inputs_are_valid('treatment',2,defaults,true) then raise exception 'missing patient medication link accepted'; end if;
    elsif not private.clair_order_detail_inputs_are_valid('treatment',2,defaults,true) then
      raise exception 'treatment nonmedication plan incomplete: %',r->>'masterKey'; end if;
  end loop;
  result:=private.publish_clinical_master_release(p); release_id:=(result->>'releaseId')::uuid;
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  if (select count(*) from public.order_catalog_items catalog join master.master_records m on m.id=catalog.source_master_record_id
    where catalog.workspace_id='clair-demo' and m.master_key in (select value->>'masterKey' from jsonb_array_elements(p->'records'))
      and catalog.detail_schema_version=2)<>111 then raise exception 'treatment all111 V2 copy missing'; end if;
  select * into strict c from public.order_catalog_items where workspace_id='clair-demo' and source_master_record_id=
    (select id from master.master_records where master_key='cm.order.v4.surgery-anesthesia.33');
  if c.default_detail_inputs->>'procedureCountUnit'<>'load' or c.default_detail_inputs ? 'administeredAmount'
    or c.detail_field_schema->>'version'<>'2' then raise exception 'sterilization preparation is not typed load'; end if;
  before_retry:=md5((select jsonb_agg(to_jsonb(x) order by id)::text from public.order_catalog_items x where workspace_id='clair-demo'));
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  if before_retry is distinct from md5((select jsonb_agg(to_jsonb(x) order by id)::text from public.order_catalog_items x where workspace_id='clair-demo')) then
    raise exception 'treatment adoption retry mutated catalog'; end if;
  preserved:=to_jsonb(c);
  result:=public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,
    jsonb_build_object('defaultDetailInputs',c.default_detail_inputs||'{"plannedProcedureCount":2}'));
  select * into c from public.order_catalog_items where id=c.id;
  if c.default_detail_inputs->>'plannedProcedureCount'<>'2' or c.detail_schema_version<>2 then raise exception 'treatment V2 admin edit failed'; end if;
  if c.price_krw is distinct from (preserved->>'price_krw')::numeric then raise exception 'treatment edit changed price'; end if;
  -- Rollback-only fixture activation for snapshot/search; production activation
  -- remains a separate WP09 acceptance, not claimed by this narrow test.
  update public.order_catalog_items set availability_status='active',billing_reflection_enabled=false where id=c.id;
  select * into c from public.order_catalog_items where id=c.id;
  result:=private.clair_build_catalog_order_snapshot('clair-demo',c.id,1);
  if result->>'detailSchemaVersion'<>'2' then raise exception 'treatment snapshot version lost: %',result; end if;
  if not exists(select 1 from public.clair_list_order_catalog_chart_search_v2('clair-demo') row
    where row.applied_snapshot->>'workspaceCatalogItemId'=c.id and row.applied_snapshot->>'detailSchemaVersion'='2') then
    raise exception 'treatment chart search version lost'; end if;
  if exists(select 1 from public.order_catalog_items f where f.workspace_id='clair-foreign-demo' and not exists(
    select 1 from taxonomy_foreign_before b where b.row=to_jsonb(f))) then raise exception 'treatment foreign changed'; end if;
  raise notice 'WP04 all111 V2 definitions published/adopted/retried and Admin edit/snapshot/search verified locally';
end $treatment$;

-- Real confirm/start/actual/amendment RPC path for the V2 tonometry scenario.
do $actual$
declare actor uuid:=(select user_id from wp01b_actor); c public.order_catalog_items; o public.orders;
  wi public.order_fulfillment_work_items; result jsonb; retry jsonb; ctx jsonb; actual jsonb; stamp timestamptz:=now();
  frozen jsonb; etag text;
begin
  select * into strict c from public.order_catalog_items where workspace_id='clair-demo' and source_master_record_id=
    (select id from master.master_records where master_key='cm.order.v4.treatment.15');
  update public.order_catalog_items set availability_status='active',billing_reflection_enabled=false where id=c.id;
  insert into public.orders(id,workspace_id,encounter_id,order_type,display_name,status,requested_by_user_id,requested_at,
    clinical_order_type,destination_module,execution_mode,detail_schema_version,detail_inputs,applied_snapshot,billing_eligible,
    billing_reflection_enabled,quantity,unit_price_snapshot,workspace_catalog_item_id,workspace_catalog_revision)
  values('97040000-0000-4000-8000-000000000001','clair-demo','97030000-0000-4000-8000-000000000002',
    'treatment','WP04 synthetic tonometry','requested',actor,now(),'treatment','treatment','routed',2,c.default_detail_inputs,
    private.clair_build_catalog_order_snapshot('clair-demo',c.id,1),false,false,1,0,c.id,c.catalog_revision);
  select * into o from public.orders where id='97040000-0000-4000-8000-000000000001';
  etag:=private.clair_b3_order_draft_etag('clair-demo',o.encounter_id);
  result:=public.clair_confirm_chart_order_candidates('clair-demo',actor,o.encounter_id,array[o.id],etag,'wp04-confirm-0001');
  select confirmed_snapshot into frozen from public.orders where id=o.id;
  if frozen->>'detailSchemaVersion'<>'2' then raise exception 'V2 confirm lost version: %',frozen; end if;
  select * into strict wi from public.order_fulfillment_work_items where order_id=o.id;
  perform public.clair_transition_fulfillment_work_item('clair-demo',actor,wi.id,'start',wi.row_revision,
    '97040000-0000-4000-8000-000000000002',null,null,null);
  select * into wi from public.order_fulfillment_work_items where id=wi.id;
  ctx:=public.clair_get_order_execution_context('clair-demo',wi.id);
  actual:='{"performedProcedure":"Synthetic tonometry","outcome":"Manual measurement recorded","performedCount":1,"performedCountUnit":"session", "measurementValue":12,"measurementUnit":"mmHg", "deviceIdentity":"Synthetic TONOVET Plus fixture","deviceSettingsPolicy":"not_adjustable"}';
  begin
    perform public.clair_record_order_execution_result('clair-demo',actor,wi.id,wi.row_revision,ctx->>'planSha256',0,
      '97040000-0000-4000-8000-000000000003',stamp,actual-'measurementValue'-'measurementUnit',null,null);
    raise exception 'V2 measurement omitted';
  exception when others then if sqlerrm<>'invalid_execution_payload' then raise; end if; end;
  begin
    perform public.clair_record_order_execution_result('clair-demo',actor,wi.id,wi.row_revision,ctx->>'planSha256',0,
      '97040000-0000-4000-8000-000000000003',stamp,actual||'{"performedCount":2}',null,null);
    raise exception 'V2 count variance omitted';
  exception when others then if sqlerrm<>'variance_reason_required' then raise; end if; end;
  result:=public.clair_record_order_execution_result('clair-demo',actor,wi.id,wi.row_revision,ctx->>'planSha256',0,
    '97040000-0000-4000-8000-000000000003',stamp,actual,null,null);
  retry:=public.clair_record_order_execution_result('clair-demo',actor,wi.id,wi.row_revision,ctx->>'planSha256',0,
    '97040000-0000-4000-8000-000000000003',stamp,actual,null,null);
  if result is distinct from retry or result->>'status'<>'completed' then raise exception 'V2 actual retry failed'; end if;
  result:=public.clair_record_order_execution_result('clair-demo',actor,wi.id,(result->>'workItemRevision')::bigint,ctx->>'planSha256',1,
    '97040000-0000-4000-8000-000000000004',stamp,actual||'{"measurementValue":13}',null,'Synthetic transcription correction');
  if result#>>'{results,0,payload,measurementValue}'<>'12' or result#>>'{results,1,payload,measurementValue}'<>'13'
    or (select confirmed_snapshot from public.orders where id=o.id) is distinct from frozen then raise exception 'V2 actual history lost'; end if;
  raise notice 'WP04 actual V2 typed measurement/count/variance/completion/retry/amendment verified with immutable plan';
end $actual$;
