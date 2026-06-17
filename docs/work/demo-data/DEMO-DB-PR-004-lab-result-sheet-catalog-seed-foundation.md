---
id: "DEMO-DB-PR-004"
status: "human_review"
area: "demo-data"
priority: "P0"
target_pr: "Demo DB PR 4"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/index.md"
  - "docs/engineering/demo-data-architecture-2026-06-08.md"
  - "docs/engineering/data-model/demo-seed-inventory-readback-contract.md"
dependencies:
  - "DEMO-DB-PR-001"
  - "DEMO-DB-PR-002"
  - "DEMO-DB-PR-003"
updated: "2026-06-09"
---

# Lab Result-Sheet Catalog Seed Foundation

## Goal

Seed the minimum deterministic `clair-demo` lab result-sheet catalog foundation needed for local/dev demo DB readback without changing UI code.

## Scope

- Confirm the `lab_test_categories`, `lab_test_items`, and `order_catalog_lab_test_item_links` schema contract.
- Add synthetic deterministic categories for Hematology and Urinalysis.
- Add CBC and urinalysis result item rows with stable IDs.
- Link the existing CBC and urinalysis order catalog rows to those result item rows.
- Move lab result-sheet catalog readback checks from known gap to baseline-required.
- Add result-sheet coverage to the readback SQL.
- Update the seed inventory/readback contract and focused static test.

## Out Of Scope

- UI rewiring.
- Remote Supabase, production DB, migration push, or staging replay.
- Real hospital, patient, guardian, staff, billing, or medical data.
- Real lab result values, reference ranges, device/PACS/provider integrations, or clinical accuracy claims.
- Billing checkout session family seed.

## Done Criteria

- `supabase/seed.sql` has idempotent category, item, and catalog-link seed rows for CBC and urinalysis.
- `supabase/snippets/demo_seed_inventory_readback.sql` requires lab result-sheet catalog rows as baseline and reports per-order result-sheet coverage.
- `tests/demo-seed-inventory-readback-contract.spec.ts` fails if lab result-sheet seed rows are removed.
- The engineering seed contract separates resolved lab result-sheet coverage from remaining billing checkout gap.
- Verification commands are recorded.

## Verification

- `npx playwright test tests/demo-seed-inventory-readback-contract.spec.ts --reporter=line`
- `npm run docs:check`
- `npm run security:secrets`
- Local DB readback SQL if Docker and `psql` are available.

## Result

Seeded two synthetic lab categories, eight lab result items, and eight catalog-to-result-sheet links for `clair-demo`: four CBC fields and four urinalysis fields. The remaining demo DB seed gap is the optional billing checkout session family.
