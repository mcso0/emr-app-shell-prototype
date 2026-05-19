---
id: "CLINICAL-BILLING-PR-007"
status: "human_review"
area: "clinical-billing"
priority: "P0"
target_pr: "Project 04 / DEN-72"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-003-chart-order-snapshot-bridge.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-006-diagnosis-persistence.md"
  - "docs/engineering/auth-security/auth-login/clinical-billing-persistence-scope.md"
  - "docs/engineering/auth-security/auth-login/clinical-order-billing-schema-migration.md"
  - "docs/product/demo-data/README.md"
  - "docs/product/demo-data/chart-order-application-v1.md"
  - "docs/product/demo-data/order-pricing-rules-v1.md"
dependencies:
  - "CLINICAL-BILLING-PR-003"
  - "CLINICAL-BILLING-PR-006"
updated: "2026-05-19"
---

# Order Draft Persistence

## Goal

Persist editable chart order draft table rows through a route-owned local-first boundary.

## Scope

- Add a route-backed order draft read/save boundary for chart encounters.
- Preserve mock/local fallback for the portfolio demo and Playwright default session.
- Enforce active workspace membership plus `chart:view`/`chart:update` permission in the server core.
- Validate encounter ownership through workspace-scoped encounter lookup.
- Save editable billing display name and quantity for existing chart-applied order rows.
- Recalculate line totals on the server from stored unit price snapshots.
- Support draft row removal for omitted rows that have not yet been linked to invoice lines.
- Add local-first Supabase RPCs for order draft read/write.
- Wire the chart editable order table `Order 업데이트` action to read and save through the route.

## Out Of Scope

- Order finalization, billing candidate issuance, invoice finalization, or payment state.
- Hospital-admin service catalog CRUD or order set CRUD conversion.
- Lab/imaging/dispensing external integrations.
- Final RLS policy hardening and audit event persistence beyond local-first `order_events` handoff.
- Remote Supabase push/link/query, production deploy, or real patient/hospital data.

## Done When

- Editable order billing name and quantity save through the route and read back.
- Server rejects invalid quantities and empty billing names.
- Server recalculates line totals rather than trusting client totals.
- Unauthorized mutation is denied.
- Encounter/workspace mismatch is denied.
- Mock fallback and synthetic demo-data boundaries remain intact.

## Handoff Notes

Ready for Human Review.

DEN-73 should continue from the DEN-100 chart-applied order snapshot contract for order confirmation/lifecycle persistence.

## Verification

- `npx playwright test tests/chart-order-draft-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/chart.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
