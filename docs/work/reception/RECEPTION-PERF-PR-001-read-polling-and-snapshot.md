---
id: "RECEPTION-PERF-PR-001"
status: "implemented"
area: "reception"
priority: "P0"
target_pr: "User request / remote staging performance audit"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/reception/RECEPTION-LIVE-PR-009-reception-queue-read.md"
  - "docs/work/reception/RECEPTION-LIVE-PR-010-reception-day-calendar-read.md"
dependencies:
  - "RECEPTION-LIVE-PR-009"
  - "RECEPTION-LIVE-PR-010"
updated: "2026-07-19"
---

# Reception Read Polling And Snapshot

## Goal

Reduce idle reception database traffic without changing reception permissions,
workspace scope, persisted read semantics, or demo fallback behavior.

## Scope

- Add one server-owned reception snapshot route for queue and day-calendar reads.
- Load the workspace permission adapter once per snapshot request.
- Run the independent queue and calendar reads concurrently.
- Replace the live 9-second interval with a 60-second visibility-aware fallback.
- Deduplicate overlapping refreshes for the same workspace and operating date.
- Keep the existing queue and calendar routes for compatibility and focused callers.

## Out Of Scope

- RLS, schema, index, or remote migration changes.
- Realtime publication or subscription changes.
- Fulfillment transition optimization.
- Notification persistence rollout.
- Cross-request permission caching.

## Done When

- A live reception refresh uses one snapshot HTTP request instead of two reads.
- The snapshot route loads the DB permission adapter once.
- Queue and calendar reads start concurrently.
- Hidden browser tabs do not run fallback refreshes.
- Same-key refresh calls reuse the in-flight request.
- Existing queue, calendar, permission, and reception regression checks pass.

## Verification

- `npx playwright test tests/db-workspace-permission-adapter.spec.ts tests/reception-read-performance.spec.ts --reporter=line`: 11 passed
- `npx playwright test tests/reception-queue-read-server.spec.ts tests/reception-calendar-read-server.spec.ts --reporter=line`: 20 passed
- `npx tsc --noEmit`: passed
- focused ESLint on changed source and tests: passed
- `npm run build`: passed with one pre-existing docs viewer NFT trace warning
- `npm run docs:check`: passed
- `npm run security:secrets`: passed
- `npx playwright test tests/reception.spec.ts -g "reception route date|reception topbar refresh" --reporter=line`: 4 pre-existing accessibility-label expectation failures; rendered current label differs from stale test label and this change did not touch that UI copy

## Result

Implemented locally. Supabase-authenticated reception reads now use one snapshot
route, the fallback polling interval is visibility-aware and reduced to 60 seconds,
same-key refreshes share one in-flight promise, and the four permission reads that
follow membership lookup start concurrently. Existing mock-mode queue/calendar
routes remain compatible. The implementation was later released through
`origin/main`; the read-only remote audit below records the post-release traffic
snapshot. A controlled authenticated-session check completed the remaining
post-release acceptance gap on 2026-07-19.

Representative report:
`docs/completed/reception/2026-07-18-reception-read-polling-performance-report.html`

## Remote MCP Audit — 2026-07-19

The production deployment now points at `origin/main` and includes the snapshot
implementation. A read-only Supabase MCP audit covered `pg_stat_statements`,
table/index statistics, performance advisors, and the latest API log sample. No
schema, RLS, index, statistics reset, or remote data mutation was performed.

- The 10-minute passive delta recorded 127 queue RPC calls and 127 calendar RPC
  calls. Membership reads increased by 322; policy, permission-role assignment,
  and job-position assignment reads each increased by 288.
- Queue and calendar execution remained fast at approximately 2.8 ms and 2.6 ms
  weighted mean. Membership and permission-policy reads remained approximately
  1.0 ms and 1.3 ms. The delta added zero shared-block reads for all six groups.
- The latest 100 API log entries were all HTTP 200. They covered 48 seconds and
  included seven queue/calendar pairs, while permission-adapter tables appeared
  14–16 times. Remote traffic therefore still contains more than one permission
  load per queue/calendar pair, from compatibility routes, staff reads, older
  browser bundles, or a mix of these callers.
- Live Supabase client reads use explicit column lists. No database `.select()`
  wildcard or omitted-column select was found in `src/` or `supabase/`.
- No hot row-driven read N+1 was found. Bounded fallback/state-transition loops
  remain intentional. Notification mark-all and fulfillment snapshot enrichment
  still perform per-item writes and are batch-RPC candidates before data volume
  grows.
- The performance advisor reported 139 unindexed foreign keys, 21 unused
  indexes, six auth RLS initialization-plan warnings, and nine multiple
  permissive-policy warnings. Current hot reception reads already use indexes,
  tables remain small, and buffer-hit execution is fast, so broad index creation
  or index deletion is not justified by this snapshot alone.

## Controlled Post-release Acceptance — 2026-07-19

One authenticated prepared-clinic reception tab was freshly reloaded to the
current production bundle. The manual `접수/예약 새로고침` action was then compared
with an equal no-action interval three times against the same remote
`pg_stat_statements` counters.

