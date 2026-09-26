---
id: "DESIGN-SYSTEM-PR-103"
status: "active"
area: "design-system"
priority: "P1"
target_pr: "Browser comment / Figma date navigator chevron parity"
created: "2026-09-27"
source_docs: []
dependencies: []
---

# Date Navigator Chevron Parity

## Goal

Match the shared previous/next date navigation buttons to Figma node
`28483:114758` while preserving the existing date and calendar interactions.

Design: [CDS.V2 date navigator](https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=28483-114758)

## Cause

`EmrDateNavigator` renders 16px chevrons inside square 32px buttons using the
tertiary text color. The Figma component uses 28px icons, 32×40px controls,
8px corners, and `neutral/600` (`#525252`).

## In Scope

- Update only the previous/next icon buttons in the existing `EmrDateNavigator`.
- Reuse the existing Button and CDS navigation chevron icons.
- Match the 32×40px button, 28×28px icon, transparent background, 8px radius,
  and existing `neutral/600` design token.
- Preserve labels, disabled behavior, focus treatment, and date callbacks.

## Out Of Scope

- Date label, today badge, calendar picker, and surrounding layout.
- Other date controls or unrelated icon buttons.
- Data, routing, persistence, permission, or release-environment changes.

## Done Criteria

- Previous and next controls render at the Figma dimensions and color.
- Existing navigation and date-picker behavior remain intact.
- Focused visual verification, local preflight, PR Preview, and the exact-candidate
  Release Check pass.

## Verification

- Storybook visual inspection and Playwright CLI computed-style check for both
  date-navigation buttons.
- `npm run security:secrets`
- `npm run docs:check`
- `git diff --check`
- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build`
- PR Preview readiness and one manually dispatched Release Check for the exact
  candidate commit.

## Release Boundary

Merging `main` is a production-release action. Prepare the exact candidate,
verification, smoke, and rollback packet before requesting any remaining
production approval.
