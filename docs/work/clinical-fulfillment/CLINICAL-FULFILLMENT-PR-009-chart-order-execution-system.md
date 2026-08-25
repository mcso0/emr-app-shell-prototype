---
id: "CLINICAL-FULFILLMENT-PR-009"
status: "completed"
area: "clinical-fulfillment"
priority: "P0"
target_pr: "https://github.com/mcso0/emr-app-shell-prototype/pull/617"
source_docs:
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/engineering/data-model/order-fulfillment-handoff-contract.md"
  - "docs/product/domain/workspace-auth-permissions.md"
  - "docs/engineering/data-model/emr-saas-db-structure-spec.ko.md"
  - "docs/design/system/DESIGN.md"
dependencies:
  - "CLINICAL-FULFILLMENT-PR-001 through CLINICAL-FULFILLMENT-PR-008"
  - "Clinical Master Phase 1 operational order catalog"
updated: "2026-08-26"
---

# Complete The Chart Order Execution System To A Deployment-Ready Checkpoint

## Goal

Implement one coherent, workspace-safe contract from order master through shared
chart candidates, explicit confirmation, universal tasks, optional department
queue projections, billing candidates, and immutable amendment/re-request
history. Deliver the exact candidate through local verification, the approved
production database migration and deterministic backfill, push, pull request,
checks, and the safe merge boundary without performing the production
application deployment.

## Baseline

- Starting `origin/main`: `355a71d7f09b1e66b2de1e9b2a7aa564d405d707`.
- Worktree:
  `/Users/iseung-ug/project/emr-app-shell-prototype/.worktrees/chart-order-execution-system`.
- Branch: `codex/chart-order-execution-system-20260825`.
- The primary checkout contains unrelated user WIP and is read-only for this
  work.
- The planning report's repository and staging observations are snapshots. The
  approved target contract remains authoritative, while current code and the
  exact production database are re-verified before implementation or remote
  mutation.

## Phase 0 Evidence

- Source baseline: `origin/main` and the clean branch both started at
  `355a71d7f09b1e66b2de1e9b2a7aa564d405d707`.
- Production deployment: Vercel project
  `prj_iCK5KPP0IBMm7crAqcruCHO4JSlV`, deployment
  `dpl_pKRtYqZDvzHzJzCFMv2reA8vzXKp`, target `production`, status `Ready`,
  alias `https://emr-app-shell-prototype.vercel.app`.
- Previous rollback candidate: source SHA
  `ddb649cb645660899d52bc18fce6c4134ce9f7eb`, Ready deployment
  `dpl_9mUarZTfs2kRjCV45yhmiewrmTr8`.
- Automatic deployment boundary: GitHub recorded a Vercel Production
  deployment for baseline SHA `355a71d7...` immediately after the `main`
  merge. No safe deployment hold is currently evidenced, so Git delivery must
  stop with the exact candidate PR merge-ready unless that fact changes.
- Production-bound runtime database: project ref `qmerxgzrwaaahpkhjqlc` in
  region `ap-southeast-2`, status `ACTIVE_HEALTHY`. Its legacy provider display
  name is `clair-emr-staging`, but the current production alias public bundle
  resolves `https://qmerxgzrwaaahpkhjqlc.supabase.co`; this runtime link, not the
  provider label, fixes the exact target for this work.
- Effective production authentication uses Supabase claims: the public bundle
  contains the same configured project and an unauthenticated API request
  returns `sessionReason=claims_missing` from the Supabase-claims boundary,
  rather than mock fallback.
- Current migration shape after two content-proven, comment-only aliases:
  `178 local / 162 remote / 162 common / 0 remote-only / 16 local-only`.
  Fourteen are the documented genuinely pending migrations; the other two are
  exact behavior-applied canonical files. Remote stored-statement and local
  file SHA-256 values match exactly:
  `4699bbd82b0e5af6a40066750f6876110cf128b1e7d546f187aa10a1ed6c9cd2`
  and
  `194300c38ae866abb376a378da5d64e5110c76f4f30e0b313f61c066a9cfe914`.
  Broad `db push` and `--include-all` remain prohibited.
- Remote production-bound row baseline: orders `44`, draft status `2`,
  confirmed flag `38`, existing queue projections `31`, order-linked invoice
  lines `18`, catalog items `1234`, order sets `64`.
- Baseline reconciliation: draft-with-queue `0`, duplicate queue keys `0`,
  duplicate billing keys `0`, queue orphans `0`, billing orphans `0`, aggregate
  queue `0`, aggregate billing `0`. Four legacy `ready_for_billing` rows retain
  a draft confirmation flag and an invoice link; seven confirmed atomic rows
  have no legacy work item. Both groups require explicit deterministic
  classification during backfill, without display-name inference.
