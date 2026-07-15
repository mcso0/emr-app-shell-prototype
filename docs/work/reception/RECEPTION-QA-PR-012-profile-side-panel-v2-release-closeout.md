---
id: "RECEPTION-QA-PR-012"
status: "human_review"
area: "reception"
priority: "P0"
target_pr: "Staff profile side panel V2 release QA and closeout"
source_docs:
  - "docs/design/system/staff-operational-profile-drawer.md"
  - "docs/engineering/testing/product-mvp-qa-scenario-pack.md"
dependencies:
  - "RECEPTION-PR-013"
  - "RECEPTION-LIVE-PR-014"
  - "RECEPTION-LIVE-PR-015"
updated: "2026-07-16"
---

# Staff Profile Side Panel V2 Release QA And Closeout

## Goal

Prove the complete V2 flow with synthetic/demo data, publish the approved build,
and leave durable evidence without retaining test records or uploaded objects.

## Scope

- Run focused and combined lint, typecheck, build, docs, Storybook, server,
  migration, RLS/Storage, and Playwright suites.
- Verify desktop 380px/10px layout, full-width non-modal mobile, exact two tabs,
  200% zoom, long text, keyboard/Escape/focus return, and all loading/empty/error
  states.
- Create synthetic schedule, status, avatar, Presence, and assigned-work data;
  verify authorized read/mutation and cross-workspace/cross-user denial; clean up
  every row and object and verify absence.
- Review local/remote migration drift, merge all PRs, synchronize `main` to
  `origin/main` with `0 0`, deploy the approved production build, and run
  authenticated post-deploy smoke against synthetic/demo data.
- Update current status and affected canonical/data docs and add the final
  closeout report with evidence and residual risks.

## Out Of Scope

- Real employee, patient, guardian, payment, or identity data.
- Opening the product to real external users or weakening production security.

## Done When

- All required PRs are merged and the deployed commit equals `origin/main`.
- Post-deploy UI/API/Presence/status/avatar/work-item smoke passes.
- Synthetic rows and Storage objects are proven removed.
- Completion audit confirms every canonical requirement or records an explicit
  approved exception; no incomplete item is described as shipped.

## Result

- Functional delivery landed sequentially through PRs
  [#418](https://github.com/mcso0/emr-app-shell-prototype/pull/418),
  [#419](https://github.com/mcso0/emr-app-shell-prototype/pull/419),
  [#420](https://github.com/mcso0/emr-app-shell-prototype/pull/420), and
  [#421](https://github.com/mcso0/emr-app-shell-prototype/pull/421). Each PR
  started from the then-current `origin/main` and was merged before the next.
- Final release QA, the real-session read-grant repair, and durable closeout are
  collected in [#422](https://github.com/mcso0/emr-app-shell-prototype/pull/422).
- Release replay exposed one server-boundary defect that mocked browser tests
  could not reveal: `authenticated` had no `SELECT` privilege on
  `order_fulfillment_work_items`, so the real-session assigned-work API could
  not reach its existing workspace RLS policy. Canonical migration
  `20260716030000_staff_assigned_work_items_authenticated_select.sql` grants
  read only; insert, update, and delete remain ungranted. It was applied to the
  linked synthetic/demo project under remote version `20260715180209` before
  this final application/docs PR is merged.
- `staff_profile_v2_release_replay.sql` creates a synthetic guardian, patient,
  encounter, order, assigned work item, published shift, status message, and
  activity row inside one transaction. Local and approved-remote runs proved
  same-workspace read, self-only status mutation, other-user/cross-workspace
  denial, rollback, and zero fixed probe rows.
- `check-staff-profile-v2-presence.mjs` proved private same-workspace
  subscribe/track/observe, heartbeat execution, cross-workspace denial, and
  Presence untrack cleanup locally and against the approved remote project.
- The existing private-avatar Storage replay was rerun remotely and proved
  owner-only quarantine, pointer-scoped peer read, pointer restore, and object
  cleanup. Final catalog readback reported zero actor probe objects, a null
  private pointer, and `avatar_legacy_hidden=false`.
- Browser coverage now fixes the 200% zoom-equivalent, long-content, exact-two-
  tabs, keyboard avatar-menu, and no-horizontal-overflow contract in addition
  to the existing desktop/mobile/focus/state regressions.
- A real local Supabase browser session signed in as the Cheongdam veterinarian
  and received `200` from both the assigned-work and dated operational-profile
  routes. This proves the added table grant reaches the server-session path
  rather than only the SQL replay or mocked route harness.

## Release Gate

The only production candidate is the merge commit of the final release PR that
contains this work item. After it merges, verify that `main...origin/main` is
`0 0`, deploy that exact SHA through the production runbook, and record the
Vercel deployment ID, commit SHA, and authenticated synthetic smoke result in
the final task review. Do not insert a guessed deployment identifier into this
pre-merge artifact.

## Verification Evidence

- local reset with the full seed and every migration: pass
- local and approved-remote transactional release replay: pass; no fixed probe
  rows remain
- local and approved-remote private Presence replay: pass; channel state removed
- approved-remote private avatar Storage replay: pass; pointer restored and
  probe objects removed
- authenticated local browser/API smoke: sign-in redirect and both assigned-
  work and dated operational-profile reads returned `200`
- focused Playwright: 59 passed across the 11 profile/status/avatar/presence/
  release-migration specs
- Storybook interaction tests: 15 passed across the two profile story files
- lint, TypeScript, docs links, staged-file secret scan, diff check, Storybook
  build, and production build: pass
- remote catalog: RLS enabled, active-member select policy present,
  authenticated select true, authenticated insert/update/delete false
- Supabase security advisor: no new table/RLS finding; the three feature RPC
  warnings are intentional authenticated self/member `SECURITY DEFINER`
  entrypoints with internal authorization checks
- inherited performance advisor notes remain for redundant permissive work-item
  policies and broader foreign-key indexes; they do not change the verified
  read boundary and are outside this release repair

## Durable Closeout

- [Staff Profile Side Panel V2 release report](../../completed/reception/2026-07-16-staff-profile-side-panel-v2-release-closeout-report.html)
- [Product MVP QA Scenario 8](../../engineering/testing/product-mvp-qa-scenario-pack.md#scenario-8-staff-profile-side-panel-v2)
