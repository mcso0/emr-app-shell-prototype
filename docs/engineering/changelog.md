# Engineering Changelog

Use this file for small engineering-planning changes that do not need a standalone ADR or decision record.

## 2026-05-31

- `changed`: DEN-336 through DEN-339 make chart `Order 청구` call the invoice candidate sync gateway, preserve operational order status during billing advance, and add focused regressions for incomplete and completed order billing flows.
- `changed`: DEN-335 updates the fulfillment/billing engineering contract so chart `Order 청구` is the trusted billing candidate action and must preserve order/fulfillment work status while using server-owned billing snapshots.

## 2026-05-27

- `fixed`: Reworked DEN-290 Order Platform replay blockers by mapping random mock UI sessions to server demo actors, sharing the mock order catalog gateway per demo client session, and adding end-to-end replay coverage for admin catalog create/update/use-stop, chart catalog confirmation, fulfillment routing, billing candidate sync, and snapshot preservation.

## 2026-05-26

- `added`: Completed DEN-289 Order Platform security review, documenting public billing snapshot trust-boundary findings, live gateway fallback risk, treatment queue permission ambiguity, and catalog mutation audit gaps.
- `changed`: Synced DEN-288 billable order snapshots into billing candidates from server-owned applied snapshots, including billing-only chart confirmation, duplicate prevention, non-billable skips, returned-order blocking, and lab/imaging vet-review billing holds.
- `changed`: Routed DEN-287 catalog-confirmed chart order snapshots into downstream fulfillment work item queues for lab, imaging, dispensing, and treatment while preserving idempotent `fulfill-{orderId}` creation and minimal server-owned source snapshots.
- `changed`: Added DEN-286 server-owned catalog snapshot persistence for chart order confirmation, preserving active workspace catalog names, billing fields, destination, quantity, and price snapshots while rejecting paused catalog rows and deferred order sets.
- `changed`: Connected DEN-285 chart `+ Order` selection to the active workspace catalog chart-search route, including candidate search, active-only catalog rows/order sets, patient species filtering, and draft row population with display, billing, instruction, and price candidates.
- `changed`: Connected DEN-284 hospital-admin Order drawer create, update, and use-stop actions to the workspace catalog mutation route, preserving saved local drafts across catalog reloads and adding focused drawer mutation regression coverage.

## 2026-05-25

- `changed`: Connected the DEN-283 hospital-admin Order management table to the workspace-scoped order catalog read route, preserving session seed fallback and expanding the UI category model for the first-scope order areas.
- `changed`: Implemented the DEN-282 local-first preset initialization and auto-merge boundary in hospital-admin order catalog core, including source tracking metadata, deterministic demo seed preservation, and focused regression coverage.
- `added`: Added `docs/engineering/data-model/order-catalog-preset-initialization-contract.md` for DEN-281, defining system preset fields, workspace catalog source tracking, idempotent initialization, conservative auto-merge behavior, customization protection, mock/demo seed rules, and DEN-282 implementation boundaries.

## 2026-05-23

- `added`: Added DEN-242 Project 08 clinical fulfillment closeout and staging readiness evidence.
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
