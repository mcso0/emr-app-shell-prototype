---
id: DESIGN-FLOW-GUARDIAN-CENTERED-BILLING-CHECKOUT
status: approved
area: design
doc_type: flow-contract
related_work:
  - DEN-358
  - DEN-349
  - DEN-348
  - DEN-341
supersedes: []
superseded_by: []
last_updated: 2026-09-29
---

# Guardian-Centered Billing Checkout Flow

This document is the implementation contract for the billing workspace UX after
the 2026-05-31 guardian-centered billing review. It is the source that DEN-359
through DEN-368 should follow for terminology, flow, and screen structure.

Detailed rationale is preserved in
[Guardian-centered Billing Checkout UX/DB Proposal](../../completed/product/2026-05-31-billing-guardian-centered-checkout-ux-db-proposal-report.html).

## Core Decision

Chart `Order 청구` already means the selected billable orders have been
intentionally requested for payment. The billing workspace must treat those
orders as `수납대기` / payable candidates, not as items waiting for a second
user-facing `청구 확정` step.

Therefore:

- Primary billing CTA: `수납 진행` or `결제 진행`.
- Payment completion CTA/state: `수납 완료`.
- Deferred/overdue action: `미납 처리`, always with a reason.
- User-facing `청구 확정` is not a required primary step.
- A server-side `issued` or amount snapshot transition may still happen behind
  `수납 진행` when the implementation needs an immutable checkout amount.

## Terminology Contract

| Term | User meaning | Data meaning | UI rule |
| --- | --- | --- | --- |
| `Order 청구` | Vet sends selected chart orders to billing. | Create/refresh server-owned billing candidates from order snapshots; preserve work status. | Chart confirmation modal may warn about unfinished orders, then routes/links to billing. |
| `수납대기` | A normal payment-ready queue item. | Candidate-backed invoice/order exists and has not been paid or explicitly deferred. | Show in the primary billing queue, not as overdue. |
| `수납 후보` | A row created from chart/order billing request. | Candidate-backed draft invoice line or equivalent candidate row. | Badge the row so staff can distinguish it from paid/closed history. |
| `수납 진행` / `결제 진행` | Staff presents final amount and starts checkout/payment. | Server recalculates amount and may create an internal issued/checkout snapshot. | Primary CTA in the payment summary. |
| `수납 완료` | Payment succeeded in the current approved scope. | Payment state becomes `paid`; synthetic provider scope remains clearly bounded. | Use amount/payment-state preflight and persistent success/error feedback. |
| `미납 처리` | Payment is deferred, declined, failed after amount presentation, or overdue. | Payment state becomes `unpaid` with actor, reason, and follow-up visibility. | Secondary/overflow action; require reason before commit. |
| `완료` | Payment is settled or the billing item is closed. | Invoice/payment is paid, voided, refunded, or otherwise terminal depending on scope. | Keep separate from active `수납대기` and `미납`. |

## Flow Contract

1. Vet selects one or more chart orders and clicks `Order 청구`.
2. If selected orders include unfinished/re-requested work, the chart modal asks
   `아직 완료되지 않은 오더가 있습니다. 수납을 진행할까요?` and shows order names
   with current work-state badges.
3. Confirming `Order 청구` creates/refreshes billing candidates and keeps order,
   task, and fulfillment status unchanged.
4. The billing workspace opens or refreshes around the guardian context.
5. The billing staff selects one or more `수납대기` / `미납` ledger rows for the
   guardian, including multiple patients when needed.
6. The center workspace shows the selected checkout set grouped by patient,
   encounter, and invoice.
7. The staff can add approved non-clinical sale items, apply discount/surcharge,
   choose payment method, and enter required memo/reason fields.
8. `수납 진행` starts checkout/payment against the final recalculated amount.
9. `수납 완료` records paid state. `미납 처리` records deferred/overdue state with
   reason.

## Screen Structure Contract

### Top Bar: Guardian Context

Replace the patient/vitals header in billing with a guardian-centered context
bar.

Required information:

- guardian name
- masked phone/contact
- primary/co-guardian relationship chip when available
- owned patient chips
- current `수납대기` count/amount
- existing `미납` count/amount
- recent payment date
- neutral billing caution/memo summary, such as `결제 주의`, `미납 주의`, or
  `수납 메모`

Do not show animal vitals, breed, age, or sex as primary billing header fields.

### Left Queue: Billing Work Queue

Use `수납대기`, `미납`, and `완료` as the primary queue groups.

