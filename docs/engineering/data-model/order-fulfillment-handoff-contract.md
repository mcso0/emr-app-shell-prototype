---
id: ENGINEERING-DATA-MODEL-ORDER-FULFILLMENT-HANDOFF-CONTRACT
type: Data Contract
title: "Order Fulfillment Handoff Engineering Contract"
description: "Defines the engineering contract for chart-confirmed order handoff into fulfillment queues, lifecycle sync, and billing candidates."
status: approved
area: engineering
doc_type: data-contract
tags: [data-model, fulfillment, orders, billing, lifecycle]
related_work:
  - DEN-235
  - DEN-236
  - DEN-237
  - DEN-238
  - DEN-239
  - DEN-240
  - DEN-241
  - DEN-242
  - DEN-335
  - DEN-340
  - DEN-349
supersedes: []
superseded_by: []
last_updated: 2026-05-31
---

# Order Fulfillment Handoff Engineering Contract

This document defines the engineering contract for Project 08, `Clinical Order Fulfillment Handoff Persistence`. It bridges existing chart/order/billing persistence with downstream lab, imaging, dispensing, and treatment queue persistence.

`DEN-235` defined the contract. `DEN-236` adds the initial local-first route/core/gateway and migration contract. `DEN-237` connects chart order confirmation to fulfillment sync. `DEN-238` connects lab and imaging screens to fulfillment queue read/status mutation. `DEN-239` connects dispensing and treatment screens to fulfillment queue read/status mutation. `DEN-240` syncs fulfillment status changes back to order lifecycle and billing candidates. `DEN-241` adds end-to-end replay coverage. `DEN-242` closes out the project and records staging readiness boundaries. Remote staging migration remains gated by dry-run and explicit approval.

## Current Inventory

| Area | Existing route or source | Current boundary |
| --- | --- | --- |
| Chart order drafts | `GET/PATCH /api/workspaces/[workspaceId]/chart/order-drafts` | server route, mock fallback, Supabase RPC contract |
| Chart order actions | `GET/PATCH /api/workspaces/[workspaceId]/chart/order-actions` | confirm/billing-candidate action route, mock fallback, Supabase RPC contract |
| Chart order lifecycle | `GET/PATCH /api/workspaces/[workspaceId]/chart/order-lifecycle` | selected order lifecycle route, mock fallback, Supabase RPC contract |
| Billing candidates | `GET/PATCH /api/workspaces/[workspaceId]/billing/invoice-candidates` | selected order to billing candidate sync |
| Billing invoice lines | `GET/PATCH /api/workspaces/[workspaceId]/billing/invoice-lines` | line edit and billing confirmation |
| Billing payment status | `GET/PATCH /api/workspaces/[workspaceId]/billing/payment-status` | synthetic payment/unpaid state |
| Lab/imaging screens | `src/features/lab-imaging/module.tsx` | DEN-238 reads fulfillment work item status context and sends status mutation from existing actions |
| Dispensing/treatment screen | `src/features/dispensing/module.tsx` | DEN-239 reads fulfillment work item status context and sends status mutation from existing actions |
| Shared fulfillment work items | `src/app/api/workspaces/[workspaceId]/fulfillment/work-items/**` | DEN-236 server route/core/gateway foundation, adopted by lab/imaging and dispensing/treatment screens |
| Chart-to-fulfillment sync | `PATCH /api/workspaces/[workspaceId]/chart/order-actions` | DEN-237 confirm action calls fulfillment sync after successful order confirmation |
| Lab/imaging queue adoption | `src/features/lab-imaging/module.tsx` | DEN-238 reads fulfillment work item status context and sends status mutation from existing actions |
| Dispensing/treatment queue adoption | `src/features/dispensing/module.tsx` | DEN-239 reads fulfillment work item status context and sends status mutation from existing actions |
| Fulfillment-to-lifecycle/billing sync | `src/features/fulfillment/server-fulfillment-work-item-core.ts` | DEN-240 syncs fulfillment status changes to order lifecycle and completed billable work to billing candidates |

## Target Route Shape

