---
type: Work Package
title: Remaining category runtime defaults and registered inpatient locations
status: in_progress
updated: 2026-09-06
---

# WP-07 — Remaining category runtime

Parent: [full remediation plan](../CLINICAL-MASTER-order-execution-defaults-remediation-plan.md).
Scope: synthetic prototype order defaults, registered workspace inpatient resources,
and planned-to-actual handoff. No remote mutation or deployment is claimed here.

## Implementation boundary

- The non-applied [remaining definitions](./artifacts/wp-07/remaining-definitions.non-applied.v1.json)
  preserve the exact original 136 identities and species: hospitalization 30,
  consultation 55, other 39, and the existing 12 system-exam authoring identities.
  No duplicated system-exam IDs or pre-authored normal/abnormal findings are added.
  The publisher fragment also carries the existing 13 supporting category/action
  records and 12 system-exam classification paths; they are dependencies, not new
  order identities.
- The original inpatient path routed to billing-only and would immediately
  complete an inpatient order without care execution. An explicitly authored
  additive action/path, `cm.action.inpatient-care-runtime` and
  `cm.path.inpatient-care-runtime`, routes these 30 existing order
  identities to the existing treatment care queue while retaining
  `clinicalOrderType: hospitalization` and its actual-result payload. The old
  shared path and held `NT_INPATIENT` route remain unchanged for foreign/unadopted
  workspaces and history. This is not a separate inpatient queue or bed engine.
  The separate supporting action is necessary because the existing publisher
  retires an action's prior active path when publishing a replacement path.
- All inpatient diet plans explicitly describe synthetic functional workflow,
  not feeding actually performed or a clinically validated dietary prescription.
  Isolation plans are authored for the exact missing `.inpatient.02`/`.inpatient.22`
  identities. Clinician and ward/cage IDs are never fabricated in master defaults.
- Generic hospital `workspace_spaces` categories have no inpatient resource-type
  contract. A small first-class `workspace_inpatient_locations` list therefore
  stores an explicit `ward`/`cage`, label, active state and row revision. There is
  no occupancy, capacity, reservation, or full bed-management engine.
- `/api/workspaces/:workspaceId/inpatient/locations` uses authenticated sessions
  only. Private SQL readers/writers enforce active membership and existing
  `chart:view`/`hospital_settings:view` read permissions; configuration requires
  `hospital_settings:manage`. RPC-only tables use RLS and revoke direct access.
  Existing role/permission policy is unchanged.
- Registration/update uses caller-generated UUID identity, CAS revision and exact
  retry semantics. Append-only events bind the authenticated actor and before/after
  snapshots. Resources are disabled, never deleted. Empty and unavailable states
  do not produce fallback rooms.
- The standalone `InpatientLocationPicker` lists real registered IDs and offers
  inline configuration only to permitted users. Workspace remount/read generations
  discard late responses. Chart detail and inline editing now resolve the same
  picker; free-text ward/cage values are rejected. There is no bulk picker
  renderer in the current chart UI.
- Confirmation validates that the selected UUID is active in the exact workspace,
  then freezes `confirmed_snapshot.inpatientLocation` (`id`, `label`, `kind`,
  `rowRevision`). Later configuration changes do not rewrite history. The existing
  confirmation wrapper propagates the frozen snapshot to the task. Re-request
  uses the existing authorized order-revision path and resolves a new attempt.
- Hospitalization care uses the existing treatment queue/dispensing permission mapping; other
  and consultation retain the existing chart mapping. Generic actual result
  storage uses manually entered activity/outcome, actor/time and append-only
  amendments. It does not rewrite planned quantities or billing.
- Destinationless system-exam, consultation and other confirmation now requires
  a separate actual-record DTO, explicit performed time and self-performance
  attestation. Actual fields start blank; system-exam findings must equal the
  clinician-authored draft finding. A deferred task INSERT guard rejects the old
  confirmation RPC without a matching actual v1, atomically with the batch.
  Chart-only complete tasks have no routed start transition; a narrowly scoped
  status-check exception permits them without inventing a started time, while
  the actual record remains mandatory.
- Chart task history reads original and amended actual versions through a
  session-authenticated endpoint, with explicit amendment reason and plan/head
  CAS. Hospitalization/routed-other history also exposes the existing lifecycle
  start and shared actual-result dialog; it creates no new execution engine.

## Verification

- `node scripts/generate-wp07-remaining-definitions.mjs` reproduces the artifact.
- `node --test tests/wp07-remaining-definitions.test.mjs`: 3 passed.
- `npx tsc --noEmit`: passed after resource/API/picker additions.
- Focused ESLint: clean for all added TypeScript, generator and test files.
- `tests/inpatient-location-contract.spec.ts`: 3 passed; parser/gateway tests cover
  malformed IDs, empty lists, foreign responses, stale revisions and denial.
- [Local SQL assertions](./artifacts/wp-07/inpatient-local-assert.sql) are integrated
  by the parent harness and passed in its local transaction (2026-09-06).
  Evidence includes all136 publish/adopt/retry, foreign catalog control,
  registered resource CAS/audit, foreign/inactive confirmation rejection, frozen
  task location, actual hospitalization completion and unchanged billing. The
  original shared inpatient path also remained byte-for-byte unchanged.
- [Chart actual SQL assertions](./artifacts/wp-07/chart-actual-local-assert.sql)
  passed for all three chart-only types: old-RPC bypass/missing actual/absent
  attestation denial, atomic actual creation, exact retry and changed-retry
  rejection, no downstream queue, explicit actor/time, immutable plan, amendment
  history/retry, stale-head and foreign-workspace rejection. This run then reached
  a separately owned WP-09 fixture alias error, so it is scoped WP-07 evidence,
  not a claim the combined suite passed. The local transaction rolled back.
- `tests/chart-actual-contract.spec.ts` and the existing chart order-domain suite:
  9 passed. `tests/chart-actual-browser.spec.ts`: passed (mocked API), covering
  blank/manual confirmation, server denial/retry, persisted task reopen and
  amendment history. Desktop/mobile dialog bounds were checked. No authenticated
  live-browser result is implied by the mocked test.
- Authenticated browser, remote application, deployment and complete WP-09
  acceptance remain part of the full active objective, not inferred from local
  implementation or mocked browser results.
