---
id: CHART-PR-037
status: in_progress
area: chart
priority: P0
target_pr: Existing encounter multi-chart creation and clinical provenance
source_docs:
  - docs/product/domain/encounter-multi-chart-contract.md
  - docs/product/domain/outpatient-workflow-state-model.md
  - docs/engineering/current-status.md
dependencies:
  - CHART-PR-033
updated: 2026-09-12
---

# Encounter Multi-Chart

PR #743 delivered the original encounter multi-chart objective to `main` in commit `82b7c21d`. The 2026-09-09 checkpoints below are historical delivery evidence, not the current remaining gate. The active 2026-09-12 follow-up removes mixed encounter/current-chart presentation from the chart workspace while preserving the shipped encounter-owned execution and billing model.

## Goal and Authorization

Complete independent morning/afternoon/overnight charts under one existing encounter, including stable diagnosis history, originating-chart orders, existing execution/results/billing, and separate chart signing/encounter finalization. The user approved specification, local implementation and non-destructive verification, remote read-only inspection, and explicitly preapproved commit/push/PR/main/Production delivery. Prepare exact remote migration/candidate/checks/smoke/rollback evidence and apply repository action-time gates; this record grants no additional permissions.

Work in `/Users/iseung-ug/project/emr-encounter-multi-chart`, branch `codex/encounter-multi-chart`, initially based on origin/main `3e832870372e47c097fd79bff0a9870621fa8f02`. Preserve the dirty primary checkout. Duplicate search found no existing multi-chart work item; CHART-PR-033 is the existing single-note system-scope dependency, not this goal.

## Scope and Sequence

1. Revalidate local/remote constraints; finalize the linked contract and implementation boundaries.
2. Add chart identity metadata, create/list/read/save/sign/amend RPCs, note-level concurrency, idempotent create, audit, and legacy ambiguity guards. Preserve existing SOAP and revision identity.
3. Replace diagnosis delete/reinsert with stable-ID update/retirement and recorded chart assessment snapshots. Add immutable order origin and same-chart mutation guards including set children.
4. Add chart selection/list/create UI, chart-keyed editor/autosave, clinical timestamps, and distinct encounter visit count. Preserve other chart scope content.
5. Separate per-chart sign from encounter finalization; preserve fulfillment/result/order identities and encounter billing totals.
6. Run migration and backend/browser regression evidence, prepare scoped remote delivery and data-preserving recovery, then complete approved delivery through its gates.

Out of scope: new receptions, ended-encounter reopening, automatic order cloning, real clinical data, provider effects, canonical role policy changes, unrelated refactors.

## Investigation Baseline

Prior read-only inspection found remote active SOAP uniqueness per encounter, encounter-only V3 save/read, destructive diagnosis replacement, and completion signing every draft plus advancing queues. Remote synthetic Cheongdam snapshot at inspection: 43 encounters, 7 SOAP rows, 36 encounters without active SOAP, 118 orders, 41 diagnoses. These are baseline observations, not permanent counts. Revalidate before migration.

Current order draft uses explicit removed IDs, not implicit deletion of omitted rows. Preserve encounter-wide ETag initially; validate chart provenance for every update/removal/root/child. Existing order lineage and invoice order references must not change. SOAP V2 validation/projections and transactional audit remain required.

## Acceptance and Evidence Matrix

| Requirement | Verified local evidence | Remaining boundary |
| --- | --- | --- |
| Same encounter, three timed notes; no extra reception | SOAP SQL + API three clinical times | Authenticated remote smoke |
| Blank/idempotent creation | SQL, API, browser, two-session create retry | Remote migration/readback |
| Independent SOAP and concurrent saves | SOAP SQL, coordinator, API/browser, two-session CAS | Authenticated remote smoke |
| Signed amendment reason/prior revision | SOAP SQL + reasoned browser amendment/refresh | Remote smoke |
| Stable diagnosis IDs/past assessments | Diagnosis SQL retains historical snapshot after update/retirement | Live diagnosis UI acceptance |
| Order root/child/revision/removal isolation | Order SQL with deferred constraints; wrong-chart save/remove/confirm/mutate rejected | Remote supported-set smoke |
| Results/billing/no duplication | Actual V1/V2 and imaging result/retry SQL; one result and stable task/billing counts | Inherited dispensing-set incompatibility below |
| Individual sign/encounter finish | SQL rejects unfinished notes; browser sign leaves other draft | Authenticated remote finish smoke |
| Legacy/foreign data and old writers | Migration before/after fingerprints; author/ACL/foreign SQL | Remote pre/post fingerprints |
| Visit/chart counts and overnight dates | Separate encounter-count source; three-time API/SQL | Visual human acceptance |
| Patient-wide individual chart history | Local RPC/parser/UI/browser regression, `진료일`/`작성일` views, additional-record cues, stable chart-ID cursor, exact encounter+chart restoration, no empty-encounter row | Remote migration and authenticated smoke |
| PR/main/Ready deployment/alias/smoke/recovery | Local release checks prepared | Exact remote candidate and migration approval |

