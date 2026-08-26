---
id: "CLINICAL-MASTER-PR-017"
type: "Work Item"
title: "Evidence-grounded dispensing order master and execution rollout"
description: "Researches, validates, and delivers a clinically review-gated dispensing-order master with at least 100 unique atomic orders across Airtable, the private master, workspace adoption, chart execution, dispensing, treatment, and billing contracts."
status: "completed"
area: "clinical-master"
priority: "P0"
tags:
  [
    "clinical-master",
    "dispensing",
    "medication",
    "evidence",
    "chart-orders",
    "synthetic-demo",
  ]
target_pr: "Evidence-grounded dispensing-order master"
source_docs:
  - "docs/engineering/data-model/clair-clinical-master-data-target-architecture.md"
  - "docs/engineering/data-model/clair-clinical-master-data-phase-1-db-spec.md"
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/product/demo-data/medication-order-details-v1.md"
  - "docs/work/clinical-master/CLINICAL-MASTER-PR-014-central-publish-adopt-pricing.md"
  - "docs/work/clinical-master/CLINICAL-MASTER-PR-016-operational-master-v4-400-orders.md"
  - "docs/work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-009-chart-order-execution-system.md"
  - "docs/work/clinical-master/clinical-master-pr-017/source-ledger.md"
dependencies:
  - "CLINICAL-MASTER-PR-014"
  - "CLINICAL-MASTER-PR-016"
  - "CLINICAL-FULFILLMENT-PR-009"
updated: "2026-08-26"
remote_writes: 8
---

# Clinical Master PR-017: Evidence-grounded dispensing order master

## Goal

Research and design a veterinary dispensing-order master, retain at least 120
initial candidates and at least 100 validated unique atomic dispensing orders,
and deliver the approved exact dataset through the CLAiR authoring, private
master, workspace-adoption, chart-execution, dispensing/treatment, billing,
Git, and production-release contracts.

Clinically unreviewed content must remain visibly unreviewed and cannot become
active for real clinical use. Real-patient exposure or clinical activation
requires a separate explicit approval even after technical delivery.

## Baseline

- Clean worktree:
  `/Users/iseung-ug/project/emr-app-shell-prototype/.worktrees/dispensing-order-master`
- Branch: `codex/dispensing-order-master-20260826`
- Starting `origin/main`: `8d4b668bdc756f6094389690fa9a2d73fa70c003`
- The dirty primary checkout is excluded from all edits, staging, reset, stash,
  checkout, and delivery actions.
- The starting commit includes chart-order execution merge
  `b17d41453a8e50a1362cea6b846ddae0555f2d57` as a parent.
- Existing V4 operational data is synthetic and explicitly not accepted as
  clinical evidence for this dispensing dataset.

### Verified remote and runtime snapshot (2026-08-26 KST)

- Airtable target is base `applMtgWwOxwPigB8` (`CLAiR Clinical Master`). The
  approved authoring write created nine isolated V1 tables, 1,549 records, and
  2,400 link references. Full readback found zero duplicate, missing, or
  unexpected external keys and zero clinically active rows. Original table
  counts remain: Release Drafts 1, Sources 1,
  Master Records 578, Names 578, Classification Paths 13, Lab Panel Items 120,
  Lab Order Profiles 85, and Diagnosis Category Links 12. The sole release
  draft is V4 and explicitly synthetic/non-authoritative. The live base has 8
  tables and 65 fields; the sorted table/field ID-name-type inventory has
  FNV-1a signature `2a741165`. The base now has 17 tables including the nine
  new medication/product/evidence/review authoring tables.
- Supabase target is project ref `qmerxgzrwaaahpkhjqlc`, displayed as
  `clair-emr-staging` even though the repository runtime and release policy use
  this project for the production-bound environment. It is PostgreSQL 17.6 and
  reported `ACTIVE_HEALTHY` during read-only inspection.
