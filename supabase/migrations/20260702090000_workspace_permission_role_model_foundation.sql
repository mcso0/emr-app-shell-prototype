-- AUTH-PR-044: additive workspace permission role and job position foundation.
-- Local-first draft only. Remote Supabase application remains approval-gated.

create schema if not exists private;

create or replace function public.clair_permission_role_type_values()
returns text[]
language sql
immutable
as $$
  select array['owner', 'admin', 'standard', 'custom']::text[];
$$;

create or replace function public.clair_owner_only_permission_values()
returns text[]
language sql
immutable
as $$
  select array[
    '*',
    'workspace:delete',
    'workspace:transfer_owner',
    'billing_contract:manage',
    'workspace_data:dangerous_delete'
  ]::text[];
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_memberships_workspace_id_id_key'
  ) then
    alter table public.user_memberships
      add constraint user_memberships_workspace_id_id_key unique (workspace_id, id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_invitations_workspace_id_id_key'
  ) then
    alter table public.workspace_invitations
      add constraint workspace_invitations_workspace_id_id_key unique (workspace_id, id);
  end if;
end;
$$;

create table if not exists public.workspace_permission_roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  role_key text not null
    check (role_key ~ '^[a-z0-9][a-z0-9_:-]{1,62}$'),
  label text not null
    check (btrim(label) <> ''),
  description text,
  role_type text not null
    check (role_type = any(public.clair_permission_role_type_values())),
  permissions jsonb not null default '{"allowed":[]}'::jsonb
    check (
      jsonb_typeof(permissions) = 'object'
      and permissions ? 'allowed'
      and jsonb_typeof(permissions->'allowed') = 'array'
    )
    check (
      role_type <> 'custom'
      or not (permissions->'allowed' ?| public.clair_owner_only_permission_values())
    ),
  is_system boolean not null default false,
  is_assignable boolean not null default true,
  sort_order integer not null default 100,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, role_key)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_permission_roles_workspace_id_id_key'
  ) then
    alter table public.workspace_permission_roles
      add constraint workspace_permission_roles_workspace_id_id_key unique (workspace_id, id);
  end if;
end;
$$;

create table if not exists public.workspace_job_positions (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  position_key text not null
    check (position_key ~ '^[a-z0-9][a-z0-9_:-]{1,62}$'),
  label text not null
    check (btrim(label) <> ''),
  description text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, position_key)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_job_positions_workspace_id_id_key'
  ) then
    alter table public.workspace_job_positions
      add constraint workspace_job_positions_workspace_id_id_key unique (workspace_id, id);
  end if;
end;
$$;

create table if not exists public.workspace_membership_permission_role_assignments (
  membership_id uuid primary key references public.user_memberships(id) on delete cascade,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  permission_role_id uuid not null,
  assigned_by_user_id uuid references public.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, membership_id)
    references public.user_memberships(workspace_id, id) on delete cascade,
  foreign key (workspace_id, permission_role_id)
    references public.workspace_permission_roles(workspace_id, id) on delete restrict
);

create table if not exists public.workspace_membership_job_position_assignments (
  membership_id uuid primary key references public.user_memberships(id) on delete cascade,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  job_position_id uuid not null,
  assigned_by_user_id uuid references public.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, membership_id)
    references public.user_memberships(workspace_id, id) on delete cascade,
  foreign key (workspace_id, job_position_id)
    references public.workspace_job_positions(workspace_id, id) on delete restrict
);

create table if not exists public.workspace_invitation_permission_role_assignments (
  invitation_id uuid primary key references public.workspace_invitations(id) on delete cascade,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  permission_role_id uuid not null,
  assigned_by_user_id uuid references public.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, invitation_id)
    references public.workspace_invitations(workspace_id, id) on delete cascade,
  foreign key (workspace_id, permission_role_id)
    references public.workspace_permission_roles(workspace_id, id) on delete restrict
);

create table if not exists public.workspace_invitation_job_position_assignments (
  invitation_id uuid primary key references public.workspace_invitations(id) on delete cascade,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  job_position_id uuid not null,
  assigned_by_user_id uuid references public.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, invitation_id)
    references public.workspace_invitations(workspace_id, id) on delete cascade,
  foreign key (workspace_id, job_position_id)
    references public.workspace_job_positions(workspace_id, id) on delete restrict
);

