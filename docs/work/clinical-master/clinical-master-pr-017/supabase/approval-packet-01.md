# CLINICAL-MASTER-PR-017 Supabase Approval Packet 01, Revision 05

Status: `schema, inactive publish, and three-workspace pending adoption approved and completed on 2026-08-26 KST`

This packet freezes the local schema, inactive release, and workspace-adoption
candidates. Approval of one gate does not approve a later gate. Airtable,
Git/merge/deploy, and clinical activation remain separate approval boundaries.

## Immutable Inputs

| Artifact | SHA-256 |
| --- | --- |
| Final technical dataset, revision `2026-08-26.1` | `cc3ef6c977122bef5a708d5c6a800a3120b257584bd78ee72c26a67d2b95260f` |
| Foundation migration | `38a92fa6ebd7c95d90e1949db932d5f676a4c2e39c96a271a33dec878ced9ea8` |
| Publish/adopt migration | `d849662cb8599bb79d308d23adb94caf28b06afb0ede010b439296d7f57aa85e` |
| Fulfillment-history migration | `f514e8773809edb15ed08e2b928aa33640fb7d427c82162cb6cf1e73b464a434` |
| Release generator | `d82f7bf13bf51ca6084cebdafd1092ed5f2029859ed603457908771b168cd011` |
| Release payload file | `23e5d0c9f2a362c7634da96459d3f1280602b49190daefd186db9d3e4d93ad2f` |
| Canonical payload content | `3825feb207ed3ea3b9fcf3be69f3e1745f4571671d988da3d57a760e3f19460b` |
| Foundation rollback replay | `6537a4d28d9304625b7e0b9f67919e47e64c4e3fd291a209e6ed977702ef0196` |
| Release rollback replay | `25749becf84193f752484989a30e1cf31f9695a1acc966a8261636bb9c60c319` |
| Read-only remote preflight | `23aee0b736b1228494191b856924580cb1a9b5ba11eefdc4dfe297191cf8fd05` |
| Read-only release/adoption postflight | `27ea1573d72d730b7e643007f64a3b983573fa48565c7dfaec339a611697a58f` |

Any byte change invalidates this packet and requires regenerated hashes and a
new review.

## Live Read-Only Preflight — 2026-08-26 KST

- Project `qmerxgzrwaaahpkhjqlc` (`clair-emr-staging`) is `ACTIVE_HEALTHY` on
  PostgreSQL 17.6.1; lock waiters were zero.
- Latest recorded remote migration is `20260825172957`
  (`chart_order_execution_fk_indexes`). The three required existing private
  publisher/adopter/hash dependencies are present. All three PR-017 schema
  sentinels are absent, as expected before Gate A.
- Latest master release remains release 12,
  `cm.release.airtable.operational-master.v4`, record count 554, source
  fingerprint
  `3bba1b06cd5334d77852b85b0ef0bd2654c0f308e034ea3e191198a12da36e6b`.
- Exact workspace controls before any write:

| Workspace | Catalog rows | Semantic fingerprint |
| --- | ---: | --- |
| `clair-demo` | 419 | `e408aa405180816db9fe73be7566c37674edf74a736bd1bd6bad5215a9114a1e` |
| `workspace-clair-cheongdam` | 413 | `8cb616e6fa5ba7c61e1476c97e581d2af42d683755d6b8488d0d05bedcf94943` |
| `workspace-clinical-master-pilot-v1` | 402 | `3875bc26e1fd25c5bc01d196ec2b6cee72845d23d627a107384161da586a10ce` |
| `clair-foreign-demo` | 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |

- Runtime aggregate control is 38 confirmed atomic orders, 38 order tasks, 31
  fulfillment work items, and 38 billing candidates. These are aggregate
  controls only; no patient-level row was read.

## Gate A — Production-Bound Schema Migration

- Target: Supabase project ref `qmerxgzrwaaahpkhjqlc` only.
- Exact files: the three migration hashes above, in timestamp order.
- Expected data-row impact: zero release, medication, catalog, order, task,
  queue, billing, or patient rows.
- Expected schema impact: 10 normalized `master` tables, one immutable
  `private` payload table, nullable dispensing lineage columns on
  `public.order_catalog_items`, computed clinical-use and lineage functions,
  immutable triggers, one chart-search function replacement, a workspace- and
  queue-permission-scoped fulfillment-history read RPC, and private publish/adopt
  entrypoints. One immutable private adoption-audit table stores
  actor, exact approved workspace allowlist, release/payload identity, counts,
  and before/after semantic fingerprints. Direct access remains revoked and no
  RLS policy is added to the new master/private tables.
- Lock boundary: migration `lock_timeout = 5s`; stop on a lock timeout or any
  preflight/history/dependency mismatch.
- Verification: exact table/column/function/trigger presence, RLS enabled,
  zero client policies, revoked ACL, existing non-dispensing row fingerprints
  unchanged from the live preflight above, and no owned data rows.
- Recovery: transaction rollback on apply failure. After any later publication,
  schema rollback is prohibited; use a reviewed forward-fix/safety block.

Approval wording: `Gate A 스키마 마이그레이션만 승인`.

## Gate B — Inactive Private-Master Publish

Prerequisite: Gate A postflight passed and a fresh read-only target preflight
still matches the recorded project, migration history, and master baseline.

