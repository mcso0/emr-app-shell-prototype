-- DEN-516: allow reservation-to-reception check-in form payload overrides.

create or replace function public.clair_check_in_reception_appointment(
  p_workspace_id text,
  p_actor_user_id text,
  p_appointment_id text,
  p_check_in jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_result jsonb;
  v_encounter_id uuid;
  v_patient_id uuid;
  v_checked_in_at timestamptz := nullif(p_check_in->>'checkedInAt', '')::timestamptz;
  v_department text := nullif(trim(p_check_in->>'department'), '');
  v_duration_minutes integer := nullif(p_check_in->>'durationMinutes', '')::integer;
  v_memo text := nullif(trim(p_check_in->>'memo'), '');
  v_primary_veterinarian_id uuid := nullif(p_check_in->>'primaryVeterinarianId', '')::uuid;
  v_visit_purpose text := nullif(trim(p_check_in->>'visitPurpose'), '');
  v_weight_kg numeric := nullif(p_check_in->>'weightKg', '')::numeric;
begin
  v_result := public.clair_check_in_reception_appointment(
    p_workspace_id,
    p_actor_user_id,
    p_appointment_id
  );

  v_encounter_id := nullif(v_result->'encounter'->>'id', '')::uuid;
  v_patient_id := nullif(v_result->'encounter'->>'patientId', '')::uuid;

  if v_duration_minutes is not null and v_duration_minutes <= 0 then
    raise exception 'invalid_input';
  end if;

  if v_weight_kg is not null and v_weight_kg <= 0 then
    raise exception 'invalid_input';
  end if;

  update public.encounters
  set
    department = coalesce(v_department, department),
    duration_minutes = coalesce(v_duration_minutes, duration_minutes),
    primary_veterinarian_id = coalesce(v_primary_veterinarian_id, primary_veterinarian_id),
    chief_complaint = coalesce(v_visit_purpose, chief_complaint),
    visit_purpose = coalesce(v_visit_purpose, visit_purpose),
    reception_memo = coalesce(v_memo, reception_memo),
    checked_in_at = coalesce(v_checked_in_at, checked_in_at),
    created_at = coalesce(v_checked_in_at, created_at),
    updated_at = now()
  where workspace_id = p_workspace_id
    and id = v_encounter_id;

  if v_weight_kg is not null then
    update public.patients
    set weight_kg = round(v_weight_kg, 2),
        updated_at = now()
    where workspace_id = p_workspace_id
      and id = v_patient_id;
  end if;

  return jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              v_result,
              '{encounter,department}',
              to_jsonb(coalesce(v_department, v_result->'encounter'->>'department'))
            ),
            '{encounter,durationMinutes}',
            to_jsonb(coalesce(v_duration_minutes, (v_result->'encounter'->>'durationMinutes')::integer))
          ),
          '{encounter,primaryVeterinarianId}',
          to_jsonb(coalesce(v_primary_veterinarian_id::text, v_result->'encounter'->>'primaryVeterinarianId'))
        ),
        '{encounter,visitPurpose}',
        to_jsonb(coalesce(v_visit_purpose, v_result->'encounter'->>'visitPurpose'))
      ),
      '{encounter,chiefComplaint}',
      to_jsonb(coalesce(v_visit_purpose, v_result->'encounter'->>'chiefComplaint'))
    ),
    '{encounter,receptionMemo}',
    to_jsonb(coalesce(v_memo, v_result->'encounter'->>'receptionMemo'))
  );
end;
$$;

revoke all on function public.clair_check_in_reception_appointment(text, text, text, jsonb) from public;
grant execute on function public.clair_check_in_reception_appointment(text, text, text, jsonb) to authenticated;

comment on function public.clair_check_in_reception_appointment(text, text, text, jsonb) is
  'DEN-516 wrapper for appointment check-in form payload overrides and patient weight writeback.';
