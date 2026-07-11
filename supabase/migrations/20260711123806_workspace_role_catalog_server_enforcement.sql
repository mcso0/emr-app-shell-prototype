-- AUTH-PR-044: durable role/job catalog writes and explicit legacy owner reconciliation.
-- Local Supabase migration only. Do not apply to remote environments from this PR.

create or replace function public.clair_safe_custom_permission_values()
returns text[]
language sql
immutable
set search_path = public, private, pg_temp
as $$
  select array[
    'reception:view',
    'reception:create',
    'reception:update',
    'patient:view',
    'chart:view',
    'chart:update',
    'order:request',
    'order:update',
    'lab:complete',
    'billing:view',
    'billing:issue',
    'service_catalog:view'
  ]::text[];
$$;

alter table public.workspace_membership_permission_role_assignments
  add column if not exists owner_source text not null default 'explicit';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_membership_permission_role_assignments_owner_source_check'
  ) then
    alter table public.workspace_membership_permission_role_assignments
      add constraint workspace_membership_permission_role_assignments_owner_source_check
      check (owner_source in ('explicit', 'legacy_creator', 'legacy_fallback'));
  end if;
end;
$$;

-- Legacy `hospital_admin` did not distinguish a protected owner from an
-- operating administrator. Keep one owner continuously, but make the source
-- visible for a later clinic confirmation instead of granting owner powers to
-- every historical administrator.
with ranked_legacy_admins as (
  select
    membership.workspace_id,
    membership.id as membership_id,
    row_number() over (
      partition by membership.workspace_id
      order by
        case when workspace.created_by_user_id = membership.user_id then 0 else 1 end,
        coalesce(membership.activated_at, membership.created_at),
        membership.id
    ) as owner_rank,
    case
      when workspace.created_by_user_id = membership.user_id then 'legacy_creator'
      else 'legacy_fallback'
    end as next_owner_source
  from public.user_memberships membership
  join public.workspaces workspace on workspace.id = membership.workspace_id
  where membership.status = 'active'
    and membership.roles @> array['hospital_admin']::text[]
), resolved_role_ids as (
  select
    legacy.workspace_id,
    legacy.membership_id,
    legacy.owner_rank,
    legacy.next_owner_source,
    owner_role.id as owner_role_id,
    admin_role.id as admin_role_id
  from ranked_legacy_admins legacy
  join public.workspace_permission_roles owner_role
    on owner_role.workspace_id = legacy.workspace_id
    and owner_role.role_key = 'owner'
  join public.workspace_permission_roles admin_role
    on admin_role.workspace_id = legacy.workspace_id
    and admin_role.role_key = 'admin'
)
update public.workspace_membership_permission_role_assignments assignment
set
  permission_role_id = case
    when resolved.owner_rank = 1 then resolved.owner_role_id
    else resolved.admin_role_id
  end,
  owner_source = case
    when resolved.owner_rank = 1 then resolved.next_owner_source
    else 'explicit'
  end,
  updated_at = now()
from resolved_role_ids resolved
where assignment.workspace_id = resolved.workspace_id
  and assignment.membership_id = resolved.membership_id;

-- An inactive historical administrator must not regain owner authority merely
-- by becoming active later. Their owner/admin choice is now explicit.
update public.workspace_membership_permission_role_assignments assignment
set
  permission_role_id = admin_role.id,
  owner_source = 'explicit',
  updated_at = now()
from public.user_memberships membership
join public.workspace_permission_roles admin_role
  on admin_role.workspace_id = membership.workspace_id
  and admin_role.role_key = 'admin'
where assignment.workspace_id = membership.workspace_id
  and assignment.membership_id = membership.id
  and membership.status <> 'active'
  and membership.roles @> array['hospital_admin']::text[];

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
    join public.workspace_membership_permission_role_assignments assignment
      on assignment.workspace_id = membership.workspace_id
      and assignment.membership_id = membership.id
    join public.workspace_permission_roles role
      on role.workspace_id = assignment.workspace_id
      and role.id = assignment.permission_role_id
    where membership.workspace_id = p_workspace_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and app_user.status = 'active'
      and role.role_type = 'owner'
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
    join public.workspace_membership_permission_role_assignments assignment
      on assignment.workspace_id = membership.workspace_id
      and assignment.membership_id = membership.id
    join public.workspace_permission_roles role
      on role.workspace_id = assignment.workspace_id
      and role.id = assignment.permission_role_id
    where membership.workspace_id = p_workspace_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and app_user.status = 'active'
      and role.role_type in ('owner', 'admin')
  );
