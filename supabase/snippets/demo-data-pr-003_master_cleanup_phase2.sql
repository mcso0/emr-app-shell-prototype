-- DEMO-DATA-PR-003 master data cleanup, phase 2 (Cheongdam only).
-- Plan: docs/product/demo-data/cheongdam-demo-realism-plan-v1.md, sections 3.1 and 3.2.
--
--   A. Rewrites the test wording phase 1 left in item-specific fields.
--   B. Pauses the two "합성 …" lab test items left from an early pilot.
--   C. Sets the proposed prices on the core demo items (Gangnam-level assumption).
--   D. Fills the hospital contact (phone, guide memo) through the app RPC, and the
--      address and representative directly: the app only offers a change-request
--      flow for those two fields.
--
-- Catalog edits use clair_update_order_catalog_item as the hospital admin.
-- Keep `dry := true` to preview: the block ends with "CLEANUP2_ROLLBACK {...}"
-- and saves nothing. Set `dry := false` to apply; any failure rolls everything back.

do $cleanup2$
declare
  w constant text := 'workspace-clair-cheongdam';
  owner constant text := '00000000-0000-4000-8000-000000000001';
  admin constant text := '49110000-0000-4000-8000-000000000001';
  pre constant text := 'master-workspace-clair-cheongdam-cm.order.';
  dry constant boolean := true;
  prices constant jsonb := '{
    "consult.first-visit": 22000, "consult.followup": 16500, "synthetic.consultation-01": 55000,
    "synthetic.preventive-01": 33000, "synthetic.preventive-04": 38500, "synthetic.preventive-02": 27500, "v4.preventive.09": 22000,
    "lab.panel.cbc-basic": 44000, "lab.panel.chemistry-basic": 77000, "v4.lab-panel.01": 110000, "synthetic.lab-01": 33000,
    "v4.lab-test.11": 49500, "v4.lab-test.17": 49500, "v4.lab-panel.03": 60500, "lab.panel.urinalysis": 33000, "v4.lab-test.22": 44000,
    "synthetic.lab-10": 22000, "synthetic.lab-11": 22000, "synthetic.lab-12": 55000,
    "imaging.chest-radiography": 55000, "imaging.abdominal-radiography": 55000, "synthetic.imaging-01": 55000, "synthetic.imaging-02": 55000,
    "synthetic.imaging-03": 55000, "v4.imaging.06": 55000, "v4.imaging.07": 55000, "v4.imaging.11": 55000,
    "imaging.abdominal-ultrasound": 110000, "imaging.echocardiography": 187000, "synthetic.imaging-04": 88000, "v4.dental.03": 88000,
    "synthetic.treatment-02": 27500, "synthetic.treatment-01": 66000, "treatment.ear-cleaning": 22000, "v4.treatment.25": 16500,
    "synthetic.dental-02": 330000, "v4.dental.09": 44000, "v4.dental.11": 44000,
    "v4.surgery-anesthesia.01": 275000, "v4.surgery-anesthesia.02": 495000, "v4.surgery-anesthesia.03": 220000, "v4.surgery-anesthesia.04": 385000,
    "v4.surgery-anesthesia.05": 385000, "v4.treatment.10": 165000,
    "synthetic.inpatient-01": 88000, "v4.inpatient.06": 165000
  }'::jsonb;
  it record; d jsonb; v text; patch jsonb; r jsonb; pr record;
  wording int := 0; paused int := 0; priced int := 0; failed int := 0; missing jsonb := '[]'::jsonb; errors jsonb := '[]'::jsonb;
  prof jsonb; out jsonb;
