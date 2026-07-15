-- RECEPTION-QA-PR-012 transaction-safe Staff Profile Side Panel V2 release replay.
-- Creates only synthetic/demo rows, exercises same-workspace and cross-workspace
-- boundaries, rolls everything back, and then proves that no created row remains.
-- Private avatar object/pointer coverage lives in private_profile_avatar_replay.sql
-- and scripts/check-private-profile-avatar-storage.mjs.
\set ON_ERROR_STOP on

begin;

insert into public.guardians (id, workspace_id, name, mobile_phone)
values (
  '5a120000-0000-4000-8000-000000000001',
  'workspace-clair-cheongdam',
  'QA-012 합성 보호자',
  '010-0000-5012'
);

insert into public.patients (
  id,
  workspace_id,
  patient_no,
  name,
  species,
  primary_attending_vet_id
)
values (
  '5a120000-0000-4000-8000-000000000002',
  'workspace-clair-cheongdam',
  'QA-012-PATIENT',
  'QA-012 합성 환자',
  'dog',
  '49110000-0000-4000-8000-000000000003'
);

insert into public.patient_guardians (
  id,
  workspace_id,
  patient_id,
  guardian_id,
  relationship,
  is_primary
)
values (
  '5a120000-0000-4000-8000-000000000003',
  'workspace-clair-cheongdam',
  '5a120000-0000-4000-8000-000000000002',
  '5a120000-0000-4000-8000-000000000001',
  '보호자',
  true
);

insert into public.encounters (
  id,
  workspace_id,
  patient_id,
  guardian_id,
  primary_veterinarian_id,
  encounter_no,
  reception_type,
  department,
  chief_complaint,
  status,
  checked_in_by_user_id
)
values (
  '5a120000-0000-4000-8000-000000000004',
  'workspace-clair-cheongdam',
  '5a120000-0000-4000-8000-000000000002',
  '5a120000-0000-4000-8000-000000000001',
  '49110000-0000-4000-8000-000000000003',
  'QA-012-ENCOUNTER',
  'walk_in',
  '진료',
  'Staff Profile V2 release replay',
  'ordered',
  '49110000-0000-4000-8000-000000000005'
);

insert into public.orders (
  id,
  workspace_id,
  encounter_id,
  order_type,
  display_name,
  status,
  priority,
  requested_by_user_id,
  requested_at,
  current_assignee_user_id,
  instruction,
  order_confirmation_status
)
values (
  '5a120000-0000-4000-8000-000000000005',
  'workspace-clair-cheongdam',
  '5a120000-0000-4000-8000-000000000004',
  'lab',
  'QA-012 합성 CBC',
  'requested',
  'normal',
  '49110000-0000-4000-8000-000000000005',
  now(),
  '49110000-0000-4000-8000-000000000003',
  'Staff Profile V2 assigned-work readback',
  'confirmed'
);

insert into public.order_fulfillment_work_items (
  id,
  workspace_id,
  encounter_id,
  order_id,
  order_type,
  queue_type,
  status,
  priority,
  requested_by_user_id,
  assigned_to_user_id,
  source_snapshot
)
values (
  '5a120000-0000-4000-8000-000000000006',
  'workspace-clair-cheongdam',
  '5a120000-0000-4000-8000-000000000004',
  '5a120000-0000-4000-8000-000000000005',
  'lab',
  'lab',
  'requested',
  'normal',
  '49110000-0000-4000-8000-000000000005',
  '49110000-0000-4000-8000-000000000003',
  '{"synthetic":true,"patientName":"QA-012 합성 환자","guardianName":"QA-012 합성 보호자","orderDisplayName":"QA-012 합성 CBC","requestingVetName":"QA-012 요청자"}'::jsonb
);

insert into public.hospital_schedule_weeks (
  id,
  workspace_id,
  week_start,
  publication_state,
  published_at,
  published_by_user_id
)
values (
  '5a120000-0000-4000-8000-000000000007',
  'workspace-clair-cheongdam',
  '2099-12-28',
  'published',
  now(),
  '49110000-0000-4000-8000-000000000001'
);

insert into public.hospital_schedule_shifts (
  id,
  workspace_id,
  schedule_week_id,
  staff_profile_id,
  shift_date,
  start_minutes,
  end_minutes,
  shift_kind,
  work_label,
  location_label,
  note,
  created_by_user_id
)
select
  '5a120000-0000-4000-8000-000000000008',
  'workspace-clair-cheongdam',
  '5a120000-0000-4000-8000-000000000007',
  profile.id,
  '2099-12-29',
  540,
  1080,
  'clinical',
  'QA-012 합성 진료',
  'QA-012 진료실',
  'Staff Profile V2 schedule readback',
  '49110000-0000-4000-8000-000000000001'
from public.hospital_schedule_staff_profiles profile
where profile.workspace_id = 'workspace-clair-cheongdam'
  and profile.membership_id = '49111000-0000-4000-8000-000000000003';

do $$
begin
  if not exists (
    select 1
      from public.hospital_schedule_shifts
     where id = '5a120000-0000-4000-8000-000000000008'
  ) then
    raise exception 'synthetic_schedule_profile_missing';
  end if;
end;
$$;

