---
id: "CLINICAL-FULFILLMENT-PR-003"
status: "human_review"
area: "clinical-fulfillment"
priority: "P0"
target_pr: "Project 08 / DEN-237"
source_docs:
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/engineering/data-model/order-fulfillment-handoff-contract.md"
  - "docs/work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-002-schema-route-contract.md"
dependencies:
  - "DEN-236"
  - "DEN-237"
updated: "2026-05-23"
---

# Connect Chart Order Confirmation To Fulfillment Handoff Creation

## Goal

Connect chart order confirmation to the shared fulfillment sync boundary so confirmed chart orders create or refresh downstream work items.

## Scenario

1. A vet selects orders in the chart and runs the confirm action.
2. The chart order action route persists the confirmation.
3. The server syncs the confirmed order ids into fulfillment work items.
4. The response includes the created or refreshed work items.
5. A downstream queue can read those work items through the DEN-236 fulfillment read route.

## Scope

- Add a fulfillment sync hook after successful `confirm` chart order actions.
- Keep `bill` order action behavior separate from fulfillment sync.
- Wire Supabase mode to the existing fulfillment RPC gateway contract.
- Extend focused route coverage to assert chart confirmation creates readable fulfillment work items.
- Preserve existing chart, billing, lab, imaging, dispensing, and treatment UI behavior.

## Out Of Scope

- Lab/imaging screen queue adoption.
- Dispensing/treatment screen queue adoption.
- Billing candidate sync from fulfillment completion.
- Remote Supabase migration push.
- External provider/device/PACS integrations.
- Production deploy or production data access.

## Done When

- Confirming chart orders returns fulfillment work items in the server response.
- The same work items can be read from the fulfillment queue route.
- Billing action tests prove billing candidate submission is not coupled to fulfillment sync.
- Docs/work, changelog, and closeout evidence are updated.
- Linear `DEN-237` is ready for Human Review.

## Verification

- `npx tsc --noEmit --pretty false`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3102 npx playwright test tests/chart-order-action-persistence-server.spec.ts tests/fulfillment-work-item-server.spec.ts`
- `npm run docs:check`
- `npm run security:secrets`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Handoff Notes

Start `DEN-238` next. It should adopt the fulfillment read/status route in lab and imaging screens without changing dispensing/treatment yet.
