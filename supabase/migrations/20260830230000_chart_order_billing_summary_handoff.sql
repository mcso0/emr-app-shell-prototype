-- CLINICAL-BILLING-PR-017: encounter-scoped Plan/Order financial summary and
-- atomic billing handoff. Confirmation creates an internal candidate; this
-- writer is the explicit boundary that links confirmed candidates to an
-- invoice while the clinical encounter remains in progress.

set lock_timeout = '5s';
set statement_timeout = '120s';

create table if not exists public.order_billing_request_commands (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  encounter_id uuid not null,
  actor_user_id uuid not null references public.users(id) on delete restrict,
  idempotency_key text not null
    check (length(btrim(idempotency_key)) between 8 and 160),
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  expected_etag text not null,
  acknowledge_unfinished boolean not null default false,
  status text not null default 'processing'
    check (status in ('processing','completed')),
  invoice_id uuid,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workspace_id, idempotency_key),
  foreign key (workspace_id, encounter_id)
    references public.encounters(workspace_id, id) on delete restrict,
  foreign key (workspace_id, invoice_id)
    references public.invoices(workspace_id, id) on delete restrict,
  check (result is null or jsonb_typeof(result) = 'object'),
  check (
    (status = 'processing' and invoice_id is null and result is null and completed_at is null)
    or (status = 'completed' and invoice_id is not null and result is not null and completed_at is not null)
  )
);

create index if not exists order_billing_request_commands_encounter_idx
  on public.order_billing_request_commands(workspace_id, encounter_id, created_at desc);

alter table public.order_billing_request_commands enable row level security;
revoke all on table public.order_billing_request_commands
  from public, anon, authenticated;

