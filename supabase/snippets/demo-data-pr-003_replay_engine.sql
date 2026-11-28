-- DEMO-DATA-PR-003 replay engine (Cheongdam only). TEMPORARY helper functions.
--
-- One past visit is created the way the app does it: reception -> call ->
-- SOAP -> diagnoses -> orders -> execution -> sign -> billing -> payment, all
-- through the public clair_* RPCs while impersonating the seed staff. The rows
-- are ordinary clinical rows, so chart search, filters and history treat them
-- like any other chart.
--
-- After each stage the timestamps written by this transaction are moved to the
-- visit time (reception = visit time, consultation +7 min, chart done +28 min,
-- payment +36 min). Triggers are disabled only for that timestamp move.
--
-- Keep batches small: 4 visits per call, one call at a time. On the Free-plan
-- instance one call with 16 visits ran past the statement timeout and the
-- database stopped accepting connections until it was restarted.
-- Run as postgres. Do not use the Cheongdam workspace in the app while a batch
-- runs: the timestamp move covers every row written in the batch window.
-- Functions are executable by postgres only. Drop them when the seed is done:
--   drop function private.clair_demo_replay_batch(jsonb, boolean);
--   drop function private.clair_demo_replay_visit(jsonb);
--   drop function private.clair_demo_replay_shift(timestamptz, timestamptz, uuid);
--   drop function private.clair_demo_replay_as(text);

create or replace function private.clair_demo_replay_as(p_user text)
returns void language plpgsql set search_path = '' as $fn$
begin
  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  perform pg_catalog.set_config('request.jwt.claim.sub', p_user, true);
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $fn$;

create or replace function private.clair_demo_replay_shift(p_t0 timestamptz, p_target timestamptz, p_chart uuid)
returns integer language plpgsql set search_path = '' as $fn$
declare
  w constant text := 'workspace-clair-cheongdam';
  lo constant timestamptz := p_t0 - interval '1 second';
  hi constant timestamptz := pg_catalog.clock_timestamp() + interval '1 second';
  delta constant interval := p_t0 - p_target;
  tbl record; n integer; total integer := 0;
begin
  -- Timestamp columns of workspace-scoped tables, listed once per transaction.
  if pg_catalog.to_regclass('pg_temp.clair_demo_replay_cols') is null then
    create temporary table clair_demo_replay_cols on commit drop as
      select c1.table_schema::text as table_schema, c1.table_name::text as table_name, c1.column_name::text as column_name
      from information_schema.columns c1
      where c1.table_schema in ('public', 'private') and c1.data_type = 'timestamp with time zone' and c1.is_generated = 'NEVER'
        and exists (select 1 from information_schema.columns c2
                    where c2.table_schema = c1.table_schema and c2.table_name = c1.table_name and c2.column_name = 'workspace_id');
  end if;
  set local session_replication_role = replica;
  -- Only tables this transaction wrote to are touched.
  for tbl in
    select pg_catalog.format('%I.%I', st.schemaname, st.relname) as name,
      pg_catalog.string_agg(pg_catalog.format('%1$I = case when %1$I between %2$L and %3$L then %1$I - %4$L::interval else %1$I end', c1.column_name, lo, hi, delta), ', ') as sets,
      pg_catalog.string_agg(pg_catalog.format('%I between %L and %L', c1.column_name, lo, hi), ' or ') as conds
    from pg_catalog.pg_stat_xact_user_tables st
    join pg_temp.clair_demo_replay_cols c1 on c1.table_schema = st.schemaname and c1.table_name = st.relname
    where st.schemaname in ('public', 'private') and st.n_tup_ins + st.n_tup_upd > 0
    group by 1
  loop
    execute pg_catalog.format('update %s set %s where workspace_id = %L and (%s)', tbl.name, tbl.sets, w, tbl.conds);
    get diagnostics n = row_count;
    total := total + n;
  end loop;
  if p_chart is not null then
    update private.chart_content_edits ce set edited_at = ce.edited_at - delta
      where ce.chart_id = p_chart and ce.edited_at between lo and hi;
  end if;
  set local session_replication_role = origin;
  return total;
