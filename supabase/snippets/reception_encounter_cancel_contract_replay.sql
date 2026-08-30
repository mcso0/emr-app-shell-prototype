-- RECEPTION-LIVE-PR-018 rollback-only synthetic verification.
-- Run after the migration against the linked synthetic/demo Supabase project.
-- The script creates a dedicated encounter and queue row, exercises the RPC as
-- an authenticated hospital admin, verifies both rows, and always rolls back.

begin;

create temporary table reception_cancel_probe_context (
  workspace_id text not null,
  actor_user_id uuid not null,
  denied_actor_user_id uuid not null,
  inactive_workspace_id text,
  inactive_actor_user_id uuid,
  foreign_workspace_id text not null,
  patient_id uuid not null,
  guardian_id uuid,
  encounter_id uuid not null,
  queue_entry_id uuid not null
) on commit drop;

do $$
declare
  v_workspace_id text;
  v_actor_user_id uuid;
  v_denied_actor_user_id uuid;
  v_inactive_workspace_id text;
  v_inactive_actor_user_id uuid;
  v_foreign_workspace_id text;
  v_patient_id uuid;
  v_guardian_id uuid;
  v_encounter_id uuid := gen_random_uuid();
  v_queue_entry_id uuid := gen_random_uuid();
  v_permission_role_count integer;
begin
  select m.workspace_id, m.user_id, p.id
    into v_workspace_id, v_actor_user_id, v_patient_id
  from public.user_memberships m
  join public.users u on u.id = m.user_id
  join public.patients p on p.workspace_id = m.workspace_id
  where m.workspace_id in ('workspace-clair-cheongdam', 'clair-demo')
    and m.status = 'active'
    and u.status = 'active'
    and m.roles @> array['hospital_admin']::text[]
    and p.status <> 'archived'
  order by
    case when m.workspace_id = 'workspace-clair-cheongdam' then 0 else 1 end,
    m.created_at,
    m.id,
    p.created_at,
    p.id
  limit 1;

  select pg.guardian_id
    into v_guardian_id
  from public.patient_guardians pg
  where pg.workspace_id = v_workspace_id
    and pg.patient_id = v_patient_id
  order by pg.is_primary desc, pg.created_at, pg.guardian_id
  limit 1;

  select m.user_id
    into v_denied_actor_user_id
  from public.user_memberships m
  join public.users u on u.id = m.user_id
  where m.workspace_id = v_workspace_id
    and m.status = 'active'
    and u.status = 'active'
    and m.roles && array['vet', 'technician']::text[]
    and not (m.roles && array['hospital_admin', 'front_desk']::text[])
  order by m.created_at, m.id
  limit 1;

  select m.workspace_id, m.user_id
    into v_inactive_workspace_id, v_inactive_actor_user_id
  from public.user_memberships m
  join public.users u on u.id = m.user_id
  where m.status <> 'active'
    or u.status <> 'active'
  order by
    case when m.workspace_id = v_workspace_id then 0 else 1 end,
    m.created_at,
    m.id
  limit 1;

  select w.id
    into v_foreign_workspace_id
  from public.workspaces w
  where w.id <> v_workspace_id
    and not exists (
      select 1
      from public.user_memberships m
      where m.workspace_id = w.id
        and m.user_id = v_actor_user_id
        and m.status = 'active'
    )
  order by w.id
  limit 1;

  if v_actor_user_id is null
     or v_denied_actor_user_id is null
     or v_foreign_workspace_id is null
     or v_patient_id is null then
    raise exception 'probe_prerequisite_missing';
  end if;

  insert into reception_cancel_probe_context (
    workspace_id,
    actor_user_id,
    denied_actor_user_id,
    inactive_workspace_id,
    inactive_actor_user_id,
    foreign_workspace_id,
    patient_id,
    guardian_id,
    encounter_id,
    queue_entry_id
  ) values (
    v_workspace_id,
    v_actor_user_id,
    v_denied_actor_user_id,
    v_inactive_workspace_id,
    v_inactive_actor_user_id,
    v_foreign_workspace_id,
    v_patient_id,
    v_guardian_id,
    v_encounter_id,
    v_queue_entry_id
  );

  update public.workspace_permission_roles r
  set permissions = pg_catalog.jsonb_set(
    r.permissions,
    '{allowed}',
    (r.permissions -> 'allowed') - 'reception:update' - '*'
  )
  from public.workspace_membership_permission_role_assignments a
  join public.user_memberships m
    on m.workspace_id = a.workspace_id
   and m.id = a.membership_id
  where a.workspace_id = v_workspace_id
    and a.permission_role_id = r.id
    and m.user_id = v_denied_actor_user_id;

  get diagnostics v_permission_role_count = row_count;
  if v_permission_role_count <> 1 then
    raise exception 'permission_denial_probe_assignment_missing';
  end if;

  insert into public.encounters (
    id,
    workspace_id,
    patient_id,
    guardian_id,
    encounter_no,
    reception_type,
    chief_complaint,
    visit_purpose,
    status,
    checked_in_at,
    checked_in_by_user_id
  ) values (
    v_encounter_id,
    v_workspace_id,
    v_patient_id,
    v_guardian_id,
    'RECEPTION-CANCEL-PROBE-' || pg_catalog.left(v_encounter_id::text, 8),
    'walk_in',
    'rollback-only reception cancel probe',
    'rollback-only reception cancel probe',
    'waiting',
    pg_catalog.now(),
    v_actor_user_id
  );

  insert into public.waiting_queue_entries (
    id,
    workspace_id,
    encounter_id,
    queue_type,
    status,
    priority,
    sort_order,
    entered_at
  ) values (
    v_queue_entry_id,
    v_workspace_id,
    v_encounter_id,
    'consultation',
    'waiting',
    'normal',
    999999,
    pg_catalog.now()
  );
