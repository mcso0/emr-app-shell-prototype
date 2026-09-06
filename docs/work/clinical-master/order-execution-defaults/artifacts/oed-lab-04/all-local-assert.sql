do $all_lab$
declare p jsonb:=(select payload from lab04_all_payload); result jsonb; retry jsonb; released uuid; row jsonb; source master.master_records;
  item_update public.workspace_lab_item_updates; old_version public.lab_test_item_versions; current_item public.lab_test_items;
begin
  result:=private.publish_clinical_master_release(p); released:=(result->>'releaseId')::uuid;
  retry:=private.publish_clinical_master_release(p);
  if result->>'releaseId' is distinct from retry->>'releaseId' or retry->>'labResultProfileCount'<>'24' or retry->>'labCompositionCount'<>'35' then
    raise exception 'All laboratory publish retry mismatch: %',retry; end if;
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',released);
  -- Exact durable source update acceptance, not an in-place rewrite of old pins.
  -- Restrict to unchanged workspace definitions and this authored test identity.
  for item_update in select u.* from public.workspace_lab_item_updates u join public.lab_test_items i on i.workspace_id=u.workspace_id and i.id=u.lab_test_item_id
    join master.master_records m on m.id=u.source_master_record_id
    where u.workspace_id='clair-demo' and u.status='pending' and i.customization_state='unmodified' and m.master_key='cm.lab-test.synthetic-14'
      and u.source_release_id in (released,(select id from master.master_releases where release_key='oed-lab04.cbc.local-test.r1'))
      and u.source_master_revision=m.current_revision
    order by u.source_release_no desc,u.id
  loop
    select * into strict old_version from public.lab_test_item_versions where workspace_id='clair-demo' and lab_test_item_id=item_update.lab_test_item_id
      and workspace_result_revision=item_update.expected_workspace_result_revision;
    perform private.clair_resolve_workspace_lab_definition_update_target('clair-demo',item_update.id,(select user_id from wp01b_actor),item_update.expected_workspace_result_revision,'accept');
    select * into strict current_item from public.lab_test_items where workspace_id='clair-demo' and id=item_update.lab_test_item_id;
    if current_item.result_value_kind<>'coded' or current_item.workspace_result_revision<>old_version.workspace_result_revision+1
      or not exists(select 1 from public.lab_test_item_versions v where v.workspace_id='clair-demo' and v.lab_test_item_id=old_version.lab_test_item_id
        and v.workspace_result_revision=old_version.workspace_result_revision and to_jsonb(v)=to_jsonb(old_version)) then raise exception 'Smear versioned acceptance rewrote history'; end if;
    exit;
  end loop;
  for row in select value from jsonb_array_elements(p->'labOrderProfiles') loop
    if not exists(select 1 from public.order_catalog_items c join master.master_records m on m.id=c.source_master_record_id
      where c.workspace_id='clair-demo' and m.master_key=row->>'orderMasterKey') then raise exception 'All laboratory atomic adoption missing: %',row; end if;
  end loop;
  if (select count(*) from master.lab_composition_versions)<>35 then raise exception 'All laboratory compositions missing'; end if;
  for row in select value from jsonb_array_elements(p->'labResultProfiles') loop
    if not exists(select 1 from master.lab_result_profile_versions where id=(row->>'id')::uuid and definition=row) then
      raise exception 'All laboratory immutable profile mismatch'; end if;
  end loop;
  raise notice 'PASS all86 source reconciliation payload:90 atomic orders,35 compositions,24 profiles; exact publish/retry/adopt; rollback only';
end $all_lab$;
