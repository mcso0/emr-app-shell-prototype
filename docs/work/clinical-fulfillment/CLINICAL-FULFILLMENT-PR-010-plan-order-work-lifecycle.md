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
updated: "2026-10-31"
---

# Plan/Order Work Lifecycle And RPC Boundary

## Current follow-up — 2026-10-31

The instruction review follow-up is locally implemented and verified. 승욱
approved the bounded remote migration and Production release on 2026-10-31;
remote execution and release verification are in progress. See
[the scoped record below](#instruction-review-follow-up--2026-10-31).

## Prior accepted closeout — dispensing instruction workflow, 2026-10-27

The bounded dispensing instruction workflow and its follow-up corrections are
complete. 승욱 accepted the reported result and requested this final record and
local commit. This closes the current workflow scope, not every historical scope
in this long-lived work item. Earlier pending/blocked statements below describe
their recorded stage; the final evidence here supersedes them for this scope.

- Delivery: PRs #1013–#1017 were merged. Required hosted DB corrections were
  applied with explicit approval. Final application merge is
  `c1df55a51f284993a61e24b9d36c03fdd05bbb53` (#1017); its Production deployment
  was verified Ready with the expected source and primary alias. No uncommitted
  application or migration changes remain in this task checkout.
- Verification: focused contracts, SQL regressions, Storybook interactions,
  type/build/lint, documentation and secret checks passed as recorded below.
  Release Check and CodeQL passed for the final candidate. These are recorded
  delivery results, not a claim that every check was rerun during closeout.
- Actual authenticated browser acceptance used only approved synthetic data:
  assignment, result recording, explicit set completion, undo, whole-set
  re-request, child dose change/re-request, requester display and reload passed.
  The final three-child scenario returned to 3/3 completed after recording the
  changed child's new 2-tablet result and explicitly finalizing the set.
  Unchanged 3/4-tablet sibling records, identifiers and completion times stayed
  identical; the changed child's original 1-tablet result was preserved.
- The display-name defect, chart lookup exception, mutation-response failure,
  requester projection omission and Storybook router fixture blocker were
  resolved by the subsequent corrections and acceptance recorded below.

### Remaining verification limits

- Full replay into an empty database remains unverified: the existing
  `20260826160000_clinical_master_dispensing_service_review.sql` requires absent
  seeded master data. Isolated regression and approved hosted application tests
  do not establish fresh-database replay. Reopen this check when its required
  baseline seed is available; no constraint or prior migration was weakened.
- Browser acceptance does not cover real clinical use or every role/screen
  combination. Automated permission, workspace, concurrency and notification
  checks are separate evidence, not proof of every corresponding rendered flow.
- No real patient/payment workflow or external communication was exercised.
  The approved synthetic fixtures and audit records remain as evidence; earlier
  deliberately pending fixtures do not represent unfinished production work.

### Evidence retention and commit boundary

Only this work document, including the final multi-child verification entries,
is included in the closeout commit. Local screenshots, SQL captures, reports and
readback files remain in `.artifacts/order-workflow/`; do not stage, publish or
upload them. They are retained locally and are not repository dependencies.
This closeout requests a local commit only; it does not require another release.

## Collected dispensing/treatment revisions — 2026-10-27

승욱 accepted the directions below and requested a consolidated list and
implementation order. **Implementation authorized on 2026-10-27.** Implement UI-01–UI-07 locally, including chart-scoped persistence and immutable request/completion instruction versions. Verify with isolated local synthetic data and rendered app checks. No deployment or hosted DB changes are authorized. Preserve the existing local table-inset changes and all
unrelated WIP. The earlier workflow closeout above remains historical evidence
for its original scope.

### Revision inventory

| ID | Revision | Current state |
| --- | --- | --- |
| UI-01 | Header ends and arrow column 28px; 24px arrow button with 4px left inset; instruction-row horizontal insets 28px | Already implemented and measured in the local synthetic app; not delivered to Production |
| UI-02 | Item-name column 280px by default, minimum 180px at compact widths; wrap long names and allocate remaining space to dose/total columns | Implemented locally; verification recorded below |
| UI-03 | Move the detached `수행기록·이력` entry to its corresponding order row, retaining result entry, read-only history, corrections and separate order `수정이력` | Implemented locally; verification recorded below |
| UI-04 | Use shared centered card-transition loading; retain same-item content on refresh; preserve scope guards and distinct error/retry/permission/empty states | Implemented locally; synthetic browser acceptance recorded below |
| UI-05 | Add chart entry and separate storage/readback for current-chart oral instructions; display them in the top Figma infobar | Implemented locally with separate chart storage; verification recorded below |
| UI-06 | Display parent-set common instructions together with the child's own instruction in each child order's expanded instruction row | Implemented locally; verification recorded below |
| UI-07 | Align the expanded instruction-row information icon's vertical center with the first text line; keep it beside that line as text wraps, preserving icon size, horizontal gap and callout padding | Implemented locally; verification recorded below |

UI-01 evidence is local presentation proof: the two changed source files are
`src/features/dispensing/components/instruction-document-table.tsx` and
`src/features/dispensing/components/instruction-document.css`. Its screenshots
and measured geometry are retained outside the repository in the task's local
evidence folder. Do not treat these checks as live API/DB or Production proof.

### Accepted instruction scopes and presentation

| Scope | Owner and application | Display |
| --- | --- | --- |
| 경구제 전체 지시 | Workspace + current chart + oral route (PO); all corresponding oral orders in that chart | Top infobar, entered through chart Plan/Order |
| 세트 공통 지시 | Parent set; its own child orders only | Each corresponding child's expanded instruction row |
| 개별 오더 지시 | Individual order or set child | The same instruction row, alongside the parent-set text when applicable |

- Use [Figma Content 28928:20808](https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ?node-id=28928-20808)
  for the infobar: information icon, `경구제 전체 지시사항` title, body, neutral
  background and close affordance. Wrap long text. Closing must not delete the
  saved instruction; temporary hiding and recovery need to be defined together.
- The current root-order `instruction` is set text, not chart-wide oral text.
  Do not relabel or overwrite it to create UI-05. Add a distinct chart-scoped
  value and trace it into the relevant dispensing view.
- Read parent-set text with the child's own text. Preserve both sources and
  their histories without copying the parent text into every child's storage.
  A standalone order has no parent-set instruction in its detail row.
- Another chart, a non-oral order or a treatment-only card must not inherit the
  oral instruction. Preserve existing workspace and server permission boundaries.
- Approved implementation: explicit chart save with expected revision; active work reads the latest value, while task request and every completion retain immutable evidence. Infobar dismissal is local to the mounted document/revision with an explicit restore action. Existing completed work and results are not rewritten.

### Planned implementation order

1. Define the three instruction scopes and their save/read/history contracts
   (UI-05/UI-06). Confirm how edits reach already-requested work and how a
   temporarily hidden infobar is recovered before implementing those behaviors.
2. Implement chart Plan/Order entry and the separate chart-scoped oral value,
   including persistence/readback under existing permissions (UI-05).
3. Connect the top infobar and move parent-set common text into the corresponding
   child instruction rows, preserving individual text (UI-05/UI-06). Align each
   expanded row's information icon with its first text line (UI-07).
4. Integrate `수행기록·이력` with the order row after its instruction structure
   is settled; preserve existing completion and correction flows (UI-03).
5. Apply the bounded item-name width and remaining-width allocation with the
   final row controls in place; retain all UI-01 dimensions (UI-02).
6. Integrate the common centered pending surface with the final document body;
   retain same-item content and existing late-response guards (UI-04).
7. Run the focused checks and synthetic rendered-app acceptance below, fixing
   in-scope regressions before declaring the local candidate complete.

### Planned acceptance and delivery boundary

- Verify chart entry, save/reload and readback in the dispensing infobar. Switch
  between multiple oral cards in the same chart and between different charts;
  confirm no leakage into non-oral/treatment scopes.
- Verify multiple sets, standalone orders and children with both instruction
  sources, one source or no text. Preserve parent/child revision history.
- Verify result entry/history/correction and distinct order `수정이력` access.
- Measure UI-01/UI-02 geometry in wide and compact layouts with long names and
  multiline instructions, including any row control added by UI-03.
- Verify UI-07 with single-line and multiline expanded instructions: the icon's
  vertical center follows the first text line rather than the full text block.
  Confirm wrapping and collapse/reopen preserve the alignment, icon size,
  horizontal gap and existing callout padding.
- Verify first load, card switching, same-item refresh, rapid A-B-C/A-B-A
  switching with late responses, error/retry, permission denial and true empty
  state using synthetic browser fixtures. Check the actual pending state before
  releasing delayed responses; do not substitute a resolved screenshot.
- Choose focused contract, component, browser and documentation checks after the
  implementation scope is concrete. The acceptance above is planned, not run.
  This planning update performs no source, API, DB, commit, push or release work.

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

### Live billing adapter repair within the approved release

PR974 merged at `9c78d47b320f1dfcf45c692e8dd28bf88078acab`; the reviewed DB candidate applied successfully as hosted version `20261012064004` (repository version `20261012054346`, same reviewed SQL). Exact Release Check 38213298634 and Preview were successful. Before write smoke, authenticated synthetic billing reads exposed an existing `workspace_membership_missing` failure: live invoice/payment/checkout routes passed the demo permission adapter instead of loading DB membership. Checkout also used an invalid UUID expression, routing valid UUIDs into mock persistence. Both prevent the requested current-owner execution proof.

The scoped follow-up connects these three billing routes to the existing session-bound DB permission loader and repairs the checkout UUID predicate. It changes no canonical roles, RLS or data. Route-handler regressions exercise valid live UUID GET/write requests, propagate denied membership, reject anonymous requests and fail if real sessions use mock persistence/authorization. Continue the authorized scoped release through a separate checked PR; do not claim billing smoke before it passes.

Live execution-context inspection also found SQL equality returned JSON null for an unassigned work item, causing the strict API parser to return 502. Additive migration `20261012065017_assignee_execution_context_boolean.sql` returns false explicitly without changing ownership or lifecycle rules. Existing applied migration history remains unchanged. Recheck the new exact head and apply only this reviewed follow-up before the app follow-up.

### Invoice candidate owner-denial HTTP follow-up (2026-10-12)

User authorized the narrow correction, commit/push/PR/main merge/Production delivery, and synthetic permission smoke while preserving existing WIP. Hosted DB still rejects nonowners with `current_assignee_required`; the gateway now maps that condition to HTTP403/permission_missing and billing core/vet-review propagation preserves403. Generic DB failures remain500. No DB migration or policy change.

Focused candidate-sync tests pass17/17, including direct/chart/fulfillment denial propagation and generic failure fallback. Existing Production reproduces500 for the previously created synthetic fixture; post-delivery smoke must return403 for the same authenticated nonowner request, with invoice/payment unchanged. Rollback baseline: PR975 merge `0752d353efbef5385b660dfb83336fe2a0783937`, Ready Production `dpl_7ajhyD7nvDYf2qT19McqoJhAAuC1`.

Local verification: secrets/docs/full lint/typecheck/build passed. Candidate sync17/17 and focused vet-review denial1/1 passed. Three historical vet-review completion tests fail identically with the origin/main fulfillment core: their setup attempts completion without the current assignment/start flow. Kept those unrelated fixtures unchanged; this correction does not weaken lifecycle guards.

### Completion test lifecycle alignment (2026-10-12)

User authorized fixing the remaining completion fixtures and scoped commit/push/PR/main/Production delivery while preserving WIP and authorization guards. Baseline fulfillment suite failed11/26: legacy self-assignment, completion before start, or a shared demo item already owned/in progress. Tests now use claim/start/complete, explicit requested/unassigned synthetic fixtures, and isolated encounter/invoice/lifecycle data for notification cases. Product code, role permissions, DB guards, and migrations are unchanged.

Verification: fulfillment26/26 + candidate-sync17/17 + eligible-assignee3/3 =46/46 passed together. Route regression retains403 before claim and adds409 before start after claim plus403 for a permission-bearing admin who is not the current owner. Existing terminal-state, audit, billing, and notification assertions remain. Local secrets/docs/full lint/TypeScript/build and diff checks passed; final test fixture edits rechecked with focused lint/TypeScript. Rollback baseline: PR976 merge `fda98a434030b141e8c90150c36d7068222695ee`, Ready Production `dpl_GPdGVRbHJAKHpxebHDVz7jq5qraU`. Delivery smoke: Ready source/alias plus login200; no new live clinical/payment writes for a tests-only change.

### Assignee input locks and stable request time follow-up (2026-10-12)

User approved the two screen corrections, synthetic UI verification, and commit/push/PR/main/Production delivery while preserving WIP and server/DB guards. Billing quantity cells use the selected invoice's existing current-assignee capability, including a callback guard; adjustment reason uses the same capability as payment memo. The checkout badge reads read-only without an editable invoice. Dispensing/treatment queue time now uses work-item creation/request time rather than last update time. No migration or permission-policy change.

Focused verification: billing actual-workspace Storybook7/7 covers unassigned/current-owner/transferred/cancelled input states; dispensing/treatment request-time browser regressions2/2 preserve creation time across claim/cancel with changed update timestamps; existing ownership/candidate/lifecycle server regressions45/45 pass. Preview/Production smoke will repeat those controls in two authenticated synthetic browser sessions, leave task status and invoice amounts unchanged, and restore unassigned owners. Rollback baseline: PR978 merge `9e6b529aec7d219e70c35823813e197257990f1a`, Ready Production `dpl_HqxEdRGP6PDz6j4RuFhiRNrvfV7Z`.

## 2026-10-12 vital read and notification timeout follow-up

User authorized investigating remaining vital-settings403 and notifications500, preserving permission enforcement and WIP, and scoped UI/API/data verification plus PR/main/Production delivery. Synthetic-only scope includes the existing Cheongdam demo workspace and two seeded actors. No clinical, payment, notification state or settings writes are needed except an explicitly denied technician settings PUT. Apply only the reviewed notification reader migration; do not replay unrelated migrations.

Cause: vital GET incorrectly required only `hospital_settings:view` despite patient-vital consumers using `patient:view`; hosted vital RPC already checks active membership. Accept either existing read permission while PUT and `canManage` retain `hospital_settings:manage`. Canonical role policies and DB vital guards remain unchanged.

DB logs at09:57:32Z and10:08:35Z show SQLSTATE57014 in `clair_read_notification_snapshot_v2` and its row-wise recipient/domain permission helpers. Cheongdam has1750 events but2 distinct recipient/domain combinations. Materialize distinct targets and evaluate the unchanged `clair_notification_visible_v2` predicate once per target per request. Retain actor validation, workspace/event scope, state isolation, limits, ordering, counts, grants and security mode. Verify complete snapshot equality before/after for both actors and denied actor/workspace access inside a rollback transaction, then apply only this migration and check actual Preview/Production screens.

Verification: vital server + notification bounded/persistence regressions26/26 passed; local secrets/docs/lint/typecheck/build passed (existing docs NFT trace warning only). In a rollback transaction, complete100-row snapshots/counts/states matched for both seeded actors; DB elapsed admin2788ms→59ms, technician1734ms→27ms. Actor mismatch and cross-workspace denial remained. A separate synthetic recipient/domain matrix84 rows per actor (168 total,7 domains,6 recipient targets,2 differing event bodies) produced0 visibility mismatches. Hosted migration `20261012103744_notification_snapshot_authorization_once` applied only the reviewed reader; repo filename `20261012103555_notification_snapshot_authorization_once.sql` records its source. Subsequent authenticated API reads returned200 in876ms/378ms (network-inclusive observations, not a load guarantee). Security advisor retained existing authenticated security-definer reader warnings; no function privilege or RLS policy changed. Rollback: revert the API commit and restore the prior reader body from `20261004041632_notification_bounded_snapshot_and_state.sql`; previous Ready Production is `dpl_jhVP6oPtmb7p1x3RACpRENMJFoXa`, source `19073231df1404a647dc79a83d995eab61249dd8`. Preview and Production smoke will verify both actors, vital read/denied write, other-workspace/no-session denial, notification drawer/filter/error state and five module loads without clinical/payment mutations.

## 2026-10-12 billing ownership feedback cleanup

User authorized fixing two final Production UX findings and scoped commit/push/PR/main/Production delivery while preserving WIP and authorization. Only billing caller display state and synthetic stories/fixtures change. No API, DB, RLS, role policy, financial mutation contract, migration or remote database change is required. Actual Preview/Production smoke uses the existing synthetic PR024 invoice and two seeded actors; restore assignment afterward and compare the financial payload. No payment execution or clinical writes.

Root causes: the assignment reader stored a null display name as an empty string, bypassing the shared card's nullish `미지정` fallback. It now clears the existing assignee display entry when no assignee/name is returned. Billing content retained a checkout failure after `canExecute` became false. Effective checkout feedback is now idle outside current ownership, and the prior checkout session is not passed to the read-only workspace. The existing async cancellation guard and server403 enforcement remain. Current-owner failures still display normally; legitimate errors are not rewritten as success.

Focused proof: two new/expanded actual-workspace Storybook regressions failed against the baseline. The fixed nine billing stories pass, including current-owner error visibility, transfer/unassign clearing, `미지정`, and late403 arrival after ownership loss. Existing API assignment/browser2/2 and session-bound billing permission17/17 pass. Candidate preflight and live screens are the remaining delivery checks. Rollback baseline: PR980 merge `f7a0bc3561057fd8b37ee867c56311e07ec60c9d`, Ready Production `dpl_BvZXFPV5ptkjsTQY11cfKFqtwUSp`.

Preflight: actual billing stories9/9, assignment/API browser2/2, session-bound permission routes17/17, focused ledger/amount/audit contracts5/5 (33 total) passed. Secrets/docs/full lint/typecheck/build and diff checks passed; only the existing docs NFT trace warning remains. Existing cancellation cleanup still owns late responses; no new effects, dependency, shared component API or accessibility controls were introduced. Delivery screen proof will exercise both live synthetic actors, retained403 writes, null→owner→new owner→null card state, and a clearly labeled controlled403 UI case for current-owner visibility/transfer cleanup/cancel cleanup; financial payloads must remain identical.

### Local demo assignee registration follow-up (2026-10-12)

The separately approved local regression follow-up registers the existing seed technician `user-tech-hayun` in the fulfillment mock permission adapter as an active `clair-demo` technician. It reuses the existing technician permission policy and adds no role, wildcard, foreign-workspace membership or authorization fallback. The unassigned Kong imaging seed now starts as `requested`, so its existing claim/start/complete flow can establish ownership before execution. No assignee is invented for that seed.

The original localhost outpatient route reproduced a 403 at the seeded CBC owner before registration; after registration it exposed the unassigned/in-progress imaging seed inconsistency. Both are corrected locally. Focused synthetic checks pass 14/14, including the unchanged outpatient save/readback/billing/audit flow, owner-only execution, unauthenticated/unknown/non-owner rejection, required start, assignment cancellation and transfer revocation. Full lint, typecheck and a mock-configured production build pass. The official 41-case regression is checked separately on the fixed local candidate. Existing local candidates and WIP are preserved; no remote DB, real-account permission, RLS, deployment setting, push, PR, CI, Preview, merge or deployment is authorized by this follow-up.

## 2026-10-13 provisional billing assignment read follow-up

User authorized investigating and fixing the initial billing assignment409, synthetic screen verification, and scoped commit/push/PR/main/Production delivery while preserving WIP, existing completed records and authorization guards. Current Production baseline is Ready `dpl_DsN53pkfcnazAxkWbUjqFkGhmyWA`, source `3d3920bfa7fe0fe1d6e2def1eb8810f2938194c6`.

The candidate-only billing display model uses `invoice-live-<encounterId>` until a persisted invoice is available. The ownership hook previously queried this display id and started its polling/realtime lifecycle, causing an initial409. The hook now treats only that reserved provisional prefix as an unavailable ownership target. It skips ownership reads/listeners/polling/subscriptions for the provisional model and resumes the existing lifecycle for persisted invoice ids. Real invoice authorization errors remain errors and continue to lock financial controls. Server/API/RLS/DB schema and canonical role policies are unchanged; no migration is needed.

The actual browser regression reproduced provisional ownership requests against the baseline. It covers provisional display and focus/event updates without an assignment request, followed by a real invoice target with denied/allowed authorization. Existing assignment and financial permission checks and actual-workspace billing stories are retained. Focused verification: new provisional-id browser regression plus existing assignment tests3/3, session-bound billing permission tests17/17, and actual-workspace billing stories9/9 pass (29 checks). Secrets/docs/lint/typecheck/build and diff checks passed; the existing docs NFT trace warning remains. Exact Release Check and scoped Preview screen acceptance follow. Smoke uses the existing pending UI-FINAL synthetic invoice, restores its unassigned state, and never starts/completes clinical work or submits payment. Rollback is the baseline Production deployment above or a revert of this scoped hook change.

## Approved dispensing/treatment instruction workflow — 2026-10-27

승욱 authorized the researched PRD update and in-scope local implementation and
verification. Baseline: Production/main `3af3462ce256fc1762216a104299c3427ab03f34`.
Work is isolated from the dirty primary checkout on
`codex/dispensing-order-workflow`. This authorization covers local synthetic
fixtures, additive migration/RPC/API preparation, application wiring, Storybook,
and tests. It does not authorize remote DB apply, main merge, Production release,
real data, payment, external messaging, or public publication.

Accepted behavior:

- Single-order row completion completes the order after a confirmation dialog.
- The top completion action completes the entire instruction, including unfinished
  active children. Its dialog explains the unfinished count. Cancelled children
  remain cancelled. Existing actual-result prerequisites remain enforced; never
  fabricate execution results to satisfy completion.
- Completing every child does not implicitly finalize a set.
- Unassign after start preserves performed results and pauses the work; a successor
  claims and resumes. Replacing an item executor does not replace the set main.
- Re-request restarts changed items only, preserving unchanged completion.
  A set-common-instruction-only change preserves completed items and set completion.
  Show the changed instruction and retain its author, time, and before/after history
  (승욱 confirmed this policy).
- Each item has one executor. The sub completes their own item. The main may
  assign/complete all items and finalize the set. The requesting vet may complete
  individual items or the set. Apply these explicit permissions at the server/DB
  boundary without broadening other modules' permissions.
- Technicians may undo a completion check without a reason or undo-history entry
  (explicit user correction). Preserve existing results and historical entries;
  reopening must not delete them. Transport deduplication is not a user activity
  history. Verify no undo task/order/audit history event is emitted.
- Match the latest reviewed prototype's card/table grouping, exact content
  hierarchy, changed-value tooltip, compact-width current value, and expanded
  change/instruction detail. Reuse current components and lifecycle/read models.

Completion criteria: the PRD's V01–V13/T01–T18 behaviors are wired through actual
callers; relevant local SQL/API/UI, stale response, retry, concurrent assignment,
workspace isolation, history, notification recipient/deduplication and visual
checks pass. Report local proof separately from remote deployment and acceptance.

Planned owners: dispensing instruction presenter/controller and contract;
fulfillment instruction read/command boundary; narrow canonical task/RPC
extensions; chart instruction/complete entry points; notification event producer;
existing product/data contracts and scoped regression coverage. No unrelated
refactoring or dependency changes.

### Local implementation and verification evidence

The shared instruction presenter is connected to the live dispensing/treatment
caller and the chart `지시서·완료` action. The reviewed prototype's status groups,
compact changed-value display, tooltip and expanded notes are retained. Draft
set notes use existing save/ETag handling; confirmed common-note revisions keep
completion. Child notes remain in the owning clinical detail schema.

Local evidence recorded on 2026-10-27:

- Ten Storybook browser checks pass, covering row confirmation/reopen, compact
  layout, read-only and save-failure states, common-note preservation, duplicate
  clicks, lost-response retries, conflicts and late reads/writes after selection.
- Fifty focused contract/draft/result checks pass, including the real local mock
  draft route, set-note reload/clear, unchanged child details and result retry
  without amendment authority.
- Real application caller checks pass for dispensing and treatment execution
  results, completion/history/amendment, and claim/unassign with stable request
  time. The dispensing result check required a rerun after initial development
  route compilation exceeded its navigation assertion timeout; the warm run passed.
- The isolated PostgreSQL harness executes instruction commands, the canonical
  result writer for a chart-only requester, independent child mutation and then
  whole-set repeat, notification recipient/deduplication checks, no-history undo,
  billing lock, actor/workspace denial, and two concurrent claim sessions.
  It checks candidate patch anchors against reconstructed owning definitions.
  Unchanged clinical validation/calculation and invoice internals are synthetic
  dependencies; handoff calls are verified, not invoice arithmetic.
- Wide/compact Storybook captures were inspected locally. Application UI uses
  synthetic intercepted responses; this does not prove hosted persistence.

A broader isolated migration replay stopped at existing migration
`20260826160000_clinical_master_dispensing_service_review.sql` because its seeded
master release was absent. No constraint was weakened and no original migration
was edited to force a pass. Full schema replay, hosted permission/persistence and
notification delivery remain release gates. Real data and remote writes were not
used. Invoiced orders retain the existing no-reopen boundary.

Final local checks pass: production build (including TypeScript), focused ESLint,
`docs:check` (1,075 files), and `git diff --check`. The existing secret scanner
also passed with its file list extended temporarily to include the new source
files (4,959 files; generated local artifacts excluded). The primary checkout
retains all 106 baseline WIP file hashes unchanged. The development server was
stopped and its unrelated generated AGENTS.md block removed.

The chart entry is wired in source and shares the tested instruction body and
transport; its complete chart-menu browser flow was not separately exercised.
No main merge, PR publication or Production delivery is included in this local
implementation authorization.


### Conditional release authorization — 2026-10-27

승욱 explicitly requested completion followed by commit, push, PR, merge to
`origin/main`, and approved deployment for this bounded instruction workflow.
This supersedes the earlier local-only delivery limit for the same work. Resolve
and record the final candidate and proceed after all applicable checks pass.
Remote DB application and hosted synthetic mutation smoke still need separately
scoped approval under the release contract; no real clinical/payment data or
external communications are included.

Current main and Ready Production source are
`3af3462ce256fc1762216a104299c3427ab03f34`. Rollback app deployment:
`dpl_4cCQcucPqUDgAEBBnFMWCypNdKvH`. Live main protection requires the combined
Release Check, an up-to-date branch, and applies to administrators.

The candidate requires these five migrations before its caller is released:

- `20261027091000_dispensing_instruction_workflow.sql`: private instruction state,
  bounded commands, receipts, completion and reopen handling.
- `20261027092000_instruction_execution_authority.sql`: requester/main executor
  access integrated with existing result and billing boundaries.
- `20261027093000_instruction_notifications.sql`: scoped notification events and
  recipient deduplication.
- `20261027094000_instruction_child_attempts.sql`: restart changed child attempts
  while preserving unaffected completion.
- `20261027095000_instruction_draft_notes.sql`: draft set-note persistence/readback.

Read-only hosted inspection confirms these migrations are not applied. Exact
hosted function definitions were exported locally without business rows. This
caught a context-reader anchor mismatch with the already deployed null-safe
owner predicate; the candidate and its reconstructed test baseline now preserve
that predicate. All further verification must use the corrected candidate.
Production merge remains blocked until required DB readiness and scoped smoke
are verified. Preview shares the existing DB and is not an isolated data target.


### Hosted preflight and remote DB authorization — 2026-10-27

승욱 explicitly approved applying the five PR1013 DB changes to the current
`clair-emr-staging` service and synthetic assignment/completion/re-request,
notification and billing-link verification. Existing clinical/payment records,
actual payments and external communications are excluded. Stop merge on failure.
This approval resolves the separate DB gate above; merge/Production approval
remains valid for this bounded task after refreshed checks pass.

Before permanent application, all five changes were executed inside rollback
transactions against the actual hosted schema. Canonical draft expansion and
confirmation created a new synthetic patient/encounter/set from an existing
synthetic catalog. Calls ran with the `authenticated` database role and the
allowlisted seeded actors; no authorization helper or trigger was disabled.

- Main/sub assignment and actual result completion passed. Replay preserved one
  result; child completion did not implicitly finalize the set.
- Requester completion passed without granting completed-result amendment rights.
- The real billing path created one synthetic candidate-linked invoice line;
  no payment was executed. All fixture rows were rolled back.
- Common-note changes preserved completion. Completion notifications reached the
  three expected recipients once; note changes reached the two assigned actors.
- A nonbillable variant passed no-history/no-notification undo with preserved
  results, independent child re-request, then whole-set repeat with child attempt 3.
- Workspace denial and private transaction-capability cleanup passed.

The hosted re-request test caught a missing reason on the aggregate's
`re_requested` event. The candidate now records the existing validated reason;
its local SQL fixture includes the canonical reason constraint and passes.
The corrected hosted re-request transaction passes as well. This supersedes the
older hosted-runtime evidence gap; fresh empty-database replay still has its
pre-existing master-seed dependency and is not claimed as passing.

### Approved hosted browser acceptance follow-up — 2026-10-27

승욱 explicitly requested clicking assignment, completion, undo and re-request in
Production using synthetic data. This authorizes one named nonbillable synthetic
instruction fixture in the existing approved workspace and UI-driven lifecycle
verification, with scoped readback and refresh checks. Existing real rows, payment,
external messages, schema changes and new releases are excluded. Persist the
synthetic fixture and its audit as acceptance evidence; do not purge it. Only setup
uses database tools; the requested lifecycle actions must use the actual UI.

### Browser acceptance defects and local correction — 2026-10-27

The user reported missing item/card names and requested finding visible defects
while exercising the workflow. Scope: correct instruction presentation and verify
the existing synthetic lifecycle. Preserve other WIP and all permission/data rules.

Observed in Production with the named nonbillable fixture:
- Main claim, item reassignment and reload succeeded. Required-result completion
  was rejected with the expected Korean message.
- Recording one synthetic result completed the item. Explicit set completion,
  undo and repeat completion succeeded. Undo preserved the one result and kept
  task-event count unchanged at 9; no revision was added.
- Item/card names were missing: canonical snapshots carry `displayName`, but the
  new reader used `orderDisplayName`. A new additive reader-only migration fixes
  both names and preserves legacy fallback names and authorization.
- Document summary incorrectly used the child assignee/status. It now uses the
  document main assignee and explicit finalization state. Start time now reads
  persisted `startedAt`, instead of the request timestamp.
- Re-request UI remains unverified: the chart live-queue route throws
  `Cannot read properties of undefined (reading 'id')`. Retry reproduced it;
  runtime error evidence predates this release (first occurrence September 22).
  This separate chart lookup defect is recorded, not silently included in the
  instruction display patch. The synthetic fixture also needs consultation-queue
  setup before chart-based acceptance can proceed.

Verification: canonical snapshot regression fails before the reader patch and
passes after it for set and individual names. Isolated SQL lifecycle/security
suite and 10 instruction contract tests pass. Targeted lint and type check pass.
These checks do not establish corrected Production rendering. The new reader
migration is prepared locally; the earlier DB approval named five migrations,
so applying this sixth migration requires the remaining scoped DB authorization.

### Chart lookup and browser re-request acceptance — 2026-10-27

승욱 explicitly requested fixing the existing chart lookup exception and verifying
re-request through the actual UI, including related visible defects. Continue the
same synthetic nonbillable fixture and bounded delivery approval. This authorizes
completing its consultation-queue/chart setup and UI lifecycle verification;
existing real rows, payments, external messages and canonical permission changes
remain excluded. No new DB migration is planned for the lookup correction.

Inspection found that the authorized reception queue already embeds patient and
optional guardian profiles. The chart reader ignores them, attempts forbidden
direct table reads, then runs a capped broad lookup. Missing guardians make that
fallback throw on `undefined.id`. Use the scoped embedded profiles, retain guarded
legacy fallback, and report incomplete hydration instead of silently hiding rows.
Completion requires successful chart loading, UI re-request creating a new attempt,
unchanged earlier result/history, correct new status/assignees, and refresh readback.

Local regression reproduces `undefined.id` before the fix; all 20 chart/instruction
contract checks pass after it. Type, build, docs and secret checks pass; full lint
has no errors (one existing untracked diagnostic-script warning). The existing
synthetic patient now has a consultation queue entry and a first chart, plus one
new nonbillable chart-owned set created/confirmed through canonical authenticated
RPCs. The prior fixture/order/results remain untouched. Actual result, completion
and re-request acceptance are pending the corrected application deployment.

### Chart mutation response acceptance correction — 2026-10-27

PR #1015 merged as `5683976d8e75796cf068f64d1bd4cfaa3fc13bf3` after local
checks, successful Release Check run `40492752284`, and Ready Preview
`dpl_J77v2s2co2uUhECx4BLjd6w5vs9u`. Production
`dpl_D5dzsPNKBVvGVPBSiiyCYm8UMcEn` is Ready for that SHA; `/login` returned
200. Authenticated actual UI now opens the synthetic chart successfully.

Actual UI completed the chart-owned synthetic set with one result, finalized it,
and preserved completion after reload. Whole-set re-request then displayed a
save failure even though the transaction committed: revision 2, linked attempt 2,
requested state, and cleared assignment/start/completion fields were persisted.
Do not retry blindly. The chart-scoped RPC delegates to the origin base without
`billingSummary`, while the application correctly requires that response field.
The live function definition confirms the missing wrapper; there is no new chart
lookup exception in the corrected deployment during this check.

Prepare an additive migration restoring the summary and broadcast inside the
same chart-scoped mutation transaction. Preserve its signature, actor/chart
checks, security-definer search path and existing grants; do not weaken response
validation or create a second mutation. The original result, task attempts and
nonbillable status must remain unchanged. Additional remote DB authorization is
pending; earlier approval covered only the previously applied migrations.

An isolated PostgreSQL regression reproduces the missing response before the
patch and passes afterward. It verifies post-mutation summary, broadcast,
idempotent replay, invocation of scope/actor checks, and rollback when summary
construction fails. Dependencies in this wrapper test are synthetic stubs; this
is not full hosted integration proof. Final acceptance requires the approved
hosted correction, successful actual UI re-request response, retained prior
actual results/history, current unassigned pending attempt, and reload readback.

### Chart requester display correction — 2026-10-27

승욱 requested fixing the remaining chart `요청 수의사` display and verifying
it in the actual screen. The persisted `orders.requested_by_user_id` exists,
but the scoped runtime projection omits it, both application parsers discard
requester metadata, and the chart resolves names from mock staff only.

Preserve canonical requester ID/display name through draft/action restoration,
row display and sorting. Explicit missing requester remains `미기록`; a known
requester without a readable name shows `이름 미확인`. Legacy responses without
new metadata retain their compatibility fallback. Do not substitute the current
viewer, primary veterinarian or confirmer for a canonical requester.

Prepared `20261027125000_chart_order_requester_display.sql` adds only two
read-only fields to the existing private projection. Live preflight confirmed
an invoker, stable function with empty search path and postgres-only execute
ACL. Remote application is pending separate user approval. Existing lifecycle,
results, nonbillable fixture and role/permission policy are outside this change.

Local verification: requester/parser contracts 25 passed; TypeScript, lint and
production build passed. Isolated PostgreSQL reproduced the missing requester
before the patch and passed afterward, including individual/set/child rows,
missing users, preserved fields, unchanged business rows and function security
contract. This uses a synthetic projection fixture, not hosted integration proof.
Storybook assertion covers two actual chart rows with a distinct synthetic
requester, but its execution is currently blocked before rendering by installed
Next.js 16.4.2 / Storybook router fixture incompatibility: `useRouter` reads
`parentRenderTree.data` from the fixture's absent `parentRenderTree`.
Both MCP tests and a fresh CLI run reproduce that initialization failure.
Do not report story tests or actual screen acceptance as passed yet.

Completion requires successful scoped screen checks and, after separate DB
approval and release gates, actual authenticated synthetic-chart readback and
reload retaining the canonical requester on the set and child rows.

승욱 explicitly approved this hosted requester projection correction in chat.
The migration applied successfully; scoped synthetic readback returned canonical
requester IDs/names for both current set and child rows. Post-apply ACL, invoker
mode, stable volatility and empty search path match preflight.

The story now supplies per-mount App Router/path/search contexts explicitly,
retaining the same synthetic chart route and avoiding the incompatible framework
decorator. All six actual-workspace stories passed, including the new requester
assertion, filtering, detail, keyboard collapse, history and retry. No shared
Storybook configuration or production routing was changed.

### Multi-child browser acceptance — 2026-10-27

승욱 explicitly requested actual-screen verification that changing the dose and
re-requesting one child of a multi-child set preserves completed sibling states
and results. Extend the existing synthetic-only browser acceptance scope with
one separate nonbillable three-child set/encounter for the existing synthetic
patient. Setup may use canonical draft/confirmation RPCs with the authenticated
seed actor; completion and individual re-request must use the actual UI.
Preserve the prior fixtures and all real records. No schema, permission, payment,
external communication or application release change is authorized or needed.
Compare sibling task/result IDs, content and completion timestamps before/after;
verify the changed child's new attempt and reload the actual instruction screen.

Actual browser acceptance passed. Three synthetic children (1, 3 and 4 tablets)
were completed through saved execution results and explicit set finalization.
Only the first child was changed to 2 tablets and re-requested through its edit
flow. After reload the instruction shows one modified child, two completed
children and 2/3 completed. Both unchanged siblings' actual result dialogs still
show their original first-attempt 3/4-tablet results and original recording times.
Scoped before/after comparisons found identical order, task, work-item and result
records for both siblings, including IDs, content and completion timestamps.
The changed child retains its first-attempt result and has a new pending second
attempt. All four order rows remain nonbillable. Prior synthetic fixtures and
real data were not changed. Evidence is retained in the local task artifacts;
this is synthetic acceptance, not real clinical validation.

승욱 subsequently requested actual-screen completion of the re-requested child,
normal whole-set completion and preservation of sibling results. Continue only
the same three-child synthetic fixture: save the new 2-tablet actual result,
explicitly finalize the set, reload, and compare the unchanged siblings against
the captured baseline. No new fixture or application/schema change is needed.

Recompletion acceptance passed in the actual browser. The changed child's
second attempt saved an actual quantity of 2 tablets and completed. Explicit
whole-set finalization then completed the root task; after reload the instruction
shows 3/3 completed, three completed children and a completed set footer.
Both unchanged siblings retain identical order/task/work-item/result records,
including IDs, content and completion timestamps. Their actual result dialogs
still show first-attempt results of 3 and 4 tablets, recorded at 20:45:54 and
20:46:09 KST respectively. The changed child's original 1-tablet result remains
alongside its new 2-tablet result. Local evidence includes the recompletion
before/after capture and reloaded completion screenshot. This verification uses
only the approved synthetic fixture; it does not establish real clinical use.


### Local implementation verification — 2026-10-27

User approved all seven items and the proposed storage/history rules. No push,
merge, deployment, hosted DB mutation or Production write is authorized.
The starting Production source was `aa26f7c424967a627be498a48f47820562a8702b`.
Existing two-file inset WIP is retained; the primary checkout was not edited.

Implemented surfaces: chart oral-instruction editor and session API; distinct
private chart revisions and task snapshots; dispensing infobar and child-row
set instructions; row-associated execution history; bounded 280/180px item
column; 28px ends/insets with 4px arrow-button inset; first-line icon alignment;
centered card loading with retained transient-error content and authorization
withdrawal. A table menu refresh action exposes same-item rereading. Minimum
numeric/action widths use local table scrolling only when space is insufficient.

Verification uses an isolated local PostgreSQL database reconstructed from local
schema and repository migrations, with synthetic identities only. It is not a
full migration replay or proof of hosted schema parity. Candidate installation,
save/readback, chart isolation, workspace/member denial, signed-chart lockout,
revision conflicts, concurrent CAS, immutable request/completion versions and
unchanged completed status passed. The normal execution-result requirement was
not disabled; the focused snapshot SQL fixture uses supported legacy result
schema 0 tasks. Existing schema-1 execution UI behavior has separate stories.

Rendered app verification at 1616 and 1280px measured all table ends/insets at
28px, arrow inset 4px, name column 280/180px, and icon center on first text line.
A local HTTP fixture proxy served synthetic queue documents; chart editor save
and fulfillment oral-instruction readback called the actual local SQL RPCs.
A→B→C and A→B→A, same-item delayed refresh, 500 retention, 403 withdrawal and
retry passed without page runtime errors. Chart editor close/reload retained its
saved DB value, and the app infobar reread that value. This is component/app and
local DB evidence, not an authenticated deployed end-to-end session.

Evidence is kept outside the repository in the task's local evidence directory.
Final checks and user acceptance remain separate from delivery.

Final local checks: production build, scoped ESLint and diff validation passed;
12 contract checks and 21 Storybook checks across four files passed. Long names
wrap at 180px, and the multiline icon center delta measured 0px. Treatment card
transition, rapid selection, retained refresh and transient-error retry also
passed in the rendered app with synthetic queue fixtures.

The final document-read check caught a PL/pgSQL variable/table alias collision;
unique aliases fixed it, and the SQL regression now calls the fulfillment reader
and asserts both latest instruction and request/completion snapshots. Local
realtime emitted missing-partition warnings: row revisions are updated, but
cross-client broadcast delivery is not verified by this local environment.
Evidence: `/Users/iseung-ug/.codex/task-evidence/2026-10-27-dispensing-seven-revisions/`.
Local implementation and focused verification are complete; user review and
any later release remain separate. No hosted migration or deployment occurred.

### Release authorization — 2026-10-28

승욱 requested deployment and gave advance approval after the assistant stated
the bounded PR/merge/Production and required instruction-storage DB scope. This
supersedes the prior no-deployment boundary for UI-01–UI-07 only. Proceed after
current-candidate checks, Ready Preview, scoped smoke and schema compatibility
verification. Preserve unrelated WIP and data. No paid resources, permission
policy expansion, provider side effects or unrelated migrations are included.
Previous Production: `a42357d9be4d60e2a4edc87da55f6acc368ef4cc`, deployment
`dpl_4jMGuahAvP2Umb2NXDDqxX9K4Lr1`. Rollback is that application deployment
or a reviewed revert; additive instruction evidence must not be deleted.

### Instruction review follow-up — 2026-10-31

승욱 approved local implementation and verification of the 16 reviewed annotations,
with existing WIP preserved. Remote DB apply and deployment require confirmation
before execution. Baseline: `7baa5f890b4095cd5eb8281445388779f2fa2870`.
The implementation uses a separate checkout. No existing remote data repair is
included; inconsistent records require a separately reviewed evidence-based plan.

Scope and acceptance:
- Claim assigns and starts eligible unfinished work atomically. Ordinary unassigned
  users cannot start/record/complete. Preserve main/item executor roles and the
  explicitly reconfirmed requesting-vet completion exception. Opening history or
  completion input never starts work. Requester save may complete authorized work
  without claiming it, with actual-result prerequisites and immutable records intact.
- Move required actual-value entry into completion; retain execution history and
  correction access in the card menu. Keep per-item completion and explicit set
  finalization. Disable modification history when no displayable changes exist.
- Resolve confirmed order names using current canonical snapshot fields; use the
  patient context profile reader/formatters for instruction patient demographics.
- Display explicit instruction/memo fields, not calculation metadata. Preserve
  source values. Remove row execution buttons and verify 36/40/52px density.
- Show the oral infobar only for nonblank current text; retain stored audit data.
  Apply Neutral/100 background, Neutral/200 1px border, padding 12px 12px 12px 18px,
  and top-aligned close control at all widths.

Planned evidence: isolated synthetic SQL lifecycle/authority/concurrent-claim and
rollback checks, contract tests, Storybook and synthetic actual-app interaction
checks (save failure/retry, stale response, ownership transfer, set partial work,
empty/history/long-content/compact layout), focused lint/type/build/docs checks.
No real patient data, hosted writes, deployment, or new clinical calculation rules.

Local verification completed — 2026-10-31:
- Isolated SQL runner passed lifecycle, requester completion without assignment,
  current-owner revocation, required payload/revision/plan validation, preserved
  results, workspace isolation, replay and concurrent claim checks. The fixture
  now applies intervening ownership/aggregate patches and timestamp constraints.
  This reconstructs the relevant schema; it is not a full migration replay or
  hosted database/RLS proof. No hosted database was read or changed in this phase.
- Focused Playwright suite: 23 passed. Synthetic API responses in the actual app
  routes covered completion/correction, failed-save draft and command-ID retention,
  set item completion before finalization, claim/status, demographics read failure,
  36/40/52px row height, and current-text-only infobar behavior at 1624/900px.
- Storybook browser suite: 20 passed across instruction workspace, transport and
  execution dialog. Includes late reads, retained state, retry, and a pending POST
  overtaken by an ownership refresh. Saving blocks dismissal and always clears
  its pending state; successful saves reconcile through a fresh read.
- TypeScript, full ESLint, production build, docs check, secret scan and diff
  whitespace check passed. The final doc-only record receives another docs check.
- Read-only authority review found two dialog race cases; both were fixed and
  re-reviewed with no remaining finding in that bounded scope.

Evidence: `/Users/iseung-ug/.codex/task-evidence/2026-10-31-instruction-review/`.
The source checkout was not edited. A dev-generated AGENTS block was removed
from this task checkout so it is excluded from the candidate. Local changes remain
uncommitted for review. No PR, merge, hosted migration, deployment, or repair of
existing inconsistent data was performed. Human acceptance remains pending.

Required next delivery scope: review and explicitly authorize migration
`20261031120000_instruction_review_fixes.sql` and the application release together.
Before any hosted apply, compare its four function anchors against the current
remote definitions and verify existing migration/permission compatibility. This
candidate preserves RLS/grants, stored results and role policy. Production smoke
and rollback preparation belong to the separately authorized release workflow.

### Release authorization and preflight — 2026-10-31

승욱 explicitly authorized the remote DB application and Production release for
this instruction-review change after current-state inspection. The authorization
covers the one migration `20261031120000_instruction_review_fixes.sql`, scoped
commit/push/PR, exact-head main merge, and deployment verification. Preserve all
other WIP; no data repair, unrelated migration, permission/grant changes, paid
resources, provider side effects, or settings changes are included.

Preflight confirmed `origin/main` remains `7baa5f890b4095cd5eb8281445388779f2fa2870`
and Production `dpl_AoTGWj1WvsjL8zDQjgS2NSTy7ACv` is Ready at that SHA. This is the
application rollback candidate. Main protection still requires the automatic
Release Check, strict up-to-date branches and resolved conversations. All 11
replacement anchors matched the four current remote SQL function definitions;
the candidate has not been applied at this checkpoint. Existing function ACLs,
table grants and RLS policy fingerprints are retained as private local evidence.

Delivery gates: current-head Ready Preview and Release Check; preserved local
verification from the unchanged app candidate; final secret/docs/diff gate;
apply exactly the approved migration with before/after definition and ACL/RLS
comparison; then merge with expected-head protection and verify Ready Production
at the merge SHA. Smoke checks cover login, unauthenticated instruction/execution
API denial and the changed UI with intercepted synthetic data. Such UI checks do
not prove a signed-in hosted persistence flow. No real clinical rows are used.
Do not roll back database records; any DB restoration requires review of the
captured prior function definitions. Stop on drift, failed gates or failed smoke.

Compatibility review: DB-first preserves data and existing-result reads, but the
old UI auto-starts requested/paused items before opening result input. The new
owner guard rejects that path for a non-executor requester. Minimize this window
by finishing Preview/CI before applying SQL and immediately releasing the app.
Old tabs need reload after delivery. App-only rollback to `7baa5f89` retains this
requester limitation; a complete rollback needs separately reviewed restoration
of the captured four prior SQL definitions. No destructive data rollback is used.
