---
id: ENGINEERING-AUTH-RECEPTION-DOMAIN-SCHEMA-EXTENSION-PLAN
status: approved
area: engineering
doc_type: data_model
related_work:
  - "DEN-55"
  - "docs/work/reception/RECEPTION-LIVE-PR-002-schema-extension-plan.md"
supersedes: []
superseded_by: []
last_updated: 2026-05-19
---

# Reception Domain Schema Extension Plan

Updated: 2026-05-19
Linear: DEN-55
Project: `03 Reception & Encounter Persistence`

## Executive Summary

Project 03 needs the first clinical domain schema extension under the existing workspace auth foundation.

The schema should stay narrow: only the reception path required to look up or minimally register a patient/guardian, check in a walk-in or appointment, and read the resulting encounter in the queue/calendar. This is not full customer management, chart, order, billing, audit, messaging provider, or production data work.

DEN-56 should implement this as a local-first migration and seed/test contract. Remote Supabase push/link, real patient or hospital data, and production deploy remain approval-gated.

## Proposed Tables

DEN-56 should add these tables:

1. `guardians`
2. `patients`
3. `patient_guardians`
4. `consents`
5. `appointments`
6. `appointment_change_logs`
7. `encounters`
8. `waiting_queue_entries`

The broad DB draft already describes these objects in `docs/engineering/data-model/emr-saas-db-structure-spec.ko.md`. This document narrows that draft for the first reception live persistence slice.

## Shared Schema Rules

- Every table that stores hospital-domain data must be workspace-scoped directly or through a required parent row.
- Direct workspace-scoped tables should include `workspace_id text not null references public.workspaces(id)`.
- Use `uuid primary key default gen_random_uuid()` for new domain rows.
- Use `created_at timestamptz not null default now()` and `updated_at timestamptz not null default now()` where rows are mutable.
- Reuse `public.clair_set_updated_at()` triggers for mutable tables.
- Use check constraints for MVP status values instead of unconstrained text.
- Add indexes for workspace-scoped reads before wiring UI readers.
- Do not use service-role credentials, remote Supabase, real clinic data, or actual patient data in this migration.

## Table Plan

### `guardians`

Minimum fields:

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid pk | Yes | Default `gen_random_uuid()`. |
| `workspace_id` | text fk | Yes | References `workspaces(id)`. |
| `name` | text | Yes | Trim before write. |
| `mobile_phone` | text | No | Main reception contact. |
| `mobile_phone_normalized` | text | No | Digits-only value for duplicate checks. |
| `phone` | text | No | Secondary phone. |
| `email` | extensions.citext | No | Optional in MVP. |
| `birth_date` | date | No | Existing UI supports it, but see privacy questions. |
| `address` | text | No | Optional customer data, not needed for encounter creation. |
| `occupation` | text | No | Existing broad data model field. |
| `memo` | text | No | Internal memo. Do not put secrets here. |
| `created_at` | timestamptz | Yes | DB default. |
| `updated_at` | timestamptz | Yes | Trigger-managed. |

Recommended indexes and constraints:

- Index `(workspace_id, name)`.
- Index `(workspace_id, mobile_phone_normalized)` where `mobile_phone_normalized is not null`.
- For MVP reception duplicate prevention, DEN-56 may add a partial unique index on `(workspace_id, mobile_phone_normalized)` where present. If this is too strict for real clinics, keep it as a server validation rule and document the exception.

### `patients`

Minimum fields:

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid pk | Yes | Default `gen_random_uuid()`. |
| `workspace_id` | text fk | Yes | References `workspaces(id)`. |
| `patient_no` | text | Yes | Human-facing number, unique per workspace. |
| `name` | text | Yes | Animal name. |
| `species` | text | Yes | Check against MVP species values. |
| `breed` | text | No | Free text or later catalog. |
| `birth_date` | date | No | Preferred when known. |
| `estimated_age_text` | text | No | For approximate age. |
| `sex` | text | Yes | `male`, `female`, `unknown`. |
| `neutered` | boolean | No | Optional. |
| `microchip_no` | text | No | Duplicate guard where present. |
| `patient_registration_no` | text | No | Existing UI field; unique per workspace when present. |
| `allergy_note` | text | No | Clinical safety note for future order work. |
| `special_note` | text | No | General patient note. |
| `handling_caution_note` | text | No | Internal caution. Do not expose to guardian-facing surfaces by default. |
| `handling_caution_locked` | boolean | Yes | Default `true`. |
| `status` | text | Yes | `active`, `inactive`, `deceased`. |
| `created_at` | timestamptz | Yes | DB default. |
| `updated_at` | timestamptz | Yes | Trigger-managed. |