begin
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',admin,true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);

  -- A. remaining test wording
  for it in
    select c.id, c.catalog_revision rev, c.default_detail_inputs d
    from public.order_catalog_items c
    where c.workspace_id = w and c.archived_at is null and c.availability_status = 'active' and c.clinical_order_type <> 'dispensing'
      and c.in_hospital_order_name not like '합성 %'
      and c.default_detail_inputs::text ~ '합성|SIM-'
    order by c.id
  loop
    d := it.d;
    if d->>'deviceProtocol' ~ 'SIM-PAIN' then
      d := jsonb_set(d, '{deviceProtocol}', to_jsonb('병원 통증 평가 체크리스트에 따라 관찰하고 기록한다.'::text));
    elsif d->>'deviceProtocol' ~ 'SIM-' then
      d := jsonb_set(d, '{deviceProtocol}', to_jsonb('병원 표준 프로토콜에 따라 시행한다. 사용 기기와 설정, 점검·관찰 결과를 기록한다.'::text));
    end if;
    if d->>'bodyRegion' ~ '합성' then
      d := jsonb_set(d, '{bodyRegion}', to_jsonb(btrim(regexp_replace(d->>'bodyRegion', '\s*\([^)]*합성[^)]*\)', ''))));
    end if;
    if d->>'imagingProtocol' ~ '합성' then
      d := jsonb_set(d, '{imagingProtocol}', to_jsonb('외부에서 촬영한 CT 영상자료를 검토한다. 검토한 영상 범위와 판독 결과를 기록한다.'::text));
    end if;
    if d->>'method' ~ '합성' then
      d := jsonb_set(d, '{method}', to_jsonb('병원 레이저 프로토콜에 따라 시행'::text));
    end if;
    if d->>'stagedInstructions' ~ '합성' then
      d := jsonb_set(d, '{stagedInstructions}', to_jsonb(replace(d->>'stagedInstructions', '명시된 합성 수기 레이저 프로토콜의 세션을 기록.', '병원 레이저 프로토콜에 따라 세션을 시행하고 기록.')));
    end if;
    if d is distinct from it.d then
      begin
        r := public.clair_update_order_catalog_item(w, it.id, it.rev, jsonb_build_object('defaultDetailInputs', d));
        wording := wording + 1;
      exception when others then
        failed := failed + 1; errors := errors || jsonb_build_object('id', it.id, 'step', 'wording', 'error', sqlerrm);
      end;
    end if;
  end loop;

  -- B. pause pilot lab items named "합성 …"
  for it in
    select c.id, c.catalog_revision rev from public.order_catalog_items c
    where c.workspace_id = w and c.archived_at is null and c.availability_status = 'active' and c.in_hospital_order_name like '합성 %'
  loop
    begin
      r := public.clair_update_order_catalog_item(w, it.id, it.rev, jsonb_build_object('availabilityStatus', 'paused'));
      paused := paused + 1;
    exception when others then
      failed := failed + 1; errors := errors || jsonb_build_object('id', it.id, 'step', 'pause', 'error', sqlerrm);
    end;
  end loop;

  -- C. core prices
  for pr in select key, value::text::integer price from jsonb_each(prices) loop
    select c.id, c.catalog_revision rev, c.price_krw into it from public.order_catalog_items c
      where c.workspace_id = w and c.id = pre || pr.key and c.archived_at is null and c.availability_status = 'active';
    if not found then
      missing := missing || to_jsonb(pr.key);
    elsif it.price_krw is distinct from pr.price then
      begin
        r := public.clair_update_order_catalog_item(w, it.id, it.rev, jsonb_build_object('priceKrw', pr.price));
        priced := priced + 1;
      exception when others then
        failed := failed + 1; errors := errors || jsonb_build_object('id', pr.key, 'step', 'price', 'error', sqlerrm);
      end;
    end if;
  end loop;

  -- D. hospital profile
  begin
    perform set_config('request.jwt.claim.sub',owner,true);
    perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated')::text, true);
    r := public.clair_update_workspace_hospital_contact(w, owner,
      (select revision from public.workspace_hospital_profiles where workspace_id = w),
      jsonb_build_object('phone', '02-6000-0100', 'fax', null, 'homepage', null, 'instagram', null,
        'customerGuideMemo', '진료 예약은 전화 또는 방문으로 가능합니다. 건물 뒤편에 주차 2대가 가능합니다.'),
      'demo-data-pr-003-phase2');
    update public.workspace_hospital_profiles
      set address = '서울특별시 강남구 청담숲길 27, 1–2층', representative_name = '서지훈'
      where workspace_id = w;
  exception when others then
    failed := failed + 1; errors := errors || jsonb_build_object('step', 'profile', 'error', sqlerrm);
  end;
  select to_jsonb(p) - 'created_at' - 'workspace_id' into prof from public.workspace_hospital_profiles p where p.workspace_id = w;

  out := jsonb_build_object('dry', dry, 'wordingFixed', wording, 'paused', paused, 'priced', priced, 'failed', failed,
    'missingPriceTargets', missing, 'errors', errors, 'profile', prof,
    'remainingTestWording', (select count(*) from public.order_catalog_items c where c.workspace_id = w and c.archived_at is null and c.availability_status = 'active'
        and c.clinical_order_type <> 'dispensing' and (c.default_detail_inputs::text ~ '합성|검증용|데모|시나리오|SYNTHETIC|SIM-' or c.in_hospital_order_name ~ '합성')));
  if dry or failed > 0 then
    raise exception 'CLEANUP2_ROLLBACK %', out::text;
  end if;
end;
$cleanup2$;
