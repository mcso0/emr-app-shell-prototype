# Workspace Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP logical workspace tabs shell so each tab owns its own route history, supports tab-scoped back/forward, can open and close tabs, and persists tabs for the current session.

**Architecture:** Add a new Zustand workspace-tabs store beside the existing layout store. Keep only the active tab rendered through the current Next route and existing `WorkspaceFrame`; use tab state to coordinate top chrome, nav rail navigation, route sync, and sessionStorage restore. Preserve current app-shell URL/share behavior by keeping the browser URL synced to the active tab's current route.

**Tech Stack:** Next.js App Router, React 19, Zustand, Tailwind CSS v4, Playwright, TypeScript.

---

## Scope And File Structure

This plan implements the approved logical-tabs MVP from `docs/superpowers/specs/2026-05-16-workspace-tabs-design.md`. It does not implement Electron, BrowserView/WebContents tabs, inactive tab DOM preservation, live persistence, or mobile-specific behavior.

**Files to create:**

- `src/stores/workspace-tabs-store.ts`: tab data model, pure helpers, Zustand actions, sessionStorage serialization.
- `src/shell/workspace-tabs-bar.tsx`: Linear-style top tab chrome with workspace selector/search/back/forward/tabs/new-tab.
- App-shell workspace tabs work item: PR-sized work item for durable routing. Create it in an `app-shell` subfolder under `docs/work` with filename `APP-SHELL-PR-001-workspace-tabs.md`.

**Files to modify:**

- `src/shell/app-shell.tsx`: initialize workspace tabs, sync active route, render the new top chrome, pass tab-aware navigation to `NavRail`.
- `src/shell/nav-rail.tsx`: replace raw `Link` module navigation with a button/callback that pushes into the active tab history.
- `src/shell/top-menu.tsx`: either remove from `AppShell` rendering or leave as an unused component. Do not delete it in this PR.
- `src/shell/layout-contract.ts`: add `topChromeHeight` and 10px shell rhythm constants if needed.
- `tests/app-shell.spec.ts`: update old nav rail link interactions and add workspace tab behavior coverage.
- `docs/work/index.md`: add the app-shell work item.
- `docs/engineering/current-status.md`: record the MVP workspace tabs state and explicit non-goals.

**Existing behavior to preserve:**

- Auth gate still wraps the shell.
- Direct URLs under `/w/:workspaceId/:module` still render.
- Cross-module query keys such as `scenario`, `patientId`, `encounterId`, `labResultId`, `imagingStudyId`, and `invoiceId` continue to survive module navigation.
- Module panel, content aside, right panel, and drawer URL sync continue to work.
- Last remaining tab cannot be closed.

---

### Task 1: Add Failing Workspace Tab Smoke Tests

**Files:**
- Modify: `tests/app-shell.spec.ts`

- [ ] **Step 1: Add helpers near the existing test helpers**

Add these helpers after `resolveCssColor`:

```ts
async function clearWorkspaceTabs(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.removeItem("clair-workspace-tabs:v1:clair-demo");
  });
}

async function expectActiveWorkspaceTab(page: Page, name: string) {
  await expect(page.getByRole("tab", { name: new RegExp(name) })).toHaveAttribute("aria-selected", "true");
}
```

- [ ] **Step 2: Add a failing initial/new/last-close test**

Add this test before the existing PWA manifest test:

```ts
test("workspace tabs create an initial tab and keep the final tab open", async ({ page }) => {
  await clearWorkspaceTabs(page);
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");

  await expect(page.getByRole("tablist", { name: "열린 업무 탭" })).toBeVisible();
  await expectActiveWorkspaceTab(page, "조제/처치");
  await expect(page.getByRole("button", { name: "새 업무 탭" })).toBeVisible();
  await expect(page.getByRole("button", { name: "조제/처치 탭 닫기" })).toHaveCount(0);

  await page.getByRole("button", { name: "새 업무 탭" }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/home/);
  await expectActiveWorkspaceTab(page, "홈");
  await expect(page.getByRole("tab")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "홈 탭 닫기" })).toBeVisible();

  await page.getByRole("button", { name: "홈 탭 닫기" }).click();
  await expect(page.getByRole("tab")).toHaveCount(1);
  await expectActiveWorkspaceTab(page, "조제/처치");
  await expect(page.getByRole("button", { name: "조제/처치 탭 닫기" })).toHaveCount(0);
});
```

