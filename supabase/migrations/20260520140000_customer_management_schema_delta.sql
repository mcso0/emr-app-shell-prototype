-- DEN-105: customer management schema delta.
-- Local-first draft only. Remote Supabase application, provider integration, and hard deletes are out of scope.

alter table public.guardians
  add column if not exists guardian_code text,
  add column if not exists additional_phone_numbers jsonb not null default '[]'::jsonb,
  add column if not exists postal_code text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists email_local_part text,
  add column if not exists email_domain_mode text,
  add column if not exists email_domain text,
  add column if not exists cash_receipt_type text not null default 'none',
  add column if not exists cash_receipt_number text,
  add column if not exists resident_registration_number_masked text,
  add column if not exists resident_registration_number_token text,
  add column if not exists vehicle_number text,
  add column if not exists status text not null default 'active',
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists deleted_reason text,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists last_updated_by_user_id uuid references public.users(id) on delete set null;

alter table public.guardians
  drop constraint if exists guardians_cash_receipt_type_check,
  add constraint guardians_cash_receipt_type_check
    check (cash_receipt_type in ('none', 'personal_income_deduction', 'business_income_deduction'));

alter table public.guardians
  drop constraint if exists guardians_email_domain_mode_check,
  add constraint guardians_email_domain_mode_check
    check (email_domain_mode is null or email_domain_mode in ('preset', 'direct_input'));

alter table public.guardians
  drop constraint if exists guardians_status_check,
  add constraint guardians_status_check
    check (status in ('active', 'soft_deleted'));

alter table public.patients
  add column if not exists primary_breed_id text,
  add column if not exists primary_breed_name text,
  add column if not exists is_mixed_breed boolean not null default false,
  add column if not exists additional_breed_ids jsonb not null default '[]'::jsonb,
  add column if not exists estimated_age_years integer,
  add column if not exists estimated_age_months integer,
  add column if not exists estimated_age_days integer,
  add column if not exists age_is_estimated boolean not null default false,
  add column if not exists weight_kg numeric(6,2),
  add column if not exists color text,
  add column if not exists microchip_type text not null default 'none',
  add column if not exists profile_memo text,
  add column if not exists primary_attending_vet_id uuid references public.users(id) on delete set null,
  add column if not exists message_consent_status text not null default 'granted',
  add column if not exists kakao_patient_code text,
  add column if not exists deceased_at timestamptz,
  add column if not exists deceased_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists deleted_reason text,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists last_updated_by_user_id uuid references public.users(id) on delete set null;

alter table public.patients
  drop constraint if exists patients_status_check,
  add constraint patients_status_check
    check (status in ('active', 'inactive', 'deceased', 'soft_deleted'));

alter table public.patients
  drop constraint if exists patients_microchip_type_check,
  add constraint patients_microchip_type_check
    check (microchip_type in ('none', 'internal', 'external'));

alter table public.patients
  drop constraint if exists patients_message_consent_status_check,
  add constraint patients_message_consent_status_check
    check (message_consent_status in ('granted', 'refused', 'unknown'));

alter table public.patients
  drop constraint if exists patients_age_parts_check,
  add constraint patients_age_parts_check
    check (
      (estimated_age_years is null or estimated_age_years >= 0)
      and (estimated_age_months is null or estimated_age_months >= 0)
      and (estimated_age_days is null or estimated_age_days >= 0)
    );

alter table public.patients
  drop constraint if exists patients_weight_kg_check,
  add constraint patients_weight_kg_check
    check (weight_kg is null or weight_kg > 0);

alter table public.patient_guardians
  add column if not exists relationship_label text,
  add column if not exists message_consent_status text not null default 'granted',
  add column if not exists message_refused_at timestamptz,
  add column if not exists guardian_phone_available boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists linked_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists unlinked_at timestamptz,
  add column if not exists unlinked_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists primary_changed_at timestamptz,
  add column if not exists primary_changed_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.patient_guardians
  drop constraint if exists patient_guardians_message_consent_status_check,
  add constraint patient_guardians_message_consent_status_check
    check (message_consent_status in ('granted', 'refused', 'unknown'));

alter table public.patient_guardians
  drop constraint if exists patient_guardians_sort_order_check,
  add constraint patient_guardians_sort_order_check
    check (sort_order >= 0);

alter table public.consents
  add column if not exists source_surface text not null default 'guardian_registration',
  add column if not exists document_version text not null default 'customer-profile-demo-v1',
  add column if not exists consented_at timestamptz,
  add column if not exists refused_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.consents
set
  consented_at = coalesce(consented_at, signed_at),
  refused_at = coalesce(refused_at, revoked_at)
where consented_at is null or refused_at is null;

alter table public.consents
  drop constraint if exists consents_status_check,
  add constraint consents_status_check
    check (status in ('granted', 'revoked', 'refused', 'unknown'));

