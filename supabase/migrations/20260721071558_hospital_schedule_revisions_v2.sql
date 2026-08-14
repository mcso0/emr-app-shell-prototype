-- HOSPITAL-ADMIN-LIVE-PR-013 through PR-016
-- Additive v2 schedule revisions. The v1 week/shift tables remain readable and
-- writable until the private rollout mode is switched to v2 for a workspace.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hospital_schedule_weeks_workspace_id_id_key'
  ) then
    alter table public.hospital_schedule_weeks
      add constraint hospital_schedule_weeks_workspace_id_id_key unique (workspace_id, id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'hospital_schedule_staff_profiles_workspace_id_id_key'
  ) then
    alter table public.hospital_schedule_staff_profiles
      add constraint hospital_schedule_staff_profiles_workspace_id_id_key unique (workspace_id, id);
  end if;
end;
$$;

create table if not exists public.hospital_schedule_revisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  schedule_week_id uuid not null,
  revision_no integer not null check (revision_no > 0),
  state text not null default 'draft' check (state in ('draft', 'published', 'superseded')),
  based_on_revision_id uuid,
  lock_version integer not null default 1 check (lock_version > 0),
  created_by_user_id uuid references public.users(id) on delete set null,
  published_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, schedule_week_id, id),
  unique (schedule_week_id, revision_no),
  foreign key (workspace_id, schedule_week_id)
    references public.hospital_schedule_weeks(workspace_id, id) on delete cascade
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hospital_schedule_revisions_based_on_revision_fkey'
  ) then
    alter table public.hospital_schedule_revisions
      add constraint hospital_schedule_revisions_based_on_revision_fkey
      foreign key (workspace_id, schedule_week_id, based_on_revision_id)
      references public.hospital_schedule_revisions(workspace_id, schedule_week_id, id)
      deferrable initially deferred;
  end if;
end;
$$;

create unique index if not exists hospital_schedule_revisions_one_draft_per_week_idx
  on public.hospital_schedule_revisions (schedule_week_id)
  where state = 'draft';
create index if not exists hospital_schedule_revisions_week_state_idx
  on public.hospital_schedule_revisions (schedule_week_id, state, revision_no desc);

alter table public.hospital_schedule_weeks
  add column if not exists latest_published_revision_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hospital_schedule_weeks_latest_published_revision_fkey'
  ) then
    alter table public.hospital_schedule_weeks
      add constraint hospital_schedule_weeks_latest_published_revision_fkey
      foreign key (workspace_id, id, latest_published_revision_id)
      references public.hospital_schedule_revisions(workspace_id, schedule_week_id, id)
      deferrable initially deferred;
  end if;
end;
$$;

create table if not exists public.hospital_schedule_revision_validations (
  schedule_revision_id uuid primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  roster_source_version text not null,
  operating_calendar_version text not null,
  issues jsonb not null default '[]'::jsonb check (jsonb_typeof(issues) = 'array'),
  validated_by_user_id uuid references public.users(id) on delete set null,
  validated_at timestamptz not null default now(),
  foreign key (workspace_id, schedule_revision_id)
    references public.hospital_schedule_revisions(workspace_id, id) on delete cascade
);
create index if not exists hospital_schedule_revision_validations_workspace_idx
  on public.hospital_schedule_revision_validations (workspace_id, validated_at desc);

create table if not exists public.hospital_schedule_work_blocks (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  schedule_revision_id uuid not null,
  staff_profile_id uuid,
  shift_date date not null,
  start_minutes integer not null check (start_minutes between 0 and 1439),
  end_minutes integer not null check (end_minutes between 1 and 1440 and end_minutes > start_minutes),
  work_kind text not null check (work_kind in ('clinical', 'support', 'reception')),
  work_label_snapshot text not null check (length(btrim(work_label_snapshot)) between 1 and 80),
  location_label_snapshot text,
  private_note text,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, schedule_revision_id)
    references public.hospital_schedule_revisions(workspace_id, id) on delete cascade,
  foreign key (workspace_id, staff_profile_id)
    references public.hospital_schedule_staff_profiles(workspace_id, id) on delete restrict
);
create index if not exists hospital_schedule_work_blocks_revision_grid_idx
  on public.hospital_schedule_work_blocks (schedule_revision_id, shift_date, staff_profile_id, start_minutes);
create index if not exists hospital_schedule_work_blocks_staff_date_idx
  on public.hospital_schedule_work_blocks (staff_profile_id, shift_date, schedule_revision_id)
  where staff_profile_id is not null;

create table if not exists public.hospital_schedule_non_work_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  schedule_revision_id uuid not null,
  staff_profile_id uuid not null,
  entry_date date not null,
  entry_kind text not null check (entry_kind in ('leave', 'off')),
  leave_subtype text check (leave_subtype is null or leave_subtype in ('annual', 'same_day')),
  start_minutes integer,
  end_minutes integer,
  private_note text,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (entry_kind = 'off' and leave_subtype is null and start_minutes is null and end_minutes is null)
    or (
      entry_kind = 'leave'
      and ((start_minutes is null and end_minutes is null)
        or (start_minutes between 0 and 1439 and end_minutes between 1 and 1440 and end_minutes > start_minutes))
    )
  ),
  foreign key (workspace_id, schedule_revision_id)
    references public.hospital_schedule_revisions(workspace_id, id) on delete cascade,
  foreign key (workspace_id, staff_profile_id)
    references public.hospital_schedule_staff_profiles(workspace_id, id) on delete restrict
);
create index if not exists hospital_schedule_non_work_entries_revision_date_idx
  on public.hospital_schedule_non_work_entries (schedule_revision_id, entry_date, staff_profile_id);
create index if not exists hospital_schedule_non_work_entries_staff_date_idx
  on public.hospital_schedule_non_work_entries (staff_profile_id, entry_date, schedule_revision_id);

create table if not exists public.hospital_schedule_workspace_policies (
  workspace_id text primary key references public.workspaces(id) on delete cascade,
  completeness_mode text not null default 'warning_only'
    check (completeness_mode in ('warning_only', 'required_job_positions')),
  updated_by_user_id uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.hospital_schedule_required_job_positions (
  workspace_id text not null,
  job_position_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, job_position_id),
  foreign key (workspace_id, job_position_id)
    references public.workspace_job_positions(workspace_id, id) on delete cascade
);
create index if not exists hospital_schedule_required_job_positions_position_idx
  on public.hospital_schedule_required_job_positions (job_position_id, workspace_id);

create table if not exists public.hospital_schedule_idempotency_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid not null references public.users(id) on delete cascade,
  operation text not null check (operation in (
    'create_draft', 'save_work_block', 'save_non_work_entry', 'delete_entry',
    'publish_revision', 'discard_draft', 'validate_revision'
  )),
  idempotency_key text not null check (length(btrim(idempotency_key)) between 8 and 160),
  payload_hash text not null check (length(payload_hash) = 32),
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default now() + interval '24 hours',
  unique (workspace_id, actor_user_id, operation, idempotency_key)
);
create index if not exists hospital_schedule_idempotency_expiry_idx
  on public.hospital_schedule_idempotency_requests (expires_at)
  where status <> 'completed';

create table if not exists private.hospital_schedule_rollout_modes (
  workspace_id text primary key references public.workspaces(id) on delete cascade,
  mode text not null default 'v1' check (mode in ('v1', 'compare', 'v2')),
  updated_at timestamptz not null default now()
);
revoke all on table private.hospital_schedule_rollout_modes from public, anon, authenticated;

alter table public.hospital_schedule_revisions enable row level security;
alter table public.hospital_schedule_revision_validations enable row level security;
alter table public.hospital_schedule_work_blocks enable row level security;
alter table public.hospital_schedule_non_work_entries enable row level security;
alter table public.hospital_schedule_workspace_policies enable row level security;
alter table public.hospital_schedule_required_job_positions enable row level security;
alter table public.hospital_schedule_idempotency_requests enable row level security;

revoke all on table public.hospital_schedule_revisions,
  public.hospital_schedule_revision_validations,
  public.hospital_schedule_work_blocks,
  public.hospital_schedule_non_work_entries,
  public.hospital_schedule_workspace_policies,
  public.hospital_schedule_required_job_positions,
  public.hospital_schedule_idempotency_requests
from public, anon, authenticated;

create or replace function private.clair_schedule_v2_rollout_mode(p_workspace_id text)
returns text
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select coalesce((
    select mode from private.hospital_schedule_rollout_modes where workspace_id = p_workspace_id
  ), 'v1');
$$;

create or replace function private.clair_schedule_v2_can_manage(p_workspace_id text)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.user_memberships membership
    join public.users app_user
      on app_user.id = membership.user_id
     and app_user.status = 'active'
    join public.workspace_membership_permission_role_assignments assignment
      on assignment.workspace_id = membership.workspace_id
     and assignment.membership_id = membership.id
    join public.workspace_permission_roles role
      on role.workspace_id = assignment.workspace_id
     and role.id = assignment.permission_role_id
     and role.status = 'active'
    where membership.workspace_id = p_workspace_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and (
        role.role_type = 'owner'
        or coalesce(role.permissions->'allowed', '[]'::jsonb) ? 'role_permission:manage'
        or coalesce(role.permissions->'allowed', '[]'::jsonb) ? '*'
      )
  );
$$;