- [ ] **Step 3: Run the focused test and verify it fails**

Run:

```bash
npx playwright test tests/app-shell.spec.ts --grep "workspace tabs create" --reporter=line
```

Expected: FAIL because the top workspace tab chrome does not exist yet.

- [ ] **Step 4: Commit the failing test**

```bash
git add tests/app-shell.spec.ts
git commit -m "test: add workspace tabs smoke coverage"
```

---

### Task 2: Add Workspace Tabs Store

**Files:**
- Create: `src/stores/workspace-tabs-store.ts`

- [ ] **Step 1: Create the workspace tabs store**

Create `src/stores/workspace-tabs-store.ts` with this content:

```ts
"use client";

import { create } from "zustand";
import { modules } from "@/modules/registry";

export type WorkspaceTab = {
  id: string;
  title: string;
  closable: boolean;
  history: string[];
  historyIndex: number;
  moduleId: string;
  patientId?: string;
  encounterId?: string;
};

type PersistedWorkspaceTabs = {
  workspaceId: string;
  tabs: WorkspaceTab[];
  activeTabId: string;
};

type WorkspaceTabsStore = {
  workspaceId: string | null;
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  hydrated: boolean;
  initialize: (input: { workspaceId: string; route: string; moduleId: string }) => void;
  pushRoute: (route: string, moduleId: string) => void;
  activateTab: (tabId: string) => string | null;
  closeTab: (tabId: string) => string | null;
  createTab: (input: { workspaceId: string; route: string; moduleId: string }) => string;
  goBack: () => string | null;
  goForward: () => string | null;
  syncActiveRoute: (route: string, moduleId: string) => void;
};

const STORAGE_PREFIX = "clair-workspace-tabs:v1";

function getStorageKey(workspaceId: string) {
  return `${STORAGE_PREFIX}:${workspaceId}`;
}

function getTabTitle(moduleId: string) {
  return modules.find((module) => module.id === moduleId)?.label ?? moduleId;
}

function createWorkspaceTab(input: {
  route: string;
  moduleId: string;
  closable: boolean;
}): WorkspaceTab {
  const searchParams = new URLSearchParams(input.route.split("?")[1] ?? "");

  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: getTabTitle(input.moduleId),
    closable: input.closable,
    history: [input.route],
    historyIndex: 0,
    moduleId: input.moduleId,
    patientId: searchParams.get("patientId") ?? undefined,
    encounterId: searchParams.get("encounterId") ?? undefined,
  };
}

function normalizeTabs(tabs: WorkspaceTab[]) {
  if (tabs.length === 0) return tabs;

  return tabs.map((tab, index) => ({
    ...tab,
    closable: tabs.length > 1 && index !== 0 ? tab.closable : tabs.length > 1,
  }));
}

function persist(workspaceId: string | null, tabs: WorkspaceTab[], activeTabId: string | null) {
  if (!workspaceId || !activeTabId || typeof window === "undefined") return;

  const payload: PersistedWorkspaceTabs = { workspaceId, tabs, activeTabId };
  window.sessionStorage.setItem(getStorageKey(workspaceId), JSON.stringify(payload));
}

function readPersistedTabs(workspaceId: string): PersistedWorkspaceTabs | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(getStorageKey(workspaceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedWorkspaceTabs;
    if (parsed.workspaceId !== workspaceId || parsed.tabs.length === 0) return null;
    if (!parsed.tabs.some((tab) => tab.id === parsed.activeTabId)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function updateActiveTab(
  state: WorkspaceTabsStore,
  updater: (tab: WorkspaceTab) => WorkspaceTab
) {
  const activeTabId = state.activeTabId;
  if (!activeTabId) return state;

  const tabs = state.tabs.map((tab) => (tab.id === activeTabId ? updater(tab) : tab));
  persist(state.workspaceId, tabs, activeTabId);

  return { ...state, tabs };
}

export const useWorkspaceTabsStore = create<WorkspaceTabsStore>()((set, get) => ({
  workspaceId: null,
  tabs: [],
  activeTabId: null,
  hydrated: false,

  initialize: ({ workspaceId, route, moduleId }) => {
    const persisted = readPersistedTabs(workspaceId);

    if (persisted) {
      const tabs = persisted.tabs;
      const activeTabId = persisted.activeTabId;
      set({ workspaceId, tabs, activeTabId, hydrated: true });
      get().syncActiveRoute(route, moduleId);
      return;
    }

    const tab = createWorkspaceTab({ route, moduleId, closable: false });
    set({ workspaceId, tabs: [tab], activeTabId: tab.id, hydrated: true });
    persist(workspaceId, [tab], tab.id);
  },

  pushRoute: (route, moduleId) => {
    set((state) =>
      updateActiveTab(state, (tab) => {
        const nextHistory = tab.history.slice(0, tab.historyIndex + 1);
        nextHistory.push(route);
        const searchParams = new URLSearchParams(route.split("?")[1] ?? "");

        return {
          ...tab,
          title: getTabTitle(moduleId),
          moduleId,
          history: nextHistory,
          historyIndex: nextHistory.length - 1,
          patientId: searchParams.get("patientId") ?? undefined,
          encounterId: searchParams.get("encounterId") ?? undefined,
        };
      })
    );
  },

  activateTab: (tabId) => {
    const tab = get().tabs.find((item) => item.id === tabId);
    if (!tab) return null;
    set({ activeTabId: tabId });
    persist(get().workspaceId, get().tabs, tabId);
    return tab.history[tab.historyIndex] ?? null;
  },

  closeTab: (tabId) => {
    const state = get();
    if (state.tabs.length <= 1) return null;

    const closingIndex = state.tabs.findIndex((tab) => tab.id === tabId);
    if (closingIndex < 0) return null;

    const nextTabs = state.tabs.filter((tab) => tab.id !== tabId);
    const fallbackIndex = Math.max(0, closingIndex - 1);
    const nextActiveTab =
      state.activeTabId === tabId
        ? nextTabs[fallbackIndex] ?? nextTabs[0]
        : nextTabs.find((tab) => tab.id === state.activeTabId) ?? nextTabs[0];

    set({
      tabs: normalizeTabs(nextTabs),
      activeTabId: nextActiveTab.id,
    });
    persist(state.workspaceId, normalizeTabs(nextTabs), nextActiveTab.id);

    return nextActiveTab.history[nextActiveTab.historyIndex] ?? null;
  },

  createTab: ({ workspaceId, route, moduleId }) => {
    const tab = createWorkspaceTab({ route, moduleId, closable: true });

    set((state) => {
      const tabs = normalizeTabs([...state.tabs, tab]);
      persist(workspaceId, tabs, tab.id);
      return { workspaceId, tabs, activeTabId: tab.id, hydrated: true };
    });

    return route;
  },

  goBack: () => {
    const activeTab = get().tabs.find((tab) => tab.id === get().activeTabId);
    if (!activeTab || activeTab.historyIndex === 0) return null;
    const nextIndex = activeTab.historyIndex - 1;
    const route = activeTab.history[nextIndex];

    set((state) =>
      updateActiveTab(state, (tab) => ({
        ...tab,
        historyIndex: nextIndex,
        moduleId: route.split("?")[0]?.split("/")[3] ?? tab.moduleId,
        title: getTabTitle(route.split("?")[0]?.split("/")[3] ?? tab.moduleId),
      }))
    );

    return route;
  },

  goForward: () => {
    const activeTab = get().tabs.find((tab) => tab.id === get().activeTabId);
    if (!activeTab || activeTab.historyIndex >= activeTab.history.length - 1) return null;
    const nextIndex = activeTab.historyIndex + 1;
    const route = activeTab.history[nextIndex];

    set((state) =>
      updateActiveTab(state, (tab) => ({
        ...tab,
        historyIndex: nextIndex,
        moduleId: route.split("?")[0]?.split("/")[3] ?? tab.moduleId,
        title: getTabTitle(route.split("?")[0]?.split("/")[3] ?? tab.moduleId),
      }))
    );

    return route;
  },

  syncActiveRoute: (route, moduleId) => {
    set((state) =>
      updateActiveTab(state, (tab) => {
        if (tab.history[tab.historyIndex] === route) {
          return { ...tab, title: getTabTitle(moduleId), moduleId };
        }

        return {
          ...tab,
          title: getTabTitle(moduleId),
          moduleId,
          history: [route],
          historyIndex: 0,
        };
      })
    );
  },
}));
```

