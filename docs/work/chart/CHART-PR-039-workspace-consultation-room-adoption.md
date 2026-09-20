---
id: CHART-PR-039
type: Work Item
title: Workspace-managed consultation room adoption
status: in_progress
area: chart
priority: P0
source_docs:
  - docs/work/chart/CHART-PR-009-consultation-room-lock-ux.md
  - docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-020-space-management-persistence.md
dependencies:
  - CHART-PR-009
  - HOSPITAL-ADMIN-LIVE-PR-020
updated: 2026-09-20
---

# Workspace-managed consultation room adoption

## Goal and authorization

Replace the chart call dialog's synthetic room list with the active workspace
`consult` spaces managed in hospital settings. The owner approved TDD, commit,
push, PR, `origin/main` merge, and production deployment after checks pass on
2026-09-20.

## Scope

- Derive call options from the workspace space-management source through a
  chart-owned `chart:view` read API that exposes only active consultation rooms.
- Keep loading, denied, and failed room reads explicit and block calls until the
  authoritative room list is ready.
- Validate the submitted room against the same workspace-scoped gateway before
  consultation mutation.
- Update the Supabase call RPC to resolve only an active, non-archived `consult`
  space in the same workspace and preserve its real ID/name snapshot in the call
  event. During mixed-version deployment, the four former request IDs translate
  to an active real space instead of surviving as stored room identities.
- Preserve session-scoped mock behavior, chart permission checks, audit,
  first-chart creation, and saved room preference invalidation.

## Out of scope

- Room occupancy, capacity, DID provider delivery, scheduling allocation, or a
  new space-management field.
- Changes to category/space CRUD, permissions, RLS, archive semantics, or audit
  payloads.
- Real patient, guardian, hospital, identity, payment, or provider data.

## Done criteria

- A room added under the workspace `consult` category appears in the call dialog
  with its real space ID and can be used to start consultation.
- Treatment/exam/surgery, archived, unknown, and cross-workspace spaces cannot be
  used as consultation rooms.
- The UI has no chart-owned hardcoded room list or room-ID fallback.
- Focused contract/server/browser tests, TypeScript, lint, build, docs, secrets,
  Release Check, Ready deployment, scoped production smoke, and rollback
  evidence pass for the exact release candidate.

## TDD evidence

- RED: the new room contract suite failed because the workspace-backed contract
  module did not exist.
- RED: the migration contract failed until the compatibility RPC preserved
  actor identity and `chart:update` permission checks before room lookup.
- RED: the rollout contract failed until legacy requests were translated to an
  active workspace space, preventing an old-app/new-database mismatch window.
- GREEN: contract/server tests and the browser flow pass with a dynamically
  supplied `3진료실` and its real space ID.

## Local verification

- 25 focused consultation-room, consultation-flow, and space-management model,
  server, and migration tests passed.
- Three focused chart browser regressions passed, including a dynamically
  supplied room, historical waiting reception, and queue selection.
- TypeScript and full lint passed; lint retained five unrelated script warnings.
- Production build passed with the existing NFT tracing warning.
- Docs links (1,036 files), secret scan (4,391 tracked files), UX copy, and
  `git diff --check` passed.
- The new SQL applied in a local PostgreSQL transaction. An active same-workspace
  consultation room and a legacy request alias both reached
  `encounter_unavailable`, while an unknown room reached `room_unavailable`.
- Remote Supabase application, exact candidate Release Check, PR merge, Ready
  Production, and post-deploy smoke remain release-phase evidence.

## Rollback

Revert the application commit while retaining the additive RPC migration only
if compatibility is confirmed. Legacy request aliases resolve to real active
spaces and are never stored as room identities. A database rollback requires a
separately reviewed function replacement compatible with existing call-event
snapshots.
