-- HOSPITAL-ADMIN-LIVE-PR-011: local/dev/test persisted schedule operations.
-- This migration stores synthetic operational data only. It does not issue pay
-- or autonomously alter a published schedule.

create table if not exists public.hospital_schedule_staff_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  membership_id uuid not null references public.user_memberships(id) on delete cascade,
  operational_role text not null check (operational_role in ('veterinarian', 'technician', 'reception')),
  hourly_rate_cents integer not null default 0 check (hourly_rate_cents >= 0),
  availability jsonb not null default '{}'::jsonb check (jsonb_typeof(availability) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, membership_id)
);

create table if not exists public.hospital_schedule_weeks (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  week_start date not null,
  publication_state text not null default 'draft' check (publication_state in ('draft', 'published', 'changed')),
  published_at timestamptz,
  published_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, week_start)
);

create table if not exists public.hospital_schedule_shifts (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  schedule_week_id uuid not null references public.hospital_schedule_weeks(id) on delete cascade,
  staff_profile_id uuid references public.hospital_schedule_staff_profiles(id) on delete set null,
  shift_date date not null,
  start_minutes integer not null check (start_minutes between 0 and 1439),
  end_minutes integer not null check (end_minutes between 1 and 1440 and end_minutes > start_minutes),
  shift_kind text not null check (shift_kind in ('clinical', 'support', 'reception', 'leave', 'off')),
  work_label text not null check (length(trim(work_label)) between 1 and 80),
  location_label text,
  note text,
  created_by_user_id uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.hospital_schedule_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  staff_profile_id uuid not null references public.hospital_schedule_staff_profiles(id) on delete cascade,
  shift_id uuid references public.hospital_schedule_shifts(id) on delete set null,
  requested_date date not null,
  request_type text not null check (request_type in ('leave', 'shift_change')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_start_minutes integer check (requested_start_minutes between 0 and 1439),
  requested_end_minutes integer check (requested_end_minutes between 1 and 1440),
  reason text not null check (length(trim(reason)) between 1 and 1000),
  reviewed_by_user_id uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.hospital_schedule_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  notification_type text not null check (notification_type in ('request_submitted', 'request_reviewed', 'schedule_published')),
  message text not null check (length(trim(message)) between 1 and 240),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.hospital_time_clock_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  staff_profile_id uuid not null references public.hospital_schedule_staff_profiles(id) on delete cascade,
  shift_id uuid references public.hospital_schedule_shifts(id) on delete set null,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  created_at timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at > clock_in_at)
);