- The pre-write private-master release was release 12,
  `cm.release.airtable.operational-master.v4`, with 554 payload records and
  fingerprint
  `3bba1b06cd5334d77852b85b0ef0bd2654c0f308e034ea3e191198a12da36e6b`.
  The approved inactive publish created release 13, ID
  `78a57bf0-10a8-47db-9ae1-8a8cff79b2c4`, with 108 dispensing orders and 1,657
  normalized rows. All clinical, regulatory, and translation gates remain
  pending and computed clinical-use is zero.
- Before adoption the three target catalogs contained 419, 413, and 402 rows.
  Approved pending adoption added exactly 108 inactive rows to each, producing
  totals 527, 521, and 510. The foreign workspace `clair-foreign-demo` remains
  zero with its original fingerprint.
- Current runtime aggregates contain 38 confirmed atomic orders, 38 tasks, 31
  queue items, and 38 billing candidates. Draft artifacts, duplicate
  Task/Queue/Billing rows, task orphans, and outbox rows are all zero in the
  inspected aggregate snapshot. No patient-level row was read.
- `origin/main` is `8d4b668bdc756f6094389690fa9a2d73fa70c003` and contains PR #617 merge
  `b17d41453a8e50a1362cea6b846ddae0555f2d57`. The matching Vercel production
  deployment is Ready at deployment ID `dpl_MhSw2GNqfnPtYBgpYciGcyMbv7D7`;
  the official alias is `https://emr-app-shell-prototype.vercel.app`.
  Unauthenticated probes returned root redirect 307, login 200, a synthetic
  chart route 200, and order API 401. No authenticated smoke is claimed.

### Verified permission and schema boundaries

- Private `master` release/record/version tables have RLS enabled, no public
  policies, and no anonymous or authenticated direct select/write grant.
- Public workspace catalog/update, task/event, fulfillment, and billing
  surfaces have RLS enabled. The authenticated role has the scoped read path
  but no direct write grant; server/RPC authority remains the mutation path.
  `public.orders` and the execution outbox have RLS enabled with no direct
  authenticated policy or grant.
- The private master now adds normalized ingredient, product, composition,
  species applicability, handling, dispensing profile, evidence assertion,
  clinical review, and Korean regulatory profile families while preserving
  `master.master_records`/`master.orders` as stable order identity.
- The current chart dispensing detail contract contains dose basis, dose and
  unit, route, frequency, duration, total quantity, taper, compound note, and
  guardian note plus extra-label species confirmation/reason. Normalized
  ingredient composition, strength, dosage form, evidence, and named-review
  lineage are server-owned snapshots; BUD/lot/expiry and actual dispense-event
  facts remain deliberately unimplemented rather than guessed.
- Existing workspace acceptance (`workspace_master_updates.status = accepted`)
  is an administrative adoption state, not veterinary clinical review. The
  publisher's validated/reviewed labels on synthetic rows likewise do not
  establish named clinician review.
- The current outbox persists confirmation events but no repository worker was
  found that claims, retries, delivers, or dead-letters them. Delivery to
  external inventory, notification, or other consumers is therefore not a
  current claim; only outbox status/count/age may be verified.
- Controlled-substance execution is outside the current permission and audit
  contract. Such candidates may be classified for review but must remain
  inactive until a separately approved regulatory workflow exists.
- Remote migration history contains timestamp aliases and intentional local
  drift. A future additive migration must be applied as one exact reviewed
  SQL/hash; broad `db push --include-all` or replay of old release SQL is
  prohibited.

### Phase 0 safety decision

- Evidence-grounded dispensing content will not be encoded as authoritative
  clinical JSON inside the current generic order payload. Phase 3 must define
  an additive normalized medication/dispensing/evidence/review contract first.
- New records remain non-clinical, inactive, and excluded from real-patient
  use until a database-enforced evidence and named clinical-review gate exists.
- Dataset authoring, reports, validation, migrations, and application support
  were prepared and the separately approved Airtable, private publish, and
  pending adoption actions completed. Deployment remains a separate release
  gate, and clinical activation still requires a future explicit approval.

## Scope

- Verify the current Airtable, private-master, workspace-adoption, Supabase,
  chart-order, Task/Queue/Billing, dispensing/treatment, and production paths.
