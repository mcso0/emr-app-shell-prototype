---
id: "CHART-PR-008"
status: "human_review"
area: "chart"
priority: "P0"
target_pr: "User request / consultation call-start flow"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/flows/2026-06-25-chart-consultation-call-workflow-plan.html"
dependencies:
  - "CLINICAL-BILLING-PR-005"
updated: "2026-06-25"
---

# Chart Consultation Call/Start Flow

## Goal

Correct the post-reception chart workflow so consultation work moves from waiting to called, then in consultation, before chart completion can move the encounter toward billing.

## Scope

- Add a route-owned `chart/consultation-flow` mutation boundary for `call` and `start`.
- Persist the local-first call event/outbox record without real DID/provider side effects.
- Move consultation queue rows from `waiting` to `called`, then `in_progress`.
- Move encounters from `waiting` to `in_consultation` only after `start`.
- Block chart completion from moving `waiting` or `called` work directly to `ready_for_billing`.
- Update chart CTA, confirmation modal, and queue/status labels.
- Add focused server and UI regression coverage.

## Out Of Scope

- Real DID device/provider integration.
- Recall, call cancel, room assignment, or delivery retry UI.
- Real patient, guardian, hospital, payment, or provider data.
- Broad chart, order, billing, or shared queue refactors.

## Done When

- Waiting consultation work shows `호출하기`, not `차트 작성완료`.
- Calling opens a confirmation dialog and stores queue status `called` plus `called_at`.
- Called work shows `진료 시작`.
- Starting stores encounter `in_consultation`, queue `in_progress`, and `started_at`.
- Chart completion is visible/executable only after `in_consultation` or `ordered`.
- Direct completion attempts from `waiting` are rejected with `409 stale_status`.

## Verification

- `npx tsc --noEmit --pretty false`: passed
- `npx playwright test tests/chart-consultation-flow-server.spec.ts --reporter=line`: 5 passed
- `npx playwright test tests/chart-completion-persistence-server.spec.ts --reporter=line`: 6 passed
- `npx playwright test tests/chart.spec.ts -g "chart consultation CTA moves" --reporter=line`: 1 passed
- `npm run docs:check`: passed
- `npm run security:secrets`: passed
- `npm run lint`: passed with existing warnings
