-- Enclosing harness seeds a current synthetic profile release, then rolls back.
do $packet$
declare proposal jsonb:=(select proposal from wp10_input); payload jsonb; record jsonb; preset jsonb;
  ptr master.order_execution_preset_current; current_preset master.order_execution_presets;
  changed_keys text[]; master_keys text[]; retired_keys text[]; extras text[]; w text; actor uuid;
  target_release_id uuid; result jsonb; baseline_sha text; before_history jsonb; after_history jsonb;
  before_retry jsonb; after_retry jsonb; review record; revision integer; price jsonb;
  packet jsonb; packet_sha text; actors jsonb; output jsonb; bad jsonb; scenario integer; order_row jsonb;
begin
  if has_function_privilege('authenticated','private.clair_wp10_project_dispensing(text,text)','EXECUTE')
    or has_function_privilege('service_role','private.clair_wp10_copy_pristine_catalog(text,text,text)','EXECUTE') then
    raise exception 'test wp10 mutation helper privilege leak'; end if;
  payload:=proposal->'payload';
  select array_agg(value->>'masterKey') into changed_keys from jsonb_array_elements(proposal->'changes');
  select array_agg(value) into master_keys from jsonb_array_elements_text(proposal->'selectableKeys');
  select array_agg(value) into retired_keys from jsonb_array_elements_text(proposal->'retiredKeys');
  -- Local identities/revision counters differ from the remote read; preserve the
  -- exact requested semantic delta while rebasing only those counters for tests.
  for record in select value from jsonb_array_elements(payload->'records') where value->>'recordType'='order' loop
    select p.* into strict ptr from master.order_execution_preset_current p join master.master_records m on m.id=p.order_record_id
      where m.master_key=record->>'masterKey';
    select * into strict current_preset from master.order_execution_presets where id=ptr.preset_id and preset_revision=ptr.preset_revision;
    if record->>'masterKey'=any(changed_keys) then
      preset:=record#>'{detail,executionPreset}';
      preset:=preset||jsonb_build_object('presetId',current_preset.id,'presetKey',current_preset.preset_key,
        'presetRevision',(select max(preset_revision)+1 from master.order_execution_presets where id=current_preset.id));
      preset:=preset||jsonb_build_object('contentSha256',private.clinical_master_sha256(private.clair_order_execution_preset_hash_content(preset)));
    else
      preset:=jsonb_build_object('presetId',current_preset.id,'presetKey',current_preset.preset_key,'presetRevision',current_preset.preset_revision,
        'clinicalOrderType',current_preset.clinical_order_type,'detailSchemaVersion',current_preset.detail_schema_version,
        'defaultDetailInputs',current_preset.default_detail_inputs,'fieldPolicies',current_preset.field_policies,
        'provenance',current_preset.provenance,'presetStatus',current_preset.preset_status,'clinicalUseAllowed',current_preset.clinical_use_allowed,
        'contentSha256',current_preset.content_sha256,'sourceArtifactSha256',current_preset.source_artifact_sha256);
    end if;
    record:=jsonb_set(record,'{detail,executionPreset}',preset);
    select jsonb_set(payload,'{records}',jsonb_agg(case when r->>'masterKey'=record->>'masterKey' then record else r end order by ordinal))
      into payload from jsonb_array_elements(payload->'records') with ordinality rows(r,ordinal);
  end loop;
  proposal:=jsonb_set(proposal,'{payload}',payload);
  proposal:=jsonb_set(proposal,'{payloadSha256}',to_jsonb(private.clinical_master_sha256(payload)));
  select jsonb_object_agg(workspace_id,user_id) into actors from (
    select distinct on(u.workspace_id) u.workspace_id,u.user_id from public.user_memberships u
    where u.workspace_id=any(array['clair-demo','clair-foreign-demo','workspace-clair-cheongdam','workspace-clinical-master-pilot-v1'])
      and u.status='active' and u.roles @> array['hospital_admin']::text[]
      and private.clair_user_has_workspace_permission(u.workspace_id,u.user_id,'hospital_settings:manage')
      and private.clair_user_has_workspace_permission(u.workspace_id,u.user_id,'service_catalog:manage') order by u.workspace_id,u.user_id
  ) chosen;
  packet:=jsonb_build_object('proposal',proposal,'resources',(select resources from wp10_input),'prices',(select prices from wp10_input),
    'actors',actors,'preflight',jsonb_build_object('state',private.clair_wp10_state_fingerprint()));
  packet_sha:=private.clinical_master_sha256(packet);
  before_retry:=private.clair_wp10_state_fingerprint();
  begin
    perform private.clair_apply_wp10_ready_orders(packet,repeat('0',64),true);
    raise exception 'test wrong packet hash accepted';
  exception when others then if sqlerrm<>'wp10_packet_contract_invalid' then raise; end if; end;
  select r into order_row from jsonb_array_elements(packet#>'{proposal,payload,records}') r where r->>'recordType'='order' limit 1;
  for scenario in 1..5 loop
    bad:=packet;
    if scenario=1 then
      bad:=jsonb_set(bad,'{proposal,payload,records}',(bad#>'{proposal,payload,records}')||jsonb_build_array(order_row||'{"masterKey":"cm.order.unapproved-extra"}'::jsonb));
    elsif scenario=2 then
      bad:=jsonb_set(bad,'{proposal,payload,records}',(select jsonb_agg(r) from jsonb_array_elements(bad#>'{proposal,payload,records}') r where r->>'masterKey'<>order_row->>'masterKey'));
    elsif scenario=3 then
      bad:=jsonb_set(bad,'{proposal,payload,records}',(bad#>'{proposal,payload,records}')||jsonb_build_array(order_row));
    elsif scenario=4 then
      bad:=jsonb_set(bad,'{proposal,payload,records}',(select jsonb_agg(case when r->>'masterKey'=retired_keys[1] then r||'{"lifecycleStatus":"published"}'::jsonb else r end) from jsonb_array_elements(bad#>'{proposal,payload,records}') r));
    else
      bad:=jsonb_set(bad,'{prices,entries,0}',bad#>'{prices,entries,1}');
    end if;
    begin
      perform private.clair_apply_wp10_ready_orders(bad,private.clinical_master_sha256(bad),true);
      raise exception 'test invalid packet identity accepted: %',scenario;
    exception when others then if sqlerrm<>'wp10_packet_identity_scope_invalid' then raise; end if; end;
    if private.clair_wp10_state_fingerprint() is distinct from before_retry then raise exception 'test rejected packet mutated state'; end if;
  end loop;
  output:=private.clair_apply_wp10_ready_orders(packet,packet_sha,false);
  if output->'rehearsal' is distinct from 'true'::jsonb or private.clair_wp10_state_fingerprint() is distinct from before_retry then
    raise exception 'test packet rehearsal residue'; end if;
  if exists(select 1 from private.wp10_ready_orders_receipt) then raise exception 'test rehearsal receipt persisted'; end if;
  output:=private.clair_apply_wp10_ready_orders(packet,packet_sha,true);
  after_retry:=private.clair_wp10_state_fingerprint();
  if private.clair_apply_wp10_ready_orders(packet,packet_sha,true) is distinct from output
    or private.clair_wp10_state_fingerprint() is distinct from after_retry then raise exception 'test receipt retry changed'; end if;
  if output->'applied' is distinct from 'true'::jsonb then raise exception 'test packet not applied'; end if;
  raise notice 'WP10 exact packet: wrong hash denied, complete rollback/no residue, apply+receipt and mutation-free retry passed';
end $packet$;
