---
title: "Customer Management Persistence Scope"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-101"
  - "docs/work/customer/CUSTOMER-LIVE-PR-001-customer-management-persistence-scope.md"
  - "docs/product/demo-data/patient-guardian-data-v1.md"
  - "docs/product/demo-data/seed-handoff-v1.md"
---

# Customer Management Persistence Scope

Linear: DEN-101
Project: `06 Customer Management Persistence`

## Decision Summary

Project 06 should extend the minimal Project 03 reception patient/guardian schema into a customer-management master-data layer for the portfolio MVP.

The project should persist guardian profiles, animal patient profiles, relationship rows, consent/referral metadata, primary guardian transitions, soft delete/restore, and customer-management reads. It must stay synthetic and local-first. It must not import real guardian, animal, hospital, or medical data, and it must not add remote Supabase, production deploy, Kakao/message provider, payment, or hard-delete scope.

## Included MVP Persistence Scope

| Area | Included in Project 06 | Primary dependency |
| --- | --- | --- |
| Guardian profile | Read/update guardian name, birth date, normalized contact values, address parts, email parts, cash receipt demo fields, vehicle number, referral sources, memo, status, and update metadata. | Project 03 `guardians`; DEN-99 `patient-guardian-data-v1.md` |
| Patient profile | Read/update patient name, species, breed, mixed-breed flags, sex/neuter, birth or estimated age, weight, color, microchip, registration number, memo, status, primary vet assignment, and messaging eligibility. | Project 03 `patients`; DEN-99 `patient-guardian-data-v1.md` |
| Consent and referral rows | Persist guardian-level consent rows and referral tags as structured rows/arrays instead of one combined UI state. | Project 03 `consents`; DEN-99 consent contract |
| Patient-guardian relationships | Persist existing guardian links, additional guardian rows, primary guardian changes, relationship-only unlink, sort order, and relationship audit metadata. | Project 03 `patient_guardians` |
| Soft delete and restore | Soft-delete/restore guardian and patient master rows, keep identifiers reserved, and derive deletion locks from active appointments, encounters, invoices, and relationship state. | Reception/clinical/billing persisted rows |
| Customer management reads | Let customer-management tables and profile drawers read from the same persisted source used by reception/chart/billing context. | Existing customer UI and profile drawers |
| Regression and handoff | Add reload/regression coverage and a Project 06 handoff before Project 07 or later customer work consumes this source. | DEN-110 |

## Explicitly Out Of Scope

- Real guardian, animal, hospital, clinic, or staff data import.
- Actual resident registration number, legal identifier, financial identifier, or unmasked sensitive ID storage.
- KakaoTalk, SMS, email, push, or message-provider delivery.
- Remote Supabase link/push/query, staging/live migration, production deploy, or real data access.
- Hard delete of guardian, patient, relationship, consent, chart, billing, or audit history.
- Advanced duplicate merge, household/CRM segmentation, loyalty, deposit ledger, accounting export, or marketing automation.
- Role/permission policy changes beyond using the existing active membership and customer/reception read-write permissions.
- Chart, order, billing, inpatient, device, PACS, or PG provider workflow changes.

## Sensitive Data Boundary

Project 06 can store synthetic portfolio data only. Values that look sensitive must be either demo placeholders or display-safe masked values.

| Data family | Storage rule |
| --- | --- |
| Mobile phone | Store normalized demo phone digits for search and duplicate checks. Use synthetic numbers only. |
| Address | Store postal code/base/detail address parts only for synthetic demo profiles. Do not use real client addresses. |
| Email | Store normalized synthetic email only. |
| Cash receipt | Store `cash_receipt_type` and a synthetic placeholder number only when the demo field is enabled. Do not store real business or personal deduction identifiers. |
| Resident registration | Store masked display value plus non-real placeholder token only. Never store a real resident registration number. |
| Memo | Store internal memo text with length limits and no secrets/provider tokens/medical legal attestations. |
| Consent | Store consent status and document version metadata. Do not store actual signed files until storage/retention is scoped. |
| Deletion audit | Store actor/time/reason and lock reasons, but not raw provider payloads, secrets, or real IDs. |

## Project 03 Vs Project 06 Responsibility

| Responsibility | Project 03 Reception | Project 06 Customer Management |
| --- | --- | --- |
| Minimal guardian/patient creation | Yes, only enough for reception registration and encounter creation. | Reads and extends the resulting master rows. |
| Lookup for reception | Yes, active lookup and registration path. | May share read source, but does not redefine reception check-in. |
| Detailed guardian profile | No, deferred. | Yes, profile read/update boundary. |
| Detailed patient profile | No, deferred. | Yes, profile read/update boundary. |
| Relationship management | Minimal first link only. | Yes, add existing guardian, primary change, unlink relationship. |
| Soft delete/restore | No. | Yes, with locks and reserved identifiers. |
| Encounter/queue/calendar writes | Yes. | No, read only for deletion locks and profile context. |

## Fields Other Projects May Consume

Project 04 and later order/billing screens should consume only the minimal, display-safe patient/guardian fields they need:

- `workspaceId`
- `patientId`
- `patientNo`
- `patientName`
- `species`
- `primaryBreedName`
- `patientStatus`
- `guardianId`
- `guardianCode`
- `guardianName`
- `mobilePhoneNormalized` or display-formatted synthetic phone
- `primaryRelationshipId`
- `messageConsentStatus`
- `guardianPhoneAvailable`

Clinical/billing routes must keep using `workspaceId`, `encounterId`, active membership, and domain permissions as authorization sources. Patient or guardian profile fields are context, not authorization.

## Recommended Project 06 Order

1. DEN-102: plan patient/guardian profile schema delta from DEN-99.
2. DEN-105: implement customer profile schema migration.
3. DEN-106: persist guardian profile read/write boundary.
4. DEN-107: persist patient profile read/write boundary.
5. DEN-108: persist patient guardian relationship management.
6. DEN-109: persist customer soft delete, restore, and deletion locks.
7. DEN-110: add customer management persistence regression and handoff.

## Acceptance Guidance For DEN-102

DEN-102 can proceed when it:

- Uses this document and `docs/product/demo-data/patient-guardian-data-v1.md` as the scope boundary.
- Extends Project 03 tables without breaking existing reception lookup, registration, encounter, chart, billing, or demo fallback flows.
- Separates masked/synthetic sensitive fields from authorization and clinical workflow state.
- Plans deletion locks from persisted appointments, encounters, invoices, and relationships without hard-delete behavior.
- Keeps remote/live Supabase and real data approval-gated.

## Verification

- `npm run docs:check`
- `npm run security:secrets`