- Remote permission baseline: the existing draft/action/fulfillment/billing
  read RPCs are executable by `authenticated`, while several database checks
  stop at active membership rather than the server capability. Existing
  fulfillment RLS also has a broad active-member `FOR ALL` policy. The new v2
  boundary must enforce capabilities in SQL, bind actors to `auth.uid()`, use
  composite workspace foreign keys, and grant no direct authenticated writes
  to command/task/attempt/event tables.
- Frozen executable fixture:
  `tests/fixtures/chart-order-execution-contract.fixture.json`; it covers all
  eight types, a 13-root mixed draft, a three-child set, destinationless and
  routed tasks, partial confirmation, billing, stale ETag, and idempotency.
  Focused fixture verification passed `3/3`.

## Phase 1 Evidence

- Added separate TypeScript domain types for the eight canonical clinical order
  types, master destinations, execution modes, binary priority, universal task
  roles, and universal task states. The legacy four-value `EmrOrderType`
  remains unchanged for backward compatibility.
- Added the version-1 Field Matrix schema and validator in
  `src/features/chart/order-execution-domain.ts`. Every field freezes its key,
  value type, label, control, unit, options, display order, required/default and
  validation rules, inline/detail placement, bulk-edit eligibility, semantics,
  pre-confirm editability, amendment behavior, and snapshot path.
- Added migration
  `20260825234000_chart_order_execution_master_contract.sql`. It expands
  `order_catalog_items` and `orders` with canonical type, destination,
  execution, schema, detail-input, billing eligibility, revision, and confirmed
  snapshot fields while retaining all legacy columns and RPC inputs.
- Legacy `billing_only` and `chart_only` values deterministically normalize to
  `destination_module = null` plus `immediate_complete`. `external_lab` is only
  created from the canonical field or explicit master writer, never from a
  display or billing name.
- Compatibility triggers populate canonical values for existing catalog and
  draft writers. The dedicated master update RPC binds the actor to
  `auth.uid()`, enforces `service_catalog:manage`, locks the expected catalog
  revision, validates the full field schema, and records a target-validated
  `order_catalog.updated` audit event.
- Focused Phase 1 tests passed `9/9`, TypeScript passed, and a full local
  `supabase db reset --local --no-seed` replayed every migration through the new
  Phase 1 migration. Local postflight confirmed ten key columns, four core
  constraints, the master RPC, and schema validation are present.

## Phase 2 Evidence

- Added `order_tasks`, where one row is one execution or aggregate attempt,
  with workspace-composite encounter/order/parent/previous-attempt references,
  binary priority, immutable identity, frozen effective/result snapshots, and a
  unique `(workspace_id, order_id, attempt_no)` identity.
- Destinationless execution attempts are constrained to `complete`; routed
  attempts retain their master-owned destination; aggregate attempts cannot
  have a destination. A task/order guard requires a confirmed or billed Order,
  matches type/destination/encounter, and requires set-child tasks to point to
  the matching aggregate parent's set Order.
- Added append-only `order_task_events` with actor, reason, before/after values,
  attempt identity, and optional confirmation command identity. Terminal task
  identity, effective snapshot, priority, destination, and completed results
  cannot be overwritten; re-request attempt `N + 1` must link to terminal
  attempt `N` and starts at `pending`.
- Added the exact approved aggregate-state precedence in SQL and TypeScript:
  all cancelled, all terminal with at least one complete, any in progress,
  mixed terminal/active, paused, then pending.
- Extended `order_fulfillment_work_items` with task attempt, canonical clinical
  type, and destination columns. It remains keyed by the legacy
  `(workspace_id, order_id)` projection for the deployed app, while new linked
  rows must match a routed execution task. The queue type now represents the
  destination and no longer conflates the legacy four-value `order_type` with
  the eight clinical types.
- Replaced the broad active-member fulfillment write policy with read-only
  capability RLS. Task/history reads require `chart:view`; queue reads and the
  actor-bound transition RPC map each destination to the current lab, imaging,
  dispensing, or chart capability. Authenticated clients have zero direct
  Task/Event writes and no direct Queue insert/update/delete privilege.
- TypeScript and focused Phase 2 tests passed `7/7`. A second full local
  `supabase db reset --local --no-seed` replayed all migrations through Phase 2.
  Local postflight found 20 Task columns, 12 Event columns, four Queue-link
  columns, only the three intended select policies, and zero authenticated
  direct Task/Event writes.
- A rolled-back synthetic SQL transaction produced destinationless Task 1 / Queue
  0, routed Task 1 / Queue 1, rejected a pending destinationless task, rejected
  a mismatched queue projection, rejected completed-result mutation, and
  preserved linked attempts `[1,2]`. An authenticated RLS transaction returned
  local workspace Tasks `1`, foreign workspace Tasks `0`, and rejected a direct
  Task insert.