end $fn$;

-- Visit fields: pat, vet (uuid), at (timestamptz), purpose (the reception RPC stores it as both
-- visit_purpose and chief_complaint, like the reception form), vit {weightKg, temperatureC, ...},
-- S/O/A/P, dx [[text, kind]], draft (bool), pay, orders [
--   {id: "<catalog id suffix>", did?, out?, in?, inputs?}   individual order (in = merge into catalog defaults, inputs = replace)
--   {set: "<order set name>", vals?: {analyte: value}}
--   {rx: "<hospital drug name>", days?}
--   imaging rows may carry views, find, interp ]
create or replace function private.clair_demo_replay_visit(v jsonb)
returns jsonb language plpgsql set search_path = '' as $fn$
declare
  w constant text := 'workspace-clair-cheongdam';
  desk constant text := '49110000-0000-4000-8000-000000000005';
  pre constant text := 'master-workspace-clair-cheongdam-cm.order.';
  vet constant text := v->>'vet';
  vetu constant uuid := (v->>'vet')::uuid;
  pat constant uuid := (v->>'pat')::uuid;
  t_visit constant timestamptz := (v->>'at')::timestamptz;
  t_work constant timestamptz := (v->>'at')::timestamptz + interval '20 minutes';
  t0 constant timestamptz := pg_catalog.transaction_timestamp();
  pay constant text := coalesce(v->>'pay', 'card');
  r jsonb; s jsonb; k jsonb; d jsonb; ent jsonb; ctx jsonb; a jsonb; chart jsonb; doc jsonb; st jsonb; lines jsonb; rws jsonb;
  e uuid; c uuid; o uuid; inv uuid; room text; ver timestamptz; rev bigint;
  ord jsonb; t jsonb; di jsonb; ci record; setrow record; wi record;
  order_rows jsonb := '[]'::jsonb; ids uuid[] := '{}'; spec jsonb := '{}'::jsonb; warn jsonb := '[]'::jsonb; step text := 'init';
