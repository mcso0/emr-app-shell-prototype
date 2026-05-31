---
id: PRODUCT-DOMAIN-ORDER-FULFILLMENT-HANDOFF
status: approved
area: product
doc_type: domain-contract
related_work:
  - DEN-235
  - DEN-287
  - DEN-288
  - DEN-301
  - DEN-335
supersedes: []
superseded_by: []
last_updated: 2026-05-31
---

# Order Fulfillment Handoff

This document defines the product-level handoff from chart-confirmed orders to lab, imaging, dispensing, treatment, and billing work. It is a domain contract, not a schema or migration plan.

## Why This Exists

The staging pilot can show a guided synthetic outpatient flow from reception through chart, lab/imaging, dispensing/treatment, and billing. However, the current product claim must stay narrow: lab, imaging, dispensing, and treatment screens are visible, but full live persistence for every downstream path is not complete.

`DEN-235` establishes the next product contract: after a vet confirms an order, the correct downstream team should receive a work item, update its state, and feed completion back into order lifecycle and billing candidate readiness.

## Boundary

| Boundary                       | Claim                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Current demo-visible path      | Synthetic fixtures can show the handoff story in a guided demo.                                                |
| Current local-first foundation | Chart/order/billing persistence routes exist for selected scoped paths.                                        |
| Target for Project 08          | Confirmed orders create server-backed fulfillment work items and downstream status changes.                    |
| Not claimed yet                | Production readiness, real data, provider/device/PACS/payment integration, or full legal/compliance readiness. |

## Product Flow

```mermaid
flowchart LR
  Chart["Chart order confirmation"]
  Fulfillment["Fulfillment work item"]
  BillAction["Chart Order 청구"]
  Lab["Lab queue"]
  Imaging["Imaging queue"]
  Dispensing["Dispensing queue"]
  Treatment["Treatment queue"]
  Lifecycle["Order lifecycle"]
  Billing["Billing candidate"]

  Chart --> Fulfillment
  Chart --> BillAction
  BillAction --> Billing
  Fulfillment --> Lab
  Fulfillment --> Imaging
  Fulfillment --> Dispensing
  Fulfillment --> Treatment
  Lab --> Lifecycle
  Imaging --> Lifecycle
  Dispensing --> Lifecycle
  Treatment --> Lifecycle
  Lifecycle --> Billing
```

## Objects

| Object                     | Meaning                                                        | Product owner                             |
| -------------------------- | -------------------------------------------------------------- | ----------------------------------------- |
| Order                      | Encounter-owned request created or confirmed by chart workflow | Vet                                       |
| Fulfillment work item      | Operational task generated from a confirmed order              | Technician or responsible queue           |
| Queue item                 | Screen-specific presentation of fulfillment work               | Lab/imaging/dispensing/treatment operator |
| Result or execution record | Output or completion evidence for the work item                | Technician, then vet review where needed  |
| Billing candidate          | Server-owned billable handoff created by chart billing action or approved sync | Billing operator                          |

## Order Type Mapping

| Order type            | Destination       | Required display context                                                 | Notes                                                        |
| --------------------- | ----------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `lab`                 | Lab queue         | patient, encounter, requested test, requesting vet, priority, due time   | Result entry and vet review may be separate states.          |
| `imaging`             | Imaging queue     | patient, encounter, modality/body part, requesting vet, priority         | PACS/device integration is not part of this contract.        |
| `dispensing`          | Dispensing queue  | medication name, route, frequency, quantity, instruction, requesting vet | Inventory, lot/expiry, and label printing are out of scope.  |
| `treatment`           | Treatment queue   | treatment name/type, body site if any, instruction, expected duration    | Technician completion may not equal vet clinical review.     |
| billable-only service | Billing candidate | encounter, service item, server-calculated amount                        | No downstream clinical queue unless `task_required` is true. |

Phase-1 permission policy: treatment and dispensing fulfillment share the
same operational permission boundary. `dispensing:view` and
`dispensing:complete` cover both queues until a later approved permission
split. 마약류 are not included in this shared boundary; controlled-substance
workflows need a separate future security and permission design.

## State Model

Fulfillment work item states are intentionally operational. They do not replace canonical order, result, invoice, or audit state.

| State         | Meaning                                        | Normal next states                                  |
| ------------- | ---------------------------------------------- | --------------------------------------------------- |
| `requested`   | Work item was generated from a confirmed order | `accepted`, `in_progress`, `cancelled`, `returned`  |
| `accepted`    | A team or assignee acknowledged the work       | `in_progress`, `completed`, `cancelled`, `returned` |
| `in_progress` | Work has started                               | `completed`, `cancelled`, `returned`                |
| `completed`   | Work is operationally complete                 | terminal for the work item                          |
| `cancelled`   | Work should not proceed                        | terminal with reason                                |
| `returned`    | Work was sent back for chart/order correction  | `requested`, `cancelled` after chart action         |

