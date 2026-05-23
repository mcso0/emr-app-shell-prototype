---
id: "CLINICAL-FULFILLMENT-PR-007"
status: "human_review"
area: "clinical-fulfillment"
priority: "P0"
target_pr: "Project 08 / DEN-241"
source_docs:
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/engineering/data-model/order-fulfillment-handoff-contract.md"
  - "docs/work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-006-lifecycle-billing-sync.md"
dependencies:
  - "DEN-240"
  - "DEN-241"
updated: "2026-05-23"
---

# Add End-To-End Fulfillment Handoff Replay And Regression Coverage

## Goal

Add a replay regression that proves chart order confirmation flows through downstream fulfillment queues, order lifecycle readback, and billing candidate readback.

## Scenario

1. A vet confirms lab, imaging, dispensing, and treatment orders for the Kong synthetic encounter.
2. The chart action route returns fulfillment work items for all four downstream queues.
3. Re-confirming the same orders does not create duplicate active work items.
4. A technician completes each queue work item through the fulfillment route.
5. Order lifecycle readback shows all selected orders as `completed`.
6. Billing candidate readback shows server-owned invoice candidates for all selected billable orders.
7. Negative replay checks block front desk chart confirmation, cross-workspace confirmation, and invalid direct fulfillment completion.

## Scope

- Add a focused Playwright API-level replay spec for the server-backed fulfillment handoff.
- Cover lab, imaging, dispensing, and treatment queues in one representative synthetic encounter.
- Cover duplicate confirmation, invalid transition, role denial, and workspace denial.
- Include existing sales demo golden path coverage in verification to preserve demo-visible UX.
- Document the replay evidence and remaining staging validation boundary.

## Out Of Scope

- Production deploy.
- Remote Supabase mutation.
- Real customer or patient data.
- External provider/device/PACS/payment integration.
- Broad UI redesign.

## Done When

- Fulfillment replay coverage passes.
- Focused fulfillment/lifecycle/billing server regression still passes.
- Existing sales demo golden path still passes.
- Docs/work, changelog, and closeout evidence are updated.
- Linear `DEN-241` is ready for Human Review.

## Verification

- `npx tsc --noEmit --pretty false`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/fulfillment-handoff-replay.spec.ts tests/fulfillment-work-item-server.spec.ts tests/sales-demo-flow.spec.ts`
- `npm run docs:check`
- `npm run security:secrets`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Handoff Notes

Start `DEN-242` next. It should close out Project 08, summarize claim boundaries, and decide whether additional staging validation needs approval.
