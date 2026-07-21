---
id: "HOSPITAL-ADMIN-LIVE-PR-013"
status: "human_review"
area: "hospital-admin"
priority: "P0"
target_pr: "Staff scheduling v2 screen foundation"
source_docs:
  - "docs/product/features/hospital-admin/staff-scheduling-mvp-plan.md"
dependencies:
  - "HOSPITAL-ADMIN-LIVE-PR-011"
updated: "2026-07-21"
---

# Staff Scheduling v2 Screen Foundation

## Goal

Add a rollout-gated, component-based v2 scheduling surface without deleting the v1 screen or its RPCs.

## Scope

- Resolve a missing `weekStart` on the server and normalize it into the URL.
- Add `v1`, `compare`, and `v2` route behavior; retain v1 output in compare mode.
- Use `SchedulePageHeader`, week navigation, grid, day-list, data-state, editor sheet, and publish review components built from existing EMR and Base UI primitives.
- Keep unsaved editor values in the current tab only and confirm before navigation/close.
- Define feature geometry and state aliases with `--emr-schedule-*` tokens.

## Done When

- v1 remains the fallback for mock sessions and rollout mode `v1`.
- v2 supports desktop grid, mobile day list, loading/empty/error/read-only states, keyboard-operable buttons, and URL week sharing.
- No manual primitive replacements or raw schedule palette values are introduced.

## Verification

- TypeScript, ESLint, existing hospital schedule UI Playwright coverage, and focused v2 model/API tests pass.
