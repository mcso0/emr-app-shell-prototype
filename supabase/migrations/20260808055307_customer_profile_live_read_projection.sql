-- CUSTOMER-LIVE-PR-009: workspace-scoped customer profile read projections.
-- Function-only migration. It intentionally creates no rows, tables, indexes, or seed data.

create or replace function public.clair_get_customer_profile_overview(
  p_workspace_id text,
  p_subject_type text,
  p_subject_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_profile jsonb;
  v_relationships jsonb;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'patient:view') then
    raise exception 'permission_missing';
  end if;

  if p_subject_type not in ('patient', 'guardian') then
    raise exception 'subject_not_found';
  end if;

  if p_subject_type = 'patient' then
    select jsonb_build_object(
      'id', p.id,
      'workspaceId', p.workspace_id,
      'patientNo', p.patient_no,
      'name', p.name,
      'species', p.species,
      'breed', p.breed,
      'birthDate', p.birth_date,
      'estimatedAgeText', p.estimated_age_text,
      'weightKg', p.weight_kg,
      'sex', p.sex,
      'neutered', p.neutered,
      'microchipNo', p.microchip_no,
      'patientRegistrationNo', p.patient_registration_no,
      'allergyNote', p.allergy_note,
      'specialNote', p.special_note,
      'handlingCautionNote', p.handling_caution_note,
      'handlingCautionLocked', p.handling_caution_locked,
      'profileMemo', p.profile_memo,
      'status', p.status,
      'createdAt', p.created_at,
      'updatedAt', p.updated_at
    )
    into v_profile
    from public.patients p
    where p.workspace_id = p_workspace_id
      and p.id = p_subject_id
      and p.status <> 'soft_deleted';

    if v_profile is null then
      raise exception 'subject_not_found';
    end if;

    select jsonb_build_object(
      'guardians', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', g.id,
            'name', g.name,
            'mobilePhone', g.mobile_phone,
            'phone', g.phone,
            'relationship', coalesce(pg.relationship_label, pg.relationship),
            'isPrimary', pg.is_primary
          )
          order by pg.is_primary desc, g.name, g.id
        ),
        '[]'::jsonb
      )
    )
    into v_relationships
    from public.patient_guardians pg
    join public.guardians g
      on g.workspace_id = pg.workspace_id
     and g.id = pg.guardian_id
    where pg.workspace_id = p_workspace_id
      and pg.patient_id = p_subject_id
      and pg.unlinked_at is null
      and g.status <> 'soft_deleted';
  else
    select jsonb_build_object(
      'id', g.id,
      'workspaceId', g.workspace_id,
      'name', g.name,
      'mobilePhone', g.mobile_phone,
      'phone', g.phone,
      'email', g.email,
      'birthDate', g.birth_date,
      'address', g.address,
      'memo', g.memo,
      'status', g.status,
      'createdAt', g.created_at,
      'updatedAt', g.updated_at
    )
    into v_profile
    from public.guardians g
    where g.workspace_id = p_workspace_id
      and g.id = p_subject_id
      and g.status <> 'soft_deleted';

    if v_profile is null then
      raise exception 'subject_not_found';
    end if;

    select jsonb_build_object(
      'patients', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'patientNo', p.patient_no,
            'name', p.name,
            'species', p.species,
            'breed', p.breed,
            'birthDate', p.birth_date,
            'sex', p.sex,
            'neutered', p.neutered,
            'status', p.status,
            'relationship', coalesce(pg.relationship_label, pg.relationship),
            'isPrimary', pg.is_primary
          )
          order by pg.is_primary desc, p.name, p.id
        ),
        '[]'::jsonb
      )
    )
    into v_relationships
    from public.patient_guardians pg
    join public.patients p
      on p.workspace_id = pg.workspace_id
     and p.id = pg.patient_id
    where pg.workspace_id = p_workspace_id
      and pg.guardian_id = p_subject_id
      and pg.unlinked_at is null
      and p.status <> 'soft_deleted';
  end if;

  return jsonb_build_object(
    'subjectType', p_subject_type,
    'subjectId', p_subject_id,
    'profile', v_profile,
    'relationships', v_relationships,
    'access', jsonb_build_object(
      'information', jsonb_build_object(
        'allowed', true,
        'requiredPermission', 'patient:view'
      ),
      'history', jsonb_build_object(
        'allowed', private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view'),
        'requiredPermission', 'chart:view'
      ),
      'reservations', jsonb_build_object(
        'allowed', private.clair_current_user_has_workspace_permission(p_workspace_id, 'reception:view'),
        'requiredPermission', 'reception:view'
      ),
      'billing', jsonb_build_object(
        'allowed', private.clair_current_user_has_workspace_permission(p_workspace_id, 'billing:view'),
        'requiredPermission', 'billing:view'
      )
    )
  );
