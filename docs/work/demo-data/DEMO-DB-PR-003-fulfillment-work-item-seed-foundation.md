---
id: "DEMO-DB-PR-003"
status: "human_review"
area: "demo-data"
priority: "P0"
target_pr: "Demo DB PR 3"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/index.md"
  - "docs/engineering/demo-data-architecture-2026-06-08.md"
  - "docs/engineering/data-model/demo-seed-inventory-readback-contract.md"
dependencies:
  - "DEMO-DB-PR-001"
  - "DEMO-DB-PR-002"
updated: "2026-06-09"
---

# Fulfillment Work Item Seed Foundation

## Goal

Seed the minimum deterministic `clair-demo` fulfillment work item foundation needed for local/dev demo DB readback without changing UI code.

## Scope

- Confirm the `order_fulfillment_work_items` schema and fulfillment RPC contract.
- Add synthetic deterministic fulfillment work item rows mapped one-to-one to the existing DEN-194 chart orders.
- Cover lab, imaging, treatment, and dispensing queues across `kong-vomit`, `nabi-urinary`, `bori-allergy`, `mango-wellness`, and `choco-rehab`.
- Move fulfillment work item readback checks from known gap to baseline-required.
- Add queue-type coverage to the readback SQL.
- Update the seed inventory/readback contract and focused static test.

## Out Of Scope

- UI rewiring.
- Remote Supabase, production DB, migration push, or staging replay.
- Real hospital, patient, guardian, staff, billing, or medical data.
- `lab_test_categories`, `lab_test_items`, or `order_catalog_lab_test_item_links` seed.
- Billing checkout session family seed.

## Done Criteria

- `supabase/seed.sql` has idempotent `order_fulfillment_work_items` seed rows for DEN-194 orders.
- `supabase/snippets/demo_seed_inventory_readback.sql` requires fulfillment work items as baseline and reports queue-type coverage.
- `tests/demo-seed-inventory-readback-contract.spec.ts` fails if fulfillment seed rows are removed.
- The engineering seed contract separates resolved fulfillment seed coverage from remaining lab/billing gaps.
- Verification commands are recorded.

## Verification

- `npx playwright test tests/demo-seed-inventory-readback-contract.spec.ts --reporter=line`
- `npm run docs:check`
- `npm run security:secrets`
- Local DB readback SQL if Docker and `psql` are available.

## Result

Seeded eleven synthetic fulfillment work item rows for `clair-demo`: two lab, three imaging, four treatment, and two dispensing queue items. The remaining demo DB seed gaps are lab result-sheet catalog/link rows and optional billing checkout session rows.
