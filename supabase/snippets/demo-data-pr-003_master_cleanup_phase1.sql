-- DEMO-DATA-PR-003 master data cleanup, phase 1 (Cheongdam only).
-- Plan: docs/product/demo-data/cheongdam-demo-realism-plan-v1.md, section 3.
--
-- What it does, through the app's own admin RPCs as the hospital admin:
--   1. Sets the workspace VAT policy (vat_included) and discount reasons.
--   2. For every active, non-archived, non-dispensing catalog item:
--      - rewrites test wording in the default order instructions,
--      - rounds the price to 100 KRW,
--      - adds the billing basis (per order, one session; clinical items are
--        VAT-exempt, certificates and other items are taxable).
--   Dispensing items, item names, device protocols and hand-tuned prices are
--   later phases.
--
-- HOW TO RUN: keep `dry := true` to preview. The block then ends with
-- "CLEANUP_ROLLBACK {...}" and saves nothing. Set `dry := false` to apply.
-- p_types limits one run to some order types (keeps each run short).

do $cleanup$
declare
  w constant text := 'workspace-clair-cheongdam';
  -- Only the owner role holds hospital_settings:manage (VAT policy). The admin
  -- role holds service_catalog:manage (catalog edits).
  owner constant text := '00000000-0000-4000-8000-000000000001';
  admin constant text := '49110000-0000-4000-8000-000000000001';
  dry constant boolean := true;
  p_types constant text[] := array['consultation','clinical_lab','imaging','treatment','hospitalization','other'];
  clinical_tax constant text := 'non_taxable';
  it record; d jsonb; v text; patch jsonb; new_price integer; r jsonb;
  changed int := 0; failed int := 0; price_fixed int := 0; wording_fixed int := 0; basis_added int := 0;
  errors jsonb := '[]'::jsonb; samples jsonb := '[]'::jsonb; out jsonb;
