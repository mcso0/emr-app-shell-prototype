---
id: BILLING-CLOSEOUT-2026-05-06-WORKSPACE-RESTRUCTURE
status: completed
area: billing
doc_type: closeout
related_work:
  - docs/work/billing/BILLING-PR-001-billing-workspace-restructure.md
last_updated: 2026-05-06
---

# Billing Workspace Restructure Closeout

## Summary

The billing workspace now uses the same App Shell slot pattern as the newer chart and lab screens. Billing has a patient context header, a center invoice workspace, and a right-side payment summary/action panel while preserving the existing session-only billing interactions.

## Changes

- Added the HTML wireframe at `docs/reference/billing/billing-workspace-wireframe.html`.
- Added a billing work item at `docs/work/billing/BILLING-PR-001-billing-workspace-restructure.md`.
- Added `BillingHeader` and `BillingRightPanel` to the billing module registry.
- Moved payment totals, readonly unsupported payment details, payment method selection, and billing actions into the right panel.
- Kept the waiting/unpaid/closed queue, invoice selection, guardian billing groups, combine/split controls, editable invoice quantities, and mock status actions.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npx playwright test tests/billing.spec.ts tests/sales-demo-flow.spec.ts --reporter=line`
- Browser visual checks:
  - `docs/reference/billing/billing-workspace-wireframe.html`
  - `/w/clair-demo/billing?modulePanel=open&right=open&aside=closed`
  - `/w/clair-demo/billing?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&invoiceId=invoice-kong-260501&modulePanel=open&right=open`

## Notes

- The chat-provided reference image was used as a visual workflow reference only and was not saved as a persistent binary reference asset.
- Real PG, receipt, VAT, partial payment, and refund approval flows remain out of scope.
