\set ON_ERROR_STOP on

-- CLINICAL-MASTER-PR-005 local replay.
-- Run only against the local synthetic database as the local postgres owner.
-- No real data and no remote DB are used.  Ordinary fixture writes go through
-- the owner-only seed adapter.  Legacy backfill coverage is a deliberate
-- multi-command preflight because migration-time anonymous DO blocks cannot be
-- invoked from inside a later transaction:
--
--   psql -v B2_REPLAY_LEGACY_PREPARE=1 -f this-file
--   psql -f supabase/migrations/20260820100000_clinical_master_phase1b2_order_set_revisions.sql
--   psql -f supabase/migrations/20260820100000_clinical_master_phase1b2_order_set_revisions.sql
--   psql -v B2_REPLAY_LEGACY_VERIFY=1 -f this-file
--   psql -f this-file
--
-- The first migration invocation sees actual legacy rows created by PREPARE;
-- the second invocation proves identical reapply against the persisted source
-- evidence.  VERIFY reads every artifact before removing only its own rows.

\if :{?B2_REPLAY_LEGACY_PREPARE}
begin;

-- The migration's deferred current-projection trigger is intentionally absent
-- for this short, owner-only source-row preparation phase.  The re-applied
-- migration recreates it after classifying/backfilling these rows.
drop trigger if exists order_sets_current_projection_deferred on public.order_sets;

do $$
declare
  v_actor uuid := '00000000-0000-4000-8000-000000000001'::uuid;
begin
  if exists (
    select 1 from public.order_sets
    where id in (
      'b2-replay-legacy-empty-active',
      'b2-replay-legacy-empty-inactive',
      'b2-replay-legacy-fixed-one-qty',
      'b2-replay-legacy-valid-sum-multi',
      'b2-replay-legacy-fixed-tax'
    )
  ) then
    raise exception 'b2_replay_legacy_prepare_rows_already_exist';
  end if;
  perform set_config('clinical_master.b2_internal_write','on',true);
  insert into public.order_sets(
    id,workspace_id,source_set_version,set_category,set_name,billing_name,
    availability_status,amount_basis,set_price_krw,sales_unit,
    billing_reflection_enabled,target_species,range_price_ranges,tax_type,
    created_by_user_id,updated_by_user_id
  ) values
    (
      'b2-replay-legacy-empty-active','clair-demo','legacy-empty-active-v1',
      'B2 legacy replay','Legacy empty active','Legacy empty active billing',
      'active','included_order_sum',0,'per_each',false,
      array['dog','cat','other']::text[],'[]'::jsonb,'derived',v_actor,v_actor
    ),
    (
      'b2-replay-legacy-empty-inactive','clair-demo','legacy-empty-inactive-v1',
      'B2 legacy replay','Legacy empty inactive','Legacy empty inactive billing',
      'inactive','included_order_sum',0,'per_each',false,
      array['dog','cat','other']::text[],'[]'::jsonb,'derived',v_actor,v_actor
    ),
    (
      'b2-replay-legacy-fixed-one-qty','clair-demo','legacy-fixed-one-qty-v1',
      'B2 legacy replay','Legacy fixed-one quantity','Legacy fixed-one quantity billing',
      'active','included_order_sum',0,'per_each',false,
      array['dog','cat','other']::text[],'[]'::jsonb,'derived',v_actor,v_actor
    ),
    (
      'b2-replay-legacy-fixed-tax','clair-demo','legacy-fixed-tax-v1',
      'B2 legacy replay','Legacy fixed tax','Legacy fixed tax billing',
      'active','set_fixed_price',5000,'per_each',true,
      array['dog','cat','other']::text[],'[]'::jsonb,'derived',v_actor,v_actor
    ),
    (
      'b2-replay-legacy-valid-sum-multi','clair-demo','legacy-valid-sum-multi-v1',
      'B2 legacy replay','Legacy valid sum multi','Legacy valid sum multi billing',
      'active','included_order_sum',0,'per_each',false,
      array['dog','cat','other']::text[],'[]'::jsonb,'derived',v_actor,v_actor
    );
  insert into public.order_set_items(
    id,workspace_id,order_set_id,child_order_id,sort_order,default_selected,
    billing_reflection_default,default_quantity,quantity_source,
    unit_price_snapshot_krw
  ) values (
    'b2-replay-legacy-fixed-one-qty-item','clair-demo',
    'b2-replay-legacy-fixed-one-qty','den194-catalog-cbc',1,true,false,2,
    'fixed_one',777
  ), (
    'b2-replay-legacy-valid-sum-multi-cbc','clair-demo',
    'b2-replay-legacy-valid-sum-multi','den194-catalog-cbc',1,true,false,1,
    'fixed_one',35000
  ), (
    'b2-replay-legacy-valid-sum-multi-fluid','clair-demo',
    'b2-replay-legacy-valid-sum-multi','den194-catalog-fluid-therapy',2,true,false,1,
    'fixed_one',28000
  );
end
$$;

commit;
select 'b2_replay_legacy_prepare_ok' as check_name;
\quit
\endif

\if :{?B2_REPLAY_LEGACY_VERIFY}
begin;

-- This block intentionally reads actual rows that were present before the two
-- migration reapplications.  It does not call a sentinel/helper as its only
-- oracle: it compares the immutable source evidence, item evidence, native
-- revision/pointer/projection, quarantine artifact, and exact row counts.
do $$
declare
  v_id text;
  v_source jsonb;
  v_expected_source jsonb;
  v_expected_hash text;
  v_classification text;
  v_reason text;
  v_action text;
  v_evidence private.order_set_legacy_classifications%rowtype;
  v_quarantine private.order_set_legacy_quarantine%rowtype;
  v_set public.order_sets%rowtype;
  v_revision public.order_set_revisions%rowtype;
  v_item public.order_set_items%rowtype;
  v_item_evidence private.order_set_legacy_classifications%rowtype;
  v_revision_item public.order_set_revision_items%rowtype;
  v_revision_id uuid;
  v_quarantine_id uuid;
  v_fixed_tax_hash text;
  v_fixed_tax_quarantine_id uuid;
  v_valid_item_id text;
  v_expected_child_id text;
  v_expected_sort integer;
  v_expected_unit_price integer;
  v_catalog_revision integer;
  v_item_count integer;
  v_classification_count integer;
  v_quarantine_count integer;
  v_payload_mismatch boolean;
