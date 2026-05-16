# Workspace Tabs Design

Date: 2026-05-16
Status: Approved for implementation planning

## Goal

Add a Linear-style, app-internal workspace tab shell so CLAiR EMR users can keep multiple work views open, move between modules inside each tab, and use tab-scoped back/forward navigation.

## Product Hypothesis

Veterinary hospital staff are used to opening several application windows and switching between them during care delivery. They also need many related information views during a visit. CLAiR should preserve that familiar multi-window mental model inside one connected EMR shell: users can keep work contexts open as tabs while patient, encounter, and module navigation remain coordinated.

## MVP Direction

Implement the first version as logical workspace tabs, not Electron WebContents and not multi-mounted React views.

Each tab owns:

- a stable tab id
- a visible title
- a route history stack
- a current history index
- a closable flag
- optional future patient and encounter metadata

Only the active tab renders. Switching tabs changes the active tab and navigates the app to that tab's current route. Inactive tab DOM, scroll position, uncontrolled inputs, and local component state are not preserved in the MVP unless they already live in URL or shared stores.

## UX Model

The top shell becomes a desktop workstation chrome:

- workspace selector/logo
- global search/command entry
- active-tab back button
- active-tab forward button
- divider
- workspace tabs
- `+` new tab action

The existing `NavRail + WorkspaceFrame` layout remains below this top shell.

Spacing follows the Figma reference:

- use a 10px rhythm between major shell controls
- use 10px between the tab chrome and workspace content
- use 10px between nav rail, module panel, and content frame
- keep dense EMR panel surfaces with quiet lines, subtle elevation, and operational typography

## Behavior

### Initial Load

On first entry, create one tab from the current URL. Its title is derived from the active module label.

If saved session tabs exist and their workspace id matches the current workspace, restore them from `sessionStorage`. The active browser URL still wins when opening a direct shared link: if the current URL is not represented by the restored active tab, update the active tab to that URL.

### New Tab

The `+` action creates a new tab at:

```txt
/w/:workspaceId/home?modulePanel=open
```

For `clair-demo`, this becomes:

```txt
/w/clair-demo/home?modulePanel=open
```

The new tab becomes active.

### Module Navigation

Clicking an item in `NavRail` navigates inside the active tab. It pushes the target route onto that tab's history and drops any forward history after the current index.

Cross-module query preservation should continue to use the existing shell query allowlist for scenario and patient/encounter continuity.

### Back And Forward

Back and forward buttons operate on the active tab's history stack, not the browser's global history.

- Back is disabled when the active tab history index is `0`.
- Forward is disabled when the active tab history index is at the latest route.
- Moving back or forward updates the active tab's current route and syncs the browser URL.

### Tab Switch

Clicking a tab makes it active and syncs the browser URL to that tab's current route. The tab title updates when the current route's module changes.

### Close Tab

Tabs show a close affordance when more than one tab is open. The final remaining tab cannot be closed. This is the MVP rule; closing the last tab does not auto-create a Home tab.

When closing the active tab, activate the nearest remaining tab. Prefer the tab to the left; if none exists, use the tab to the right.

### Persistence

Persist tab state to `sessionStorage`, scoped by workspace id. This keeps the prototype session-only and avoids implying server persistence.

Do not persist to live DB/API. Do not use Supabase for this MVP.

## Architecture

Add a workspace tabs store that sits beside the existing layout store.

The layout store continues to own current shell layout state:

- drawer
- module panel open/closed
- content aside open/closed
- right panel open/closed
- panel widths
- selected queue ids

The new workspace tabs store owns cross-route tab state:

- open tabs
- active tab id
- tab route histories
- tab-scoped navigation actions
- session storage hydration

`AppShell` becomes the coordinator:

- reads the active route from browser URL and current module params
- initializes/restores workspace tabs
- renders the top workspace tab chrome
- renders the current module through the existing `WorkspaceFrame`
- syncs active tab route changes to Next router

`NavRail` should stop using raw `Link` navigation for module switches in the tabbed shell. It should call a tab-aware navigation callback supplied by `AppShell`, preserving current query parameters through the existing cross-module query helper.

## State Shape

```ts
type WorkspaceTab = {
  id: string;
  title: string;
  closable: boolean;
  history: string[];
  historyIndex: number;
  moduleId: string;
  patientId?: string;
  encounterId?: string;
};
```

```ts
type WorkspaceTabsState = {
  workspaceId: string | null;
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  hydrated: boolean;
};
```

## Accessibility

- Render the tab list with `role="tablist"`.
- Render each tab with `role="tab"` and `aria-selected`.
- Give close buttons labels such as `조제/처치 탭 닫기`.
- Give back/forward buttons labels `탭 뒤로가기`, `탭 앞으로가기`.
- Disabled back/forward buttons must use native disabled state.
- Keyboard roving focus is not required in MVP, but native focus order must be sensible.

## Testing

Add focused Playwright coverage for:

- initial route creates one active tab
- `+` creates a Home tab and activates it
- nav rail navigation pushes history inside the active tab
- back and forward move within the active tab history
- switching tabs restores each tab's current route
- closing the active tab activates the nearest remaining tab
- the final remaining tab cannot be closed
- session reload restores open tabs

Also keep existing app-shell tests passing.

## Out Of Scope

- Electron shell, WebContents, BrowserView, or native packaging
- ChromeOS PWA `tabbed` mode changes
- inactive tab DOM preservation
- tab-specific global store isolation
- full scroll, form draft, table sort, and filter preservation
- live API/DB persistence
- Supabase validation or RLS changes
- mobile layout

## Open Follow-Ups

- Decide later whether to evolve from logical tabs to multi-mounted tabs inside the web app.
- Decide later whether a desktop Electron shell is worth the packaging and update cost.
- Add patient/encounter-specific tab titles once route state consistently exposes those ids.
