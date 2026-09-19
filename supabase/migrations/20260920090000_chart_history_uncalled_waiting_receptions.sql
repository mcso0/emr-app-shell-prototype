-- CHART-PR-037: surface an uncalled waiting reception in patient chart history.
-- Existing chart rows keep immutable chart-created ordering. A chartless waiting
-- reception uses its check-in timestamp and encounter id as the stable cursor key.

create or replace function public.clair_list_chart_patient_history(
  p_workspace_id text,
  p_patient_id uuid,
  p_cursor text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 50);
  v_cursor_at timestamptz;
  v_cursor_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if not private.clair_current_user_has_workspace_permission(
    p_workspace_id,
    'chart:view'
  ) then
    raise exception 'permission_missing';
  end if;

  if not exists (
    select 1
    from public.patients p
    where p.workspace_id = p_workspace_id
      and p.id = p_patient_id
      and p.status <> 'soft_deleted'
  ) then
    raise exception 'patient_unavailable';
  end if;

  if p_cursor is not null and p_cursor <> '' then
    begin
      v_cursor_at := (
        convert_from(decode(p_cursor, 'base64'), 'UTF8')::jsonb ->> 'at'
      )::timestamptz;
      v_cursor_id := (
        convert_from(decode(p_cursor, 'base64'), 'UTF8')::jsonb ->> 'id'
      )::uuid;
    exception
      when others then
        raise exception 'invalid_cursor';
    end;
  end if;

  with history_refs as (
    select
      s.id as history_id,
      s.created_at as history_at,
      s.id as chart_id,
      e.id as encounter_id,
      null::uuid as queue_entry_id
    from public.soap_notes s
    join public.encounters e
      on e.workspace_id = s.workspace_id
     and e.id = s.encounter_id
    where e.workspace_id = p_workspace_id
      and e.patient_id = p_patient_id
      and s.status <> 'voided'

    union all

    select
      e.id as history_id,
      coalesce(e.checked_in_at, e.created_at) as history_at,
      null::uuid as chart_id,
      e.id as encounter_id,
      q.id as queue_entry_id
    from public.encounters e
    join public.waiting_queue_entries q
      on q.workspace_id = e.workspace_id
     and q.encounter_id = e.id
     and q.queue_type = 'consultation'
     and q.status = 'waiting'
    where e.workspace_id = p_workspace_id
      and e.patient_id = p_patient_id
      and e.status = 'waiting'
      and not exists (
        select 1
        from public.soap_notes existing_chart
        where existing_chart.workspace_id = e.workspace_id
          and existing_chart.encounter_id = e.id
          and existing_chart.status <> 'voided'
      )
  ), base as (
    select
      history_refs.history_id,
      history_refs.history_at,
      case
        when s.id is null then null
        else private.clair_chart_note_json(s)
      end as chart,
      e.id,
      e.workspace_id,
      e.patient_id,
      e.guardian_id,
      e.appointment_id,
      e.primary_veterinarian_id,
      e.encounter_no,
      e.reception_type,
      e.department,
      e.duration_minutes,
      e.chief_complaint,
      e.visit_purpose,
      e.reception_memo,
      e.status,
      e.checked_in_at,
      e.checked_in_by_user_id,
      e.started_at,
      e.chart_completed_at,
      e.chart_completed_by_user_id,
      e.completed_at,
      e.created_at,
      e.updated_at,
      g.id as guardian_record_id,
      g.name as guardian_name,
      g.mobile_phone as guardian_mobile_phone,
      g.phone as guardian_phone,
      g.email::text as guardian_email,
      g.birth_date as guardian_birth_date,
      g.address as guardian_address,
      g.occupation as guardian_occupation,
      g.memo as guardian_memo,
      g.created_at as guardian_created_at,
      g.updated_at as guardian_updated_at,
      u.display_name as veterinarian_name,
      q.id as queue_record_id,
      q.queue_type,
      q.status as queue_status,
      q.priority as queue_priority,
      q.sort_order as queue_sort_order,
      q.entered_at as queue_entered_at,
      q.called_at as queue_called_at,
      q.finished_at as queue_finished_at,
      coalesce(diagnosis_summary.items, '[]'::jsonb) as diagnoses
    from history_refs
    join public.encounters e
      on e.workspace_id = p_workspace_id
     and e.id = history_refs.encounter_id
    join public.patients p
      on p.workspace_id = e.workspace_id
     and p.id = e.patient_id
     and p.status <> 'soft_deleted'
    left join public.soap_notes s
      on s.workspace_id = e.workspace_id
     and s.id = history_refs.chart_id
    left join lateral (
      select queue.*
      from public.waiting_queue_entries queue
      where queue.workspace_id = e.workspace_id
        and queue.encounter_id = e.id
        and queue.queue_type = 'consultation'
        and (
          history_refs.queue_entry_id is null
          or queue.id = history_refs.queue_entry_id
        )
      order by queue.entered_at desc, queue.id desc
      limit 1
    ) q on true
    left join public.guardians g
      on g.workspace_id = e.workspace_id
     and g.id = e.guardian_id
     and g.status <> 'soft_deleted'
    left join public.users u
      on u.id = e.primary_veterinarian_id
    left join lateral (
      select jsonb_agg(
        jsonb_build_object('diagnosisText', d.diagnosis_text)
        order by d.is_primary desc, d.sort_order, d.created_at, d.id
      ) as items
      from public.diagnoses d
      where d.workspace_id = e.workspace_id
        and d.encounter_id = e.id
    ) diagnosis_summary on true
  ), ordered as (
    select *
    from base
    where v_cursor_at is null
       or history_at < v_cursor_at
       or (history_at = v_cursor_at and history_id < v_cursor_id)
    order by history_at desc, history_id desc
    limit v_limit + 1
  ), page as (
    select *
    from ordered
    order by history_at desc, history_id desc
    limit v_limit
  ), extra as (
    select *
    from ordered
    order by history_at desc, history_id desc
    offset v_limit
    limit 1
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'chart', chart,
          'encounter', jsonb_strip_nulls(jsonb_build_object(
            'id', id,
            'workspaceId', workspace_id,
            'patientId', patient_id,
            'guardianId', guardian_id,
            'appointmentId', appointment_id,
            'primaryVeterinarianId', primary_veterinarian_id,
            'encounterNo', encounter_no,
            'receptionType', reception_type,
            'department', department,
            'durationMinutes', duration_minutes,
            'chiefComplaint', chief_complaint,
            'visitPurpose', visit_purpose,
            'receptionMemo', reception_memo,
            'status', status,
            'checkedInAt', checked_in_at,
            'checkedInByUserId', checked_in_by_user_id,
            'startedAt', started_at,
            'chartCompletedAt', chart_completed_at,
            'chartCompletedByUserId', chart_completed_by_user_id,
            'completedAt', completed_at,
            'createdAt', created_at,
            'updatedAt', updated_at
          )),
          'primaryGuardian', case
            when guardian_record_id is null then null
            else jsonb_strip_nulls(jsonb_build_object(
              'id', guardian_record_id,
              'workspaceId', workspace_id,
              'name', guardian_name,
              'mobilePhone', guardian_mobile_phone,
              'phone', guardian_phone,
              'email', guardian_email,
              'birthDate', guardian_birth_date,
              'address', guardian_address,
              'occupation', guardian_occupation,
              'memo', guardian_memo,
              'createdAt', guardian_created_at,
              'updatedAt', guardian_updated_at
            ))
          end,
          'queueEntry', case
            when queue_record_id is null then null
            else jsonb_strip_nulls(jsonb_build_object(
              'id', queue_record_id,
              'workspaceId', workspace_id,
              'encounterId', id,
              'queueType', queue_type,
              'status', queue_status,
              'priority', queue_priority,
              'sortOrder', queue_sort_order,
              'enteredAt', queue_entered_at,
              'calledAt', queue_called_at,
              'finishedAt', queue_finished_at
            ))
          end,
          'veterinarianName', veterinarian_name,
          'diagnoses', diagnoses
        )
        order by history_at desc, history_id desc
      )
      from page
    ), '[]'::jsonb),
    'nextCursor', case
      when exists (select 1 from extra) then (
        select pg_catalog.encode(
          pg_catalog.convert_to(
            pg_catalog.jsonb_build_object(
              'at', history_at,
              'id', history_id
            )::text,
            'UTF8'
          ),
          'base64'
        )
        from page
        order by history_at asc, history_id asc
        limit 1
      )
      else null
    end,
    'totalCount', (select count(*) from base)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.clair_list_chart_patient_history(
  text,
  uuid,
  text,
  integer
) from public, anon;

grant execute on function public.clair_list_chart_patient_history(
  text,
  uuid,
  text,
  integer
) to authenticated;

comment on function public.clair_list_chart_patient_history(
  text,
  uuid,
  text,
  integer
) is
  'Workspace-scoped chart history including chartless uncalled waiting receptions, ordered by stable history time and id.';
