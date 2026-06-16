---
id: "UI-PR-002"
status: "human_review"
area: "demo-data"
priority: "P0"
target_pr: "UI PR 2"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/index.md"
  - "docs/engineering/demo-data-architecture-2026-06-08.md"
  - "docs/engineering/data-model/demo-seed-inventory-readback-contract.md"
  - "docs/work/demo-data/UI-PR-001-reception-chart-api-wiring-e2e.md"
dependencies:
  - "DEMO-DB-PR-001"
  - "DEMO-DB-PR-002"
  - "DEMO-DB-PR-003"
  - "DEMO-DB-PR-004"
  - "DEMO-DB-PR-005"
  - "UI-PR-001"
updated: "2026-06-09"
---

# Fulfillment and Billing UI Wiring E2E

## Goal

Extend the post-seed UI/API adoption phase past reception/chart by proving downstream fulfillment, lab result-sheet, billing checkout, and audit review boundaries with deterministic synthetic data.

## Scope

- Add a lab result-sheet catalog API route that reads seeded `lab_test_categories`, `lab_test_items`, and `order_catalog_lab_test_item_links` for Supabase sessions and returns deterministic synthetic fallback rows in mock mode.
- Add a local/dev server-boundary lab result entry route so visible result inputs can be saved without adding schema or seed rows.
- Make lab/imaging mock-runtime queues append API-only fulfillment work items when they do not match existing fixtures.
- Hydrate empty live lab result rows from the result-sheet catalog route.
- Extend Playwright coverage for:
  - lab fulfillment queue item rendering
  - seeded CBC result-sheet row display
  - lab result entry save boundary
  - treatment/dispensing fulfillment route transitions
  - billing checkout UI boundary
  - hospital-admin audit review UI boundary
- Preserve existing Sales Demo fixture fallback.

## Out Of Scope

- Seed expansion, schema changes, migrations, RLS changes, or remote Supabase work.
- Durable DB persistence for entered lab result values; this PR only adds a local/dev server-boundary save proof.
- Full removal of mock-first billing store state.
- Dispensing/treatment execution screen refactor. The existing screen can read/update fulfillment routes, but full visible-control stability remains a later UI work item.
- Payment provider, receipt, refund, accounting, settlement, or production integration.
- Real hospital, patient, guardian, payment, or clinical data.

## Done Criteria

- Lab result input can display seeded CBC/urinalysis catalog rows for live fulfillment work items.
- Lab result save button crosses a server route and reports success/failure in the UI.
- Route-boundary E2E covers lab catalog/read-save, fulfillment status transitions across lab/imaging/treatment/dispensing, billing checkout/payment, and audit.
- Visible UI E2E covers lab result-sheet input, billing checkout route consumption, and audit review route consumption.
- Current status and seed contract docs identify remaining adoption work honestly.

## Verification

- `npx playwright test tests/ui-demo-api-wiring-e2e.spec.ts --reporter=line`
- `npx playwright test tests/demo-seed-inventory-readback-contract.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run docs:check`
- `npm run security:secrets`

## Result

UI PR 2 does not change seed or schema. It closes the most important downstream result-sheet UI gap by connecting live lab work items to the seeded lab catalog, adds a local/dev result-entry server boundary, and expands E2E coverage through fulfillment, billing checkout, and audit review. Some visible screens remain mock-first and should be handled by later focused UI refactors.