## Verification Plan

Use a dedicated local database for replay; never reset shared user DB. Test fresh/repeated migration, legacy/no-note records, foreign IDs, permissions, spoofed actors, stale writes, duplicate creation, amendment history, and diagnosis/order association preservation. Run focused existing SOAP/autosave/diagnosis/order/completion tests plus new integration cases, then fulfillment/billing replay and browser flow. Complete lint/typecheck/build/docs/secrets/diff checks and exact-candidate Release Check before delivery. Record evidence here as it becomes available, not as intentions.

## Recovery and Remaining Gates

Keep existing records and unproven order provenance unchanged. Additive schema and migration-first compatible deployment precede multi-chart activation. Once multiple charts exist, never restore the old unique index or roll back to an ambiguous encounter-only writer. Prepare creation-disable recovery with chart-aware data access. Remote mutation and exact release gates must be resolved after the candidate is concrete.


## Local Implementation Checkpoint — 2026-09-09

Implemented chart-specific create/list/get/save/sign APIs and RPCs using SOAP IDs; immutable clinical time, request replay, note CAS, signed amendment history, and author preservation. Legacy SOAP writers reject ambiguity. The selected chart controls URL, editor/autosave identity, diagnosis assessment, and order scope. Switching flushes SOAP and order changes; failed saves retain selection and text. The previous StrictMode cleanup issue in the autosave coordinator is covered by a reattachment regression.

Diagnosis IDs now remain stable with retirement and per-chart assessment snapshots. Orders have immutable `origin_chart_id`; set children inherit their root and server RPCs reject cross-chart draft/removal/confirmation/execution requests. Legacy null-origin orders remain separately editable. Encounter-wide order viewing and billing stay available. Individual signing is separate from encounter finalization, which rejects unfinished charts.

Completed local evidence at this checkpoint:

- Playwright combined run: **51 passed** across multi-chart browser/API, SOAP persistence, order action persistence, and autosave coordinator tests. Includes independent notes, save-on-switch, refresh, individual sign, reasoned amendment, failure/retry, and read-only encounter order scope. Browser uses repository synthetic mock mode; this is **not** authenticated remote Supabase smoke.
- Required local checks passed: TypeScript, production build, docs (1,026 files), Korean UX copy, secrets and diff whitespace. Final repository lint has 0 errors and 5 existing unused-variable warnings in unrelated WP10 scripts.
- Owned PostgreSQL rehearsal: **seven SQL contract suites passed including `SET CONSTRAINTS ALL IMMEDIATE` before rollback**. The stricter pass exposed and led to narrow fixes for canonical set-envelope preservation and aggregate lifecycle metadata. Earlier assertion-only runs are superseded.
- Separate PostgreSQL sessions passed idempotent concurrent create, one-winner same-note CAS, independent note saves, and root cancellation versus child lifecycle synchronization with real COMMIT and preserved origins. This is concurrent-session evidence; the scheduler interleaving is not a deterministic deadlock reproduction.
- No primary-checkout edits, remote DB mutation, commit, push, PR, main merge, or deployment has occurred at this checkpoint.

### Rehearsal Provenance and Limitations

The owned Docker container `chart-pr037-postgres` and database `chart_pr037_perf_rehearsal` use a schema-only ACL-preserving dump from an existing local Supabase schema, repository synthetic seed, and later migrations. No source clinical rows were copied. Historical replay dependencies required applying the schema portion of `20260901131810` without its historical activation block; `20260831064944` was already represented in the source schema. This is a repaired schema rehearsal, **not a complete fresh replay of all historical migrations**. Each SQL contract runs candidate migration and synthetic fixtures in a transaction, checks assertions and deferred constraints, and rolls back. The concurrency runner clones and drops only its explicitly owned temporary database.

