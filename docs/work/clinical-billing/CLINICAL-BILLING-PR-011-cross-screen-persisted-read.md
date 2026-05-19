---
id: "CLINICAL-BILLING-PR-011"
status: "human_review"
area: "clinical-billing"
priority: "P0"
target_pr: "Project 04 / DEN-76"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-010-invoice-candidate-sync.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-009-order-lifecycle-persistence.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-008-order-action-persistence.md"
updated: "2026-05-20"
---

# Cross-Screen Persisted Read

## Goal

Make chart and billing screens read the same persisted order and invoice candidate state.

## Scope

- Chart order summary loads persisted order action and lifecycle status overlays.
- Billing workspace loads invoice candidate overlays from the DEN-75 reader route.
- Billing invoice totals are recalculated from the merged persisted candidate line view.
- Mock fallback and existing sales demo billing flow remain intact.

## Out Of Scope

- Payment completion mutation.
- Chart editor changes.
- External module integration.
- Remote Supabase push/link/query, production deploy, or real patient/hospital data.

## Handoff Notes

Ready for Human Review.

DEN-77 can build invoice line edit and billing confirmation writes on top of this shared read surface.

## Verification

- `npx playwright test tests/chart.spec.ts tests/billing.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
