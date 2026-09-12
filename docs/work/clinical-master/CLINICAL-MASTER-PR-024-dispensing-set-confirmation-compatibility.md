---
id: "CLINICAL-MASTER-PR-024"
type: "Work Item"
title: "Dispensing Set Confirmation Compatibility"
description: "Separates immutable B3 set pricing from dispensing calculation, authority, and lineage snapshots so a dispensing set child can save and confirm without weakening either contract."
status: "human_review"
area: "clinical-master"
priority: "P0"
tags: [clinical-master, order-set, dispensing, confirmation, billing]
target_pr: "#747"
source_docs:
  - "docs/work/clinical-master/CLINICAL-MASTER-PR-006-phase-1b-3-chart-set-runtime.md"
  - "docs/work/clinical-master/CLINICAL-MASTER-PR-023-plan-order-authority-enrichment.md"
  - "docs/work/chart/CHART-PR-037-encounter-multi-chart.md"
dependencies:
  - "CLINICAL-MASTER-PR-006"
  - "CLINICAL-MASTER-PR-023"
  - "CHART-PR-037"
updated: "2026-09-12"
---

# Dispensing Set Confirmation Compatibility

## Goal and authorization

Repair the inherited incompatibility between the exact B3 set-child snapshot
contract and the dispensing projection/lineage contract. The user authorized a
local implementation, self-test, and reviewable candidate, followed by an
independent review request to the original Codex task. The user later expanded
delivery through commit, push, PR, exact-candidate review, and a requested
Production release. The exact `main`/Production approval packet and any remote
Supabase migration apply remain separate gates under the release runbook.

Work on branch `codex/dispensing-set-confirmation-compat` in the isolated
`34bb` worktree. Preserve the primary checkout and the separate current-chart UI
worktree. The current-chart task owns Assessment and Plan/Order chart scoping;
this item owns only dispensing-set storage, calculation, and confirmation.

## Reproduced defect

On the current `origin/main` migration chain through
`20260908211856_encounter_multi_chart`, a chart-scoped save of the synthetic
`den194-set-kong-vomit-compact` set with its dispensing child reached the write
path but failed when deferred constraints were forced immediate:

- SQLSTATE: `P0001`
- message: `order_set_snapshot_hash_invalid`
- source: `private.clair_b3_assert_set_child_lineage()`

The B3 writer hashes a literal nine-key price calculation as part of the set
composition envelope. The plan-order BEFORE trigger then replaces
`calculation_outputs` with the dispensing projection. A master-backed
dispensing-lineage trigger also appends a non-B3 key to `applied_snapshot`.
Both operations invalidate the exact composition/hash contract.

## Implemented representation

- Keep operational dispensing results in the existing `calculation_outputs` so
  confirmation, overrides, re-request, fulfillment, and billing readers retain
  their existing contract.
- Capture the exact B3 price object in
  `orders.set_pricing_calculation_outputs` before the dispensing projection.
- Freeze the server-authored catalog authority in
  `orders.dispensing_authority_snapshot`, outside the literal B3 composition
  object, and feed that copy to the existing V1/V2 calculator.
- Store a master-backed child lineage object in
  `orders.dispensing_lineage_snapshot`; atomically maintain a revision-item keyed
  copy on the set root from an AFTER trigger so one B3 removal statement can
  cancel both root and children without a PostgreSQL self-update conflict.
- Validate B3 schema/hash against the pricing copy, validate parent/child
  lineage equality with a deferred constraint, and freeze all three separated
  values into the confirmation/task/billing source snapshot.
- Teach billing authority capture and confirmation quantity projection to read
  the dedicated authority, so per-product-unit quantity, unit, and amount stay
  correct without changing the B3 hash input.
- Preserve an existing manual actual-dispense override on a harmless set save;
  on a clinically relevant edit, retain it and require explicit reconfirmation.
- Preserve the old applied-snapshot lineage representation for individual
  orders. Existing calculator behavior and API fields remain compatible.

## Migration object inventory

The migration adds three `orders` columns and their object checks, plus these
eight private helpers:

- `clair_is_set_pricing_calculation_outputs`
- `clair_b3_pricing_calculation_outputs`
- `clair_order_dispensing_authority`
- `clair_order_dispensing_lineage`
- `clair_capture_set_dispensing_contracts`
- `clair_sync_set_dispensing_lineage_copy`
- `clair_sync_set_dispensing_lineage_after`
- `clair_assert_dispensing_set_contract_copy`