create table if not exists public.hospital_schedule_payroll_previews (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  total_minutes integer not null check (total_minutes >= 0),
  total_pay_cents integer not null check (total_pay_cents >= 0),
  status text not null default 'preview' check (status = 'preview'),
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists hospital_schedule_shifts_week_date_idx on public.hospital_schedule_shifts (schedule_week_id, shift_date);
create index if not exists hospital_schedule_requests_workspace_status_idx on public.hospital_schedule_requests (workspace_id, status, created_at desc);
create index if not exists hospital_time_clock_entries_staff_idx on public.hospital_time_clock_entries (staff_profile_id, clock_in_at desc);
create index if not exists hospital_schedule_notifications_recipient_idx on public.hospital_schedule_notifications (recipient_user_id, read_at, created_at desc);

alter table public.hospital_schedule_staff_profiles enable row level security;
alter table public.hospital_schedule_weeks enable row level security;
alter table public.hospital_schedule_shifts enable row level security;
alter table public.hospital_schedule_requests enable row level security;
alter table public.hospital_time_clock_entries enable row level security;
alter table public.hospital_schedule_payroll_previews enable row level security;
alter table public.hospital_schedule_notifications enable row level security;

grant select, insert, update, delete on public.hospital_schedule_staff_profiles, public.hospital_schedule_weeks, public.hospital_schedule_shifts, public.hospital_schedule_requests, public.hospital_time_clock_entries, public.hospital_schedule_payroll_previews to authenticated;
grant select, update on public.hospital_schedule_notifications to authenticated;

create or replace function private.clair_is_own_schedule_staff_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public, private, pg_temp as $$
  select exists (
    select 1 from public.hospital_schedule_staff_profiles profile
    join public.user_memberships membership on membership.id = profile.membership_id
    where profile.id = p_profile_id and membership.user_id = auth.uid() and membership.status = 'active'
  );
$$;

create policy hospital_schedule_admin_all on public.hospital_schedule_staff_profiles for all to authenticated using (private.clair_is_workspace_admin(workspace_id)) with check (private.clair_is_workspace_admin(workspace_id));
create policy hospital_schedule_weeks_member_select on public.hospital_schedule_weeks for select to authenticated using (private.clair_is_active_workspace_member(workspace_id));
create policy hospital_schedule_weeks_admin_write on public.hospital_schedule_weeks for all to authenticated using (private.clair_is_workspace_admin(workspace_id)) with check (private.clair_is_workspace_admin(workspace_id));
create policy hospital_schedule_shifts_member_select on public.hospital_schedule_shifts for select to authenticated using (private.clair_is_active_workspace_member(workspace_id));
create policy hospital_schedule_shifts_admin_write on public.hospital_schedule_shifts for all to authenticated using (private.clair_is_workspace_admin(workspace_id)) with check (private.clair_is_workspace_admin(workspace_id));
create policy hospital_schedule_requests_own_select on public.hospital_schedule_requests for select to authenticated using (private.clair_is_workspace_admin(workspace_id) or private.clair_is_own_schedule_staff_profile(staff_profile_id));
create policy hospital_schedule_requests_own_insert on public.hospital_schedule_requests for insert to authenticated with check (private.clair_is_own_schedule_staff_profile(staff_profile_id));
create policy hospital_schedule_requests_admin_update on public.hospital_schedule_requests for update to authenticated using (private.clair_is_workspace_admin(workspace_id)) with check (private.clair_is_workspace_admin(workspace_id));
create policy hospital_time_clock_own_all on public.hospital_time_clock_entries for all to authenticated using (private.clair_is_own_schedule_staff_profile(staff_profile_id)) with check (private.clair_is_own_schedule_staff_profile(staff_profile_id));
create policy hospital_time_clock_admin_select on public.hospital_time_clock_entries for select to authenticated using (private.clair_is_workspace_admin(workspace_id));
create policy hospital_schedule_payroll_admin_all on public.hospital_schedule_payroll_previews for all to authenticated using (private.clair_is_workspace_admin(workspace_id)) with check (private.clair_is_workspace_admin(workspace_id));
create policy hospital_schedule_notifications_own_select on public.hospital_schedule_notifications for select to authenticated using (recipient_user_id = auth.uid());
create policy hospital_schedule_notifications_own_update on public.hospital_schedule_notifications for update to authenticated using (recipient_user_id = auth.uid()) with check (recipient_user_id = auth.uid());

revoke all on function private.clair_is_own_schedule_staff_profile(uuid) from public, anon;
grant execute on function private.clair_is_own_schedule_staff_profile(uuid) to authenticated;

create or replace function private.clair_current_schedule_staff_profile(p_workspace_id text)
returns uuid language sql stable security definer set search_path = public, private, pg_temp as $$
  select profile.id
  from public.hospital_schedule_staff_profiles profile
  join public.user_memberships membership on membership.id = profile.membership_id
  join public.users app_user on app_user.id = membership.user_id
  where profile.workspace_id = p_workspace_id
    and membership.workspace_id = p_workspace_id
    and membership.user_id = auth.uid()
    and membership.status = 'active'
    and app_user.status = 'active'
  limit 1;
$$;

create or replace function private.clair_schedule_notify_request_created()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  insert into public.hospital_schedule_notifications (
    workspace_id, recipient_user_id, notification_type, message, data
  )
  select
    new.workspace_id,
    membership.user_id,
    'request_submitted',
    '근무 변경 요청이 도착했어.',
    jsonb_build_object('requestId', new.id, 'requestType', new.request_type)
  from public.user_memberships membership
  where membership.workspace_id = new.workspace_id
    and membership.status = 'active'
    and membership.roles @> array['hospital_admin']::text[];
  return new;
end;
$$;

create or replace function private.clair_schedule_notify_request_reviewed()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  recipient_id uuid;
begin
  if old.status = new.status or new.status = 'pending' then
    return new;
  end if;

  select membership.user_id into recipient_id
  from public.hospital_schedule_staff_profiles profile
  join public.user_memberships membership on membership.id = profile.membership_id
  where profile.id = new.staff_profile_id;

  if recipient_id is not null then
    insert into public.hospital_schedule_notifications (
      workspace_id, recipient_user_id, notification_type, message, data
    ) values (
      new.workspace_id,
      recipient_id,
      'request_reviewed',
      case when new.status = 'approved' then '근무 요청이 승인됐어.' else '근무 요청이 반려됐어.' end,
      jsonb_build_object('requestId', new.id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

create or replace function private.clair_schedule_notify_week_published()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if new.publication_state <> 'published' or old.publication_state = 'published' then
    return new;
  end if;

  insert into public.hospital_schedule_notifications (
    workspace_id, recipient_user_id, notification_type, message, data
  )
  select distinct
    new.workspace_id,
    membership.user_id,
    'schedule_published',
    '새 근무표가 게시됐어.',
    jsonb_build_object('weekStart', new.week_start)
  from public.hospital_schedule_shifts shift
  join public.hospital_schedule_staff_profiles profile on profile.id = shift.staff_profile_id
  join public.user_memberships membership on membership.id = profile.membership_id
  where shift.schedule_week_id = new.id
    and membership.status = 'active';
  return new;
end;
$$;

drop trigger if exists hospital_schedule_request_created_notification on public.hospital_schedule_requests;
create trigger hospital_schedule_request_created_notification
after insert on public.hospital_schedule_requests
for each row execute function private.clair_schedule_notify_request_created();

drop trigger if exists hospital_schedule_request_reviewed_notification on public.hospital_schedule_requests;
create trigger hospital_schedule_request_reviewed_notification
after update of status on public.hospital_schedule_requests
for each row execute function private.clair_schedule_notify_request_reviewed();

drop trigger if exists hospital_schedule_week_published_notification on public.hospital_schedule_weeks;
create trigger hospital_schedule_week_published_notification
after update of publication_state on public.hospital_schedule_weeks
for each row execute function private.clair_schedule_notify_week_published();

create or replace function public.hospital_schedule_read_snapshot(
  p_workspace_id text,
  p_week_start date
) returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  is_admin boolean := private.clair_is_workspace_admin(p_workspace_id);
  own_profile_id uuid := private.clair_current_schedule_staff_profile(p_workspace_id);
  week_id uuid;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception using errcode = '42501', message = 'schedule_workspace_membership_required';
  end if;

  select id into week_id
  from public.hospital_schedule_weeks
  where workspace_id = p_workspace_id and week_start = p_week_start;

  return jsonb_build_object(
    'week', (
      select jsonb_build_object(
        'id', schedule_week.id,
        'weekStart', schedule_week.week_start,
        'publicationState', schedule_week.publication_state,
        'publishedAt', schedule_week.published_at
      )
      from public.hospital_schedule_weeks schedule_week
      where schedule_week.id = week_id
    ),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', profile.id,
        'membershipId', profile.membership_id,
        'name', app_user.display_name,
        'initials', coalesce(app_user.initial, left(app_user.display_name, 2)),
        'role', profile.operational_role,
        'availability', profile.availability
      ) order by app_user.display_name)
      from public.hospital_schedule_staff_profiles profile
      join public.user_memberships membership on membership.id = profile.membership_id
      join public.users app_user on app_user.id = membership.user_id
      where profile.workspace_id = p_workspace_id and membership.status = 'active'
    ), '[]'::jsonb),
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', shift.id,
        'staffProfileId', shift.staff_profile_id,
        'date', shift.shift_date,
        'startMinutes', shift.start_minutes,
        'endMinutes', shift.end_minutes,
        'kind', shift.shift_kind,
        'workLabel', shift.work_label,
        'locationLabel', shift.location_label,
        'note', shift.note
      ) order by shift.shift_date, shift.start_minutes)
      from public.hospital_schedule_shifts shift
      where shift.schedule_week_id = week_id
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', request.id,
        'staffProfileId', request.staff_profile_id,
        'shiftId', request.shift_id,
        'date', request.requested_date,
        'type', request.request_type,
        'status', request.status,
        'requestedStartMinutes', request.requested_start_minutes,
        'requestedEndMinutes', request.requested_end_minutes,
        'reason', request.reason
      ) order by request.created_at desc)
      from public.hospital_schedule_requests request
      where request.workspace_id = p_workspace_id
        and (is_admin or request.staff_profile_id = own_profile_id)
    ), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', notification.id,
        'type', notification.notification_type,
        'message', notification.message,
        'data', notification.data,
        'readAt', notification.read_at,
        'createdAt', notification.created_at
      ) order by notification.created_at desc)
      from public.hospital_schedule_notifications notification
      where notification.workspace_id = p_workspace_id and notification.recipient_user_id = auth.uid()
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.hospital_schedule_create_request(
  p_workspace_id text,
  p_shift_id uuid,
  p_requested_date date,
  p_request_type text,
  p_requested_start_minutes integer,
  p_requested_end_minutes integer,
  p_reason text
) returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  profile_id uuid := private.clair_current_schedule_staff_profile(p_workspace_id);
  request_id uuid;
