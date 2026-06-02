-- DEN-376: guardian-centered billing checkout data model and RPC hardening.
-- Local migration authoring only. Remote Supabase push, RLS replay, production
-- deploy, payment provider integration, and real data import remain gated.

alter table public.invoices
  add column if not exists billing_requested_at timestamptz,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_reason text;

update public.invoices
set billing_requested_at = coalesce(billing_requested_at, issued_at, created_at)
where billing_requested_at is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_voided_reason_required'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_voided_reason_required
      check (status <> 'voided' or voided_reason is not null);
  end if;
end $$;

create table if not exists public.billing_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete set null,
  payer_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(payer_snapshot) = 'object'),
  status text not null default 'draft'
    check (status in ('draft', 'prepared', 'payment_pending', 'paid', 'unpaid', 'voided', 'expired')),
  subtotal_amount numeric(12,2) not null default 0 check (subtotal_amount >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  surcharge_amount numeric(12,2) not null default 0 check (surcharge_amount >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  selected_payment_method text
    check (selected_payment_method is null or selected_payment_method in ('card', 'cash', 'transfer', 'other')),
  unpaid_reason text,
  payment_memo text,
  created_by_user_id uuid references public.users(id) on delete set null,
  prepared_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'unpaid' or unpaid_reason is not null),
  check (status not in ('paid', 'unpaid', 'voided', 'expired') or completed_at is not null)
);

