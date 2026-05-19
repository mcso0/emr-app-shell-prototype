---
id: "CLINICAL-BILLING-PR-003"
status: "human_review"
area: "clinical-billing"
priority: "P0"
target_pr: "Project 04 / DEN-100"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/clinical-order-billing-schema-migration.md"
  - "docs/product/demo-data/chart-order-application-v1.md"
  - "docs/product/demo-data/order-pricing-rules-v1.md"
  - "docs/product/demo-data/seed-handoff-v1.md"
dependencies:
  - "CLINICAL-BILLING-PR-002"
updated: "2026-05-19"
---

# Chart Order Snapshot Bridge

## Goal

Bridge the DEN-68 Project 04 order schema to the DEN-99 chart-applied order data contract before route-backed order draft, confirmation, and billing candidate work begins.

## Scope

- Add a local-first migration that extends `orders` with chart-applied row hierarchy, source IDs, applied snapshots, calculation sources, confirmation state, billing candidate state, and task state.
- Add invoice-line handoff snapshot columns needed to preserve billing names, candidate IDs, tax state, non-tax reason, and adjustment reason.
- Keep hospital-admin order catalog CRUD, order set CRUD, lab item CRUD, and medication/vaccine catalog metadata in separate projects.
- Add static migration tests that verify fields, constraints, workspace-scoped links, and no policy/secrets leakage.

## Out Of Scope

- Route handler implementation.
- UI persistence wiring.
- Full hospital-admin order catalog conversion.
- Real medical advice, real patient/hospital data, remote Supabase, or production deploy.

## Done When

- DEN-72 can save chart-applied order rows with source/snapshot/calculation fields.
- DEN-73 can treat order confirmation separately from billing candidate status.
- DEN-75 can generate invoice candidates without trusting client totals or current mutable catalog values.
- Docs and Linear handoff notes point to this bridge as the Project 04 boundary.

## Handoff Notes

Ready for Human Review.

DEN-72/73/75 can consume `orders` as the chart-applied order line table. The hospital-admin catalog source remains a later Project 07 concern; Project 04 should store source IDs and snapshots, not mutate catalog master rows.

## Verification

- `npx playwright test tests/chart-order-snapshot-bridge-migration.spec.ts --reporter=line`
- `npm run docs:check`
- `npm run security:secrets`