begin
  if t_visit > t0 - interval '2 hours' then raise exception 'replay_visit_must_be_past'; end if;
  if exists (select 1 from public.encounters en where en.workspace_id = w and en.patient_id = pat
             and en.checked_in_at between t_visit - interval '1 minute' and t_visit + interval '10 minutes') then
    return pg_catalog.jsonb_build_object('at', v->>'at', 'skipped', true);
  end if;

  begin
    step := 'reception';
    perform private.clair_demo_replay_as(desk);
    r := public.clair_create_reception_walk_in_encounter(w, desk, pg_catalog.jsonb_build_object(
      'patientId', pat,
      'guardianId', (select pg.guardian_id from public.patient_guardians pg
                     where pg.workspace_id = w and pg.patient_id = pat and pg.is_primary and pg.unlinked_at is null limit 1),
      'primaryVeterinarianId', vet, 'plannedStartAt', v->>'at', 'durationMinutes', 30,
      'visitPurpose', v->>'purpose', 'vitals', v->'vit'));
    e := (r #>> '{encounter,id}')::uuid;
    perform private.clair_demo_replay_shift(t0, t_visit, null);

    step := 'call';
    perform private.clair_demo_replay_as(vet);
    select x.id into room from (
      select sp.id::text as id, pg_catalog.row_number() over (order by ca.sort_order, sp.sort_order, sp.name, sp.id) as rn, pg_catalog.count(*) over () as cnt
      from public.workspace_spaces sp
      join public.workspace_space_categories ca on ca.id = sp.category_id and ca.workspace_id = sp.workspace_id
      where sp.workspace_id = w and sp.archived_at is null and ca.archived_at is null and ca.icon_key = 'consult') x
    where x.rn = 1 + pg_catalog.abs(pg_catalog.hashtext(vet)) % x.cnt;
    r := public.clair_call_consultation_queue(w, vet, e, room);
    chart := r -> 'chart';
    c := (chart ->> 'id')::uuid;

    step := 'soap';
    doc := pg_catalog.jsonb_build_object('schemaVersion', 2, 'scopes', pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'scopeKey', 'default', 'scope', 'default', 'systemLabel', '기본 SOAP', 'blocks',
      (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', 'sec-' || x.kk, 'type', 'soapSection',
          'props', pg_catalog.jsonb_build_object('kind', x.kk, 'label', x.lbl, 'systemLabel', '기본 SOAP', 'scope', 'default'),
          'children', pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id', 'p-' || x.kk, 'type', 'paragraph',
            'props', pg_catalog.jsonb_build_object('backgroundColor', 'default', 'textColor', 'default', 'textAlignment', 'left'),
            'content', pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('type', 'text', 'text', x.txt, 'styles', '{}'::jsonb)),
            'children', '[]'::jsonb))) order by x.ord)
       from (values (1, 'subjective', '주관적 · 보호자 진술', v->>'S'), (2, 'objective', '객관적 · 신체검사 소견', v->>'O'),
                    (3, 'assessment', '평가 · 임상 판단', v->>'A'), (4, 'plan', '계획 · 치료 및 추적', v->>'P')) x(ord, kk, lbl, txt)))));
    chart := public.clair_save_chart_soap_note_v4(w, vet, e, c,
      pg_catalog.jsonb_build_object('blockDocument', doc, 'subjective', v->>'S', 'objective', v->>'O', 'assessment', v->>'A', 'plan', v->>'P'),
      (chart ->> 'updatedAt')::timestamptz, 'manual_save', 'replay-soap-' || e, null);

    step := 'diagnoses';
    st := public.clair_get_chart_diagnosis_assessments(w, e, c);
    r := public.clair_save_chart_diagnoses_v2(w, vet, e, c,
      (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('diagnosisText', x.dx ->> 0, 'diagnosisType', x.dx ->> 1,
          'isPrimary', x.i = 1, 'isClosed', false, 'sortOrder', x.i - 1) order by x.i)
       from pg_catalog.jsonb_array_elements(v -> 'dx') with ordinality x(dx, i)), st ->> 'version', null);
    perform private.clair_demo_replay_shift(t0, t_visit + interval '7 minutes', c);

    if coalesce((v ->> 'draft')::boolean, false) then
      return pg_catalog.jsonb_build_object('at', v->>'at', 'encounter', e, 'chart', c, 'status', 'draft');
    end if;

    step := 'orders.draft';
    for ord in select * from pg_catalog.jsonb_array_elements(v -> 'orders') loop
      o := pg_catalog.gen_random_uuid();
      ids := ids || o;
      spec := spec || pg_catalog.jsonb_build_object(o::text, ord);
      if ord ? 'set' then
        select os.id as set_id, os.current_revision_id as rev_id, rv.revision_no into setrow
        from public.order_sets os join public.order_set_revisions rv on rv.id = os.current_revision_id
        where os.workspace_id = w and os.set_name = ord ->> 'set' and os.availability_status = 'active';
        if not found then raise exception 'replay_set_missing %', ord ->> 'set'; end if;
        order_rows := order_rows || pg_catalog.jsonb_build_object('rowType', 'set', 'orderId', o, 'sourceSetId', setrow.set_id,
          'sourceSetRevisionId', setrow.rev_id, 'sourceSetRevisionNo', setrow.revision_no,
          'selectionIntent', pg_catalog.jsonb_build_object('items', (
            select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('revisionItemId', i.id, 'selected', true, 'quantity', 1) order by i.sort_order)
            from public.order_set_revision_items i where i.order_set_id = setrow.set_id and i.revision_id = setrow.rev_id)),
          'detailInputs', '{}'::jsonb, 'detailSchemaVersion', 1, 'priority', 'normal',
          'childInputs', (
            select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('revisionItemId', i.id, 'detailInputs', ci2.default_detail_inputs - 'planOrderAuthority',
              'detailSchemaVersion', ci2.detail_schema_version, 'priority', 'normal') order by i.sort_order)
            from public.order_set_revision_items i
            join public.order_catalog_items ci2 on ci2.workspace_id = w and ci2.id = i.child_order_catalog_item_id
            where i.order_set_id = setrow.set_id and i.revision_id = setrow.rev_id));
      else
        if ord ? 'rx' then
          select x.* into ci from public.order_catalog_items x
          where x.workspace_id = w and x.origin_type = 'workspace_custom' and x.clinical_order_type = 'dispensing'
            and x.availability_status = 'active' and x.in_hospital_order_name = ord ->> 'rx';
        else
          select x.* into ci from public.order_catalog_items x
          where x.workspace_id = w and x.availability_status = 'active' and x.id = pre || (ord ->> 'id');
        end if;
        if not found then raise exception 'replay_item_missing %', ord; end if;
        di := coalesce(ord -> 'inputs', (ci.default_detail_inputs - 'planOrderAuthority') || coalesce(ord -> 'in', '{}'::jsonb));
        if ci.clinical_order_type = 'consultation' then
          di := di || pg_catalog.jsonb_build_object('responsibleClinicianId', vet);
        end if;
        if ord ? 'rx' and ord ? 'days' and di ->> 'frequency' <> 'once' then
          di := di || pg_catalog.jsonb_build_object('durationDays', (ord ->> 'days')::numeric,
            'totalQuantity', (di ->> 'dose')::numeric * (case di ->> 'frequency' when 'bid' then 2 when 'tid' then 3 when 'qid' then 4 else 1 end) * (ord ->> 'days')::numeric);
        end if;
        order_rows := order_rows || pg_catalog.jsonb_build_object('rowType', 'individual', 'orderId', o, 'workspaceCatalogItemId', ci.id,
          'quantity', 1, 'detailSchemaVersion', ci.detail_schema_version, 'priority', 'normal', 'detailInputs', di);
      end if;
    end loop;
    s := public.clair_save_chart_order_draft_for_chart(w, vet, e, c,
      pg_catalog.jsonb_build_object('expectedEtag', public.clair_get_chart_order_draft(w, e) ->> 'etag', 'rows', order_rows));
    step := 'orders.confirm';
    k := public.clair_confirm_chart_order_candidates_with_actual_for_chart(w, vetu, e, c, ids, s ->> 'etag', 'replay-' || e, '{}'::jsonb);

    step := 'execute.actual';
    for t in select * from pg_catalog.jsonb_array_elements(k -> 'tasks') loop
      if exists (select 1 from public.orders od where od.id = (t ->> 'orderId')::uuid and od.row_type = 'individual' and od.destination_module is null) then
        ord := spec -> (t ->> 'orderId');
        ctx := public.clair_get_chart_actual_context(w, (t ->> 'taskId')::uuid);
        perform public.clair_record_chart_actual_result(w, vetu, (t ->> 'taskId')::uuid, ctx ->> 'planSha256', pg_catalog.gen_random_uuid(), t_work,
          pg_catalog.jsonb_build_object('performedActivity', coalesce(ord ->> 'did', '문진과 신체검사 시행'), 'outcome', coalesce(ord ->> 'out', v ->> 'A')), true);
      end if;
    end loop;

    step := 'execute.work';
    for wi in
      select f.id, f.order_id, f.row_revision, f.destination_module, od.detail_inputs, coalesce(od.parent_chart_order_line_id, od.id) as root_id
      from public.order_fulfillment_work_items f join public.orders od on od.id = f.order_id
      where f.workspace_id = w and f.encounter_id = e order by f.created_at, f.id
    loop
      ord := coalesce(spec -> wi.root_id::text, '{}'::jsonb);
      step := 'execute.' || coalesce(wi.destination_module, 'none');
      if wi.destination_module = 'lab' then
        perform public.clair_transition_fulfillment_work_item(w, vetu, wi.id, 'claim', wi.row_revision, pg_catalog.gen_random_uuid(), null, null, null);
        perform public.clair_save_chart_order_lifecycle(w, vetu, e, wi.order_id, 'in_progress', null);
        ent := public.clair_get_lab_result_entry(w, vetu, null, wi.id, wi.order_id);
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('rowId', x ->> 'id', 'note', null, 'value', coalesce(
            ord #>> array['vals', x ->> 'analyteName'],
            case
              when x ->> 'resultValueKind' = 'numeric' and x ->> 'referenceRange' ~ '^[0-9.]+–[0-9.]+$' then
                pg_catalog.round(rg.lo + (rg.hi - rg.lo) * (0.3 + 0.4 * (pg_catalog.abs(pg_catalog.hashtext(e::text || (x ->> 'id'))) % 1000) / 1000.0),
                  coalesce((x ->> 'decimalScale')::integer, 1))::text
              when x ->> 'resultValueKind' = 'numeric' then '1'
              when x ->> 'resultValueKind' = 'coded' and x ->> 'analyteName' ~ '도말|형태|침사|세포' then 'unremarkable'
              when x ->> 'resultValueKind' = 'coded' then 'negative'
              else '특이 소견 없음'
            end)))
          into rws
          from pg_catalog.jsonb_array_elements(ent -> 'rows') x
          left join lateral (select nullif(pg_catalog.split_part(x ->> 'referenceRange', '–', 1), '')::numeric as lo,
                                    nullif(pg_catalog.split_part(x ->> 'referenceRange', '–', 2), '')::numeric as hi
                             where x ->> 'referenceRange' ~ '^[0-9.]+–[0-9.]+$') rg on true;
        perform public.clair_save_lab_result_entry_v2(w, vetu, ent ->> 'resultId', e, wi.order_id, wi.id, (ent ->> 'entryWriteRevision')::integer, pg_catalog.gen_random_uuid(), rws);
        select f2.row_revision into rev from public.order_fulfillment_work_items f2 where f2.id = wi.id;
        perform public.clair_transition_fulfillment_work_item(w, vetu, wi.id, 'complete', rev, pg_catalog.gen_random_uuid(), null, null, null);
        perform public.clair_save_chart_order_lifecycle(w, vetu, e, wi.order_id, 'completed', null);
      elsif wi.destination_module = 'imaging' then
        perform public.clair_transition_fulfillment_work_item(w, vetu, wi.id, 'claim', wi.row_revision, pg_catalog.gen_random_uuid(), null, null, null);
        perform public.clair_save_chart_order_lifecycle(w, vetu, e, wi.order_id, 'in_progress', null);
        ctx := public.clair_get_order_execution_context(w, wi.id, null);
        perform public.clair_record_order_execution_result(w, vetu, wi.id, (ctx ->> 'workItemRevision')::bigint, ctx ->> 'planSha256', 0, pg_catalog.gen_random_uuid(), pg_catalog.now(),
          pg_catalog.jsonb_build_object('acquisitionDisposition', 'acquired_new', 'acquiredViews', coalesce(ord -> 'views', '["측면", "복배"]'::jsonb),
            'performedProtocol', coalesce(wi.detail_inputs ->> 'imagingProtocol', '표준 프로토콜'), 'quality', 'diagnostic',
            'findings', coalesce(ord ->> 'find', v ->> 'O'), 'interpretation', coalesce(ord ->> 'interp', v ->> 'A')), null, null);
      else
        d := public.clair_get_fulfillment_instruction(w, wi.id);
        d := public.clair_mutate_fulfillment_instruction(w, wi.id, pg_catalog.jsonb_build_object('action', 'claim', 'startWork', true,
          'commandId', pg_catalog.gen_random_uuid(), 'expectedRevision', d ->> 'revision'));
        d := public.clair_mutate_fulfillment_instruction(w, wi.id, pg_catalog.jsonb_build_object('action', 'complete', 'itemId', wi.id,
          'commandId', pg_catalog.gen_random_uuid(), 'expectedRevision', d ->> 'revision'));
      end if;
    end loop;

    step := 'sign';
    chart := public.clair_sign_encounter_chart(w, vet, e, c, (select sn.updated_at from public.soap_notes sn where sn.id = c), 'replay-sign-' || e);
    step := 'billing.request';
    s := public.clair_get_chart_order_billing_summary(w, e);
    r := public.clair_request_selected_chart_order_billing(w, vetu, e, s ->> 'etag', 'replay-bill-' || e,
      array(select x::uuid from pg_catalog.jsonb_array_elements_text(s -> 'requestableOrderIds') x order by 1),
      pg_catalog.jsonb_array_length(s -> 'unfinishedOrders') > 0);
    inv := (r ->> 'invoiceId')::uuid;
    step := 'complete_chart';
    r := public.clair_complete_chart(w, vet, e);
    perform private.clair_demo_replay_shift(t0, t_visit + interval '28 minutes', c);

    step := 'billing.claim';
    perform private.clair_demo_replay_as(desk);
    a := public.clair_get_billing_assignment(w, inv);
    a := public.clair_change_billing_assignment(w, inv, 'claim', (a ->> 'revision')::bigint);
    step := 'billing.issue';
    r := public.clair_get_billing_invoice_lines(w, inv);
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('invoiceLineId', l ->> 'id', 'quantity', (l ->> 'quantity')::numeric)), '[]'::jsonb)
      into lines from pg_catalog.jsonb_array_elements(r -> 'lines') l;
    r := public.clair_save_billing_invoice_lines(w, desk::uuid, inv, lines, true);
    step := 'billing.paid';
    ver := (public.clair_get_billing_payment_status(w, inv) -> 'invoice' ->> 'updatedAt')::timestamptz;
    r := public.clair_transition_billing_invoice_status(w, desk::uuid, inv, 'paid', pay, '보호자 수납 완료', ver);
    ver := (r -> 'invoice' ->> 'updatedAt')::timestamptz;
    r := public.clair_save_billing_payment_status(w, desk::uuid, inv, 'complete_payment', pay, null, ver);
    -- The invoice number carries the creation date; align it with the visit day.
    -- This runs before the last timestamp move so that the move also corrects updated_at.
    update public.invoices set invoice_no = 'INV-' || pg_catalog.to_char(t_visit at time zone 'Asia/Seoul', 'YYMMDD') || pg_catalog.substr(invoice_no, 11)
      where id = inv and invoice_no ~ '^INV-[0-9]{6}-';
    perform private.clair_demo_replay_shift(t0, t_visit + interval '36 minutes', c);
  exception when others then
    raise exception 'replay_failed at=% step=% error=%', v ->> 'at', step, sqlerrm;
  end;

  return (select pg_catalog.jsonb_build_object('at', v ->> 'at', 'encounter', e, 'chart', c, 'status', en.status, 'invoice', i.status,
      'total', i.total_amount, 'orders', pg_catalog.cardinality(ids), 'warn', warn)
    from public.encounters en left join public.invoices i on i.id = inv where en.id = e);
