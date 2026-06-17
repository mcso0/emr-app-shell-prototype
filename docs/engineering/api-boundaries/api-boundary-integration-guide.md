# API Boundary Integration Guide

Updated: 2026-06-11

## Current State

The app now has a mixed boundary state.

- The original read-model selector boundary still exists for feature-level adapter work.
- The current `clair-demo` outpatient demo also uses direct Next.js route/API boundaries for selected local-first flows.
- Reception/profile lookup, chart queue/order actions, fulfillment work items, lab result catalog/result entries, billing invoice/payment/checkout, and audit review have scoped route-boundary coverage.
- Sales Demo and unconfigured local sessions still keep mock fallback behavior where explicitly scoped.

Use `docs/engineering/current-status.md` as the source of truth for which modules are API-backed, local-first, mock fallback, or not complete.

The requested `docs/archive/implementation-waves/mvp-parallel-workstreams.md` file was not present on `origin/main` when this worktree was created. This guide no longer treats that missing archive file as current guidance.

## Connected Demo API Boundaries

| Area | Current connected boundary | Verification anchor |
| --- | --- | --- |
| Reception / chart | Reception lookup routes and chart live queue/order actions for the selected synthetic flow | `tests/ui-demo-api-wiring-e2e.spec.ts` |
| Lab result values | Local/dev/test Supabase RPC-backed result entry route plus seeded result-sheet catalog route | `tests/lab-result-entry-persistence-contract.spec.ts`, `tests/ui-demo-api-wiring-e2e.spec.ts` |
| Fulfillment queues | Shared `order_fulfillment_work_items` read/update routes used by lab/imaging and dispensing/treatment | `tests/fulfillment-work-item-server.spec.ts`, `tests/dispensing-fulfillment.spec.ts` |
| Billing | Invoice-line, payment-status, and guardian-checkout route snapshots for the selected billing demo path | `tests/billing-invoice-line-persistence-server.spec.ts`, `tests/billing-payment-status-persistence-server.spec.ts`, `tests/billing-guardian-checkout-hardening-server.spec.ts` |
| Seed replay | `clair-demo` seed inventory/readback SQL plus safe local replay helper | `tests/demo-seed-inventory-readback-contract.spec.ts`, `npm run demo:seed:check` |
| Permission boundary | Focused unauthenticated, insufficient-role, and cross-workspace denial coverage for connected lab/billing/fulfillment APIs | `tests/api-boundary-permission-regression.spec.ts` |

For the current demo runbook, use `docs/engineering/testing/api-backed-demo-runbook.md`.

## Integration Order

Adopt the boundary one feature at a time.

1. Pick one read-only feature surface.

Start with a screen that already has a Playwright regression test and does not require session-only writes. Good candidates are read-heavy panels such as patient summary data or billing group lists.

2. Create a local adapter inside the feature.

Use `createMockEmrReadRepository()` at the feature boundary, then map the returned read model into the feature's existing view model. Keep existing component structure intact.

3. Preserve current behavior.

Before changing imports, capture the current expectations in the relevant Playwright spec. After the adapter change, the screen should render the same text, ordering, statuses, and enabled/disabled actions.

4. Move writes separately.

Check-in, form edits, result entry, payment actions, and session-only relationship edits should not be pushed through this read repository. They need a separate command boundary after the read side is stable.

5. Replace the snapshot provider.

When API/DB work begins, implement `EmrReadRepository` with a real data source or provide an API-backed `EmrReadSnapshot`. Keep selector tests as the contract for joined records.

Current note: for the demo completion project, several flows adopted direct route/API boundaries before a full repository-wide read model replacement. Do not interpret that as approval to remove the selector boundary wholesale. Future work should still be module-scoped and should document whether it uses the repository boundary, a route boundary, or both.

## Guardrails

- Do not refactor multiple feature modules in one PR.
- Keep UI behavior changes out of scope while adopting this boundary unless the work item explicitly includes them.
- Do not wire auth, audit logging, or service catalog lookup into this helper layer.
- Do not create Next.js API routes as part of read selector adoption.
- Do not add DB clients or migrations until the backend plan is explicit.
- Do not claim client-only permission gating, hidden buttons, or mock role labels as security completion.
- Do not run remote Supabase, migration push, production deploy, real email, payment provider, or external provider operations without explicit approval.

## Suggested Follow-Up PRs

| PR | Scope | Verification |
|---|---|---|
| API Boundary 2 | Use repository in one small read-only feature adapter | Existing feature Playwright spec plus `tests/api-boundary.spec.ts` |
| API Boundary 3 | Add command boundary draft for session-only writes | Unit/Playwright tests around one write workflow |
| API Boundary 4 | Prototype API-backed snapshot behind the same repository interface | Contract tests comparing mock-backed and API-backed read models |

## Review Checklist

- Feature module diff is narrow and localized.
- No forbidden UI or token files changed.
- Selector tests still pass.
- The feature's existing regression test still passes.
- Any intentional data shape change is documented in `api-boundary-selectors.md`.