create or replace function private.clair_schedule_v2_can_read_profile(
  p_workspace_id text,
  p_target_user_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select auth.uid() = p_target_user_id
    or exists (
      select 1
      from public.user_memberships membership
      join public.users app_user
        on app_user.id = membership.user_id
       and app_user.status = 'active'
      join public.workspace_membership_permission_role_assignments assignment
        on assignment.workspace_id = membership.workspace_id
       and assignment.membership_id = membership.id
      join public.workspace_permission_roles role
        on role.workspace_id = assignment.workspace_id
       and role.id = assignment.permission_role_id
       and role.status = 'active'
      where membership.workspace_id = p_workspace_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
        and (
          role.role_type = 'owner'
          or coalesce(role.permissions->'allowed', '[]'::jsonb) ? 'role_permission:manage'
          or coalesce(role.permissions->'allowed', '[]'::jsonb) ? 'reception:view'
          or coalesce(role.permissions->'allowed', '[]'::jsonb) ? '*'
        )
    );
$$;

create or replace function private.clair_schedule_v2_week_start(p_workspace_id text)
returns date
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select date_trunc(
    'week',
    timezone(coalesce(workspace.timezone, 'Asia/Seoul'), now())
  )::date
  from public.workspaces workspace
  where workspace.id = p_workspace_id;
$$;

create or replace function private.clair_schedule_v2_roster_hash(p_workspace_id text)
returns text
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select md5(coalesce((
    select jsonb_agg(jsonb_build_object(
      'membershipId', membership.id,
      'status', membership.status,
      'roles', membership.roles,
      'jobPositionId', assignment.job_position_id,
      'profileId', profile.id,
      'profileUpdatedAt', profile.updated_at,
      'membershipUpdatedAt', membership.updated_at
    ) order by membership.id)::text
    from public.user_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    left join public.hospital_schedule_staff_profiles profile
      on profile.workspace_id = membership.workspace_id and profile.membership_id = membership.id
    left join public.workspace_membership_job_position_assignments assignment
      on assignment.workspace_id = membership.workspace_id and assignment.membership_id = membership.id
    where membership.workspace_id = p_workspace_id and app_user.status = 'active'
  ), '[]'));
$$;

create or replace function private.clair_schedule_v2_operating_calendar_hash(p_workspace_id text)
returns text
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select md5(jsonb_build_object(
    'workspace', (
      select jsonb_build_object('timezone', timezone, 'holidayPolicy', holiday_policy, 'updatedAt', updated_at)
      from public.workspaces where id = p_workspace_id
    ),
    'weekly', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.day_of_week)
      from public.workspace_operating_hours item where item.workspace_id = p_workspace_id
    ), '[]'::jsonb),
    'exceptions', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.operating_date)
      from public.workspace_operating_hour_exceptions item where item.workspace_id = p_workspace_id
    ), '[]'::jsonb)
  )::text);
$$;

create or replace function private.clair_schedule_v2_assert_entry_date()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_week_start date;
  v_entry_date date := coalesce(
    nullif(to_jsonb(new)->>'shift_date', '')::date,
    nullif(to_jsonb(new)->>'entry_date', '')::date
  );
begin
  select schedule_week.week_start into v_week_start
  from public.hospital_schedule_revisions revision
  join public.hospital_schedule_weeks schedule_week on schedule_week.id = revision.schedule_week_id
  where revision.id = new.schedule_revision_id and revision.workspace_id = new.workspace_id;
  if v_week_start is null or v_entry_date < v_week_start or v_entry_date >= v_week_start + 7 then
    raise exception using errcode = '22023', message = 'schedule_date_outside_week';
  end if;
  return new;
end;
$$;

drop trigger if exists hospital_schedule_v2_work_block_week_guard on public.hospital_schedule_work_blocks;
create trigger hospital_schedule_v2_work_block_week_guard
before insert or update on public.hospital_schedule_work_blocks
for each row execute function private.clair_schedule_v2_assert_entry_date();

drop trigger if exists hospital_schedule_v2_non_work_week_guard on public.hospital_schedule_non_work_entries;
create trigger hospital_schedule_v2_non_work_week_guard
before insert or update on public.hospital_schedule_non_work_entries
for each row execute function private.clair_schedule_v2_assert_entry_date();

create or replace function private.clair_schedule_v2_immutable_revision()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if old.state <> 'draft' and current_setting('app.schedule_v2_publish', true) <> 'on' then
    raise exception using errcode = '55000', message = 'published_schedule_revision_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists hospital_schedule_v2_revision_immutable on public.hospital_schedule_revisions;
create trigger hospital_schedule_v2_revision_immutable
before update on public.hospital_schedule_revisions
for each row execute function private.clair_schedule_v2_immutable_revision();

create or replace function private.clair_schedule_v2_immutable_entry()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_revision_id uuid := coalesce(new.schedule_revision_id, old.schedule_revision_id);
  v_state text;
begin
  select state into v_state from public.hospital_schedule_revisions where id = v_revision_id;
  if v_state <> 'draft' then
    raise exception using errcode = '55000', message = 'published_schedule_revision_children_immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists hospital_schedule_v2_work_block_immutable on public.hospital_schedule_work_blocks;
create trigger hospital_schedule_v2_work_block_immutable
before update or delete on public.hospital_schedule_work_blocks
for each row execute function private.clair_schedule_v2_immutable_entry();

drop trigger if exists hospital_schedule_v2_non_work_immutable on public.hospital_schedule_non_work_entries;
create trigger hospital_schedule_v2_non_work_immutable
before update or delete on public.hospital_schedule_non_work_entries
for each row execute function private.clair_schedule_v2_immutable_entry();

create or replace function private.clair_schedule_v2_assert_latest_published()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.latest_published_revision_id is not null and not exists (
    select 1
    from public.hospital_schedule_revisions revision
    where revision.id = new.latest_published_revision_id
      and revision.workspace_id = new.workspace_id
      and revision.schedule_week_id = new.id
      and revision.state = 'published'
  ) then
    raise exception using errcode = '23514', message = 'latest_published_revision_invalid';
  end if;
  return new;
end;
$$;

drop trigger if exists hospital_schedule_v2_latest_published_guard on public.hospital_schedule_weeks;
create trigger hospital_schedule_v2_latest_published_guard
before insert or update of latest_published_revision_id on public.hospital_schedule_weeks
for each row execute function private.clair_schedule_v2_assert_latest_published();

create or replace function private.clair_schedule_v2_validate(
  p_workspace_id text,
  p_revision_id uuid,
  p_accept_source_changes boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_week_start date;
  v_roster_hash text;
  v_calendar_hash text;
  v_prior_validation public.hospital_schedule_revision_validations%rowtype;
  v_issues jsonb := '[]'::jsonb;
begin
  select schedule_week.week_start into v_week_start
  from public.hospital_schedule_revisions revision
  join public.hospital_schedule_weeks schedule_week on schedule_week.id = revision.schedule_week_id
  where revision.id = p_revision_id and revision.workspace_id = p_workspace_id;
  if v_week_start is null then
    raise exception using errcode = 'P0002', message = 'schedule_revision_not_found';
  end if;

  select * into v_prior_validation
  from public.hospital_schedule_revision_validations
  where schedule_revision_id = p_revision_id;
  v_roster_hash := private.clair_schedule_v2_roster_hash(p_workspace_id);
  v_calendar_hash := private.clair_schedule_v2_operating_calendar_hash(p_workspace_id);

  if not p_accept_source_changes
    and v_prior_validation.schedule_revision_id is not null
    and v_prior_validation.roster_source_version <> v_roster_hash then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'roster_revalidation_required', 'severity', 'blocker',
      'message', '직원 구성 변경 후 재검토가 필요해.', 'entryId', null, 'staffProfileId', null, 'date', null
    ));
  end if;
  if not p_accept_source_changes
    and v_prior_validation.schedule_revision_id is not null
    and v_prior_validation.operating_calendar_version <> v_calendar_hash then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'operating_calendar_revalidation_required', 'severity', 'blocker',
      'message', '운영 시간 변경 후 재검토가 필요해.', 'entryId', null, 'staffProfileId', null, 'date', null
    ));
  end if;

  v_issues := v_issues || coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', 'inactive_staff_profile', 'severity', 'blocker',
      'message', '활성 상태가 아닌 직원에게 근무를 배정할 수 없어.',
      'entryId', block.id, 'staffProfileId', block.staff_profile_id, 'date', block.shift_date
    ))
    from public.hospital_schedule_work_blocks block
    left join public.hospital_schedule_staff_profiles profile
      on profile.id = block.staff_profile_id and profile.workspace_id = block.workspace_id
    left join public.user_memberships membership on membership.id = profile.membership_id
    where block.schedule_revision_id = p_revision_id
      and block.staff_profile_id is not null
      and (profile.id is null or membership.status <> 'active')
  ), '[]'::jsonb);

  v_issues := v_issues || coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', 'overlapping_assignment', 'severity', 'blocker',
      'message', '같은 직원의 근무 시간이 겹쳐.',
      'entryId', later_block.id, 'staffProfileId', later_block.staff_profile_id, 'date', later_block.shift_date
    ))
    from public.hospital_schedule_work_blocks earlier_block
    join public.hospital_schedule_work_blocks later_block
      on later_block.schedule_revision_id = earlier_block.schedule_revision_id
      and later_block.staff_profile_id = earlier_block.staff_profile_id
      and later_block.shift_date = earlier_block.shift_date
      and later_block.id > earlier_block.id
      and later_block.start_minutes < earlier_block.end_minutes
      and earlier_block.start_minutes < later_block.end_minutes
    where earlier_block.schedule_revision_id = p_revision_id
      and earlier_block.staff_profile_id is not null
  ), '[]'::jsonb);

  v_issues := v_issues || coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', 'work_overlaps_non_work', 'severity', 'blocker',
      'message', '근무와 휴무·휴가가 겹쳐.',
      'entryId', block.id, 'staffProfileId', block.staff_profile_id, 'date', block.shift_date
    ))
    from public.hospital_schedule_work_blocks block
    join public.hospital_schedule_non_work_entries entry
      on entry.schedule_revision_id = block.schedule_revision_id
      and entry.staff_profile_id = block.staff_profile_id
      and entry.entry_date = block.shift_date
      and (
        entry.entry_kind = 'off'
        or entry.start_minutes is null
        or (block.start_minutes < entry.end_minutes and entry.start_minutes < block.end_minutes)
      )
    where block.schedule_revision_id = p_revision_id
      and block.staff_profile_id is not null
  ), '[]'::jsonb);

  v_issues := v_issues || coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', 'missing_required_assignment', 'severity', 'blocker',
      'message', '근무표 대상 직원의 근무·휴무·휴가가 미등록 상태야.',
      'entryId', null, 'staffProfileId', profile.id, 'date', days.day::date
    ))
    from public.hospital_schedule_workspace_policies policy
    join public.hospital_schedule_required_job_positions required_position
      on required_position.workspace_id = policy.workspace_id
    join public.workspace_membership_job_position_assignments assignment
      on assignment.workspace_id = required_position.workspace_id
      and assignment.job_position_id = required_position.job_position_id
    join public.user_memberships membership
      on membership.id = assignment.membership_id and membership.status = 'active'
    join public.hospital_schedule_staff_profiles profile
      on profile.workspace_id = membership.workspace_id and profile.membership_id = membership.id
    cross join lateral generate_series(v_week_start, v_week_start + 6, interval '1 day') days(day)
    where policy.workspace_id = p_workspace_id
      and policy.completeness_mode = 'required_job_positions'
      and not exists (
        select 1 from public.hospital_schedule_work_blocks block
        where block.schedule_revision_id = p_revision_id
          and block.staff_profile_id = profile.id and block.shift_date = days.day::date
      )
      and not exists (
        select 1 from public.hospital_schedule_non_work_entries entry
        where entry.schedule_revision_id = p_revision_id
          and entry.staff_profile_id = profile.id and entry.entry_date = days.day::date
      )
  ), '[]'::jsonb);

  v_issues := v_issues || coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', case when not (effective.value->>'isOpen')::boolean then 'hospital_closed' else 'outside_operating_hours' end,
      'severity', 'blocker',
      'message', case when not (effective.value->>'isOpen')::boolean then '병원 휴무일에는 근무를 편성할 수 없어.' else '운영 시간 밖의 근무야.' end,
      'entryId', block.id, 'staffProfileId', block.staff_profile_id, 'date', block.shift_date
    ))
    from public.hospital_schedule_work_blocks block
    cross join lateral (select private.clair_resolve_effective_operating_hours(p_workspace_id, block.shift_date) value) effective
    where block.schedule_revision_id = p_revision_id
      and (
        not (effective.value->>'isOpen')::boolean
        or block.start_minutes < extract(hour from (effective.value->>'treatmentStart')::time)::integer * 60 + extract(minute from (effective.value->>'treatmentStart')::time)::integer
        or block.end_minutes > extract(hour from (effective.value->>'treatmentEnd')::time)::integer * 60 + extract(minute from (effective.value->>'treatmentEnd')::time)::integer
      )
  ), '[]'::jsonb);

  insert into public.hospital_schedule_revision_validations (
    schedule_revision_id, workspace_id, roster_source_version, operating_calendar_version, issues, validated_by_user_id, validated_at
  ) values (
    p_revision_id, p_workspace_id, v_roster_hash, v_calendar_hash, v_issues, auth.uid(), now()
  ) on conflict (schedule_revision_id) do update set
    roster_source_version = case
      when p_accept_source_changes
        or hospital_schedule_revision_validations.roster_source_version = excluded.roster_source_version
      then excluded.roster_source_version
      else hospital_schedule_revision_validations.roster_source_version
    end,
    operating_calendar_version = case
      when p_accept_source_changes
        or hospital_schedule_revision_validations.operating_calendar_version = excluded.operating_calendar_version
      then excluded.operating_calendar_version
      else hospital_schedule_revision_validations.operating_calendar_version
    end,
    issues = excluded.issues,
    validated_by_user_id = excluded.validated_by_user_id,
    validated_at = excluded.validated_at;

  return v_issues;
