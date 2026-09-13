-- CHART-PR-037: a started consultation owns one usable first chart immediately.
-- Additional + new chart creation keeps its existing request-id semantics.

create function private.clair_ensure_encounter_first_chart_internal(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_audit jsonb;
  v_note public.soap_notes;
begin
  -- This encounter lock serializes call/start recovery with explicit chart creation.
  perform private.clair_require_chart_encounter(
    p_workspace_id,
    p_encounter_id,
    p_actor_user_id
  );

  select s.*
    into v_note
  from public.soap_notes s
  where s.workspace_id = p_workspace_id
    and s.encounter_id = p_encounter_id
    and s.status <> 'voided'
  order by s.created_at, s.id
  limit 1;

  if found then
    return private.clair_chart_note_json(v_note)
      || pg_catalog.jsonb_build_object('idempotentReplay', true);
  end if;

  insert into public.soap_notes (
    workspace_id,
    encounter_id,
    author_user_id,
    clinical_at
  ) values (
    p_workspace_id,
    p_encounter_id,
    auth.uid(),
    pg_catalog.clock_timestamp()
  )
  returning * into v_note;

  v_audit := private.clair_record_chart_audit(
    p_workspace_id,
    p_encounter_id,
    v_note.id,
    'created'
  );

  return private.clair_chart_note_json(v_note) || v_audit;
end;
$$;

revoke all on function private.clair_ensure_encounter_first_chart_internal(text, text, uuid)
  from public, anon, authenticated, service_role;

create function public.clair_ensure_encounter_first_chart(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.clair_ensure_encounter_first_chart_internal(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id
  );
$$;

revoke all on function public.clair_ensure_encounter_first_chart(text, text, uuid)
  from public, anon;
grant execute on function public.clair_ensure_encounter_first_chart(text, text, uuid)
  to authenticated;

create or replace function public.clair_call_consultation_queue(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_room_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor_user_id uuid;
  v_chart jsonb;
  v_flow jsonb;
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
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing';
  end if;

  v_flow := private.clair_call_consultation_queue_internal(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id,
    p_room_id
  );
  v_chart := private.clair_ensure_encounter_first_chart_internal(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id
  );

  return v_flow || pg_catalog.jsonb_build_object('chart', v_chart);
end;
$$;

create or replace function public.clair_call_consultation_queue(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid
)
returns jsonb
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select public.clair_call_consultation_queue(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id,
    'room-consult-1'
  );
$$;

revoke all on function public.clair_call_consultation_queue(text, text, uuid, text)
  from public, anon;
revoke all on function public.clair_call_consultation_queue(text, text, uuid)
  from public, anon;
grant execute on function public.clair_call_consultation_queue(text, text, uuid, text)
  to authenticated;
grant execute on function public.clair_call_consultation_queue(text, text, uuid)
  to authenticated;

alter function public.clair_start_consultation(text, text, uuid)
  set schema private;
alter function private.clair_start_consultation(text, text, uuid)
  rename to clair_start_consultation_internal;
revoke all on function private.clair_start_consultation_internal(text, text, uuid)
  from public, anon, authenticated;

create function public.clair_start_consultation(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor_user_id uuid;
  v_chart jsonb;
  v_flow jsonb;
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
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing';
  end if;

  v_flow := private.clair_start_consultation_internal(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id
  );
  v_chart := private.clair_ensure_encounter_first_chart_internal(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id
  );

  return v_flow || pg_catalog.jsonb_build_object('chart', v_chart);
end;
$$;

revoke all on function public.clair_start_consultation(text, text, uuid)
  from public, anon;
grant execute on function public.clair_start_consultation(text, text, uuid)
  to authenticated;

comment on function public.clair_ensure_encounter_first_chart(text, text, uuid) is
  'Idempotently prepares or reuses the oldest non-voided chart for an already-started encounter.';
comment on function public.clair_call_consultation_queue(text, text, uuid, text) is
  'Calls a consultation patient and atomically returns its ensured first chart.';
comment on function public.clair_start_consultation(text, text, uuid) is
  'Starts a called consultation and atomically returns its ensured first chart.';
