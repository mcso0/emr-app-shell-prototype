---
id: "RECEPTION-QA-PR-001"
type: "Work Item"
title: "Reception QA DB/API and fallback boundary"
description: "Defines the live data boundary, missing contracts, and verification gates before implementing the reception/reservation QA fixes."
status: "human_review"
area: "reception"
priority: "P0"
tags:
  - "reception"
  - "qa"
  - "db-api-boundary"
target_pr: "Reception QA project / DEN-519"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/reception/RECEPTION-LIVE-PR-004-patient-guardian-lookup.md"
  - "docs/work/reception/RECEPTION-LIVE-PR-006-walk-in-encounter-create.md"
  - "docs/work/reception/RECEPTION-LIVE-PR-007-appointment-check-in-transition.md"
  - "docs/work/reception/RECEPTION-LIVE-PR-008-reception-mutation-permission-hardening.md"
  - "docs/work/reception/RECEPTION-LIVE-PR-009-reception-queue-read.md"
  - "docs/work/reception/RECEPTION-LIVE-PR-010-reception-day-calendar-read.md"
  - "docs/work/reception/RECEPTION-LIVE-PR-011-sales-demo-mock-fallback-preservation.md"
  - "docs/work/reception/RECEPTION-LIVE-PR-012-reception-persistence-regression-coverage.md"
dependencies:
  - "RECEPTION-LIVE-PR-012"
updated: "2026-06-16"
---

# Reception QA DB/API and Fallback Boundary

## Goal

Freeze the data-boundary contract for DEN-514 through DEN-517 so the reception/reservation QA fixes use synthetic/demo DB and API readback instead of passing through UI-only, mock-only, or session-only behavior.

## Current Boundary Map

- Queue read is API-backed through `GET /api/workspaces/[workspaceId]/reception/queue`, then merged into reception store state with `applyPersistedReceptionQueue`.
- Day calendar read is API-backed through `GET /api/workspaces/[workspaceId]/reception/calendar/day?date=YYYY-MM-DD`, then merged with `applyPersistedReceptionCalendar`.
- Patient/guardian lookup is API-backed through `GET /api/workspaces/[workspaceId]/reception/patient-guardian-lookup`, backed by `clair_search_reception_patient_guardian_lookup` in Supabase mode.
- Walk-in reception create is API-backed through `POST /api/workspaces/[workspaceId]/reception/walk-in-encounters`, backed by `clair_create_reception_walk_in_encounter` in Supabase mode.
- Appointment check-in is API-backed through `POST /api/workspaces/[workspaceId]/reception/appointments/[appointmentId]/check-in`, backed by `clair_check_in_reception_appointment` in Supabase mode.
- Encounter cancel is API-backed through `POST /api/workspaces/[workspaceId]/reception/encounters/[encounterId]/cancel`, backed by `clair_cancel_reception_encounter` in Supabase mode.
- Patient profile read/update route exists under `customer/patients/[patientId]/profile`, but the reviewed implementation is mock-gateway based and not enough to satisfy reception weight DB persistence.
- The reception UI still has session draft paths such as `createWalkInCheckIn`; these can preserve local UX but cannot satisfy QA acceptance for persisted create/readback.

## Material Gaps

- Weight handling is not a live reception contract yet:
  - `ReceptionWalkInEncounterInput` has no `weightKg`.
  - The reception dialog currently reads recent weight from a local hardcoded map.
  - Walk-in RPC does not update `patients.weight_kg`.
  - Existing patient profile update core validates `weightKg`, but no reviewed Supabase gateway/RPC path proves live DB update from the reception flow.
- Appointment creation is missing as a live contract. Current support covers appointment read/check-in, not create/update/cancel/no-show.
- Encounter detail edit is missing as a live contract for mutable reception fields: weight, visit purpose, duration, department, veterinarian, and memo.
- DB RPC permission enforcement is weaker than server route enforcement. Current reception RPCs mainly enforce active workspace membership and object workspace scope; server core enforces `reception:view`, `reception:create`, or `reception:update`.
- Reception write audit is not atomic with DB mutation. Walk-in create, appointment check-in, and encounter cancel emit audit after RPC mutation in TypeScript.
- Walk-in create passes actor ID into RPC but currently stores `checked_in_by_user_id` as `null`.
- Route/UI tests that use demo headers or intercepted responses prove wiring only. They do not prove live Supabase/RLS behavior.

## Scope

- Document API/DB/fallback boundaries for DEN-514 through DEN-517.
- Identify missing DB/API contracts needed for reception QA implementation.
- Define verification gates that reject mock-only, fallback-only, and session-only success.
- Keep Sales Demo mock fallback preservation intact; do not remove legacy fallback as part of this boundary work.

## Out Of Scope

- Implementing the reception QA UI changes.
- Running remote Supabase SQL, migrations, dashboard changes, or remote readback.
- Using real clinic, patient, guardian, staff, identity, billing, payment, Kakao, email, or SMS data.
- Deploying production-demo or opening external access.
- Weakening RPC grants or RLS remotely.

## Required Implementation Rules For Follow-Up Issues

- Treat synthetic/demo DB records as the real service surface for QA. Do not use random dummy objects or in-component mock data for acceptance.
- UI create/update acceptance must include API write plus API readback. Local store overlay can improve responsiveness but is not enough.
- Any new reservation create/edit/check-in path must be represented by typed request/response contracts, server permission checks, DB/RPC or approved server gateway, and readback tests.
- Weight update must be persisted through the DB/API path used by reception. A successful reception create with weight must update the patient profile source of truth and be visible after reload/readback.
- Date navigation must refetch queue/calendar data for the selected operating date, not merely move the visible calendar.
- Existing Sales Demo fallback must remain explicit and bounded; new QA paths must be able to fail when live/demo DB wiring is missing.
- Prefer small changes in existing reception modules and server cores. Do not add speculative abstraction layers or broad reservation features beyond the QA issues.

## Done When

- Boundary map and missing contracts are documented.
- DEN-514 through DEN-517 can reference this work item for DB/API acceptance criteria.
- Existing reception server regression tests are run as a baseline.
- A Korean completion report exists for DEN-519.
- Linear DEN-519 is updated with the result and ready for human review.

## Verification

- `npx playwright test tests/reception-queue-read-server.spec.ts tests/reception-calendar-read-server.spec.ts tests/reception-patient-guardian-lookup-server.spec.ts tests/reception-walk-in-encounter-server.spec.ts tests/reception-appointment-check-in-server.spec.ts tests/reception-encounter-cancel-server.spec.ts tests/customer-patient-profile-server.spec.ts --reporter=line`: 42 passed
- `npm run docs:check`: checked 712 docs/agent markdown files

## Handoff Notes

- Start DEN-515 with the weight contract first. The visible UI bug depends on a missing write contract, not just input disabled state.
- If adding DB/RPC scope for patient weight or encounter edit, include local direct-RPC denial/readback tests. Server permission tests alone are not enough.
- Keep DEN-514 date/search/filter UI work separate from DEN-516 reservation creation unless a shared API query shape is genuinely needed.

## Result

Ready for Human Review.

DEN-519 established the DB/API and fallback boundary for the reception QA project. No implementation, remote Supabase operation, production deploy, or real clinic/patient data access was performed.
