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
Supabase migration apply remain separate gates under the release runbook. The
original compatibility migration has since been applied to the approved shared
project; the forward billing-handoff correction added after authenticated smoke
is a new candidate and has not been applied remotely.

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
- On dispensing execution, link an existing frozen billing candidate through
  the candidate-authoritative invoice writer. Retain the prior fulfillment sync
  only as a compatibility fallback when no eligible unlinked candidate exists;
  never rewrite an already-linked invoice or its audit history.
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
patches or replaces these eight existing functions:
`clair_save_chart_order_draft_phase2_base`,
`clair_b3_assert_set_child_lineage`,
`clair_compute_plan_order_dispense_projection`,
`clair_set_dispensing_order_lineage`,
`clair_confirm_chart_order_candidates_billing_summary_base`,
`clair_snapshot_order_billing_authority`,
`clair_confirm_chart_order_candidates_origin_base`, and
`clair_b3_runtime_row_json`. The six dynamic patches have exact text-anchor
guards in the migration. The two full replacements—billing authority and
runtime-row JSON—are instead bound, together with the other six functions, by
full predecessor SHA-256 checks in the release preflight and full candidate
SHA-256 checks in the postflight and pre-use rollback.

The migration ends with two scoped `UPDATE public.orders` repairs: one for
mutable, active dispensing set children and one for their root lineage maps.
These are business-row DML even when they affect zero rows. They must not be
described as additive DDL only.

The forward migration
`20260912230700_dispensing_execution_billing_candidate_handoff.sql` patches the
single billing call inside `clair_record_order_execution_result` with an exact
text-anchor guard. It selects
`private.clair_link_chart_order_billing_candidates_internal` only when an
unlinked candidate exists, otherwise preserving the existing fulfillment
compatibility function. It contains no historical invoice/candidate repair DML.

## Acceptance evidence

| Requirement | Local evidence | Remaining boundary |
| --- | --- | --- |
| Dispensing child save no longer conflicts with B3 | Baseline failure above; a mixed dispensing + clinical-lab set saves and passes `SET CONSTRAINTS ALL IMMEDIATE` | Changed candidate review |
| Price and dispensing calculations do not overwrite each other | Exact nine-key pricing copy and clean ready dispensing projection asserted locally and through authenticated remote save/reload | Changed-candidate regression pending |
| Authority and lineage are server-authored and frozen | Catalog-revision authority capture, child lineage, root keyed copy, post-confirm mutation denial; original remote apply and authenticated save/reload/confirm smoke completed | New forward migration pending |
| Set edit/removal semantics remain valid | Dispensing-child deselection while lab stays selected, full-root removal, semantic deselection retry, and rejected repeated removal asserted | Changed-candidate Preview smoke pending |
| Override/reconfirmation semantics remain valid | Exact override retry, harmless resave preservation, dose `1` to `2` recalculation, stale confirmation denial, explicit reconfirmation, and reconfirm retry asserted remotely | Changed-candidate Preview smoke pending |
| Fail-closed boundaries remain valid | Missing authority blocks confirmation; invalid authority is rejected; cross-chart mutation is denied | Revalidate after forward apply |
| Confirmation/source snapshots are complete | Confirmed order, Task, fulfillment work item, billing candidate, execution result/amendment, and linked attempt-2 re-request contracts asserted | Production gated |
| Billing uses the dedicated authority | Per-product-unit candidate freezes quantity `3`, unit price `1000`, amount `3000`, and unit `tablet`; a cloned candidate DB now also proves execution creates a draft, unpaid invoice line with the same quantity and amount through candidate authority | Forward migration remote apply and authenticated re-smoke gated |
| Client readback uses the dedicated authority | Authenticated exact-Preview smoke exposed two fail-closed mapper gaps: omitted non-range `priceRanges` and nullable non-billable set-parent total. Narrow local normalizers and regression tests now cover both without accepting nullable billable child totals | Changed-candidate Preview/Production smoke gated |
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

