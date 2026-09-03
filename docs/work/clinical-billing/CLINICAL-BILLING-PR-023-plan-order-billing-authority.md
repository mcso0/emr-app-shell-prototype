---
id: "CLINICAL-BILLING-PR-023"
type: "Work Item"
title: "Plan/Order Billing Authority And Snapshot"
description: "Implements versioned pre-billing overrides, returned-state billing gates, row adjustments, tax policy, and set ownership."
status: "completed"
area: "clinical-billing"
priority: "P0"
tags: [plan-order, billing, tax, adjustments, snapshots]
target_pr: "GitHub PR #698"
source_docs:
  - "docs/product/domain/plan-order-all-tab-legacy-column-contract.md"
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/work/chart/CHART-PR-031-plan-order-legacy-column-validation.md"
dependencies:
  - "CLINICAL-MASTER-PR-023"
  - "CLINICAL-FULFILLMENT-PR-010"
  - "CLINICAL-BILLING-PR-022"
updated: "2026-09-03"
---

# Plan/Order Billing Authority And Snapshot

## Goal

Keep clinical confirmation immutable while supporting audited billing-only
overrides until encounter-scoped `Order 청구`, then freeze an idempotent invoice
handoff that blocks returned/cancelled work and prevents set/attempt duplication.

## Scope

- Persist versioned billing name, reflection, derived/manual quantity,
  amount-or-percent adjustment source, derived counterpart, and reason.
- Copy confirmation-frozen unit price, price basis, billing unit, tax class, and
  set owner/amount strategy into the candidate/invoice snapshot without a
  post-confirmation refresh path.
- Keep unadjusted base total and final charge amount distinct; implement whole
  KRW half-away-from-zero rounding and non-negative final validation.
- Add workspace VAT arithmetic policy and hospital adjustment-reason config;
  retain built-in `기타` with required detail.
- Keep `Order 청구` encounter-scoped and link every currently eligible row once.
- Block returned/cancelled work, invalid configuration, contradictory set
  ownership, duplicate candidate, and post-lock silent mutation.
- Preserve order-row adjustment in the invoice line and later checkout/session
  adjustment as a separate audited layer.
- Put candidate or invoice-linked unfinished work on billing-review hold when it
  is returned. Preserve linked/paid history and require the authorized
  correction, reversal, or refund record before checkout or changed clinical
  reconfirmation proceeds.
- Enforce direct RPC permissions and trusted server-side arithmetic.

## Out Of Scope

- Clinical dose or practical preparation policy values.
- Work assignment/phase implementation.
- Final chart table layout.

## Done When

- Confirmation snapshot, pre-billing revision, candidate snapshot, invoice-line
  snapshot, and checkout adjustment have distinct owners and history.
- No unit-price, price-basis, tax-class, or set-pricing update can bypass chart
  correction, a new order revision, and reconfirmation.
- Returned/cancelled and unconfirmed rows cannot be billed; unfinished allowed
  states require the existing explicit acknowledgement.
- Parent- or child-owned set billing is exclusive and idempotent.
- Cross-workspace, stale ETag/revision, replay, direct-RPC, and negative-amount
  cases are denied by server and DB tests.

## Verification

- Focused server/API/domain tests and SQL transaction tests.
- Invoice candidate/line and checkout regression.
- TypeScript, focused lint, docs check, secret scan, and diff check.
- Exact remote rollback rehearsal before persistent migration or billing smoke.

## Implementation Checkpoint — 2026-09-03

- Versioned pre-billing overrides, adjustment derivation, immutable billing
  snapshots, returned-work review hold, invoice reversal, and checkout/payment
  fail-closed mappings are implemented locally.
- Permission, CAS, replay/idempotency, immutable-history, and negative billing
  cases passed the focused TypeScript/Playwright suite and transactional local
  SQL smoke.
- No remote invoice, payment, or billing-policy data mutation has been
  executed. PR #698's exact staging migration and billing smoke
  passed inside one rolled-back transaction with no schema, fixture, or
  migration-history residue.
- 승욱 approved and Supabase applied persistent schema/RPC migration
  `20260903003949_plan_order_work_lifecycle_and_rpc_boundary`. Post-apply
  readback verified validated constraints, RLS, and authenticated-only execute
  grants for the target billing RPCs.
- PR #698 merged as `f86ff1c31c6c288b5ba9697e5ad3902bd17f48ee`;
  production deployment `dpl_BekLknn1zHvZexMs2eniy4aSz5fG` is `Ready`.
  Authenticated production smoke rendered the billing columns and `Order 청구`
  boundary without raw identifier/enum leakage or browser errors.

## Handoff Notes

The current `tax_included` field is a misleading compatibility field used as
taxability. Preserve its observed behavior during migration, but expose an
explicit tax class and separate VAT arithmetic policy in the new contract.
