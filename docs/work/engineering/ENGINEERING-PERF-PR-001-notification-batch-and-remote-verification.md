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
updated: "2026-07-19"
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
