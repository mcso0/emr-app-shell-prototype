---
status: "active"
updated: "2026-05-22"
linear_issue: "DEN-203"
linear_project: "CLAiR EMR UI/UX Consistency & Affordance Hardening"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/ui-refactor-dod.md"
  - "docs/design/qa/final-cross-screen-ui-consistency-review.md"
  - "docs/completed/design/2026-05-22-ui-ux-consistency-audit-report.html"
  - "output/ui-audit-2026-05-22/"
---

# Product MVP UI/UX A-Grade Acceptance Matrix

This matrix turns the 2026-05-22 UI/UX consistency audit into an execution and
review contract for the Product MVP. It is the acceptance source for Linear
project `CLAiR EMR UI/UX Consistency & Affordance Hardening`.

The target is to raise the Product MVP design maturity from the baseline audit's
`C+` to `A` or higher. This is not a live persistence, production, or provider
integration project.

## Baseline

Baseline report:

- `docs/completed/design/2026-05-22-ui-ux-consistency-audit-report.html`

Baseline evidence folder:

- `output/ui-audit-2026-05-22/`

Representative evidence:

- `output/ui-audit-2026-05-22/screenshots/02-reception.png`
- `output/ui-audit-2026-05-22/screenshots/05-treatment-complete-dialog.png`
- `output/ui-audit-2026-05-22/screenshots/09-billing-confirm-feedback.png`
- `output/ui-audit-2026-05-22/screenshots/12-customer-row-menu.png`

Baseline audit scores:

| Dimension | Baseline |
|---|---:|
| Overall design maturity | C+ |
| Component/token consistency | C- |
| UX guidance/error recovery | C |
| Priority improvement items | 10 |

Quantitative baseline from the audit:

- Arbitrary Tailwind utility usage: about 1,978 occurrences.
- Token variable references: about 1,213 occurrences.
- Raw hex/rgb outside token files: almost none.

Interpretation: the color-token foundation is usable, but spacing, width,
font-size, dialog, CTA, alert, menu, and workflow-state patterns are still too
screen-local to feel like one mature product.

## A-Grade Design Maturity Gate

DEN-212 may mark the project ready for Human Review as `A` or higher only when
all of these conditions are true:

- No `High` matrix item remains unresolved.
- At least 8 of 10 matrix items are fully passed.
- Any partial matrix item has a documented reason, no workflow trust impact, and
  a follow-up issue if it blocks `A+`.
- The four representative evidence screens have before/after screenshots or an
  explicit reason why a screen did not need visual change.
- Reception, chart completion, billing financial CTA, and customer row menu
  workflows have interaction evidence.
- Error, warning, info, success, unavailable, and mock/live boundary states are
  distinguishable by copy, placement, and affordance without relying on color
  alone.
- The final Korean HTML report records `A` or higher with evidence, or records
  the blockers preventing `A` and links follow-up issues.

Use this scale for final scoring:

| Grade | Meaning |
|---|---|
| A+ | All 10 items pass, no meaningful visual/interaction debt remains in the scoped surfaces. |
| A | All High items pass and users can move across core workflows without relearning UI rules. |
| B | Most items pass, but at least one core workflow still has visible inconsistency or weak recovery. |
| C | The UI is functional but still feels screen-by-screen rather than product-system-driven. |
| D/F | Users still encounter unclear risk, recovery, or affordance rules in core workflows. |

## Acceptance Matrix

