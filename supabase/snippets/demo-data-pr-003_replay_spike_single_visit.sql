-- DEMO-DATA-PR-003 replay spike. One Cheongdam visit driven through the app's
-- own RPCs, from reception to a paid invoice. Verified on the hosted demo DB on
-- 2026-11-28. The block ALWAYS ends with "REPLAY_ROLLBACK {...}", so nothing is
-- saved; the message carries the outcome of each stage.
--
-- Notes for the real replay:
--   * Staff are impersonated with request.jwt.claim.sub; every RPC checks it.
--   * Only reception accepts a past time (plannedStartAt). Other timestamps are
--     now() and need a later backdating pass.
--   * The two "test-only settings" are missing on hosted today. Billing fails
--     without them (billing_authority_incomplete, vat_calculation_policy_missing).
--   * Lab/imaging: an unassigned work item is claimed, which also starts it.
--     Imaging completes by recording the execution result; do not call complete.
--   * Sign the chart after orders and diagnoses, then request billing, then
--     complete the chart. Only complete_payment sets encounters.status=completed.

do $replay$
declare
  w constant text := 'workspace-clair-cheongdam';
  desk constant text := '49110000-0000-4000-8000-000000000005'; desku constant uuid := desk::uuid;
  vet constant text := '49110000-0000-4000-8000-000000000003'; vetu constant uuid := vet::uuid;
  pat constant uuid := '49121000-0000-4000-8000-000000000008';
  cat constant text := 'master-workspace-clair-cheongdam-cm.order.';
  r jsonb; out jsonb := '{}'::jsonb; e uuid; chart jsonb; c uuid; room text; doc jsonb; st jsonb; step text := 'init';
  o uuid; s jsonb; k jsonb; wi uuid; rev bigint; ctx jsonb; ent jsonb; rws jsonb; d jsonb; inv uuid; a jsonb; lines jsonb; ver timestamptz;