- [ ] **Step 2: Run TypeScript and fix any store typing errors**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS after fixing any exact inferred return type issues in the new store. Do not change app behavior yet.

- [ ] **Step 3: Commit the store**

```bash
git add src/stores/workspace-tabs-store.ts
git commit -m "feat: add workspace tabs store"
```

---

### Task 3: Render The Top Workspace Tabs Chrome

**Files:**
- Create: `src/shell/workspace-tabs-bar.tsx`
- Modify: `src/shell/app-shell.tsx`

- [ ] **Step 1: Create the top chrome component**

Create `src/shell/workspace-tabs-bar.tsx` with this content:

```tsx
"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  SearchIcon,
  WorkspaceLogoMarkIcon,
} from "@/components/icons";
import { CdsActionsPlusIcon } from "@/components/cds-icons/actions-and-controls";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkspaceTab } from "@/stores/workspace-tabs-store";

type WorkspaceTabsBarProps = {
  activeTabId: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  tabs: WorkspaceTab[];
  workspaceId: string;
  onActivateTab: (tabId: string) => void;
  onBack: () => void;
  onCloseTab: (tabId: string) => void;
  onForward: () => void;
  onNewTab: () => void;
};

export function WorkspaceTabsBar({
  activeTabId,
  canGoBack,
  canGoForward,
  tabs,
  workspaceId,
  onActivateTab,
  onBack,
  onCloseTab,
  onForward,
  onNewTab,
}: WorkspaceTabsBarProps) {
  const hasMultipleTabs = tabs.length > 1;

  return (
    <header
      data-testid="workspace-tabs-bar"
      className="relative z-20 flex h-[58px] items-center gap-2.5 bg-[var(--emr-surface-app)] px-2.5"
    >
      <button
        type="button"
        className="flex h-10 min-w-[240px] items-center gap-2 rounded-[var(--emr-radius-panel)] bg-[var(--emr-surface-panel)] px-3 text-[15px] font-semibold text-[var(--emr-text-primary)] shadow-[var(--emr-shadow-control)]"
        aria-label={`${workspaceId} 워크스페이스 선택`}
      >
        <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-primary text-primary-foreground">
          <WorkspaceLogoMarkIcon className="size-7" aria-hidden="true" />
        </span>
        <span className="truncate">VIP 동물의료센터 청담점</span>
      </button>

      <Button variant="outline" size="icon" aria-label="전역 통합 검색 열기" className="size-10 rounded-[var(--emr-radius-panel)]">
        <SearchIcon className="size-5" aria-hidden="true" />
      </Button>

      <Button variant="outline" size="icon" aria-label="탭 뒤로가기" disabled={!canGoBack} onClick={onBack} className="size-10 rounded-[var(--emr-radius-panel)]">
        <ChevronLeftIcon className="size-5" aria-hidden="true" />
      </Button>
      <Button variant="outline" size="icon" aria-label="탭 앞으로가기" disabled={!canGoForward} onClick={onForward} className="size-10 rounded-[var(--emr-radius-panel)]">
        <ChevronRightIcon className="size-5" aria-hidden="true" />
      </Button>

      <div className="h-7 w-px shrink-0 bg-[var(--emr-line-container)]" />

      <div className="flex min-w-0 flex-1 items-center gap-2.5" role="tablist" aria-label="열린 업무 탭">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;

          return (
            <div
              key={tab.id}
              className={cn(
                "flex h-10 max-w-[230px] items-center gap-2 rounded-[var(--emr-radius-panel)] border px-3 text-[14px] font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                active
                  ? "border-[var(--emr-line-container)] bg-card text-[var(--emr-text-primary)] shadow-[var(--emr-shadow-control)]"
                  : "border-transparent bg-[var(--emr-surface-muted)] text-[var(--emr-text-secondary)] hover:bg-card"
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className="min-w-0 flex-1 truncate text-left outline-none"
                onClick={() => onActivateTab(tab.id)}
              >
                {tab.title}
              </button>
              {hasMultipleTabs ? (
                <button
                  type="button"
                  aria-label={`${tab.title} 탭 닫기`}
                  className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  onClick={() => onCloseTab(tab.id)}
                >
                  <CloseIcon className="size-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <Button variant="ghost" size="icon" aria-label="새 업무 탭" onClick={onNewTab} className="size-10 rounded-[var(--emr-radius-panel)]">
        <CdsActionsPlusIcon className="size-5" aria-hidden="true" />
      </Button>
    </header>
  );
}
```

