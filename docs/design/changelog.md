# Design Changelog

Use this file for small design-planning changes that do not need a standalone decision record.

## 2026-08-25

- `changed`: Static backgrounds now use the equal-channel Neutral surface
  ladder, while interaction feedback uses black-alpha overlays: hover 4%,
  selected 6%, and active 8%.
- `changed`: Shared data-table rows and pinned cells use the same semantic state
  tokens; pinned cells compose the overlay over an opaque base to prevent
  scroll-through.
- `deprecated`: `--emr-surface-hover` and `--emr-surface-selected` remain
  compatibility aliases only; new code uses `--emr-state-*`.

## 2026-08-22

- `changed`: Structural borders now use only the neutral
  `--emr-border-subtle/default/strong` hierarchy; the four legacy structural
  `--emr-line-*` aliases and unused compatibility utilities were removed.
- `changed`: The hand-authored EMR theme now maps global shadcn `--border` and
  `--input` to `--emr-border-default`, while selected, focus, drag, status, and
  accent borders keep their dedicated semantic tokens.

## 2026-08-01

- `fixed`: Reception keeps its feature-owned 56px calendar toolbar at the top
  of the content frame and no longer reserves a duplicate empty shared header.

## 2026-07-27

- `changed`: Customer animal/guardian tables and hospital-admin Order/audit tables now reserve a feature-owned 56px content-top slot, use `#FCFCFC` for the content frame, and preserve a 0px table-header-to-first-row gap.
- `clarified`: The 56px slot is not a global shell insertion because several clinical, reception, and calendar surfaces already own that height through their context or date/filter bars.

## 2026-07-25

- `changed`: The shared module-list panel and menu body now fill the shell-provided width; rows retain an 8px horizontal inset so hospital-admin and customer-management selected states align with the list on both sides.

## 2026-07-24

- `changed`: Aligned `EmrModuleListSidePanel` spacing and typography to CDS.V2 Figma node `27794:28010` while preserving existing menu content, icons, selection, disabled states, and interactions.
- `changed`: The current shared contract is a 296px panel with 280px rows, 8px horizontal inset, 16px top-level group spacing, 2px within-group spacing, 26px child-list offset, 8px leaf right inset, 13/18px item typography, and 12/16px metadata typography.

## 2026-07-23

- `added`: DESIGN-SYSTEM-PR-082 adds the product-wide Korean honorific baseline: system copy uses `합니다체`, user requests use `~해 주세요`, and confirmation questions use `~하시겠습니까?`.
- `changed`: Confirmed informal product copy was corrected across shell, docs/PRD viewers, auth, reception, customer, chart, billing, Home, hospital scheduling, and demo-session surfaces without changing workflow behavior.
- `added`: A dependency-free source check now blocks clear informal Korean product-copy endings while preserving polite `해요체`, user-authored clinical content, and developer-only guidance.

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
