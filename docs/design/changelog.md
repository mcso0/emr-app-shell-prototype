# Design Changelog

Use this file for small design-planning changes that do not need a standalone decision record.

## 2026-06-06

- `added`: DEN-433 defines the shared border, radius, and shadow depth contract for common EMR surfaces and follow-up screen implementation issues.
- `added`: DEN-434 defines the shared empty state and info box contract, including loading/error/permission separation and E1 action affordance inside passive state surfaces.
- `changed`: DEN-436 applies the accepted queue shortcut, local detail filter, visible sort, display-options density, and contextual TASK overflow menu direction to the shared side-panel queue.
- `added`: DEN-435 defines the shared Tab UX/UI and Table Density contract, including when tabs are navigation versus section switches or filters, and when density should remain an icon segmented selector versus move into a dropdown.

## 2026-05-31

- `changed`: DEN-366 hardens the local-first billing state semantics behind the payment summary UX: `미납 처리` now needs a reason at the API/server boundary, while `issued` without a reason remains `수납진행`/waiting rather than overdue.
- `changed`: DEN-364 reworks the billing payment summary CTA hierarchy by replacing user-facing `청구 확정` with `수납 진행`, moving `미납 처리` to a secondary reason-required dialog, and adding payment method, installment, adjustment reason, and memo placeholders.
- `changed`: DEN-363 reframes the billing center workspace around selected checkout groups by patient, encounter, and invoice, including chart-order source badges, order work-state labels, candidate badges, group totals, and non-clinical add-on placeholders.
- `changed`: DEN-362 adds a billing content-aside guardian ledger with date quick ranges, status filters, optional co-guardian invoice inclusion, selectable ledger rows, and a central selected checkout summary.
- `changed`: DEN-361 rebuilds the billing side-panel queue labels and row hierarchy around `수납대기`, reason-backed `미납`, and `완료`, with guardian-first row identity, patient chips, explicit state badges, order counts, amounts, and request time.
- `changed`: DEN-360 replaces the billing workspace patient/vitals header with a billing-only guardian context bar that shows guardian contact, owned patients, waiting/unpaid summary, payment caution, invoice status, and the payment summary toggle.
- `added`: DEN-359 adds the billing screen component ownership plan for DEN-360 through DEN-364, mapping current `src/features/billing/module.tsx` responsibilities to guardian context, queue, ledger, checkout table, and payment summary slices.
- `added`: DEN-358 adds the Guardian-Centered Billing Checkout Flow contract, replacing user-facing billing `청구 확정` with `수납 진행` / `결제 진행`, `수납 완료`, and reason-backed `미납 처리` UX.
- `changed`: Billing financial CTA taxonomy now treats `수납 진행` / `결제 진행` as the primary checkout action and `미납 처리` as a secondary reason-required action.

## 2026-05-22

- `changed`: Added `EmrRowActionMenu` and normalized representative customer, reception, and hospital-admin row/card menu affordances for DEN-210.
- `changed`: Normalized chart completion confirmation and unavailable Order action affordances for DEN-209.
- `changed`: Applied financial CTA preflight and persistent save-failure recovery UX to billing for DEN-208.
- `changed`: Applied `EmrInlineAlert` recovery UX to reception queue/calendar read failures for DEN-207.
- `added`: Added CTA risk taxonomy and confirmation/preflight rules for DEN-206.
- `added`: Added `EmrDialogShell` and confirm/form/wide-form dialog rules for DEN-205.
- `added`: Added `EmrInlineAlert` and persistent feedback severity rules for DEN-204.
- `added`: Added the Product MVP UI/UX A-grade acceptance matrix for the Linear hardening project DEN-203 through DEN-212.

## 2026-05-03

- `added`: Adopted shared docs lifecycle and routing rules from `docs/_meta/`.

## 2026-05-10

- `added`: Added Light Operational Foundation guidance and the first EMR token alias layer for shared panel, list, side-panel card, and table surfaces.
- `added`: Added canonical CLAiR EMR `DESIGN.md` for the bright operational design direction.

## 2026-05-12

- `added`: Added a senior product design development-points note for cross-workflow next-action, handoff, error-prevention, and foundation-first design direction.
