-- DEN-56: reception domain schema foundation.
-- Local-first draft only. Remote Supabase application and domain RLS policy details are follow-up scopes.

create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  mobile_phone text,
  mobile_phone_normalized text,
  phone text,
  email extensions.citext,
  birth_date date,
  address text,
  occupation text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  patient_no text not null check (length(trim(patient_no)) > 0),
  name text not null check (length(trim(name)) > 0),
  species text not null check (
    species in (
      'dog',
      'cat',
      'rabbit',
      'ferret',
      'hamster',
      'guinea_pig',
      'hedgehog',
      'bird',
      'reptile',
      'turtle',
      'other'
    )
  ),
  breed text,
  birth_date date,
  estimated_age_text text,
  weight_kg numeric(6,2),
  sex text not null default 'unknown'
    check (sex in ('male', 'female', 'unknown')),
  neutered boolean,
  microchip_no text,
  patient_registration_no text,
  allergy_note text,
  special_note text,
  handling_caution_note text,
  handling_caution_locked boolean not null default true,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'deceased')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patient_guardians (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  relationship text,
  is_primary boolean not null default false,
  can_receive_messages boolean not null default true,
  created_at timestamptz not null default now(),
  unique (patient_id, guardian_id)
);

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  consent_type text not null
    check (consent_type in ('privacy', 'treatment', 'surgery', 'hospitalization', 'marketing', 'messaging')),
  status text not null default 'granted'
    check (status in ('granted', 'revoked')),
  signed_at timestamptz,
  revoked_at timestamptz,
  document_url text,
  created_at timestamptz not null default now(),
  check (status <> 'revoked' or revoked_at is not null)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete set null,
  assigned_veterinarian_id uuid references public.users(id) on delete set null,
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz,
  visit_purpose text,
  symptom_note text,
  status text not null default 'confirmed'
    check (status in ('requested', 'confirmed', 'changed', 'cancelled', 'checked_in', 'no_show')),
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end_at is null or scheduled_end_at > scheduled_start_at)
);

create table if not exists public.appointment_change_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  changed_by_user_id uuid references public.users(id) on delete set null,
  change_type text not null
    check (change_type in ('create', 'reschedule', 'cancel', 'assign_doctor', 'confirm', 'check_in', 'no_show')),
  reason text,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.encounters (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  primary_veterinarian_id uuid references public.users(id) on delete set null,
  encounter_no text not null check (length(trim(encounter_no)) > 0),
  reception_type text not null check (reception_type in ('walk_in', 'appointment')),
  department text,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  chief_complaint text,
  visit_purpose text,
  reception_memo text,
  status text not null default 'waiting'
    check (status in ('waiting', 'in_consultation', 'ordered', 'ready_for_billing', 'completed', 'cancelled')),
  checked_in_at timestamptz not null default now(),
  checked_in_by_user_id uuid references public.users(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (reception_type = 'walk_in' and appointment_id is null)
    or
    (reception_type = 'appointment' and appointment_id is not null)
  )
);

create table if not exists public.waiting_queue_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  queue_type text not null
    check (queue_type in ('reception', 'consultation', 'treatment', 'billing')),
  status text not null default 'waiting'
    check (status in ('waiting', 'called', 'in_progress', 'done', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('urgent', 'high', 'normal', 'low')),
  sort_order integer,
  entered_at timestamptz not null default now(),
  called_at timestamptz,
  finished_at timestamptz
);

create unique index if not exists guardians_workspace_mobile_phone_normalized_key
  on public.guardians (workspace_id, mobile_phone_normalized)
  where mobile_phone_normalized is not null and mobile_phone_normalized <> '';

create unique index if not exists guardians_workspace_id_key
  on public.guardians (workspace_id, id);

create unique index if not exists patients_workspace_patient_no_key
  on public.patients (workspace_id, patient_no);

create unique index if not exists patients_workspace_id_key
  on public.patients (workspace_id, id);

create unique index if not exists patients_workspace_microchip_no_key
  on public.patients (workspace_id, microchip_no)
  where microchip_no is not null and microchip_no <> '';

create unique index if not exists patients_workspace_patient_registration_no_key
  on public.patients (workspace_id, patient_registration_no)
  where patient_registration_no is not null and patient_registration_no <> '';

create unique index if not exists patient_guardians_workspace_patient_primary_key
  on public.patient_guardians (workspace_id, patient_id)
  where is_primary = true;

create unique index if not exists appointments_workspace_id_key
  on public.appointments (workspace_id, id);

create unique index if not exists encounters_appointment_id_key
  on public.encounters (appointment_id)
  where appointment_id is not null;

create unique index if not exists encounters_workspace_encounter_no_key
  on public.encounters (workspace_id, encounter_no);

create unique index if not exists encounters_workspace_id_key
  on public.encounters (workspace_id, id);

create unique index if not exists waiting_queue_entries_encounter_queue_type_key
  on public.waiting_queue_entries (encounter_id, queue_type);

create index if not exists guardians_workspace_name_idx
  on public.guardians (workspace_id, name);

create index if not exists guardians_workspace_mobile_phone_normalized_idx
  on public.guardians (workspace_id, mobile_phone_normalized)
  where mobile_phone_normalized is not null;