Recommended indexes and constraints:

- Unique `(workspace_id, patient_no)`.
- Partial unique `(workspace_id, microchip_no)` where `microchip_no is not null and microchip_no <> ''`.
- Partial unique `(workspace_id, patient_registration_no)` where `patient_registration_no is not null and patient_registration_no <> ''`.
- Index `(workspace_id, name)`.
- Index `(workspace_id, status)`.

### `patient_guardians`

Minimum fields:

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid pk | Yes | Default `gen_random_uuid()`. |
| `workspace_id` | text fk | Yes | Store directly to simplify RLS and cross-workspace checks. |
| `patient_id` | uuid fk | Yes | References `patients(id)`. |
| `guardian_id` | uuid fk | Yes | References `guardians(id)`. |
| `relationship` | text | No | Example: primary guardian, family. |
| `is_primary` | boolean | Yes | Default `false`. |
| `can_receive_messages` | boolean | Yes | Default `true`. Not provider consent by itself. |
| `created_at` | timestamptz | Yes | DB default. |

Recommended indexes and constraints:

- Unique `(patient_id, guardian_id)`.
- Partial unique `(workspace_id, patient_id)` where `is_primary = true`.
- Index `(workspace_id, guardian_id)`.
- DEN-56 should prevent cross-workspace links either with composite FKs or transaction validation.

### `consents`

Minimum fields:

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid pk | Yes | Default `gen_random_uuid()`. |
| `workspace_id` | text fk | Yes | References `workspaces(id)`. |
| `guardian_id` | uuid fk | Yes | Consent actor. |
| `patient_id` | uuid fk | No | Null means guardian-level consent. |
| `consent_type` | text | Yes | `privacy`, `treatment`, `surgery`, `hospitalization`, `marketing`, `messaging`. |
| `status` | text | Yes | `granted`, `revoked`. |
| `signed_at` | timestamptz | No | Initial registration may set this. |
| `revoked_at` | timestamptz | No | Required when revoked later. |
| `document_url` | text | No | Mock/local document path only until storage is scoped. |
| `created_at` | timestamptz | Yes | DB default. |

Project 03 recommendation:

- Keep consent rows append-friendly rather than overwriting history.
- DEN-58 may write initial `privacy` and optional `marketing` consent rows from reception registration.
- Real e-signature, file storage, Kakao/message provider consent automation, and consent document retention policy remain out of scope.

### `appointments`

Minimum fields:

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid pk | Yes | Default `gen_random_uuid()`. |
| `workspace_id` | text fk | Yes | References `workspaces(id)`. |
| `patient_id` | uuid fk | Yes | Must belong to workspace. |
| `guardian_id` | uuid fk | No | Optional but validate if supplied. |
| `assigned_veterinarian_id` | uuid fk | No | References `users(id)`. Assignment can be empty. |
| `scheduled_start_at` | timestamptz | Yes | Calendar basis. |
| `scheduled_end_at` | timestamptz | No | Check greater than start when present. |
| `visit_purpose` | text | No | Display and encounter handoff. |
| `symptom_note` | text | No | Can seed encounter `chief_complaint`. |
| `status` | text | Yes | `requested`, `confirmed`, `changed`, `cancelled`, `checked_in`, `no_show`. |
| `created_by_user_id` | uuid fk | No | Actor user id. |
| `created_at` | timestamptz | Yes | DB default. |
| `updated_at` | timestamptz | Yes | Trigger-managed. |

Recommended indexes and constraints:

- Index `(workspace_id, scheduled_start_at)`.
- Index `(workspace_id, status, scheduled_start_at)`.
- Index `(workspace_id, patient_id, scheduled_start_at desc)`.
- Check `scheduled_end_at is null or scheduled_end_at > scheduled_start_at`.

### `appointment_change_logs`

Minimum fields:

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid pk | Yes | Default `gen_random_uuid()`. |
| `workspace_id` | text fk | Yes | Store directly for RLS and query filtering. |
| `appointment_id` | uuid fk | Yes | References `appointments(id)`. |
| `changed_by_user_id` | uuid fk | No | Actor user id. |
| `change_type` | text | Yes | `create`, `reschedule`, `cancel`, `assign_doctor`, `confirm`, `check_in`, `no_show`. |
| `reason` | text | No | Optional. |
| `before_value` | jsonb | No | Stable, non-secret snapshot. |
| `after_value` | jsonb | No | Stable, non-secret snapshot. |
| `created_at` | timestamptz | Yes | DB default. |

