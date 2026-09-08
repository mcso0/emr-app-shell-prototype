---
type: Work Package
title: Ready-on-add orders and pristine synthetic workspace catalogs
status: in_progress
updated: 2026-09-08
---

# WP-10 — Ready orders and workspace unification

Parent: [Order defaults plan](../CLINICAL-MASTER-order-execution-defaults-remediation-plan.md).

## User-approved outcome and scope

On 2026-09-08 승욱 approved implementation of the preceding requirements:
new Plan/Order candidates must contain valid required defaults and selected default
options, display `확정 대기`, and allow review/changes before confirmation. Merely
hiding `입력 필요`, invented actual findings, and dummy foreign-key defaults do not
meet this outcome.

Reset these four synthetic functional-verification workspaces to one current master
catalog: `clair-demo`, `clair-foreign-demo`, `workspace-clair-cheongdam`, and
`workspace-clinical-master-pilot-v1`. This explicitly supersedes the older WP-09
three-workspace/foreign-unchanged scope for this operation only. Remove local-only
items from current catalogs, reset workspace customization, normalize taxonomy,
source versions and defaults, and initialize equivalent valid workspace resource
bindings. Preserve existing patient/encounter/order/result/billing history and
immutable snapshots. Referenced retired catalog identities remain archived for
foreign-key integrity; unreferenced local items may be deleted after verification.

Canonical master excludes prices. Common functional-test prices are a separate
workspace-owned initialization fixture based on existing authored synthetic pricing
fixtures; they are not clinical pricing authority. No real data/provider actions,
permissions changes, clinical approval, or new public reset API are in scope.

## Implementation sequence

1. Freeze current master/catalog identities and recovery data; inspect references.
2. Version planning schemas so actual findings/results are recorded at execution,
   not defaulted or required to create/confirm the plan. Keep historical V1 behavior.
3. Provide explicit master options and valid workspace default locations/profiles.
   Preserve encounter-authoritative clinician resolution.
4. Normalize the master and all four current catalogs with an operator-only,
   fingerprint-bound transaction, rollback rehearsal and idempotent readback.
5. Show editable defaults and actionable per-field errors for user-created invalid
   states in the existing table/detail pattern.
6. Verify full catalog readiness plus focused UI, lifecycle, data integrity and
   cross-workspace tests. Prepare exact PR Preview/release evidence.

On 2026-09-08 the user selected the recommended treatment flow: the eight
linked-medication plans may confirm before linkage. New treatment schema V3
requires a same-workspace, same-encounter confirmed noncancelled dispensing order
before execution starts or completes. Link through the existing pending-order
amendment. No companion medication/dose/billing row is added automatically.
Historical V2 confirmation rules remain intact; a V3 plan cannot downgrade its
schema to bypass the execution boundary. Cancellation remains available if the
linked medication becomes invalid.

## Done criteria

- Every current selectable master identity exists in all four workspaces;
  no active local-only, retired, or unclassified identities remain.
- Resolved required planning defaults pass app and DB validators on add.
- User changes remain editable, durable, and validated without losing defaults.
- New chart-only plans confirm pending, and actual completion requires explicit
  actor/time/result with immutable history and scoped idempotency.
- Historical row/snapshot fingerprints remain unchanged during catalog reset.
- Exact mutation packet passes rollback rehearsal and readback; unexpected drift
  stops application. No trigger/RLS bypass or blanket database reset.

## Delivery boundary

User approval covers the scoped synthetic reset and implementation. Production
merge/deploy still follows the current exact-candidate release gate. Prepare the
candidate/checks/rollback before that remaining approval. Do not apply incompatible
DB lifecycle changes while the old app is still the advertised verification path.

## Evidence

- Base: `origin/main` 2e095d5576b5f916640f7b7df720454280c83609 in isolated worktree.
- Initial remote read: master 575; local-only catalog rows 19/0/12/0 in the four
  listed workspaces; no mutation performed at intake.
- Focused app contract tests: 11 passed (`chart-actual-contract` and
  `chart-order-execution-domain`, catalog-contract Playwright config).
