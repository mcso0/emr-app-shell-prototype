-- Append-only repair: approve immutable, structurally identical stale catalog
-- owners through the existing pure-cascade resolver before frozen item CAS.
-- No public API/grant changes; no direct link DML or weaker owner predicate.
create or replace function private.clair_apply_oed_20260906_candidate(p_packet jsonb,p_packet_sha256 text,p_commit boolean default false)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private,master as $fn$
declare targets constant text[]:=array['clair-demo','workspace-clair-cheongdam','workspace-clinical-master-pilot-v1'];
  v_release_key constant text:='cm.release.order-defaults-complete.2026-09-06.v1';
  payload jsonb:=p_packet->'payload'; config jsonb:=p_packet->'configuration'; preflight jsonb:=p_packet->'preflight';
  receipt private.oed_20260906_rollout_receipt; w text; x jsonb; expected jsonb; before_rows jsonb; after_rows jsonb;
  c public.order_catalog_items; changed public.order_catalog_items; lab public.lab_test_items; u record;
  v_release_id uuid; result jsonb; outcome jsonb; candidates text[]; retired text[]; additions text[];
  old_prices jsonb; old_profiles jsonb; old_lab_versions jsonb; old_set_versions jsonb;
  old_products text; old_reviews text; n integer; profile_id uuid; request_id uuid; before_retry jsonb;
  source_snapshot jsonb; incoming_preset jsonb; source_order jsonb; source_classification jsonb; source_path uuid;
  lab_revision integer; lab_projection jsonb; workspace_snapshot jsonb; affected_ids text[]; expected_links jsonb;
  accepted_link_ids text[]:='{}'; old_lab_links jsonb; old_notifications jsonb;
  catalog_target_ids uuid[]:='{}'; catalog_links_before jsonb; catalog_old_snapshot jsonb; catalog_members jsonb;
  catalog_old_order jsonb; catalog_new_order jsonb; catalog_old_profile jsonb; catalog_new_profile jsonb;
  catalog_old_panel jsonb; catalog_new_panel jsonb; catalog_new_revision integer;
  owner_link public.order_catalog_lab_test_item_links; owner_patch jsonb; owner_refresh_evidence jsonb:='[]';