## Phase 3 Evidence

- Added the backward-compatible shared-draft migration
  `20260825240000_chart_order_shared_draft_contract.sql`. The deployed RPC
  signature and legacy row subset remain valid, while new candidates persist
  canonical type, master-owned destination/execution mode, versioned
  `detailInputs`, binary priority, billing eligibility, revision, and explicit
  selected set-child inputs.
- The runtime row serializer now includes every editable candidate value, so
  the server ETag covers quantity, set selection, type-specific details,
  urgency, and canonical lineage. A stale ETag is rejected before any newer
  server value can be overwritten.
- The chart client now autosaves valid pending changes after `700 ms`, flushes
  editable cells on blur and Enter, preserves edits made during an in-flight
  save, and retains local values on a `409 revision_conflict`. Unresolved
  conflicts visibly block confirmation and billing until the user explicitly
  reloads the current server draft.
- TypeScript draft validation accepts incomplete known fields during editing,
  rejects unknown client-owned fields, and retains full required-field
  validation for confirmation. The same partial-field policy is enforced by
  SQL and the mock gateway.
- A fresh local `supabase db reset --local --no-seed` replayed all migrations
  through Phase 3. Focused domain/draft/migration tests passed `22/22`, the
  targeted browser ETag-conflict scenario passed, and TypeScript passed.
- The rolled-back authenticated local SQL fixture
  `tests/sql/chart_order_shared_draft_contract.sql` proved same-server
  cross-device readback, a second-device update, stale-ETag rejection, invalid
  detail rollback, preservation of the latest ETag/value, and candidate-side
  Task `0` / Queue `0` / Billing `0`.

## Phase 4 Evidence

- Added the additive atomic-confirmation migration
  `20260825241000_chart_order_atomic_confirmation_contract.sql`. Its one
  actor-bound RPC validates workspace capability, encounter, selection, shared
  Draft ETag, canonical master revision, required detail values, and a
  normalized idempotency key before freezing confirmed snapshots and creating
  every execution artifact in one PostgreSQL transaction.
- Added `order_confirmation_commands`, `order_billing_candidates`, and
  `order_execution_outbox`. Authenticated callers receive no direct command,
  Task, Event, or Outbox writes; Billing candidate reads require
  `billing:view`. Exact retries return the stored deterministic result, while a
  reused key with a different request is rejected.
- Confirmation creates one execution Task per confirmed atomic Order, one
  aggregate Task plus current included-child execution Tasks for a set,
  immediate `complete` state for destinationless work, Queue projections only
  for routed execution Tasks, and one positive chargeable Billing candidate per
  atomic Order. Aggregate Tasks never project to Queue or Billing.
- Task events, Order/Billing audit events, and one durable outbox event per
  selected root share the same commit boundary. The deployed B3 confirmation
  function remains the backward-compatible set-expansion and canonical lab
  snapshot bridge inside that transaction.
- The chart action core now requires the server-atomic result and no longer
  sequences fulfillment, billing, or audit calls after confirmation. The chart
  client flushes its Draft first, sends one stable idempotency key, disables a
  concurrent double-click, and—after an uncertain network failure—retries the
  exact ETag/selection/key without rewriting the Draft. A changed selection,
  edit, or ETag cannot reuse that pending command.
- A fresh `supabase db reset --local --yes --no-seed` replayed every migration
  through Phase 4. The rolled-back authenticated SQL fixture
  `tests/sql/chart_order_atomic_confirmation_contract.sql` proved selected-only
  confirmation with one unselected Draft, Task `5`, Queue `2`, Billing `4`,
  aggregate Queue `0`, destinationless Queue `0`, command `1`, Task event `5`,
  outbox `3`, whitespace-normalized exact retry, different-request conflict,
  and injected mid-transaction failure with zero partial artifacts.
- TypeScript passed; the combined Phase 1–4 focused suite passed `59/59`; and
  the two targeted browser scenarios passed, including atomic retry with one
  Draft write and two identical confirmation command bodies.

## Phase 5 Evidence

- Added the additive revision/attempt migration
  `20260825242000_chart_order_revision_attempt_contract.sql`. It extends the
  existing Order revision tables with typed change identity, expected revision,
  normalized idempotency key and request hash, before/after values, affected
  Task identities, billing impact, deterministic result, and completion time.
- Added one actor-bound `clair_mutate_chart_order_execution` transaction for
  pending amendment, cancellation, binary-priority change, billing-only
  correction, and linked re-request. SQL repeats active-workspace and
  capability enforcement (`order:update` or `billing:issue`), rejects set-child
  independent mutation, records Order/Task/Revision/Audit history, and emits a
  revision-owned durable outbox event in the same commit boundary.
