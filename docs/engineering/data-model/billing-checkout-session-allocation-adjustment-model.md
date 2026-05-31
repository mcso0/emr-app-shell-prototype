---
id: ENGINEERING-DATA-MODEL-BILLING-CHECKOUT-SESSION-ALLOCATION-ADJUSTMENT
status: review
area: engineering
doc_type: data-model-proposal
related_work:
  - DEN-365
  - DEN-358
  - DEN-366
last_updated: 2026-05-31
---

# Billing Checkout Session, Allocation, And Adjustment Model

This proposal defines the approval-gated DB/RPC shape for guardian-centered
combined billing checkout. It does not authorize a migration, remote Supabase
push, RLS replay, payment-provider integration, or real data operation.

## Decision Summary

The current `invoices`, `invoice_lines`, and `payments` tables are sufficient
for the local-first MVP UI because each invoice can be issued, marked unpaid, or
paid independently.

They are not sufficient for product-grade combined checkout because the billing
screen now allows staff to select several waiting/unpaid invoices across one
guardian's patients and present one final amount. That requires a durable
checkout object, explicit allocation records, and auditable adjustments.

Recommended path:

- Keep the current tables for MVP and regression work.
- Do not change live schema until 승욱 approves the migration target and timing.
- When approved, add a checkout-session layer that references existing invoices
  instead of replacing them.

## Current Fit

| Current table/RPC | Fits today | Gap for combined checkout |
| --- | --- | --- |
| `invoices` | Stores encounter/patient-scoped billing status, amount snapshot, selected method, `payment_state`, and `unpaid_reason`. | One invoice cannot represent one guardian checkout spanning several patients/invoices without losing per-invoice traceability. |
| `invoice_lines` | Stores item-level charge lines with order/service references and generated line totals. | Discount/surcharge reason is not auditable as a separate business event. Combined checkout needs line/session-level adjustment history. |
| `payments` | Stores synthetic local-first payment records per invoice. | A single card/cash payment cannot be allocated across multiple invoices without duplicating or guessing payment intent. |
| `clair_save_billing_payment_status` | Persists `select_payment_method`, `mark_unpaid`, and `complete_payment` for one invoice. | It cannot atomically complete a guardian checkout with several invoice allocations. |
| `patient_guardians` / `guardians` | Determines owned patients and co-guardian context. | There is no immutable checkout payer snapshot, so later guardian/contact edits can make historical receipts ambiguous. |

## Proposed Tables

### `billing_checkout_sessions`

One staff-controlled checkout attempt for a payer/guardian.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | Server-generated. |
| `workspace_id` | text fk | Workspace boundary. |
| `guardian_id` | uuid fk nullable | Current guardian reference. |
| `payer_snapshot` | jsonb | Immutable payer name/contact/co-guardian context at checkout time. |
| `status` | text | `draft`, `prepared`, `payment_pending`, `paid`, `unpaid`, `voided`, `expired`. |
| `subtotal_amount` | numeric(12,2) | Sum before adjustments/tax. |
| `discount_amount` | numeric(12,2) | Session-level discount total. |
| `surcharge_amount` | numeric(12,2) | Session-level surcharge total. |
| `tax_amount` | numeric(12,2) | Tax total. |
| `total_amount` | numeric(12,2) | Final payable amount. |
| `selected_payment_method` | text nullable | `card`, `cash`, `transfer`, `other`. |
| `unpaid_reason` | text nullable | Required when `status = 'unpaid'`. |
| `payment_memo` | text nullable | Staff memo. |
| `created_by_user_id` | uuid fk nullable | Actor. |
| `prepared_at` | timestamptz nullable | Amount snapshot time. |
| `completed_at` | timestamptz nullable | Paid/unpaid terminal time. |
| `created_at` / `updated_at` | timestamptz | Standard timestamps. |

Recommended checks:

- `total_amount >= 0`
- `discount_amount >= 0`
- `surcharge_amount >= 0`
- `status <> 'unpaid' or unpaid_reason is not null`
- `status not in ('paid', 'unpaid', 'voided', 'expired') or completed_at is not null`

### `billing_checkout_session_invoices`

Join table preserving the selected invoice set and per-invoice amount snapshot.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `workspace_id` | text fk | |
| `checkout_session_id` | uuid fk | |
| `invoice_id` | uuid fk | Existing invoice. |
| `encounter_id` | uuid fk | Snapshot convenience and integrity check. |
| `patient_id` | uuid fk nullable | Snapshot convenience. |
| `guardian_id` | uuid fk nullable | Snapshot convenience. |
| `invoice_status_snapshot` | text | Status at selection/preparation. |
| `subtotal_amount` | numeric(12,2) | Invoice subtotal snapshot. |
| `discount_amount` | numeric(12,2) | Invoice adjustment total. |
| `surcharge_amount` | numeric(12,2) | Invoice surcharge total. |
| `tax_amount` | numeric(12,2) | Invoice tax snapshot. |
| `allocated_amount` | numeric(12,2) | Payment portion assigned to this invoice. |
| `created_at` | timestamptz | |

Recommended uniqueness:

- unique `(workspace_id, checkout_session_id, invoice_id)`

### `invoice_adjustments`