alter table public.consents
  drop constraint if exists consents_consent_type_check,
  add constraint consents_consent_type_check
    check (
      consent_type in (
        'privacy',
        'treatment',
        'surgery',
        'hospitalization',
        'marketing',
        'messaging',
        'personal_data_collection',
        'third_party_sharing',
        'marketing_messages'
      )
    );

alter table public.consents
  drop constraint if exists consents_source_surface_check,
  add constraint consents_source_surface_check
    check (source_surface in ('guardian_registration', 'guardian_detail_edit', 'future_signing_surface'));

create table if not exists public.guardian_referral_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  source_type text not null check (
    source_type in (
      'homepage',
      'blog_cafe_article',
      'youtube',
      'instagram',
      'kakao_channel',
      'offline_lecture',
      'nearby',
      'referral',
      'other_hospital',
      'other'
    )
  ),
  source_other_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guardian_duplicate_overrides (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  candidate_guardian_ids jsonb not null default '[]'::jsonb,
  accepted_by_user_id uuid references public.users(id) on delete set null,
  accepted_at timestamptz not null default now(),
  reason text
);

create table if not exists public.patient_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  staff_id uuid not null references public.users(id) on delete cascade,
  staff_display_name text,
  department_label text,
  assignment_role text not null default 'attending'
    check (assignment_role in ('primary', 'attending', 'consulting')),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_profile_change_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  subject_type text not null
    check (subject_type in ('guardian', 'patient', 'patient_guardian', 'consent')),
  subject_id uuid not null,
  change_type text not null
    check (change_type in ('create', 'update', 'soft_delete', 'restore', 'unlink', 'primary_change', 'consent_change')),
  changed_by_user_id uuid references public.users(id) on delete set null,
  before_value jsonb,
  after_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create unique index if not exists guardians_workspace_guardian_code_key
  on public.guardians (workspace_id, guardian_code)
  where guardian_code is not null and guardian_code <> '';

create index if not exists guardians_workspace_status_updated_idx
  on public.guardians (workspace_id, status, updated_at desc);

create index if not exists patients_workspace_primary_attending_vet_idx
  on public.patients (workspace_id, primary_attending_vet_id)
  where primary_attending_vet_id is not null;

create index if not exists patients_workspace_status_updated_idx
  on public.patients (workspace_id, status, updated_at desc);

create unique index if not exists patients_workspace_kakao_patient_code_key
  on public.patients (workspace_id, kakao_patient_code)
  where kakao_patient_code is not null and kakao_patient_code <> '';

drop index if exists patient_guardians_workspace_patient_primary_key;

create unique index if not exists patient_guardians_workspace_active_link_key
  on public.patient_guardians (workspace_id, patient_id, guardian_id)
  where unlinked_at is null;

create unique index if not exists patient_guardians_workspace_active_patient_primary_key
  on public.patient_guardians (workspace_id, patient_id)
  where is_primary = true and unlinked_at is null;

create index if not exists patient_guardians_workspace_guardian_unlinked_idx
  on public.patient_guardians (workspace_id, guardian_id, unlinked_at);

create index if not exists patient_guardians_workspace_patient_sort_idx
  on public.patient_guardians (workspace_id, patient_id, sort_order);

create unique index if not exists guardian_referral_sources_workspace_guardian_source_key
  on public.guardian_referral_sources (workspace_id, guardian_id, source_type);

create index if not exists guardian_referral_sources_workspace_source_idx
  on public.guardian_referral_sources (workspace_id, source_type);

create index if not exists guardian_duplicate_overrides_workspace_guardian_idx
  on public.guardian_duplicate_overrides (workspace_id, guardian_id, accepted_at desc);

create unique index if not exists patient_staff_assignments_workspace_active_primary_key
  on public.patient_staff_assignments (workspace_id, patient_id)
  where assignment_role = 'primary' and is_active = true;

create index if not exists patient_staff_assignments_workspace_active_patient_idx
  on public.patient_staff_assignments (workspace_id, patient_id, is_active, sort_order);

create index if not exists patient_staff_assignments_workspace_staff_idx
  on public.patient_staff_assignments (workspace_id, staff_id);

create index if not exists customer_profile_change_logs_workspace_subject_idx
  on public.customer_profile_change_logs (workspace_id, subject_type, subject_id, created_at desc);

alter table public.guardian_referral_sources
  add constraint guardian_referral_sources_guardian_workspace_fk
  foreign key (workspace_id, guardian_id) references public.guardians(workspace_id, id)
  on delete cascade;

alter table public.guardian_duplicate_overrides
  add constraint guardian_duplicate_overrides_guardian_workspace_fk
  foreign key (workspace_id, guardian_id) references public.guardians(workspace_id, id)
  on delete cascade;

alter table public.patient_staff_assignments
  add constraint patient_staff_assignments_patient_workspace_fk
  foreign key (workspace_id, patient_id) references public.patients(workspace_id, id)
  on delete cascade;