begin
  if profile_id is null then
    raise exception using errcode = '42501', message = 'schedule_staff_profile_required';
  end if;
  if p_request_type not in ('leave', 'shift_change') or length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception using errcode = '22023', message = 'schedule_request_invalid';
  end if;
  if (p_requested_start_minutes is null) <> (p_requested_end_minutes is null)
    or (p_requested_start_minutes is not null and (p_requested_start_minutes < 0 or p_requested_end_minutes > 1440 or p_requested_end_minutes <= p_requested_start_minutes)) then
    raise exception using errcode = '22023', message = 'schedule_request_time_invalid';
  end if;
  if p_shift_id is not null and not exists (
    select 1 from public.hospital_schedule_shifts shift
    where shift.id = p_shift_id and shift.workspace_id = p_workspace_id and shift.staff_profile_id = profile_id
  ) then
    raise exception using errcode = '42501', message = 'schedule_request_shift_not_owned';
  end if;

  insert into public.hospital_schedule_requests (
    workspace_id, staff_profile_id, shift_id, requested_date, request_type,
    requested_start_minutes, requested_end_minutes, reason
  ) values (
    p_workspace_id, profile_id, p_shift_id, p_requested_date, p_request_type,
    p_requested_start_minutes, p_requested_end_minutes, trim(p_reason)
  ) returning id into request_id;
  return request_id;
