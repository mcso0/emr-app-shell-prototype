-- Local-only fixtures and assertions. Caller supplies BEGIN and unconditional ROLLBACK.
-- Full permanent-table fingerprint catches publisher/adopter/audit residue that
-- the rollout's narrower clinical/workspace fingerprint intentionally omits.
create function pg_temp.wp09_full_fingerprint() returns jsonb language plpgsql as $fn$
declare t record; result jsonb:='[]'; row_hash jsonb;
begin
  for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','master','private') and c.relkind='r' order by n.nspname,c.relname loop
    execute format('select jsonb_build_object(''schema'',$1,''table'',$2,''count'',count(*),''sha256'',private.clinical_master_sha256(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''))) from %I.%I x',t.nspname,t.relname)
      into row_hash using t.nspname,t.relname;
    result:=result||jsonb_build_array(row_hash);
  end loop;
  return result;
end $fn$;

do $fixture$
declare targets constant text[]:=array['clair-demo','workspace-clair-cheongdam','workspace-clinical-master-pilot-v1'];
  w text; result jsonb; profile master.dispensing_order_profiles; c public.order_catalog_items; product master.medication_products;
  snapshot jsonb; v_packet jsonb:=(select i.packet from wp09_scoped_input i); p jsonb; rec jsonb; preset jsonb;
  ptr master.order_execution_preset_current; old master.order_execution_presets; expected jsonb; lab_items jsonb;
