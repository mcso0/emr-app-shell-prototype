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

Match Home previous/next date navigation buttons to Figma node
`28483:114758` and sidebar controls to `28414:121557`, while preserving
the existing date and calendar interactions.

Design: [CDS.V2 date navigator](https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=28483-114758)

## Cause

PR #836 matched the Home design with 28px chevrons and 32×40px controls
but applied those dimensions to every shared navigator. Sidebar Figma uses
16px chevrons and 32×32px controls. Both use 8px corners and `neutral/600`
(`#525252`).

## In Scope

- Update only the previous/next icon buttons in the existing `EmrDateNavigator`.
- Reuse the existing Button and CDS navigation chevron icons.
- Select the Home or compact dimensions explicitly; preserve transparent
  background, 8px radius and the existing `neutral/600` design token.
- Match the compact navigator's 16px horizontal inset.
- Preserve labels, disabled behavior, focus treatment, and date callbacks.

## Out Of Scope

- Date label, today badge, calendar picker and other surrounding layout.
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

## Sidebar Correction — 2026-09-29

PR #836 applied the Home dimensions to every shared date navigator. 승욱
approved this scoped correction, verification, commit/push/PR, direct
`origin/main` merge and Production delivery in this chat.

- `appearance="compact"` is the default: 32×32px controls, 16px chevrons,
  neutral/600, 8px radius, 48px row height and 16px horizontal inset.
- Home explicitly selects `appearance="home"`: retain its 32×40px controls,
  28px chevrons, existing date formatter, label/badge styling and calendar.
- Chart and dispensing/treatment use the shared order queue; lab, imaging
  and billing use the same compact navigator directly. The lab receipt panel
  also inherits compact sizing and retains its explicit inset/disabled state.
- Existing Button/CDS icons and date-selection callbacks remain shared.
  Storybook exposes both appearances; browser regressions cover all five
  queues, keyboard date movement and unchanged Home geometry.
- No data/API/auth/permission/environment/dependency change. Preserve primary
  WIP; release only from the isolated current-main worktree.

Release base: `166a7736`. Rollback: previous Ready Production
`dpl_5qHFro1xoqpuQ5XhCnLHaZG5tmWN` or revert only the correction commit.
Smoke: login and synthetic Cheongdam Home/treatment/lab/imaging/dispensing/billing
routes; report authenticated interaction separately from HTTP probes.
Stop on failed preflight, exact-candidate Release Check, Preview readiness,
candidate drift or scoped smoke. Exact candidate/PR/deployment evidence
is recorded in the corrective PR.

Local verification: 8 focused Chromium browser tests passed; both Storybook
appearances were visually inspected and measured at their intended dimensions.
Secrets/docs/UX copy/diff checks, lint, TypeScript and Production build passed.
Lint retains five existing unrelated warnings; build retains the existing
docs-reader file-tracing warning.
