-- DEN-45: persisted workspace membership list reader.
-- Local-first only. Remote Supabase execution remains approval-gated.

create or replace function public.clair_list_active_workspaces_for_current_user()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', workspace.id,
        'displayName', workspace.display_name,
        'membershipId', membership.id::text,
        'roles', membership.roles,
        'status', membership.status
      )
      order by workspace.display_name
    ),
    '[]'::jsonb
  )
  from public.user_memberships membership
  join public.workspaces workspace on workspace.id = membership.workspace_id
  join public.users app_user on app_user.id = membership.user_id
  where membership.user_id = auth.uid()
    and membership.status = 'active'
    and app_user.status = 'active'
    and workspace.status = 'active';
$$;

revoke all on function public.clair_list_active_workspaces_for_current_user()
  from public;
revoke all on function public.clair_list_active_workspaces_for_current_user()
  from anon;
grant execute on function public.clair_list_active_workspaces_for_current_user()
  to authenticated;

comment on function public.clair_list_active_workspaces_for_current_user() is
  'Lists active workspaces for the verified user based on active persisted memberships.';
