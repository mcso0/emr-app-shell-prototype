---
id: "APP-SHELL-PR-001"
status: "done"
area: "app-shell"
priority: "P1"
target_pr: "PR 1"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/architecture/app-shell-layout-contract.md"
  - "docs/superpowers/specs/2026-05-16-workspace-tabs-design.md"
dependencies: []
updated: "2026-05-16"
---

# Workspace Tabs MVP

## Goal

Add a Linear-style logical workspace tabs shell so users can keep multiple EMR work views open and navigate with tab-scoped back/forward.

## PR Gate

- Goal: clinicians and hospital staff can keep several EMR modules open in one app shell with familiar tab switching.
- PR-sized scope: session-only tab store, top workspace tab chrome, active-tab route history, tab-scoped back/forward, new/close tab behavior, reload restore coverage, and shell spacing tests.
- Out of scope: Electron shell, BrowserView/WebContents, inactive tab DOM preservation, per-tab global store isolation, live persistence, Supabase/RLS/API changes, and mobile-specific tab UX.
- Done criteria: initial route creates one active tab, new tab opens Home, nav rail navigation pushes into active tab history, top-shell back/forward work per active tab, switching tabs restores route, last tab cannot be closed, reload restores open tabs.
- Source docs: current status, app shell layout contract, and workspace tabs design spec.
- Verification: lint, TypeScript, docs check, focused app-shell Playwright workspace tab tests, and full app-shell Playwright tests.
- Status/dependencies: done; no dependencies.
- Duplicate check: no existing app-shell workspace tabs work item existed in `docs/work/index.md` or inbox.

## Scope

- Add `src/stores/workspace-tabs-store.ts` for session-only logical tabs and per-tab route history.
- Add `src/shell/workspace-tabs-bar.tsx` for the Linear-style top chrome.
- Route normal nav rail module clicks through the active tab history while preserving link semantics.
- Add tab-scoped back/forward, new tab, close tab, and session restore behavior.
- Keep the last remaining tab open.
- Preserve existing App Shell slots and URL-share behavior.
- Lock the 10px shell rhythm between top chrome, nav rail, and workspace frame.

## Out Of Scope

- Electron shell, WebContents, BrowserView, or native packaging.
- Inactive tab DOM preservation.
- Per-tab global store isolation.
- Live persistence, Supabase, RLS, or API changes.
- Mobile-specific tab layout.

## Done When

- Initial route creates one active tab.
- New tab opens Home and becomes active.
- Nav rail navigation pushes into active tab history.
- Back/forward controls move within active tab history.
- Switching tabs restores each tab's current route.
- Last tab cannot be closed.
- Session reload restores open tabs.
- Shell spacing follows the approved 10px rhythm.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/app-shell.spec.ts --grep "workspace tabs|workspace tab chrome" --reporter=line`
- `npx playwright test tests/app-shell.spec.ts --reporter=line`

## Completion Notes

Completed on 2026-05-16.

- Added session-only logical workspace tabs for the App Shell.
- Added top workspace chrome with workspace selector, global search, tab back/forward, tab list, close buttons, and new-tab action.
- New tabs open `/w/:workspaceId/home?modulePanel=open`.
- Last remaining tab cannot be closed.
- Nav rail module links preserve link semantics, while normal left-clicks push into the active tab's route history.
- URL normalization updates the current active tab entry without collapsing that tab's back stack.
- Reload restores open tabs from `sessionStorage` for the current workspace.
- 10px spacing between top chrome, nav rail, and workspace frame is covered by Playwright.
- Electron/WebContents, inactive DOM preservation, per-tab global store isolation, live persistence, and server-side changes remain out of scope.