Project 08 should introduce a shared fulfillment boundary before screen-specific adoption.

| Route | Purpose |
| --- | --- |
| `GET /api/workspaces/[workspaceId]/fulfillment/work-items` | List fulfillment work items by queue, status, assignee, encounter, or order. |
| `POST /api/workspaces/[workspaceId]/fulfillment/work-items/sync-from-orders` | Idempotently create or refresh work items for confirmed orders. |
| `PATCH /api/workspaces/[workspaceId]/fulfillment/work-items/[workItemId]` | Mutate fulfillment status and assignment. |

Route naming can change during `DEN-236` if implementation finds a better local convention, but the behavior should remain equivalent.

## Proposed Work Item Shape

| Field | Requirement |
| --- | --- |
| `id` | stable work item id |
| `workspaceId` | required tenant boundary |
| `encounterId` | required outpatient workflow context |
| `orderId` | required source order |
| `orderType` | `lab`, `imaging`, `dispensing`, or `treatment` |
| `queueType` | screen destination: `lab`, `imaging`, `dispensing`, `treatment` |
| `status` | `requested`, `accepted`, `in_progress`, `completed`, `cancelled`, `returned` |
| `priority` | copied or derived from order priority |
| `requestedByUserId` | source vet/user |
| `assignedToUserId` | nullable current assignee |
| `dueAt` | nullable operational due timestamp |
| `completedAt` | nullable completion timestamp |
| `cancelledAt` | nullable cancellation timestamp |
| `returnedAt` | nullable returned timestamp |
| `reason` | nullable cancellation/return reason |
| `sourceSnapshot` | safe JSON snapshot for display fields |
| `createdAt` / `updatedAt` | required history fields |

`sourceSnapshot` must not contain raw SOAP text, secrets, provider payloads, tokens, or unnecessary personal data.

## Minimal Source Snapshot

| Field | Use |
| --- | --- |
| `patientName` | queue display |
| `guardianName` | queue display where already visible in existing workflow |
| `orderDisplayName` | queue row title |
| `requestingVetName` | queue context |
| `serviceItemId` | billing/order catalog trace |
| `billingReflectionEnabled` | candidate sync decision |
| `instruction` | operational instruction |
| `detail` | type-specific safe detail object |

Type-specific `detail` examples:

- `lab`: result category or test item hints.
- `imaging`: modality, body part, reading context.
- `dispensing`: medication name, route, frequency, quantity, storage instruction.
- `treatment`: treatment type, body site, expected duration.

## Status Mapping

| Fulfillment status | Order lifecycle effect | Billing effect |
| --- | --- | --- |
| `requested` | order remains `requested` or `in_progress` depending on chart action | confirmation may create an internal candidate; chart `Order 청구` invoice-links it after unfinished-work acknowledgement |
| `accepted` | order can remain `in_progress` | confirmed candidate may be invoice-linked without changing work state after acknowledgement |
| `in_progress` | order should be `in_progress` | confirmed candidate may be invoice-linked without changing work state after acknowledgement |
| `completed` | order becomes `completed` for the local-first fulfillment path | confirmed candidate may be invoice-linked without an unfinished-work warning |
| `cancelled` | order becomes `cancelled` | candidate is not created from this fulfillment update |
| `returned` | order becomes `re_requested` | candidate does not advance automatically; chart user confirmation is required if billing is intentionally requested |

`CLINICAL-BILLING-PR-017` supersedes the older selected-row billing wording. Confirmation creates the internal frozen candidate; encounter-scoped chart `Order 청구` is the trusted, atomic invoice-link boundary. Draft rows are included only in the estimate, and the action must not change encounter, order execution, or fulfillment work status.

`DEN-340` validates that the current table split can represent separated work and billing states without a schema migration:

- `orders.status`, `orders.work_status`, and `orders.task_status` remain clinical/work execution state.
- `order_fulfillment_work_items.status` remains downstream queue execution state.
- `orders.billing_candidate_status`, `orders.billing_candidate_id`, `invoices`, and `invoice_lines` remain billing handoff and invoice state.
- `clair_save_chart_order_action(action = 'bill')` marks the selected non-cancelled order as a billing candidate and preserves order/work/fulfillment status.
- `clair_sync_billing_invoice_candidates` validates the same workspace/encounter/order scope, excludes cancelled and non-billable rows, lazily creates a draft invoice anchor when needed, upserts deterministic invoice lines, and recalculates invoice totals from server-owned order snapshots.

The PR-017 path consolidates stale-summary validation, candidate selection, invoice-line linkage, invoice total refresh, candidate status update, and audit into `clair_request_chart_order_billing`. It holds the encounter billing advisory lock, accepts only server-derived requestable IDs, and records an actor/workspace/encounter-bound idempotency command so a lost success response can be replayed without duplicating the invoice, line, audit event, or command. `order_billing_candidates` is the invoice-line authority after a billing-only correction; its billing name, quantity, unit price, and amount must exactly match the generated line. The legacy two-RPC action remains compatibility code but is not the footer action authority.

`DEN-349` originally fixed candidate promotion language around a user-facing `청구 확정` step:

- `Order 청구`: create or refresh billing candidates from server-owned order snapshots.
- Billing workspace review: display candidates as `수납 후보`.
- `청구 확정`: accept candidate rows as the guardian-facing invoice amount basis and move the invoice to `issued`.
- `수납 완료`: change payment state only.

Current fit check: `clair_sync_billing_invoice_candidates` already inserts/updates `invoice_lines` at candidate sync time, while `clair_save_billing_invoice_lines` can only edit existing invoice line quantities and set invoice status to `issued`. Therefore the current DB/RPC shape can represent "candidate-backed draft invoice lines" but does not yet cleanly model "physical invoice line creation only at 청구 확정". If the product requires strict candidate-to-line promotion at `청구 확정`, a migration/RPC extension is required and must be approved before remote application.

The 2026-05-31 guardian-centered billing review supersedes the user-facing `청구 확정` requirement:

- Chart `Order 청구` is the moment selected orders become payable billing queue items. It should create/refresh candidate-backed invoice rows and preserve order/work status.
- Billing should present guardian-level checkout, not a patient-only confirmation screen. The primary action should be `수납 진행` / `결제 진행`.
- A server-side issue/snapshot transition may still happen internally during `수납 진행`, but it should not appear as an extra required `청구 확정` UX step.
- `미납 처리` should be an explicit deferred/overdue payment action with reason, not the default state for every same-day item that has not yet been paid.

Revised MVP fit:

- Candidate-backed draft invoice lines are acceptable and are now the preferred fit for the product flow because `Order 청구` already means payable handoff.
- No candidate-to-line promotion migration is required merely to remove `청구 확정` from the primary UX.
- A later migration is still likely for guardian-centered combined checkout, adjustment audit, and payment allocation across multiple patients/invoices.

Candidate promotion migration options, only if stricter semantics are later required:

1. Keep candidate-backed draft invoice lines: add/standardize a line status or candidate marker, expose candidate line IDs to the billing UI, and have `clair_save_billing_invoice_lines(..., p_confirm_billing = true)` issue the invoice containing those candidate-backed lines. This is the smaller DB change.
2. Move physical invoice line creation to billing confirmation: store candidates separately or only on `orders.billing_candidate_*` until `청구 확정`, then insert invoice lines inside a new promotion RPC. This is the stricter semantic model but a larger migration.

Recommended revised direction: option 1 for MVP, with user-facing copy changed from `청구 확정` to `수납 진행` / `결제 진행`. The approval-gated migration should focus on combined checkout and payment allocation before it focuses on strict candidate-to-line promotion.

Guardian-centered checkout model required for later implementation:

- `invoices` can remain encounter/patient anchored, but billing workspace selection must group by guardian account and allow multiple patient invoices to be paid together.
- Add a future `billing_checkout_sessions` or equivalent aggregate object when combined payment needs persistence beyond client state. It should store workspace, guardian, selected invoice IDs, selected patient IDs, subtotal, adjustments, final amount, status, actor, and timestamps.
- Add `payment_allocations` when one payment can settle multiple invoices. Each allocation links payment, invoice, amount, and allocation status.
- Add `invoice_adjustments` for discount/surcharge reason, actor, amount, type, and optional approval metadata.
- Add guardian-level billing flags/notes using neutral copy such as `결제 주의`, `미납 주의`, or `수납 메모`; avoid exposing a raw `blacklist` concept in guardian-facing outputs.
- Co-guardian inclusion requires patient-guardian relationship queries and an explicit UI toggle before cross-guardian invoices are shown in the billing ledger.

Recommended consolidated RPC shape, if later approved:

- `public.clair_bill_chart_orders_and_sync_invoice_candidates(p_workspace_id text, p_actor_user_id uuid, p_encounter_id uuid, p_order_ids uuid[]) returns jsonb`
- Transactional behavior: validate membership, encounter, selected orders, `billing_reflection_enabled`, and cancellation status; update order billing candidate fields; create or reuse the active draft/issued invoice; insert/update invoice lines; recalculate invoice totals; write order events; return both order action rows and invoice candidate rows.
- Verification: static migration contract tests, focused chart order action server specs for rollback-on-sync-failure and retry, focused invoice candidate specs, `npx tsc --noEmit --pretty false`, `npm run security:secrets`, and DEN-341 synthetic staging replay after explicit staging application approval.

## Permission And Scope Requirements

- All reads and mutations require an authenticated actor or approved mock actor fallback.
- Every work item read/mutation must validate `workspaceId`.
- `orderId` and `encounterId` must belong to the same workspace.
- Chart confirmation remains a vet/chart authority action.
- Chart `Order 청구` remains a chart authority action for moving selected billable orders to billing candidate state.
- Fulfillment status mutation is primarily technician authority unless a later role policy explicitly expands it.
- Billing candidate sync must not trust client-submitted amounts.
- Unfinished selected orders must require explicit UI confirmation before chart billing action continues.
- Chart billing action must preserve `orders.status`, `orders.task_status`, and `order_fulfillment_work_items.status`.
- Cross-workspace, inactive member, non-member, invalid transition, duplicate creation, and unsupported order type cases must be covered by tests.

## Migration Gate

`DEN-236` may need a migration for a new table and RPCs. If so:

1. Write repo migration files first.
2. Add static migration contract tests.
3. Run local checks.
4. For remote staging, run dry-run before any push.
5. Push to `clair-emr-staging / qmerxgzrwaaahpkhjqlc` only after explicit approval and repo migration match.

No direct SQL mutation is allowed.

## Implementation Issue Order

| Issue | Dependency | Engineering output |
| --- | --- | --- |
| `DEN-236` | `DEN-235` | shared fulfillment route, core, gateway, migration contract |
| `DEN-237` | `DEN-236` | chart order confirmation creates work items |
| `DEN-238` | `DEN-237` | lab/imaging server-backed queue read and status mutation |
| `DEN-239` | `DEN-237` | dispensing/treatment server-backed queue read and status mutation |
| `DEN-240` | `DEN-238`, `DEN-239` | lifecycle and billing candidate sync |
| `DEN-241` | `DEN-240` | E2E replay and regression coverage |
| `DEN-242` | `DEN-241` | closeout and staging readiness report |

## Verification Baseline

Use narrow verification first, then expand as implementation touches shared behavior:

- fulfillment route/server specs
- migration/static contract specs when schema/RPC changes
- focused chart, lab/imaging, dispensing, billing Playwright specs
- cross-tenant denial and amount-integrity regressions
- `npx tsc --noEmit --pretty false`
- `npm run lint`
- `npm run build` for broad UI/API changes
- `npm run docs:check`
- `npm run security:secrets`

## Related Docs

- [Order Fulfillment Handoff Product Contract](../../product/domain/order-fulfillment-handoff.md)
- [DB Structure Spec KO](emr-saas-db-structure-spec.ko.md)
- [Mock And Live Boundary Map](../architecture/mock-live-boundary-map.md)
