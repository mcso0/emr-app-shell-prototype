---
id: "RECEPTION-CDS-V2-SCREEN-ALIGNMENT-NOTES"
type: "Design Planning"
title: "CDS V2 Reception Screen Alignment Notes"
description: "Captures the requested CDS V2 reception topbar, left side panel, and calendar alignment constraints before implementation."
status: "draft"
area: design
tags:
  - reception
  - cds-v2
  - calendar
  - side-panel
  - queue-persistence
updated: "2026-06-20"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-038-cds-v2-app-shell-scope.md"
  - "docs/work/reception/RECEPTION-PR-005-calendar-task-creation-ux.md"
  - "docs/work/reception/RECEPTION-QA-PR-002-date-filter-search.md"
---

# CDS V2 Reception Screen Alignment Notes

These notes capture the current requested direction for the reception screen visual alignment. They are not a completion claim and do not replace the active work-item gate for implementation.

## Scope Boundary

The requested screen alignment has three visible areas:

1. Workspace topbar and page-tab chrome.
2. Reception left side panel.
3. Reception calendar.

Implementation should preserve existing workspace routing, tab behavior, drawer behavior, selected operating date behavior, and API/server boundaries unless a scoped work item explicitly changes them.

## 1. Workspace Topbar And Page Tabs

The topbar direction follows the CDS V2 frame where:

- the workspace button stays in the left section;
- back and forward controls sit beside the workspace area;
- page navigation behaves visually like browser tabs;
- right-side global actions remain compact 32px controls.

Static review artifact:

- `docs/design/screens/reception/planning/reception-topbar-v2-html-prototype.html`

The static HTML artifact is scoped to workspace chrome and page-tab structure only. Reception schedule toolbar controls are tracked under the calendar scope below and must not be dropped from implementation.

Candidate implementation owners:

- `src/shell/workspace-tabs-bar.tsx`
- `src/shell/workspace-chrome-tabs.tsx`
- `src/shell/workspace-switcher.tsx`
- `src/shell/layout-contract.ts`

## 2. Reception Left Side Panel

Additional requested constraints:

- The left side panel background must resolve visually to `#F9F9F9`.
- The list title filter should use the CDS V2 tab structure for `전체 / 외래 / 예약`.
- The filter change is not visual-only. Update the filter logic and count calculations so `외래` and `예약` counts describe the actual reception list state.
- Verify that queue data is persisted through the API/DB boundary, not only rendered from client state.

Persistence verification requirements:

- Creation and check-in flows that create queue-visible work must be verified through the server routes and returned `queueEntry` payloads.
- After mutation, readback must verify `GET /api/workspaces/[workspaceId]/reception/queue` and, when calendar-visible, `GET /api/workspaces/[workspaceId]/reception/calendar/day?date=YYYY-MM-DD`.
- When a scoped local/dev DB run is part of the work item, verify the corresponding `waiting_queue_entries` row exists and remains workspace-scoped.
- Use synthetic/demo data only. Do not use real patient, guardian, hospital, staff, payment, identity, or provider data.

Candidate implementation owners:

- `src/features/reception/module.tsx`
- `src/components/emr/subpanel.tsx`
- `src/features/reception/store.ts`
- `src/features/reception/data.ts`
- `src/app/api/workspaces/[workspaceId]/reception/queue/route.ts`
- `src/app/api/workspaces/[workspaceId]/reception/walk-in-encounters/route.ts`
- `src/app/api/workspaces/[workspaceId]/reception/appointments/[appointmentId]/check-in/route.ts`

## 3. Reception Calendar

The calendar work must modify the existing reception calendar implementation first. Do not create a parallel calendar implementation or replace the existing calendar structure unless the current component tree cannot support the required CDS V2 behavior.

Creation rule:

- Use existing components and functions first.
- Create a new component only when no existing component can own the repeated role cleanly.
- If a new component is required, keep it inside the current reception/shared EMR ownership boundary and route it through the design-system contract.

Current candidate owners:

- `ReceptionScheduleDateControl`
- `ScheduleToolbar`
- `CalendarTaskBadge`
- `CalendarTaskCard`
- `DayScheduleBoard`
- `WeekScheduleBoard`
- `MonthScheduleBoard`
- `ScheduleAppointmentCard`
- `ScheduleWalkInQueueCard`

Primary implementation file:

- `src/features/reception/module.tsx`

Design implementation rule:

