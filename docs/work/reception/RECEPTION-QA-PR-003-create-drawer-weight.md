---
id: "RECEPTION-QA-PR-003"
type: "Work Item"
title: "Reception creation drawer and patient weight write contract"
description: "Implements DEN-515 reception QA fixes for the create-entry point, drawer-based walk-in form, patient weight lookup/writeback, visit-purpose tag removal, and synthetic/demo DB/API contracts."
status: "human_review"
area: "reception"
priority: "P0"
tags:
  - "reception"
  - "qa"
  - "walk-in-create"
  - "patient-weight"
  - "db-api"
target_pr: "Reception QA project / DEN-515"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/reception/RECEPTION-QA-PR-001-db-api-fallback-boundary.md"
  - "docs/work/reception/RECEPTION-QA-PR-002-date-filter-search.md"
dependencies:
  - "RECEPTION-QA-PR-001"
  - "RECEPTION-QA-PR-002"
updated: "2026-07-08"
---

# Reception Creation Drawer and Patient Weight Write Contract

## Goal

Turn the first reception QA creation issue into a real DB/API-backed walk-in creation path: patient weight must come from the selected patient, be editable only after patient selection, and be written back to the patient profile when the walk-in reception is created.

## Scope

- Change the toolbar action from `+ 진료 접수` to a `+ 접수/예약` dropdown.
- Open walk-in reception creation through the right drawer instead of the old modal dialog.
- Keep `예약하기` as a visible split entry point, but leave full reservation creation/time-collision rules to DEN-516.
- Disable the weight input until a patient is selected.
- Fill the weight input from the selected patient's latest `weightKg` when available.
- Keep the weight input enabled but empty if the selected patient has no weight.
- Send entered weight through the walk-in creation API payload.
- Update patient `weight_kg` in the synthetic/demo DB writer RPC when a weight is provided.
- Return patient `weightKg` from the patient/guardian lookup reader RPC.
- Remove visit-purpose quick tags and their helper description.
- Rename the reception drawer shell title from `접수 정보` to `접수 상세`.
- Rename the calendar drag draft drawer title from `접수 task 생성` to `접수 생성`.

## Out Of Scope

- Full appointment/reservation creation, holiday exclusion, and occupied-slot disablement. This remains DEN-516.
- Appointment-to-reception conversion and reservation badge behavior. This remains DEN-516.
- Reception detail edit mode. This remains DEN-517.
- Remote Supabase migration execution or production deployment.
- Removing the Sales Demo/local fallback path.

## Implementation Notes

- `Patient` now includes optional `weightKg`.
- Mock patient fixtures include synthetic weight values so local fallback can still demonstrate the behavior.
- Reception lookup, queue, calendar, customer profile, and registration mappers preserve `weightKg` from camelCase or snake_case DB rows.
- The walk-in writer accepts `weightKg`, validates positive values, and updates `public.patients.weight_kg` in the same scoped RPC path after encounter/queue creation.
- The old modal form was removed from the active reception module path. The new drawer form owns the visible create flow and reuses the existing walk-in route contract.
- The `+ 접수/예약` dropdown intentionally avoids implementing fake reservation logic. `예약하기` only announces that DEN-516 owns reservation scheduling validation.

## DB/API Boundary

- `GET /api/workspaces/[workspaceId]/reception/patient-guardian-lookup` can return `patient.weightKg`.
- `POST /api/workspaces/[workspaceId]/reception/walk-in-encounters` can receive `weightKg`.
- `public.clair_create_reception_walk_in_encounter` validates `weightKg > 0` and writes it to `public.patients.weight_kg`.
- The implementation stays on synthetic/demo data paths. No remote Supabase operation was executed.
- This is not mock-only: server core tests and migration static checks cover lookup readback and walk-in write payload/writeback.

## Done When

- Toolbar shows `+ 접수/예약` and exposes `접수하기` / `예약하기`.
- `접수하기` opens a right drawer walk-in form.
- Weight is disabled before patient selection.
- Selecting a patient enables weight and pre-fills the patient's latest known weight.
- Entered weight is sent in the walk-in API request and written back through the DB writer contract.
- Visit-purpose quick tags are gone.
- Walk-in creation still creates the waiting queue/calendar card and chart handoff data.
- Existing focused reception tests remain green.

## Verification

- `npx playwright test tests/reception.spec.ts --grep "reception dialogs align 40px inputs and select triggers|reception creates a walk-in waiting row|server-backed walk-in encounter sends minimal reception payload|reception walk-in keeps selected veterinarian" --reporter=line`: 4 passed
- `npx playwright test tests/reception-patient-guardian-lookup-server.spec.ts tests/reception-walk-in-encounter-server.spec.ts --reporter=line`: 14 passed
- `npm run docs:check`: 713 docs/agent markdown files passed
- `git diff --check`: passed
- `npm run lint`: blocked before linting because `eslint-plugin-storybook` cannot be resolved from the local install.
- `npx tsc --noEmit --pretty false --incremental false`: blocked by existing Storybook/Vitest story type-resolution errors; no filtered errors appeared for the touched reception files.

## Handoff Notes

- DEN-516 should reuse the `reception-form` drawer direction for reservation creation instead of reviving the removed modal path.
- DEN-516 should implement real reservation slot availability and holiday/business-hour validation before making `예약하기` create data.
- DEN-517 detail drawer work should keep the new `접수 상세` shell title and use patient `weightKg` rather than hard-coded `0.00 kg`.
- The patient weight contract is now a real API/RPC field; do not reintroduce local-only hard-coded recent-weight maps.

## 2026-07-08 Side Panel Follow-up

- Walk-in reception creation now uses the reception right side panel presentation when opened from the toolbar or URL, matching the reception detail side-panel field structure.
- The side-panel presentation uses one-column icon-labeled rows for patient/guardian, weight, department/veterinarian, reception date/time, visit purpose, and reception memo so the 380px panel is not using the old drawer grid.
- Existing walk-in create API, patient weight lookup/writeback, business-hour blocking, and Kakao send toggle behavior remain unchanged.
- Focused UI coverage now asserts the side-panel surface instead of the removed global workspace drawer for the walk-in creation path.

## Result

Ready for Human Review.

DEN-515 implemented the walk-in creation drawer and patient-weight read/write contract. Reservation creation remains intentionally deferred to DEN-516 so it can be implemented with the required calendar availability rules instead of a partial fake path.