It adds the capture, lineage-copy, and deferred contract-copy triggers. It also
patches or replaces these eight existing functions behind exact text-anchor
drift guards: `clair_save_chart_order_draft_phase2_base`,
`clair_b3_assert_set_child_lineage`,
`clair_compute_plan_order_dispense_projection`,
`clair_set_dispensing_order_lineage`,
`clair_confirm_chart_order_candidates_billing_summary_base`,
`clair_snapshot_order_billing_authority`,
`clair_confirm_chart_order_candidates_origin_base`, and
`clair_b3_runtime_row_json`.

The migration ends with two scoped `UPDATE public.orders` repairs: one for
mutable, active dispensing set children and one for their root lineage maps.
These are business-row DML even when they affect zero rows. They must not be
described as additive DDL only.

## Acceptance evidence

| Requirement | Local evidence | Remaining boundary |
| --- | --- | --- |
| Dispensing child save no longer conflicts with B3 | Baseline failure above; a mixed dispensing + clinical-lab set saves and passes `SET CONSTRAINTS ALL IMMEDIATE` | Independent review |
| Price and dispensing calculations do not overwrite each other | Exact nine-key pricing copy and clean ready dispensing projection asserted | Remote migration apply gated |
| Authority and lineage are server-authored and frozen | Catalog-revision authority capture, child lineage, root keyed copy, post-confirm mutation denial | Authenticated remote smoke gated |
| Set edit/removal semantics remain valid | Dispensing-child deselection while lab stays selected, full-root removal, semantic deselection retry, and rejected repeated removal asserted | Preview smoke pending |
| Override/reconfirmation semantics remain valid | Exact override retry, harmless resave preservation, dose `1` to `2` recalculation, stale confirmation denial, explicit reconfirmation, and reconfirm retry asserted | Preview smoke pending |
| Fail-closed boundaries remain valid | Missing authority blocks confirmation; invalid authority is rejected; cross-chart mutation is denied | Remote state remains unchanged |
| Confirmation/source snapshots are complete | Confirmed order, Task, fulfillment work item, billing candidate, execution result/amendment, and linked attempt-2 re-request contracts asserted | Production gated |
| Billing uses the dedicated authority | Per-product-unit candidate freezes quantity `3`, unit price `1000`, amount `3000`, and unit `tablet` | Remote migration apply gated |
| Client readback uses the dedicated authority | Both server mappers retain the field; local route-intercepted browser smoke covers the preserved individual-order path and a set-child path that exposes and saves the constrained `준비 예정량` control without an applied-snapshot authority copy | Authenticated mixed-set Preview/Production smoke gated |
| Individual/legacy compatibility | Existing preparation V2 direct calculator suite passes; unconfigured legacy child remains fail-closed | Broader historical replay is stale under multi-chart lifecycle |
| Foreign workspace isolation | Foreign active member cannot read the candidate catalog or set through RLS | No remote foreign workspace mutation |
| Existing persisted rows preserved | Baseline/candidate order count `12/12`; existing-field fingerprint `817cec76e9ff37ba12c601c847572d87` equal after excluding three additive columns | Remote preflight required before any future apply |

The owned local PostgreSQL database is cloned from the documented
`chart_pr037_perf_rehearsal` schema-only/synthetic source, then applies
`20260908211856` and the candidate migration. The new rehearsal creates only
synthetic master/catalog/set/chart rows inside one transaction and always rolls
back. Running it twice passes without residue. This is not remote integration
evidence and does not include real clinical records.

Static PL/pgSQL checks report no new errors or warnings in the changed trigger,
calculation, confirmation, and billing functions; the B3 writer's one
unused-variable warning is identical in the baseline database. Repository docs and secret checks,
ESLint (five pre-existing warnings), and a webpack production build including
TypeScript all pass.

The route-intercepted browser checks prove only client readback and the
actual-dispense override interaction. They are not a real database-backed
mixed-set save/reload/confirm/downstream E2E. Likewise, the asserted billing
output is a billing candidate projection, not an issued invoice, payment, or
collection result. Those boundaries remain in the remote Preview/Production
gate and are not claimed as local completion evidence.

The pre-use rollback artifact was applied to a clone of the candidate database.
It restored all eight predecessor function definitions to their baseline
SHA-256 values, removed all candidate objects, and preserved the exact 12-row
baseline fingerprint. A separate denial clone with one nonempty candidate
snapshot stopped at `dispensing_set_compatibility_rollback_after_use_denied`
and retained all three columns, proving the fail-closed after-use guard.

## Verification and recovery

Primary replay:

