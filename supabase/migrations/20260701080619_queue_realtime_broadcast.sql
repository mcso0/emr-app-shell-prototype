create or replace function private.clair_queue_realtime_topic(p_workspace_id text)
returns text
language sql
stable
as $$
  select 'workspace:' || p_workspace_id || ':queue'
$$;

create or replace function private.clair_queue_realtime_workspace_from_topic(p_topic text)
returns text
language sql
stable
as $$
  select substring(p_topic from '^workspace:([^:]+):queue(?:$|:)')
$$;

drop policy if exists clair_queue_realtime_broadcast_receive on realtime.messages;
create policy clair_queue_realtime_broadcast_receive
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and private.clair_queue_realtime_workspace_from_topic((select realtime.topic())) is not null
  and private.clair_is_active_workspace_member(
    private.clair_queue_realtime_workspace_from_topic((select realtime.topic()))
  )
);

create or replace function private.clair_broadcast_queue_changed()
returns trigger
language plpgsql
security definer
set search_path = public, private, realtime
as $$
declare
  v_workspace_id text;
  v_entity_id text;
begin
  if TG_OP = 'DELETE' then
    v_workspace_id := old.workspace_id;
    v_entity_id := old.id::text;
  else
    v_workspace_id := new.workspace_id;
    v_entity_id := new.id::text;
  end if;

  if v_workspace_id is null then
    return null;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'workspaceId', v_workspace_id,
      'domain', 'queue',
      'sourceTable', TG_TABLE_NAME,
      'operation', TG_OP,
      'entityId', v_entity_id,
      'occurredAt', now(),
      'version', 1
    ),
    'queue_changed',
    private.clair_queue_realtime_topic(v_workspace_id),
    true
  );

  return null;
end;
$$;

drop trigger if exists clair_waiting_queue_entries_realtime on public.waiting_queue_entries;
create trigger clair_waiting_queue_entries_realtime
after insert or update or delete on public.waiting_queue_entries
for each row
execute function private.clair_broadcast_queue_changed();

drop trigger if exists clair_order_fulfillment_work_items_realtime on public.order_fulfillment_work_items;
create trigger clair_order_fulfillment_work_items_realtime
after insert or update or delete on public.order_fulfillment_work_items
for each row
execute function private.clair_broadcast_queue_changed();

drop trigger if exists clair_encounters_realtime on public.encounters;
create trigger clair_encounters_realtime
after insert or update or delete on public.encounters
for each row
execute function private.clair_broadcast_queue_changed();

grant execute on function private.clair_queue_realtime_topic(text) to authenticated;
grant execute on function private.clair_queue_realtime_workspace_from_topic(text) to authenticated;