begin
  for v_id in
    select unnest(array[
      'b2-replay-legacy-empty-active',
      'b2-replay-legacy-empty-inactive',
      'b2-replay-legacy-fixed-one-qty',
      'b2-replay-legacy-valid-sum-multi',
      'b2-replay-legacy-fixed-tax'
    ]::text[])
  loop
    if v_id='b2-replay-legacy-empty-active' then
      v_classification := 'empty_active';
      v_reason := 'legacy_empty_active_was_demoted';
      v_action := 'demote_and_backfill';
      v_expected_source := jsonb_build_object(
        'id',v_id,'workspaceId','clair-demo','sourceSetVersion','legacy-empty-active-v1',
        'setCategory','B2 legacy replay','setName','Legacy empty active',
        'billingName','Legacy empty active billing','availabilityStatus','active',
        'amountBasis','included_order_sum','setPriceKrw',0,'salesUnit','per_each',
        'billingReflectionEnabled',false,'targetSpecies',jsonb_build_array('dog','cat','other'),
        'careGuide',null,'internalInstruction',null,'items','[]'::jsonb
      );
    elsif v_id='b2-replay-legacy-empty-inactive' then
      v_classification := 'empty_unavailable';
      v_reason := 'empty_unavailable';
      v_action := 'backfill';
      v_expected_source := jsonb_build_object(
        'id',v_id,'workspaceId','clair-demo','sourceSetVersion','legacy-empty-inactive-v1',
        'setCategory','B2 legacy replay','setName','Legacy empty inactive',
        'billingName','Legacy empty inactive billing','availabilityStatus','inactive',
        'amountBasis','included_order_sum','setPriceKrw',0,'salesUnit','per_each',
        'billingReflectionEnabled',false,'targetSpecies',jsonb_build_array('dog','cat','other'),
        'careGuide',null,'internalInstruction',null,'items','[]'::jsonb
      );
    elsif v_id='b2-replay-legacy-fixed-one-qty' then
      v_classification := 'invalid_quantity';
      v_reason := 'legacy_invalid_quantity';
      v_action := 'quarantine';
      select coalesce(jsonb_agg(to_jsonb(i) order by i.sort_order,i.id),'[]'::jsonb)
        into v_source
      from public.order_set_items i
      where i.workspace_id='clair-demo' and i.order_set_id=v_id;
      v_expected_source := jsonb_build_object(
        'id',v_id,'workspaceId','clair-demo','sourceSetVersion','legacy-fixed-one-qty-v1',
        'setCategory','B2 legacy replay','setName','Legacy fixed-one quantity',
        'billingName','Legacy fixed-one quantity billing','availabilityStatus','active',
        'amountBasis','included_order_sum','setPriceKrw',0,'salesUnit','per_each',
        'billingReflectionEnabled',false,'targetSpecies',jsonb_build_array('dog','cat','other'),
        'careGuide',null,'internalInstruction',null,'items',v_source
      );
    elsif v_id='b2-replay-legacy-valid-sum-multi' then
      v_classification := 'valid_sum';
      v_reason := 'legacy_valid_sum';
      v_action := 'backfill';
      select coalesce(jsonb_agg(to_jsonb(i) order by i.sort_order,i.id),'[]'::jsonb)
        into v_source
      from public.order_set_items i
      where i.workspace_id='clair-demo' and i.order_set_id=v_id;
      if jsonb_array_length(v_source) <> 2 then
        raise exception 'b2_replay_legacy_valid_sum_multi_source_item_count_failed';
      end if;
      v_expected_source := jsonb_build_object(
        'id',v_id,'workspaceId','clair-demo','sourceSetVersion','legacy-valid-sum-multi-v1',
        'setCategory','B2 legacy replay','setName','Legacy valid sum multi',
        'billingName','Legacy valid sum multi billing','availabilityStatus','active',
        'amountBasis','included_order_sum','setPriceKrw',0,'salesUnit','per_each',
        'billingReflectionEnabled',false,'targetSpecies',jsonb_build_array('dog','cat','other'),
        'careGuide',null,'internalInstruction',null,'items',v_source
      );
    else
      v_classification := 'legacy_fixed_tax_unset';
      v_reason := 'legacy_fixed_tax_unset';
      v_action := 'quarantine';
      v_expected_source := jsonb_build_object(
        'id',v_id,'workspaceId','clair-demo','sourceSetVersion','legacy-fixed-tax-v1',
        'setCategory','B2 legacy replay','setName','Legacy fixed tax',
        'billingName','Legacy fixed tax billing','availabilityStatus','active',
        'amountBasis','set_fixed_price','setPriceKrw',5000,'salesUnit','per_each',
        'billingReflectionEnabled',true,'targetSpecies',jsonb_build_array('dog','cat','other'),
        'careGuide',null,'internalInstruction',null,'items','[]'::jsonb
      );
    end if;
    v_expected_hash := private.clair_b2_sha256(v_expected_source);
    v_quarantine_id := private.clair_b2_deterministic_uuid(
      'quarantine',array['clair-demo','order_set',v_id,v_reason]::text[]
    );
    if v_id='b2-replay-legacy-fixed-tax' then
      v_fixed_tax_hash := v_expected_hash;
      v_fixed_tax_quarantine_id := v_quarantine_id;
    end if;
    select * into v_evidence
    from private.order_set_legacy_classifications c
    where c.workspace_id='clair-demo' and c.source_kind='order_set' and c.source_id=v_id;
    if not found
       or v_evidence.classification is distinct from v_classification
       or v_evidence.reason_code is distinct from v_reason
       or v_evidence.action is distinct from v_action
       or v_evidence.source_row is distinct from v_expected_source
       or v_evidence.source_sha256 is distinct from v_expected_hash
       or v_evidence.deterministic_id is distinct from v_quarantine_id then
      raise exception 'b2_replay_legacy_original_evidence_failed:%',v_id;
    end if;
    if v_classification <> 'valid_sum' then
      select * into v_quarantine
      from private.order_set_legacy_quarantine q
      where q.workspace_id='clair-demo' and q.legacy_order_set_id=v_id;
      if not found or v_quarantine.quarantine_id is distinct from v_quarantine_id
         or v_quarantine.reason_code is distinct from v_reason
         or v_quarantine.source_hash is distinct from v_expected_hash
         or v_quarantine.source_snapshot is distinct from v_expected_source then
        raise exception 'b2_replay_legacy_quarantine_artifact_failed:%',v_id;
      end if;
    end if;
    select * into v_set from public.order_sets where workspace_id='clair-demo' and id=v_id;
    if v_classification in ('empty_active','empty_unavailable') then
      v_revision_id := private.clair_b2_deterministic_uuid('revision',array['clair-demo',v_id,'1']::text[]);
      if v_set.current_revision_id is distinct from v_revision_id
         or v_set.source_set_version <> 'order-set-revision-1'
         or v_set.set_name <> (v_expected_source->>'setName')
         or v_set.billing_name <> (v_expected_source->>'billingName')
         or v_set.availability_status <> (case when v_classification='empty_active' then 'paused' else 'inactive' end) then
        raise exception 'b2_replay_legacy_empty_projection_failed:%',v_id;
      end if;
      select * into v_revision from public.order_set_revisions where id=v_revision_id;
      select count(*) into v_item_count from public.order_set_revision_items where revision_id=v_revision_id;
      if v_revision.id is null or v_revision.validation_status <> 'valid' or v_item_count <> 0 then
        raise exception 'b2_replay_legacy_zero_item_backfill_failed:%',v_id;
      end if;
    elsif v_classification='valid_sum' then
      v_revision_id := private.clair_b2_deterministic_uuid('revision',array['clair-demo',v_id,'1']::text[]);
      if v_set.current_revision_id is distinct from v_revision_id
         or v_set.source_set_version <> 'order-set-revision-1'
         or v_set.set_name <> (v_expected_source->>'setName')
         or v_set.billing_name <> (v_expected_source->>'billingName')
         or v_set.availability_status <> 'active' then
        raise exception 'b2_replay_legacy_valid_sum_multi_projection_failed';
      end if;
      select * into v_revision from public.order_set_revisions where workspace_id='clair-demo' and order_set_id=v_id and id=v_revision_id;
      select count(*) into v_item_count from public.order_set_revision_items where workspace_id='clair-demo' and order_set_id=v_id and revision_id=v_revision_id;
      if v_revision.id is null or v_revision.validation_status <> 'valid' or v_item_count <> 2 then
        raise exception 'b2_replay_legacy_valid_sum_multi_revision_item_count_failed';
      end if;
    else
      if v_set.current_revision_id is not null
         or v_set.availability_status <> 'inactive'
         or v_set.source_set_version <> 'order-set-quarantine-'||v_quarantine_id::text
         or v_set.set_name <> 'Quarantined Order Set '||v_quarantine_id::text
         or v_set.billing_name <> 'Quarantined Order Set '||v_quarantine_id::text then
        raise exception 'b2_replay_legacy_quarantine_projection_failed:%',v_id;
      end if;
    end if;
  end loop;

  -- A two-item valid_sum source proves that replay preserves the complete
  -- source/item evidence while assigning global 1-based ranks and the exact
  -- deterministic revision-item identities to both selected atomic members.
  v_revision_id := private.clair_b2_deterministic_uuid(
    'revision',array['clair-demo','b2-replay-legacy-valid-sum-multi','1']::text[]
  );
  for v_valid_item_id in
    select unnest(array[
      'b2-replay-legacy-valid-sum-multi-cbc',
      'b2-replay-legacy-valid-sum-multi-fluid'
    ]::text[])
  loop
    if v_valid_item_id='b2-replay-legacy-valid-sum-multi-cbc' then
      v_expected_child_id := 'den194-catalog-cbc';
      v_expected_sort := 1;
      v_expected_unit_price := 35000;
    else
      v_expected_child_id := 'den194-catalog-fluid-therapy';
      v_expected_sort := 2;
      v_expected_unit_price := 28000;
    end if;
    select * into v_item
    from public.order_set_items
    where workspace_id='clair-demo' and id=v_valid_item_id
      and order_set_id='b2-replay-legacy-valid-sum-multi';
    select * into v_item_evidence
    from private.order_set_legacy_classifications
    where workspace_id='clair-demo' and source_kind='order_set_item' and source_id=v_valid_item_id;
    select c.catalog_revision into v_catalog_revision
    from public.order_catalog_items c
    where c.workspace_id='clair-demo' and c.id=v_expected_child_id;
    select * into v_revision_item
    from public.order_set_revision_items ri
    where ri.workspace_id='clair-demo'
      and ri.order_set_id='b2-replay-legacy-valid-sum-multi'
      and ri.revision_id=v_revision_id
      and ri.id=private.clair_b2_deterministic_uuid('item',array[
        'clair-demo','b2-replay-legacy-valid-sum-multi',v_revision_id::text,
        v_expected_sort::text,'atomic',v_expected_child_id,v_catalog_revision::text,null,null
      ]::text[]);
    if v_item.id is null
       or v_item.workspace_id <> 'clair-demo'
       or v_item.order_set_id <> 'b2-replay-legacy-valid-sum-multi'
       or v_item.child_order_id <> v_expected_child_id
       or v_item.sort_order <> v_expected_sort
       or not v_item.default_selected
       or v_item.billing_reflection_default
       or v_item.default_quantity <> 1
       or v_item.quantity_source <> 'fixed_one'
       or v_item.unit_price_snapshot_krw <> v_expected_unit_price
       or v_item_evidence.source_kind is null
       or v_item_evidence.classification <> 'valid_sum'
       or v_item_evidence.reason_code <> 'legacy_valid_sum'
       or v_item_evidence.action <> 'backfill'
       or v_item_evidence.source_row is distinct from to_jsonb(v_item)
       or v_item_evidence.source_sha256 is distinct from private.clair_b2_sha256(to_jsonb(v_item))
       or v_item_evidence.deterministic_id is distinct from private.clair_b2_deterministic_uuid('quarantine',array[
         'clair-demo','order_set_item',v_valid_item_id,'legacy_valid_sum'
       ]::text[])
       or v_catalog_revision is null
       or v_revision_item.id is null
       or v_revision_item.workspace_id <> 'clair-demo'
       or v_revision_item.order_set_id <> 'b2-replay-legacy-valid-sum-multi'
       or v_revision_item.revision_id <> v_revision_id
       or v_revision_item.child_kind <> 'atomic'
       or v_revision_item.child_order_catalog_item_id <> v_expected_child_id
       or v_revision_item.child_order_catalog_revision <> v_catalog_revision
       or v_revision_item.child_order_set_id is not null
       or v_revision_item.child_set_revision_id is not null
       or v_revision_item.sort_order <> v_expected_sort
       or v_revision_item.default_selected is distinct from v_item.default_selected
       or v_revision_item.billing_reflection_default is distinct from v_item.billing_reflection_default
       or v_revision_item.default_quantity is distinct from v_item.default_quantity
       or v_revision_item.quantity_source is distinct from v_item.quantity_source
       or v_revision_item.created_at is distinct from v_item.created_at then
      raise exception 'b2_replay_legacy_valid_sum_multi_item_evidence_failed:%',v_valid_item_id;
    end if;
  end loop;
  -- Reapply must reject a changed payload even when the backing rows are real
  -- legacy rows.  The preceding assertions prove the unchanged payload first;
  -- this mutation proves the exact sentinel/evidence guard is not permissive.
  v_payload_mismatch := false;
  begin
    perform private.clair_b2_assert_legacy_replay_artifacts(
      'clair-demo',
      'b2-replay-legacy-fixed-tax',
      'legacy_fixed_tax_unset',
      'legacy_fixed_tax_unset',
      jsonb_set(
        jsonb_build_object(
          'id','b2-replay-legacy-fixed-tax','workspaceId','clair-demo',
          'sourceSetVersion','legacy-fixed-tax-v1','setCategory','B2 legacy replay',
          'setName','Legacy fixed tax changed','billingName','Legacy fixed tax billing',
          'availabilityStatus','active','amountBasis','set_fixed_price','setPriceKrw',5000,
          'salesUnit','per_each','billingReflectionEnabled',true,
          'targetSpecies',jsonb_build_array('dog','cat','other'),
          'careGuide',null,'internalInstruction',null,'items','[]'::jsonb
        ),
        '{setName}',to_jsonb('Legacy fixed tax changed'::text)
      ),
      v_fixed_tax_hash,
      v_fixed_tax_quarantine_id
    );
  exception when others then
    v_payload_mismatch := sqlerrm = 'legacy_replay_payload_mismatch';
  end;
  if not v_payload_mismatch then
    raise exception 'b2_replay_legacy_payload_mismatch_guard_missing';
  end if;
  select * into v_item from public.order_set_items
  where workspace_id='clair-demo' and id='b2-replay-legacy-fixed-one-qty-item';
  select * into v_item_evidence from private.order_set_legacy_classifications
  where workspace_id='clair-demo' and source_kind='order_set_item' and source_id=v_item.id;
  if v_item.id is null or v_item_evidence.source_kind is null or v_item.default_quantity <> 2 or v_item.quantity_source <> 'fixed_one'
     or v_item_evidence.classification <> 'invalid_quantity'
     or v_item_evidence.source_row is distinct from to_jsonb(v_item)
     or v_item_evidence.source_sha256 is distinct from private.clair_b2_sha256(to_jsonb(v_item)) then
    raise exception 'b2_replay_legacy_fixed_one_original_item_evidence_failed';
  end if;
  select count(*) into v_classification_count
  from private.order_set_legacy_classifications
  where workspace_id='clair-demo'
    and source_id = any(array[
      'b2-replay-legacy-empty-active','b2-replay-legacy-empty-inactive',
      'b2-replay-legacy-fixed-one-qty','b2-replay-legacy-valid-sum-multi',
      'b2-replay-legacy-fixed-tax','b2-replay-legacy-fixed-one-qty-item',
      'b2-replay-legacy-valid-sum-multi-cbc','b2-replay-legacy-valid-sum-multi-fluid'
    ]::text[]);
  select count(*) into v_quarantine_count
  from private.order_set_legacy_quarantine
  where workspace_id='clair-demo'
    and legacy_order_set_id = any(array[
      'b2-replay-legacy-empty-active','b2-replay-legacy-empty-inactive',
      'b2-replay-legacy-fixed-one-qty','b2-replay-legacy-fixed-tax'
    ]::text[]);
  if v_classification_count <> 8 or v_quarantine_count <> 4
     or exists (
       select 1 from private.order_set_legacy_quarantine
       where workspace_id='clair-demo' and legacy_order_set_id='b2-replay-legacy-valid-sum-multi'
     ) then
    raise exception 'b2_replay_legacy_reapply_duplicate_or_missing_artifact';
  end if;
