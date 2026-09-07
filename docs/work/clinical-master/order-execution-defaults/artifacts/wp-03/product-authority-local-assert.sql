do $products$
declare p jsonb:=(select payload from wp03_product_payload); record jsonb; result jsonb; release_id uuid;
  c public.order_catalog_items; before_retry text; authority jsonb;
begin
  for record in select value from jsonb_array_elements(p->'records') loop
    authority:=record#>'{detail,executionPreset,defaultDetailInputs,planOrderAuthority}';
    if private.clair_plan_order_authority_is_valid(authority) is not true then
      raise exception 'test product authority invalid: %',record->>'masterKey'; end if;
    if private.clair_order_execution_preset_contract_is_valid('dispensing',1,
      record#>'{detail,executionPreset,defaultDetailInputs}',record#>'{detail,executionPreset,fieldPolicies}') is not true then
      raise exception 'test product preset contract invalid: %',record->>'masterKey'; end if;
    if private.clair_order_detail_inputs_are_valid('dispensing',1,
      (record#>'{detail,executionPreset,defaultDetailInputs}')-'planOrderAuthority',true) is not true then
      raise exception 'test product clinical details incomplete: %',record->>'masterKey'; end if;
  end loop;
  -- Patient detail inputs cannot smuggle calculation/product authority.
  if private.clair_order_detail_inputs_are_valid('dispensing',1,
    record#>'{detail,executionPreset,defaultDetailInputs}',false) is not false then raise exception 'test forged clinical authority accepted'; end if;
  if private.clair_plan_order_authority_is_valid(authority||'{"invented":1}') is not false then raise exception 'test authority unknown key accepted'; end if;
  result:=private.publish_clinical_master_release(p); release_id:=(result->>'releaseId')::uuid;
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  if (select count(*) from public.order_catalog_items catalog join master.master_records m on m.id=catalog.source_master_record_id
    where catalog.workspace_id='clair-demo' and m.master_key in (select value->>'masterKey' from jsonb_array_elements(p->'records'))
      and catalog.default_detail_inputs#>>'{planOrderAuthority,schemaVersion}'='2')<>127 then
    raise exception 'test all127 product authorities not adopted'; end if;
  select * into strict c from public.order_catalog_items where workspace_id='clair-demo' and source_master_record_id=
    (select id from master.master_records where master_key='cm.order.dispensing-wp03.neurontin-100mg-capsule');
  if private.clair_catalog_effective_default_detail_inputs(c) ? 'planOrderAuthority' then raise exception 'test reserved metadata leaked into clinical input'; end if;
  if c.execution_source_baseline#>'{planOrderAuthority,cell,value}' is distinct from c.default_detail_inputs->'planOrderAuthority' then
    raise exception 'test product authority baseline missing'; end if;
  before_retry:=md5((select jsonb_agg(to_jsonb(x) order by id)::text from public.order_catalog_items x where workspace_id='clair-demo'));
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  if before_retry is distinct from md5((select jsonb_agg(to_jsonb(x) order by id)::text from public.order_catalog_items x where workspace_id='clair-demo')) then
    raise exception 'test product adoption retry changed catalogs'; end if;
  -- Local fixture availability only: tests snapshot projection, not the pending
  -- WP09 active/synthetic workspace policy or a remote activation claim.
  update public.order_catalog_items set availability_status='active',billing_reflection_enabled=false where id=c.id;
  result:=private.clair_build_catalog_order_snapshot('clair-demo',c.id,1);
  if result->'planOrderAuthority' is distinct from c.default_detail_inputs->'planOrderAuthority' then
    raise exception 'test snapshot authority not exact catalog copy'; end if;
  if not exists(select 1 from public.clair_list_order_catalog_chart_search_v2('clair-demo') row
    where row.applied_snapshot->>'workspaceCatalogItemId'=c.id
      and row.applied_snapshot->'planOrderAuthority'=c.default_detail_inputs->'planOrderAuthority') then
    raise exception 'test chart search product authority missing'; end if;
  raise notice 'WP03 all127 typed product presets published/adopted/retried locally; exact raw/default/snapshot/search authority verified; enclosing transaction rolls back';
end $products$;
