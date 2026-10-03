-- HOME-PR-014 / audit item5. Apply before the application; retain old readers
-- and fulfillment v2 unchanged for rollback and exact-day source/detail reads.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Matches Home's server predicate: selected Seoul day plus earlier unfinished
-- work. Terminal inclusion is based on source operating time, not completion time.
create or replace function private.clair_home_includes_source(
  p_at timestamptz, p_state text, p_date date,
  p_include_completed boolean, p_include_cancelled boolean
) returns boolean language sql immutable security invoker set search_path = pg_catalog
as $$
  select p_at < (p_date + 1)::timestamp at time zone 'Asia/Seoul'
    and (p_state not in ('completed', 'cancelled') or (
      p_at >= p_date::timestamp at time zone 'Asia/Seoul'
      and ((p_state = 'completed' and p_include_completed)
        or (p_state = 'cancelled' and p_include_cancelled))
    ));
$$;
revoke all on function private.clair_home_includes_source(timestamptz,text,date,boolean,boolean)
  from public, anon, authenticated, service_role;

-- Internal shared source set for context dependencies and the compact queue
-- reader. No direct client grant; called only by the permission-checked definers.
create or replace function private.clair_home_fulfillment_source_rows(
  p_workspace_id text, p_date date, p_include_completed boolean, p_include_cancelled boolean
) returns setof public.order_fulfillment_work_items
language sql stable security invoker set search_path = pg_catalog
as $$
  with allowed_queues as materialized (
    select q from unnest(array['lab','imaging','dispensing','treatment']) q
    where private.clair_current_user_has_workspace_permission(
      p_workspace_id, private.clair_queue_permission_for_destination(q, 'read'))
  )
  select item.* from public.order_fulfillment_work_items item
  join allowed_queues on allowed_queues.q = item.queue_type
  join public.encounters e on e.workspace_id = item.workspace_id and e.id = item.encounter_id
  where item.workspace_id = p_workspace_id
    and private.clair_home_includes_source(coalesce(item.due_at, item.created_at),
      case when item.status in ('completed','cancelled') then item.status else 'waiting' end,
      p_date, p_include_completed, p_include_cancelled);
$$;
revoke all on function private.clair_home_fulfillment_source_rows(text,date,boolean,boolean)
  from public, anon, authenticated, service_role;

create or replace function private.clair_get_home_operations_source_snapshot_v2(
  p_workspace_id text, p_date date,
  p_include_completed boolean default false, p_include_cancelled boolean default false
) returns jsonb language plpgsql stable security definer set search_path = pg_catalog
as $$
declare
  v_chart boolean;
  v_billing boolean;
  v_rows jsonb;
