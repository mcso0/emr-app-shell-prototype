# Product Changelog

Use this file for small product-planning changes that do not need a standalone decision record.

## 2026-06-01

- `changed`: DEN-369 lets billing users select completed/cancelled guardian ledger rows for detail review while excluding those rows from current checkout totals, with local-first status transition controls for completed/cancelled history.

## 2026-05-31

- `changed`: DEN-368 fixed staging replay now verifies the guardian-centered billing checkout flow on the fixed staging URL, including `수납 진행`, reason-backed `미납 처리`, `수납 완료`, guardian ledger, and removal of user-facing `청구 확정` copy.
- `added`: DEN-358 adds the guardian-centered billing checkout flow contract so follow-up issues use `수납 진행` / `결제 진행`, `수납 완료`, and reason-backed `미납 처리` instead of user-facing `청구 확정`.
- `changed`: The guardian-centered billing review supersedes the earlier user-facing `청구 확정` requirement: chart `Order 청구` now means the selected orders are payable `수납대기`, billing primary CTA should be `수납 진행` / `결제 진행`, and `미납 처리` is an explicit deferred/overdue action with reason.
- `changed`: DEN-349 fixes the product timing for billing confirmation: `Order 청구` creates billing candidates, billing workspace review shows `수납 후보`, `청구 확정` accepts candidates as the invoice amount basis, and `수납 완료` only changes payment state.
- `changed`: DEN-348 shows DEN-341 order billing candidates inside the billing invoice-line table for the active encounter/invoice context, marking them as `수납 후보` so candidate readback is visible without treating the rows as persisted invoice-line edits.
- `changed`: DEN-341 fixed staging alias replay now points to the latest preview and verifies lab, imaging, dispensing, and treatment candidate readback on the fixed staging URL; chart lifecycle alias resolution was hardened after staging exposed the same demo encounter bridge gap.
- `changed`: DEN-341 preview replay passed for lab, imaging, dispensing, and treatment order billing candidate sync after fixing billing candidate alias resolution and chart deep-link selection; billing invoice-line table candidate display remains a follow-up decision.
- `changed`: DEN-340 validates that the current separated work/billing state model is sufficient for DEN-341 staging replay; strict single-transaction chart billing remains an optional approval-gated hardening step.
- `changed`: DEN-336 through DEN-339 connect chart `Order 청구` directly to billing candidate creation without draft-save dependency, add unfinished-order confirmation copy, and remove the table-level veterinarian billing gate.
- `changed`: DEN-335 separates order work state from billing candidate state. Chart `Order 청구` can move selected billable lab, imaging, dispensing, and treatment orders to billing candidates, while unfinished work requires explicit confirmation instead of blocking billing by default.

## 2026-05-25

- `changed`: Clarified the Order Platform implementation guardrail after DEN-291: app/UI/API/core implementation, local tests, repo migration file authoring, and local migration/static tests are allowed for scoped implementation issues, while remote Supabase application, remote RLS replay, production deploy, and real data import remain approval-gated.
- `added`: Added `docs/product/domain/workspace-order-catalog-platform.md` for DEN-280, fixing the MVP policy for CLAiR presets, workspace catalog customization, hospital-admin-only phase-1 management, use-stop behavior, immediate future price changes with historical snapshots, routing/billing gates, order set deferral, and CSV template-only scope.

## 2026-05-23

- `changed`: Lab and imaging queues now read fulfillment work item status context and send status mutations through the shared fulfillment route for DEN-238.
- `changed`: Chart order confirmation now produces server-side fulfillment work items for downstream queue adoption in DEN-237.
- `changed`: Added the DEN-236 server-backed fulfillment work item foundation while keeping downstream screen adoption and billing sync as explicit follow-up scope.
- `added`: Added `docs/product/domain/order-fulfillment-handoff.md` for the DEN-235 chart-confirmed order to downstream fulfillment handoff product contract.

## 2026-05-03

- `added`: Adopted shared docs lifecycle and routing rules from `docs/_meta/`.
- `added`: Split DB planning guidance between `docs/product/domain/` and `docs/engineering/data-model/`.