create table if not exists public.billing_checkout_session_invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  checkout_session_id uuid not null references public.billing_checkout_sessions(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  encounter_id uuid not null references public.encounters(id) on delete restrict,
  patient_id uuid references public.patients(id) on delete set null,
  guardian_id uuid references public.guardians(id) on delete set null,
  invoice_status_snapshot text not null,
  amount_inclusion text not null check (amount_inclusion in ('payable', 'excluded')),
  subtotal_amount numeric(12,2) not null default 0 check (subtotal_amount >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  surcharge_amount numeric(12,2) not null default 0 check (surcharge_amount >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  allocated_amount numeric(12,2) not null default 0 check (allocated_amount >= 0),
  created_at timestamptz not null default now(),
  unique (workspace_id, checkout_session_id, invoice_id)
);

create table if not exists public.invoice_adjustments (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  checkout_session_id uuid references public.billing_checkout_sessions(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete cascade,
  invoice_line_id uuid references public.invoice_lines(id) on delete cascade,
  adjustment_type text not null
    check (adjustment_type in ('discount', 'surcharge', 'manual_price_override', 'tax_override')),
  amount numeric(12,2) not null check (amount >= 0),
  reason text not null check (length(trim(reason)) > 0),
  memo text,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (checkout_session_id is not null or invoice_id is not null or invoice_line_id is not null)
);

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  checkout_session_id uuid not null references public.billing_checkout_sessions(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (workspace_id, payment_id, invoice_id)
);

create table if not exists public.billing_invoice_status_transition_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  previous_status text not null,
  next_status text not null,
  previous_payment_state text,
  next_payment_state text,
  amount_snapshot numeric(12,2) not null default 0 check (amount_snapshot >= 0),
  reason text not null check (length(trim(reason)) > 0),
  source text not null default 'guardian_checkout',
  payment_side_effect jsonb not null default '{}'::jsonb check (jsonb_typeof(payment_side_effect) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists invoices_workspace_billing_requested_idx
  on public.invoices (workspace_id, billing_requested_at desc);

create index if not exists billing_checkout_sessions_workspace_guardian_status_idx
  on public.billing_checkout_sessions (workspace_id, guardian_id, status, updated_at desc);

create index if not exists billing_checkout_session_invoices_workspace_invoice_idx
  on public.billing_checkout_session_invoices (workspace_id, invoice_id);

create index if not exists invoice_adjustments_workspace_invoice_idx
  on public.invoice_adjustments (workspace_id, invoice_id, created_at desc)
  where invoice_id is not null;

create index if not exists payment_allocations_workspace_checkout_idx
  on public.payment_allocations (workspace_id, checkout_session_id);

create index if not exists billing_invoice_transition_events_workspace_invoice_idx
  on public.billing_invoice_status_transition_events (workspace_id, invoice_id, created_at desc);

create or replace function private.clair_billing_lifecycle_status(
  p_invoice_status text,
  p_payment_state text,
  p_unpaid_reason text
)
returns text
language sql
immutable
as $$
  select case
    when p_invoice_status = 'voided' then 'voided'
    when p_invoice_status = 'refunded' or p_payment_state = 'refunded' then 'refunded'
    when p_invoice_status = 'paid' or p_payment_state = 'paid' then 'paid'
    when p_payment_state in ('unpaid', 'failed') or nullif(btrim(coalesce(p_unpaid_reason, '')), '') is not null then 'unpaid'
    else 'waiting'
  end;
$$;

create or replace function private.clair_billing_amount_inclusion(
  p_invoice_status text,
  p_payment_state text,
  p_unpaid_reason text
)
returns text
language sql
immutable
as $$
  select case
    when private.clair_billing_lifecycle_status(p_invoice_status, p_payment_state, p_unpaid_reason)
      in ('waiting', 'unpaid')
    then 'payable'
    else 'excluded'
  end;
$$;

create or replace function public.clair_list_guardian_billing_ledger(
  p_workspace_id text,
  p_guardian_id uuid,
  p_include_co_guardian_invoices boolean default false,
  p_status_filter text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if p_status_filter not in ('all', 'waiting', 'unpaid', 'paid', 'voided', 'refunded') then
    raise exception 'ledger_filter_unavailable';
  end if;

  if not exists (
    select 1 from public.guardians g
    where g.workspace_id = p_workspace_id and g.id = p_guardian_id
  ) then
    raise exception 'guardian_unavailable';
  end if;

  with owned_patients as (
    select pg.patient_id
    from public.patient_guardians pg
    join public.patients p
      on p.id = pg.patient_id
     and p.workspace_id = p_workspace_id
    where pg.guardian_id = p_guardian_id
  ),
  ledger as (
    select
      i.id as invoice_id,
      i.invoice_no,
      i.guardian_id,
      g.name as guardian_name,
      e.id as encounter_id,
      p.id as patient_id,
      p.name as patient_name,
      coalesce(i.billing_requested_at, i.issued_at, i.created_at) as activity_at,
      case
        when i.billing_requested_at is not null then 'billing_requested_at'
        when i.issued_at is not null then 'issued_at'
        else 'created_at'
      end as activity_basis,
      private.clair_billing_lifecycle_status(i.status, i.payment_state, i.unpaid_reason) as lifecycle_status,
      private.clair_billing_amount_inclusion(i.status, i.payment_state, i.unpaid_reason) as amount_inclusion,
      i.total_amount,
      greatest(i.total_amount - coalesce(sum(pay.amount) filter (where pay.status = 'approved'), 0), 0) as balance_amount,
      count(distinct il.id) as line_count,
      coalesce(
        min(il.description) || case when count(distinct il.id) > 1 then ' 외 ' || (count(distinct il.id) - 1)::text || '건' else '' end,
        '청구 항목 없음'
      ) as line_summary
    from public.invoices i
    join public.encounters e
      on e.workspace_id = i.workspace_id
     and e.id = i.encounter_id
    join public.patients p
      on p.workspace_id = e.workspace_id
     and p.id = e.patient_id
    left join public.guardians g
      on g.workspace_id = i.workspace_id
     and g.id = i.guardian_id
    left join public.invoice_lines il
      on il.workspace_id = i.workspace_id
     and il.invoice_id = i.id
    left join public.payments pay
      on pay.workspace_id = i.workspace_id
     and pay.invoice_id = i.id
    where i.workspace_id = p_workspace_id
      and e.patient_id in (select patient_id from owned_patients)
      and (p_include_co_guardian_invoices = true or i.guardian_id = p_guardian_id)
    group by i.id, g.name, e.id, p.id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'invoiceId', ledger.invoice_id,
        'invoiceNo', ledger.invoice_no,
        'guardianId', ledger.guardian_id,
        'guardianName', ledger.guardian_name,
        'encounterId', ledger.encounter_id,
        'patientId', ledger.patient_id,
        'patientName', ledger.patient_name,
        'activityAt', ledger.activity_at,
        'activityBasis', ledger.activity_basis,
        'status', ledger.lifecycle_status,
        'amountInclusion', ledger.amount_inclusion,
        'totalAmount', ledger.total_amount,
        'balanceAmount', ledger.balance_amount,
        'payableAmount', case when ledger.amount_inclusion = 'payable' then ledger.balance_amount else 0 end,
        'lineCount', ledger.line_count,
        'lineSummary', ledger.line_summary
      )
      order by ledger.activity_at desc, ledger.invoice_id
    ),
    '[]'::jsonb
  )
  into v_rows
  from ledger
  where p_status_filter = 'all' or ledger.lifecycle_status = p_status_filter;

  return v_rows;
end;
$$;

create or replace function public.clair_prepare_billing_checkout_session(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_invoice_ids uuid[],
  p_payment_method text default null,
  p_adjustments jsonb default '[]'::jsonb,
  p_payment_memo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_checkout_id uuid := gen_random_uuid();
  v_invoice_count integer := coalesce(array_length(p_invoice_ids, 1), 0);
  v_matched_count integer := 0;
  v_now timestamptz := now();
  v_payload jsonb;
  v_primary_guardian_id uuid;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if v_invoice_count = 0 or v_invoice_count > 100 then
    raise exception 'invoice_unavailable';
  end if;

  if p_payment_method is not null and p_payment_method not in ('card', 'cash', 'transfer', 'other') then
    raise exception 'invoice_unavailable';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_adjustments, '[]'::jsonb))
      as adjustment("amount" numeric, "reason" text)
    where adjustment."amount" > 0
      and nullif(btrim(coalesce(adjustment."reason", '')), '') is null
  ) then
    raise exception 'adjustment_reason_required';
  end if;

  select count(*), min(i.guardian_id::text)::uuid
  into v_matched_count, v_primary_guardian_id
  from public.invoices i
  where i.workspace_id = p_workspace_id
    and i.id = any(p_invoice_ids)
    and private.clair_billing_lifecycle_status(i.status, i.payment_state, i.unpaid_reason) in ('waiting', 'unpaid', 'paid', 'voided');

  if v_matched_count <> v_invoice_count then
    raise exception 'invoice_unavailable';
  end if;

  insert into public.billing_checkout_sessions (
    id,
    workspace_id,
    guardian_id,
    payer_snapshot,
    status,
    subtotal_amount,
    discount_amount,
    surcharge_amount,
    tax_amount,
    total_amount,
    selected_payment_method,
    payment_memo,
    created_by_user_id,
    prepared_at,
    created_at,
    updated_at
  )
  select
    v_checkout_id,
    p_workspace_id,
    v_primary_guardian_id,
    coalesce(jsonb_build_object('guardianId', g.id, 'name', g.name, 'mobilePhone', g.mobile_phone), '{}'::jsonb),
    'prepared',
    coalesce(sum(i.subtotal_amount) filter (
      where private.clair_billing_amount_inclusion(i.status, i.payment_state, i.unpaid_reason) = 'payable'
    ), 0),
    coalesce(sum(i.discount_amount) filter (
      where private.clair_billing_amount_inclusion(i.status, i.payment_state, i.unpaid_reason) = 'payable'
    ), 0),
    0,
    coalesce(sum(i.tax_amount) filter (
      where private.clair_billing_amount_inclusion(i.status, i.payment_state, i.unpaid_reason) = 'payable'
    ), 0),
    coalesce(sum(i.total_amount) filter (
      where private.clair_billing_amount_inclusion(i.status, i.payment_state, i.unpaid_reason) = 'payable'
    ), 0),
    p_payment_method,
    nullif(btrim(coalesce(p_payment_memo, '')), ''),
    p_actor_user_id,
    v_now,
    v_now,
    v_now
  from public.invoices i
  left join public.guardians g
    on g.workspace_id = i.workspace_id
   and g.id = v_primary_guardian_id
  where i.workspace_id = p_workspace_id
    and i.id = any(p_invoice_ids)
  group by g.id;

  insert into public.billing_checkout_session_invoices (
    workspace_id,
    checkout_session_id,
    invoice_id,
    encounter_id,
    patient_id,
    guardian_id,
    invoice_status_snapshot,
    amount_inclusion,
    subtotal_amount,
    discount_amount,
    tax_amount,
    allocated_amount,
    created_at
  )
  select
    i.workspace_id,
    v_checkout_id,
    i.id,
    i.encounter_id,
    e.patient_id,
    i.guardian_id,
    private.clair_billing_lifecycle_status(i.status, i.payment_state, i.unpaid_reason),
    private.clair_billing_amount_inclusion(i.status, i.payment_state, i.unpaid_reason),
    i.subtotal_amount,
    i.discount_amount,
    i.tax_amount,
    case
      when private.clair_billing_amount_inclusion(i.status, i.payment_state, i.unpaid_reason) = 'payable'
      then i.total_amount
      else 0
    end,
    v_now
  from public.invoices i
  join public.encounters e
    on e.workspace_id = i.workspace_id
   and e.id = i.encounter_id
  where i.workspace_id = p_workspace_id
    and i.id = any(p_invoice_ids);

  select jsonb_build_object(
    'checkoutSession',
    jsonb_build_object(
      'id', s.id,
      'workspaceId', s.workspace_id,
      'guardianId', s.guardian_id,
      'payerSnapshot', s.payer_snapshot,
      'status', s.status,
      'selectedInvoiceIds', p_invoice_ids,
      'payableAmount', s.total_amount,
      'excludedAmount', coalesce(sum(greatest(i.total_amount - coalesce(payments.paid_amount, 0), 0)) filter (where csi.amount_inclusion = 'excluded'), 0),
      'excludedCount', count(*) filter (where csi.amount_inclusion = 'excluded'),
      'paymentMethod', s.selected_payment_method,
      'paymentMemo', s.payment_memo,
      'preparedAt', s.prepared_at
    ),
    'invoiceSnapshots',
    coalesce(jsonb_agg(
      jsonb_build_object(
        'invoiceId', csi.invoice_id,
        'status', csi.invoice_status_snapshot,
        'amountInclusion', csi.amount_inclusion,
        'payableAmount', csi.allocated_amount,
        'totalAmount', i.total_amount,
        'paidAmount', coalesce(payments.paid_amount, 0),
        'balanceAmount', greatest(i.total_amount - coalesce(payments.paid_amount, 0), 0),
        'activityAt', coalesce(i.billing_requested_at, i.issued_at, i.created_at),
        'activityBasis', case
          when i.billing_requested_at is not null then 'billing_requested_at'
          when i.issued_at is not null then 'issued_at'
          else 'created_at'
        end
      )
      order by csi.created_at, csi.invoice_id
    ), '[]'::jsonb)
  )
  into v_payload
  from public.billing_checkout_sessions s
  join public.billing_checkout_session_invoices csi
    on csi.workspace_id = s.workspace_id
   and csi.checkout_session_id = s.id
  join public.invoices i
    on i.workspace_id = csi.workspace_id
   and i.id = csi.invoice_id
  left join lateral (
    select sum(p.amount) as paid_amount
    from public.payments p
    where p.workspace_id = i.workspace_id
      and p.invoice_id = i.id
      and p.status = 'approved'
  ) payments on true
  where s.workspace_id = p_workspace_id
    and s.id = v_checkout_id
  group by s.id;

  return v_payload;
end;
$$;

create or replace function public.clair_transition_billing_invoice_status(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_invoice_id uuid,
  p_target text,
  p_payment_method text default 'card',
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_invoice public.invoices%rowtype;
  v_next_invoice public.invoices%rowtype;
  v_now timestamptz := now();
  v_payload jsonb;
  v_previous_status text;
  v_next_status text;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if p_target not in ('waiting', 'unpaid', 'paid', 'voided') then
    raise exception 'invoice_unavailable';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'transition_reason_required';
  end if;

  if p_payment_method not in ('card', 'cash', 'transfer', 'other') then
    raise exception 'invoice_unavailable';
  end if;

  select i.*
  into v_invoice
  from public.invoices i
  where i.workspace_id = p_workspace_id
    and i.id = p_invoice_id
  for update;

  if v_invoice.id is null then
    raise exception 'invoice_unavailable';
  end if;

  v_previous_status := private.clair_billing_lifecycle_status(
    v_invoice.status,
    v_invoice.payment_state,
    v_invoice.unpaid_reason
  );

  if p_target = 'paid' then
    update public.invoices
    set
      status = 'paid',
      payment_state = 'paid',
      selected_payment_method = p_payment_method,
      unpaid_reason = null,
      issued_at = coalesce(issued_at, v_now),
      paid_at = v_now,
      voided_at = null,
      voided_reason = null,
      updated_at = v_now
    where workspace_id = p_workspace_id and id = p_invoice_id
    returning * into v_next_invoice;

    insert into public.payments (
      workspace_id,
      invoice_id,
      payment_method,
      amount,
      status,
      paid_at,
      metadata,
      created_at
    )
    values (
      p_workspace_id,
      p_invoice_id,
      p_payment_method,
      v_next_invoice.total_amount,
      'approved',
      v_now,
      jsonb_build_object('prototype', true, 'source', 'billing_invoice_status_transition'),
      v_now
    )
    on conflict do nothing;
  elsif p_target = 'unpaid' then
    update public.invoices
    set
      status = 'issued',
      payment_state = 'unpaid',
      selected_payment_method = p_payment_method,
      unpaid_reason = nullif(btrim(p_reason), ''),
      issued_at = coalesce(issued_at, v_now),
      paid_at = null,
      voided_at = null,
      voided_reason = null,
      updated_at = v_now
    where workspace_id = p_workspace_id and id = p_invoice_id
    returning * into v_next_invoice;

    update public.payments
    set status = 'cancelled'
    where workspace_id = p_workspace_id
      and invoice_id = p_invoice_id
      and status = 'approved';
  elsif p_target = 'voided' then
    update public.invoices
    set
      status = 'voided',
      payment_state = 'none',
      paid_at = null,
      unpaid_reason = null,
      voided_at = v_now,
      voided_reason = nullif(btrim(p_reason), ''),
      updated_at = v_now
    where workspace_id = p_workspace_id and id = p_invoice_id
    returning * into v_next_invoice;

    update public.payments
    set status = 'cancelled'
    where workspace_id = p_workspace_id
      and invoice_id = p_invoice_id
      and status = 'approved';
  else
    update public.invoices
    set
      status = 'draft',
      payment_state = 'none',
      selected_payment_method = null,
      unpaid_reason = null,
      paid_at = null,
      voided_at = null,
      voided_reason = null,
      updated_at = v_now
    where workspace_id = p_workspace_id and id = p_invoice_id
    returning * into v_next_invoice;

    update public.payments
    set status = 'cancelled'
    where workspace_id = p_workspace_id
      and invoice_id = p_invoice_id
      and status = 'approved';
  end if;

  v_next_status := private.clair_billing_lifecycle_status(
    v_next_invoice.status,
    v_next_invoice.payment_state,
    v_next_invoice.unpaid_reason
  );

  insert into public.billing_invoice_status_transition_events (
    workspace_id,
    invoice_id,
    actor_user_id,
    previous_status,
    next_status,
    previous_payment_state,
    next_payment_state,
    amount_snapshot,
    reason,
    source,
    payment_side_effect,
    created_at
  )
  values (
    p_workspace_id,
    p_invoice_id,
    p_actor_user_id,
    v_previous_status,
    v_next_status,
    v_invoice.payment_state,
    v_next_invoice.payment_state,
    v_invoice.total_amount,
    nullif(btrim(p_reason), ''),
    'guardian_checkout',
    jsonb_build_object('target', p_target, 'paymentMethod', p_payment_method),
    v_now
  );

  select jsonb_build_object(
    'invoice',
    jsonb_build_object(
      'id', v_next_invoice.id,
      'workspaceId', v_next_invoice.workspace_id,
      'encounterId', v_next_invoice.encounter_id,
      'guardianId', v_next_invoice.guardian_id,
      'invoiceNo', v_next_invoice.invoice_no,
      'status', v_next_invoice.status,
      'paymentState', v_next_invoice.payment_state,
      'selectedPaymentMethod', v_next_invoice.selected_payment_method,
      'unpaidReason', v_next_invoice.unpaid_reason,
      'subtotalAmount', v_next_invoice.subtotal_amount,
      'discountAmount', v_next_invoice.discount_amount,
      'taxAmount', v_next_invoice.tax_amount,
      'totalAmount', v_next_invoice.total_amount,
      'issuedAt', v_next_invoice.issued_at,
      'paidAt', v_next_invoice.paid_at,
      'createdAt', v_next_invoice.created_at
    ),
    'payments',
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'invoiceId', p.invoice_id,
        'paymentMethod', p.payment_method,
        'amount', p.amount,
        'status', p.status,
        'paidAt', p.paid_at,
        'metadata', p.metadata
      ) order by p.paid_at desc, p.id)
      from public.payments p
      where p.workspace_id = p_workspace_id
        and p.invoice_id = p_invoice_id
    ), '[]'::jsonb),
    'auditEvent',
    jsonb_build_object(
      'eventType', 'billing.invoice_status_transitioned',
      'invoiceId', p_invoice_id,
      'actorUserId', p_actor_user_id,
      'previousStatus', v_previous_status,
      'targetStatus', v_next_status,
      'amountSnapshot', v_invoice.total_amount,
      'reason', nullif(btrim(p_reason), ''),
      'source', 'guardian_checkout',
      'transitionedAt', v_now
    )
  )
  into v_payload;

  return v_payload;
