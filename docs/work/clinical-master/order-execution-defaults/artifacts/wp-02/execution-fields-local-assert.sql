-- Synthetic fixture in a transaction; no deployed data or historical rewrite.
do $test$
declare c public.order_catalog_items%rowtype; p jsonb; result jsonb; release_id uuid; update_id uuid;
  saved jsonb; revision_before integer; local_values jsonb; id_before text;
begin
  select * into strict c from public.order_catalog_items where workspace_id='clair-demo'
    and source_master_record_id=(select id from master.master_records where master_key='cm.order.lab.panel.cbc-basic');
  -- Preserve an explicitly paused hospital item during all source merges.
  -- This fixture does not stand in for the separate prototype activation gate.
  result:=public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,'{"availabilityStatus":"paused"}');
  select * into c from public.order_catalog_items where id=c.id;
  id_before:=c.id; saved:=to_jsonb(c);
  local_values:=jsonb_set(c.default_detail_inputs,'{collectionCondition}','"Synthetic local collection"')-'testPanel';
  result:=public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,jsonb_build_object('defaultDetailInputs',local_values));
  select * into c from public.order_catalog_items where id=id_before;
  if not(c.customized_fields @> array['defaultDetailInputs.collectionCondition','defaultDetailInputs.testPanel'])
    or c.customized_fields && array['defaultDetailInputs','default_detail_inputs'] then raise exception 'test per-field customization failed'; end if;
  if c.default_detail_inputs ? 'testPanel' or c.default_detail_input_policies->>'testPanel'<>'workspace_resolved'
    or c.default_detail_input_policies->>'specimenType'<>'derived_from_profile'
    or c.price_krw<>777 or c.availability_status is distinct from saved->>'availability_status' then
    raise exception 'test clear or unrelated field policy preservation failed'; end if;
  p:=(select payload from taxonomy_test_payload);
  p:=jsonb_set(p,'{releaseKey}','"wp02.fields.local-test.r3"');
  p:=jsonb_set(p,'{records,0,detail,labFamilyCode}','"chemistry"');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,presetRevision}','3');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,defaultDetailInputs,collectionCondition}','"Synthetic source collection r3"');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,defaultDetailInputs,testPanel}','"Synthetic source panel r3"');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,defaultDetailInputs,pretreatment}','"Synthetic pretreatment r3"');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,fieldPolicies,pretreatment}','"preset_fixed"');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,contentSha256}',to_jsonb(
    private.clinical_master_sha256(private.clair_order_execution_preset_hash_content(p#>'{records,0,detail,executionPreset}'))));
  result:=private.publish_clinical_master_release(p); release_id:=(result->>'releaseId')::uuid;
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  select * into c from public.order_catalog_items where id=id_before;
  if c.default_detail_inputs->>'collectionCondition'<>'Synthetic local collection' or c.default_detail_inputs ? 'testPanel'
    or c.default_detail_inputs->>'pretreatment'<>'Synthetic pretreatment r3'
    or not(c.execution_merge_conflicts ?& array['collectionCondition','testPanel'])
    or c.price_krw<>777 or c.availability_status is distinct from saved->>'availability_status' then
    raise exception 'test independent field adoption/override/conflict failed: %',to_jsonb(c); end if;
  revision_before:=c.catalog_revision;
  if c.source_execution_preset_revision<>3 or c.source_execution_preset_sha256 is distinct from p#>>'{records,0,detail,executionPreset,contentSha256}' then
    raise exception 'test merged defaults retained stale source safety lineage'; end if;
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  if (select catalog_revision from public.order_catalog_items where id=id_before)<>revision_before then raise exception 'test merge retry mutated'; end if;
  result:=public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,'{"keepExecutionFields":["collectionCondition"]}');
  select * into c from public.order_catalog_items where id=id_before;
  if c.execution_merge_conflicts ? 'collectionCondition' or c.default_detail_inputs->>'collectionCondition'<>'Synthetic local collection' then
    raise exception 'test reject source changed local value'; end if;
  result:=public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,'{"resetExecutionFields":["testPanel"]}');
  select * into c from public.order_catalog_items where id=id_before;
  if c.default_detail_inputs->>'testPanel'<>'Synthetic source panel r3' or c.default_detail_input_policies->>'testPanel'<>'derived_from_profile'
    or 'defaultDetailInputs.testPanel'=any(c.customized_fields) or c.execution_merge_conflicts<>'{}' then raise exception 'test accept field failed'; end if;
  -- Stale CAS and protected source metadata never write.
  begin
    perform public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision-1,'{"resetExecutionFields":["testPanel"]}');
    raise exception 'test stale field reset accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,'{"resetExecutionFields":["unknown"]}');
    raise exception 'test unknown field reset accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,'{"execution_source_baseline":{},"defaultDetailInputs":{}}');
    raise exception 'test source metadata accepted';
  exception when invalid_parameter_value or insufficient_privilege then null; end;
  -- The next source change reopens only the still-overridden field.
  p:=jsonb_set(p,'{releaseKey}','"wp02.fields.local-test.r4"');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,presetRevision}','4');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,defaultDetailInputs,collectionCondition}','"Synthetic source collection r4"');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,defaultDetailInputs,testPanel}','"Synthetic source panel r4"');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,contentSha256}',to_jsonb(
    private.clinical_master_sha256(private.clair_order_execution_preset_hash_content(p#>'{records,0,detail,executionPreset}'))));
  result:=private.publish_clinical_master_release(p); release_id:=(result->>'releaseId')::uuid;
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  select * into c from public.order_catalog_items where id=id_before;
  if c.default_detail_inputs->>'testPanel'<>'Synthetic source panel r4'
    or c.default_detail_inputs->>'collectionCondition'<>'Synthetic local collection'
    or not(c.execution_merge_conflicts ? 'collectionCondition') or c.execution_merge_conflicts ? 'testPanel' then
    raise exception 'test accepted field did not inherit next revision'; end if;
  -- An unrelated source advance must refresh the unresolved decision revision.
  p:=jsonb_set(p,'{releaseKey}','"wp02.fields.local-test.r5"');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,presetRevision}','5');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,defaultDetailInputs,pretreatment}','"Synthetic pretreatment r5"');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,contentSha256}',to_jsonb(
    private.clinical_master_sha256(private.clair_order_execution_preset_hash_content(p#>'{records,0,detail,executionPreset}'))));
  result:=private.publish_clinical_master_release(p); release_id:=(result->>'releaseId')::uuid;
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  select * into c from public.order_catalog_items where id=id_before;
  if (c.execution_merge_conflicts->'collectionCondition'->'incoming'->>'presetRevision')::integer<>5 then
    raise exception 'test unresolved conflict decision revision did not advance'; end if;
  revision_before:=c.catalog_revision;
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  if (select catalog_revision from public.order_catalog_items where id=id_before)<>revision_before then raise exception 'test refreshed conflict retry mutated'; end if;
  result:=public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,'{"keepExecutionFields":["collectionCondition"]}');
  select * into c from public.order_catalog_items where id=id_before;
  if c.execution_merge_conflicts ? 'collectionCondition' then raise exception 'test keep after unrelated source advance failed'; end if;
  -- Recover a previously recorded cross-field proposal failure using a valid merge.
  update public.order_catalog_items set execution_merge_conflicts=jsonb_build_object('$contract',
    jsonb_build_object('masterRevision',5,'presetRevision',5,'proposedValues','{}'::jsonb,'proposedPolicies','{}'::jsonb)) where id=id_before;
  perform private.clair_merge_order_execution_fields('clair-demo',c.id);
  select * into c from public.order_catalog_items where id=id_before;
  if c.execution_merge_conflicts ? '$contract' then raise exception 'test recovered contract conflict remained'; end if;
  -- Empty object clears every previously persisted field, never legacy refill.
  result:=public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,'{"defaultDetailInputs":{}}');
  select * into c from public.order_catalog_items where id=id_before;
  if c.default_detail_inputs<>'{}' or private.clair_catalog_effective_default_detail_inputs(c)<>'{}' then
    raise exception 'test explicit empty copy was refilled'; end if;
  saved:=to_jsonb(c); perform private.clair_merge_order_execution_fields('clair-demo',c.id);
  if (select default_detail_inputs from public.order_catalog_items where id=id_before)<>'{}' then raise exception 'test explicit clear overwritten'; end if;
  update public.order_catalog_items set customized_fields=array['*'] where id=id_before;
  if private.clair_merge_order_execution_fields('clair-demo',c.id) then raise exception 'test wildcard merged'; end if;
  select * into c from public.order_catalog_items where id=id_before;
  begin
    perform public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,'{"resetExecutionFields":["testPanel"]}');
    raise exception 'test wildcard field reset accepted';
  exception when invalid_parameter_value then null; end;
  update public.order_catalog_items set customized_fields='{}',customization_state='detached' where id=id_before;
  if private.clair_merge_order_execution_fields('clair-demo',c.id) then raise exception 'test detached merged'; end if;
  -- Exercise the actual legacy reconciliation RPC, not a direct lineage reset.
  update public.order_catalog_items set customization_state='customized',customized_fields=array['defaultDetailInputs'] where id=id_before;
  select * into c from public.order_catalog_items where id=id_before;
  select u.id into strict update_id from public.workspace_master_updates u where u.workspace_id='clair-demo'
    and u.order_catalog_item_id=c.id and u.status='pending' and u.source_revision=(
      select current_revision from master.master_records where id=c.source_master_record_id) order by u.created_at desc limit 1;
  result:=public.clair_resolve_workspace_master_update('clair-demo',update_id,c.catalog_revision,'accept_source');
  select * into c from public.order_catalog_items where id=id_before;
  if c.execution_merge_conflicts<>'{}' or c.default_detail_inputs->>'testPanel'<>'Synthetic source panel r4'
    or c.execution_source_baseline->'testPanel'->>'presetRevision'<>'5'
    or c.source_execution_preset_revision<>5 or c.customized_fields && array['defaultDetailInputs','*'] then
    raise exception 'test whole-source reconciliation did not reset field lineage: %',jsonb_build_object(
      'conflicts',c.execution_merge_conflicts,'values',c.default_detail_inputs,'baseline',c.execution_source_baseline,
      'presetRevision',c.source_execution_preset_revision,'custom',c.customized_fields); end if;
  revision_before:=c.catalog_revision;
  perform private.clair_merge_order_execution_fields('clair-demo',c.id);
  if (select catalog_revision from public.order_catalog_items where id=id_before)<>revision_before then
    raise exception 'test reconciled copy incorrectly re-customized'; end if;
  result:=public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,jsonb_build_object('defaultDetailInputs',
    jsonb_set(c.default_detail_inputs,'{collectionCondition}','"Local retained after source removal"')));
  p:=jsonb_set(p,'{releaseKey}','"wp02.fields.local-test.r6"');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,presetRevision}','6');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,defaultDetailInputs}',
    (p#>'{records,0,detail,executionPreset,defaultDetailInputs}')-array['collectionCondition','pretreatment']);
  p:=jsonb_set(p,'{records,0,detail,executionPreset,fieldPolicies,collectionCondition}','"required_manual"');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,fieldPolicies,pretreatment}','"required_manual"');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,contentSha256}',to_jsonb(
    private.clinical_master_sha256(private.clair_order_execution_preset_hash_content(p#>'{records,0,detail,executionPreset}'))));
  result:=private.publish_clinical_master_release(p); release_id:=(result->>'releaseId')::uuid;
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  select * into c from public.order_catalog_items where id=id_before;
  if c.default_detail_inputs ? 'pretreatment' or c.default_detail_inputs->>'collectionCondition'<>'Local retained after source removal'
    or not(c.execution_merge_conflicts ? 'collectionCondition') then raise exception 'test source removal lost local or retained inherited value'; end if;
  result:=public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,'{"resetExecutionFields":["collectionCondition"]}');
  select * into c from public.order_catalog_items where id=id_before;
  if c.default_detail_inputs ? 'collectionCondition' or c.execution_source_baseline->'collectionCondition'->'cell'->>'present'<>'false'
    or c.default_detail_input_policies->>'collectionCondition'<>'required_manual' then raise exception 'test reset did not accept source absence'; end if;
  revision_before:=c.catalog_revision;
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  if (select catalog_revision from public.order_catalog_items where id=id_before)<>revision_before then raise exception 'test source removal retry mutated'; end if;
  -- '*' reconciliation retains explicit protection for unrelated hospital fields.
  update public.order_catalog_items set customized_fields=array['*'],customization_state='customized',
    price_krw=123,pricing_rule=jsonb_set(pricing_rule,'{priceKrw}','123') where id=id_before;
  select * into c from public.order_catalog_items where id=id_before;
  select u.id into strict update_id from public.workspace_master_updates u where u.workspace_id='clair-demo'
    and u.order_catalog_item_id=c.id and u.status='pending' and u.source_revision=(
      select current_revision from master.master_records where id=c.source_master_record_id) order by u.created_at desc limit 1;
  result:=public.clair_resolve_workspace_master_update('clair-demo',update_id,c.catalog_revision,'accept_source');
  select * into c from public.order_catalog_items where id=id_before;
  if c.price_krw<>123 or not('priceKrw'=any(c.customized_fields)) or '*'=any(c.customized_fields)
    or c.execution_source_baseline->'testPanel'->>'presetRevision'<>'6' then raise exception 'test wildcard reconciliation lost local protection'; end if;
  perform set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
  begin
    perform public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,'{"defaultDetailInputs":{}}');
    raise exception 'test nonmember field write accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',(select user_id::text from wp01b_actor),true);
  if has_function_privilege('authenticated','private.clair_merge_order_execution_fields(text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.clair_update_order_catalog_item_before_execution_fields(text,text,integer,jsonb)','EXECUTE') then
    raise exception 'test execution helper privilege leak'; end if;
  if (select jsonb_agg(to_jsonb(x)) from (select to_jsonb(f) row from public.order_catalog_items f where workspace_id='clair-foreign-demo') x)
    is distinct from (select jsonb_agg(to_jsonb(x)) from taxonomy_foreign_before x) then raise exception 'test execution merge changed foreign catalog'; end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(o) order by o.id)::text,'')) from public.orders o)
    is distinct from (select fingerprint from taxonomy_orders_before) then raise exception 'test execution merge changed confirmed history'; end if;
  raise notice 'execution field SQL assertions passed: real publish/adopt r3-r6, local override/clear/removal, policies, conflict revision/recovery, keep/reset/whole accept/wildcard, retry, CAS, legacy/detached, permissions, foreign/history';
