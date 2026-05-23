---
id: "CLINICAL-FULFILLMENT-PR-006"
status: "human_review"
area: "clinical-fulfillment"
priority: "P0"
target_pr: "Project 08 / DEN-240"
source_docs:
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/engineering/data-model/order-fulfillment-handoff-contract.md"
  - "docs/work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-004-lab-imaging-queue-adoption.md"
  - "docs/work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-005-dispensing-treatment-queue-adoption.md"
dependencies:
  - "DEN-238"
  - "DEN-239"
  - "DEN-240"
updated: "2026-05-23"
---

# Sync Fulfillment Completion To Order Lifecycle And Billing Candidates

## Goal

Connect fulfillment status changes back to order lifecycle and billing candidate sync so downstream work completion can return to the chart and billing flow.

## Scenario

1. Chart confirmation has created fulfillment work items.
2. A technician starts a lab, imaging, dispensing, or treatment work item.
3. The fulfillment update route syncs order lifecycle to `in_progress`.
4. When the work item is completed, order lifecycle syncs to `completed`.
5. If billing reflection is enabled, the server syncs invoice candidates using server-owned order/invoice line snapshots.
6. Returned work syncs order lifecycle to `re_requested`; cancelled work syncs to `cancelled`.

## Scope

- Add downstream sync from fulfillment updates to chart order lifecycle.
- Add billing candidate sync for completed, billable fulfillment work items.
- Preserve server-owned invoice amount snapshots; clients cannot submit billing amounts through fulfillment.
- Emit audit events for lifecycle status changes and generated billing candidates.
- Extend focused server coverage across fulfillment, lifecycle, and billing candidate boundaries.
- Keep fixture fallback and Supabase RPC gateway contracts aligned.

## Out Of Scope

- Payment provider, receipt, refund, settlement, or accounting integration.
- External device/provider/PACS delivery.
- Broad billing UI redesign.
- Remote Supabase migration push.
- Production access or real data.

## Done When

- Fulfillment `in_progress`, `completed`, `cancelled`, and `returned` statuses map to order lifecycle states.
- Completed billable work syncs billing candidates with server-owned amounts.
- Returned/cancelled/non-completed work does not create billing candidates.
- Focused regression coverage passes.
- Linear `DEN-240` is ready for Human Review.

## Verification

- `npx tsc --noEmit --pretty false`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3105 npx playwright test tests/fulfillment-work-item-server.spec.ts tests/billing-invoice-candidate-sync-server.spec.ts tests/chart-order-lifecycle-persistence-server.spec.ts`
- `npm run docs:check`
- `npm run security:secrets`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Handoff Notes

Start `DEN-241` next. It should add end-to-end replay coverage for chart confirmation through downstream fulfillment and billing readback.
