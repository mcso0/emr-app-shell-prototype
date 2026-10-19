---
id: "ENGINEERING-PERF-PR-001"
status: "implemented"
area: "engineering"
priority: "P0"
target_pr: "User request / performance and remote database follow-up"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/reception/RECEPTION-PERF-PR-001-read-polling-and-snapshot.md"
  - "docs/work/notifications/NOTIFICATION-PR-024-db-backed-route-adoption.md"
dependencies:
  - "RECEPTION-PERF-PR-001"
  - "NOTIFICATION-PR-024"
updated: "2026-10-20"
---

# Notification Batch And Remote Verification

## Goal

Finish the remaining performance follow-up with deployed evidence: remove known
duplicate notification reads and per-item writes, classify remote database
advisor findings, and verify the released version against Supabase and Vercel.

## Scope

- Load active and archived notifications through one startup API request.
- Replace notification read-all per-item persistence with one set-based RPC.
- Replace fulfillment snapshot per-item enrichment updates with one batch RPC.
- Re-measure the shared reception staff read and aggregate route traffic.
- Triage relevant Supabase performance and security advisor findings.
- Capture Vercel production route and runtime-error evidence before and after release.
- Apply additive migrations to the connected remote Supabase project and validate
  only aggregate statistics, catalogs, and synthetic/demo-safe behavior.

## Out Of Scope

- Broad creation or deletion of indexes based only on advisor counts.
- Unrelated RLS or function-grant cleanup.
- Cross-request authorization caching, Realtime adoption, or server scaling.
- Reading or mutating real patient, guardian, payment, or identity records.
- Changing existing notification, fulfillment, or reception user-facing behavior.

## Done When

- App-shell notification startup uses one request while preserving active and
  archived notification state.
- Notification read-all performs one database mutation RPC regardless of item count.
- Fulfillment snapshot enrichment performs one database mutation RPC regardless of
  work-item count.
- Focused tests, type-check, lint, build, docs, and secrets checks pass.
- Additive migrations are applied and verified on the connected remote database.
- Remote advisor output is classified into fix-now, monitor, and separate-scope work.
- The candidate is merged to `production/main`, deployed, and the production SHA,
  route health, runtime errors, and remote database behavior are recorded.

## Verification

- `npx playwright test tests/notification-persistence-contract.spec.ts tests/notification-live-api-server.spec.ts tests/fulfillment-work-item-server.spec.ts tests/reception-read-performance.spec.ts tests/reception-queue-read-server.spec.ts --reporter=line`: 55 passed.
- Focused startup/batch red-green regression set: five failed before implementation and five passed after implementation.
- `npm run lint`: passed.
- `npx tsc --noEmit --pretty false`: passed.
- `npm run build`: passed with the pre-existing docs-viewer NFT trace warning.
- `npm run docs:check`: passed.
- `npm run security:secrets`: passed.
- `git diff --check`: passed.

## Remote Supabase Result

- The connected project is healthy and the production Vercel environment uses
  this same remote Supabase project.
- The previously local-only notification persistence foundation was absent.
  It was applied additively before the batch migrations.
- Notification event/state tables and both batch RPCs now exist remotely.
- Anonymous execution is denied and authenticated execution is present for the
  two new RPCs.
- An authenticated zero-write notification probe passed. An authenticated
  fulfillment snapshot probe passed inside an explicit rollback transaction.
- The advisor baseline was 175 performance notices and 140 security notices.
  After the new tables/functions it reports 182 performance notices and 142
  security notices. The increase is explainable by empty new-table foreign-key,
  unused-index, and overlapping-policy notices; no broad index mutation is
  justified while both notification tables contain zero rows.
- Targeted search-path hardening reduced mutable-search-path warnings from 11
  before this work to 10 after it, and anonymous SECURITY DEFINER exposure from
  five to two. Authenticated SECURITY DEFINER notices for the new RPCs are
  intentional because route handlers call them with the user's Supabase session
  and the functions enforce actor and workspace membership internally.
- Fulfillment has 30 live work-item rows. Its established workspace/encounter,
  workspace/queue/status, and workspace/order indexes already show use; the
  advisor's broad foreign-key suggestions are monitor-only until query evidence
  identifies a real delete/join cost.

## Production Baseline And Remaining Release Gate

- The current deployed staff route produced 15 HTTP 200 requests in the latest
  ten-minute sample on deployment `dpl_DbiheieewRR2D8Y7FYZ8hDSszU3o`.
- The latest 24-hour Vercel sample showed repeated notification HTTP 500 responses
  before the missing remote notification migration was applied.
- Vercel's MCP runtime-log endpoint still returns HTTP 403. Read-only Vercel CLI
  logs for the same linked project now provide route/status evidence instead.
