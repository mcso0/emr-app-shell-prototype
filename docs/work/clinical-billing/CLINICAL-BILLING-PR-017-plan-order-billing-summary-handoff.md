---
id: "CLINICAL-BILLING-PR-017"
status: "done"
area: "clinical-billing"
priority: "P0"
target_pr: "GitHub PR #673"
source_docs:
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/engineering/data-model/order-fulfillment-handoff-contract.md"
  - "docs/engineering/data-model/billing-checkout-session-allocation-adjustment-model.md"
  - "docs/engineering/auth-security/auth-login/clinical-billing-persistence-scope.md"
dependencies:
  - "CLINICAL-BILLING-PR-016"
  - "CLINICAL-FULFILLMENT-PR-009"
updated: "2026-08-30"
---

# Plan/Order Billing Summary And Encounter Billing Handoff

## Goal

Replace the generic Plan/Order table footer with a compact encounter-scoped
order and financial summary, a non-modal amount-detail aside, and a chart-owned
`Order 청구` handoff that remains independent from chart completion.

## Scope

- Add one server-owned encounter billing summary read model for the Plan/Order
  footer and amount-detail aside.
- Keep checkbox selection actions row-scoped and keep `Order 확정` in the
  floating selection action bar.
- Show order counts on the left and money information plus `금액 상세` and
  primary `Order 청구` actions on the right in one compact footer row.
- Open amount detail as a feature-local non-modal aside without backdrop,
  dimming, blur, focus trap, or table interaction blocking.
- Treat draft amounts as estimates while billing only confirmed, non-cancelled,
  billing-eligible, not-yet-invoiced orders.
- Atomically link the eligible frozen billing candidates to invoice lines,
  preserve billing-only name/quantity/unit-price corrections, recalculate
  totals, record an idempotent billing command, and preserve clinical/work status.
- Serialize one encounter billing request by locking encounter, order, and
  candidate rows before revision validation so a concurrent billing correction
  cannot pass an already-stale amount snapshot.
- Navigate to Billing with durable `encounterId` and `invoiceId` context and
  remove the selected-detail dependency on chart session-storage handoff.
- Add permission, workspace, amount-integrity, idempotency, UI, and cross-screen
  regression coverage.
- Bind live Billing read snapshots to the active actor session and workspace;
  deny or actor changes must not render a previous user's protected snapshot.
- Apply the exact approved migration to the production-bound synthetic/demo
  Supabase project only after local replay and boundary review pass.
- Deliver through commit, push, PR, exact-candidate release checks,
  `origin/main` merge, production deployment, scoped smoke, and rollback proof.

## Out Of Scope

- Arbitrary partial-amount payment input for one invoice or checkout.
- Real payment provider, receipt, tax export, refund provider, email, KakaoTalk,
  PACS, accounting, or device integration.
- Real hospital, guardian, patient, staff, identity, billing, or payment data.
- Canonical role/permission-policy changes.
- Reworking unrelated Billing workspace layout or Plan/Order table behavior.

## Product Contract

- Footer and amount detail are encounter-scoped; the floating action bar is
  selection-scoped.
- `Order 확정` freezes the selected order snapshot and may create an internal
  billing-ready candidate, but does not make the order payable by itself.
- `Order 청구` moves all currently eligible confirmed encounter orders into
  invoice-linked, payable billing work and may run before chart completion.
- Draft amounts are included in `청구 예상 총액` but excluded from the current
  billing request and are explained in amount detail.
- `Order 청구`, checkout, and payment must not complete the encounter or mutate
  fulfillment work status.
- Interim settlement means billing and paying currently eligible confirmed
  orders while the encounter continues. Arbitrary partial payment remains a
  separate follow-up.

## Done When

- Footer shows one compact row with grouped order and money information.
- `금액 상세` opens a non-modal aside and uncovered table controls remain usable.
- Footer and aside use the same server-owned response and never trust client
  totals as financial authority.
- `Order 청구` works without table selection and without chart completion,
  excludes draft/cancelled/already-invoiced rows, warns for unfinished work,
  uses the latest execution attempt for that warning, and replays the same
  idempotency command without duplicate invoice lines or audit events.
- Billing-only candidate corrections exactly match the generated invoice line,
  and audit snapshots exclude patient/guardian display context.
- Billing opens from durable server data after refresh or direct link.
- Payment completion in the adopted flow leaves encounter status unchanged.
- Focused tests, TypeScript, lint, build, docs, secret scan, migration replay,
  remote catalog verification, PR checks, deployment, smoke, and rollback
  evidence are reported.

## Current Chart CAB UX Clarification (2026-09-20)

The chart now has two intentionally different billing entry points in the
approved interaction contract:

- Footer `전체 수납 청구`: encounter-scoped; selection-independent; includes all
  currently eligible confirmed, not-yet-invoiced orders.
- Selection CAB `n개 Order 수납 청구`: selection-scoped partial billing; includes
  only selected confirmed, billing-eligible orders. In mixed selection, draft
  orders are excluded from the billing count and request.

This does not change the existing out-of-scope rule for arbitrary partial-amount
input. It clarifies that staff may request billing for a selected subset of
eligible order lines while the billing amount remains server-owned. The full
interaction contract is recorded in
[Order Selection CAB Interaction Contract](../../design/flows/order-selection-cab-interaction-spec.md).

The chart implementation now permits mixed draft/confirmed top-level selection,
renders action-specific counts, carries selected billable order IDs into the
billing route, and keeps the encounter-wide footer action separate. Confirmed
bulk `재요청` and `긴급` use the existing server mutation route with per-order
success/failure retention; candidate `삭제` still removes rows from the current
Plan draft only after confirmation.

## Verification

- `npm run security:secrets`
- `npm run docs:check`
- `git diff --check`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4175 npx playwright test tests/order-selection-cab-prototype.spec.ts`
- `npx playwright test tests/chart.spec.ts -g "chart mixed selection keeps confirmation and partial billing scoped"`
- `npx playwright test tests/chart-order-billing-summary-server.spec.ts --reporter=line`
- `npx playwright test tests/chart-order-action-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/billing-invoice-candidate-sync-server.spec.ts --reporter=line`
- `npx playwright test tests/billing-guardian-checkout-hardening-server.spec.ts --reporter=line`
- `npx playwright test tests/chart.spec.ts -g "Plan/Order billing summary" --reporter=line`
- `npx playwright test tests/billing.spec.ts -g "chart billing handoff" --reporter=line`
- Local Supabase migration replay and rollback-only SQL contract verification.

## Subagent And Review Policy

- Parent implementation and integration remain centralized in this worktree.
- Use one independent security boundary review after the candidate diff exists
  because workspace, RLS, billing integrity, payment-adjacent, and production
  boundaries are material.
- Use test triage only for focused failing logs; subagent findings are evidence,
  and the parent owns final decisions and fixes.

## Review Handoff

- Independent workspace, RLS, billing integrity, concurrency, and protected
  client-state review: `APPROVE` on 2026-08-30.
- Representative acceptance: 승욱 approved the released result on 2026-08-30;
  the work item moved from `human_review` to `done`.
- Representative-facing report:
  `docs/completed/clinical-billing/2026-08-30-clinical-billing-pr-017-plan-order-billing-summary-report.html`
