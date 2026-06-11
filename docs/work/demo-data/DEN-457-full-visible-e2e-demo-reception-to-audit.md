---
id: "DEN-457"
status: "human_review"
area: "demo-data"
priority: "P0"
target_pr: "Linear DEN-457"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/index.md"
  - "docs/work/demo-data/UI-PR-001-reception-chart-api-wiring-e2e.md"
  - "docs/work/demo-data/UI-PR-002-fulfillment-billing-ui-wiring-e2e.md"
  - "docs/work/demo-data/DEN-456-dispensing-treatment-fulfillment-work-item-adoption.md"
dependencies:
  - "UI-PR-001"
  - "UI-PR-002"
  - "DEN-456"
updated: "2026-06-11"
---

# Full Visible E2E Demo: Reception To Audit

## Goal

Add a visible Playwright demo that proves the outpatient flow can be exercised from reception through chart queue, fulfillment work, lab result entry, billing checkout, and audit review.

## Scope

- Review the existing UI PR 1/2 E2E and seed readback contract.
- Add a single visible day-in-clinic test that navigates through reception, chart, lab, dispensing, billing, and audit surfaces.
- Require API boundary calls in the final assertion so a mock-only static UI path cannot satisfy the test.
- Keep the existing route-boundary API test and seed readback contract intact.
- Use deterministic synthetic data only.

## Out Of Scope

- New seed data.
- DB schema, migration, or RLS changes.
- Visual redesign.
- Production E2E, remote Supabase, or real customer/provider data.

## Done Criteria

- The visible E2E test includes reception, chart queue, fulfillment/lab work, billing checkout, and audit review.
- The test asserts API boundary calls for each major stage.
- Seed readback contract still passes.
- The work remains local/dev/test scoped.

## Verification

- `npx playwright test tests/ui-demo-api-wiring-e2e.spec.ts --reporter=line`
- `npx playwright test tests/demo-seed-inventory-readback-contract.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run docs:check`
- `npm run security:secrets`

## Result

DEN-457 adds a visible day-in-clinic E2E scenario to `tests/ui-demo-api-wiring-e2e.spec.ts`. The scenario walks the UI through reception, chart queue, lab result entry, dispensing fulfillment readback, billing checkout, and audit review while asserting that the relevant API boundaries were consumed.
