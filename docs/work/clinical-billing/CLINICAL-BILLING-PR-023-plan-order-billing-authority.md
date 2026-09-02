---
id: "CLINICAL-BILLING-PR-023"
type: "Work Item"
title: "Plan/Order Billing Authority And Snapshot"
description: "Implements versioned pre-billing overrides, returned-state billing gates, row adjustments, tax policy, and set ownership."
status: "ready"
area: "clinical-billing"
priority: "P0"
tags: [plan-order, billing, tax, adjustments, snapshots]
target_pr: "TBD"
source_docs:
  - "docs/product/domain/plan-order-all-tab-legacy-column-contract.md"
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/work/chart/CHART-PR-031-plan-order-legacy-column-validation.md"
dependencies:
  - "CLINICAL-MASTER-PR-023"
  - "CLINICAL-FULFILLMENT-PR-010"
  - "CLINICAL-BILLING-PR-022"
updated: "2026-09-02"
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

## Handoff Notes

The current `tax_included` field is a misleading compatibility field used as
taxability. Preserve its observed behavior during migration, but expose an
explicit tax class and separate VAT arithmetic policy in the new contract.
