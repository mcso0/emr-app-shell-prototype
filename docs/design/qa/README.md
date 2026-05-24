# Design QA

Use this folder for visual, interaction, and reference-screen QA checklists.

Use this README as the GitBook entry point for UI/UX verification. These docs help reviewers decide whether the interface is coherent, dense enough for EMR work, accessible enough for repeated use, and ready for Human Review.

## Read First

| Need | Start With |
| --- | --- |
| PR-sized UI review checklist | `core-workspace-ui-review-checklist.md` |
| Keyboard, focus, tooltip, and accessible-name checks | `interaction-accessibility-audit.md` |
| Dense layout, overflow, clipping, and responsive behavior | `responsive-dense-layout-audit.md` |
| Product MVP UI/UX maturity gate | `product-mvp-uiux-a-grade-acceptance-matrix.md` |
| Cross-screen final review history and follow-up backlog | `final-cross-screen-ui-consistency-review.md` |
| Older broad UI consistency audit | `2026-05-10-ui-consistency-audit.md` |

## Current Files

| Document | Role |
| --- | --- |
| `core-workspace-ui-review-checklist.md` | Reusable checklist for PR-sized UI refactor review. |
| `interaction-accessibility-audit.md` | Keyboard, focus, tooltip, and accessible-name baseline. |
| `responsive-dense-layout-audit.md` | Overflow, clipping, and dense table readability baseline. |
| `product-mvp-uiux-a-grade-acceptance-matrix.md` | Product MVP UI/UX consistency matrix and A-grade maturity gate for DEN-203 through DEN-212. |
| `final-cross-screen-ui-consistency-review.md` | Project 07/08/09 final consistency review and follow-up backlog. |
| `2026-05-10-ui-consistency-audit.md` | Older broad audit. Use as background unless a current issue cites it. |

## Boundaries

- Put reusable design-system rules in `docs/design/system/`, not here.
- Put screen-specific product behavior in `docs/product/` or `docs/design/screens/`.
- Do not treat a QA finding as implementation scope until it is linked to an active work item or Linear issue.
- Private GitBook can expose these checklists for internal review; public screenshots or customer-facing examples would need separate review.

## Verification Notes

- Use these docs to choose focused UI/browser checks when implementation changes affect screens.
- For docs-only edits in this folder, run `npm run docs:check`.
