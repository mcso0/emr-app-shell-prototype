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

## Follow-up Rework 2026-06-21

- Keep workspace history controls in the existing topbar DOM while shifting the leading slot only when `modulePanel=open`, so the collapsed side-panel state keeps the legacy slot.
- Enforce the CDS V2 page-tab minimum width through `--emr-topbar-tab-min-width: 148px`.
- Keep tab close buttons mounted for stable layout, but reveal them only on tab hover or keyboard focus.
- Add focused Playwright coverage for the open/closed history slot, 148px tab width, and hover-only close affordance.
- Browser review follow-up: align the reception calendar current-time timeline label to the CDS V2 red/500, 36px by 16px pill, 6px radius, 1px/4px padding, and 2px label-to-line gap while preserving the existing calendar component.
- Browser review follow-up: restore the missed reception calendar lane header spec: 64px outer cell with 8px padding, 48px inner header with 12px radius and 8px padding, 32px by 32px avatar with 16px radius, and 500-level lane colors.

## Follow-up Rework 2026-06-21: Topbar History Boundary

- Anchor workspace history controls to the expanded navigation column boundary when `modulePanel=open`; the controls' right edge must not cross the 362px left-region axis.
- Keep the collapsed `modulePanel=closed` history controls in the legacy topbar slot.
- Keep workspace tab and divider layout in the right workspace section, so multiple tabs do not inherit the history-control offset.

## Follow-up Rework 2026-06-21: Remove Leading Divider

- Remove the leading divider before workspace tabs after the history controls moved into the expanded left-region boundary.
- Keep open/closed tab-history geometry coverage focused on the history boundary and tablist start position.