begin
  if auth.uid()<>'00000000-0000-4000-8000-000000000001'::uuid then raise exception 'test actor mismatch'; end if;
  foreach w in array targets loop
    insert into public.user_memberships(workspace_id,user_id,roles,status,activated_at)
      select w,auth.uid(),array['hospital_admin'],'active',now()
      where not exists(select 1 from public.user_memberships where workspace_id=w and user_id=auth.uid());
    if not private.clair_is_active_workspace_member(w) or not private.clair_current_user_has_workspace_permission(w,'service_catalog:manage') then
      raise exception 'test active admin membership missing:%',w; end if;
  end loop;
  -- Reproduce the verified remote history in chronological order: project the
  -- existing immutable revision-1 lab owners before a later order-only release
  -- advances orders. Never forge old link owners after publishing revision 2.
  create temp table wp09_pre_history_catalog_ids as select workspace_id,id from public.order_catalog_items where workspace_id=any(targets);
  foreach w in array targets loop
    -- The legacy fixture adopter establishes pre-preset history; the modern
    -- adopter requires presets introduced by the following seed release.
    perform private.clair_adopt_master_release_to_workspace_a2_cumulative(w,(select id from master.master_releases
      where status='published' order by release_no desc limit 1));
    perform private.clair_adopt_lab_master_projection_to_workspace(w,null);
  end loop;
  -- The legacy adopter is cumulative. Discard ONLY its newly created nonlab
  -- fixture rows and their review notifications before the baseline seed; the
  -- historical-gap scenario must not invent unrelated dispensing history.
  create temp table wp09_discard_nonlab_fixture as select i.workspace_id,i.id from public.order_catalog_items i
    where i.workspace_id=any(targets) and i.category_group<>'lab'
      and not exists(select 1 from wp09_pre_history_catalog_ids prior_ids where prior_ids.workspace_id=i.workspace_id and prior_ids.id=i.id);
  delete from public.notification_events n using public.workspace_master_updates u,wp09_discard_nonlab_fixture f
    where u.workspace_id=f.workspace_id and u.order_catalog_item_id=f.id and n.workspace_id=u.workspace_id
      and n.notification_id='notif-clinical-master-'||u.id::text;
  delete from public.workspace_master_updates u using wp09_discard_nonlab_fixture f
    where u.workspace_id=f.workspace_id and u.order_catalog_item_id=f.id;
  delete from public.order_catalog_items i using wp09_discard_nonlab_fixture f where i.workspace_id=f.workspace_id and i.id=f.id;
  create temp table wp09_historical_wbc_links as
    select l.workspace_id,l.id,to_jsonb(l) as original_row
    from public.order_catalog_lab_test_item_links l join master.master_records m on m.id=l.source_master_test_record_id
    where l.workspace_id=any(targets) and m.master_key='cm.lab-test.cbc-wbc';
  if (select count(distinct workspace_id) from wp09_historical_wbc_links)<>3
    or exists(select 1 from wp09_historical_wbc_links where (original_row->>'source_master_order_revision')::integer<>1
      or (original_row->>'owner_pinned_source_test_revision')::integer<>1 or (original_row->>'pinned_workspace_result_revision')::integer<>1) then
    raise exception 'test historical WBC owner1 fixture absent'; end if;
  result:=private.publish_clinical_master_release(jsonb_set((select seed from wp09_scoped_input),'{releaseKey}','"wp09.scoped-rollout.local-baseline"'));
  foreach w in array targets loop
    perform private.clair_adopt_master_release_to_workspace(w,(result->>'releaseId')::uuid);
    for profile in select * from master.dispensing_order_profiles order by profile_key loop
      select * into strict c from public.order_catalog_items where workspace_id=w and source_master_record_id=profile.order_record_id;
      select * into strict product from master.medication_products where id=profile.product_id and revision=profile.product_revision;
      snapshot:=jsonb_build_object('schemaVersion',1,'sourceDispensingProfileId',profile.id,'sourceDispensingProfileRevision',profile.profile_revision,
        'sourceMedicationProductId',product.id,'sourceMedicationProductRevision',product.revision,'productKey',product.product_key,
        'englishProductName',product.english_product_name,'koreanDraftName',product.korean_draft_name,'koreanReviewStatus',product.korean_review_status,
        'dosageForm',product.dosage_form,'routes',to_jsonb(profile.allowed_routes),'strengthSnapshot',product.strength_snapshot,
        'targetSpecies',(select jsonb_agg(s.species_code order by s.species_code) from master.medication_species_applicability a
          join master.species s on s.master_record_id=a.species_record_id where a.product_id=product.id and a.product_revision=product.revision),'clinicalUseAllowed',false);
      update public.order_catalog_items set source_master_revision=profile.order_record_revision,
        source_dispensing_profile_id=profile.id,source_dispensing_profile_revision=profile.profile_revision,
        dispensing_profile_snapshot=snapshot,dispensing_profile_snapshot_sha256=private.clinical_master_sha256(snapshot),
        availability_status='pending_activation' where workspace_id=w and id=c.id;
    end loop;
    -- Synthetic fixture prices reproduce existing hospital-owned amounts.
    update public.order_catalog_items set price_krw=23000,pricing_rule=pricing_rule||'{"priceKrw":23000}'::jsonb
      where workspace_id=w and source_master_record_id in
        (select m.id from master.master_records m join jsonb_array_elements((select seed from wp09_scoped_input)->'records') r on r->>'masterKey'=m.master_key where r->>'recordType'='order');
    -- Read-only remote baseline confirmed original414 nonprofile rows active,
    -- linked108 pending_activation in each target. Reproduce existing history,
    -- not a candidate runtime shortcut or clinical approval.
    update public.order_catalog_items set availability_status='active' where workspace_id=w and source_dispensing_profile_id is null
      and source_master_record_id in (select m.id from master.master_records m join jsonb_array_elements((select seed from wp09_scoped_input)->'records') r on r->>'masterKey'=m.master_key where r->>'recordType'='order');
    update public.workspace_master_updates u set status='accepted',resolved_by_user_id=auth.uid(),resolved_at=now()
      from public.order_catalog_items i where u.workspace_id=w and i.workspace_id=w and i.id=u.order_catalog_item_id
      and u.update_type='new' and u.status='pending' and i.source_dispensing_profile_id is null and i.availability_status='active';
    -- CBC-HCT's verified remote baseline has hospital price/availability
    -- provenance, not customized laboratory membership.
    update public.order_catalog_items i set customization_state='customized',customized_fields=array['availabilityStatus','priceKrw'],
      last_customized_at=now(),last_customized_by_user_id=auth.uid()::text from master.master_records m
      where m.id=i.source_master_record_id and i.workspace_id=w and m.master_key='cm.order.lab.test.cbc-hct';
    if (select count(*) from public.order_catalog_items where workspace_id=w and source_master_record_id is not null
      and source_dispensing_profile_id is null and availability_status='active')<>414 then raise exception 'test original414active fixture missing:%',w; end if;
    update public.lab_test_items set customization_state='unmodified' where workspace_id=w and source_master_record_id is not null;
    if (select count(*) from public.order_catalog_items where workspace_id=w and source_dispensing_profile_id is not null)<>108 then raise exception 'test linked108 fixture missing:%',w; end if;
    if (select count(*) from public.lab_test_items where workspace_id=w and source_master_record_id is not null and customization_state='unmodified')<>69 then raise exception 'test pinned lab69 fixture missing:%',w; end if;
  end loop;
  if exists(select 1 from wp09_historical_wbc_links b join public.order_catalog_lab_test_item_links l on l.workspace_id=b.workspace_id and l.id=b.id
    join master.master_records m on m.id=l.source_master_order_record_id
    join master.master_record_versions old_owner on old_owner.master_record_id=m.id and old_owner.revision=1
    join master.master_record_versions new_owner on new_owner.master_record_id=m.id and new_owner.revision=2
    where m.current_revision<>2 or l.source_master_order_revision<>1
      or old_owner.snapshot->'labOrderProfiles' is distinct from new_owner.snapshot->'labOrderProfiles') then
    raise exception 'test historical WBC owner1 current2 immutable profile drift'; end if;
  update public.order_catalog_items i set price_krw=null,billing_eligible=false,billing_reflection_enabled=false,
    pricing_rule=(pricing_rule-'priceKrw')||'{"billingReflectionEnabled":false}'::jsonb
    from master.master_records m where m.id=i.source_master_record_id and i.workspace_id='workspace-clinical-master-pilot-v1'
      and m.master_key in ('phase1.optionb.v1.order.metabolic','cm.order.consult.initial');
  create temp table wp09_nonbillable_before as select i.id,i.workspace_id,i.price_krw,i.pricing_rule,i.billing_eligible,i.billing_reflection_enabled,i.sales_unit
    from public.order_catalog_items i join master.master_records m on m.id=i.source_master_record_id where i.workspace_id='workspace-clinical-master-pilot-v1'
      and m.master_key in ('phase1.optionb.v1.order.metabolic','cm.order.consult.initial');
  if (select count(*) from wp09_nonbillable_before)<>2 then raise exception 'test two preexisting nonbillable fixtures absent'; end if;
  select * into strict c from public.order_catalog_items where workspace_id='clair-demo' and source_dispensing_profile_id is not null order by id limit 1;
  update public.order_catalog_items set price_krw=777,customization_state='customized',customized_fields=array['priceKrw'],
    pricing_rule=pricing_rule||'{"priceKrw":777}'::jsonb where workspace_id=c.workspace_id and id=c.id;
  create temp table wp09_price_override as select c.workspace_id,c.id,777 as price_krw;
  -- Local DB execution-preset UUID/revision history differs from remote history.
  -- Profile/composition IDs remain exactly the authored configuration IDs.
  p:=v_packet->'payload';
  for rec in select value from jsonb_array_elements(p->'records') where value->>'recordType'='order' loop
    select cur.* into ptr from master.order_execution_preset_current cur join master.master_records m on m.id=cur.order_record_id where m.master_key=rec->>'masterKey';
    if found then
      select * into strict old from master.order_execution_presets where id=ptr.preset_id and preset_revision=ptr.preset_revision and order_record_id=ptr.order_record_id;
      preset:=rec#>'{detail,executionPreset}';
      preset:=preset||jsonb_build_object('presetId',old.id,'presetKey',old.preset_key,'presetRevision',
        (select max(preset_revision)+1 from master.order_execution_presets where order_record_id=ptr.order_record_id));
      preset:=preset||jsonb_build_object('contentSha256',private.clinical_master_sha256(private.clair_order_execution_preset_hash_content(preset)));
      rec:=jsonb_set(rec,'{detail,executionPreset}',preset);
      select jsonb_set(p,'{records}',jsonb_agg(case when r->>'masterKey'=rec->>'masterKey' then rec else r end order by ordinal))
        into p from jsonb_array_elements(p->'records') with ordinality rows(r,ordinal);
    end if;
  end loop;
  select jsonb_agg(jsonb_build_object('workspaceId',i.workspace_id,'catalogId',i.id,'catalogRevision',i.catalog_revision,'catalogSha256',private.clinical_master_sha256(to_jsonb(i)),
    'masterKey',m.master_key,'profileId',pr.id,'profileRevision',pr.profile_revision,'profileSha256',private.clinical_master_sha256(to_jsonb(pr)),
    'presetSha256',(select r#>>'{detail,executionPreset,contentSha256}' from jsonb_array_elements(p->'records') r where r->>'masterKey'=m.master_key)) order by i.workspace_id,i.id)
    into expected from public.order_catalog_items i join master.dispensing_order_profiles pr on pr.id=i.source_dispensing_profile_id and pr.profile_revision=i.source_dispensing_profile_revision
    join master.master_records m on m.id=i.source_master_record_id where i.workspace_id=any(targets);
  select jsonb_agg(jsonb_build_object('workspaceId',i.workspace_id,'id',i.id,'rowSha256',private.clinical_master_sha256(to_jsonb(i))) order by i.workspace_id,i.id)
    into lab_items from public.lab_test_items i where i.workspace_id=any(targets) and i.source_master_record_id is not null;
  if jsonb_array_length(expected)<>324 or jsonb_array_length(lab_items)<>207 then raise exception 'test frozen324_207 missing'; end if;
  v_packet:=jsonb_set(v_packet,'{payload}',p)||jsonb_build_object('preflight',jsonb_build_object('fingerprints',private.clair_oed_20260906_fingerprints(),'rebind',expected,'labItems',lab_items));
  update wp09_scoped_input set packet=v_packet;
  raise notice 'PASS WP09 local baseline: original522, linked108, lab69 per workspace; existing price override; packet frozen324/207';
end $fixture$;

create temp table wp09_catalog_cascade_observations(update_id uuid primary key,links_before jsonb,accepted boolean default false);
create function pg_temp.wp09_observe_catalog_cascade() returns trigger language plpgsql as $fn$
declare links_now jsonb; frozen jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]') into links_now
    from public.order_catalog_lab_test_item_links l where l.workspace_id=new.workspace_id and l.order_catalog_item_id=new.order_catalog_item_id;
  if tg_op='INSERT' then
    insert into wp09_catalog_cascade_observations values(new.id,links_now,false);
  elsif new.status='accepted' and old.status='pending' then
    select links_before into strict frozen from wp09_catalog_cascade_observations where update_id=new.id;
    if links_now is distinct from frozen then raise exception 'test catalog-only resolver changed link bytes'; end if;
    update wp09_catalog_cascade_observations set accepted=true where update_id=new.id;
  end if;
  return new;
end $fn$;
create trigger wp09_observe_catalog_cascade after insert or update on public.workspace_lab_catalog_updates
  for each row execute function pg_temp.wp09_observe_catalog_cascade();

create temp table wp09_direct_mutations(kind text,before_row jsonb,after_row jsonb);
create function pg_temp.wp09_capture_direct_mutation() returns trigger language plpgsql as $fn$
begin
  if old.price_krw is null and new.price_krw is not null then
    insert into wp09_direct_mutations values('price',to_jsonb(old),to_jsonb(new));
  end if;
  if old.availability_status<>'paused' and new.availability_status='paused' then
    insert into wp09_direct_mutations values('pause',to_jsonb(old),to_jsonb(new));
  end if;
  return new;
end $fn$;
create trigger wp09_capture_direct_mutation after update on public.order_catalog_items for each row execute function pg_temp.wp09_capture_direct_mutation();
create function pg_temp.wp09_fail_at_receipt() returns trigger language plpgsql as $fn$
begin raise exception 'wp09_test_late_failure'; end $fn$;

-- Each structural drift is independently schema-valid and fully rolled back.
-- Refreshing only the packet fingerprint proves the semantic guard rejects it,
-- rather than merely exercising the unrelated stale-preflight check.
create function pg_temp.wp09_reject_structural_drift(kind text) returns void language plpgsql as $fn$
declare p jsonb:=(select packet from wp09_scoped_input); before_full jsonb:=pg_temp.wp09_full_fingerprint();
  target public.order_catalog_lab_test_item_links; extra public.lab_test_items; mutated_id text; err text;
begin
  select l.* into strict target from public.order_catalog_lab_test_item_links l
    join master.master_records o on o.id=l.source_master_order_record_id
    join master.master_records t on t.id=l.source_master_test_record_id
    where l.workspace_id='clair-demo' and o.master_key='cm.order.lab.panel.cbc-basic' and t.master_key='cm.lab-test.cbc-wbc';
  begin
    mutated_id:=target.id;
    case kind
      when 'workspace_custom' then update public.order_catalog_lab_test_item_links set link_origin='workspace_custom',
        source_master_test_record_id=null,owner_pinned_source_test_revision=null,source_ordinal=null where workspace_id=target.workspace_id and id=target.id;
      when 'missing' then delete from public.order_catalog_lab_test_item_links where workspace_id=target.workspace_id and id=target.id;
      when 'ordinal' then update public.order_catalog_lab_test_item_links set source_ordinal=source_ordinal+1000,
        effective_sort_order=effective_sort_order+1000,sort_order=sort_order+1000 where workspace_id=target.workspace_id and id=target.id;
      when 'required' then update public.order_catalog_lab_test_item_links set required=not required where workspace_id=target.workspace_id and id=target.id;
      when 'group' then update public.order_catalog_lab_test_item_links set display_group='wp09-negative-group' where workspace_id=target.workspace_id and id=target.id;
      when 'profile' then update public.order_catalog_lab_test_item_links set profile_kind='standalone_test',
        source_master_panel_record_id=null,source_master_panel_revision=null,source_ordinal=null where workspace_id=target.workspace_id and id=target.id;
      when 'extra' then
        select i.* into strict extra from public.lab_test_items i where i.workspace_id=target.workspace_id and i.source_master_record_id is not null
          and not exists(select 1 from public.order_catalog_lab_test_item_links l where l.workspace_id=i.workspace_id
            and l.order_catalog_item_id=target.order_catalog_item_id and l.lab_test_item_id=i.id) order by i.id limit 1;
        mutated_id:='wp09-negative-extra';
        insert into public.order_catalog_lab_test_item_links select (jsonb_populate_record(null::public.order_catalog_lab_test_item_links,
          to_jsonb(target)||jsonb_build_object('id',mutated_id,'lab_test_item_id',extra.id,'source_master_test_record_id',extra.source_master_record_id,
            'owner_pinned_source_test_revision',extra.source_master_revision,'pinned_workspace_result_revision',extra.workspace_result_revision,
            'source_ordinal',1000,'effective_sort_order',1000,'sort_order',1000))).*;
      else raise exception 'test unknown structural drift:%',kind;
    end case;
    update public.order_catalog_lab_test_item_links l set snapshot_metadata=l.snapshot_metadata||jsonb_build_object(
      'linkOrigin',l.link_origin,'profileKind',l.profile_kind,'masterPanelRecordId',l.source_master_panel_record_id,
      'masterPanelRevision',l.source_master_panel_revision,'masterTestRecordId',l.source_master_test_record_id,
      'ownerPinnedSourceTestRevision',l.owner_pinned_source_test_revision,'labTestItemId',l.lab_test_item_id,
      'pinnedWorkspaceResultRevision',l.pinned_workspace_result_revision,'sourceOrdinal',l.source_ordinal,
      'effectiveSortOrder',l.effective_sort_order,'required',l.required,'displayGroup',l.display_group)
      where l.workspace_id=target.workspace_id and l.id=mutated_id;
    update public.order_catalog_lab_test_item_links l set snapshot_metadata_sha256=private.clinical_master_sha256(l.snapshot_metadata)
      where l.workspace_id=target.workspace_id and l.id=mutated_id;
    p:=jsonb_set(p,'{preflight,fingerprints}',private.clair_oed_20260906_fingerprints());
    perform private.clair_apply_oed_20260906_candidate(p,private.clinical_master_sha256(p),false);
    raise exception 'test structural drift accepted:%',kind;
  exception when others then
    get stacked diagnostics err=message_text;
    if (err not like 'oed_lab_catalog_cascade_structural_drift%' and err not like 'oed_lab_catalog_cascade_not_eligible%')
      or right(err,length(target.workspace_id||':'||target.order_catalog_item_id))<>(target.workspace_id||':'||target.order_catalog_item_id) then raise; end if;
  end;
  if pg_temp.wp09_full_fingerprint() is distinct from before_full then raise exception 'test structural drift rollback left residue:%',kind; end if;
  raise notice 'PASS WP09 structural drift rejected and rolled back: % (%)',kind,err;
end $fn$;
select pg_temp.wp09_reject_structural_drift('workspace_custom') where current_setting('wp09.positive_only',true)<>'true';
select pg_temp.wp09_reject_structural_drift('extra') where current_setting('wp09.positive_only',true)<>'true';
select pg_temp.wp09_reject_structural_drift('missing') where current_setting('wp09.positive_only',true)<>'true';
select pg_temp.wp09_reject_structural_drift('ordinal') where current_setting('wp09.positive_only',true)<>'true';
select pg_temp.wp09_reject_structural_drift('required') where current_setting('wp09.positive_only',true)<>'true';
select pg_temp.wp09_reject_structural_drift('group') where current_setting('wp09.positive_only',true)<>'true';
select pg_temp.wp09_reject_structural_drift('profile') where current_setting('wp09.positive_only',true)<>'true';

do $assert$
declare p jsonb:=(select packet from wp09_scoped_input); sha text; bad jsonb; before_full jsonb; after_full jsonb;
  result jsonb; retry jsonb; w text; n integer; err text;
begin
  sha:=private.clinical_master_sha256(p); before_full:=pg_temp.wp09_full_fingerprint();
  if current_setting('wp09.positive_only',true)<>'true' then
  foreach w in array array['anon','authenticated','service_role'] loop
    if has_function_privilege(w,'private.clair_apply_oed_20260906_candidate(jsonb,text,boolean)','EXECUTE')
      or has_function_privilege(w,'private.clair_oed_20260906_fingerprints()','EXECUTE') then raise exception 'test operator helper exposed:%',w; end if;
    begin
      execute format('set local role %I',w);
      perform private.clair_apply_oed_20260906_candidate(p,sha,false);
      raise exception 'test nonoperator execute accepted';
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
    perform private.clair_apply_oed_20260906_candidate(p,sha,false);
    raise exception 'test nonmanager actor accepted';
  exception when insufficient_privilege then null; end;
  begin
    if not exists(select 1 from public.user_memberships where workspace_id='clair-demo' and user_id='00000000-0000-4000-8000-000000000013'::uuid and status='inactive') then raise exception 'test inactive membership fixture absent'; end if;
    perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000013',true);
    perform private.clair_apply_oed_20260906_candidate(p,sha,false);
    raise exception 'test inactive actor accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform private.clair_apply_oed_20260906_candidate(p,repeat('0',64),false);
    raise exception 'test invalid SHA accepted';
  exception when others then get stacked diagnostics err=message_text; if err<>'oed_packet_contract_mismatch' then raise; end if; end;
  bad:=jsonb_set(p,'{configuration,workspaceAllowlist,2}','"clair-foreign-demo"');
  begin
    perform private.clair_apply_oed_20260906_candidate(bad,private.clinical_master_sha256(bad),false);
    raise exception 'test foreign scope accepted';
  exception when others then get stacked diagnostics err=message_text; if err<>'oed_packet_contract_mismatch' then raise; end if; end;
  bad:=jsonb_set(p,'{newKeys}',(p->'newKeys')-0);
  begin
    perform private.clair_apply_oed_20260906_candidate(bad,private.clinical_master_sha256(bad),false);
    raise exception 'test short exact scope accepted';
  exception when others then get stacked diagnostics err=message_text; if err<>'oed_exact_scope_required' then raise; end if; end;
  bad:=jsonb_set(p,'{preflight,fingerprints,0,sha256}',to_jsonb(repeat('0',64)));
  begin
    perform private.clair_apply_oed_20260906_candidate(bad,private.clinical_master_sha256(bad),false);
    raise exception 'test stale preflight accepted';
  exception when serialization_failure then null; end;
  if pg_temp.wp09_full_fingerprint() is distinct from before_full then raise exception 'test rejected packet changed permanent state'; end if;
  result:=private.clair_apply_oed_20260906_candidate(p,sha,false);
  if result->'applied'<>'false'::jsonb or result->'rehearsal'<>'true'::jsonb then raise exception 'test rehearsal result missing'; end if;
  if pg_temp.wp09_full_fingerprint() is distinct from before_full then raise exception 'test rehearsal left full-table residue'; end if;
  if exists(select 1 from private.oed_20260906_rollout_receipt) then raise exception 'test rehearsal receipt persisted'; end if;
  raise notice 'PASS WP09 false rehearsal: every permanent public/master/private table unchanged; SHA/scope/foreign/stale rejected';
  create trigger wp09_fail_at_receipt before insert on private.oed_20260906_rollout_receipt for each row execute function pg_temp.wp09_fail_at_receipt();
  begin
    perform private.clair_apply_oed_20260906_candidate(p,sha,true);
    raise exception 'test late-stage injected failure did not run';
  exception when others then get stacked diagnostics err=message_text; if err<>'wp09_test_late_failure' then raise; end if; end;
  drop trigger wp09_fail_at_receipt on private.oed_20260906_rollout_receipt;
  if pg_temp.wp09_full_fingerprint() is distinct from before_full or exists(select 1 from wp09_direct_mutations) then raise exception 'test late failure left residue'; end if;
  raise notice 'PASS WP09 ACL denial anon/authenticated/service_role, nonmanager/inactive actor denial, receipt-stage failure fully rolled back';
  end if;
  result:=private.clair_apply_oed_20260906_candidate(p,sha,true);
  if result->'applied'<>'true'::jsonb or result->'rehearsal'<>'false'::jsonb then raise exception 'test apply result missing'; end if;
  if coalesce(jsonb_array_length(result->'labOwnerRefreshEvidence'),0)=0
    or exists(select 1 from jsonb_array_elements(result->'labOwnerRefreshEvidence') e
      where e->>'writer'<>'clair_update_order_catalog_item_lab_definition' or e->'workspaceResultPinsPreserved'<>'true'::jsonb
        or e->>'beforeLinksSha256'=e->>'afterLinksSha256'
        or not exists(select 1 from public.audit_events a where a.workspace_id=e->>'workspaceId' and a.target_id=e->>'catalogId'
          and a.metadata->>'action' like 'oed_immutable_lab_owner_refresh:%')) then
    raise exception 'test immutable lab owner refresh evidence or audit absent'; end if;
  -- The result creator validates owner pins for every sibling, including tests
  -- whose definition did not change. Current lab-item revisions alone are not
  -- sufficient evidence that a catalog can produce a new result.
  select jsonb_agg(to_jsonb(mismatch) order by mismatch.workspace_id,mismatch.master_key,mismatch.link_order_revision) into bad from (
    select i.workspace_id,m.master_key,i.source_master_revision as catalog_order_revision,l.source_master_order_revision as link_order_revision,
      l.source_master_panel_revision as link_panel_revision,(profile.value->>'labPanelMasterRevision')::integer as immutable_panel_revision,
      jsonb_agg(t.master_key order by t.master_key) as member_keys
    from public.order_catalog_items i join master.master_records m on m.id=i.source_master_record_id
    join master.master_record_versions v on v.master_record_id=m.id and v.revision=i.source_master_revision
    join public.order_catalog_lab_test_item_links l on l.workspace_id=i.workspace_id and l.order_catalog_item_id=i.id
    left join master.master_records t on t.id=l.source_master_test_record_id
    left join lateral jsonb_array_elements(coalesce(v.snapshot->'labOrderProfiles','[]')) profile(value) on profile.value->>'orderMasterKey'=m.master_key
    where i.workspace_id in(select jsonb_array_elements_text(p#>'{configuration,workspaceAllowlist}'))
      and m.master_key in(select r->>'masterKey' from jsonb_array_elements(p#>'{payload,records}') r where r->>'recordType'='order')
      and i.category_group='lab' and l.link_origin in ('clair_master','workspace_custom')
      and (l.source_master_order_record_id is distinct from i.source_master_record_id or l.source_master_order_revision is distinct from i.source_master_revision
        or l.source_master_panel_record_id is distinct from (profile.value->>'labPanelMasterRecordId')::uuid
        or l.source_master_panel_revision is distinct from (profile.value->>'labPanelMasterRevision')::integer)
    group by i.workspace_id,m.master_key,i.source_master_revision,l.source_master_order_revision,l.source_master_panel_revision,profile.value->>'labPanelMasterRevision'
  ) mismatch;
  if bad is not null then raise exception 'test current lab creator owner mismatch:%',bad; end if;
  for w in select jsonb_array_elements_text(p#>'{configuration,workspaceAllowlist}') loop
    select count(*) into n from public.order_catalog_items i join master.master_records m on m.id=i.source_master_record_id
      where i.workspace_id=w and m.master_key in(select r->>'masterKey' from jsonb_array_elements(p#>'{payload,records}') r where r->>'recordType'='order')
        and i.source_master_revision=m.current_revision and not i.clinical_use_allowed
        and (i.availability_status='active' or (i.availability_status='pending_activation' and private.clair_dispensing_service_review_catalog_item_allowed(w,i.id)));
    if n<>524 then raise exception 'test selectable524 missing:%:%',w,n; end if;
    if (select count(*) from public.order_catalog_items i join master.master_records m on m.id=i.source_master_record_id
      where i.workspace_id=w and m.master_key in(select jsonb_array_elements_text(p->'retiredKeys')) and i.availability_status='paused')<>51 then raise exception 'test paused51 missing'; end if;
    if (select count(*) from jsonb_array_elements(p#>'{configuration,pricingAssignments}') x join master.master_records m on m.master_key=x->>'orderMasterKey'
      join public.order_catalog_items i on i.source_master_record_id=m.id and i.workspace_id=x->>'workspaceId'
      where i.workspace_id=w and i.price_krw=(x->>'priceKrw')::integer)<>53 then raise exception 'test prices53 mismatch'; end if;
  end loop;
  if (select count(*) from public.workspace_lab_devices)<>9 or (select count(*) from public.workspace_lab_result_profile_bindings)<>519
    or (select count(*) from public.workspace_lab_composition_revisions)<>90 then raise exception 'test devices9_bindings519_compositions90 missing'; end if;
  if (select count(*) from public.workspace_lab_composition_revisions where billing_policy='preserve_parent_price')<>89
    or (select count(*) from public.workspace_lab_composition_revisions where billing_policy='no_charge')<>1
    or (select count(*) from public.workspace_lab_composition_revisions r join public.order_sets s on s.id=r.order_set_id and s.workspace_id=r.workspace_id)<>90 then
    raise exception 'test sets90_parent89_nocharge1 missing'; end if;
  if exists(select 1 from public.workspace_lab_composition_revisions r join public.order_set_revisions s
    on s.workspace_id=r.workspace_id and s.id=r.order_set_revision_id join public.order_catalog_items c
    on c.workspace_id=r.workspace_id and c.id=r.original_catalog_item_id
    where (r.billing_policy='preserve_parent_price' and (s.set_price_krw is distinct from c.price_krw or not s.billing_reflection_enabled))
      or (r.billing_policy='no_charge' and (s.billing_reflection_enabled or s.set_price_krw is not null))) then raise exception 'test parent charge preserved or nocharge billing mismatch'; end if;
  if exists(select 1 from public.workspace_lab_composition_revisions r join public.order_set_revision_items i
    on i.workspace_id=r.workspace_id and i.order_set_revision_id=r.order_set_revision_id where i.billing_reflection_default) then
    raise exception 'test atomic fee leaked into parent or nocharge set'; end if;
  if exists(select 1 from wp09_price_override x join public.order_catalog_items i on i.workspace_id=x.workspace_id and i.id=x.id
    where i.price_krw<>x.price_krw or not ('priceKrw'=any(i.customized_fields))) then raise exception 'test hospital price override lost'; end if;
  if exists(select 1 from wp09_nonbillable_before b join public.order_catalog_items c on c.workspace_id=b.workspace_id and c.id=b.id where
    (c.price_krw,c.pricing_rule,c.billing_eligible,c.billing_reflection_enabled,c.sales_unit) is distinct from
    (b.price_krw,b.pricing_rule,b.billing_eligible,b.billing_reflection_enabled,b.sales_unit)
    or not ('billingReflectionEnabled'=any(c.customized_fields))
    or c.source_projection_snapshot#>'{order,defaultBillingReflectionEnabled}' is distinct from 'true'::jsonb
    or c.source_projection_snapshot is distinct from private.clinical_master_order_source_projection(c.source_master_record_id)) then
    raise exception 'test two pilot nonbillable amounts marker or canonical source lost'; end if;
  if (select count(*) from public.audit_events a join wp09_nonbillable_before b on b.workspace_id=a.workspace_id and b.id=a.target_id
    where a.metadata->>'action' like 'oed_source_accepted_existing_nonbillable_preserved:%' and a.event_type='order_catalog.updated'
      and a.metadata->'changedFields' @> '["sourceMasterRevision","sourceProjectionSnapshot","billingReflectionEnabled"]'::jsonb
      and (a.before_snapshot->'priceKrw',a.before_snapshot->'salesUnit',a.before_snapshot->'billingReflectionEnabled',a.before_snapshot->'pricingRule')
        is not distinct from (a.after_snapshot->'priceKrw',a.after_snapshot->'salesUnit',a.after_snapshot->'billingReflectionEnabled',a.after_snapshot->'pricingRule'))<>2 then
    raise exception 'test two nonbillable source acceptance audits absent'; end if;
  if (select count(*) from wp09_direct_mutations where kind='price')<>159 or (select count(*) from wp09_direct_mutations where kind='pause')<>153 then raise exception 'test direct mutations159_153 missing'; end if;
  if exists(select 1 from wp09_direct_mutations where kind='price' and (
    before_row-array['price_krw','pricing_rule','customization_state','customized_fields','last_customized_at','last_customized_by_user_id','catalog_revision','updated_at']
      is distinct from after_row-array['price_krw','pricing_rule','customization_state','customized_fields','last_customized_at','last_customized_by_user_id','catalog_revision','updated_at']
    or (before_row->'pricing_rule')-'priceKrw' is distinct from (after_row->'pricing_rule')-'priceKrw'))
    or exists(select 1 from wp09_direct_mutations where kind='pause' and before_row-array['availability_status','customization_state','customized_fields','last_customized_at','last_customized_by_user_id','catalog_revision','updated_at']
      is distinct from after_row-array['availability_status','customization_state','customized_fields','last_customized_at','last_customized_by_user_id','catalog_revision','updated_at']) then raise exception 'test direct price or pause changed defaults clinical review or metadata'; end if;
  if exists(select 1 from wp09_direct_mutations where not ((after_row->'customized_fields') @> (before_row->'customized_fields'))
    or not ((after_row->'customized_fields') @> jsonb_build_array(case when kind='price' then 'priceKrw' else 'availabilityStatus' end))) then raise exception 'test direct mutation provenance missing or overwritten'; end if;
  after_full:=pg_temp.wp09_full_fingerprint();
  retry:=private.clair_apply_oed_20260906_candidate(p,sha,true);
  if retry-'retry' is distinct from result or retry->'retry'<>'true'::jsonb then raise exception 'test exact retry outcome changed'; end if;
  if pg_temp.wp09_full_fingerprint() is distinct from after_full then raise exception 'test exact retry changed permanent state'; end if;
  if not exists(select 1 from wp09_catalog_cascade_observations where accepted) then raise exception 'test historical catalog-only cascade not exercised'; end if;
  raise notice 'PASS WP09 true inside outer rollback: selectable524/paused51/new prices53 per workspace; devices9/bindings519/compositions90; exact retry stable';
end $assert$;