| ID | Priority | Audit finding | Acceptance requirement | Evidence | Linear coverage |
|---|---|---|---|---|---|
| UXA-01 | High | Spacing, width, and font arbitrary utilities are excessive. | The project defines which density, dialog, table, and font decisions must become tokens or variants, and each implementation issue either adopts those decisions or records a scoped exception. | Source scan summary and before/after screenshots where density changes. | DEN-203, DEN-204, DEN-205, DEN-212 |
| UXA-02 | High | Dialog formats are not unified. | Confirm, form, wide-form, and destructive dialog variants share shell structure, footer order, close affordance, width rules, and focus expectations. | Dialog examples and focused interaction evidence. | DEN-205, DEN-209, DEN-212 |
| UXA-03 | High | Error guidance lacks recovery behavior. | Persistent read/write failures use inline alerts with cause, state, recovery action, and fallback/live boundary copy where applicable. | Reception and billing failure screenshots. | DEN-204, DEN-207, DEN-208, DEN-212 |
| UXA-04 | High | Financial and state-changing CTAs use inconsistent confirmation rules. | CTA risk levels are documented and applied to chart completion, billing confirmation, payment completion, destructive actions, and unavailable actions. | CTA taxonomy plus selected flow screenshots/tests. | DEN-206, DEN-208, DEN-209, DEN-212 |
| UXA-05 | Medium | Menu and overlay close rules are weak. | Row menus, card menus, profile menus, dialogs, and popovers have explicit Escape, outside-click, route-change, focus, and unavailable-item behavior. | Menu interaction evidence for customer/reception/hospital-admin representative surfaces. | DEN-210, DEN-212 |
| UXA-06 | Medium | Status color meaning varies by module. | Status severity colors are separated from person/lane/department colors, and status labels use central semantic language where touched. | Screenshot comparison and status mapping notes. | DEN-203, DEN-204, DEN-212 |
| UXA-07 | Medium | Reception calendar empty-slot CTAs create visual noise. | Empty-slot affordance stays discoverable on mouse, keyboard, and screen reader paths while no longer competing with appointment cards and error banners by default. | Reception calendar before/after screenshots and focus check. | DEN-211, DEN-212 |
| UXA-08 | Medium | Mock/live boundary guidance differs by screen. | Demo, local-first, live-read failure, external-integration-unavailable, and unsupported states use a consistent chip, alert, notice, or help pattern. | Header/panel state screenshots and copy examples. | DEN-204, DEN-207, DEN-208, DEN-209, DEN-212 |
| UXA-09 | Polish | Table and panel density rules are uneven. | Density exceptions are documented, and any touched data/table surfaces use existing EMR primitives or a recorded reason for feature-local treatment. | Source notes and screenshots for touched tables/panels. | DEN-203, DEN-210, DEN-212 |
| UXA-10 | Polish | Contextual help affordance is too global. | High-risk flows have local help, notice, preflight, or unavailable-action guidance near the action instead of relying only on global help icons. | Flow screenshots for billing, chart, reception, or registration as applicable. | DEN-206, DEN-208, DEN-209, DEN-212 |

## Issue Coverage Map

| Issue | Phase | Matrix coverage | Output expected |
|---|---|---|---|
| DEN-203 | 00 Scope & Design System Decisions | UXA-01 through UXA-10 | This matrix and A-grade scoring rules. |
| DEN-204 | 01 Shared UI Foundations | UXA-01, UXA-03, UXA-06, UXA-08 | `EmrInlineAlert` foundation and severity rules. |
| DEN-205 | 01 Shared UI Foundations | UXA-01, UXA-02 | `EmrDialogShell` and dialog variants. |
| DEN-206 | 01 Shared UI Foundations | UXA-04, UXA-10 | CTA risk taxonomy and confirmation rules. |
| DEN-207 | 02 Core Workflow Affordances | UXA-03, UXA-08 | Reception read-failure recovery UX. |
| DEN-208 | 02 Core Workflow Affordances | UXA-03, UXA-04, UXA-08, UXA-10 | Billing financial CTA and failure recovery UX. |
| DEN-209 | 02 Core Workflow Affordances | UXA-02, UXA-04, UXA-08, UXA-10 | Chart completion and unavailable-action UX. |
| DEN-210 | 03 Screen-Level Adoption | UXA-05, UXA-09 | Row/menu affordance and close behavior. |
| DEN-211 | 03 Screen-Level Adoption | UXA-07 | Reception calendar empty-slot noise reduction. |
| DEN-212 | 04 Verification & Human Review | UXA-01 through UXA-10 | Final visual QA, grade decision, and Korean HTML closeout. |

## Out Of Scope

The project must not claim or implement:

- live Supabase validation
- DB migration, RLS, or server enforcement
- payment provider, VAT, receipt, refund, accounting, or settlement integration
- real email, KakaoTalk, PACS, device, Excel, or external provider integration
- real patient, guardian, hospital, payment, or identity data
- production deploy
- product role/permission policy changes

## Verification Expectations

For DEN-203:

- `npm run docs:check`
- report review only

For later implementation issues, use `docs/design/system/ui-refactor-dod.md`:

- shared component or app code changes: `npm run lint -- --ignore-pattern '.worktrees/**'`
- TypeScript contract changes: `npx tsc --noEmit`
- workflow or visible interaction changes: focused Playwright and screenshot evidence

DEN-212 should include the final verification set actually run, not a claim that
the full suite passed unless it was run.

## Human Review Contract

Each meaningful issue should stop at `Human Review` with:

- Korean summary for 승욱.
- Branch name.
- Changed files.
- Verification commands and results.
- Report path under `docs/completed/design/` when the issue changed product
  quality or completed a workflow.
- Remaining risks and explicit out-of-scope items.

Move issues to `Done` only after 승욱 explicitly accepts the result.
