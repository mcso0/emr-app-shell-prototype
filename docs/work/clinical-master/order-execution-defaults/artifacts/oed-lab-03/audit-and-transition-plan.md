---
title: CBC code and remote schema audit
type: Audit
status: done
updated: 2026-09-06
tags: [clinical-master, cbc, non-applied, schema-audit]
---

# OED-LAB-03 audit and transition plan

## Outcome and authority

The existing system has atomic lab definitions, workspace copies, pinned immutable
definition revisions, generic nested order sets and durable results. It does NOT
yet implement the LAB-02 versioned equipment/species reference-profile contract.
This is a contract/transport gap, not just missing seed values.

Read-only inspection completed against the connected staging database and local
checkout on 2026-09-06. No application, migration, master, workspace or patient
data was changed. Only metadata, synthetic master definitions and six CBC-related
Cheongdam catalog rows were queried. No patient/result rows were read. This is
not a new production release, authenticated UI proof or a full security audit.

Local HEAD was `f564a493b52be6f5592bda6484dd0bcf9a8a2c4b`; checkout already had
54 status entries. Preserve all unrelated WIP. [Manifest](./artifact-manifest.v1.json)
pins actual source contents independently of HEAD. [Remote evidence](./remote-evidence.v1.json)
records SELECT queries, observed columns, constraints and function-body excerpts
with definition hashes. Excerpt line numbers refer to remote function definitions,
not local migration lines. A failed exploratory regex SELECT changed no data;
the successful original name query is retained as evidence.

## Verified remote facts

- Master record counts: 522 orders, 73 lab-test definitions, 19 lab panels and
  9 specimen types. These have different denominators from the 86 in-scope orders.
- CBC order revision 2 targets `cm.lab-panel.cbc-basic`, whose current membership
  is WBC, HCT and PLT only. Cheongdam has the same three pinned links.
- RBC/HGB definitions exist but neither has a standalone master lab-order profile.
- Six scoped Cheongdam orders are active, with `testPanel`, `specimenType:blood`
  and `collectionCondition` persisted. These execution instructions are not
  numeric reference profiles. `customized_fields` contains availability and price;
  do not overwrite these during future adoption.
- Remote `clair_assert_lab_result_definition_snapshot` requires schemaVersion 1,
  null referenceRange and `not_judged`. Create freezes null; save-v2 forces
  `not_judged`; the row guard rejects range/judgment changes. A data-only patch
  would fail the current contract.
- Public result rows allow numeric/text/coded metadata, but `result_value` is
  text and the judgment CHECK only allows low/normal/high/critical/not_judged.
  Positive/negative or assay-specific classifications need a new contract.
- Generic set items allow atomic/order_set children. Remote integrity and chart
  expansion functions enforce a nesting limit; local writer rejects a child
  that already contains a set. CBC→groups→atoms fits that generic shape;
  checkup→CBC→groups→atoms exceeds it. The existing master CBC is an ORDER,
  not already a generic workspace set.

## Source key

Paths are repository-relative. Line ranges identify inspected source regions;
source hashes are pinned in the manifest.

| Key | Source |
| --- | --- |
| P | `src/features/clinical-master/server-clinical-master-publisher-core.ts` |
| A | `src/features/hospital-admin/server-order-catalog-core.ts` |
| C | `src/features/chart/module.tsx` |
| L | `src/features/lab-imaging/module.tsx` |
| B1 | `supabase/migrations/20260819172501_clinical_master_phase1b1_laboratory_slice.sql` |
| B2 | `supabase/migrations/20260820100000_clinical_master_phase1b2_order_set_revisions.sql` |
| B3 | `supabase/migrations/20260820140000_clinical_master_phase1b3_chart_set_runtime.sql` |
| F | `supabase/migrations/20260820150000_clinical_master_phase1b3_confirm_lab_freeze.sql` |
| AD | `supabase/migrations/20260824091724_clinical_master_release_scoped_workspace_adoption.sql` |
| T | `supabase/migrations/20260831070431_clinical_master_execution_preset_runtime_transport.sql` |
| M | `supabase/migrations/20260831070512_clinical_master_execution_preset_publish_adopt.sql` |

