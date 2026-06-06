---
id: "HOME-PR-007"
status: "human_review"
area: "home"
priority: "P0"
target_pr: "Project 17 / DEN-419"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/home/HOME-PR-004-den-411-home-unified-workspace.md"
  - "docs/work/home/HOME-PR-006-den-418-home-shared-task-queue-card.md"
dependencies:
  - "HOME-PR-004"
  - "HOME-PR-006"
updated: "2026-06-05"
---

# DEN-419 Home Kanban Visual Noise Cleanup

## Goal

Remove accent bars and helper subtitles from the Home `업무 현황` Kanban so the board is easier to scan.

## Scope

- Remove the selected task card accent-bar pattern from Home Kanban usage.
- Hide status group left indicators in Home Kanban group headers.
- Remove the Home board heading helper text.
- Remove all Kanban column helper descriptions.

## Out Of Scope

- Global redesign of shared side-panel/card/group components.
- Home outside the unified workspace.
- Non-Home queue screens.
- New design tokens.

## Done Criteria

- Home Kanban no longer shows selected-card left accent bars.
- Status group headers no longer show left color indicators.
- `업무 현황` helper text is removed.
- Kanban column helper descriptions are removed.
- Focused Home regression tests pass.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/home.spec.ts --reporter=line`
- Browser visual check on `/w/clair-demo/home?modulePanel=open` at desktop baseline.

## Completion Notes

Handed to human review on 2026-06-05.

- Removed Home board heading helper text.
- Removed Kanban column helper descriptions.
- Hid Home Kanban status group left indicators.
- Home Kanban selected cards now use the shared queue card selected styling without the accent-bar pattern.
- Added Home regression checks for removed helper text and removed card-internal ghost CTA.