- All three no-action intervals added zero calls across queue, calendar,
  membership, permission-policy, permission-role assignment, and job-position
  assignment reads.
- Two isolated action intervals added exactly one call to each of the six query
  groups. The third interval included concurrent traffic and added three
  queue/calendar calls, five permission-related calls, and six membership calls.
- The three-run median was therefore one queue RPC, one calendar RPC, one
  membership read, and one read for each permission adapter per manual refresh.
- The page remained on the prepared-clinic reception route and the refresh
  control returned to its enabled state after every action. The latest API log
  sample remained HTTP 200.

This closes the controlled reception-refresh acceptance gap: the current client
does not reproduce the passive sample's elevated permission ratio. That ratio
comes from concurrent callers such as staff reads, compatibility routes, or
older open clients and should be investigated as a separate route-attribution
task only if aggregate traffic remains material. The Chrome connection did not
expose a request waterfall, so the live proof is the matched browser action and
database delta; the single snapshot HTTP contract remains covered by the
deployed source and focused tests.

## Route Attribution — 2026-07-19

The elevated aggregate permission ratio is attributable to multiple legitimate
Next.js API callers rather than an N+1 inside the reception snapshot. A fresh
179-second Supabase API sample contained 13 permission-adapter groups, four
queue RPCs, five calendar RPCs, and four staff operational-status/profile read
groups. All sampled requests returned HTTP 200.

| Caller | Trigger | Permission/read cost | Attribution |
|---|---|---|---|
| Reception snapshot | mount, visible 60-second interval, focus/visibility, manual refresh | one permission adapter plus queue and calendar RPCs | recurring reception read |
| Reception staff list | content mount, visible 60-second interval, focus; side-panel mount/date change | one permission adapter plus staff membership, user, profile, and operational-status reads | recurring staff read plus one duplicate initial owner |
| Notification snapshot | app-shell mount/reload | two parallel notification API requests, each loading its own permission adapter | startup-only duplicate authorization preparation |
| Workspace tabs | shell initialization and persisted tab changes | GET/PUT requests each load a permission adapter | startup/navigation overhead |
| Reception drawer staff list | only while a reception drawer is mounted | another staff-list request and 60-second/focus refresh | conditional drawer overhead |

The passive long-window ratio is therefore expected to settle near two
permission loads per queue snapshot while the reception content independently
polls both the snapshot and staff list every 60 seconds. Startup notification and
workspace-tab requests, the independently mounted reception side panel, focus
events, and conditional drawers explain the remaining ratio above two. The
manual refresh button itself still loads only the reception snapshot once.

Recommended implementation order if the aggregate traffic becomes material:

1. Give reception one shared staff-read owner so content, side panel, and open
   drawer reuse the same workspace/date result. This removes the confirmed
   duplicate initial staff request without changing permissions or freshness.
2. Consider a single notification snapshot response that includes active and
   archived items, so app-shell initialization prepares authorization once.
3. Only after measuring those changes, evaluate whether reception snapshot and
   staff refresh should share one server request. That is a larger response and
   state-ownership change and is not justified by current 1–3 ms database
   execution times alone.

Vercel runtime request-path aggregation was attempted as a secondary source but
the current MCP connection returned `403 Forbidden`. No deployment, environment,
database, RLS, index, or remote data change was made during attribution.

## Shared Reception Staff Resource — 2026-07-19

Implemented the first route-attribution follow-up without changing the staff API,
server permission resolver, RLS, database schema, or visible reception design.

- Added a workspace-and-operating-date keyed reception staff resource store.
- `ReceptionContent` is now the only owner of the staff API request, 60-second
  refresh interval, and window-focus refresh listener.
- `ReceptionSidePanel` and `ReceptionDrawer` subscribe to the shared result and
  no longer issue their own staff requests or install their own refresh timers.
- Same-key in-flight requests are reused. A successful result is treated as
  fresh for 30 seconds on focus, preventing an immediate duplicate request while
  preserving the existing 60-second refresh. Failed reads remain retryable and
  are not marked fresh.
- Workspace/date keys preserve clinic and operating-date separation. The server
  still performs the existing session, membership, workspace, and
  `reception:view` authorization for the single request.

Focused verification:

- The new browser regression failed before implementation with six observed
  staff requests and passed after implementation with exactly one request while
  content, side panel, and a reception drawer were mounted. It also verified the
  same veterinarian in the calendar lane and drawer selector.
- `npx playwright test tests/reception-read-performance.spec.ts --reporter=line`:
  5 passed.
- `npx tsc --noEmit --pretty false`: passed.
- Focused ESLint for the changed reception source, store, and performance test:
  passed.
- `npm run build`: passed with the pre-existing docs viewer NFT trace warning.
- `npm run docs:check` and `npm run security:secrets`: passed.
- Five broader existing reception UI tests were attempted but remain blocked by
  pre-existing fixtures that omit `operatingSchedule`; `origin/main` already
  dereferences `operatingSchedule.date` and the tests crash before completing.
  One of those tests also retains a pre-existing hover-color expectation drift.
  This change does not touch operating-schedule handling or lane styling.
