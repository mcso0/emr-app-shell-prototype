-- DEMO-DATA-PR-003. Remove feature-development leftovers from the Cheongdam
-- synthetic workspace before realistic history is replayed.
--
-- Approved by 승욱 on 2026-11-28: every encounter and its dependent records
-- (including the two signed test charts), appointments, checkout sessions,
-- notifications, audit events, and patients/guardians registered outside the
-- CD-P-* / CD-G-* seed. Seed patients, guardians, staff, catalogs, hospital
-- settings and schedules stay.
--
-- HOW TO RUN (Supabase SQL editor, as postgres):
--   1. Dry run: keep `dry constant boolean := true`. The block ends with the
--      error "PURGE_ROLLBACK {...}" that lists row counts. Nothing is saved.
--      `orphans` must be {}.
--   2. Real run: change it to `false`. The block commits only when no orphan
--      reference remains; otherwise it rolls back with the same message.
-- Deleted rows cannot be restored. Storage files (chart and lab attachments)
-- are not removed by SQL; clear them through the Storage API or dashboard.

do $purge$
declare
  w constant text := 'workspace-clair-cheongdam';
  dry constant boolean := true;
  t regclass; n bigint; total bigint := 0; counts jsonb := '{}'::jsonb; orphans jsonb := '{}'::jsonb;
  extra_patients uuid[]; extra_guardians uuid[]; purged regclass[] := '{}';
  fk record; q text;
begin
  select coalesce(array_agg(id), '{}') into extra_patients from public.patients where workspace_id=w and patient_no not like 'CD-P-%';
  select coalesce(array_agg(id), '{}') into extra_guardians from public.guardians where workspace_id=w and coalesce(guardian_code,'') not like 'CD-G-%';
  -- Completed tasks, audit rows and signed charts are immutable by trigger, and
  -- several child FKs do not cascade. Triggers are off only inside this block.
  set local session_replication_role = replica;

  -- 1. chart content stamps have no workspace column
  delete from private.chart_content_edits c using public.soap_notes s where s.id = c.chart_id and s.workspace_id = w;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('private.chart_content_edits', n);

  -- 2. everything that hangs off encounters, plus loose transactional tables
  for t in
    with recursive reach(tbl) as (
      select 'public.encounters'::regclass
      union
      select c.conrelid::regclass from pg_constraint c join reach r on c.confrelid = r.tbl where c.contype='f')
    select tbl from reach where exists(select 1 from pg_attribute a where a.attrelid=tbl and a.attname='workspace_id' and not a.attisdropped)
    union
    select x::regclass from unnest(array[
      'public.appointment_change_logs','public.appointment_staff_assignments','public.appointments','public.billing_checkout_sessions',
      'public.notification_events','public.notification_user_states',
      'private.confirmed_order_edit_commands','private.confirmed_order_edit_scope','private.fulfillment_instruction_receipts',
      'private.fulfillment_instruction_completion_scope','private.fulfillment_instruction_reopen_scope',
      'private.order_clinical_edit_revisions','private.order_financial_edits','private.order_partial_work_notes',
      'private.clair_chart_copy_pending','private.clair_chart_export_receipts']) x
  loop
    execute format('delete from %s where workspace_id = %L', t, w);
    get diagnostics n = row_count;
    purged := purged || t;
    if n > 0 then counts := counts || jsonb_build_object(t::text, n); total := total + n; end if;
  end loop;

  -- 3. test-registered patients and guardians (seed CD-P-* / CD-G-* stay)
  foreach t in array array['public.patient_guardians','public.consents','public.patient_staff_assignments']::regclass[] loop
    execute format('delete from %s where workspace_id = %L and patient_id = any($1)', t, w) using extra_patients;
    get diagnostics n = row_count; if n > 0 then counts := counts || jsonb_build_object(t::text||' (extra patients)', n); end if;
  end loop;
  foreach t in array array['public.patient_guardians','public.consents','public.guardian_duplicate_overrides','public.guardian_referral_sources']::regclass[] loop
    execute format('delete from %s where workspace_id = %L and guardian_id = any($1)', t, w) using extra_guardians;
    get diagnostics n = row_count; if n > 0 then counts := counts || jsonb_build_object(t::text||' (extra guardians)', n); end if;
  end loop;
  delete from public.patients where workspace_id = w and id = any(extra_patients);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('public.patients (extra)', n);
  delete from public.guardians where workspace_id = w and id = any(extra_guardians);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('public.guardians (extra)', n);
  purged := purged || array['public.patients','public.guardians']::regclass[];

  set local session_replication_role = origin;

  -- 4. no row anywhere may still point at something that was deleted
  for fk in
    -- Explicit "as": a bare alias such as notnull is read as the NOTNULL operator.
    select c.oid, c.conname, c.conrelid::regclass as child, c.confrelid::regclass as parent,
      (select string_agg(format('c.%I', a.attname), ', ' order by k.ord) from unnest(c.conkey) with ordinality k(att, ord) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.att) as ccols,
      (select string_agg(format('p.%I', a.attname), ', ' order by k.ord) from unnest(c.confkey) with ordinality k(att, ord) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.att) as pcols,
      (select string_agg(format('c.%I is not null', a.attname), ' and ') from unnest(c.conkey) k(att) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.att) as filled
    from pg_constraint c
    where c.contype='f' and c.confrelid = any(purged)
  loop
    q := format('select count(*) from %s c where %s and not exists (select 1 from %s p where (%s) = (%s))', fk.child, fk.filled, fk.parent, fk.pcols, fk.ccols);
    execute q into n;
    if n > 0 then orphans := orphans || jsonb_build_object(fk.child::text||'.'||fk.conname, n); end if;
  end loop;

  if dry or orphans <> '{}'::jsonb then
    raise exception 'PURGE_ROLLBACK %', jsonb_build_object('dry', dry, 'encounterScopeTotal', total, 'extraPatients', cardinality(extra_patients), 'extraGuardians', cardinality(extra_guardians), 'orphans', orphans, 'counts', counts)::text;
  end if;
end;
$purge$;

-- After the real run, this should return zeros (patients 25, guardians 25).
select
  (select count(*) from public.encounters where workspace_id = 'workspace-clair-cheongdam') as encounters,
  (select count(*) from public.soap_notes where workspace_id = 'workspace-clair-cheongdam') as charts,
  (select count(*) from public.orders where workspace_id = 'workspace-clair-cheongdam') as orders,
  (select count(*) from public.invoices where workspace_id = 'workspace-clair-cheongdam') as invoices,
  (select count(*) from public.notification_events where workspace_id = 'workspace-clair-cheongdam') as notifications,
  (select count(*) from public.audit_events where workspace_id = 'workspace-clair-cheongdam') as audit_events,
  (select count(*) from public.patients where workspace_id = 'workspace-clair-cheongdam') as patients,
  (select count(*) from public.guardians where workspace_id = 'workspace-clair-cheongdam') as guardians;