$$;

create or replace function private.clair_assert_workspace_permission_role_valid()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  permission_count integer;
  distinct_permission_count integer;
begin
  if auth.uid() is not null and tg_op = 'UPDATE' and old.is_system then
    raise exception 'workspace_permission_role_system_immutable'
      using errcode = '42501';
  end if;

  if auth.uid() is not null and tg_op = 'UPDATE' and not old.is_system and new.is_system then
    raise exception 'workspace_permission_role_system_immutable'
      using errcode = '42501';
  end if;

  if new.role_type = 'custom' then
    if new.is_system
      or jsonb_typeof(new.permissions) <> 'object'
      or jsonb_typeof(new.permissions -> 'allowed') <> 'array'
    then
      raise exception 'invalid_custom_role_permissions'
        using errcode = '22023';
    end if;

    select count(*), count(distinct permission_id)
      into permission_count, distinct_permission_count
    from jsonb_array_elements_text(new.permissions -> 'allowed') as permission_id;

    if permission_count = 0
      or permission_count <> distinct_permission_count
      or exists (
        select 1
        from jsonb_array_elements_text(new.permissions -> 'allowed') as permission_id
        where permission_id <> all(public.clair_safe_custom_permission_values())
           or permission_id = any(public.clair_owner_only_permission_values())
      )
    then
      raise exception 'invalid_custom_role_permissions'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.clair_assert_workspace_job_position_valid()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is not null and tg_op = 'UPDATE' and old.is_system then
    raise exception 'workspace_job_position_system_immutable'
      using errcode = '42501';
  end if;

  if auth.uid() is not null and tg_op = 'UPDATE' and not old.is_system and new.is_system then
    raise exception 'workspace_job_position_system_immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function private.clair_assert_workspace_catalog_delete_allowed()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is not null and old.is_system then
    raise exception '%', case
      when tg_table_name = 'workspace_permission_roles' then 'workspace_permission_role_system_immutable'
      else 'workspace_job_position_system_immutable'
    end using errcode = '42501';
  end if;

  return old;
end;
$$;

drop trigger if exists workspace_permission_role_validate on public.workspace_permission_roles;
create trigger workspace_permission_role_validate
before insert or update on public.workspace_permission_roles
for each row execute function private.clair_assert_workspace_permission_role_valid();

drop trigger if exists workspace_permission_role_delete_guard on public.workspace_permission_roles;
create trigger workspace_permission_role_delete_guard
before delete on public.workspace_permission_roles
for each row execute function private.clair_assert_workspace_catalog_delete_allowed();

drop trigger if exists workspace_job_position_validate on public.workspace_job_positions;
create trigger workspace_job_position_validate
before insert or update on public.workspace_job_positions
for each row execute function private.clair_assert_workspace_job_position_valid();

drop trigger if exists workspace_job_position_delete_guard on public.workspace_job_positions;
create trigger workspace_job_position_delete_guard
before delete on public.workspace_job_positions
for each row execute function private.clair_assert_workspace_catalog_delete_allowed();

create or replace function private.clair_seed_workspace_role_catalog()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  insert into public.workspace_permission_roles (
    workspace_id, role_key, label, description, role_type, permissions, is_system, is_assignable, sort_order
  )
  values
    (new.id, 'owner', '소유자', '워크스페이스 소유권과 위험 작업을 포함한 보호 권한', 'owner', '{"allowed":["*"]}'::jsonb, true, true, 10),
    (new.id, 'admin', '관리자', '대부분의 병원 운영 권한, 소유자 전용 위험 작업 제외', 'admin', '{"allowed":["reception:view","reception:create","reception:update","patient:view","patient:create","patient:update","encounter:view","encounter:create","encounter:update","chart:view","chart:update","order:view","order:request","order:update","dispensing:view","dispensing:complete","lab:view","lab:complete","imaging:view","imaging:complete","billing:view","billing:issue","service_catalog:view","service_catalog:manage","role_permission:view","role_permission:manage"]}'::jsonb, true, true, 20),
    (new.id, 'general', '일반', '일반 운영 권한', 'standard', '{"allowed":["reception:view","reception:create","reception:update","patient:view","patient:create","patient:update","encounter:view","encounter:create","encounter:update","chart:view","chart:update","order:view","order:request","order:update","dispensing:view","dispensing:complete","lab:view","lab:complete","imaging:view","imaging:complete","billing:view","billing:issue","service_catalog:view"]}'::jsonb, true, true, 30)
  on conflict (workspace_id, role_key) do nothing;

  insert into public.workspace_job_positions (
    workspace_id, position_key, label, is_system, is_active, sort_order
  )
  values
    (new.id, 'hospital_director', '병원장', true, true, 10),
    (new.id, 'veterinarian', '수의사', true, true, 20),
    (new.id, 'technician', '테크니션', true, true, 30),
    (new.id, 'front_desk', '데스크', true, true, 40)
  on conflict (workspace_id, position_key) do nothing;

  return new;