## All nine LAB-02 audit targets

| Target | Current owner/support | Gap and proposed change | Evidence |
| --- | --- | --- | --- |
| master atomic order/definition version | master.master_records/versions, orders, lab_tests; stable ID, type, unit, precision | Extend publisher with explicit versioned result profiles; do not hide result rules in generic execution defaults | P 150–157; remote columns/tests |
| set-to-set and set-to-order links | master.lab_panel_items is panel→test only; public.order_set_revision_items supports one nested level | Add versioned master composition edges to stable atomic ORDER identities or child compositions; project into existing workspace set revisions. Preserve result-definition association and old CBC order identity | P 53–65, 776–795; B2 1968–1974; B3 1022–1033; remote constraints/boundary functions |
| workspace field override provenance | public.order_catalog_items customized_fields, default_detail_inputs/policies, catalog_revision; lab items/versions and update inbox | Sync currently selects completely unmodified catalogs and copies whole defaults. Implement per-field base/local/incoming merge with explicit cleared vs absent values; keep modified price/availability | M 373–378, 434–443; T 638–654, 697–704; remote Cheongdam rows |
| workspace explicit equipment/result-profile binding | master specimen vocabulary exists; UI EquipmentReceipt is receipt metadata, not registered device config | Persist workspace device/manual identity plus selected profile revision/species; manual_entry/not_integrated. No first-class profile/binding table in inspected master/public inventory | L 1295, 3594–3597; src/types/emr-domain.ts 638–649; remote columns/inventory |
| chart order snapshot | orders applied/confirmed_snapshot, source revisions, detail inputs; atomic confirmation and lab freeze exist | Snapshot-v2 must pin effective profile, unit/range/interpretation/source, patient context and full membership paths. Confirm all atomic leaves once; preserve aggregate grouping | C 8925–8946; F 70–108; atomic_confirmation migration 343–379; remote orders columns |
| execution attempt and specimen | order_tasks attempt_no/re_requested_from_task_id and work-item cycle; lab source profile pins specimen TYPE | Add actual specimen identity/collection decision and link result to the exact task/request attempt. Generic lifecycle rerun is not proof of a new independent lab result | B1 3249–3262; remote order_tasks/work_items columns; 20260903003949 lifecycle migration 3904,3956,4277 |
| typed result and reference snapshot | lab_test_item_versions, lab_result_entries/rows; immutable definition and optimistic/idempotent writes | v2 snapshot/assertion/guards/serializer/save must evolve together. Numeric/coded/narrative validation, explicit absent/flagged states and server interpretation; UI must display same outcome | B1 3038,3143,3314,4709–4725,4795–4829; L 253–311,990–996,2376–2386; remote canonicalFunctions/constraints |
| retest links and immutable history | atomic WBC profile exists; generic task lineage exists; one canonical result per order path | Create a new atomic request/order, retain previous order+exact result row/write revision, reason and specimen decision; empty new value. Never reuse old canonical result entry | B1 3217–3221,3300–3304,3327–3331; remote columns; L has no matching per-row retest action in inspected table |
| billing choice | prices/line snapshots, billing flags, billing candidates and set billing rules exist | Requested outputs vs supporting measurements must be separate. Add explicit retest charge policy; no automatic orders/charges for calculation dependencies | src/features/billing/server-invoice-candidate-sync-core.ts 388–435,737–761; remote orders/order_set_revision_items constraints |

## Additional display and validation defects

Admin and chart already read workspace catalog, not two unrelated master searches.
Chart starts empty and fetches chart-search (C 2640–2669, 10352–10367).
Persisted defaults have a transport path (T 72–79,327–384). Admin currently maps
linked lab IDs to empty arrays (A 3260–3267); its summary needs persisted
membership/profile data, not synthetic display defaults.