end;
$$;

create or replace function public.hospital_schedule_review_request(
  p_request_id uuid,
  p_decision text
) returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  request_row public.hospital_schedule_requests%rowtype;
  week_id uuid;
begin
  select * into request_row from public.hospital_schedule_requests where id = p_request_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'schedule_request_not_found';
  end if;
  if not private.clair_is_workspace_admin(request_row.workspace_id) then
    raise exception using errcode = '42501', message = 'schedule_admin_required';
  end if;
  if request_row.status <> 'pending' or p_decision not in ('approved', 'declined') then
    raise exception using errcode = '22023', message = 'schedule_request_review_invalid';
  end if;

  update public.hospital_schedule_requests
  set status = p_decision, reviewed_by_user_id = auth.uid(), reviewed_at = now()
  where id = request_row.id;

  if p_decision = 'approved' then
    if request_row.shift_id is null then
      select id into week_id
      from public.hospital_schedule_weeks
      where workspace_id = request_row.workspace_id
        and week_start = date_trunc('week', request_row.requested_date::timestamp)::date;
      if week_id is null then
        raise exception using errcode = 'P0002', message = 'schedule_week_not_found';
      end if;
      insert into public.hospital_schedule_shifts (
        workspace_id, schedule_week_id, staff_profile_id, shift_date, start_minutes,
        end_minutes, shift_kind, work_label, created_by_user_id
      ) values (
        request_row.workspace_id, week_id, request_row.staff_profile_id, request_row.requested_date,
        coalesce(request_row.requested_start_minutes, 540),
        coalesce(request_row.requested_end_minutes, 1080),
        'leave', '휴무', auth.uid()
      );
    elsif request_row.request_type = 'leave' then
      update public.hospital_schedule_shifts
      set shift_kind = 'leave', work_label = '휴무', location_label = null, updated_at = now()
      where id = request_row.shift_id;
    else
      update public.hospital_schedule_shifts
      set start_minutes = coalesce(request_row.requested_start_minutes, start_minutes),
          end_minutes = coalesce(request_row.requested_end_minutes, end_minutes),
          updated_at = now()
      where id = request_row.shift_id;
    end if;

    update public.hospital_schedule_weeks
    set publication_state = 'changed', updated_at = now()
    where id in (
      select schedule_week_id from public.hospital_schedule_shifts where id = request_row.shift_id
      union all select week_id where week_id is not null
    );
  end if;

  return jsonb_build_object('id', request_row.id, 'status', p_decision);
