---
id: "DESIGN-SYSTEM-PR-039"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Project 17 / DEN-351"
source_docs:
  - "docs/work/design-system/DESIGN-SYSTEM-PR-038-cds-v2-app-shell-scope.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
dependencies:
  - "DEN-350"
updated: "2026-05-31"
---

# CDS V2 Shell Surfaces And Command Entry

## Goal

Apply the first CDS V2 app shell refinement slice: shell surface tokens, workspace switcher density, and nav rail command entry placement.

## Scope

- Move the global command/search trigger from the workspace topbar into the nav rail.
- Preserve the existing command palette dialog, keyboard shortcut, search behavior, and route navigation.
- Align shell surface and hairline aliases with the brighter CDS V2 frame direction.
- Refine the workspace switcher to a fixed compact 32px-height button with card surface, hairline border, and small logo mark.
- Update app-shell Playwright expectations for the nav-rail command trigger location.

## Out Of Scope

- Topbar tab interaction redesign.
- Central 조제/처치 order table body, row/cell layout, sort/filter, and density changes.
- Side panel task card redesign, patient/document info bar redesign, and content aside card redesign.
- Live Supabase, DB schema, RLS, server enforcement, role/permission policy, production deploy, payment, email, or external integration changes.

## Done When

- The command palette opens from the nav rail and still supports the existing search workflow.
- Workspace switcher remains visible in expanded, collapsed, and narrow shell states.
- Shell panel borders and surfaces use the updated CDS V2 light hierarchy.
- App shell regression coverage passes.
- Korean closeout report and visual evidence are recorded.

## Verification

- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npx tsc --noEmit`
- `npx playwright test tests/app-shell.spec.ts --project=chromium`
- Desktop screenshot: `docs/completed/design/evidence/2026-05-31-den-351-shell-desktop.png`
- Narrow screenshot: `docs/completed/design/evidence/2026-05-31-den-351-shell-narrow.png`

## Handoff Notes

- `GlobalCommandPalette` now supports a `rail` trigger variant. Keep the dialog/search implementation shared; avoid duplicating command state in `NavRail`.
- `WorkspaceTabsBar` no longer needs `workspaceId` because command entry moved to `NavRail`.
- Remaining topbar chrome refinement belongs to DEN-352.
- Remaining side panel, patient/document, and content aside visual work belongs to DEN-353 through DEN-356.