create index if not exists workspace_permission_roles_workspace_type_idx
  on public.workspace_permission_roles (workspace_id, role_type);

create index if not exists workspace_permission_roles_permissions_gin_idx
  on public.workspace_permission_roles using gin (permissions);

create index if not exists workspace_job_positions_workspace_active_idx
  on public.workspace_job_positions (workspace_id, is_active, sort_order);

create index if not exists workspace_membership_permission_roles_workspace_idx
  on public.workspace_membership_permission_role_assignments (workspace_id, permission_role_id);

create index if not exists workspace_membership_job_positions_workspace_idx
  on public.workspace_membership_job_position_assignments (workspace_id, job_position_id);

create index if not exists workspace_invitation_permission_roles_workspace_idx
  on public.workspace_invitation_permission_role_assignments (workspace_id, permission_role_id);

create index if not exists workspace_invitation_job_positions_workspace_idx
  on public.workspace_invitation_job_position_assignments (workspace_id, job_position_id);

drop trigger if exists set_workspace_permission_roles_updated_at on public.workspace_permission_roles;
create trigger set_workspace_permission_roles_updated_at
before update on public.workspace_permission_roles
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_workspace_job_positions_updated_at on public.workspace_job_positions;
create trigger set_workspace_job_positions_updated_at
before update on public.workspace_job_positions
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_workspace_membership_permission_role_assignments_updated_at
  on public.workspace_membership_permission_role_assignments;
create trigger set_workspace_membership_permission_role_assignments_updated_at
before update on public.workspace_membership_permission_role_assignments
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_workspace_membership_job_position_assignments_updated_at
  on public.workspace_membership_job_position_assignments;
create trigger set_workspace_membership_job_position_assignments_updated_at
before update on public.workspace_membership_job_position_assignments
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_workspace_invitation_permission_role_assignments_updated_at
  on public.workspace_invitation_permission_role_assignments;
create trigger set_workspace_invitation_permission_role_assignments_updated_at
before update on public.workspace_invitation_permission_role_assignments
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_workspace_invitation_job_position_assignments_updated_at
  on public.workspace_invitation_job_position_assignments;
create trigger set_workspace_invitation_job_position_assignments_updated_at
before update on public.workspace_invitation_job_position_assignments
for each row execute function public.clair_set_updated_at();

with default_permission_roles(role_key, label, role_type, permissions, sort_order) as (
  values
    (
      'owner',
      '소유자',
      'owner',
      '{"allowed":["*"]}'::jsonb,
      10
    ),
    (
      'admin',
      '관리자',
      'admin',
      '{"allowed":["reception:view","reception:create","reception:update","patient:view","patient:create","patient:update","encounter:view","encounter:create","encounter:update","chart:view","chart:update","order:view","order:request","order:update","dispensing:view","dispensing:complete","lab:view","lab:complete","imaging:view","imaging:complete","billing:view","billing:issue","service_catalog:view","service_catalog:manage","role_permission:view","role_permission:manage"]}'::jsonb,
      20
    ),
    (
      'general',
      '일반',
      'standard',
      '{"allowed":["reception:view","reception:create","reception:update","patient:view","patient:create","patient:update","encounter:view","encounter:create","encounter:update","chart:view","chart:update","order:view","order:request","order:update","dispensing:view","dispensing:complete","lab:view","lab:complete","imaging:view","imaging:complete","billing:view","billing:issue","service_catalog:view"]}'::jsonb,
      30
    )
)
insert into public.workspace_permission_roles (
  workspace_id,
  role_key,
  label,
  role_type,
  permissions,
  is_system,
  is_assignable,
  sort_order
)
select
  workspace.id,
  role.role_key,
  role.label,
  role.role_type,
  role.permissions,
  true,
  true,
  role.sort_order
from public.workspaces workspace
cross join default_permission_roles role
on conflict (workspace_id, role_key) do update
set
  label = excluded.label,
  role_type = excluded.role_type,
  permissions = excluded.permissions,
  is_system = true,
  is_assignable = true,
  sort_order = excluded.sort_order,
  updated_at = now();

