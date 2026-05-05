---
id: "RECEPTION-PR-002"
status: "done"
area: "reception"
priority: "P1"
target_pr: "PR 2"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/product/features/reception-appointment-spec.md"
  - "docs/design/ux-flows/reception-appointment-flow.md"
dependencies: []
updated: "2026-05-05"
---

# Reception Calendar Visual UX Polish

## Goal

접수/예약 calendar와 side panel을 바쁜 운영자가 빠르게 읽을 수 있도록 정보 위계, 색상 단서, 대기 긴급도를 정돈한다.

## PR Creation Gate

- Goal: calendar card hierarchy, veterinarian accent, waiting urgency, current-time label, and side-panel role separation.
- PR size: one PR. Drag and drop, real schedule mutation, and empty-space widgets are deferred.
- Scope: reception calendar cards, side-panel default/list labeling, focused reception tests, source-of-truth docs.
- Out of scope: DB/API persistence, Supabase, appointment drag-and-drop, memo/notice data model, 조제/처치 changes.
- Done criteria: 대기 중심 side panel, icon-assisted purpose labels, veterinarian accent bars, red long-wait pill, current-time label, high-contrast check-in button.
- Source docs: reception feature spec, UX flow, current status, existing reception implementation.
- Verification: lint, TypeScript, reception Playwright suite, docs link check.
- Status/dependencies: done; no external dependency.
- Duplicate check: existing `RECEPTION-PR-001` covered walk-in creation, not calendar visual hierarchy.

## Scope

- Make the side panel default to `대기`, with `대기 / 예약 / 전체` tabs.
- Keep calendar cards status-colored while adding veterinarian accent bars.
- Add compact visit-purpose icon chips for common purposes such as 구토/식욕, 예방접종, 피부, and 수술.
- Change long waiting time to a signal-color pill.
- Add `현재 11:20` to the day current-time line.
- Increase contrast of the 예약확정 `접수 처리` action.

## Out Of Scope

- Drag-and-drop schedule edits.
- Empty-state memo or notice widget.
- Appointment create/update/cancel persistence.
- New public APIs, schemas, routes, or migrations.

## Done When

- 기본 side panel list shows active waiting/check-in rows before appointments.
- Calendar cards emphasize patient and visit purpose before guardian details.
- Appointment and walk-in cards expose veterinarian accent bars, with gray for unassigned.
- Long wait pills use red tone at 90 minutes or more.
- Focused reception Playwright tests cover the new visual and interaction expectations.

## Verification

- `npm run lint -- src/features/reception/module.tsx tests/reception.spec.ts` (passed)
- `npx tsc --noEmit` (passed)
- `npx playwright test tests/reception.spec.ts --reporter=line` (`18 passed`)
- `npm run docs:check` (passed)