L 299–311 uses Number(value) without first rejecting blank input, so empty text
would become zero once ranges are introduced. L 2158–2168 recomputes judgment in
the UI while save sends only rowId/value/note; current canonical DB forces unknown.
Fix server/client parity, not merely the visible range cell. `required` is stored,
but the inspected result writer only marks entered: all-required-final completion
needs an explicit integration test and enforcement in the implementation slice.

## Bounded fallback inventory

| Path | Observed behavior | Required handling |
| --- | --- | --- |
| A 2369–2401 | Admin RPC error→table compatibility read; table/chart RPC error→successful empty list | WP-01B: explicit unavailable/unauthorized/error; no error-to-empty disguise |
| A 924–927,961–964; API order-catalog route 51–59 | Missing injected gateway can choose mock; route chooses mock only in demo_header_mock_mode | Explicit gateway required for hospital routes; do not claim live RPC errors currently inject mock orders |
| C 8961–8976; execution-presets migration 763–790 | Generic empty defaults may read same-row legacy medication defaults | Materialize compatibility value before runtime; preserve explicit empty; no invented fallback |
| B1 5252–5268,5278–5292 | Missing vocabulary pin can fall through same-release to latest version | Resolve/pin in publish/adopt; no cross-release implicit substitution |
| L 1406–1429 | Mock detail permitted only outside live mode | Keep isolated fixture-only tools distinct from live catalog behavior |
| C 4895–5009 | Restore earlier draft display metadata | Not an alternate master catalog; preserve true saved-draft history, do not mislabel every restore as fabricated data |

Inventory is scoped to the traced CBC/catalog paths, not a proof that every fallback
in the repository has been discovered. The original historical browser incident
was not reproduced in an authenticated deployed app during this audit.

## ID and version reconciliation

[Full 26-row reconciliation](./id-reconciliation.v1.json) compares every candidate
to remote keys and all 73 current result codes. Five atomic order keys and seven
test keys already exist. The 21 proposed order keys and 19 proposed test keys
are absent; no matching result code was found for those new test definitions.
RBC/HGB need new order identities while reusing old test identities.

`RETIC` with unit percent remains percentage, never RETIC_ABS. RBC/WBC/PLT/RETIC_PCT
precision differs from LAB-02; preserve old versions and publish new definitions
where necessary. These are keys, not UUID allocation or publish approval.

The candidate root `cm.order.lab.panel.cbc-basic` names an existing master ORDER.
Do not insert it as a different record_type or directly as an order_set ID.
Keep root order identity, add a versioned composition association and an explicit
deterministic workspace projection. Four proposed subgroup keys are absent.
Repeat key/code/synonym collision checks on the exact applying release.

## Proposed target ownership and storage

These are design proposals, not applied table names or new approved product rules.

1. Reuse master records/versions and lab_tests. Add immutable result-profile
   revision and per-test rule storage: profile key/revision, device/manual identity,
   method/specimen, species/population, entry/integration state, unit, precision,
   range/status, codes/flags, provenance and source version. Avoid duplicated
   profiles embedded independently in every order's generic default JSON.
2. Add versioned master composition/edge ownership with a tagged union of
   atomic order vs child composition, required/default-selected/sort/group.
   Reuse workspace set revision storage through an explicit adoption bridge.
   Validate cycles, bounded depth, duplicate paths, foreign scope and current pins.
3. Add workspace equipment/manual registration and effective profile selection
   with revision/override provenance. Adopt only explicit persisted settings.
   A missing selection is configuration_required, not clinical review pending.
4. Extend existing order/result frozen JSON through a discriminated v2 contract;
   keep v1 readable and unchanged. New tables/fields use workspace-qualified FKs
   and revision constraints, not client-only ownership checks.
5. Reuse task attempt identity; add specimen instance and repeat-request lineage
   with previous order/result row/write revision. Store supporting measurements
   separately from requested billable orders; distinguish result correction from
   a new retest request. Review actual result status semantics before changing them.

## Small implementation slices and exit gates