with default_job_positions(position_key, label, sort_order) as (
  values
    ('hospital_director', '병원장', 10),
    ('veterinarian', '수의사', 20),
    ('technician', '테크니션', 30),
    ('front_desk', '데스크', 40)
)
insert into public.workspace_job_positions (
  workspace_id,
  position_key,
  label,
  is_system,
  is_active,
  sort_order
)
select
  workspace.id,
  position.position_key,
  position.label,
  true,
  true,
  position.sort_order
from public.workspaces workspace
cross join default_job_positions position
on conflict (workspace_id, position_key) do update
set
  label = excluded.label,
  is_system = true,
  is_active = true,
  sort_order = excluded.sort_order,
  updated_at = now();

with membership_permission_role_backfill as (
  select
    m.*,
    case
      when m.roles @> array['hospital_admin']::text[] then 'owner'
      else 'general'
    end as next_role_key
  from public.user_memberships m
)
insert into public.workspace_membership_permission_role_assignments (
  workspace_id,
  membership_id,
  permission_role_id,
  assigned_by_user_id,
  assigned_at
)
select
  m.workspace_id,
  m.id,
  role.id,
  m.invited_by_user_id,
  coalesce(m.activated_at, m.created_at, now())
from membership_permission_role_backfill m
join public.workspace_permission_roles role
  on role.workspace_id = m.workspace_id
  and (
    (m.next_role_key = 'owner' and role.role_key = 'owner')
    or (m.next_role_key = 'general' and role.role_key = 'general')
  )
on conflict (membership_id) do update
set
  workspace_id = excluded.workspace_id,
  permission_role_id = excluded.permission_role_id,
  updated_at = now();

insert into public.workspace_membership_job_position_assignments (
  workspace_id,
  membership_id,
  job_position_id,
  assigned_by_user_id,
  assigned_at
)
select
  m.workspace_id,
  m.id,
  position.id,
  m.invited_by_user_id,
  coalesce(m.activated_at, m.created_at, now())
from public.user_memberships m
join public.workspace_job_positions position
  on position.workspace_id = m.workspace_id
  and position.position_key = case
    when m.roles @> array['hospital_admin']::text[] then 'hospital_director'
    when m.roles @> array['vet']::text[] then 'veterinarian'
    when m.roles @> array['technician']::text[] then 'technician'
    when m.roles @> array['front_desk']::text[] then 'front_desk'
    else 'front_desk'
  end
on conflict (membership_id) do update
set
  workspace_id = excluded.workspace_id,
  job_position_id = excluded.job_position_id,
  updated_at = now();

insert into public.workspace_invitation_permission_role_assignments (
  workspace_id,
  invitation_id,
  permission_role_id,
  assigned_by_user_id,
  assigned_at
)
select
  invitation.workspace_id,
  invitation.id,
  role.id,
  invitation.invited_by_user_id,
  invitation.created_at
from public.workspace_invitations invitation
join public.workspace_permission_roles role
  on role.workspace_id = invitation.workspace_id
  and role.role_key = case
    when invitation.invited_roles @> array['hospital_admin']::text[] then 'owner'
    else 'general'
  end
on conflict (invitation_id) do update
set
  workspace_id = excluded.workspace_id,
  permission_role_id = excluded.permission_role_id,
  updated_at = now();

insert into public.workspace_invitation_job_position_assignments (
  workspace_id,
  invitation_id,
  job_position_id,
  assigned_by_user_id,
  assigned_at
)
select
  invitation.workspace_id,
  invitation.id,
  position.id,
  invitation.invited_by_user_id,
  invitation.created_at
from public.workspace_invitations invitation
join public.workspace_job_positions position
  on position.workspace_id = invitation.workspace_id
  and position.position_key = case
    when invitation.invited_roles @> array['hospital_admin']::text[] then 'hospital_director'
    when invitation.invited_roles @> array['vet']::text[] then 'veterinarian'
    when invitation.invited_roles @> array['technician']::text[] then 'technician'
    when invitation.invited_roles @> array['front_desk']::text[] then 'front_desk'
    else 'front_desk'
  end
