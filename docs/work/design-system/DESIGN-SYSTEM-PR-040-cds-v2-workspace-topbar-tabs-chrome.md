---
id: DESIGN-SYSTEM-PR-040
status: human_review
area: design-system
priority: P0
target_pr: Project 17 / DEN-352
created: 2026-05-31
---

# DESIGN-SYSTEM-PR-040: CDS V2 Workspace Topbar And Tabs Chrome

## Goal

Align the workspace topbar and page tab chrome with the CDS V2 topbar component while preserving tab navigation behavior.

## Scope

- Add EMR topbar alias tokens for spacing, icon colors, tab states, divider treatment, and profile button sizing.
- Refine `WorkspaceTabsBar` layout around the CDS V2 topbar rhythm: 32px controls, 8px left item gaps, 16px section gap, and 10px right action gaps.
- Refine `WorkspaceChromeTabs` active/inactive/hover tab surfaces, typography, icon color, and close affordance.
- Refine `AuthProfileMenu` trigger sizing and visual treatment to match the topbar profile button.

## Out Of Scope

- Left nav rail, workspace switcher, and command entry changes already covered by DEN-351.
- Side panel task title/card, patient/document bars, content aside, and order table body changes.
- Live auth, Supabase, or server-side permission changes.

## Acceptance Criteria

- Topbar height, icon button density, tab shape, divider treatment, and active/inactive states match the referenced CDS V2 component.
- Back/forward, tab creation, tab closing, active tab switching, and per-tab navigation history remain unchanged.
- Styling uses existing components and token aliases; no one-off hardcoded component styling is introduced.
- Focused and full app-shell Playwright coverage passes with lint and typecheck.

## Verification

- Passed: `npx playwright test tests/app-shell.spec.ts --project=chromium -g "workspace tab"`
- Passed: `npx playwright test tests/app-shell.spec.ts --project=chromium`
- Passed: `npx tsc --noEmit`
- Passed with 5 pre-existing warnings: `npm run lint -- --ignore-pattern '.worktrees/**'`
