---
id: "CLINICAL-BILLING-PR-025"
type: "Work Item"
title: "Fixed-Price Set Parent Billing Authority"
description: "Lets a parent-billed order set pass the billing request by deriving its billing authority from the set order's applied price snapshot."
status: "in_progress"
area: "clinical-billing"
priority: "P1"
tags: [plan-order, billing, order-set, snapshots]
target_pr: "TBD"
source_docs:
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-023-plan-order-billing-authority.md"
  - "docs/engineering/operations/release-environment-policy.md"
dependencies:
  - "CLINICAL-BILLING-PR-023"
updated: "2026-11-28"
---

# Fixed-Price Set Parent Billing Authority

## Goal

An order set that is billed as one parent line (fixed price or range price) reaches an invoice through the normal billing request.

## Background

Found on 2026-11-28 while preparing Cheongdam demo data. Ordering the fixed-price set `요검사 패널` created one parent billing candidate (`billedAs: set_parent`, amount = set price), but `clair_request_selected_chart_order_billing` raised `billing_authority_incomplete`.

`private.clair_snapshot_order_billing_authority` fills the candidate's price basis, billing unit, tax class and set owner from the candidate `source_snapshot` (the order's confirmed snapshot). A set parent keeps those facts in `orders.applied_price_snapshot` (`amountBasis`, `taxType`, `billedAs`), and a set definition has no plan-order authority field. All four columns stayed null. Every lab panel in the synthetic Cheongdam workspace is a fixed-price set, so lab panels could not be billed. Individual orders were unaffected.

## Scope

- Re-create `private.clair_snapshot_order_billing_authority` with one extra, lowest-priority source: the applied price snapshot of a `set` order billed as `set_parent` with amount basis `set_fixed_price` or `range_price`.
  - price basis `fixed_set`, billing unit `set`, set owner `parent`
  - amount strategy `fixed_set` or `range_price`
  - tax class only when the set tax type is `taxable` or `non_taxable`
- Static migration spec and a rolled-back SQL contract.

## Out Of Scope

- Rewriting existing candidates. Their snapshots are immutable; affected open candidates must be re-confirmed.
- Sets billed through their members (`included_order_sum`).
- Sets whose tax type is `derived`. They keep a null tax class and stay blocked.
- Billing UI changes.

## Done Criteria

- A fixed-price set parent candidate is created with `fixed_set` / `set` / `parent` and the set's tax class.
- The billing request, issue and payment complete with one invoice line for the set at the set price.
- An individual order's candidate is unchanged by the fallback.

## Verification

- `npx tsc --noEmit`, `npm run lint`, `npm run docs:check`
- `npx playwright test tests/set-parent-billing-authority-migration.spec.ts`
- `tests/sql/set-parent-billing-authority.sql` on a database with the Cheongdam synthetic workspace and this migration applied. Passed on the hosted demo database on 2026-11-28.

## Notes

- 2026-11-28 hosted verification without persistence: the function body was replaced inside one transaction on the hosted demo database, a visit with one individual consultation order and the set `요검사 패널` was driven through the app RPCs to payment, and the transaction was force-rolled back. Result: set candidate `fixed_set` / `set` / `taxable` / `parent` / `fixed_set` at 33,000; consultation candidate unchanged (`per_order` / `session`, no set owner); invoice `paid` with two lines (요검사 패널 33,000, 재진 16,500); encounter `completed`. Readback after rollback confirmed the hosted function is unchanged.
- The local Supabase replay cannot run the contract end to end: it stops on remote-anchored clinical-master migrations, so the master order catalog is missing. Locally the migration compiles and the contract parses and runs until the first catalog lookup.
- Observation, not changed here: invoice lines showed `tax_type: taxable` for the consultation line although its candidate tax class was `non_taxable`; the invoice tax total was 0.
- 2026-11-28 remote apply, approved by 승욱 ("승인"): applied to the hosted demo project through the Supabase MCP `apply_migration` from PR #1136 head `10cfd563`. Remote history recorded version `20261128123347`; the migration file was renamed to that version so local and remote history match. The automatic Release Check was still pending at apply time.
  - Post-apply check: `tests/sql/set-parent-billing-authority.sql` ran on the hosted database and ended with `SET_PARENT_BILLING_CONTRACT_ROLLBACK passed` (invoice `paid`, total 49,500, set price 33,000, encounter `completed`). Nothing was saved. Function ACL stays `postgres` only.
  - Rollback: re-create the function from `20260912113946_dispensing_set_confirmation_compatibility.sql`.
- Merge and Production deployment still need 승욱's approval. The change is database-only, so the app deployment does not alter this behavior.
