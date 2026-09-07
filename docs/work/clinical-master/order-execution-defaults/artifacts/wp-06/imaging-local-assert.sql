-- Consumes wp06_imaging_payload after the common WP03/lab fixtures. Rollback only.
do $imaging$
declare p jsonb:=(select payload from wp06_imaging_payload); r jsonb; result jsonb; release_id uuid;
  c public.order_catalog_items; before_retry text; defaults jsonb;
begin
  if jsonb_array_length(p->'records')<>30 then raise exception 'imaging expected30'; end if;
  for r in select value from jsonb_array_elements(p->'records') loop
    defaults:=r#>'{detail,executionPreset,defaultDetailInputs}';
    if not private.clair_order_execution_preset_contract_is_valid('imaging',1,defaults,r#>'{detail,executionPreset,fieldPolicies}')
      or not private.clair_order_detail_inputs_are_valid('imaging',1,defaults,true) then
      raise exception 'imaging incomplete preset: %',r->>'masterKey'; end if;
  end loop;
  result:=private.publish_clinical_master_release(p); release_id:=(result->>'releaseId')::uuid;
  if (private.publish_clinical_master_release(p)->>'releaseId')::uuid is distinct from release_id then raise exception 'imaging publish retry changed release'; end if;
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  if (select count(*) from public.order_catalog_items catalog join master.master_records m on m.id=catalog.source_master_record_id
    where catalog.workspace_id='clair-demo' and m.master_key in (select value->>'masterKey' from jsonb_array_elements(p->'records'))
      and catalog.detail_schema_version=1)<>30 then raise exception 'imaging all30 copy missing'; end if;
  for r in select value from jsonb_array_elements(p->'records') loop
    select * into strict c from public.order_catalog_items where workspace_id='clair-demo' and source_master_record_id=
      (select id from master.master_records where master_key=r->>'masterKey');
    if c.default_detail_inputs is distinct from r#>'{detail,executionPreset,defaultDetailInputs}' then raise exception 'imaging default projection mismatch: %',r->>'masterKey'; end if;
  end loop;
  before_retry:=md5((select jsonb_agg(to_jsonb(x) order by id)::text from public.order_catalog_items x where workspace_id='clair-demo'));
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  if before_retry is distinct from md5((select jsonb_agg(to_jsonb(x) order by id)::text from public.order_catalog_items x where workspace_id='clair-demo')) then raise exception 'imaging retry mutated catalog'; end if;
  if exists(select 1 from public.order_catalog_items f where f.workspace_id='clair-foreign-demo' and not exists(
    select 1 from taxonomy_foreign_before b where b.row=to_jsonb(f))) then raise exception 'imaging foreign changed'; end if;
  raise notice 'WP06 all30 imaging definitions valid/published/adopted/retried; foreign control unchanged';
end $imaging$;

do $actual$
declare actor uuid:=(select user_id from wp01b_actor); c public.order_catalog_items; o public.orders;
  wi public.order_fulfillment_work_items; result jsonb; retry jsonb; ctx jsonb; actual jsonb; stamp timestamptz:=now();
  frozen jsonb; etag text;
begin
  select * into strict c from public.order_catalog_items where workspace_id='clair-demo' and source_master_record_id=
    (select id from master.master_records where master_key='cm.order.v4.imaging.18');
  -- Explicit local fixture activation only; not production activation acceptance.
  update public.order_catalog_items set availability_status='active',billing_reflection_enabled=false where id=c.id;
  insert into public.orders(id,workspace_id,encounter_id,order_type,display_name,status,requested_by_user_id,requested_at,
    clinical_order_type,destination_module,execution_mode,detail_schema_version,detail_inputs,applied_snapshot,billing_eligible,
    billing_reflection_enabled,quantity,unit_price_snapshot,workspace_catalog_item_id,workspace_catalog_revision)
  values('97060000-0000-4000-8000-000000000001','clair-demo','97030000-0000-4000-8000-000000000002',
    'imaging','WP06 synthetic existing CT review','requested',actor,now(),'imaging','imaging','routed',1,c.default_detail_inputs,
    private.clair_build_catalog_order_snapshot('clair-demo',c.id,1),false,false,1,0,c.id,c.catalog_revision);
  select * into o from public.orders where id='97060000-0000-4000-8000-000000000001';
  etag:=private.clair_b3_order_draft_etag('clair-demo',o.encounter_id);
  result:=public.clair_confirm_chart_order_candidates('clair-demo',actor,o.encounter_id,array[o.id],etag,'wp06-confirm-0001');
  select confirmed_snapshot into frozen from public.orders where id=o.id;
  select * into strict wi from public.order_fulfillment_work_items where order_id=o.id;
  perform public.clair_transition_fulfillment_work_item('clair-demo',actor,wi.id,'start',wi.row_revision,
    '97060000-0000-4000-8000-000000000002',null,null,null);
  select * into wi from public.order_fulfillment_work_items where id=wi.id;
  ctx:=public.clair_get_order_execution_context('clair-demo',wi.id);
  if jsonb_array_length(ctx->'results')<>0 then raise exception 'imaging fake actual prefill'; end if;
  actual:='{"acquisitionDisposition":"reviewed_existing","acquiredViews":["Synthetic supplied thoracic CT series"],"performedProtocol":"Manual review of supplied synthetic images only","quality":"limited","findings":"Manually entered synthetic observation","interpretation":"Synthetic limited interpretation; no new acquisition"}';
  begin
    perform public.clair_record_order_execution_result('clair-demo',actor,wi.id,wi.row_revision,ctx->>'planSha256',0,
      '97060000-0000-4000-8000-000000000003',stamp,actual-'acquisitionDisposition',null,null);
    raise exception 'imaging missing disposition accepted';
  exception when others then if sqlerrm<>'invalid_execution_payload' then raise; end if; end;
  result:=public.clair_record_order_execution_result('clair-demo',actor,wi.id,wi.row_revision,ctx->>'planSha256',0,
    '97060000-0000-4000-8000-000000000003',stamp,actual,null,null);
  retry:=public.clair_record_order_execution_result('clair-demo',actor,wi.id,wi.row_revision,ctx->>'planSha256',0,
    '97060000-0000-4000-8000-000000000003',stamp,actual,null,null);
  if result is distinct from retry or result->>'status'<>'completed' then raise exception 'imaging actual retry failed'; end if;
  result:=public.clair_record_order_execution_result('clair-demo',actor,wi.id,(result->>'workItemRevision')::bigint,ctx->>'planSha256',1,
    '97060000-0000-4000-8000-000000000004',stamp,actual||'{"interpretation":"Synthetic amended interpretation; no new acquisition"}',null,'Synthetic transcription correction');
  ctx:=public.clair_get_order_execution_context('clair-demo',wi.id);
  if ctx is distinct from result or jsonb_array_length(ctx->'results')<>2
    or ctx#>>'{results,0,payload,acquisitionDisposition}'<>'reviewed_existing'
    or ctx#>>'{results,1,payload,acquisitionDisposition}'<>'reviewed_existing'
    or ctx#>>'{results,0,payload,interpretation}'<>actual->>'interpretation'
    or (select confirmed_snapshot from public.orders where id=o.id) is distinct from frozen then raise exception 'imaging actual history or immutable plan lost'; end if;
  raise notice 'WP06 CT existing-review actual blank/start/record/complete/retry/amend/readback passed; plan immutable';
end $actual$;