end
$$;

commit;
select 'b2_replay_legacy_reapply_ok' as check_name;

begin;
do $$
begin
  perform set_config('clinical_master.b2_internal_write','on',true);
  update public.order_sets set current_revision_id=null
  where workspace_id='clair-demo' and id like 'b2-replay-legacy-%';
  delete from public.order_set_revision_price_ranges
  where workspace_id='clair-demo' and order_set_id like 'b2-replay-legacy-%';
  delete from public.order_set_revision_items
  where workspace_id='clair-demo' and order_set_id like 'b2-replay-legacy-%';
  delete from public.order_set_revisions
  where workspace_id='clair-demo' and order_set_id like 'b2-replay-legacy-%';
  delete from public.order_set_items
  where workspace_id='clair-demo' and order_set_id like 'b2-replay-legacy-%';
  delete from private.order_set_legacy_classifications
  where workspace_id='clair-demo' and source_id like 'b2-replay-legacy-%';
  delete from private.order_set_legacy_quarantine
  where workspace_id='clair-demo' and legacy_order_set_id like 'b2-replay-legacy-%';
  delete from public.order_sets
  where workspace_id='clair-demo' and id like 'b2-replay-legacy-%';
end
$$;
commit;
select 'b2_replay_legacy_cleanup_ok' as check_name;
\quit
\endif

begin;

do $$
declare
  v_actor uuid := '00000000-0000-4000-8000-000000000001'::uuid;
  v_request uuid;
  v_result jsonb;
  v_child_revision uuid;
  v_parent jsonb;
  v_range jsonb;
