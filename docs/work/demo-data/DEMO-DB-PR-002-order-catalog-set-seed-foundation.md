---
id: "DEMO-DB-PR-002"
status: "human_review"
area: "demo-data"
priority: "P0"
target_pr: "Demo DB PR 2"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/index.md"
  - "docs/engineering/demo-data-architecture-2026-06-08.md"
  - "docs/engineering/data-model/demo-seed-inventory-readback-contract.md"
dependencies:
  - "DEMO-DB-PR-001"
updated: "2026-06-09"
---

# Order Catalog And Order Set Seed Foundation

## Goal

Seed the minimum deterministic `clair-demo` order catalog and order set foundation needed for local/dev demo DB readback without changing UI code.

## Scope

- Confirm the `order_catalog_items`, `order_sets`, and `order_set_items` schema and chart-search RPC shape.
- Add synthetic deterministic `order_catalog_items` rows mapped to existing DEN-194 service item/order meanings.
- Add one compact Kong vomiting set and one compact Mango wellness set.
- Add included-order rows for those sets.
- Move order catalog and set readback checks from known gap to baseline-required.
- Update the seed inventory/readback contract and focused static test.

## Out Of Scope

- UI rewiring.
- Remote Supabase, production DB, migration push, or staging replay.
- Real hospital, patient, guardian, staff, billing, or medical data.
- `order_fulfillment_work_items` seed/generation.
- `lab_test_categories`, `lab_test_items`, or `order_catalog_lab_test_item_links` seed.
- Billing checkout session family seed.

## Done Criteria

- `supabase/seed.sql` has idempotent order catalog, order set, and order set item seed rows.
- `supabase/snippets/demo_seed_inventory_readback.sql` requires catalog and set rows as baseline.
- `tests/demo-seed-inventory-readback-contract.spec.ts` fails if catalog/set seed is removed.
- The engineering seed contract separates resolved catalog/set gaps from remaining fulfillment/lab/billing gaps.
- Verification commands are recorded.

## Verification

- `npx playwright test tests/demo-seed-inventory-readback-contract.spec.ts --reporter=line`
- `npm run docs:check`
- `npm run security:secrets`
- Local DB readback SQL if Docker and `psql` are available.

## Result

Seeded nine synthetic order catalog rows, two compact order sets, and five included-order rows for `clair-demo`. The remaining demo DB seed gaps are fulfillment work items, lab result-sheet catalog/linkage rows, and optional billing checkout session rows.