end;
$$;

create or replace function private.clair_schedule_v2_assert_work_block_allowed(
  p_workspace_id text,
  p_revision_id uuid,
  p_block_id uuid,
  p_staff_profile_id uuid,
  p_shift_date date,
  p_start_minutes integer,
  p_end_minutes integer
) returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_operating_schedule jsonb;
  v_start_limit integer;
  v_end_limit integer;
begin
  if p_staff_profile_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.hospital_schedule_staff_profiles profile
    join public.user_memberships membership
      on membership.id = profile.membership_id
     and membership.workspace_id = p_workspace_id
     and membership.status = 'active'
    where profile.id = p_staff_profile_id
      and profile.workspace_id = p_workspace_id
  ) then
    raise exception using errcode = '23503', message = 'schedule_staff_profile_inactive_or_cross_workspace';
  end if;

  if exists (
    select 1
    from public.hospital_schedule_work_blocks block
    where block.schedule_revision_id = p_revision_id
      and block.staff_profile_id = p_staff_profile_id
      and block.shift_date = p_shift_date
      and block.id <> p_block_id
      and block.start_minutes < p_end_minutes
      and p_start_minutes < block.end_minutes
  ) then
    raise exception using errcode = '23P01', message = 'schedule_work_block_overlaps_existing';
  end if;

  if exists (
    select 1
    from public.hospital_schedule_non_work_entries entry
    where entry.schedule_revision_id = p_revision_id
      and entry.staff_profile_id = p_staff_profile_id
      and entry.entry_date = p_shift_date
      and (
        entry.entry_kind = 'off'
        or entry.start_minutes is null
        or (entry.start_minutes < p_end_minutes and p_start_minutes < entry.end_minutes)
      )
  ) then
    raise exception using errcode = '23P01', message = 'schedule_work_block_overlaps_non_work';
  end if;

  v_operating_schedule := private.clair_resolve_effective_operating_hours(
    p_workspace_id,
    p_shift_date
  );
  if coalesce((v_operating_schedule->>'isOpen')::boolean, false) = false then
    raise exception using errcode = '23514', message = 'schedule_hospital_closed';
  end if;
  v_start_limit := extract(hour from (v_operating_schedule->>'treatmentStart')::time)::integer * 60
    + extract(minute from (v_operating_schedule->>'treatmentStart')::time)::integer;
  v_end_limit := extract(hour from (v_operating_schedule->>'treatmentEnd')::time)::integer * 60
    + extract(minute from (v_operating_schedule->>'treatmentEnd')::time)::integer;
  if p_start_minutes < v_start_limit or p_end_minutes > v_end_limit then
    raise exception using errcode = '23514', message = 'schedule_work_block_outside_operating_hours';
  end if;
end;
$$;

create or replace function private.clair_schedule_v2_assert_non_work_entry_allowed(
  p_workspace_id text,
  p_revision_id uuid,
  p_entry_id uuid,
  p_staff_profile_id uuid,
  p_entry_date date,
  p_entry_kind text,
  p_start_minutes integer,
  p_end_minutes integer
) returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.hospital_schedule_staff_profiles profile
    join public.user_memberships membership
      on membership.id = profile.membership_id
     and membership.workspace_id = p_workspace_id
     and membership.status = 'active'
    where profile.id = p_staff_profile_id
      and profile.workspace_id = p_workspace_id
  ) then
    raise exception using errcode = '23503', message = 'schedule_staff_profile_inactive_or_cross_workspace';
  end if;

  if exists (
    select 1
    from public.hospital_schedule_non_work_entries entry
    where entry.schedule_revision_id = p_revision_id
      and entry.staff_profile_id = p_staff_profile_id
      and entry.entry_date = p_entry_date
      and entry.id <> p_entry_id
  ) then
    raise exception using errcode = '23P01', message = 'schedule_non_work_entry_duplicate';
  end if;

  if exists (
    select 1
    from public.hospital_schedule_work_blocks block
    where block.schedule_revision_id = p_revision_id
      and block.staff_profile_id = p_staff_profile_id
      and block.shift_date = p_entry_date
      and (
        p_entry_kind = 'off'
        or p_start_minutes is null
        or (block.start_minutes < p_end_minutes and p_start_minutes < block.end_minutes)
      )
  ) then
    raise exception using errcode = '23P01', message = 'schedule_non_work_entry_overlaps_work';
  end if;
end;
$$;

