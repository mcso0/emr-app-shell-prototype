---
id: "CLINICAL-BILLING-PR-021"
status: "done"
area: "clinical-billing"
priority: "P0"
target_pr: "#682"
source_docs:
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-020-plan-order-billing-response-latency.md"
  - "docs/engineering/operations/release-environment-policy.md"
  - "docs/engineering/operations/manual-merge-gate-runbook.md"
dependencies:
  - "CLINICAL-BILLING-PR-020"
updated: "2026-08-31"
---

# Plan/Order Region And Server Timing

## Goal

Measure the remaining server-confirmation latency without exposing clinical or
identity data, and align the Vercel Node Functions with the verified Supabase
region before considering any database index.

## Scope

- Add `session`, `permission`, `rpc`, and `total` `Server-Timing` metrics to the
  billing Summary GET and the draft, atomic-confirmation, and execution mutation
  routes.
- Emit one structured timing log per instrumented request containing only the
  allowlisted route key, method, response status, and durations.
- Preserve all existing identity, active-membership, workspace, permission,
  rate-limit, ETag, and mutation contracts.
- Configure the project-level Vercel Function region as `syd1` because the
  inspected shared Supabase project is active in `ap-southeast-2`.
- Inspect the Summary RPC and latest-Task lateral lookup before deciding on an
  index.

## Out Of Scope

- Realtime cross-session invalidation; that belongs to
  `CLINICAL-BILLING-PR-022`.
- New observability vendors, data-fetching libraries, client payload changes,
  billing policy, or permission expansion.
- Database DDL unless a measured DB p95 above 200ms or an explicit query-plan
  scan bottleneck is reproduced.
- Fixed staging alias movement, `main`, or production without a new exact-target
  approval.
- Real patient, guardian, payment, or invoice data.

## Baseline And Index Decision

- On the current `iad1` fixed staging, 30 alternating quantity edits on one
  synthetic order measured client-observed preview median 56ms / p95 207ms and
  edit-to-authoritative median 2,579ms / p95 3,388ms (min 2,018ms, max
  4,869ms). This includes the 700ms continuous-input debounce and browser/UI
  overhead, so it is a user-perceived mutation baseline rather than pure route
  execution time.
- A final synthetic restore completed in 2,221ms. Direct Summary readback then
  confirmed one draft order and 201,000원, matching the UI.
- Thirty warm calls to the internal Summary function on the same synthetic
  encounter measured median 0.691ms and p95 7.635ms.
- The latest-Task lateral lookup on a seeded `clair-demo` encounter with seven
  requestable candidates executed in 5.710ms, used the existing
  `order_tasks_workspace_id_order_id_attempt_no_key` index, and read zero disk
  blocks.
- These results do not meet the plan's DB-index trigger. PR-021 adds no index.
- The exact authenticated 30-request Summary GET route baseline remains a
  fixed-staging gate: current browser isolation permits UI state measurement
  but does not expose session material to command-line benchmarking. It must be
  collected through the deployed timing header after the approved fixed-staging
  transition without weakening auth or inspecting browser storage.

## Done When

- All four routes return ordered, numeric `Server-Timing` values on success and
  expected early denials.
- Headers and structured logs contain no workspace, encounter, actor, order,
  patient, guardian, payment, or invoice identifiers.
- Focused route tests prove auth and permission behavior is unchanged.
- Vercel Preview is Ready from the candidate SHA and its relevant Functions are
  placed in `syd1`.
- Fixed staging, after approval, provides 30 warm authenticated measurements
  for Summary GET and mutation confirmation, including median/p95 and request
  counts.
- Secret scan, docs check, diff check, lint, TypeScript, build, and focused
  Playwright gates pass.

## Verification

- `npx playwright test tests/server-timing.spec.ts tests/chart-order-billing-summary-server.spec.ts tests/chart-order-draft-persistence-server.spec.ts tests/chart-order-action-persistence-server.spec.ts tests/chart-order-revision-attempt-contract.spec.ts --reporter=line`
- `npm run security:secrets`
- `npm run docs:check`
- `git diff --check`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

## Release Policy

- Open the PR against `staging` from the isolated clean worktree and verify the
  Preview placement before requesting a new staging approval.
- Move fixed staging only with an approval packet containing candidate SHA,
  Preview deployment, `syd1` evidence, smoke path, and the previous Ready
  deployment as rollback candidate.
- If post-alignment results regress or do not support the change, revert
  `vercel.json` and restore the previous Ready fixed-staging deployment.
- `main` and production remain blocked until PR-022 is separately completed and
  the final release packet is approved.

## Release Evidence

- GitHub PR `#682` candidate
  `a2a7fea24894aa948557790c4d4cc04be59cb29a` passed Release Check
  `33367555659` and merged to `staging` as
  `15d12733baa66b14d15884d5770938eb3d7bf8f9`.
- Fixed staging alias run `33368035853` passed for Ready deployment
  `dpl_EDK7HMBoo1Re9TSTCp5bpqoi2voQ`; Vercel inspect reports the Next.js
  Lambda build in `syd1`. Previous Ready deployment
  `dpl_CXPRbT2rhYgKQgToa5kcnifbVY2o` remains the rollback candidate.
- Thirty warm authenticated Summary requests measured server total median
  `143.6ms` and p95 `366.4ms`. Thirty warm mutation requests measured server
  total median `237.1ms` and p95 `890.6ms`.
- The same synthetic edit flow measured edit-to-authoritative median `1,629ms`
  and p95 `1,984ms`, improving the prior `iad1` user-perceived baseline by
  about `36.8%` and `41.4%` respectively. This browser measure includes the
  700ms input debounce and automation overhead; it is not a pure route time.
- The mutation window contained one PATCH per save and zero automatic Summary
  GETs. The synthetic quantity was restored to `1`, the footer returned to
  `201,000원`, and the final browser console error count was zero.
- Exact pre-instrumentation authenticated `iad1` Summary-route header data was
  unavailable, so no exact route-to-route percentage claim is made. PR-021 has
  no database migration or index.
- `origin/main` and the production deployment remained unchanged.