begin
  v_request := private.clair_b2_deterministic_uuid('replay',array['clair-demo','b2-sum','2026-08-20']::text[]);
  v_result := private.clair_seed_order_set_compatibility_projection(
    'clair-demo','b2-replay-sum',
    jsonb_build_object(
      'setCategory','B2 replay','setName','B2 replay sum','billingName','B2 replay sum billing',
      'amountBasis','included_order_sum','setPriceKrw',null,'rangeBasis',null,
      'salesUnit','per_each','billingReflectionEnabled',false,'taxType','derived',
      'targetSpecies',jsonb_build_array('dog','cat','other'),'careGuide',null,'internalInstruction',null,
      'items',jsonb_build_array(jsonb_build_object('childKind','atomic','childOrderCatalogItemId','den194-catalog-cbc','childOrderCatalogRevision',1,'childOrderSetId',null,'childSetRevisionId',null,'sortOrder',1,'defaultSelected',true,'billingReflectionDefault',true,'defaultQuantity',1,'quantitySource','fixed_one')),
      'priceRanges',jsonb_build_array()
    ),'active',v_actor,v_request
  );
  if v_result->>'outcome' <> 'created' then raise exception 'b2_replay_sum_create_failed:%',v_result; end if;

  v_request := private.clair_b2_deterministic_uuid('replay',array['clair-demo','b2-child','2026-08-20']::text[]);
  v_result := private.clair_seed_order_set_compatibility_projection(
    'clair-demo','b2-replay-child',
    jsonb_build_object(
      'setCategory','B2 replay','setName','B2 replay child','billingName','B2 replay child billing',
      'amountBasis','included_order_sum','setPriceKrw',null,'rangeBasis',null,
      'salesUnit','per_each','billingReflectionEnabled',false,'taxType','derived',
      'targetSpecies',jsonb_build_array('dog'),'careGuide',null,'internalInstruction',null,
      'items',jsonb_build_array(jsonb_build_object('childKind','atomic','childOrderCatalogItemId','den194-catalog-fluid-therapy','childOrderCatalogRevision',1,'childOrderSetId',null,'childSetRevisionId',null,'sortOrder',1,'defaultSelected',true,'billingReflectionDefault',true,'defaultQuantity',1,'quantitySource','fixed_one')),
      'priceRanges',jsonb_build_array()
    ),'active',v_actor,v_request
  );
  select current_revision_id into v_child_revision from public.order_sets where workspace_id='clair-demo' and id='b2-replay-child';
  if v_child_revision is null then raise exception 'b2_replay_child_revision_missing'; end if;

  v_request := private.clair_b2_deterministic_uuid('replay',array['clair-demo','b2-parent','2026-08-20']::text[]);
  v_parent := jsonb_build_object(
    'setCategory','B2 replay','setName','B2 replay nested parent','billingName','B2 replay nested parent billing',
    'amountBasis','included_order_sum','setPriceKrw',null,'rangeBasis',null,
    'salesUnit','per_each','billingReflectionEnabled',false,'taxType','derived',
    'targetSpecies',jsonb_build_array('dog'),'careGuide',null,'internalInstruction',null,
    'items',jsonb_build_array(jsonb_build_object('childKind','order_set','childOrderCatalogItemId',null,'childOrderCatalogRevision',null,'childOrderSetId','b2-replay-child','childSetRevisionId',v_child_revision,'sortOrder',1,'defaultSelected',true,'billingReflectionDefault',false,'defaultQuantity',1,'quantitySource','fixed_one')),
    'priceRanges',jsonb_build_array()
  );
  v_result := private.clair_seed_order_set_compatibility_projection('clair-demo','b2-replay-parent',v_parent,'active',v_actor,v_request);
  if v_result->>'outcome' <> 'created' then raise exception 'b2_replay_parent_create_failed:%',v_result; end if;

  v_request := private.clair_b2_deterministic_uuid('replay',array['clair-demo','b2-fixed','2026-08-20']::text[]);
  v_result := private.clair_seed_order_set_compatibility_projection(
    'clair-demo','b2-replay-fixed',
    jsonb_build_object(
      'setCategory','B2 replay','setName','B2 replay fixed','billingName','B2 replay fixed billing',
      'amountBasis','set_fixed_price','setPriceKrw',0,'rangeBasis',null,
      'salesUnit','per_each','billingReflectionEnabled',true,'taxType','non_taxable',
      'targetSpecies',jsonb_build_array('dog'),'careGuide',null,'internalInstruction',null,
      'items',jsonb_build_array(jsonb_build_object('childKind','atomic','childOrderCatalogItemId','den194-catalog-wellness-vaccine','childOrderCatalogRevision',1,'childOrderSetId',null,'childSetRevisionId',null,'sortOrder',1,'defaultSelected',true,'billingReflectionDefault',false,'defaultQuantity',1,'quantitySource','fixed_one')),
      'priceRanges',jsonb_build_array()
    ),'active',v_actor,v_request
  );
  if v_result->>'outcome' <> 'created' then raise exception 'b2_replay_fixed_create_failed:%',v_result; end if;

  v_range := jsonb_build_object(
    'setCategory','B2 replay','setName','B2 replay range','billingName','B2 replay range billing',
    'amountBasis','range_price','setPriceKrw',null,'rangeBasis','patient_weight_kg',
    'salesUnit','per_kg','billingReflectionEnabled',true,'taxType','taxable',
    'targetSpecies',jsonb_build_array('dog'),'careGuide',null,'internalInstruction',null,
    'items',jsonb_build_array(jsonb_build_object('childKind','atomic','childOrderCatalogItemId','den194-catalog-cbc','childOrderCatalogRevision',1,'childOrderSetId',null,'childSetRevisionId',null,'sortOrder',1,'defaultSelected',true,'billingReflectionDefault',false,'defaultQuantity',1,'quantitySource','fixed_one')),
    'priceRanges',jsonb_build_array(
      jsonb_build_object('sortOrder',1,'lowerBound',0,'upperBound',5,'priceKrw',1000),
      jsonb_build_object('sortOrder',2,'lowerBound',5,'upperBound',null,'priceKrw',1500)
    )
  );
  v_request := private.clair_b2_deterministic_uuid('replay',array['clair-demo','b2-range','2026-08-20']::text[]);
  v_result := private.clair_seed_order_set_compatibility_projection('clair-demo','b2-replay-range',v_range,'active',v_actor,v_request);
  if v_result->>'outcome' <> 'created' then raise exception 'b2_replay_range_create_failed:%',v_result; end if;

  -- Exact replay is idempotent and returns the original committed envelope.
  v_result := private.clair_seed_order_set_compatibility_projection('clair-demo','b2-replay-range',v_range,'active',v_actor,v_request);
  if v_result->>'outcome' <> 'created' or v_result->>'requestId' <> v_request::text then raise exception 'b2_replay_idempotency_failed:%',v_result; end if;
  if (select count(*) from public.order_set_revisions where workspace_id='clair-demo' and order_set_id='b2-replay-range') <> 1 then raise exception 'b2_replay_duplicate_revision'; end if;

  -- The second synthetic tenant proves stable identity and catalog pins are
  -- workspace-scoped; this row must never be visible through clair-demo reads.
  v_request := private.clair_b2_deterministic_uuid('replay',array['workspace-clair-cheongdam','b2-other-workspace','2026-08-20']::text[]);
  v_result := private.clair_seed_order_set_compatibility_projection(
    'workspace-clair-cheongdam','b2-replay-other-workspace',
    jsonb_build_object(
      'setCategory','B2 replay','setName','B2 replay other workspace','billingName','B2 replay other workspace billing',
      'amountBasis','included_order_sum','setPriceKrw',null,'rangeBasis',null,
      'salesUnit','per_order','billingReflectionEnabled',false,'taxType','derived',
      'targetSpecies',jsonb_build_array('dog'),'careGuide',null,'internalInstruction',null,
      'items',jsonb_build_array(jsonb_build_object('childKind','atomic','childOrderCatalogItemId','cd-consult-first','childOrderCatalogRevision',1,'childOrderSetId',null,'childSetRevisionId',null,'sortOrder',1,'defaultSelected',true,'billingReflectionDefault',true,'defaultQuantity',1,'quantitySource','fixed_one')),
      'priceRanges',jsonb_build_array()
    ),'active','49110000-0000-4000-8000-000000000001'::uuid,v_request
  );
  if v_result->>'outcome' <> 'created' then raise exception 'b2_replay_second_workspace_failed:%',v_result; end if;
end
$$;

