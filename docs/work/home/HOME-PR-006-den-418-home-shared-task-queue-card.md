---
id: "HOME-PR-006"
status: "human_review"
area: "home"
priority: "P0"
target_pr: "Project 17 / DEN-418"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/home/HOME-PR-004-den-411-home-unified-workspace.md"
  - "docs/work/home/HOME-PR-005-den-417-home-non-modal-task-detail.md"
dependencies:
  - "HOME-PR-004"
  - "HOME-PR-005"
updated: "2026-06-05"
---

# DEN-418 Home Shared Task Queue Card

## Goal

Align Home Kanban task cards with the shared task queue card UI used by clinical, lab, imaging, billing, and other queue surfaces.

## Scope

- Replace the custom Home Kanban task card markup with `EmrTaskQueueCard`.
- Add a small Home task-to-queue-card mapping helper.
- Keep Home task selection behavior and test ids.
- Remove the card-internal ghost navigation CTA; navigation remains in the right detail panel footer.

## Out Of Scope

- Broad redesign of the shared queue card component.
- Behavior changes to non-Home queue screens.
- Actual task mutation behavior.
- Live DB, Supabase, RLS, or server enforcement.

## Done Criteria

- Home Kanban task cards render through the shared queue card component.
- Card-level ghost navigation CTA no longer appears.
- Selecting cards still opens or updates the task detail panel.
- Focused Home regression tests pass.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/home.spec.ts --reporter=line`

## Completion Notes

Handed to human review on 2026-06-05.

- Replaced custom Home Kanban task card markup with the shared `EmrTaskQueueCard`.
- Added a Home task-to-queue-card mapper while preserving Home Kanban task test ids.
- Removed card-internal ghost navigation CTA buttons.
- Kept the shared queue card hover action pattern.
