---
id: "CLINICAL-BILLING-PR-015"
status: "human_review"
area: "clinical-billing"
priority: "P0"
target_pr: "Project 04 / DEN-80"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/reception/RECEPTION-LIVE-PR-013-chart-order-billing-handoff-closeout.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-014-billing-permission-amount-integrity-regression.md"
updated: "2026-05-20"
---

# Outpatient Persistence Regression

## Goal

Protect the core outpatient route-backed persistence path from chart note save through order confirmation, invoice candidate sync, and billing completion.

## Scope

- Add a focused outpatient persistence regression.
- Verify SOAP save and readback checkpoint.
- Verify order confirmation and readback checkpoint.
- Verify invoice candidate sync and readback checkpoint.
- Verify billing completion and payment-status readback checkpoint.
- Keep the existing sales demo golden path separate by using demo actor/client-session headers.

## Out Of Scope

- Full lab/imaging/dispensing live E2E.
- Performance/load testing.
- Remote Supabase push/link/query, production deploy, or real patient/hospital data.

## Handoff Notes

Ready for Human Review.

The new regression is API-level by design. It exercises the route-backed persistence contracts and keeps failure points visible by module checkpoint.

## Verification

- `npx playwright test tests/outpatient-persistence-regression.spec.ts --reporter=line`
- `npx playwright test tests/reception.spec.ts tests/chart.spec.ts tests/billing.spec.ts --reporter=line`
