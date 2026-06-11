-- Demo DB PR 1 seed inventory readback.
-- Read-only local/dev verification for workspace clair-demo.
-- Scope: synthetic demo data only. No remote, production, or real hospital data.

with inventory(
  sort_order,
  area,
  expected_min,
  desired_min,
  policy,
  evidence_source,
  demo_workflow,
  gap_message
) as (
  values
    (10, 'auth users / app users', 11, 11, 'baseline_required', 'auth.users + public.users + public.user_memberships', 'Demo login for hospital_admin, vet, technician, and front_desk roles.', 'Expected deterministic Supabase Auth users joined to app users and active clair-demo memberships.'),
    (20, 'workspace', 1, 1, 'baseline_required', 'public.workspaces', 'Select the CLAiR demo hospital workspace.', 'Expected workspace id clair-demo.'),
    (30, 'memberships', 11, 11, 'baseline_required', 'public.user_memberships', 'Role-scoped demo users enter the same hospital workspace.', 'Expected active clair-demo memberships for admin, veterinarians, technicians, and front desk users.'),
    (40, 'permission policies', 4, 4, 'baseline_required', 'public.permission_policies', 'Permission matrix seed for demo route and server-boundary checks.', 'Expected role permission policy rows for canonical MVP roles.'),
    (50, 'guardians', 12, 12, 'baseline_required', 'public.guardians', 'Reception/customer lookup and billing guardian context.', 'Expected DEN-194 synthetic guardian rows.'),
    (60, 'patients', 15, 15, 'baseline_required', 'public.patients', 'Patient lookup, chart context, and scenario continuity.', 'Expected DEN-194 synthetic patient rows.'),
    (70, 'patient_guardians', 15, 15, 'baseline_required', 'public.patient_guardians', 'Guardian-patient relationship readback.', 'Expected DEN-194 synthetic guardian-patient relationship rows.'),
    (80, 'appointments', 3, 3, 'baseline_required', 'public.appointments', 'Daily reception schedule.', 'Expected DEN-194 appointment rows.'),
    (90, 'encounters', 5, 5, 'baseline_required', 'public.encounters', 'Outpatient visit chart entry points.', 'Expected DEN-194 encounter rows.'),
    (100, 'waiting_queue_entries', 5, 5, 'baseline_required', 'public.waiting_queue_entries', 'Reception queue and status handoff.', 'Expected DEN-194 waiting queue rows.'),
    (110, 'SOAP notes', 5, 5, 'baseline_required', 'public.soap_notes', 'Chart SOAP readback for representative visits.', 'Expected DEN-194 SOAP note rows.'),
    (120, 'diagnoses', 5, 5, 'baseline_required', 'public.diagnoses', 'Chart assessment and billing context.', 'Expected DEN-194 diagnosis rows.'),
    (130, 'service categories', 2, 6, 'baseline_required', 'public.service_categories', 'Service catalog grouping for chart orders and billing.', 'Expected DEN-194 service category rows; broader catalog groups remain a later demo seed expansion.'),
    (140, 'service items', 9, 20, 'baseline_required', 'public.service_items + public.service_item_prices', 'Orderable and billable service items used by chart orders.', 'Expected DEN-194 service item and price rows.'),
    (150, 'order catalog items', 9, 20, 'baseline_required', 'public.order_catalog_items', 'Hospital-admin Order management and chart catalog search.', 'Expected DEMO-DB-PR-002 order catalog rows for lab, imaging, treatment, dispensing, wellness, and rehab.'),
    (160, 'order sets', 2, 3, 'baseline_required', 'public.order_sets', 'Hospital-admin Order set demo and set-to-chart application.', 'Expected DEMO-DB-PR-002 compact order sets for kong-vomit and mango-wellness.'),
    (170, 'order_set_items', 5, 8, 'baseline_required', 'public.order_set_items', 'Included-order rows for compact set expansion.', 'Expected DEMO-DB-PR-002 included-order rows linked to seeded catalog items.'),
    (180, 'order groups', 5, 5, 'baseline_required', 'public.order_groups', 'Encounter-owned grouped chart order confirmation.', 'Expected DEN-194 order group rows.'),
    (190, 'orders', 11, 11, 'baseline_required', 'public.orders', 'Chart orders across lab, imaging, treatment, and dispensing.', 'Expected DEN-194 order rows.'),
    (200, 'order events', 10, 10, 'baseline_required', 'public.order_events', 'Order completion/result evidence.', 'Expected DEN-194 order event rows.'),
    (210, 'order_fulfillment_work_items', 11, 11, 'baseline_required', 'public.order_fulfillment_work_items', 'Lab/imaging/dispensing/treatment task queues after chart order confirmation.', 'Expected DEMO-DB-PR-003 work items mapped one-to-one to DEN-194 seeded chart orders.'),
    (215, 'lab_test_categories', 2, 2, 'baseline_required', 'public.lab_test_categories', 'Structured lab result-sheet category grouping for CBC and urinalysis.', 'Expected DEMO-DB-PR-004 Hematology and Urinalysis categories.'),
    (216, 'lab_test_items', 8, 8, 'baseline_required', 'public.lab_test_items', 'Structured CBC and urinalysis result entry fields.', 'Expected DEMO-DB-PR-004 CBC and urinalysis item rows.'),
    (217, 'order_catalog_lab_test_item_links', 8, 8, 'baseline_required', 'public.order_catalog_lab_test_item_links', 'Catalog-to-result-sheet linkage for CBC and urinalysis orders.', 'Expected DEMO-DB-PR-004 links from CBC/urinalysis catalog rows to lab item rows.'),
    (218, 'billing checkout session family', 2, 2, 'baseline_required', 'public.billing_checkout_sessions + public.billing_checkout_session_invoices + public.payment_allocations', 'Optional guardian-level checkout session proof.', 'Expected DEMO-DB-PR-005 checkout sessions, invoice snapshots, and payment allocations for paid Nabi and Mango scenarios.'),
    (220, 'invoices', 5, 5, 'baseline_required', 'public.invoices', 'Billing desk invoice list and guardian checkout context.', 'Expected DEN-194 invoice rows.'),
    (230, 'invoice lines', 11, 11, 'baseline_required', 'public.invoice_lines', 'Billing reflection from chart orders.', 'Expected DEN-194 invoice line rows.'),
    (240, 'payments', 2, 2, 'baseline_required', 'public.payments', 'Paid/unpaid billing state demo.', 'Expected DEN-194 payment rows.'),
    (250, 'audit events', 5, 5, 'baseline_required', 'public.audit_events', 'History/audit trail for order and billing actions.', 'Expected DEN-194 audit event rows.')
),
actual_counts(area, actual_count) as (
  select 'auth users / app users', count(distinct au.id)::int
  from auth.users au
  join public.users app_user on app_user.id = au.id
  join public.user_memberships membership
    on membership.user_id = app_user.id
    and membership.workspace_id = 'clair-demo'
    and membership.status = 'active'
  where au.email like '%@clair.local'
  union all
  select 'workspace', count(*)::int
  from public.workspaces
  where id = 'clair-demo'
  union all
  select 'memberships', count(*)::int
  from public.user_memberships
  where workspace_id = 'clair-demo' and status = 'active'
  union all
  select 'permission policies', count(*)::int
  from public.permission_policies
  where workspace_id = 'clair-demo'
  union all
  select 'guardians', count(*)::int
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
  select 'SOAP notes', count(*)::int
  from public.soap_notes
  where workspace_id = 'clair-demo' and id::text like '19429200-%'
  union all
  select 'diagnoses', count(*)::int
  from public.diagnoses
  where workspace_id = 'clair-demo' and id::text like '19429300-%'
  union all
  select 'service categories', count(*)::int
  from public.service_categories
  where workspace_id = 'clair-demo' and id::text like '19428000-%'
  union all
  select 'service items', least(
    (select count(*)::int from public.service_items where workspace_id = 'clair-demo' and id::text like '19429000-%'),
    (select count(*)::int from public.service_item_prices where workspace_id = 'clair-demo' and id::text like '19429100-%')
  )
  union all
  select 'order catalog items', count(*)::int
  from public.order_catalog_items
  where workspace_id = 'clair-demo' and id like 'den194-catalog-%'
  union all
  select 'order sets', least(
    (select count(*)::int from public.order_sets where workspace_id = 'clair-demo' and id like 'den194-set-%'),
    (select count(distinct order_set_id)::int from public.order_set_items where workspace_id = 'clair-demo' and id like 'den194-setitem-%')
  )
  union all
  select 'order_set_items', count(*)::int
  from public.order_set_items
  where workspace_id = 'clair-demo' and id like 'den194-setitem-%'
  union all
  select 'order groups', count(*)::int
  from public.order_groups
  where workspace_id = 'clair-demo' and id::text like '19429400-%'
  union all
  select 'orders', count(*)::int
  from public.orders
  where workspace_id = 'clair-demo' and id::text like '19429500-%'
  union all
  select 'order events', count(*)::int
  from public.order_events
  where workspace_id = 'clair-demo' and id::text like '19429800-%'
  union all
  select 'order_fulfillment_work_items', count(*)::int
  from public.order_fulfillment_work_items
  where workspace_id = 'clair-demo' and id::text like '19431000-%'
  union all
  select 'lab_test_categories', count(*)::int
  from public.lab_test_categories
  where workspace_id = 'clair-demo' and id like 'den194-labcat-%'
  union all
  select 'lab_test_items', count(*)::int
  from public.lab_test_items
  where workspace_id = 'clair-demo' and id like 'den194-labitem-%'
  union all
  select 'order_catalog_lab_test_item_links', count(*)::int
  from public.order_catalog_lab_test_item_links
  where workspace_id = 'clair-demo' and id like 'den194-lablink-%'
  union all
  select 'billing checkout session family', least(
    (select count(*)::int from public.billing_checkout_sessions where workspace_id = 'clair-demo' and id::text like '19433000-%'),
    (select count(*)::int from public.billing_checkout_session_invoices where workspace_id = 'clair-demo' and id::text like '19433100-%'),
    (select count(*)::int from public.payment_allocations where workspace_id = 'clair-demo' and id::text like '19433200-%')
  )
  union all
  select 'invoices', count(*)::int
  from public.invoices
  where workspace_id = 'clair-demo' and invoice_no like 'INV-DEN194-%'
  union all
  select 'invoice lines', count(*)::int
  from public.invoice_lines
  where workspace_id = 'clair-demo' and id::text like '19429700-%'
  union all
  select 'payments', count(*)::int
  from public.payments
  where workspace_id = 'clair-demo' and id::text like '19429900-%'
  union all
  select 'audit events', count(*)::int
  from public.audit_events
  where workspace_id = 'clair-demo' and id like 'den-194-audit-%'
),
coverage as (
  select
    inventory.sort_order,
    inventory.area,
    inventory.expected_min,
    inventory.desired_min,
    inventory.policy,
    coalesce(actual_counts.actual_count, 0) as actual_count,
    case
      when coalesce(actual_counts.actual_count, 0) >= inventory.expected_min then 'pass'
      when inventory.policy = 'known_gap' then 'gap'
      else 'fail'
    end as status,
    inventory.evidence_source,
    inventory.demo_workflow,
    inventory.gap_message
  from inventory
  left join actual_counts on actual_counts.area = inventory.area
),
role_counts as (
  select role, count(*)::int as actual_count
  from public.user_memberships membership
  cross join lateral unnest(membership.roles) as role
  where membership.workspace_id = 'clair-demo'
    and membership.status = 'active'
    and role in ('hospital_admin', 'vet', 'technician', 'front_desk')
  group by role
),
expected_roles(role, expected_min) as (
  values
    ('hospital_admin', 1),
    ('vet', 3),
    ('technician', 4),
    ('front_desk', 3)
),
order_type_counts as (
  select order_type, count(*)::int as actual_count
  from public.orders
  where workspace_id = 'clair-demo' and id::text like '19429500-%'
  group by order_type
),
expected_order_types(order_type, expected_min, demo_workflow) as (
  values
    ('lab', 2, 'Lab queue/result evidence.'),
    ('imaging', 3, 'Imaging queue/result evidence.'),
    ('treatment', 4, 'Treatment task evidence.'),
    ('dispensing', 2, 'Dispensing task evidence.')
),
fulfillment_queue_counts as (
  select queue_type, count(*)::int as actual_count
  from public.order_fulfillment_work_items
  where workspace_id = 'clair-demo' and id::text like '19431000-%'
  group by queue_type
),
expected_fulfillment_queues(queue_type, expected_min, demo_workflow) as (
  values
    ('lab', 2, 'Lab technician work items for CBC and urinalysis.'),
    ('imaging', 3, 'Imaging technician work items for ultrasound and x-ray orders.'),
    ('treatment', 4, 'Treatment technician work items for fluids, ear cleaning, vaccine, and rehab.'),
    ('dispensing', 2, 'Dispensing queue work items for medication handoff.')
),
lab_result_sheet_counts as (
  select order_catalog_item_id, count(*)::int as actual_count
  from public.order_catalog_lab_test_item_links
  where workspace_id = 'clair-demo' and id like 'den194-lablink-%'
  group by order_catalog_item_id
),
expected_lab_result_sheets(order_catalog_item_id, expected_min, demo_workflow) as (
  values
    ('den194-catalog-cbc', 4, 'CBC result sheet fields for the kong-vomit lab order.'),
    ('den194-catalog-urinalysis', 4, 'Urinalysis result sheet fields for the nabi-urinary lab order.')
),
billing_checkout_session_counts as (
  select
    session.id::text as checkout_session_id,
    session.selected_payment_method,
    session.total_amount,
    count(distinct session_invoice.invoice_id)::int as invoice_count,
    count(distinct allocation.id)::int as allocation_count,
    coalesce(sum(allocation.amount), 0)::numeric(12, 2) as allocated_amount
  from public.billing_checkout_sessions session
  left join public.billing_checkout_session_invoices session_invoice
    on session_invoice.workspace_id = session.workspace_id
   and session_invoice.checkout_session_id = session.id
  left join public.payment_allocations allocation
    on allocation.workspace_id = session.workspace_id
   and allocation.checkout_session_id = session.id
  where session.workspace_id = 'clair-demo'
    and session.id::text like '19433000-%'
    and session.status = 'paid'
  group by session.id, session.selected_payment_method, session.total_amount
),
expected_billing_checkout_sessions(
  checkout_session_id,
  expected_payment_method,
  expected_total_amount,
  demo_workflow
) as (
  values
    ('19433000-0000-4000-8000-000000000002', 'card', 85000.00::numeric, 'Nabi urinalysis paid-card checkout session.'),
    ('19433000-0000-4000-8000-000000000004', 'cash', 45000.00::numeric, 'Mango wellness paid-cash checkout session.')
),
scenario_counts as (
  select metadata->>'scenario_code' as scenario_code, count(*)::int as actual_count
  from public.audit_events
  where workspace_id = 'clair-demo' and id like 'den-194-audit-%'
  group by metadata->>'scenario_code'
),
expected_scenarios(scenario_code, demo_workflow) as (
  values
    ('kong-vomit', 'Full outpatient flow: reception, chart, lab, imaging, treatment, dispensing, invoice.'),
    ('nabi-urinary', 'Lab/imaging result and paid invoice scenario.'),
    ('bori-allergy', 'Treatment/dispensing and unpaid invoice scenario.'),
    ('mango-wellness', 'Preventive care and paid cash invoice scenario.'),
    ('choco-rehab', 'Imaging plus pending treatment follow-up scenario.')
),
invoice_integrity as (
  select
    invoice.invoice_no,
    invoice.total_amount,
    coalesce(sum((line.quantity * line.unit_price) - line.discount_amount), 0)::numeric(12, 2) as line_total
  from public.invoices invoice
  left join public.invoice_lines line
    on line.invoice_id = invoice.id
    and line.workspace_id = invoice.workspace_id
  where invoice.workspace_id = 'clair-demo'
    and invoice.invoice_no like 'INV-DEN194-%'
  group by invoice.id, invoice.invoice_no, invoice.total_amount
),
synthetic_guard as (
  select 'guardian_emails' as check_name, count(*)::int as violation_count
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
  'contract', 'demo_seed_inventory_readback:2026-06-08',
  'workspaceId', 'clair-demo',
  'workspaceDisplayName', (select display_name from public.workspaces where id = 'clair-demo'),
  'statusPolicy', jsonb_build_object(
    'pass', 'actualCount is greater than or equal to expectedMin',
    'gap', 'known missing seed family for the current PR scope',
    'fail', 'baseline seed family is below expectedMin'
  ),
  'coverage', (
    select jsonb_agg(
      jsonb_build_object(
        'area', area,
        'policy', policy,
        'expectedMin', expected_min,
        'desiredMin', desired_min,
        'actualCount', actual_count,
        'status', status,
        'evidenceSource', evidence_source,
        'demoWorkflow', demo_workflow,
        'message', case when status = 'pass' then 'covered' else gap_message end
      )
      order by sort_order
    )
    from coverage
  ),
  'roleCoverage', (
    select jsonb_agg(
      jsonb_build_object(
        'role', expected_roles.role,
        'expectedMin', expected_roles.expected_min,
        'actualCount', coalesce(role_counts.actual_count, 0),
        'status', case when coalesce(role_counts.actual_count, 0) >= expected_roles.expected_min then 'pass' else 'fail' end
      )
      order by expected_roles.role
    )
    from expected_roles
    left join role_counts on role_counts.role = expected_roles.role
  ),
  'orderTypeCoverage', (
    select jsonb_agg(
      jsonb_build_object(
        'orderType', expected_order_types.order_type,
        'expectedMin', expected_order_types.expected_min,
        'actualCount', coalesce(order_type_counts.actual_count, 0),
        'status', case when coalesce(order_type_counts.actual_count, 0) >= expected_order_types.expected_min then 'pass' else 'fail' end,
        'demoWorkflow', expected_order_types.demo_workflow
      )
      order by expected_order_types.order_type
    )
    from expected_order_types
    left join order_type_counts on order_type_counts.order_type = expected_order_types.order_type
  ),
  'fulfillmentQueueCoverage', (
    select jsonb_agg(
      jsonb_build_object(
        'queueType', expected_fulfillment_queues.queue_type,
        'expectedMin', expected_fulfillment_queues.expected_min,
        'actualCount', coalesce(fulfillment_queue_counts.actual_count, 0),
        'status', case when coalesce(fulfillment_queue_counts.actual_count, 0) >= expected_fulfillment_queues.expected_min then 'pass' else 'fail' end,
        'demoWorkflow', expected_fulfillment_queues.demo_workflow
      )
      order by expected_fulfillment_queues.queue_type
    )
    from expected_fulfillment_queues
    left join fulfillment_queue_counts on fulfillment_queue_counts.queue_type = expected_fulfillment_queues.queue_type
  ),
  'labResultSheetCoverage', (
    select jsonb_agg(
      jsonb_build_object(
        'orderCatalogItemId', expected_lab_result_sheets.order_catalog_item_id,
        'expectedMin', expected_lab_result_sheets.expected_min,
        'actualCount', coalesce(lab_result_sheet_counts.actual_count, 0),
        'status', case when coalesce(lab_result_sheet_counts.actual_count, 0) >= expected_lab_result_sheets.expected_min then 'pass' else 'fail' end,
        'demoWorkflow', expected_lab_result_sheets.demo_workflow
      )
      order by expected_lab_result_sheets.order_catalog_item_id
    )
    from expected_lab_result_sheets
    left join lab_result_sheet_counts on lab_result_sheet_counts.order_catalog_item_id = expected_lab_result_sheets.order_catalog_item_id
  ),
  'billingCheckoutCoverage', (
    select jsonb_agg(
      jsonb_build_object(
        'checkoutSessionId', expected_billing_checkout_sessions.checkout_session_id,
        'expectedPaymentMethod', expected_billing_checkout_sessions.expected_payment_method,
        'actualPaymentMethod', billing_checkout_session_counts.selected_payment_method,
        'expectedTotalAmount', expected_billing_checkout_sessions.expected_total_amount,
        'actualTotalAmount', billing_checkout_session_counts.total_amount,
        'invoiceCount', coalesce(billing_checkout_session_counts.invoice_count, 0),
        'allocationCount', coalesce(billing_checkout_session_counts.allocation_count, 0),
        'allocatedAmount', coalesce(billing_checkout_session_counts.allocated_amount, 0),
        'status', case
          when billing_checkout_session_counts.checkout_session_id is not null
            and billing_checkout_session_counts.selected_payment_method = expected_billing_checkout_sessions.expected_payment_method
            and billing_checkout_session_counts.total_amount = expected_billing_checkout_sessions.expected_total_amount
            and billing_checkout_session_counts.invoice_count >= 1
            and billing_checkout_session_counts.allocation_count >= 1
            and billing_checkout_session_counts.allocated_amount = billing_checkout_session_counts.total_amount
          then 'pass'
          else 'fail'
        end,
        'demoWorkflow', expected_billing_checkout_sessions.demo_workflow
      )
      order by expected_billing_checkout_sessions.checkout_session_id
    )
    from expected_billing_checkout_sessions
    left join billing_checkout_session_counts
      on billing_checkout_session_counts.checkout_session_id = expected_billing_checkout_sessions.checkout_session_id
  ),
  'scenarioCoverage', (
    select jsonb_agg(
      jsonb_build_object(
        'scenarioCode', expected_scenarios.scenario_code,
        'auditEvents', coalesce(scenario_counts.actual_count, 0),
        'status', case when coalesce(scenario_counts.actual_count, 0) >= 1 then 'pass' else 'fail' end,
        'demoWorkflow', expected_scenarios.demo_workflow
      )
      order by expected_scenarios.scenario_code
    )
    from expected_scenarios
    left join scenario_counts on scenario_counts.scenario_code = expected_scenarios.scenario_code
  ),
  'invoiceIntegrity', (
    select jsonb_agg(
      jsonb_build_object(
        'invoiceNo', invoice_no,
        'totalAmount', total_amount,
        'lineTotal', line_total,
        'status', case when total_amount = line_total then 'pass' else 'fail' end
      )
      order by invoice_no
    )
    from invoice_integrity
  ),
  'syntheticGuard', (
    select jsonb_agg(
      jsonb_build_object(
        'check', check_name,
        'violations', violation_count,
        'status', case when violation_count = 0 then 'pass' else 'fail' end
      )
      order by check_name
    )
    from synthetic_guard
  ),
  'knownSeedGaps', (
    select jsonb_agg(
      jsonb_build_object(
        'area', area,
        'desiredMin', desired_min,
        'actualCount', actual_count,
        'message', gap_message
      )
      order by sort_order
    )
    from coverage
    where status = 'gap'
  ),
  'baselineFailureCount', (
    select count(*)::int
    from coverage
    where policy = 'baseline_required' and status = 'fail'
  ),
  'knownGapCount', (
    select count(*)::int
    from coverage
    where status = 'gap'
  )
) as demo_seed_inventory_readback_contract;
