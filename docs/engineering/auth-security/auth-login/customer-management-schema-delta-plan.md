---
title: "Customer Management Schema Delta Plan"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-102"
  - "docs/work/customer/CUSTOMER-LIVE-PR-002-customer-schema-delta-plan.md"
  - "docs/engineering/auth-security/auth-login/customer-management-persistence-scope.md"
  - "docs/product/demo-data/patient-guardian-data-v1.md"
  - "docs/product/demo-data/seed-handoff-v1.md"
  - "supabase/migrations/20260519090000_reception_domain_schema_foundation.sql"
---

# Customer Management Schema Delta Plan

Linear: DEN-102
Project: `06 Customer Management Persistence`

## Decision Summary

DEN-102 plans the local-first schema delta that DEN-105 should implement on top of Project 03 reception persistence.

Project 03 already created the minimal `guardians`, `patients`, `patient_guardians`, and `consents` tables for reception registration, lookup, appointment, encounter, and queue work. Project 06 should extend those same master rows for customer-management profile editing instead of creating parallel customer tables.

The migration should keep existing reception, chart, order, billing, and audit readers compatible. New customer-management fields must remain workspace-scoped, synthetic-data-only, and display-safe. Real resident registration numbers, real cash receipt identifiers, provider payloads, remote Supabase, production deploy, and hard deletes stay out of scope.

## Existing Project 03 Baseline

| Table | Project 03 current responsibility | Customer gap |
| --- | --- | --- |
| `guardians` | Minimal owner/customer lookup and registration: name, phone, email, birth date, flat address, occupation, memo. | Missing guardian code, address parts, email parts, additional phones, cash receipt demo fields, masked resident-number placeholders, vehicle number, referral metadata, duplicate override audit, and soft-delete/restore fields. |
| `patients` | Minimal animal-patient registration and reception context: patient number, name, species, breed, age, sex/neuter, identifiers, notes, status. | Missing split breed fields, mixed-breed rows, estimated age parts, weight/color, microchip type, primary vet assignment, message eligibility, status audit, customer memo, soft-delete/restore, and display-safe Kakao demo code. |
| `patient_guardians` | Minimal link row and primary guardian marker. | Missing relationship label normalization, message-consent state, ordering, unlink audit, primary-change audit, and updated-at metadata. |
| `consents` | Minimal consent rows for privacy/treatment/surgery/hospitalization/marketing/messaging. | Missing `unknown`/`refused` status mapping, source surface, document version, consent/refusal timestamps, and a no-signed-file storage boundary. |

## Proposed Column Deltas

### `guardians`

Add scalar profile columns to `public.guardians` because they are one-to-one with the guardian master record.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `guardian_code` | text | Yes after backfill | Staff-facing synthetic code such as `C01234`; unique per workspace. |
| `additional_phone_numbers` | jsonb | No | Array of up to two synthetic contact values. Use `[]` default if easier for serializers. |
| `postal_code` | text | No | Synthetic address part. |
| `address_line1` | text | No | Synthetic base address. |
| `address_line2` | text | No | Synthetic detail address. |
| `email_local_part` | text | No | Optional edit-state field; `email` remains normalized display/search value. |
| `email_domain_mode` | text | No | `preset` or `direct_input`. |
| `email_domain` | text | No | Synthetic domain text. |
| `cash_receipt_type` | text | Yes | `none`, `personal_income_deduction`, or `business_income_deduction`; default `none`. |
| `cash_receipt_number` | text | No | Synthetic placeholder only. Required by route validation when type is not `none`; do not store real deduction identifiers. |
| `resident_registration_number_masked` | text | No | Display-safe synthetic masked value only. |
| `resident_registration_number_token` | text | No | Non-real placeholder token only. |
| `vehicle_number` | text | No | Synthetic parking/display value. |
| `status` | text | Yes | `active` or `soft_deleted`; default `active`. |
| `deleted_at`, `deleted_by_user_id`, `deleted_reason` | timestamptz / uuid / text | No | Soft-delete audit. No hard delete. |
| `restored_at`, `restored_by_user_id` | timestamptz / uuid | No | Restore audit. |
| `last_updated_by_user_id` | uuid | No | Last profile edit actor. |

Constraints and indexes:

- Add unique partial index `(workspace_id, guardian_code)` where `guardian_code` is not null.
- Keep the existing `(workspace_id, mobile_phone_normalized)` duplicate guard.
- Add `cash_receipt_type`, `email_domain_mode`, and `status` check constraints.
- Add `(workspace_id, status, updated_at desc)` index.
- Keep strict cash receipt number conditional validation in routes unless seed backfill is ready for a DB check.

