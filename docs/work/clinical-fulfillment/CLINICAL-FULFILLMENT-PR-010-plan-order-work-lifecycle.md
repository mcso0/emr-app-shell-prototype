---
id: "CLINICAL-FULFILLMENT-PR-010"
type: "Work Item"
title: "Plan/Order Work Lifecycle And RPC Boundary"
description: "Separates assignment from work state and implements the target task lifecycle with DB-enforced permissions."
status: "human_review"
area: "clinical-fulfillment"
priority: "P0"
tags: [plan-order, fulfillment, rls, rpc, assignment]
target_pr: "GitHub PR #698; regression remediation PR #746"
source_docs:
  - "docs/product/domain/plan-order-all-tab-legacy-column-contract.md"
  - "docs/engineering/data-model/order-fulfillment-handoff-contract.md"
  - "docs/work/chart/CHART-PR-031-plan-order-legacy-column-validation.md"
dependencies:
  - "CLINICAL-FULFILLMENT-PR-009"
  - "CLINICAL-MASTER-PR-023"
updated: "2026-10-03"
---

# Plan/Order Work Lifecycle And RPC Boundary

## Goal

Implement one authoritative requested/in-progress/paused/completed/returned/
cancelled attempt lifecycle with separate assignee metadata, detailed phase,
history, and DB-level capability enforcement.

## Scope

- Add task assignee, assigned actor/time, started actor/time, detailed phase,
  prior paused phase, and revision/idempotency fields with immutable events.
- Add assign/claim/start/phase/pause/resume/return/handoff mutations and active
  assignee eligibility checks using existing route capabilities.
- Retire `accepted` from new writes. Migrate historical `accepted` with start
  evidence to `in_progress` and without evidence to `requested`, preserving a
  legacy event. Never infer from display names.
- Preserve returned attempts and create linked re-request attempts without
  duplicate active work.
- Extend execution and queue read models with safe assignee DTOs and phase.
- Preserve operating date/encounter context when navigating to downstream work.
- Add `chart:view`/`billing:view` checks to identified read RPCs and close direct
  legacy confirm/bill access through `clair_save_chart_order_action`.

## Out Of Scope

- Clinical master value authoring.
- Row-level billing adjustments and tax arithmetic.
- Final fixed 25-column chart rendering.

## Done When

- Assignment never changes common work state; start and handoff are distinct,
  auditable operations.
- Every target transition has allow/deny, stale revision, replay, cross-workspace,
  and wrong-permission coverage.
- Returned is a first-class terminal attempt and cannot be overwritten by a new
  request cycle.
- Direct RPC callers cannot bypass chart/billing capability or atomic
  confirmation.
- Lab, imaging, dispensing, and treatment screens expose the authorized target
  actions without placeholder user IDs.

## Verification

- SQL transaction tests and migration replay/rollback.
- Fulfillment server/API/UI tests for all target transitions and denial cases.
- TypeScript, focused lint, docs check, secret scan, and diff check.
- Remote read-only preflight and transaction rollback rehearsal before an exact
  persistent migration packet.

## Implementation Checkpoint — 2026-09-03

- Assignment is separated from work status; assign/unassign/claim/start/phase/
  pause/resume/handoff/complete/return, revision CAS, command replay, immutable
  history, re-request attempts, and queue-specific assignee eligibility are
  implemented locally.
- Mock and live RPC boundaries both deny unauthorized assignee discovery, and
  the changed/new regression suite plus local SQL rollback smoke passed.
- The first exact remote rehearsal found 16 legacy completed Tasks without
  start metadata plus queue rows without assignment provenance. Deterministic
  timestamp/actor backfills now repair those existing shapes without display-
  name inference or history deletion.
- The corrected staging migration and fulfillment smoke passed in one rolled-
  back transaction; follow-up readback proved no schema, fixture, or migration-
  history residue.
- 승욱 approved and Supabase applied persistent schema/RPC migration
  `20260903003949_plan_order_work_lifecycle_and_rpc_boundary`. Post-apply
  readback found zero started/assignment/cycle/returned shape violations across
  the existing task/queue rows. No remote fulfillment business-row mutation was
  executed.
- PR #698 merged as `f86ff1c31c6c288b5ba9697e5ad3902bd17f48ee`;
  production deployment `dpl_BekLknn1zHvZexMs2eniy4aSz5fG` is `Ready`.
  Authenticated production Plan/Order readback completed without raw lifecycle
  enum exposure or browser errors.

