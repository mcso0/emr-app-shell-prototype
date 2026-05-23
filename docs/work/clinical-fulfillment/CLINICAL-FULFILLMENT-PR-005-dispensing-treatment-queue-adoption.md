---
id: "CLINICAL-FULFILLMENT-PR-005"
status: "human_review"
area: "clinical-fulfillment"
priority: "P0"
target_pr: "Project 08 / DEN-239"
source_docs:
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/engineering/data-model/order-fulfillment-handoff-contract.md"
  - "docs/work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-003-chart-confirmation-sync.md"
dependencies:
  - "DEN-237"
  - "DEN-239"
updated: "2026-05-23"
---

# Add Dispensing Treatment Queue Server Read And Status Mutation

## Goal

Adopt the fulfillment work item route in the dispensing and treatment workspace while preserving the existing operator table, assignment, and grouped instruction UX.

## Scenario

1. A technician opens `/w/clair-demo/dispensing`.
2. The dispensing/treatment screen keeps rendering the existing demo queue immediately.
3. The screen reads server-backed fulfillment work items for `dispensing` and `treatment`.
4. Matching fulfillment status and assignee context are overlaid on the visible queue.
5. Existing actions such as assign/start/complete/return send status mutations through the fulfillment route.
6. If route read or mutation fails, the fixture-backed UI remains usable for the demo path.

## Scope

- Add a dispensing/treatment fulfillment queue read hook.
- Read both `dispensing` and `treatment` queue types from the shared fulfillment route.
- Map fulfillment statuses to existing queue status ids.
- Call the fulfillment status mutation route from existing start, complete, and return actions.
- Add focused Playwright coverage for route read and status mutation from the dispensing screen.
- Preserve the existing table, row, dropdown, history, and detail surfaces.

## Out Of Scope

- Inventory, lot/expiry, label printing, or pharmacy integration.
- Treatment device/provider integration.
- Billing candidate sync from fulfillment completion.
- Canonical order lifecycle sync from fulfillment completion.
- Remote Supabase migration push.
- Broad visual redesign.

## Done When

- Dispensing/treatment screens can read fulfillment work items and apply visible status context.
- Existing operator actions can call the fulfillment mutation route.
- Focused dispensing fulfillment coverage passes together with fulfillment server coverage.
- Docs/work, changelog, and closeout evidence are updated.
- Linear `DEN-239` is ready for Human Review.

## Verification

- `npx tsc --noEmit --pretty false`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3104 npx playwright test tests/dispensing-fulfillment.spec.ts tests/fulfillment-work-item-server.spec.ts`
- `npm run docs:check`
- `npm run security:secrets`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Handoff Notes

Start `DEN-240` next. It should connect fulfillment completion to order lifecycle and billing candidate sync now that lab, imaging, dispensing, and treatment screens can all speak to the shared fulfillment route.
