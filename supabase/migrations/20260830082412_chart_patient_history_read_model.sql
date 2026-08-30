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

  with base as (
    select
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
      coalesce(diagnosis_summary.items, '[]'::jsonb) as diagnoses,
      soap_summary.soap_note
    from public.encounters e
    join public.patients p
      on p.workspace_id = e.workspace_id
     and p.id = e.patient_id
     and p.status <> 'soft_deleted'
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
    left join lateral (
      select jsonb_build_object('assessment', sn.assessment) as soap_note
      from public.soap_notes sn
      where sn.workspace_id = e.workspace_id
        and sn.encounter_id = e.id
        and sn.status <> 'voided'
      order by sn.updated_at desc, sn.id desc
      limit 1
    ) soap_summary on true
    where e.workspace_id = p_workspace_id
      and e.patient_id = p_patient_id
  ), ordered as (
    select *
    from base
    where v_cursor_at is null
       or checked_in_at < v_cursor_at
       or (checked_in_at = v_cursor_at and id < v_cursor_id)
    order by checked_in_at desc, id desc
    limit v_limit + 1
  ), page as (
    select *
    from ordered
    order by checked_in_at desc, id desc
    limit v_limit
  ), extra as (
    select *
    from ordered
    order by checked_in_at desc, id desc
    offset v_limit
    limit 1
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
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
          'veterinarianName', veterinarian_name,
          'diagnoses', diagnoses,
          'soapNote', soap_note
        )
        order by checked_in_at desc, id desc
      )
      from page
    ), '[]'::jsonb),
    'nextCursor', case
      when exists (select 1 from extra) then (
        select pg_catalog.encode(
          pg_catalog.convert_to(
            pg_catalog.jsonb_build_object('at', checked_in_at, 'id', id)::text,
            'UTF8'
          ),
          'base64'
        )
        from page
        order by checked_in_at asc, id asc
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
  'CHART-PR-025 workspace-scoped, chart:view-gated patient chart history projection with cursor paging.';
