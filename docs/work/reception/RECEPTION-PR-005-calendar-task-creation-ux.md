---
id: "RECEPTION-PR-005"
status: "done"
area: "reception"
priority: "P1"
target_pr: "Project 18 / DEN-382-DEN-385"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/product/features/reception-appointment-spec.md"
  - "docs/design/ux-flows/reception-appointment-flow.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
dependencies: []
updated: "2026-06-01"
---

# Reception Calendar Task Creation UX

## Goal

Bring the reception calendar task cards closer to the CDS V2 Figma `celanderTask` component and let desk users create session-only reception tasks from the calendar by clicking or dragging exact 15-minute slots.

## PR Creation Gate

- Goal: Figma-aligned calendar task cards plus 15-minute click/drag reception task creation through the right drawer.
- PR size: one UI/UX PR across reception calendar cards, day-view creation interaction, tests, and closeout.
- Scope: `src/features/reception/*`, focused reception Playwright coverage, reception product/design docs, and completion report.
- Out of scope: live Supabase validation, DB migrations, RLS, RPC changes, production deploy, real appointment persistence, existing task drag/resize movement, week/month task creation.
- Done criteria: users can click a 15-minute slot or drag a 15-minute-snapped range in day view, complete the reception drawer, and see the session-only task on the calendar and side panel.
- Source docs: reception feature spec, reception UX flow, design system rules, current status, Figma CDS V2 `celanderTask` inspection.
- Verification: `npm run docs:check`, focused lint/typecheck, and `tests/reception.spec.ts`.
- Status/dependencies: done; no external dependency. External calendar libraries were reviewed, but the current implementation keeps the existing CLAiR calendar structure.
- Duplicate check: prior `RECEPTION-PR-002` polished visual hierarchy only; it did not implement 15-minute click/drag task creation.

## Scope

- Map Figma `celanderTask` states to reception calendar states:
  - 예약: confirmed appointment task.
  - 접수완료: checked-in appointment or walk-in queue task.
  - 노쇼: no-show appointment task.
  - 추가: empty-slot click target for `+ 접수/예약`.
- Add exact 15-minute slots: `HH:00`, `HH:15`, `HH:30`, and `HH:45`.
- Support click creation in day view with a default 15-minute task.
- Support drag creation in day view with start/end snapped to 15-minute boundaries.
- Open the right reception drawer after a calendar selection instead of a Notion-style popover.
- Commit through existing session-only walk-in reception behavior.

## Out Of Scope

- Live Supabase or remote project validation.
- DB migration, RLS, server permission policy, or RPC changes.
- Persisted appointment creation/update/cancel/no-show mutations.
- Week/month click or drag creation.
- Existing task drag, drop, or resize editing.
- Replacing the CLAiR calendar with a third-party calendar engine.

## Interaction Contract

- Click: a click inside a veterinarian day lane creates a 15-minute draft at the clicked slot.
- Drag: a drag inside a veterinarian day lane creates a draft from the snapped start to snapped end.
- Snap rule: all created start/end times must align to 15-minute boundaries only.
- Minimum duration: 15 minutes.
- Drawer rule: selection opens the right drawer with date, veterinarian, start time, and duration prefilled.
- Commit rule: creating from the drawer creates a session-only walk-in encounter and queue entry.

## Reception Scenario

1. Desk user opens `접수/예약` day view.
2. User clicks `12:15` in a veterinarian lane.
3. Right drawer opens with `진료시작시간=12:15` and `소요시간=15분`.
4. User chooses or confirms patient/guardian, visit purpose, department, veterinarian, and memo.
5. User clicks `생성`.
6. A session-only reception task appears on the calendar at `12:15`.
7. Side panel queue includes the created patient as waiting.
8. User can also drag from `14:00` to `18:00`; drawer opens with `14:00` and `240분`.

## Verification

- `npm run docs:check`
- `npm run lint -- src/features/reception/module.tsx src/features/reception/store.ts src/features/reception/data.ts src/shell/workspace-frame.tsx tests/reception.spec.ts`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3109 npx playwright test tests/reception.spec.ts --grep "15-minute calendar click|dragged calendar range|day calendar emphasizes schedule card hierarchy|walk-in keeps selected veterinarian"`