-- Exercise the B2 runtime contract through the public envelopes as well as the
-- owner-only seed adapter.  This remains one synthetic transaction; the
-- assertions below are rolled back with the fixture rows.
do $$
declare
  v_admin uuid := '00000000-0000-4000-8000-000000000001'::uuid;
  v_vet uuid := '00000000-0000-4000-8000-000000000002'::uuid;
  v_workspace text := 'clair-demo';
  v_child_def jsonb;
  v_parent_def jsonb;
  v_inactive_def jsonb;
  v_result jsonb;
  v_retry jsonb;
  v_request uuid;
  v_child_v1 uuid;
  v_child_v2 uuid;
  v_child_v3 uuid;
  v_child_v4 uuid;
  v_child_v5 uuid;
  v_parent_v1 uuid;
  v_parent_v2 uuid;
  v_parent_v3 uuid;
  v_parent_paused_v1 uuid;
  v_parent_inactive_v1 uuid;
  v_parent_paused_id text;
  v_parent_inactive_id text;
  v_review_paused_v6 uuid;
  v_review_inactive_v6 uuid;
  v_child_v6 uuid;
  v_child_v7 uuid;
  v_review_v2 uuid;
  v_review_v3 uuid;
  v_review_v5 uuid;
  v_pending integer;
  v_before jsonb;
  v_after jsonb;
  v_invalid_revision uuid;
  v_denied boolean;
  v_current_etag text;
  v_pending_reviews integer;
  v_list_name text;
  v_catalog_revision integer;
  v_revision_count integer;