- Use both Exa Search and ordinary web search, prioritizing official Korean and
  international regulatory, standards, and clinical sources.
- Record source searched/reviewed/accepted/rejected counts and field-level
  provenance with direct/inferred/not-found status.
- Define the dispensing-order taxonomy, Field Matrix, canonical duplicate key,
  lifecycle/review/evidence states, dose-input templates, execution fields,
  and immutable confirmation snapshot.
- Build at least 120 candidates and retain at least 100 unique, quality-passing
  atomic dispensing orders after deduplication.
- Produce a canonical Markdown research report and a standalone searchable,
  filterable, responsive HTML report in the approved artifact locations.
- Implement deterministic validation and import/adoption artifacts, then make
  only the exact approved persistent writes.
- Preserve the chart candidate/confirmation and Task/Queue/Billing cardinality
  contracts delivered by CLINICAL-FULFILLMENT-PR-009.
- Verify local behavior, migration/RPC/RLS/audit boundaries, production data
  reconciliation, Git delivery, deployment, and synthetic production smoke.

## Explicit Approval Gates

Before each gate, present the target, exact candidate SHA, dataset revision and
hash, expected row impact, migration hash when applicable, verification,
clinical-review status, rollback or forward-fix, and stop conditions.

- Airtable creation or update of 100 or more persistent records.
- Private clinical-master persistent publish.
- Production database migration or deterministic data upsert.
- Target workspace adoption.
- An `origin/main` merge that immediately triggers production deployment.
- Production deployment, alias transition, or user-facing feature activation.
- Any activation for real clinical use or real-patient exposure.

## Out Of Scope And Prohibited

- Real patient, guardian, staff, hospital, identity, payment, or prescription
  data.
- Clinical activation of unreviewed content.
- Treating the existing synthetic V4 catalog as dose or medication evidence.
- Guessing dose, maximum dose, BUD, stability, expiry, storage, or other
  clinically meaningful values.
- Controlled-substance workflow activation without a separately approved
  permission, audit, and regulatory design.
- `DROP`, `TRUNCATE`, broad delete, RLS weakening, force push, destructive reset,
  unrelated refactor, or unrelated workspace/base/table mutation.

## Phase Status

| Phase                             | Status              | Exit gate                                                                                                                                        |
| --------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0. Baseline and safety boundaries | `completed`         | Exact current local/remote architecture, targets, counts, permissions, deployment trigger, rollback candidate, and active work contract recorded |
| 1. Exa and web research           | `completed`         | Seven independent workstreams complete with auditable source counts and provenance                                                               |
| 2. Dataset design                 | `completed`         | At least 120 candidates and at least 100 validated unique atomic dispensing orders                                                               |
| 3. Field Matrix and contracts     | `completed`         | Authoring/master/adoption/chart/Task/Queue/Billing/dispensing mappings and validation rules complete                                             |
| 4. Markdown and HTML reports      | `completed`         | Required report content, search/filter/detail/source/coverage features, dataset hash, and risk packet complete                                   |
| 5. Implementation plan            | `completed`         | Exact files, migrations, functions, RLS, tests, rollout, and rollback plan complete                                                              |
| 6. Airtable authoring             | `completed`         | Nine isolated V1 tables, 1,549 records, and 2,400 links read back exactly; old tables unchanged and active rows zero                             |
| 7. Master and production DB       | `completed`         | Three exact migrations, inactive release 13, three 108-row pending adoptions, retries, RLS/ACL, audit, foreign control, and runtime reconciliation passed |
| 8. Chart and execution screens    | `completed`         | Large-data interaction, accessibility, queue-count, extra-label veterinarian attestation, and persisted fulfillment-history evidence pass; unimplemented dispense-event facts remain explicitly out of scope |
| 9. Data quality and safety        | `completed`         | Validator and 108 live source links pass; Airtable/private-master/workspace counts, fingerprints, duplicates, orphans, and inactive gates pass remotely |
| 10. Functional verification       | `completed`         | 46 focused tests, two rollback replays, remote reconciliation, route probes, authenticated non-exposure smoke, and retry gates pass                |
| 11. Git delivery                  | `completed`         | Candidate `f8a1d927`, PR #620, Release Check 32919156702, merge `6dcb71ac`, and exact `origin/main` proof complete                                  |
| 12. Production release            | `completed`         | Deployment `dpl_ADnW4rS7CzYQgiAXCbXPHvyKaSjb` Ready, official alias and synthetic authenticated smoke verified; clinical activation remains gated   |

