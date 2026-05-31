# Product Changelog

Use this file for small product-planning changes that do not need a standalone decision record.

## 2026-05-31

- `changed`: DEN-336 through DEN-339 connect chart `Order 청구` directly to billing candidate creation without draft-save dependency, add unfinished-order confirmation copy, and remove the table-level veterinarian billing gate.
- `changed`: DEN-335 separates order work state from billing candidate state. Chart `Order 청구` can move selected billable lab, imaging, dispensing, and treatment orders to billing candidates, while unfinished work requires explicit confirmation instead of blocking billing by default.

## 2026-05-25

- `changed`: Clarified the Order Platform implementation guardrail after DEN-291: app/UI/API/core implementation, local tests, repo migration file authoring, and local migration/static tests are allowed for scoped implementation issues, while remote Supabase application, remote RLS replay, production deploy, and real data import remain approval-gated.
- `added`: Added `docs/product/domain/workspace-order-catalog-platform.md` for DEN-280, fixing the MVP policy for CLAiR presets, workspace catalog customization, hospital-admin-only phase-1 management, use-stop behavior, immediate future price changes with historical snapshots, routing/billing gates, order set deferral, and CSV template-only scope.

## 2026-05-23

- `changed`: Lab and imaging queues now read fulfillment work item status context and send status mutations through the shared fulfillment route for DEN-238.
- `changed`: Chart order confirmation now produces server-side fulfillment work items for downstream queue adoption in DEN-237.
- `changed`: Added the DEN-236 server-backed fulfillment work item foundation while keeping downstream screen adoption and billing sync as explicit follow-up scope.
- `added`: Added `docs/product/domain/order-fulfillment-handoff.md` for the DEN-235 chart-confirmed order to downstream fulfillment handoff product contract.

## 2026-05-03

- `added`: Adopted shared docs lifecycle and routing rules from `docs/_meta/`.
- `added`: Split DB planning guidance between `docs/product/domain/` and `docs/engineering/data-model/`.
