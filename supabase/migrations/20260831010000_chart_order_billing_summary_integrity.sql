-- CLINICAL-BILLING-PR-019: close the remaining integrity gaps in the
-- encounter-scoped Plan/Order billing summary. Fixed/range Order Sets bill
-- their aggregate parent once, voided invoice money is ignored, and aggregate
-- tasks participate in unfinished-work warnings.

set lock_timeout = '5s';
set statement_timeout = '120s';

create or replace function private.clair_assert_set_parent_billing_candidate_integrity(
  p_workspace_id text,
  p_order_id uuid,
  p_require_completed_command boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_order public.orders%rowtype;
  v_task public.order_tasks%rowtype;
  v_command public.order_confirmation_commands%rowtype;
  v_candidate public.order_billing_candidates%rowtype;
  v_expected_billing_name text;
begin
  select orders.*
  into v_order
  from public.orders orders
  where orders.workspace_id = p_workspace_id
    and orders.id = p_order_id
    and orders.row_type = 'set'
    and orders.status <> 'cancelled'
    and orders.order_confirmation_status in ('confirmed','billed')
    and orders.billing_eligible
    and orders.billing_reflection_enabled
    and orders.line_total_snapshot > 0
    and orders.applied_price_snapshot ->> 'billedAs' = 'set_parent';

  if not found then
    return;
  end if;

  select task.*
  into v_task
  from public.order_tasks task
  where task.workspace_id = v_order.workspace_id
    and task.order_id = v_order.id
    and task.task_role = 'aggregate'
    and task.attempt_no = 1;

  if not found then
    raise exception 'set_parent_billing_candidate_integrity_mismatch:%', p_order_id;
  end if;

  select command.*
  into v_command
  from public.order_confirmation_commands command
  where command.workspace_id = v_order.workspace_id
    and command.encounter_id = v_order.encounter_id
    and (
      not p_require_completed_command
      or command.status = 'completed'
    )
    and v_order.id = any(command.selected_root_order_ids)
    and command.id::text = coalesce(
      nullif(v_order.confirmed_snapshot ->> 'confirmationCommandId', ''),
      case when v_task.effective_snapshot ? 'legacyBackfill' then
        private.clair_chart_order_backfill_uuid(
          'chart-order-backfill-command-v1|' || v_order.workspace_id || '|' || v_order.id::text
        )::text
      end
    );

  if not found then
    raise exception 'set_parent_billing_candidate_integrity_mismatch:%', p_order_id;
  end if;

  select candidate.*
  into v_candidate
  from public.order_billing_candidates candidate
  where candidate.workspace_id = v_order.workspace_id
    and candidate.order_id = v_order.id;

  v_expected_billing_name := coalesce(
    nullif(v_order.applied_snapshot ->> 'billingName', ''),
    nullif(v_order.applied_snapshot ->> 'inHospitalOrderName', ''),
    'Order ' || v_order.id::text
  );

  if not found
     or v_candidate.id is distinct from 'billcand-' || v_order.id::text
     or v_candidate.workspace_id is distinct from v_order.workspace_id
     or v_candidate.encounter_id is distinct from v_order.encounter_id
     or v_candidate.order_id is distinct from v_order.id
     or v_candidate.task_id is distinct from v_task.id
     or v_candidate.task_attempt_no is distinct from v_task.attempt_no
     or v_candidate.confirmation_command_id is distinct from v_command.id
     or v_candidate.created_by_user_id is distinct from v_command.actor_user_id
     or v_candidate.billing_name_snapshot is distinct from v_expected_billing_name
     or v_candidate.quantity is distinct from v_order.quantity
     or v_candidate.unit_price is distinct from coalesce(v_order.unit_price_snapshot, 0)
     or v_candidate.amount is distinct from v_order.line_total_snapshot
     or v_candidate.currency is distinct from 'KRW'
     or v_candidate.source_snapshot is distinct from (case
       when v_task.effective_snapshot ? 'legacyBackfill' then v_task.effective_snapshot
       else v_order.confirmed_snapshot
     end)
     or v_candidate.invoice_line_id is distinct from v_order.invoice_line_id
     or v_candidate.status is distinct from (case
       when v_order.invoice_line_id is null then 'candidate_created'
       else 'invoice_linked'
     end) then
    raise exception 'set_parent_billing_candidate_integrity_mismatch:%', p_order_id;
  end if;

  if v_order.invoice_line_id is not null and not exists (
    select 1
    from public.invoice_lines line
    join public.invoices invoice
      on invoice.workspace_id = line.workspace_id
     and invoice.id = line.invoice_id
    where line.id = v_order.invoice_line_id
      and line.workspace_id = v_order.workspace_id
      and line.order_id = v_order.id
      and line.billing_candidate_id = v_candidate.id
      and line.quantity = v_candidate.quantity
      and line.line_total = v_candidate.amount
      and invoice.encounter_id = v_order.encounter_id
  ) then
    raise exception 'set_parent_billing_candidate_integrity_mismatch:%', p_order_id;
  end if;
end;
$function$;

revoke all on function private.clair_assert_set_parent_billing_candidate_integrity(text,uuid,boolean)
  from public, anon, authenticated, service_role;

create or replace function private.clair_create_set_parent_billing_candidate()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if new.task_role <> 'aggregate' or new.attempt_no <> 1 then
    return new;
  end if;

  insert into public.order_billing_candidates(
    id, workspace_id, encounter_id, order_id, task_id, task_attempt_no,
    billing_name_snapshot, quantity, unit_price, amount, source_snapshot,
    created_by_user_id, confirmation_command_id, created_at, updated_at
  )
  select
    'billcand-' || orders.id::text,
    orders.workspace_id,
    orders.encounter_id,
    orders.id,
    new.id,
    new.attempt_no,
    coalesce(
      nullif(orders.applied_snapshot ->> 'billingName', ''),
      nullif(orders.applied_snapshot ->> 'inHospitalOrderName', ''),
      'Order ' || orders.id::text
    ),
    orders.quantity,
    coalesce(orders.unit_price_snapshot, 0),
    orders.line_total_snapshot,
    case
      when new.effective_snapshot ? 'legacyBackfill' then new.effective_snapshot
      else orders.confirmed_snapshot
    end,
    command.actor_user_id,
    command.id,
    new.created_at,
    new.created_at
  from public.orders orders
  join public.order_confirmation_commands command
    on command.workspace_id = orders.workspace_id
   and command.encounter_id = orders.encounter_id
   and command.status in ('processing','completed')
   and orders.id = any(command.selected_root_order_ids)
   and command.id::text = coalesce(
     nullif(orders.confirmed_snapshot ->> 'confirmationCommandId', ''),
     case when new.effective_snapshot ? 'legacyBackfill' then
       private.clair_chart_order_backfill_uuid(
         'chart-order-backfill-command-v1|' || orders.workspace_id || '|' || orders.id::text
       )::text
     end
   )
  where orders.workspace_id = new.workspace_id
    and orders.encounter_id = new.encounter_id
    and orders.id = new.order_id
    and orders.row_type = 'set'
    and orders.status <> 'cancelled'
    and orders.order_confirmation_status in ('confirmed','billed')
    and orders.billing_eligible
    and orders.billing_reflection_enabled
    and orders.line_total_snapshot > 0
    and orders.applied_price_snapshot ->> 'billedAs' = 'set_parent'
  on conflict (workspace_id, order_id) do nothing;

  perform private.clair_assert_set_parent_billing_candidate_integrity(
    new.workspace_id,
    new.order_id,
    false
  );

  return new;
end;
$function$;

revoke all on function private.clair_create_set_parent_billing_candidate()
  from public, anon, authenticated, service_role;

drop trigger if exists chart_order_set_parent_billing_candidate
  on public.order_tasks;
create trigger chart_order_set_parent_billing_candidate
after insert on public.order_tasks
for each row
when (new.task_role = 'aggregate' and new.attempt_no = 1)
execute function private.clair_create_set_parent_billing_candidate();

-- Repair already-confirmed fixed/range parents using their original immutable
-- confirmation command and aggregate task. Sum-price parents remain nonbillable.
insert into public.order_billing_candidates(
  id, workspace_id, encounter_id, order_id, task_id, task_attempt_no,
  status, billing_name_snapshot, quantity, unit_price, amount, source_snapshot,
  created_by_user_id, confirmation_command_id, invoice_line_id,
  created_at, updated_at
)
select
  'billcand-' || orders.id::text,
  orders.workspace_id,
  orders.encounter_id,
  orders.id,
  task.id,
  task.attempt_no,
  case when orders.invoice_line_id is null then 'candidate_created' else 'invoice_linked' end,
  coalesce(
    nullif(orders.applied_snapshot ->> 'billingName', ''),
    nullif(orders.applied_snapshot ->> 'inHospitalOrderName', ''),
    'Order ' || orders.id::text
  ),
  orders.quantity,
  coalesce(orders.unit_price_snapshot, 0),
  orders.line_total_snapshot,
  case
    when task.effective_snapshot ? 'legacyBackfill' then task.effective_snapshot
    else orders.confirmed_snapshot
  end,
  command.actor_user_id,
  command.id,
  orders.invoice_line_id,
  coalesce(orders.confirmed_at, task.created_at),
  now()
from public.orders orders
join public.order_tasks task
  on task.workspace_id = orders.workspace_id
 and task.order_id = orders.id
 and task.task_role = 'aggregate'
 and task.attempt_no = 1
join public.order_confirmation_commands command
  on command.workspace_id = orders.workspace_id
 and command.encounter_id = orders.encounter_id
 and command.status = 'completed'
 and orders.id = any(command.selected_root_order_ids)
 and command.id::text = coalesce(
   nullif(orders.confirmed_snapshot ->> 'confirmationCommandId', ''),
   case when task.effective_snapshot ? 'legacyBackfill' then
     private.clair_chart_order_backfill_uuid(
       'chart-order-backfill-command-v1|' || orders.workspace_id || '|' || orders.id::text
     )::text
   end
 )
where orders.row_type = 'set'
  and orders.status <> 'cancelled'
  and orders.order_confirmation_status in ('confirmed','billed')
  and orders.billing_eligible
  and orders.billing_reflection_enabled
  and orders.line_total_snapshot > 0
  and orders.applied_price_snapshot ->> 'billedAs' = 'set_parent'
on conflict (workspace_id, order_id) do nothing;

update public.orders orders
set
  billing_candidate_status = candidate.status,
  billing_candidate_id = candidate.id,
  updated_at = now()
from public.order_billing_candidates candidate
where candidate.workspace_id = orders.workspace_id
  and candidate.order_id = orders.id
  and orders.row_type = 'set'
  and orders.applied_price_snapshot ->> 'billedAs' = 'set_parent'
  and (
    orders.billing_candidate_status is distinct from candidate.status
    or orders.billing_candidate_id is distinct from candidate.id
  );

insert into public.audit_events(
  id, workspace_id, actor_user_id, actor_membership_id,
  event_type, target_type, target_id, encounter_id, request_id,
  before_snapshot, after_snapshot, metadata, occurred_at, created_at
)
select
  'billing-candidate-' || candidate.confirmation_command_id::text || '-' || candidate.order_id::text,
  candidate.workspace_id,
  candidate.created_by_user_id,
  membership.id,
  'order.billing_candidate_requested',
  'order_billing_candidate',
  candidate.id,
  candidate.encounter_id,
  candidate.confirmation_command_id::text,
  '{}'::jsonb,
  candidate.source_snapshot || jsonb_build_object(
    'billingCandidateId', candidate.id,
    'amount', candidate.amount,
    'status', candidate.status
  ),
  jsonb_build_object('source', 'chart-order-billing-summary-integrity-v1'),
  candidate.created_at,
  now()
from public.order_billing_candidates candidate
join public.orders orders
  on orders.workspace_id = candidate.workspace_id
 and orders.id = candidate.order_id
left join lateral (
  select active_membership.id
  from public.user_memberships active_membership
  where active_membership.workspace_id = candidate.workspace_id
    and active_membership.user_id = candidate.created_by_user_id
    and active_membership.status = 'active'
  order by active_membership.created_at, active_membership.id
  limit 1
) membership on true
where orders.row_type = 'set'
  and orders.applied_price_snapshot ->> 'billedAs' = 'set_parent'
on conflict (id) do nothing;

-- Completed idempotency results must reflect the repaired candidate list so a
-- replay returns the same durable state as a fresh confirmation.
update public.order_confirmation_commands command
set result = jsonb_set(
  command.result,
  '{billingCandidates}',
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'billingCandidateId', candidate.id,
      'orderId', candidate.order_id,
      'taskId', candidate.task_id,
      'status', candidate.status,
      'billingName', candidate.billing_name_snapshot,
      'quantity', candidate.quantity,
      'unitPrice', candidate.unit_price,
      'amount', candidate.amount,
      'currency', candidate.currency,
      'createdAt', candidate.created_at
    ) order by candidate.order_id)
    from public.order_billing_candidates candidate
    where candidate.workspace_id = command.workspace_id
      and candidate.confirmation_command_id = command.id
  ), '[]'::jsonb),
  true
)
where command.status = 'completed'
  and command.result is not null
  and exists (
    select 1
    from public.order_billing_candidates candidate
    join public.orders orders
      on orders.workspace_id = candidate.workspace_id
     and orders.id = candidate.order_id
    where candidate.workspace_id = command.workspace_id
      and candidate.confirmation_command_id = command.id
      and orders.row_type = 'set'
      and orders.applied_price_snapshot ->> 'billedAs' = 'set_parent'
  );