- Confirmed snapshots cannot be overwritten after their one atomic v1 freeze.
  Completed Task results and terminal attempt state remain protected by the
  Phase 2 history guard. Pending amendment updates only the current effective
  snapshot; billing-only correction updates the candidate without reopening an
  execution attempt.
- Re-request preserves the previous terminal result, starts attempt `N + 1` at
  `pending`, and links it to attempt `N`. Destinationless re-request remains in
  Task history with Queue `0`; set re-request creates one new aggregate attempt
  plus one execution attempt per included child, with aggregate Queue `0`.
- Added the server-owned execution-mutation API, Supabase/mock gateways,
  action-specific payload validation, capability split, and normalized
  idempotent replay. The RPC, rather than a client-side sequence, owns all
  mutation, audit, Queue, Billing, and outbox writes.
- A fresh `supabase db reset --local --yes --no-seed` replayed every migration
  through Phase 5. The rolled-back authenticated SQL fixture
  `tests/sql/chart_order_revision_attempt_contract.sql` proved amendment on the
  same attempt, priority/Queue sync, exact Billing before/after, completed-result
  and confirmed-snapshot immutability, destinationless and set re-request,
  Task/Queue/Billing deduplication, direct revision-write denial,
  cross-workspace rejection, deterministic replay, set-child rejection, and an
  injected cancellation failure with zero partial artifacts.
- The Phase 4 atomic-confirmation fixture still passes after the new immutability
  guard. TypeScript passed, the combined Phase 1–5 focused suite passed `47/47`,
  and the Phase 5 route/core/SQL suite passed `6/6`. Local database lint reported
  no Phase 5 function issue; its listed warnings/errors are pre-existing outside
  this work item.

## Phase 6 Evidence

- Extended the shared `EmrDataTable` with feature-supplied row-state and action
  content while keeping viewport geometry, focus/touch behavior, and selection
  toolbar placement in the common component. The shared row states are
  `normal`, `draft`, `confirmed`, `error`, and `disabled`; the feature remains
  responsible for clinical action meaning and eligibility.
- Added a zero-width sticky row anchor whose gradient overlay remains attached
  to the visible viewport right edge at the start, midpoint, and end of the
  horizontal scroll range. Left-pinned identity columns and the existing
  single scroll owner remain unchanged, and the overlay adds no visible
  `작업` column.
- Added keyboard/focus reveal, popup persistence, coarse-pointer touch trigger,
  Escape recovery, and a fixed contextual selection action bar. The action bar
  derives its center, bottom clamp, and maximum width from the visible
  intersection of the table and browser viewport rather than the full page.
- Queried the running project-scoped Storybook MCP for current instructions and
  the generated `EmrDataTable` documentation. Added dedicated stories for
  viewport-right geometry, selection-bar placement, semantic row gradients,
  and touch fallback without changing the existing story variants.
- All `13` `EmrDataTable` Storybook stories passed interaction and accessibility
  checks. The focused Chromium geometry suite passed `4/4`, covering every
  horizontal scroll position, keyboard focus, selection-bar placement and
  dismissal, distinct semantic state gradients, touch expansion, and Escape
  close. TypeScript, focused ESLint, and the static Storybook production build
  passed; its font-resolution, Lottie `eval`, and chunk-size messages are
  existing build warnings rather than Phase 6 failures.

## Phase 7 Evidence

- Rebuilt the chart Plan/Order surface on the shared `EmrDataTable` as the
  approved eight-type union Field Matrix. Selection, state, classification,
  and Order identity remain pinned at the left; every type-specific field
  shares one horizontal scroll owner, and irrelevant cells render `—` without
  adding `작업` or `목적지` columns.
- Added the canonical eight type tabs, inline type validation, binary urgent
  `Switch`, explicit set-child include/exclude controls, set hierarchy, partial
  top-level confirmation, read-only confirmed snapshots, and auxiliary Sheet
  editing for complex/detail fields.
- Adopted the viewport-right overlay and contextual selection action bar for
  pre-confirm detail/delete/explicit-confirm actions and post-confirm
  detail/history/amend/cancel/priority/billing/re-request actions. Task-aware
  eligibility keeps pending work amendable and enables re-request only for the
  SQL-approved active/terminal task states.
- Draft saving now serializes the latest local rows and ETag, flushes an
  in-flight save before confirmation, and prevents action retry from rewriting
  the Draft. Server Draft rows remain authoritative on cross-device reload;
  set children keep their discriminator and excluded children remain keyboard
  reachable for re-inclusion.
- The Figma-sized `1540 x 968` chart reference was intentionally regenerated
  after waiting for the shared Draft readback, then passed a clean repeat.
  Focused add/set/idempotent confirmation passed `3/3`, and the final chart
  Chromium regression plus density contract passed `59/59`; TypeScript and
  focused ESLint passed.