end;
$$;

drop trigger if exists seed_workspace_role_catalog on public.workspaces;
create trigger seed_workspace_role_catalog
after insert on public.workspaces
for each row execute function private.clair_seed_workspace_role_catalog();

create or replace function private.clair_assign_new_workspace_membership_catalog()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_role_key text;
  v_position_key text;
begin
  select case
    when workspace.created_by_user_id = new.user_id then 'owner'
    when new.roles @> array['hospital_admin']::text[] then 'admin'
    else 'general'
  end
  into v_role_key
  from public.workspaces workspace
  where workspace.id = new.workspace_id;

  v_position_key := case
    when new.roles @> array['hospital_admin']::text[] then 'hospital_director'
    when new.roles @> array['vet']::text[] then 'veterinarian'
    when new.roles @> array['technician']::text[] then 'technician'
    else 'front_desk'
  end;

  insert into public.workspace_membership_permission_role_assignments (
    workspace_id, membership_id, permission_role_id, assigned_by_user_id, owner_source
  )
  select new.workspace_id, new.id, role.id, new.invited_by_user_id,
    case when role.role_type = 'owner' then 'legacy_creator' else 'explicit' end
  from public.workspace_permission_roles role
  where role.workspace_id = new.workspace_id
    and role.role_key = v_role_key
  on conflict (membership_id) do nothing;

  insert into public.workspace_membership_job_position_assignments (
    workspace_id, membership_id, job_position_id, assigned_by_user_id
  )
  select new.workspace_id, new.id, position.id, new.invited_by_user_id
  from public.workspace_job_positions position
  where position.workspace_id = new.workspace_id
    and position.position_key = v_position_key
  on conflict (membership_id) do nothing;

  return new;
end;
$$;

drop trigger if exists assign_new_workspace_membership_catalog on public.user_memberships;
create trigger assign_new_workspace_membership_catalog
after insert on public.user_memberships
for each row execute function private.clair_assign_new_workspace_membership_catalog();

create or replace function private.clair_copy_accepted_invitation_catalog()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  membership_id uuid;
begin
  if new.status <> 'accepted' or old.status = 'accepted' or new.accepted_by_user_id is null then
    return new;
  end if;

  select id into membership_id
  from public.user_memberships
  where workspace_id = new.workspace_id
    and user_id = new.accepted_by_user_id
  order by created_at desc
  limit 1;

  if membership_id is null then
    return new;
  end if;

  insert into public.workspace_membership_permission_role_assignments (
    workspace_id, membership_id, permission_role_id, assigned_by_user_id, owner_source
  )
  select assignment.workspace_id, membership_id, assignment.permission_role_id, assignment.assigned_by_user_id, 'explicit'
  from public.workspace_invitation_permission_role_assignments assignment
  where assignment.workspace_id = new.workspace_id
    and assignment.invitation_id = new.id
  on conflict (membership_id) do update
  set permission_role_id = excluded.permission_role_id,
      assigned_by_user_id = excluded.assigned_by_user_id,
      owner_source = excluded.owner_source,
      updated_at = now();

  insert into public.workspace_membership_job_position_assignments (
    workspace_id, membership_id, job_position_id, assigned_by_user_id
  )
  select assignment.workspace_id, membership_id, assignment.job_position_id, assignment.assigned_by_user_id
  from public.workspace_invitation_job_position_assignments assignment
  where assignment.workspace_id = new.workspace_id
    and assignment.invitation_id = new.id
  on conflict (membership_id) do update
  set job_position_id = excluded.job_position_id,
      assigned_by_user_id = excluded.assigned_by_user_id,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists copy_accepted_invitation_catalog on public.workspace_invitations;
