---
id: "HOME-PR-005"
status: "human_review"
area: "home"
priority: "P0"
target_pr: "Project 17 / DEN-417"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/home/HOME-PR-004-den-411-home-unified-workspace.md"
dependencies:
  - "HOME-PR-004"
updated: "2026-06-05"
---

# DEN-417 Home Non-Modal Task Detail

## Goal

Convert the Home `업무 현황` selected task detail from a modal Sheet into a non-modal right-side task detail panel so staff can keep scanning and selecting other Kanban tasks.

## Scope

- Remove modal Sheet overlay/focus-trap behavior from Home task detail.
- Render a right-side `aside` panel within the Home workspace.
- Keep Kanban task selection active while the panel is open.
- Allow selecting another task to update panel content without blocking the board.
- Match the reception drawer footer pattern: one full-width primary CTA and two disabled secondary actions.

## Out Of Scope

- Live DB, Supabase, RLS, server enforcement, or realtime task data.
- Actual assignment or memo mutation behavior.
- Home Kanban card shared queue-card adoption, tracked separately in DEN-418.
- Accent bar and helper subtitle cleanup, tracked separately in DEN-419.
- Production deploy.

## Done Criteria

- Selecting a Home Kanban task opens a non-modal right panel.
- No dim/blur overlay blocks the Kanban board.
- A second task can be selected while the detail panel remains open.
- Closing the panel clears selected task state.
- Focused Home regression tests cover the panel behavior.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/home.spec.ts --reporter=line`
- Browser visual check on `/w/clair-demo/home?modulePanel=open` at desktop baseline.

## Completion Notes

Handed to human review on 2026-06-05.

- Replaced the Home task detail modal `Sheet` with a non-modal right `aside` panel.
- Removed modal overlay/focus-trap behavior so the Kanban board remains visible and interactive.
- Selecting a second task updates the right panel content without closing the panel.
- Updated the footer to the reception-style pattern: one full-width primary CTA and two disabled secondary actions.
- Added Home regression coverage for non-modal panel behavior.
