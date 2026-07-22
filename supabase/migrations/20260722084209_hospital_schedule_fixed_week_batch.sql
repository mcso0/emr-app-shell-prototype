-- Add one atomic, idempotent shortcut for company-style fixed weekly hours.
-- Existing work, leave, and off entries are preserved so administrators can
-- use the shortcut without overwriting week-specific exceptions.

alter table public.hospital_schedule_idempotency_requests
  drop constraint if exists hospital_schedule_idempotency_requests_operation_check;
alter table public.hospital_schedule_idempotency_requests
  add constraint hospital_schedule_idempotency_requests_operation_check check (operation in (
    'create_draft', 'save_work_block', 'save_non_work_entry', 'delete_entry',
    'publish_revision', 'discard_draft', 'validate_revision', 'apply_fixed_week'
  ));

create or replace function public.hospital_schedule_apply_fixed_week_v2(
  p_workspace_id text,
  p_revision_id uuid,
  p_expected_lock_version integer,
  p_weekdays integer[],
  p_start_minutes integer,
  p_end_minutes integer,
  p_roles text[],
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
  v_week_start date;
  v_profile record;
  v_weekday integer;
  v_shift_date date;
  v_block_id uuid;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_work_kind text;
  v_work_label text;
begin
  if not private.clair_schedule_v2_can_manage(p_workspace_id) then
    raise exception using errcode = '42501', message = 'schedule_admin_required';
  end if;
  if coalesce(cardinality(p_weekdays), 0) = 0
    or exists (select 1 from unnest(p_weekdays) day_value where day_value not between 1 and 7)
    or (select count(*) from unnest(p_weekdays)) <> (select count(distinct day_value) from unnest(p_weekdays) day_value)
    or coalesce(cardinality(p_roles), 0) = 0
    or exists (
      select 1 from unnest(p_roles) role_value
      where role_value not in ('veterinarian', 'technician', 'reception')
    )
    or (select count(*) from unnest(p_roles)) <> (select count(distinct role_value) from unnest(p_roles) role_value)
    or p_expected_lock_version is null
    or p_expected_lock_version <= 0
    or p_start_minutes is null
    or p_end_minutes is null
    or p_start_minutes not between 0 and 1439
    or p_end_minutes not between 1 and 1440
    or p_end_minutes <= p_start_minutes
  then
    raise exception using errcode = '22023', message = 'schedule_fixed_week_invalid';
  end if;

  v_existing := private.clair_schedule_v2_idempotency_result(
    p_workspace_id,
    'apply_fixed_week',
    p_idempotency_key,
    jsonb_build_object(
      'revisionId', p_revision_id,
      'expectedLockVersion', p_expected_lock_version,
      'weekdays', p_weekdays,
      'startMinutes', p_start_minutes,
      'endMinutes', p_end_minutes,
      'roles', p_roles
    )
  );
  if v_existing is not null then return v_existing; end if;

  select revision.*
    into v_revision
  from public.hospital_schedule_revisions revision
  join public.hospital_schedule_weeks schedule_week
    on schedule_week.id = revision.schedule_week_id
   and schedule_week.workspace_id = revision.workspace_id
  where revision.id = p_revision_id
    and revision.workspace_id = p_workspace_id
  for update of revision;
  if not found then
    raise exception using errcode = 'P0002', message = 'schedule_revision_not_found';
  end if;
  if v_revision.state <> 'draft' then
    raise exception using errcode = '55000', message = 'schedule_revision_not_draft';
  end if;
  if v_revision.lock_version <> p_expected_lock_version then
    raise exception using errcode = '40001', message = 'stale_schedule_revision';
  end if;
  select schedule_week.week_start into v_week_start
  from public.hospital_schedule_weeks schedule_week
  where schedule_week.id = v_revision.schedule_week_id
    and schedule_week.workspace_id = p_workspace_id;

  for v_profile in
    select profile.id, profile.operational_role
    from public.hospital_schedule_staff_profiles profile
    join public.user_memberships membership
      on membership.id = profile.membership_id
     and membership.workspace_id = p_workspace_id
     and membership.status = 'active'
    join public.users app_user
      on app_user.id = membership.user_id
     and app_user.status = 'active'
    where profile.workspace_id = p_workspace_id
      and profile.operational_role = any(p_roles)
    order by profile.id
  loop
    v_work_kind := case v_profile.operational_role
      when 'veterinarian' then 'clinical'
      when 'technician' then 'support'
      else 'reception'
    end;
    v_work_label := case v_profile.operational_role
      when 'veterinarian' then '진료'
      when 'technician' then '지원'
      else '접수'
    end;

    foreach v_weekday in array p_weekdays loop
      v_shift_date := v_week_start + (v_weekday - 1);

      if exists (
        select 1 from public.hospital_schedule_work_blocks block
        where block.schedule_revision_id = p_revision_id
          and block.staff_profile_id = v_profile.id
          and block.shift_date = v_shift_date
      ) or exists (
        select 1 from public.hospital_schedule_non_work_entries entry
        where entry.schedule_revision_id = p_revision_id
          and entry.staff_profile_id = v_profile.id
          and entry.entry_date = v_shift_date
      ) then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      v_block_id := gen_random_uuid();
      perform private.clair_schedule_v2_assert_work_block_allowed(
        p_workspace_id,
        p_revision_id,
        v_block_id,
        v_profile.id,
        v_shift_date,
        p_start_minutes,
        p_end_minutes
      );
      insert into public.hospital_schedule_work_blocks (
        id, workspace_id, schedule_revision_id, staff_profile_id, shift_date,
        start_minutes, end_minutes, work_kind, work_label_snapshot,
        location_label_snapshot, private_note, created_by_user_id
      ) values (
        v_block_id, p_workspace_id, p_revision_id, v_profile.id, v_shift_date,
        p_start_minutes, p_end_minutes, v_work_kind, v_work_label,
        null, null, auth.uid()
      );
      v_inserted := v_inserted + 1;
    end loop;
  end loop;

  update public.hospital_schedule_revisions
  set lock_version = lock_version + 1, updated_at = now()
  where id = p_revision_id
  returning * into v_revision;
  v_issues := private.clair_schedule_v2_validate(p_workspace_id, p_revision_id, false);
  v_result := jsonb_build_object(
    'revisionId', p_revision_id,
    'lockVersion', v_revision.lock_version,
    'insertedCount', v_inserted,
    'skippedCount', v_skipped,
    'issues', v_issues
  );
  perform private.clair_schedule_v2_append_audit(
    p_workspace_id,
    'apply_fixed_week',
    p_revision_id,
    v_revision.lock_version,
    p_idempotency_key
  );
  perform private.clair_schedule_v2_complete_idempotency(
    p_workspace_id,
    'apply_fixed_week',
    p_idempotency_key,
    v_result
  );
  return v_result;
end;
$$;

revoke all on function public.hospital_schedule_apply_fixed_week_v2(
  text, uuid, integer, integer[], integer, integer, text[], text
) from public, anon;
grant execute on function public.hospital_schedule_apply_fixed_week_v2(
  text, uuid, integer, integer[], integer, integer, text[], text
) to authenticated;
