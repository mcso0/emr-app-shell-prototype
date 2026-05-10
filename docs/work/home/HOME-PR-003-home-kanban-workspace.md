---
id: "HOME-PR-003"
status: "done"
area: "home"
priority: "P1"
target_pr: "PR 3"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/product/features/home/home-v1-epic-plan.md"
  - "docs/product/features/home/home-work-generation-rules-v0.md"
  - "docs/reference/home/home-kanban-workspace-wireframe.html"
dependencies:
  - "HOME-PR-002"
updated: "2026-05-09"
---

# Home Kanban Workspace

## Goal

Rework the default Home body into a Home dashboard plus a kanban-style `업무 현황` work board.

## PR Gate

- Goal: 홈 기본 화면을 업무별 세로 리스트 칸반으로 전환하고 우측에는 우선 확인할 업무를 제안하는 보조 패널을 표시한다.
- PR-sized scope: home feature module, home mock data shape, kanban board component, side-panel-card reuse for task cards, work focus side panel, focused Home tests, docs/status updates.
- Out of scope: live DB/API persistence, server-side permission enforcement, realtime updates, actual claim/complete/cancel actions, full Notification Center, hospital management KPI dashboard.
- Done criteria: default Home shows `홈 | 업무 현황` tabs, the Home tab renders a dashboard surface, work-status view shows all work by workstream, task card anatomy follows side panel queue card components, card action appears on hover/focus, Sales Demo remains available at `?view=demo`.
- Source docs: Home v1 epic/rules, current wireframe, current status.
- Verification: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npx playwright test tests/home.spec.ts tests/sales-demo-flow.spec.ts --reporter=line`, browser visual check.
- Status/dependencies: in progress; depends on completed `HOME-PR-002`.
- Duplicate check: `HOME-PR-002` completed My Work-first layout; this item replaces the default body structure with a kanban view while preserving the Home v1 work-entry principles.

## Scope

- Replace the default Home header/body layout with dashboard and kanban workspace tabs:
  - `홈` and `업무 현황` page tabs aligned with the body content.
  - `홈` uses shadcn Card/Table/Progress/Avatar primitives for the dashboard-only UI.
  - `업무 현황` keeps the compact kanban workspace.
  - Workstream columns: 대기, 예약, 진료, 임상병리검사, 영상검사, 조제, 처치, 수납.
  - Button-tab status filters under the tabs.
  - Right-aligned assignee filter and checkbox-based multi-select workstream filter for narrowing the kanban board.
  - Right work focus panel that recommends urgent, delayed, and unassigned work to check next.
- Reuse existing side panel task card primitives:
  - `EmrSidePanelCard`
  - `EmrSidePanelCardAction`
  - `EmrSidePanelTypeBadge`
  - `EmrSidePanelMetaBadge`
- Keep Home task actions to source workflow entry only.

## Out Of Scope

- API/DB task source integration.
- Notification Center implementation.
- Claim, completion, cancellation, payment, or lab/chart finalization actions from Home.
- Live hospital management KPI cards.
- Pixel-perfect reference image alignment.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/home.spec.ts tests/sales-demo-flow.spec.ts --reporter=line`
- Browser visual check on `/w/clair-demo/home?modulePanel=open`
- Browser route check on `/w/clair-demo/home?view=demo`

## Completion Notes

Completed on 2026-05-09.

- Default Home now renders a kanban-style workspace that is now exposed through the `업무 현황` page tab.
- The old greeting header, My Work panel, and compact flow summary are removed from the default Home body.
- Workstream columns are `대기`, `예약`, `진료`, `임상병리검사`, `영상검사`, `조제`, `처치`, and `수납`.
- Home task cards reuse the side-panel card primitives: `EmrSidePanelCard`, `EmrSidePanelCardAction`, `EmrSidePanelTypeBadge`, and `EmrSidePanelMetaBadge`.
- Each workstream column groups cards by task status (`지연`, `요청`, `배정`, `진행`) using the shared side-panel collapsible group pattern.
- Workstream column headers show the task count beside the column title and reveal a ghost hover/focus collapse control on the right. Collapsing a column hides its status groups and cards, shrinking the column to its header with the same motion language as side-panel groups.
- The task card action button follows the side-panel hover/focus pattern and does not expose claim, complete, payment, chart, or lab finalization actions.
- The right-side panel now shows `지금 볼 업무` instead of `병원 흐름 요약`, a notification list, or repeated count boxes.
- The focus panel recommends up to three actionable groups for urgent, delayed, and unassigned work. Each group uses a `긴급 업무 2` style title, is a white accordion row, and is expanded by default. Focus task body clicks do not mutate the kanban board; hovering or focusing a focus task reveals a `보러가기` action that routes to the source workflow.
- Focus group titles include lightweight status-matched icons for urgent, delayed, and unassigned work.
- The top workstream filter supports checkbox-based multi-select. Selecting `전체 업무` clears individual workstream selections.
- The status controls under the Home view tabs use button tabs with `전체`, `긴급`, `지연`, and `미지정`; `전체` is selected by default.
- Non-`전체` status filters keep all workstream columns visible, but move columns with visible tasks before empty columns.
- The filter row now includes right-aligned `담당자` and `업무` filters; both default to `전체`, include `미지정` where relevant, and update the kanban board directly.
- Sales Demo remains available at `/w/clair-demo/home?view=demo`.

Updated on 2026-05-10.

- The default tab order is now `홈` then `업무 현황`.
- The former `내 업무` tab label was removed from the Home workspace tabs.
- The default `홈` tab now renders a dashboard-style UI using shadcn `Card`, `Table`, `Progress`, and `Avatar` primitives plus existing EMR tokens/icons.
- The kanban board, status filters, workstream filters, and `지금 볼 업무` side panel moved under the `업무 현황` tab.

Verification passed:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/home.spec.ts tests/sales-demo-flow.spec.ts --reporter=line`
- Browser visual check on `/w/clair-demo/home?modulePanel=open`