end;
$$;

create or replace function public.hospital_schedule_clock_in(
  p_workspace_id text,
  p_shift_id uuid
) returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  profile_id uuid := private.clair_current_schedule_staff_profile(p_workspace_id);
  entry_id uuid;
begin
  if profile_id is null or not exists (
    select 1 from public.hospital_schedule_shifts shift
    where shift.id = p_shift_id
      and shift.workspace_id = p_workspace_id
      and shift.staff_profile_id = profile_id
      and shift.shift_kind not in ('leave', 'off')
  ) then
    raise exception using errcode = '42501', message = 'schedule_clock_in_not_allowed';
  end if;
  if exists (
    select 1 from public.hospital_time_clock_entries entry
    where entry.workspace_id = p_workspace_id and entry.staff_profile_id = profile_id and entry.clock_out_at is null
  ) then
    raise exception using errcode = '23505', message = 'schedule_clock_in_already_open';
  end if;
  insert into public.hospital_time_clock_entries (workspace_id, staff_profile_id, shift_id, clock_in_at)
  values (p_workspace_id, profile_id, p_shift_id, now()) returning id into entry_id;
  return entry_id;
end;
$$;

create or replace function public.hospital_schedule_clock_out(p_workspace_id text)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  profile_id uuid := private.clair_current_schedule_staff_profile(p_workspace_id);
  entry_id uuid;
begin
  if profile_id is null then
    raise exception using errcode = '42501', message = 'schedule_staff_profile_required';
  end if;
  update public.hospital_time_clock_entries entry
  set clock_out_at = now()
  where entry.id = (
    select id from public.hospital_time_clock_entries
    where workspace_id = p_workspace_id and staff_profile_id = profile_id and clock_out_at is null
    order by clock_in_at desc limit 1
  ) returning id into entry_id;
  if entry_id is null then
    raise exception using errcode = 'P0002', message = 'schedule_clock_entry_not_found';
  end if;
  return entry_id;