Project 03 recommendation:

- DEN-59 should write a `check_in` log when appointment check-in becomes live.
- This table is not a replacement for the future audit log project.

### `encounters`

Minimum fields:

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid pk | Yes | Default `gen_random_uuid()`. |
| `workspace_id` | text fk | Yes | References `workspaces(id)`. |
| `patient_id` | uuid fk | Yes | Must belong to workspace. |
| `guardian_id` | uuid fk | No | Validate link when present. |
| `appointment_id` | uuid fk | No | Null for walk-in. |
| `primary_veterinarian_id` | uuid fk | No | References `users(id)`. Unassigned is allowed. |
| `encounter_no` | text | Yes | Unique per workspace. |
| `reception_type` | text | Yes | `walk_in`, `appointment`. |
| `department` | text | No | Example: `진료`; source from reception form. |
| `duration_minutes` | integer | No | Calendar/load display. |
| `chief_complaint` | text | No | Symptom note or check-in complaint. |
| `visit_purpose` | text | No | Reception and chart header display. |
| `reception_memo` | text | No | Front desk memo. |
| `status` | text | Yes | `waiting`, `in_consultation`, `ordered`, `ready_for_billing`, `completed`, `cancelled`. |
| `checked_in_at` | timestamptz | Yes | Server time for Project 03 created encounters. |
| `checked_in_by_user_id` | uuid fk | No | Actor user id. |
| `started_at` | timestamptz | No | Future chart transition. |
| `completed_at` | timestamptz | No | Future billing/close transition. |
| `created_at` | timestamptz | Yes | DB default. |
| `updated_at` | timestamptz | Yes | Trigger-managed. |

Recommended indexes and constraints:

- Unique `(workspace_id, encounter_no)`.
- Partial unique `(appointment_id)` where `appointment_id is not null`.
- Index `(workspace_id, checked_in_at desc)`.
- Index `(workspace_id, status, checked_in_at desc)`.
- Index `(workspace_id, patient_id, checked_in_at desc)`.
- Check `duration_minutes is null or duration_minutes > 0`.
- Check appointment consistency in server transaction or DB function: appointment-linked encounters must use `reception_type = 'appointment'`; walk-in encounters must have `appointment_id is null`.

### `waiting_queue_entries`

Minimum fields:

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid pk | Yes | Default `gen_random_uuid()`. |
| `workspace_id` | text fk | Yes | References `workspaces(id)`. |
| `encounter_id` | uuid fk | Yes | References `encounters(id)`. |
| `queue_type` | text | Yes | `reception`, `consultation`, `treatment`, `billing`. |
| `status` | text | Yes | `waiting`, `called`, `in_progress`, `done`, `cancelled`. |
| `priority` | text | Yes | `urgent`, `high`, `normal`, `low`. |
| `sort_order` | integer | No | Optional manual ordering. |
| `entered_at` | timestamptz | Yes | Usually same as `checked_in_at` for first queue row. |
| `called_at` | timestamptz | No | Future queue action. |
| `finished_at` | timestamptz | No | Future queue action. |

Recommended indexes and constraints:

- Index `(workspace_id, queue_type, status, entered_at)`.
- Index `(workspace_id, encounter_id)`.
- Optional unique `(encounter_id, queue_type)` for the first implementation if the product only allows one active row per queue type.

## Status Mapping

| Source type | Current code values | DB values for Project 03 |
| --- | --- | --- |
| `PatientStatus` | `active`, `inactive`, `deceased` | Same. |
| `ConsentType` | `privacy`, `treatment`, `surgery`, `hospitalization`, `marketing`, `messaging` | Same. |
| `ConsentStatus` | `granted`, `revoked` | Same. |
| `AppointmentStatus` | `requested`, `confirmed`, `changed`, `cancelled`, `checked_in`, `no_show` | Same. |
| `EncounterStatus` | `waiting`, `in_consultation`, `ordered`, `ready_for_billing`, `completed`, `cancelled` | Same. |
| `WaitingQueueType` | `reception`, `consultation`, `treatment`, `billing` | Same. |
| `WaitingQueueStatus` | `waiting`, `called`, `in_progress`, `done`, `cancelled` | Same. |
| `OrderPriority` as queue priority | `urgent`, `high`, `normal`, `low` | Same. Rename later only if queue priority diverges. |

