-- DEMO-DATA-PR-003 hospital drug list (Cheongdam only).
-- Plan: docs/product/demo-data/cheongdam-demo-realism-plan-v1.md.
--
-- The 179 master drug items stay blocked by the clinical review gate
-- (clinical_use_allowed = false) and carry brand names. This script does not
-- touch that gate. It adds hospital-authored drugs the way the app does:
--   1. hospital admin creates the item      clair_create_order_catalog_item
--   2. admin adds the dispensing/billing basis clair_update_order_catalog_item
--      (the create path cannot accept planOrderAuthority)
--   3. a veterinarian approves it            clair_review_workspace_dispensing_order
-- Names are ingredient + strength only. No brand or manufacturer names.
-- Prices are VAT-included. "unit" = price per tablet/capsule/mL/pipette,
-- "order" = one price per dispensed container.
-- Not covered: the test-named master item "PR-024B 조제 제품" stays active. The
-- catalog update RPC rejects it (catalog_default_detail_inputs_invalid), and
-- the frequency "qod" is rejected for catalog defaults, so the shampoo uses "once".
--
-- Safe to re-run: an item whose name already exists as a hospital drug is skipped.
-- Keep `dry := true` to preview: the block ends with "DRUGLIST_ROLLBACK {...}".

do $drugs$
declare
  w constant text := 'workspace-clair-cheongdam';
  admin constant text := '49110000-0000-4000-8000-000000000001';
  vet constant text := '49110000-0000-4000-8000-000000000003';
  dry constant boolean := true;
  -- n name | ko/en ingredient | s subcategory | r route | u unit | d dose | f frequency | days | p price | b basis | sp species | a alias | g guardian note
  drugs constant jsonb := $json$[
    {"n":"마로피탄트 16mg 정","ko":"마로피탄트","en":"Maropitant","s":"oral-medication","r":"PO","u":"tablet","d":1,"f":"sid","days":3,"p":3300,"b":"unit","sp":["dog","cat"],"a":"항구토제","g":"하루 1회, 식전에 먹이세요."},
    {"n":"아목시실린·클라불란산 62.5mg 정","ko":"아목시실린·클라불란산","en":"Amoxicillin-clavulanate","s":"oral-medication","r":"PO","u":"tablet","d":1,"f":"bid","days":7,"p":1100,"b":"unit","sp":["dog","cat"],"a":"항생제","g":"하루 2회, 식후에 먹이세요. 끝까지 복용하세요."},
    {"n":"아목시실린·클라불란산 250mg 정","ko":"아목시실린·클라불란산","en":"Amoxicillin-clavulanate","s":"oral-medication","r":"PO","u":"tablet","d":1,"f":"bid","days":7,"p":1650,"b":"unit","sp":["dog"],"a":"항생제","g":"하루 2회, 식후에 먹이세요. 끝까지 복용하세요."},
    {"n":"세팔렉신 250mg 캡슐","ko":"세팔렉신","en":"Cefalexin","s":"oral-medication","r":"PO","u":"capsule","d":1,"f":"bid","days":7,"p":770,"b":"unit","sp":["dog"],"a":"항생제","g":"하루 2회, 식후에 먹이세요."},
    {"n":"메트로니다졸 250mg 정","ko":"메트로니다졸","en":"Metronidazole","s":"oral-medication","r":"PO","u":"tablet","d":0.5,"f":"bid","days":5,"p":660,"b":"unit","sp":["dog","cat"],"a":"장염","g":"하루 2회, 식후에 먹이세요."},
    {"n":"독시사이클린 100mg 정","ko":"독시사이클린","en":"Doxycycline","s":"oral-medication","r":"PO","u":"tablet","d":0.5,"f":"sid","days":14,"p":880,"b":"unit","sp":["dog","cat"],"a":"항생제","g":"먹인 뒤 물이나 간식을 함께 주세요."},
    {"n":"파모티딘 10mg 정","ko":"파모티딘","en":"Famotidine","s":"oral-medication","r":"PO","u":"tablet","d":0.5,"f":"bid","days":7,"p":440,"b":"unit","sp":["dog","cat"],"a":"위장 보호제","g":"하루 2회, 식전 30분에 먹이세요."},
    {"n":"오메프라졸 10mg 캡슐","ko":"오메프라졸","en":"Omeprazole","s":"oral-medication","r":"PO","u":"capsule","d":1,"f":"sid","days":7,"p":880,"b":"unit","sp":["dog","cat"],"a":"위산 억제제","g":"하루 1회, 아침 식전에 먹이세요."},
    {"n":"우르소데옥시콜산 100mg 정","ko":"우르소데옥시콜산","en":"Ursodeoxycholic acid","s":"oral-medication","r":"PO","u":"tablet","d":1,"f":"bid","days":14,"p":660,"b":"unit","sp":["dog","cat"],"a":"간 보호제","g":"하루 2회, 식후에 먹이세요."},
    {"n":"실리마린 70mg 캡슐","ko":"실리마린","en":"Silymarin","s":"oral-medication","r":"PO","u":"capsule","d":1,"f":"bid","days":30,"p":880,"b":"unit","sp":["dog","cat"],"a":"간 보조제","g":"하루 2회 먹이세요."},
    {"n":"락툴로오스 시럽","ko":"락툴로오스","en":"Lactulose","s":"oral-medication","r":"PO","u":"ml","d":2,"f":"bid","days":7,"p":550,"b":"unit","sp":["dog","cat"],"a":"변비","g":"하루 2회 먹이세요. 변이 묽어지면 연락 주세요."},
    {"n":"가바펜틴 100mg 캡슐","ko":"가바펜틴","en":"Gabapentin","s":"oral-medication","r":"PO","u":"capsule","d":1,"f":"bid","days":7,"p":660,"b":"unit","sp":["dog","cat"],"a":"진통제","g":"하루 2회 먹이세요. 졸려 보일 수 있습니다."},
    {"n":"멜록시캄 1mg 정","ko":"멜록시캄","en":"Meloxicam","s":"oral-medication","r":"PO","u":"tablet","d":1,"f":"sid","days":5,"p":1100,"b":"unit","sp":["dog"],"a":"소염진통제","g":"하루 1회, 반드시 식후에 먹이세요. 구토나 검은 변이 보이면 중단하고 연락 주세요."},
    {"n":"프레드니솔론 5mg 정","ko":"프레드니솔론","en":"Prednisolone","s":"oral-medication","r":"PO","u":"tablet","d":1,"f":"sid","days":5,"p":330,"b":"unit","sp":["dog","cat"],"a":"스테로이드","g":"하루 1회, 식후에 먹이세요. 임의로 중단하지 마세요."},
    {"n":"오클라시티닙 5.4mg 정","ko":"오클라시티닙","en":"Oclacitinib","s":"oral-medication","r":"PO","u":"tablet","d":1,"f":"bid","days":14,"p":3850,"b":"unit","sp":["dog"],"a":"가려움증","g":"처음 14일은 하루 2회, 이후 하루 1회로 줄입니다."},
    {"n":"테오필린 100mg 서방정","ko":"테오필린","en":"Theophylline","s":"oral-medication","r":"PO","u":"tablet","d":0.5,"f":"bid","days":7,"p":550,"b":"unit","sp":["dog","cat"],"a":"기관지 확장제","g":"하루 2회 먹이세요. 쪼갠 정제는 씹지 않게 해 주세요."},
    {"n":"피모벤단 1.25mg 정","ko":"피모벤단","en":"Pimobendan","s":"oral-medication","r":"PO","u":"tablet","d":1,"f":"bid","days":30,"p":1650,"b":"unit","sp":["dog","cat"],"a":"강심제","g":"하루 2회, 식전 1시간에 먹이세요. 매일 같은 시간에 먹이세요."},
    {"n":"푸로세미드 10mg 정","ko":"푸로세미드","en":"Furosemide","s":"oral-medication","r":"PO","u":"tablet","d":1,"f":"bid","days":14,"p":440,"b":"unit","sp":["dog","cat"],"a":"이뇨제","g":"하루 2회 먹이세요. 물은 항상 마실 수 있게 해 주세요."},
    {"n":"베나제프릴 5mg 정","ko":"베나제프릴","en":"Benazepril","s":"oral-medication","r":"PO","u":"tablet","d":0.5,"f":"sid","days":30,"p":880,"b":"unit","sp":["dog","cat"],"a":"혈압·신장","g":"하루 1회 먹이세요."},
    {"n":"암로디핀 5mg 정","ko":"암로디핀","en":"Amlodipine","s":"oral-medication","r":"PO","u":"tablet","d":0.25,"f":"sid","days":30,"p":550,"b":"unit","sp":["dog","cat"],"a":"혈압약","g":"하루 1회, 1/4정씩 먹이세요."},
    {"n":"텔미사르탄 4mg/mL 경구액","ko":"텔미사르탄","en":"Telmisartan","s":"oral-medication","r":"PO","u":"ml","d":0.5,"f":"sid","days":30,"p":2200,"b":"unit","sp":["cat"],"a":"단백뇨","g":"하루 1회, 주사기로 입에 직접 먹이세요."},
    {"n":"클로피도그렐 75mg 정","ko":"클로피도그렐","en":"Clopidogrel","s":"oral-medication","r":"PO","u":"tablet","d":0.25,"f":"sid","days":30,"p":1100,"b":"unit","sp":["cat"],"a":"항혈전제","g":"하루 1회, 1/4정씩 먹이세요. 쓴맛이 강해 캡슐에 넣어 드립니다."},
    {"n":"프라조신 1mg 정","ko":"프라조신","en":"Prazosin","s":"oral-medication","r":"PO","u":"tablet","d":0.5,"f":"bid","days":7,"p":770,"b":"unit","sp":["cat"],"a":"요도 이완제","g":"하루 2회 먹이세요. 소변을 못 보면 바로 내원하세요."},
    {"n":"구형흡착탄 200mg 캡슐","ko":"구형흡착탄","en":"Spherical carbon adsorbent","s":"oral-medication","r":"PO","u":"capsule","d":1,"f":"bid","days":30,"p":990,"b":"unit","sp":["dog","cat"],"a":"신장 보조제","g":"다른 약과 2시간 간격을 두고 먹이세요."},
    {"n":"인슐린 글라진 100IU/mL 10mL","ko":"인슐린 글라진","en":"Insulin glargine","s":"injection","r":"SC","u":"ml","d":0.02,"f":"bid","days":30,"p":71500,"b":"order","sp":["dog","cat"],"a":"인슐린","g":"1회 2단위(0.02mL)를 하루 2회, 식사 후 피하주사합니다. 냉장 보관하세요."},
    {"n":"오플록사신 0.3% 점안액","ko":"오플록사신","en":"Ofloxacin","s":"ophthalmic","r":"ophthalmic","u":"drop","d":1,"f":"tid","days":7,"p":16500,"b":"order","sp":["dog","cat"],"a":"항생제 안약","g":"하루 3회, 한 방울씩 넣어 주세요."},
    {"n":"히알루론산나트륨 0.1% 점안액","ko":"히알루론산나트륨","en":"Sodium hyaluronate","s":"ophthalmic","r":"ophthalmic","u":"drop","d":1,"f":"tid","days":14,"p":13200,"b":"order","sp":["dog","cat"],"a":"인공눈물","g":"하루 3회, 한 방울씩 넣어 주세요."},
    {"n":"겐타마이신·베타메타손·클로트리마졸 점이액","ko":"겐타마이신·베타메타손·클로트리마졸","en":"Gentamicin-betamethasone-clotrimazole","s":"otic","r":"otic","u":"drop","d":5,"f":"bid","days":7,"p":27500,"b":"order","sp":["dog"],"a":"귀약","g":"하루 2회, 귀 세정 후 5방울씩 넣고 귀 밑을 부드럽게 문질러 주세요."},
    {"n":"클로르헥시딘 2% 약용 샴푸","ko":"클로르헥시딘","en":"Chlorhexidine","s":"topical","r":"topical","u":"application","d":1,"f":"once","days":1,"p":33000,"b":"order","sp":["dog","cat"],"a":"약용 샴푸","g":"주 2회, 거품을 10분 유지한 뒤 헹궈 주세요."},
    {"n":"무피로신 2% 연고","ko":"무피로신","en":"Mupirocin","s":"topical","r":"topical","u":"application","d":1,"f":"bid","days":7,"p":11000,"b":"order","sp":["dog","cat"],"a":"항생제 연고","g":"하루 2회 얇게 바르고 핥지 않게 해 주세요."},
    {"n":"클로르헥시딘 0.12% 구강 겔","ko":"클로르헥시딘","en":"Chlorhexidine","s":"oromucosal","r":"oromucosal","u":"application","d":1,"f":"sid","days":14,"p":22000,"b":"order","sp":["dog","cat"],"a":"구강 관리","g":"하루 1회, 잇몸에 발라 주세요."},
    {"n":"셀라멕틴 스팟온 2.6–5kg","ko":"셀라멕틴","en":"Selamectin","s":"transdermal","r":"transdermal","u":"pipette","d":1,"f":"once","days":1,"p":22000,"b":"unit","sp":["dog","cat"],"a":"외부기생충 예방","g":"목 뒤 피부에 직접 바르고, 마를 때까지 만지지 마세요."}
  ]$json$::jsonb;
  d jsonb; r jsonb; ci record; path uuid; defaults jsonb; new_id text; per_day numeric; total numeric; by_unit boolean;
  created int := 0; skipped int := 0; failed int := 0; errors jsonb := '[]'::jsonb; out jsonb; step text;