on conflict (invitation_id) do update
set
  workspace_id = excluded.workspace_id,
  job_position_id = excluded.job_position_id,
  updated_at = now();

create or replace function private.clair_is_workspace_owner(p_workspace_id text)
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
    left join public.workspace_membership_permission_role_assignments assignment
      on assignment.workspace_id = membership.workspace_id
      and assignment.membership_id = membership.id
    left join public.workspace_permission_roles role
      on role.workspace_id = assignment.workspace_id
      and role.id = assignment.permission_role_id
    where membership.workspace_id = p_workspace_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and app_user.status = 'active'
      and (
        role.role_type = 'owner'
        or membership.roles @> array['hospital_admin']::text[]
      )
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
    left join public.workspace_membership_permission_role_assignments assignment
      on assignment.workspace_id = membership.workspace_id
      and assignment.membership_id = membership.id
    left join public.workspace_permission_roles role
      on role.workspace_id = assignment.workspace_id
      and role.id = assignment.permission_role_id
    where membership.workspace_id = p_workspace_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and app_user.status = 'active'
      and (
        role.role_type in ('owner', 'admin')
        or membership.roles @> array['hospital_admin']::text[]
      )
  );
$$;

create or replace function private.clair_assert_not_last_active_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  old_is_active_owner boolean := false;
  next_is_active_owner boolean := false;
  remaining_active_owner_count integer := 0;
  checked_workspace_id text;
  checked_membership_id uuid;
begin
  if tg_table_name = 'workspace_membership_permission_role_assignments' then
    checked_workspace_id := old.workspace_id;
    checked_membership_id := old.membership_id;

    select exists (
      select 1
      from public.user_memberships membership
      join public.workspace_permission_roles role
        on role.workspace_id = old.workspace_id
        and role.id = old.permission_role_id
      where membership.workspace_id = old.workspace_id
        and membership.id = old.membership_id
        and membership.status = 'active'
        and role.role_type = 'owner'
    ) into old_is_active_owner;

    if tg_op = 'UPDATE' then
      select exists (
        select 1
        from public.user_memberships membership
        join public.workspace_permission_roles role
          on role.workspace_id = new.workspace_id
          and role.id = new.permission_role_id
        where membership.workspace_id = new.workspace_id
          and membership.id = new.membership_id
          and membership.status = 'active'
          and role.role_type = 'owner'
      ) into next_is_active_owner;
    end if;
  else
    checked_workspace_id := old.workspace_id;
    checked_membership_id := old.id;

    select exists (
      select 1
      from public.workspace_membership_permission_role_assignments assignment
      join public.workspace_permission_roles role
        on role.workspace_id = assignment.workspace_id
        and role.id = assignment.permission_role_id
      where assignment.workspace_id = old.workspace_id
        and assignment.membership_id = old.id
        and old.status = 'active'
        and role.role_type = 'owner'
    ) into old_is_active_owner;

    if tg_op = 'UPDATE' then
      next_is_active_owner :=
        new.workspace_id = old.workspace_id
        and new.status = 'active'
        and old_is_active_owner;
    end if;
  end if;

  if old_is_active_owner and not next_is_active_owner then
    select count(*)
      into remaining_active_owner_count
    from public.workspace_membership_permission_role_assignments assignment
    join public.user_memberships membership
      on membership.workspace_id = assignment.workspace_id
      and membership.id = assignment.membership_id
    join public.workspace_permission_roles role
      on role.workspace_id = assignment.workspace_id
      and role.id = assignment.permission_role_id
    where assignment.workspace_id = checked_workspace_id
      and assignment.membership_id <> checked_membership_id
      and membership.status = 'active'
      and role.role_type = 'owner';

    if remaining_active_owner_count = 0 then
      raise exception 'last_active_workspace_owner_protected'
        using
          errcode = '23514',
          detail = 'At least one active workspace owner must remain in each workspace.',
          hint = 'Assign another active owner before removing, demoting, or deactivating this owner.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_last_active_workspace_owner_assignment
  on public.workspace_membership_permission_role_assignments;
