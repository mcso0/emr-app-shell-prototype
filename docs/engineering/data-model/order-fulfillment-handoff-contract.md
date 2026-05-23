---
id: ENGINEERING-DATA-MODEL-ORDER-FULFILLMENT-HANDOFF-CONTRACT
status: approved
area: engineering
doc_type: data-contract
related_work:
  - DEN-235
  - DEN-236
  - DEN-237
supersedes: []
superseded_by: []
last_updated: 2026-05-23
---

# Order Fulfillment Handoff Engineering Contract

This document defines the engineering contract for Project 08, `Clinical Order Fulfillment Handoff Persistence`. It bridges existing chart/order/billing persistence with downstream lab, imaging, dispensing, and treatment queue persistence.

`DEN-235` defined the contract. `DEN-236` adds the initial local-first route/core/gateway and migration contract. `DEN-237` connects chart order confirmation to fulfillment sync. Remote staging migration remains gated by dry-run and explicit approval.

## Current Inventory

| Area | Existing route or source | Current boundary |
| --- | --- | --- |
| Chart order drafts | `GET/PATCH /api/workspaces/[workspaceId]/chart/order-drafts` | server route, mock fallback, Supabase RPC contract |
| Chart order actions | `GET/PATCH /api/workspaces/[workspaceId]/chart/order-actions` | confirm/billing-candidate action route, mock fallback, Supabase RPC contract |
| Chart order lifecycle | `GET/PATCH /api/workspaces/[workspaceId]/chart/order-lifecycle` | selected order lifecycle route, mock fallback, Supabase RPC contract |
| Billing candidates | `GET/PATCH /api/workspaces/[workspaceId]/billing/invoice-candidates` | selected order to billing candidate sync |
| Billing invoice lines | `GET/PATCH /api/workspaces/[workspaceId]/billing/invoice-lines` | line edit and billing confirmation |
| Billing payment status | `GET/PATCH /api/workspaces/[workspaceId]/billing/payment-status` | synthetic payment/unpaid state |
| Lab/imaging screens | `src/features/lab-imaging/data.ts` | mock domain fixtures, no fulfillment server queue route |
| Dispensing/treatment screen | `src/features/dispensing/data.ts` | module-local fixture rows, no fulfillment server queue route |
| Shared fulfillment work items | `src/app/api/workspaces/[workspaceId]/fulfillment/work-items/**` | DEN-236 server route/core/gateway foundation, not yet adopted by downstream screens |
| Chart-to-fulfillment sync | `PATCH /api/workspaces/[workspaceId]/chart/order-actions` | DEN-237 confirm action calls fulfillment sync after successful order confirmation |

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
| `requested` | order remains `requested` or `in_progress` depending on chart action | none |
| `accepted` | order can remain `in_progress` | none |
| `in_progress` | order should be `in_progress` | none |
| `completed` | order may become `confirmed` or `completed` based on review policy | billable candidate may be created or refreshed |
| `cancelled` | order may become `cancelled` or require chart review | remove, void, or exclude candidate by explicit rule |
| `returned` | order should be `re_requested` or remain open for chart correction | candidate must not advance |

`DEN-235` does not decide every review policy. The implementation issues must preserve explicit decision points for lab/imaging vet review and cancellation after candidate creation.

## Permission And Scope Requirements

- All reads and mutations require an authenticated actor or approved mock actor fallback.
- Every work item read/mutation must validate `workspaceId`.
- `orderId` and `encounterId` must belong to the same workspace.
- Chart confirmation remains a vet/chart authority action.
- Fulfillment status mutation is primarily technician authority unless a later role policy explicitly expands it.
- Billing candidate sync must not trust client-submitted amounts.
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
