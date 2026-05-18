---
id: ENGINEERING-AUTH-RECEPTION-ENCOUNTER-PERSISTENCE-CONTRACT
status: approved
area: engineering
doc_type: contract
related_work:
  - "DEN-54"
  - "docs/work/reception/RECEPTION-LIVE-PR-001-encounter-persistence-contract.md"
supersedes: []
superseded_by: []
last_updated: 2026-05-18
---

# Reception Encounter Persistence Contract

Updated: 2026-05-18
Linear: DEN-54
Project: `03 Reception & Encounter Persistence`

## Executive Summary

Project 03 should start reception persistence with the encounter as the first workspace-scoped clinical data boundary.

The first live slice is not full customer management or chart persistence. It is the minimum safe path where a receptionist can find or create the needed patient/guardian context, check in a walk-in or appointment, and see the persisted encounter in the queue and calendar after reload.

Project 03 remains local-first until 승욱 separately approves remote Supabase, staging/live migration, real clinic data, or production deployment.

## Scope Decision

Included in Project 03:

- Patient/guardian lookup boundary for reception use.
- Minimal patient/guardian registration needed to complete reception.
- Walk-in encounter creation.
- Appointment check-in to encounter transition.
- Workspace-scoped read access for reception queue and day calendar.
- Mock/session fallback and sales demo preservation.
- Handoff fields for chart, order, and billing persistence.

Out of scope:

- Full customer management CRUD.
- Full appointment CRUD, drag/drop scheduling, no-show automation, and reminder provider rollout.
- SOAP/chart, diagnosis, order, lab, imaging, dispensing, treatment, and billing persistence.
- Audit log persistence beyond hook points.
- Remote Supabase push/link, real patient or hospital data, production deploy, email/Kakao provider effects, payment/subscription effects.

## Source Dependencies

Project 03 may rely on the Project 02 contract:

- Server actor identity comes from `readServerSession()`.
- Demo actor headers are allowed only in mock fallback mode.
- `workspaceId` is a server-enforced scope, not a trusted client claim.
- Active workspace membership is the minimum boundary for workspace-scoped domain reads.
- Role and permission authority comes from membership and permission policy sources.
- Personal profile data is display-only and must not authorize clinical access.
- Protected mutation routes should use route-level rate limiting and typed response envelopes with safe errors.

Reference docs:

- `docs/engineering/auth-security/auth-login/reception-persistence-workspace-context-handoff.md`
- `docs/engineering/auth-security/auth-login/workspace-member-server-route-contract.md`
- `docs/engineering/auth-security/auth-login/api-error-telemetry-contract.md`
- `docs/product/features/reception-appointment-spec.md`
- `docs/engineering/data-model/emr-saas-db-structure-spec.ko.md`

## Encounter Creation Boundary

### Walk-In Check-In

A walk-in check-in creates an encounter without an appointment.

Required behavior:

1. Resolve server session.
2. Validate the actor has active membership in `workspaceId`.
3. Validate the actor has the reception mutation permission.
4. Validate `patientId` belongs to the same workspace and is active.
5. Validate `guardianId`, when supplied, belongs to the same workspace and is linked to the patient.
6. Create one encounter with `appointment_id = null`.
7. Create the initial consultation queue entry for that encounter.
8. Return the persisted encounter and queue row using the shared API envelope.

Initial encounter status:

- `encounters.status = waiting`
- `waiting_queue_entries.queue_type = consultation`
- `waiting_queue_entries.status = waiting`

### Appointment Check-In

An appointment check-in converts a confirmed appointment into an operational encounter.

Required behavior:

1. Resolve server session.
2. Validate active membership and reception mutation permission.
3. Validate the appointment belongs to `workspaceId`.
4. Validate the appointment status is check-in ready, normally `confirmed` or a future approved equivalent.
5. Create one encounter linked by `appointment_id`.
6. Update `appointments.status` to `checked_in`.
7. Create the initial consultation queue entry.
8. Complete the appointment update and encounter creation in one transaction boundary.

Duplicate protection:

- The database contract should allow at most one encounter per appointment.
- A repeated check-in request must not create a second encounter.
- The UI may reselect the existing encounter after a duplicate-safe server response, but the server must remain the source of truth.

## Field Contract

### Encounter Fields Required For Project 03