```sh
docker exec -i chart-pr037-postgres psql -U supabase_admin \
  -d dispensing_set_compat_20260912 -X \
  < supabase/snippets/clinical_master_dispensing_set_confirmation_compatibility_rehearsal.sql
```

Recovery is forward-only after persistent use: stop new dispensing-set saves at
the application/RPC boundary, keep the additive columns and all confirmed
snapshots, and ship a reviewed corrective migration. Before any adoption, when
all three new columns are still empty and no candidate code has written them,
the reviewed
`clinical_master_dispensing_set_confirmation_compatibility_preuse_rollback.sql`
artifact can restore the captured function definitions, drop the three new
triggers and private helpers, and drop the three columns. Never drop populated
columns or restore the old functions after candidate-written dispensing-set
rows exist.

## Exact remote apply preparation

Read-only preflight on `clair-emr-staging / qmerxgzrwaaahpkhjqlc` found the
project healthy and the latest remote migration at `20260908211856`. The
current Vercel Production environment uses this same shared Supabase project.
The exact migration SHA-256 is
`84d955b3c881121cd91d6172b9ccf31599614ab67cc8d612156f119885141432`.
The release-only preflight, postflight, and pre-use rollback SHA-256 values are
`dc03dadebd316fb6d24e6e35184d02390898c1a27778477bfdd67af9c3177e27`,
`f3c4b585560693dd95c229dce0520218baf080e4dc938752b6a987e124a6dc92`,
and `eece8a7172cb14dadd71a62f4948458ba57b9da27d0f3e8b82109f83f5e6a34b`.

The remote `orders` baseline is 162 rows with existing-field fingerprint
`3dae85d3e90453ba69e681eb4129681a`. Candidate columns, helpers, and triggers
are absent. There is one set child, but zero dispensing set children and zero
confirmed dispensing set children, so the two repair statements currently
expect `UPDATE 0`. The predecessor anchor counts are `3 / 31 / 1 / 2 / 1 / 4`
for the writer, B3 constraint, authority, base calls, confirmation snapshot,
and billing projection respectively.

Remote application must concatenate, in one transaction, the exact preflight
snippet, the exact migration, and the exact postflight snippet. The preflight
takes an `ACCESS EXCLUSIVE` lock and stops if the 162-row fingerprint, zero
dispensing-set-child assumption, absent-object state, or predecessor anchors
change. The postflight requires the same 162-row fingerprint, zero nonempty new
snapshots on preexisting rows, all columns/constraints/triggers/helpers, patched
anchors, and private helper grant denial before committing.

The captured predecessor function SHA-256 values are:

| Function | SHA-256 |
| --- | --- |
| `clair_save_chart_order_draft_phase2_base` | `bff6b9f029576b690267bfa3b4903f739c616ecd6e7b02526f1c3980d9d92415` |
| `clair_b3_assert_set_child_lineage` | `fc9276157eb42ddf3df01f28d748036526dc73c88fa26b79a4f9a451adf98832` |
| `clair_compute_plan_order_dispense_projection` | `45e7d833c3aac8fd6a95838c8b10d141ade4e5debdaab6b51602db53a0ed0ec7` |
| `clair_set_dispensing_order_lineage` | `a7bdc73f260867a90f72bbfcb06cb02e2c8e1ff0242fc962ec7561151980cb02` |
| `clair_confirm_chart_order_candidates_billing_summary_base` | `ef199a2e9df94783a7065a7d295ddf307f9281c31552b86ef03b5b93aa7749c0` |
| `clair_snapshot_order_billing_authority` | `6a2ac1b735567d116932b20c8b9816557bcd1b20e7f9112112a55cdfc1bfb7cf` |
| `clair_confirm_chart_order_candidates_origin_base` | `06d6e61c633bee382dd53db84ccb8c2a5a2c0db1534918a9362ef35d78a7b683` |
| `clair_b3_runtime_row_json` | `42b0427da929c84ae9b012de0c05b2717ed9c2d3c179c5a5c3e9c48049b47bb5` |

## Remaining gates

- Independent review by the original parent Codex task and exact candidate SHA.
- Push, PR Preview Ready, exact-head manual Release Check, and scoped Preview
  smoke under the expanded delivery request.
- A separate, explicit remote Supabase migration apply packet with target,
  preserved-data preflight, apply order, verification, and forward recovery.
- Exact-candidate `main`/Production approval after PR, checks, Preview,
  Production comparison, smoke path, rollback candidate, and stop conditions
  are all known. A changed PR head invalidates that approval packet.
