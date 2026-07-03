create or replace function public.clair_call_consultation_queue(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_room_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
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

  v_room_name := case p_room_id
    when 'room-consult-1' then '1진료실'
    when 'room-consult-2' then '2진료실'
    when 'room-cat' then '고양이 진료실'
    when 'room-director' then '원장 진료실'
    else null
  end;

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

create or replace function public.clair_call_consultation_queue(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
begin
  return public.clair_call_consultation_queue(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id,
    'room-consult-1'
  );
end;
$$;

with called_consultation as (
  select
    e.id as encounter_id,
    e.workspace_id,
    coalesce(e.started_at, q.called_at, now()) as started_at
  from public.encounters e
  join public.waiting_queue_entries q
    on q.workspace_id = e.workspace_id
   and q.encounter_id = e.id
   and q.queue_type = 'consultation'
  where q.status = 'called'
    and e.status = 'waiting'
)
update public.encounters e
set
  status = 'in_consultation',
  started_at = called_consultation.started_at,
  updated_at = now()
from called_consultation
where e.workspace_id = called_consultation.workspace_id
  and e.id = called_consultation.encounter_id;

update public.waiting_queue_entries
set
  status = 'in_progress',
  called_at = coalesce(called_at, now())
where queue_type = 'consultation'
  and status = 'called';

revoke all on function public.clair_call_consultation_queue(text, text, uuid) from public;
revoke all on function public.clair_call_consultation_queue(text, text, uuid) from authenticated;
revoke all on function public.clair_call_consultation_queue(text, text, uuid, text) from public;
grant execute on function public.clair_call_consultation_queue(text, text, uuid) to authenticated;
grant execute on function public.clair_call_consultation_queue(text, text, uuid, text) to authenticated;

comment on function public.clair_call_consultation_queue(text, text, uuid, text) is
  'Calls a synthetic consultation patient and immediately starts consultation; queue called state is retired from the chart flow.';
comment on function public.clair_call_consultation_queue(text, text, uuid) is
  'Compatibility wrapper for legacy consultation call clients; defaults to 1진료실 and immediately starts consultation.';