do $block$
declare
  v_order record;
begin
  for v_order in
    select orders.workspace_id, orders.id
    from public.orders orders
    where orders.row_type = 'set'
      and orders.status <> 'cancelled'
      and orders.order_confirmation_status in ('confirmed','billed')
      and orders.billing_eligible
      and orders.billing_reflection_enabled
      and orders.line_total_snapshot > 0
      and orders.applied_price_snapshot ->> 'billedAs' = 'set_parent'
  loop
    begin
      perform private.clair_assert_set_parent_billing_candidate_integrity(
        v_order.workspace_id,
        v_order.id,
        true
      );
    exception when others then
      raise exception 'set_parent_billing_candidate_backfill_incomplete:%', v_order.id
        using detail = sqlerrm;
    end;
  end loop;

  if exists (
    select 1
    from public.orders orders
    join public.order_billing_candidates candidate
      on candidate.workspace_id = orders.workspace_id
     and candidate.order_id = orders.id
    where orders.row_type = 'set'
      and orders.applied_price_snapshot ->> 'billedAs' = 'set_parent'
      and (
        orders.billing_candidate_status is distinct from candidate.status
        or orders.billing_candidate_id is distinct from candidate.id
      )
  ) then
    raise exception 'set_parent_billing_candidate_backfill_incomplete';
  end if;

  if exists (
    select 1
    from public.order_billing_candidates candidate
    join public.orders orders
      on orders.workspace_id = candidate.workspace_id
     and orders.id = candidate.order_id
    where orders.row_type = 'set'
      and orders.applied_price_snapshot ->> 'billedAs' = 'nonbillable_parent'
  ) then
    raise exception 'sum_set_parent_billing_candidate_detected';
  end if;
end;
$block$;

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
    'recheck', count(*) filter (where o.status = 're_requested'),
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
      and o.row_type in ('individual','set_child','set')
      and (
        o.row_type <> 'set'
        or o.applied_price_snapshot ->> 'billedAs' = 'set_parent'
      )
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
      and i.status <> 'voided'
      and p.status = 'approved'
  ), surcharge_totals as (
    select coalesce(sum(a.amount), 0) surcharge
    from public.invoice_adjustments a
    join public.invoices i on i.workspace_id = a.workspace_id and i.id = a.invoice_id
    where a.workspace_id = p_workspace_id
      and i.encounter_id = p_encounter_id
      and i.status <> 'voided'
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
      and latest.task_role in ('execution','aggregate')
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

revoke all on function private.clair_get_chart_order_billing_summary_internal(text, uuid)
  from public, anon, authenticated, service_role;

comment on function private.clair_get_chart_order_billing_summary_internal(text, uuid) is
  'Internal encounter-scoped Plan/Order billing summary with set-parent and voided-invoice integrity guarantees.';
