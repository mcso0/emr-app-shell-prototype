# Engineering Changelog

Use this file for small engineering-planning changes that do not need a standalone ADR or decision record.

## 2026-05-23

- `added`: Added DEN-241 end-to-end fulfillment handoff replay coverage from chart confirmation through queue completion, lifecycle readback, and billing candidate readback.
- `changed`: Connected DEN-240 fulfillment status updates back to order lifecycle and billing candidate sync with audit evidence.
- `changed`: Connected dispensing and treatment screens to fulfillment work item read/status mutation paths for DEN-239 while preserving fixture fallback.
- `changed`: Connected lab and imaging screens to fulfillment work item read/status mutation paths for DEN-238 while preserving fixture fallback.
- `changed`: Connected chart order confirmation to the DEN-236 fulfillment sync boundary for DEN-237 while keeping billing candidate submission separate.
- `added`: Added DEN-236 fulfillment work item route/core/gateway and local-first migration contract for downstream lab, imaging, dispensing, and treatment queue persistence.
- `added`: Added `docs/engineering/data-model/order-fulfillment-handoff-contract.md` for the DEN-235 fulfillment work item route/data/status/permission contract.

## 2026-05-03

- `added`: Adopted shared docs lifecycle and routing rules from `docs/_meta/`.
- `added`: Clarified that actual DB schema, ERD, migrations, RLS, indexes, and persistence contracts live in `docs/engineering/data-model/`.