begin
  perform set_config('request.jwt.claim.role','authenticated',true);
  select classification_path_id into path from public.order_catalog_items
    where workspace_id = w and clinical_order_type = 'dispensing' and origin_type = 'clair_master' and admin_subcategory_code = 'oral-medication' limit 1;

  for d in select * from jsonb_array_elements(drugs) loop
    if exists (select 1 from public.order_catalog_items where workspace_id = w and origin_type = 'workspace_custom'
               and clinical_order_type = 'dispensing' and in_hospital_order_name = d->>'n') then
      skipped := skipped + 1; continue;
    end if;
    begin
      step := 'create';
      perform set_config('request.jwt.claim.sub', admin, true);
      perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
      by_unit := d->>'b' = 'unit';
      per_day := case d->>'f' when 'bid' then 2 when 'tid' then 3 when 'qid' then 4 when 'qod' then 0.5 else 1 end;
      total := case when d->>'f' = 'once' then (d->>'d')::numeric else (d->>'d')::numeric * per_day * (d->>'days')::numeric end;
      defaults := jsonb_build_object('dose', d->'d', 'route', d->>'r', 'doseUnit', d->>'u', 'doseBasis', 'patient', 'frequency', d->>'f',
        'durationDays', d->'days', 'totalQuantity', total, 'totalQuantityUnit', d->>'u', 'guardianNote', d->>'g');
      r := public.clair_create_order_catalog_item(w, jsonb_build_object(
        'id', 'x', 'standardOrderId', 'cd-rx-' || md5(d->>'n'), 'sourcePresetVersion', 'workspace-custom-v1',
        'classificationPathId', path, 'categoryGroup', 'medication', 'categoryLabel', 'CG_MEDICATION_SUPPLY', 'adminSubcategoryCode', d->>'s',
        'standardOrderName', d->>'n', 'inHospitalOrderName', d->>'n', 'billingName', d->>'n', 'aliases', jsonb_build_array(d->>'a', d->>'en'),
        'availabilityStatus', 'active', 'priceKrw', d->'p', 'salesUnit', case when by_unit then 'per_each' else 'per_order' end, 'targetSpecies', d->'sp',
        'defaultDestinationModule', 'dispensing', 'defaultTaskRequired', true, 'billingReflectionEnabled', true,
        'careGuide', null, 'careGuideDeliveryEnabled', false, 'internalInstruction', null, 'internalInstructionDeliveryEnabled', false,
        'taxIncluded', true, 'roundingRule', 'as_is',
        'pricingRule', jsonb_build_object('priceKrw', d->'p', 'priceBasis', case when by_unit then 'unit_price' else 'fixed_order_price' end),
        'medicationMetadata', jsonb_build_object('ingredientKoreanName', d->>'ko', 'ingredientEnglishName', d->>'en', 'defaultDetailInputs', defaults),
        'vaccineMetadata', '{}'::jsonb));
      if not coalesce((r->>'ok')::boolean, false) then raise exception 'create rejected: %', left(r::text, 200); end if;
      new_id := r #>> '{item,id}';

      step := 'authority';
      select * into ci from public.order_catalog_items where workspace_id = w and id = new_id;
      r := public.clair_update_order_catalog_item(w, new_id, ci.catalog_revision, jsonb_build_object('defaultDetailInputs',
        ci.default_detail_inputs || jsonb_build_object('planOrderAuthority', jsonb_build_object(
          'schemaVersion', 2, 'calculationMode', 'product_unit', 'dispenseUnit', d->>'u',
          'priceBasis', case when by_unit then 'per_product_unit' else 'per_order' end,
          'billingUnit', case when by_unit then d->>'u' else 'container' end, 'taxClass', 'taxable',
          'preparationPolicy', jsonb_build_object('increment', case when d->>'u' = 'ml' then 0.1 else 1 end, 'roundingMode', 'up',
            'quantityScope', 'course_total', 'displayPrecision', case when d->>'u' = 'ml' then 1 else 0 end)))));

      step := 'approve';
      perform set_config('request.jwt.claim.sub', vet, true);
      perform set_config('request.jwt.claims', json_build_object('sub', vet, 'role', 'authenticated')::text, true);
      select * into ci from public.order_catalog_items where workspace_id = w and id = new_id;
      r := public.clair_review_workspace_dispensing_order(w, new_id, ci.catalog_revision, 'approve', '성분·함량·기본 용법 확인');
      select * into ci from public.order_catalog_items where workspace_id = w and id = new_id;
      if ci.availability_status <> 'active' or ci.workspace_dispensing_review_status <> 'approved' then
        raise exception 'not active after approval: % / %', ci.availability_status, ci.workspace_dispensing_review_status;
      end if;
      created := created + 1;
    exception when others then
      failed := failed + 1;
      errors := errors || jsonb_build_object('drug', d->>'n', 'step', step, 'error', left(sqlerrm, 200));
    end;
  end loop;

  out := jsonb_build_object('dry', dry, 'created', created, 'skipped', skipped, 'failed', failed, 'errors', errors,
    'hospitalDrugsActive', (select count(*) from public.order_catalog_items where workspace_id = w and origin_type = 'workspace_custom'
       and clinical_order_type = 'dispensing' and availability_status = 'active' and workspace_dispensing_review_status = 'approved'),
    'activeSetsNeedingRefresh', (select count(distinct s.id) from public.order_sets s
       join public.order_set_revision_items i on i.workspace_id = s.workspace_id and i.order_set_id = s.id and i.revision_id = s.current_revision_id
       join public.order_catalog_items c on c.workspace_id = i.workspace_id and c.id = i.child_order_catalog_item_id
       where s.workspace_id = w and s.availability_status = 'active' and i.child_kind = 'atomic'
         and i.child_order_catalog_revision is distinct from c.catalog_revision));
  if dry or failed > 0 then
    raise exception 'DRUGLIST_ROLLBACK %', out::text;
  end if;
end $drugs$;
