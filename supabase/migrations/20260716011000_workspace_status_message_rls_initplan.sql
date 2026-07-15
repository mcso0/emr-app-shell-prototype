-- RECEPTION-LIVE-PR-014: avoid per-row auth.uid() re-evaluation while
-- preserving the same self-only write boundary.

alter policy workspace_member_status_messages_insert_self
on public.workspace_member_status_messages
with check (
  user_id = (select auth.uid())
  and private.clair_is_active_workspace_member(workspace_id)
);

alter policy workspace_member_status_messages_update_self
on public.workspace_member_status_messages
using (
  user_id = (select auth.uid())
  and private.clair_is_active_workspace_member(workspace_id)
)
with check (
  user_id = (select auth.uid())
  and private.clair_is_active_workspace_member(workspace_id)
);

alter policy workspace_member_status_messages_delete_self
on public.workspace_member_status_messages
using (
  user_id = (select auth.uid())
  and private.clair_is_active_workspace_member(workspace_id)
);
