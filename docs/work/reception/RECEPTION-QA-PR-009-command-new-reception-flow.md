---
id: "RECEPTION-QA-PR-009"
type: "Work Item"
title: "Global command new reception drawer flow"
description: "Wire the global command palette 신규 진료 접수 action to the shared walk-in reception drawer, then route successful creation through a toast action to the created reception detail."
status: "implemented"
area: "reception"
priority: "P0"
tags:
  - "reception"
  - "qa"
  - "command-palette"
  - "walk-in-create"
  - "drawer"
  - "toast"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/product/features/reception-appointment-spec.md"
  - "docs/design/ux-flows/reception-appointment-flow.md"
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
  - "docs/engineering/architecture/app-shell-layout-contract.md"
dependencies:
  - "RECEPTION-QA-PR-003"
  - "RECEPTION-QA-PR-004"
  - "RECEPTION-QA-PR-005"
  - "RECEPTION-QA-PR-008"
updated: "2026-07-05"
---

# Global Command New Reception Drawer Flow

## Goal

Make the global command palette `신규 진료 접수` action start the same drawer-based walk-in reception creation flow that reception staff already use, without forcing immediate navigation to the 접수/예약 screen. After creation, show a success toast with `접수 확인하기`; that action navigates to 접수/예약, selects the newly created queue item, and opens its `접수 상세` drawer.

## Scope

- Add a dedicated global command action for `new-reception`.
- Open `activeDrawer = { type: "reception-form", id: "walk-in" }` from the command action instead of routing to `/reception`.
- Make the shell drawer renderer support reception creation/detail drawer types outside the reception module.
- Reuse the existing walk-in reception form, validation, lookup, and `POST /api/workspaces/[workspaceId]/reception/walk-in-encounters` mutation path.
- After successful walk-in create, show a success toast with `접수 확인하기`.
- Make the toast action navigate to `/w/[workspaceId]/reception?modulePanel=open&drawer=reception-encounter:<encounterId>&encounterId=<encounterId>&patientId=<patientId>`.
- Add focused Playwright coverage for command entry from a non-reception module and for toast action navigation/readback.

## Out Of Scope

- New reservation creation behavior.
- New DB schema, RLS, or remote Supabase migration work.
- A new notification-center event type. This is a local creation success toast, not a persisted notification drawer event.
- Same-day duplicate reception warning UI.
- Unsaved drawer dirty-state confirmation.
- Persistent follow-up notification after toast expiry.

## Product Behavior Contract

| Moment | Expected behavior |
| --- | --- |
| User clicks `신규 진료 접수` in command palette | Palette closes and the walk-in reception drawer opens on the current workspace module. |
| Current module is not `reception` | Stay on the current module path and render the reception create drawer through the shell. |
| Current module has right-panel content open | Render the drawer from the outer workspace right edge, above content and right-panel layers, not between content and the right panel. |
| User cancels before create | Close the drawer. Do not create queue/calendar data. |
| User submits invalid or unauthorized create | Keep the drawer open and show the existing field/server error feedback. |
| Create succeeds | Apply the created encounter to reception state and show success toast. |
| User ignores toast | Stay on the current module; created data remains available through normal reception reads. |
| User clicks `접수 확인하기` | Navigate to 접수/예약 and open `drawer=reception-encounter:<encounterId>` with the queue item selected. |

## Edge Cases

| Case | Decision |
| --- | --- |
| Command click from a module without its own drawer | Render the shared reception drawer through the shell instead of navigating first. |
| Command click from a module with content/right panels open | Drawer is a shell overlay with drawer-level z-order. It must cover the open right panel from the workspace's far-right edge. |
| Missing required form fields | Keep existing disabled create / field feedback behavior. |
| Permission, validation, or server failure | Keep the drawer open and reuse the existing walk-in route error toast. |
| Created encounter is not immediately visible after navigation | URL carries `encounterId` and `patientId`; reception route selection/read retry owns readback. Do not show an empty success state. |
| User ignores or dismisses toast | No extra navigation. The created reception remains available through normal reception reads. |
| Same patient already has an active same-day encounter | Follow-up scope; do not add duplicate-warning UI in this PR. |
| User closes the drawer with unsaved typed values | Follow-up scope; do not add a new dirty-state confirmation in this PR. |
| Toast expires before user clicks it | Follow-up scope; do not create a persistent notification-center event in this PR. |

## Verification

- Passed: `npm run lint -- src/shell/global-command-palette.tsx src/shell/workspace-frame.tsx src/features/reception/module.tsx tests/app-shell.spec.ts tests/reception.spec.ts`, with pre-existing `src/features/reception/module.tsx` unused-symbol warnings only.
- Passed: `npx tsc --noEmit --pretty false --incremental false`.
- Passed: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/app-shell.spec.ts -g "global command palette" --reporter=line`.
- Passed: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/reception.spec.ts -g "server-backed walk-in encounter sends minimal reception payload" --reporter=line`.
- Passed: `npm run docs:check`.
- Partial: the broader reception grep had 8 passing tests and 5 existing failures outside this command/toast slice: calendar compact card vertical gap tolerance, two Cheongdam walk-in tests with disabled create button, one compact walk-in card text expectation, and one duplicate `patient-card-patient-haru` strict-mode expectation.

### 2026-07-05 Drawer Layer Follow-up

- Scope: fixed the shell drawer layer placement so global `신규 진료 접수` opens from the outer workspace right edge and covers an open right panel.
- Regression coverage: app-shell command test now starts from billing with `right=open`, verifies the drawer z-index, right-edge alignment, and right-panel hit-test coverage.
- Passed: `npm run lint -- src/shell/workspace-frame.tsx tests/app-shell.spec.ts`.
- Passed: `npx tsc --noEmit --pretty false --incremental false`.
- Passed: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3103 npx playwright test tests/app-shell.spec.ts -g "global command palette" --reporter=line`.
- Passed: `npm run docs:check`.

## Handoff Notes

- The command action is an action, not a view shortcut. `오늘 접수/예약 보기` can still route directly to 접수/예약.
- The success toast is intentionally transient and should not be modeled as a global notification-center drawer event unless a later notification work item scopes it.
- Follow-up candidates: same-day duplicate reception warning, unsaved drawer dirty guard, and persistent follow-up notification after toast expiry.
