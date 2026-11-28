-- CLINICAL-BILLING-PR-025 contract. Run as postgres on a database that has the
-- Cheongdam synthetic workspace and migration 20261128123347 applied. It drives
-- one visit through the app RPCs: an individual consultation order plus the
-- fixed-price order set "요검사 패널", then billing request, issue and payment.
--
-- The block always ends with "SET_PARENT_BILLING_CONTRACT_ROLLBACK {...}" and
-- saves nothing. A failed expectation ends with "SET_PARENT_BILLING_CONTRACT_FAILED".
-- Passed on the hosted demo database on 2026-11-28 after the migration was applied.

do $contract$
declare
  w constant text := 'workspace-clair-cheongdam';
  desk constant text := '49110000-0000-4000-8000-000000000005';
  vet constant text := '49110000-0000-4000-8000-000000000003';
  pat constant uuid := '49121000-0000-4000-8000-000000000008';
  consult constant text := 'master-workspace-clair-cheongdam-cm.order.consult.followup';
  r jsonb; s jsonb; k jsonb; a jsonb; lines jsonb; out jsonb;
  e uuid; c uuid; room text; o_set uuid := gen_random_uuid(); o_one uuid := gen_random_uuid(); inv uuid; ver timestamptz;
  setrow record; cand record; set_price numeric;
