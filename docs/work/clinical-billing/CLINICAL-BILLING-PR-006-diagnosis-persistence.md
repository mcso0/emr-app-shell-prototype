---
id: "CLINICAL-BILLING-PR-006"
status: "human_review"
area: "clinical-billing"
priority: "P0"
target_pr: "Project 04 / DEN-71"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/clinical-billing-persistence-scope.md"
  - "docs/engineering/auth-security/auth-login/clinical-order-billing-schema-migration.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-005-chart-completion-persistence.md"
  - "docs/product/demo-data/README.md"
  - "docs/product/demo-data/diagnosis-catalog-v1.md"
dependencies:
  - "CLINICAL-BILLING-PR-005"
updated: "2026-05-19"
---

# Diagnosis Persistence

## Goal

Persist chart diagnosis rows through the same route-owned local-first boundary used by SOAP and chart completion.

## Scope

- Add a route-backed diagnosis read/save boundary for chart encounters.
- Preserve mock/local fallback for the portfolio demo and Playwright default session.
- Enforce active workspace membership plus `chart:view`/`chart:update` permission in the server core.
- Validate encounter ownership through workspace-scoped encounter lookup.
- Save catalog-linked and free-text diagnosis rows with diagnosis type, focus marker, and row order.
- Add local-first Supabase RPCs for diagnosis read/write.
- Wire the chart diagnosis panel to read persisted rows and save add/toggle/delete changes.

## Out Of Scope

- Real diagnosis catalog API, licensed terminology import, or automated diagnosis correctness.
- Order recommendation automation from diagnosis selection.
- Order persistence, billing candidate generation, invoice sync, or payment state.
- Final RLS policy hardening and audit log persistence.
- Remote Supabase push/link/query, production deploy, or real patient/hospital data.

## Done When

- Diagnosis rows save through the route and read back after reload.
- Catalog-linked and free-text rows keep type, focus marker, and row order.
- Unauthorized mutation is denied.
- Encounter/workspace mismatch is denied.
- Mock fallback and synthetic demo-data boundaries remain intact.

## Handoff Notes

Ready for Human Review.

DEN-72 should continue from the DEN-100 chart-applied order snapshot contract for editable order draft row persistence.

## Verification

- `npx playwright test tests/chart-diagnosis-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/chart.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
