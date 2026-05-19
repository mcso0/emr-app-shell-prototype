---
id: "CLINICAL-BILLING-PR-013"
status: "human_review"
area: "clinical-billing"
priority: "P0"
target_pr: "Project 04 / DEN-78"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-012-invoice-line-billing-confirmation-persistence.md"
  - "docs/engineering/auth-security/auth-login/clinical-order-billing-schema-migration.md"
  - "docs/product/demo-data/staff-roles-workflow-v1.md"
  - "docs/product/demo-data/seed-handoff-v1.md"
updated: "2026-05-20"
---

# Payment Status Persistence

## Goal

Persist selected payment method, unpaid state, and completed payment state without connecting a real payment provider.

## Scope

- Add `GET/PATCH /api/workspaces/[workspaceId]/billing/payment-status`.
- Enforce active workspace membership and `billing:view`/`billing:issue`.
- Validate invoice workspace ownership.
- Save selected payment method, unpaid reason, payment state, paid timestamp, and synthetic approved payment rows.
- Mark invoice `issued/unpaid` for unpaid handling and `paid/paid` for completed payment.
- Close the encounter to `completed` in the local-first RPC after completed payment.
- Connect billing UI payment method, unpaid, and completed actions to route-backed persistence.
- Keep external provider confirmation, accounting, and refund provider behavior out of scope.

## Out Of Scope

- PG transaction confirmation.
- Refund approval provider.
- Accounting settlement, receipt, cash receipt, or tax export.
- Remote Supabase push/link/query, production deploy, or real patient/hospital data.

## Handoff Notes

Ready for Human Review.

DEN-79 should continue from the persisted payment state and focus on the next Project 04 issue scope from Linear.

## Verification

- `npx playwright test tests/billing-payment-status-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/billing.spec.ts --reporter=line`
