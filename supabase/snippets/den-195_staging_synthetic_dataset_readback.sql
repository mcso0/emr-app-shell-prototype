-- DEN-195 staging synthetic dataset readback.
-- Read-only verification for clair-emr-staging / qmerxgzrwaaahpkhjqlc.
-- Scope: workspace clair-demo, DEN-194 synthetic fixture IDs only.

with expected_counts(metric, expected_count) as (
  values
    ('guardians', 12),
    ('patients', 15),
    ('patient_guardians', 15),
    ('consents', 5),
    ('appointments', 3),
    ('encounters', 5),
    ('waiting_queue_entries', 5),
    ('service_categories', 2),
    ('service_items', 9),
    ('service_item_prices', 9),
    ('soap_notes', 5),
    ('diagnoses', 5),
    ('order_groups', 5),
    ('orders', 11),
    ('order_events', 10),
    ('invoices', 5),
    ('invoice_lines', 11),
    ('payments', 2),
    ('audit_events', 5),
    ('patient_staff_assignments', 5)
),
actual_counts as (
  select 'guardians' as metric, count(*)::int as actual_count
  from public.guardians
  where workspace_id = 'clair-demo' and guardian_code like 'DEN-194-G-%'
  union all
  select 'patients', count(*)::int
  from public.patients
  where workspace_id = 'clair-demo' and patient_no like 'P-DEN194-%'
  union all
  select 'patient_guardians', count(*)::int
  from public.patient_guardians
  where workspace_id = 'clair-demo' and id::text like '19422000-%'
  union all
  select 'consents', count(*)::int
  from public.consents
  where workspace_id = 'clair-demo' and id::text like '19423000-%'
  union all
  select 'appointments', count(*)::int
  from public.appointments
  where workspace_id = 'clair-demo' and id::text like '19424000-%'
  union all
  select 'encounters', count(*)::int
  from public.encounters
  where workspace_id = 'clair-demo' and encounter_no like 'E-DEN194-%'
  union all
  select 'waiting_queue_entries', count(*)::int
  from public.waiting_queue_entries
  where workspace_id = 'clair-demo' and id::text like '19427000-%'
  union all
  select 'service_categories', count(*)::int
  from public.service_categories
  where workspace_id = 'clair-demo' and id::text like '19428000-%'
  union all
  select 'service_items', count(*)::int
  from public.service_items
  where workspace_id = 'clair-demo' and id::text like '19429000-%'
  union all
  select 'service_item_prices', count(*)::int
  from public.service_item_prices
  where workspace_id = 'clair-demo' and id::text like '19429100-%'
  union all
  select 'soap_notes', count(*)::int
  from public.soap_notes
  where workspace_id = 'clair-demo' and id::text like '19429200-%'
  union all
  select 'diagnoses', count(*)::int
  from public.diagnoses
  where workspace_id = 'clair-demo' and id::text like '19429300-%'
  union all
  select 'order_groups', count(*)::int
  from public.order_groups
  where workspace_id = 'clair-demo' and id::text like '19429400-%'
  union all
  select 'orders', count(*)::int
  from public.orders
  where workspace_id = 'clair-demo' and id::text like '19429500-%'
  union all
  select 'order_events', count(*)::int
  from public.order_events
  where workspace_id = 'clair-demo' and id::text like '19429800-%'
  union all
  select 'invoices', count(*)::int
  from public.invoices
  where workspace_id = 'clair-demo' and invoice_no like 'INV-DEN194-%'
  union all
  select 'invoice_lines', count(*)::int
  from public.invoice_lines
  where workspace_id = 'clair-demo' and id::text like '19429700-%'
  union all
  select 'payments', count(*)::int
  from public.payments
  where workspace_id = 'clair-demo' and id::text like '19429900-%'
  union all
  select 'audit_events', count(*)::int
  from public.audit_events
  where workspace_id = 'clair-demo' and id like 'den-194-audit-%'
  union all
  select 'patient_staff_assignments', count(*)::int
  from public.patient_staff_assignments
  where workspace_id = 'clair-demo' and id::text like '19432000-%'
),
staff_roles as (
  select role, count(*)::int as actual_count
  from public.user_memberships um
  cross join lateral unnest(um.roles) as role
  where um.workspace_id = 'clair-demo'
    and um.status = 'active'
    and role in ('hospital_admin', 'vet', 'technician', 'front_desk')
  group by role
),
expected_staff(role, expected_count) as (
  values
    ('hospital_admin', 1),
    ('vet', 3),
    ('technician', 4),
    ('front_desk', 3)
),
scenario_audit as (
  select metadata->>'scenario_code' as scenario_code, count(*)::int as actual_count
  from public.audit_events
  where workspace_id = 'clair-demo' and id like 'den-194-audit-%'
  group by metadata->>'scenario_code'
),
expected_scenarios(scenario_code) as (
  values
    ('kong-vomit'),
    ('nabi-urinary'),
    ('bori-allergy'),
    ('mango-wellness'),
    ('choco-rehab')
),
invoice_integrity as (
  select
    i.invoice_no,
    i.total_amount,
    coalesce(sum((il.quantity * il.unit_price) - il.discount_amount), 0)::numeric(12, 2) as line_total
  from public.invoices i
  left join public.invoice_lines il
    on il.invoice_id = i.id and il.workspace_id = i.workspace_id
  where i.workspace_id = 'clair-demo' and i.invoice_no like 'INV-DEN194-%'
  group by i.id, i.invoice_no, i.total_amount
),
duplicate_checks as (
  select 'guardian_code' as key_name, count(*)::int as duplicate_groups
  from (
    select guardian_code
    from public.guardians
    where workspace_id = 'clair-demo' and guardian_code like 'DEN-194-G-%'
    group by guardian_code
    having count(*) > 1
  ) d
  union all
  select 'patient_no', count(*)::int
  from (
    select patient_no
    from public.patients
    where workspace_id = 'clair-demo' and patient_no like 'P-DEN194-%'
    group by patient_no
    having count(*) > 1
  ) d
  union all
  select 'invoice_no', count(*)::int
  from (
    select invoice_no
    from public.invoices
    where workspace_id = 'clair-demo' and invoice_no like 'INV-DEN194-%'
    group by invoice_no
    having count(*) > 1
  ) d
),
synthetic_guard as (
  select 'guardian_names' as check_name, count(*)::int as violation_count
  from public.guardians
  where workspace_id = 'clair-demo'
    and guardian_code like 'DEN-194-G-%'
    and name not like 'DEN-194 Guardian %'
  union all
  select 'guardian_emails', count(*)::int
  from public.guardians
  where workspace_id = 'clair-demo'
    and guardian_code like 'DEN-194-G-%'
    and email not like '%@example.test'
  union all
  select 'patient_names', count(*)::int
  from public.patients
  where workspace_id = 'clair-demo'
    and patient_no like 'P-DEN194-%'
    and name not like '%Synthetic%'
)
select jsonb_build_object(
  'workspaceDisplayName', (select display_name from public.workspaces where id = 'clair-demo'),
  'countChecks', (
    select jsonb_agg(
      jsonb_build_object(
        'metric', e.metric,
        'expected', e.expected_count,
        'actual', coalesce(a.actual_count, 0),
        'pass', coalesce(a.actual_count, 0) = e.expected_count
      )
      order by e.metric
    )
    from expected_counts e
    left join actual_counts a on a.metric = e.metric
  ),
  'staffChecks', (
    select jsonb_agg(
      jsonb_build_object(
        'role', e.role,
        'expected', e.expected_count,
        'actual', coalesce(s.actual_count, 0),
        'pass', coalesce(s.actual_count, 0) = e.expected_count
      )
      order by e.role
    )
    from expected_staff e
    left join staff_roles s on s.role = e.role
  ),
  'scenarioChecks', (
    select jsonb_agg(
      jsonb_build_object(
        'scenarioCode', e.scenario_code,
        'auditEvents', coalesce(s.actual_count, 0),
        'pass', coalesce(s.actual_count, 0) = 1
      )
      order by e.scenario_code
    )
    from expected_scenarios e
    left join scenario_audit s on s.scenario_code = e.scenario_code
  ),
  'invoiceIntegrity', (
    select jsonb_agg(
      jsonb_build_object(
        'invoiceNo', invoice_no,
        'totalAmount', total_amount,
        'lineTotal', line_total,
        'pass', total_amount = line_total
      )
      order by invoice_no
    )
    from invoice_integrity
  ),
  'duplicateChecks', (
    select jsonb_agg(
      jsonb_build_object(
        'key', key_name,
        'duplicateGroups', duplicate_groups,
        'pass', duplicate_groups = 0
      )
      order by key_name
    )
    from duplicate_checks
  ),
  'syntheticGuardChecks', (
    select jsonb_agg(
      jsonb_build_object(
        'check', check_name,
        'violations', violation_count,
        'pass', violation_count = 0
      )
      order by check_name
    )
    from synthetic_guard
  )
) as den195_readback_contract;
