-- CHART-PR-026: converge the SOAP writer after the already-applied DEN-69
-- migration drifted from the six-argument application RPC contract.

drop function if exists public.clair_save_chart_soap_note(text, text, uuid, jsonb, text);
drop function if exists public.clair_save_chart_soap_note(text, text, uuid, jsonb, timestamptz, text);

create function public.clair_save_chart_soap_note(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_note jsonb,
  p_expected_updated_at timestamptz default null,
  p_mode text default 'autosave'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_encounter_status text;
  v_existing_id uuid;
  v_existing_updated_at timestamptz;
  v_now timestamptz := now();
  v_status text := case when p_mode = 'manual_save' then 'draft' else 'autosaved' end;
  v_note_row jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;

  if auth.uid() is null or v_actor_user_id is null or v_actor_user_id is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;

  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing' using errcode = '42501';
  end if;

  select e.status
    into v_encounter_status
  from public.encounters e
  where e.workspace_id = p_workspace_id
    and e.id = p_encounter_id
    and e.status <> 'cancelled';

  if v_encounter_status is null then
    raise exception 'encounter_unavailable';
  end if;

  if v_encounter_status not in ('in_consultation', 'ordered') then
    raise exception 'stale_status';
  end if;

  select s.id, s.updated_at
    into v_existing_id, v_existing_updated_at
  from public.soap_notes s
  where s.workspace_id = p_workspace_id
    and s.encounter_id = p_encounter_id
    and s.status <> 'voided'
  order by s.updated_at desc
  limit 1
  for update;

  if v_existing_id is not null
    and p_expected_updated_at is not null
    and v_existing_updated_at is distinct from p_expected_updated_at
  then
    raise exception 'soap_note_conflict';
  end if;

  if v_existing_id is not null and p_expected_updated_at is null then
    raise exception 'soap_note_conflict';
  end if;

  if v_existing_id is null and p_expected_updated_at is not null then
    raise exception 'soap_note_conflict';
  end if;

  if v_existing_id is null then
    insert into public.soap_notes (
      workspace_id,
      encounter_id,
      author_user_id,
      subjective,
      objective,
      assessment,
      plan,
      status,
      autosaved_at,
      created_at,
      updated_at
    )
    values (
      p_workspace_id,
      p_encounter_id,
      v_actor_user_id,
      nullif(btrim(p_note->>'subjective'), ''),
      nullif(btrim(p_note->>'objective'), ''),
      nullif(btrim(p_note->>'assessment'), ''),
      nullif(btrim(p_note->>'plan'), ''),
      v_status,
      case when p_mode = 'autosave' then v_now else null end,
      v_now,
      v_now
    )
    returning id into v_existing_id;
  else
    update public.soap_notes
    set
      author_user_id = coalesce(author_user_id, v_actor_user_id),
      subjective = nullif(btrim(p_note->>'subjective'), ''),
      objective = nullif(btrim(p_note->>'objective'), ''),
      assessment = nullif(btrim(p_note->>'assessment'), ''),
      plan = nullif(btrim(p_note->>'plan'), ''),
      status = v_status,
      autosaved_at = case when p_mode = 'autosave' then v_now else autosaved_at end,
      updated_at = v_now
    where id = v_existing_id
      and workspace_id = p_workspace_id;
  end if;

  select public.clair_get_chart_soap_note(p_workspace_id, p_encounter_id)
    into v_note_row;

  return v_note_row;
end;
$$;

revoke all on function public.clair_save_chart_soap_note(text, text, uuid, jsonb, timestamptz, text) from public;
revoke all on function public.clair_save_chart_soap_note(text, text, uuid, jsonb, timestamptz, text) from anon;
grant execute on function public.clair_save_chart_soap_note(text, text, uuid, jsonb, timestamptz, text) to authenticated;

comment on function public.clair_save_chart_soap_note(text, text, uuid, jsonb, timestamptz, text) is
  'CHART-PR-026 SOAP writer: authenticated actor equality, chart:update, encounter lifecycle, and optimistic updated_at conflict enforcement.';