The authenticated exact-Preview check reached the shared database and proved
set save, reload, override/reconfirmation, confirmation, execution, and
idempotency. It also exposed that the completion path created a draft invoice
line from legacy order quantity `1` even though the frozen candidate was
quantity `3`. The forward migration fixes only future candidate-backed links.
The historical synthetic draft invoice and confirmed audit are intentionally
unchanged, and no payment or collection action occurred. The new invoice
assertion has passed twice in a rollback-only cloned-database rehearsal; it is
not yet remote evidence. The same rehearsal also proves the no-candidate legacy
fallback in a rolled-back subtransaction and proves that an execution amendment
does not duplicate or mutate the candidate-authoritative invoice line.

The pre-use rollback artifact was applied to a clone of the candidate database.
It restored all eight predecessor function definitions to their baseline
SHA-256 values, removed all candidate objects, and preserved the exact 12-row
baseline fingerprint. A separate denial clone with one nonempty candidate
snapshot stopped at `dispensing_set_compatibility_rollback_after_use_denied`
and retained all three columns, proving the fail-closed after-use guard. Two
additional drift-negative clones added an independent field to the fully
replaced runtime-row function: apply stopped before DDL and retained the
predecessor change, while rollback stopped before trigger removal and retained
the candidate change.

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

## Remote apply evidence and forward correction

The original read-only preflight on `clair-emr-staging / qmerxgzrwaaahpkhjqlc` found the
project healthy and the latest remote migration at `20260908211856`. The
current Vercel Production environment uses this same shared Supabase project.
The exact migration SHA-256 is
`84d955b3c881121cd91d6172b9ccf31599614ab67cc8d612156f119885141432`.
The release-only preflight, postflight, and pre-use rollback SHA-256 values are
`42451cbe8788789b0074295434276db3070e8d723c92c73c087dd6d05aaab0d4`,
`356d77980209a808d3186e5c635cdb4947ed21666cad4d820c65c05d0bc0caa7`,
and `8a150ecdfc3b32a4ab078a79b06e42dc9c0f9a44dd88859ac1d01c5ac4ceb274`.

That exact original packet was applied and is recorded remotely as migration
ledger version `20260912132531`. Post-smoke cleanup archived the synthetic set
and catalog item and completed its consultation queue while retaining the
confirmed/execution/invoice audit history. Non-fixture orders remained at 162
with the same existing-field fingerprint
`3dae85d3e90453ba69e681eb4129681a`; the foreign workspace remained unchanged.
Do not reapply or rewrite the original migration.

The forward billing-handoff migration is locally validated only. It must receive
a fresh exact-SHA review/apply packet and remote postflight before the workflow
can claim candidate-to-invoice billing consistency. The historical synthetic
invoice discrepancy is evidence and is not a cleanup target.

The forward migration, preflight, postflight, and strengthened rehearsal
SHA-256 values are respectively
`6739b19a967b6c2623341b9355f159607bb45d9e73c00b3efc23de38d374547b`,
`c8e3924720bc5e0ebee655461f247f769a61863e559b4eba09a677d6ba7dab14`,
`241cb6648589cd0640e79bf6959346b5ee19461ef70ddf432a5a1a14a4358a03`,
and `5e3e5ea331f5708fcc45017b6e8846590f49e11bd87d94e904b5fdb757848f5b`.
The packet fixes the current remote execution-function SHA-256
`33763f9994cc60979c301435793c7c71207e5b41f4400a7c24d40d34340c4a7b`
to candidate SHA-256
`dbd9321c23391fce6e559e01139fba53c1cfeea431fa2208513062ec4b982a18`
while pinning the existing candidate linker SHA-256
`6e5ca8e3e043cb653cb0049c2d6864a8420a4bd1df47c0753c8d11f905b57ccc`.
On a cloned database, the whole preflight/migration/postflight transaction
passed, the strengthened rollback rehearsal passed twice, and replaying the
preflight against the already-patched definition failed closed as drift.

