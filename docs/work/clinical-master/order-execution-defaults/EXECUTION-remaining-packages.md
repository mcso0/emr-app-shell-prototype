---
type: Execution Record
title: Remaining order-defaults packages execution
status: in_progress
updated: 2026-09-06
---

# Active objective

The user explicitly reaffirmed completion of the entire remaining package list,
not a single slice: WP-01B, WP-02, WP-03, WP-04, OED-LAB-04, WP-06, WP-07,
WP-08 and WP-09. Continue implementation and relevant verification across bounded
slices without requesting the same approval or ending after a local milestone.
Preserve previous decisions and all existing WIP. Final completion still requires
real evidence; never mark unverified gates complete.

Scope: prototype synthetic master/workspace orders and planned/actual/result flows
in the [upper plan](../CLINICAL-MASTER-order-execution-defaults-remediation-plan.md).
Existing research/candidates are inputs, not completed live master data. No runtime
fallback catalog, invented display defaults, fake device integration or clinical
review queue for prototype master data. Real data/provider effects/security
weakening/destructive remote changes remain gated under current repository rules.

## Execution ledger

| Package | Position | Required exit evidence |
| --- | --- | --- |
| WP-01B | Local persisted read/trace/UI implemented and focused tests pass | Authenticated deployed exact IDs/defaults/counts/edit/reload/use-stop still required |
| WP-02 | Local merge/storage/API/UI and rollback SQL pass | Deployed custom-field/conflict/retry acceptance still required |
| WP-03 |127 definitions and actual preparation/result/history locally verified |51 explicit redefinitions must stop future selection only in approved targets |
| WP-04 |111 V2 definitions and typed actual RPC/browser locally verified | Target activation and authenticated fulfillment/history acceptance |
| OED-LAB-04 | All86 reconciled:90 atomic,35 compositions,24 profiles; overrides/results/retest locally verified | Approved manual profile and billing choices; persistent target acceptance remains |
| WP-06 | All30 definitions and actual existing-review workflow locally verified | Authenticated deployed acquisition/review/result/history acceptance |
| WP-07 |136 exact definitions, real location resolver and explicit chart actual locally verified | Registered target resources and authenticated acceptance |
| WP-08 | Routed and chart-only actual/retry/amendment/history locally verified | Deployed full-category matrix; two-session stress not claimed |
| WP-09 |522→524 combined API+SQL and three-workspace operator rollback/retry verified locally | Fresh post-DDL fingerprints, persistent apply/retirement/selection, authenticated PR Preview/Production delivery |

## Current checkpoint — 2026-09-07

All scope/configuration decisions are approved, including synthetic-selectable108
dispensing profiles, the existing nonbillable pilot set, and differentiated prices
for new53 only. The19-migration local operator harness passes at helper SHA
`f19307dc6ad570cb1e755c391acad130054bc7fc85c560611186766e4da3ea7b`;
false/late-failure/true/retry scenarios all leave no persistent local residue.
See [WP09](./WP-09-complete-candidate-and-rollout.md) for exact counts and boundaries.
The scoped delivery worktree starts at current main22f40916, preserving unrelated
WIP. PR Preview, exact Release Check, Production approval, coordinated DB/app
cutover and authenticated smoke remain. The checkpoints below are historical;
their earlier questions do not reopen approvals.

## 2026-09-06 continuation checkpoint

- Removed Admin runtime store initialization from legacy samples. Added workspace
  ownership/read generation and fail-closed rows/capabilities on denied/error/foreign
  responses. Same-owner unsaved drafts are not merged into another workspace.
- Save/reset/pause/review responses are scoped to the current owner, read generation
  and drawer lifetime. Network failure exits the saving state; it does not manufacture
  a successful write. A late-response browser proof is still outstanding.
- Chart picker now reloads on every opening with a request-generation guard, rather
  than retaining a ready catalog indefinitely after Admin changes.
- Chart transport validates duplicate identity/category/species and lineage
  contradictions. New snapshots carry workspace/source/catalog revisions.
- New local migration `20260906084227_clinical_master_chart_catalog_lineage.sql` extends
  exact-row snapshot/search lineage; no historical snapshot rewrite.
- Focused catalog contracts:152 passed. Local PostgreSQL transaction including
  taxonomy publisher/adopter and new search/snapshot lineage assertions passed and
  rolled back. No remote mutation or deployment performed in this checkpoint.
- Admin UI9 plus the separate dispensing-author permission test and catalog contracts154 pass after WP-02 integration; local PostgreSQL
  publisher/adopter r3–r6, per-field conflict/clear/reset/keep and whole-source
  reconciliation pass inside rollback. See [WP-02](./WP-02-execution-field-lineage-and-merge.md).
- Broader per-schema and authenticated acceptance remain separate.
- [WP-03](./WP-03-dispensing-product-preparation-and-actual.md):168 focused contracts,
  product-ledger tests and actual preparation RPC/confirmation/billing history verified
  locally.127 successor dispensing definitions reconcile159 originals with explicit
  51 replacements/19 additions. No actual execution or remote application claim.

## Historical package checkpoints and resolved question

[WP-04](./WP-04-treatment-planning-and-actual.md) records local all111 publish/adopt/
retry/Admin/snapshot/search and typed actual tonometry RPC evidence.180 contracts,
TypeScript and focused ESLint pass. Local fixture activation is not production
activation proof. Continue the complete objective; no remote completion claim.

WP-08 local progress and unresolved cross-category boundaries are recorded in
[actual execution results](./WP-08-actual-execution-results.md). Core contracts174
and preparation/Admin route/browser16 pass; rollback-only actual record/completion/
amendment/history and planned billing assertions pass. Not remote completion.

[OED-LAB04](./OED-LAB-04-profiles-composition-results-and-retest.md): six-profile
CBC immutable publication, explicit device/profile choice, canonical persisted
result read, typed interpretation and atomic retest are locally implemented.
193 contracts and two mocked browser cases pass; SQL rollback tests cover exact
profile/result pins and independent retest confirmation without rewriting prior
results. Composition, workspace profile overrides, all86 and remote acceptance
remain active. No package-local milestone ends the complete objective.

The question about CLAiR synthetic manual profiles, parent-only set billing and
default nonbillable atomic retest was answered with explicit approval. CBC grouping may use the
proposed LAB-02 fixture and bounded graph-depth implementation must support at least
checkup → CBC → group → atomic without claiming unrestricted recursion.

## Execution discipline

Read-only exploration/review may use at most four concurrent spawned agents;
parallel implementation was explicitly approved on2026-09-06 with disjoint chart,
inpatient and imaging ownership; the parent integrated and verified. Spark quota became unavailable during this
continuation; the existing read-only catalog reviewer completed the chart trace.
No claim of a parent model switch. Use fresh current contracts, not historical
remote hashes. Prepare the complete reviewable release packet before any genuinely
remaining approval-gated operation.
