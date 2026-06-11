---
id: "DEN-454"
status: "human_review"
area: "demo-data"
priority: "P0"
target_pr: "Linear DEN-454"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/index.md"
  - "docs/engineering/demo-data-architecture-2026-06-08.md"
  - "docs/engineering/data-model/demo-seed-inventory-readback-contract.md"
  - "docs/work/demo-data/DEMO-DB-PR-005-billing-checkout-session-family-seed-foundation.md"
  - "docs/completed/engineering/2026-06-09-demo-db-pr-005-billing-checkout-session-family-seed-report.html"
dependencies:
  - "UI-PR-002"
  - "DEN-452"
  - "DEN-453"
updated: "2026-06-09"
---

# Billing API-primary Invoice, Payment, and Checkout State

## Goal

Move the billing demo path from mock-only state toward API-primary invoice, payment, and checkout session readback without changing the schema, seed data, or production environment.

## Scope

- Inspect remaining mock/local billing state in `src/features/billing/store.ts` and `src/features/billing/module.tsx`.
- Let API invoice-line and payment-status snapshots update or insert billing store invoices, so route responses are not limited to preloaded mock invoice IDs.
- Keep Sales Demo and unconfigured local fallback behavior available.
- Add visible Playwright coverage proving the billing screen renders API-provided invoice number, payment status, line item, and checkout total.
- Extend the route-boundary E2E to verify payment-status PATCH persists on a later GET readback.

## Out Of Scope

- New seed data, schema changes, migrations, RLS changes, or remote Supabase work.
- Real payment provider, receipt, refund, settlement, or accounting integration.
- Full billing UX redesign.
- Complete removal of all mock fallback data across every billing surface.
- Production DB, production deploy, real hospital data, real patient data, real guardian data, or real payment data.

## Done Criteria

- Billing store snapshot application can accept API-returned invoices even when the ID was not already in the mock-backed store.
- The selected billing screen can display API-provided invoice-line and payment-status snapshots.
- Checkout workspace total can display the API-provided guardian checkout session payable amount.
- Payment status mutation is verified by a follow-up readback in the focused synthetic E2E.
- Documentation records that billing is API-primary for the core demo path while mock fallback remains intentionally available.

## Verification

- `npx playwright test tests/ui-demo-api-wiring-e2e.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`

## Result

DEN-454 makes the core billing demo path API-primary for invoice-line, payment-status, and checkout-session snapshots. The screen now accepts persisted snapshots into the billing store and the focused E2E proves that API values override fixture values in the visible UI. Mock fallback remains for Sales Demo and unconfigured local sessions.
