-- Preserve per-user read/archive acknowledgement when the same reception
-- waiting alert is refreshed. Other notification kinds keep their existing
-- repeat policy in the legacy emitter.
create or replace function public.clair_emit_notification_event(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_event jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp, pg_catalog
as $$
declare
  v_event_scope_id text;
  v_existing_notification_id text;
  v_preserved_states jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if p_actor_user_id is null or p_actor_user_id <> auth.uid() then
    raise exception 'notification_actor_mismatch';
  end if;

  if coalesce(p_event ->> 'eventScopeId', '') = 'order-set-review' then
    raise exception 'order_set_notification_writer_required' using errcode = '42501';
  end if;

  if coalesce(p_event ->> 'eventKey', '') <> 'waiting_over_30m' then
    return public.clair_emit_notification_event_legacy(
      p_workspace_id,
      p_actor_user_id,
      p_event
    );
  end if;

  v_event_scope_id := private.clair_notification_scope_id(
    p_event ->> 'eventScopeId'
  );

  select event_row.notification_id
    into v_existing_notification_id
  from public.notification_events event_row
  where event_row.workspace_id = p_workspace_id
    and event_row.event_scope_id = v_event_scope_id
    and event_row.dedupe_key = p_event ->> 'dedupeKey'
  for update;

  if v_existing_notification_id is not null then
    select coalesce(jsonb_agg(to_jsonb(locked_state)), '[]'::jsonb)
      into v_preserved_states
    from (
      select
        state_row.actor_user_id,
        state_row.state_scope_id,
        state_row.notification_id,
        state_row.read_at,
        state_row.archived_at,
        state_row.created_at,
        state_row.updated_at
      from public.notification_user_states state_row
      where state_row.workspace_id = p_workspace_id
        and state_row.notification_id = v_existing_notification_id
      for update
    ) locked_state;
  end if;

  v_result := public.clair_emit_notification_event_legacy(
    p_workspace_id,
    p_actor_user_id,
    p_event
  );

  if jsonb_array_length(v_preserved_states) > 0 then
    insert into public.notification_user_states (
      workspace_id,
      actor_user_id,
      state_scope_id,
      notification_id,
      read_at,
      archived_at,
      created_at,
      updated_at
    )
    select
      p_workspace_id,
      preserved.actor_user_id,
      preserved.state_scope_id,
      preserved.notification_id,
      preserved.read_at,
      preserved.archived_at,
      preserved.created_at,
      preserved.updated_at
    from jsonb_to_recordset(v_preserved_states) as preserved(
      actor_user_id uuid,
      state_scope_id text,
      notification_id text,
      read_at timestamptz,
      archived_at timestamptz,
      created_at timestamptz,
      updated_at timestamptz
    )
    on conflict (workspace_id, actor_user_id, state_scope_id, notification_id)
    do update set
      read_at = excluded.read_at,
      archived_at = excluded.archived_at,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;
  end if;

  return v_result;
end;
$$;

revoke all on function public.clair_emit_notification_event(text, uuid, jsonb)
  from public, anon, service_role;
grant execute on function public.clair_emit_notification_event(text, uuid, jsonb)
  to authenticated;

comment on function public.clair_emit_notification_event(text, uuid, jsonb) is
  'Emits authorized notification events while preserving per-user acknowledgement for repeated reception waiting alerts.';