- Commit, PR, exact production approval, merge, deployment, and post-deploy
  notification/staff/database deltas remain pending.


## Frontend idle refresh follow-up — 2026-09-30

승욱 approved the small frontend fixes after a read-only Supabase-request caller
investigation, then authorized release preparation and deployment once tests pass.
The exact-candidate Production approval gate still applies. This follow-up does
not authorize DB/RLS, billing/settings/data changes, bounded notification RPC
redesign, or multi-tab leader election.

- Reception staff polling runs only while visible, with focus/visibility-return
  revalidation. The existing 30-second successful-read freshness check and
  same-scope in-flight sharing remain in place. Hidden initial mounts wait for
  visible return; the visible 60-second interval is unchanged.
- Notification startup/focus/visibility/30-second polling shares only a pending
  snapshot read within the current effect's actor/workspace scope. Mutation reload
  keys still abort/invalidate the old snapshot and start a post-mutation read.
  Unmount/scope changes remove listeners/timers and abort the old request.
- Chart startup/focus/visibility reads share a pending read and retain the unsaved
  draft/save guards. Mutation and private Realtime invalidations still invoke the
  authoritative reader separately; its existing sequence rejects stale results.
- Presence channel failure, timeout and close stop the activity timer. Subscribe
  success tracks Presence and immediately touches activity, then restarts one
  60-second timer. Disposed callbacks cannot restart it. Presence is not paused
  merely because a tab is hidden, and DB actor/membership checks remain unchanged.

Local fake-timer/mock verification uses
`npx vitest run --config vitest.frontend-refresh.config.ts` without a web server,
authenticated session, env files or hosted Supabase. Existing Presence,
notification persistence and chart private Realtime contract tests run with a
server-free Playwright config. Full local release checks and exact Preview/CI
results are recorded in the PR approval packet; Production is pending that gate.

Expected savings: hidden reception staff interval calls stop (nominally 60 calls
per hidden tab-hour), overlapping automatic reads collapse to one pending request,
and disconnected Presence no longer keeps issuing activity RPCs. Real byte/egress
savings, client attribution and deployed runtime behavior remain unmeasured.

## Shared Read Refresh — 2026-10-20

### Outcome And Authority

승욱 authorized the ordered UI, release-policy, and request-reduction work, with
advance approval for each bounded PR to proceed through review, checks, Ready
Preview, protected main merge, and Production verification. The parent performs
review; GPT-6.1 Sol workers implement the scoped changes. This section records
that direct approval and does not grant authority by itself.

Preserve existing functionality and visible freshness while eliminating duplicate
same-scope profile/billing reads and paired focus/visibility refreshes. Keep this
candidate separate from notification sharing across browser windows.

### Scope And Boundaries

- Share personal-profile reads across same-actor consumers; retain the four-minute
  visible refresh and revalidate on visible return.
- Share billing-assignment reads for the same actor, workspace, role, and invoice;
  retain the visible ten-second refresh and authoritative post-mutation reads.
- Coalesce paired focus/visibility resume events without suppressing mutation
  invalidations. Dispose unused resources and reject stale, aborted, or previous
  actor/workspace results.
- Add only the feature-local live-auth subscription necessary to identify billing
  resource scope; do not redesign global auth hydration or permission policy.
- No DB/RLS/migration, provider, payment, real-data mutation, paid resource, polling
  interval increase, or unrelated refactor. Notification cadence remains 30 seconds.

### Verification And Completion

Use synthetic fixtures and deterministic request counts. Verify multiple
consumers, hidden/resume behavior, paired events, ref-count disposal, auth/logout,
workspace/invoice changes, failed reads, repeated edits, mutation invalidation,
and late responses. Retain server authorization and mutation revision contracts.
Run focused frontend/server regression checks, lint, type checks, build, docs,
secret scan, and diff validation. Record measured request reduction separately
from unmeasured production CPU savings. Release requires current candidate CI,
Ready Preview, scoped synthetic smoke and rollback evidence. Automatic Preview
activation remains a separate usage/data-conditioned operation.

Implementation and verification are in progress in the isolated
`codex/shared-read-refresh` branch. Prior unrelated delivery history and
outstanding database findings above remain unchanged.

### Shared Read Verification Evidence

- Parent-integrated frontend refresh suite: 56 tests passed across six files.
- Existing billing assignment server/UI and provisional-invoice browser specs:
  three passed on the isolated loopback mock server. The cold development-server
  run timed out/had incomplete page startup; the warmed rerun passed all three
  with a 90-second test budget. No hosted data or provider was used.
