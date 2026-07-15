---
id: "RECEPTION-QA-PR-012"
status: "planned"
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