- `npx tsc --noEmit`: passed after planning/API/detail-error changes.
- `node scripts/test-wp01b-taxonomy-local.mjs --chart-plan-v2`: passed in the
  named synthetic local Docker DB, with outer rollback. Covered three V2 types'
  plan confirmation without actuals, explicit first actual and retry, V1 and
  schema-0 historical behavior, explicit local default location/inactive
  exclusion, source preservation and archive FK history.
- Local publisher/retirement rehearsal: 524 published master orders and 51
  deprecated orders; rollback completed. The general cumulative publisher
  leaves live lifecycle columns unchanged, so the scoped operator reconciles
  only the corresponding new immutable deprecated snapshots and appends review
  events. No prior versions/reviews are altered.
- Common synthetic pricing fixture covers all 524 current identities: 512
  numerical prices and 12 canonical nonbillable items. Existing authored fixtures
  cover 510 amounts; two older keys use the current Cheongdam synthetic values
  read on 2026-09-08 (initial 34,300; metabolic 35,000). These are a selected
  common test baseline, not master or market pricing authority.
- Missing specimen on 11 composite roots is resolved by applying their existing
  compiled sets with separately pinned atomic specimens, not assigning a generic
  parent specimen. Giardia's authored specimen is `cm.specimen.feces`.
- `node scripts/test-wp10-catalog-reset-local.mjs`: passed with outer rollback.
  Covered new release publication, 51 retirements, four catalogs with 524 current
  rows, 108 product/profile projections into the formerly empty catalog, source
  acceptance and lab membership cascade, canonical value copy, extra-row archive,
  17 clinical/history/billing table fingerprints, and mutation-free reset retries.
  The historical local fixture lacks a pilot administrator; the harness creates
  that fixture membership inside the rollback transaction only. Remote execution
  must select an existing authorized administrator per target; it grants no roles.
  Common prices must precede source acceptance for older nonbillable fixtures.
- Resource rollback integration passed: four workspaces each have 173 canonical
  profile bindings, 30 source compositions and one explicit default ward; current
  overrides are reset with audit while immutable history remains. Offline planning
  validators passed 1,976 probes (494 atomic identities across four workspaces).
- Browser tests passed for pending V2 plans, blank actual-result inputs, explicit
  self-attestation and result submission on desktop/mobile; legacy amendment smoke
  also passed. These use synthetic mocked APIs, not remote workspace smoke.
- Type checking, lint, default Turbopack production build, docs and secret scan
  passed. The worktree uses a local copy of existing dependencies because
  Turbopack rejects an external node_modules symlink; dependencies/config unchanged.
- Exact packet local integration passed: five malformed identity/price cases and
  a wrong hash are rejected, full four-workspace rehearsal restores rows, actual
  application creates the receipt and retry leaves rows unchanged. Every test is
  inside an outer rollback. Remote rehearsal/readback, authenticated workspace
  smoke and delivery remain.
- Packet scope checks bind actual payload order identities and retirement states
  to the approved 524+51 keys and bind all price keys exactly to the 524 selectable
  keys. Five malformed packet regressions cover extra/missing/duplicate orders,
  wrong retirement state and duplicate prices. Operator results separately record
  master sequence values: row rollback does not undo sequence advancement.
- All remote Supabase operations so far are read-only. Generated WP-10 artifacts
  explicitly remain non-applied and the candidate is incomplete while the
  resource/remote packet has not yet passed complete verification.

- Treatment V3 local rollback integration passed: unlinked plan confirmation,
  start denial for missing or unconfirmed medication, V3 downgrade and invalid
  target denial, pending amendment followed by real start/actual completion,
  cancellation-after-start blocking completion while allowing treatment cancel.
  No companion medication is created by confirmation.
- Focused app contract suite passed 23 tests after treatment V3 was added.

- Final mixed-set rollback test passed with nonbillable catalog leaves: all three
  V2 chart types remain pending until explicit actual results, and aggregate
  status advances partial/full. New inserts transport catalog billing eligibility;
  existing rows and per-order billing reflection are unchanged.
- Final source readback compared all 575 master/current-preset identities,
  revisions, schema versions and hashes with the frozen intake: no drift.
- Independent security review found no remaining concrete blocker after payload
  identity/price binding and V2 billing transport fixes; remote execution evidence
  is still required.