end;
$$;

create or replace function public.clair_list_customer_profile_history(
  p_workspace_id text,
  p_subject_type text,
  p_subject_id uuid,
  p_cursor text default null,
  p_limit integer default 20,
  p_months integer default 6,
  p_patient_id uuid default null,
  p_month text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_months integer := case when p_months = 12 then 12 else 6 end;
  v_cursor_at timestamptz;
  v_cursor_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view') then
    raise exception 'permission_missing';
  end if;
  if p_subject_type not in ('patient', 'guardian') then raise exception 'subject_not_found'; end if;
  if p_subject_type = 'patient' and p_patient_id is not null and p_patient_id <> p_subject_id then
    raise exception 'patient_filter_invalid';
  end if;
  if p_subject_type = 'guardian' and p_patient_id is not null and not exists (
    select 1
    from public.patient_guardians pg
    join public.patients p on p.workspace_id = pg.workspace_id and p.id = pg.patient_id
    where pg.workspace_id = p_workspace_id
      and pg.guardian_id = p_subject_id
      and pg.patient_id = p_patient_id
      and pg.unlinked_at is null
      and p.status <> 'soft_deleted'
  ) then
    raise exception 'patient_filter_invalid';
  end if;
  if not exists (
    select 1
    from public.patients p
    where p.workspace_id = p_workspace_id
      and p.id = case when p_subject_type = 'patient' then p_subject_id else coalesce(p_patient_id, p_subject_id) end
      and p.status <> 'soft_deleted'
  ) and (p_subject_type = 'patient') then
    raise exception 'subject_not_found';
  end if;
  if p_subject_type = 'guardian' and not exists (
    select 1 from public.guardians g
    where g.workspace_id = p_workspace_id and g.id = p_subject_id and g.status <> 'soft_deleted'
  ) then raise exception 'subject_not_found'; end if;
  if p_cursor is not null and p_cursor <> '' then
    begin
      v_cursor_at := (convert_from(decode(p_cursor, 'base64'), 'UTF8')::jsonb ->> 'at')::timestamptz;
      v_cursor_id := (convert_from(decode(p_cursor, 'base64'), 'UTF8')::jsonb ->> 'id')::uuid;
    exception when others then raise exception 'invalid_filter';
    end;
  end if;

  with base as (
    select
      e.id,
      e.patient_id,
      p.name as patient_name,
      coalesce(e.completed_at, e.checked_in_at, e.created_at) as occurred_at,
      e.status,
      coalesce(e.visit_purpose, e.chief_complaint) as visit_purpose,
      u.display_name as clinician_name
    from public.encounters e
    join public.patients p on p.workspace_id = e.workspace_id and p.id = e.patient_id
    left join public.users u on u.id = e.primary_veterinarian_id
    where e.workspace_id = p_workspace_id
      and e.status <> 'cancelled'
      and p.status <> 'soft_deleted'
      and coalesce(e.completed_at, e.checked_in_at, e.created_at) >= now() - make_interval(months => v_months)
      and (
        (p_subject_type = 'patient' and e.patient_id = p_subject_id)
        or
        (p_subject_type = 'guardian' and exists (
          select 1 from public.patient_guardians pg
          where pg.workspace_id = e.workspace_id and pg.patient_id = e.patient_id and pg.guardian_id = p_subject_id and pg.unlinked_at is null
        ))
      )
      and (p_patient_id is null or e.patient_id = p_patient_id)
  ), ordered as (
    select * from base
    where v_cursor_at is null
       or occurred_at < v_cursor_at
       or (occurred_at = v_cursor_at and id < v_cursor_id)
    order by occurred_at desc, id desc
    limit v_limit + 1
  ), page as (
    select * from ordered order by occurred_at desc, id desc limit v_limit
  ), extra as (
    select * from ordered order by occurred_at desc, id desc offset v_limit limit 1
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id,
      'patientId', patient_id,
      'patientName', patient_name,
      'occurredAt', occurred_at,
      'status', status,
      'visitPurpose', visit_purpose,
      'clinicianName', clinician_name
    ) order by occurred_at desc, id desc) from page), '[]'::jsonb),
    'nextCursor', (select encode(convert_to(jsonb_build_object('at', occurred_at, 'id', id)::text, 'UTF8'), 'base64') from extra)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.clair_list_customer_profile_reservations(
  p_workspace_id text,
  p_subject_type text,
  p_subject_id uuid,
  p_cursor text default null,
  p_limit integer default 20,
  p_months integer default 6,
  p_patient_id uuid default null,
  p_month text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_month_start date;
  v_cursor_at timestamptz;
  v_cursor_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing'; end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'reception:view') then raise exception 'permission_missing'; end if;
  if p_subject_type not in ('patient', 'guardian') then raise exception 'subject_not_found'; end if;
  if p_month is not null and p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'invalid_filter'; end if;
  v_month_start := coalesce(to_date(p_month || '-01', 'YYYY-MM-DD'), (timezone('Asia/Seoul', now()))::date - ((extract(day from timezone('Asia/Seoul', now()))::integer - 1)));
  if p_subject_type = 'patient' and p_patient_id is not null and p_patient_id <> p_subject_id then raise exception 'patient_filter_invalid'; end if;
  if p_subject_type = 'guardian' and p_patient_id is not null and not exists (
    select 1 from public.patient_guardians pg
    join public.patients p on p.workspace_id = pg.workspace_id and p.id = pg.patient_id
    where pg.workspace_id = p_workspace_id and pg.guardian_id = p_subject_id and pg.patient_id = p_patient_id and pg.unlinked_at is null and p.status <> 'soft_deleted'
  ) then raise exception 'patient_filter_invalid'; end if;
  if p_subject_type = 'patient' and not exists (select 1 from public.patients p where p.workspace_id = p_workspace_id and p.id = p_subject_id and p.status <> 'soft_deleted') then raise exception 'subject_not_found'; end if;
  if p_subject_type = 'guardian' and not exists (select 1 from public.guardians g where g.workspace_id = p_workspace_id and g.id = p_subject_id and g.status <> 'soft_deleted') then raise exception 'subject_not_found'; end if;
  if p_cursor is not null and p_cursor <> '' then
    begin
      v_cursor_at := (convert_from(decode(p_cursor, 'base64'), 'UTF8')::jsonb ->> 'at')::timestamptz;
      v_cursor_id := (convert_from(decode(p_cursor, 'base64'), 'UTF8')::jsonb ->> 'id')::uuid;
    exception when others then raise exception 'invalid_filter'; end;
  end if;

  with base as (
    select
      a.id,
      a.patient_id,
      p.name as patient_name,
      a.scheduled_start_at,
      a.scheduled_end_at,
      a.visit_purpose,
      a.symptom_note,
      a.status
    from public.appointments a
    join public.patients p on p.workspace_id = a.workspace_id and p.id = a.patient_id
    where a.workspace_id = p_workspace_id
      and p.status <> 'soft_deleted'
      and a.scheduled_start_at >= (v_month_start::timestamp at time zone 'Asia/Seoul')
      and a.scheduled_start_at < ((v_month_start + interval '1 month')::timestamp at time zone 'Asia/Seoul')
      and (
        (p_subject_type = 'patient' and a.patient_id = p_subject_id)
        or (p_subject_type = 'guardian' and exists (
          select 1 from public.patient_guardians pg
          where pg.workspace_id = a.workspace_id and pg.patient_id = a.patient_id and pg.guardian_id = p_subject_id and pg.unlinked_at is null
        ))
      )
      and (p_patient_id is null or a.patient_id = p_patient_id)
  ), ordered as (
    select * from base
    where v_cursor_at is null
       or scheduled_start_at > v_cursor_at
       or (scheduled_start_at = v_cursor_at and id > v_cursor_id)
    order by scheduled_start_at asc, id asc
    limit v_limit + 1
  ), page as (
    select * from ordered order by scheduled_start_at asc, id asc limit v_limit
  ), extra as (
    select * from ordered order by scheduled_start_at asc, id asc offset v_limit limit 1
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id,
      'patientId', patient_id,
      'patientName', patient_name,
      'scheduledStartAt', scheduled_start_at,
      'scheduledEndAt', scheduled_end_at,
      'visitPurpose', visit_purpose,
      'symptomNote', symptom_note,
      'status', status
    ) order by scheduled_start_at asc, id asc) from page), '[]'::jsonb),
    'nextCursor', (select encode(convert_to(jsonb_build_object('at', scheduled_start_at, 'id', id)::text, 'UTF8'), 'base64') from extra)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.clair_list_customer_profile_billing(
  p_workspace_id text,
  p_subject_type text,
  p_subject_id uuid,
  p_cursor text default null,
  p_limit integer default 20,
  p_months integer default 6,
  p_patient_id uuid default null,
  p_month text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_months integer := case when p_months = 12 then 12 else 6 end;
  v_cursor_at timestamptz;
  v_cursor_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing'; end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'billing:view') then raise exception 'permission_missing'; end if;
  if p_subject_type not in ('patient', 'guardian') then raise exception 'subject_not_found'; end if;
  if p_subject_type = 'patient' and p_patient_id is not null and p_patient_id <> p_subject_id then raise exception 'patient_filter_invalid'; end if;
  if p_subject_type = 'guardian' and p_patient_id is not null and not exists (
    select 1 from public.patient_guardians pg
    join public.patients p on p.workspace_id = pg.workspace_id and p.id = pg.patient_id
    where pg.workspace_id = p_workspace_id and pg.guardian_id = p_subject_id and pg.patient_id = p_patient_id and pg.unlinked_at is null and p.status <> 'soft_deleted'
  ) then raise exception 'patient_filter_invalid'; end if;
  if p_subject_type = 'patient' and not exists (select 1 from public.patients p where p.workspace_id = p_workspace_id and p.id = p_subject_id and p.status <> 'soft_deleted') then raise exception 'subject_not_found'; end if;
  if p_subject_type = 'guardian' and not exists (select 1 from public.guardians g where g.workspace_id = p_workspace_id and g.id = p_subject_id and g.status <> 'soft_deleted') then raise exception 'subject_not_found'; end if;
  if p_cursor is not null and p_cursor <> '' then
    begin
      v_cursor_at := (convert_from(decode(p_cursor, 'base64'), 'UTF8')::jsonb ->> 'at')::timestamptz;
      v_cursor_id := (convert_from(decode(p_cursor, 'base64'), 'UTF8')::jsonb ->> 'id')::uuid;
    exception when others then raise exception 'invalid_filter'; end;
  end if;

  with base as (
    select
      i.id,
      i.invoice_no,
      i.encounter_id,
      e.patient_id,
      p.name as patient_name,
      coalesce(i.paid_at, i.issued_at, i.created_at) as activity_at,
      i.status,
      i.payment_state,
      i.total_amount,
      payment_summary.approved_amount,
      line_summary.line_summary
    from public.invoices i
    join public.encounters e on e.workspace_id = i.workspace_id and e.id = i.encounter_id
    join public.patients p on p.workspace_id = e.workspace_id and p.id = e.patient_id
    left join lateral (
      select coalesce(sum(pay.amount) filter (where pay.status = 'approved'), 0) as approved_amount
      from public.payments pay
      where pay.workspace_id = i.workspace_id and pay.invoice_id = i.id
    ) payment_summary on true
    left join lateral (
      select string_agg(il.description, ', ' order by il.created_at, il.id) as line_summary
      from public.invoice_lines il
      where il.workspace_id = i.workspace_id and il.invoice_id = i.id
    ) line_summary on true
    where i.workspace_id = p_workspace_id
      and i.status <> 'voided'
      and p.status <> 'soft_deleted'
      and coalesce(i.paid_at, i.issued_at, i.created_at) >= now() - make_interval(months => v_months)
      and (
        (p_subject_type = 'patient' and e.patient_id = p_subject_id)
        or (p_subject_type = 'guardian' and i.guardian_id = p_subject_id and exists (
          select 1 from public.patient_guardians pg
          where pg.workspace_id = e.workspace_id and pg.patient_id = e.patient_id and pg.guardian_id = p_subject_id and pg.unlinked_at is null
        ))
      )
      and (p_patient_id is null or e.patient_id = p_patient_id)
  ), ordered as (
    select * from base
    where v_cursor_at is null
       or activity_at < v_cursor_at
       or (activity_at = v_cursor_at and id < v_cursor_id)
    order by activity_at desc, id desc
    limit v_limit + 1
  ), page as (
    select * from ordered order by activity_at desc, id desc limit v_limit
  ), extra as (
    select * from ordered order by activity_at desc, id desc offset v_limit limit 1
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id,
      'invoiceNo', invoice_no,
      'encounterId', encounter_id,
      'patientId', patient_id,
      'patientName', patient_name,
      'activityAt', activity_at,
      'status', status,
      'paymentState', payment_state,
      'totalAmount', total_amount,
      'approvedAmount', approved_amount,
      'lineSummary', line_summary
    ) order by activity_at desc, id desc) from page), '[]'::jsonb),
    'nextCursor', (select encode(convert_to(jsonb_build_object('at', activity_at, 'id', id)::text, 'UTF8'), 'base64') from extra)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.clair_get_customer_profile_overview(text, text, uuid) from public, anon;