Final SQL independent source review approved SHA256 `df4bfd797ba78d31e832dcf4ef29ac1e35528f556e0d91a5b74e57fcee7537d7`, including SOAP CRUD revokes, set envelopes, aggregate lifecycle timestamps and cancelled-root membership semantics. This source approval is distinct from the executed tests. Preserve the full user objective until authorized delivery and scoped remote smoke complete.


### Inherited Dispensing-Set Limitation

The pre-existing dispensing projection and B3 exact set-snapshot contract are incompatible for dispensing set children. Canonical documentation includes dispensing sets; this is an inherited defect, **not an intentionally unsupported feature**. This slice preserves the existing readiness and lineage guards and does not loosen hashes or claim a successful dispensing-set preparation/confirmation path. Root and non-dispensing child envelopes are preserved byte-for-byte; clinical inputs remain in their dedicated columns and are included in confirmation snapshots. The exercised supported set contains lab and imaging children. Atomic V1/V2 actual-result tests are separate. A dispensing-set representation fix needs its own scoped change and validation.

### Remote Migration and Recovery Candidate

- Target: existing synthetic Supabase project `qmerxgzrwaaahpkhjqlc`; DDL/RPC contracts apply project-wide. User explicitly approved remote DB writes on 2026-09-09. Applied the reviewed multi-chart SQL successfully; remote ledger version is `20260908211856`.
- Read-only preflight: [preflight SQL](../../../../scripts/sql/encounter-multi-chart-preflight.sql). Compare existing-field hashes before/after; no clinical row bodies are returned. Current remote counts: Cheongdam 43 encounters / 7 SOAP / 118 orders / 41 diagnoses; `clair-demo` 9 / 6 / 38 / 6; foreign demo 0 / 0 / 0 / 0; clinical-master pilot 1 / 0 / 4 / 0.
- Candidate: `supabase/migrations/20260908211856_encounter_multi_chart.sql`, reviewed SHA256 above. Applied as one migration transaction after target/scope authorization. All ten existing workspace/table count and preserved-field fingerprint pairs matched immediately before/after. Existing 13 SOAP rows retain their data and receive clinical time from creation time; no legacy orders received guessed origins. Expected indexes, four new columns, SOAP CRUD revokes, authenticated create permission and anonymous denial were verified. Repository filename now matches the generated remote ledger; SQL content hash is unchanged.
- Containment: [pause new creation](../../../../scripts/sql/encounter-multi-chart-pause-creation.sql), retaining chart-aware reads/writes and all data. The UI may still display the create action, but the database rejects it. Resume creation only after a reviewed fix by restoring authenticated EXECUTE.
- Do **not** revert to the pre-feature application as normal recovery once multiple notes exist. Keep this chart-aware build and use a forward fix; never restore the old unique index or delete later notes. A previous deployment is only an emergency availability reference, not a data-compatible full rollback.
- Remote migration and synthetic Cheongdam smoke are authorized by the user. Main/deployment preapproval remains valid. Complete authenticated smoke and the updated exact-candidate Release Check before merging.


### Planned Scoped Deployment Smoke

After the separately approved migration, use the existing authenticated synthetic Cheongdam workspace to load an active encounter, create three independent timed charts, switch/refresh SOAP, sign one chart without signing the other drafts, and verify diagnosis/order source scopes. Any persisted synthetic smoke records and permitted cleanup must be included in that approval. Compare foreign/demo pilot preserved-field fingerprints after migration and after the scoped smoke; expected mutations must be isolated to the approved synthetic encounter. Probe `/login` separately from authenticated treatment behavior. Do not label mock-browser results as live integration verification.

### Authenticated Preview Checkpoint

The synthetic Cheongdam veterinarian login succeeded. Live inspection found the history aside had not hydrated its separate Supabase auth hook, so actor scope differed from the body and disabled chart creation. The aside now invokes the existing hydration method on mount. This issue was hidden by the shared mock session store; authenticated preview retest is required. Existing clinical records were not edited during diagnosis.

### Live Integration Findings and Fixes — 2026-09-09

