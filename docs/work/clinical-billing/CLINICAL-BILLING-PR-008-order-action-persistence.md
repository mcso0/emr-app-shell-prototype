---
id: "CLINICAL-BILLING-PR-008"
status: "human_review"
area: "clinical-billing"
priority: "P0"
target_pr: "Project 04 / DEN-73"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-003-chart-order-snapshot-bridge.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-007-order-draft-persistence.md"
  - "docs/engineering/auth-security/auth-login/clinical-billing-persistence-scope.md"
  - "docs/engineering/auth-security/auth-login/clinical-order-billing-schema-migration.md"
  - "docs/product/demo-data/README.md"
  - "docs/product/demo-data/chart-order-application-v1.md"
  - "docs/product/demo-data/order-pricing-rules-v1.md"
dependencies:
  - "CLINICAL-BILLING-PR-003"
  - "CLINICAL-BILLING-PR-007"
updated: "2026-05-19"
---

# Order Action Persistence

## Goal

Persist selected chart order confirmation and billing submit actions through a route-owned local-first boundary.

## Scope

- Add a route-backed order action read/save boundary for chart encounters.
- Preserve mock/local fallback for the portfolio demo and Playwright default session.
- Enforce active workspace membership plus `chart:view`/`chart:update` permission in the server core.
- Validate encounter ownership and selected order ownership through workspace-scoped lookups.
- Save `Order 확정` as order confirmation status, actor, and timestamp.
- Save `Order 청구` as billing candidate status and billing sync hook point without finalizing invoices.
- Keep order confirmation state separate from billing candidate state.
- Add local-first Supabase RPCs for order action read/write.
- Wire the chart confirmation dialog confirm action to save through the route.

## Out Of Scope

- Billing invoice finalization, payment state, or actual invoice issuance.
- Full audit persistence rollout beyond local-first `order_events` handoff.
- External order delivery to lab, imaging, pharmacy, or equipment systems.
- Hospital-admin service catalog CRUD or order set CRUD conversion.
- Remote Supabase push/link/query, production deploy, or real patient/hospital data.

## Done When

- Selected order confirmation state saves through the route and reads back after reload.
- Billing submit creates a billing candidate state without changing invoice/payment state.
- Unauthorized mutation is denied.
- Encounter/workspace/order mismatch is denied.
- Mock fallback and synthetic demo-data boundaries remain intact.

## Handoff Notes

Ready for Human Review.

DEN-75 can consume the billing candidate status and `billing_candidate_id` hook point when invoice candidate generation starts.

## Verification

- `npx playwright test tests/chart-order-action-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/chart.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
