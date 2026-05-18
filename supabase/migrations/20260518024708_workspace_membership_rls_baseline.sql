-- DEN-37: workspace membership RLS baseline.
-- Local-first draft only. Domain table RLS follows in later work.

create schema if not exists private;

create or replace function private.clair_is_active_workspace_member(p_workspace_id text)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.user_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = p_workspace_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and app_user.status = 'active'
  );
$$;

create or replace function private.clair_is_workspace_admin(p_workspace_id text)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.user_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = p_workspace_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.roles @> array['hospital_admin']::text[]
      and app_user.status = 'active'
  );
$$;

revoke all on function private.clair_is_active_workspace_member(text) from public;
revoke all on function private.clair_is_workspace_admin(text) from public;

alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_memberships enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.permission_policies enable row level security;

grant select on public.users to authenticated;
grant select, update on public.workspaces to authenticated;
grant select, insert, update on public.user_profiles to authenticated;
grant select, insert, update, delete on public.user_memberships to authenticated;
grant select, insert, update, delete on public.workspace_invitations to authenticated;
grant select, insert, update, delete on public.permission_policies to authenticated;

drop policy if exists users_select_self_or_workspace_member on public.users;
create policy users_select_self_or_workspace_member
on public.users
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.user_memberships membership
    where membership.user_id = users.id
      and private.clair_is_active_workspace_member(membership.workspace_id)
  )
);

drop policy if exists workspaces_select_active_member on public.workspaces;
create policy workspaces_select_active_member
on public.workspaces
for select
to authenticated
using (private.clair_is_active_workspace_member(id));

drop policy if exists workspaces_update_admin on public.workspaces;
create policy workspaces_update_admin
on public.workspaces
for update
to authenticated
using (private.clair_is_workspace_admin(id))
with check (private.clair_is_workspace_admin(id));

drop policy if exists user_profiles_select_self_or_workspace_member on public.user_profiles;
create policy user_profiles_select_self_or_workspace_member
on public.user_profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.user_memberships membership
    where membership.user_id = user_profiles.user_id
      and private.clair_is_active_workspace_member(membership.workspace_id)
  )
);

drop policy if exists user_profiles_insert_self on public.user_profiles;
create policy user_profiles_insert_self
on public.user_profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists user_profiles_update_self on public.user_profiles;
create policy user_profiles_update_self
on public.user_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists user_memberships_select_active_member on public.user_memberships;
create policy user_memberships_select_active_member
on public.user_memberships
for select
to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists user_memberships_insert_admin on public.user_memberships;
create policy user_memberships_insert_admin
on public.user_memberships
for insert
to authenticated
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists user_memberships_update_admin on public.user_memberships;
create policy user_memberships_update_admin
on public.user_memberships
for update
to authenticated
using (private.clair_is_workspace_admin(workspace_id))
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists user_memberships_delete_admin on public.user_memberships;
create policy user_memberships_delete_admin
on public.user_memberships
for delete
to authenticated
using (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_invitations_select_admin on public.workspace_invitations;
create policy workspace_invitations_select_admin
on public.workspace_invitations
for select
to authenticated
using (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_invitations_insert_admin on public.workspace_invitations;
create policy workspace_invitations_insert_admin
on public.workspace_invitations
for insert
to authenticated
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_invitations_update_admin on public.workspace_invitations;
create policy workspace_invitations_update_admin
on public.workspace_invitations
for update
to authenticated
using (private.clair_is_workspace_admin(workspace_id))
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_invitations_delete_admin on public.workspace_invitations;
create policy workspace_invitations_delete_admin
on public.workspace_invitations
for delete
to authenticated
using (private.clair_is_workspace_admin(workspace_id));

drop policy if exists permission_policies_select_active_member on public.permission_policies;
create policy permission_policies_select_active_member
on public.permission_policies
for select
to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists permission_policies_insert_admin on public.permission_policies;
create policy permission_policies_insert_admin
on public.permission_policies
for insert
to authenticated
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists permission_policies_update_admin on public.permission_policies;
create policy permission_policies_update_admin
on public.permission_policies
for update
to authenticated
using (private.clair_is_workspace_admin(workspace_id))
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists permission_policies_delete_admin on public.permission_policies;
create policy permission_policies_delete_admin
on public.permission_policies
for delete
to authenticated
using (private.clair_is_workspace_admin(workspace_id));

comment on function private.clair_is_active_workspace_member(text) is
  'RLS helper: true when auth.uid() is an active app user with active membership in the workspace.';
comment on function private.clair_is_workspace_admin(text) is
  'RLS helper: true when auth.uid() is an active app user with active hospital_admin membership in the workspace.';
