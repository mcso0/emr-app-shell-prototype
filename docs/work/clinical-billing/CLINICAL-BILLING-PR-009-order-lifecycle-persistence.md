---
id: "CLINICAL-BILLING-PR-009"
status: "human_review"
area: "clinical-billing"
priority: "P0"
target_pr: "Project 04 / DEN-74"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-008-order-action-persistence.md"
  - "docs/engineering/auth-security/auth-login/clinical-billing-persistence-scope.md"
  - "docs/engineering/auth-security/auth-login/clinical-order-billing-schema-migration.md"
  - "docs/product/demo-data/chart-order-application-v1.md"
dependencies:
  - "CLINICAL-BILLING-PR-008"
updated: "2026-05-19"
---

# Order Lifecycle Persistence

## Goal

Persist minimal order lifecycle status changes that chart, billing, and downstream modules can share.

## Scope

- Add a route-backed order lifecycle read/save boundary for chart encounters.
- Preserve mock/local fallback for the portfolio demo and Playwright default session.
- Enforce active workspace membership plus `chart:view`/`chart:update` permission in the server core.
- Validate encounter ownership and order ownership through workspace-scoped lookups.
- Persist MVP lifecycle statuses: `requested`, `re_requested`, `in_progress`, `completed`, `cancelled`.
- Reject invalid transitions on the server.
- Add local-first Supabase RPCs for lifecycle read/write.

## Out Of Scope

- Device/PACS integration.
- Full lab/imaging/dispensing result persistence.
- Advanced workflow automation.
- Invoice/payment finalization.
- Remote Supabase push/link/query, production deploy, or real patient/hospital data.

## Handoff Notes

Ready for Human Review.

DEN-75 can use this status source plus DEN-73 billing candidate state when generating invoice candidates.

## Verification

- `npx playwright test tests/chart-order-lifecycle-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/chart.spec.ts tests/billing.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
