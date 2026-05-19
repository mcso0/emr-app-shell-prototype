---
id: "CLINICAL-BILLING-PR-014"
status: "human_review"
area: "clinical-billing"
priority: "P0"
target_pr: "Project 04 / DEN-79"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-012-invoice-line-billing-confirmation-persistence.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-013-payment-status-persistence.md"
updated: "2026-05-20"
---

# Billing Permission And Amount Integrity Regression

## Goal

Lock down billing mutation authorization, server-side amount recalculation, and invoice/payment status transitions with automated regression coverage.

## Scope

- Add focused billing security regression tests.
- Verify unauthorized billing mutation denial.
- Verify approved billing roles can update invoice lines.
- Verify client-submitted amount fields are ignored and totals are recalculated from stored server unit price.
- Verify payment state transitions remain explicit: `none` to `unpaid` to `paid`.

## Out Of Scope

- Payment provider contract tests.
- Finance/accounting export.
- Remote Supabase push/link/query, production deploy, or real patient/hospital data.

## Handoff Notes

Ready for Human Review.

Covered risk: client UI gating and client-calculated totals are not treated as the security boundary. Server route/core recalculation remains the source of truth.

## Verification

- `npx playwright test tests/billing-security-regression.spec.ts --reporter=line`
- `npx playwright test tests/billing.spec.ts --reporter=line`