Authenticated Preview created three synthetic charts beneath the existing approved Cheongdam encounter. Independent A/B/C SOAP text survived fresh reads; A signed while B/C and the encounter stayed open. Recording assessments exposed a redundant BlockNote change event when editability toggled: the document was exactly unchanged, but it queued a SOAP write during the assessment RPC and sent the prior revision. The UI now ignores equal documents. A local copy of the candidate connected to the same remote DB verified diagnosis response revision → identical SOAP expected revision → HTTP 200, then successful chart switch. A delayed-response browser regression covers this ordering.

Live order integration found two narrow request/response issues: the route accepted `chartId` but core envelope validation omitted it; the fixed-price set RPC omitted `priceRanges` while the mapper required an array. Core validation now accepts the documented chart identifier and still rejects unknown keys. Only fixed-price previews default an omitted range list to `[]`; range-price previews still require it. The synthetic lab set and its child saved successfully, each retaining the C chart origin and root/child linkage. One catalog-read attempt returned 503 before a successful retry; no timeout or readiness guard was relaxed.

Remote synthetic smoke records are intentionally retained as evidence:

- Encounter: `de66f185-864d-4d70-b5f6-c51b6e47bbc1` (existing; still `in_consultation`). Chart creation did not create another reception or change the seven-visit history count.
- A `2ba72407-c6e6-472e-a923-fb0e53f28705`: signed; B `861e1680-2d92-468a-a3fb-8f86ce259cd3` and C `22edf959-7b5a-49bd-a472-22fe6aa5517f`: drafts. Each has its own clearly marked synthetic SOAP text and four recorded diagnosis assessments.
- C set root `28f2662c-8b4e-472f-bc5a-cdd3439d8373` and child `24665cf0-8048-455f-8d89-43057eb30a69`: saved drafts; neither is a new invoice or completed result. B's current-chart order view remains empty. Encounter-wide read-only viewing includes the C set and existing legacy orders.
- Existing Cheongdam SOAP fingerprint remains `efa1d0eb74d0964a0421e323429514d5`; existing legacy order fingerprint remains `87ffe1c4a652cd1277d44a034f709507`. Cheongdam counts are now 43 encounters, 10 SOAP, 120 orders, 41 diagnoses. Assessment saves updated only this encounter's diagnosis audit metadata and encounter update time. `clair-demo` and pilot fingerprints remain equal; foreign-demo record count remains zero.

Final Preview/Production smoke must use the updated application candidate. Local authenticated remote-DB evidence is distinct from deployed Preview evidence. Live confirmation/results/billing execution and encounter finalization were not performed against the pre-existing synthetic drafts; those transitions remain covered by the owned PostgreSQL suites. Inherited dispensing-set snapshot incompatibility remains as documented above.

Final live-fix verification: 29 focused browser/API/catalog regressions passed, including delayed diagnosis-response revision ordering, chart envelope acceptance, and fixed-price preview omission. TypeScript and production build passed; lint has zero errors and the same five existing WP10 warnings. Docs, secrets, and diff checks passed. The updated deployed candidate and exact-head Release Check are the remaining delivery checks.

### Patient Chart History Correction — 2026-09-12

The side history was still encounter-based: its RPC paged by encounter check-in time and returned at most one SOAP summary per encounter, while the UI rendered a second selected-encounter chart list. The local correction replaces that projection with one patient-wide row per non-voided chart and uses immutable chart creation time plus chart ID for cursor order. The side panel now has one grouped chart list with a `진료일 | 작성일` segmented view; the default visit-date view uses encounter check-in/creation dates, while the created-date view exposes later additions without changing the selected chart or total count. The oldest active chart in an encounter is the first record, later charts are marked `추가 기록`, and a cross-date addition shows its source visit in history and a neutral relation notice above the clinical panels. A row carries and restores its exact encounter and chart IDs; deep links survive reload, historical charts remain read-only, and encounters without charts do not create display rows. Inline diagnosis history stays encounter-deduplicated because it is a separate encounter-owned diagnosis surface.

`+ 새 차트` now opens a target-visit dialog instead of silently inheriting the chart currently on screen. Rows identify visits by purpose, date/time, veterinarian, status, and existing chart count without an encounter/chart number. The current active visit is the default. Completed visits remain visible but disabled with an always-visible `차트 추가 불가` state and hover/focus guidance; the server continues to accept creation only for `in_consultation` and `ordered`. The creator is persisted and displayed as the new chart 담당자. A failed editor flush keeps the dialog open and creates nothing.