end;
$$;

revoke all on function public.clair_list_guardian_billing_ledger(text, uuid, boolean, text) from public;
revoke all on function public.clair_prepare_billing_checkout_session(text, uuid, uuid[], text, jsonb, text) from public;
revoke all on function public.clair_transition_billing_invoice_status(text, uuid, uuid, text, text, text) from public;

grant execute on function public.clair_list_guardian_billing_ledger(text, uuid, boolean, text) to authenticated;
grant execute on function public.clair_prepare_billing_checkout_session(text, uuid, uuid[], text, jsonb, text) to authenticated;
grant execute on function public.clair_transition_billing_invoice_status(text, uuid, uuid, text, text, text) to authenticated;

comment on column public.invoices.billing_requested_at is
  'Billing ledger activity date. Prefer chart Order 청구/candidate sync timestamp over issued/paid dates.';
comment on table public.billing_checkout_sessions is
  'Guardian-centered checkout session snapshot for local-first billing hardening.';
comment on function public.clair_list_guardian_billing_ledger(text, uuid, boolean, text) is
  'Returns guardian billing ledger rows with activity date and payable/excluded amount split.';
comment on function public.clair_prepare_billing_checkout_session(text, uuid, uuid[], text, jsonb, text) is
  'Prepares a local-first guardian checkout session and selected invoice amount snapshots.';
comment on function public.clair_transition_billing_invoice_status(text, uuid, uuid, text, text, text) is
  'Audited invoice status transition RPC for completed/cancelled billing history corrections.';
