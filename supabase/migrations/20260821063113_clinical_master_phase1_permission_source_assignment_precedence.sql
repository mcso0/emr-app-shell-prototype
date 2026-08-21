-- CLINICAL-MASTER Phase 1 permission-source correction.
-- Assignment rows are authoritative when present; legacy policies remain a
-- compatibility fallback only for memberships without an assignment row.

create or replace function private.clair_current_user_has_workspace_permission(
  p_workspace_id text,
  p_permission_id text
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  with active_membership as (
    select membership.id, membership.user_id, membership.roles
    from public.user_memberships membership
    join public.users app_user
      on app_user.id = membership.user_id
    where membership.workspace_id = p_workspace_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and app_user.status = 'active'
  )
  select exists (
    select 1
    from active_membership membership
    where (
      (
        exists (
          select 1
          from public.workspace_membership_permission_role_assignments assignment
          join public.workspace_permission_roles assigned_role
            on assigned_role.workspace_id = assignment.workspace_id
           and assigned_role.id = assignment.permission_role_id
          where assignment.workspace_id = p_workspace_id
            and assignment.membership_id = membership.id
            and assigned_role.status = 'active'
            and (
              coalesce(assigned_role.permissions -> 'allowed', '[]'::jsonb) ? '*'
              or coalesce(assigned_role.permissions -> 'allowed', '[]'::jsonb) ? p_permission_id
            )
        )
      )
      or (
        not exists (
          select 1
          from public.workspace_membership_permission_role_assignments assignment
          where assignment.workspace_id = p_workspace_id
            and assignment.membership_id = membership.id
        )
        and (
          membership.roles @> array['hospital_admin']::text[]
          or exists (
            select 1
            from public.permission_policies policy
            where policy.workspace_id = p_workspace_id
              and (
                (
                  policy.scope = 'role'
                  and policy.target_role = any(membership.roles)
                )
                or (
                  policy.scope = 'user'
                  and policy.target_user_id = membership.user_id
                )
              )
              and (
                coalesce(policy.permissions -> 'allowed', '[]'::jsonb) ? '*'
                or coalesce(policy.permissions -> 'allowed', '[]'::jsonb) ? p_permission_id
              )
          )
        )
      )
    )
  );
$$;

revoke all on function private.clair_current_user_has_workspace_permission(text, text)
  from public, anon;
grant execute on function private.clair_current_user_has_workspace_permission(text, text)
  to authenticated;

comment on function private.clair_current_user_has_workspace_permission(text, text) is
  'DEN-505 helper: true when auth.uid() is an active workspace member with the requested DB-backed permission policy.';
