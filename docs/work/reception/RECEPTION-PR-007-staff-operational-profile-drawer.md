---
id: "RECEPTION-PR-007"
status: "done"
area: "reception"
priority: "P1"
target_pr: "User goal / staff operational profile drawer implementation"
source_docs:
  - "docs/design/system/staff-operational-profile-drawer.md"
  - "docs/engineering/current-status.md"
dependencies:
  - "PR #381 / staff operational profile design contract"
  - "HOSPITAL-ADMIN-LIVE-PR-011"
updated: "2026-07-14"
---

# Staff Operational Profile Drawer Implementation

## Goal

Add a safe, reusable staff operational profile read surface to the reception day calendar without changing staff, permission, or schedule source data.

## Scope

- Add a reserved veterinarian lane-header action area that is visible on hover, keyboard focus, and all touch/non-hover environments.
- Provide exactly `캘린더에서 숨기기` and `운영 프로필 보기` menu actions.
- Reuse the existing veterinarian filter selection state and protect the last visible lane.
- Add a shared read-only staff operational profile Sheet with desktop and mobile layouts.
- Add a workspace-scoped read API that composes existing user, membership, job-position, avatar, and schedule sources.
- Add reception-context appointment counts only from the already loaded, permission-checked calendar source.
- Cover loading, empty, partial error, inactive membership, keyboard, focus-return, Escape, backdrop-close, and responsive behavior.

## Out Of Scope

- New tables, columns, migrations, permission roles, or RLS policy changes.
- Editing personal profiles, organization fields, schedules, roles, or permissions from the drawer.
- Personal phone numbers, login history, internal membership IDs, or permission-role disclosure.
- Inferring responsibilities, competencies, clinical specialties, or executable tasks.
- Remote Supabase mutation, real employee data, external communication, or production deployment.

## Done When

- Lane hiding and the top veterinarian filter share one selection source and cannot hide the last visible lane.
- The profile API requires an active same-workspace actor with `reception:view`, rejects cross-workspace targets without disclosure, and serializes only approved operational fields.
- The drawer renders source-backed organization, selected-date shift, and reception summary states without converting errors to empty values.
- Base UI Sheet behavior provides close, Escape, backdrop close, focus containment, and focus return, with a full-width mobile presentation.
- Focused server and Playwright tests pass together with lint, typecheck, build, and docs checks.

## Verification

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/staff-operational-profile-server.spec.ts tests/reception-staff-operational-profile.spec.ts --reporter=line` — 11 passed
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/staff-avatar-contract.spec.ts --reporter=line` — 4 passed
- `npm run lint` — passed
- `npx tsc --noEmit` — passed
- `npm run build` — passed; existing broad project tracing warning from the docs reader remains
- `npm run docs:check` — 798 Markdown files checked, passed
- `npm run security:secrets` — 3,061 tracked files checked, passed

## Data And Permission Boundary

- Base profile: `users`, `user_profiles`, `user_memberships`.
- Job position: `workspace_membership_job_position_assignments` and `workspace_job_positions`.
- Selected-date shift: existing `hospital_schedule_read_snapshot` output linked through membership ID.
- Reception summary: current reception calendar appointments already loaded for the selected date.
- Initial read permission: active workspace membership plus `reception:view`; a cross-module `staff:read` policy remains a follow-up decision.

## Data Mapping

| Drawer field                         | Current source                                                              | Mapping rule                                                                     | New schema/API need |
| ------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------- |
| Name and initials                    | `users`                                                                     | Target user constrained by workspace membership                                  | None                |
| Avatar                               | `user_profiles.avatar_storage_path`                                         | Existing public avatar bucket URL helper                                         | None                |
| Department, title, membership status | `user_memberships`                                                          | Same-workspace target membership only                                            | None                |
| Job position                         | `workspace_membership_job_position_assignments` → `workspace_job_positions` | Current assignment label only                                                    | None                |
| Selected-date shift                  | `hospital_schedule_read_snapshot`                                           | Join schedule staff membership ID to the target membership                       | None                |
| Reception counts                     | Already-loaded reception calendar appointments                              | Aggregate only the selected veterinarian and selected date; omit patient details | None                |

The legacy mock schedule fixture cannot be joined reliably to user IDs, so it returns a truthful no-shift state instead of inferred data. Schedule RPC failure remains a section-level error and is not converted to a no-shift state.

## Result

- Added the lane action area, exact two-item menu, shared filter-state hiding, and final-lane guard.
- Added the shared responsive Sheet with loading, empty, base error, partial shift error, inactive, Escape, backdrop-close, and focus-return behavior.
- Added a safe operational-profile route and Supabase/mock composition gateways without schema, migration, or RLS changes.
- Added focused API/data-boundary and reception interaction tests, including desktop, mobile, touch, keyboard, and non-today date behavior.
- Added [completion report](../../completed/reception/2026-07-14-staff-operational-profile-drawer-report.html).

## Follow-up

- Define a dedicated cross-module `staff:read` policy before exposing the same endpoint from schedule or hospital-admin screens.
- Replace the legacy mock schedule identity mismatch only through an authoritative fixture mapping; do not infer shifts from role or display name.