create trigger protect_last_active_workspace_owner_assignment
before update or delete on public.workspace_membership_permission_role_assignments
for each row execute function private.clair_assert_not_last_active_workspace_owner();

drop trigger if exists protect_last_active_workspace_owner_membership on public.user_memberships;
create trigger protect_last_active_workspace_owner_membership
before update or delete on public.user_memberships
for each row execute function private.clair_assert_not_last_active_workspace_owner();

create or replace function private.update_workspace_membership_permission_role(
  p_workspace_id text,
  p_membership_id uuid,
  p_next_permission_role_id uuid
)
returns public.workspace_membership_permission_role_assignments
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  updated_assignment public.workspace_membership_permission_role_assignments;
begin
  if not exists (
    select 1
    from public.workspace_permission_roles role
    where role.workspace_id = p_workspace_id
      and role.id = p_next_permission_role_id
      and role.is_assignable
  ) then
    raise exception 'workspace_permission_role_missing_or_unassignable'
      using errcode = '22023';
  end if;

  insert into public.workspace_membership_permission_role_assignments (
    workspace_id,
    membership_id,
    permission_role_id
  )
  values (
    p_workspace_id,
    p_membership_id,
    p_next_permission_role_id
  )
  on conflict (membership_id) do update
  set
    workspace_id = excluded.workspace_id,
    permission_role_id = excluded.permission_role_id,
    updated_at = now()
  returning * into updated_assignment;

  return updated_assignment;
end;
$$;

create or replace function private.update_workspace_membership_job_position(
  p_workspace_id text,
  p_membership_id uuid,
  p_next_job_position_id uuid
)
returns public.workspace_membership_job_position_assignments
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  updated_assignment public.workspace_membership_job_position_assignments;
begin
  if not exists (
    select 1
    from public.workspace_job_positions position
    where position.workspace_id = p_workspace_id
      and position.id = p_next_job_position_id
      and position.is_active
  ) then
    raise exception 'workspace_job_position_missing_or_inactive'
      using errcode = '22023';
  end if;

  insert into public.workspace_membership_job_position_assignments (
    workspace_id,
    membership_id,
    job_position_id
  )
  values (
    p_workspace_id,
    p_membership_id,
    p_next_job_position_id
  )
  on conflict (membership_id) do update
  set
    workspace_id = excluded.workspace_id,
    job_position_id = excluded.job_position_id,
    updated_at = now()
  returning * into updated_assignment;

  return updated_assignment;
end;
$$;

