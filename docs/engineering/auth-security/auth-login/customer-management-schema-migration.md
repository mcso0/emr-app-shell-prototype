---
title: "Customer Management Schema Migration"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-105"
  - "docs/work/customer/CUSTOMER-LIVE-PR-003-customer-schema-migration.md"
  - "docs/engineering/auth-security/auth-login/customer-management-schema-delta-plan.md"
  - "supabase/migrations/20260520140000_customer_management_schema_delta.sql"
---

# Customer Management Schema Migration

Linear: DEN-105
Project: `06 Customer Management Persistence`

## Summary

DEN-105 implements the local-first customer-management schema foundation on top of Project 03 reception persistence.

The migration extends the existing Project 03 master tables instead of creating parallel customer master tables. It adds customer-profile columns to `guardians`, `patients`, `patient_guardians`, and `consents`, then adds support tables for referral sources, duplicate override decisions, staff assignments, and redacted profile change logs.

Remote Supabase, production deploy, provider integration, actual identifiers, imported client/patient data, and hard deletes were not used.

## Migration

Migration file:

- `supabase/migrations/20260520140000_customer_management_schema_delta.sql`

Extended tables:

| Table | Added responsibility |
| --- | --- |
| `public.guardians` | Guardian code, contact/address/email parts, cash receipt demo fields, masked resident-number placeholder fields, vehicle number, status, soft-delete/restore audit, and last editor. |
| `public.patients` | Breed split, mixed-breed data, estimated age parts, weight/color, microchip type, customer memo, primary vet, message consent, synthetic messaging code, deceased/soft-delete/restore audit, and last editor. |
| `public.patient_guardians` | Relationship label, message-consent state, sendability snapshot, sort order, link/unlink actor, primary-change audit, and updated timestamp. |
| `public.consents` | Source surface, document version, consent/refusal timestamps, updated timestamp, and expanded status/type compatibility. |

New support tables:

| Table | Purpose |
| --- | --- |
| `public.guardian_referral_sources` | Multi-select synthetic guardian referral tags. |
| `public.guardian_duplicate_overrides` | Duplicate guardian creation override decisions. |
| `public.patient_staff_assignments` | Patient-level veterinarian/staff assignment rows. |
| `public.customer_profile_change_logs` | Redacted local-first profile, relationship, soft-delete, restore, and consent change history. |

Read-only derived source:

- `public.customer_profile_deletion_locks` derives soft-delete blockers from appointments, encounters, waiting queue entries, invoices, and active primary guardian relationships.

## Safety Boundaries

- The migration preserves the existing `patient_guardians(patient_id, guardian_id)` uniqueness used by Project 03 seed and registration compatibility.
- New tables are workspace-scoped and RLS-enabled, with the same no-policy local-first posture used by prior domain migrations.
- No signed consent files, provider payloads, raw resident registration values, actual cash receipt identifiers, or imported live records are introduced.
- Soft delete and unlink fields are added; no hard-delete operation is introduced.

## Seed Contract

`supabase/seed.sql` now includes a DEN-105 synthetic customer-management fixture:

- guardian profile fields with masked resident-number and cash receipt placeholders
- patient profile fields and primary vet assignment
- relationship metadata
- consent metadata
- referral source rows
- patient staff assignment row
- customer profile change-log row

The fixture is local-only and synthetic.

## Verification Notes

Focused static coverage lives in `tests/customer-management-schema-migration.spec.ts`.

Fresh verification:

- `npx playwright test tests/customer-management-schema-migration.spec.ts --reporter=line` (`5 passed`)
- `npx playwright test tests/customer-management-schema-migration.spec.ts tests/reception-domain-schema-migration.spec.ts --reporter=line` (`11 passed`)
- `npm run docs:check`
- `npm run security:secrets`

SQL runtime replay with Docker-backed local Supabase was not run in this pass; this work follows the existing static migration verification posture.

## Follow-Up

Next Project 06 work should continue with DEN-106, the guardian profile read/write boundary, using this migration as the persisted source and keeping remote Supabase and real data approval-gated.