Only one major phase may be `in_progress` at a time.

## Required Dataset Invariants

- Candidate count is at least 120 and final valid unique count is at least 100.
- Duplicate canonical key and duplicate stable ID counts are zero.
- Display name, active ingredient, dosage form, and applicable route are present.
- No clinical dose lacks a unit; unknown values remain null/unknown with a
  reason instead of being guessed.
- No unsupported species or guessed BUD/expiry/stability values are present.
- Clinically meaningful values carry field-level provenance and confidence.
- `clinical_order_type` is `dispensing` and destination remains master-owned.
- Candidate selection creates zero Task, Queue, and Billing artifacts.
- Confirmed routed atomic orders create Task 1, Queue 1, and Billing candidate 1
  only when chargeable; retries create no duplicates.
- Clinically unreviewed orders cannot become active for real clinical use.
- Cross-workspace leakage, foreign-workspace drift, duplicates, and orphans are
  all zero.

## Stop Conditions

Stop the relevant remote action on an unexpected target, larger-than-reviewed
row impact, cross-workspace change, duplicate master/order/task/queue/billing
row, RLS or permission failure, snapshot loss, lock timeout, compatibility
failure, unexplained orphan, real-data exposure risk, or clinically unsafe
field. Preserve the Goal and report the exact safe checkpoint instead of
marking it complete.

## Verification Plan

- Dataset validation and source-link checks.
- Focused unit, server, API, RPC, migration, RLS-negative, audit, and
  reconciliation tests.
- Focused Storybook/interaction/accessibility and Playwright coverage for chart
  and dispensing/treatment surfaces.
- `npm run security:secrets`
- `npm run docs:check`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `git diff --check`
- Exact migration, dataset, report, Airtable, private-master, workspace, and
  production fingerprints before and after approved writes.

## Phase Artifacts

- Phase 1 source ledger:
  [clinical-master-pr-017/source-ledger.md](clinical-master-pr-017/source-ledger.md)
- Phase 2 dataset README and deterministic artifacts:
  [clinical-master-pr-017/datasets/README.md](clinical-master-pr-017/datasets/README.md)
- Phase 2 result: 140 initial candidates, 108 final technical passes, zero
  duplicate stable IDs/canonical keys/source product IDs, and zero clinically
  active rows. The final JSON SHA-256 is
  `cc3ef6c977122bef5a708d5c6a800a3120b257584bd78ee72c26a67d2b95260f`.
- Phase 3 field matrix and cross-system contract:
  [clinical-master-pr-017/field-matrix.md](clinical-master-pr-017/field-matrix.md)
- Phase 4 canonical report:
  [clinical-master-pr-017/dispensing-order-master-report.md](clinical-master-pr-017/dispensing-order-master-report.md)
- Phase 4 standalone report:
  [clinical-master-pr-017/dispensing-order-master-report.html](clinical-master-pr-017/dispensing-order-master-report.html)
  with search, category/route/species filters, row details, direct SPC links,
  coverage, risks, and filtered CSV export. Browser verification covered desktop
  and 390 px mobile rendering, 108-to-1 search reduction, detail dialog behavior,
  and zero console errors.
- Phase 5 implementation plan:
  [clinical-master-pr-017/implementation-plan.md](clinical-master-pr-017/implementation-plan.md)
- Phase 6 frozen Airtable authoring payload and approval packet:
  [clinical-master-pr-017/airtable/approval-packet-01.md](clinical-master-pr-017/airtable/approval-packet-01.md)
  (`9` new tables, `1,549` records, `2,400` link references, zero existing-table
  mutations, zero active rows). The approved write and full remote readback are
  complete.