end;
$test$;

-- The generic execution-field wrapper must preserve the existing narrow
-- dispensing-author path, without promoting veterinarians to catalog managers.
-- An inner subtransaction restores all fixture edits and actor context before
-- later publish/adopt assertions reuse this workspace.
do $vet_author$
declare original_actor uuid:=auth.uid(); candidate uuid; vet_actor uuid;
  dispensing public.order_catalog_items; lab public.order_catalog_items; general public.order_catalog_items;
  result jsonb; values_after jsonb; before_fingerprint text;
begin
  before_fingerprint:=(select md5(jsonb_agg(to_jsonb(c) order by c.id)::text) from public.order_catalog_items c);
  begin
    for candidate in select m.user_id from public.user_memberships m join public.users u on u.id=m.user_id
      where m.workspace_id='clair-demo' and m.status='active' and u.status='active' and m.roles @> array['vet']::text[] order by m.user_id loop
      perform set_config('request.jwt.claim.sub',candidate::text,true);
      if private.clair_is_active_veterinarian_member('clair-demo',candidate)
        and not private.clair_is_workspace_admin('clair-demo')
        and not private.clair_current_user_has_workspace_permission('clair-demo','service_catalog:manage') then vet_actor:=candidate; exit; end if;
    end loop;
    if vet_actor is null then raise exception 'WP02 active vet without catalog manage fixture missing'; end if;
    select * into strict dispensing from public.order_catalog_items where workspace_id='clair-demo'
      and category_group='medication' and default_destination_module='dispensing' and standard_order_name='Synthetic dispensing create';
    select * into strict lab from public.order_catalog_items where workspace_id='clair-demo' and id='wp01b-taxonomy-created';
    -- Scoped synthetic general item; no master identity, workspace policy, or
    -- existing row is rewritten to manufacture the permission distinction.
    insert into public.order_catalog_items(id,workspace_id,standard_order_id,source_preset_version,category_group,category_label,
      standard_order_name,in_hospital_order_name,billing_name,default_destination_module,clinical_order_type,execution_mode,
      detail_schema_version,detail_field_schema,billing_eligible,price_krw)
    values('wp02-vet-general-denial','clair-demo','wp02-vet-general-denial','synthetic-vet-permission','consultation','Synthetic general',
      'Synthetic general authorization check','Synthetic general authorization check','Synthetic general authorization check',
      'chart_only','consultation','immediate_complete',1,'{}',false,0) returning * into general;

    values_after:=dispensing.default_detail_inputs||'{"compoundNote":"Synthetic veterinarian-authored dispensing instruction"}'::jsonb;
    result:=public.clair_update_order_catalog_item('clair-demo',dispensing.id,dispensing.catalog_revision,jsonb_build_object('defaultDetailInputs',values_after));
    if (select default_detail_inputs from public.order_catalog_items where id=dispensing.id) is distinct from values_after
      or (select catalog_revision from public.order_catalog_items where id=dispensing.id)<>dispensing.catalog_revision+1
      or result#>>'{item,default_detail_inputs,compoundNote}'<>'Synthetic veterinarian-authored dispensing instruction' then
      raise exception 'WP02 nonmanager veterinarian dispensing defaults not persisted'; end if;
    if not exists(select 1 from public.audit_events where workspace_id='clair-demo' and target_id=dispensing.id
      and actor_user_id=vet_actor and metadata->>'action'='execution_field_workspace_edit') then raise exception 'WP02 vet dispensing audit actor missing'; end if;
    if private.clair_current_user_has_workspace_permission('clair-demo','service_catalog:manage') then raise exception 'WP02 vet gained generic manage'; end if;

    begin
      perform public.clair_update_order_catalog_item('clair-demo',lab.id,lab.catalog_revision,'{"defaultDetailInputs":{}}');
      raise exception 'WP02 veterinarian edited lab defaults';
    exception when insufficient_privilege then null; end;
    begin
      perform public.clair_update_order_catalog_item('clair-demo',general.id,general.catalog_revision,'{"defaultDetailInputs":{}}');
      raise exception 'WP02 veterinarian edited general defaults';
    exception when insufficient_privilege then null; end;
    begin
      perform public.clair_update_order_catalog_item('clair-foreign-demo','wp01b-taxonomy-foreign',1,'{"defaultDetailInputs":{}}');
      raise exception 'WP02 veterinarian edited foreign defaults';
    exception when insufficient_privilege then null; end;
    -- Supplying another workspace's item ID to the permitted workspace also
    -- fails scoped lookup; it is not treated as a dispensing-author bypass.
    begin
      perform public.clair_update_order_catalog_item('clair-demo','wp01b-taxonomy-foreign',1,'{"defaultDetailInputs":{}}');
      raise exception 'WP02 veterinarian addressed foreign item through local workspace';
    exception when no_data_found then null; end;
    if (select to_jsonb(c) from public.order_catalog_items c where id=lab.id) is distinct from to_jsonb(lab)
      or (select to_jsonb(c) from public.order_catalog_items c where id=general.id) is distinct from to_jsonb(general) then
      raise exception 'WP02 denied vet write changed catalog'; end if;
    raise exception 'rollback successful scoped vet fixture' using errcode='P7001';
  exception when sqlstate 'P7001' then null; end;
  if auth.uid() is distinct from original_actor or before_fingerprint is distinct from
    (select md5(jsonb_agg(to_jsonb(c) order by c.id)::text) from public.order_catalog_items c) then raise exception 'WP02 vet fixture leaked actor or catalog changes'; end if;
  raise notice 'WP02 active veterinarian without service_catalog:manage can edit dispensing defaults only; lab/general/foreign denied; audit actor and scoped rollback verified';
end $vet_author$;
