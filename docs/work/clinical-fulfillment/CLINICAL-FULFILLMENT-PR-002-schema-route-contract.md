---
id: "CLINICAL-FULFILLMENT-PR-002"
status: "human_review"
area: "clinical-fulfillment"
priority: "P0"
target_pr: "Project 08 / DEN-236"
source_docs:
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/engineering/data-model/order-fulfillment-handoff-contract.md"
  - "docs/engineering/architecture/mock-live-boundary-map.md"
dependencies:
  - "DEN-235"
  - "DEN-236"
updated: "2026-05-23"
---

# Build Order Fulfillment Work Item Schema And Route Contract

## Goal

Implement the first shared server boundary for fulfillment work items so chart-confirmed orders can be represented as lab, imaging, dispensing, or treatment queue work.

## Scenario

1. A vet confirms or selects chart orders for an encounter.
2. The server sync route receives the encounter and selected order ids.
3. The server creates or refreshes one fulfillment work item per selected supported order.
4. A downstream technician reads work items for one queue type.
5. The technician advances a work item through valid lifecycle states.
6. Invalid actor, workspace, order, and transition cases are rejected before UI adoption.

## Scope

- Add shared fulfillment work item core logic with mock fallback and Supabase RPC gateway contract.
- Add routes:
  - `GET /api/workspaces/[workspaceId]/fulfillment/work-items`
  - `POST /api/workspaces/[workspaceId]/fulfillment/work-items/sync-from-orders`
  - `PATCH /api/workspaces/[workspaceId]/fulfillment/work-items/[workItemId]`
- Add local-first migration file for the `order_fulfillment_work_items` table and RPC contract.
- Cover permission, workspace, transition, RPC, and migration contract behavior with focused tests.
- Preserve existing chart, lab, imaging, dispensing, treatment, and billing UI behavior.

## Out Of Scope

- Remote Supabase migration push.
- Chart UI integration.
- Lab/imaging screen queue replacement.
- Dispensing/treatment screen queue replacement.
- Billing candidate sync from fulfillment completion.
- Production deploy or production data access.
- Real hospital, guardian, patient, payment, or identity data.

## Done When

- Fulfillment work item server routes compile and pass focused Playwright request coverage.
- Supabase gateway names and payloads are fixed by contract tests.
- Migration contract is present in repo and guarded by static tests.
- Docs/work, changelog, and closeout evidence are updated.
- Linear `DEN-236` is ready for Human Review.

## Verification

- `npx tsc --noEmit --pretty false`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3101 npx playwright test tests/fulfillment-work-item-server.spec.ts`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Handoff Notes

Start `DEN-237` next. It should connect chart order confirmation to the new fulfillment sync route without replacing lab, imaging, dispensing, or treatment screens yet.
