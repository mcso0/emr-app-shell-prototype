-- DEN-58: local-first reception patient/guardian registration writer.
-- Remote Supabase application remains approval-gated.

create or replace function public.clair_register_reception_patient_guardian(
  p_workspace_id text,
  p_actor_user_id text,
  p_registration jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_mode text := coalesce(p_registration->>'mode', 'new_guardian_patient');
  v_guardian jsonb := coalesce(p_registration->'guardian', '{}'::jsonb);
  v_patient jsonb := coalesce(p_registration->'patient', '{}'::jsonb);
  v_existing_guardian_id uuid;
  v_guardian_id uuid;
  v_patient_id uuid;
  v_patient_guardian_id uuid;
  v_privacy_consent_id uuid;
  v_marketing_consent_id uuid;
  v_now timestamptz := now();
  v_mobile_phone text := nullif(btrim(v_guardian->>'mobilePhone'), '');
  v_mobile_phone_normalized text := nullif(regexp_replace(coalesce(v_guardian->>'mobilePhone', ''), '\D', '', 'g'), '');
  v_patient_no text := 'P-' || to_char(v_now, 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_microchip_no text := nullif(btrim(v_patient->>'microchipNo'), '');
  v_patient_registration_no text := nullif(btrim(v_patient->>'patientRegistrationNo'), '');
  v_guardian_row jsonb;
  v_patient_row jsonb;
  v_patient_guardian_row jsonb;
  v_consents jsonb := '[]'::jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if v_mode not in ('new_guardian_patient', 'existing_guardian_patient') then
    raise exception 'invalid_input';
  end if;

  if nullif(btrim(v_patient->>'name'), '') is null
    or nullif(btrim(v_patient->>'species'), '') is null
    or nullif(btrim(v_patient->>'breed'), '') is null then
    raise exception 'invalid_input';
  end if;

  if exists (
    select 1 from public.patients p
    where p.workspace_id = p_workspace_id
      and v_microchip_no is not null
      and p.microchip_no = v_microchip_no
  ) then
    raise exception 'duplicate_patient_microchip';
  end if;

  if exists (
    select 1 from public.patients p
    where p.workspace_id = p_workspace_id
      and v_patient_registration_no is not null
      and p.patient_registration_no = v_patient_registration_no
  ) then
    raise exception 'duplicate_patient_registration_no';
  end if;

  if v_mode = 'existing_guardian_patient' then
    v_existing_guardian_id := nullif(p_registration->>'existingGuardianId', '')::uuid;

    select g.id
      into v_guardian_id
    from public.guardians g
    where g.workspace_id = p_workspace_id
      and g.id = v_existing_guardian_id;

    if v_guardian_id is null then
      raise exception 'guardian_unavailable';
    end if;
  else
    if nullif(btrim(v_guardian->>'name'), '') is null
      or v_mobile_phone_normalized is null
      or coalesce((v_guardian->>'privacyConsent')::boolean, false) is not true then
      raise exception 'invalid_input';
    end if;

    if exists (
      select 1 from public.guardians g
      where g.workspace_id = p_workspace_id
        and g.mobile_phone_normalized = v_mobile_phone_normalized
    ) then
      raise exception 'duplicate_guardian_mobile_phone';
    end if;

    insert into public.guardians (
      workspace_id,
      name,
      mobile_phone,
      mobile_phone_normalized,
      phone,
      email,
      birth_date,
      address,
      memo,
      created_at,
      updated_at
    )
    values (
      p_workspace_id,
      btrim(v_guardian->>'name'),
      v_mobile_phone,
      v_mobile_phone_normalized,
      nullif(btrim(v_guardian->>'phone'), ''),
      nullif(btrim(v_guardian->>'email'), '')::extensions.citext,
      nullif(btrim(v_guardian->>'birthDate'), '')::date,
      nullif(btrim(v_guardian->>'address'), ''),
      nullif(btrim(v_guardian->>'memo'), ''),
      v_now,
      v_now
    )
    returning id into v_guardian_id;

    insert into public.consents (
      workspace_id,
      guardian_id,
      consent_type,
      status,
      signed_at,
      created_at
    )
    values (
      p_workspace_id,
      v_guardian_id,
      'privacy',
      'granted',
      v_now,
      v_now
    )
    returning id into v_privacy_consent_id;

    if coalesce((v_guardian->>'marketingConsent')::boolean, false) then
      insert into public.consents (
        workspace_id,
        guardian_id,
        consent_type,
        status,
        signed_at,
        created_at
      )
      values (
        p_workspace_id,
        v_guardian_id,
        'marketing',
        'granted',
        v_now,
        v_now
      )
      returning id into v_marketing_consent_id;
    end if;
  end if;

  insert into public.patients (
    workspace_id,
    patient_no,
    name,
    species,
    breed,
    birth_date,
    estimated_age_text,
    sex,
    neutered,
    microchip_no,
    patient_registration_no,
    special_note,
    handling_caution_locked,
    status,
    created_at,
    updated_at
  )
  values (
    p_workspace_id,
    v_patient_no,
    btrim(v_patient->>'name'),
    btrim(v_patient->>'species'),
    nullif(btrim(v_patient->>'breed'), ''),
    nullif(btrim(v_patient->>'birthDate'), '')::date,
    nullif(btrim(v_patient->>'estimatedAgeText'), ''),
    coalesce(nullif(btrim(v_patient->>'sex'), ''), 'unknown'),
    coalesce((v_patient->>'neutered')::boolean, false),
    v_microchip_no,
    v_patient_registration_no,
    nullif(btrim(v_patient->>'specialNote'), ''),
    true,
    'active',
    v_now,
    v_now
  )
  returning id into v_patient_id;

  insert into public.patient_guardians (
    workspace_id,
    patient_id,
    guardian_id,
    relationship,
    is_primary,
    can_receive_messages,
    created_at
  )
  values (
    p_workspace_id,
    v_patient_id,
    v_guardian_id,
    '주보호자',
    true,
    true,
    v_now
  )
  returning id into v_patient_guardian_id;

  select jsonb_build_object(
    'id', g.id::text,
    'workspaceId', g.workspace_id,
    'name', g.name,
    'mobilePhone', g.mobile_phone,
    'phone', g.phone,
    'email', g.email::text,
    'birthDate', g.birth_date::text,
    'address', g.address,
    'memo', g.memo,
    'createdAt', g.created_at,
    'updatedAt', g.updated_at
  )
    into v_guardian_row
  from public.guardians g
  where g.id = v_guardian_id;

  select jsonb_build_object(
    'id', p.id::text,
    'workspaceId', p.workspace_id,
    'patientNo', p.patient_no,
    'name', p.name,
    'species', p.species,
    'breed', p.breed,
    'birthDate', p.birth_date::text,
    'estimatedAgeText', p.estimated_age_text,
    'sex', p.sex,
    'neutered', p.neutered,
    'microchipNo', p.microchip_no,
    'patientRegistrationNo', p.patient_registration_no,
    'specialNote', p.special_note,
    'handlingCautionLocked', p.handling_caution_locked,
    'status', p.status,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at
  )
    into v_patient_row
  from public.patients p
  where p.id = v_patient_id;

  select jsonb_build_object(
    'id', pg.id::text,
    'patientId', pg.patient_id::text,
    'guardianId', pg.guardian_id::text,
    'relationship', pg.relationship,
    'isPrimary', pg.is_primary,
    'canReceiveMessages', pg.can_receive_messages,
    'createdAt', pg.created_at
  )
    into v_patient_guardian_row
  from public.patient_guardians pg
  where pg.id = v_patient_guardian_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id::text,
    'workspaceId', c.workspace_id,
    'guardianId', c.guardian_id::text,
    'patientId', c.patient_id::text,
    'consentType', c.consent_type,
    'status', c.status,
    'signedAt', c.signed_at,
    'revokedAt', c.revoked_at,
    'documentUrl', c.document_url
  ) order by c.created_at), '[]'::jsonb)
    into v_consents
  from public.consents c
  where c.id in (v_privacy_consent_id, v_marketing_consent_id);

  return jsonb_build_object(
    'guardian', v_guardian_row,
    'patient', v_patient_row,
    'patientGuardian', v_patient_guardian_row,
    'consents', v_consents
  );
end;
$$;

revoke all on function public.clair_register_reception_patient_guardian(text, text, jsonb) from public;
grant execute on function public.clair_register_reception_patient_guardian(text, text, jsonb) to authenticated;

comment on function public.clair_register_reception_patient_guardian(text, text, jsonb) is
  'DEN-58 local-first server-owned writer for minimal reception patient and guardian registration.';
