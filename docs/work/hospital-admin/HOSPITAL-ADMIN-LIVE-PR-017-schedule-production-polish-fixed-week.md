---
id: "HOSPITAL-ADMIN-LIVE-PR-017"
status: "human_review"
area: "hospital-admin"
priority: "P0"
target_pr: "https://github.com/mcso0/emr-app-shell-prototype/pull/477"
source_docs:
  - "docs/product/features/hospital-admin/staff-scheduling-mvp-plan.md"
dependencies:
  - "HOSPITAL-ADMIN-LIVE-PR-013"
  - "HOSPITAL-ADMIN-LIVE-PR-015"
  - "HOSPITAL-ADMIN-LIVE-PR-016"
updated: "2026-07-22"
---

# Production Schedule Polish and Fixed Weekly Hours

## Goal

Make the v2 hospital schedule feel like an operational product: keep long rosters scrollable, make loading and edit/publication state legible, and let an administrator fill a company-style fixed weekly pattern without overwriting exceptions.

## Scope

- Give the v2 schedule screen ownership of vertical scrolling inside the workspace frame and keep its primary header reachable.
- Replace the text-only loading state with an accessible progress/skeleton state.
- Use action-oriented labels such as `근무표 편집`, `현재 게시된 근무표`, `지난주 근무표 가져오기`, and `게시 전 확인`.
- Add an administrator-only `기본 근무 일괄 입력` dialog for roles, weekdays, and one daytime range.
- Apply the fixed week in one idempotent, lock-version-checked, audited database transaction.
- Preserve existing work, leave, and off entries; reject inactive, cross-workspace, closed-day, outside-hours, and stale-revision writes.

## Out of Scope

- Automatic recurring jobs that create future weeks without an administrator action.
- Complex rotating shifts, overnight work, split-shift templates, payroll, or attendance policy.
- Production deployment or real employee data.

## Done When

- A roster taller than the workspace viewport scrolls inside the schedule screen.
- Loading exposes `aria-busy` and a visible progress/skeleton state.
- Fixed-week request input is bounded to valid roles, unique weekdays, and a valid daytime range.
- The batch RPC inserts only empty staff-days, skips existing exceptions, increments the revision lock once, validates once, and returns inserted/skipped counts.
- Focused TypeScript, ESLint, Playwright, SQL transaction replay, build, and docs checks pass.

## Verification

- Passed: `npx tsc --noEmit --pretty false`
- Passed: targeted ESLint for the v2 schedule surface, API parser, and focused tests.
- Passed: focused Playwright contracts for fixed-week migration/API/UI composition (6 tests).
- Passed: local transaction replay compiled the v2 base plus the additive migration, inserted 30 synthetic veterinarian work blocks, verified idempotent replay, and rolled back.
- Passed: staging migration `20260722090248_hospital_schedule_fixed_week_batch` applied; RPC existence, anonymous denial, authenticated grant, internal administrator check, and zero batch-created rows verified.
- Pending: authenticated PR Preview browser verification and production release approval; no production code deployment or real employee-data mutation was performed.