## Phase 8 Evidence

- Added the actor/session-bound chart execution read API and the
  `clair_get_chart_order_execution_read_model` RPC. It returns workspace and
  encounter scoped Tasks, attempts, Task events, Order revisions, task-linked
  Queue projections, capability-filtered Billing candidates, and deterministic
  reconciliation counters in one validated envelope.
- The chart applies the newest universal Task attempt to visible Order status
  and priority. The Order history Sheet now shows immutable snapshot identity,
  execution/aggregate attempt cards, linked-attempt context, Queue/Billing
  links, revisions, and Task events instead of a placeholder.
- The fulfillment TypeScript gateway now preserves `taskId`, attempt number,
  canonical clinical type, and master destination from the existing Queue RPC.
  Its summary separately reports active non-terminal rows so waiting counts do
  not conflate completed or cancelled projections.
- The reconciliation read model counts confirmed atomic Orders, execution
  Tasks, missing/duplicate Task/Queue/Billing rows, destinationless and
  aggregate Queue leakage, orphan Task/Queue/Billing links, and any artifact
  attached to an unconfirmed Draft. Billing identities are returned only when
  the caller also has `billing:view`.
- A fresh seeded local `supabase db reset --local` replayed the complete
  migration chain through
  `20260825243000_chart_order_downstream_read_models.sql`. The rolled-back
  Phase 5/8 authenticated SQL fixture proved linked attempt/history readback,
  every anomaly count at zero, and cross-workspace denial. The corrected full
  read-model and fulfillment server regression passed `23/23`; the targeted chart
  history/eligibility flow, TypeScript, and focused ESLint passed.

## Phase 9 Evidence

- Reconfirmed production project `qmerxgzrwaaahpkhjqlc`, PostgreSQL `17.6`,
  remote head `20260825135815`, and the unchanged before-state fingerprints:
  Order `b38c5abd7988769afc4315becc3cf00c`, Queue
  `83161728f891d72c4a604789c0fa7166`, and invoice line
  `6c519e36662a63f44616cfb2ce5677de`. The exact preflight was Order `44`,
  Draft `6`, confirmed atomic `38`, durable routed Queue `31`, canonical
  destinationless `7`, linked invoice lines `18`, duplicate invoice/order `0`,
  durable confirmed set parents/children `0`, and actor gaps `0`.
- Added nine canonical additive migrations for the master contract and durable
  route forward-fix, universal Tasks, shared Draft, atomic confirmation,
  revision/attempt history, downstream read model, deterministic backfill, and
  advisor-requested FK indexes. Each uses `lock_timeout = 5s` and
  `statement_timeout = 120s`; no migration contains `DROP TABLE`, `TRUNCATE`,
  broad `DELETE`, name inference, or legacy contract removal.
- Fresh local replay and a separate forward replay from exact version
  `20260825135815` both applied the full chain. Rolled-back SQL fixtures then
  proved shared-Draft zero artifacts, selected/set atomic confirmation,
  transaction rollback, amendment/re-request history, downstream
  reconciliation, durable legacy set backfill, destinationless completion,
  invoice linking, missing-Queue repair, and a second backfill with all write
  counters `0`.
- The first production master attempt rolled back atomically on a pending
  deferred trigger event. No canonical columns or rows remained. The read-model
  `CREATE OR REPLACE` had applied independently but was unreachable by the
  undeployed client. The exact forward-fix added a constraint-event flush, then
  exposed a catalog-link gap in postflight: all historical destinations were
  initially null. Remote work stopped until the durable-Queue-only route fix
  restored routed `31`, destinationless `7`, Queue mismatch `0`, and snapshot
  mismatch `0`, without display-name inference.
- Production remote versions `20260825172441` through `20260825172957` now
  represent the nine canonical files through comment-only history aliases.
  Final migration-history shape is `196 local / 171 remote / 171 common / 0
  remote-only / 25 local-only`; the 25 are the 14 separately pending legacy
  migrations, two earlier behavior-applied canonical files, and these nine
  content-proven canonical files.
- Production backfill created execution Task `38`, Task event `38`, legacy
  confirmation command `38`, Billing candidate `38`, and audit event `38`.
  It linked the existing Queue rows `31`; no aggregate Task was inferred because
  production has no durable confirmed set. Billing reconciled to
  `invoice_linked 14 / candidate_created 24`. Task state reconciled to
  `complete 12 / in_progress 4 / pending 22`, including destinationless
  complete `7`. A production retry returned every insert/update counter `0`.
