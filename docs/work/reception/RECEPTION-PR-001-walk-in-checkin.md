---
id: "RECEPTION-PR-001"
status: "done"
area: "reception"
priority: "P0"
target_pr: "PR 1"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/product/features/reception-appointment-spec.md"
  - "docs/design/ux-flows/reception-appointment-flow.md"
  - "docs/design/reference-screen-index.md"
dependencies: []
updated: "2026-05-03"
---

# Walk-In Check-In MVP Reinforcement

## Goal

예약 없는 환자를 현장 접수하고, 입력한 값 그대로 진료대기 row로 확인할 수 있게 한다.

## PR Creation Gate

- Goal: 현장 접수 form 입력값을 session-only encounter/queue 생성에 반영하고 진료대기 상태를 명확히 보여준다.
- PR size: one PR. 예약 접수 처리, 예약 CRUD, 노쇼 처리는 후속 PR로 분리한다.
- Scope: 현장 접수 drawer, `createWalkInCheckIn` action input, reception view model 표시, focused Playwright coverage.
- Out of scope: Next.js API routes, Supabase persistence, migration/RLS, server permission enforcement, 예약 생성/변경/취소, 노쇼 처리, 조제/처치 화면 변경.
- Done criteria: 방문 목적/담당의/미지정/메모 입력값이 생성된 draft encounter와 사이드 패널/캘린더 표시로 이어진다.
- Source docs: product feature spec, UX flow, current status, reference screen index, existing reception implementation and tests.
- Verification: docs check, lint, TypeScript, focused reception Playwright suite.
- Status/dependencies: ready and in progress; no external dependency.
- Duplicate check: no existing reception work item covers Product MVP walk-in check-in reinforcement.

## Scope

- Convert the walk-in reception drawer to a controlled form.
- Pass visit purpose, department, selected veterinarian, duration, and memo through the `createWalkInCheckIn` action boundary.
- Allow veterinarian assignment to remain unset and display that state intentionally.
- Keep generated draft encounter selected after creation.
- Show the generated waiting encounter in reception list and day calendar context.
- Use existing project UI components first; use shadcn primitives only through the project token/style system.

## Out Of Scope

- Live DB/API persistence.
- Auth/RLS/server enforcement.
- Appointment creation, update, cancellation, or no-show handling.
- KakaoTalk/external messaging integration.
- Pixel-perfect reference image matching.
- 조제/처치 screen changes.

## Done When

- 현장 접수 drawer stores user-entered visit purpose instead of always using a fixed `"현장 접수"` value.
- 담당의 미지정으로 생성한 현장 접수 row is visible as `진료대기` with `담당의 미지정`.
- 담당의를 선택한 현장 접수 row keeps that veterinarian label.
- The generated draft remains selected in the side panel after drawer close.
- Tests cover the main walk-in creation flow and unassigned veterinarian case.

## Verification

- `npm run docs:check` (passed)
- `npm run lint` (passed)
- `npx tsc --noEmit` (passed)
- `npx playwright test tests/reception.spec.ts --reporter=line` (`13 passed`)

## Handoff Notes

- This work keeps the prototype session-only and prepares the action input shape for later API-backed writes.
- PR 2 should continue with appointment check-in cleanup, using this action/view-model boundary style.
- Closeout: `docs/completed/reception/2026-05-03-walk-in-checkin.md`.
