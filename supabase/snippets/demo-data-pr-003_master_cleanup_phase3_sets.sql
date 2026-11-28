-- DEMO-DATA-PR-003 master data cleanup, phase 3 (Cheongdam only): order sets and lab devices.
-- Plan: docs/product/demo-data/cheongdam-demo-realism-plan-v1.md.
--
--   A. Sets realistic fixed prices on the 29 lab order sets (lab panels are
--      ordered as sets of single-analyte tests in this product).
--   B. Deactivates the 10 test-named sets ("PR…", "합성 …"). Six of them hold an
--      invalid definition; the RPC still deactivates them and reports ok=false
--      ("inactive revision retained as immutable invalid history"), so success
--      is judged by the resulting status, not by the RPC result.
--   C. Renames the three lab devices. There is no rename RPC; only `name` changes.
--
-- Sets are saved through clair_save_order_set_revision as the hospital admin,
-- re-pinned to the current member catalog revisions.
-- NOT covered: billing a fixed-price set still fails (billing_authority_incomplete).
-- That is a product gap, see the work item.
--
-- Keep `dry := true` to preview: the block ends with "SETCLEAN_ROLLBACK {...}".

do $sets$
declare
  w constant text := 'workspace-clair-cheongdam';
  admin constant text := '49110000-0000-4000-8000-000000000001';
  dry constant boolean := true;
  prices constant jsonb := '{
    "전혈구 기본 패널": 44000, "기본 혈청화학 패널": 77000, "확장 혈청화학 패널": 110000, "전해질 검사": 33000, "요검사 패널": 33000, "분변 검사 패널": 27500,
    "췌장 평가 패널": 60500, "갑상선 검사 패널": 66000, "신장 검사": 66000, "간 검사": 66000, "수술 전 검사": 99000, "응고 검사": 44000, "지질 검사 패널": 44000,
    "부신 검사 패널": 88000, "염증 표지 패널": 55000, "당대사 패널": 55000, "요단백 평가 패널": 55000, "감염성 질환 선별 패널": 77000,
    "기본 건강검진 검사 조합": 132000, "노령견 검사 조합": 165000, "노령묘 검사 조합": 165000, "마취 전 확장 검사 조합": 143000, "신장 평가 검사 조합": 121000,
    "간담도 평가 검사 조합": 121000, "구토·설사 검사 조합": 110000, "다뇨·다갈 검사 조합": 132000, "체중감소 검사 조합": 132000, "응급 초기 검사 조합": 110000, "감염성 질환 검사 조합": 99000
  }'::jsonb;
  st record; def jsonb; r jsonb; failed int := 0; errors jsonb := '[]'::jsonb; out jsonb; n int;
begin
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',admin,true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  for st in
    select s.id, s.set_name, s.current_revision_id rev_id, s.availability_status,
      (s.set_name ~ '^(PR-?[0-9]|합성 )') is_test, (prices->>s.set_name)::int new_price
    from public.order_sets s
    where s.workspace_id = w and s.availability_status = 'active' and s.archived_at is null
    order by s.set_name
  loop
    if not st.is_test and st.new_price is null then continue; end if;
    select jsonb_build_object('setCategory',rv.set_category,'setName',rv.set_name,'billingName',rv.billing_name,'amountBasis',rv.amount_basis,
        'setPriceKrw',case when st.is_test then rv.set_price_krw else st.new_price end,
        'rangeBasis',rv.range_basis,'salesUnit',rv.sales_unit,'billingReflectionEnabled',rv.billing_reflection_enabled,'taxType',rv.tax_type,'targetSpecies',to_jsonb(rv.target_species),
        'careGuide',rv.care_guide,'internalInstruction',rv.internal_instruction,
        'items',coalesce((select jsonb_agg(jsonb_build_object('childKind',i.child_kind,
              'childOrderCatalogItemId',case when i.child_kind='atomic' then i.child_order_catalog_item_id else null end,
              'childOrderCatalogRevision',case when i.child_kind='atomic' then c.catalog_revision else null end,
              'childOrderSetId',case when i.child_kind='order_set' then i.child_order_set_id else null end,
              'childSetRevisionId',case when i.child_kind='order_set' then i.child_set_revision_id else null end,
              'sortOrder',i.sort_order,'defaultSelected',i.default_selected,'billingReflectionDefault',i.billing_reflection_default,'defaultQuantity',i.default_quantity,'quantitySource',i.quantity_source) order by i.sort_order)
            from public.order_set_revision_items i left join public.order_catalog_items c on c.workspace_id=i.workspace_id and c.id=i.child_order_catalog_item_id
            where i.workspace_id=rv.workspace_id and i.order_set_id=rv.order_set_id and i.revision_id=rv.id),'[]'::jsonb),
        'priceRanges',private.clair_b2_revision_ranges_json(rv.workspace_id,rv.order_set_id,rv.id))
      into def from public.order_set_revisions rv where rv.workspace_id=w and rv.order_set_id=st.id and rv.id=st.rev_id;
    r := public.clair_save_order_set_revision(w, st.id, st.rev_id, def, case when st.is_test then 'inactive' else st.availability_status end, gen_random_uuid());
    if not st.is_test and not coalesce((r->>'ok')::boolean, false) then
      failed := failed + 1; errors := errors || jsonb_build_object('set', st.set_name, 'error', r#>>'{error,message}');
    end if;
  end loop;

  update public.workspace_lab_devices set name = case model
      when 'SYNTHETIC-CBC-MANUAL' then '혈구 검사 수기 입력'
      when 'SYNTHETIC-LAB-MANUAL' then '일반 검사 수기 입력'
      when 'SYNTHETIC-SMEAR-MANUAL' then '혈액도말 현미경 판독' else name end
    where workspace_id = w and name like '%합성%';
  get diagnostics n = row_count;

  out := jsonb_build_object('dry', dry, 'failed', failed, 'errors', errors, 'devicesRenamed', n,
    'activeSets', (select count(*) from public.order_sets where workspace_id=w and availability_status='active'),
    'activeTestNamed', (select jsonb_agg(set_name) from public.order_sets where workspace_id=w and availability_status='active' and set_name ~ '^(PR-?[0-9]|합성 )'),
    'oddSetPrices', (select count(*) from public.order_sets s join public.order_set_revisions rv on rv.id=s.current_revision_id where s.workspace_id=w and s.availability_status='active' and rv.set_price_krw % 100 <> 0));
  if dry or failed > 0 or out->'activeTestNamed' <> 'null'::jsonb then
    raise exception 'SETCLEAN_ROLLBACK %', out::text;
  end if;
end $sets$;
