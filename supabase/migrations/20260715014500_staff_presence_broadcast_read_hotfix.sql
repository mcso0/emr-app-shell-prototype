-- RECEPTION-PR-009 hotfix: hosted Realtime evaluates broadcast.read when a
-- private channel joins, including Presence-only channels. Keep the existing
-- workspace:([^:]+):staff-presence topic parser and grant receive-only access
-- for both handshake extensions to active members of that workspace.
--
-- The existing clair_staff_presence_track INSERT policy remains Presence-only,
-- so clients still cannot publish Broadcast messages on this topic.

drop policy if exists clair_staff_presence_receive on realtime.messages;
create policy clair_staff_presence_receive
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and private.clair_staff_presence_workspace_from_topic(
    (select realtime.topic())
  ) is not null
  and private.clair_is_active_workspace_member(
    private.clair_staff_presence_workspace_from_topic(
      (select realtime.topic())
    )
  )
);
