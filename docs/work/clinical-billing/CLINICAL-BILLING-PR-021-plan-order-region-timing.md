---
id: "CLINICAL-BILLING-PR-021"
status: "human_review"
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

- The PR-020 fixed-staging synthetic edit took approximately 2.1–2.8 seconds
  from save start to authoritative amount while its Functions were in `iad1`.
  This is preliminary mutation evidence, not a 30-request HTTP Summary
  benchmark.
- Thirty warm calls to the internal Summary function on the same synthetic
  encounter measured median 0.691ms and p95 7.635ms.
- The latest-Task lateral lookup on a seeded `clair-demo` encounter with seven
  requestable candidates executed in 5.710ms, used the existing
  `order_tasks_workspace_id_order_id_attempt_no_key` index, and read zero disk
  blocks.
- These results do not meet the plan's DB-index trigger. PR-021 adds no index.
- The exact authenticated 30-request HTTP baseline remains a fixed-staging gate:
  current browser isolation permits UI smoke but does not expose session
  material to command-line benchmarking. It must be collected through the
  deployed timing header after the approved fixed-staging transition without
  weakening auth or inspecting browser storage.

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

## Candidate Evidence

- GitHub PR `#682` targets `staging`; initial verified candidate SHA
  `717e0c6b71f7c1f51d558f2252306998983782da` is mergeable and its Vercel check
  passed.
- Preview deployment `dpl_9uBmmV3NiuA2txZVbh3ggGuo7A32` is Ready. Vercel
  inspect reports the Next.js Lambda build in `syd1`.
- No shared database, fixed-staging alias, `staging`, `main`, or production
  mutation was performed for PR-021.
