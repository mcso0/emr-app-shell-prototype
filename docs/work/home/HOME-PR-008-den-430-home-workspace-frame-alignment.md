---
id: "HOME-PR-008"
status: "human_review"
area: "home"
priority: "P0"
target_pr: "Project 17 / DEN-430"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/home/HOME-PR-004-den-411-home-unified-workspace.md"
  - "docs/work/home/HOME-PR-005-den-417-home-non-modal-task-detail.md"
  - "docs/work/home/HOME-PR-006-den-418-home-shared-task-queue-card.md"
  - "docs/work/home/HOME-PR-007-den-419-home-kanban-visual-noise-cleanup.md"
dependencies:
  - "HOME-PR-004"
  - "HOME-PR-005"
  - "HOME-PR-006"
  - "HOME-PR-007"
updated: "2026-06-05"
---

# DEN-430 Home Workspace Frame Alignment

## Goal

Align the Home unified workspace with the existing module shell frame so the navigation rail, left side panel, and content section read as one continuous workspace like reception and treatment screens.

## Scope

- Remove the extra Home content padding that creates a gap inside `WorkspaceFrame`.
- Remove the nested Home Kanban root border/radius/card frame.
- Keep the left next-action panel and central work-status content inside one shell frame with a single divider.
- Align the loading skeleton with the same frame contract.

## Out Of Scope

- Redesigning Home filters, Kanban columns, task card content, or the detail panel.
- Changing global `WorkspaceFrame` behavior for other modules.
- Adding new design tokens or shell APIs.
- Mobile layout redesign.

## Done Criteria

- Home no longer renders an inner rounded/bordered workspace card inside the shell frame.
- The next-action panel and work-status content share the same top/bottom frame bounds.
- Existing Home task filtering, selection, and non-modal detail behavior still works.
- Focused Home regression tests pass.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/home.spec.ts --reporter=line`
- Browser visual check on `/w/clair-demo/home?modulePanel=open` at desktop baseline.

## Completion Notes

Handed to human review on 2026-06-05.

- Removed the extra Home content wrapper padding inside `WorkspaceFrame`.
- Removed the nested Home Kanban workspace border, radius, and card frame.
- Updated the Home loading skeleton to use the same side-panel/content frame contract.
- Added a regression check that the Home workspace root has no inner border/radius and that the side panel and board share the same top alignment.
- Verified the non-modal detail panel still opens without a dialog overlay and stays aligned with the workspace frame.