| Field | Required | Source | Notes |
| --- | --- | --- | --- |
| `id` | Yes | DB | UUID primary key. |
| `workspace_id` | Yes | Route/server scope | Must match active membership scope. |
| `patient_id` | Yes | Selected or newly registered patient | Patient must belong to the workspace. |
| `guardian_id` | Optional but recommended | Selected guardian or primary guardian | Must be same workspace and linked to patient when present. |
| `appointment_id` | Optional | Appointment check-in only | Null for walk-in encounters. |
| `primary_veterinarian_id` | Optional | Appointment or check-in form | Unassigned veterinarian is allowed. |
| `encounter_no` | Yes | Server-generated | Human-readable encounter number. |
| `visit_purpose` | Optional | Appointment or check-in form | Used by reception, chart header, and handoff. |
| `chief_complaint` | Optional | Symptom note or check-in text | Can mirror visit purpose until chart persistence separates it. |
| `status` | Yes | Server | Starts as `waiting`. |
| `checked_in_at` | Yes for checked-in encounters | Server clock | Basis for wait time. |
| `created_at` | Yes | DB | Server-generated. |
| `updated_at` | Yes | DB | Server-generated. |

### Fields DEN-55 Should Consider Adding

The current broad DB draft does not yet cover every reception field used by the session prototype. DEN-55 should decide whether these become columns or auxiliary metadata:

| Field | Why it matters |
| --- | --- |
| `checked_in_by_user_id` | Audit and operational accountability for reception mutation. |
| `department` | Reception form and future scheduling/reporting. |
| `reception_memo` | Front desk note that should not be lost before chart persistence. |
| `reception_type` | Distinguish `walk_in` from `appointment` without inferring only from `appointment_id`. |
| `duration_minutes` | Calendar display and scheduling load estimate. |

Do not store role, permission, service-role secret, raw provider payload, or patient-sensitive free text in fields that are meant only for authorization or telemetry.

## Dependency Map

| Dependency | Needed for | Project 03 decision |
| --- | --- | --- |
| Workspace active membership | All reads and writes | Required minimum boundary. |
| Permission policies | Reception mutations and reads | Use membership/permission source, not profile fields. |
| Patient | Encounter creation | Must exist before encounter write. |
| Guardian | Queue/calendar display and communication context | Optional on encounter, but validate when supplied. |
| Patient guardian link | Guardian-patient integrity | Required when a guardian is attached to the encounter. |
| Appointment | Appointment check-in | Required only for appointment flow; walk-in uses null appointment. |
| Waiting queue entry | Reception queue, chart entry, billing handoff | Create with encounter for check-in flows. |
| Message delivery | Kakao/message simulation | Preserve mock fallback; real provider remains out of scope. |

## Permission Contract

Project 03 must not change product role policy in this first scope issue. It should use the existing permission model unless a later issue explicitly scopes a policy decision.

Recommended first-pass mapping:

| Operation | Minimum server boundary |
| --- | --- |
| Search patient/guardian for reception | Active membership plus `reception:view` or `patient:view`, finalized in DEN-57. |
| Register minimal patient/guardian from reception | Active membership plus `reception:create`; DEN-58 should decide whether `patient:create` is also required. |
| Create walk-in encounter | Active membership plus `reception:create`. |
| Check in appointment | Active membership plus `reception:create` or `reception:update`; DEN-59 should finalize the exact action. |
| Read queue/calendar | Active membership plus `reception:view`. |
| Assign veterinarian or update queue status | Active membership plus `reception:update`; later issue only. |

Non-members, inactive members, and cross-workspace requests must be denied from the server route even if the UI hides actions.

## Response And Error Contract

Project 03 routes should use the DEN-96 envelope:

```json
{
  "ok": true,
  "requestId": "req_...",
  "data": {}
}
```

Failure responses must use stable categories and must not include raw SQL errors, secrets, invite tokens, cookies, authorization headers, stack traces, service role keys, DB passwords, or provider response bodies.

Reception-specific denial reasons may include:

| Reason | Use for |
| --- | --- |
| `patient_unavailable` | Patient is missing, inactive, or outside workspace scope. |
| `guardian_unavailable` | Guardian is missing or outside workspace scope. |
| `patient_guardian_link_missing` | Supplied guardian is not linked to the patient. |
| `appointment_unavailable` | Appointment is missing or outside workspace scope. |
| `appointment_not_checkin_ready` | Appointment status cannot be checked in. |
| `encounter_duplicate` | Request would create a duplicate appointment encounter. |
| `workspace_membership_missing` | Actor is not a member of the workspace. |
| `workspace_membership_inactive` | Actor membership is not active. |
| `permission_missing` | Actor lacks the required permission. |

## Mock Fallback And Demo Preservation

Project 03 must preserve:

- `NEXT_PUBLIC_AUTH_MODE=mock` local demo behavior.
- Existing `draftCheckIns` session-only behavior until each route-backed handoff replaces it.
- Sales demo golden path and `kong-vomit` query context.
- Mock patient, guardian, appointment, encounter, queue, and message fixture readability.

Supabase mode must not silently fall back to browser storage when a protected live route has no valid server session.

## Chart, Order, And Billing Handoff Fields

Future Project 04 should be able to rely on these fields from Project 03:

- `workspaceId`
- `encounterId`
- `encounterNo`
- `patientId`
- `guardianId`
- `appointmentId`
- `primaryVeterinarianId`
- `status`
- `checkedInAt`
- `visitPurpose`
- `chiefComplaint`
- active queue row with `queueType`, `status`, `enteredAt`, and `priority`

Project 03 should not implement SOAP, diagnosis, order, invoice, or payment writes, but it should avoid field choices that make those later joins ambiguous.

## Project 03/04 Closeout Handoff

As of DEN-66, the local-first reception persistence handoff is ready for Human Review.

Completed local-first boundaries:

- Patient/guardian lookup, registration, walk-in encounter create, appointment check-in, queue read, day calendar read.
- Shared reception mutation permission matrix requiring active workspace membership plus `reception:create`.
- Reception read boundaries requiring active workspace membership plus `reception:view`.
- E2E-style route-mocked regression coverage for walk-in create reload, appointment check-in reload, and cross-workspace read denial.
- Sales demo/mock fallback preservation for `kong-vomit`.

Chart/order/billing can rely on a persisted encounter identity contract:

- use `encounter.id` as the primary join target for SOAP/chart notes, orders, queue transitions, and invoices;
- use `encounter.workspaceId` for every read/write scope;
- use `encounter.patientId`, `guardianId`, and `appointmentId` only as context links, not as authorization sources;
- use `encounter.primaryVeterinarianId` as the initial responsible clinician hint, not the final chart signer;
- treat `encounter.status` as the high-level clinical/billing state: `waiting`, `in_consultation`, `ordered`, `ready_for_billing`, `completed`, `cancelled`;
- use `waiting_queue_entries` for operational queue placement and queue status, not as the source of encounter existence.

Remaining approval-gated risks:

- Local Supabase SQL runtime replay still needs Docker daemon availability.
- Final domain RLS policy SQL and Supabase advisor review remain future work.
- Remote Supabase push/link/query, production deploy, and real clinic/patient data access remain disallowed until 승욱 explicitly approves.
- Chart/order/billing persistence must start with a separate scope confirmation; DEN-67 is the recommended next issue.

## Recommended Implementation Order

1. DEN-55: plan patient, guardian, appointment, and encounter schema extension.
2. DEN-56: implement local-first schema migration and seed/test contract.
3. DEN-57: add DB-backed patient and guardian lookup repository.
4. DEN-58: persist minimal patient/guardian registration from reception.
5. DEN-60: persist walk-in encounter creation.
6. DEN-59: persist appointment check-in to encounter transition.

DEN-60 and DEN-59 are now implemented as local-first server-owned writer boundaries. Next Project 03 implementation should be selected from Linear before continuing, with remote Supabase and real data still approval-gated.
7. DEN-61: enforce workspace and role permissions on reception mutations.
8. DEN-62: read persisted encounters in reception queue and side panel.
9. DEN-63: read persisted appointments and encounters in day calendar.
10. DEN-64: preserve sales demo and mock fallback.
11. DEN-65: add end-to-end reception persistence regression coverage.
12. DEN-66: produce chart/order/billing handoff and reception closeout.

If remote/staging Supabase is approved later, run Supabase advisors, migration review, and security-definer RPC review before any remote push/link.

## Verification

- `npm run docs:check`
