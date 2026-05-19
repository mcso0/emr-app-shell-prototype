---
id: "CLINICAL-BILLING-PR-012"
status: "human_review"
area: "clinical-billing"
priority: "P0"
target_pr: "Project 04 / DEN-77"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-010-invoice-candidate-sync.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-011-cross-screen-persisted-read.md"
  - "docs/engineering/auth-security/auth-login/clinical-order-billing-schema-migration.md"
  - "docs/product/demo-data/README.md"
  - "docs/product/demo-data/order-pricing-rules-v1.md"
updated: "2026-05-20"
---

# Invoice Line And Billing Confirmation Persistence

## Goal

Persist billing invoice line quantity edits and billing confirmation state through a route-backed local-first boundary.

## Scope

- Add `GET/PATCH /api/workspaces/[workspaceId]/billing/invoice-lines`.
- Enforce active workspace membership and `billing:view`/`billing:issue`.
- Validate invoice ownership and invoice-line ownership inside the selected workspace.
- Recalculate line totals, invoice subtotal, and invoice total on the server side.
- Store billing confirmation status with actor and timestamp.
- Connect billing UI quantity edits and `청구 확정` to the route-backed boundary with pending/success/error state.
- Keep mock fallback separated by demo actor so route tests do not leak into the default sales demo session.
- Add local-first Supabase RPCs for invoice line read/save.

## Out Of Scope

- PG/payment provider integration.
- Receipt, cash receipt, tax settlement, or accounting export.
- Refund workflow and payment completion persistence.
- Remote Supabase push/link/query, production deploy, or real patient/hospital data.

## Handoff Notes

Ready for Human Review.

DEN-78 can build payment status persistence on top of the invoice-issued state from this route.

## Verification

- `npx playwright test tests/billing-invoice-line-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/billing.spec.ts --reporter=line`
