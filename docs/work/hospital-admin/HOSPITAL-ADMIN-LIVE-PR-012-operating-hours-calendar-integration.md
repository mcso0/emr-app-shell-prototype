---
id: "HOSPITAL-ADMIN-LIVE-PR-012"
status: "completed"
area: "hospital-admin"
priority: "P0"
target_pr: "User goal / operating-hours calendar integration"
source_docs:
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-PR-005-hospital-basic-settings-ui.md"
  - "docs/product/features/hospital-admin/hospital-admin-settings-hub-plan.md"
dependencies:
  - "HOSPITAL-ADMIN-PR-005"
updated: "2026-07-15"
---

# Operating Hours Calendar Integration

## Goal

Persist workspace operating hours, date exceptions, holiday policy, and timezone; enforce the effective schedule in reception writes; and render the reception calendar with compact non-business time.

## Scope

- Forward-only local Supabase migration with tenant-bound tables, RLS, explicit grants, admin mutation RPC, audit event, effective-date resolver, and future appointment conflict protection.
- Hospital basic settings operating-hours GET/PUT route with server authorization and mock fallback.
- Reception calendar response includes the selected date's effective schedule.
- Appointment and walk-in creation use the effective schedule instead of fixed 09:00-19:00 checks.
- Calendar density: business 15 minutes = 36px; non-business hour = 72px; compact cards = 36px with 8px inset.

## Out Of Scope

- Remote Supabase migration application, deployment, or real patient/customer data.
- Persisting unrelated hospital profile/contact fields.
- Automatic cancellation or movement of appointments that conflict with changed hours.

## Done When

- Admin-only writes and workspace-member reads are enforced in API/RLS/RPC contracts.
- A settings update that would invalidate a future active appointment returns a conflict and writes nothing.
- Calendar and reception writers consume the same effective-date resolver contract.
- Focused DB/RLS/API/UI tests, TypeScript, lint, and docs checks pass.

## Verification

- Local PostgreSQL migration apply and transaction replay passed for member read, non-admin direct-write denial, admin update, audit, and future-appointment rollback.
- Focused Playwright integration suite: 70 passed.
- Calendar density UI contract: 2 passed after the final Turbopack root adjustment.
- `npx tsc --noEmit`, focused ESLint, `npm run docs:check`, `npm run security:secrets`, `git diff --check`, and `npm run build` passed.
- `npx supabase migration up --local` could not replay the repository history because the existing local catalog references legacy version `20260714193844`; the new migration itself was applied directly to local PostgreSQL and verified with the scoped replay snippet.

## Handoff Notes

- Apply migration `20260715100000` before or together with the application release. Remote Supabase was not queried or changed in this work.
- Until a trusted public-holiday calendar source is selected, holiday closures must be represented as explicit date exceptions.
- Hospital contact/profile fields remain session-local and are intentionally outside this work item.