drop trigger if exists set_patient_guardians_updated_at on public.patient_guardians;
create trigger set_patient_guardians_updated_at
before update on public.patient_guardians
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_consents_updated_at on public.consents;
create trigger set_consents_updated_at
before update on public.consents
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_guardian_referral_sources_updated_at on public.guardian_referral_sources;
create trigger set_guardian_referral_sources_updated_at
before update on public.guardian_referral_sources
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_patient_staff_assignments_updated_at on public.patient_staff_assignments;
create trigger set_patient_staff_assignments_updated_at
before update on public.patient_staff_assignments
for each row execute function public.clair_set_updated_at();

alter table public.guardian_referral_sources enable row level security;
alter table public.guardian_duplicate_overrides enable row level security;
alter table public.patient_staff_assignments enable row level security;
alter table public.customer_profile_change_logs enable row level security;

create or replace view public.customer_profile_deletion_locks as
select
  appointment.workspace_id,
  'patient'::text as subject_type,
  appointment.patient_id as subject_id,
  'active_appointment'::text as lock_type,
  'public.appointments'::text as source_table,
  appointment.id as source_id,
  'Active appointment blocks patient soft delete.'::text as lock_reason
from public.appointments appointment
where appointment.status not in ('cancelled', 'checked_in', 'no_show')
union all
select
  appointment.workspace_id,
  'guardian'::text as subject_type,
  appointment.guardian_id as subject_id,
  'active_appointment'::text as lock_type,
  'public.appointments'::text as source_table,
  appointment.id as source_id,
  'Active appointment blocks guardian soft delete.'::text as lock_reason
from public.appointments appointment
where appointment.guardian_id is not null
  and appointment.status not in ('cancelled', 'checked_in', 'no_show')
union all
select
  encounter.workspace_id,
  'patient'::text as subject_type,
  encounter.patient_id as subject_id,
  'active_encounter'::text as lock_type,
  'public.encounters'::text as source_table,
  encounter.id as source_id,
  'Active encounter blocks patient soft delete.'::text as lock_reason
from public.encounters encounter
where encounter.status not in ('completed', 'cancelled')
union all
select
  encounter.workspace_id,
  'guardian'::text as subject_type,
  encounter.guardian_id as subject_id,
  'active_encounter'::text as lock_type,
  'public.encounters'::text as source_table,
  encounter.id as source_id,
  'Active encounter blocks guardian soft delete.'::text as lock_reason
from public.encounters encounter
where encounter.guardian_id is not null
  and encounter.status not in ('completed', 'cancelled')
union all
select
  queue_entry.workspace_id,
  'patient'::text as subject_type,
  encounter.patient_id as subject_id,
  'active_queue'::text as lock_type,
  'public.waiting_queue_entries'::text as source_table,
  queue_entry.id as source_id,
  'Active queue entry blocks patient soft delete.'::text as lock_reason
from public.waiting_queue_entries queue_entry
join public.encounters encounter
  on encounter.id = queue_entry.encounter_id
  and encounter.workspace_id = queue_entry.workspace_id
where queue_entry.status not in ('done', 'cancelled')
union all
select
  invoice.workspace_id,
  'guardian'::text as subject_type,
  invoice.guardian_id as subject_id,
  'open_invoice'::text as lock_type,
  'public.invoices'::text as source_table,
  invoice.id as source_id,
  'Open invoice blocks guardian soft delete.'::text as lock_reason
from public.invoices invoice
where invoice.guardian_id is not null
  and (invoice.status not in ('voided') or invoice.payment_state <> 'paid')
union all
select
  patient_guardian.workspace_id,
  'guardian'::text as subject_type,
  patient_guardian.guardian_id as subject_id,
  'active_primary_relationship'::text as lock_type,
  'public.patient_guardians'::text as source_table,
  patient_guardian.id as source_id,
  'Active primary relationship blocks guardian soft delete unless another active primary is assigned.'::text as lock_reason
from public.patient_guardians patient_guardian
join public.patients patient
  on patient.id = patient_guardian.patient_id
  and patient.workspace_id = patient_guardian.workspace_id
where patient_guardian.is_primary = true
  and patient_guardian.unlinked_at is null
  and patient.status = 'active';

comment on table public.guardian_referral_sources is
  'Synthetic customer-management referral source tags for guardian profiles.';
comment on table public.guardian_duplicate_overrides is
  'Synthetic duplicate guardian override decisions. Not an authorization source.';
comment on table public.patient_staff_assignments is
  'Workspace-scoped synthetic patient staff assignment rows for customer profile display.';
comment on table public.customer_profile_change_logs is
  'Local-first redacted customer profile change log for Project 06 relationship and profile edits.';
comment on view public.customer_profile_deletion_locks is
  'Derived soft-delete lock source for customer-management profile deletion checks. No hard delete behavior.';