end;
$$;

create function pg_temp.reception_cancel_probe_fail_audit()
returns trigger
language plpgsql
as $$
begin
  if new.event_type = 'reception.encounter_cancelled' then
    raise exception 'probe_audit_failure';
  end if;
  return new;
end;
$$;

create trigger reception_cancel_probe_fail_audit
before insert on public.audit_events
for each row execute function pg_temp.reception_cancel_probe_fail_audit();

grant select on reception_cancel_probe_context to authenticated;
grant execute on function pg_temp.reception_cancel_probe_fail_audit() to authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select actor_user_id::text from reception_cancel_probe_context),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object(
      'sub', actor_user_id::text,
      'role', 'authenticated'
    )::text
    from reception_cancel_probe_context
  ),
  true
);

set local role authenticated;

do $$
declare
  v_context reception_cancel_probe_context%rowtype;
begin
  select * into strict v_context from reception_cancel_probe_context;

  if not has_function_privilege(
    'authenticated',
    'public.clair_cancel_reception_encounter(text,text,text,text)',
    'execute'
  ) then
    raise exception 'four_argument_execute_missing';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.clair_cancel_reception_encounter(text,text,text)',
    'execute'
  ) then
    raise exception 'legacy_three_argument_execute_still_granted';
  end if;

  if has_function_privilege(
    'anon',
    'public.clair_cancel_reception_encounter(text,text,text,text)',
    'execute'
  ) then
    raise exception 'anonymous_four_argument_execute_granted';
  end if;

  begin
    perform public.clair_cancel_reception_encounter(
      v_context.workspace_id,
      gen_random_uuid()::text,
      v_context.encounter_id::text,
      'actor mismatch probe'
    );
    raise exception 'actor_mismatch_was_not_denied';
  exception
    when insufficient_privilege then
      if position('actor_mismatch' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', v_context.denied_actor_user_id::text, true);
  begin
    perform public.clair_cancel_reception_encounter(
      v_context.workspace_id,
      v_context.denied_actor_user_id::text,
      v_context.encounter_id::text,
      'permission denial probe'
    );
    raise exception 'permission_missing_was_not_denied';
  exception
    when insufficient_privilege then
      if position('permission_missing' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  if v_context.inactive_actor_user_id is not null then
    perform set_config('request.jwt.claim.sub', v_context.inactive_actor_user_id::text, true);
    begin
      perform public.clair_cancel_reception_encounter(
        v_context.inactive_workspace_id,
        v_context.inactive_actor_user_id::text,
        v_context.encounter_id::text,
        'inactive membership probe'
      );
      raise exception 'inactive_membership_was_not_denied';
    exception
      when insufficient_privilege then
        if position('workspace_membership_missing' in sqlerrm) = 0 then
          raise;
        end if;
    end;
  end if;

  perform set_config('request.jwt.claim.sub', v_context.actor_user_id::text, true);
  begin
    perform public.clair_cancel_reception_encounter(
      v_context.foreign_workspace_id,
      v_context.actor_user_id::text,
      v_context.encounter_id::text,
      'cross workspace probe'
    );
    raise exception 'cross_workspace_call_was_not_denied';
  exception
    when insufficient_privilege then
      if position('workspace_membership_missing' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  begin
    perform public.clair_cancel_reception_encounter(
      v_context.workspace_id,
      v_context.actor_user_id::text,
      v_context.encounter_id::text,
      'rollback-only reception cancel probe'
    );
    raise exception 'audit_failure_was_not_propagated';
  exception
    when others then
      if position('probe_audit_failure' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end;
$$;

reset role;

do $$
declare
  v_context reception_cancel_probe_context%rowtype;
begin
  select * into strict v_context from reception_cancel_probe_context;

  if not exists (
    select 1
    from public.encounters e
    where e.id = v_context.encounter_id
      and e.workspace_id = v_context.workspace_id
      and e.status = 'waiting'
      and e.cancellation_reason is null
  ) then
    raise exception 'audit_failure_did_not_roll_back_encounter';
  end if;

  if not exists (
    select 1
    from public.waiting_queue_entries q
    where q.id = v_context.queue_entry_id
      and q.workspace_id = v_context.workspace_id
      and q.status = 'waiting'
      and q.finished_at is null
  ) then
    raise exception 'audit_failure_did_not_roll_back_queue';
  end if;

  if exists (
    select 1
    from public.audit_events a
    where a.workspace_id = v_context.workspace_id
      and a.encounter_id = v_context.encounter_id
      and a.event_type = 'reception.encounter_cancelled'
  ) then
    raise exception 'failed_audit_event_was_persisted';
  end if;
end;
$$;

drop trigger reception_cancel_probe_fail_audit on public.audit_events;
drop function pg_temp.reception_cancel_probe_fail_audit();

set local role authenticated;

do $$
declare
  v_context reception_cancel_probe_context%rowtype;
  v_result jsonb;
begin
  select * into strict v_context from reception_cancel_probe_context;

  v_result := public.clair_cancel_reception_encounter(
    v_context.workspace_id,
    v_context.actor_user_id::text,
    v_context.encounter_id::text,
    'rollback-only reception cancel probe'
  );

  if v_result #>> '{encounter,status}' <> 'cancelled'
     or v_result #>> '{encounter,cancellationReason}' <> 'rollback-only reception cancel probe'
     or v_result #>> '{queueEntry,status}' <> 'cancelled'
     or nullif(v_result #>> '{queueEntry,finishedAt}', '') is null
     or v_result ->> 'auditHandledBy' <> 'database_transaction'
     or nullif(v_result ->> 'auditEventId', '') is null then
    raise exception 'cancel_result_mismatch';
  end if;
end;
$$;

reset role;

do $$
declare
  v_context reception_cancel_probe_context%rowtype;
begin
  select * into strict v_context from reception_cancel_probe_context;

  if not exists (
    select 1
    from public.encounters e
    where e.id = v_context.encounter_id
      and e.workspace_id = v_context.workspace_id
      and e.status = 'cancelled'
      and e.cancellation_reason = 'rollback-only reception cancel probe'
  ) then
    raise exception 'encounter_cancel_readback_failed';
  end if;

  if not exists (
    select 1
    from public.waiting_queue_entries q
    where q.id = v_context.queue_entry_id
      and q.workspace_id = v_context.workspace_id
      and q.status = 'cancelled'
      and q.finished_at is not null
  ) then
    raise exception 'queue_cancel_readback_failed';
  end if;

  if not exists (
    select 1
    from public.audit_events a
    where a.workspace_id = v_context.workspace_id
      and a.encounter_id = v_context.encounter_id
      and a.event_type = 'reception.encounter_cancelled'
      and a.reason = 'rollback-only reception cancel probe'
      and a.before_snapshot @> '{"status":"waiting","queueStatus":"waiting"}'::jsonb
      and a.after_snapshot @> '{"status":"cancelled","queueStatus":"cancelled"}'::jsonb
      and a.metadata @> '{"source":"reception-encounter-cancel-rpc"}'::jsonb
  ) then
    raise exception 'atomic_audit_readback_failed';
  end if;
end;
$$;

rollback;
