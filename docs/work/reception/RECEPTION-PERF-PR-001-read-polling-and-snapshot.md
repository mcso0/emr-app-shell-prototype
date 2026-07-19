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
updated: "2026-07-18"
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
routes remain compatible. Remote staging deployment and post-deploy query-stat
verification remain separate release work.

Representative report:
`docs/completed/reception/2026-07-18-reception-read-polling-performance-report.html`