begin
  -- The child starts at v1, advances through v2 and v3, and the parent keeps
  -- its exact v1 pin until the latest eligible review is accepted.
  v_child_def := jsonb_build_object(
    'setCategory','B2 review','setName','B2 review child v1','billingName','B2 review child v1 billing',
    'amountBasis','included_order_sum','setPriceKrw',null,'rangeBasis',null,
    'salesUnit','per_each','billingReflectionEnabled',false,'taxType','derived',
    'targetSpecies',jsonb_build_array('dog'),'careGuide',null,'internalInstruction',null,
    'items',jsonb_build_array(jsonb_build_object(
      'childKind','atomic','childOrderCatalogItemId','den194-catalog-fluid-therapy',
      'childOrderCatalogRevision',1,'childOrderSetId',null,'childSetRevisionId',null,
      'sortOrder',1,'defaultSelected',true,'billingReflectionDefault',true,
      'defaultQuantity',1,'quantitySource','fixed_one')),
    'priceRanges',jsonb_build_array());
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin::text,'role','authenticated')::text,true);
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'review-child-v1','2026-08-20']::text[]);
  v_result := private.clair_seed_order_set_compatibility_projection(v_workspace,'b2-replay-review-child',v_child_def,'active',v_admin,v_request);
  if v_result->>'ok' <> 'true' or v_result->>'outcome' <> 'created'
     or v_result->'result'->'current'->>'etag' is null then
    raise exception 'b2_replay_review_child_v1_create_failed:%',v_result;
  end if;
  select current_revision_id into v_child_v1 from public.order_sets where workspace_id=v_workspace and id='b2-replay-review-child';
  if v_child_v1 is null then raise exception 'b2_replay_review_child_v1_missing'; end if;

  v_parent_def := jsonb_build_object(
    'setCategory','B2 review','setName','B2 review parent v1','billingName','B2 review parent v1 billing',
    'amountBasis','included_order_sum','setPriceKrw',null,'rangeBasis',null,
    'salesUnit','per_each','billingReflectionEnabled',false,'taxType','derived',
    'targetSpecies',jsonb_build_array('dog'),'careGuide',null,'internalInstruction',null,
    'items',jsonb_build_array(jsonb_build_object(
      'childKind','order_set','childOrderCatalogItemId',null,'childOrderCatalogRevision',null,
      'childOrderSetId','b2-replay-review-child','childSetRevisionId',v_child_v1,
      'sortOrder',1,'defaultSelected',true,'billingReflectionDefault',false,
      'defaultQuantity',1,'quantitySource','fixed_one')),
    'priceRanges',jsonb_build_array());
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'review-parent-v1','2026-08-20']::text[]);
  v_result := private.clair_seed_order_set_compatibility_projection(v_workspace,'b2-replay-review-parent',v_parent_def,'active',v_admin,v_request);
  if v_result->>'ok' <> 'true' then raise exception 'b2_replay_review_parent_create_failed:%',v_result; end if;
  select current_revision_id into v_parent_v1 from public.order_sets where workspace_id=v_workspace and id='b2-replay-review-parent';

  v_child_def := jsonb_set(jsonb_set(v_child_def,'{setName}',to_jsonb('B2 review child v2'::text)),'{billingName}',to_jsonb('B2 review child v2 billing'::text));
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'review-child-v2','2026-08-20']::text[]);
  v_result := public.clair_save_order_set_revision(v_workspace,'b2-replay-review-child',v_child_v1,v_child_def,'active',v_request);
  if v_result->>'ok' <> 'true' or v_result->>'outcome' <> 'applied' then raise exception 'b2_replay_review_child_v2_save_failed:%',v_result; end if;
  select current_revision_id into v_child_v2 from public.order_sets where workspace_id=v_workspace and id='b2-replay-review-child';
  select count(*) into v_pending from public.order_set_revision_update_reviews where workspace_id=v_workspace and parent_order_set_id='b2-replay-review-parent' and status='pending';
  if v_pending <> 1 then raise exception 'b2_replay_review_v2_pending_count:%',v_pending; end if;
  select id into v_review_v2 from public.order_set_revision_update_reviews
  where workspace_id=v_workspace and parent_order_set_id='b2-replay-review-parent' and pinned_child_revision_id=v_child_v1 and available_child_revision_id=v_child_v2;
  if v_review_v2 is null then raise exception 'b2_replay_review_v2_target_missing'; end if;
  if (select current_revision_id from public.order_sets where workspace_id=v_workspace and id='b2-replay-review-parent') is distinct from v_parent_v1 then
    raise exception 'b2_replay_review_parent_followed_child';
  end if;

  v_child_def := jsonb_set(jsonb_set(v_child_def,'{setName}',to_jsonb('B2 review child v3'::text)),'{billingName}',to_jsonb('B2 review child v3 billing'::text));
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'review-child-v3','2026-08-20']::text[]);
  v_result := public.clair_save_order_set_revision(v_workspace,'b2-replay-review-child',v_child_v2,v_child_def,'active',v_request);
  if v_result->>'ok' <> 'true' or v_result->>'outcome' <> 'applied' then raise exception 'b2_replay_review_child_v3_save_failed:%',v_result; end if;
  select current_revision_id into v_child_v3 from public.order_sets where workspace_id=v_workspace and id='b2-replay-review-child';
  if (select status from public.order_set_revision_update_reviews where id=v_review_v2) <> 'superseded'
     or (select resolution_status from private.order_set_review_notification_resolutions where review_id=v_review_v2) <> 'superseded'
     or (select requires_action from public.notification_events where notification_id='order-set-review-'||v_review_v2::text) then
    raise exception 'b2_replay_review_v2_supersession_failed';
  end if;
  select id into v_review_v3 from public.order_set_revision_update_reviews
  where workspace_id=v_workspace and parent_order_set_id='b2-replay-review-parent' and pinned_child_revision_id=v_child_v1 and available_child_revision_id=v_child_v3 and status='pending';
  if v_review_v3 is null then raise exception 'b2_replay_review_v3_target_missing'; end if;

  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'review-accept-v3','2026-08-20']::text[]);
  v_result := public.clair_resolve_order_set_update_review(v_workspace,v_review_v3,v_parent_v1,'accept',v_request);
  if v_result->>'ok' <> 'true' or v_result->>'outcome' <> 'accepted'
     or v_result->'result'->'current'->>'etag' is null then raise exception 'b2_replay_review_accept_failed:%',v_result; end if;
  v_retry := public.clair_resolve_order_set_update_review(v_workspace,v_review_v3,v_parent_v1,'accept',v_request);
  if v_retry is distinct from v_result then raise exception 'b2_replay_review_accept_retry_changed'; end if;
  select current_revision_id into v_parent_v2 from public.order_sets where workspace_id=v_workspace and id='b2-replay-review-parent';
  if v_parent_v2 is null or v_parent_v2 = v_parent_v1
     or (select child_set_revision_id from public.order_set_revision_items where workspace_id=v_workspace and order_set_id='b2-replay-review-parent' and revision_id=v_parent_v2) is distinct from v_child_v3
     or (select status from public.order_set_revision_update_reviews where id=v_review_v3) <> 'accepted'
     or (select resolution_status from private.order_set_review_notification_resolutions where review_id=v_review_v3) <> 'accepted' then
    raise exception 'b2_replay_review_accept_pin_or_resolution_failed';
  end if;
  v_result := public.clair_resolve_order_set_update_review(v_workspace,v_review_v3,v_parent_v1,'dismiss',v_request);
  if v_result->>'ok' <> 'false' or v_result->>'outcome' <> 'conflict' or v_result->'error'->>'code' <> 'idempotency_conflict' then
    raise exception 'b2_replay_review_terminal_idempotency_guard_failed:%',v_result;
  end if;

  -- Dismiss a later child advance without changing the accepted parent pointer.
  v_child_def := jsonb_set(jsonb_set(v_child_def,'{setName}',to_jsonb('B2 review child v4'::text)),'{billingName}',to_jsonb('B2 review child v4 billing'::text));
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'review-child-v4','2026-08-20']::text[]);
  v_result := public.clair_save_order_set_revision(v_workspace,'b2-replay-review-child',v_child_v3,v_child_def,'active',v_request);
  if v_result->>'ok' <> 'true' then raise exception 'b2_replay_review_child_v4_save_failed:%',v_result; end if;
  select current_revision_id into v_child_v4 from public.order_sets where workspace_id=v_workspace and id='b2-replay-review-child';
  select id into v_review_v3 from public.order_set_revision_update_reviews
  where workspace_id=v_workspace and parent_order_set_id='b2-replay-review-parent' and pinned_child_revision_id=v_child_v3 and available_child_revision_id=v_child_v4 and status='pending';
  if v_review_v3 is null then raise exception 'b2_replay_review_dismiss_target_missing'; end if;
  v_before := (select to_jsonb(s) from public.order_sets s where s.workspace_id=v_workspace and s.id='b2-replay-review-parent');
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'review-dismiss-v4','2026-08-20']::text[]);
  v_result := public.clair_resolve_order_set_update_review(v_workspace,v_review_v3,v_parent_v2,'dismiss',v_request);
  v_after := (select to_jsonb(s) from public.order_sets s where s.workspace_id=v_workspace and s.id='b2-replay-review-parent');
  if v_result->>'ok' <> 'true' or v_result->>'outcome' <> 'dismissed'
     or v_before->>'current_revision_id' is distinct from v_after->>'current_revision_id'
     or (select status from public.order_set_revision_update_reviews where id=v_review_v3) <> 'dismissed'
     or (select resolution_status from private.order_set_review_notification_resolutions where review_id=v_review_v3) <> 'dismissed'
     or (select requires_action from public.notification_events where notification_id='order-set-review-'||v_review_v3::text)
     or (select badge_count from public.notification_events where notification_id='order-set-review-'||v_review_v3::text) then
    raise exception 'b2_replay_review_dismiss_failed:%',v_result;
  end if;

  -- A parent edit can make a pending review superseded.  The edit explicitly
  -- pins the current child revision; it never follows a child implicitly.
  v_child_def := jsonb_set(jsonb_set(v_child_def,'{setName}',to_jsonb('B2 review child v5'::text)),'{billingName}',to_jsonb('B2 review child v5 billing'::text));
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'review-child-v5','2026-08-20']::text[]);
  v_result := public.clair_save_order_set_revision(v_workspace,'b2-replay-review-child',v_child_v4,v_child_def,'active',v_request);
  if v_result->>'ok' <> 'true' then raise exception 'b2_replay_review_child_v5_save_failed:%',v_result; end if;
  select current_revision_id into v_child_v5 from public.order_sets where workspace_id=v_workspace and id='b2-replay-review-child';
  select id into v_review_v5 from public.order_set_revision_update_reviews
  where workspace_id=v_workspace and parent_order_set_id='b2-replay-review-parent' and pinned_child_revision_id=v_child_v3 and available_child_revision_id=v_child_v5 and status='pending';
  if v_review_v5 is null then raise exception 'b2_replay_review_parent_edit_target_missing'; end if;
  v_parent_def := jsonb_set(jsonb_set(v_parent_def,'{setName}',to_jsonb('B2 review parent edited'::text)),'{billingName}',to_jsonb('B2 review parent edited billing'::text));
  v_parent_def := jsonb_set(v_parent_def,'{items,0,childSetRevisionId}',to_jsonb(v_child_v5));
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'review-parent-edit','2026-08-20']::text[]);
  v_result := public.clair_save_order_set_revision(v_workspace,'b2-replay-review-parent',v_parent_v2,v_parent_def,'active',v_request);
  if v_result->>'ok' <> 'true' then raise exception 'b2_replay_review_parent_edit_failed:%',v_result; end if;
  select current_revision_id into v_parent_v3 from public.order_sets where workspace_id=v_workspace and id='b2-replay-review-parent';
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'review-superseded-v5','2026-08-20']::text[]);
  v_result := public.clair_resolve_order_set_update_review(v_workspace,v_review_v5,v_parent_v2,'accept',v_request);
  v_retry := public.clair_resolve_order_set_update_review(v_workspace,v_review_v5,v_parent_v2,'accept',v_request);
  if v_result->>'ok' <> 'false' or v_result->>'outcome' <> 'superseded'
     or v_result->'error'->>'code' <> 'order_set_review_obsolete'
     or v_retry is distinct from v_result
     or (select status from public.order_set_revision_update_reviews where id=v_review_v5) <> 'superseded'
     or (select resolution_status from private.order_set_review_notification_resolutions where review_id=v_review_v5) <> 'superseded' then
    raise exception 'b2_replay_review_parent_edit_superseded_failed:%',v_result;
  end if;

  -- A child advance is still reviewable when the exact-pinning current parent
  -- is paused or inactive.  If that review is overtaken by a newer usable
  -- child, its terminal resolution is obsolete (not superseded), and the
  -- same request UUID must return the exact terminal envelope on retry.
  v_parent_def := jsonb_set(jsonb_set(v_parent_def,'{setName}',to_jsonb('B2 review parent paused'::text)),'{billingName}',to_jsonb('B2 review parent paused billing'::text));
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'review-parent-paused','2026-08-20']::text[]);
  v_result := public.clair_create_order_set(v_workspace,v_parent_def,'paused',v_request);
  if v_result->>'ok' <> 'true' or v_result->>'outcome' <> 'created' then raise exception 'b2_replay_review_paused_parent_create_failed:%',v_result; end if;
  -- The public API owns the stable ID, so read it by the returned DTO rather
  -- than relying on a client-generated identity.
  select (v_result->'result'->'orderSet'->>'id') into v_parent_paused_id;
  if v_parent_paused_id is null then raise exception 'b2_replay_review_paused_parent_id_missing'; end if;
  select current_revision_id into v_parent_paused_v1 from public.order_sets where workspace_id=v_workspace and id=v_parent_paused_id;
  if v_parent_paused_v1 is null then raise exception 'b2_replay_review_paused_parent_pointer_missing'; end if;
  v_parent_def := jsonb_set(jsonb_set(v_parent_def,'{setName}',to_jsonb('B2 review parent inactive'::text)),'{billingName}',to_jsonb('B2 review parent inactive billing'::text));
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'review-parent-inactive','2026-08-20']::text[]);
  v_result := public.clair_create_order_set(v_workspace,v_parent_def,'inactive',v_request);
  if v_result->>'ok' <> 'true' or v_result->>'outcome' <> 'created' then raise exception 'b2_replay_review_inactive_parent_create_failed:%',v_result; end if;
  select (v_result->'result'->'orderSet'->>'id') into v_parent_inactive_id;
  if v_parent_inactive_id is null then raise exception 'b2_replay_review_inactive_parent_id_missing'; end if;
  select current_revision_id into v_parent_inactive_v1 from public.order_sets where workspace_id=v_workspace and id=v_parent_inactive_id;
  if v_parent_inactive_v1 is null then raise exception 'b2_replay_review_inactive_parent_pointer_missing'; end if;

  v_child_def := jsonb_set(jsonb_set(v_child_def,'{setName}',to_jsonb('B2 review child v6'::text)),'{billingName}',to_jsonb('B2 review child v6 billing'::text));
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'review-child-v6','2026-08-20']::text[]);
  v_result := public.clair_save_order_set_revision(v_workspace,'b2-replay-review-child',v_child_v5,v_child_def,'active',v_request);
  if v_result->>'ok' <> 'true' then raise exception 'b2_replay_review_child_v6_save_failed:%',v_result; end if;
  select current_revision_id into v_child_v6 from public.order_sets where workspace_id=v_workspace and id='b2-replay-review-child';
  select id into v_review_paused_v6
  from public.order_set_revision_update_reviews
  where workspace_id=v_workspace and parent_order_set_id=v_parent_paused_id
    and pinned_child_revision_id=v_child_v5 and available_child_revision_id=v_child_v6 and status='pending';
  if v_review_paused_v6 is null then raise exception 'b2_replay_review_paused_child_advance_missing'; end if;
  select id into v_review_inactive_v6
  from public.order_set_revision_update_reviews
  where workspace_id=v_workspace and parent_order_set_id=v_parent_inactive_id
    and pinned_child_revision_id=v_child_v5 and available_child_revision_id=v_child_v6 and status='pending';
  if v_review_inactive_v6 is null then raise exception 'b2_replay_review_inactive_child_advance_missing'; end if;

  v_child_def := jsonb_set(jsonb_set(v_child_def,'{setName}',to_jsonb('B2 review child v7'::text)),'{billingName}',to_jsonb('B2 review child v7 billing'::text));
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'review-child-v7','2026-08-20']::text[]);
  v_result := public.clair_save_order_set_revision(v_workspace,'b2-replay-review-child',v_child_v6,v_child_def,'active',v_request);
  if v_result->>'ok' <> 'true' then raise exception 'b2_replay_review_child_v7_save_failed:%',v_result; end if;
  select current_revision_id into v_child_v7 from public.order_sets where workspace_id=v_workspace and id='b2-replay-review-child';
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'review-paused-obsolete-v6','2026-08-20']::text[]);
  v_result := public.clair_resolve_order_set_update_review(v_workspace,v_review_paused_v6,v_parent_paused_v1,'accept',v_request);
  v_retry := public.clair_resolve_order_set_update_review(v_workspace,v_review_paused_v6,v_parent_paused_v1,'accept',v_request);
  if v_result->>'ok' <> 'false'
     or v_result->>'outcome' <> 'superseded'
     or v_result->'error'->>'code' <> 'order_set_review_obsolete'
     or v_retry is distinct from v_result
     or (select resolution_status from private.order_set_review_notification_resolutions where review_id=v_review_paused_v6) <> 'superseded'
     or (select requires_action from public.notification_events where notification_id='order-set-review-'||v_review_paused_v6::text) then
    raise exception 'b2_replay_review_paused_obsolete_terminal_retry_failed:%',v_result;
  end if;
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'review-inactive-obsolete-v6','2026-08-20']::text[]);
  v_result := public.clair_resolve_order_set_update_review(v_workspace,v_review_inactive_v6,v_parent_inactive_v1,'accept',v_request);
  v_retry := public.clair_resolve_order_set_update_review(v_workspace,v_review_inactive_v6,v_parent_inactive_v1,'accept',v_request);
  if v_result->>'ok' <> 'false'
     or v_result->>'outcome' <> 'superseded'
     or v_result->'error'->>'code' <> 'order_set_review_obsolete'
     or v_retry is distinct from v_result
     or (select resolution_status from private.order_set_review_notification_resolutions where review_id=v_review_inactive_v6) <> 'superseded'
     or (select requires_action from public.notification_events where notification_id='order-set-review-'||v_review_inactive_v6::text) then
    raise exception 'b2_replay_review_inactive_obsolete_terminal_retry_failed:%',v_result;
  end if;

  -- A false root and a child with no selected atomic member are both rejected
  -- by the flattened active projection check; the immutable rows are restored
  -- by the savepoint when the expected assertion raises.
  v_denied := false;
  begin
    perform set_config('clinical_master.b2_internal_write','on',true);
    update public.order_set_revision_items set default_selected=false
    where workspace_id=v_workspace and order_set_id='b2-replay-review-parent' and revision_id=v_parent_v3;
    perform private.clair_b2_validate_current_projection(v_workspace,'b2-replay-review-parent');
  exception when others then
    v_denied := sqlerrm = 'order_set_active_member_required';
  end;
  if not v_denied then raise exception 'b2_replay_false_root_selected_contract_missing'; end if;
  v_denied := false;
  begin
    perform set_config('clinical_master.b2_internal_write','on',true);
    update public.order_set_revision_items set default_selected=false
    where workspace_id=v_workspace and order_set_id='b2-replay-review-child' and revision_id=v_child_v5;
    perform private.clair_b2_validate_current_projection(v_workspace,'b2-replay-review-parent');
  exception when others then
    v_denied := sqlerrm = 'order_set_active_member_required';
  end;
  if not v_denied then raise exception 'b2_replay_empty_nested_selected_contract_missing'; end if;

  -- Inactive/use-off saves may retain a valid pointer while an invalid
  -- historical revision is recorded.  This is exercised through the public
  -- save RPC, never by manufacturing a revision with owner-only INSERT.
  v_inactive_def := jsonb_build_object(
    'setCategory','B2 replay','setName','B2 replay inactive','billingName','B2 replay inactive billing',
    'amountBasis','included_order_sum','setPriceKrw',null,'rangeBasis',null,
    'salesUnit','per_each','billingReflectionEnabled',false,'taxType','derived',
    'targetSpecies',jsonb_build_array('dog'),'careGuide',null,'internalInstruction',null,
    'items',jsonb_build_array(jsonb_build_object(
      'childKind','atomic','childOrderCatalogItemId','den194-catalog-ear-cleaning',
      'childOrderCatalogRevision',1,'childOrderSetId',null,'childSetRevisionId',null,
      'sortOrder',1,'defaultSelected',true,'billingReflectionDefault',true,
      'defaultQuantity',1,'quantitySource','fixed_one')),
    'priceRanges',jsonb_build_array());
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'inactive-create','2026-08-20']::text[]);
  v_result := private.clair_seed_order_set_compatibility_projection(
    v_workspace,'b2-replay-inactive',
    jsonb_set(v_inactive_def,'{items}','[]'::jsonb),
    'inactive',v_admin,v_request
  );
  if v_result->>'outcome' <> 'created' then raise exception 'b2_replay_inactive_create_failed:%',v_result; end if;
  select current_revision_id into v_parent_v1 from public.order_sets where workspace_id=v_workspace and id='b2-replay-inactive';
  v_before := (select to_jsonb(s) from public.order_sets s where workspace_id=v_workspace and id='b2-replay-inactive');
  select catalog_revision into v_catalog_revision
  from public.order_catalog_items
  where workspace_id=v_workspace and id='den194-catalog-ear-cleaning';
  v_result := public.clair_update_order_catalog_item_a2_base(
    v_workspace,'den194-catalog-ear-cleaning',v_catalog_revision,
    jsonb_build_object('availabilityStatus','paused')
  );
  if v_result->>'ok' <> 'true' then raise exception 'b2_replay_inactive_catalog_pause_failed:%',v_result; end if;
  select catalog_revision into v_catalog_revision
  from public.order_catalog_items
  where workspace_id=v_workspace and id='den194-catalog-ear-cleaning';
  v_inactive_def := jsonb_set(
    v_inactive_def,
    '{items,0,childOrderCatalogRevision}',
    to_jsonb(v_catalog_revision)
  );
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'inactive-invalid-save','2026-08-20']::text[]);
  v_result := public.clair_save_order_set_revision(
    v_workspace,'b2-replay-inactive',v_parent_v1,v_inactive_def,'inactive',v_request
  );
  if v_result->>'ok' <> 'false'
     or v_result->>'outcome' <> 'rejected'
     or v_result->'error'->>'code' <> 'invalid_order_set_definition' then
    raise exception 'b2_replay_inactive_invalid_save_envelope_failed:%',v_result;
  end if;
  select result_revision_id into v_invalid_revision
  from private.order_set_revision_save_requests
  where workspace_id=v_workspace and request_id=v_request;
  v_result := public.clair_update_order_catalog_item_a2_base(
    v_workspace,'den194-catalog-ear-cleaning',v_catalog_revision,
    jsonb_build_object('availabilityStatus','active')
  );
  if v_result->>'ok' <> 'true' then raise exception 'b2_replay_inactive_catalog_restore_failed:%',v_result; end if;
  v_after := (select to_jsonb(s) from public.order_sets s where workspace_id=v_workspace and id='b2-replay-inactive');
  if v_before->>'current_revision_id' is distinct from v_after->>'current_revision_id'
     or v_before->>'set_name' is distinct from v_after->>'set_name'
     or v_after->>'availability_status' <> 'inactive'
     or (select validation_status from public.order_set_revisions where id=v_invalid_revision) <> 'invalid'
     or (select validation_errors @> jsonb_build_array(jsonb_build_object('code','order_set_member_unavailable')) from public.order_set_revisions where id=v_invalid_revision) is not true then
    raise exception 'b2_replay_inactive_invalid_history_pointer_changed';
  end if;
  select count(*) into v_revision_count
  from public.order_set_revisions
  where workspace_id=v_workspace and order_set_id='b2-replay-inactive';
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'inactive-invalid-definition','2026-08-20']::text[]);
  v_retry := public.clair_save_order_set_revision(
    v_workspace,'b2-replay-inactive',v_parent_v1,
    jsonb_set(v_inactive_def,'{items,0,defaultQuantity}',to_jsonb(2)),
    'inactive',v_request
  );
  select result_revision_id into v_invalid_revision
  from private.order_set_revision_save_requests
  where workspace_id=v_workspace and request_id=v_request;
  if v_retry->>'ok' <> 'false'
     or v_retry->>'outcome' <> 'rejected'
     or v_retry->'error'->>'code' <> 'invalid_order_set_definition'
     or (select count(*) from public.order_set_revisions where workspace_id=v_workspace and order_set_id='b2-replay-inactive') <> v_revision_count + 1
     or v_invalid_revision is null
     or (select validation_status from public.order_set_revisions where id=v_invalid_revision) <> 'invalid'
     or (select validation_errors @> jsonb_build_array(jsonb_build_object('code','invalid_order_set_definition')) from public.order_set_revisions where id=v_invalid_revision) is not true
     or (select current_revision_id::text from public.order_sets where workspace_id=v_workspace and id='b2-replay-inactive') is distinct from v_after->>'current_revision_id'
     or (select source_set_version from public.order_sets where workspace_id=v_workspace and id='b2-replay-inactive') is distinct from v_after->>'source_set_version'
     or (select set_name from public.order_sets where workspace_id=v_workspace and id='b2-replay-inactive') is distinct from v_after->>'set_name'
     or (select billing_name from public.order_sets where workspace_id=v_workspace and id='b2-replay-inactive') is distinct from v_after->>'billing_name'
     or (select availability_status from public.order_sets where workspace_id=v_workspace and id='b2-replay-inactive') is distinct from v_after->>'availability_status'
     or (select needs_composition_review from public.order_sets where workspace_id=v_workspace and id='b2-replay-inactive') is distinct from (v_after->>'needs_composition_review')::boolean then
    raise exception 'b2_replay_inactive_invalid_order_set_definition_failed:%',v_retry;
  end if;
  v_denied := false;
  begin
    perform set_config('clinical_master.b2_internal_write','off',true);
    update public.order_set_revisions set set_name='mutated' where id=v_invalid_revision;
  exception when others then
    v_denied := sqlerrm = 'order_set_revision_immutable';
  end;
  if not v_denied then raise exception 'b2_replay_invalid_history_immutable_guard_missing'; end if;

  -- Save CAS, exact retry, changed-payload retry, and the common DTO envelope.
  select current_revision_id into v_parent_v1 from public.order_sets where workspace_id=v_workspace and id='b2-replay-sum';
  v_child_def := jsonb_set(jsonb_set(v_child_def,'{setName}',to_jsonb('B2 replay sum edited'::text)),'{billingName}',to_jsonb('B2 replay sum edited billing'::text));
  v_request := private.clair_b2_deterministic_uuid('replay',array[v_workspace,'sum-save','2026-08-20']::text[]);
  v_result := public.clair_save_order_set_revision(v_workspace,'b2-replay-sum',v_parent_v1,v_child_def,'active',v_request);
  if v_result->>'ok' <> 'true' or v_result->>'outcome' <> 'applied' or v_result->'result'->'current'->>'etag' is null then raise exception 'b2_replay_save_envelope_failed:%',v_result; end if;
  v_retry := public.clair_save_order_set_revision(v_workspace,'b2-replay-sum',v_parent_v1,v_child_def,'active',v_request);
  if v_retry is distinct from v_result then raise exception 'b2_replay_save_exact_retry_changed'; end if;
  v_retry := public.clair_save_order_set_revision(v_workspace,'b2-replay-sum',v_parent_v1,jsonb_set(v_child_def,'{setName}',to_jsonb('B2 replay sum changed payload'::text)),'active',v_request);
  if v_retry->>'ok' <> 'false' or v_retry->>'outcome' <> 'conflict' or v_retry->'error'->>'code' <> 'idempotency_conflict' then raise exception 'b2_replay_save_payload_retry_guard_failed:%',v_retry; end if;
  v_retry := public.clair_save_order_set_revision(v_workspace,'b2-replay-sum',v_parent_v1,v_child_def,'active',private.clair_b2_deterministic_uuid('replay',array[v_workspace,'sum-stale','2026-08-20']::text[]));
  if v_retry->>'ok' <> 'false' or v_retry->>'outcome' <> 'conflict' or v_retry->'error'->>'code' <> 'revision_conflict' then raise exception 'b2_replay_save_cas_guard_failed:%',v_retry; end if;
  select current_etag,pending_review_count,set_name into v_current_etag,v_pending_reviews,v_list_name from public.clair_list_order_sets(v_workspace,'B2 replay sum') limit 1;
  if v_current_etag is null or v_current_etag not like 'order-set-revision-%' or v_list_name <> 'B2 replay sum edited' then raise exception 'b2_replay_order_set_list_dto_failed'; end if;
  v_result := public.clair_get_order_set(v_workspace,'b2-replay-sum');
  if jsonb_typeof(v_result->'orderSet') <> 'object' or jsonb_typeof(v_result->'history') <> 'array' or jsonb_typeof(v_result->'reviews') <> 'array' then raise exception 'b2_replay_order_set_detail_dto_failed:%',v_result; end if;

  -- The non-admin member cannot call a manage RPC, and authenticated has no
  -- direct DML or private notification-writer privilege.
  perform set_config('request.jwt.claim.sub',v_vet::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_vet::text,'role','authenticated')::text,true);
  v_denied := false;
  begin
    perform public.clair_create_order_set(v_workspace,v_inactive_def,'inactive',private.clair_b2_deterministic_uuid('replay',array[v_workspace,'permission-denied','2026-08-20']::text[]));
  exception when others then
    v_denied := sqlerrm = 'permission_missing';
  end;
  if not v_denied then raise exception 'b2_replay_manage_permission_boundary_missing'; end if;
  if has_table_privilege('authenticated','public.order_set_revisions','UPDATE')
     or has_table_privilege('authenticated','public.order_set_revision_items','UPDATE')
     or has_table_privilege('authenticated','public.order_set_revision_update_reviews','UPDATE')
     or has_function_privilege('authenticated','private.clair_b2_save_core(text,text,uuid,jsonb,text,uuid,uuid)','EXECUTE') then
    raise exception 'b2_replay_authenticated_direct_dml_acl_leak';
  end if;
end
$$;

select 'b2_replay_order_sets' as check_name, count(*)::integer as value
from public.order_sets
where workspace_id='clair-demo' and id like 'b2-replay-%';
select 'b2_replay_current_pointers' as check_name, count(*)::integer as value
from public.order_sets
where workspace_id='clair-demo' and id like 'b2-replay-%' and current_revision_id is not null;
select 'b2_replay_workspace_isolation' as check_name,
  count(*)::integer as value
from public.order_sets
where workspace_id='workspace-clair-cheongdam' and id='b2-replay-other-workspace';

rollback;

do $$
begin
  if exists (select 1 from public.order_sets where id like 'b2-replay-%')
     or exists (select 1 from public.order_set_revisions where order_set_id like 'b2-replay-%')
     or exists (select 1 from public.order_set_revision_update_reviews where parent_order_set_id like 'b2-replay-%')
     or exists (select 1 from private.order_set_legacy_quarantine where legacy_order_set_id like 'b2-replay-%') then
    raise exception 'b2_replay_cleanup_failed';
  end if;
end
$$;

select 'b2_replay_cleanup_ok' as check_name;
