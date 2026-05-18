-- DEN-36: DB-level last active hospital_admin protection foundation.
-- Local-first draft only. The helper lives in private schema and is not exposed via Data API.

create schema if not exists private;

create or replace function private.clair_assert_not_last_active_hospital_admin()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  touches_active_admin boolean := false;
  remaining_active_admin_count integer := 0;
begin
  if tg_op = 'DELETE' then
    touches_active_admin :=
      old.status = 'active'
      and old.roles @> array['hospital_admin']::text[];
  else
    touches_active_admin :=
      old.status = 'active'
      and old.roles @> array['hospital_admin']::text[]
      and (
        new.workspace_id is distinct from old.workspace_id
        or new.status is distinct from 'active'
        or not (new.roles @> array['hospital_admin']::text[])
      );
  end if;

  if touches_active_admin then
    select count(*)
      into remaining_active_admin_count
    from public.user_memberships
    where workspace_id = old.workspace_id
      and id <> old.id
      and status = 'active'
      and roles @> array['hospital_admin']::text[];

    if remaining_active_admin_count = 0 then
      raise exception 'last_active_hospital_admin_protected'
        using
          errcode = '23514',
          detail = 'At least one active hospital_admin membership must remain in each workspace.',
          hint = 'Use the private membership update helper after adding another active hospital_admin.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_last_active_hospital_admin on public.user_memberships;
create trigger protect_last_active_hospital_admin
before update or delete on public.user_memberships
for each row execute function private.clair_assert_not_last_active_hospital_admin();

create or replace function private.update_workspace_membership_roles(
  p_workspace_id text,
  p_membership_id uuid,
  p_next_roles text[],
  p_next_status text default null
)
returns public.user_memberships
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  updated_membership public.user_memberships;
begin
  if p_next_roles is null
    or not (p_next_roles <@ public.clair_workspace_role_values())
  then
    raise exception 'invalid_workspace_roles'
      using errcode = '22023';
  end if;

  if coalesce(p_next_status, 'active') not in ('pending', 'active', 'inactive') then
    raise exception 'invalid_membership_status'
      using errcode = '22023';
  end if;

  if coalesce(p_next_status, 'active') = 'active'
    and cardinality(p_next_roles) = 0
  then
    raise exception 'active_membership_requires_role'
      using errcode = '23514';
  end if;

  update public.user_memberships
  set
    roles = p_next_roles,
    status = coalesce(p_next_status, status),
    activated_at = case
      when coalesce(p_next_status, status) = 'active'
        and status is distinct from 'active'
      then now()
      else activated_at
    end,
    deactivated_at = case
      when coalesce(p_next_status, status) = 'inactive'
        and status is distinct from 'inactive'
      then now()
      else deactivated_at
    end,
    updated_at = now()
  where workspace_id = p_workspace_id
    and id = p_membership_id
  returning * into updated_membership;

  if not found then
    raise exception 'workspace_membership_missing'
      using errcode = '02000';
  end if;

  return updated_membership;
end;
$$;

revoke all on function private.clair_assert_not_last_active_hospital_admin() from public;
revoke all on function private.clair_assert_not_last_active_hospital_admin() from anon;
revoke all on function private.clair_assert_not_last_active_hospital_admin() from authenticated;

revoke all on function private.update_workspace_membership_roles(text, uuid, text[], text) from public;
revoke all on function private.update_workspace_membership_roles(text, uuid, text[], text) from anon;
revoke all on function private.update_workspace_membership_roles(text, uuid, text[], text) from authenticated;

comment on function private.clair_assert_not_last_active_hospital_admin() is
  'Trigger guard that blocks deleting, demoting, moving, or deactivating the last active hospital_admin membership in a workspace.';
comment on function private.update_workspace_membership_roles(text, uuid, text[], text) is
  'Private transaction helper skeleton for role/status updates. Server code should call this through a trusted DB path after permission checks.';
