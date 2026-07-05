-- HOME-PR-011: Home operations work-status aggregate reader.
-- Additive read-only RPC. No source workflow state is mutated here.

create index if not exists order_fulfillment_work_items_workspace_created_status_idx
  on public.order_fulfillment_work_items (workspace_id, created_at, status);

create index if not exists invoice_lines_workspace_created_idx
  on public.invoice_lines (workspace_id, created_at);

create index if not exists invoices_workspace_payment_created_idx
  on public.invoices (workspace_id, payment_state, created_at);

create or replace function public.clair_list_home_operations_work_items(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_operating_date date,
  p_scope text default 'all',
  p_include_completed boolean default false,
  p_include_cancelled boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_end_at timestamptz;
  v_items jsonb;
  v_start_at timestamptz;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if p_scope not in ('all', 'mine') then
    raise exception 'invalid_scope';
  end if;

  v_start_at := (p_operating_date::text || 'T00:00:00+09:00')::timestamptz;
  v_end_at := v_start_at + interval '1 day';

  with source_items as (
    select
      'appointment'::text as source_type,
      a.id::text as source_id,
      a.status::text as source_status,
      null::uuid as encounter_id,
      a.patient_id,
      a.guardian_id,
      coalesce(p.name || ' 예약 확인', '예약 확인') as title,
      p.name as patient_name,
      g.name as guardian_name,
      case
        when a.status in ('cancelled', 'no_show') then 'cancelled'
        when a.status = 'checked_in' then 'completed'
        else 'waiting'
      end as progress_state,
      null::uuid as assignee_user_id,
      'reception'::text as team_queue_id,
      '접수팀 큐'::text as team_queue_label,
      a.scheduled_start_at as requested_at,
      a.updated_at as state_entered_at,
      (a.scheduled_start_at at time zone 'Asia/Seoul')::date as source_operating_date,
      '/w/' || p_workspace_id || '/reception?appointmentId=' || a.id::text || '&modulePanel=open' as source_href,
      coalesce(a.visit_purpose, a.symptom_note, '예약 접수 상태를 확인합니다.') as drawer_summary,
      'normal'::text as priority
    from public.appointments a
    left join public.patients p
      on p.workspace_id = a.workspace_id
     and p.id = a.patient_id
    left join public.guardians g
      on g.workspace_id = a.workspace_id
     and g.id = a.guardian_id
    where a.workspace_id = p_workspace_id
      and (
        (a.scheduled_start_at >= v_start_at and a.scheduled_start_at < v_end_at)
        or (
          a.scheduled_start_at < v_start_at
          and a.status in ('requested', 'confirmed', 'changed')
        )
      )

    union all

    select
      case
        when w.queue_type = 'reception' then 'reception'
        when w.queue_type = 'billing' then 'billing'
        when w.queue_type = 'treatment' then 'treatment'
        else 'consultation'
      end as source_type,
      w.id::text as source_id,
      w.status::text as source_status,
      e.id as encounter_id,
      e.patient_id,
      e.guardian_id,
      case
        when w.queue_type = 'billing' then coalesce(p.name || ' 수납 대기', '수납 대기')
        when w.queue_type = 'treatment' then coalesce(p.name || ' 처치 대기', '처치 대기')
        when w.queue_type = 'reception' then coalesce(p.name || ' 접수 확인', '접수 확인')
        else coalesce(p.name || ' 진료 대기', '진료 대기')
      end as title,
      p.name as patient_name,
      g.name as guardian_name,
      case
        when w.status = 'cancelled' or e.status = 'cancelled' then 'cancelled'
        when w.status = 'done' or e.status in ('completed', 'ready_for_billing') then 'completed'
        when w.status in ('called', 'in_progress') or e.status in ('in_consultation', 'ordered') then 'in_progress'
        else 'waiting'
      end as progress_state,
      case when w.queue_type = 'consultation' then e.primary_veterinarian_id else null end as assignee_user_id,
      case
        when w.queue_type = 'billing' then 'billing'
        when w.queue_type = 'treatment' then 'treatment'
        when w.queue_type = 'reception' then 'reception'
        else 'consultation'
      end as team_queue_id,
      case
        when w.queue_type = 'billing' then '수납팀 큐'
        when w.queue_type = 'treatment' then '처치팀 큐'
        when w.queue_type = 'reception' then '접수팀 큐'
        else '진료 큐'
      end as team_queue_label,
      w.entered_at as requested_at,
      coalesce(w.finished_at, w.called_at, w.entered_at) as state_entered_at,
      (w.entered_at at time zone 'Asia/Seoul')::date as source_operating_date,
      case
        when w.queue_type = 'billing' then '/w/' || p_workspace_id || '/billing?encounterId=' || e.id::text || '&modulePanel=open'
        when w.queue_type = 'treatment' then '/w/' || p_workspace_id || '/dispensing?encounterId=' || e.id::text || '&modulePanel=open'
        else '/w/' || p_workspace_id || '/treatment?encounterId=' || e.id::text || '&modulePanel=open'
      end as source_href,
      coalesce(e.visit_purpose, e.chief_complaint, '접수 후 원내 대기 상태를 확인합니다.') as drawer_summary,
      w.priority::text as priority
    from public.waiting_queue_entries w
    join public.encounters e
      on e.workspace_id = w.workspace_id
     and e.id = w.encounter_id
    left join public.patients p
      on p.workspace_id = e.workspace_id
     and p.id = e.patient_id
    left join public.guardians g
      on g.workspace_id = e.workspace_id
     and g.id = e.guardian_id
    where w.workspace_id = p_workspace_id
      and (
        (w.entered_at >= v_start_at and w.entered_at < v_end_at)
        or (
          w.entered_at < v_start_at
          and w.status not in ('done', 'cancelled')
          and e.status <> 'cancelled'
        )
      )

    union all

    select
      item.queue_type::text as source_type,
      item.id::text as source_id,
      item.status::text as source_status,
      item.encounter_id,
      e.patient_id,
      e.guardian_id,
      coalesce(
        nullif(item.source_snapshot->>'orderDisplayName', ''),
        case item.queue_type
          when 'lab' then '임상병리 업무'
          when 'imaging' then '영상 업무'
          when 'dispensing' then '조제 업무'
          else '처치 업무'
        end
      ) as title,
      coalesce(nullif(item.source_snapshot->>'patientName', ''), p.name) as patient_name,
      coalesce(nullif(item.source_snapshot->>'guardianName', ''), g.name) as guardian_name,
      case
        when item.status = 'completed' then 'completed'
        when item.status = 'cancelled' then 'cancelled'
        when item.status = 'in_progress' then 'in_progress'
        else 'waiting'
      end as progress_state,
      item.assigned_to_user_id as assignee_user_id,
      item.queue_type::text as team_queue_id,
      case item.queue_type
        when 'lab' then '임상병리팀 큐'
        when 'imaging' then '영상팀 큐'
        when 'dispensing' then '조제팀 큐'
        else '처치팀 큐'
      end as team_queue_label,
      item.created_at as requested_at,
      coalesce(item.returned_at, item.completed_at, item.cancelled_at, item.updated_at, item.created_at) as state_entered_at,
      (item.created_at at time zone 'Asia/Seoul')::date as source_operating_date,
      case item.queue_type
        when 'lab' then '/w/' || p_workspace_id || '/lab?encounterId=' || item.encounter_id::text || '&modulePanel=open'
        when 'imaging' then '/w/' || p_workspace_id || '/imaging?encounterId=' || item.encounter_id::text || '&modulePanel=open'
        else '/w/' || p_workspace_id || '/dispensing?encounterId=' || item.encounter_id::text || '&modulePanel=open'
      end as source_href,
      coalesce(nullif(item.source_snapshot->>'instruction', ''), '오더 기반 업무 상태를 확인합니다.') as drawer_summary,
      item.priority::text as priority
    from public.order_fulfillment_work_items item
    join public.encounters e
      on e.workspace_id = item.workspace_id
     and e.id = item.encounter_id
    left join public.patients p
      on p.workspace_id = e.workspace_id
     and p.id = e.patient_id
    left join public.guardians g
      on g.workspace_id = e.workspace_id
     and g.id = e.guardian_id
    where item.workspace_id = p_workspace_id
      and (
        (item.created_at >= v_start_at and item.created_at < v_end_at)
        or (
          item.created_at < v_start_at
          and item.status not in ('completed', 'cancelled')
        )
      )

    union all

    select
      'billing'::text as source_type,
      il.id::text as source_id,
      concat(i.status, ':', i.payment_state)::text as source_status,
      i.encounter_id,
      e.patient_id,
      e.guardian_id,
      coalesce(il.description, p.name || ' 수납 요청', '수납 요청') as title,
      p.name as patient_name,
      g.name as guardian_name,
      case
        when i.status = 'paid' or i.payment_state = 'paid' then 'completed'
        when i.status in ('voided', 'refunded') or i.payment_state = 'refunded' then 'cancelled'
        when i.status = 'issued' or i.payment_state in ('unpaid', 'failed') then 'in_progress'
        else 'waiting'
      end as progress_state,
      null::uuid as assignee_user_id,
      'billing'::text as team_queue_id,
      '수납팀 큐'::text as team_queue_label,
      il.created_at as requested_at,
      coalesce(i.paid_at, i.issued_at, il.updated_at, il.created_at) as state_entered_at,
      (il.created_at at time zone 'Asia/Seoul')::date as source_operating_date,
      '/w/' || p_workspace_id || '/billing?encounterId=' || i.encounter_id::text || '&modulePanel=open' as source_href,
      '청구 후보 또는 수납 진행 상태를 확인합니다.'::text as drawer_summary,
      'normal'::text as priority
    from public.invoice_lines il
    join public.invoices i
      on i.workspace_id = il.workspace_id
     and i.id = il.invoice_id
    join public.encounters e
      on e.workspace_id = i.workspace_id
     and e.id = i.encounter_id
    left join public.patients p
      on p.workspace_id = e.workspace_id
     and p.id = e.patient_id
    left join public.guardians g
      on g.workspace_id = e.workspace_id
     and g.id = e.guardian_id
    left join public.orders o
      on o.workspace_id = il.workspace_id
     and o.id = il.order_id
    where il.workspace_id = p_workspace_id
      and coalesce(il.billing_candidate_id, o.billing_candidate_id) is not null
      and (
        (il.created_at >= v_start_at and il.created_at < v_end_at)
        or (
          il.created_at < v_start_at
          and i.status not in ('paid', 'voided', 'refunded')
          and i.payment_state <> 'paid'
        )
      )
  ),
  normalized as (
    select
      source_items.*,
      array_remove(array[
        case when priority = 'urgent' then 'urgent' end,
        case when source_status in ('returned', 're_requested') then 're_requested' end,
        case when assignee_user_id is null and team_queue_id is null then 'assignment_missing' end,
        case when assignee_user_id is null and team_queue_id is not null then 'team_queue' end,
        case
          when progress_state not in ('completed', 'cancelled')
           and state_entered_at < v_start_at then 'long_stay'
        end
      ]::text[], null) as attention_signals
    from source_items
  ),
  visible as (
    select *
    from normalized
    where (p_include_completed or progress_state <> 'completed')
      and (p_include_cancelled or progress_state <> 'cancelled')
      and (
        p_scope = 'all'
        or assignee_user_id = p_actor_user_id
        or team_queue_id is not null
      )
  )
  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'id', source_type || ':' || source_id,
        'workspaceId', p_workspace_id,
        'sourceType', source_type,
        'sourceId', source_id,
        'sourceStatus', source_status,
        'encounterId', encounter_id,
        'patientId', patient_id,
        'guardianId', guardian_id,
        'title', title,
        'patientName', patient_name,
        'guardianName', guardian_name,
        'progressState', progress_state,
        'attentionSignals', to_jsonb(attention_signals),
        'assigneeUserId', assignee_user_id,
        'teamQueueId', team_queue_id,
        'teamQueueLabel', team_queue_label,
        'requestedAt', requested_at,
        'stateEnteredAt', state_entered_at,
        'operatingDate', to_char(source_operating_date, 'YYYY-MM-DD'),
        'sourceHref', source_href,
        'drawerSummary', drawer_summary,
        'permissionMode', 'full'
      ))
      order by
        case
          when 'urgent' = any(attention_signals) then 0
          when 're_requested' = any(attention_signals) then 1
          when 'assignment_missing' = any(attention_signals) then 2
          when progress_state = 'in_progress' then 3
          when progress_state = 'waiting' then 4
          when progress_state = 'completed' then 5
          else 6
        end,
        coalesce(state_entered_at, requested_at),
        source_type,
        source_id
    ),
    '[]'::jsonb
  )
  into v_items
  from visible;

  return jsonb_build_object(
    'generatedAt', now(),
    'items', v_items,
    'sourceStatus', case when jsonb_array_length(v_items) = 0 then 'empty' else 'live' end
  );
end;
$$;

revoke all on function public.clair_list_home_operations_work_items(text, uuid, date, text, boolean, boolean)
  from public, anon;

grant execute on function public.clair_list_home_operations_work_items(text, uuid, date, text, boolean, boolean)
  to authenticated;

comment on function public.clair_list_home_operations_work_items(text, uuid, date, text, boolean, boolean) is
  'Read-only Home operations board aggregate for selected operating-day reception, fulfillment, and billing work items.';
