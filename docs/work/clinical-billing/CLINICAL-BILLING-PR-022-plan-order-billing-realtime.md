---
id: "CLINICAL-BILLING-PR-022"
status: "human_review"
area: "clinical-billing"
priority: "P0"
target_pr: "#683"
source_docs:
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-020-plan-order-billing-response-latency.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-021-plan-order-region-timing.md"
  - "docs/product/domain/workspace-auth-permissions.md"
dependencies:
  - "CLINICAL-BILLING-PR-021"
updated: "2026-08-31"
---

# Plan/Order Billing Summary Realtime Invalidation

## Goal

Refresh the authoritative encounter billing Summary in another active browser
session without a manual reload or focus transition, while keeping clinical,
identity, order, payment, and amount data out of Realtime payloads.

## Scope

- Add one private topic per workspace and encounter:
  `workspace:{workspaceId}:encounter:{encounterId}:billing-summary`.
- Broadcast `billing_summary_changed` with only workspace ID, encounter ID,
  optional Summary ETag, transaction ID, occurrence time, and payload version.
- Allow receive access only to authenticated active workspace members who have
  `chart:view`; do not create a client-send policy.
- Emit one ETag-bearing event from each authorized chart mutation wrapper and
  ETag-free invalidations from invoice, invoice-line, payment, and invoice-
  adjustment changes that affect an encounter.
- Subscribe with the existing browser Supabase client, merge events for 300ms,
  ignore current ETags and duplicate transaction IDs, and refetch the
  authoritative Summary once.
- Defer invalidations during a local unsaved edit or mutation. If the mutation
  response adopts the same ETag, clear its pending event without a GET;
  otherwise refetch once after the client becomes safe.
- Preserve the existing focus and visibility Summary revalidation as the
  reconnect and subscription-failure fallback.

## Out Of Scope

- Realtime payloads containing amounts, order names, patient, guardian,
  payment, invoice, or clinical detail.
- Client broadcast/insert permission, public channels, new objects inside the
  locked `realtime` schema, or a new data-fetching dependency.
- Billing calculation, price policy, ETag, permission, RLS, or mutation request
  contract changes.
- Remote migration application, fixed staging movement, `main`, or production
  without a separate exact-target approval.
- Real patient, guardian, payment, invoice, or hospital data.

## Done When

- Migration apply/reapply creates only the allowed `realtime.messages` SELECT
  policy plus private helper functions and public-table triggers, and rollback
  leaves no PR-022 policy, function, trigger, or base-wrapper residue.
- Authenticated members with `chart:view` can receive the private invalidation;
  missing permission, inactive membership, and another workspace cannot.
- Chart mutation wrappers retain actor, membership, action permission,
  `chart:view`, public RPC signatures, base-function revocation, and current
  Summary response behavior while emitting one event per wrapper call.
- Client tests cover exact scope and payload validation, duplicate
  transactions, current ETag, event storms, unsafe edits, in-flight refresh,
  and unmount cleanup.
- Focused regression, SQL contract, secrets, docs, diff, lint, TypeScript, and
  build gates pass, followed by an independent security-boundary review.
- After an approved remote migration and fixed-staging release, two
  authenticated synthetic browser sessions show cross-session refresh without
  reload or focus change, with p95 at or below 1.5 seconds.

## Verification

- `scripts/test-chart-order-billing-summary-realtime-migration.sh`
- `npx playwright test tests/chart-order-billing-summary-realtime.spec.ts tests/chart-order-mutation-billing-summary-contract.spec.ts tests/chart-order-billing-summary-freshness.spec.ts --reporter=line`
- `npm run security:secrets`
- `npm run docs:check`
- `git diff --check`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

## Release Policy

- Implement and verify from the clean `origin/staging` worktree while
  preserving the dirty primary checkout.
- Open the PR against `staging` and verify its Preview before any shared DB
  change.
- Apply the exact migration SHA to the inspected synthetic/demo Supabase target
  only after an approval packet names the target, candidate SHA, migration,
  validation, stop condition, and rollback.
- Keep `main` and production unchanged until remote permission, two-session,
  reconnect, and regression checks pass and a final release packet is approved.

## Current Evidence

- Local migration apply/reapply, private payload, active membership plus
  `chart:view` SELECT policy, four financial triggers, wrapper ACLs, authorized
  receive, missing-permission, inactive-member, cross-workspace denial, and
  rollback-zero-residue contract passed.
- Focused client tests passed for payload scope, event coalescing, duplicate
  transaction handling, current-ETag suppression, unsafe-edit deferral,
  in-flight follow-up, teardown, and focus/visibility fallback preservation.
- Focused Playwright regression passed `72/72`; secret, docs, diff, full lint,
  TypeScript, and production build gates passed. The build retained the known
  docs-viewer Turbopack NFT warning but compiled successfully.
- Independent security-boundary review returned `APPROVE / MUST-FIX 0` for the
  exact migration and client snapshot.
- No remote migration, shared database, staging, `main`, or production change
  is claimed for PR-022.