insert into public.workspace_member_activity (
  workspace_id,
  user_id,
  last_seen_at,
  updated_at
)
values (
  'workspace-clair-cheongdam',
  '49110000-0000-4000-8000-000000000003',
  now(),
  now()
)
on conflict (workspace_id, user_id) do update
set last_seen_at = excluded.last_seen_at,
    updated_at = excluded.updated_at;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '49110000-0000-4000-8000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_expected timestamptz;
  v_result jsonb;
begin
  select message.updated_at
    into v_expected
    from public.workspace_member_status_messages message
   where message.workspace_id = 'workspace-clair-cheongdam'
     and message.user_id = '49110000-0000-4000-8000-000000000003';

  v_result := public.clair_set_my_workspace_status_message(
    'workspace-clair-cheongdam',
    '  QA-012 합성 상태 메시지  ',
    v_expected
  );

  if v_result->>'message' <> 'QA-012 합성 상태 메시지' then
    raise exception 'self_status_message_normalization_failed: %', v_result;
  end if;
end;
$$;

do $$
declare
  v_snapshot jsonb;
begin
  select public.hospital_schedule_read_snapshot(
    'workspace-clair-cheongdam',
    '2099-12-28'
  ) into v_snapshot;

  if v_snapshot #>> '{week,publicationState}' <> 'published'
     or not (v_snapshot::text like '%5a120000-0000-4000-8000-000000000008%') then
    raise exception 'same_workspace_schedule_readback_failed: %', v_snapshot;
  end if;

  if not exists (
    select 1
      from public.order_fulfillment_work_items item
     where item.id = '5a120000-0000-4000-8000-000000000006'
       and item.assigned_to_user_id = '49110000-0000-4000-8000-000000000003'
  ) then
    raise exception 'self_assigned_work_readback_failed';
  end if;

  if not exists (
    select 1
      from public.workspace_member_activity activity
     where activity.workspace_id = 'workspace-clair-cheongdam'
       and activity.user_id = '49110000-0000-4000-8000-000000000003'
  ) then
    raise exception 'self_activity_readback_failed';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '49110000-0000-4000-8000-000000000004',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_updated integer;
begin
  if not exists (
    select 1
      from public.workspace_member_status_messages message
     where message.workspace_id = 'workspace-clair-cheongdam'
       and message.user_id = '49110000-0000-4000-8000-000000000003'
       and message.status_message = 'QA-012 합성 상태 메시지'
  ) then
    raise exception 'peer_status_message_readback_failed';
  end if;

  if not exists (
    select 1
      from public.order_fulfillment_work_items item
     where item.id = '5a120000-0000-4000-8000-000000000006'
  ) then
    raise exception 'peer_assigned_work_readback_failed';
  end if;

  update public.workspace_member_status_messages message
     set status_message = 'QA-012 타인 수정 시도'
   where message.workspace_id = 'workspace-clair-cheongdam'
     and message.user_id = '49110000-0000-4000-8000-000000000003';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'peer_status_message_write_unexpectedly_succeeded';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from public.workspace_member_status_messages message
   where message.workspace_id = 'workspace-clair-cheongdam';
  if v_count <> 0 then
    raise exception 'cross_workspace_status_read_unexpectedly_succeeded';
  end if;

  select count(*)
    into v_count
    from public.workspace_member_activity activity
   where activity.workspace_id = 'workspace-clair-cheongdam';
  if v_count <> 0 then
    raise exception 'cross_workspace_activity_read_unexpectedly_succeeded';
  end if;

  select count(*)
    into v_count
    from public.order_fulfillment_work_items item
   where item.workspace_id = 'workspace-clair-cheongdam';
  if v_count <> 0 then
    raise exception 'cross_workspace_work_read_unexpectedly_succeeded';
  end if;

  begin
    perform public.hospital_schedule_read_snapshot(
      'workspace-clair-cheongdam',
      '2099-12-28'
    );
    raise exception 'cross_workspace_schedule_read_unexpectedly_succeeded';
  exception
    when sqlstate '42501' then null;
  end;
end;
$$;

reset role;
rollback;

do $$
begin
  if exists (
    select 1 from public.guardians
     where id = '5a120000-0000-4000-8000-000000000001'
    union all
    select 1 from public.patients
     where id = '5a120000-0000-4000-8000-000000000002'
    union all
    select 1 from public.encounters
     where id = '5a120000-0000-4000-8000-000000000004'
    union all
    select 1 from public.orders
     where id = '5a120000-0000-4000-8000-000000000005'
    union all
    select 1 from public.order_fulfillment_work_items
     where id = '5a120000-0000-4000-8000-000000000006'
    union all
    select 1 from public.hospital_schedule_weeks
     where id = '5a120000-0000-4000-8000-000000000007'
    union all
    select 1 from public.hospital_schedule_shifts
     where id = '5a120000-0000-4000-8000-000000000008'
  ) then
    raise exception 'staff_profile_v2_release_replay_cleanup_failed';
  end if;
end;
$$;

select jsonb_build_object(
  'assignedWorkReadback', true,
  'crossWorkspaceDenied', true,
  'noResidualRows', true,
  'scheduleReadback', true,
  'sameWorkspaceRead', true,
  'selfStatusWrite', true,
  'otherStatusWriteDenied', true,
  'transactionRollback', true
) as staff_profile_v2_release_replay;