end $fn$;

-- Runs visits in order. A failed visit is rolled back on its own and reported;
-- the others are kept. With p_dry the whole batch ends with
-- "REPLAY_DRY_ROLLBACK [...]" and nothing is saved.
create or replace function private.clair_demo_replay_batch(p_visits jsonb, p_dry boolean default true)
returns jsonb language plpgsql set search_path = '' as $fn$
declare
  v jsonb; res jsonb := '[]'::jsonb; started timestamptz;
begin
  for v in select * from pg_catalog.jsonb_array_elements(p_visits) loop
    started := pg_catalog.clock_timestamp();
    begin
      res := res || (private.clair_demo_replay_visit(v)
        || pg_catalog.jsonb_build_object('ms', pg_catalog.round(extract(epoch from pg_catalog.clock_timestamp() - started) * 1000)));
    exception when others then
      res := res || pg_catalog.jsonb_build_object('at', v ->> 'at', 'pat', pg_catalog.right(v ->> 'pat', 2), 'failed', sqlerrm);
    end;
  end loop;
  if p_dry then raise exception 'REPLAY_DRY_ROLLBACK %', res::text; end if;
  return res;
end $fn$;

revoke all on function private.clair_demo_replay_as(text) from public, anon, authenticated, service_role;
revoke all on function private.clair_demo_replay_shift(timestamptz, timestamptz, uuid) from public, anon, authenticated, service_role;
revoke all on function private.clair_demo_replay_visit(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.clair_demo_replay_batch(jsonb, boolean) from public, anon, authenticated, service_role;
