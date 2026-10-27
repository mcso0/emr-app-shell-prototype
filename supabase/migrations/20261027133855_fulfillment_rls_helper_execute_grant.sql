-- RLS evaluates this pure permission-name mapper as the authenticated caller.
-- Preserve the existing membership/capability policy and table privileges.
grant execute on function private.clair_queue_permission_for_destination(text, text) to authenticated;