begin
  if auth.uid() is null or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'reception:view') then
    raise exception 'home_permission_denied' using errcode = '42501';
  end if;
  if p_date is null or p_include_completed is null or p_include_cancelled is null then
    raise exception 'invalid_home_filters' using errcode = '22023';
  end if;
  v_chart := private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view');
  v_billing := private.clair_current_user_has_workspace_permission(p_workspace_id, 'billing:view');

  with appointments as materialized (
    select r.* from public.appointments r where r.workspace_id = p_workspace_id
      and private.clair_home_includes_source(coalesce(r.scheduled_start_at, r.created_at),
        case when r.status = 'checked_in' then 'completed'
          when r.status in ('cancelled','no_show') then 'cancelled' else 'waiting' end,
        p_date, p_include_completed, p_include_cancelled)
  ), queues as materialized (
    select r.* from public.waiting_queue_entries r
    join public.encounters e on e.workspace_id = r.workspace_id and e.id = r.encounter_id
    where r.workspace_id = p_workspace_id
      and (r.queue_type = 'reception' or (r.queue_type = 'consultation' and v_chart))
      and private.clair_home_includes_source(r.entered_at,
        case when r.status = 'cancelled' or e.status = 'cancelled' then 'cancelled'
          when r.status = 'done' or e.status in ('completed','ready_for_billing') then 'completed'
          else 'waiting' end, p_date, p_include_completed, p_include_cancelled)
  ), invoices as materialized (
    select r.* from public.invoices r
    cross join lateral (
      select min(l.created_at) as first_line_at,
        bool_or(l.billing_candidate_id is not null or o.billing_candidate_id is not null) as has_candidate
      from public.invoice_lines l
      left join public.orders o on o.workspace_id = l.workspace_id and o.id = l.order_id
      where l.workspace_id = p_workspace_id and l.invoice_id = r.id
    ) lines
    where r.workspace_id = p_workspace_id and v_billing and lines.has_candidate
      and private.clair_home_includes_source(coalesce(r.billing_requested_at, lines.first_line_at, r.created_at),
        case when r.status = 'paid' or r.payment_state = 'paid' then 'completed'
          when r.status in ('voided','refunded') or r.payment_state = 'refunded' then 'cancelled'
          else 'waiting' end, p_date, p_include_completed, p_include_cancelled)
  ), fulfillment as materialized (
    select * from private.clair_home_fulfillment_source_rows(p_workspace_id, p_date, p_include_completed, p_include_cancelled)
  ), encounter_ids as (
    select r.id from public.encounters r where r.workspace_id = p_workspace_id
      and (
        -- Current presence ignores selected day and flags. Keep all active
        -- encounters, including future checked-in times (JS uses real now).
        r.status in ('waiting','in_consultation','ordered','ready_for_billing')
        or private.clair_home_includes_source(r.checked_in_at,
          case when r.status = 'waiting' then 'waiting'
            when r.status = 'cancelled' then 'cancelled' else 'completed' end,
          p_date, p_include_completed, p_include_cancelled)
      )
    union select r.id from public.encounters r join appointments a on a.id = r.appointment_id
      where r.workspace_id = p_workspace_id
    union select encounter_id from queues
    union select encounter_id from invoices
    union select encounter_id from fulfillment
  ), encounters as materialized (
    select r.* from public.encounters r join encounter_ids i on i.id = r.id where r.workspace_id = p_workspace_id
  ), retained_queues as materialized (
    select * from queues
    union
    -- Preserve reception suppression even when the queue itself is terminal or
    -- outside the day. Otherwise an encounter dependency invents reception work.
    select q.* from public.waiting_queue_entries q join encounters e on e.id = q.encounter_id
      where q.workspace_id = p_workspace_id and q.queue_type = 'reception'
  ), invoice_lines as materialized (
    -- All lines determine count, totals and fallback timestamps, not just anchors.
    select r.* from public.invoice_lines r join invoices i on i.id = r.invoice_id where r.workspace_id = p_workspace_id
  ), patient_ids as (
    select patient_id id from appointments union select patient_id from encounters
  ), guardian_ids as (
    select guardian_id id from appointments union select guardian_id from encounters union select guardian_id from invoices
  )
  select jsonb_build_object(
    'appointments', coalesce((select jsonb_agg(to_jsonb(page) order by page.id) from (
      select r.id, r.workspace_id, r.patient_id, r.guardian_id, r.scheduled_start_at, r.visit_purpose, r.symptom_note,
        r.status, r.created_by_user_id, r.created_at, r.updated_at,
        coalesce((select jsonb_agg(a.assignee_user_id order by a.assignee_user_id) from public.appointment_staff_assignments a
          where a.workspace_id = p_workspace_id and a.appointment_id = r.id), '[]'::jsonb) as assigned_staff_user_ids
      from appointments r) page), '[]'::jsonb),
    'encounters', coalesce((select jsonb_agg(to_jsonb(page) order by page.id) from (
      select r.id, r.workspace_id, r.patient_id, r.guardian_id, r.appointment_id, r.primary_veterinarian_id,
        r.reception_type, r.chief_complaint, r.visit_purpose, r.status, r.checked_in_at, r.checked_in_by_user_id,
        coalesce((select jsonb_agg(a.assignee_user_id order by a.assignee_user_id) from public.encounter_staff_assignments a
          where a.workspace_id = p_workspace_id and a.encounter_id = r.id), '[]'::jsonb) as assigned_staff_user_ids
      from encounters r) page), '[]'::jsonb),
    'waiting_queue_entries', coalesce((select jsonb_agg(to_jsonb(page) order by page.id) from (
      select r.id, r.workspace_id, r.encounter_id, r.queue_type, r.status, r.priority, r.entered_at, r.called_at, r.finished_at
      from retained_queues r) page), '[]'::jsonb),
    'patients', coalesce((select jsonb_agg(to_jsonb(page) order by page.id) from (
      select r.id, r.workspace_id, r.name from public.patients r join patient_ids i on i.id = r.id
      where r.workspace_id = p_workspace_id) page), '[]'::jsonb),
    'guardians', coalesce((select jsonb_agg(to_jsonb(page) order by page.id) from (
      select r.id, r.workspace_id, r.name from public.guardians r join guardian_ids i on i.id = r.id
      where r.workspace_id = p_workspace_id) page), '[]'::jsonb),
    'invoices', coalesce((select jsonb_agg(to_jsonb(page) order by page.id) from (
      select r.id, r.workspace_id, r.encounter_id, r.guardian_id, r.invoice_no, r.status, r.total_amount,
        r.issued_at, r.paid_at, r.payment_state, r.billing_requested_at, r.created_at from invoices r) page), '[]'::jsonb),
    'invoice_lines', coalesce((select jsonb_agg(to_jsonb(page) order by page.id) from (
      select r.id, r.workspace_id, r.invoice_id, r.order_id, r.line_total, r.billing_candidate_id, r.created_at, r.updated_at
      from invoice_lines r) page), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(to_jsonb(page) order by page.id) from (
      select r.id, r.workspace_id, r.billing_candidate_id from public.orders r
      where r.workspace_id = p_workspace_id and r.billing_candidate_id is not null
        and exists (select 1 from invoice_lines l where l.order_id = r.id)) page), '[]'::jsonb),
    'user_memberships', coalesce((select jsonb_agg(to_jsonb(page) order by page.id) from (
      select r.id, r.workspace_id, r.user_id,
        (select jsonb_build_object('display_name', u.display_name) from public.users u where u.id = r.user_id) as users
      from public.user_memberships r where r.workspace_id = p_workspace_id) page), '[]'::jsonb)
  ) into v_rows;
  return v_rows;
