# App Shell Layout Contract Design

Date: 2026-05-17
Status: Draft for user review
Scope: App shell visual structure and layout contract

## Goal

Align the current app shell with the Figma `key_screen` layout structure while preserving existing CLAiR components and product behavior. The target is not pixel-for-pixel Figma node recreation. The target is a shared shell layout contract: clear navigation/workspace regions, consistent 10px spacing, and balanced open/collapsed navigation states.

## Source References

- Figma: `CDS.V2 CLAiR EMR Design System Ver.2`, `ReadMe` section, node `27235:50103`
- Figma frames inspected:
  - Expanded `key_screen`: `leftSection` width `366`, `rightSection` width `1554`
  - Collapsed `key_screen`: `leftSection` width `63`, `rightSection` width `1857`
- Local app reference:
  - `/w/clair-demo/reception?modulePanel=open`
  - `/w/clair-demo/reception?modulePanel=closed`

## Confirmed Decisions

1. Keep `WorkspaceTabsBar` as the global top row.
   - It remains above the Figma-like work area because workspace tabs are app-wide chrome, not content inside the active module.

2. Apply the Figma-like layout below the global tabs.
   - `ShellMain` becomes the main work area under `WorkspaceTabsBar`.
   - `ShellMain` owns the large navigation and workspace regions.

3. Add role-based layout wrappers without recreating UI.
   - Add only structural wrappers such as `ShellMain`, `ShellNavigationColumn`, `ShellWorkspaceArea`, and `ModulePanelArea`.
   - Reuse and move existing UI components instead of building new visual controls.

4. Move the existing workspace selector into the navigation column.
   - Extract the current workspace button from `WorkspaceTabsBar`.
   - Render it at the top of `ShellNavigationColumn`.
   - In collapsed mode, the workspace selector also collapses to a compact/icon form so the left column remains visually balanced.

5. Preserve existing shell behavior.
   - Keep tab history, module navigation, global command, auth profile, URL layout state, drawers, content aside, and right panel behavior.
   - Do not rewrite module content, side panel internals, queue cards, tables, or feature-specific headers unless spacing integration requires a small wrapper-level adjustment.

6. Use a 10px spacing contract.
   - App work area outer padding: `10px`
   - Gap between `ShellNavigationColumn` and `ShellWorkspaceArea`: `10px`
   - Navigation column internal vertical gap: `10px`
   - Gap between `WorkspaceSwitcher` and `ModulePanelArea`: `10px`
   - Gap between `NavRail` and module side panel: `10px`
   - Workspace area internal section gap where applicable: `10px`

## Recommended Naming

Use role-oriented names instead of copying Figma directional names directly.

| Figma name | Recommended local name | Notes |
|---|---|---|
| `leftSection` | `ShellNavigationColumn` | Holds workspace switcher, nav rail, and module side panel. |
| `rightSection` | `ShellWorkspaceArea` | Holds the active work surface. |
| `workspace` | `WorkspaceSwitcher` | Existing workspace selection button, extracted and reused. |
| `sidepanel` | `ModulePanelArea` | Structural area containing `NavRail` and module side panel. |
| `LeftNavigation` | `NavRail` | Keep existing name. |
| `leftSubPanel` | `ModuleSidePanel` / `moduleDefinition.sidePanel` | Keep existing module slot model. |
| `topbar` | Existing global `WorkspaceTabsBar`; future workspace toolbar only if needed | Global tabs stay above `ShellMain`. |
| `contents` | `WorkspaceFrame` | Keep existing name and slot ownership. |
| `historyList` | `ContentAside` | Keep existing slot concept. |
| `rightPanel` | `RightPanel` | Keep existing slot concept. |

## Target Structure

```text
AppShell
  ├─ WorkspaceTabsBar
  └─ ShellMain
      ├─ ShellNavigationColumn
      │   ├─ WorkspaceSwitcher
      │   └─ ModulePanelArea
      │       ├─ NavRail
      │       └─ ModuleSidePanel
      └─ ShellWorkspaceArea
          └─ WorkspaceFrame
```

## Component Responsibility

### `WorkspaceTabsBar`

Keeps global tab concerns:

- active tab display
- tab close/new tab
- tab back/forward
- global command trigger
- utility actions
- profile menu

It should no longer own the full-size workspace selector once `WorkspaceSwitcher` moves into `ShellNavigationColumn`.

### `WorkspaceSwitcher`

Extract the current workspace selection button from `WorkspaceTabsBar`.

- Open state: show logo, workspace name, and chevron using the current visual treatment.
- Collapsed state: show compact icon-only form aligned to the collapsed navigation column width.
- Do not invent a new visual style; reuse current button/icon tokens and adjust layout only.

### `ShellNavigationColumn`

Owns the left-side visual column under the global tabs.

- Open state: contains `WorkspaceSwitcher` and `ModulePanelArea`.
- Collapsed state: contains compact `WorkspaceSwitcher` and `ModulePanelArea` with only `NavRail`.
- Width should be derived from shell layout tokens rather than hardcoded in several components.

### `ModulePanelArea`

Owns the horizontal relationship between `NavRail` and the active module side panel.

- Open state: `NavRail`, 10px gap, module side panel.
- Collapsed state: `NavRail` only, with the same column rhythm.
- Existing `moduleDefinition.sidePanel` implementations stay unchanged unless wrapper spacing requires a small adjustment.

### `ShellWorkspaceArea`

Owns the active workspace region under the global tabs.

- Renders `WorkspaceFrame`.
- Should align to `ShellNavigationColumn` with a 10px column gap.
- It should not take over module internals.

### `WorkspaceFrame`

Keeps current feature workspace responsibilities:

- module content header
- content aside
- module content
- right panel
- drawers

It should become less responsible for the outer nav/module-panel relationship, because that relationship belongs to `ShellNavigationColumn` and `ModulePanelArea`.

## Out Of Scope

- Pixel-perfect Figma side panel dimensions.
- Rebuilding existing controls from scratch.
- Renaming all existing shell slots.
- Moving workspace tabs into the right-side workspace area.
- Reworking feature modules, module content, tables, queue item internals, drawer behavior, or auth state.
- Changing live data, Supabase, permissions, or server behavior.

## Risks

- `WorkspaceTabsBar` currently combines workspace selector, tab controls, utility controls, and profile state. Extracting `WorkspaceSwitcher` should be done carefully to avoid tab or auth regressions.
- `WorkspaceFrame` currently owns module side panel width and animation. Moving that ownership outward can affect URL-driven `modulePanel=open/closed` behavior.
- Existing Playwright tests rely on accessible names and test IDs in the shell. Tests should be updated only where the rendered location changes, not where behavior stays the same.
- There are pre-existing uncommitted changes in `src/shell/global-command-palette.tsx`, `src/shell/workspace-tabs-bar.tsx`, and `tests/app-shell.spec.ts`. Implementation should inspect and preserve those changes.

## Verification Plan

Minimum verification after implementation:

- `npm run lint`
- `npx tsc --noEmit`
- focused shell tests, including `tests/app-shell.spec.ts`
- browser check for:
  - `/w/clair-demo/reception?modulePanel=open`
  - `/w/clair-demo/reception?modulePanel=closed`
  - at least one module with `contentAside`
  - at least one module with `rightPanel`

Visual acceptance criteria:

- `WorkspaceTabsBar` remains the top global row.
- Main work area below tabs reads as navigation column plus workspace area.
- Major shell gaps follow the 10px contract.
- Workspace selector collapses with the navigation column.
- Existing CLAiR controls are reused rather than visually recreated.