The selected operating date scopes live queue discovery. Waiting/unpaid invoices
carry forward from their billing request date; terminal invoices appear on that
request date. Date changes clear invoice/encounter/order selection. While the
new scope is pending and no current detail is selected, show the same centered
`md` loading surface as chart. A successful empty response alone shows no work;
permission denial and failed reads show their own states.

Queue discovery reads minimal card fields through a `billing:view` RPC. It must
not create candidates or prepare checkout. Selecting an invoice starts the
existing detail flow; invoice and encounter context must match before display.
The 2026-09-29 implementation and rolled-back synthetic SQL proof are local:
[DEN-455 follow-up](../../work/demo-data/DEN-455-billing-ux-loading-failure-retry-payment-state-clarity.md#approved-follow-up--2026-09-29).
Remote migration application and deployment remain pending.

Queue row should show:

- guardian name
- patient chips
- invoice/order count
- current due or unpaid amount
- latest request/update time
- explicit badges such as `수납대기`, `재요청 포함`, `일부미납`, `수납완료`

Do not rely on color alone to communicate state.

### Guardian Ledger Sidebar

The secondary content/sidebar should show billing history for the guardian
across owned patients.

Required controls:

- date ranges: `1주`, `2주`, `1달`, `3달`, `6개월`, custom range
- status filters: `수납대기`, `미납`, `완료`
- default focus: `수납대기 + 미납`
- optional `타 보호자 청구서 포함` toggle only when co-guardian relationship
  context exists
- selectable rows so staff can choose multiple pending/unpaid items for checkout

### Center Workspace: Selected Checkout Items

The center area is a checkout item workspace, not a generic invoice editor.

Group selected rows by patient, encounter, and invoice. Show group totals and
overall checkout total.

Each line should show:

- item name
- source: `차트 청구` or `수납 추가`
- order work-state badge when sourced from chart orders
- quantity
- unit price
- discount/surcharge
- subtotal
- `수납 후보` badge for candidate-backed rows

Add-on sale items are allowed only for non-clinical or approved sale items in
MVP UI scope. Clinical prescription or approval-required items need a separate
future flow.

### Right Panel: Payment Summary

The right panel should make the next action obvious.

Required hierarchy:

1. final payment amount
2. primary CTA: `수납 진행` / `결제 진행`
3. payment method and installment/simple-pay placeholders
4. discount/surcharge summary and required reason
5. payment memo
6. collapsible amount breakdown
7. secondary/overflow `미납 처리` action with reason dialog

Avoid placing `미납` beside `수납` as two equal primary buttons.

## Figma Carry/Replace Checklist

Carry forward:

- date-based billing queue concept
- pending/unpaid/completed grouping
- guardian-level history and unpaid shortcut concept
- combined billing concept for multiple owned patients
- grouped invoice/item totals
- right-side payment summary concept

Replace or clarify:

- `대기/미납/종료` labels -> `수납대기/미납/완료`
- patient-style header -> guardian context bar
- color-only state hints -> explicit status badges
- always-visible primary `미납` button -> secondary `미납 처리` with reason
- central invoice editor -> selected checkout workspace
- long payment summary scroll -> final amount and CTA-first hierarchy
- user-facing `청구 확정` primary step -> `수납 진행` / `결제 진행`

## Approval Gates

The following remain outside DEN-358 and require explicit approval before
execution:

- remote Supabase migration push
- remote RLS replay
- production deploy
- real data import
- real payment provider integration
- settlement, refund, accounting, or receipt-provider integration
- DB/RPC migration for combined checkout sessions, payment allocations, or
  invoice adjustments

## Follow-Up Issue Mapping

| Issue | Uses this contract for |
| --- | --- |
| DEN-359 | Component boundaries and implementation plan |
| DEN-360 | Guardian context bar |
| DEN-361 | `수납대기` / `미납` / `완료` queue |
| DEN-362 | Guardian ledger selection |
| DEN-363 | Selected checkout workspace |
| DEN-364 | Payment summary CTA and unpaid reason UX |
| DEN-365 | Combined checkout/payment allocation/adjustment DB design |
| DEN-366 | Local-first checkout and unpaid state semantics |
| DEN-367 | Regression coverage |
| DEN-368 | Fixed staging replay |

## Related Docs

- [Order Fulfillment Handoff](../../product/domain/order-fulfillment-handoff.md)
- [Outpatient Workflow State Model](../../product/domain/outpatient-workflow-state-model.md)
- [Billing Checkout Session, Allocation, And Adjustment Model](../../engineering/data-model/billing-checkout-session-allocation-adjustment-model.md)
- [Order Fulfillment Handoff Engineering Contract](../../engineering/data-model/order-fulfillment-handoff-contract.md)
- [CTA Risk Taxonomy](../system/cta-risk-taxonomy.md)