- Final production invariants are all zero: Draft artifact, missing confirmed
  atomic Task, duplicate Task, duplicate Queue, duplicate Billing, destinationless
  or aggregate Queue exposure, Task orphan, Queue workspace mismatch, Billing
  workspace mismatch, and missing positive Billing candidate. A non-member
  authenticated rollback-only probe read zero Task/Event/Billing rows and the
  read-model RPC rejected with SQLSTATE `42501`.
- Direct authenticated writes remain false for Task, Command, and Outbox.
  Confirmation, mutation, and read-model `SECURITY DEFINER` functions are
  intentionally authenticated and independently bind `auth.uid()`, active
  membership, exact workspace, and capability. Advisor-reported new FK paths
  are all indexed; remaining fulfillment FK INFO items predate this work.

## Phase 10 Evidence

- A final fresh mock-server Chromium run passed the complete chart regression
  and density contract `59/59`. The shared table's viewport-right geometry,
  semantic gradients, focus, bottom-clamped selection bar, touch trigger, and
  Escape recovery passed `4/4` against the project Storybook origin.
- The exact focused server/API/domain/RPC/migration/RLS-negative/downstream
  suite passed `112/112`. It covers shared Draft CAS and cross-device readback,
  all eight type schemas, atomic selection/set confirmation and retry,
  transaction rollback, immutable history, linked attempts, Queue/Billing
  reconciliation, production backfill idempotency, fulfillment projection,
  catalog ownership, and migration-history proof.
- All `13` `EmrDataTable` Storybook stories passed interaction and accessibility
  checks. `npm run build-storybook` completed successfully; the emitted font,
  dependency `eval`, and chunk-size messages are unchanged third-party/build
  warnings rather than test failures.
- `npm run lint`, `npx tsc --noEmit`, `npm run docs:check`,
  `npm run security:secrets`, `git diff --check`, and the Next.js production
  build all exited `0`. The production build includes the new execution read
  and mutation routes.
- `npx supabase db lint --local` exited `0`. Its three reported function errors
  and the non-chart warnings predate this work item; the new confirmation and
  shared-Draft wrappers only report unused local-variable warnings and have
  already passed fresh replay, exact forward replay, SQL fixtures, and remote
  postflight. Applied production migration files and recorded SHA-256 values
  were therefore left immutable.
- The final seeded local reset replayed all `196` local migration files. Four
  rolled-back SQL fixtures passed after that reset: shared Draft, atomic
  confirmation, revision/read-model reconciliation, and deterministic
  production backfill including a zero-write retry.
- A diagnostic all-repository Playwright launch was stopped after `37/1527`
  because its one-worker duration was approximately one hour and it exposed
  three unrelated current app-shell baseline assertions (dispensing default
  selection and a strict command-palette text locator). No unrelated product
  or test contract was changed. The exact chart/order release surface was then
  rerun from a clean mock server with the green results above.

## Phase 11 Evidence

- Committed the scoped implementation in three reviewable commits, pushed
  branch `codex/chart-order-execution-system-20260825`, and opened PR
  `https://github.com/mcso0/emr-app-shell-prototype/pull/617` against `main`.
- The PR records the approved product contract, production migration/backfill,
  RLS boundary, validation results, application-deployment boundary, and the
  rollback/forward-fix path. The latest PR head is verified by the manually
  dispatched GitHub `Release Check`; its exact SHA, run URL, full check state,
  and deployment-ready packet are retained in the mutable PR evidence.
- GitHub reported the PR `MERGEABLE` and `CLEAN`, with no requested review or
  unresolved review comment. GitBook and Vercel Preview checks passed. The
  Ready Preview is SSO-protected: unauthenticated probes of `/` and the chart
  route returned the expected Vercel SSO `302`, so no authenticated Preview
  smoke is claimed.
- No production application deployment, production alias transition,
  user-facing feature activation, post-deploy smoke, or cleanup migration has
  been performed. Because `main` is the unholdable Vercel Production trigger,
  the terminal state is an exact, fully checked, merge-ready PR with merge
  intentionally withheld at the deployment approval boundary.

## Work Classification

- Primary type: `code`.
- Secondary types: `database`, `security`, `qa`, `docs`, and `release`.
- Depth: `L4` because the work changes Supabase schema/RPC/RLS, billing
  integrity, shared UI, and the production release boundary.
- Autonomy: local implementation and verification plus the explicitly approved
  production database migration/backfill and GitHub delivery.
- Ambiguity policy: use current source/remote facts for the baseline without
  changing the approved product contract. Stop only for a target mismatch,
  data-loss risk, contract change, or the production application deployment
  boundary.

## Approved Product Contract

1. Search/selection creates an editable shared candidate, never confirmation.
2. Draft candidates autosave with about 700 ms debounce, flush before movement
   and confirmation, and reject unresolved stale ETags.
3. Selected top-level roots confirm independently; unselected roots remain in
   the draft.
