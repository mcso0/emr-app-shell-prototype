---
id: "CLINICAL-BILLING-PR-018"
status: "active"
area: "clinical-billing"
priority: "P0"
target_pr: "TBD"
source_docs:
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-017-plan-order-billing-summary-handoff.md"
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/engineering/data-model/order-fulfillment-handoff-contract.md"
dependencies:
  - "CLINICAL-BILLING-PR-017"
updated: "2026-08-31"
---

# Plan/Order Billing Summary Freshness And Stale Safety

## Goal

Keep the Plan/Order financial summary synchronized with persisted order changes
without a page reload, and prevent an `Order 청구` request whenever the last
server-owned summary is not known to be current.

## Scope

- Re-read the encounter billing summary after successful draft save,
  confirmation, cancellation, re-request, and billing correction mutations.
- Revalidate on browser focus or visibility return when no unsaved draft exists.
- Keep the latest successful server amount visible during refresh or failure,
  while labeling stale state and disabling both billing request actions.
- Ignore an older delayed response when a newer refresh has already completed.
- Use only a fresh server ETag to authorize `Order 청구`; never submit the
  client-only estimate ETag.
- Align the local mock permission fixture with the existing admin and vet demo
  sessions without changing canonical roles or permissions.
- Add focused server and browser regression coverage.

## Out Of Scope

- Order Set pricing or aggregate billing candidate changes.
- Invoice, payment, discount, surcharge, or refund product-policy changes.
- New caching libraries, global data abstractions, or unrelated chart layout.
- Real data, provider/payment integrations, or canonical permission changes.

## Done When

- A persisted quantity, add, or delete mutation updates the visible footer
  amount without reload.
- Successful confirm and execution/billing mutations revalidate the same
  server-owned summary.
- Refresh failure preserves the previous display value but shows
  `최신 금액 확인 필요`, offers retry in amount detail, and disables both
  `Order 청구` buttons.
- Refreshing shows `금액 갱신 중`, and only the newest overlapping response can
  become authoritative.
- Revision conflict immediately invalidates the request authority and refreshes
  the summary; a failed refresh cannot leave a billing action enabled.
- Focused tests, TypeScript, lint, build, docs, and secret checks pass.

## Verification

- `npm run security:secrets`
- `npm run docs:check`
- `git diff --check`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/chart-order-billing-summary-server.spec.ts --reporter=line`
- `npx playwright test tests/chart-order-billing-summary-freshness.spec.ts --reporter=line`

## Review Policy

- Parent implementation and integration stay in the isolated clean worktree.
- Run one independent security boundary review after the exact candidate diff
  exists because billing authority and protected stale state are in scope.
- Use test triage only when focused failures need independent diagnosis.

## Review Handoff

- Independent billing authority, workspace, permission, stale-state, and ETag
  boundary review: `APPROVE` on 2026-08-31 with no release blocker.
- Focused acceptance covers persisted draft refresh without reload, latest-wins
  overlap handling, failed-refresh billing lockout, delayed GET after successful
  POST, partial confirmation failure, execution revision conflict, local-only
  estimate lockout, and normal mock admin/vet permission parity.
