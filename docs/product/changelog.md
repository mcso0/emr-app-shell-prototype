# Product Changelog

Use this file for small product-planning changes that do not need a standalone decision record.

## 2026-05-23

- `changed`: Lab and imaging queues now read fulfillment work item status context and send status mutations through the shared fulfillment route for DEN-238.
- `changed`: Chart order confirmation now produces server-side fulfillment work items for downstream queue adoption in DEN-237.
- `changed`: Added the DEN-236 server-backed fulfillment work item foundation while keeping downstream screen adoption and billing sync as explicit follow-up scope.
- `added`: Added `docs/product/domain/order-fulfillment-handoff.md` for the DEN-235 chart-confirmed order to downstream fulfillment handoff product contract.

## 2026-05-03

- `added`: Adopted shared docs lifecycle and routing rules from `docs/_meta/`.
- `added`: Split DB planning guidance between `docs/product/domain/` and `docs/engineering/data-model/`.