| Sequence | Package | Exit proof |
| --- | --- | --- |
| 1 — immediate next | Existing WP-01B persisted Admin/chart read parity | Both surfaces show same eligible persisted rows/defaults across categories; true empty stays empty, error stays error; no injected order/value; compact category summaries |
| 2 | OED-LAB-04 CBC schema/publisher contract | Versioned composition + result profiles validated offline/local DB; all 26 candidate IDs reconciled; v1 preserved; no runtime adoption yet |
| 3 | WP-02 + CBC adoption bridge | Field-level inheritance preserves customized price/availability and explicit clears; workspace profile choice persisted; foreign workspace fingerprints unchanged; idempotent retry |
| 4 | OED-LAB-04 CBC chart/result vertical | CBC expands to selected atoms; profile-v2 frozen; numeric/code/manual entry and interpretation survive reload; required completion behavior proven |
| 5 | OED-LAB-04 WBC-only retest/billing | Prior WBC result immutable, new request blank, exact lineage/specimen choice; no implicit extra order or invoice line |
| 6 — after CBC proof | Remaining laboratory scope | Extend by assay family with the same versioned contracts; do not postpone CBC until every numeric source is researched |

The 26 CBC parameters are not the denominator for 86 original orders. Existing
CBC-family standalone orders are already in those 86; deduplicate the future
target ledger before counting or scheduling the remaining work.

## Migration, backfill and rollback plan — NOT EXECUTED

- Preflight: fresh schema/function hashes, target release/record IDs, selected
  workspace set, all pinned result links and foreign negative-control fingerprints.
  Record exact product decisions below. Use a clean implementation worktree.
- Additive migration first: new versioned structures/constraints and v2 readers
  alongside v1. Validate publisher/adopter, server authorization and RLS before
  exposing new tables; do not loosen old snapshot guards globally.
- Backfill only explicit synthetic master keys and selected workspace records.
  Existing orders/tests keep identity; changes produce new revisions. Do not
  infer analyzer/species/units from names. Never fill historical patient results
  with newly found ranges or change their interpretation.
- Adoption: preview per-field diffs, preserve local overrides, materialize selected
  profile and membership versions, prove retry yields no duplicate rows/charges.
  Price unset means explicit non-billable or configured price per approved policy,
  never guessed zero. No waiting-for-clinical-review gate on synthetic master data.
- Release: app reader/writer contract and DB v2 guards move together. Keep old
  results readable throughout; use scoped synthetic proof and authenticated UI.
- Rollback before any v2 result: restore captured version pointers/configuration
  with compare-and-swap, reverse only exact new records if unreferenced.
- Rollback after v2 result: stop new adoption/requests and retain v2 reader/history;
  forward-fix write path. Do not drop tables, delete results, reset workspace data
  or roll back to an app that cannot read the new result version.

## Remaining choices and unverified boundaries

- CBC grouping/default selections from LAB-02 remain proposed, not an industry
  universal or automatic approval of pricing.
- Choose demo workspace profile explicitly; no claim of actual installed equipment.
- Decide partial/retest price and parent-vs-child charge ownership before billing
  implementation. Supporting measurements do not silently become charges.
- Set a safe maximum graph depth without excluding the agreed checkup→CBC→groups
  case; enforce the same limit in publisher, DB, UI and flattening.
- Database metadata confirms RLS enabled on inspected tables and selected public
  RPCs deny anon EXECUTE. Save-v2 checks auth.uid/actor and lab:complete. This is
  not an authenticated role replay or comprehensive RLS/security approval.
- Result values, real patient encounters, external workspace rows and device
  connections were intentionally not examined. Remote app deployment/version
  and actual UI parity remain to be tested during implementation.

## Reproduce artifact checks

Run `node scripts/generate-oed-lab-03-audit.mjs`,
`node scripts/render-oed-lab-03-report.mjs`, then
`node --test tests/oed-lab-03-audit.test.mjs`.
These commands replay stored read-only evidence; they do not refresh the remote
database. A fresh remote check requires the recorded SELECTs and exact scope.