end;
$$;

create or replace function public.hospital_schedule_publish_week(
  p_workspace_id text,
  p_week_start date
) returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  week_id uuid;
begin
  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception using errcode = '42501', message = 'schedule_admin_required';
  end if;
  select id into week_id from public.hospital_schedule_weeks
  where workspace_id = p_workspace_id and week_start = p_week_start for update;
  if week_id is null then
    raise exception using errcode = 'P0002', message = 'schedule_week_not_found';
  end if;
  if exists (
    select 1 from public.hospital_schedule_shifts shift
    where shift.schedule_week_id = week_id and shift.staff_profile_id is null and shift.shift_kind not in ('leave', 'off')
  ) then
    raise exception using errcode = '23514', message = 'schedule_publish_unassigned_shift';
  end if;
  update public.hospital_schedule_weeks
  set publication_state = 'published', published_at = now(), published_by_user_id = auth.uid(), updated_at = now()
  where id = week_id;
  return jsonb_build_object('id', week_id, 'publicationState', 'published');
end;
$$;

create or replace function public.hospital_schedule_create_payroll_preview(
  p_workspace_id text,
  p_period_start date,
  p_period_end date
) returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  preview_id uuid;
  preview_minutes integer;
  preview_cents integer;
begin
  if not private.clair_is_workspace_admin(p_workspace_id) or p_period_end < p_period_start then
    raise exception using errcode = '42501', message = 'schedule_payroll_preview_not_allowed';
  end if;
  select
    coalesce(sum(floor(extract(epoch from (entry.clock_out_at - entry.clock_in_at)) / 60))::integer, 0),
    coalesce(sum(floor(extract(epoch from (entry.clock_out_at - entry.clock_in_at)) / 60) * profile.hourly_rate_cents / 60)::integer, 0)
  into preview_minutes, preview_cents
  from public.hospital_time_clock_entries entry
  join public.hospital_schedule_staff_profiles profile on profile.id = entry.staff_profile_id
  where entry.workspace_id = p_workspace_id
    and entry.clock_out_at is not null
    and entry.clock_in_at >= p_period_start::timestamptz
    and entry.clock_in_at < (p_period_end + 1)::timestamptz;

  insert into public.hospital_schedule_payroll_previews (
    workspace_id, period_start, period_end, total_minutes, total_pay_cents, created_by_user_id
  ) values (
    p_workspace_id, p_period_start, p_period_end, preview_minutes, preview_cents, auth.uid()
  ) returning id into preview_id;
  return jsonb_build_object(
    'id', preview_id,
    'status', 'preview',
    'totalMinutes', preview_minutes,
    'totalPayCents', preview_cents
  );
end;
$$;

create or replace function public.hospital_schedule_save_shift(
  p_workspace_id text,
  p_shift_id uuid,
  p_staff_profile_id uuid,
  p_shift_date date,
  p_start_minutes integer,
  p_end_minutes integer,
  p_shift_kind text,
  p_work_label text,
  p_location_label text,
  p_note text
) returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  week_id uuid;
  saved_shift_id uuid;
