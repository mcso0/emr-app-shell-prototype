---
id: BILLING-PR-001
status: done
area: billing
priority: P1
target_pr: PR 1
created: 2026-05-06
updated: 2026-05-06
---

# Billing Workspace Restructure

## Goal

Restructure the billing workspace so it keeps the existing session-only billing behavior while matching the newer App Shell layout used by chart and lab screens.

## PR-Sized Scope

- Add an HTML wireframe under `docs/reference/billing/` for the redesigned billing workspace.
- Add `contentHeader` and `rightPanel` slots to the billing module.
- Keep the left billing queue, guardian billing groups, invoice combining, editable invoice quantities, payment method selection, and mock payment status actions.
- Move the payment summary and action hierarchy into the billing right panel.
- Update billing-focused regression tests and current source-of-truth docs.

## Out Of Scope

- Real payment gateway, receipt, VAT, partial payment, cash receipt, or refund approval integration.
- New billing domain types or persistent backend/API changes.
- Changes to dispensing/treatment, lab, reception, inpatient, or hospital admin behavior.

## Done Criteria

- Billing opens with module panel and right payment panel visible by default.
- Header shows patient, guardian, basic patient facts, invoice number, and billing status.
- The center workspace shows invoice context, guardian billing grouping, combine/split controls, and an editable invoice-line table.
- The right panel shows billing totals, readonly unsupported payment details, payment method selection, and billing actions.
- Existing billing session-only interactions still pass regression coverage.

## Source Docs

- `docs/engineering/current-status.md`
- `docs/engineering/architecture/app-shell-layout-contract.md`
- `docs/design/reference-screen-index.md`
- `docs/reference/billing/billing-workspace-wireframe.html`

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npx playwright test tests/billing.spec.ts tests/sales-demo-flow.spec.ts --reporter=line`
- Browser visual check for the HTML wireframe and `/w/clair-demo/billing?modulePanel=open&right=open&aside=closed`.