- [ ] **Step 2: Wire the component in `AppShell`**

In `src/shell/app-shell.tsx`:

1. Remove the `TopMenu` import.
2. Import `WorkspaceTabsBar`.
3. Import `useWorkspaceTabsStore`.
4. Compute the current route as `pathname + (search ? \`?\${search}\` : "")`.
5. Call `initialize({ workspaceId, route: currentRoute, moduleId: moduleDefinition.id })` once per workspace in an effect.
6. Render `WorkspaceTabsBar` instead of `TopMenu`.
7. Change shell height math from `52px` to `58px`.

The final return should have this shape:

```tsx
return (
  <div className="h-screen min-h-0 overflow-hidden bg-[var(--emr-surface-app)] text-foreground">
    <WorkspaceTabsBar
      activeTabId={activeTabId}
      canGoBack={Boolean(activeTab && activeTab.historyIndex > 0)}
      canGoForward={Boolean(activeTab && activeTab.historyIndex < activeTab.history.length - 1)}
      tabs={tabs}
      workspaceId={workspaceId}
      onActivateTab={handleActivateTab}
      onBack={handleTabBack}
      onCloseTab={handleCloseTab}
      onForward={handleTabForward}
      onNewTab={handleNewTab}
    />
    <div className="grid h-[calc(100vh-58px)] grid-cols-[48px_1fr] gap-2.5 px-2.5 pb-2.5">
      <NavRail
        activeModuleId={moduleDefinition.id}
        navigationSearch={navigationSearch}
        workspaceId={workspaceId}
      />
      <WorkspaceFrame moduleDefinition={moduleDefinition} workspaceId={workspaceId} />
    </div>
  </div>
);
```