## Transition Rules

- Chart confirmation creates or updates fulfillment work items only for orders that require downstream work.
- Creation must be idempotent. Retrying the same confirmation must not create duplicate active work items.
- Cancelling an order must decide whether active fulfillment work is cancelled, returned, or locked for review.
- Completing a work item can update order lifecycle, but completion is not the only path to billing candidate creation.
- Billing candidates must use server-owned service item and price snapshots. Client-submitted amount is not trusted.
- `Order 청구` is the chart-owned action that moves selected billable orders to billing candidate state across `lab`, `imaging`, `dispensing`, and `treatment`.
- `Order 청구` must not change operational work status. `requested + 수납 후보`, `in_progress + 수납 후보`, and `completed + 수납 후보` are all valid combinations.
- If selected orders include unfinished work, the UI must ask: `아직 완료되지 않은 오더가 있습니다. 수납을 진행할까요?` and show each unfinished order name with its current status badge.
- Vet result review and re-request remain clinical/result workflow actions. They must not be treated as the default billing gate.
- Workspace catalog confirmations can create fulfillment work items from the applied snapshot even when the selected catalog row does not yet exist in the legacy mock `orders` fixture. The fulfillment source snapshot remains minimal and should contain display, billing, instruction, routing, and service item context only.
- Every mutation must be workspace-scoped and actor-scoped.
- Unauthorized, cross-workspace, invalid transition, and duplicate mutation attempts must keep state unchanged and return safe errors.

## Billing State Matrix

| Work state | Billing candidate rule | User confirmation |
| --- | --- | --- |
| `requested` | Can be moved to billing candidate by chart `Order 청구` when billable | Required |
| `accepted` / `in_progress` | Can be moved to billing candidate by chart `Order 청구` when billable | Required |
| `completed` | Can be moved to billing candidate by chart `Order 청구` when billable | Not required by default |
| `re_requested` / `returned` | Can be billed only if the chart user intentionally selects it and confirms unfinished/rework status | Required |
| `cancelled` | Must not create a new active billing candidate | Not applicable |
| Existing billing candidate | Re-running `Order 청구` should be idempotent and must not fail because a candidate already exists | Not required by default |

## Role Expectations

| Action                                         | Hospital admin               | Vet                               | Technician                              | Front desk / billing     |
| ---------------------------------------------- | ---------------------------- | --------------------------------- | --------------------------------------- | ------------------------ |
| Confirm order                                  | Oversight only unless scoped | Yes                               | No                                      | No                       |
| Accept/start fulfillment                       | Oversight if scoped          | Usually no                        | Yes                                     | No                       |
| Complete lab/imaging/treatment/dispensing work | Oversight if scoped          | Review if scoped                  | Yes                                     | No                       |
| Return work for correction                     | Oversight if scoped          | Yes                               | Yes if reasoned                         | No                       |
| Sync billable candidate                        | Oversight                    | Yes through chart `Order 청구`    | No                                      | Yes within billing scope |
| Issue/payment finalization                     | Admin oversight              | View                              | No                                      | Yes within billing scope |

## Demo And Claim Language

Safe wording:

- "The representative outpatient workflow is visible end to end."
- "Project 08 is the track that turns chart-confirmed orders into server-backed downstream work queues."
- "Payment providers, PACS, device ingestion, and production data remain outside this claim."

Do not say:

- "Every lab/imaging/dispensing/treatment path is fully live."
- "External devices or PACS are integrated."
- "Real patient data or production pilots are ready."

## Open Decisions Before Implementation

- DEN-335 replaces the earlier lab/imaging-only billing gate with a unified rule: chart `Order 청구` can advance billable orders to billing candidate state for lab, imaging, dispensing, and treatment, while unfinished orders require explicit user confirmation.
- DEN-280 resolves the MVP technician cancellation policy: technicians can return work to chart with a reason, but should not cancel order work in phase 1.
- DEN-280 resolves the MVP billable-only policy: billable-only service items can skip fulfillment and create billing candidates directly from chart confirmation.
- Whether medication dispensing completion requires inventory or label-printing fields in a later project.
- Which role names and permissions map to each mutation if the current permission set is insufficient.
- 마약류 / controlled-substance workflow policy is a separate future security and permission scope. It is not implemented in this contract and should require veterinarian-only authority or explicit controlled-substance permission.

See [Workspace Order Catalog Platform](workspace-order-catalog-platform.md) for the product policy that links workspace catalog destination, chart snapshots, fulfillment routing, and billing readiness.

## Related Docs

- [Outpatient Workflow State Model](outpatient-workflow-state-model.md)
- [EMR Domain Entity Map](emr-domain-entity-map.md)
- [Mock And Live Boundary Map](../../engineering/architecture/mock-live-boundary-map.md)
- [Order Fulfillment Handoff Engineering Contract](../../engineering/data-model/order-fulfillment-handoff-contract.md)
