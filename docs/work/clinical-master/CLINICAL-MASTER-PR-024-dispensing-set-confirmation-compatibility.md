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
original compatibility migration and the forward billing-handoff correction
added after authenticated smoke have both since been applied to the approved
shared project through separately guarded packets.

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
| Price and dispensing calculations do not overwrite each other | Exact nine-key pricing copy and ready dispensing projection asserted locally and through fresh exact-Preview save/reload/confirm; the subsequent focused UI regression proves a quantity-1 stored set child displays the quantity-3 required dispense total without changing its snapshot | Exact changed-head Release Check and Production gate |
| Authority and lineage are server-authored and frozen | Catalog-revision authority capture, child lineage, root keyed copy, post-confirm mutation denial; original and forward remote applies plus fresh lineage-backed exact-Preview smoke completed | Production gated |
| Set edit/removal semantics remain valid | Dispensing-child deselection while lab stays selected, full-root removal, semantic deselection retry, rejected repeated removal, and fresh exact-Preview mixed-set save/reload asserted | Production gated |
| Override/reconfirmation semantics remain valid | Exact override retry, harmless resave preservation, dose `1` to `2` recalculation, stale confirmation denial, explicit reconfirmation, reconfirm retry, and fresh exact-Preview confirmation asserted | Production gated |
| Fail-closed boundaries remain valid | Missing authority blocks confirmation; invalid authority is rejected; cross-chart mutation is denied; forward postflight preserved function grants and all guarded business-row fingerprints | Production gated |
| Confirmation/source snapshots are complete | Confirmed order, Task, fulfillment work item, billing candidate, execution result/amendment, and linked attempt-2 re-request contracts asserted | Production gated |
| Billing uses the dedicated authority | Per-product-unit candidate froze quantity `3`, unit price `1000`, amount `3000`, and unit `tablet`; fresh exact-Preview execution linked that same candidate to one draft, unpaid invoice line with quantity `3` and amount `3000` through candidate authority | Production gated |
| Client readback uses the dedicated authority | The fresh exact-Preview loaded an omitted non-range `priceRanges` catalog item and a nullable non-billable set parent, saved and reloaded the parent plus both children, and reached confirmation without accepting nullable billable child totals | Production gated |
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

## Fresh exact-Preview regression evidence

Exact application head `923af5b013563e432cb02e444c39449240fd95e6` was
re-tested on the Ready Preview deployment `6410614270`. In the isolated
synthetic encounter `02490000-0000-4000-8000-000000000102` and chart
`02492000-0000-4000-8000-000000000102`, the authenticated UI:

- found `PR-024B dispensing set`, loaded both the dispensing and clinical-lab
  revision items, and saved parent `a6883158-5263-4f57-949e-9265ab9bb939`;
- saved dispensing child `6c2d35a6-d103-484d-8a3d-ed4ea44ac85a` with
  `patient / 1 tablet / PO / SID / 3 days / 3 tablets`, producing ready
  course-total preparation quantity `3`, and saved clinical-lab child
  `1ffac5bd-4d5c-4961-a8c9-14ea1d1e6f8a` with `serum / AST / routine`;
- reloaded the page and restored the parent plus both children before confirming
  the set atomically;
- created dispensing work item `b991e02c-a303-4f57-8099-f3b5043bb1f9`
  and lab work item `211e7fd8-0524-49f4-a1f0-e87bf3239e02`;
- assigned, started, and completed the dispensing item through the normal UI,
  recording execution result `2608144e-9fc2-4ef8-9b49-0245533c006f`
  version 1 with actual prepared quantity `3 tablet`; and
- linked the already-frozen candidate
  `billcand-6c2d35a6-d103-484d-8a3d-ed4ea44ac85a` to invoice line
  `1da6a664-5332-414a-99c3-a9df0ebd7dcc`, quantity `3`, unit price `1000`,
  line total `3000`, with `billingAuthority=order_billing_candidates`.

Invoice `f484a406-6010-43e6-9a5c-994965cf7cd8` remains `draft` with
`payment_state=none`; the UI showed 3,000 won due and zero collected. No payment,
collection, or billing-assignment action was taken. Readback found exactly one
fulfillment work item, one execution-result version, one billing candidate, and
one invoice line for the dispensing child. The completed UI exposes no second
completion action, so command-level replay was not forced through an alternate
API; the strengthened rollback rehearsal remains the duplicate/amendment retry
evidence.

Before confirmation, the chart table showed 13,000 won because its immutable
set-child price snapshot still displayed the dispensing catalog quantity `1`
plus the 12,000-won lab item. Confirmation correctly used the dispensing
authority's course-total quantity `3`, and the confirmed aggregate became
15,000 won. The 3,000-won dispensing invoice is correct; the 13,000-won
pre-confirm estimate is a UI/read-model discrepancy and is not represented as
full pricing-parity proof.

The subsequent narrow UI correction projects only a `per_product_unit` row's
displayed line total from `totalRequiredDispenseQuantity` when that positive
calculation output exists. It preserves the immutable stored set-child quantity,
all other price bases, and fixed-order pricing. The focused presentation
regression proves the observed quantity `1` / required dispense quantity `3` /
unit price `1000` case displays `3000`, with fallback and fixed-price behavior
unchanged.

The first browser attempt used the same synthetic set before its full CLAiR
master lineage was attached. It is intentionally retained as three draft rows
in encounter `02490000-0000-4000-8000-000000000101`: parent
`95a3bc98-9db3-4c39-acfb-9d530add127d`, dispensing child
`9dd62852-b574-486b-94a6-4c293c40f85e`, and lab child
`bc2476b3-ff00-4cf3-94f9-042a3a0c7625`. The successful encounter's lab work
item remains requested with its 12,000-won candidate unlinked. The older
historical requested lab work item `205be3e4-d38e-4af8-bfa4-6ad87b177be5`
and wrong quantity-1 draft invoice `1f705f8a-13fd-4ace-b2b7-bf0b80b86239`
with line `df081525-c64b-4ff2-9988-3029bcc53078` also remain unchanged. These
records are explicit retained audit/test inventory, not cleanup targets.

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

The forward billing-handoff packet was applied once and is recorded remotely as
migration ledger version `20260912142240`. Postflight readback matched the exact
candidate function SHA, one candidate-authority call, one legacy fallback call,
the expected security-definer search path and grants, and the preserved 162-row
non-fixture fingerprint. The historical synthetic invoice discrepancy remains
evidence and is not a cleanup target.

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

- Push the final changed head and pass its exact-head Release Check once. The
  completed authenticated Preview smoke remains the lifecycle evidence; the
  focused presentation regression covers the isolated display delta.
- Exact-candidate `main`/Production approval after PR, checks, Preview,
  Production comparison, smoke path, rollback candidate, and stop conditions
  are all known. A changed PR head invalidates that approval packet.