- [ ] **Step 3: Add the handlers in `AppShell`**

Add these handlers before the return:

```tsx
const {
  activeTabId,
  activateTab,
  closeTab,
  createTab,
  goBack,
  goForward,
  initialize,
  tabs,
} = useWorkspaceTabsStore();
const activeTab = tabs.find((tab) => tab.id === activeTabId);
const currentRoute = `${pathname}${search ? `?${search}` : ""}`;
const tabsInitializedRef = useRef<string | null>(null);

useEffect(() => {
  if (tabsInitializedRef.current === workspaceId) return;
  initialize({ workspaceId, route: currentRoute, moduleId: moduleDefinition.id });
  tabsInitializedRef.current = workspaceId;
}, [currentRoute, initialize, moduleDefinition.id, workspaceId]);

function navigateToTabRoute(route: string | null) {
  if (!route) return;
  router.push(route, { scroll: false });
}

function handleActivateTab(tabId: string) {
  navigateToTabRoute(activateTab(tabId));
}

function handleCloseTab(tabId: string) {
  navigateToTabRoute(closeTab(tabId));
}

function handleNewTab() {
  const route = `/w/${workspaceId}/home?modulePanel=open`;
  navigateToTabRoute(createTab({ workspaceId, route, moduleId: "home" }));
}

function handleTabBack() {
  navigateToTabRoute(goBack());
}

function handleTabForward() {
  navigateToTabRoute(goForward());
}
```

- [ ] **Step 4: Run the focused smoke test**

Run:

```bash
npx playwright test tests/app-shell.spec.ts --grep "workspace tabs create" --reporter=line
```

Expected: PASS.

- [ ] **Step 5: Commit the top chrome**

```bash
git add src/shell/app-shell.tsx src/shell/workspace-tabs-bar.tsx
git commit -m "feat: render workspace tabs chrome"
```

---

### Task 4: Make Nav Rail Navigation Tab-Aware

**Files:**
- Modify: `tests/app-shell.spec.ts`
- Modify: `src/shell/nav-rail.tsx`
- Modify: `src/shell/app-shell.tsx`

- [ ] **Step 1: Add failing tab history test**

Add this test before the PWA manifest test:

```ts
test("workspace tabs keep navigation history per active tab", async ({ page }) => {
  await clearWorkspaceTabs(page);
  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=closed&right=closed");
  await expectActiveWorkspaceTab(page, "진료/차트");

  await page.getByRole("button", { name: "임상병리검사" }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/lab/);
  await expectActiveWorkspaceTab(page, "검사");
  await expect(page.getByRole("button", { name: "탭 뒤로가기" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "탭 앞으로가기" })).toBeDisabled();

  await page.getByRole("button", { name: "탭 뒤로가기" }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/treatment/);
  await expectActiveWorkspaceTab(page, "진료/차트");
  await expect(page.getByRole("button", { name: "탭 앞으로가기" })).toBeEnabled();

  await page.getByRole("button", { name: "새 업무 탭" }).click();
  await expectActiveWorkspaceTab(page, "홈");
  await page.getByRole("button", { name: "수납" }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/billing/);
  await expectActiveWorkspaceTab(page, "수납");

  await page.getByRole("tab", { name: /진료\/차트/ }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/treatment/);
  await expect(page.getByRole("button", { name: "탭 앞으로가기" })).toBeEnabled();
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx playwright test tests/app-shell.spec.ts --grep "workspace tabs keep navigation" --reporter=line
```

Expected: FAIL because nav rail still uses raw links and does not call `pushRoute`.

- [ ] **Step 3: Change `NavRailProps`**

In `src/shell/nav-rail.tsx`, add a callback prop:

```ts
type NavRailProps = {
  activeModuleId: string;
  navigationSearch?: string;
  workspaceId: string;
  onNavigateModule?: (href: string, moduleId: string) => void;
};
```

Pass it through `NavSection` and `RailModuleItem`.

- [ ] **Step 4: Replace module `Link` with a button**

In `RailModuleItem`, replace the `Link` usage with:

```tsx
<button
  type="button"
  className={cn(
    "flex size-8 items-center justify-center rounded-[6px] text-primary-foreground/55 outline-none transition-colors hover:text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
    active && "bg-primary-foreground/15 text-primary-foreground"
  )}
  aria-current={active ? "page" : undefined}
  aria-label={item.label}
  data-testid={active ? "nav-rail-active-item" : undefined}
  onClick={() => {
    if (item.moduleId) {
      onNavigateModule?.(href, item.moduleId);
    }
  }}
>
  <IconFrame>
    <Icon className={item.iconClassName} />
  </IconFrame>
</button>
```

Remove the unused `Link` import.

- [ ] **Step 5: Add tab-aware module navigation in `AppShell`**

Import `pushRoute` from `useWorkspaceTabsStore()` and add:

```tsx
function handleNavigateModule(href: string, nextModuleId: string) {
  pushRoute(href, nextModuleId);
  router.push(href, { scroll: false });
}
```

Pass it to `NavRail`:

```tsx
<NavRail
  activeModuleId={moduleDefinition.id}
  navigationSearch={navigationSearch}
  workspaceId={workspaceId}
  onNavigateModule={handleNavigateModule}
/>
```

- [ ] **Step 6: Update existing nav rail tests from links to buttons**

In `tests/app-shell.spec.ts`, replace:

```ts
page.getByRole("link", { name: "홈" })
page.getByRole("link", { name: "조제/처치" })
page.getByRole("link", { name: "임상병리검사" })
```

with:

```ts
page.getByRole("button", { name: "홈" })
page.getByRole("button", { name: "조제/처치" })
page.getByRole("button", { name: "임상병리검사" })
```

- [ ] **Step 7: Run focused app-shell navigation tests**

Run:

```bash
npx playwright test tests/app-shell.spec.ts --grep "workspace tabs keep|home normalizes|shell navigation keeps" --reporter=line
```

Expected: PASS.

- [ ] **Step 8: Commit tab-aware nav rail**

```bash
git add src/shell/app-shell.tsx src/shell/nav-rail.tsx tests/app-shell.spec.ts
git commit -m "feat: route module navigation through active tab"
```

---

### Task 5: Add Session Restore Coverage

**Files:**
- Modify: `tests/app-shell.spec.ts`
- Modify: `src/stores/workspace-tabs-store.ts`
- Modify: `src/shell/app-shell.tsx`

- [ ] **Step 1: Add failing session restore test**

Add this test before the PWA manifest test:

```ts
test("workspace tabs restore open tabs after reload", async ({ page }) => {
  await clearWorkspaceTabs(page);
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");

  await page.getByRole("button", { name: "새 업무 탭" }).click();
  await page.getByRole("button", { name: "임상병리검사" }).click();
  await expectActiveWorkspaceTab(page, "검사");
  await expect(page.getByRole("tab")).toHaveCount(2);

  await page.reload();

  await expect(page.getByRole("tab")).toHaveCount(2);
  await expectActiveWorkspaceTab(page, "검사");
  await expect(page).toHaveURL(/\/w\/clair-demo\/lab/);

  await page.getByRole("tab", { name: /조제\/처치/ }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/dispensing/);
});
```