Do not introduce Korean label values into the DB status columns. Korean labels stay in UI/status mapper code.

## Mock Domain To DB Mapping

| TypeScript/mock field | DB column | Notes |
| --- | --- | --- |
| `workspaceId` | `workspace_id` | Must match route workspace scope. |
| `Guardian.mobilePhone` | `guardians.mobile_phone` | Also populate normalized value. |
| `Guardian.birthDate` | `guardians.birth_date` | Privacy question remains. |
| `Patient.patientNo` | `patients.patient_no` | Unique per workspace. |
| `Patient.microchipNo` | `patients.microchip_no` | Partial unique when present. |
| `Patient.patientRegistrationNo` | `patients.patient_registration_no` | Add to DB plan; broad draft missed it. |
| `Patient.handlingCautionLocked` | `patients.handling_caution_locked` | Default true. |
| `PatientGuardian.canReceiveMessages` | `patient_guardians.can_receive_messages` | Not equivalent to legal provider consent. |
| `Consent.consentType` | `consents.consent_type` | Same enum values. |
| `Appointment.assignedVeterinarianId` | `appointments.assigned_veterinarian_id` | References `users(id)`. |
| `Appointment.scheduledStartAt` | `appointments.scheduled_start_at` | Timestamptz. |
| `Appointment.symptomNote` | `appointments.symptom_note` | Can seed encounter complaint. |
| `Encounter.primaryVeterinarianId` | `encounters.primary_veterinarian_id` | Optional. |
| `Encounter.encounterNo` | `encounters.encounter_no` | Unique per workspace. |
| `Encounter.checkedInAt` | `encounters.checked_in_at` | Required for Project 03 writes. |
| `ReceptionDraftCheckIn.receptionType` | `encounters.reception_type` | New DB field. |
| `ReceptionDraftCheckIn.department` | `encounters.department` | New DB field. |
| `ReceptionDraftCheckIn.durationMinutes` | `encounters.duration_minutes` | New DB field. |
| `ReceptionDraftCheckIn.memo` | `encounters.reception_memo` | New DB field. |
| `WaitingQueueEntry.queueType` | `waiting_queue_entries.queue_type` | Same enum values. |
| `WaitingQueueEntry.enteredAt` | `waiting_queue_entries.entered_at` | Timestamptz. |

## RLS And Server Enforcement Split

DEN-55 does not implement RLS policies.

Recommended split:

| Follow-up | Responsibility |
| --- | --- |
| DEN-56 | Create local-first schema, constraints, indexes, updated-at triggers, and seed/test fixtures. Enable RLS only if the migration also documents the no-policy/route-owned access posture. |
| DEN-57/DEN-58 | Use server-owned readers/writers or DB functions; no direct client trust. |
| DEN-60/DEN-59 | Use transaction boundaries for walk-in and appointment check-in writes. |
| DEN-61 | Add explicit workspace and role permission enforcement for reception mutations and finalize the RLS policy baseline if it was not included earlier. |

Domain RLS should mirror the auth foundation principle: active workspace membership is the minimum read boundary, and route/server permission checks own mutation authorization.

## Privacy And Consent Questions

Open questions for 승욱 or future Human Review:

1. Should guardian `birth_date` be stored in the first reception live slice, or deferred until a clearer business need exists?
2. Should guardian `mobile_phone` be unique per workspace in the DB, or should duplicate phone stay a server/UI warning to support families sharing a phone?
3. Which consent is mandatory for minimal live reception registration: `privacy` only, or `privacy` plus `messaging` when check-in message simulation is enabled?
4. Should `marketing` consent be allowed in Project 03, or deferred because it is not required for medical reception?
5. Should `document_url` remain a mock/local placeholder until storage and retention policy are scoped?
6. Should `reception_memo` and guardian `memo` have length limits or sensitive-info warnings before live clinic use?

Default for DEN-56:

- Do not require guardian birth date.
- Do not store real consent document files.
- Keep `privacy` consent as the only clearly required registration consent.
- Keep `marketing` and `messaging` optional and explicit.
- Use synthetic seed data only.

## DEN-56 Acceptance Guidance

DEN-56 should be considered implementable when it can:

- Add the proposed tables without touching remote Supabase.
- Apply the migration to Docker local Supabase.
- Seed only synthetic guardian/patient/appointment/encounter data.
- Prove constraints for same-workspace links, appointment duplicate encounter protection, status checks, and key uniqueness.
- Leave UI and route implementation for later DEN issues.

## Verification

- `npm run docs:check`
