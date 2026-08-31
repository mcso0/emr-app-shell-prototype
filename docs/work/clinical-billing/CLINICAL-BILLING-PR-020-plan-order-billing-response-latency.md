---
id: "CLINICAL-BILLING-PR-020"
status: "done"
area: "clinical-billing"
priority: "P0"
target_pr: "#681"
source_docs:
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-018-plan-order-billing-summary-freshness.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-019-plan-order-billing-summary-integrity.md"
  - "docs/engineering/data-model/order-fulfillment-handoff-contract.md"
dependencies:
  - "CLINICAL-BILLING-PR-019"
updated: "2026-08-31"
---

# Plan/Order Billing Response Latency

## Goal

Remove the mutation-to-Summary GET waterfall so an order edit shows an immediate
local estimate and then adopts the authoritative amount from the same successful
mutation response, without weakening billing, workspace, or permission
boundaries.

## Scope

- Extend the existing draft, atomic confirmation, and execution mutation RPC
  responses with the current encounter `billingSummary` while preserving public
  RPC names and request signatures.
- Keep the renamed mutation bodies private to their authenticated wrappers and
  retain actor, active-membership, action-specific permission checks, and the
  `chart:view` capability required to read the returned Summary.
- Recompute the current Summary after an idempotent base replay rather than
  returning a stored historical Summary.
- Apply one workspace/encounter-scoped authoritative Summary path on the client
  that invalidates earlier GET sequences and updates Summary, ETag, freshness,
  and error state together.
- Replace the normal post-mutation Summary GET with the mutation response.
  Preserve GET recovery for initial load, safe focus/visibility revalidation,
  conflicts, lost-response readback, and explicit retry.
- Show an immediate draft-only amount delta over the last server Summary while
  preserving its discounts, surcharges, tax, payment, invoice, and outstanding
  values.
- Keep fixed/range set-parent and included-order-sum reflection rules aligned
  with the server-owned Summary.
- Save discrete add/delete/set/priority changes after 150ms, continuous input
  after 700ms, and clear an add-delete net-zero change before any request.
- Block `Order 청구` for preview, invalid, failed, conflict, stale, or
  non-authoritative states.

## Out Of Scope

- Remote migration application, fixed staging movement, `main`, or production
  deployment without a separate exact-target approval.
- Server timing, Vercel region placement, or fixed-staging performance
  measurement; those belong to `CLINICAL-BILLING-PR-021`.
- Cross-session Realtime invalidation; that belongs to
  `CLINICAL-BILLING-PR-022`.
- New data-fetching libraries, observability vendors, price policy, invoice
  policy, or permission expansion.
- Real patient, guardian, payment, or invoice data.

## Done When

- Each successful mutation response contains a Summary identical to an
  immediate authorized direct read for the same workspace and encounter.
- Idempotent confirmation and execution replay creates no duplicate write and
  returns the current Summary.
- A normal draft, confirmation, or execution mutation performs one mutation
  request and no trailing Summary GET.
- The next render after a valid edit shows `오더 예상 총액` and
  `예상 · 저장 중`; success switches to `청구 예상 총액`.
- Invalid input and failed/conflicted saves retain the previous server amount,
  show the required `금액 미반영` state, and disable billing.
- Older delayed GET responses cannot overwrite a newer mutation Summary.
- Local SQL apply/reapply, ACL, response equality, idempotent replay, and
  rollback-zero-residue checks pass with synthetic data.
- A custom role that has only the mutation capability but lacks `chart:view`
  is rejected before the database gateway runs.
- Focused Playwright, TypeScript, lint, build, docs, diff, and secret gates pass,
  followed by an independent security-boundary review.

## Verification

- `scripts/test-chart-order-mutation-billing-summary-migration.sh`
- `scripts/test-chart-order-mutation-billing-summary-responses.sh`
- `npx playwright test tests/chart-order-mutation-billing-summary-contract.spec.ts tests/chart-order-billing-summary-freshness.spec.ts tests/chart-order-draft-persistence-server.spec.ts tests/chart-order-action-persistence-server.spec.ts tests/chart-order-revision-attempt-contract.spec.ts tests/chart-order-shared-draft-contract.spec.ts --reporter=line`
- `npm run security:secrets`
- `npm run docs:check`
- `git diff --check`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

## Review And Release Policy

- Implement and verify only in the clean worktree created from the inspected
  `origin/main` SHA; preserve the dirty primary checkout.
- Run an independent security-boundary review after the exact migration and
  local SQL evidence are stable.
- A pull request may provide a Preview candidate, but remote DB migration,
  fixed staging, `main`, and production remain blocked until the exact source
  SHA, target, migration, smoke path, and rollback candidate receive approval.

## Release Evidence

- GitHub PR `#681` merged to `staging` as
  `e230d2db56283e913da32c2c737cf7df48db214e`; Release Check run
  `33363968392` passed.
- Approved migration
  `20260831053359_chart_order_mutation_billing_summary.sql` was applied to the
  inspected `ap-southeast-2` shared staging project. Remote wrapper/base ACL,
  synthetic atomic-confirmation and revision replay, and rollback residue
  checks passed.
- Fixed staging alias run `33364502104` passed for Vercel deployment
  `dpl_CXPRbT2rhYgKQgToa5kcnifbVY2o` built from the same merge SHA.
- Authenticated synthetic smoke showed the estimate in 64ms on the measured
  restore edit, changed the authoritative amount from 201,000원 to 402,000원,
  and restored it to 201,000원. The two normal saves produced two mutation
  PATCH requests and zero trailing Summary GET requests.
- The `main`/`staging` reconciliation candidate removed blur-triggered writes
  from continuous fields, kept table column instances stable while draft rows
  change, disabled confirmation during a revision conflict, and skips the
  redundant draft PATCH when autosave already persisted the selected rows.
  Focused chart integration passed `9/9`; billing, Realtime, Server-Timing, and
  SOAP contracts passed `55/55`; PR-020, PR-022, and SOAP migration
  apply/reapply/permission/rollback contracts passed against local Supabase.
- `origin/main` and the production deployment remained unchanged. Region and
  request-stage performance work continues in `CLINICAL-BILLING-PR-021`.