create or replace function private.clair_get_chart_order_billing_summary_internal(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_invoice_id uuid;
  v_counts jsonb;
  v_amounts jsonb;
  v_requestable_ids jsonb;
  v_unfinished jsonb;
  v_context jsonb;
  v_payload jsonb;
  v_etag text;
begin
  if not exists (
    select 1 from public.encounters e
    where e.workspace_id = p_workspace_id
      and e.id = p_encounter_id
      and e.status <> 'cancelled'
  ) then
    raise exception 'encounter_unavailable';
  end if;

  select jsonb_build_object(
    'encounter', jsonb_build_object(
      'id', e.id,
      'patientId', e.patient_id,
      'guardianId', e.guardian_id,
      'encounterNo', e.encounter_no,
      'status', e.status,
      'createdAt', e.created_at,
      'updatedAt', e.updated_at
    ),
    'patient', jsonb_build_object(
      'id', p.id,
      'patientNo', p.patient_no,
      'name', p.name,
      'species', p.species,
      'breed', p.breed,
      'sex', p.sex,
      'status', p.status,
      'createdAt', p.created_at,
      'updatedAt', p.updated_at
    ),
    'guardian', case when g.id is null then null else jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'createdAt', g.created_at,
      'updatedAt', g.updated_at
    ) end
  ) into v_context
  from public.encounters e
  join public.patients p on p.workspace_id = e.workspace_id and p.id = e.patient_id
  left join public.guardians g on g.workspace_id = e.workspace_id and g.id = e.guardian_id
  where e.workspace_id = p_workspace_id and e.id = p_encounter_id;

  select i.id into v_invoice_id
  from public.invoices i
  where i.workspace_id = p_workspace_id
    and i.encounter_id = p_encounter_id
    and i.status <> 'voided'
  order by case i.status when 'draft' then 0 when 'issued' then 1 else 2 end,
           i.created_at desc, i.id
  limit 1;

  select jsonb_build_object(
    'total', count(*) filter (where o.status <> 'cancelled'),
    'confirmed', count(*) filter (
      where o.status <> 'cancelled'
        and o.order_confirmation_status in ('confirmed','billed')
    ),
    'draft', count(*) filter (
      where o.status <> 'cancelled'
        and o.order_confirmation_status in ('draft','pending')
    ),
    'recheck', count(*) filter (
      where o.status = 're_requested'
    ),
    'requested', count(*) filter (
      where o.status <> 'cancelled'
        and o.billing_candidate_status = 'invoice_linked'
    ),
    'requestable', (
      select count(*)
      from public.order_billing_candidates c
      join public.orders bo
        on bo.workspace_id = c.workspace_id and bo.id = c.order_id
      where c.workspace_id = p_workspace_id
        and c.encounter_id = p_encounter_id
        and c.status = 'candidate_created'
        and bo.status <> 'cancelled'
        and bo.order_confirmation_status = 'confirmed'
        and bo.invoice_line_id is null
    ),
    'cancelled', count(*) filter (where o.status = 'cancelled')
  ) into v_counts
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and coalesce(o.row_depth, 0) = 0;

  with billable as (
    select
      o.id,
      o.order_confirmation_status,
      case
        when o.order_confirmation_status = 'confirmed'
          then coalesce(c.amount, o.line_total_snapshot)
        when o.order_confirmation_status = 'billed'
          then coalesce(il.line_total, c.amount, o.line_total_snapshot)
        else o.line_total_snapshot
      end effective_amount
    from public.orders o
    left join public.order_billing_candidates c
      on c.workspace_id = o.workspace_id
     and c.order_id = o.id
     and c.status <> 'cancelled'
    left join public.invoice_lines il
      on il.workspace_id = o.workspace_id
     and il.id = o.invoice_line_id
    where o.workspace_id = p_workspace_id
      and o.encounter_id = p_encounter_id
      and o.row_type in ('individual','set_child')
      and o.status <> 'cancelled'
      and o.billing_eligible
      and o.billing_reflection_enabled
      and o.line_total_snapshot > 0
  ), invoice_totals as (
    select
      coalesce(sum(i.discount_amount), 0) discount,
      coalesce(sum(i.tax_amount), 0) tax,
      coalesce(sum(i.total_amount), 0) total
    from public.invoices i
    where i.workspace_id = p_workspace_id
      and i.encounter_id = p_encounter_id
      and i.status <> 'voided'
  ), paid_totals as (
    select coalesce(sum(p.amount), 0) paid
    from public.payments p
    join public.invoices i on i.workspace_id = p.workspace_id and i.id = p.invoice_id
    where p.workspace_id = p_workspace_id
      and i.encounter_id = p_encounter_id
      and p.status = 'approved'
  ), surcharge_totals as (
    select coalesce(sum(a.amount), 0) surcharge
    from public.invoice_adjustments a
    join public.invoices i on i.workspace_id = a.workspace_id and i.id = a.invoice_id
    where a.workspace_id = p_workspace_id
      and i.encounter_id = p_encounter_id
      and a.adjustment_type = 'surcharge'
  ), requestable as (
    select coalesce(sum(c.amount), 0) amount
    from public.order_billing_candidates c
    join public.orders o on o.workspace_id = c.workspace_id and o.id = c.order_id
    where c.workspace_id = p_workspace_id
      and c.encounter_id = p_encounter_id
      and c.status = 'candidate_created'
      and o.status <> 'cancelled'
      and o.order_confirmation_status = 'confirmed'
      and o.invoice_line_id is null
  )
  select jsonb_build_object(
    'gross', coalesce(sum(b.effective_amount), 0),
    'confirmed', coalesce(sum(b.effective_amount) filter (
      where b.order_confirmation_status in ('confirmed','billed')
    ), 0),
    'draft', coalesce(sum(b.effective_amount) filter (
      where b.order_confirmation_status in ('draft','pending')
    ), 0),
    'discount', it.discount,
    'surcharge', st.surcharge,
    'tax', it.tax,
    'paid', pt.paid,
    'outstanding', greatest(it.total + st.surcharge - pt.paid, 0),
    'estimatedTotal', greatest(
      coalesce(sum(b.effective_amount), 0) - it.discount + st.surcharge + it.tax,
      0
    ),
    'requestableTotal', r.amount
  ) into v_amounts
  from billable b
  cross join invoice_totals it
  cross join paid_totals pt
  cross join surcharge_totals st
  cross join requestable r
  group by it.discount, it.tax, it.total, pt.paid, st.surcharge, r.amount;

  select coalesce(jsonb_agg(c.order_id::text order by c.created_at, c.order_id), '[]'::jsonb)
  into v_requestable_ids
  from public.order_billing_candidates c
  join public.orders o on o.workspace_id = c.workspace_id and o.id = c.order_id
  where c.workspace_id = p_workspace_id
    and c.encounter_id = p_encounter_id
    and c.status = 'candidate_created'
    and o.status <> 'cancelled'
    and o.order_confirmation_status = 'confirmed'
    and o.invoice_line_id is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'orderId', c.order_id,
    'name', c.billing_name_snapshot,
    'status', t.status
  ) order by c.created_at, c.order_id), '[]'::jsonb)
  into v_unfinished
  from public.order_billing_candidates c
  join public.orders o
    on o.workspace_id = c.workspace_id
   and o.id = c.order_id
  join lateral (
    select latest.*
    from public.order_tasks latest
    where latest.workspace_id = c.workspace_id
      and latest.order_id = c.order_id
      and latest.task_role = 'execution'
    order by latest.attempt_no desc, latest.created_at desc, latest.id desc
    limit 1
  ) t on true
  where c.workspace_id = p_workspace_id
    and c.encounter_id = p_encounter_id
    and c.status = 'candidate_created'
    and o.status <> 'cancelled'
    and o.order_confirmation_status = 'confirmed'
    and o.invoice_line_id is null
    and t.status not in ('complete','cancelled');

  v_payload := jsonb_build_object(
    'workspaceId', p_workspace_id,
    'encounterId', p_encounter_id,
    'currency', 'KRW',
    'context', v_context,
    'invoiceId', v_invoice_id,
    'orderCounts', coalesce(v_counts, '{}'::jsonb),
    'amounts', coalesce(v_amounts, jsonb_build_object(
      'gross', 0, 'confirmed', 0, 'draft', 0, 'discount', 0,
      'surcharge', 0, 'tax', 0, 'paid', 0, 'outstanding', 0,
      'estimatedTotal', 0, 'requestableTotal', 0
    )),
    'requestableOrderIds', v_requestable_ids,
    'unfinishedOrders', v_unfinished
  );
  v_etag := '"' || encode(digest(v_payload::text, 'sha256'), 'hex') || '"';
  return v_payload || jsonb_build_object('etag', v_etag, 'generatedAt', v_now);