### `patients`

Add patient profile columns to `public.patients`. Keep existing Project 03 columns stable for reception and chart/billing readers.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `primary_breed_id` | text | No | Main breed preset id from synthetic demo data. |
| `primary_breed_name` | text | No | Display snapshot. Existing `breed` can remain as compatibility fallback. |
| `is_mixed_breed` | boolean | Yes | Default `false`. |
| `additional_breed_ids` | jsonb | No | Up to two breed ids for registration demo. |
| `estimated_age_years`, `estimated_age_months`, `estimated_age_days` | integer | No | Numeric age parts when exact birth date is absent. |
| `age_is_estimated` | boolean | Yes | Default `false`. |
| `weight_kg` | numeric(6,2) | No | Positive when present. |
| `color` | text | No | Coat color label. |
| `microchip_type` | text | Yes | `none`, `internal`, or `external`; default `none`. |
| `profile_memo` | text | No | Customer-management memo; Project 03 notes remain operational. |
| `primary_attending_vet_id` | uuid | No | References `users(id)` with `on delete set null`. |
| `message_consent_status` | text | Yes | `granted`, `refused`, or `unknown`; default `granted` for synthetic demo patients. |
| `kakao_patient_code` | text | No | Synthetic display code only; no provider integration. |
| `deceased_at`, `deceased_by_user_id` | timestamptz / uuid | No | Death-state audit. |
| `deleted_at`, `deleted_by_user_id`, `deleted_reason` | timestamptz / uuid / text | No | Soft-delete audit. |
| `restored_at`, `restored_by_user_id` | timestamptz / uuid | No | Restore audit. |
| `last_updated_by_user_id` | uuid | No | Last profile edit actor. |

Status and indexes:

- Expand `patients.status` to include `soft_deleted`.
- Keep `inactive` until existing mock/UI references are retired.
- Add checks for `microchip_type`, `message_consent_status`, non-negative age parts, and positive `weight_kg`.
- Add indexes for `(workspace_id, primary_attending_vet_id)`, `(workspace_id, status, updated_at desc)`, and unique optional `(workspace_id, kakao_patient_code)`.

### `patient_guardians`

Extend relationship rows instead of introducing a separate relationship table.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `relationship_label` | text | No | `primary`, `additional`, `family`, or free-label snapshot. Existing `relationship` remains compatibility fallback. |
| `message_consent_status` | text | Yes | `granted`, `refused`, or `unknown`; default derives from `can_receive_messages`. |
| `message_refused_at` | timestamptz | No | Set when relationship-level messaging is refused. |
| `guardian_phone_available` | boolean | Yes | Derived snapshot for sendability display; route can recompute from guardian phone. |
| `sort_order` | integer | Yes | Default `0`; primary relationship should sort first. |
| `linked_by_user_id` | uuid | No | Actor who linked guardian and patient. |
| `unlinked_at`, `unlinked_by_user_id` | timestamptz / uuid | No | Relationship soft delete. Guardian and patient master rows remain. |
| `primary_changed_at`, `primary_changed_by_user_id` | timestamptz / uuid | No | Audit for primary guardian transitions. |
| `updated_at` | timestamptz | Yes | Updated-at trigger target. |

Constraints and indexes:

- Prefer active-link uniqueness: `(workspace_id, patient_id, guardian_id) where unlinked_at is null`.
- Keep one active primary guardian per patient: `(workspace_id, patient_id) where is_primary = true and unlinked_at is null`.
- Add `(workspace_id, guardian_id, unlinked_at)` and `(workspace_id, patient_id, sort_order)` indexes.
- Add check constraints for `message_consent_status` and non-negative `sort_order`.

### `consents`

Keep `public.consents` as the guardian/patient consent source, but adjust it for customer-management consent rows.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `source_surface` | text | Yes | `guardian_registration`, `guardian_detail_edit`, or `future_signing_surface`. |
| `document_version` | text | Yes | Synthetic policy/document version string. |
| `consented_at` | timestamptz | No | Alias/new field for granted state; existing `signed_at` can backfill it. |
| `refused_at` | timestamptz | No | Customer wording for refusal; existing `revoked_at` can backfill it where needed. |
| `updated_at` | timestamptz | Yes | Add updated-at trigger. |

Status/type changes:

- Expand `consents.status` to `granted`, `refused`, and `unknown`.
- Keep migration compatibility with existing `revoked` rows by mapping them to `refused` during DEN-105 or temporarily allowing both values if a two-step migration is safer.
- Add or alias product consent types: `personal_data_collection`, `third_party_sharing`, and `marketing_messages`.
- Do not store signed files or real document URLs in Project 06.

## Proposed New Tables

| Table | Reason | Notes |
| --- | --- | --- |
| `guardian_referral_sources` | Referral is multi-select and filterable. | Columns: `id`, `workspace_id`, `guardian_id`, `source_type`, `source_other_text`, timestamps. Unique `(workspace_id, guardian_id, source_type)`. |
| `guardian_duplicate_overrides` | Duplicate acceptance should be audit-style, not a mutable guardian array. | Columns: `id`, `workspace_id`, `guardian_id`, `candidate_guardian_ids` jsonb, `accepted_by_user_id`, `accepted_at`, `reason`. |
| `patient_staff_assignments` | A patient can have multiple active vets/staff rows. | Columns: `id`, `workspace_id`, `patient_id`, `staff_id`, `staff_display_name`, `department_label`, `assignment_role`, `sort_order`, `is_active`, timestamps. One active primary per patient. |
| `customer_profile_change_logs` | Relationship changes, profile edits, soft delete, restore, and consent changes need local traceability. | Not the full Project 05 audit surface. Store redacted synthetic `before_value` and `after_value` only. |

## Deletion Lock Source

Deletion locks should be derived from existing persisted operational rows, not hand-entered flags.

| Lock source | Guardian lock | Patient lock | Notes |
| --- | --- | --- | --- |
| Active appointment | Yes when guardian is linked to appointment or active patient. | Yes. | Status not in `cancelled`, `no_show`, or completed-equivalent. |
| Active encounter | Yes through linked patient or encounter guardian. | Yes. | Status not in `completed` or `cancelled`. |
| Waiting queue entry | Yes through encounter patient/guardian. | Yes. | Status not in `done` or `cancelled`. |
| Invoice or billing candidate | Yes when unpaid/open balance exists. | Yes. | Use Project 04 billing tables when present; DEN-105 can defer exact SQL if names are unstable. |
| Active primary relationship | Yes when deleting guardian would leave an active patient without a primary guardian. | No. | Relationship unlink is allowed only when another active primary exists or the patient is also soft-deleted. |

Recommended DEN-105 shape:

- Add a read-only SQL view or route-level query named conceptually `customer_profile_deletion_locks`.
- Return `workspace_id`, `subject_type`, `subject_id`, `lock_type`, `source_table`, `source_id`, and `lock_reason`.
- Do not persist lock rows unless later workflow needs manual override.
- Do not hard-delete any profile, relationship, consent, chart, billing, or audit history.

## UX-Only Or Deferred Data

Do not add these to DEN-105 unless a later issue explicitly scopes them:

- Active drawer tab, hover state, sort popover state, unsaved-change modal state, and selected sidebar filters.
- KakaoTalk/SMS/email provider payloads or delivery results.
- Actual signed consent files and storage retention policy.
- Household segmentation, loyalty, deposit ledger, accounting export, or marketing automation tags.
- Full duplicate merge history beyond duplicate override decision rows.
- Inpatient, surgery/anesthesia, PACS, device, and PG provider state beyond deletion-lock reads from already persisted tables.

## DEN-105 Migration Acceptance Criteria

DEN-105 should be accepted when:

1. The migration extends Project 03 tables rather than creating parallel customer master tables.
2. All new tables include `workspace_id`, same-workspace foreign keys, timestamps, and RLS enablement consistent with the local-first no-policy posture used in DEN-56.
3. Guardian, patient, relationship, consent, referral, staff assignment, and change-log deltas are covered by static migration tests.
4. Existing Project 03 tests and seed inserts still pass without requiring real data.
5. The seed remains synthetic and does not include real resident registration numbers, real cash receipt identifiers, real phone/address/email data, provider payloads, or production IDs.
6. Remote Supabase, production deploy, staging migration, and real data access remain approval-gated.

## Open Decisions Before Route Work

- Whether `cash_receipt_number` conditional requirement should be a DB check or only route validation for easier mock seed evolution.
- Whether `consents.status = 'revoked'` is migrated immediately to `refused` or temporarily allowed as a legacy value.
- Whether `customer_profile_change_logs` should stay a Project 06 table or emit through the Project 05 audit helper once route code is implemented.
- Whether the deletion-lock view should include Project 04 billing tables in the first migration or wait until DEN-109.

## Verification

- `npm run docs:check`
- `npm run security:secrets`