create trigger copy_accepted_invitation_catalog
after update of status on public.workspace_invitations
for each row execute function private.clair_copy_accepted_invitation_catalog();

create or replace function private.clair_assert_owner_assignment_allowed()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  old_is_owner boolean := false;
  next_is_owner boolean := false;
  allow_initial_creator_owner boolean := false;
  allow_accepted_owner_invitation boolean := false;
begin
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op <> 'INSERT' then
    select role.role_type = 'owner' into old_is_owner
    from public.workspace_permission_roles role
    where role.workspace_id = old.workspace_id
      and role.id = old.permission_role_id;
  end if;

  if tg_op <> 'DELETE' then
    select role.role_type = 'owner' into next_is_owner
    from public.workspace_permission_roles role
    where role.workspace_id = new.workspace_id
      and role.id = new.permission_role_id;
  end if;

  if tg_table_name = 'workspace_membership_permission_role_assignments'
    and tg_op = 'INSERT'
    and next_is_owner
  then
    select
      workspace.created_by_user_id = membership.user_id
      and not exists (
        select 1
        from public.workspace_membership_permission_role_assignments owner_assignment
        join public.workspace_permission_roles owner_role
          on owner_role.workspace_id = owner_assignment.workspace_id
          and owner_role.id = owner_assignment.permission_role_id
        join public.user_memberships owner_membership
          on owner_membership.workspace_id = owner_assignment.workspace_id
          and owner_membership.id = owner_assignment.membership_id
        where owner_assignment.workspace_id = new.workspace_id
          and owner_membership.status = 'active'
          and owner_role.role_type = 'owner'
      )
    into allow_initial_creator_owner
    from public.user_memberships membership
    join public.workspaces workspace on workspace.id = membership.workspace_id
    where membership.workspace_id = new.workspace_id
      and membership.id = new.membership_id;

    select exists (
      select 1
      from public.workspace_invitations invitation
      join public.workspace_invitation_permission_role_assignments invitation_assignment
        on invitation_assignment.workspace_id = invitation.workspace_id
        and invitation_assignment.invitation_id = invitation.id
        and invitation_assignment.permission_role_id = new.permission_role_id
      join public.user_memberships accepted_membership
        on accepted_membership.workspace_id = invitation.workspace_id
        and accepted_membership.user_id = invitation.accepted_by_user_id
        and accepted_membership.id = new.membership_id
      join public.user_memberships inviter_membership
        on inviter_membership.workspace_id = invitation.workspace_id
        and inviter_membership.user_id = invitation_assignment.assigned_by_user_id
        and inviter_membership.status = 'active'
      join public.workspace_membership_permission_role_assignments inviter_assignment
        on inviter_assignment.workspace_id = inviter_membership.workspace_id
        and inviter_assignment.membership_id = inviter_membership.id
      join public.workspace_permission_roles inviter_role
        on inviter_role.workspace_id = inviter_assignment.workspace_id
        and inviter_role.id = inviter_assignment.permission_role_id
      where invitation.workspace_id = new.workspace_id
        and invitation.status = 'accepted'
        and invitation.accepted_by_user_id = auth.uid()
        and inviter_role.role_type = 'owner'
    ) into allow_accepted_owner_invitation;
  end if;

  if (old_is_owner or next_is_owner)
    and not private.clair_is_workspace_owner(coalesce(new.workspace_id, old.workspace_id))
    and not allow_initial_creator_owner
    and not allow_accepted_owner_invitation
  then
    raise exception 'workspace_owner_required'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

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
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

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
    permission_role_id,
    assigned_by_user_id,
    owner_source
  )
  values (
    p_workspace_id,
    p_membership_id,
    p_next_permission_role_id,
    auth.uid(),
    'explicit'
  )
  on conflict (membership_id) do update
  set
    workspace_id = excluded.workspace_id,
    permission_role_id = excluded.permission_role_id,
    assigned_by_user_id = excluded.assigned_by_user_id,
    owner_source = excluded.owner_source,
    updated_at = now()
  returning * into updated_assignment;

  return updated_assignment;
end;
$$;

drop trigger if exists workspace_membership_owner_assignment_guard on public.workspace_membership_permission_role_assignments;
create trigger workspace_membership_owner_assignment_guard
before insert or update or delete on public.workspace_membership_permission_role_assignments
for each row execute function private.clair_assert_owner_assignment_allowed();

