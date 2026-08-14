---
id: "RECEPTION-LIVE-PR-016"
status: "implemented"
area: "reception"
priority: "P0"
target_pr: "User request / break-time warning creation policy"
source_docs:
  - "docs/product/features/reception-appointment-spec.md"
  - "docs/design/ux-flows/reception-appointment-flow.md"
  - "docs/work/reception/RECEPTION-PR-006-calendar-selection-guardrails.md"
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-012-operating-hours-calendar-integration.md"
dependencies:
  - "RECEPTION-PR-006"
  - "HOSPITAL-ADMIN-LIVE-PR-012"
updated: "2026-07-22"
---

# Break-Time Warning Creation Policy

## Goal

Allow walk-in reception and reservation creation inside or partially overlapping
the effective configured break, require an accessible confirmation dialog before
the mutation, and distinguish the break from normal and blocked calendar time.

## PR Creation Gate

- Scope: day-calendar selection and break band, walk-in/reservation create forms,
  shared operating-time classification, focused server/UI tests, and a forward
  Supabase migration for the authoritative write and settings-conflict guards.
- Out of scope: changing configured break values, weekly calendar data-model
  reconstruction, appointment check-in conversion, collision policy, past-time
  policy expansion, and real customer or patient data.
- Done criteria: `normal` creates directly, `break-warning` creates only after
  confirmation, and `blocked` remains unavailable; cancel performs zero writes;
  confirmed creation is a single request; break-time records remain readable.
- Security boundary: preserve actor/session equality, active workspace
  membership, `reception:create`, RLS, direct-write denial, atomic writers, and
  operating-hours admin authorization.

## Implementation Contract

- Use the effective date schedule and the overlap rule
  `start < breakEnd && end > breakStart`.
- Keep closed days, treatment boundaries, date boundaries, elapsed UI slots,
  collisions, invalid assignments, and permission denials blocked.
- Use the shared dialog primitive with the exact Korean copy from the request.
- Render one pointer-transparent, minute-aligned hatched band across day-view
  veterinarian lanes with an accessible break-time label.
- Add a new migration; do not edit the applied operating-hours migration.
- Remove break-only conflict rejection from both reception write validation and
  future-appointment validation during operating-hours replacement.

## Verification

- Focused operating-time, appointment, walk-in, migration, and UI Playwright:
  46 passed. Coverage includes overlap boundaries, closed/outside/conflict and
  permission regressions, the selectable hatch, dialog cancel/confirm, one-request
  double-confirm behavior, and authoritative-schedule loading.
- Focused existing reception calendar tests: outside-hours copy and reverse drag
  passed. Five stale side-panel descendant selectors still fail; the representative
  15-minute draft selector fails identically on fresh `origin/main` and is not
  introduced by this work.
- Local Supabase transaction replay: the new migration compiled, a 13:00 break-time
  appointment and 13:30 walk-in were created through authenticated RPCs, exact
  appointment/encounter/queue timestamps read back, outside-hours and direct-write
  guards were asserted, and the entire transaction rolled back.
- Approved remote Supabase application: migration
  `20260722112803_reception_break_time_creation_policy` is applied to the shared
  staging/production project. Catalog readback confirms the private guard is not
  executable by client roles, the public settings writer remains authenticated-only,
  both functions retain fixed `search_path`, and the treatment/closed-day conflict
  guard remains present. No real customer or patient rows were used.
- `git diff --check`: passed.
- `npm run lint`: passed.
- `npx tsc --noEmit --pretty false`: passed.
- `npm run docs:check`: passed.
- `npm run security:secrets`: passed.
- `npm run build`: passed with the pre-existing Next.js NFT trace warning for the
  docs reader.

## Rollback

- Revert the application classification/dialog/band change.
- Apply a new forward migration restoring the previous break-overlap clauses in
  `private.clair_assert_reception_time_allowed` and
  `public.clair_replace_workspace_operating_hours`; never rewrite applied history.
- Revert the associated application deployment to the previous known-good main
  commit if the warning flow or calendar interaction regresses.
