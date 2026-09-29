---
id: DESIGN-SYSTEM-PR-104
status: active
area: design-system
priority: P1
target_pr: Browser comment / Figma Home date label and today badge fidelity
created: 2026-09-27
source_docs: []
dependencies: []
---

# Home Date Label And Today Badge Fidelity

## Goal

Match the Home hospital date trigger and today badge to Figma node
`28483:112319` while preserving date selection and navigation behavior.

Design: [CDS.V2 Home date navigator](https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=28483-112319)

## Cause

Home's current trigger uses an automatic width and its today badge inherits a
12px label style. The Figma trigger is 218×40px with a 24px/32px date label;
the badge is 42×28px with a 15px/22px label.

## In Scope

- Home `원내 현황` date trigger width, typography, spacing, and date-label clipping.
- Home `오늘` badge size, border, fill, typography, and inner padding.
- A Storybook example using the Home-owned date navigator styles.
- Keep the existing date formatter, picker, callbacks, and shared default presentation.

## Out Of Scope

- Previous/next chevron geometry covered by `DESIGN-SYSTEM-PR-103`.
- Date picker calendar contents, Home toolbar layout, other date navigator callers,
  data, routing, permissions, or persistence.

## Done Criteria

- Home trigger is 218×40px with 12px/10px horizontal and 4px vertical padding,
  24px/32px semibold text, and −0.552px tracking.
- Today badge is 42×28px with 8px horizontal and 2px vertical padding, 1px
  neutral outline, white fill, and 15px/22px medium text.
- Full formatted date and accessible date-selection label are visible.
- Other date navigator presentations and interactions remain unchanged.

## Verification

- Storybook visual inspection and computed-style readback for trigger and badge.
- `npm run security:secrets`
- `npm run docs:check`
- `git diff --check`
- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build`
- PR Preview readiness and one manually dispatched Release Check for the exact
  candidate commit.

## Release Boundary

Merging to `main` is a Production release. Prepare the exact candidate,
verification, scoped smoke, and rollback packet before requesting any remaining
Production approval.

## 2026-09-29 Optical Alignment Follow-up

승욱 approved the proposed Home date-label correction and requested commit,
push, PR, merge to `origin/main`, and Production deployment in the same chat.

- The 40px button and 32px date-label line box were centered; the rendered
  date glyphs appeared lower than the adjacent chevrons.
- Apply `translateY(calc(-1 * var(--clair-spacing-2)))` only to the existing
  Home hospital date-label span. The computed offset is -2px.
- Storybook readback: date-label center moved from 36px to 34px; button,
  chevron-button, and today-badge centers stayed at 36px. The trigger remains
  218×40px and the badge remains 42×28px.
- Home and sidebar Storybook checks passed (2/2). The sidebar date label has
  no transform. Date-picker opening and Escape closing were verified locally.
- The exact follow-up PR records release checks, Preview readiness, Production
  smoke, and the prior Ready deployment or merge-revert rollback candidate.
