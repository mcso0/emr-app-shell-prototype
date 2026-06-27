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
updated: "2026-06-27"
---

# Chart Consultation Call/Start Flow

## Goal

Correct the post-reception chart workflow so `호출하기` means the user is ready to call the patient and begin consultation immediately.

## Scope

- Add a route-owned `chart/consultation-flow` mutation boundary for `call`, legacy `start`, and `return_to_waiting`.
- Persist the local-first call event/outbox record without real DID/provider side effects.
- Move consultation queue rows from `waiting` to `in_progress` immediately on `call`.
- Move encounters from `waiting` to `in_consultation` immediately on `call`.
- Keep the `called` enum/type/DB compatibility surface, but do not use it in the chart CTA flow.
- Add chart header CTA as primary button plus secondary icon dropdown.
- Add secondary actions: `대기로 변경`, divider, `진료 취소`.
- Require a cancel reason for encounter cancellation.
- Allow `대기로 변경` directly when no chart/order work exists; show confirmation when work exists.
- Block chart completion from moving `waiting` or `called` work directly to `ready_for_billing`.
- Update chart CTA, confirmation modal, and queue/status labels.
- Add focused server and UI regression coverage.

## Out Of Scope

- Real DID device/provider integration.
- Recall, call cancel, room assignment, or delivery retry UI.
- Full reception cancel reason UX redesign outside the chart CTA.
- Real patient, guardian, hospital, payment, or provider data.
- Broad chart, order, billing, or shared queue refactors.

## Done When

- Waiting consultation work shows `호출하기`, not `차트 작성완료`.
- Calling opens a confirmation dialog and stores encounter `in_consultation`, queue `in_progress`, `called_at`, and `started_at`.
- Called work does not show a `진료 시작` CTA in the chart flow.
- In consultation work shows primary CTA `진료 완료`.
- In consultation work exposes secondary dropdown actions `대기로 변경` and `진료 취소` separated by a divider.
- `진료 취소` requires a reason and stores it through the cancel boundary.
- `대기로 변경` returns encounter and queue to `waiting`.
- Chart completion is visible/executable only after `in_consultation` or `ordered`.
- Direct completion attempts from `waiting` are rejected with `409 stale_status`.

## Verification

- `npx tsc --noEmit --pretty false`: passed
- `npx playwright test tests/chart-consultation-flow-server.spec.ts --reporter=line`: 5 passed
- `npx playwright test tests/reception-encounter-cancel-server.spec.ts --reporter=line`: 6 passed
- `npx playwright test tests/reception-encounter-restore-server.spec.ts --reporter=line`: 4 passed
- `npx playwright test tests/chart-completion-persistence-server.spec.ts --reporter=line`: 6 passed
- `npx playwright test tests/chart.spec.ts -g "chart consultation CTA" --reporter=line`: 1 passed
- `npx playwright test tests/live-audit-mutation-emission.spec.ts --reporter=line`: 2 passed
- `npx playwright test tests/reception-mutation-permissions-server.spec.ts --reporter=line`: 37 passed
- `npm run security:secrets`: passed
- `npm run docs:check`: passed
- `npm run lint`: passed with existing warnings