- The visible calendar design should match the referenced Figma components.
- Code structure should follow the current CLAiR implementation and shared EMR components instead of copying Figma node structure literally.
- The calendar toolbar must include the veterinarian lane filter, `일 / 주 / 월` view switcher, `+ 신규 동물/보호자`, `+ 접수/예약`, and horizontal more icon button shown in the Figma frame.
- Preserve day/week/month view behavior, selected operating date behavior, click/drag draft creation behavior, and drawer handoff behavior unless a scoped work item explicitly changes them.

## Figma Calendar Component References

Figma file: `[CDS.V2] CLAiR EMR Design System Ver.2`

Referenced component nodes:

| Figma component | Node | Observed structure |
| --- | --- | --- |
| `celanderTask` | `27379:14027` | Variants for default, hover/select, focus, disable, compact, and no-show task cards. |
| `.CelenderBadge` | `27379:15090` | Badge variants for `예약`, `외래`, and `노쇼`. |
| `calendeCell` | `27458:24119` | Cell variants for header and body states. |
| `calenderBlaock` | `27458:24129` | Calendar block component, observed 169x144 inner block. |
| `caldenderHeder` | `27458:24529` | Header variants for calendar header and timeline header. |
| `calenderLane` | `27458:24557` | Lane variants for timeline and calendar lanes. |
| `calenderBody` | `27458:24311` | Body variants for calendar body and timeline body. |

Implementation should inspect these links again before coding because Figma component details may change:

- https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27379-14027&t=a5YEuslMpcP2Pjx4-4
- https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27379-15090&t=a5YEuslMpcP2Pjx4-4
- https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27458-24119&t=a5YEuslMpcP2Pjx4-4
- https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27458-24129&t=a5YEuslMpcP2Pjx4-4
- https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27458-24529&t=a5YEuslMpcP2Pjx4-4
- https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27458-24557&t=a5YEuslMpcP2Pjx4-4
- https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27458-24311&t=a5YEuslMpcP2Pjx4-4

## Verification Expectations For Implementation

The implementation work item should include:

- focused Playwright coverage for topbar/page-tab interaction if topbar code changes;
- focused Playwright coverage for `전체 / 외래 / 예약` side-panel filtering and counts;
- server/API readback verification for queue persistence;
- focused visual QA for the calendar in desktop width matching the Figma frame;
- regression checks for day view click/drag draft creation and existing drawer handoff;
- `npm run docs:check`;
- focused lint/typecheck/build commands according to the scoped work item.

## 2026-06-20 Implementation Checkpoint

Implemented on branch `codex/reception-cds-v2-alignment` as an initial combined alignment pass:

- Workspace topbar tab chrome now uses tokenized active shadow and close icon sizing.
- Reception left side panel background resolves through `--emr-surface-sidepanel` to `#F9F9F9`.
- Reception side panel list mode now defaults to `전체`; `외래` counts active reception encounters and `예약` counts calendar/appointment-origin reception work.
- Calendar toolbar keeps the veterinarian filter, `일 / 주 / 월`, `신규 동물/보호자`, `접수/예약`, and horizontal more actions visible.
- Existing reception calendar boards were modified in place for CDS V2 lane headers, task card hierarchy, and current-time label/dot/line.

Verification captured:

- `npx eslint --fix src/features/reception/module.tsx src/features/reception/profile-drawer.tsx src/shell/workspace-chrome-tabs.tsx tests/reception.spec.ts tests/app-shell.spec.ts`
- `npx tsc --noEmit --pretty false`
- `npm run docs:check`
- `npx playwright test tests/app-shell.spec.ts --project=chromium -g "workspace tabs|workspace tab chrome" --reporter=line`
- `npx playwright test tests/reception.spec.ts --project=chromium -g "first-path workspace|date controls refetch|week calendar shows|day calendar emphasizes|veterinarian selector|side panel searches|appointment check-in persistence regression|walk-in persistence regression|15-minute calendar click|draft schedule card|blocks invalid calendar draft|dragged calendar range|cards open the reception detail|side panel cards keep order" --reporter=line`
- `npx playwright test tests/reception-queue-read-server.spec.ts tests/reception-walk-in-encounter-server.spec.ts tests/reception-appointment-check-in-server.spec.ts --reporter=line`
- Desktop visual QA screenshots saved under `test-results/reception-cds-v2-1280.png` and `test-results/reception-cds-v2-1920.png`.

Local Supabase direct row readback was not run in this checkpoint because the environment is missing the `supabase` and `psql` CLIs. `npm run demo:seed:check` passed local safety diagnostics for config, Docker, and local-only DB URL, and reported those CLI gaps.
