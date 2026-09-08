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

Release sequencing: deploy the compatible app first, verify Production Ready,
then run the already-authorized fingerprint-bound master/catalog transaction.
Before that transaction the previous Production deployment is a rollback option.
After catalog normalization, an app-only rollback must retain chart V2 result
recording and treatment V3 linkage; an older incompatible app is not a valid
standalone rollback. Use the compatible Ready candidate or a reviewed forward fix.

## Evidence

### 2026-09-08 production chart-read correction

After PR #726 was merged and the approved normalization packet was applied,
the user requested actual chart verification and correction of remaining defects.
The internal browser reproduced `Order 추가` loading failure: all 494 atomic
RPC rows had null `appliedAmountBasis`, causing the strict application mapper to
reject the entire 524-row response. Admin reads had masked this because their
existing compact-pricing rule defaults to `fixed_order_price`.

- Migration `20260908110612_wp10_chart_price_basis_projection` was applied to the
  same approved synthetic verification project. Three existing chart read
  functions now project the same effective default while retaining explicitly
  authored bases such as `unit_price`. The future WP-10 initializer writes its
  chosen fixed-price basis explicitly. No catalog amount, revision, set pin,
  stored order snapshot, role or permission was changed by this migration.
- The exact-packet local rollback harness passed, including all four 524-row
  chart responses, compact/null/explicit-unit/snake-case pricing, unchanged
  amounts, row-state preservation, packet rejection, rollback and receipt retry.
  The app mapper remains strict: missing projected basis still fails closed.
- Remote before/after fingerprints matched across all 181 covered entries and
  clinical history. The four changed functions retained ACL, owner, security
  mode, search path, volatility and parallel attributes. Advisor finding counts
  were unchanged. Independent bounded review found no blocker.
- The actual repaired Cheongdam RPC returned 494 atomic rows plus 30 sets with
  no missing basis; the deployed app mapper accepted all 524. The internal
  browser showed 479 patient-species-eligible choices rather than a loading error.
- In the existing synthetic chart, new 초진 and 요화학 비중 검사 candidates both
  displayed `확정 대기`. Responsible clinician, occurrence, timing, instruction,
  urine specimen, test item, collection condition and the synthetic result
  profile resolved. Editing the new consultation's occurrence/instruction saved
  to the DB. Existing six order rows remained byte-equivalent.
- Both agent-created candidates were removed through the normal UI and are
  retained as `cancelled` / `draft_candidate_removed` audit history. The chart
  returned to its original six visible rows; no confirmation, actual result or
  billing action was performed. Existing legacy drafts were preserved.
- Focused app contracts: 58 passed. Type checking, lint (zero errors; five
  existing warnings), production build, secret scan and docs checks passed.
  This DB-only runtime correction uses the existing compatible Production app.
  The repository follow-up PR still follows the exact-candidate merge gate.

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
- Remote additive schema migrations were applied on 2026-09-08. Local migration
  filenames are aligned with the actual remote ledger versions to avoid replay.
  Master publication/current-catalog normalization has not persisted yet.
- Remote scalar preflight covers 181 table/workspace entries and 17 clinical-history
  tables. The first 105-second rehearsal stopped during foreign workspace adoption;
  a full subsequent fingerprint comparison proved row-state restoration. Target
  release, application receipt and foreign catalog all remained absent. Release
  sequence advanced to 89 and was not rewound.
- A private operator-only rehearsal receipt passed local rollback integration so completed rollback
  evidence remains queryable if the transport times out. Its schema requires a
  matching packet hash, rehearsal=true and applied=false; authenticated/service
  roles receive no access. Receipt absence alone does not prove execution ended.
- Independent security review confirmed that scalar hashing retains all prior
  table/workspace coverage and that rehearsal evidence follows successful row
  restoration. Authenticated access to the new actual-result RPC is intentional
  and retains actor, workspace and permission checks; the advisor's corresponding
  SECURITY DEFINER notice does not grant additional access.
- PR #726 Preview is Ready for source 2bbf10b14cc0bf46224dc2e50a704bcd4cded94f;
  Release Check 34204781751 passed for that source. The later SQL execution-evidence
  changes require a fresh final candidate check. Preview browser reaches the real
  login screen; authenticated remote browser smoke is not yet established.

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

- Remote ledger: 20260908083019 (chart planning/archive), 20260908083035
  (normalization operator), 20260908083048 (treatment V3), 20260908083938
  (scalar state comparison), 20260908085242 (rehearsal evidence receipt).
  20260908092110 (failure diagnostics), 20260908092115 (reused projection plans).
  20260908093016 (resource diagnostic counts), 20260908094229 (frozen archive IDs).
  All nine files match applied DDL; no application permissions were expanded.
- Failure diagnostics are private and run outside the rehearsal subtransaction.
  A real 50 ms statement cancellation in the local rollback harness proved that
  the changed probe row restores, one failure diagnostic survives the savepoint,
  and no success receipt is written. No commit mode is exposed by the wrapper.
- Repeated source projection planning was measured as a bottleneck. The two
  exact-source-hash-bound SQL functions now reuse PL/pgSQL plans with their
  original SELECT bodies, first-row/null semantics and catalog attributes.
  Remote before/after hashes matched for all 575 orders and one nonexistent ID
  (576 comparisons, zero differences). Independent security review found no
  remaining blocker in these two additive migrations.
- Remote diagnostic rehearsals completed in 341 and 388 seconds. Both rolled
  back with a resource readback failure; exact diagnosis was `clair-demo` with
  173 bindings, 31 active sets and one default ward. Full 181-entry plus 17-history
  fingerprint comparison proved restoration after the failure and narrow probes.
- A narrow rollback probe reproduced one skipped extra parent during archival:
  an earlier child's normal invalidation trigger updates the parent while the
  `FOR UPDATE` cursor is scanning. Freeze extra IDs before mutation, then re-read
  and lock each current row for archival/audit. The matching fixed rollback probe
  left zero unarchived extras. No trigger is disabled and immutable revisions
  remain unchanged. Independent security review found no concrete blocker.
- Local final packet tests also cover durable failure evidence and real statement
  cancellation. Transport HTTP 504 does not establish DB completion; inspect
  active execution and durable receipts before retrying.

- Nested extra-set regression passed through the actual immutable B2 creation
  core and resource normalizer: a child invalidation updates the parent before
  its archive, both extras become inactive/archived, canonical active count is
  30, current revision pins and all original revision/items/ranges/creation
  requests are byte-identical, clinical history is unchanged, and each extra
  receives one accurate archive audit with no duplication on retry. Deferred
  constraints also pass.

- Remote exact-packet rehearsal succeeded at 2026-09-08 09:51:15 UTC after all
  nine migrations, with `rehearsal=true` and `applied=false`. Packet SHA-256:
  `19deb45a981824df2c7997835a5bfcb40a604f40c63537b3b27b7e26cabfb833`.
  Each of the four workspaces passed 524 selectable classified orders, 173
  profile bindings, 30 active compositions and one active default ward; required
  planning defaults and clinical-history guards passed. The durable success
  receipt is operator-only. Release sequence advanced 92 to 93 and action-code
  sequence 769 to 795; these nontransactional gaps are recorded, not rewound.
- Post-success readback matched both the frozen preflight and receipt before-state
  across 181 state entries and 17 clinical-history tables. Clinical history also
  matched the rehearsal after-state. The proposed release and application receipt
  are absent: master/current catalogs are still unchanged pending compatible
  Production delivery and the already-authorized persistent transaction.
