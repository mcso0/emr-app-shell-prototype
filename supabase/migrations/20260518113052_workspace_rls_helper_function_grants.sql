-- DEN-94: allow authenticated policy evaluation to execute private RLS helpers.
-- The private schema remains outside the exposed API schemas; these grants only allow
-- RLS policy expressions to call the helper functions for authenticated requests.

grant usage on schema private to authenticated;

grant execute on function private.clair_is_active_workspace_member(text) to authenticated;
grant execute on function private.clair_is_workspace_admin(text) to authenticated;

revoke all on function private.clair_is_active_workspace_member(text) from anon;
revoke all on function private.clair_is_workspace_admin(text) from anon;

comment on function private.clair_is_active_workspace_member(text) is
  'RLS helper: true when auth.uid() is an active app user with active membership in the workspace. Authenticated execute grant is required for policy evaluation.';
comment on function private.clair_is_workspace_admin(text) is
  'RLS helper: true when auth.uid() is an active app user with active hospital_admin membership in the workspace. Authenticated execute grant is required for policy evaluation.';