create or replace function private.clair_schedule_v2_idempotency_result(
  p_workspace_id text,
  p_operation text,
  p_key text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_existing public.hospital_schedule_idempotency_requests%rowtype;
  v_hash text := md5(coalesce(p_payload, '{}'::jsonb)::text);
begin
  select * into v_existing
  from public.hospital_schedule_idempotency_requests
  where workspace_id = p_workspace_id
    and actor_user_id = auth.uid()
    and operation = p_operation
    and idempotency_key = p_key
  for update;
  if found then
    if v_existing.payload_hash <> v_hash then
      raise exception using errcode = '23505', message = 'idempotency_key_reused';
    end if;
    if v_existing.status = 'completed' then
      return v_existing.result;
    end if;
    raise exception using errcode = '55P03', message = 'idempotency_request_in_progress';
  end if;
  insert into public.hospital_schedule_idempotency_requests (
    workspace_id, actor_user_id, operation, idempotency_key, payload_hash
  ) values (p_workspace_id, auth.uid(), p_operation, p_key, v_hash);
  return null;
end;
$$;

create or replace function private.clair_schedule_v2_complete_idempotency(
  p_workspace_id text, p_operation text, p_key text, p_result jsonb
) returns void
language sql
security definer
set search_path = public, private, pg_temp
as $$
  update public.hospital_schedule_idempotency_requests
  set status = 'completed', result = p_result, completed_at = now()
  where workspace_id = p_workspace_id and actor_user_id = auth.uid()
    and operation = p_operation and idempotency_key = p_key;
$$;

create or replace function private.clair_schedule_v2_append_audit(
  p_workspace_id text,
  p_operation text,
  p_revision_id uuid,
  p_lock_version integer,
  p_idempotency_key text
) returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_membership_id uuid;
begin
  select id into v_membership_id
  from public.user_memberships
  where workspace_id = p_workspace_id
    and user_id = auth.uid()
    and status = 'active';

  perform public.clair_append_audit_event(
    'schedule-revision-' || md5(concat_ws(':', p_operation, p_revision_id::text, p_idempotency_key)),
    p_workspace_id,
    auth.uid(),
    v_membership_id,
    'hospital.schedule_revision_mutated',
    'hospital_schedule_revision',
    p_revision_id::text,
    p_after_snapshot => jsonb_build_object('revisionId', p_revision_id, 'lockVersion', p_lock_version),
    p_metadata => jsonb_build_object('operation', p_operation)
  );
end;
$$;

create or replace function public.hospital_schedule_resolve_week_start(p_workspace_id text)
returns date
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception using errcode = '42501', message = 'schedule_workspace_membership_required';
  end if;
  return private.clair_schedule_v2_week_start(p_workspace_id);
end;
$$;

create or replace function public.hospital_schedule_get_rollout_mode(p_workspace_id text)
returns text
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception using errcode = '42501', message = 'schedule_workspace_membership_required';
  end if;
  return private.clair_schedule_v2_rollout_mode(p_workspace_id);
end;
$$;

create or replace function public.hospital_schedule_resolve_revision_week_start(
  p_workspace_id text,
  p_revision_id uuid
) returns date
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_week_start date;
begin
  if not private.clair_schedule_v2_can_manage(p_workspace_id) then
    raise exception using errcode = '42501', message = 'schedule_admin_required';
  end if;
  select schedule_week.week_start into v_week_start
  from public.hospital_schedule_revisions revision
  join public.hospital_schedule_weeks schedule_week
    on schedule_week.id = revision.schedule_week_id
   and schedule_week.workspace_id = p_workspace_id
  where revision.id = p_revision_id
    and revision.workspace_id = p_workspace_id;
  if v_week_start is null then
    raise exception using errcode = 'P0002', message = 'schedule_revision_not_found';
  end if;
  return v_week_start;
end;
$$;

create or replace function public.hospital_schedule_read_revision_snapshot(
  p_workspace_id text, p_week_start date
) returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_week_id uuid;
  v_draft_id uuid;
  v_published_id uuid;
begin
  if not private.clair_schedule_v2_can_manage(p_workspace_id) then
    raise exception using errcode = '42501', message = 'schedule_admin_required';
  end if;
  select id, latest_published_revision_id into v_week_id, v_published_id
  from public.hospital_schedule_weeks
  where workspace_id = p_workspace_id and week_start = p_week_start;
  select id into v_draft_id from public.hospital_schedule_revisions
  where schedule_week_id = v_week_id and state = 'draft';
  return jsonb_build_object(
    'modelVersion', 'v2',
    'week', jsonb_build_object('id', v_week_id, 'weekStart', p_week_start, 'latestPublishedRevisionId', v_published_id),
    'draftRevision', (select to_jsonb(revision) from public.hospital_schedule_revisions revision where id = v_draft_id),
    'latestPublishedRevision', (select to_jsonb(revision) from public.hospital_schedule_revisions revision where id = v_published_id),
    'publishedRevisions', coalesce((
      select jsonb_agg(to_jsonb(revision) order by revision.revision_no desc)
      from public.hospital_schedule_revisions revision
      where revision.schedule_week_id = v_week_id
        and revision.workspace_id = p_workspace_id
        and revision.state in ('published', 'superseded')
    ), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', profile.id,
        'membershipId', profile.membership_id,
        'name', app_user.display_name,
        'initials', coalesce(app_user.initial, left(app_user.display_name, 2)),
        'role', profile.operational_role,
        'availability', profile.availability,
        'jobPositionId', assignment.job_position_id
      ) order by app_user.display_name)
      from public.hospital_schedule_staff_profiles profile
      join public.user_memberships membership
        on membership.id = profile.membership_id
       and membership.workspace_id = p_workspace_id
       and membership.status = 'active'
      join public.users app_user
        on app_user.id = membership.user_id
       and app_user.status = 'active'
      left join public.workspace_membership_job_position_assignments assignment
        on assignment.workspace_id = p_workspace_id
       and assignment.membership_id = membership.id
      where profile.workspace_id = p_workspace_id
    ), '[]'::jsonb),
    'workBlocks', coalesce((select jsonb_agg(to_jsonb(block) order by block.shift_date, block.start_minutes)
      from public.hospital_schedule_work_blocks block where block.schedule_revision_id = coalesce(v_draft_id, v_published_id)), '[]'::jsonb),
    'nonWorkEntries', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.entry_date, entry.start_minutes nulls first)
      from public.hospital_schedule_non_work_entries entry where entry.schedule_revision_id = coalesce(v_draft_id, v_published_id)), '[]'::jsonb),
    'issues', coalesce((select issues from public.hospital_schedule_revision_validations where schedule_revision_id = coalesce(v_draft_id, v_published_id)), '[]'::jsonb),
    'rolloutMode', private.clair_schedule_v2_rollout_mode(p_workspace_id)
  );
end;
$$;