begin
  if auth.uid() is null or p_commit is null then raise exception 'oed_operator_actor_required' using errcode='42501'; end if;
  if private.clinical_master_sha256(p_packet) is distinct from p_packet_sha256
    or payload->>'releaseKey' is distinct from v_release_key or payload->>'adoptionScope' is distinct from 'payload'
    or config->'workspaceAllowlist' is distinct from to_jsonb(targets)
    or config->>'foreignControl' is distinct from 'clair-foreign-demo'
    or config->'applied' is distinct from 'false'::jsonb
    or config->>'defaultRetestBillingPolicy' is distinct from 'no_charge' then raise exception 'oed_packet_contract_mismatch'; end if;
  select array_agg(r->>'masterKey' order by r->>'masterKey') into candidates from jsonb_array_elements(payload->'records') r where r->>'recordType'='order';
  select array_agg(value order by value) into retired from jsonb_array_elements_text(p_packet->'retiredKeys');
  select array_agg(value order by value) into additions from jsonb_array_elements_text(p_packet->'newKeys');
  if cardinality(candidates)<>524 or cardinality(retired)<>51 or cardinality(additions)<>53
    or (select count(distinct v) from unnest(candidates) v)<>524
    or (select count(distinct v) from unnest(retired) v)<>51
    or (select count(distinct v) from unnest(additions) v)<>53
    or candidates && retired or not additions<@candidates
    or jsonb_array_length(config->'pricingAssignments')<>159 or jsonb_array_length(config->'bindings')<>519
    or jsonb_array_length(config->'devices')<>9 or jsonb_array_length(config->'compositionAssignments')<>90
    or jsonb_array_length(preflight->'rebind')<>324 or jsonb_array_length(preflight->'labItems')<>207 then raise exception 'oed_exact_scope_required'; end if;
  foreach w in array targets loop
    if not private.clair_is_active_workspace_member(w) or not private.clair_current_user_has_workspace_permission(w,'service_catalog:manage') then
      raise exception 'oed_workspace_permission_missing' using errcode='42501'; end if;
    perform pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:'||w,0));
    if (select count(distinct value->>'orderMasterKey') from jsonb_array_elements(config->'pricingAssignments') where value->>'workspaceId'=w)<>53
      or (select count(distinct (value->>'orderMasterKey',value->>'species')) from jsonb_array_elements(config->'bindings') where value->>'workspaceId'=w)<>173
      or (select count(distinct value->>'id') from jsonb_array_elements(config->'devices') where value->>'workspaceId'=w)<>3
      or (select count(distinct value->>'compositionVersionId') from jsonb_array_elements(config->'compositionAssignments') where value->>'workspaceId'=w)<>30
      or (select count(distinct value->>'id') from jsonb_array_elements(preflight->'labItems') where value->>'workspaceId'=w)<>69 then raise exception 'oed_workspace_exact_counts_required'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(config->'bindings') b where not exists(
    select 1 from jsonb_array_elements(payload->'labResultProfiles') p where p->>'id'=b->>'profileVersionId'
      and p->>'species'=b->>'species' and p#>>'{device,manufacturer}'='CLAiR' and p#>>'{device,kind}'='manual'
      and p->'clinicalUseAllowed'='false'::jsonb)
    or not exists(select 1 from jsonb_array_elements_text(payload->'labResultProfileOrderKeys') k where k=b->>'orderMasterKey'))
    or exists(select 1 from jsonb_array_elements(config->'compositionAssignments') a where not exists(
      select 1 from jsonb_array_elements(payload->'labCompositions') p where p->>'id'=a->>'compositionVersionId'
        and p->>'masterKey'=a->>'compositionMasterKey' and p->>'originalOrderMasterKey'=a->>'originalOrderMasterKey')) then raise exception 'oed_configuration_source_mismatch'; end if;
  select * into receipt from private.oed_20260906_rollout_receipt r where r.release_key=v_release_key;
  if found then
    if receipt.packet_sha256<>p_packet_sha256 or receipt.actor_user_id<>auth.uid() then raise exception 'oed_retry_packet_conflict'; end if;
    if private.clair_oed_20260906_fingerprints() is distinct from receipt.outcome->'afterFingerprints' then raise exception 'oed_applied_state_drift'; end if;
    return receipt.outcome||jsonb_build_object('retry',true);
  end if;
  before_rows:=private.clair_oed_20260906_fingerprints();
  if before_rows is distinct from preflight->'fingerprints' then raise exception 'oed_preflight_drift' using errcode='40001'; end if;
  select jsonb_agg(jsonb_build_object('workspaceId',i.workspace_id,'id',i.id,'price',i.price_krw,'pricingRule',i.pricing_rule,
    'billingEligible',i.billing_eligible,'billingReflection',i.billing_reflection_enabled,'salesUnit',i.sales_unit) order by i.workspace_id,i.id)
    into old_prices from public.order_catalog_items i where workspace_id=any(targets);
  select jsonb_agg(jsonb_build_object('id',p.id,'hash',private.clinical_master_sha256(to_jsonb(p))) order by p.id)
    into old_profiles from master.dispensing_order_profiles p;
  select private.clinical_master_sha256(coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]')) into old_products from master.medication_products p;
  select private.clinical_master_sha256(coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]')) into old_reviews from master.clinical_reviews p;
  select coalesce(jsonb_agg(jsonb_build_object('workspaceId',v.workspace_id,'id',v.lab_test_item_id,'revision',v.workspace_result_revision,
    'sha256',private.clinical_master_sha256(to_jsonb(v)))),'[]') into old_lab_versions from public.lab_test_item_versions v where workspace_id=any(targets);
  select coalesce(jsonb_agg(jsonb_build_object('workspaceId',v.workspace_id,'id',v.id,'sha256',private.clinical_master_sha256(to_jsonb(v)))),'[]')
    into old_set_versions from public.order_set_revisions v where workspace_id=any(targets);
  select coalesce(jsonb_agg(to_jsonb(l)),'[]') into old_lab_links from public.order_catalog_lab_test_item_links l where workspace_id=any(targets);
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'hash',private.clinical_master_sha256(to_jsonb(e)))),'[]')
    into old_notifications from public.notification_events e where workspace_id=any(targets);
  for x in select value from jsonb_array_elements(preflight->'labItems') loop
    select * into lab from public.lab_test_items where workspace_id=x->>'workspaceId' and id=x->>'id';
    if not found or not lab.workspace_id=any(targets) or lab.customization_state<>'unmodified'
      or private.clinical_master_sha256(to_jsonb(lab)) is distinct from x->>'rowSha256' then raise exception 'oed_frozen_lab_target_drift'; end if;
  end loop;
  -- Only this block writes. The deliberate exception in rehearsal rolls back
  -- all publisher/adopter/audit/version changes while retaining the local report.
  begin
    result:=private.publish_clinical_master_release(payload); v_release_id:=(result->>'releaseId')::uuid;
    foreach w in array targets loop
      select jsonb_agg(value order by value->>'catalogId') into expected from jsonb_array_elements(preflight->'rebind') where value->>'workspaceId'=w;
      perform private.clair_rebind_oed_synthetic_dispensing(w,v_release_id,expected);
      perform private.clair_adopt_master_release_to_workspace(w,v_release_id);
      -- Some legitimate links pin an older, structurally identical owner.
      -- Establish a normal catalog-first pure cascade; never loosen the item
      -- resolver's ownership predicate or directly rewrite a workspace link.
      for c in select i.* from public.order_catalog_items i
        join master.master_records m on m.id=i.source_master_record_id
        where i.workspace_id=w and m.master_key=any(candidates)
          and exists(select 1 from public.order_catalog_lab_test_item_links l
            join public.lab_test_items item on item.workspace_id=l.workspace_id and item.id=l.lab_test_item_id
            join private.clinical_master_release_payload_owner_manifest manifest
              on manifest.release_id=v_release_id and manifest.master_record_id=item.source_master_record_id
                and manifest.included and manifest.record_type='lab_test'
            where l.workspace_id=w and l.order_catalog_item_id=i.id
              and item.source_master_revision<manifest.effective_revision
              and exists(select 1 from jsonb_array_elements(preflight->'labItems') frozen
                where frozen->>'workspaceId'=w and frozen->>'id'=item.id)
              and (l.source_master_order_revision < (
                select max(v.revision) from master.master_record_versions v
                join master.master_releases r on r.id=v.release_id
                where v.master_record_id=l.source_master_order_record_id
                  and r.release_no<(select release_no from master.master_releases where id=v_release_id))
                or (l.profile_kind='panel' and l.source_master_panel_revision < (
                  select max(v.revision) from master.master_record_versions v
                  join master.master_releases r on r.id=v.release_id
                  where v.master_record_id=l.source_master_panel_record_id
                    and r.release_no<(select release_no from master.master_releases where id=v_release_id)))))
        order by i.id for update of i
      loop
        if c.origin_type<>'clair_master' or c.customization_state='detached'
          or c.category_group<>'lab' or c.last_applied_lab_membership_projection_schema_version<>1
          or c.last_applied_lab_membership_projection_snapshot is null
          or c.last_applied_lab_membership_projection_sha256 is distinct from
            private.clinical_master_lab_membership_source_fingerprint(c.last_applied_lab_membership_projection_snapshot)
          or exists(select 1 from public.workspace_lab_catalog_updates t
            where t.workspace_id=w and t.order_catalog_item_id=c.id and t.status='pending')
          then raise exception 'oed_lab_catalog_cascade_not_eligible:%:%',w,c.id; end if;
        catalog_old_snapshot:=c.last_applied_lab_membership_projection_snapshot;
        catalog_links_before:=(select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]')
          from public.order_catalog_lab_test_item_links l where l.workspace_id=w and l.order_catalog_item_id=c.id);
        if jsonb_array_length(catalog_links_before)=0 or exists(
          select 1 from public.order_catalog_lab_test_item_links l
          left join public.lab_test_items item on item.workspace_id=w and item.id=l.lab_test_item_id
          left join public.lab_test_item_versions v on v.workspace_id=w and v.lab_test_item_id=l.lab_test_item_id
            and v.workspace_result_revision=l.pinned_workspace_result_revision
          where l.workspace_id=w and l.order_catalog_item_id=c.id and (
            l.link_origin<>'clair_master' or item.id is null or v.lab_test_item_id is null
            or item.definition_origin<>'clair_master' or item.customization_state<>'unmodified'
            or l.source_master_order_record_id is distinct from c.source_master_record_id
            or l.source_master_order_revision is distinct from (catalog_old_snapshot->>'sourceMasterOrderRevision')::integer
            or l.source_master_panel_record_id::text is distinct from catalog_old_snapshot->>'sourceMasterPanelRecordId'
            or l.source_master_panel_revision is distinct from (catalog_old_snapshot->>'sourceMasterPanelRevision')::integer
            or l.source_master_test_record_id is distinct from item.source_master_record_id
            or l.owner_pinned_source_test_revision is distinct from item.source_master_revision
            or v.source_master_record_id is distinct from item.source_master_record_id
            or v.source_master_revision is distinct from item.source_master_revision
            or l.pinned_workspace_result_revision is distinct from item.workspace_result_revision
            or not exists(select 1 from jsonb_array_elements(preflight->'labItems') frozen
              where frozen->>'workspaceId'=w and frozen->>'id'=item.id)))
          then raise exception 'oed_lab_catalog_cascade_not_eligible:%:%',w,c.id; end if;
        select coalesce(jsonb_agg(jsonb_build_object(
          'linkOrigin',l.link_origin,'profileKind',l.profile_kind,
          'sourceMasterTestRecordId',l.source_master_test_record_id,
          'ownerPinnedSourceTestRevision',l.owner_pinned_source_test_revision,
          'itemVersionSourceMasterRecordId',v.source_master_record_id,
          'itemVersionSourceTestRevision',v.source_master_revision,'labTestItemId',l.lab_test_item_id,
          'pinnedWorkspaceResultRevision',l.pinned_workspace_result_revision,
          'sourceOrdinal',l.source_ordinal,'effectiveSortOrder',l.effective_sort_order,
          'required',l.required,'displayGroup',l.display_group)
          order by coalesce(l.source_ordinal,2147483647),l.effective_sort_order,l.lab_test_item_id),'[]')
          into catalog_members
          from public.order_catalog_lab_test_item_links l join public.lab_test_item_versions v
            on v.workspace_id=l.workspace_id and v.lab_test_item_id=l.lab_test_item_id
              and v.workspace_result_revision=l.pinned_workspace_result_revision
          where l.workspace_id=w and l.order_catalog_item_id=c.id;
        workspace_snapshot:=jsonb_build_object('schemaVersion',1,
          'sourceMasterOrderRecordId',c.source_master_record_id,
          'sourceMasterOrderRevision',(catalog_old_snapshot->>'sourceMasterOrderRevision')::integer,
          'targetType',catalog_old_snapshot->>'targetType',
          'sourceMasterPanelRecordId',nullif(catalog_old_snapshot->>'sourceMasterPanelRecordId','')::uuid,
          'sourceMasterPanelRevision',(catalog_old_snapshot->>'sourceMasterPanelRevision')::integer,
          'members',catalog_members);
        if workspace_snapshot is distinct from catalog_old_snapshot then
          raise exception 'oed_lab_catalog_cascade_structural_drift:%:%',w,c.id; end if;
        select version.snapshot into strict catalog_old_order from master.master_record_versions version
          where version.master_record_id=c.source_master_record_id
            and version.revision=(workspace_snapshot->>'sourceMasterOrderRevision')::integer;
        select version.snapshot,version.revision into strict catalog_new_order,catalog_new_revision
          from master.master_record_versions version
          join private.clinical_master_release_payload_owner_manifest manifest
            on manifest.release_id=version.release_id and manifest.master_record_id=version.master_record_id
              and manifest.effective_revision=version.revision and manifest.included and manifest.record_type='order'
          join master.master_records m on m.id=version.master_record_id and m.current_revision=version.revision
          where version.release_id=v_release_id and version.master_record_id=c.source_master_record_id;
        if jsonb_array_length(coalesce(catalog_old_order->'labOrderProfiles','[]'))<>1
          or jsonb_array_length(coalesce(catalog_new_order->'labOrderProfiles','[]'))<>1
          or catalog_new_revision<(workspace_snapshot->>'sourceMasterOrderRevision')::integer then
          raise exception 'oed_lab_catalog_cascade_structural_drift:%:%',w,c.id; end if;
        catalog_old_profile:=catalog_old_order#>'{labOrderProfiles,0}';
        catalog_new_profile:=catalog_new_order#>'{labOrderProfiles,0}';
        if (catalog_old_profile-array['labTestMasterRevision','labPanelMasterRevision'])
          is distinct from (catalog_new_profile-array['labTestMasterRevision','labPanelMasterRevision'])
          or catalog_old_profile->>'labPanelMasterRecordId' is distinct from workspace_snapshot->>'sourceMasterPanelRecordId'
          or (catalog_old_profile->>'labPanelMasterRevision')::integer is distinct from
            (workspace_snapshot->>'sourceMasterPanelRevision')::integer then
          raise exception 'oed_lab_catalog_cascade_structural_drift:%:%',w,c.id; end if;
        if workspace_snapshot->>'targetType'='panel' then
          select version.snapshot into strict catalog_old_panel from master.master_record_versions version
            where version.master_record_id=(catalog_old_profile->>'labPanelMasterRecordId')::uuid
              and version.revision=(catalog_old_profile->>'labPanelMasterRevision')::integer;
          select version.snapshot into strict catalog_new_panel from master.master_record_versions version
            join private.clinical_master_release_payload_owner_manifest manifest
              on manifest.release_id=version.release_id and manifest.master_record_id=version.master_record_id
                and manifest.effective_revision=version.revision and manifest.included and manifest.record_type='lab_panel'
            join master.master_records m on m.id=version.master_record_id and m.current_revision=version.revision
            where version.release_id=v_release_id
              and version.master_record_id=(catalog_new_profile->>'labPanelMasterRecordId')::uuid
              and version.revision=(catalog_new_profile->>'labPanelMasterRevision')::integer;
          if (select jsonb_agg(value-'testMasterRevision' order by (value->>'sortOrder')::integer,value->>'testMasterRecordId')
                from jsonb_array_elements(catalog_old_panel->'labPanelItems'))
            is distinct from (select jsonb_agg(value-'testMasterRevision' order by (value->>'sortOrder')::integer,value->>'testMasterRecordId')
                from jsonb_array_elements(catalog_new_panel->'labPanelItems'))
            or (catalog_new_profile->>'labPanelMasterRevision')::integer<(catalog_old_profile->>'labPanelMasterRevision')::integer
            or jsonb_array_length(catalog_old_panel->'labPanelItems')<>jsonb_array_length(catalog_members)
            or exists(select 1 from jsonb_array_elements(catalog_members) member where
              member->>'profileKind'<>'panel' or not exists(
                select 1 from jsonb_array_elements(catalog_old_panel->'labPanelItems') old_member
                where old_member->>'testMasterRecordId'=member->>'sourceMasterTestRecordId'
                  and (old_member->>'testMasterRevision')::integer=(member->>'ownerPinnedSourceTestRevision')::integer
                  and (old_member->>'sortOrder')::integer=(member->>'sourceOrdinal')::integer
                  and coalesce((old_member->>'required')::boolean,true)=(member->>'required')::boolean
                  and nullif(old_member->>'displayGroup','') is not distinct from member->>'displayGroup'))
            then raise exception 'oed_lab_catalog_cascade_structural_drift:%:%',w,c.id; end if;
          select jsonb_agg(member||jsonb_build_object('ownerPinnedSourceTestRevision',(new_member->>'testMasterRevision')::integer)
              order by coalesce((member->>'sourceOrdinal')::integer,2147483647),
                (member->>'effectiveSortOrder')::integer,member->>'labTestItemId')
            into catalog_members from jsonb_array_elements(catalog_members) member
              join jsonb_array_elements(catalog_new_panel->'labPanelItems') new_member
                on new_member->>'testMasterRecordId'=member->>'sourceMasterTestRecordId';
        elsif workspace_snapshot->>'targetType'='test' then
          if jsonb_array_length(catalog_members)<>1
            or catalog_members#>>'{0,profileKind}'<>'standalone_test'
            or catalog_members#>>'{0,sourceMasterTestRecordId}' is distinct from catalog_old_profile->>'labTestMasterRecordId'
            or (catalog_members#>>'{0,ownerPinnedSourceTestRevision}')::integer is distinct from (catalog_old_profile->>'labTestMasterRevision')::integer
            or catalog_members#>'{0,sourceOrdinal}' is distinct from 'null'::jsonb
            or catalog_members#>'{0,required}' is distinct from 'true'::jsonb
            or catalog_members#>'{0,displayGroup}' is distinct from 'null'::jsonb then
            raise exception 'oed_lab_catalog_cascade_structural_drift:%:%',w,c.id; end if;
          catalog_members:=jsonb_build_array(catalog_members->0||jsonb_build_object(
            'ownerPinnedSourceTestRevision',(catalog_new_profile->>'labTestMasterRevision')::integer));
        else raise exception 'oed_lab_catalog_cascade_structural_drift:%:%',w,c.id; end if;
        if exists(select 1 from jsonb_array_elements(catalog_members) member where not exists(
          select 1 from private.clinical_master_release_payload_owner_manifest manifest
          -- Included unchanged siblings reuse their earlier immutable revision.
          join master.master_record_versions version on version.master_record_id=manifest.master_record_id
            and version.revision=manifest.effective_revision
          join master.master_records m on m.id=manifest.master_record_id and m.current_revision=manifest.effective_revision
          where manifest.release_id=v_release_id and manifest.included and manifest.record_type='lab_test'
            and manifest.master_record_id=(member->>'sourceMasterTestRecordId')::uuid
            and manifest.effective_revision=(member->>'ownerPinnedSourceTestRevision')::integer
            and manifest.effective_revision>=(member->>'itemVersionSourceTestRevision')::integer)) then
          raise exception 'oed_lab_catalog_cascade_not_eligible:%:%',w,c.id; end if;
        source_snapshot:=workspace_snapshot||jsonb_build_object(
          'sourceMasterOrderRevision',catalog_new_revision,
          'sourceMasterPanelRevision',(catalog_new_profile->>'labPanelMasterRevision')::integer,'members',catalog_members);
        select array_agg(value->>'labTestItemId' order by value->>'labTestItemId') into affected_ids
          from jsonb_array_elements(catalog_members);
        result:=private.clair_create_lab_catalog_update_target(w,v_release_id,c.id,c.source_master_record_id,
          catalog_new_revision,'membership_changed',source_snapshot,workspace_snapshot,affected_ids);
        select * into strict u from public.workspace_lab_catalog_updates where workspace_id=w and id=(result->>'id')::uuid;
        if result->'created' is distinct from 'true'::jsonb or u.order_catalog_item_id is distinct from c.id
          or u.source_release_id is distinct from v_release_id or u.source_owner_record_id is distinct from c.source_master_record_id
          or u.source_owner_revision is distinct from catalog_new_revision or u.expected_catalog_revision is distinct from c.catalog_revision
          or u.source_membership_projection_snapshot is distinct from source_snapshot
          or u.source_membership_projection_sha256 is distinct from private.clinical_master_lab_membership_source_fingerprint(source_snapshot)
          or u.workspace_membership_projection_snapshot is distinct from workspace_snapshot
          or u.affected_lab_test_item_ids is distinct from affected_ids or u.update_type<>'membership_changed'
          or u.status<>'pending' or u.superseded_by_update_id is not null then
          raise exception 'oed_lab_catalog_cascade_target_mismatch:%:%',w,c.id; end if;
        catalog_target_ids:=array_append(catalog_target_ids,u.id);
        result:=private.clair_resolve_workspace_lab_definition_update_target(w,u.id,auth.uid(),u.expected_catalog_revision,'accept');
        select * into strict changed from public.order_catalog_items where workspace_id=w and id=c.id;
        if result->>'targetKind' is distinct from 'catalog' or result->'cascadeOnly' is distinct from 'true'::jsonb
          or result->>'orderCatalogItemId' is distinct from c.id
          or (to_jsonb(changed)-array['last_applied_lab_membership_projection_snapshot','last_applied_lab_membership_projection_sha256',
              'last_applied_lab_membership_projection_schema_version','updated_at'])
            is distinct from (to_jsonb(c)-array['last_applied_lab_membership_projection_snapshot','last_applied_lab_membership_projection_sha256',
              'last_applied_lab_membership_projection_schema_version','updated_at'])
          or catalog_links_before is distinct from(select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]')
            from public.order_catalog_lab_test_item_links l where l.workspace_id=w and l.order_catalog_item_id=c.id)
          then raise exception 'oed_lab_catalog_cascade_mutated_links:%:%',w,c.id; end if;
      end loop;
      -- Payload adoption creates missing rows/links but intentionally creates no
      -- review targets. Explicitly propose only the frozen unmodified items,
      -- using the included immutable source and the existing protected resolver.
      -- Definition CAS must precede catalog price/review/availability writers.
      for x in select value from jsonb_array_elements(preflight->'labItems') where value->>'workspaceId'=w order by value->>'id' loop
        select * into strict lab from public.lab_test_items where workspace_id=w and id=x->>'id' for update;
        select manifest.effective_revision into strict lab_revision from private.clinical_master_release_payload_owner_manifest manifest
          join master.master_records m on m.id=manifest.master_record_id and m.current_revision=manifest.effective_revision
          where manifest.release_id=v_release_id and manifest.master_record_id=lab.source_master_record_id
            and manifest.record_type='lab_test' and manifest.included;
        if lab.customization_state<>'unmodified' or lab.definition_origin<>'clair_master' or lab.source_master_revision>lab_revision then
          raise exception 'oed_frozen_lab_source_not_eligible'; end if;
        if lab.source_master_revision=lab_revision then continue; end if;
        if exists(select 1 from public.workspace_lab_item_updates where workspace_id=w and lab_test_item_id=lab.id and status='pending') then
          raise exception 'oed_preexisting_lab_review_requires_reconciliation'; end if;
        lab_projection:=private.clinical_master_lab_test_projection(lab.source_master_record_id,lab_revision);
        if lab_projection is null then raise exception 'oed_frozen_lab_projection_missing'; end if;
        source_snapshot:=jsonb_build_object('schemaVersion',1,'sourceMasterRecordId',lab.source_master_record_id,
          'sourceMasterRevision',lab_revision,'testItemName',lab_projection->>'testItemName','resultInputType',lab_projection->>'resultInputType',
          'resultValueKind',lab_projection->>'resultValueKind','resultUnit',lab_projection->>'resultUnit','decimalScale',nullif(lab_projection->>'decimalScale','')::integer);
        workspace_snapshot:=jsonb_build_object('schemaVersion',1,'sourceMasterRecordId',lab.source_master_record_id,
          'sourceMasterRevision',lab.source_master_revision,'testItemName',lab.test_item_name,'resultInputType',lab.result_input_type,
          'resultValueKind',lab.result_value_kind,'resultUnit',lab.result_unit,'decimalScale',lab.decimal_scale,
          'workspaceResultRevision',lab.workspace_result_revision,'customizationState',lab.customization_state);
        select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]'),coalesce(array_agg(distinct l.order_catalog_item_id order by l.order_catalog_item_id),'{}')
          into expected_links,affected_ids from public.order_catalog_lab_test_item_links l
          join public.order_catalog_items i on i.workspace_id=l.workspace_id and i.id=l.order_catalog_item_id
          join master.master_records m on m.id=i.source_master_record_id
          where l.workspace_id=w and l.lab_test_item_id=lab.id and m.master_key=any(candidates)
            and l.link_origin='clair_master' and l.source_master_test_record_id=lab.source_master_record_id
            and l.owner_pinned_source_test_revision=lab.source_master_revision and l.pinned_workspace_result_revision=lab.workspace_result_revision;
        result:=private.clair_create_lab_item_update_target(w,v_release_id,lab.id,lab.source_master_record_id,lab_revision,source_snapshot,workspace_snapshot,affected_ids);
        select * into strict u from public.workspace_lab_item_updates where workspace_id=w and id=(result->>'id')::uuid;
        if u.lab_test_item_id is distinct from lab.id or u.source_release_id is distinct from v_release_id
          or u.source_master_record_id is distinct from lab.source_master_record_id or u.source_master_revision is distinct from lab_revision
          or u.source_projection_snapshot is distinct from source_snapshot or u.source_projection_sha256 is distinct from private.clinical_master_sha256(source_snapshot)
          or u.affected_catalog_item_ids is distinct from affected_ids or u.status<>'pending'
          or u.expected_workspace_result_revision<>lab.workspace_result_revision then raise exception 'oed_created_lab_target_mismatch'; end if;
        result:=private.clair_resolve_workspace_lab_definition_update_target(w,u.id,auth.uid(),u.expected_workspace_result_revision,'accept');
        if result->>'targetKind' is distinct from 'item'
          or (select coalesce(array_agg(value order by value),'{}') from jsonb_array_elements_text(result->'affectedCatalogItemIds')) is distinct from affected_ids
          or exists(select 1 from jsonb_array_elements(expected_links) frozen left join public.order_catalog_lab_test_item_links l
            on l.workspace_id=w and l.id=frozen->>'id' where l.id is null or l.owner_pinned_source_test_revision<>lab_revision
              or l.pinned_workspace_result_revision<>lab.workspace_result_revision+1) then raise exception 'oed_lab_owner_cascade_incomplete:%:%',w,lab.id; end if;
        accepted_link_ids:=accepted_link_ids||array(select value->>'id' from jsonb_array_elements(expected_links));
      end loop;
      -- The legacy adopter leaves a whole-source review for price/availability
      -- customizations even when the separate execution field merge succeeded.
      -- Accept only an exact current source with no execution/taxonomy override.
      for u in select review.* from public.workspace_master_updates review join master.master_records m on m.id=review.source_master_record_id
        where review.workspace_id=w and review.release_id=v_release_id and review.status='pending' and review.update_type='changed'
          and m.master_key=any(candidates) and not m.master_key=any(additions) order by review.order_catalog_item_id loop
        select * into strict c from public.order_catalog_items where workspace_id=w and id=u.order_catalog_item_id for update;
        if c.source_dispensing_profile_id is not null then continue; end if;
        source_snapshot:=private.clinical_master_order_source_projection(c.source_master_record_id);
        incoming_preset:=source_snapshot->'executionPreset'; source_order:=source_snapshot->'order'; source_classification:=source_snapshot->'classification';
        if source_snapshot is distinct from u.source_snapshot or (source_snapshot->>'revision')::integer<>u.source_revision
          or not exists(select 1 from private.clinical_master_release_payload_owner_manifest m where m.release_id=v_release_id
            and m.master_record_id=c.source_master_record_id and m.included and m.effective_revision=u.source_revision)
          or c.origin_type<>'clair_master' or c.customization_state='detached'
          or not coalesce(c.customized_fields,'{}')<@array['priceKrw','availabilityStatus']
          or c.execution_merge_conflicts<>'{}'::jsonb or c.taxonomy_merge_conflict is not null
          or c.default_detail_inputs is distinct from incoming_preset->'defaultDetailInputs'
          or c.default_detail_input_policies is distinct from incoming_preset->'fieldPolicies'
          or c.source_execution_preset_id::text is distinct from incoming_preset->>'id'
          or c.source_execution_preset_revision is distinct from (incoming_preset->>'revision')::integer
          or c.source_execution_preset_sha256 is distinct from incoming_preset->>'contentSha256'
          or c.clinical_order_type is distinct from incoming_preset->>'clinicalOrderType'
          or c.detail_schema_version is distinct from (incoming_preset->>'detailSchemaVersion')::integer
          or c.clinical_use_allowed
          or exists(select 1 from jsonb_each(c.execution_source_baseline) b where (b.value->>'masterRevision')::integer is distinct from u.source_revision
            or b.value->>'presetId' is distinct from incoming_preset->>'id'
            or (b.value->>'presetRevision')::integer is distinct from (incoming_preset->>'revision')::integer
            or b.value->>'sha256' is distinct from incoming_preset->>'contentSha256')
          or incoming_preset->>'presetStatus' is distinct from 'synthetic_unreviewed'
          or incoming_preset->'clinicalUseAllowed' is distinct from 'false'::jsonb
          or c.sales_unit is distinct from private.clinical_master_normalize_sales_unit(source_order->>'defaultSalesUnitCode',c.sales_unit) then
          raise exception 'oed_existing_source_requires_reconciliation:%:%',w,source_snapshot->>'masterKey'; end if;
        if c.billing_reflection_enabled is distinct from (source_order->>'defaultBillingReflectionEnabled')::boolean then
          -- Exact preexisting pilot exceptions. Canonical source remains true;
          -- record a visible local billing override instead of falsifying it.
          if w<>'workspace-clinical-master-pilot-v1' or not (source_snapshot->>'masterKey'=any(array['phase1.optionb.v1.order.metabolic','cm.order.consult.initial']))
            or c.price_krw is not null or c.billing_eligible or c.billing_reflection_enabled
            or not exists(select 1 from jsonb_array_elements(old_prices) p where p->>'workspaceId'=w and p->>'id'=c.id
              and p->'price'='null'::jsonb and p->'billingEligible'='false'::jsonb and p->'billingReflection'='false'::jsonb) then
            raise exception 'oed_existing_billing_preservation_required:%:%',w,source_snapshot->>'masterKey'; end if;
          select id into strict source_path from master.classification_paths where path_key=source_classification->>'pathKey' and retired_in_release_id is null;
          update public.order_catalog_items set standard_order_id=source_snapshot->>'masterKey',
            standard_order_name=coalesce((select v->>'name' from jsonb_array_elements(source_snapshot->'names') v
              where v->>'languageCode'='ko' and v->>'nameKind'='preferred' order by (v->>'sortOrder')::integer limit 1),source_snapshot->>'masterKey'),
            aliases=array(select v->>'name' from jsonb_array_elements(source_snapshot->'names') v where v->>'nameKind'='alias'),
            category_group=source_classification->>'itemType',category_label=coalesce(source_classification->>'chartGroupCode',c.category_label),
            target_species=array(select jsonb_array_elements_text(source_order->'species')),
            default_destination_module=case when source_classification->>'destinationModule'='inpatient' then 'billing_only' else coalesce(source_classification->>'destinationModule',c.default_destination_module) end,
            default_task_required=coalesce((source_classification->>'taskRequired')::boolean,c.default_task_required),
            classification_path_id=source_path,source_master_revision=u.source_revision,last_auto_merged_revision=u.source_revision,
            source_preset_version='master-r'||u.source_revision,last_auto_merged_preset_version='master-r'||u.source_revision,
            source_projection_snapshot=source_snapshot,source_projection_fingerprint=private.clinical_master_projection_fingerprint(source_snapshot),
            preset_merge_status='current',customization_state='customized',
            customized_fields=array(select distinct k from unnest(coalesce(c.customized_fields,'{}')||array['billingReflectionEnabled']) k order by k),
            last_customized_at=now(),last_customized_by_user_id=auth.uid()::text,catalog_revision=catalog_revision+1,updated_at=now()
            where workspace_id=w and id=c.id and catalog_revision=c.catalog_revision returning * into changed;
          get diagnostics n=row_count;
          if n<>1 then raise exception 'oed_nonbillable_source_cas_conflict' using errcode='40001'; end if;
          update public.workspace_master_updates set status='accepted',resolved_by_user_id=auth.uid(),resolved_at=now()
            where workspace_id=w and id=u.id and release_id=v_release_id and status='pending' and source_revision=u.source_revision;
          get diagnostics n=row_count;
          if n<>1 then raise exception 'oed_nonbillable_review_cas_conflict' using errcode='40001'; end if;
          perform private.clair_pr020_append_order_catalog_audit(w,'order_catalog.updated',c.id,c,changed,
            'oed_source_accepted_existing_nonbillable_preserved:'||v_release_id::text||':'||p_packet_sha256,
            array['sourceMasterRevision','sourceProjectionSnapshot','billingReflectionEnabled']);
        else
          perform public.clair_resolve_workspace_master_update(w,u.id,c.catalog_revision,'accept_source');
        end if;
        select * into strict changed from public.order_catalog_items where workspace_id=w and id=c.id;
        if (changed.price_krw,changed.pricing_rule,changed.billing_eligible,changed.billing_reflection_enabled,changed.sales_unit,
            changed.in_hospital_order_name,changed.billing_name,changed.medication_metadata,changed.vaccine_metadata,
            changed.default_detail_inputs,changed.default_detail_input_policies,changed.availability_status)
          is distinct from(c.price_krw,c.pricing_rule,c.billing_eligible,c.billing_reflection_enabled,c.sales_unit,
            c.in_hospital_order_name,c.billing_name,c.medication_metadata,c.vaccine_metadata,c.default_detail_inputs,c.default_detail_input_policies,c.availability_status) then
          raise exception 'oed_source_accept_changed_local_values:%:%',w,c.id; end if;
      end loop;
      -- Refresh the stored projection from accepted links after core review.
      -- This is not a review-proposal generator or membership acceptance.
      perform private.clair_adopt_master_release_to_workspace(w,v_release_id);
      for x in select value from jsonb_array_elements(config->'pricingAssignments') where value->>'workspaceId'=w order by value->>'orderMasterKey' loop
        if not (x->>'orderMasterKey'=any(additions)) or (x->>'priceKrw')::integer not between 5000 and 100000
          or x->'syntheticPriceNotClinicalRecommendation' is distinct from 'true'::jsonb then raise exception 'oed_new_price_scope_invalid'; end if;
        select i.* into strict c from public.order_catalog_items i join master.master_records m on m.id=i.source_master_record_id
          where i.workspace_id=w and m.master_key=x->>'orderMasterKey' for update of i;
        select * into strict u from public.workspace_master_updates where workspace_id=w and order_catalog_item_id=c.id
          and release_id=v_release_id and update_type='new' and status='pending';
        if c.price_krw is not null or c.origin_type<>'clair_master' or c.customization_state='detached'
          or c.availability_status='active' or exists(select 1 from jsonb_array_elements(old_prices) p where p->>'workspaceId'=w and p->>'id'=c.id) then raise exception 'oed_new_price_provenance_invalid'; end if;
        -- Operator-only price initialization, not medication authoring. Preserve
        -- every ingredient/dose/default/review field and all normal DB triggers.
        update public.order_catalog_items set price_krw=(x->>'priceKrw')::integer,
          pricing_rule=jsonb_set(coalesce(pricing_rule,'{}'),'{priceKrw}',x->'priceKrw',true),
          customization_state='customized',customized_fields=array(select distinct k from unnest(coalesce(c.customized_fields,'{}')||array['priceKrw']) k order by k),
          last_customized_at=now(),last_customized_by_user_id=auth.uid()::text,catalog_revision=catalog_revision+1,updated_at=now()
          where workspace_id=w and id=c.id and catalog_revision=c.catalog_revision and price_krw is null returning * into changed;
        get diagnostics n=row_count;
        if n<>1 then raise exception 'oed_price_cas_conflict' using errcode='40001'; end if;
        perform private.clair_pr020_append_order_catalog_audit(w,'order_catalog.updated',c.id,c,changed,
          'oed_synthetic_price_not_clinical_recommendation:'||v_release_id::text||':'||p_packet_sha256,array['priceKrw']);
        c:=changed;
        perform public.clair_resolve_workspace_master_update(w,u.id,c.catalog_revision,'accept_source');
      end loop;
      -- Unchanged test definitions have no item CAS. Refresh their stale
      -- order/panel owner metadata through the existing full-membership writer,
      -- only after core source acceptance and exact immutable equivalence proof.
      -- This is an explicit owner repair, not catalog pure-cascade link DML.
      for c in select i.* from public.order_catalog_items i
        join master.master_records m on m.id=i.source_master_record_id
        where i.workspace_id=w and i.category_group='lab' and m.master_key=any(candidates)
          and exists(select 1 from public.order_catalog_lab_test_item_links l where l.workspace_id=w
            and l.order_catalog_item_id=i.id and l.source_master_order_revision is distinct from i.source_master_revision)
        order by i.id for update of i
      loop
        if c.origin_type<>'clair_master' or c.customization_state='detached'
          or c.last_applied_lab_membership_projection_schema_version<>1
          or c.last_applied_lab_membership_projection_sha256 is distinct from
            private.clinical_master_lab_membership_source_fingerprint(c.last_applied_lab_membership_projection_snapshot)
          or not exists(select 1 from jsonb_array_elements(old_prices) frozen
            where frozen->>'workspaceId'=w and frozen->>'id'=c.id)
          or exists(select 1 from public.workspace_lab_catalog_updates t where t.workspace_id=w
            and t.order_catalog_item_id=c.id and t.status='pending') then
          raise exception 'oed_lab_owner_refresh_not_eligible:%:%',w,c.id; end if;
        select version.snapshot into strict catalog_new_order from master.master_record_versions version
          join private.clinical_master_release_payload_owner_manifest manifest
            on manifest.master_record_id=version.master_record_id and manifest.effective_revision=version.revision
          join master.master_records m on m.id=version.master_record_id and m.current_revision=version.revision
          where manifest.release_id=v_release_id and manifest.included and manifest.record_type='order'
            and version.master_record_id=c.source_master_record_id and version.revision=c.source_master_revision;
        if jsonb_array_length(coalesce(catalog_new_order->'labOrderProfiles','[]'))<>1 then
          raise exception 'oed_lab_owner_refresh_structural_drift:%:%',w,c.id; end if;
        catalog_new_profile:=catalog_new_order#>'{labOrderProfiles,0}';
        catalog_new_panel:=null;
        if catalog_new_profile->>'labPanelMasterRecordId' is not null then
          -- An included order may retain an omitted, unchanged dependency
          -- (the approved metabolic panel). Its exact immutable profile pin,
          -- not authorship in this payload, is the dependency authority.
          select version.snapshot into strict catalog_new_panel from master.master_record_versions version
            join master.master_records m on m.id=version.master_record_id and m.record_type='lab_panel'
            where version.master_record_id=(catalog_new_profile->>'labPanelMasterRecordId')::uuid
              and version.revision=(catalog_new_profile->>'labPanelMasterRevision')::integer;
        end if;
        catalog_links_before:=(select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]')
          from public.order_catalog_lab_test_item_links l where l.workspace_id=w and l.order_catalog_item_id=c.id);
        if jsonb_array_length(catalog_links_before)<>(case when catalog_new_panel is null then 1
            else jsonb_array_length(catalog_new_panel->'labPanelItems') end) then
          raise exception 'oed_lab_owner_refresh_structural_drift:%:%',w,c.id; end if;
        for owner_link in select l.* from public.order_catalog_lab_test_item_links l
          where l.workspace_id=w and l.order_catalog_item_id=c.id order by l.id for update
        loop
          select * into strict lab from public.lab_test_items where workspace_id=w and id=owner_link.lab_test_item_id;
          if owner_link.link_origin<>'clair_master' or lab.definition_origin<>'clair_master' or lab.customization_state<>'unmodified'
            or owner_link.source_master_order_record_id is distinct from c.source_master_record_id
            or owner_link.source_master_order_revision>c.source_master_revision
            or owner_link.source_master_test_record_id is distinct from lab.source_master_record_id
            or owner_link.owner_pinned_source_test_revision is distinct from lab.source_master_revision
            or owner_link.pinned_workspace_result_revision is distinct from lab.workspace_result_revision
            or owner_link.sort_order is distinct from owner_link.effective_sort_order
            or owner_link.snapshot_metadata_schema_version<>2
            or owner_link.snapshot_metadata_sha256 is distinct from private.clinical_master_sha256(owner_link.snapshot_metadata)
            or not exists(select 1 from jsonb_array_elements(preflight->'labItems') frozen
              where frozen->>'workspaceId'=w and frozen->>'id'=lab.id)
            or not exists(select 1 from public.lab_test_item_versions version
              where version.workspace_id=w and version.lab_test_item_id=lab.id
                and version.workspace_result_revision=owner_link.pinned_workspace_result_revision
                and version.source_master_record_id=lab.source_master_record_id and version.source_master_revision=lab.source_master_revision)
            or not exists(select 1 from private.clinical_master_release_payload_owner_manifest manifest
              join master.master_records m on m.id=manifest.master_record_id and m.current_revision=manifest.effective_revision
              where manifest.release_id=v_release_id and manifest.included and manifest.record_type='lab_test'
                and manifest.master_record_id=lab.source_master_record_id and manifest.effective_revision=lab.source_master_revision)
            then raise exception 'oed_lab_owner_refresh_not_eligible:%:%',w,c.id; end if;
          select version.snapshot into strict catalog_old_order from master.master_record_versions version
            where version.master_record_id=owner_link.source_master_order_record_id and version.revision=owner_link.source_master_order_revision;
          if jsonb_array_length(coalesce(catalog_old_order->'labOrderProfiles','[]'))<>1 then
            raise exception 'oed_lab_owner_refresh_structural_drift:%:%',w,c.id; end if;
          catalog_old_profile:=catalog_old_order#>'{labOrderProfiles,0}';
          if (catalog_old_profile-array['labTestMasterRevision','labPanelMasterRevision'])
            is distinct from (catalog_new_profile-array['labTestMasterRevision','labPanelMasterRevision'])
            or owner_link.source_master_panel_record_id::text is distinct from catalog_old_profile->>'labPanelMasterRecordId'
            or owner_link.source_master_panel_revision is distinct from (catalog_old_profile->>'labPanelMasterRevision')::integer then
            raise exception 'oed_lab_owner_refresh_structural_drift:%:%',w,c.id; end if;
          if catalog_new_panel is not null then
            select version.snapshot into strict catalog_old_panel from master.master_record_versions version
              where version.master_record_id=owner_link.source_master_panel_record_id and version.revision=owner_link.source_master_panel_revision;
            if owner_link.profile_kind<>'panel'
              or (select jsonb_agg(value-'testMasterRevision' order by (value->>'sortOrder')::integer,value->>'testMasterRecordId')
                    from jsonb_array_elements(catalog_old_panel->'labPanelItems'))
                is distinct from (select jsonb_agg(value-'testMasterRevision' order by (value->>'sortOrder')::integer,value->>'testMasterRecordId')
                    from jsonb_array_elements(catalog_new_panel->'labPanelItems'))
              or not exists(select 1 from jsonb_array_elements(catalog_new_panel->'labPanelItems') member
                where member->>'testMasterRecordId'=owner_link.source_master_test_record_id::text
                  and (member->>'testMasterRevision')::integer=owner_link.owner_pinned_source_test_revision
                  and (member->>'sortOrder')::integer=owner_link.source_ordinal
                  and coalesce((member->>'required')::boolean,true)=owner_link.required
                  and nullif(member->>'displayGroup','') is not distinct from owner_link.display_group)
              or not exists(select 1 from master.lab_panel_items member
                where member.lab_panel_id=owner_link.source_master_panel_record_id
                  and member.lab_test_id=owner_link.source_master_test_record_id and member.sort_order=owner_link.source_ordinal)
              then raise exception 'oed_lab_owner_refresh_structural_drift:%:%',w,c.id; end if;
          elsif owner_link.profile_kind<>'standalone_test'
            or catalog_new_profile->>'labTestMasterRecordId' is distinct from owner_link.source_master_test_record_id::text
            or (catalog_new_profile->>'labTestMasterRevision')::integer is distinct from owner_link.owner_pinned_source_test_revision
            or owner_link.source_ordinal is not null or not owner_link.required or owner_link.display_group is not null then
            raise exception 'oed_lab_owner_refresh_structural_drift:%:%',w,c.id;
          end if;
        end loop;
        select jsonb_build_object('labDefinition',jsonb_build_object('availabilityStatus',c.availability_status,
          'links',jsonb_agg(jsonb_build_object('labTestItemId',l.lab_test_item_id,'effectiveSortOrder',l.effective_sort_order,
            'required',l.required,'displayGroup',l.display_group,'expectedLinkRevision',l.link_revision,
            'expectedWorkspaceResultRevision',l.pinned_workspace_result_revision) order by l.id)))
          into owner_patch from public.order_catalog_lab_test_item_links l where l.workspace_id=w and l.order_catalog_item_id=c.id;
        result:=public.clair_update_order_catalog_item(w,c.id,c.catalog_revision,owner_patch);
        select * into strict changed from public.order_catalog_items where workspace_id=w and id=c.id;
        if result->>'enforcedBy' is distinct from 'clair_update_order_catalog_item_lab_definition'
          or (to_jsonb(changed)-array['last_applied_lab_membership_projection_snapshot','last_applied_lab_membership_projection_sha256',
              'last_applied_lab_membership_projection_schema_version'])
            is distinct from (to_jsonb(c)-array['last_applied_lab_membership_projection_snapshot','last_applied_lab_membership_projection_sha256',
              'last_applied_lab_membership_projection_schema_version'])
          or jsonb_array_length(catalog_links_before)<>(select count(*) from public.order_catalog_lab_test_item_links
            where workspace_id=w and order_catalog_item_id=c.id)
          or exists(select 1 from jsonb_array_elements(catalog_links_before) frozen
            left join public.order_catalog_lab_test_item_links l on l.workspace_id=w and l.id=frozen->>'id'
            where l.id is null or
              (to_jsonb(l)-array['source_master_order_revision','source_master_panel_revision','snapshot_metadata','snapshot_metadata_sha256'])
              is distinct from (frozen-array['source_master_order_revision','source_master_panel_revision','snapshot_metadata','snapshot_metadata_sha256'])
              or (l.snapshot_metadata-array['masterOrderRevision','masterPanelRevision'])
                is distinct from ((frozen->'snapshot_metadata')-array['masterOrderRevision','masterPanelRevision'])
              or l.source_master_order_revision is distinct from c.source_master_revision
              or l.source_master_panel_revision is distinct from (catalog_new_profile->>'labPanelMasterRevision')::integer
              or l.snapshot_metadata_sha256 is distinct from private.clinical_master_sha256(l.snapshot_metadata))
          then raise exception 'oed_lab_owner_refresh_changed_nonowner_fields:%:%',w,c.id; end if;
        accepted_link_ids:=accepted_link_ids||array(select value->>'id' from jsonb_array_elements(catalog_links_before));
        owner_refresh_evidence:=owner_refresh_evidence||jsonb_build_array(jsonb_build_object('workspaceId',w,'catalogId',c.id,
          'beforeLinksSha256',private.clinical_master_sha256(catalog_links_before),
          'afterLinksSha256',(select private.clinical_master_sha256(jsonb_agg(to_jsonb(l) order by l.id))
            from public.order_catalog_lab_test_item_links l where l.workspace_id=w and l.order_catalog_item_id=c.id),
          'linkIds',(select jsonb_agg(value->>'id' order by value->>'id') from jsonb_array_elements(catalog_links_before)),
          'writer','clair_update_order_catalog_item_lab_definition','workspaceResultPinsPreserved',true));
        perform private.clair_pr020_append_order_catalog_audit(w,'order_catalog.updated',c.id,c,changed,
          'oed_immutable_lab_owner_refresh:'||v_release_id::text||':'||p_packet_sha256,array['labDefinition']);
      end loop;
      if exists(select 1 from public.order_catalog_items i join master.master_records m on m.id=i.source_master_record_id
        join master.master_record_versions version on version.master_record_id=i.source_master_record_id and version.revision=i.source_master_revision
        join public.order_catalog_lab_test_item_links l on l.workspace_id=i.workspace_id and l.order_catalog_item_id=i.id
        where i.workspace_id=w and i.category_group='lab' and m.master_key=any(candidates) and (
          l.source_master_order_record_id is distinct from i.source_master_record_id
          or l.source_master_order_revision is distinct from i.source_master_revision
          or l.source_master_panel_record_id::text is distinct from version.snapshot#>>'{labOrderProfiles,0,labPanelMasterRecordId}'
          or l.source_master_panel_revision is distinct from (version.snapshot#>>'{labOrderProfiles,0,labPanelMasterRevision}')::integer))
        then raise exception 'oed_lab_final_owner_projection_stale:%',w; end if;
      -- Retained non-profile rows were already active in the frozen remote
      -- baseline. The53 new rows activate through accept_source above. Do not
      -- silently promote any other paused/review-pending row; postconditions fail.
      for c in select i.* from public.order_catalog_items i join master.master_records m on m.id=i.source_master_record_id
        where i.workspace_id=w and m.master_key=any(retired) and i.availability_status<>'paused' order by i.id for update of i loop
        if c.origin_type<>'clair_master' or c.customization_state='detached' then raise exception 'oed_retirement_provenance_invalid'; end if;
        update public.order_catalog_items set availability_status='paused',
          customization_state='customized',customized_fields=array(select distinct k from unnest(coalesce(c.customized_fields,'{}')||array['availabilityStatus']) k order by k),
          last_customized_at=now(),last_customized_by_user_id=auth.uid()::text,catalog_revision=catalog_revision+1,updated_at=now()
          where workspace_id=w and id=c.id and catalog_revision=c.catalog_revision returning * into changed;
        get diagnostics n=row_count;
        if n<>1 then raise exception 'oed_pause_cas_conflict' using errcode='40001'; end if;
        perform private.clair_pr020_append_order_catalog_audit(w,'order_catalog.paused',c.id,c,changed,
          'oed_retire_future_selection_only:'||v_release_id::text||':'||p_packet_sha256,array['availabilityStatus']);
      end loop;
      for x in select value from jsonb_array_elements(config->'devices') where value->>'workspaceId'=w order by value->>'id' loop
        select (p->>'id')::uuid into strict profile_id from jsonb_array_elements(payload->'labResultProfiles') p
          where p#>>'{device,manufacturer}'='CLAiR' and p#>>'{device,kind}'='manual' and p#>>'{device,model}'=x->>'model' order by p->>'id' limit 1;
        perform public.clair_register_workspace_lab_device(w,(x->>'id')::uuid,x->>'name',profile_id);
      end loop;
      for x in select value from jsonb_array_elements(config->'bindings') where value->>'workspaceId'=w order by value->>'orderMasterKey',value->>'species' loop
        select i.* into strict c from public.order_catalog_items i join master.master_records m on m.id=i.source_master_record_id where i.workspace_id=w and m.master_key=x->>'orderMasterKey';
        -- These tables are new in this coordinated release: do not overwrite an
        -- independently configured workspace binding, including its intervals.
        if exists(select 1 from public.workspace_lab_result_profile_bindings where workspace_id=w and order_catalog_item_id=c.id and species=x->>'species') then raise exception 'oed_existing_profile_binding_requires_review'; end if;
        perform public.clair_bind_workspace_lab_result_profile(w,c.id,(x->>'profileVersionId')::uuid,(x->>'deviceId')::uuid,0);
      end loop;
      for x in select value from jsonb_array_elements(config->'compositionAssignments') where value->>'workspaceId'=w order by value->>'compositionMasterKey' loop
        if (x->>'billingPolicy') is distinct from (case when w='workspace-clinical-master-pilot-v1' and x->>'originalOrderMasterKey'='phase1.optionb.v1.order.metabolic' then 'no_charge' else 'preserve_parent_price' end) then raise exception 'oed_composition_billing_scope_invalid'; end if;
        request_id:=private.clair_b2_deterministic_uuid('oed-20260906-composition',array[w,x->>'compositionMasterKey']);
        perform public.clair_apply_lab_composition(w,(x->>'compositionVersionId')::uuid,x->>'billingPolicy',null,request_id);
        perform public.clair_apply_lab_composition(w,(x->>'compositionVersionId')::uuid,x->>'billingPolicy',null,request_id);
      end loop;
      select count(*) into n from public.order_catalog_items i join master.master_records m on m.id=i.source_master_record_id where i.workspace_id=w and m.master_key=any(candidates)
        and i.source_master_revision=m.current_revision and not i.clinical_use_allowed
        and (i.availability_status='active' or (i.availability_status='pending_activation' and private.clair_dispensing_service_review_catalog_item_allowed(w,i.id)));
      if n<>524 then raise exception 'oed_candidate524_not_selectable:%:%',w,n; end if;
      if (select count(*) from public.order_catalog_items i join master.master_records m on m.id=i.source_master_record_id where i.workspace_id=w and m.master_key=any(retired) and i.availability_status='paused')<>51 then raise exception 'oed_retirement51_incomplete'; end if;
    end loop;
    if (select count(*) from jsonb_array_elements(preflight->'labItems') target_row join public.lab_test_items i on i.workspace_id=target_row->>'workspaceId' and i.id=target_row->>'id'
      join master.master_records m on m.id=i.source_master_record_id where i.source_master_revision=m.current_revision and i.customization_state='unmodified')<>207 then raise exception 'oed_frozen207_not_current'; end if;
    if exists(select 1 from jsonb_array_elements(old_lab_links) frozen left join public.order_catalog_lab_test_item_links l
      on l.workspace_id=frozen->>'workspace_id' and l.id=frozen->>'id' where not (frozen->>'id'=any(accepted_link_ids))
      and to_jsonb(l) is distinct from frozen) then raise exception 'oed_untargeted_lab_link_changed'; end if;
    if exists(select 1 from jsonb_array_elements(old_notifications) frozen left join public.notification_events e on e.id=(frozen->>'id')::uuid
      where e.id is null or private.clinical_master_sha256(to_jsonb(e)) is distinct from frozen->>'hash')
      or exists(select 1 from public.notification_events e where e.workspace_id=any(targets)
        and not exists(select 1 from jsonb_array_elements(old_notifications) frozen where frozen->>'id'=e.id::text)
        and not exists(select 1 from public.workspace_lab_item_updates t where t.workspace_id=e.workspace_id and t.id::text=e.source_entity_id and t.source_release_id=v_release_id)
        and not exists(select 1 from public.workspace_lab_catalog_updates t where t.workspace_id=e.workspace_id
          and t.id=any(catalog_target_ids) and t.id::text=e.source_entity_id and t.source_release_id=v_release_id and t.status='accepted')
        and not exists(select 1 from public.workspace_master_updates t where t.workspace_id=e.workspace_id and t.id::text=e.source_entity_id and t.release_id=v_release_id)) then raise exception 'oed_notification_scope_changed'; end if;
    if exists(select 1 from jsonb_array_elements(old_lab_versions) target_row left join public.lab_test_item_versions v on v.workspace_id=target_row->>'workspaceId'
      and v.lab_test_item_id=target_row->>'id' and v.workspace_result_revision=(target_row->>'revision')::integer where v.lab_test_item_id is null or private.clinical_master_sha256(to_jsonb(v)) is distinct from target_row->>'sha256')
      or exists(select 1 from jsonb_array_elements(old_set_versions) target_row left join public.order_set_revisions v on v.workspace_id=target_row->>'workspaceId' and v.id::text=target_row->>'id'
        where v.id is null or private.clinical_master_sha256(to_jsonb(v)) is distinct from target_row->>'sha256') then raise exception 'oed_immutable_definition_history_changed'; end if;
    for x in select value from jsonb_array_elements(old_prices) loop
      select * into strict c from public.order_catalog_items where workspace_id=x->>'workspaceId' and id=x->>'id';
      if jsonb_build_object('workspaceId',c.workspace_id,'id',c.id,'price',c.price_krw,'pricingRule',c.pricing_rule,
        'billingEligible',c.billing_eligible,'billingReflection',c.billing_reflection_enabled,'salesUnit',c.sales_unit) is distinct from x then raise exception 'oed_existing_pricing_changed:%:%',c.workspace_id,c.id; end if;
    end loop;
    if exists(select 1 from jsonb_array_elements(old_profiles) target_row left join master.dispensing_order_profiles p on p.id=(target_row->>'id')::uuid
      where p.id is null or private.clinical_master_sha256(to_jsonb(p)) is distinct from target_row->>'hash')
      or old_products is distinct from(select private.clinical_master_sha256(coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]')) from master.medication_products p)
      or old_reviews is distinct from(select private.clinical_master_sha256(coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]')) from master.clinical_reviews p) then raise exception 'oed_immutable_product_review_history_changed'; end if;
    after_rows:=private.clair_oed_20260906_fingerprints();
    if exists(select 1 from jsonb_array_elements(before_rows) b join jsonb_array_elements(after_rows) a on a->>'workspaceId'=b->>'workspaceId' and a->>'tableName'=b->>'tableName'
      where (b->>'workspaceId'='clair-foreign-demo' or b->>'tableName'=any(array['orders','order_tasks','order_task_events','order_confirmation_commands','order_fulfillment_work_items','order_billing_candidates','lab_result_entries','lab_result_entry_rows','order_execution_result_versions','lab_atomic_retest_requests','workspace_lab_profile_override_versions','notification_user_states'])) and a<>b) then raise exception 'oed_history_or_foreign_changed'; end if;
    before_retry:=after_rows;
    foreach w in array targets loop
      select jsonb_agg(value order by value->>'catalogId') into expected from jsonb_array_elements(preflight->'rebind') where value->>'workspaceId'=w;
      perform private.clair_rebind_oed_synthetic_dispensing(w,v_release_id,expected);
      perform private.clair_adopt_master_release_to_workspace(w,v_release_id);
    end loop;
    if private.clair_oed_20260906_fingerprints() is distinct from before_retry then raise exception 'oed_adoption_retry_mutated_state'; end if;
    outcome:=jsonb_build_object('releaseId',v_release_id,'packetSha256',p_packet_sha256,'applied',p_commit,'rehearsal',not p_commit,
      'workspaceIds',to_jsonb(targets),'selectablePerWorkspace',524,'retiredPerWorkspace',51,'newPricedPerWorkspace',53,
      'beforeFingerprints',before_rows,'afterFingerprints',after_rows,'clinicalApprovalGranted',false,
      'labOwnerRefreshEvidence',owner_refresh_evidence);
    if not p_commit then raise exception 'oed_rehearsal_complete' using errcode='P0906'; end if;
    insert into private.oed_20260906_rollout_receipt(release_key,packet_sha256,actor_user_id,outcome) values(v_release_key,p_packet_sha256,auth.uid(),outcome);
  exception when sqlstate 'P0906' then
    if p_commit or outcome is null then raise; end if;
  end;
  if not p_commit and private.clair_oed_20260906_fingerprints() is distinct from before_rows then raise exception 'oed_rehearsal_residue'; end if;
  return outcome;
end $fn$;
revoke all on function private.clair_apply_oed_20260906_candidate(jsonb,text,boolean) from public,anon,authenticated,service_role;
