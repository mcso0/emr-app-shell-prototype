# Home Kanban Workspace Closeout

Date: 2026-05-09

## Summary

Home default view was changed from the My Work panel plus compact flow summary into a kanban-style work board.

## Completed Scope

- Replaced the default Home greeting/header area with `병원 현황` and `내 업무` page tabs.
- Added workstream columns for `대기`, `예약`, `진료`, `임상병리검사`, `영상검사`, `조제`, `처치`, and `수납`.
- Workstream column headers show the task count beside the column title and reveal a ghost hover/focus collapse control on the right. Collapsing a column hides its status groups and cards, shrinking the column to its header with the same motion language as side-panel groups.
- Added `병원 현황` view for all mock work and `내 업무` view for role/user-specific mock work.
- Replaced the right `병원 흐름 요약` panel with `지금 볼 업무`.
- The focus panel recommends up to three actionable urgent, delayed, and unassigned work groups. Each group uses a `긴급 업무 2` style title, is a white accordion row, and is expanded by default. Focus task body clicks do not mutate the kanban board; hovering or focusing a focus task reveals a `보러가기` action that routes to the source workflow.
- Focus group titles include lightweight status-matched icons for urgent, delayed, and unassigned work.
- The top `업무` filter supports checkbox-based multi-select. Selecting `전체 업무` clears individual workstream selections.
- Added button-tab status filters under the Home view tabs: `전체`, `긴급`, `지연`, and `미지정`; `전체` is selected by default.
- Non-`전체` status filters keep all workstream columns visible, but move columns with visible tasks before empty columns.
- Added right-aligned `담당자` and `업무` filters to the Home kanban filter row; both default to `전체` and the assignee filter includes `미지정`.
- Reused existing side-panel task card primitives for Home task cards:
  - `EmrSidePanelCard`
  - `EmrSidePanelCardAction`
  - `EmrSidePanelTypeBadge`
  - `EmrSidePanelMetaBadge`
- Grouped Home task cards by task status (`지연`, `요청`, `배정`, `진행`) with the shared side-panel collapsible group pattern.
- Kept Home actions as source workflow entry only.
- Preserved Sales Demo at `/w/clair-demo/home?view=demo`.

## Out Of Scope

- Live DB/API task source integration.
- Actual claim, complete, cancel, payment, lab, chart, or notification-center actions.
- Full global Notification Center.
- Hospital management KPI dashboard.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/home.spec.ts tests/sales-demo-flow.spec.ts --reporter=line`
- Browser visual check on `/w/clair-demo/home?modulePanel=open`

## Follow-Up

- Shape the Home task contract so the kanban can later be fed by source workflow queues instead of mock-only task arrays.
