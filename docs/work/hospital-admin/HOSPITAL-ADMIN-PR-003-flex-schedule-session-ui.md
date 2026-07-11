---
id: "HOSPITAL-ADMIN-PR-003"
status: "human_review"
area: "hospital-admin"
priority: "P0"
target_pr: "User goal / Flex-inspired interactive schedule"
source_docs:
  - "docs/product/features/hospital-admin/hospital-admin-settings-hub-plan.md"
  - "docs/design/screens/hospital-admin/hospital-admin-settings-hub-ux.md"
  - "docs/completed/hospital-admin/2026-07-11-hospital-schedule-ux-ui-audit-report.html"
dependencies:
  - "HOSPITAL-ADMIN-PR-002"
updated: "2026-07-11"
---

# Flex-Inspired Hospital Schedule Session UI

## Goal

Replace the static `근무표` concept with a focused operational schedule screen that makes weekly editing, daily coverage review, personal requests, and publication status visible.

## Scope

- Keep the existing 병원관리 route and side-panel entry.
- Add synthetic Cheongdam staff, shifts, availability, requests, coverage rules, and publication state in a dedicated Zustand session store.
- Support admin weekly grid, daily coverage timeline, unassigned shifts, shift create/edit/copy/leave/delete, settings, and conflict-gated publication.
- Support a personal weekly calendar and pending leave/shift-change requests.
- Apply approved requests only through the admin staff detail sheet, then mark the schedule for republication.
- Use existing CLAiR/shadcn components and low-saturation shift tokens with text labels.

## Out Of Scope

- Database/API persistence, RLS, server authorization, notifications, payroll, time clock, automatic scheduling, or real staff data.
- A claim that client-side role switching is access control.

## Done When

- `근무표` no longer renders through the generic concept-screen renderer.
- Week/day/admin/personal workflows work against session-only synthetic data.
- Publication is blocked for availability conflicts or coverage gaps.
- Focused model and browser tests cover CRUD, approval, publish blocking, and mobile day-list behavior.
- Canonical product/design/status docs and an implementation report record the boundary.

## Verification

- Passed: `npx tsc --noEmit --pretty false`
- Passed: `npx eslint src/features/hospital-admin/module.tsx src/features/hospital-admin/schedule tests/hospital-admin.spec.ts tests/hospital-schedule-model.spec.ts`
- Passed: `npx playwright test tests/hospital-schedule-model.spec.ts --project=chromium --reporter=line`
- Passed: `npx playwright test tests/hospital-admin.spec.ts --project=chromium --grep "hospital schedule" --reporter=line`
- Passed: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npx playwright test tests/hospital-admin.spec.ts tests/hospital-schedule-model.spec.ts --project=chromium --reporter=line` (20 tests)
- Passed: `npm run docs:check`
- Passed: `npx storybook build --disable-telemetry`
- Passed: `npm run build`

## Handoff Notes

- The current data is intentionally session-only and resets with a fresh browser page.
- Seeded conflicts are visible by design so the publish-blocking state has a tangible review path.
- The implementation report is `docs/completed/hospital-admin/2026-07-11-flex-hospital-schedule-implementation-report.html`.