begin
  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception using errcode = '42501', message = 'schedule_admin_required';
  end if;
  if p_shift_kind not in ('clinical', 'support', 'reception', 'leave', 'off')
    or p_start_minutes < 0 or p_end_minutes > 1440 or p_end_minutes <= p_start_minutes
    or length(trim(coalesce(p_work_label, ''))) = 0 then
    raise exception using errcode = '22023', message = 'schedule_shift_invalid';
  end if;
  select id into week_id
  from public.hospital_schedule_weeks
  where workspace_id = p_workspace_id
    and week_start = date_trunc('week', p_shift_date::timestamp)::date;
  if week_id is null then
    raise exception using errcode = 'P0002', message = 'schedule_week_not_found';
  end if;
  if p_staff_profile_id is not null and not exists (
    select 1 from public.hospital_schedule_staff_profiles profile
    where profile.id = p_staff_profile_id and profile.workspace_id = p_workspace_id
  ) then
    raise exception using errcode = '22023', message = 'schedule_staff_profile_invalid';
  end if;

  if p_shift_id is null then
    insert into public.hospital_schedule_shifts (
      workspace_id, schedule_week_id, staff_profile_id, shift_date, start_minutes,
      end_minutes, shift_kind, work_label, location_label, note, created_by_user_id
    ) values (
      p_workspace_id, week_id, p_staff_profile_id, p_shift_date, p_start_minutes,
      p_end_minutes, p_shift_kind, trim(p_work_label), nullif(trim(coalesce(p_location_label, '')), ''),
      nullif(trim(coalesce(p_note, '')), ''), auth.uid()
    ) returning id into saved_shift_id;
  else
    update public.hospital_schedule_shifts
    set schedule_week_id = week_id,
        staff_profile_id = p_staff_profile_id,
        shift_date = p_shift_date,
        start_minutes = p_start_minutes,
        end_minutes = p_end_minutes,
        shift_kind = p_shift_kind,
        work_label = trim(p_work_label),
        location_label = nullif(trim(coalesce(p_location_label, '')), ''),
        note = nullif(trim(coalesce(p_note, '')), ''),
        updated_at = now()
    where id = p_shift_id and workspace_id = p_workspace_id
    returning id into saved_shift_id;
    if saved_shift_id is null then
      raise exception using errcode = 'P0002', message = 'schedule_shift_not_found';
    end if;
  end if;

  update public.hospital_schedule_weeks
  set publication_state = 'changed', updated_at = now()
  where id = week_id;
  return saved_shift_id;
end;
$$;

create or replace function public.hospital_schedule_delete_shift(
  p_workspace_id text,
  p_shift_id uuid
) returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  week_id uuid;
  deleted_shift_id uuid;
begin
  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception using errcode = '42501', message = 'schedule_admin_required';
  end if;
  delete from public.hospital_schedule_shifts
  where id = p_shift_id and workspace_id = p_workspace_id
  returning id, schedule_week_id into deleted_shift_id, week_id;
  if deleted_shift_id is null then
    raise exception using errcode = 'P0002', message = 'schedule_shift_not_found';
  end if;
  update public.hospital_schedule_weeks
  set publication_state = 'changed', updated_at = now()
  where id = week_id;
  return deleted_shift_id;
end;
$$;

revoke all on function private.clair_current_schedule_staff_profile(text) from public, anon;
grant execute on function private.clair_current_schedule_staff_profile(text) to authenticated;
revoke all on function public.hospital_schedule_read_snapshot(text, date), public.hospital_schedule_create_request(text, uuid, date, text, integer, integer, text), public.hospital_schedule_review_request(uuid, text), public.hospital_schedule_clock_in(text, uuid), public.hospital_schedule_clock_out(text), public.hospital_schedule_publish_week(text, date), public.hospital_schedule_create_payroll_preview(text, date, date), public.hospital_schedule_save_shift(text, uuid, uuid, date, integer, integer, text, text, text, text), public.hospital_schedule_delete_shift(text, uuid) from public, anon;
grant execute on function public.hospital_schedule_read_snapshot(text, date), public.hospital_schedule_create_request(text, uuid, date, text, integer, integer, text), public.hospital_schedule_review_request(uuid, text), public.hospital_schedule_clock_in(text, uuid), public.hospital_schedule_clock_out(text), public.hospital_schedule_publish_week(text, date), public.hospital_schedule_create_payroll_preview(text, date, date), public.hospital_schedule_save_shift(text, uuid, uuid, date, integer, integer, text, text, text, text), public.hospital_schedule_delete_shift(text, uuid) to authenticated;