begin
  -- test-only settings (rolled back with everything else)
  begin
    update public.order_catalog_items
      set default_detail_inputs = default_detail_inputs || jsonb_build_object('planOrderAuthority', jsonb_build_object('schemaVersion',1,'calculationMode','not_applicable','priceBasis','per_order','billingUnit','session','taxClass','taxable')),
          default_detail_input_policies = coalesce(default_detail_input_policies,'{}'::jsonb) || jsonb_build_object('planOrderAuthority','workspace_resolved')
      where workspace_id=w and id in (cat||'consult.followup', cat||'lab.panel.cbc-basic', cat||'imaging.abdominal-ultrasound', cat||'synthetic.treatment-02');
    insert into public.workspace_order_billing_policies(workspace_id, vat_calculation_policy) values (w,'vat_included')
      on conflict (workspace_id) do update set vat_calculation_policy = excluded.vat_calculation_policy;
  exception when others then out := out || jsonb_build_object('settingsPatchError', sqlerrm); end;

  perform set_config('request.jwt.claim.role','authenticated',true);
  begin
    step := 'reception';
    perform set_config('request.jwt.claim.sub',desk,true);
    perform set_config('request.jwt.claims', json_build_object('sub', desk, 'role', 'authenticated')::text, true);
    r := public.clair_create_reception_walk_in_encounter(w, desk, jsonb_build_object(
      'patientId',pat,'guardianId',(select guardian_id from public.patient_guardians where workspace_id=w and patient_id=pat and is_primary and unlinked_at is null limit 1),
      'primaryVeterinarianId',vet,'plannedStartAt','2026-10-02T10:00:00+09:00','durationMinutes',30,'visitPurpose','노령묘 정기 검진',
      'vitals',jsonb_build_object('weightKg',4.6,'temperatureC',38.4,'heartRateBpm',180,'respiratoryRateRpm',28)));
    e := (r#>>'{encounter,id}')::uuid;
    step := 'call';
    perform set_config('request.jwt.claim.sub',vet,true);
    perform set_config('request.jwt.claims', json_build_object('sub', vet, 'role', 'authenticated')::text, true);
    select s2.id::text into room from public.workspace_spaces s2 join public.workspace_space_categories c2 on c2.id=s2.category_id and c2.workspace_id=s2.workspace_id
      where s2.workspace_id=w and s2.archived_at is null and c2.archived_at is null and c2.icon_key='consult' order by c2.sort_order, s2.sort_order, s2.name, s2.id limit 1;
    r := public.clair_call_consultation_queue(w, vet, e, room);
    chart := r->'chart'; c := (chart->>'id')::uuid;
    step := 'soap';
    doc := jsonb_build_object('schemaVersion',2,'scopes',jsonb_build_array(jsonb_build_object('scopeKey','default','scope','default','systemLabel','기본 SOAP','blocks',
      (select jsonb_agg(jsonb_build_object('id','sec-'||kk,'type','soapSection','props',jsonb_build_object('kind',kk,'label',lbl,'systemLabel','기본 SOAP','scope','default'),
         'children',jsonb_build_array(jsonb_build_object('id','p-'||kk,'type','paragraph','props',jsonb_build_object('backgroundColor','default','textColor','default','textAlignment','left'),
           'content',jsonb_build_array(jsonb_build_object('type','text','text',txt,'styles','{}'::jsonb)),'children','[]'::jsonb))) order by ord)
       from (values (1,'subjective','주관적 · 보호자 진술','물을 많이 마심.'),(2,'objective','객관적 · 신체검사 소견','체중 4.6kg. 경도 탈수.'),
                    (3,'assessment','평가 · 임상 판단','만성 신장질환 의심.'),(4,'plan','계획 · 치료 및 추적','혈액검사 진행.')) v(ord,kk,lbl,txt)))));
    chart := public.clair_save_chart_soap_note_v4(w, vet, e, c, jsonb_build_object('blockDocument',doc,'subjective','물을 많이 마심.','objective','체중 4.6kg. 경도 탈수.','assessment','만성 신장질환 의심.','plan','혈액검사 진행.'),
      (chart->>'updatedAt')::timestamptz, 'manual_save', 'replay-soap-1', null);
    step := 'diagnoses';
    st := public.clair_get_chart_diagnosis_assessments(w, e, c);
    r := public.clair_save_chart_diagnoses_v2(w, vet, e, c, jsonb_build_array(jsonb_build_object('diagnosisText','고양이 만성 신장질환 의심','diagnosisType','suspected','isPrimary',true,'isClosed',false,'sortOrder',0)), st->>'version', null);
  exception when others then
    raise exception 'REPLAY_ROLLBACK %', (out || jsonb_build_object('failedStep', step, 'error', sqlerrm))::text;
  end;

  -- consultation: confirm, then record the chart actual result
  begin
    o := gen_random_uuid();
    s := public.clair_save_chart_order_draft_for_chart(w, vet, e, c, jsonb_build_object('expectedEtag', public.clair_get_chart_order_draft(w,e)->>'etag','rows', jsonb_build_array(jsonb_build_object(
      'rowType','individual','orderId',o,'workspaceCatalogItemId',cat||'consult.followup','quantity',1,'detailSchemaVersion',2,'priority','normal',
      'detailInputs', jsonb_build_object('responsibleClinicianId',vet,'occurrenceCount',1,'timing','now','instructionSummary','재진 진행')))));
    k := public.clair_confirm_chart_order_candidates_with_actual_for_chart(w, vetu, e, c, array[o], s->>'etag', 'replay-'||o, '{}'::jsonb);
    ctx := public.clair_get_chart_actual_context(w, (k#>>'{tasks,0,taskId}')::uuid);
    perform public.clair_record_chart_actual_result(w, vetu, (k#>>'{tasks,0,taskId}')::uuid, ctx->>'planSha256', gen_random_uuid(), now(), '{"performedActivity":"문진과 신체검사 시행","outcome":"노령묘 정기 검진 진행"}'::jsonb, true);
  exception when others then out := out || jsonb_build_object('consultError', sqlerrm); end;

  -- lab: claim (starts), enter values, complete
  begin
    o := gen_random_uuid();
    s := public.clair_save_chart_order_draft_for_chart(w, vet, e, c, jsonb_build_object('expectedEtag', public.clair_get_chart_order_draft(w,e)->>'etag','rows', jsonb_build_array(jsonb_build_object(
      'rowType','individual','orderId',o,'workspaceCatalogItemId',cat||'lab.panel.cbc-basic','quantity',1,'detailSchemaVersion',1,'priority','normal',
      'detailInputs', jsonb_build_object('testPanel','전혈구 기본 패널','specimenType','blood','collectionCondition','병원 표준 검체 채취 절차 확인 후 채취')))));
    k := public.clair_confirm_chart_order_candidates_with_actual_for_chart(w, vetu, e, c, array[o], s->>'etag', 'replay-'||o, '{}'::jsonb);
    select id,row_revision into wi,rev from public.order_fulfillment_work_items where workspace_id=w and order_id=o;
    perform public.clair_transition_fulfillment_work_item(w, vetu, wi, 'claim', rev, gen_random_uuid(), null, null, null);
    perform public.clair_save_chart_order_lifecycle(w, vetu, e, o, 'in_progress', null);
    ent := public.clair_get_lab_result_entry(w, vetu, null, wi, o);
    select jsonb_agg(jsonb_build_object('rowId',x->>'id','value',case x->>'analyteName' when '백혈구 수' then '9.8' when '헤마토크릿' then '31.5' else '245' end,'note',null)) into rws from jsonb_array_elements(ent->'rows') x;
    perform public.clair_save_lab_result_entry_v2(w, vetu, ent->>'resultId', e, o, wi, (ent->>'entryWriteRevision')::int, gen_random_uuid(), rws);
    select row_revision into rev from public.order_fulfillment_work_items where id=wi;
    perform public.clair_transition_fulfillment_work_item(w, vetu, wi, 'complete', rev, gen_random_uuid(), null, null, null);
    perform public.clair_save_chart_order_lifecycle(w, vetu, e, o, 'completed', null);
  exception when others then out := out || jsonb_build_object('labError', sqlerrm); end;

  -- imaging: claim (starts), record the execution result (auto-completes)
  begin
    o := gen_random_uuid();
    s := public.clair_save_chart_order_draft_for_chart(w, vet, e, c, jsonb_build_object('expectedEtag', public.clair_get_chart_order_draft(w,e)->>'etag','rows', jsonb_build_array(jsonb_build_object(
      'rowType','individual','orderId',o,'workspaceCatalogItemId',cat||'imaging.abdominal-ultrasound','quantity',1,'detailSchemaVersion',1,'priority','normal',
      'detailInputs', jsonb_build_object('bodyRegion','복부','position','등쪽 또는 측면','viewCount',1,'contrastRequired',false,'sedationRequired',false,'imagingProtocol','복부 초음파 표준 프로토콜')))));
    k := public.clair_confirm_chart_order_candidates_with_actual_for_chart(w, vetu, e, c, array[o], s->>'etag', 'replay-'||o, '{}'::jsonb);
    select id,row_revision into wi,rev from public.order_fulfillment_work_items where workspace_id=w and order_id=o;
    perform public.clair_transition_fulfillment_work_item(w, vetu, wi, 'claim', rev, gen_random_uuid(), null, null, null);
    perform public.clair_save_chart_order_lifecycle(w, vetu, e, o, 'in_progress', null);
    ctx := public.clair_get_order_execution_context(w, wi, null);
    perform public.clair_record_order_execution_result(w, vetu, wi, (ctx->>'workItemRevision')::bigint, ctx->>'planSha256', 0, gen_random_uuid(), now(),
      '{"acquisitionDisposition":"acquired_new","acquiredViews":["복부 장축"],"performedProtocol":"복부 초음파 표준 프로토콜","quality":"diagnostic","findings":"양측 신장 피질 에코 증가.","interpretation":"만성 신장 변화에 합당."}'::jsonb, null, null);
  exception when others then out := out || jsonb_build_object('imagingError', sqlerrm); end;

  -- treatment: instruction claim with startWork, then complete
  begin
    o := gen_random_uuid();
    s := public.clair_save_chart_order_draft_for_chart(w, vet, e, c, jsonb_build_object('expectedEtag', public.clair_get_chart_order_draft(w,e)->>'etag','rows', jsonb_build_array(jsonb_build_object(
      'rowType','individual','orderId',o,'workspaceCatalogItemId',cat||'synthetic.treatment-02','quantity',1,'detailSchemaVersion',3,'priority','normal',
      'detailInputs', jsonb_build_object('procedureKind','administration','method','피하 주입','plannedProcedureCount',1,'procedureCountUnit','session','frequency','once','schedule','진료 중 1회',
        'administrationPolicy','direct_quantity','plannedAmount',100,'plannedAmountUnit','mL','productReference','하트만 수액','plannedRoute','SC','site','견갑 사이 피하','stagedInstructions','수액 100mL 피하 주입','exceptions','주입부 부종 지속 시 보고')))));
    k := public.clair_confirm_chart_order_candidates_with_actual_for_chart(w, vetu, e, c, array[o], s->>'etag', 'replay-'||o, '{}'::jsonb);
    select id into wi from public.order_fulfillment_work_items where workspace_id=w and order_id=o;
    d := public.clair_get_fulfillment_instruction(w, wi);
    d := public.clair_mutate_fulfillment_instruction(w, wi, jsonb_build_object('action','claim','startWork',true,'commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
    d := public.clair_mutate_fulfillment_instruction(w, wi, jsonb_build_object('action','complete','itemId',wi,'commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
  exception when others then out := out || jsonb_build_object('treatmentError', sqlerrm); end;

  -- sign, request billing, complete chart, then front desk claims and takes payment
  begin
    step := 'sign';
    chart := public.clair_sign_encounter_chart(w, vet, e, c, (select updated_at from public.soap_notes where id=c), 'replay-sign-1');
    step := 'billing.request';
    s := public.clair_get_chart_order_billing_summary(w, e);
    r := public.clair_request_selected_chart_order_billing(w, vetu, e, s->>'etag', 'replay-bill-'||e::text,
      array(select x::uuid from jsonb_array_elements_text(s->'requestableOrderIds') x order by 1), jsonb_array_length(s->'unfinishedOrders')>0);
    inv := (r->>'invoiceId')::uuid;
    step := 'complete_chart';
    r := public.clair_complete_chart(w, vet, e);
    step := 'billing.claim';
    perform set_config('request.jwt.claim.sub',desk,true);
    perform set_config('request.jwt.claims', json_build_object('sub', desk, 'role', 'authenticated')::text, true);
    a := public.clair_get_billing_assignment(w, inv);
    a := public.clair_change_billing_assignment(w, inv, 'claim', (a->>'revision')::bigint);
    step := 'billing.issue';
    r := public.clair_get_billing_invoice_lines(w, inv);
    select coalesce(jsonb_agg(jsonb_build_object('invoiceLineId',l->>'id','quantity',(l->>'quantity')::numeric)),'[]') into lines from jsonb_array_elements(r->'lines') l;
    r := public.clair_save_billing_invoice_lines(w, desku, inv, lines, true);
    step := 'billing.paid';
    ver := (public.clair_get_billing_payment_status(w, inv)->'invoice'->>'updatedAt')::timestamptz;
    r := public.clair_transition_billing_invoice_status(w, desku, inv, 'paid', 'card', '보호자 수납 완료', ver);
    step := 'billing.complete_payment';
    ver := (r->'invoice'->>'updatedAt')::timestamptz;
    r := public.clair_save_billing_payment_status(w, desku, inv, 'complete_payment', 'card', null, ver);
    out := out || jsonb_build_object('final', (select jsonb_build_object('encounter', en.status, 'invoice', i.status, 'total', i.total_amount, 'lines', (select count(*) from public.invoice_lines l where l.invoice_id=i.id), 'payments', (select count(*) from public.payments p where p.invoice_id=i.id))
      from public.encounters en join public.invoices i on i.encounter_id=en.id where en.id=e limit 1));
    perform set_config('request.jwt.claim.sub',vet,true);
    perform set_config('request.jwt.claims', json_build_object('sub', vet, 'role', 'authenticated')::text, true);
    out := out || jsonb_build_object('search', (select jsonb_build_object('status',x->>'status','orders',(select jsonb_agg(oo->>'name') from jsonb_array_elements(x->'orders') oo),'taskStatuses',x->'taskStatuses') from jsonb_array_elements(public.clair_advanced_chart_search_batch(w, p_ids=>array[c])) x));
  exception when others then out := out || jsonb_build_object('closingError', step||': '||sqlerrm); end;

  raise exception 'REPLAY_ROLLBACK %', out::text;
end;
$replay$;