The browser regression uses mocked API responses and deliberately separates chart `created_at` from clinical time, update time, and encounter check-in time; it also covers two same-minute charts, stable ordering, exact past-chart selection, reload restoration, current-chart return, and distinct loading/error/empty states. Six focused `chart.spec.ts` browser cases passed. A separate 17-case run passed all patient-history server, encounter multi-chart server, and multi-chart browser tests, including failed-save retention and save-on-switch. Existing first-chart encounters whose orders predate origin tracking now open the explicit legacy-order scope by default, while additional charts open their own chart scope; a representative legacy mutation regression passed after this compatibility correction. The owned local PostgreSQL runner passed all eight contract suites with explicit rollback, including the new history suite for patient scope, no empty/voided rows, same-timestamp tie order, and lossless two-page cursors. TypeScript, production build, docs, secrets, Korean UX copy, diff whitespace, and full lint passed; lint retained only five pre-existing WP10 unused-variable warnings, and the build retained the pre-existing broad NFT trace warning for the docs reader. These are local synthetic checks, not an authenticated live database result. The new migration `20260912103000_chart_patient_history_by_created_at.sql` has not been applied remotely, and no commit, push, PR, merge, or deployment is part of this checkpoint.

## Current-Record Isolation Follow-up — 2026-09-12

The chart workspace now has one visible scope: the active chart. Assessment reads and edits only that chart's diagnosis snapshot. Plan/Order removes the encounter-scope selector and filters legacy-null and other-chart rows before rendering, counting, selecting, editing, confirming, or calculating the chart footer. The footer and amount detail use the same current-chart rows; top-level set counts stay distinct from child presentation and included-order-sum sets do not double-charge the parent. `수납에서 청구` navigates to the existing encounter billing workspace and does not issue the encounter-wide billing POST from the chart screen.

The internal encounter contract remains intact. Diagnosis identities are still encounter-owned; the revised chart assessment writer validates and upserts only the selected chart's rows while retaining the stable catalog snapshot, revision, closure, and creation metadata rules. Its 30-row limit applies to that selected chart input, and rows absent from that input are not retired or rewritten. It then replaces only the selected chart snapshot. Clearing one chart's assessment therefore preserves the encounter diagnosis, audit author/timestamp metadata, and every other chart snapshot. Order draft/action/execution writers continue to enforce immutable `origin_chart_id` independently of the client filter. Synthetic demo orders and focused server/browser fixtures assign explicit chart origins; no production legacy order is guessed or backfilled.

Local evidence on branch `codex/chart-current-record-scope`, based on `origin/main` `8a69d2fd6ad16357320f11c9a2827aabdba67604`:

- The production build, TypeScript, docs, secret scan, Korean UX copy check, and full ESLint pass. ESLint retains the five existing WP10 unused-variable warnings and has zero errors.
- Ten focused browser regressions pass for two-chart Assessment isolation; two-chart order row/count/amount isolation; encounter-summary exclusion; included-order-sum child billing with a zero-priced parent reporting one requestable set and 6,000 KRW; navigation to billing with zero chart billing POSTs; and existing chart geometry, confirmation, draft edit/delete, and empty/first-add behavior.
- Sixty-two focused diagnosis, draft, action, multi-chart, and billing server regressions pass. They include two independent chart snapshots, clearing one assessment, preserved encounter identity, and explicit demo chart ownership for draft/action mutations.
- The updated diagnosis SQL contract passes in an owned temporary clone of `chart_pr037_verified`; the temporary database is dropped after rollback. It proves that a repeated catalog selection keeps the stable diagnosis ID, chart A with 20 rows plus chart B with 11 rows is accepted, the chart A author/timestamp remains unchanged after chart B saves, one selected chart with 31 rows is rejected, and clearing chart B leaves chart A's snapshot and the active encounter diagnosis unchanged.

Remote DB application and production-data mutation are excluded from this repository candidate and require separate explicit approval. Repository delivery follows the exact PR candidate, Preview, Release Check, Production approval, merge, and smoke gates; PR #743's deployed state remains the baseline until those gates complete.