create or replace function public.clair_update_workspace_membership_permission_role(
  p_workspace_id text,
  p_membership_id uuid,
  p_next_permission_role_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  updated_assignment public.workspace_membership_permission_role_assignments;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'role_permission:manage required';
  end if;

  updated_assignment := private.update_workspace_membership_permission_role(
    p_workspace_id,
    p_membership_id,
    p_next_permission_role_id
  );

  return jsonb_build_object(
    'workspaceId', updated_assignment.workspace_id,
    'membershipId', updated_assignment.membership_id,
    'permissionRoleId', updated_assignment.permission_role_id,
    'assignedAt', updated_assignment.assigned_at
  );
end;
$$;

create or replace function public.clair_update_workspace_membership_job_position(
  p_workspace_id text,
  p_membership_id uuid,
  p_next_job_position_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  updated_assignment public.workspace_membership_job_position_assignments;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'role_permission:manage required';
  end if;

  updated_assignment := private.update_workspace_membership_job_position(
    p_workspace_id,
    p_membership_id,
    p_next_job_position_id
  );

  return jsonb_build_object(
    'workspaceId', updated_assignment.workspace_id,
    'membershipId', updated_assignment.membership_id,
    'jobPositionId', updated_assignment.job_position_id,
    'assignedAt', updated_assignment.assigned_at
  );
end;
$$;

alter table public.workspace_permission_roles enable row level security;
alter table public.workspace_job_positions enable row level security;
alter table public.workspace_membership_permission_role_assignments enable row level security;
alter table public.workspace_membership_job_position_assignments enable row level security;
alter table public.workspace_invitation_permission_role_assignments enable row level security;
alter table public.workspace_invitation_job_position_assignments enable row level security;

grant select, insert, update, delete on public.workspace_permission_roles to authenticated;
grant select, insert, update, delete on public.workspace_job_positions to authenticated;
grant select, insert, update, delete on public.workspace_membership_permission_role_assignments to authenticated;
grant select, insert, update, delete on public.workspace_membership_job_position_assignments to authenticated;
grant select, insert, update, delete on public.workspace_invitation_permission_role_assignments to authenticated;
grant select, insert, update, delete on public.workspace_invitation_job_position_assignments to authenticated;

drop policy if exists workspace_permission_roles_select_active_member on public.workspace_permission_roles;
create policy workspace_permission_roles_select_active_member
on public.workspace_permission_roles
for select
to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists workspace_permission_roles_insert_admin on public.workspace_permission_roles;
create policy workspace_permission_roles_insert_admin
on public.workspace_permission_roles
for insert
to authenticated
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_permission_roles_update_admin on public.workspace_permission_roles;
create policy workspace_permission_roles_update_admin
on public.workspace_permission_roles
for update
to authenticated
using (private.clair_is_workspace_admin(workspace_id))
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_permission_roles_delete_admin on public.workspace_permission_roles;
create policy workspace_permission_roles_delete_admin
on public.workspace_permission_roles
for delete
to authenticated
using (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_job_positions_select_active_member on public.workspace_job_positions;
create policy workspace_job_positions_select_active_member
on public.workspace_job_positions
for select
to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists workspace_job_positions_insert_admin on public.workspace_job_positions;
create policy workspace_job_positions_insert_admin
on public.workspace_job_positions
for insert
to authenticated
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_job_positions_update_admin on public.workspace_job_positions;
create policy workspace_job_positions_update_admin
on public.workspace_job_positions
for update
to authenticated
using (private.clair_is_workspace_admin(workspace_id))
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_job_positions_delete_admin on public.workspace_job_positions;
create policy workspace_job_positions_delete_admin
on public.workspace_job_positions
for delete
to authenticated
using (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_membership_permission_role_assignments_select_active_member
  on public.workspace_membership_permission_role_assignments;
create policy workspace_membership_permission_role_assignments_select_active_member
on public.workspace_membership_permission_role_assignments
for select
to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists workspace_membership_permission_role_assignments_insert_admin
  on public.workspace_membership_permission_role_assignments;
create policy workspace_membership_permission_role_assignments_insert_admin
on public.workspace_membership_permission_role_assignments
for insert
to authenticated
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_membership_permission_role_assignments_update_admin
  on public.workspace_membership_permission_role_assignments;
create policy workspace_membership_permission_role_assignments_update_admin
on public.workspace_membership_permission_role_assignments
for update
to authenticated
using (private.clair_is_workspace_admin(workspace_id))
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_membership_permission_role_assignments_delete_admin
  on public.workspace_membership_permission_role_assignments;
create policy workspace_membership_permission_role_assignments_delete_admin
on public.workspace_membership_permission_role_assignments
for delete
to authenticated
using (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_membership_job_position_assignments_select_active_member
  on public.workspace_membership_job_position_assignments;
create policy workspace_membership_job_position_assignments_select_active_member
on public.workspace_membership_job_position_assignments
for select
to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists workspace_membership_job_position_assignments_insert_admin
  on public.workspace_membership_job_position_assignments;
create policy workspace_membership_job_position_assignments_insert_admin
on public.workspace_membership_job_position_assignments
for insert
to authenticated
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_membership_job_position_assignments_update_admin
  on public.workspace_membership_job_position_assignments;
create policy workspace_membership_job_position_assignments_update_admin
on public.workspace_membership_job_position_assignments
for update
to authenticated
using (private.clair_is_workspace_admin(workspace_id))
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_membership_job_position_assignments_delete_admin
  on public.workspace_membership_job_position_assignments;
create policy workspace_membership_job_position_assignments_delete_admin
on public.workspace_membership_job_position_assignments
for delete
to authenticated
using (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_invitation_permission_role_assignments_select_admin
  on public.workspace_invitation_permission_role_assignments;
create policy workspace_invitation_permission_role_assignments_select_admin
on public.workspace_invitation_permission_role_assignments
for select
to authenticated
using (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_invitation_permission_role_assignments_insert_admin
  on public.workspace_invitation_permission_role_assignments;
create policy workspace_invitation_permission_role_assignments_insert_admin
on public.workspace_invitation_permission_role_assignments
for insert
to authenticated
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_invitation_permission_role_assignments_update_admin
  on public.workspace_invitation_permission_role_assignments;
create policy workspace_invitation_permission_role_assignments_update_admin
on public.workspace_invitation_permission_role_assignments
for update
to authenticated
using (private.clair_is_workspace_admin(workspace_id))
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_invitation_permission_role_assignments_delete_admin
  on public.workspace_invitation_permission_role_assignments;
create policy workspace_invitation_permission_role_assignments_delete_admin
on public.workspace_invitation_permission_role_assignments
for delete
to authenticated
using (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_invitation_job_position_assignments_select_admin
  on public.workspace_invitation_job_position_assignments;
create policy workspace_invitation_job_position_assignments_select_admin
on public.workspace_invitation_job_position_assignments
for select
to authenticated
using (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_invitation_job_position_assignments_insert_admin
  on public.workspace_invitation_job_position_assignments;
create policy workspace_invitation_job_position_assignments_insert_admin
on public.workspace_invitation_job_position_assignments
for insert
to authenticated
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_invitation_job_position_assignments_update_admin
  on public.workspace_invitation_job_position_assignments;
create policy workspace_invitation_job_position_assignments_update_admin
on public.workspace_invitation_job_position_assignments
for update
to authenticated
using (private.clair_is_workspace_admin(workspace_id))
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists workspace_invitation_job_position_assignments_delete_admin
  on public.workspace_invitation_job_position_assignments;
create policy workspace_invitation_job_position_assignments_delete_admin
on public.workspace_invitation_job_position_assignments
for delete
to authenticated
using (private.clair_is_workspace_admin(workspace_id));

revoke all on function private.clair_is_workspace_owner(text) from public, anon;
revoke all on function private.clair_is_workspace_admin(text) from public, anon;
revoke all on function private.clair_assert_not_last_active_workspace_owner() from public, anon, authenticated;
revoke all on function private.update_workspace_membership_permission_role(text, uuid, uuid) from public, anon, authenticated;
revoke all on function private.update_workspace_membership_job_position(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.clair_update_workspace_membership_permission_role(text, uuid, uuid) from public, anon;
revoke all on function public.clair_update_workspace_membership_job_position(text, uuid, uuid) from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.clair_is_workspace_owner(text) to authenticated;
grant execute on function private.clair_is_workspace_admin(text) to authenticated;
grant execute on function public.clair_update_workspace_membership_permission_role(text, uuid, uuid) to authenticated;
grant execute on function public.clair_update_workspace_membership_job_position(text, uuid, uuid) to authenticated;

revoke all on function private.clair_is_workspace_owner(text) from anon;
revoke all on function private.clair_is_workspace_admin(text) from anon;

comment on table public.workspace_permission_roles is
  'Workspace-scoped permission roles. User-facing labels are Korean; role_key is internal compatibility metadata.';
comment on table public.workspace_job_positions is
  'Workspace-scoped job positions / 직무. Job position is display and workflow metadata, not an authorization source.';
comment on table public.workspace_membership_permission_role_assignments is
  'MVP one-per-membership permission role assignment. Legacy user_memberships.roles remains for dual-read compatibility.';
comment on table public.workspace_membership_job_position_assignments is
  'MVP one-per-membership job position assignment.';
comment on function private.clair_is_workspace_owner(text) is
  'RLS helper: true when auth.uid() is an active owner by new permission-role assignment or legacy hospital_admin compatibility.';
comment on function private.clair_is_workspace_admin(text) is
  'RLS helper: true when auth.uid() is an active owner/admin by new permission-role assignment or legacy hospital_admin compatibility.';
comment on function private.clair_assert_not_last_active_workspace_owner() is
  'Trigger guard that blocks deleting, demoting, moving, or deactivating the last active workspace owner assignment.';
