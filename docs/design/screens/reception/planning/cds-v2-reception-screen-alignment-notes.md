---
id: "RECEPTION-CDS-V2-SCREEN-ALIGNMENT-NOTES"
type: "Design Planning"
title: "CDS V2 Reception Screen Alignment Notes"
description: "Captures the requested CDS V2 reception topbar, left side panel, and calendar alignment constraints before implementation."
status: "in_progress"
area: design
tags:
  - reception
  - cds-v2
  - calendar
  - side-panel
  - queue-persistence
updated: "2026-07-14"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-038-cds-v2-app-shell-scope.md"
  - "docs/work/reception/RECEPTION-PR-005-calendar-task-creation-ux.md"
  - "docs/work/reception/RECEPTION-QA-PR-002-date-filter-search.md"
---

# CDS V2 Reception Screen Alignment Notes

## Approved Calendar Overlay Drawer — 2026-09-30

- 예약 생성, 접수 생성, 예약 상세, 접수 상세, and appointment-to-reception creation use a 380px overlay anchored to the calendar's right edge, below the toolbar. Narrow calendars cap the drawer at their available width.
- The drawer enters from right to left and exits to the right. Opening it preserves calendar width and scroll; switching cards or completing creation replaces the content without replaying the entrance.
- Keep the queue and toolbar interactive, without a blocking backdrop. Closing removes the drawer from keyboard interaction; reduced motion skips translation.
- Preserve existing forms, API writes, URL restoration, and draft-card cleanup. Staff, patient, and guardian profiles keep their existing panel presentation.
- The older fixed right-column presentation below is historical for these five reception drawer types. See [detail drawer work item](../../../../work/reception/RECEPTION-QA-PR-005-detail-edit-drawer.md) for local verification.


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
- The calendar toolbar must include the veterinarian lane filter, `일 / 주 / 월` view switcher, `+ 환자/보호자 등록`, `+ 접수/예약 생성`, and horizontal more icon button shown in the Figma frame.
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
- Calendar toolbar keeps the veterinarian filter, `일 / 주 / 월`, `환자/보호자 등록`, `접수/예약 생성`, and horizontal more actions visible.
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

## 2026-07-14 Implemented: Day Header Staff Availability Row

Figma node `27684:22157` is the measured source for the existing
`VeterinarianLaneHeader` in the reception day calendar. The HTML review artifact
remains planning evidence; the production implementation is in the existing calendar.

- Review artifact: `docs/design/screens/reception/planning/calendar-veterinarian-lane-header-prototype.html`
- Preserve the current calendar lane color policy and the existing 40px inner-header density. The Figma blue sample is a single tone reference, not an instruction to make every staff lane blue.
- Keep the stable staff-to-tone mapping already owned by `getVeterinarianToneIndex`; do not recompute a remaining lane's color when a peer lane is hidden.
- Derive each tone's header background from its existing `500` token at 6% over white and use that same tone's existing `300` token for the border. The header surface does not change on hover.
- Use the measured 40px inner height, 12px radius, 10px horizontal/8px vertical padding, and 10px content gap.
- Use a 24x24px, 6px-radius avatar with neutral-200 border and a 16/24 medium name with 0.006em letter spacing.
- Use an 18px-high, 6px-radius operational badge with 6px horizontal/1px vertical padding, neutral-200 border, white surface, and 12/16 medium label with 0.025em letter spacing.
- Render only source-backed states: `진료중`, `진료가능`, `근무 예정`, `근무 종료`, `퇴근`, `휴가중`, or `휴무`. Missing schedule data renders no badge.
- Reveal the eye and overflow controls only on pointer hover or keyboard focus, while keeping them available on touch/coarse-pointer layouts. The action group uses a 4px gap; each control is 24x24px with 4px radius and a 14px icon.
- Treat each icon control as a ghost button: it has no default fill, and only the hovered or keyboard-focused icon receives a translucent black overlay. Do not render the Figma hover composite as a permanent filled button.
- The eye control hides only that staff lane from both the header and calendar body. Recalculate the shared header/body grid from the visible lane count so the remaining columns fill the available width; do not delete schedule data or leave an empty column.
- Do not hide the final visible lane. Existing veterinarian selection remains the production restoration path; the HTML prototype's restore control exists only to demonstrate the state transition.
- The overflow menu currently presents `메시지 보내기` and `사용자 정보 보기` as candidates only; its permission boundary, final destinations, and event behavior need an approved interaction contract before application implementation.

## 2026-07-14 Implemented: Day Calendar Lane Visibility And Status

The existing day-calendar lane header now implements the approved visibility
interaction without introducing a new staff-status data model.

- The eye action is a ghost icon button: transparent at rest and uses the existing
  `black-alpha-4` token only on its own hover or keyboard-focus state.
- Selecting the eye removes that staff member from both the day header and day-grid
  columns. The existing selected-veterinarian state remains the source of truth, so
  the final visible lane is protected and the schedule-toolbar selector restores a
  hidden lane.
- Header tone assignment now resolves against the full available-veterinarian list,
  rather than the current visible list. Hiding a lane therefore does not recolor any
  remaining lane.
- Each lane retains its own `300` border and `500` tone. The header surface uses the
  `500` tone at 6% over the common white token and remains unchanged on hover/focus.
- The overflow control only repeats the approved `레인 숨기기` action. No message or
  profile navigation was added because those actions still lack a destination and
  permission contract.
- The selected-date staff read now merges a workspace-scoped schedule/time-clock
  snapshot. Actual clock-out renders `퇴근`; elapsed shift time without a clock-out
  fact renders `근무 종료`. A currently overlapping checked-in appointment renders
  `진료중`, and status-read failure does not remove the staff lane.
- The client refreshes the read every 60 seconds and when the window regains focus.
  No minute-by-minute status value is persisted in the database.