## Handoff Notes

Remote inspection found no current `accepted` or `returned` queue rows, but the
schema and RPC still permit both. Preserve the four historical
`ready_for_billing`/draft compatibility rows untouched unless a separately
reviewed deterministic migration covers them.

## Approved Regression Remediation — 2026-09-12

승욱 approved a local-only correction for fulfillment queue regressions found
after the lifecycle RPC replacement. The bounded scope is:

- Restore workspace-scoped patient, guardian, requester, and Task display
  context in `clair_list_fulfillment_work_items` while returning the stored
  `source_snapshot` unchanged.
- Use the hospital operating timezone for live queue and history timestamps.
- Make the URL `date` the shared operating-date boundary across each module's
  queue, header, content, and history surfaces.
- Persist the exact lab result, imaging study, or fulfillment work item together
  with its encounter and date; clear stale selection parameters on date or
  cross-module navigation.
- Keep terminal work readable through the existing immutable result/history and
  explicit amendment path. This checkpoint does not authorize a remote
  migration or business-row mutation.

After the local implementation and focused verification completed, 승욱
authorized commit, push, and PR creation and requested preparation through the
`main`/Production release path. The exact-candidate Production approval gate
and the separate remote Supabase migration gate remain required before those
actions.

Verification must cover the RPC permission boundary and snapshot separation,
stale URL fail-closed behavior, exact multi-item selection, Asia/Seoul display,
and completed lab/imaging/dispensing/treatment read and amendment contracts.

## Regression Remediation Verification — 2026-09-12

- The replacement queue RPC migration applied cleanly to an isolated local
  clone. Readback confirmed the workspace-scoped requester join, unchanged
  `source_snapshot`, authenticated execute grant, and anonymous denial; the
  temporary database was removed after verification.
- TypeScript, focused ESLint, documentation links, secret scanning,
  `git diff --check`, and the production build passed. The build retained the
  existing Turbopack NFT trace warning from the docs reader path.
- Focused browser checks passed for stale-selection fail-closed behavior, live
  patient/requester and Asia/Seoul display context, shared operating-date URL
  state, cross-module selection cleanup, and exact `workItemId` selection when
  an encounter has multiple queue rows.
- Independent review found that a live dispensing row could still fall through
  to display-name matching when two work items had the same name. Live rows now
  resolve only by their exact `workItemId`; an unknown live ID fails closed.
  Focused coverage verifies same-name rows in the same and different encounters,
  URL/detail selection, execution-history reads, assignment commands, and the
  missing-ID denial path.
- The authenticated PR-024 set rehearsal exposed a separate presentation
  mismatch in the retained work-item snapshot: the queue fell back to
  `Live order` and rendered `1 per_each` even though the frozen display name and
  product-unit authority recorded a confirmed candidate quantity of `3 tablet`.
  The queue now reads those frozen fields for display and product-unit billing
  projection while preserving the distinct prescribed total of `2`.
- The same rehearsal produced an actual draft invoice line with quantity `1`
  while its billing candidate held quantity `3`. That billing handoff mismatch
  remains a separate blocker owned by the predecessor remediation; this
  read-only queue projection neither changes nor claims to repair the invoice.
- Fulfillment lifecycle, execution-result, and lab-result persistence contracts
  passed 38 focused tests. The complete dispensing fulfillment browser file
  passed 14 tests, including the retained set snapshot projection and corrected
  Asia/Seoul timestamp expectation. Imaging immutable completion/amendment
  history passed its dedicated browser check; dispensing and treatment
  completion/amendment flows passed the focused execution checks.
- This local candidate is ready for human review. The migration remains
  unapplied remotely. Commit, push, and PR preparation are authorized; merge,
  Production deployment, and remote migration still require their exact
  candidate packets and approvals.
- Regression remediation PR #746 targets `main` from
  `codex/fulfillment-queue-context-selection`. Its exact final head, Preview,
  and manually dispatched Release Check are recorded at the release gate.
- A broader changed-file browser run reached 24 passes before it was stopped
  after six failures outside the focused scope. Three representative failures
  reproduced unchanged on the `origin/main` parent: a date-stale dispensing
  fixture and a pre-existing strict-locator ambiguity. They are recorded as
  baseline limitations rather than candidate regressions.

## Audit Item 4 — Approved Local Follow-up, 2026-10-03

