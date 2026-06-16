-- DEN-57: reception patient/guardian lookup reader.
-- Local-first only. Remote Supabase application remains approval-gated.

create or replace function public.clair_search_reception_patient_guardian_lookup(
  p_workspace_id text,
  p_query text default '',
  p_limit integer default 25
)
returns jsonb
language sql
stable
security definer
set search_path = public, private, extensions
as $$
  with normalized_input as (
    select
      nullif(lower(trim(coalesce(p_query, ''))), '') as query_text,
      greatest(1, least(coalesce(p_limit, 25), 50)) as row_limit
  ),
  scoped_patients as (
    select
      p.*,
      g.id as guardian_id,
      g.workspace_id as guardian_workspace_id,
      g.name as guardian_name,
      g.mobile_phone as guardian_mobile_phone,
      g.phone as guardian_phone,
      g.email as guardian_email,
      g.birth_date as guardian_birth_date,
      g.address as guardian_address,
      g.occupation as guardian_occupation,
      g.memo as guardian_memo,
      g.created_at as guardian_created_at,
      g.updated_at as guardian_updated_at,
      lower(
        concat_ws(
          ' ',
          p.name,
          p.patient_no,
          p.breed,
          p.microchip_no,
          p.patient_registration_no,
          g.name,
          g.mobile_phone,
          g.mobile_phone_normalized,
          g.phone
        )
      ) as search_text
    from public.patients p
    left join public.patient_guardians pg
      on pg.workspace_id = p.workspace_id
     and pg.patient_id = p.id
     and pg.is_primary = true
    left join public.guardians g
      on g.workspace_id = p.workspace_id
     and g.id = pg.guardian_id
    cross join normalized_input input
    where p.workspace_id = p_workspace_id
      and p.status = 'active'
      and private.clair_is_active_workspace_member(p_workspace_id)
      and (
        input.query_text is null
        or lower(
          concat_ws(
            ' ',
            p.name,
            p.patient_no,
            p.breed,
            p.microchip_no,
            p.patient_registration_no,
            g.name,
            g.mobile_phone,
            g.mobile_phone_normalized,
            g.phone
          )
        ) like '%' || input.query_text || '%'
      )
    order by p.name asc, p.patient_no asc
    limit (select row_limit from normalized_input)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'patient',
        jsonb_build_object(
          'id', id,
          'workspaceId', workspace_id,
          'patientNo', patient_no,
          'name', name,
          'species', species,
          'breed', breed,
          'birthDate', birth_date,
          'estimatedAgeText', estimated_age_text,
          'sex', sex,
          'neutered', neutered,
          'microchipNo', microchip_no,
          'patientRegistrationNo', patient_registration_no,
          'weightKg', weight_kg,
          'allergyNote', allergy_note,
          'specialNote', special_note,
          'handlingCautionNote', handling_caution_note,
          'handlingCautionLocked', handling_caution_locked,
          'status', status,
          'createdAt', created_at,
          'updatedAt', updated_at
        ),
        'primaryGuardian',
        case
          when guardian_id is null then null
          else jsonb_build_object(
            'id', guardian_id,
            'workspaceId', guardian_workspace_id,
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
          )
        end,
        'searchText', search_text
      )
    ),
    '[]'::jsonb
  )
  from scoped_patients;
$$;

revoke all on function public.clair_search_reception_patient_guardian_lookup(text, text, integer)
  from public;
grant execute on function public.clair_search_reception_patient_guardian_lookup(text, text, integer)
  to authenticated;