4. An atomic order creates one execution task. A set creates one aggregate task
   and one execution task per included child.
5. `clinical_order_type` is one of `consultation`, `clinical_lab`, `imaging`,
   `external_lab`, `dispensing`, `treatment`, `hospitalization`, or `other`.
6. `destination_module` is optional, master-owned, and not veterinarian-editable.
7. Every confirmed atomic order has a universal task. A destinationless task is
   immediately `complete`; routed execution tasks alone receive queue
   projections. Aggregate tasks never receive queue projections.
8. Task states are `pending`, `in_progress`, `paused`, `partial_complete`,
   `complete`, and `cancelled`. Re-request is an event plus a linked attempt.
9. Priority is binary `normal | urgent`, separate from lifecycle state.
10. Confirmation is one idempotent transaction over snapshot, tasks, queue
    projections, billing candidates, events, audit, remaining draft, and the
    deterministic retry result.
11. Positive chargeable confirmed atomic orders create one billing candidate;
    payment remains billing-owned and aggregate parents never duplicate charges.
12. Confirmed snapshots and completed results are immutable. Amendments,
    cancellations, priority changes, billing-only corrections, and re-requests
    retain actor, reason, before/after values, time, and affected identities.

## Scope

- Extend the order master and confirmed snapshot contract for the eight clinical
  types, canonical external-lab classification, versioned field schema,
  destination, execution mode, and billing defaults.
- Add universal execution/aggregate tasks, attempts, task events, aggregate
  state calculation, constraints, indexes, grants, and workspace RLS.
- Extend shared chart drafts with type-specific `detailInputs`, schema version,
  urgency, set-child inclusion, autosave/flush, and conflict recovery.
- Replace sequential confirmation side effects with an idempotent atomic RPC and
  a durable outbox only for effects that cannot share the transaction.
- Add amendment, cancellation, priority-change, billing-only correction, and
  linked re-request attempt boundaries.
- Add the shared `EmrDataTable` row overlay/selection action-bar geometry and
  adopt it in the chart Order table with the approved Behavior and Field
  matrices.
- Align department queue, task/history, and billing candidate read models.
- Produce and verify an additive, backward-compatible production migration,
  deterministic backfill, reconciliation evidence, and rollback/forward-fix
  packet.
- Synchronize affected canonical docs, this work item, and the deployment-ready
  packet carried by the final pull-request evidence.

## Out Of Scope

- Staging deployment or staging database usage.
- Production application deployment, promotion, or alias change.
- User-facing feature-flag activation.
- Post-deploy browser smoke, monitoring, or contract cleanup.
- Real patient, guardian, staff, payment, or identity data.
- Unrelated schema/code/docs cleanup, permission weakening, destructive reset,
  force push, broad delete, `DROP`, or `TRUNCATE`.

## Phase Status

| Phase | Status | Exit gate |
| --- | --- | --- |
| 0. Baseline and work item | `completed` | Exact source/production/deployment baseline, synthetic fixture, and clean scope recorded |
| 1. Domain and order master | `completed` | Eight-type field-schema fixtures and validation pass |
| 2. Universal task | `completed` | Immediate, routed, aggregate, attempt, constraint, and RLS tests pass |
| 3. Shared draft | `completed` | Cross-device, autosave/flush, ETag, partial-draft, and zero-artifact tests pass |
| 4. Atomic confirmation | `completed` | Idempotency, rollback, task/queue/billing/event transaction tests pass |
| 5. Amend/cancel/re-request | `completed` | Immutable-result and linked-attempt tests pass |
| 6. Shared data table | `completed` | Storybook, geometry, keyboard, focus, and touch tests pass |
| 7. Chart Order table | `completed` | Behavior/Field Matrix and partial-confirm UI tests pass |
| 8. Downstream alignment | `completed` | Cross-surface identity, status, count, and billing reconciliation passes |
| 9. Production migration/backfill | `completed` | Exact SQL/hash, backward compatibility, postflight, and zero anomaly gates pass |
| 10. Verification/reconciliation | `completed` | Required automated, static, security, build, browser, DB, and diff checks pass |
| 11. Git delivery | `completed` | Commit/push/PR/checks and safe merge boundary are fully evidenced |

Only one major phase may be `in_progress` at a time.

## Required Invariants

1. Candidate addition creates zero Task, Queue, notification, and Billing rows.
2. Two clients read the same saved draft.
3. A stale ETag never overwrites a newer draft.
4. Only selected roots confirm; unselected roots remain drafts.
5. A routed atomic order creates Task 1 and Queue 1.
6. A destinationless atomic order creates Task 1 as complete and Queue 0.
7. A set creates aggregate Task 1 and included-child execution Tasks N.
8. Aggregate tasks create Queue 0 and Billing 0.
9. Double-click and identical idempotency retry create no duplicates.
10. Any intermediate confirmation failure rolls back every artifact.
11. A chargeable atomic order creates Billing candidate 1.
12. Re-requesting completed work preserves the original and creates a linked
    pending attempt.