At the original preflight, the remote `orders` baseline was 162 rows with existing-field fingerprint
`3dae85d3e90453ba69e681eb4129681a`. Candidate columns, helpers, and triggers
were absent. There was one set child, but zero dispensing set children and zero
confirmed dispensing set children, so the two repair statements currently
expected `UPDATE 0`. The predecessor anchor counts were `3 / 31 / 1 / 2 / 1 / 4`
for the writer, B3 constraint, authority, base calls, confirmation snapshot,
and billing projection respectively.

The original remote application concatenated, in one transaction, the exact preflight
snippet, the exact migration, and the exact postflight snippet. The preflight
takes an `ACCESS EXCLUSIVE` lock and stops if the 162-row fingerprint, zero
dispensing-set-child assumption, absent-object state, or predecessor anchors
change. The postflight requires the same 162-row fingerprint, zero nonempty new
snapshots on preexisting rows, all columns/constraints/triggers/helpers, patched
anchors, and private helper grant denial before committing.

The captured predecessor and candidate function SHA-256 values are:

| Function | Predecessor SHA-256 | Candidate SHA-256 |
| --- | --- | --- |
| `clair_save_chart_order_draft_phase2_base` | `bff6b9f029576b690267bfa3b4903f739c616ecd6e7b02526f1c3980d9d92415` | `1bacf55f8ef7886c7729dcf54d46b1e107c9e81d9862e051f7ff5f95660008dc` |
| `clair_b3_assert_set_child_lineage` | `fc9276157eb42ddf3df01f28d748036526dc73c88fa26b79a4f9a451adf98832` | `2d966e28eb8e8f60eb97765e6e1807ddc3ed922382c1dea33ee8e9d03fe7709b` |
| `clair_compute_plan_order_dispense_projection` | `45e7d833c3aac8fd6a95838c8b10d141ade4e5debdaab6b51602db53a0ed0ec7` | `76a817fffa69e4721261f353ce834e5bf91ca23413c3d047378b4b74a1c52c6b` |
| `clair_set_dispensing_order_lineage` | `a7bdc73f260867a90f72bbfcb06cb02e2c8e1ff0242fc962ec7561151980cb02` | `0d045bea458e4b4e9358ca680f71712ac73ed1be4ff0badea2c0caff95333079` |
| `clair_confirm_chart_order_candidates_billing_summary_base` | `ef199a2e9df94783a7065a7d295ddf307f9281c31552b86ef03b5b93aa7749c0` | `772d3042977beb75c8f685498982ce700aa6dcd7762bb66f8ad26282552b144b` |
| `clair_snapshot_order_billing_authority` | `6a2ac1b735567d116932b20c8b9816557bcd1b20e7f9112112a55cdfc1bfb7cf` | `887fcfb012e38a9e72cf93249fc7f26a99cbfcb6e5ffff87b09843edd7243721` |
| `clair_confirm_chart_order_candidates_origin_base` | `06d6e61c633bee382dd53db84ccb8c2a5a2c0db1534918a9362ef35d78a7b683` | `117e71a2689568f392cbfbe0e4e324d4443af795a822d9420b60dd9a8e042b81` |
| `clair_b3_runtime_row_json` | `42b0427da929c84ae9b012de0c05b2717ed9c2d3c179c5a5c3e9c48049b47bb5` | `afb2b2065bb1809aacad45414d3e60ecebfb457626440ef70d088d0dd85d5d98` |

## Remaining gates

- Reconcile the changed branch with current `origin/main`, then obtain a fresh
  independent review and exact candidate SHA.
- Push the changed PR head, wait for Preview Ready and exact-head Release Check,
  then repeat the authenticated mixed-set smoke.
- Prepare and approve a separate forward-migration apply packet with target,
  preserved-data preflight, exact SHA, postflight, and forward recovery. Do not
  alter the historical confirmed/invoice audit.
- Exact-candidate `main`/Production approval after PR, checks, Preview,
  Production comparison, smoke path, rollback candidate, and stop conditions
  are all known. A changed PR head invalidates that approval packet.
