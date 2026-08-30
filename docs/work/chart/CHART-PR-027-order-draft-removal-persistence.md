---
id: "CHART-PR-027"
status: "implemented"
area: "chart"
priority: "P0"
target_pr: "User request / Plan-Order candidate removal persistence"
source_docs:
  - "docs/product/domain/outpatient-workflow-state-model.md"
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/engineering/data-model/emr-saas-db-structure-spec.ko.md"
  - "docs/engineering/data-model/order-fulfillment-handoff-contract.md"
dependencies:
  - "CHART-PR-007"
updated: "2026-08-30"
---

# Plan/Order Candidate Removal Persistence

## Goal

Keep an explicitly removed, unconfirmed Plan/Order candidate removed after autosave, reload, and chart re-entry while making add/remove persistence state visible and recoverable.

## Root Cause

The client removes a candidate locally and sends only the remaining draft rows. The shared database writer upserts submitted rows but does not interpret omission as removal, so its authoritative readback returns the omitted candidate and the UI shows it again.

## Approved Scope

- Add optional, explicit `removedOrderIds` intent to the existing chart order draft PATCH/RPC contract.
- Soft-cancel only same-workspace, same-encounter, unconfirmed root candidates and their unconfirmed set children in the existing CAS transaction.
- Reject invalid, cross-scope, confirmed, billed, or downstream-linked removal targets.
- Keep persisted rows visible as `삭제 중` until the server acknowledges removal; retain them with a retry path on failure.
- Apply the same confirmation step to single and bulk candidate removal.
- Announce order-add success only after server persistence succeeds and expose visible draft save state.
- Add focused server, migration-contract, and browser regression coverage.

## Out Of Scope

- Confirmed-order cancellation, amendment, re-request, fulfillment, or billing reversal policy.
- Order catalog administration or catalog row deletion.
- Table layout, density, filtering, or unrelated chart refactors.
- Remote migration application, production deployment, or real clinical data mutation.

## Done Criteria

1. A removed candidate stays absent after autosave, reload, patient switch, and chart re-entry.
2. Only explicit root IDs in `removedOrderIds` can be cancelled; omission alone never deletes a row.
3. Confirmed, billed, cross-workspace, cross-encounter, and downstream-linked rows are rejected atomically.
4. Single and bulk removal share confirmation, pending, failure, and retry behavior.
5. Add success appears after persistence, and visible save state distinguishes pending, saving, saved, failed, and conflict states.
6. Focused server, migration, UI, lint, type, build, docs, secret, and diff checks pass or have a documented limitation.

## Verification

- `npx playwright test tests/chart-order-draft-persistence-server.spec.ts tests/chart-order-shared-draft-contract.spec.ts --reporter=line`
- `npx playwright test tests/chart.spec.ts --grep "order table edits quantity|candidate removal|order add announces|in-flight save can be removed" --reporter=line`
- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Implementation Result

- The PATCH/RPC envelope now carries explicit `removedOrderIds`; omitted rows
  remain non-destructive for backward compatibility.
- Persisted candidates stay visible as `삭제 중` until the server acknowledges
  the soft-cancel. A failed save keeps the row and exposes `다시 저장`.
- Single and bulk removal use one confirmation path. Add and remove success
  messages are emitted only after the authoritative response, with a visible
  footer save state.
- The migration soft-cancels only same-scope unconfirmed roots and set children,
  writes a cancellation event, and atomically rejects confirmed or downstream-
  linked targets.

## Verification Result

- `22 passed`: server persistence and shared migration contract suites.
- `4 passed`: quantity/save/removal, removal failure retry, add ACK timing, and
  add-while-saving immediate-removal browser scenarios.
- New SQL loaded successfully against the current local Supabase schema inside
  a single transaction and was rolled back; the original function remained in
  place and no local row or schema state was retained.
- ESLint, TypeScript, production build, docs links, secret scan, Korean UX copy,
  formatting, and `git diff --check` passed.
- The production build retained one pre-existing Turbopack NFT tracing warning
  from `src/lib/prd-viewer/doc-reader.ts`; compilation and page generation
  completed successfully.
- Persona QA evidence is synthetic browser regression evidence, not real-user
  research or validation.

## Rollback

Revert the application change while leaving the additive RPC envelope backward compatible: clients that omit `removedOrderIds` continue to save rows without deletion. If the database wrapper needs correction, ship a reviewed forward migration restoring the prior writer behavior; do not delete order or migration-history rows.