- Exact payload file and canonical content hashes: frozen above.
- Generic release manifest: 116 records — 108 new atomic dispensing orders and
  8 exact structural dependencies — plus one classification path.
- Normalized rows: 1,657 total:
  - ingredients 79;
  - evidence documents 108;
  - products 108;
  - product ingredients 132;
  - species applicability 150;
  - product handling 108;
  - dispensing profiles 108;
  - evidence assertions 648;
  - clinical reviews 108; and
  - Korean regulatory profiles 108.
- Required safety result: clinical-use allowed 0, approved clinical reviews 0,
  approved Korean regulatory profiles 0, approved Korean translations 0,
  prescription defaults 0, workspace catalog writes 0, patient/order/task/
  queue/billing writes 0.
- Retry: the exact payload hash returns the existing release without duplicate
  normalized rows; any different content must stop.
- Verification: manifest 116, dispensing profiles 108, all relation counts
  exact, all computed clinical gates false, immutable payload stored, duplicate
  and orphan counts zero.
- Recovery: release-scoped safety block/forward-fix only; do not delete immutable
  master history.

Approval wording: `Gate B 비활성 private master publish만 승인`.

## Gate C — Pending Workspace Adoption

Prerequisite: Gate B publish and postflight passed. This approval does not make
any row clinically usable or chart-searchable.

- Proposed exact target allowlist:
  - `clair-demo`;
  - `workspace-clair-cheongdam`;
  - `workspace-clinical-master-pilot-v1`.
- Foreign unchanged control: `clair-foreign-demo`.
- Expected target impact: 108 dispensing catalog projections per target,
  324 total, each `pending_activation`, `clinical_use_allowed = false`, with
  exact product/profile/evidence lineage. Existing hospital-owned names,
  prices, tax, units, billing choices, and customization stay workspace-owned.
- Expected foreign impact: zero rows and an unchanged semantic fingerprint.
- Chart impact: all 324 rows remain excluded from ordinary chart search.
- Runtime impact: zero draft/confirmed orders, tasks, queues, billing
  candidates, dispense events, or patient exposure.
- Retry: target semantic fingerprints and catalog revisions remain unchanged.
- Stop on any unexpected workspace, row count, duplicate lineage, foreign
  drift, active row, true clinical gate, existing customization overwrite, or
  runtime artifact.

Approval wording: `Gate C 세 workspace pending adoption만 승인`.

## Executed Result

- Gate A applied as remote migrations `20260826011738`
  (`clinical_master_dispensing_order_foundation`), `20260826011742`
  (`clinical_master_dispensing_order_publish_adopt`), and `20260826011745`
  (`clinical_master_dispensing_fulfillment_history`). Immediate post-schema
  readback showed all 13 new relations empty, RLS enabled, policy count zero,
  and no anon/authenticated/service-role DML. Private publish/adopt and helper
  functions were not executable by client roles.
- Gate B published inactive release 13, ID
  `78a57bf0-10a8-47db-9ae1-8a8cff79b2c4`. The exact retry returned the same
  release with `idempotent=true`. All ten normalized counts matched 1,657 total;
  clinical-use, non-pending review, duplicate, and orphan counts were zero.
- Gate C adopted 108 rows into each exact target as `pending_activation` with
  `clinical_use_allowed=false`. Totals became 527 (`clair-demo`), 521
  (Cheongdam), and 510 (pilot). Exact retries created zero rows and preserved
  fingerprints `4e6fc1fd...`, `759ff5a4...`, and `98b2bce7...`.
- Three immutable adoption events retain actor
  `00000000-0000-4000-8000-000000000001`, release/payload identity, and exact
  before/after counts/fingerprints.
- `clair-foreign-demo` stayed at zero with fingerprint
  `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`.
  Runtime aggregates stayed 38 confirmed atomic orders, 38 Tasks, 31
  fulfillment work items, and 38 billing candidates.
- The post-migration Supabase advisor added only expected INFO notices for
  closed RLS-with-no-policy tables and empty/new indexes; no new PR-017
  WARN/ERROR was reported. See the [Supabase database linter guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Clinical activation, named veterinary review decisions, regulatory approval,
  and real-patient exposure were not performed.

## Still Not Approved

- Clinical review approval or Korean regulatory/translation approval.
- Moving `pending_activation` rows to `active`.
- Real-patient or real-prescription exposure.
- Any feature flag or data transition that exposes these 108 rows as clinically
  usable.

## Local Evidence

- Foundation replay verified false/true predicate behavior, active-row
  rejection, snapshot tamper rejection, patient-species compatibility,
  incompatible-route rejection, immutable revisions, RLS/ACL, draft and
  confirmed lineage, and full rollback.
- Release replay verified first publish, exact retry, all normalized counts,
  zero open clinical gates, missing-key rejection, null-actor rejection,
  premature-review rejection, wrong-workspace approval rejection, `clair-demo`
  pending adoption, immutable actor-attributed audit, adoption retry with
  unchanged fingerprint, `clair-foreign-demo` unchanged, chart non-exposure,
  and full rollback.
- Current focused Playwright evidence: 46 publisher/schema/execution/
  fulfillment/history/browser contract tests passed after the final security
  fix.
- TypeScript: `npx tsc --noEmit` passed.
- ESLint: `npm run lint` passed.
- Source-link reachability: 108 distinct official URLs checked, zero broken.
- Generated release payload and summary reproduced byte-for-byte on rerun.