13. Cross-workspace reads and writes fail without side effects.
14. Thirteen to twenty mixed candidates remain continuously editable.
15. Row actions remain visible at the viewport edge for every horizontal scroll
    position.
16. Keyboard and touch users reach the same actions.
17. Migration before/after aggregates are explainable.
18. Production has zero draft-created tasks.
19. Production has zero confirmed atomic orders missing universal tasks.
20. Production has zero unexplained duplicate/orphan/cross-workspace anomalies.

## Production Database Gate

The user explicitly approved the scoped production database migration and
deterministic backfill for synthetic/demo CLAiR data. Before the first remote
write, record:

- exact project reference and evidence that it is the application production
  database;
- source-versus-remote migration history and schema/RPC/RLS fingerprint;
- affected table counts and estimated backfill row counts;
- lock/statement timeout settings;
- exact SQL artifact and SHA-256;
- local fresh-apply and forward-migration results;
- before-state fingerprint and rollback/forward-fix artifact;
- compatibility proof for the currently deployed application.

Stop remote work on an unexpected project, larger-than-reviewed row impact,
lock timeout, snapshot loss, cross-workspace result, duplicate Task/Queue/Billing
row, RLS failure, backward-compatibility failure, or unexplained orphan.

## Application Release Boundary

The repository policy currently treats `main` as the Vercel Production branch.
Phase 0 must verify the live Git/Vercel behavior and whether deployment can be
held without changing the user-facing alias.

- If merge can be held from user-facing production, merge after all checks and
  record the merge SHA.
- If `origin/main` merge automatically creates or promotes a production
  deployment and cannot be safely held, leave the exact candidate PR
  merge-ready and treat merge as the deployment approval boundary.
- Never execute a production deploy, promotion, alias change, or user-facing
  feature-flag activation in this work item.

## Subagent Policy

- Decision: `USE_SUBAGENTS_FOR_EXPLORATION` during Phase 0 and independent
  review after boundary-sensitive implementation.
- Scores: parallelism `5/5`, conflict risk `1/5` for read-only work, noise
  reduction `4/5`.
- Allowed roles: one read-only codebase explorer, one independent security/data
  boundary reviewer, and test triage only after a concrete failure.
- No parallel implementation. The parent owns all architecture choices, edits,
  migration execution, integration, verification, and final reporting.

## Verification

- Focused unit, server, API, RPC, migration, RLS-negative, and integration tests.
- Focused Storybook/interaction, Playwright, accessibility, keyboard, touch, and
  geometry tests for the shared table and chart workflow.
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
- migration fresh-apply, forward-apply, replay, fingerprint, invariant, and
  backward-compatibility checks.
- `git diff --check` and exact changed-file review.
- Manually dispatched GitHub `Release Check` for the exact candidate plus PR and
  Vercel Preview evidence.

## Done When

- The approved product contract is implemented consistently across DB, RPC,
  API, server authorization, RLS, audit, downstream reads, chart UI, tests, and
  docs.
- All required invariants and verification commands pass.
- The scoped production database migration/backfill is applied and postflight
  reconciliation is clean.
- The branch is committed, pushed, reviewed through a PR, and all required
  checks pass.
- The safe merge condition is satisfied, or the exact candidate is left
  merge-ready when merge itself is the unholdable production trigger.
- A deployment-ready packet records the baseline/candidate SHA, commits, PR,
  checks, database project and migration hash, pre/postflight, backfill counts,
  reconciliation, permissions/RLS, feature-flag default, production project and
  alias, deploy/smoke plan, previous deployment, and rollback path.
- Production application deployment, alias transition, feature activation,
  post-deploy smoke/monitoring, and cleanup remain explicitly unperformed.

## Failure Criteria

- Any draft artifact, missing/duplicate task, queue/billing duplication,
  completed-result overwrite, cross-workspace leak, unexplained orphan, or
  backward-compatibility regression.
- Remote mutation before the exact target, SQL hash, impact, rollback, and local
  verification are recorded.
- A production application deployment, promotion, alias change, or feature
  activation occurs inside this work item.
- Unrelated user WIP or unrelated repo/database scope enters the diff.

## Trace Requirements

Record baseline and candidate SHAs; migration paths and hashes; remote project
identity; pre/postflight fingerprints and row counts; task/queue/billing/audit
identities; verification commands and results; PR/check state; merge decision;
deployment trigger evidence; and rollback/forward-fix evidence. Do not record
secret values or real user data.