end;
$$;
revoke all on function private.clair_get_home_operations_source_snapshot_v2(text,date,boolean,boolean)
  from public, anon, authenticated, service_role;
grant execute on function private.clair_get_home_operations_source_snapshot_v2(text,date,boolean,boolean) to authenticated;

create or replace function public.clair_get_home_operations_source_snapshot_v2(
  p_workspace_id text, p_date date,
  p_include_completed boolean default false, p_include_cancelled boolean default false
) returns jsonb language sql stable security invoker set search_path = pg_catalog
as $$ select private.clair_get_home_operations_source_snapshot_v2(p_workspace_id, p_date, p_include_completed, p_include_cancelled); $$;
revoke all on function public.clair_get_home_operations_source_snapshot_v2(text,date,boolean,boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.clair_get_home_operations_source_snapshot_v2(text,date,boolean,boolean) to authenticated;

create or replace function private.clair_list_home_fulfillment_work_items(
  p_workspace_id text, p_queue_type text, p_date date,
  p_include_completed boolean default false, p_include_cancelled boolean default false
) returns jsonb language plpgsql stable security definer set search_path = pg_catalog
as $$
declare v_rows jsonb;
begin
  if auth.uid() is null or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'reception:view') then
    raise exception 'home_permission_denied' using errcode = '42501';
  end if;
  if p_date is null or p_include_completed is null or p_include_cancelled is null or p_queue_type is null
    or p_queue_type not in ('lab','imaging','dispensing','treatment') then
    raise exception 'invalid_home_filters' using errcode = '22023';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id,
    private.clair_queue_permission_for_destination(p_queue_type, 'read')) then
    raise exception 'permission_missing' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(page) order by page.updated_at desc, page.id), '[]'::jsonb) into v_rows
  from (
    select item.id, item.workspace_id, e.patient_id, item.encounter_id, item.queue_type, item.status, item.priority,
      item.requested_by_user_id, item.assigned_to_user_id, item.due_at, item.created_at, item.updated_at,
      item.returned_at, item.completed_at, item.cancelled_at,
      -- Frozen display values retain precedence over current context. Only the
      -- consumed snapshot keys leave the DB; full details remain in source RPCs.
      jsonb_build_object('orderDisplayName', item.source_snapshot->'orderDisplayName',
        'billingName', item.source_snapshot->'billingName', 'patientName', item.source_snapshot->'patientName',
        'guardianName', item.source_snapshot->'guardianName', 'requestingVetName', item.source_snapshot->'requestingVetName',
        'instruction', item.source_snapshot->'instruction', 'receptionType', item.source_snapshot->'receptionType',
        'reception_type', item.source_snapshot->'reception_type',
        'detail', jsonb_build_object('modality', item.source_snapshot->'detail'->'modality')) as source_snapshot
    from private.clair_home_fulfillment_source_rows(p_workspace_id, p_date, p_include_completed, p_include_cancelled) item
    join public.encounters e on e.workspace_id = item.workspace_id and e.id = item.encounter_id
    where item.queue_type = p_queue_type
  ) page;
  return v_rows;
end;
$$;
revoke all on function private.clair_list_home_fulfillment_work_items(text,text,date,boolean,boolean)
  from public, anon, authenticated, service_role;
grant execute on function private.clair_list_home_fulfillment_work_items(text,text,date,boolean,boolean) to authenticated;

create or replace function public.clair_list_home_fulfillment_work_items(
  p_workspace_id text, p_queue_type text, p_date date,
  p_include_completed boolean default false, p_include_cancelled boolean default false
) returns jsonb language sql stable security invoker set search_path = pg_catalog
as $$ select private.clair_list_home_fulfillment_work_items(p_workspace_id, p_queue_type, p_date, p_include_completed, p_include_cancelled); $$;
revoke all on function public.clair_list_home_fulfillment_work_items(text,text,date,boolean,boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.clair_list_home_fulfillment_work_items(text,text,date,boolean,boolean) to authenticated;

comment on function public.clair_get_home_operations_source_snapshot_v2(text,date,boolean,boolean) is
  'Complete, permission-gated Home operational sources and dependencies. Seoul selected day plus earlier unfinished work; current presence independent of date; one scalar JSON snapshot without offset or row cap. No writes.';
comment on function public.clair_list_home_fulfillment_work_items(text,text,date,boolean,boolean) is
  'Compact Home fulfillment read: Seoul dueAt-first day plus all earlier unfinished work, terminal flags, destination and Home permissions. Full source/detail readers unchanged; no writes.';
commit;
