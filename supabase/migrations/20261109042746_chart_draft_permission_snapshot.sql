-- Return the same RLS-visible inputs used by the chart draft permission resolver
-- in one read-only request. The session determines the actor.
begin;

create or replace function public.clair_read_chart_draft_permission_snapshot(p_workspace_id text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with memberships as materialized (
    select m.id, m.workspace_id, m.user_id, m.roles, m.status
    from public.user_memberships m
    where m.workspace_id = p_workspace_id and m.user_id = (select auth.uid())
  )
  select jsonb_build_object(
    'memberships', coalesce((select jsonb_agg(m) from memberships m), '[]'::jsonb),
    'users', coalesce((select jsonb_agg(u) from (
      select id, status, display_name
      from public.users
      where id = (select auth.uid())
    ) u), '[]'::jsonb),
    'permissionPolicies', coalesce((select jsonb_agg(p) from (
      select workspace_id, scope, target_role, permissions
      from public.permission_policies
      where workspace_id = p_workspace_id and scope = 'role'
    ) p), '[]'::jsonb),
    'permissionRoleAssignments', coalesce((select jsonb_agg(a) from (
      select assignment.workspace_id, assignment.membership_id, assignment.permission_role_id,
        role.role_key, role.label, role.role_type, role.permissions
      from memberships m
      join public.workspace_membership_permission_role_assignments assignment
        on assignment.workspace_id = m.workspace_id and assignment.membership_id = m.id
      join public.workspace_permission_roles role
        on role.workspace_id = assignment.workspace_id and role.id = assignment.permission_role_id
    ) a), '[]'::jsonb),
    'jobPositionAssignments', coalesce((select jsonb_agg(a) from (
      select assignment.workspace_id, assignment.membership_id, assignment.job_position_id,
        position.position_key, position.label
      from memberships m
      join public.workspace_membership_job_position_assignments assignment
        on assignment.workspace_id = m.workspace_id and assignment.membership_id = m.id
      join public.workspace_job_positions position
        on position.workspace_id = assignment.workspace_id and position.id = assignment.job_position_id
    ) a), '[]'::jsonb)
  );
$function$;

revoke all on function public.clair_read_chart_draft_permission_snapshot(text) from public, anon, service_role;
grant execute on function public.clair_read_chart_draft_permission_snapshot(text) to authenticated;

commit;
