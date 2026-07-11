---
id: "HOSPITAL-ADMIN-LIVE-PR-011"
status: "completed"
area: "hospital-admin"
priority: "P0"
target_pr: "User goal / persisted hospital schedule operations"
source_docs:
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-PR-003-flex-schedule-session-ui.md"
  - "docs/product/features/hospital-admin/hospital-admin-settings-hub-plan.md"
  - "docs/design/screens/hospital-admin/hospital-admin-settings-hub-ux.md"
dependencies:
  - "HOSPITAL-ADMIN-PR-003"
  - "HOSPITAL-ADMIN-PR-004"
updated: "2026-07-11"
---

# Hospital Schedule Operations Persistence

## Goal

Move the synthetic hospital schedule from browser-only state to a local-first Supabase/API boundary with server authorization, in-app schedule notifications, assisted assignment, time-clock entries, and payroll-preview snapshots.

## Scope

- Local/dev/test Supabase migration, RLS, and RPC contracts for schedule staff profiles, weeks, shifts, availability, requests, time-clock entries, and payroll previews.
- Server routes that use verified server sessions in Supabase mode and retain explicit mock fallback only for existing demo tests.
- Admin-only schedule mutation, publication, assignment application, and payroll-preview creation; active staff can read their own schedule and submit/see their own requests and time-clock entries.
- Existing in-app notification persistence for submitted/reviewed schedule requests; no external delivery channel.
- Recommendation-only automatic assignment: the administrator explicitly applies suggestions.
- Synthetic hourly-rate payroll preview from approved shift/time-clock data; no payment, tax, settlement, or accounting mutation.

## Out Of Scope

- Remote/staging/production migration push or seed mutation.
- Real employee data, real payroll payment, statutory overtime/tax rules, or time-clock hardware integration.
- Email, KakaoTalk, SMS, push provider delivery, and fully autonomous schedule changes.

## Done When

- The migration has RLS and explicit authenticated grants for every exposed table/RPC.
- API/server tests prove unauthorized mutation denial; workspace scope is checked in every RLS policy and RPC input.
- UI loads and mutates schedule data through the server boundary when Supabase mode is enabled, while mock test mode stays explicit.
- Assignment suggestions require an admin apply action.
- Time-clock and payroll-preview values are auditable synthetic operational data, not payments.

## Verification

- Focused Playwright covers staff/request vs admin/review authorization, assisted suggestions, payroll preview, and migration contract shape.
- Isolated local Supabase applied the schedule migration. A synthetic staff session could read/request but direct shift update returned `UPDATE 0`; a synthetic admin approved the request, published the week, and generated request/publish notifications.
- Targeted ESLint and TypeScript checks pass.
- Repository-wide local reset remains blocked by a pre-existing reception migration failure (`weight_kg` column missing). No shared local database was migrated for this work.

## Handoff Notes

- Supabase CLI is not globally installed; use `npx supabase` for local-only migration generation/validation.
- The current screen stays session-only in mock mode. Production/remote migration push, real employee data, and external delivery remain out of scope.
