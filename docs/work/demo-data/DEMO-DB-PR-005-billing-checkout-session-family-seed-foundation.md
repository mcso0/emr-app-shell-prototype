---
id: "DEMO-DB-PR-005"
status: "human_review"
area: "demo-data"
priority: "P0"
target_pr: "Demo DB PR 5"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/index.md"
  - "docs/engineering/demo-data-architecture-2026-06-08.md"
  - "docs/engineering/data-model/demo-seed-inventory-readback-contract.md"
dependencies:
  - "DEMO-DB-PR-001"
  - "DEMO-DB-PR-002"
  - "DEMO-DB-PR-003"
  - "DEMO-DB-PR-004"
updated: "2026-06-09"
---

# Billing Checkout Session Family Seed Foundation

## Goal

Seed the minimum deterministic `clair-demo` billing checkout session family needed for local/dev demo DB readback without changing UI code.

## Scope

- Confirm the `billing_checkout_sessions`, `billing_checkout_session_invoices`, and `payment_allocations` schema contract.
- Add synthetic deterministic paid checkout sessions for existing Nabi card and Mango cash payment scenarios.
- Add invoice snapshot rows linked to the seeded paid invoices.
- Add payment allocation rows linked to the seeded approved payments.
- Move billing checkout session readback checks from known gap to baseline-required.
- Add checkout-session coverage to the readback SQL.
- Update the seed inventory/readback contract and focused static test.

## Out Of Scope

- UI rewiring.
- Remote Supabase, production DB, migration push, or staging replay.
- Real hospital, patient, guardian, staff, billing, payment, or identity data.
- Payment provider, receipt, refund, settlement, accounting, or production payment confirmation.
- Broad billing workflow refactor.

## Done Criteria

- `supabase/seed.sql` has idempotent checkout session, session invoice, and payment allocation seed rows for Nabi and Mango.
- `supabase/snippets/demo_seed_inventory_readback.sql` requires checkout family rows as baseline and reports per-session coverage.
- `tests/demo-seed-inventory-readback-contract.spec.ts` fails if checkout family seed rows are removed.
- The engineering seed contract records that current seed-family gaps are closed and remaining work is UI/API adoption.
- Verification commands are recorded.

## Verification

- `npx playwright test tests/demo-seed-inventory-readback-contract.spec.ts --reporter=line`
- `npm run docs:check`
- `npm run security:secrets`
- Local DB readback SQL if Docker and `psql` are available.

## Result

Seeded two synthetic paid checkout sessions, two checkout invoice snapshots, and two payment allocation rows for `clair-demo`. The seed inventory no longer tracks a current seed-family gap; next work should focus on API-backed UI rewiring and end-to-end demo scenario tests.