- Phase 7 local additive foundation:
  [`20260826150000_clinical_master_dispensing_order_foundation.sql`](../../../supabase/migrations/20260826150000_clinical_master_dispensing_order_foundation.sql)
  plus the additive fulfillment-history read RPC
  [`20260826152000_clinical_master_dispensing_fulfillment_history.sql`](../../../supabase/migrations/20260826152000_clinical_master_dispensing_fulfillment_history.sql)
  and rollback-only replay
  [`clinical_master_dispensing_order_foundation_replay.sql`](../../../supabase/snippets/clinical_master_dispensing_order_foundation_replay.sql).
  The replay verified the false/true clinical-use gates, active-row rejection,
  snapshot tamper rejection, immutable revisions, RLS with zero policies, revoked
  client/service-role table access, fulfillment-history workspace/queue scope,
  and zero residue after `ROLLBACK`. The exact migrations were subsequently
  applied remotely as versions `20260826011738`, `20260826011742`, and
  `20260826011745`; postflight confirmed the new relations were empty and
  access-closed before publication with no drift in existing controls.
- Phase 7 deterministic inactive release and local publish/adopt contract:
  [`dispensing-order-release-payload.v1.json`](clinical-master-pr-017/supabase/dispensing-order-release-payload.v1.json),
  [`20260826151000_clinical_master_dispensing_order_publish_adopt.sql`](../../../supabase/migrations/20260826151000_clinical_master_dispensing_order_publish_adopt.sql),
  and rollback-only
  [`clinical_master_dispensing_release_replay.sql`](../../../supabase/snippets/clinical_master_dispensing_release_replay.sql),
  plus read-only
  [`clinical_master_dispensing_v1_preflight.sql`](../../../supabase/snippets/clinical_master_dispensing_v1_preflight.sql)
  and
  [`clinical_master_dispensing_v1_postflight.sql`](../../../supabase/snippets/clinical_master_dispensing_v1_postflight.sql).
  The canonical payload content SHA-256 is
  `3825feb207ed3ea3b9fcf3be69f3e1745f4571671d988da3d57a760e3f19460b`;
  it contains 108 generic dispensing orders, 8 exact structural dependencies,
  one classification path, and 1,657 normalized relation rows. All 108 clinical,
  Korean regulatory, and Korean translation reviews remain pending, all
  prescription defaults are null, and the computed clinical-use count is zero.
  The replay verified exact publish counts, missing-key/null-actor/early-review
  rejection, exact-retry idempotency, wrong-scope rejection, 108-row
  `clair-demo` pending adoption, immutable actor-attributed audit, retry without
  catalog revision drift, `clair-foreign-demo` unchanged, chart non-exposure,
  zero runtime artifacts, and zero residue after `ROLLBACK`.
- Phase 7 exact remote approval packet:
  [clinical-master-pr-017/supabase/approval-packet-01.md](clinical-master-pr-017/supabase/approval-packet-01.md).
  Schema migration, inactive private publish, and three-workspace pending
  adoption were separately approved and completed. Feature and clinical
  activation were not performed.
- Phase 7 live read-only preflight on 2026-08-26 KST confirmed project
  `qmerxgzrwaaahpkhjqlc` is `ACTIVE_HEALTHY`, PostgreSQL 17.6.1, latest remote
  migration `20260825172957`, all three required existing dependencies present,
  all PR-017 schema sentinels absent, and zero lock waiters. Workspace catalog
  controls remain 419 (`clair-demo`), 413 (`workspace-clair-cheongdam`), 402
  (`workspace-clinical-master-pilot-v1`), and zero
  (`clair-foreign-demo`). Current runtime aggregate controls are 38 confirmed
  atomic orders, 38 order tasks, 31 fulfillment work items, and 38 billing
  candidates; no patient-level row was read.
- Phase 7 remote postflight confirmed release 13, exact normalized counts
  79/108/108/132/150/108/108/648/108/108, zero computed clinical-use,
  duplicate, orphan, or non-pending review rows, and exact publish retry. The
  three target workspaces each contain 108 `pending_activation` projections;
  retries created zero rows and preserved fingerprints. Three immutable
  adoption events retain the actor and before/after counts. Foreign and runtime
  controls remained unchanged.