- [ ] **Step 2: Run the failing restore test**

Run:

```bash
npx playwright test tests/app-shell.spec.ts --grep "workspace tabs restore" --reporter=line
```

Expected: FAIL if reload restore or direct URL reconciliation is incomplete.

- [ ] **Step 3: Fix restore reconciliation**

If the restore test fails because `initialize()` overwrites the active tab with the current reload route, adjust `initialize()` in `src/stores/workspace-tabs-store.ts`:

```ts
if (persisted) {
  const activeTab = persisted.tabs.find((tab) => tab.id === persisted.activeTabId);
  const activeRoute = activeTab?.history[activeTab.historyIndex];
  set({ workspaceId, tabs: persisted.tabs, activeTabId: persisted.activeTabId, hydrated: true });

  if (activeRoute !== route) {
    get().syncActiveRoute(route, moduleId);
  }

  return;
}
```

Then run the restore test again. If the intended behavior should prefer the persisted active route on plain reload, update `AppShell` to call `router.replace(activeRoute, { scroll: false })` after hydration instead of mutating the restored tab.

Use the behavior from the approved spec: browser direct URL wins only when opening a direct shared link. A normal reload at the active route should preserve the active tab.

- [ ] **Step 4: Run focused restore test**

Run:

```bash
npx playwright test tests/app-shell.spec.ts --grep "workspace tabs restore" --reporter=line
```

Expected: PASS.

- [ ] **Step 5: Commit restore behavior**

```bash
git add src/stores/workspace-tabs-store.ts src/shell/app-shell.tsx tests/app-shell.spec.ts
git commit -m "feat: restore workspace tabs from session storage"
```

---

### Task 6: Polish Shell Spacing And Accessibility

**Files:**
- Modify: `src/shell/workspace-tabs-bar.tsx`
- Modify: `src/shell/app-shell.tsx`
- Modify: `tests/app-shell.spec.ts`

- [ ] **Step 1: Add a focused spacing/accessibility test**

Add this test before the PWA manifest test:

```ts
test("workspace tab chrome follows the 10px shell rhythm", async ({ page }) => {
  await clearWorkspaceTabs(page);
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");

  const metrics = await page.evaluate(() => {
    const header = document.querySelector("[data-testid='workspace-tabs-bar']");
    const nav = document.querySelector("nav");
    const main = document.querySelector("main");

    if (!header || !nav || !main) {
      throw new Error("Workspace tab chrome, nav rail, or workspace frame was not found.");
    }

    const headerBox = header.getBoundingClientRect();
    const navBox = nav.getBoundingClientRect();
    const mainBox = main.getBoundingClientRect();

    return {
      headerToNav: Math.round(navBox.top - headerBox.bottom),
      navToMain: Math.round(mainBox.left - navBox.right),
    };
  });

  expect(metrics.headerToNav).toBe(10);
  expect(metrics.navToMain).toBe(10);
  await expect(page.getByRole("button", { name: "탭 뒤로가기" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "탭 앞으로가기" })).toBeDisabled();
});
```

- [ ] **Step 2: Adjust layout if the spacing test fails**

Keep the shell grid in `AppShell` at:

```tsx
<div className="grid h-[calc(100vh-58px)] grid-cols-[48px_1fr] gap-2.5 px-2.5 pb-2.5">
```

If `headerToNav` is not 10, add `pt-0` only if needed and keep the top chrome height fixed. If `navToMain` is not 10, keep `gap-2.5` and avoid adding margin to `NavRail` or `WorkspaceFrame`.

- [ ] **Step 3: Run focused spacing/accessibility test**

Run:

```bash
npx playwright test tests/app-shell.spec.ts --grep "workspace tab chrome follows" --reporter=line
```

Expected: PASS.

- [ ] **Step 4: Commit polish**

```bash
git add src/shell/app-shell.tsx src/shell/workspace-tabs-bar.tsx tests/app-shell.spec.ts
git commit -m "test: lock workspace tab chrome spacing"
```

---