Auditable discount/surcharge records.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `workspace_id` | text fk | |
| `checkout_session_id` | uuid fk nullable | Session-level adjustment. |
| `invoice_id` | uuid fk nullable | Invoice-level adjustment. |
| `invoice_line_id` | uuid fk nullable | Line-level adjustment. |
| `adjustment_type` | text | `discount`, `surcharge`, `manual_price_override`, `tax_override`. |
| `amount` | numeric(12,2) | Non-negative amount. |
| `reason` | text | Required. |
| `memo` | text nullable | Optional detail. |
| `created_by_user_id` | uuid fk nullable | Actor. |
| `created_at` | timestamptz | |

Recommended checks:

- exactly one or more valid scopes depending on policy: session, invoice, or line
- `amount >= 0`
- `length(trim(reason)) > 0`

### `payment_allocations`

Allocates one payment record across selected invoices.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `workspace_id` | text fk | |
| `checkout_session_id` | uuid fk | |
| `payment_id` | uuid fk | Existing `payments` row or future provider payment row. |
| `invoice_id` | uuid fk | Invoice receiving the allocated amount. |
| `amount` | numeric(12,2) | Allocation amount. |
| `created_at` | timestamptz | |

Recommended checks:

- unique `(workspace_id, payment_id, invoice_id)`
- allocation total by payment equals `payments.amount`
- allocation total by checkout equals checkout paid amount

## Proposed RPCs

### `clair_prepare_billing_checkout_session`

Input:

- `workspaceId`
- selected `invoiceIds`
- optional payment method
- adjustment payloads with required reason
- payment memo

Responsibilities:

- verify active workspace membership and billing mutation permission
- verify invoices belong to the workspace and payer/guardian scope
- reject terminal or voided invoices
- recalculate amounts from authoritative `invoice_lines`
- create/update a `prepared` checkout session
- persist immutable payer/invoice amount snapshots

### `clair_apply_invoice_adjustment`

Input:

- checkout session id
- invoice id or invoice line id
- adjustment type
- amount
- reason/memo

Responsibilities:

- require reason
- recalculate invoice/session totals
- record an immutable adjustment event
- keep the checkout session non-terminal

### `clair_complete_billing_checkout_payment`

Input:

- checkout session id
- payment method
- confirmed final amount
- provider payload placeholder or synthetic local-first marker

Responsibilities:

- re-read prepared session and selected invoices in one transaction
- reject stale amount mismatch
- create a payment record
- create `payment_allocations`
- mark all included invoices paid with consistent timestamps
- optionally complete the encounter only when all encounter billing is paid

### `clair_mark_billing_checkout_unpaid`

Input:

- checkout session id
- required unpaid reason
- optional follow-up date/memo

Responsibilities:

- require non-empty reason
- mark session `unpaid`
- mark included invoices `payment_state = 'unpaid'`
- preserve selected invoice and amount snapshots for follow-up work

## Transaction Boundary

Combined checkout completion should be one DB transaction when the migration is
approved. The transaction must cover:

1. amount recalculation / stale check
2. session status transition
3. payment row creation
4. payment allocations
5. invoice status/payment state updates
6. audit event emission

The current local-first implementation may continue to save one invoice at a
time until this migration is approved.

## State Mapping

| User action | Checkout session | Invoice | Payment/allocation |
| --- | --- | --- | --- |
| Staff selects rows | `draft` | unchanged | none |
| Staff clicks `수납 진행` | `prepared` or `payment_pending` | `issued`, `payment_state = none` | none |
| Payment succeeds | `paid` | `paid`, `payment_state = paid` | payment + allocations |
| Staff defers payment | `unpaid` | `issued`, `payment_state = unpaid` | none or failed provider marker |
| Staff voids stale session | `voided` | unchanged or restored by policy | allocations cancelled if any |

## Approval Gate

Before implementation, 승욱 must explicitly approve:

- target environment: local migration only, staging, or production
- migration filename and included tables/checks
- RPC names and transaction behavior
- RLS policy scope and replay plan
- whether this replaces or coexists with `clair_save_billing_payment_status`

Without that approval, agents must not create/apply a migration, push to remote
Supabase, run remote RLS replay, or import real data.

## Verification Plan After Approval

1. Static migration lint: SQL syntax, idempotent `if not exists`, constraints,
   indexes, grants, and comments.
2. Local Supabase migration replay with synthetic fixtures only.
3. RLS replay:
   - same-workspace billing staff can prepare/complete checkout
   - cross-workspace user cannot read or mutate sessions/allocations
   - missing unpaid reason is rejected
4. Server specs:
   - prepare combined checkout across two invoices
   - stale amount mismatch rejection
   - paid allocation sum equals payment amount
   - unpaid reason required
   - void/expired session cannot be paid
5. Focused Playwright:
   - guardian ledger selects multiple patient invoices
   - right panel final amount matches grouped workspace amount
   - `수납 진행`, `수납 완료`, and `미납 처리` remain distinct
6. Fixed staging synthetic replay after local approval and staging deploy
   approval.

## Open Product Decisions

- Whether partial payment is in MVP scope or explicitly post-MVP.
- Whether one checkout session may include co-guardian invoices from different
  primary guardians.
- Whether `수납 진행` should always create a durable session or only when
  multiple invoices/adjustments are present.
- Whether receipts should be session-level, invoice-level, or both when real
  receipt integration is approved.
