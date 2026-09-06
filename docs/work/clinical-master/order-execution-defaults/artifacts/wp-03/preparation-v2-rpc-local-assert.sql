-- Synthetic real RPC integration; enclosing harness always rolls back.
insert into public.patients(id,workspace_id,patient_no,name,species,sex)
values('97030000-0000-4000-8000-000000000001','clair-demo','WP03-SYNTHETIC','WP03 synthetic','dog','unknown');
insert into public.encounters(id,workspace_id,patient_id,primary_veterinarian_id,encounter_no,reception_type,status)
select '97030000-0000-4000-8000-000000000002','clair-demo','97030000-0000-4000-8000-000000000001',
  user_id,'WP03-SYNTHETIC','walk_in','in_consultation' from wp01b_actor;
insert into public.order_catalog_items(id,workspace_id,standard_order_id,source_preset_version,
  category_group,category_label,standard_order_name,in_hospital_order_name,billing_name,availability_status,
  billing_reflection_enabled,price_krw,default_destination_module,classification_path_id,clinical_order_type,
  is_external_lab,destination_module,execution_mode,detail_schema_version,detail_field_schema,billing_eligible)
select 'wp03-synthetic-preparation','clair-demo','wp03-synthetic-preparation','synthetic-v2','medication','Synthetic medication',
  'WP03 synthetic','WP03 synthetic','WP03 synthetic','active',true,1000,'dispensing',id,'dispensing',false,'dispensing','routed',1,
  private.clair_order_detail_field_schema_v1('dispensing'),true from master.classification_paths where path_key='cm.path.dispensing';

insert into public.orders(id,workspace_id,encounter_id,order_type,display_name,status,requested_by_user_id,requested_at,
  clinical_order_type,destination_module,execution_mode,detail_inputs,applied_snapshot,billing_eligible,
  billing_reflection_enabled,quantity,unit_price_snapshot,workspace_catalog_item_id,workspace_catalog_revision)
select '97030000-0000-4000-8000-000000000004','clair-demo','97030000-0000-4000-8000-000000000002',
  'dispensing','WP03 synthetic','requested',user_id,now(),'dispensing','dispensing','routed',
  '{"doseBasis":"patient","dose":0.25,"doseUnit":"tablet","route":"PO","frequency":"tid","durationDays":5,"totalQuantity":4}',
  '{"workspaceCatalogItemId":"wp03-synthetic-preparation","workspaceCatalogRevision":1,"taxType":"taxable","planOrderAuthority":{
    "schemaVersion":2,"calculationMode":"product_unit","dispenseUnit":"tablet",
    "preparationPolicy":{"quantityScope":"course_total","increment":0.5,"roundingMode":"up","displayPrecision":1,"noReasonTolerance":0.1},
    "priceBasis":"per_product_unit","billingUnit":"tablet","taxClass":"taxable"}}',
  true,true,4,1000,'wp03-synthetic-preparation',1 from wp01b_actor;

do $rpc$
declare actor uuid:=(select user_id from wp01b_actor); o public.orders; result jsonb; retry jsonb; etag text; task_id uuid;
begin
  select * into strict o from public.orders where id='97030000-0000-4000-8000-000000000004';
  result:=public.clair_save_order_actual_dispense_override('clair-demo',actor,o.id,o.updated_at,4.5,'Synthetic preparation adjustment','wp03-prepare-0001');
  if result->>'preparationQuantityScope' is distinct from 'course_total' or (result->>'plannedPracticalTotalQuantity')::numeric is distinct from 4.5 then
    raise exception 'test RPC V2 transport missing: %',result; end if;
  retry:=public.clair_save_order_actual_dispense_override('clair-demo',actor,o.id,o.updated_at,4.5,'Synthetic preparation adjustment','wp03-prepare-0001');
  if retry is distinct from result then raise exception 'test preparation retry not stable'; end if;
  etag:=private.clair_b3_order_draft_etag('clair-demo',o.encounter_id);
  result:=public.clair_confirm_chart_order_candidates('clair-demo',actor,o.encounter_id,array[o.id],etag,'wp03-confirm-0001');
  select * into o from public.orders where id=o.id;
  if (o.confirmed_snapshot#>>'{calculationOutputs,plannedPracticalTotalQuantity}')::numeric is distinct from 4.5 then
    raise exception 'test confirmed V2 planning snapshot missing: %',o.confirmed_snapshot; end if;
  if not exists(select 1 from public.order_billing_candidates where order_id=o.id
    and quantity=4.5 and amount=4500 and billing_unit_snapshot='tablet') then
    raise exception 'test V2 confirm billed occurrences twice'; end if;
  select id into strict task_id from public.order_tasks where order_id=o.id and attempt_no=1;
  if not exists(select 1 from public.order_fulfillment_work_items where order_id=o.id
    and (source_snapshot#>>'{calculationOutputs,plannedPracticalTotalQuantity}')::numeric=4.5) then
    raise exception 'test fulfillment lost plan scope'; end if;
  update public.order_tasks set status='returned',returned_at=now(),updated_at=now() where id=task_id;
  update public.order_fulfillment_work_items set status='returned',returned_at=now(),reason='Synthetic revision test',updated_at=now()
    where order_id=o.id;
  result:=public.clair_mutate_chart_order_execution('clair-demo',actor,o.id,'re_request','Synthetic revised plan',1,
    '{"detailInputs":{"doseBasis":"patient","dose":0.5,"doseUnit":"tablet","route":"PO","frequency":"tid","durationDays":5,"totalQuantity":8},
      "detailSchemaVersion":1,"priority":"normal","actualDispenseQuantity":8}', 'wp03-reconfirm-0001');
  if (result#>>'{order,calculationOutputs,plannedPracticalTotalQuantity}')::numeric is distinct from 8 then
    raise exception 'test V2 reconfirm snapshot stale: %',result; end if;
  if not exists(select 1 from public.order_billing_candidates where order_id=o.id and quantity=8 and amount=8000) then
    raise exception 'test V2 reconfirm billed occurrences twice'; end if;
  if not exists(select 1 from public.order_tasks where id=task_id
    and (effective_snapshot#>>'{calculationOutputs,plannedPracticalTotalQuantity}')::numeric=4.5) then
    raise exception 'test prior attempt plan rewritten'; end if;
  begin
    update public.order_actual_dispense_overrides set reason='rewrite' where order_id=o.id;
    raise exception 'test planning override history mutable';
  exception when sqlstate '55000' then null; end;
end $rpc$;
