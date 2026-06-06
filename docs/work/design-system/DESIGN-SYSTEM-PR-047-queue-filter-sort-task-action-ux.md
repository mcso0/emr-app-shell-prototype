---
id: "DESIGN-SYSTEM-PR-047"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Project 공통 UX/UI 기준 정리 및 화면 적용 / DEN-436"
linear: "DEN-436"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/tab-table-density-contract.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/table-sort-filter-behavior.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
updated: "2026-06-07"
---

# Queue Filter, Sort, And Task Action UX

## Goal

Apply the accepted DEN-435/DEN-436 queue UX direction to the shared side-panel queue without changing server-side sort/filter contracts.

## Scope

- Keep top queue shortcuts as quick scope controls.
- Add visible local sort state to the queue toolbar.
- Add detailed local filter options for assignee/status conditions.
- Move queue density into a display options dropdown.
- Change TASK/order card overflow from inert icon button to contextual dropdown.
- Preserve existing side-panel card border, shadow, density, and group behavior.

## Out Of Scope

- New data-grid library adoption.
- Server/API sort, filter, query, or persistence contract changes.
- Full task/order action matrix definition.
- Live Supabase, migrations, RLS, server enforcement, production deploy, or real data access.

## Implementation Notes

- `src/components/emr/order-queue-side-panel.tsx` now owns local queue sort/filter/display state and uses the same shared panel for chart and dispensing/treatment queues.
- `src/components/emr/side-panel-card.tsx` lets side-panel card actions render the shared `EmrRowActionMenu`.
- Chart queues label the primary contextual action as `차트 열기`; order queues label it as `오더 열기` or `지시서 열기`.
- Patient/guardian drawer actions are shown as disabled placeholders until the explicit action matrix is defined.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npx playwright test tests/app-shell.spec.ts --grep "module side panel order type segmented control|treatment module renders the chart queue|dispensing queue selection updates"`
- `npm run docs:check`

## Handoff Notes

Ready for Human Review.

The next follow-up should define the full contextual task/order action matrix by screen, order type, state, assignee state, and resulting UI target.