create or replace function public.hospital_schedule_create_draft_v2(
  p_workspace_id text, p_week_start date, p_source_revision_id uuid, p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_existing jsonb;
  v_week_id uuid;
  v_source public.hospital_schedule_revisions%rowtype;
  v_revision public.hospital_schedule_revisions%rowtype;
  v_next_no integer;
  v_result jsonb;
  v_source_week_start date;
  v_date_offset integer := 0;
begin
  if not private.clair_schedule_v2_can_manage(p_workspace_id) then raise exception using errcode = '42501', message = 'schedule_admin_required'; end if;
  v_existing := private.clair_schedule_v2_idempotency_result(p_workspace_id, 'create_draft', p_idempotency_key,
    jsonb_build_object('weekStart', p_week_start, 'sourceRevisionId', p_source_revision_id));
  if v_existing is not null then return v_existing; end if;
  insert into public.hospital_schedule_weeks (workspace_id, week_start)
  values (p_workspace_id, p_week_start) on conflict (workspace_id, week_start) do nothing;
  select id into v_week_id from public.hospital_schedule_weeks where workspace_id = p_workspace_id and week_start = p_week_start for update;
  select * into v_revision from public.hospital_schedule_revisions where schedule_week_id = v_week_id and state = 'draft';
  if found then
    v_result := jsonb_build_object('revisionId', v_revision.id, 'lockVersion', v_revision.lock_version, 'resumed', true);
    perform private.clair_schedule_v2_complete_idempotency(p_workspace_id, 'create_draft', p_idempotency_key, v_result);
    return v_result;
  end if;
  if p_source_revision_id is not null then
    select * into v_source from public.hospital_schedule_revisions
    where id = p_source_revision_id and workspace_id = p_workspace_id and state in ('published', 'superseded');
    if not found then raise exception using errcode = 'P0002', message = 'schedule_source_revision_not_found'; end if;
    select week_start into v_source_week_start from public.hospital_schedule_weeks where id = v_source.schedule_week_id;
    if v_source_week_start = p_week_start then
      v_date_offset := 0;
    elsif v_source_week_start = p_week_start - 7 then
      v_date_offset := 7;
    else
      raise exception using errcode = '22023', message = 'schedule_source_week_invalid';
    end if;
  end if;
  select coalesce(max(revision_no), 0) + 1 into v_next_no from public.hospital_schedule_revisions where schedule_week_id = v_week_id;
  insert into public.hospital_schedule_revisions (
    workspace_id, schedule_week_id, revision_no, based_on_revision_id, created_by_user_id
  ) values (p_workspace_id, v_week_id, v_next_no, v_source.id, auth.uid()) returning * into v_revision;
  if v_source.id is not null then
    insert into public.hospital_schedule_work_blocks (
      workspace_id, schedule_revision_id, staff_profile_id, shift_date, start_minutes, end_minutes,
      work_kind, work_label_snapshot, location_label_snapshot, private_note, created_by_user_id
    ) select workspace_id, v_revision.id, staff_profile_id, shift_date + v_date_offset, start_minutes, end_minutes,
      work_kind, work_label_snapshot, location_label_snapshot, private_note, auth.uid()
    from public.hospital_schedule_work_blocks where schedule_revision_id = v_source.id;
    insert into public.hospital_schedule_non_work_entries (
      workspace_id, schedule_revision_id, staff_profile_id, entry_date, entry_kind, leave_subtype,
      start_minutes, end_minutes, private_note, created_by_user_id
    ) select workspace_id, v_revision.id, staff_profile_id, entry_date + v_date_offset, entry_kind, leave_subtype,
      start_minutes, end_minutes, private_note, auth.uid()
    from public.hospital_schedule_non_work_entries where schedule_revision_id = v_source.id;
  end if;
  v_result := jsonb_build_object('revisionId', v_revision.id, 'lockVersion', v_revision.lock_version, 'resumed', false);
  perform private.clair_schedule_v2_append_audit(
    p_workspace_id, 'create_draft', v_revision.id, v_revision.lock_version, p_idempotency_key
  );
  perform private.clair_schedule_v2_complete_idempotency(p_workspace_id, 'create_draft', p_idempotency_key, v_result);
  return v_result;
end;
$$;

create or replace function public.hospital_schedule_validate_revision_v2(
  p_workspace_id text, p_revision_id uuid, p_expected_lock_version integer, p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_revision public.hospital_schedule_revisions%rowtype;
  v_existing jsonb;
  v_issues jsonb;
  v_result jsonb;
begin
  if not private.clair_schedule_v2_can_manage(p_workspace_id) then raise exception using errcode = '42501', message = 'schedule_admin_required'; end if;
  v_existing := private.clair_schedule_v2_idempotency_result(p_workspace_id, 'validate_revision', p_idempotency_key,
    jsonb_build_object('revisionId', p_revision_id, 'expectedLockVersion', p_expected_lock_version));
  if v_existing is not null then return v_existing; end if;
  select * into v_revision from public.hospital_schedule_revisions
  where id = p_revision_id and workspace_id = p_workspace_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'schedule_revision_not_found'; end if;
  if v_revision.state <> 'draft' then raise exception using errcode = '55000', message = 'schedule_revision_not_draft'; end if;
  if v_revision.lock_version <> p_expected_lock_version then raise exception using errcode = '40001', message = 'stale_schedule_revision'; end if;
  v_issues := private.clair_schedule_v2_validate(p_workspace_id, p_revision_id, true);
  v_result := jsonb_build_object('revisionId', p_revision_id, 'lockVersion', v_revision.lock_version, 'issues', v_issues);
  perform private.clair_schedule_v2_append_audit(
    p_workspace_id, 'validate_revision', p_revision_id, v_revision.lock_version, p_idempotency_key
  );
  perform private.clair_schedule_v2_complete_idempotency(p_workspace_id, 'validate_revision', p_idempotency_key, v_result);
  return v_result;
end;
$$;

create or replace function public.hospital_schedule_save_work_block_v2(
  p_workspace_id text,
  p_revision_id uuid,
  p_expected_lock_version integer,
  p_payload jsonb,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_revision public.hospital_schedule_revisions%rowtype;
  v_existing jsonb;
  v_block public.hospital_schedule_work_blocks%rowtype;
  v_block_id uuid;
  v_staff_profile_id uuid;
  v_result jsonb;
  v_issues jsonb;
begin
  if not private.clair_schedule_v2_can_manage(p_workspace_id) then raise exception using errcode = '42501', message = 'schedule_admin_required'; end if;
  if jsonb_typeof(p_payload) <> 'object'
    or coalesce(p_payload->>'shiftDate', '') !~ '^\d{4}-\d{2}-\d{2}$'
    or coalesce(p_payload->>'workKind', '') not in ('clinical', 'support', 'reception')
    or length(btrim(coalesce(p_payload->>'workLabelSnapshot', ''))) = 0
    or coalesce(p_payload->>'startMinutes', '') !~ '^\d+$'
    or coalesce(p_payload->>'endMinutes', '') !~ '^\d+$'
  then raise exception using errcode = '22023', message = 'schedule_work_block_invalid'; end if;
  if p_payload ? 'staffProfileId' and nullif(p_payload->>'staffProfileId', '') is not null then
    if p_payload->>'staffProfileId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception using errcode = '22023', message = 'schedule_staff_profile_invalid';
    end if;
    v_staff_profile_id := (p_payload->>'staffProfileId')::uuid;
  end if;
  v_existing := private.clair_schedule_v2_idempotency_result(p_workspace_id, 'save_work_block', p_idempotency_key,
    jsonb_build_object('revisionId', p_revision_id, 'expectedLockVersion', p_expected_lock_version, 'payload', p_payload));
  if v_existing is not null then return v_existing; end if;
  select * into v_revision from public.hospital_schedule_revisions
  where id = p_revision_id and workspace_id = p_workspace_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'schedule_revision_not_found'; end if;
  if v_revision.state <> 'draft' then raise exception using errcode = '55000', message = 'schedule_revision_not_draft'; end if;
  if v_revision.lock_version <> p_expected_lock_version then raise exception using errcode = '40001', message = 'stale_schedule_revision'; end if;
  if p_payload ? 'id' and nullif(p_payload->>'id', '') is not null then
    if p_payload->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception using errcode = '22023', message = 'schedule_work_block_id_invalid';
    end if;
    v_block_id := (p_payload->>'id')::uuid;
    if not exists (select 1 from public.hospital_schedule_work_blocks where id = v_block_id and schedule_revision_id = p_revision_id) then
      raise exception using errcode = 'P0002', message = 'schedule_work_block_not_found';
    end if;
  else
    v_block_id := gen_random_uuid();
  end if;
  perform private.clair_schedule_v2_assert_work_block_allowed(
    p_workspace_id,
    p_revision_id,
    v_block_id,
    v_staff_profile_id,
    (p_payload->>'shiftDate')::date,
    (p_payload->>'startMinutes')::integer,
    (p_payload->>'endMinutes')::integer
  );
  insert into public.hospital_schedule_work_blocks (
    id, workspace_id, schedule_revision_id, staff_profile_id, shift_date, start_minutes, end_minutes,
    work_kind, work_label_snapshot, location_label_snapshot, private_note, created_by_user_id
  ) values (
    v_block_id, p_workspace_id, p_revision_id, v_staff_profile_id, (p_payload->>'shiftDate')::date,
    (p_payload->>'startMinutes')::integer, (p_payload->>'endMinutes')::integer,
    p_payload->>'workKind', btrim(p_payload->>'workLabelSnapshot'), nullif(p_payload->>'locationLabelSnapshot', ''),
    nullif(p_payload->>'privateNote', ''), auth.uid()
  ) on conflict (id) do update set
    staff_profile_id = excluded.staff_profile_id,
    shift_date = excluded.shift_date,
    start_minutes = excluded.start_minutes,
    end_minutes = excluded.end_minutes,
    work_kind = excluded.work_kind,
    work_label_snapshot = excluded.work_label_snapshot,
    location_label_snapshot = excluded.location_label_snapshot,
    private_note = excluded.private_note,
    updated_at = now()
  returning * into v_block;
  update public.hospital_schedule_revisions
  set lock_version = lock_version + 1, updated_at = now()
  where id = p_revision_id returning * into v_revision;
  v_issues := private.clair_schedule_v2_validate(p_workspace_id, p_revision_id, false);
  v_result := jsonb_build_object('entry', to_jsonb(v_block), 'lockVersion', v_revision.lock_version, 'issues', v_issues);
  perform private.clair_schedule_v2_append_audit(
    p_workspace_id, 'save_work_block', p_revision_id, v_revision.lock_version, p_idempotency_key
  );
  perform private.clair_schedule_v2_complete_idempotency(p_workspace_id, 'save_work_block', p_idempotency_key, v_result);
  return v_result;
end;
$$;

create or replace function public.hospital_schedule_save_non_work_entry_v2(
  p_workspace_id text,
  p_revision_id uuid,
  p_expected_lock_version integer,
  p_payload jsonb,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_revision public.hospital_schedule_revisions%rowtype;
  v_existing jsonb;
  v_entry public.hospital_schedule_non_work_entries%rowtype;
  v_entry_id uuid;
  v_staff_profile_id uuid;
  v_start_minutes integer;
  v_end_minutes integer;
  v_result jsonb;
  v_issues jsonb;
begin
  if not private.clair_schedule_v2_can_manage(p_workspace_id) then raise exception using errcode = '42501', message = 'schedule_admin_required'; end if;
  if jsonb_typeof(p_payload) <> 'object'
    or coalesce(p_payload->>'entryDate', '') !~ '^\d{4}-\d{2}-\d{2}$'
    or coalesce(p_payload->>'entryKind', '') not in ('leave', 'off')
    or coalesce(p_payload->>'staffProfileId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then raise exception using errcode = '22023', message = 'schedule_non_work_entry_invalid'; end if;
  v_staff_profile_id := (p_payload->>'staffProfileId')::uuid;
  if p_payload->>'entryKind' = 'leave' and ((p_payload ? 'startMinutes') <> (p_payload ? 'endMinutes')) then
    raise exception using errcode = '22023', message = 'schedule_non_work_time_invalid';
  end if;
  if p_payload->>'entryKind' = 'leave' and p_payload ? 'startMinutes' then
    if coalesce(p_payload->>'startMinutes', '') !~ '^\d+$' or coalesce(p_payload->>'endMinutes', '') !~ '^\d+$' then
      raise exception using errcode = '22023', message = 'schedule_non_work_time_invalid';
    end if;
    v_start_minutes := (p_payload->>'startMinutes')::integer;
    v_end_minutes := (p_payload->>'endMinutes')::integer;
  end if;
  v_existing := private.clair_schedule_v2_idempotency_result(p_workspace_id, 'save_non_work_entry', p_idempotency_key,
    jsonb_build_object('revisionId', p_revision_id, 'expectedLockVersion', p_expected_lock_version, 'payload', p_payload));
  if v_existing is not null then return v_existing; end if;
  select * into v_revision from public.hospital_schedule_revisions
  where id = p_revision_id and workspace_id = p_workspace_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'schedule_revision_not_found'; end if;
  if v_revision.state <> 'draft' then raise exception using errcode = '55000', message = 'schedule_revision_not_draft'; end if;
  if v_revision.lock_version <> p_expected_lock_version then raise exception using errcode = '40001', message = 'stale_schedule_revision'; end if;
  if p_payload ? 'id' and nullif(p_payload->>'id', '') is not null then
    if p_payload->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception using errcode = '22023', message = 'schedule_non_work_entry_id_invalid';
    end if;
    v_entry_id := (p_payload->>'id')::uuid;
    if not exists (select 1 from public.hospital_schedule_non_work_entries where id = v_entry_id and schedule_revision_id = p_revision_id) then
      raise exception using errcode = 'P0002', message = 'schedule_non_work_entry_not_found';
    end if;
  else
    v_entry_id := gen_random_uuid();
  end if;
  perform private.clair_schedule_v2_assert_non_work_entry_allowed(
    p_workspace_id,
    p_revision_id,
    v_entry_id,
    v_staff_profile_id,
    (p_payload->>'entryDate')::date,
    p_payload->>'entryKind',
    v_start_minutes,
    v_end_minutes
  );
  insert into public.hospital_schedule_non_work_entries (
    id, workspace_id, schedule_revision_id, staff_profile_id, entry_date, entry_kind, leave_subtype,
    start_minutes, end_minutes, private_note, created_by_user_id
  ) values (
    v_entry_id, p_workspace_id, p_revision_id, v_staff_profile_id, (p_payload->>'entryDate')::date,
    p_payload->>'entryKind',
    case when p_payload->>'entryKind' = 'leave' then nullif(p_payload->>'leaveSubtype', '') else null end,
    case when p_payload->>'entryKind' = 'leave' then v_start_minutes else null end,
    case when p_payload->>'entryKind' = 'leave' then v_end_minutes else null end,
    nullif(p_payload->>'privateNote', ''), auth.uid()
  ) on conflict (id) do update set
    staff_profile_id = excluded.staff_profile_id,
    entry_date = excluded.entry_date,
    entry_kind = excluded.entry_kind,
    leave_subtype = excluded.leave_subtype,
    start_minutes = excluded.start_minutes,
    end_minutes = excluded.end_minutes,
    private_note = excluded.private_note,
    updated_at = now()
  returning * into v_entry;
  update public.hospital_schedule_revisions
  set lock_version = lock_version + 1, updated_at = now()
  where id = p_revision_id returning * into v_revision;
  v_issues := private.clair_schedule_v2_validate(p_workspace_id, p_revision_id, false);
  v_result := jsonb_build_object('entry', to_jsonb(v_entry), 'lockVersion', v_revision.lock_version, 'issues', v_issues);
  perform private.clair_schedule_v2_append_audit(
    p_workspace_id, 'save_non_work_entry', p_revision_id, v_revision.lock_version, p_idempotency_key
  );
  perform private.clair_schedule_v2_complete_idempotency(p_workspace_id, 'save_non_work_entry', p_idempotency_key, v_result);
  return v_result;
end;
$$;

create or replace function public.hospital_schedule_delete_entry_v2(
  p_workspace_id text,
  p_revision_id uuid,
  p_expected_lock_version integer,
  p_entry_kind text,
  p_entry_id uuid,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_revision public.hospital_schedule_revisions%rowtype;
  v_existing jsonb;
  v_result jsonb;
  v_issues jsonb;
  v_deleted integer;
begin
  if not private.clair_schedule_v2_can_manage(p_workspace_id) then raise exception using errcode = '42501', message = 'schedule_admin_required'; end if;
  if p_entry_kind not in ('work_block', 'non_work_entry') then raise exception using errcode = '22023', message = 'schedule_entry_kind_invalid'; end if;
  v_existing := private.clair_schedule_v2_idempotency_result(p_workspace_id, 'delete_entry', p_idempotency_key,
    jsonb_build_object('revisionId', p_revision_id, 'expectedLockVersion', p_expected_lock_version, 'entryKind', p_entry_kind, 'entryId', p_entry_id));
  if v_existing is not null then return v_existing; end if;
  select * into v_revision from public.hospital_schedule_revisions
  where id = p_revision_id and workspace_id = p_workspace_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'schedule_revision_not_found'; end if;
  if v_revision.state <> 'draft' then raise exception using errcode = '55000', message = 'schedule_revision_not_draft'; end if;
  if v_revision.lock_version <> p_expected_lock_version then raise exception using errcode = '40001', message = 'stale_schedule_revision'; end if;
  if p_entry_kind = 'work_block' then
    delete from public.hospital_schedule_work_blocks where id = p_entry_id and schedule_revision_id = p_revision_id;
  else
    delete from public.hospital_schedule_non_work_entries where id = p_entry_id and schedule_revision_id = p_revision_id;
  end if;
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then raise exception using errcode = 'P0002', message = 'schedule_entry_not_found'; end if;
  update public.hospital_schedule_revisions
  set lock_version = lock_version + 1, updated_at = now()
  where id = p_revision_id returning * into v_revision;
  v_issues := private.clair_schedule_v2_validate(p_workspace_id, p_revision_id, false);
  v_result := jsonb_build_object('entryId', p_entry_id, 'lockVersion', v_revision.lock_version, 'issues', v_issues);
  perform private.clair_schedule_v2_append_audit(
    p_workspace_id, 'delete_entry', p_revision_id, v_revision.lock_version, p_idempotency_key
  );
  perform private.clair_schedule_v2_complete_idempotency(p_workspace_id, 'delete_entry', p_idempotency_key, v_result);
  return v_result;
end;
$$;

create or replace function public.hospital_schedule_discard_draft_v2(
  p_workspace_id text, p_revision_id uuid, p_expected_lock_version integer, p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_revision public.hospital_schedule_revisions%rowtype;
  v_existing jsonb;
  v_result jsonb;
begin
  if not private.clair_schedule_v2_can_manage(p_workspace_id) then raise exception using errcode = '42501', message = 'schedule_admin_required'; end if;
  v_existing := private.clair_schedule_v2_idempotency_result(p_workspace_id, 'discard_draft', p_idempotency_key,
    jsonb_build_object('revisionId', p_revision_id, 'expectedLockVersion', p_expected_lock_version));
  if v_existing is not null then return v_existing; end if;
  select * into v_revision from public.hospital_schedule_revisions
  where id = p_revision_id and workspace_id = p_workspace_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'schedule_revision_not_found'; end if;
  if v_revision.state <> 'draft' then raise exception using errcode = '55000', message = 'schedule_revision_not_draft'; end if;
  if v_revision.lock_version <> p_expected_lock_version then raise exception using errcode = '40001', message = 'stale_schedule_revision'; end if;
  perform private.clair_schedule_v2_append_audit(
    p_workspace_id, 'discard_draft', p_revision_id, v_revision.lock_version, p_idempotency_key
  );
  delete from public.hospital_schedule_revisions where id = p_revision_id;
  v_result := jsonb_build_object('revisionId', p_revision_id, 'discarded', true);
  perform private.clair_schedule_v2_complete_idempotency(p_workspace_id, 'discard_draft', p_idempotency_key, v_result);
  return v_result;
end;
$$;

create or replace function public.hospital_schedule_publish_revision_v2(
  p_workspace_id text, p_revision_id uuid, p_expected_lock_version integer, p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_revision public.hospital_schedule_revisions%rowtype;
  v_existing jsonb;
  v_issues jsonb;
  v_result jsonb;
  v_membership_id uuid;
begin
  if not private.clair_schedule_v2_can_manage(p_workspace_id) then raise exception using errcode = '42501', message = 'schedule_admin_required'; end if;
  v_existing := private.clair_schedule_v2_idempotency_result(p_workspace_id, 'publish_revision', p_idempotency_key,
    jsonb_build_object('revisionId', p_revision_id, 'expectedLockVersion', p_expected_lock_version));
  if v_existing is not null then return v_existing; end if;
  select * into v_revision from public.hospital_schedule_revisions
  where id = p_revision_id and workspace_id = p_workspace_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'schedule_revision_not_found'; end if;
  if v_revision.state <> 'draft' then raise exception using errcode = '55000', message = 'schedule_revision_not_draft'; end if;
  if v_revision.lock_version <> p_expected_lock_version then raise exception using errcode = '40001', message = 'stale_schedule_revision'; end if;
  v_issues := private.clair_schedule_v2_validate(p_workspace_id, p_revision_id, true);
  if jsonb_array_length(v_issues) > 0 then
    raise exception using errcode = 'P0001', message = 'publication_blocked:' || v_issues::text;
  end if;
  perform set_config('app.schedule_v2_publish', 'on', true);
  update public.hospital_schedule_revisions
  set state = 'superseded', updated_at = now()
  where schedule_week_id = v_revision.schedule_week_id and state = 'published';
  update public.hospital_schedule_revisions
  set state = 'published', published_at = now(), published_by_user_id = auth.uid(), updated_at = now(), lock_version = lock_version + 1
  where id = p_revision_id returning * into v_revision;
  update public.hospital_schedule_weeks
  set latest_published_revision_id = p_revision_id, updated_at = now()
  where id = v_revision.schedule_week_id and workspace_id = p_workspace_id;
  select id into v_membership_id from public.user_memberships
  where workspace_id = p_workspace_id and user_id = auth.uid() and status = 'active';
  perform public.clair_append_audit_event(
    'schedule-revision-published-' || p_revision_id::text, p_workspace_id, auth.uid(), v_membership_id,
    'hospital.schedule_revision_published', 'hospital_schedule_revision', p_revision_id::text,
    p_after_snapshot => jsonb_build_object('revisionId', p_revision_id, 'weekId', v_revision.schedule_week_id)
  );
  v_result := jsonb_build_object('revisionId', p_revision_id, 'lockVersion', v_revision.lock_version, 'publishedAt', v_revision.published_at);
  perform private.clair_schedule_v2_complete_idempotency(p_workspace_id, 'publish_revision', p_idempotency_key, v_result);
  return v_result;
end;
$$;

create or replace function public.hospital_schedule_read_profile_schedule(
  p_workspace_id text,
  p_user_id text,
  p_start_date date,
  p_end_date date
) returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := nullif(p_user_id, '')::uuid;
  v_staff_profile_id uuid;
  v_mode text;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception using errcode = '42501', message = 'schedule_workspace_membership_required';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date
    or p_end_date > p_start_date + 13 then
    raise exception using errcode = '22023', message = 'schedule_profile_date_range_invalid';
  end if;
  if not private.clair_schedule_v2_can_read_profile(p_workspace_id, v_user_id) then
    raise exception using errcode = '42501', message = 'schedule_profile_not_owned';
  end if;

  select profile.id into v_staff_profile_id
  from public.hospital_schedule_staff_profiles profile
  join public.user_memberships membership
    on membership.id = profile.membership_id
   and membership.workspace_id = p_workspace_id
   and membership.user_id = v_user_id
   and membership.status = 'active'
  join public.users app_user
    on app_user.id = membership.user_id
   and app_user.status = 'active'
  where profile.workspace_id = p_workspace_id;

  v_mode := private.clair_schedule_v2_rollout_mode(p_workspace_id);
  if v_mode = 'v2' then
    return jsonb_build_object(
      'scheduleProfileId', v_staff_profile_id,
      'shifts', coalesce((
        select jsonb_agg(to_jsonb(item) order by item.date, item.start_minutes)
        from (
          select
            block.shift_date as date,
            block.start_minutes,
            block.end_minutes,
            block.work_kind as kind,
            block.work_label_snapshot as work_label,
            block.location_label_snapshot as location_label
          from public.hospital_schedule_work_blocks block
          join public.hospital_schedule_revisions revision
            on revision.id = block.schedule_revision_id
           and revision.workspace_id = p_workspace_id
           and revision.state = 'published'
          join public.hospital_schedule_weeks schedule_week
            on schedule_week.id = revision.schedule_week_id
           and schedule_week.workspace_id = p_workspace_id
           and schedule_week.latest_published_revision_id = revision.id
          where block.workspace_id = p_workspace_id
            and block.staff_profile_id = v_staff_profile_id
            and block.shift_date between p_start_date and p_end_date
          union all
          select
            entry.entry_date as date,
            coalesce(entry.start_minutes, 0) as start_minutes,
            coalesce(entry.end_minutes, 1440) as end_minutes,
            entry.entry_kind as kind,
            case when entry.entry_kind = 'leave' then '휴가' else '휴무일' end as work_label,
            null::text as location_label
          from public.hospital_schedule_non_work_entries entry
          join public.hospital_schedule_revisions revision
            on revision.id = entry.schedule_revision_id
           and revision.workspace_id = p_workspace_id
           and revision.state = 'published'
          join public.hospital_schedule_weeks schedule_week
            on schedule_week.id = revision.schedule_week_id
           and schedule_week.workspace_id = p_workspace_id
           and schedule_week.latest_published_revision_id = revision.id
          where entry.workspace_id = p_workspace_id
            and entry.staff_profile_id = v_staff_profile_id
            and entry.entry_date between p_start_date and p_end_date
        ) item
      ), '[]'::jsonb),
      'modelVersion', 'v2'
    );
  end if;

  return jsonb_build_object(
    'scheduleProfileId', v_staff_profile_id,
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', shift.shift_date,
        'start_minutes', shift.start_minutes,
        'end_minutes', shift.end_minutes,
        'kind', shift.shift_kind,
        'work_label', shift.work_label,
        'location_label', shift.location_label
      ) order by shift.shift_date, shift.start_minutes)
      from public.hospital_schedule_shifts shift
      join public.hospital_schedule_weeks schedule_week
        on schedule_week.id = shift.schedule_week_id
       and schedule_week.workspace_id = p_workspace_id
       and schedule_week.publication_state in ('published', 'changed')
      where shift.workspace_id = p_workspace_id
        and shift.staff_profile_id = v_staff_profile_id
        and shift.shift_date between p_start_date and p_end_date
    ), '[]'::jsonb),
    'modelVersion', 'v1'
  );
end;
$$;

-- This exercises the same minimal profile projection consumed by reception/profile
-- instead of treating a successful publish transaction as proof of downstream visibility.
create or replace function public.hospital_schedule_verify_profile_readback_v2(
  p_workspace_id text,
  p_revision_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_week_start date;
  v_revision_state text;
  v_latest_revision_id uuid;
  v_expected_count integer := 0;
  v_readback_count integer := 0;
  v_profile record;
  v_projection jsonb;
begin
  if not private.clair_schedule_v2_can_manage(p_workspace_id) then
    raise exception using errcode = '42501', message = 'schedule_admin_required';
  end if;

  select schedule_week.week_start, revision.state, schedule_week.latest_published_revision_id
    into v_week_start, v_revision_state, v_latest_revision_id
  from public.hospital_schedule_revisions revision
  join public.hospital_schedule_weeks schedule_week
    on schedule_week.id = revision.schedule_week_id
   and schedule_week.workspace_id = p_workspace_id
  where revision.id = p_revision_id
    and revision.workspace_id = p_workspace_id;

  if not found or v_revision_state <> 'published' or v_latest_revision_id is distinct from p_revision_id then
    return jsonb_build_object(
      'status', 'verification_failed',
      'reason', 'latest_published_pointer_mismatch'
    );
  end if;

  select count(*) into v_expected_count
  from (
    select id from public.hospital_schedule_work_blocks
    where workspace_id = p_workspace_id and schedule_revision_id = p_revision_id
    union all
    select id from public.hospital_schedule_non_work_entries
    where workspace_id = p_workspace_id and schedule_revision_id = p_revision_id
  ) entries;

  for v_profile in
    select distinct membership.user_id
    from (
      select staff_profile_id
      from public.hospital_schedule_work_blocks
      where workspace_id = p_workspace_id
        and schedule_revision_id = p_revision_id
        and staff_profile_id is not null
      union
      select staff_profile_id
      from public.hospital_schedule_non_work_entries
      where workspace_id = p_workspace_id
        and schedule_revision_id = p_revision_id
    ) entries
    join public.hospital_schedule_staff_profiles profile
      on profile.id = entries.staff_profile_id
     and profile.workspace_id = p_workspace_id
    join public.user_memberships membership
      on membership.id = profile.membership_id
     and membership.workspace_id = p_workspace_id
  loop
    v_projection := public.hospital_schedule_read_profile_schedule(
      p_workspace_id,
      v_profile.user_id::text,
      v_week_start,
      v_week_start + 6
    );
    if coalesce(v_projection ->> 'modelVersion', '') <> 'v2' then
      return jsonb_build_object(
        'status', 'verification_failed',
        'reason', 'profile_projection_not_v2'
      );
    end if;
    v_readback_count := v_readback_count + jsonb_array_length(coalesce(v_projection -> 'shifts', '[]'::jsonb));
  end loop;

  if v_readback_count <> v_expected_count then
    return jsonb_build_object(
      'status', 'verification_failed',
      'reason', 'profile_projection_entry_count_mismatch',
      'expectedEntryCount', v_expected_count,
      'readbackEntryCount', v_readback_count
    );
  end if;

  return jsonb_build_object(
    'status', 'confirmed',
    'expectedEntryCount', v_expected_count,
    'readbackEntryCount', v_readback_count
  );
end;
$$;

create or replace function private.clair_staff_current_work_status_snapshot_v2(
  p_workspace_id text,
  p_user_id text,
  p_day date
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := nullif(p_user_id, '')::uuid;
  v_staff_profile_id uuid;
  v_timezone text;
  v_local_now timestamp;
  v_local_today date;
  v_target_minutes integer;
  v_operating_schedule jsonb;
  v_shift record;
  v_room_name text;
  v_state text;
  v_source text := 'schedule';
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception using errcode = '42501', message = 'staff_current_work_workspace_membership_required';
  end if;

  if not private.clair_schedule_v2_can_read_profile(p_workspace_id, v_user_id) then
    raise exception using errcode = '42501', message = 'staff_current_work_not_owned';
  end if;

  select profile.id, workspace.timezone
    into v_staff_profile_id, v_timezone
  from public.user_memberships membership
  join public.users app_user
    on app_user.id = membership.user_id
   and app_user.status = 'active'
  join public.workspaces workspace
    on workspace.id = membership.workspace_id
  left join public.hospital_schedule_staff_profiles profile
    on profile.workspace_id = membership.workspace_id
   and profile.membership_id = membership.id
  where membership.workspace_id = p_workspace_id
    and membership.user_id = v_user_id
    and membership.status = 'active';

  if v_timezone is null then return null; end if;
  v_local_now := timezone(v_timezone, now());
  v_local_today := v_local_now::date;
  v_target_minutes := case
    when p_day < v_local_today then 1440
    when p_day > v_local_today then -1
    else extract(hour from v_local_now)::integer * 60 + extract(minute from v_local_now)::integer
  end;
  v_operating_schedule := private.clair_resolve_effective_operating_hours(p_workspace_id, p_day);

  select * into v_shift
  from (
    select
      entry.id,
      entry.start_minutes,
      entry.end_minutes,
      entry.entry_kind as shift_kind,
      entry.leave_subtype,
      0 as entry_priority
    from public.hospital_schedule_non_work_entries entry
    join public.hospital_schedule_revisions revision
      on revision.id = entry.schedule_revision_id
     and revision.workspace_id = p_workspace_id
     and revision.state = 'published'
    join public.hospital_schedule_weeks schedule_week
      on schedule_week.id = revision.schedule_week_id
     and schedule_week.workspace_id = p_workspace_id
     and schedule_week.latest_published_revision_id = revision.id
    where entry.workspace_id = p_workspace_id
      and entry.staff_profile_id = v_staff_profile_id
      and entry.entry_date = p_day
    union all
    select
      block.id,
      block.start_minutes,
      block.end_minutes,
      block.work_kind as shift_kind,
      null::text as leave_subtype,
      1 as entry_priority
    from public.hospital_schedule_work_blocks block
    join public.hospital_schedule_revisions revision
      on revision.id = block.schedule_revision_id
     and revision.workspace_id = p_workspace_id
     and revision.state = 'published'
    join public.hospital_schedule_weeks schedule_week
      on schedule_week.id = revision.schedule_week_id
     and schedule_week.workspace_id = p_workspace_id
     and schedule_week.latest_published_revision_id = revision.id
    where block.workspace_id = p_workspace_id
      and block.staff_profile_id = v_staff_profile_id
      and block.shift_date = p_day
  ) candidate
  order by
    candidate.entry_priority,
    case
      when v_target_minutes between candidate.start_minutes and candidate.end_minutes - 1 then 0
      when v_target_minutes < candidate.start_minutes then 1
      else 2
    end,
    candidate.start_minutes
  limit 1;

  if v_shift.id is null then
    if coalesce((v_operating_schedule->>'isOpen')::boolean, false) = false then
      return jsonb_build_object('date', p_day, 'state', 'hospital_closed', 'startMinutes', null, 'endMinutes', null, 'detailLabel', null, 'source', 'operating_hours');
    end if;
    return null;
  end if;

  if v_shift.shift_kind = 'leave' then
    v_state := case when v_shift.leave_subtype = 'same_day' then 'same_day_leave' else 'leave' end;
  elsif v_shift.shift_kind = 'off' then
    v_state := 'off';
  else
    select call_event.room_name into v_room_name
    from public.encounters encounter
    join public.encounter_call_events call_event
      on call_event.workspace_id = encounter.workspace_id
     and call_event.encounter_id = encounter.id
    where encounter.workspace_id = p_workspace_id
      and encounter.primary_veterinarian_id = v_user_id
      and encounter.status = 'in_consultation'
      and timezone(v_timezone, encounter.checked_in_at)::date = p_day
      and nullif(trim(call_event.room_name), '') is not null
    order by call_event.created_at desc
    limit 1;

    if v_room_name is not null then
      v_state := 'in_consultation';
      v_source := 'encounter';
    elsif v_target_minutes >= v_shift.end_minutes then
      v_state := 'shift_ended';
    elsif v_target_minutes < v_shift.start_minutes then
      v_state := 'scheduled';
    else
      v_state := 'working';
    end if;
  end if;

  return jsonb_build_object(
    'date', p_day,
    'state', v_state,
    'startMinutes', v_shift.start_minutes,
    'endMinutes', v_shift.end_minutes,
    'detailLabel', case when v_state = 'in_consultation' then v_room_name else null end,
    'source', v_source
  );
end;
$$;

create or replace function public.staff_current_work_status_snapshot(
  p_workspace_id text,
  p_user_id text,
  p_day date
) returns jsonb
language plpgsql
stable
security invoker
set search_path = public, private, pg_temp
as $$
begin
  if not private.clair_schedule_v2_can_read_profile(
    p_workspace_id,
    nullif(p_user_id, '')::uuid
  ) then
    raise exception using errcode = '42501', message = 'staff_current_work_not_owned';
  end if;
  if private.clair_schedule_v2_rollout_mode(p_workspace_id) = 'v2' then
    return private.clair_staff_current_work_status_snapshot_v2(p_workspace_id, p_user_id, p_day);
  end if;
  return private.clair_staff_current_work_status_snapshot(p_workspace_id, p_user_id, p_day);
end;
$$;

-- Backfill v1 without changing the legacy records. A changed v1 week is already
-- consumer-visible, therefore it becomes revision 1 published rather than a draft.
insert into public.hospital_schedule_revisions (
  workspace_id, schedule_week_id, revision_no, state, created_by_user_id, published_by_user_id, published_at
)
select
  schedule_week.workspace_id,
  schedule_week.id,
  1,
  case when schedule_week.publication_state = 'draft' then 'draft' else 'published' end,
  schedule_week.published_by_user_id,
  schedule_week.published_by_user_id,
  schedule_week.published_at
from public.hospital_schedule_weeks schedule_week
where not exists (
  select 1 from public.hospital_schedule_revisions revision where revision.schedule_week_id = schedule_week.id
);

update public.hospital_schedule_weeks schedule_week
set latest_published_revision_id = revision.id
from public.hospital_schedule_revisions revision
where revision.schedule_week_id = schedule_week.id
  and revision.state = 'published'
  and schedule_week.latest_published_revision_id is null;

insert into public.hospital_schedule_work_blocks (
  id, workspace_id, schedule_revision_id, staff_profile_id, shift_date, start_minutes, end_minutes,
  work_kind, work_label_snapshot, location_label_snapshot, private_note, created_by_user_id, updated_at
)
select
  shift.id, shift.workspace_id, revision.id, shift.staff_profile_id, shift.shift_date, shift.start_minutes, shift.end_minutes,
  shift.shift_kind, shift.work_label, shift.location_label, shift.note, shift.created_by_user_id, shift.updated_at
from public.hospital_schedule_shifts shift
join public.hospital_schedule_revisions revision on revision.schedule_week_id = shift.schedule_week_id and revision.revision_no = 1
where shift.shift_kind in ('clinical', 'support', 'reception')
on conflict (id) do nothing;

insert into public.hospital_schedule_non_work_entries (
  id, workspace_id, schedule_revision_id, staff_profile_id, entry_date, entry_kind, leave_subtype,
  start_minutes, end_minutes, private_note, created_by_user_id, updated_at
)
select
  shift.id, shift.workspace_id, revision.id, shift.staff_profile_id, shift.shift_date, shift.shift_kind, shift.leave_subtype,
  case when shift.shift_kind = 'leave' then shift.start_minutes else null end,
  case when shift.shift_kind = 'leave' then shift.end_minutes else null end,
  shift.note, shift.created_by_user_id, shift.updated_at
from public.hospital_schedule_shifts shift
join public.hospital_schedule_revisions revision on revision.schedule_week_id = shift.schedule_week_id and revision.revision_no = 1
where shift.shift_kind in ('leave', 'off') and shift.staff_profile_id is not null
on conflict (id) do nothing;

insert into public.hospital_schedule_revision_validations (
  schedule_revision_id, workspace_id, roster_source_version, operating_calendar_version, issues, validated_at
)
select
  revision.id,
  revision.workspace_id,
  private.clair_schedule_v2_roster_hash(revision.workspace_id),
  private.clair_schedule_v2_operating_calendar_hash(revision.workspace_id),
  '[]'::jsonb,
  now()
from public.hospital_schedule_revisions revision
on conflict (schedule_revision_id) do nothing;

alter table public.audit_events drop constraint if exists audit_events_event_type_check;
alter table public.audit_events add constraint audit_events_event_type_check check (event_type in (
  'workspace.created','workspace.invitation_created','workspace.invitation_resent','workspace.invitation_canceled',
  'workspace.invitation_accepted','workspace.membership_roles_changed','workspace.role_catalog_changed',
  'workspace.membership_status_changed','workspace.membership_soft_deleted','workspace.membership_archived',
  'workspace.membership_deactivated','workspace.membership_reactivated','workspace.membership_restored',
  'workspace.permission_role_deactivated','workspace.permission_role_reactivated',
  'workspace.permission_role_created','workspace.permission_role_updated',
  'workspace.job_position_deactivated','workspace.job_position_reactivated',
  'workspace.last_admin_change_blocked','user.profile_updated','user.workspace_status_message_updated',
  'reception.patient_guardian_registered','reception.walk_in_created','reception.appointment_created',
  'reception.appointment_checked_in','reception.appointment_restored','reception.encounter_cancelled',
  'reception.encounter_restored','reception.encounter_updated','reception.queue_status_changed',
  'chart.patient_called','chart.consultation_started','chart.consultation_returned_to_waiting',
  'chart.soap_saved','chart.completed','diagnosis.changed','order.draft_changed','order.confirmed',
  'order.billing_candidate_requested','order.status_changed','order_catalog.created',
  'order_catalog.updated','order_catalog.paused','billing.invoice_candidate_generated',
  'billing.invoice_line_changed','billing.invoice_issued','billing.payment_state_changed',
  'billing.refund_requested','hospital.operating_hours_updated','hospital.schedule_revision_published',
  'hospital.schedule_revision_mutated'
));

revoke all on function private.clair_schedule_v2_rollout_mode(text) from public, anon, authenticated;
revoke all on function private.clair_schedule_v2_can_manage(text) from public, anon, authenticated;
revoke all on function private.clair_schedule_v2_can_read_profile(text, uuid) from public, anon, authenticated;
revoke all on function private.clair_schedule_v2_week_start(text) from public, anon, authenticated;
revoke all on function private.clair_schedule_v2_roster_hash(text) from public, anon, authenticated;
revoke all on function private.clair_schedule_v2_operating_calendar_hash(text) from public, anon, authenticated;
revoke all on function private.clair_schedule_v2_validate(text, uuid, boolean) from public, anon, authenticated;
revoke all on function private.clair_schedule_v2_idempotency_result(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.clair_schedule_v2_complete_idempotency(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.clair_schedule_v2_append_audit(text, text, uuid, integer, text) from public, anon, authenticated;
revoke all on function private.clair_schedule_v2_assert_work_block_allowed(text, uuid, uuid, uuid, date, integer, integer) from public, anon, authenticated;
revoke all on function private.clair_schedule_v2_assert_non_work_entry_allowed(text, uuid, uuid, uuid, date, text, integer, integer) from public, anon, authenticated;
revoke all on function private.clair_schedule_v2_assert_entry_date() from public, anon, authenticated;
revoke all on function private.clair_schedule_v2_immutable_revision() from public, anon, authenticated;
revoke all on function private.clair_schedule_v2_immutable_entry() from public, anon, authenticated;
revoke all on function private.clair_schedule_v2_assert_latest_published() from public, anon, authenticated;
grant execute on function public.hospital_schedule_resolve_week_start(text) to authenticated;
grant execute on function public.hospital_schedule_get_rollout_mode(text) to authenticated;
grant execute on function public.hospital_schedule_resolve_revision_week_start(text, uuid) to authenticated;
grant execute on function public.hospital_schedule_read_profile_schedule(text, text, date, date) to authenticated;
grant execute on function public.hospital_schedule_verify_profile_readback_v2(text, uuid) to authenticated;
grant execute on function public.hospital_schedule_read_revision_snapshot(text, date) to authenticated;
grant execute on function public.hospital_schedule_create_draft_v2(text, date, uuid, text) to authenticated;
grant execute on function public.hospital_schedule_validate_revision_v2(text, uuid, integer, text) to authenticated;
grant execute on function public.hospital_schedule_save_work_block_v2(text, uuid, integer, jsonb, text) to authenticated;
grant execute on function public.hospital_schedule_save_non_work_entry_v2(text, uuid, integer, jsonb, text) to authenticated;
grant execute on function public.hospital_schedule_delete_entry_v2(text, uuid, integer, text, uuid, text) to authenticated;
grant execute on function public.hospital_schedule_discard_draft_v2(text, uuid, integer, text) to authenticated;
grant execute on function public.hospital_schedule_publish_revision_v2(text, uuid, integer, text) to authenticated;
revoke all on function private.clair_staff_current_work_status_snapshot_v2(text, text, date) from public, anon, authenticated;
revoke all on function public.staff_current_work_status_snapshot(text, text, date) from public, anon;
grant execute on function public.staff_current_work_status_snapshot(text, text, date) to authenticated;