User continuation authorization covers reducing historical reads for treatment,
lab, and pharmacy fulfillment plus synthetic local verification. It does not
cover hosted migration application, publication, `main` merge, or deployment.
The original dirty checkout was preserved. Work is isolated on
`codex/audit-fulfillment-history`; fetched base is
`e0e81f8f5d8888af3e7d44b68ec145553385d34f`, including PR896. Its sole chart
button-layout change does not overlap this fulfillment core/SQL change.

Implementation: additive v2 RPC and `(workspace_id, queue_type,
coalesce(due_at, created_at))` index; gateway passes existing selected operating
date and patient history filter, and mutation permission lookup passes exact
work item ID. Full snapshots, ordering, all statuses, summary semantics
(including returned in activeCount), and detail/mutation/realtime behavior are
preserved. The established contract is exact operating day, not new overdue
carryover. No row cap, new dependency, home redesign, role change, or business
write is added. [The owning read contract](../../engineering/data-model/order-fulfillment-handoff-contract.md#fulfillment-read-scope--audit-item-4-local-candidate)
records the deployment dependency.

### Synthetic Baseline And Reduction

An empty task database `item4_synthetic` in the existing localhost Docker
Postgres container received schema only, the existing main lifecycle/display
RPC migrations, and synthetic fixtures. No hosted data was read or written.
Fixture: 1,200 selected-day + 12,000 prior-day rows per queue, all six statuses,
dueAt present/absent, and five additional Seoul midnight/precedence rows.
Snapshot payload includes 2,700 bytes of synthetic detail text per normal row.

| Queue | RPC rows before → after | JSON text bytes before → after | Median RPC + JSON text serialization, 5 runs |
| --- | --- | --- | --- |
| Lab | 13,205 → 1,202 | 55,423,548 → 5,038,944 | 381.575ms → 32.961ms |
| Pharmacy/dispensing | 13,200 → 1,200 | 55,602,694 → 5,053,493 | 398.190ms → 37.552ms |
| Treatment | 13,200 → 1,200 | 55,576,294 → 5,051,093 | 379.140ms → 36.007ms |

JSON text shrank about 90.9%; local median time shrank 90.5–91.4%. These are
Postgres JSON-text/clock measurements, not wire/compressed egress, browser
latency, or production savings. Matching payloads were compared in full against
v1 filtered by the existing date contract, including sorted order and all status
subsets. The selected-day predicate used the new index (1,202 rows, 72 shared
buffer hits, 0.325ms direct index scan execution). It is not a measurement of
the whole RPC. No pagination/truncation at 1,000 rows was observed.

### Verification

- Local SQL: [fixture](../../../tests/sql/fulfillment_scoped_queue_fixture.sql)
  and [reader proof](../../../tests/sql/fulfillment_scoped_queue_reader.sql),
  guarded to the task DB. Full payload/order/status equivalence, dueAt-first
  half-open Seoul midnight, prior unfinished detail/historical day, future
  exclusion, date-free history, patient/order/encounter filters, missing actor,
  wrong role/workspace, inactive membership, restricted grants, and unchanged
  work-item hashes/counts passed. Proof changes were rolled back.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3144 npx playwright test
  tests/fulfillment-scoped-read.spec.ts tests/fulfillment-work-item-server.spec.ts
  tests/fulfillment-handoff-replay.spec.ts tests/fulfillment-assignee-server.spec.ts
  tests/queue-realtime-refresh.spec.ts tests/dispensing-fulfillment.spec.ts
  tests/lab-imaging.spec.ts --reporter=line`: 67 passed, 2 failed. New gateway
  tests cover date/patient payload, all-status summaries/full snapshot, Seoul
  boundaries, exact ID without date, and missing-v2 fail-closed behavior.
- The two failures reproduced unchanged in a clean archive of main with the
  same lockfile dependencies on port3145: handoff confirmation returns409 at
  `fulfillment-handoff-replay.spec.ts:46`; vital editor click waits on a disabled
  button at `dispensing-fulfillment.spec.ts:1417`. No scope expansion to fix them.
- `npm run lint`: passed, five existing warnings; `npx tsc --noEmit` and
  `npm run build`: passed after installing exact lockfile dependencies in the
  isolated checkout. Original checkout dependencies were incomplete for main.
- `npm run security:secrets`, `npm run docs:check`, `npm run ux-copy:check`, and
  `git diff --check`: passed.
- The 69-test suite ran on `f3e2566e`; after fast-forwarding the disjoint
  PR896 change, the three new gateway tests, type/lint/build, docs, secrets, UX
  copy, and diff checks passed again on `e0e81f8f`. Exact release-head checks
  remain part of the later publication/release workflow.
- Supabase CLI2.114.0 local advisors before/after v2/index produced exactly
  identical39 inherited findings. Public-schema DB lint reports one unrelated
  pre-existing `clair_restore_reception_appointment` reference to absent
  `appointment_change_logs.action`; the same lint output was reproduced without
  v2. No v2 finding and no hosted advisor claim.
- Official Supabase changelog and database-function docs were checked. The
  Sept25 PostgreSQL breaking changes concern ltree, legacy pgcrypto ciphers,
  btree_gist NaN, and custom operators; this candidate uses none of them.
  Sources: [changelog](https://supabase.com/changelog.md),
  [Postgres minor upgrade](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes),
  [database functions](https://supabase.com/docs/guides/database/functions).

### Release And Rollback Boundary

Local verification is ready for review with the two baseline test failures and
inherited schema findings above. Hosted migration, draft PR publication,
exact-candidate Release Check/Preview, `main` merge, and Production deployment
remain unperformed. Production Supabase must receive the separately approved
additive migration before the new application caller. Index creation has 5s
lock/120s statement timeouts and the migration is transactional. Failure must
stop application release; do not use unfiltered v1 as a runtime fallback.

Rollback rehearsal in the task DB removed v2/index while leaving v1 intact,
then reapplied the migration successfully. Prefer reverting the application to
the prior v1 caller; the additive DB objects can remain, or be dropped only
after all v2 callers are reverted. There is no data backfill or data rollback.
Date-free patient history and the separate home v1 reader can still be large;
future projection/pagination requires its own consumer/count contract.

## Draft PR / Release Preparation Authorization — 2026-10-03

승욱 accepted the offer to publish a draft PR and prepare release checks and
rollback evidence (`오케이 좋아`). Authorized preparation includes commit/push,
draft PR, automatic Preview, exact-head Release Check, and read-only production
schema/deployment/unauthenticated route verification. Hosted migration, `main`
merge, Production deployment, and clinical/financial write smoke remain gated.

The isolated branch was fast-forwarded to live main
`b56b6133213181091dd9d3939d5d45cb44f3cf42` (PR897 lab autosave). It contains PR895
and PR896. The new lab consumer changes do not overlap the fulfillment core/SQL
files. Repeated focused suite plus `lab-autosave-coordinator.spec.ts`: 73/75
passed, with the same two clean-main baseline failures documented above.
Type/lint/docs/UX/secret gates passed; production build was repeated before
publication. No dependency or lockfile change is included.

Read-only production metadata confirmed Vercel project
`prj_iCK5KPP0IBMm7crAqcruCHO4JSlV` / team
`team_yPnxLJWKaLHGXtslBgkEKmMv` and current Ready deployment
`dpl_GxoKWzoVnqzU6sSupAhzYokN3Nwh` at main `b56b6133`, with alias
`https://emr-app-shell-prototype.vercel.app`. This deployment preserves PR897 and
is the app rollback candidate, subject to a fresh check immediately before an
approved release.

Production Supabase target is `qmerxgzrwaaahpkhjqlc` despite its
`clair-emr-staging` display name. Read-only schema introspection found the v1
function body exactly matches repository migration `20260912121342`; hosted
history recorded it as `20260912145224`. Required lifecycle/display columns
exist, and v2/index are absent. Latest hosted migration observed:
`20261003070504_notification_waiting_threshold_idempotency`. This history drift
is why the release must apply only the reviewed SQL, not all pending migrations.

Candidate SQL file SHA256:
`2d97b629f7efde276315b65f777ec1747f10d95380dd826544ce91c00312d518`.
Preserved hosted v1 `pg_get_functiondef` SHA256:
`bebb45af41b20340ddc9cb9bcafc1bd91d8b5e262e45589fb1a05f52b72fed94`;
trimmed body SHA256:
`9a144b9cb71351cc2aa11c884c92442ae727965db8a65009bf7b2ac3330e1252`.
V1 execute ACL is owner + authenticated only, with fixed
`search_path=pg_catalog, public, private`. Proposed v2 preserves that boundary.

The complete approval packet will be attached to the draft PR after Preview and
exact-head Release Check finish. Safe smoke is limited to login and unauthenticated
API denial checks; no hosted clinical/financial write or authenticated clinical
list smoke is claimed. Preview cannot validate authenticated v2 reads before
the separately approved migration exists on its configured DB. Synthetic local
DB/browser regressions provide that behavior evidence at this preparation stage.

During draft PR899 publication, main advanced to
`c0faa1837842a48b6a3250d8b4a076d54d038804` (PR898 responsive lab table).
There was no fulfillment-file overlap. The feature commit was rebased onto
that main to preserve PR895–898; final candidate/Preview/Release Check must
use the resulting exact head, superseding the initial publication head.
The refreshed app rollback candidate is Ready Production
`dpl_DQD8jYcfZww9e1DVgRQ4gzz6KyHs`, source `c0faa183`, URL
`https://emr-app-shell-prototype-dsxf568sk-mcso0s-projects.vercel.app`.

## Current assignee boundary follow-up (2026-10-12)

승욱 explicitly authorized local UI/API/data implementation and non-destructive verification for lab, imaging, dispensing, treatment, and billing. Only the current assignee may edit or execute; reassignment transfers authority immediately. Lab input opens on claim; other modules retain start/completion/amendment flows. This follow-up uses isolated synthetic fixtures only. Existing WIP is preserved; no real data, remote migration, Production deployment, main merge, provider payment, or communication is authorized.

Implementation: shared assignee avatar/actions and feedback; DB enforcement for lifecycle, results, attachments and billing; durable invoice ownership with immutable assignment events; concurrent handoff rejection and scoped regression coverage. Local verification completed below; remote application remains pending.

### Local implementation and verification

- Shared avatar candidate dropdown, primary split-button sizing/style, success/failure feedback, busy recovery and current-assignee action gates are implemented. Dispensing/treatment table assignment no longer changes only local row state; assignment is controlled by the durable header action.
- DB candidate covers lifecycle, canonical/legacy lab writers, overall findings, attachment preparation/publication/deletion, execution recording/amendment, retest, invoice ownership/audit and billing writes. Existing start/completion phases and computed clinical handoffs are retained.
- SQL harness uses actual committed stored-function baselines with isolated synthetic tables/permission helpers. Apply/reapply, owner/inactive/foreign denial, immediate lab eligibility, durable invoice revision/events, legacy/direct attachment execution closure, manual sync rejection and two concurrent sessions (handoff vs stale write) pass. This is not a full Supabase replay or remote acceptance.
- Attachment route regressions: 14 passed, including publication/delete after transfer and permitted pending cleanup. Shared Storybook: 5 passed after dependency optimizer warm-up. Browser/API/contract checks: 19 passed for four-module avatar change/handoff and existing execution/eligible-candidate contracts; focused lab ownership and billing ownership UI each passed afterward. Lab browser verifies equal split-button height and settled primary background, immediate input, cancellation lock and transfer.
- A broader existing `billing.spec.ts` case failed before ownership actions at its queue-selection URL expectation. No unrelated queue-selection fix is included. Test-snapshot preparation initially missed assets/PostCSS; those environment errors were corrected before the successful scoped browser checks.
- TypeScript, focused lint and secret scan passed. Isolated mock-configured production webpack build also passed. Billing UI claim/transfer and settled primary split-button style passed; the invoice ownership trigger wakes existing private queue subscribers. Remote realtime delivery is not verified. No remote migration, commit/PR/release or real payment/data write was performed by this task. Existing and concurrently added WIP remains preserved.

### Scoped release authorization and preparation (2026-10-12)

승욱 authorized committing/pushing only this follow-up, PR/main/Production delivery, the reviewed remote DB migration, and synthetic live claim/change/cancel/authority-transfer verification. Existing user WIP remains in the original checkout. The release candidate is isolated on `codex/current-assignee-boundary` from current main and preserves already merged queue, history, tab and lab-table changes.

Hosted introspection found the established queue broadcast helper/receive policy and fulfillment trigger missing. This candidate includes their established implementation plus the invoice ownership trigger so open clients receive assignment changes. A transactionally rolled-back execution of the complete candidate passed against the hosted schema; original affected function definitions are retained locally for recovery. No unrelated pending migration is included.

Candidate checks: isolated SQL apply/reapply and concurrent handoff pass; attachment routes 14 pass; current and retained lifecycle Storybook stories 19 pass; lab claim/cancel/transfer browser pass. Full local lint, typecheck, docs, UX copy and staged secret scan pass; production webpack build passes. One initial browser run required dependency-install recovery, and one later mock-auth hydration timeout is being checked separately. Production smoke uses existing synthetic administrator/technician/front-desk sessions; no actual payment execution or real data is included.
