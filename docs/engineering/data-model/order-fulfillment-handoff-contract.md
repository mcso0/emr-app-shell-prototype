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
last_updated: 2026-10-27
---

# Order Fulfillment Handoff Engineering Contract

This document defines the engineering contract for Project 08, `Clinical Order Fulfillment Handoff Persistence`. It bridges existing chart/order/billing persistence with downstream lab, imaging, dispensing, and treatment queue persistence.

`DEN-235` defined the contract. `DEN-236` adds the initial local-first route/core/gateway and migration contract. `DEN-237` connects chart order confirmation to fulfillment sync. `DEN-238` connects lab and imaging screens to fulfillment queue read/status mutation. `DEN-239` connects dispensing and treatment screens to fulfillment queue read/status mutation. `DEN-240` syncs fulfillment status changes back to order lifecycle and billing candidates. `DEN-241` adds end-to-end replay coverage. `DEN-242` closes out the project and records staging readiness boundaries. Remote staging migration remains gated by dry-run and explicit approval.

## Dispensing/treatment instruction candidate — 2026-10-27

Local candidate only; remote application is not verified. See
[CLINICAL-FULFILLMENT-PR-010](../../work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-010-plan-order-work-lifecycle.md#approved-dispensingtreatment-instruction-workflow--2026-10-27).

- The authenticated instruction GET/PATCH route uses session-bound RPCs. Live
  failures do not fall back to demo state. Existing legacy sales fixtures remain
  an explicitly separate caller path.
- A set has a main executor and each item has one executor. The main can assign
  and complete its items; a sub can complete only their own item. The requesting
  vet can complete items/the set. Server capabilities own these rules.
- Completing all children does not finalize a set. Explicit group completion
  completes unfinished active children atomically and keeps cancelled children
  cancelled. Actual-result requirements and billing guards remain enforced.
- Reopening preserves stored results and emits no undo activity/history or
  notification. Invoiced orders cannot be reopened through this command.
- Unassigning started work pauses it while retaining results. A successor claims
  and resumes. Changing a child's executor does not change the set main.
- Independent changed-child requests keep the aggregate identity and advance only
  that child's attempt. Whole-set repeats use each child's current attempt.
- Common set instruction text uses the existing draft save/ETag before first
  confirmation. Confirmed common-text edits preserve completion and record
  author, time, and before/after values. Item notes use existing clinical fields.
- Completion receipts are actor-bound. A transaction-local private capability
  supports completion readback/billing without granting completed-result
  amendment permission to a requester. It is removed before the command returns.
- Assignment, cancellation, completion and instruction-change notifications use
  persisted user recipients and deduplicated event identities. Reopen is silent.

Migrations `20261027091000` through `20261027095000` must be reviewed/applied
as one candidate before enabling its live caller. Local isolated SQL tests use
synthetic schema fixtures; clinical calculations and invoice internals remain
separate dependencies. This is not a full hosted-schema or real-data proof.

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
| `patientId` / `patientName` | workspace-scoped current queue display context |
| `guardianName` | workspace-scoped current queue display context |
| `requesterName` | active same-workspace requester display name |
| `sourceSnapshot` | server-frozen source facts; read projections must not overwrite it |
| `createdAt` / `updatedAt` | required history fields |

`sourceSnapshot` must not contain raw SOAP text, secrets, provider payloads, tokens, or unnecessary personal data. Patient, guardian, and requester names already frozen into older snapshots remain valid historical facts, but live queue display uses the separate workspace-scoped projection fields above.

## Minimal Source Snapshot

| Field | Use |
| --- | --- |
| `patientName` | optional historical label frozen at request time |
| `guardianName` | optional historical label frozen at request time |
| `orderDisplayName` | queue row title |
| `requestingVetName` | optional historical requester label frozen at request time |
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

`CLINICAL-BILLING-PR-020` makes the current Summary part of the existing chart
mutation success contract. `clair_save_chart_order_draft`,
`clair_confirm_chart_order_candidates`, and
`clair_mutate_chart_order_execution` keep their public names and input
signatures, finish the existing mutation first, and then compute
`billingSummary` in the same database transaction. An idempotent replay must
reuse the existing mutation result but recompute the current Summary; it must
not persist or replay a historical Summary snapshot. Their renamed base
functions are not executable by API roles, while the public wrappers retain
actor equality, active workspace membership, and the existing action-specific
permission checks. Because the returned Summary contains chart and financial
read data, every Summary-bearing mutation also requires `chart:view`; a custom
role with only `chart:update`, `order:update`, or `billing:issue` must not gain
Summary access through the mutation response.

The chart client accepts a mutation Summary only when both `workspaceId` and
`encounterId` match the active chart. Accepting it invalidates older Summary GET
sequences and updates Summary, ETag, freshness, and error state as one
authoritative transition. A normal successful mutation therefore has no
trailing Summary GET. GET remains the recovery path for initial entry, safe
focus/visibility return, revision conflict, lost-response readback, and explicit
retry. While a draft is unsaved, the UI may apply only its order amount delta to
the last server Summary; discounts, surcharges, tax, payment, outstanding,
invoice, and billing authority stay server-owned. Preview, invalid, failed,
conflicted, stale, and unauthoritative states must keep `Order 청구` disabled.

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

## Fulfillment Read Scope — Audit Item 4 (Local Candidate)

The application candidate uses `clair_list_fulfillment_work_items_v2` with
optional `p_date`, `p_patient_id`, and `p_work_item_id` alongside the existing
workspace, queue, encounter, order, and status filters. The migration is
`20261003073105_fulfillment_scoped_queue_read.sql`; hosted application is pending
separate approval.

A selected day uses the half-open Asia/Seoul interval on
`coalesce(due_at, created_at)`. This moves the existing server date filter to the
DB before joins/JSON aggregation; the server keeps its date check as defense in
depth. Status does not alter the interval. Historical unfinished work remains
readable by its operating day, date-free patient history, and exact work item
lookup. This change does not introduce an overdue carryover policy.

The RPC returns the complete matching set, existing display context/order, and
unchanged full `sourceSnapshot`. There is no row limit or pagination that could
silently truncate counts or hide work. Detail, execution, and billing consumers
still need nested frozen/lineage/detail data, so snapshot projection is deferred.
Date-free history remains potentially large but is scoped by patient at the DB;
mutation permission lookup is scoped by work item ID. The home reader remains
on v1; home redesign/read-model optimization is outside this item.

The same DB membership, destination read permission, workspace-scoped joins,
and authenticated-only execute boundary are retained. No role/RLS policy or
clinical/financial write path changes. Apply the additive RPC/index before the
application release; an absent v2 fails as a read error, with no broad-history
fallback. Keep v1 for application rollback. After reverting callers, v2 and its
new index can be removed without changing business data.

See [CLINICAL-FULFILLMENT-PR-010](../../work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-010-plan-order-work-lifecycle.md)
for local equivalence, performance, regressions, and release limits.

## Patient View Of Execution Queues

Lab, imaging, and combined dispensing/treatment sidebars have an
오더별/환자별 toggle. With no saved choice, the existing highlighted toggle
(`aria-pressed=true`, button label 오더별 보기, patient-grouped display) is the
default. Save the last explicit toggle choice independently per authenticated
actor, workspace, and queue in browser localStorage. Restore both on and off
choices on reload and return visits in the same browser; there is no device
sync. Wait for actor identity before enabling the toggle. Invalid stored values
use the default; unavailable storage preserves switching for the current visit.
Patient groups use the authorized workspace and actual
patient ID within the selected server operating day, across encounters and
SOAP charts. Missing patient identities stay task-specific. Names are display
labels only. Type/status/search counts retain their existing task semantics.
Urgency is independent of lifecycle status. Patient priority/latest sorting
uses raw priority/status and immutable request creation time; equal task ranks
use the chosen request/assignee/wait sort. Paused belongs to 진행중 filtering.
Assignment filtering uses assignedToUserId, not whether a display name resolves.

Selection still uses exact lab result, imaging study, or fulfillment queue
item/work item IDs. Switching views never writes or replaces the selected
task. Filtering out the selection retains its detail and provides a condition
reset action. A private realtime event still triggers the existing API refetch;
only newly returned stable IDs produce a new-work notice. The current reading
anchor remains until the user requests 목록에서 보기. Authentication or
permission denial clears cached queue rows; network failures retain their
existing recovery behavior. No synthetic scenario controls enter the app.

The additive v2 projection returns nullable originChartId and
originChartCreatedAt from the exact workspace/encounter/order/soap_notes joins.
The origin ID is the successfully scoped SOAP row ID. Invalid/missing/foreign
origins return NULL metadata without dropping work. No sourceSnapshot, business
row, permission, or audit mutation is introduced. Display uses immutable chart
created_at, includes the date, and adds a deterministic per-time record ordinal
for simultaneous charts. That ordinal is a UI disambiguator within the complete
authorized group, not a stored chart number. Legacy origins remain explicitly
unconfirmed and are never inferred from encounter or timestamps. SOAP content
and unowned clinical fields are not included.

Apply the projection migration before the app release. Old callers ignore
the extra keys; the previous RPC definition can be restored independently of
app rollback without business data changes. Hosted apply remains separately
approved. See [CLINICAL-FULFILLMENT-PR-011](../../work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-011-patient-queue-view.md)
for synthetic proofs, verification, and delivery evidence.

## Current assignee authority (2026-10-12 local candidate)

- Workspace permissions and current ownership are both required. Claim is allowed only while unassigned. Once claimed, only the current assignee may start, pause, resume, complete, return, change or cancel assignment. Existing terminal-state immutability remains.
- Lab values, item/overall findings and attachment publication/deletion open immediately after claim (`requested` + assigned). No start action is required for lab input. Unassigned, another assignee, paused and terminal lab results are read-only. Read/history access keeps its existing workspace permission boundary. Pending upload discard remains available to its original uploader for cleanup after transfer; it cannot publish a result.
- Imaging, dispensing and treatment keep `in_progress` for first actual recording and `completed` + amendment reason for correction. The current assignee check applies to both. An open execution/retest form invalidates its authority after ownership changes; server checks remain authoritative.
- Billing ownership is persisted on the invoice as a user ID and assignment revision. Claim/change/cancel are locked and audited in `billing_assignment_events`. Invoice lines, payment method, status/review reversal and every selected checkout invoice require current ownership. Manual direct/legacy chart invoice sync checks the resolved existing invoice owner. Source-derived fulfillment billing handoff preserves existing completed-item verification and additionally requires ownership of every exact completed work item; it is not a free-form financial-edit surface. Canonical chart authoring and automatic handoff retain their existing trusted boundaries.
- Transfer and result writes serialize on the existing encounter billing lock. Checkout acquires all distinct encounter locks in deterministic order before invoice locks. Attachment finalize is a service-only branch after server byte validation; delete/discard use session-bound RPCs. Authenticated direct attachment inserts and inherited legacy result-writer execution are revoked.
- Queue reads project the actual assignee name and actor-bound `canManage`. UI feedback does not substitute for DB authorization. Billing ownership uses workspace realtime refresh plus a bounded visible-page fallback.
- Migration `20261012054346_current_assignee_mutation_boundary.sql` is a local candidate. Apply it before the app candidate. No remote apply, real data, payment execution or Production delivery is verified. Rollback must restore the prior affected function definitions; retain invoice assignment fields/events and saved results rather than deleting history.

## RLS Helper Execution Grant (2026-10-27)

Authenticated direct reads of `order_fulfillment_work_items` require EXECUTE on
`private.clair_queue_permission_for_destination(text,text)` during RLS evaluation.
The explicit grant preserves the existing active-membership and queue-capability
policy; it adds no table write rights or anonymous access.
[DB-PR-002](../../work/engineering/ENGINEERING-DB-PR-002-fulfillment-rls-helper-grant.md)
tracks the local forward migration and isolated regression; remote application
is not recorded.