begin
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',owner,true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated')::text, true);
  perform public.clair_update_workspace_order_billing_policy(w, owner::uuid, 'vat_included',
    '["단골 보호자 할인","다두 가정 할인","직원 할인","재진 패키지","기타"]'::jsonb);
  perform set_config('request.jwt.claim.sub',admin,true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);

  for it in
    select c.id, c.clinical_order_type t, c.catalog_revision rev, c.price_krw, c.default_detail_inputs d, c.in_hospital_order_name name
    from public.order_catalog_items c
    where c.workspace_id = w and c.archived_at is null and c.availability_status = 'active'
      and c.clinical_order_type = any(p_types)
    order by c.clinical_order_type, c.id
  loop
    d := it.d; patch := '{}'::jsonb;

    if d ? 'collectionCondition' then
      v := d->>'collectionCondition';
      v := replace(v, '합성 EDTA 전혈 시나리오 · 환자 및 검체 라벨 확인 후 수기 접수', 'EDTA 전혈 · 검체 라벨과 환자 확인');
      v := replace(v, ' · 합성 검체 라벨 및 요청 환자 확인', ' · 검체 라벨과 환자 확인');
      v := regexp_replace(v, '^합성 ', '');
      d := jsonb_set(d, '{collectionCondition}', to_jsonb(v));
    end if;
    if d->>'pretreatment' ~ '합성' then
      d := jsonb_set(d, '{pretreatment}', to_jsonb('검체 상태 확인 후 검사 진행'::text));
    end if;
    if d->>'exceptions' ~ '합성' then
      d := jsonb_set(d, '{exceptions}', to_jsonb(case it.t
        when 'imaging' then '부위·자세·촬영 수·조영·진정 계획이 다르면 환자에 맞게 수정한다.'
        else '환자·부위·재료가 계획과 다르면 시작 전에 확인한다. 시행 차이와 중단 사유는 기록한다.' end));
    end if;
    if d->>'dietPlan' ~ '합성' then
      d := jsonb_set(d, '{dietPlan}', to_jsonb('급여 여부를 확인하고 식이 인계 내용을 기록한다.'::text));
    end if;
    if d->>'isolationPlan' ~ '합성' then
      d := jsonb_set(d, '{isolationPlan}', to_jsonb('지정된 격리 입원 공간을 사용한다. 전용 물품을 쓰고 접촉 동선을 분리한다.'::text));
    end if;
    if d ? 'stagedInstructions' then
      v := d->>'stagedInstructions';
      v := regexp_replace(v, '합성 데모 시나리오 [A-Za-z0-9-]+: ', '', 'g');
      v := replace(v, '실제 수행한 범위와 결과를 수행기록에 직접 입력한다.', '시행한 범위와 결과를 수행 기록에 남긴다.');
      v := replace(v, '준비 확인 결과만 기록한다. 실제 수술·천자·마취·멸균 완료로 기록하지 않는다.', '준비 확인 결과를 기록한다.');
      v := replace(v, '약품 제품·용량·경로는 같은 진료의 별도 약품 오더를 연결한다. 이 처치의 1 session을 약품 용량으로 해석하지 않는다.', '약품 제품·용량·경로는 별도 약품 오더로 연결한다.');
      v := replace(v, '관찰값·완료 상태를 미리 채우지 않는다.', '');
      v := regexp_replace(v, '예정량 1은 [^\n]*실제 수행량에 복사하지 않는다\.', '', 'g');
      v := btrim(regexp_replace(v, '\n{2,}', E'\n', 'g'), E'\n ');
      d := jsonb_set(d, '{stagedInstructions}', to_jsonb(v));
    end if;
    if d is distinct from it.d then wording_fixed := wording_fixed + 1; end if;

    if it.t <> 'system_exam' and not (d ? 'planOrderAuthority') then
      d := d || jsonb_build_object('planOrderAuthority', jsonb_build_object(
        'schemaVersion', 1, 'calculationMode', 'not_applicable', 'priceBasis', 'per_order', 'billingUnit', 'session',
        'taxClass', case when it.t = 'other' then 'taxable' else clinical_tax end));
      basis_added := basis_added + 1;
    end if;
    if d is distinct from it.d then patch := patch || jsonb_build_object('defaultDetailInputs', d); end if;

    if it.price_krw is not null and it.price_krw % 100 <> 0 then
      new_price := (round(it.price_krw / 100.0) * 100)::integer;
      patch := patch || jsonb_build_object('priceKrw', new_price);
      price_fixed := price_fixed + 1;
    end if;

    if patch <> '{}'::jsonb then
      begin
        r := public.clair_update_order_catalog_item(w, it.id, it.rev, patch);
        changed := changed + 1;
        if jsonb_array_length(samples) < 4 and it.d ? 'stagedInstructions' then
          samples := samples || jsonb_build_object('name', it.name, 'before', left(it.d->>'stagedInstructions', 160), 'after', left(d->>'stagedInstructions', 160));
        end if;
      exception when others then
        failed := failed + 1;
        if jsonb_array_length(errors) < 8 then errors := errors || jsonb_build_object('id', it.id, 'error', sqlerrm); end if;
      end;
    end if;
  end loop;

  out := jsonb_build_object('dry', dry, 'types', p_types, 'changed', changed, 'failed', failed,
    'wordingFixed', wording_fixed, 'priceRounded', price_fixed, 'billingBasisAdded', basis_added,
    'vatPolicy', (select vat_calculation_policy from public.workspace_order_billing_policies where workspace_id = w),
    'remainingTestWording', (select count(*) from public.order_catalog_items c where c.workspace_id = w and c.archived_at is null and c.availability_status = 'active'
        and c.clinical_order_type = any(p_types) and c.default_detail_inputs::text ~ '합성|검증용|데모|SYNTHETIC'),
    'remainingOddPrices', (select count(*) from public.order_catalog_items c where c.workspace_id = w and c.archived_at is null and c.availability_status = 'active'
        and c.clinical_order_type = any(p_types) and c.price_krw % 100 <> 0),
    'errors', errors, 'samples', samples);
  if dry or failed > 0 then
    raise exception 'CLEANUP_ROLLBACK %', out::text;
  end if;
  raise notice 'CLEANUP_APPLIED %', out::text;
end;
$cleanup$;
