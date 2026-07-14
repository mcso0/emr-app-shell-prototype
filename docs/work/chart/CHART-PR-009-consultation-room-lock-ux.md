---
id: "CHART-PR-009"
status: "human_review"
area: "chart"
priority: "P0"
target_pr: "User request / consultation room selection and pre-start chart lock"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/flows/2026-06-25-chart-consultation-call-workflow-plan.html"
dependencies:
  - "CHART-PR-008"
updated: "2026-06-25"
---

# Chart Consultation Room Selection And Pre-Start Lock

## Goal

Refine the post-reception consultation workflow so patient call requires a consultation room selection, and chart mutation surfaces stay locked until the patient has entered and the clinician starts consultation.

## Scope

- Require `roomId` for the `chart/consultation-flow` `call` action.
- Store the selected synthetic consultation room snapshot in the local call event.
- Replace implementation-oriented call dialog copy with product UX copy and a two-column label/field form.
- Keep the call dialog label/value grid at a 1:2 width ratio with a 12px desktop column gap, and align the room-preference checkbox to the value column.
- Hide chart completion and editing surfaces while encounter/queue are `waiting/waiting`.
- Server-block SOAP, diagnosis, order draft, and order action mutations before `in_consultation` or `ordered`.
- Add focused server and UI regression coverage.

## Out Of Scope

- Real DID device/provider integration.
- Hospital `hospital_spaces` schema, room CRUD, or hospital-admin space management UI.
- Recall, call cancel, room occupancy, or retry workflows.
- Real patient, guardian, hospital, payment, identity, or provider data.

## Done When

- The call dialog shows patient/guardian, reception time, veterinarian, and required consultation-room dropdown.
- The call dialog label/value rows use a 1:2 layout with responsive 8px mobile / 12px desktop column spacing without changing the modal shell or actions.
- The call button stays disabled until a room is selected.
- Calling stores encounter `in_consultation`, queue `in_progress`, `called_at`, and a room snapshot in the call event.
- Called queue status is retained only as a backward-compatible DB value; the chart room-selection flow does not create or display it.
- After call, chart editing/completion are available.
- Direct pre-start chart mutation attempts return `409 stale_status`.

## Verification

- `npx tsc --noEmit --pretty false`: passed
- `npx playwright test tests/chart-consultation-flow-server.spec.ts --reporter=line`: 5 passed
- `npx playwright test tests/chart-soap-note-persistence-server.spec.ts tests/chart-diagnosis-persistence-server.spec.ts tests/chart-order-draft-persistence-server.spec.ts tests/chart-order-action-persistence-server.spec.ts --reporter=line`: 37 passed
- `npx playwright test tests/chart.spec.ts -g "chart consultation CTA moves" --reporter=line`: 1 passed
- `npm run docs:check`: passed
- `npm run security:secrets`: passed
- `npm run lint`: passed with 10 existing warnings
