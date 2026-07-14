-- RECEPTION-QA-PR-011: close the direct authenticated RPC permission gap.
-- Keep the already-applied walk-in implementation private and expose only a
-- permission-gated public wrapper with the original Data API signature.

alter function public.clair_create_reception_walk_in_encounter(text, text, jsonb) set schema private;

alter function private.clair_create_reception_walk_in_encounter(text, text, jsonb)
  rename to clair_create_reception_walk_in_encounter_internal;

revoke all on function private.clair_create_reception_walk_in_encounter_internal(text, text, jsonb) from public, anon, authenticated;

create or replace function public.clair_create_reception_walk_in_encounter(
  p_workspace_id text,
  p_actor_user_id text,
  p_walk_in jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_actor_user_id uuid;
begin
  begin
    v_actor_user_id := nullif(p_actor_user_id, '')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'actor_mismatch';
  end;

  if v_actor_user_id is null or v_actor_user_id <> auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'reception:create') then
    raise exception 'permission_missing';
  end if;

  return private.clair_create_reception_walk_in_encounter_internal(
    p_workspace_id,
    p_actor_user_id,
    p_walk_in
  );
end;
$$;

revoke all on function public.clair_create_reception_walk_in_encounter(text, text, jsonb)
  from public, anon;
grant execute on function public.clair_create_reception_walk_in_encounter(text, text, jsonb)
  to authenticated;

create index patient_vital_measurements_recorded_by_user_id_idx
  on public.patient_vital_measurements (recorded_by_user_id);

comment on function public.clair_create_reception_walk_in_encounter(text, text, jsonb) is
  'RECEPTION-QA-PR-011 permission-gated walk-in Data API wrapper.';

comment on function private.clair_create_reception_walk_in_encounter_internal(text, text, jsonb) is
  'RECEPTION-QA-PR-011 internal atomic walk-in implementation; direct authenticated execution is revoked.';
