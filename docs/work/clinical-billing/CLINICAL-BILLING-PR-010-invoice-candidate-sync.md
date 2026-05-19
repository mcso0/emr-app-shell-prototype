---
id: "CLINICAL-BILLING-PR-010"
status: "human_review"
area: "clinical-billing"
priority: "P0"
target_pr: "Project 04 / DEN-75"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-003-chart-order-snapshot-bridge.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-008-order-action-persistence.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-009-order-lifecycle-persistence.md"
  - "docs/engineering/auth-security/auth-login/clinical-billing-persistence-scope.md"
  - "docs/engineering/auth-security/auth-login/clinical-order-billing-schema-migration.md"
  - "docs/product/demo-data/chart-order-application-v1.md"
  - "docs/product/demo-data/order-pricing-rules-v1.md"
dependencies:
  - "CLINICAL-BILLING-PR-003"
  - "CLINICAL-BILLING-PR-008"
  - "CLINICAL-BILLING-PR-009"
updated: "2026-05-20"
---

# Invoice Candidate Sync

## Goal

Sync confirmed chart order rows into billing invoice candidate lines without finalizing invoice or payment state.

## Scope

- Add a route-backed billing invoice candidate read/sync boundary.
- Preserve mock/local fallback for the portfolio demo and Playwright default session.
- Enforce active workspace membership, `billing:view` for read, and `billing:issue` for sync.
- Validate encounter ownership and selected order ownership through workspace-scoped lookups.
- Generate candidate line data from server-owned order/invoice snapshots.
- Guard duplicate candidate generation for the same invoice/order pair.
- Prepare a billing reader route for DEN-76 cross-screen read work.
- Add local-first Supabase RPCs for candidate read/sync.

## Out Of Scope

- Payment status persistence.
- Discount/refund advanced rules.
- Service catalog admin live conversion.
- Invoice finalization or actual payment provider work.
- Remote Supabase push/link/query, production deploy, or real patient/hospital data.

## Handoff Notes

Ready for Human Review.

DEN-76 can consume `GET /api/workspaces/[workspaceId]/billing/invoice-candidates` and the candidate line contract when chart and billing screens are wired to the same persisted source.

## Verification

- `npx playwright test tests/billing-invoice-candidate-sync-server.spec.ts --reporter=line`
- `npx playwright test tests/chart.spec.ts tests/billing.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
