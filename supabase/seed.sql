-- DEN-35: workspace auth seed contract.
-- Runs after local migrations during `npx supabase db reset --local`.
-- legacy role compatibility: nurse -> technician, billing_admin -> hospital_admin.

select 'workspace_auth_seed_contract_version:2026-05-18-den-35' as workspace_auth_seed_contract_version;

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'admin@clair.local',
    crypt('local-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"송민재"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'vet@clair.local',
    crypt('local-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"이수지"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'technician@clair.local',
    crypt('local-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"송하윤"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'front-desk@clair.local',
    crypt('local-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"최유나"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into public.users (id, display_name, initial, email, phone, status)
values
  ('00000000-0000-4000-8000-000000000001', '송민재', 'SM', 'admin@clair.local', '010-0000-0001', 'active'),
  ('00000000-0000-4000-8000-000000000002', '이수지', 'LS', 'vet@clair.local', '010-0000-0002', 'active'),
  ('00000000-0000-4000-8000-000000000003', '송하윤', 'SH', 'technician@clair.local', '010-0000-0003', 'active'),
  ('00000000-0000-4000-8000-000000000004', '최유나', 'CY', 'front-desk@clair.local', '010-0000-0004', 'active')
on conflict (id) do update
set
  display_name = excluded.display_name,
  initial = excluded.initial,
  email = excluded.email,
  phone = excluded.phone,
  status = excluded.status,
  updated_at = now();

insert into public.workspaces (id, display_name, status, created_by_user_id)
values (
  'clair-demo',
  'CLAiR Demo Hospital',
  'active',
  '00000000-0000-4000-8000-000000000001'
)
on conflict (id) do update
set
  display_name = excluded.display_name,
  status = excluded.status,
  created_by_user_id = excluded.created_by_user_id,
  updated_at = now();

insert into public.user_memberships (
  id,
  workspace_id,
  user_id,
  roles,
  department,
  title,
  status,
  activated_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'clair-demo',
    '00000000-0000-4000-8000-000000000001',
    array['hospital_admin'],
    'Operations',
    'Hospital Admin',
    'active',
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'clair-demo',
    '00000000-0000-4000-8000-000000000002',
    array['vet'],
    'Clinical',
    'Veterinarian',
    'active',
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'clair-demo',
    '00000000-0000-4000-8000-000000000003',
    array['technician'],
    'Clinical Support',
    'Technician',
    'active',
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'clair-demo',
    '00000000-0000-4000-8000-000000000004',
    array['front_desk'],
    'Reception',
    'Front Desk',
    'active',
    now()
  )
on conflict (workspace_id, user_id) do update
set
  roles = excluded.roles,
  department = excluded.department,
  title = excluded.title,
  status = excluded.status,
  activated_at = excluded.activated_at,
  updated_at = now();

insert into public.permission_policies (
  workspace_id,
  name,
  scope,
  target_role,
  permissions
)
values
  (
    'clair-demo',
    'Hospital admin full access',
    'role',
    'hospital_admin',
    '{"allowed":["*"]}'::jsonb
  ),
  (
    'clair-demo',
    'Veterinarian MVP access',
    'role',
    'vet',
    '{"allowed":["reception:view","patient:view","encounter:view","chart:view","chart:update","order:create","order:update","dispensing:view","lab:view","imaging:view","billing:view"]}'::jsonb
  ),
  (
    'clair-demo',
    'Technician MVP access',
    'role',
    'technician',
    '{"allowed":["reception:view","patient:view","encounter:view","chart:view","order:update","dispensing:view","dispensing:complete","lab:view","lab:update","imaging:view","imaging:update"]}'::jsonb
  ),
  (
    'clair-demo',
    'Front desk MVP access',
    'role',
    'front_desk',
    '{"allowed":["reception:view","reception:create","reception:update","patient:view","patient:create","patient:update","encounter:view","billing:view","billing:issue"]}'::jsonb
  )
on conflict (workspace_id, target_role) where scope = 'role' do update
set
  name = excluded.name,
  permissions = excluded.permissions,
  updated_at = now();

-- DEN-56: reception domain synthetic seed contract.
-- Uses local-only synthetic data. Do not replace with production guardian, patient, or clinic data.

select 'reception_domain_seed_contract_version:2026-05-19-den-56' as reception_domain_seed_contract_version;

insert into public.guardians (
  id,
  workspace_id,
  name,
  mobile_phone,
  mobile_phone_normalized,
  email,
  memo
)
values (
  '20000000-0000-4000-8000-000000000001',
  'clair-demo',
  '로컬보호자',
  '010-1111-2222',
  '01011112222',
  'guardian.reception.seed@example.test',
  'DEN-56 synthetic guardian fixture'
)
on conflict (id) do update
set
  name = excluded.name,
  mobile_phone = excluded.mobile_phone,
  mobile_phone_normalized = excluded.mobile_phone_normalized,
  email = excluded.email,
  memo = excluded.memo,
  updated_at = now();

insert into public.patients (
  id,
  workspace_id,
  patient_no,
  name,
  species,
  breed,
  birth_date,
  sex,
  neutered,
  microchip_no,
  patient_registration_no,
  handling_caution_locked,
  status
)
values (
  '21000000-0000-4000-8000-000000000001',
  'clair-demo',
  'P-SEED-0001',
  '로컬환자',
  'dog',
  'Mixed',
  '2021-01-01',
  'female',
  true,
  '999000000000001',
  'REG-SEED-0001',
  true,
  'active'
)
on conflict (id) do update
set
  patient_no = excluded.patient_no,
  name = excluded.name,
  species = excluded.species,
  breed = excluded.breed,
  birth_date = excluded.birth_date,
  sex = excluded.sex,
  neutered = excluded.neutered,
  microchip_no = excluded.microchip_no,
  patient_registration_no = excluded.patient_registration_no,
  handling_caution_locked = excluded.handling_caution_locked,
  status = excluded.status,
  updated_at = now();

insert into public.patient_guardians (
  id,
  workspace_id,
  patient_id,
  guardian_id,
  relationship,
  is_primary,
  can_receive_messages
)
values (
  '22000000-0000-4000-8000-000000000001',
  'clair-demo',
  '21000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'primary',
  true,
  true
)
on conflict (patient_id, guardian_id) do update
set
  relationship = excluded.relationship,
  is_primary = excluded.is_primary,
  can_receive_messages = excluded.can_receive_messages;

insert into public.consents (
  id,
  workspace_id,
  guardian_id,
  patient_id,
  consent_type,
  status,
  signed_at,
  document_url
)
values
  (
    '23000000-0000-4000-8000-000000000001',
    'clair-demo',
    '20000000-0000-4000-8000-000000000001',
    '21000000-0000-4000-8000-000000000001',
    'privacy',
    'granted',
    now(),
    '/mock-documents/session-consents/den-56-privacy.pdf'
  ),
  (
    '23000000-0000-4000-8000-000000000002',
    'clair-demo',
    '20000000-0000-4000-8000-000000000001',
    '21000000-0000-4000-8000-000000000001',
    'messaging',
    'granted',
    now(),
    '/mock-documents/session-consents/den-56-messaging.pdf'
  )
on conflict (id) do nothing;

insert into public.appointments (
  id,
  workspace_id,
  patient_id,
  guardian_id,
  assigned_veterinarian_id,
  scheduled_start_at,
  scheduled_end_at,
  visit_purpose,
  symptom_note,
  status,
  created_by_user_id
)
values (
  '24000000-0000-4000-8000-000000000001',
  'clair-demo',
  '21000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '2026-05-19T10:00:00+09:00',
  '2026-05-19T10:30:00+09:00',
  'DEN-56 synthetic appointment',
  'Synthetic appointment check-in fixture',
  'confirmed',
  '00000000-0000-4000-8000-000000000004'
)
on conflict (id) do update
set
  assigned_veterinarian_id = excluded.assigned_veterinarian_id,
  scheduled_start_at = excluded.scheduled_start_at,
  scheduled_end_at = excluded.scheduled_end_at,
  visit_purpose = excluded.visit_purpose,
  symptom_note = excluded.symptom_note,
  status = excluded.status,
  updated_at = now();

insert into public.encounters (
  id,
  workspace_id,
  patient_id,
  guardian_id,
  appointment_id,
  primary_veterinarian_id,
  encounter_no,
  reception_type,
  department,
  duration_minutes,
  chief_complaint,
  visit_purpose,
  reception_memo,
  status,
  checked_in_at,
  checked_in_by_user_id
)
values (
  '26000000-0000-4000-8000-000000000001',
  'clair-demo',
  '21000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  null,
  '00000000-0000-4000-8000-000000000002',
  'E-SEED-0001',
  'walk_in',
  '진료',
  30,
  'Synthetic walk-in chief complaint',
  'DEN-56 synthetic walk-in',
  'DEN-56 synthetic reception memo',
  'waiting',
  '2026-05-19T09:30:00+09:00',
  '00000000-0000-4000-8000-000000000004'
)
on conflict (id) do update
set
  primary_veterinarian_id = excluded.primary_veterinarian_id,
  encounter_no = excluded.encounter_no,
  reception_type = excluded.reception_type,
  department = excluded.department,
  duration_minutes = excluded.duration_minutes,
  chief_complaint = excluded.chief_complaint,
  visit_purpose = excluded.visit_purpose,
  reception_memo = excluded.reception_memo,
  status = excluded.status,
  checked_in_at = excluded.checked_in_at,
  checked_in_by_user_id = excluded.checked_in_by_user_id,
  updated_at = now();

insert into public.waiting_queue_entries (
  id,
  workspace_id,
  encounter_id,
  queue_type,
  status,
  priority,
  sort_order,
  entered_at
)
values (
  '27000000-0000-4000-8000-000000000001',
  'clair-demo',
  '26000000-0000-4000-8000-000000000001',
  'consultation',
  'waiting',
  'normal',
  1,
  '2026-05-19T09:30:00+09:00'
)
on conflict (encounter_id, queue_type) do update
set
  status = excluded.status,
  priority = excluded.priority,
  sort_order = excluded.sort_order,
  entered_at = excluded.entered_at;

-- DEN-68: clinical/order/billing synthetic seed contract.
-- Local-only portfolio fixture. Do not replace with production client, patient, or clinic data.

select 'clinical_billing_seed_contract_version:2026-05-19-den-68' as clinical_billing_seed_contract_version;

insert into public.service_categories (
  id,
  workspace_id,
  parent_id,
  name,
  sort_order
)
values (
  '28000000-0000-4000-8000-000000000001',
  'clair-demo',
  null,
  'DEN-68 synthetic clinical orders',
  10
)
on conflict (id) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.service_items (
  id,
  workspace_id,
  category_id,
  name,
  item_type,
  description,
  default_duration_minutes,
  is_orderable,
  is_billable,
  is_active
)
values (
  '29000000-0000-4000-8000-000000000001',
  'clair-demo',
  '28000000-0000-4000-8000-000000000001',
  'DEN-68 CBC synthetic order',
  'lab',
  'Synthetic Project 04 service item used for chart/order/billing persistence tests.',
  20,
  true,
  true,
  true
)
on conflict (id) do update
set
  category_id = excluded.category_id,
  name = excluded.name,
  item_type = excluded.item_type,
  description = excluded.description,
  default_duration_minutes = excluded.default_duration_minutes,
  is_orderable = excluded.is_orderable,
  is_billable = excluded.is_billable,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.service_item_prices (
  id,
  workspace_id,
  service_item_id,
  price,
  currency,
  effective_from,
  effective_to
)
values (
  '29100000-0000-4000-8000-000000000001',
  'clair-demo',
  '29000000-0000-4000-8000-000000000001',
  35000.00,
  'KRW',
  '2026-05-19',
  null
)
on conflict (id) do update
set
  service_item_id = excluded.service_item_id,
  price = excluded.price,
  currency = excluded.currency,
  effective_from = excluded.effective_from,
  effective_to = excluded.effective_to;

insert into public.soap_notes (
  id,
  workspace_id,
  encounter_id,
  author_user_id,
  subjective,
  objective,
  assessment,
  plan,
  status,
  autosaved_at
)
values (
  '29200000-0000-4000-8000-000000000001',
  'clair-demo',
  '26000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'Synthetic subjective note for DEN-68.',
  'Synthetic objective note for DEN-68.',
  'Synthetic assessment note for DEN-68.',
  'Synthetic plan note for DEN-68.',
  'autosaved',
  now()
)
on conflict (id) do update
set
  subjective = excluded.subjective,
  objective = excluded.objective,
  assessment = excluded.assessment,
  plan = excluded.plan,
  status = excluded.status,
  autosaved_at = excluded.autosaved_at,
  updated_at = now();

insert into public.diagnoses (
  id,
  workspace_id,
  encounter_id,
  diagnosis_catalog_id,
  diagnosis_text,
  diagnosis_type,
  is_primary,
  sort_order,
  created_by_user_id,
  updated_by_user_id
)
values (
  '29300000-0000-4000-8000-000000000001',
  'clair-demo',
  '26000000-0000-4000-8000-000000000001',
  null,
  'DEN-68 synthetic diagnosis',
  'suspected',
  true,
  1,
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000002'
)
on conflict (id) do update
set
  diagnosis_text = excluded.diagnosis_text,
  diagnosis_type = excluded.diagnosis_type,
  is_primary = excluded.is_primary,
  sort_order = excluded.sort_order,
  updated_by_user_id = excluded.updated_by_user_id,
  updated_at = now();

insert into public.order_groups (
  id,
  workspace_id,
  encounter_id,
  group_type,
  title,
  label,
  status,
  priority,
  sort_order,
  created_by_user_id
)
values (
  '29400000-0000-4000-8000-000000000001',
  'clair-demo',
  '26000000-0000-4000-8000-000000000001',
  'lab',
  'DEN-68 synthetic lab order group',
  'Project 04 synthetic',
  'requested',
  'normal',
  1,
  '00000000-0000-4000-8000-000000000002'
)
on conflict (id) do update
set
  title = excluded.title,
  label = excluded.label,
  status = excluded.status,
  priority = excluded.priority,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.orders (
  id,
  workspace_id,
  encounter_id,
  order_group_id,
  service_item_id,
  order_type,
  display_name,
  billing_display_name,
  status,
  work_status,
  priority,
  quantity,
  unit_price_snapshot,
  requested_by_user_id,
  requested_at,
  confirmed_by_user_id,
  confirmed_at,
  instruction,
  sort_order
)
values (
  '29500000-0000-4000-8000-000000000001',
  'clair-demo',
  '26000000-0000-4000-8000-000000000001',
  '29400000-0000-4000-8000-000000000001',
  '29000000-0000-4000-8000-000000000001',
  'lab',
  'DEN-68 synthetic CBC order',
  'DEN-68 synthetic CBC billing line',
  'ready_for_billing',
  'pending',
  'normal',
  1,
  35000.00,
  '00000000-0000-4000-8000-000000000002',
  now(),
  '00000000-0000-4000-8000-000000000002',
  now(),
  'Synthetic Project 04 order fixture.',
  1
)
on conflict (id) do update
set
  order_group_id = excluded.order_group_id,
  service_item_id = excluded.service_item_id,
  display_name = excluded.display_name,
  billing_display_name = excluded.billing_display_name,
  status = excluded.status,
  work_status = excluded.work_status,
  priority = excluded.priority,
  quantity = excluded.quantity,
  unit_price_snapshot = excluded.unit_price_snapshot,
  confirmed_by_user_id = excluded.confirmed_by_user_id,
  confirmed_at = excluded.confirmed_at,
  instruction = excluded.instruction,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.invoices (
  id,
  workspace_id,
  encounter_id,
  guardian_id,
  invoice_no,
  status,
  payment_state,
  selected_payment_method,
  unpaid_reason,
  subtotal_amount,
  discount_amount,
  tax_amount,
  total_amount,
  issued_by_user_id,
  issued_at
)
values (
  '29600000-0000-4000-8000-000000000001',
  'clair-demo',
  '26000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'INV-DEN68-0001',
  'issued',
  'unpaid',
  null,
  'Synthetic unpaid state for Project 04 fixture.',
  35000.00,
  0.00,
  0.00,
  35000.00,
  '00000000-0000-4000-8000-000000000004',
  now()
)
on conflict (id) do update
set
  invoice_no = excluded.invoice_no,
  status = excluded.status,
  payment_state = excluded.payment_state,
  unpaid_reason = excluded.unpaid_reason,
  subtotal_amount = excluded.subtotal_amount,
  discount_amount = excluded.discount_amount,
  tax_amount = excluded.tax_amount,
  total_amount = excluded.total_amount,
  issued_by_user_id = excluded.issued_by_user_id,
  issued_at = excluded.issued_at,
  updated_at = now();

insert into public.invoice_lines (
  id,
  workspace_id,
  invoice_id,
  service_item_id,
  order_id,
  description,
  quantity,
  unit_price,
  discount_amount
)
values (
  '29700000-0000-4000-8000-000000000001',
  'clair-demo',
  '29600000-0000-4000-8000-000000000001',
  '29000000-0000-4000-8000-000000000001',
  '29500000-0000-4000-8000-000000000001',
  'DEN-68 synthetic CBC invoice line',
  1,
  35000.00,
  0.00
)
on conflict (id) do update
set
  service_item_id = excluded.service_item_id,
  order_id = excluded.order_id,
  description = excluded.description,
  quantity = excluded.quantity,
  unit_price = excluded.unit_price,
  discount_amount = excluded.discount_amount,
  updated_at = now();

-- DEN-105: customer management synthetic seed contract.
-- Uses local-only portfolio fixture values and masked placeholders.

select 'customer_management_seed_contract_version:2026-05-20-den-105' as customer_management_seed_contract_version;

update public.guardians
set
  guardian_code = 'C-SEED-0001',
  additional_phone_numbers = '["010-1111-3333"]'::jsonb,
  postal_code = '06000',
  address_line1 = 'Synthetic Cheongdam demo address',
  address_line2 = 'Synthetic suite 101',
  email_local_part = 'guardian.reception.seed',
  email_domain_mode = 'direct_input',
  email_domain = 'example.test',
  cash_receipt_type = 'personal_income_deduction',
  cash_receipt_number = 'cash-receipt-demo-placeholder',
  resident_registration_number_masked = '900101-1******',
  resident_registration_number_token = 'masked-demo-rrn-token',
  vehicle_number = 'DEMO-1234',
  status = 'active',
  last_updated_by_user_id = '00000000-0000-4000-8000-000000000004',
  updated_at = now()
where id = '20000000-0000-4000-8000-000000000001';

update public.patients
set
  primary_breed_id = 'breed-demo-mixed',
  primary_breed_name = 'Mixed',
  is_mixed_breed = true,
  additional_breed_ids = '["breed-demo-poodle"]'::jsonb,
  estimated_age_years = 5,
  estimated_age_months = 4,
  estimated_age_days = 0,
  age_is_estimated = true,
  weight_kg = 6.20,
  color = 'Synthetic cream',
  microchip_type = 'internal',
  profile_memo = 'DEN-105 synthetic customer profile memo.',
  primary_attending_vet_id = '00000000-0000-4000-8000-000000000002',
  message_consent_status = 'granted',
  kakao_patient_code = 'KAKAO-DEMO-PATIENT-001',
  last_updated_by_user_id = '00000000-0000-4000-8000-000000000004',
  updated_at = now()
where id = '21000000-0000-4000-8000-000000000001';

update public.patient_guardians
set
  relationship_label = 'primary',
  message_consent_status = 'granted',
  guardian_phone_available = true,
  sort_order = 0,
  linked_by_user_id = '00000000-0000-4000-8000-000000000004',
  updated_at = now()
where id = '22000000-0000-4000-8000-000000000001';

update public.consents
set
  source_surface = 'guardian_registration',
  document_version = 'customer-profile-demo-v1',
  consented_at = coalesce(consented_at, signed_at, now()),
  updated_at = now()
where guardian_id = '20000000-0000-4000-8000-000000000001';

insert into public.guardian_referral_sources (
  id,
  workspace_id,
  guardian_id,
  source_type,
  source_other_text
)
values
  (
    '31000000-0000-4000-8000-000000000001',
    'clair-demo',
    '20000000-0000-4000-8000-000000000001',
    'homepage',
    null
  ),
  (
    '31000000-0000-4000-8000-000000000002',
    'clair-demo',
    '20000000-0000-4000-8000-000000000001',
    'referral',
    null
  )
on conflict (workspace_id, guardian_id, source_type) do update
set
  source_other_text = excluded.source_other_text,
  updated_at = now();

insert into public.patient_staff_assignments (
  id,
  workspace_id,
  patient_id,
  staff_id,
  staff_display_name,
  department_label,
  assignment_role,
  sort_order,
  is_active
)
values (
  '32000000-0000-4000-8000-000000000001',
  'clair-demo',
  '21000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '이수지',
  'Internal medicine demo',
  'primary',
  0,
  true
)
on conflict (id) do update
set
  staff_id = excluded.staff_id,
  staff_display_name = excluded.staff_display_name,
  department_label = excluded.department_label,
  assignment_role = excluded.assignment_role,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.customer_profile_change_logs (
  id,
  workspace_id,
  subject_type,
  subject_id,
  change_type,
  changed_by_user_id,
  before_value,
  after_value,
  reason
)
values (
  '33000000-0000-4000-8000-000000000001',
  'clair-demo',
  'guardian',
  '20000000-0000-4000-8000-000000000001',
  'update',
  '00000000-0000-4000-8000-000000000004',
  '{}'::jsonb,
  '{"guardianCode":"C-SEED-0001","cashReceipt":"masked"}'::jsonb,
  'DEN-105 synthetic customer profile seed'
)
on conflict (id) do update
set
  changed_by_user_id = excluded.changed_by_user_id,
  before_value = excluded.before_value,
  after_value = excluded.after_value,
  reason = excluded.reason;