begin
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  perform set_config('request.jwt.claim.sub', desk, true);
  r := public.clair_create_reception_walk_in_encounter(w, desk, jsonb_build_object(
    'patientId', pat,
    'guardianId', (select guardian_id from public.patient_guardians where workspace_id = w and patient_id = pat and is_primary and unlinked_at is null limit 1),
    'primaryVeterinarianId', vet, 'plannedStartAt', '2026-10-02T10:00:00+09:00', 'durationMinutes', 30, 'visitPurpose', '검진',
    'vitals', jsonb_build_object('weightKg', 4.6, 'temperatureC', 38.4)));
  e := (r #>> '{encounter,id}')::uuid;

  perform set_config('request.jwt.claim.sub', vet, true);
  select sp.id::text into room
  from public.workspace_spaces sp
  join public.workspace_space_categories ca on ca.id = sp.category_id and ca.workspace_id = sp.workspace_id
  where sp.workspace_id = w and sp.archived_at is null and ca.archived_at is null and ca.icon_key = 'consult'
  order by ca.sort_order, sp.sort_order, sp.name, sp.id limit 1;
  r := public.clair_call_consultation_queue(w, vet, e, room);
  c := (r -> 'chart' ->> 'id')::uuid;

  -- individual order: its candidate must not pick up set values
  s := public.clair_save_chart_order_draft_for_chart(w, vet, e, c, jsonb_build_object(
    'expectedEtag', public.clair_get_chart_order_draft(w, e) ->> 'etag',
    'rows', jsonb_build_array(jsonb_build_object(
      'rowType', 'individual', 'orderId', o_one, 'workspaceCatalogItemId', consult, 'quantity', 1, 'detailSchemaVersion', 2, 'priority', 'normal',
      'detailInputs', jsonb_build_object('responsibleClinicianId', vet, 'occurrenceCount', 1, 'timing', 'now', 'instructionSummary', '재진 진행')))));
  k := public.clair_confirm_chart_order_candidates_with_actual_for_chart(w, vet::uuid, e, c, array[o_one], s ->> 'etag', 'contract-' || o_one, '{}'::jsonb);

  -- fixed-price set billed as one parent line
  select st.id set_id, st.current_revision_id rev_id, rv.revision_no, rv.set_price_krw, rv.tax_type into setrow
  from public.order_sets st join public.order_set_revisions rv on rv.id = st.current_revision_id
  where st.workspace_id = w and st.set_name = '요검사 패널' and st.availability_status = 'active' and rv.amount_basis = 'set_fixed_price';
  if not found then raise exception 'SET_PARENT_BILLING_CONTRACT_FAILED fixture set missing'; end if;
  set_price := setrow.set_price_krw;
  s := public.clair_save_chart_order_draft_for_chart(w, vet, e, c, jsonb_build_object(
    'expectedEtag', public.clair_get_chart_order_draft(w, e) ->> 'etag',
    'rows', jsonb_build_array(jsonb_build_object(
      'rowType', 'set', 'orderId', o_set, 'sourceSetId', setrow.set_id, 'sourceSetRevisionId', setrow.rev_id, 'sourceSetRevisionNo', setrow.revision_no,
      'selectionIntent', jsonb_build_object('items', (
        select jsonb_agg(jsonb_build_object('revisionItemId', i.id, 'selected', true, 'quantity', 1) order by i.sort_order)
        from public.order_set_revision_items i where i.order_set_id = setrow.set_id and i.revision_id = setrow.rev_id)),
      'detailInputs', '{}'::jsonb, 'detailSchemaVersion', 1, 'priority', 'normal',
      'childInputs', (
        select jsonb_agg(jsonb_build_object('revisionItemId', i.id, 'detailInputs', ci.default_detail_inputs - 'planOrderAuthority',
          'detailSchemaVersion', ci.detail_schema_version, 'priority', 'normal') order by i.sort_order)
        from public.order_set_revision_items i
        join public.order_catalog_items ci on ci.workspace_id = w and ci.id = i.child_order_catalog_item_id
        where i.order_set_id = setrow.set_id and i.revision_id = setrow.rev_id)))));
  k := public.clair_confirm_chart_order_candidates_with_actual_for_chart(w, vet::uuid, e, c, array[o_set], s ->> 'etag', 'contract-' || o_set, '{}'::jsonb);

  select * into cand from public.order_billing_candidates where workspace_id = w and order_id = o_set;
  if cand.price_basis_snapshot is distinct from 'fixed_set' or cand.billing_unit_snapshot is distinct from 'set'
    or cand.set_billing_owner_snapshot is distinct from 'parent' or cand.set_amount_strategy_snapshot is distinct from 'fixed_set'
    or cand.tax_class_snapshot is distinct from setrow.tax_type or cand.amount is distinct from set_price then
    raise exception 'SET_PARENT_BILLING_CONTRACT_FAILED set candidate %', to_jsonb(cand) - 'source_snapshot';
  end if;
  select * into cand from public.order_billing_candidates where workspace_id = w and order_id = o_one;
  if cand.set_billing_owner_snapshot is not null or cand.set_amount_strategy_snapshot is not null
    or cand.price_basis_snapshot is not distinct from 'fixed_set' or cand.billing_unit_snapshot is not distinct from 'set' then
    raise exception 'SET_PARENT_BILLING_CONTRACT_FAILED individual candidate %', to_jsonb(cand) - 'source_snapshot';
  end if;
  if exists (select 1 from public.order_billing_candidates bc join public.orders od on od.id = bc.order_id
             where bc.workspace_id = w and bc.encounter_id = e and od.row_type = 'set_child') then
    raise exception 'SET_PARENT_BILLING_CONTRACT_FAILED set members must not be billed separately';
  end if;

  perform public.clair_sign_encounter_chart(w, vet, e, c, (select updated_at from public.soap_notes where id = c), 'contract-sign');
  s := public.clair_get_chart_order_billing_summary(w, e);
  r := public.clair_request_selected_chart_order_billing(w, vet::uuid, e, s ->> 'etag', 'contract-bill-' || e::text,
    array(select x::uuid from jsonb_array_elements_text(s -> 'requestableOrderIds') x order by 1), true);
  inv := (r ->> 'invoiceId')::uuid;
  if (select count(*) from public.invoice_lines l where l.invoice_id = inv and l.order_id = o_set and l.line_total = set_price) <> 1
    or (select count(*) from public.invoice_lines l where l.invoice_id = inv) <> 2 then
    raise exception 'SET_PARENT_BILLING_CONTRACT_FAILED invoice lines %',
      (select jsonb_agg(jsonb_build_object('name', l.billing_name_snapshot, 'total', l.line_total)) from public.invoice_lines l where l.invoice_id = inv);
  end if;
  r := public.clair_complete_chart(w, vet, e);

  perform set_config('request.jwt.claim.sub', desk, true);
  a := public.clair_get_billing_assignment(w, inv);
  a := public.clair_change_billing_assignment(w, inv, 'claim', (a ->> 'revision')::bigint);
  r := public.clair_get_billing_invoice_lines(w, inv);
  select coalesce(jsonb_agg(jsonb_build_object('invoiceLineId', l ->> 'id', 'quantity', (l ->> 'quantity')::numeric)), '[]')
    into lines from jsonb_array_elements(r -> 'lines') l;
  r := public.clair_save_billing_invoice_lines(w, desk::uuid, inv, lines, true);
  ver := (public.clair_get_billing_payment_status(w, inv) -> 'invoice' ->> 'updatedAt')::timestamptz;
  r := public.clair_transition_billing_invoice_status(w, desk::uuid, inv, 'paid', 'card', '보호자 수납 완료', ver);
  ver := (r -> 'invoice' ->> 'updatedAt')::timestamptz;
  r := public.clair_save_billing_payment_status(w, desk::uuid, inv, 'complete_payment', 'card', null, ver);

  select jsonb_build_object('encounter', en.status, 'invoice', i.status, 'total', i.total_amount, 'setPrice', set_price) into out
  from public.encounters en join public.invoices i on i.encounter_id = en.id where en.id = e;
  if out ->> 'encounter' <> 'completed' or out ->> 'invoice' <> 'paid' then
    raise exception 'SET_PARENT_BILLING_CONTRACT_FAILED final state %', out;
  end if;
  raise exception 'SET_PARENT_BILLING_CONTRACT_ROLLBACK passed %', out;
end;
$contract$;