revoke all on function public.clair_list_customer_profile_history(text, text, uuid, text, integer, integer, uuid, text) from public, anon;
revoke all on function public.clair_list_customer_profile_reservations(text, text, uuid, text, integer, integer, uuid, text) from public, anon;
revoke all on function public.clair_list_customer_profile_billing(text, text, uuid, text, integer, integer, uuid, text) from public, anon;

grant execute on function public.clair_get_customer_profile_overview(text, text, uuid) to authenticated;
grant execute on function public.clair_list_customer_profile_history(text, text, uuid, text, integer, integer, uuid, text) to authenticated;
grant execute on function public.clair_list_customer_profile_reservations(text, text, uuid, text, integer, integer, uuid, text) to authenticated;
grant execute on function public.clair_list_customer_profile_billing(text, text, uuid, text, integer, integer, uuid, text) to authenticated;

comment on function public.clair_get_customer_profile_overview(text, text, uuid) is
  'Permission-gated, workspace-scoped customer profile and relationship projection without clinical or billing activity rows.';
comment on function public.clair_list_customer_profile_history(text, text, uuid, text, integer, integer, uuid, text) is
  'Permission-gated, cursor-paged customer encounter summary projection; SOAP, diagnosis, and prescription data are excluded.';
comment on function public.clair_list_customer_profile_reservations(text, text, uuid, text, integer, integer, uuid, text) is
  'Permission-gated, month-scoped cursor-paged customer appointment projection.';
comment on function public.clair_list_customer_profile_billing(text, text, uuid, text, integer, integer, uuid, text) is
  'Permission-gated, cursor-paged billing projection with strict guardian invoice-owner filtering.';
