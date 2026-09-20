-- CHART-PR-039: consultation calls use active workspace-managed consultation rooms.

create or replace function private.clair_call_consultation_queue_internal(
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
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_now timestamptz := now();
  v_encounter public.encounters%rowtype;
  v_queue public.waiting_queue_entries%rowtype;
  v_call_event public.encounter_call_events%rowtype;
  v_room_name text;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  select space.name
    into v_room_name
  from public.workspace_spaces space
  join public.workspace_space_categories category
    on category.id = space.category_id
   and category.workspace_id = space.workspace_id
  where space.workspace_id = p_workspace_id
    and space.id::text = nullif(btrim(p_room_id), '')
    and space.archived_at is null
    and category.archived_at is null
    and category.icon_key = 'consult';

  if v_room_name is null then
    raise exception 'room_unavailable';
  end if;

  select *
    into v_encounter
  from public.encounters
  where workspace_id = p_workspace_id
    and id = p_encounter_id
    and status <> 'cancelled'
  for update;

  if v_encounter.id is null then
    raise exception 'encounter_unavailable';
  end if;

  select *
    into v_queue
  from public.waiting_queue_entries
  where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id
    and queue_type = 'consultation'
    and status <> 'cancelled'
  for update;

  if v_queue.id is null then
    raise exception 'queue_entry_unavailable';
  end if;

  if v_encounter.status <> 'waiting' or v_queue.status <> 'waiting' then
    raise exception 'stale_status';
  end if;

  update public.encounters
  set
    status = 'in_consultation',
    started_at = v_now,
    updated_at = v_now
  where id = v_encounter.id
  returning * into v_encounter;

  update public.waiting_queue_entries
  set
    status = 'in_progress',
    called_at = v_now,
    called_by_user_id = v_actor_user_id,
    started_by_user_id = v_actor_user_id
  where id = v_queue.id
  returning * into v_queue;

  insert into public.encounter_call_events (
    workspace_id,
    encounter_id,
    queue_entry_id,
    event_type,
    display_text,
    delivery_status,
    provider,
    room_id,
    room_name,
    payload,
    created_by_user_id,
    created_at
  )
  values (
    p_workspace_id,
    p_encounter_id,
    v_queue.id,
    'did_call_requested',
    v_room_name || '로 환자를 호출하고 진료를 시작합니다.',
    'queued',
    'local_outbox',
    p_room_id,
    v_room_name,
    jsonb_build_object(
      'didProvider', 'not_configured',
      'roomId', p_room_id,
      'roomName', v_room_name
    ),
    v_actor_user_id,
    v_now
  )
  returning * into v_call_event;

  return jsonb_build_object(
    'encounter', row_to_json(v_encounter),
    'queueEntry', row_to_json(v_queue),
    'callEvent', jsonb_build_object(
      'id', v_call_event.id::text,
      'workspaceId', v_call_event.workspace_id,
      'encounterId', v_call_event.encounter_id::text,
      'queueEntryId', v_call_event.queue_entry_id::text,
      'eventType', v_call_event.event_type,
      'displayText', v_call_event.display_text,
      'deliveryStatus', v_call_event.delivery_status,
      'roomId', v_call_event.room_id,
      'roomName', v_call_event.room_name,
      'createdAt', v_call_event.created_at,
      'createdByUserId', v_call_event.created_by_user_id::text
    )
  );
end;
$$;

revoke all on function private.clair_call_consultation_queue_internal(text, text, uuid, text)
  from public, anon, authenticated;

create or replace function public.clair_call_consultation_queue(
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
  v_room_id text;
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

  select space.id::text
    into v_room_id
  from public.workspace_spaces space
  join public.workspace_space_categories category
    on category.id = space.category_id
   and category.workspace_id = space.workspace_id
  where space.workspace_id = p_workspace_id
    and space.archived_at is null
    and category.archived_at is null
    and category.icon_key = 'consult'
  order by category.sort_order, space.sort_order, space.name, space.id
  limit 1;

  if v_room_id is null then
    raise exception 'room_unavailable';
  end if;

  return public.clair_call_consultation_queue(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id,
    v_room_id
  );
end;
$$;

revoke all on function public.clair_call_consultation_queue(text, text, uuid)
  from public, anon;
grant execute on function public.clair_call_consultation_queue(text, text, uuid)
  to authenticated;

comment on function private.clair_call_consultation_queue_internal(text, text, uuid, text) is
  'Calls a consultation patient into an active workspace-managed consultation room.';
comment on function public.clair_call_consultation_queue(text, text, uuid) is
  'Compatibility wrapper that selects the first active workspace-managed consultation room.';