- Phase 8 chart-to-dispensing execution support preserves the immutable
  dispensing profile, product, clinical-review, and evidence lineage through
  draft, confirmation, Task/Queue handoff, and fulfillment readback. The DB
  gate rejects incompatible patient species unless the workspace was
  intentionally broadened and an active veterinarian supplies explicit
  extra-label confirmation and a bounded reason. Workspace species changes and
  order attestation are immutable/audited. The gate maps the UI `PO` route to
  the reviewed canonical `oral` route before accepting it. The shared
  조제/처치 screen keeps the two destinations separated by `queueType`; only
  reviewed product name, strength, form, route, and species are shown, while
  lot, expiry, and BUD remain outside the implemented dispense-event scope and
  unpopulated. The queue candidate now exposes patient/encounter/order/Task
  lineage and separate universal Task status without conflating it with the
  fulfillment operational state. Focused interaction, server, migration, and
  remote reconciliation evidence closes the implemented Phase 8 boundary.
  The live history panel now reads the existing immutable fulfillment events
  through a workspace- and queue-permission-scoped RPC/API and renders the
  actor, reason, and previous/next operational status without fixture fallback.
  It does not add or imply a lot/expiry/BUD/actual-dispense event contract.
- Phase 9 local validation passes with 140 candidates, 108 final unique rows,
  zero duplicate IDs/keys/products, zero clinically active rows, 1,657
  normalized relation rows, and zero errors. The opt-in reachability check also
  passed all 108 distinct official source URLs with zero broken links. Remote
  Airtable/private-master/workspace fingerprints passed exact readback.
- Phase 8–10 exact completion audit:
  [clinical-master-pr-017/completion-audit.md](clinical-master-pr-017/completion-audit.md).
- Delivery report:
  [2026-08-26 clinical-master dispensing-order report](../../completed/clinical-master/2026-08-26-clinical-master-dispensing-order-master-report.html).
- Phase 10 local verification matrix:
  [clinical-master-pr-017/functional-verification.md](clinical-master-pr-017/functional-verification.md).
  The direct 108-row search, 20-row continuous editing and DOM stability,
  keyboard focus, touch action, queue-count reconciliation, persisted
  fulfillment history, and rollback replays are green. The post-fix focused
  suite is 46/46 and remote duplicate/orphan/runtime reconciliation is green.
- Phase 11 delivery used candidate
  `f8a1d9274016757dbd975c4a55f4a1ddff0c014e` in PR #620. Release Check
  [32919156702](https://github.com/mcso0/emr-app-shell-prototype/actions/runs/32919156702)
  passed secrets, docs, UX copy, lint, typecheck, and build. GitHub merged the
  PR as `6dcb71ac1b54098d47bf5bf7068b2a10083af158`; fetched `origin/main` and
  `refs/heads/main` matched that SHA, and the candidate is its second parent.
- Phase 12 production deployment
  `dpl_ADnW4rS7CzYQgiAXCbXPHvyKaSjb` is Ready for merge SHA `6dcb71ac`.
  The official alias `https://emr-app-shell-prototype.vercel.app` resolves to
  that exact deployment. Unauthenticated probes returned root 307 to login,
  login 200, chart shell 200, chart-order execution API 401, and fulfillment
  history API 401. In the authenticated synthetic Cheongdam workspace, the
  chart and dispensing routes loaded with zero captured browser errors; exact
  search for one inactive release-13 product returned no candidate and an empty
  result state. The immediately preceding Ready production rollback candidate
  is `dpl_773HbNmYGPDtBNX4P3sjhJNHDBZ2` for `bf2f9ee0`.

## Done When

The research, dataset, documentation, authoring, inactive master/adoption,
application, data-quality, permission/RLS/audit, Git, deployment, and synthetic
production-smoke conditions in this work item are verified. Clinical,
regulatory, and translation review plus any real-patient exposure remain a
separate explicit approval gate and were not performed.