drop trigger if exists workspace_invitation_owner_assignment_guard on public.workspace_invitation_permission_role_assignments;
create trigger workspace_invitation_owner_assignment_guard
before insert or update or delete on public.workspace_invitation_permission_role_assignments
for each row execute function private.clair_assert_owner_assignment_allowed();

create or replace function public.clair_read_workspace_role_catalog(p_workspace_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  return jsonb_build_object(
    'permissionRoles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'roleKey', role.role_key,
        'label', role.label,
        'description', role.description,
        'roleType', role.role_type,
        'permissionIds', role.permissions -> 'allowed',
        'isSystem', role.is_system,
        'isAssignable', role.is_assignable,
        'sortOrder', role.sort_order,
        'assignedMemberCount', (
          select count(*)
          from public.workspace_membership_permission_role_assignments assignment
          join public.user_memberships membership
            on membership.workspace_id = assignment.workspace_id
            and membership.id = assignment.membership_id
          where assignment.workspace_id = role.workspace_id
            and assignment.permission_role_id = role.id
            and membership.status = 'active'
        )
      ) order by role.sort_order, role.label)
      from public.workspace_permission_roles role
      where role.workspace_id = p_workspace_id
    ), '[]'::jsonb),
    'jobPositions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'positionKey', position.position_key,
        'label', position.label,
        'description', position.description,
        'isSystem', position.is_system,
        'isActive', position.is_active,
        'sortOrder', position.sort_order
      ) order by position.sort_order, position.label)
      from public.workspace_job_positions position
      where position.workspace_id = p_workspace_id
    ), '[]'::jsonb),
    'access', jsonb_build_object(
      'canManage', private.clair_is_workspace_admin(p_workspace_id)
    ),
    'ownerReconciliation', jsonb_build_object(
      'needsConfirmation', exists (
        select 1
        from public.workspace_membership_permission_role_assignments assignment
        join public.user_memberships membership
          on membership.workspace_id = assignment.workspace_id
          and membership.id = assignment.membership_id
        where assignment.workspace_id = p_workspace_id
          and membership.status = 'active'
          and assignment.owner_source = 'legacy_fallback'
      ),
      'membershipIds', coalesce((
        select jsonb_agg(assignment.membership_id::text)
        from public.workspace_membership_permission_role_assignments assignment
        join public.user_memberships membership
          on membership.workspace_id = assignment.workspace_id
          and membership.id = assignment.membership_id
        where assignment.workspace_id = p_workspace_id
          and membership.status = 'active'
          and assignment.owner_source = 'legacy_fallback'
      ), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.clair_mutate_workspace_role_catalog(
  p_workspace_id text,
  p_action text,
  p_role_key text default null,
  p_position_key text default null,
  p_label text default null,
  p_description text default null,
  p_permission_ids text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_role_key text := nullif(trim(coalesce(p_role_key, '')), '');
  v_position_key text := nullif(trim(coalesce(p_position_key, '')), '');
  v_label text := nullif(trim(coalesce(p_label, '')), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_permission_ids text[] := array(select distinct unnest(coalesce(p_permission_ids, array[]::text[])) order by 1);
  v_role_id uuid;
  v_reference_count integer;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'role_permission:manage required';
  end if;

  if p_action not in ('role.create', 'role.update', 'role.delete', 'job.create', 'job.update', 'job.archive') then
    raise exception 'invalid_role_catalog_action' using errcode = '22023';
  end if;

  if p_action in ('role.create', 'role.update') and (
    v_label is null or cardinality(v_permission_ids) = 0
    or not (v_permission_ids <@ public.clair_safe_custom_permission_values())
    or v_permission_ids && public.clair_owner_only_permission_values()
  ) then
    raise exception 'invalid_custom_role_permissions' using errcode = '22023';
  end if;

  if p_action = 'role.create' then
    if v_role_key is null then
      v_role_key := 'custom_' || substr(md5(clock_timestamp()::text || random()::text), 1, 16);
    end if;
    if v_role_key !~ '^[a-z0-9][a-z0-9_:-]{1,62}$' then
      raise exception 'invalid_role_catalog_key' using errcode = '22023';
    end if;

    insert into public.workspace_permission_roles (
      workspace_id, role_key, label, description, role_type, permissions, is_system, is_assignable, created_by_user_id
    )
    values (
      p_workspace_id, v_role_key, v_label, v_description, 'custom',
      jsonb_build_object('allowed', to_jsonb(v_permission_ids)), false, true, auth.uid()
    );
  elsif p_action = 'role.update' then
    update public.workspace_permission_roles
    set label = v_label,
        description = v_description,
        permissions = jsonb_build_object('allowed', to_jsonb(v_permission_ids)),
        updated_at = now()
    where workspace_id = p_workspace_id
      and role_key = v_role_key
      and role_type = 'custom'
      and not is_system;
    if not found then raise exception 'workspace_custom_role_missing' using errcode = '40400'; end if;
  elsif p_action = 'role.delete' then
    select id into v_role_id
    from public.workspace_permission_roles
    where workspace_id = p_workspace_id
      and role_key = v_role_key
      and role_type = 'custom'
      and not is_system;
    if v_role_id is null then raise exception 'workspace_custom_role_missing' using errcode = '40400'; end if;
    select count(*) into v_reference_count
    from public.workspace_membership_permission_role_assignments
    where workspace_id = p_workspace_id and permission_role_id = v_role_id;
    select v_reference_count + count(*) into v_reference_count
    from public.workspace_invitation_permission_role_assignments
    where workspace_id = p_workspace_id and permission_role_id = v_role_id;
    if v_reference_count > 0 then raise exception 'role_catalog_referenced' using errcode = '23503'; end if;
    delete from public.workspace_permission_roles where id = v_role_id;
  elsif p_action = 'job.create' then
    if v_label is null then raise exception 'invalid_job_position_label' using errcode = '22023'; end if;
    if v_position_key is null then
      v_position_key := 'custom_' || substr(md5(clock_timestamp()::text || random()::text), 1, 16);
    end if;
    if v_position_key !~ '^[a-z0-9][a-z0-9_:-]{1,62}$' then
      raise exception 'invalid_role_catalog_key' using errcode = '22023';
    end if;
    insert into public.workspace_job_positions (
      workspace_id, position_key, label, description, is_system, is_active, created_by_user_id
    ) values (p_workspace_id, v_position_key, v_label, v_description, false, true, auth.uid());
  elsif p_action = 'job.update' then
    if v_label is null then raise exception 'invalid_job_position_label' using errcode = '22023'; end if;
    update public.workspace_job_positions
    set label = v_label, description = v_description, updated_at = now()
    where workspace_id = p_workspace_id
      and position_key = v_position_key
      and not is_system;
    if not found then raise exception 'workspace_custom_job_position_missing' using errcode = '40400'; end if;
  elsif p_action = 'job.archive' then
    update public.workspace_job_positions
    set is_active = false, updated_at = now()
    where workspace_id = p_workspace_id
      and position_key = v_position_key
      and not is_system;
    if not found then raise exception 'workspace_custom_job_position_missing' using errcode = '40400'; end if;
  end if;

  return public.clair_read_workspace_role_catalog(p_workspace_id);
end;
$$;

revoke insert, update, delete on public.workspace_permission_roles from authenticated;
revoke insert, update, delete on public.workspace_job_positions from authenticated;
revoke insert, update, delete on public.workspace_membership_permission_role_assignments from authenticated;
revoke insert, update, delete on public.workspace_membership_job_position_assignments from authenticated;
revoke insert, update, delete on public.workspace_invitation_permission_role_assignments from authenticated;
revoke insert, update, delete on public.workspace_invitation_job_position_assignments from authenticated;

revoke all on function public.clair_safe_custom_permission_values() from public, anon;
revoke all on function private.clair_assert_workspace_permission_role_valid() from public, anon, authenticated;
revoke all on function private.clair_assert_workspace_job_position_valid() from public, anon, authenticated;
revoke all on function private.clair_assert_workspace_catalog_delete_allowed() from public, anon, authenticated;
revoke all on function private.clair_seed_workspace_role_catalog() from public, anon, authenticated;
revoke all on function private.clair_assign_new_workspace_membership_catalog() from public, anon, authenticated;
revoke all on function private.clair_copy_accepted_invitation_catalog() from public, anon, authenticated;
revoke all on function private.clair_assert_owner_assignment_allowed() from public, anon, authenticated;
revoke all on function public.clair_read_workspace_role_catalog(text) from public, anon;
revoke all on function public.clair_mutate_workspace_role_catalog(text, text, text, text, text, text, text[]) from public, anon;

grant execute on function public.clair_read_workspace_role_catalog(text) to authenticated;
grant execute on function public.clair_mutate_workspace_role_catalog(text, text, text, text, text, text, text[]) to authenticated;