- Actual baseline (`9002e19b`) and changed hook code ran under the same synthetic
  effect/timer harness with three consumers: profile eight visible minutes
  **9 -> 3 GETs**; profile startup then eight hidden minutes **9 -> 1**;
  billing thirty visible seconds **12 -> 4**; billing startup then thirty hidden
  seconds **3 -> 1**. These are request counts, not measured CPU savings.
- Focused regressions cover forced post-PATCH reads, consecutive completions,
  failed PATCH/read retry, later Realtime invalidation, disposed auth callbacks,
  actor changes/logout before React cleanup, and same-user login epochs.
- Parent review corrected pending-invalidation reuse and confirmed scoped billing
  mirror cleanup cannot clear a newer resource's publication.
- Full lint, nonincremental TypeScript, Node 22 production build, docs (1,073),
  secret scan (4,920), and diff checks passed. Build retains the existing
  docs-viewer dynamic-filesystem trace warning. Remote delivery remains pending.

## Notification Window Sharing — 2026-10-20

### Approved Outcome And Candidate Boundary

승욱 authorized request reduction while preserving existing functionality and the
30-second notification cadence, with parent review and GPT-6.1 Sol implementation.
Advance bounded delivery approval covers this separate candidate after checks,
Ready Preview, review, protected merge, scoped smoke and rollback evidence.
No paid service, DB/RLS/migration, real-data mutation, provider effect, or global
auth/permission redesign is included. The prior frontend follow-up's exclusion of
multi-window sharing describes that historical candidate, not this new authority.

### Implementation Contract

Use server-verified actor/login-session/workspace scope. Each window performs its
own authorized initial read before joining an in-memory group. Supported browsers
may share steady visible polling through BroadcastChannel and Web Locks. Unsupported
or failing coordination falls back to the existing per-window refresh. Initial,
focus/resume, explicit retry, and post-mutation reads remain available directly.
Hidden/disposed leaders release ownership; stalled leaders cannot indefinitely
suppress a visible follower's independent refresh.

Never persist notification payloads or credentials for coordination. Preserve
server authorization, bounded rows, global counts, mutation permissions, and
per-window toast/sound/preferences behavior. Leader changes must not reset toast
history. Different users, workspaces, or login generations must not accept each
other's payloads. Logout, denied access, delayed reads and pre-mutation responses
must not restore protected or stale state. Sharing changes requests, not alert
ownership or the existing delivery policy.

### Verification And Done Criteria

Use synthetic fixtures with no hosted DB writes. Verify two visible windows,
unsupported APIs, leader hide/close/stall, scope changes, logout/relogin, 401/403,
concurrent mutation invalidation, failed/repeated edits, stale replies, and retained
per-window delivery semantics. Include actual same-origin browser coordination and
live-mode caller evidence; mock auth alone cannot prove the sharing branch.
Record request counts without claiming unmeasured Production CPU savings. Complete
focused checks and standard local/remote release gates before delivery.

Implementation is in progress in isolated `codex/notification-poll-sharing`.
The earlier profile/billing shared-read candidate must be integrated before final
verification; overlapping documentation history must be preserved during merge.

### Notification window sharing verification — 2026-10-20

- Integrated the profile/billing shared-read candidate before verification. Focused Vitest configuration passed 72 tests across 8 files.
- `npx playwright test --config playwright.notification-sharing.config.ts` passed all 11 browser tests using the actual hook and toast delivery component, native BroadcastChannel/Web Locks, a loopback-only fixture, and synthetic API interception. The fixture blocks external requests and does not load service environment files.
- During the real 62-second two-window cadence test, each window performed its own initial GET; only two subsequent periodic GETs occurred in total. The 30-second cadence remains unchanged.
- Browser checks covered read/archive/restore/read-all synchronization, concurrent mutations, stale GET and POST completion, ordinary/silent mutation failures, 403 fencing and own retry, login/workspace separation, unavailable sharing APIs, missing server scope, and login-generation toast reset.
- Scope hashing tests cover stable identical inputs and isolation by actor, workspace, and login session; a missing session disables sharing. A changed-scope response cannot publish into the previous channel.
- Frozen-lock and stopped-message/timer behavior was verified at the coordinator protocol boundary with synthetic clocks and transport. An actual browser process freeze was not executed.
- Server/API/DB permission enforcement, notification semantics, and per-window toast ownership remain in place. No database, provider, real-data mutation, or paid service change is part of this candidate.
- Remote required CI, current-head Preview, ordered merge, and Production smoke are separate release evidence and remain pending at this local verification checkpoint.

- Parent integrated preflight passed: full ESLint, non-incremental TypeScript, and Production build (25 pages). The existing `src/lib/prd-viewer/doc-reader.ts:78` dynamic filesystem tracing warning remains unrelated. Documentation references passed for 1,073 Markdown files, secret scan for 4,930 tracked files, and `git diff --check` passed.
