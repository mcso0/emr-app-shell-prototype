---
id: "HOME-PR-014"
status: "human_review"
area: "home"
priority: "P1"
target_pr: "User request / Home board presentation motion"
source_docs:
  - "docs/product/features/home/home-operations-work-status-contract-v0.md"
  - "docs/work/home/HOME-PR-011-home-operations-live-work-items.md"
dependencies:
  - "HOME-PR-011"
updated: "2026-07-18"
---

# Home Board Presentation Motion

## Goal

Adopt dnd kit and NumberFlow in the Home `원내 현황` board without changing the authoritative source-workflow boundary.

## Scope

- Add accessible keyboard and pointer drag-and-drop for session-scoped workstream column order in `전체 흐름`.
- Animate the three Home summary counts with NumberFlow while respecting the operating system reduced-motion preference.
- Keep Home cards read-only: opening detail and navigating to the source workflow remain unchanged.

## Out Of Scope

- Reordering, claiming, assigning, completing, cancelling, billing, or otherwise mutating source work items.
- Persisting a personal column order, migrations, API changes, RLS changes, or production deployment.
- Applying the new libraries to reception scheduling, payment, or clinical measurements.

## Done Criteria

- A keyboard user can move a Home workstream column through the dedicated reorder handle.
- The reordered columns retain their cards and source-workflow behavior.
- Summary counters render through NumberFlow and honour reduced-motion preferences.
- Focused Home regression coverage and static checks pass.

## Verification

- `npx playwright test tests/home.spec.ts --grep "home lets users reorder|home unified board|operation mode filters" --reporter=line`
- `npx tsc --noEmit --pretty false`
- `npm run lint`
- `npm run docs:check`
- `git diff --check`

## Completion Notes

Handed to human review on 2026-07-18.

- Added dnd kit pointer drag plus dedicated left/right-arrow keyboard controls for session-scoped Home workstream column order.
- Added NumberFlow for the `배정 누락`, `주의 업무`, and `내 업무` counters; the package respects reduced-motion preferences by default.
- Kept cards read-only and left API, database, RLS, source-workflow state, and column-order persistence unchanged.
- Passed focused Home Playwright coverage, TypeScript, lint, docs links, and whitespace validation.
- Completion report: `docs/completed/home/2026-07-18-home-board-presentation-motion-report.html`.