create index if not exists patients_workspace_name_idx
  on public.patients (workspace_id, name);

create index if not exists patients_workspace_status_idx
  on public.patients (workspace_id, status);

create index if not exists patient_guardians_workspace_guardian_idx
  on public.patient_guardians (workspace_id, guardian_id);

create index if not exists consents_workspace_guardian_idx
  on public.consents (workspace_id, guardian_id, consent_type, status);

create index if not exists appointments_workspace_start_idx
  on public.appointments (workspace_id, scheduled_start_at);

create index if not exists appointments_workspace_status_start_idx
  on public.appointments (workspace_id, status, scheduled_start_at);

create index if not exists appointments_workspace_patient_start_idx
  on public.appointments (workspace_id, patient_id, scheduled_start_at desc);

create index if not exists appointment_change_logs_workspace_appointment_idx
  on public.appointment_change_logs (workspace_id, appointment_id, created_at desc);

create index if not exists encounters_workspace_checked_in_idx
  on public.encounters (workspace_id, checked_in_at desc);

create index if not exists encounters_workspace_status_checked_in_idx
  on public.encounters (workspace_id, status, checked_in_at desc);

create index if not exists encounters_workspace_patient_checked_in_idx
  on public.encounters (workspace_id, patient_id, checked_in_at desc);

create index if not exists waiting_queue_entries_workspace_queue_status_idx
  on public.waiting_queue_entries (workspace_id, queue_type, status, entered_at);

create index if not exists waiting_queue_entries_workspace_encounter_idx
  on public.waiting_queue_entries (workspace_id, encounter_id);

alter table public.patient_guardians
  add constraint patient_guardians_patient_workspace_fk
  foreign key (workspace_id, patient_id) references public.patients(workspace_id, id)
  on delete cascade;

alter table public.patient_guardians
  add constraint patient_guardians_guardian_workspace_fk
  foreign key (workspace_id, guardian_id) references public.guardians(workspace_id, id)
  on delete cascade;

alter table public.consents
  add constraint consents_guardian_workspace_fk
  foreign key (workspace_id, guardian_id) references public.guardians(workspace_id, id)
  on delete cascade;

alter table public.consents
  add constraint consents_patient_workspace_fk
  foreign key (workspace_id, patient_id) references public.patients(workspace_id, id)
  on delete cascade;

alter table public.appointments
  add constraint appointments_patient_workspace_fk
  foreign key (workspace_id, patient_id) references public.patients(workspace_id, id)
  on delete cascade;

alter table public.appointments
  add constraint appointments_guardian_workspace_fk
  foreign key (workspace_id, guardian_id) references public.guardians(workspace_id, id);

alter table public.appointment_change_logs
  add constraint appointment_change_logs_appointment_workspace_fk
  foreign key (workspace_id, appointment_id) references public.appointments(workspace_id, id)
  on delete cascade;

alter table public.encounters
  add constraint encounters_patient_workspace_fk
  foreign key (workspace_id, patient_id) references public.patients(workspace_id, id)
  on delete cascade;

alter table public.encounters
  add constraint encounters_guardian_workspace_fk
  foreign key (workspace_id, guardian_id) references public.guardians(workspace_id, id);

alter table public.encounters
  add constraint encounters_appointment_workspace_fk
  foreign key (workspace_id, appointment_id) references public.appointments(workspace_id, id);

alter table public.waiting_queue_entries
  add constraint waiting_queue_entries_encounter_workspace_fk
  foreign key (workspace_id, encounter_id) references public.encounters(workspace_id, id)
  on delete cascade;

drop trigger if exists set_guardians_updated_at on public.guardians;
create trigger set_guardians_updated_at
before update on public.guardians
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_patients_updated_at on public.patients;
create trigger set_patients_updated_at
before update on public.patients
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
before update on public.appointments
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_encounters_updated_at on public.encounters;
create trigger set_encounters_updated_at
before update on public.encounters
for each row execute function public.clair_set_updated_at();

alter table public.guardians enable row level security;
alter table public.patients enable row level security;
alter table public.patient_guardians enable row level security;
alter table public.consents enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_change_logs enable row level security;
alter table public.encounters enable row level security;
alter table public.waiting_queue_entries enable row level security;

comment on table public.guardians is
  'Workspace-scoped guardian/customer rows for reception lookup and minimal registration.';
comment on table public.patients is
  'Workspace-scoped animal patient rows. First Project 03 domain persistence table.';
comment on table public.patient_guardians is
  'Workspace-scoped guardian-patient relationship. Server transactions must prevent cross-workspace links.';
comment on table public.consents is
  'Append-friendly consent records for privacy, messaging, marketing, and treatment consent state.';
comment on table public.appointments is
  'Workspace-scoped appointment rows. Check-in creates at most one linked encounter.';
comment on table public.appointment_change_logs is
  'Appointment state change log for reception operations. Not the full audit log.';
comment on table public.encounters is
  'Actual visit/care-work unit created by walk-in or appointment check-in.';
comment on table public.waiting_queue_entries is
  'Operational queue rows derived from encounters for reception, consultation, treatment, and billing.';
