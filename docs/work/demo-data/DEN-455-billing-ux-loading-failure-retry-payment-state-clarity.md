---
id: "DEN-455"
status: "human_review"
area: "demo-data"
priority: "P0"
target_pr: "Linear DEN-455"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/index.md"
  - "docs/work/demo-data/DEN-454-billing-api-primary-invoice-payment-checkout-state.md"
dependencies:
  - "DEN-454"
updated: "2026-06-09"
---

# Billing UX Loading, Failure, Retry, and Payment State Clarity

## Goal

Make the API-primary billing screen show understandable loading, failure, retry, and permission states for invoice lines, payment status, and checkout session preparation.

## Scope

- Track invoice-line and payment-status read states in the billing workspace data hook.
- Surface loading, retryable failure, permission denial, and empty API response states in the central billing workspace.
- Track checkout session preparation state and expose retry for checkout preparation failures.
- Keep existing fixture fallback visible only with an explicit API-state notice when readback fails or is empty.
- Add focused Playwright coverage for:
  - retryable invoice-line API read failure and recovery
  - permission denial distinct from retryable failure
  - checkout session failure and retry recovery

## Out Of Scope

- Real PG/Stripe or receipt/refund/settlement/accounting integration.
- DB schema, migration, seed, or RLS changes.
- Billing UX redesign beyond state clarity and retry affordances.
- Full removal of Sales Demo or unconfigured local fallback behavior.

## Done Criteria

- Billing staff can see whether billing API data is loading, blocked by permission, retryable after failure, or empty.
- Retryable failures expose visible retry actions.
- Permission errors do not look like normal network retries.
- Checkout session failure has its own visible retry path.
- Focused UI/E2E assertions cover the new states.

## Verification

- `npx playwright test tests/ui-demo-api-wiring-e2e.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`

## Result

DEN-455 adds visible API state handling for the billing demo path. Invoice/payment reads now expose loading, permission, retryable failure, and empty states, while checkout preparation has its own status and retry affordance. Mock fallback remains available but is no longer silent when the API readback path fails.
