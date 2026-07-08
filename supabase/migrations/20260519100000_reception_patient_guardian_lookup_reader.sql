-- DEN-57: reception patient/guardian lookup reader.
-- Local-first only. Remote Supabase application remains approval-gated.

create index if not exists patients_workspace_status_lower_name_prefix_idx
  on public.patients (workspace_id, status, lower(name) text_pattern_ops);

create index if not exists guardians_workspace_lower_name_prefix_idx
  on public.guardians (workspace_id, lower(name) text_pattern_ops);

create index if not exists guardians_workspace_mobile_phone_normalized_prefix_idx
  on public.guardians (workspace_id, mobile_phone_normalized text_pattern_ops)
  where mobile_phone_normalized is not null and mobile_phone_normalized <> '';

create index if not exists patient_guardians_workspace_patient_primary_lookup_idx
  on public.patient_guardians (workspace_id, patient_id, is_primary);

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
  base_patients as not materialized (
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
      lower(p.name) as patient_name_key,
      lower(coalesce(p.patient_no, '')) as patient_no_key,
      lower(coalesce(p.breed, '')) as breed_key,
      lower(coalesce(p.microchip_no, '')) as microchip_key,
      lower(coalesce(p.patient_registration_no, '')) as patient_registration_key,
      lower(coalesce(g.name, '')) as guardian_name_key,
      lower(coalesce(g.mobile_phone, '')) as guardian_mobile_phone_key,
      lower(coalesce(g.mobile_phone_normalized, '')) as guardian_mobile_phone_normalized_key,
      lower(coalesce(g.phone, '')) as guardian_phone_key,
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
    where p.workspace_id = p_workspace_id
      and p.status = 'active'
      and private.clair_is_active_workspace_member(p_workspace_id)
  ),
  ranked_prefix_patients as (
    select
      base.*,
      case
        when input.query_text is null then 1
        when base.patient_name_key = input.query_text
          or base.guardian_name_key = input.query_text
          or base.patient_no_key = input.query_text
          or base.guardian_mobile_phone_key = input.query_text
          or base.guardian_mobile_phone_normalized_key = input.query_text
          or base.guardian_phone_key = input.query_text
        then 0
        else 1
      end as match_rank
    from base_patients base
    cross join normalized_input input
    where input.query_text is null
      or base.patient_name_key = input.query_text
      or base.guardian_name_key = input.query_text
      or base.patient_no_key = input.query_text
      or base.guardian_mobile_phone_key = input.query_text
      or base.guardian_mobile_phone_normalized_key = input.query_text
      or base.guardian_phone_key = input.query_text
      or base.patient_name_key like input.query_text || '%'
      or base.guardian_name_key like input.query_text || '%'
      or base.patient_no_key like input.query_text || '%'
      or base.microchip_key like input.query_text || '%'
      or base.patient_registration_key like input.query_text || '%'
      or base.guardian_mobile_phone_key like input.query_text || '%'
      or base.guardian_mobile_phone_normalized_key like input.query_text || '%'
      or base.guardian_phone_key like input.query_text || '%'
  ),
  prefix_patients as (
    select *
    from ranked_prefix_patients
    order by match_rank asc, name asc, patient_no asc
    limit (select row_limit from normalized_input)
  ),
  prefix_count as (
    select count(*) as row_count from prefix_patients
  ),
  ranked_contains_patients as (
    select
      base.*,
      2 as match_rank
    from base_patients base
    cross join normalized_input input
    cross join prefix_count
    where input.query_text is not null
      and length(input.query_text) >= 2
      and prefix_count.row_count < input.row_limit
      and base.search_text like '%' || input.query_text || '%'
      and not exists (
        select 1
        from prefix_patients prefix
        where prefix.id = base.id
      )
    order by base.name asc, base.patient_no asc
    limit (
      select input.row_limit - prefix_count.row_count
      from normalized_input input
      cross join prefix_count
    )
  ),
  scoped_patients as (
    select * from prefix_patients
    union all
    select * from ranked_contains_patients
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
      order by match_rank asc, name asc, patient_no asc
    ),
    '[]'::jsonb
  )
  from scoped_patients;
$$;

revoke all on function public.clair_search_reception_patient_guardian_lookup(text, text, integer)
  from public;
grant execute on function public.clair_search_reception_patient_guardian_lookup(text, text, integer)
  to authenticated;