### Task 7: Update Work Docs And Current Status

**Files:**
- Create: app-shell work item file in an `app-shell` subfolder under `docs/work` named `APP-SHELL-PR-001-workspace-tabs.md`
- Modify: `docs/work/index.md`
- Modify: `docs/engineering/current-status.md`

- [ ] **Step 1: Create work item directory if needed**

Run:

```bash
mkdir -p docs/work/app-shell
```

- [ ] **Step 2: Add the work item**

Create the app-shell work item file with this content:

```md
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

## Scope

- Add a session-only workspace tabs store.
- Add top workspace tab chrome.
- Route nav rail module switches through the active tab history.
- Add tab-scoped back/forward, new tab, close tab, and session restore behavior.
- Preserve existing App Shell slots and URL-share behavior.

## Out Of Scope

- Electron shell, WebContents, BrowserView, or native packaging.
- Inactive tab DOM preservation.
- Per-tab global store isolation.
- Live persistence, Supabase, RLS, or API changes.
- Mobile layout.

## Done When

- Initial route creates one active tab.
- New tab opens Home and becomes active.
- Nav rail navigation pushes into active tab history.
- Back/forward controls move within active tab history.
- Switching tabs restores each tab's current route.
- Last tab cannot be closed.
- Session reload restores open tabs.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/app-shell.spec.ts --grep "workspace tabs|workspace tab chrome" --reporter=line`
- `npx playwright test tests/app-shell.spec.ts --reporter=line`
```

- [ ] **Step 3: Add work item to index**

In `docs/work/index.md`, add a row near other shell/PWA items:

```md
| APP-SHELL-PR-001 | done | app-shell | P1 | PR 1 | app-shell workspace tabs work item |
```

- [ ] **Step 4: Update current status**

In `docs/engineering/current-status.md`, add a 2026-05-16 bullet near the existing App Shell/PWA bullets:

```md
- 2026-05-16 기준 App Shell은 Linear-style logical workspace tabs MVP를 제공한다. 각 탭은 session-only route history를 가지며, nav rail 이동은 active tab history에 push되고 상단 뒤로/앞으로는 active tab 기준으로 동작한다. 새 탭은 Home에서 시작하고 마지막 남은 탭은 닫을 수 없다. 비활성 탭 DOM 유지, 탭별 전역 store 격리, Electron/WebContents, live persistence는 아직 지원하지 않는다.
```

Also update the document header date to `Updated: 2026-05-16` if it is older.

- [ ] **Step 5: Run docs check**

Run:

```bash
npm run docs:check
```

Expected: PASS.

- [ ] **Step 6: Commit docs**

```bash
git add docs/work/app-shell docs/work/index.md docs/engineering/current-status.md
git commit -m "docs: record workspace tabs MVP"
```

---

### Task 8: Final Verification

**Files:**
- No new files unless verification reveals a regression.

- [ ] **Step 1: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run docs check**

Run:

```bash
npm run docs:check
```

Expected: PASS.

- [ ] **Step 4: Run focused workspace tabs tests**

Run:

```bash
npx playwright test tests/app-shell.spec.ts --grep "workspace tabs|workspace tab chrome" --reporter=line
```

Expected: PASS.

- [ ] **Step 5: Run full app shell regression**

Run:

```bash
npx playwright test tests/app-shell.spec.ts --reporter=line
```

Expected: PASS.

- [ ] **Step 6: Review git diff**

Run:

```bash
git diff --stat
git diff -- src/stores/workspace-tabs-store.ts src/shell/workspace-tabs-bar.tsx src/shell/app-shell.tsx src/shell/nav-rail.tsx tests/app-shell.spec.ts
```

Expected: Diff only contains workspace tabs MVP implementation, test updates, and docs. Existing unrelated dirty files remain untouched.

---

## Self-Review Checklist

- Spec coverage: Tasks cover logical tabs, tab history, new tab, close tab, last-tab rule, tab switching, session restore, top chrome spacing, docs, and verification.
- Scope: No Electron, inactive DOM preservation, Supabase, live persistence, RLS, or mobile work is included.
- TDD: Each behavior starts with a failing Playwright test before implementation.
- Compatibility: Existing nav rail tests are updated from `link` role to `button` role as part of the explicit navigation behavior change.
- Persistence: Uses `sessionStorage` only and scopes storage by workspace id.