end
$$;

create or replace function public.clair_get_chart_order_billing_summary(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, private, extensions, pg_temp
as $$
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view') then
    raise exception 'permission_missing';
  end if;
  return private.clair_get_chart_order_billing_summary_internal(
    p_workspace_id, p_encounter_id
  );
end
$$;

create or replace function private.clair_link_chart_order_billing_candidates_internal(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_order_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_selected_count integer := coalesce(cardinality(p_order_ids), 0);
  v_matched_count integer;
  v_invoice_id uuid;
  v_candidate record;
  v_line_id uuid;
  v_invoice_line_unit_price numeric(12,2);
  v_invoice_line_discount_amount numeric(12,2);
  v_tax_type text;
begin
  if p_actor_user_id is distinct from auth.uid()
     or not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if v_selected_count = 0 or v_selected_count > 100 then
    raise exception 'order_unavailable';
  end if;

  -- Match the existing execution-mutation lock order (order -> candidate).
  -- Billing corrections therefore either finish before this snapshot freezes
  -- or wait until the invoice link commits; they cannot deadlock by taking the
  -- same authority rows in reverse order.
  perform 1
  from public.orders orders
  where orders.workspace_id = p_workspace_id
    and orders.encounter_id = p_encounter_id
    and orders.id = any(p_order_ids)
  order by orders.id
  for update;

  perform 1
  from public.order_billing_candidates candidate
  where candidate.workspace_id = p_workspace_id
    and candidate.encounter_id = p_encounter_id
    and candidate.order_id = any(p_order_ids)
  order by candidate.order_id, candidate.id
  for update;

  select count(*) into v_matched_count
  from public.order_billing_candidates candidate
  join public.orders orders
    on orders.workspace_id = candidate.workspace_id
   and orders.id = candidate.order_id
  where candidate.workspace_id = p_workspace_id
    and candidate.encounter_id = p_encounter_id
    and candidate.order_id = any(p_order_ids)
    and candidate.status = 'candidate_created'
    and candidate.currency = 'KRW'
    and orders.status <> 'cancelled'
    and orders.order_confirmation_status = 'confirmed'
    and orders.billing_reflection_enabled
    and orders.invoice_line_id is null;
  if v_matched_count is distinct from v_selected_count then
    raise exception 'billing_candidate_unavailable';
  end if;

  select invoice.id into v_invoice_id
  from public.invoices invoice
  where invoice.workspace_id = p_workspace_id
    and invoice.encounter_id = p_encounter_id
    and invoice.status = 'draft'
  order by invoice.created_at, invoice.id
  limit 1
  for update;

  if v_invoice_id is null then
    insert into public.invoices (
      workspace_id, encounter_id, guardian_id, invoice_no, status,
      payment_state, created_at, updated_at
    )
    select encounter.workspace_id, encounter.id, encounter.guardian_id,
      'INV-' || to_char(v_now, 'YYMMDD') || '-'
        || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      'draft', 'none', v_now, v_now
    from public.encounters encounter
    where encounter.workspace_id = p_workspace_id
      and encounter.id = p_encounter_id
      and encounter.status <> 'cancelled'
    returning id into v_invoice_id;
  end if;
  if v_invoice_id is null then raise exception 'invoice_unavailable'; end if;

  for v_candidate in
    select
      candidate.*,
      orders.service_item_id,
      orders.applied_price_snapshot,
      orders.calculation_outputs,
      orders.applied_snapshot,
      orders.workspace_catalog_item_id,
      orders.source_master_record_id,
      orders.source_master_revision,
      orders.workspace_catalog_revision
    from public.order_billing_candidates candidate
    join public.orders orders
      on orders.workspace_id = candidate.workspace_id
     and orders.id = candidate.order_id
    where candidate.workspace_id = p_workspace_id
      and candidate.encounter_id = p_encounter_id
      and candidate.order_id = any(p_order_ids)
      and candidate.status = 'candidate_created'
    order by candidate.order_id
  loop
    -- The candidate amount is the frozen billing authority. It may differ
    -- from quantity * unit_price because the confirmation contract preserves
    -- fixed totals and rounding results independently. Derive representable
    -- invoice-line inputs without recomputing or mutating that frozen amount.
    v_invoice_line_unit_price := v_candidate.unit_price;
    if (v_invoice_line_unit_price * v_candidate.quantity)::numeric(12,2)
        < v_candidate.amount then
      v_invoice_line_unit_price := (
        ceil((v_candidate.amount / v_candidate.quantity) * 100) / 100
      )::numeric(12,2);
    end if;
    v_invoice_line_discount_amount := (
      v_invoice_line_unit_price * v_candidate.quantity - v_candidate.amount
    )::numeric(12,2);
    if v_invoice_line_discount_amount < 0 then
      raise exception 'frozen_amount_unrepresentable';
    end if;

    v_tax_type := coalesce(
      nullif(v_candidate.applied_price_snapshot->>'taxType', ''),
      nullif(v_candidate.calculation_outputs->>'taxType', ''),
      nullif(v_candidate.applied_snapshot->>'taxType', '')
    );
    if v_tax_type is null then
      if v_candidate.workspace_catalog_item_id is not null then
        raise exception 'frozen_tax_missing';
      end if;
      v_tax_type := 'taxable';
    end if;
    if v_tax_type not in ('taxable','non_taxable') then
      raise exception 'frozen_tax_invalid';
    end if;

    insert into public.invoice_lines (
      workspace_id, invoice_id, service_item_id, order_id, description,
      quantity, unit_price, discount_amount, billing_candidate_id,
      billing_name_snapshot, source_order_snapshot, tax_type, created_at, updated_at
    ) values (
      p_workspace_id, v_invoice_id, v_candidate.service_item_id,
      v_candidate.order_id, v_candidate.billing_name_snapshot,
      v_candidate.quantity, v_invoice_line_unit_price,
      v_invoice_line_discount_amount, v_candidate.id,
      v_candidate.billing_name_snapshot,
      v_candidate.source_snapshot || jsonb_build_object(
        'billingAuthority', 'order_billing_candidates',
        'billingCandidateId', v_candidate.id,
        'workspaceCatalogItemId', v_candidate.workspace_catalog_item_id,
        'sourceMasterRecordId', v_candidate.source_master_record_id,
        'sourceMasterRevision', v_candidate.source_master_revision,
        'workspaceCatalogRevision', v_candidate.workspace_catalog_revision,
        'billingNameSnapshot', v_candidate.billing_name_snapshot,
        'quantity', v_candidate.quantity,
        'unitPriceSnapshot', v_candidate.unit_price,
        'lineTotalSnapshot', v_candidate.amount,
        'invoiceLineUnitPrice', v_invoice_line_unit_price,
        'invoiceLineDiscountAmount', v_invoice_line_discount_amount,
        'taxType', v_tax_type
      ),
      v_tax_type, v_now, v_now
    ) returning id into v_line_id;

    if not exists (
      select 1 from public.invoice_lines line
      where line.workspace_id = p_workspace_id
        and line.id = v_line_id
        and line.description = v_candidate.billing_name_snapshot
        and line.quantity = v_candidate.quantity
        and line.line_total = v_candidate.amount
    ) then
      raise exception 'billing_candidate_snapshot_mismatch';
    end if;

    update public.orders orders
    set invoice_line_id = v_line_id,
        billing_candidate_status = 'invoice_linked',
        billing_candidate_id = v_candidate.id,
        order_confirmation_status = 'billed',
        updated_at = v_now
    where orders.workspace_id = p_workspace_id
      and orders.id = v_candidate.order_id
      and orders.invoice_line_id is null;

    update public.order_billing_candidates candidate
    set status = 'invoice_linked',
        invoice_line_id = v_line_id,
        updated_at = v_now
    where candidate.workspace_id = p_workspace_id
      and candidate.id = v_candidate.id
      and candidate.status = 'candidate_created';
  end loop;

  update public.invoices invoice
  set subtotal_amount = totals.subtotal_amount,
      total_amount = greatest(
        totals.subtotal_amount - invoice.discount_amount + invoice.tax_amount,
        0
      ),
      billing_requested_at = coalesce(invoice.billing_requested_at, v_now),
      updated_at = v_now
  from (
    select coalesce(sum(line.line_total), 0) subtotal_amount
    from public.invoice_lines line
    where line.workspace_id = p_workspace_id
      and line.invoice_id = v_invoice_id
  ) totals
  where invoice.workspace_id = p_workspace_id
    and invoice.id = v_invoice_id
    and invoice.status = 'draft';

  insert into public.order_events (
    workspace_id, order_id, event_type, performed_by_user_id, payload, created_at
  )
  select p_workspace_id, orders.id, 'edited', p_actor_user_id,
    jsonb_build_object(
      'action', 'chart_order_billing_requested',
      'invoiceId', v_invoice_id,
      'billingAuthority', 'order_billing_candidates'
    ),
    v_now
  from public.orders orders
  where orders.workspace_id = p_workspace_id
    and orders.id = any(p_order_ids);

  return v_invoice_id;
end
$$;

create or replace function public.clair_request_chart_order_billing(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_expected_etag text,
  p_idempotency_key text,
  p_acknowledge_unfinished boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_order_ids uuid[];
  v_invoice_id uuid;
  v_actor_membership_id uuid;
  v_command public.order_billing_request_commands%rowtype;
  v_existing public.order_billing_request_commands%rowtype;
  v_idempotency_key text := btrim(coalesce(p_idempotency_key, ''));
  v_request_sha256 text;
  v_now timestamptz := now();
begin
  if not private.clair_is_active_workspace_member(p_workspace_id)
     or p_actor_user_id is distinct from auth.uid() then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing';
  end if;
  if length(v_idempotency_key) not between 8 and 160
     or p_expected_etag is null then
    raise exception 'invalid_billing_request';
  end if;

  v_request_sha256 := encode(digest(jsonb_build_object(
    'workspaceId', p_workspace_id,
    'actorUserId', p_actor_user_id,
    'encounterId', p_encounter_id,
    'expectedEtag', p_expected_etag,
    'acknowledgeUnfinished', coalesce(p_acknowledge_unfinished, false)
  )::text, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(
    hashtextextended(
      'chart_order_billing_request:' || p_workspace_id || ':' || v_idempotency_key,
      0
    )
  );
  select * into v_existing
  from public.order_billing_request_commands command
  where command.workspace_id = p_workspace_id
    and command.idempotency_key = v_idempotency_key
  for update;
  if found then
    if v_existing.actor_user_id is distinct from p_actor_user_id
       or v_existing.encounter_id is distinct from p_encounter_id
       or v_existing.request_sha256 is distinct from v_request_sha256 then
      raise exception 'idempotency_conflict';
    end if;
    if v_existing.status = 'completed' and v_existing.invoice_id is not null then
      return private.clair_get_chart_order_billing_summary_internal(
        p_workspace_id, p_encounter_id
      ) || jsonb_build_object('invoiceId', v_existing.invoice_id);
    end if;
    raise exception 'billing_request_in_progress';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('clinical_billing:' || p_workspace_id || ':' || p_encounter_id::text, 0)
  );

  -- Freeze the encounter and every existing order/candidate authority row in
  -- the same order used by confirmation and billing correction. The ETag is
  -- calculated only after these locks are held, so a correction that committed
  -- after the browser read becomes a revision conflict instead of silently
  -- changing the invoice snapshot.
  perform 1
  from public.encounters encounter
  where encounter.workspace_id = p_workspace_id
    and encounter.id = p_encounter_id
    and encounter.status <> 'cancelled'
  for update;
  if not found then raise exception 'encounter_unavailable'; end if;

  perform 1
  from public.orders orders
  where orders.workspace_id = p_workspace_id
    and orders.encounter_id = p_encounter_id
  order by orders.id
  for update;

  perform 1
  from public.order_billing_candidates candidate
  where candidate.workspace_id = p_workspace_id
    and candidate.encounter_id = p_encounter_id
  order by candidate.order_id, candidate.id
  for update;

  v_before := private.clair_get_chart_order_billing_summary_internal(
    p_workspace_id, p_encounter_id
  );
  if p_expected_etag is distinct from v_before->>'etag' then
    raise exception 'revision_conflict';
  end if;
  if jsonb_array_length(v_before->'unfinishedOrders') > 0
     and not coalesce(p_acknowledge_unfinished, false) then
    raise exception 'unfinished_ack_required';
  end if;

  select coalesce(array_agg(value::text::uuid order by value::text), '{}'::uuid[])
  into v_order_ids
  from jsonb_array_elements_text(v_before->'requestableOrderIds') value;
  if coalesce(cardinality(v_order_ids), 0) = 0 then
    raise exception 'no_billable_orders';
  end if;

  insert into public.order_billing_request_commands(
    workspace_id, encounter_id, actor_user_id, idempotency_key,
    request_sha256, expected_etag, acknowledge_unfinished
  ) values (
    p_workspace_id, p_encounter_id, p_actor_user_id, v_idempotency_key,
    v_request_sha256, p_expected_etag, coalesce(p_acknowledge_unfinished, false)
  ) returning * into v_command;

  v_invoice_id := private.clair_link_chart_order_billing_candidates_internal(
    p_workspace_id, p_actor_user_id, p_encounter_id, v_order_ids
  );

  select membership.id into v_actor_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = p_actor_user_id
    and membership.status = 'active'
  order by membership.created_at
  limit 1;

  v_after := private.clair_get_chart_order_billing_summary_internal(
    p_workspace_id, p_encounter_id
  );
  update public.order_billing_request_commands command
  set status = 'completed',
      invoice_id = v_invoice_id,
      result = jsonb_build_object(
        'invoiceId', v_invoice_id,
        'orderIds', to_jsonb(v_order_ids),
        'resultEtag', v_after->>'etag'
      ),
      completed_at = v_now
  where command.workspace_id = p_workspace_id
    and command.id = v_command.id;

  insert into public.audit_events(
    id, workspace_id, actor_user_id, actor_membership_id,
    event_type, target_type, target_id, encounter_id, request_id,
    before_snapshot, after_snapshot, metadata, occurred_at, created_at
  ) values (
    'chart-order-billing-' || v_command.id::text,
    p_workspace_id, p_actor_user_id, v_actor_membership_id,
    'billing.invoice_candidate_generated', 'invoice', v_invoice_id::text,
    p_encounter_id, v_command.id::text,
    jsonb_build_object(
      'etag', v_before->'etag',
      'orderCounts', v_before->'orderCounts',
      'amounts', v_before->'amounts',
      'requestableOrderIds', v_before->'requestableOrderIds'
    ),
    jsonb_build_object(
      'etag', v_after->'etag',
      'orderCounts', v_after->'orderCounts',
      'amounts', v_after->'amounts',
      'invoiceId', v_invoice_id
    ),
    jsonb_build_object(
      'source', 'chart-order-billing-summary-v1',
      'idempotencyKey', v_idempotency_key,
      'orderIds', to_jsonb(v_order_ids),
      'encounterStatusChanged', false
    ),
    v_now, v_now
  );
  return v_after;
end
$$;

revoke all on function private.clair_get_chart_order_billing_summary_internal(text,uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.clair_link_chart_order_billing_candidates_internal(text,uuid,uuid,uuid[])
  from public, anon, authenticated, service_role;
revoke all on function public.clair_get_chart_order_billing_summary(text,uuid)
  from public, anon;
revoke all on function public.clair_request_chart_order_billing(text,uuid,uuid,text,text,boolean)
  from public, anon;
grant execute on function public.clair_get_chart_order_billing_summary(text,uuid)
  to authenticated;
grant execute on function public.clair_request_chart_order_billing(text,uuid,uuid,text,text,boolean)
  to authenticated;

comment on function public.clair_request_chart_order_billing(text,uuid,uuid,text,text,boolean)
is 'Atomically links confirmed billing candidates to one invoice without changing encounter/work status.';
