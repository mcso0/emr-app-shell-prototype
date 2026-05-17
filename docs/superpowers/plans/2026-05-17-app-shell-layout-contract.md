# App Shell Layout Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the app shell work area below the global workspace tabs into a Figma-aligned navigation column and workspace area with a 10px spacing contract.

**Architecture:** Keep `WorkspaceTabsBar` as the global top row. Extract the existing workspace selector into `WorkspaceSwitcher`, introduce `ShellMain` to own `ShellNavigationColumn`, `ModulePanelArea`, and `ShellWorkspaceArea`, and remove module side panel ownership from `WorkspaceFrame`. Existing feature side panels, nav rail, tab history, URL state, drawers, content aside, and right panel behavior remain intact.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Zustand layout store, Tailwind utility classes, framer-motion, Playwright.

---

## Source Inputs

- Design spec: `docs/superpowers/specs/2026-05-17-app-shell-layout-contract-design.md`
- Current shell files:
  - `src/shell/app-shell.tsx`
  - `src/shell/workspace-tabs-bar.tsx`
  - `src/shell/workspace-frame.tsx`
  - `src/shell/nav-rail.tsx`
  - `src/shell/layout-contract.ts`
- Existing shell regression tests: `tests/app-shell.spec.ts`

## Pre-Implementation Guard

There are pre-existing uncommitted changes in:

- `src/shell/global-command-palette.tsx`
- `src/shell/workspace-tabs-bar.tsx`
- `tests/app-shell.spec.ts`

Before editing, inspect the current diff and preserve user-owned changes:

```bash
git status --short
git diff -- src/shell/global-command-palette.tsx src/shell/workspace-tabs-bar.tsx tests/app-shell.spec.ts
```

Expected: the command shows the existing modified files. Do not revert those changes. Adapt edits on top of them.

---

## File Structure

- Modify: `src/shell/layout-contract.ts`
  - Add the 10px shell spacing contract and navigation column widths.
- Create: `src/shell/workspace-switcher.tsx`
  - Extract the existing workspace selection UI from `WorkspaceTabsBar`.
  - Support open and collapsed visual states with the same icon and token style.
- Create: `src/shell/shell-main.tsx`
  - Own the below-tabs shell layout.
  - Render `WorkspaceSwitcher`, `NavRail`, active `moduleDefinition.sidePanel`, and `WorkspaceFrame`.
- Modify: `src/shell/workspace-tabs-bar.tsx`
  - Remove the full-size workspace selector from the global top row.
  - Keep tab, command, utility, and auth/profile concerns.
- Modify: `src/shell/app-shell.tsx`
  - Replace the current `NavRail + WorkspaceFrame` grid with `ShellMain`.
- Modify: `src/shell/workspace-frame.tsx`
  - Remove module side panel rendering and related column width logic.
  - Keep content header, content aside, content, right panel, and drawers.
- Modify: `tests/app-shell.spec.ts`
  - Add focused layout contract tests for the new wrappers and 10px spacing.

---

### Task 1: Lock Shell Layout Contract With Failing Tests

**Files:**
- Modify: `tests/app-shell.spec.ts`

- [ ] **Step 1: Add helpers for shell layout geometry**

Add these helpers near the existing helper functions at the top of `tests/app-shell.spec.ts`:

```ts
function expectRect(value: Awaited<ReturnType<Page["locator"]>["boundingBox"]>): asserts value is NonNullable<typeof value> {
  expect(value).not.toBeNull();
}

async function expectHorizontalGap(page: Page, leftTestId: string, rightTestId: string, expectedGap: number) {
  const leftBox = await page.getByTestId(leftTestId).boundingBox();
  const rightBox = await page.getByTestId(rightTestId).boundingBox();

  expectRect(leftBox);
  expectRect(rightBox);
  expect(Math.round(rightBox.x - (leftBox.x + leftBox.width))).toBe(expectedGap);
}
```

- [ ] **Step 2: Add the open-state layout contract test**

Add this test after `global command palette searches and opens patient context`:

```ts
test("app shell renders workspace switcher in the navigation column when module panel is open", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open");

  const tabsBar = page.getByTestId("workspace-tabs-bar");
  const navigationColumn = page.getByTestId("shell-navigation-column");
  const workspaceArea = page.getByTestId("shell-workspace-area");
  const workspaceSwitcher = page.getByTestId("workspace-switcher");

  await expect(tabsBar.getByRole("button", { name: "clair-demo 워크스페이스 선택" })).toHaveCount(0);
  await expect(navigationColumn.getByRole("button", { name: "clair-demo 워크스페이스 선택" })).toBeVisible();
  await expect(workspaceSwitcher.getByText("VIP 동물의료센터 청담점")).toBeVisible();
  await expect(page.getByRole("button", { name: "사이드 패널 접기", exact: true })).toBeVisible();

  await expectHorizontalGap(page, "shell-navigation-column", "shell-workspace-area", 10);

  const navigationBox = await navigationColumn.boundingBox();
  const workspaceBox = await workspaceArea.boundingBox();

  expectRect(navigationBox);
  expectRect(workspaceBox);
  expect(navigationBox.height).toBe(workspaceBox.height);
});
```

- [ ] **Step 3: Add the collapsed-state layout contract test**

Add this test after the open-state test:

```ts
test("app shell collapses workspace switcher with the navigation column", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?modulePanel=closed");

  const navigationColumn = page.getByTestId("shell-navigation-column");
  const workspaceSwitcher = page.getByTestId("workspace-switcher");

  await expect(workspaceSwitcher).toBeVisible();
  await expect(workspaceSwitcher.getByText("VIP 동물의료센터 청담점")).toBeHidden();
  await expect(page.getByRole("button", { name: "사이드 패널 펼치기" })).toBeVisible();
  await expectHorizontalGap(page, "shell-navigation-column", "shell-workspace-area", 10);

  const navigationBox = await navigationColumn.boundingBox();
  const switcherBox = await workspaceSwitcher.boundingBox();

  expectRect(navigationBox);
  expectRect(switcherBox);
  expect(Math.round(navigationBox.width)).toBe(48);
  expect(Math.round(switcherBox.width)).toBe(48);
});
```

- [ ] **Step 4: Run the focused tests and verify they fail**

Run:

```bash
npx playwright test tests/app-shell.spec.ts -g "app shell renders workspace switcher|app shell collapses workspace switcher" --reporter=line
```

Expected: both new tests fail because `shell-navigation-column`, `shell-workspace-area`, and `workspace-switcher` do not exist yet, and the workspace selector still lives inside `WorkspaceTabsBar`.

- [ ] **Step 5: Commit the failing tests**

```bash
git add tests/app-shell.spec.ts
git commit -m "test: lock app shell layout contract"
```

---

### Task 2: Extract WorkspaceSwitcher From WorkspaceTabsBar

**Files:**
- Create: `src/shell/workspace-switcher.tsx`
- Modify: `src/shell/workspace-tabs-bar.tsx`

- [ ] **Step 1: Create the extracted WorkspaceSwitcher component**

Create `src/shell/workspace-switcher.tsx` with this content:

```tsx
"use client";

import { WorkspaceLogoMarkIcon } from "@/components/icons";
import { CdsNavigationChevronDownIcon } from "@/components/cds-icons/navigation";
import { cn } from "@/lib/utils";

type WorkspaceSwitcherProps = {
  collapsed?: boolean;
  className?: string;
  workspaceId: string;
};

export function WorkspaceSwitcher({ collapsed = false, className, workspaceId }: WorkspaceSwitcherProps) {
  return (
    <button
      type="button"
      data-testid="workspace-switcher"
      className={cn(
        "flex h-10 items-center rounded-[var(--emr-radius-panel)] bg-[var(--emr-surface-panel)] text-[var(--emr-text-primary)] shadow-[var(--emr-shadow-control)] outline-none transition-[background-color,width] hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/40",
        collapsed
          ? "w-12 justify-center px-0"
          : "w-full min-w-0 justify-start gap-2 px-3 text-[15px] font-semibold",
        className,
      )}
      aria-label={`${workspaceId} 워크스페이스 선택`}
    >
      <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-primary text-primary-foreground">
        <WorkspaceLogoMarkIcon className="size-7" aria-hidden="true" />
      </span>
      <span className={cn("truncate", collapsed && "sr-only")}>VIP 동물의료센터 청담점</span>
      <CdsNavigationChevronDownIcon
        className={cn("size-4 shrink-0 text-foreground", collapsed && "hidden")}
        aria-hidden="true"
      />
    </button>
  );
}
```

- [ ] **Step 2: Remove workspace selector-only imports from WorkspaceTabsBar**

In `src/shell/workspace-tabs-bar.tsx`, remove these imports:

```ts
  WorkspaceLogoMarkIcon,
```

and:

```ts
import { CdsNavigationChevronDownIcon } from "@/components/cds-icons/navigation";
```

Keep `CdsActionsPlusIcon`, because the new tab button still uses it.

- [ ] **Step 3: Remove the workspace selector button from WorkspaceTabsBar render**

Delete this block from `WorkspaceTabsBar`:

```tsx
      <button
        type="button"
        className="flex h-10 min-w-[240px] items-center justify-center gap-2 rounded-[var(--emr-radius-panel)] bg-[var(--emr-surface-panel)] px-3 text-[15px] font-semibold text-[var(--emr-text-primary)] shadow-[var(--emr-shadow-control)] outline-none transition-colors hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/40"
        aria-label={`${workspaceId} 워크스페이스 선택`}
      >
        <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-primary text-primary-foreground">
          <WorkspaceLogoMarkIcon className="size-7" aria-hidden="true" />
        </span>
        <span className="truncate">VIP 동물의료센터 청담점</span>
        <CdsNavigationChevronDownIcon className="size-4 shrink-0 text-foreground" aria-hidden="true" />
      </button>
```

Leave the next sibling:

```tsx
      <GlobalCommandPalette triggerVariant="icon" workspaceId={workspaceId} />
```

as the first rendered control in the global tab bar.

- [ ] **Step 4: Run TypeScript to verify the extraction compiles**

Run:

```bash
npx tsc --noEmit
```

Expected: pass or fail only on unrelated pre-existing changes. If it fails because `WorkspaceLogoMarkIcon` or `CdsNavigationChevronDownIcon` is still imported unused in `workspace-tabs-bar.tsx`, remove the unused import.

- [ ] **Step 5: Commit the extraction**

```bash
git add src/shell/workspace-switcher.tsx src/shell/workspace-tabs-bar.tsx
git commit -m "refactor: extract workspace switcher"
```

---

### Task 3: Add Shell Layout Tokens

**Files:**
- Modify: `src/shell/layout-contract.ts`

- [ ] **Step 1: Add shell-level spacing and navigation column tokens**

Replace the current `SHELL_LAYOUT` object in `src/shell/layout-contract.ts` with:

```ts
export const SHELL_LAYOUT = {
  shell: {
    gap: 10,
    bodyPadding: 10,
    tabsBarHeight: 58,
  },
  navRailWidth: 48,
  topMenuHeight: 44,
  navigationColumn: {
    collapsedWidth: 48,
    openWidth: 354,
  },
  moduleSidePanel: {
    minWidth: 296,
    defaultWidth: 296,
  },
  contentAside: {
    minWidth: 280,
    defaultWidth: 280,
  },
  rightPanel: {
    defaultWidth: 316,
  },
  drawer: {
    defaultWidth: 460,
    largeWidth: 708,
    zIndex: 40,
  },
} as const;
```

Rationale: `navigationColumn.openWidth` is `48px NavRail + 10px gap + 296px module side panel`. It intentionally preserves the existing side panel width instead of copying Figma pixel dimensions.

- [ ] **Step 2: Run TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: pass. The new tokens are additive except for the shape of `SHELL_LAYOUT`, and existing property paths such as `SHELL_LAYOUT.moduleSidePanel.defaultWidth` remain unchanged.

- [ ] **Step 3: Commit the layout tokens**

```bash
git add src/shell/layout-contract.ts
git commit -m "refactor: add app shell layout tokens"
```

---

### Task 4: Create ShellMain and Move Module Side Panel Ownership Outward

**Files:**
- Create: `src/shell/shell-main.tsx`
- Modify: `src/shell/app-shell.tsx`
- Modify: `src/shell/workspace-frame.tsx`

- [ ] **Step 1: Create ShellMain**

Create `src/shell/shell-main.tsx` with this content:

```tsx
"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Transition } from "framer-motion";
import type { CSSProperties } from "react";
import type { ModuleDefinition } from "@/types/emr";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import { NavRail } from "@/shell/nav-rail";
import { SHELL_LAYOUT } from "@/shell/layout-contract";
import { WorkspaceFrame } from "@/shell/workspace-frame";
import { WorkspaceSwitcher } from "@/shell/workspace-switcher";

type ShellMainProps = {
  moduleDefinition: ModuleDefinition;
  navigationSearch: string;
  workspaceId: string;
  onNavigateModule: (href: string, moduleId: string) => void;
};

const PANEL_ENTER_EASE = [0.16, 0, 0.08, 1] as const;
const PANEL_EXIT_EASE = [0.32, 0, 1, 1] as const;

export function ShellMain({
  moduleDefinition,
  navigationSearch,
  workspaceId,
  onNavigateModule,
}: ShellMainProps) {
  const reduceMotion = useReducedMotion();
  const modulePanelOpen = useLayoutStore((state) => state.modulePanelOpen);
  const SidePanel = moduleDefinition.sidePanel;
  const shouldShowModuleSidePanel = Boolean(modulePanelOpen && SidePanel);
  const navigationColumnWidth = shouldShowModuleSidePanel
    ? SHELL_LAYOUT.navigationColumn.openWidth
    : SHELL_LAYOUT.navigationColumn.collapsedWidth;
  const modulePanelTransition: Transition = reduceMotion
    ? { duration: 0 }
    : {
        duration: modulePanelOpen ? 0.16 : 0.12,
        ease: modulePanelOpen ? PANEL_ENTER_EASE : PANEL_EXIT_EASE,
      };
  const slotProps = {
    workspaceId,
    moduleId: moduleDefinition.id,
    moduleLabel: moduleDefinition.label,
    hasContentAside: Boolean(moduleDefinition.contentAside),
    hasRightPanel: Boolean(moduleDefinition.rightPanel),
  };

  return (
    <div
      className="grid min-h-0 transition-[grid-template-columns] max-md:grid-cols-1"
      style={{
        gap: SHELL_LAYOUT.shell.gap,
        gridTemplateColumns: `${navigationColumnWidth}px minmax(0, 1fr)`,
        height: `calc(100vh - ${SHELL_LAYOUT.shell.tabsBarHeight}px)`,
        padding: SHELL_LAYOUT.shell.bodyPadding,
        transitionDuration: reduceMotion ? "0ms" : "160ms",
        transitionTimingFunction: "var(--clair-motion-easing-panel-enter)",
      } as CSSProperties}
    >
      <section
        data-testid="shell-navigation-column"
        className="flex min-h-0 min-w-0 flex-col transition-[width] max-md:hidden"
        style={{ gap: SHELL_LAYOUT.shell.gap, width: navigationColumnWidth }}
      >
        <WorkspaceSwitcher collapsed={!shouldShowModuleSidePanel} workspaceId={workspaceId} />

        <div
          data-testid="module-panel-area"
          className="grid min-h-0 flex-1 transition-[grid-template-columns]"
          style={{
            gap: SHELL_LAYOUT.shell.gap,
            gridTemplateColumns: shouldShowModuleSidePanel
              ? `${SHELL_LAYOUT.navRailWidth}px minmax(0, ${SHELL_LAYOUT.moduleSidePanel.defaultWidth}px)`
              : `${SHELL_LAYOUT.navRailWidth}px 0px`,
            transitionDuration: reduceMotion ? "0ms" : "160ms",
            transitionTimingFunction: "var(--clair-motion-easing-panel-enter)",
          } as CSSProperties}
        >
          <NavRail
            activeModuleId={moduleDefinition.id}
            navigationSearch={navigationSearch}
            workspaceId={workspaceId}
            onNavigateModule={onNavigateModule}
          />

          <aside
            className={cn(
              "min-h-0 min-w-0 overflow-hidden rounded-lg border border-[var(--emr-line-default)] bg-[var(--emr-surface-panel)]",
              !shouldShowModuleSidePanel && "pointer-events-none border-transparent opacity-0",
            )}
          >
            <div
              className="relative flex h-full flex-col"
              style={{
                minWidth: SHELL_LAYOUT.moduleSidePanel.minWidth,
                width: SHELL_LAYOUT.moduleSidePanel.defaultWidth,
              }}
            >
              <AnimatePresence initial={false}>
                {shouldShowModuleSidePanel && SidePanel ? (
                  <motion.div
                    key={`${moduleDefinition.id}-module-side-panel`}
                    initial={reduceMotion ? false : { opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -12 }}
                    transition={modulePanelTransition}
                    className="h-full min-h-0"
                  >
                    <SidePanel {...slotProps} />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </aside>
        </div>
      </section>

      <section data-testid="shell-workspace-area" className="min-h-0 min-w-0 [&>main]:h-full">
        <WorkspaceFrame moduleDefinition={moduleDefinition} workspaceId={workspaceId} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Replace AppShell body layout with ShellMain**

In `src/shell/app-shell.tsx`, remove these imports:

```ts
import { NavRail } from "@/shell/nav-rail";
import { WorkspaceFrame } from "@/shell/workspace-frame";
```

Add this import:

```ts
import { ShellMain } from "@/shell/shell-main";
```

Replace the current below-tabs grid:

```tsx
      <div className="grid h-[calc(100vh-58px)] grid-cols-[48px_1fr] gap-2.5 px-2.5 pt-2.5 pb-2.5">
        <NavRail
          activeModuleId={moduleDefinition.id}
          navigationSearch={navigationSearch}
          workspaceId={workspaceId}
          onNavigateModule={handleNavigateModule}
        />
        <div data-testid="workspace-frame" className="min-h-0 min-w-0 [&>main]:h-full">
          <WorkspaceFrame moduleDefinition={moduleDefinition} workspaceId={workspaceId} />
        </div>
      </div>
```

with:

```tsx
      <ShellMain
        moduleDefinition={moduleDefinition}
        navigationSearch={navigationSearch}
        workspaceId={workspaceId}
        onNavigateModule={handleNavigateModule}
      />
```

- [ ] **Step 3: Remove module side panel rendering from WorkspaceFrame**

In `src/shell/workspace-frame.tsx`, remove `Transition` from the framer-motion type import:

```ts
import type { Transition } from "framer-motion";
```

Remove `useReducedMotion` from the framer-motion import:

```ts
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
```

so it becomes:

```ts
import { AnimatePresence, motion } from "framer-motion";
```

Delete these constants:

```ts
const PANEL_ENTER_EASE = [0.16, 0, 0.08, 1] as const;
const PANEL_EXIT_EASE = [0.32, 0, 1, 1] as const;
```

Remove these layout store fields from the destructure:

```ts
    modulePanelOpen,
```

Remove these local variables:

```ts
  const reduceMotion = useReducedMotion();
  const SidePanel = moduleDefinition.sidePanel;
  const shouldShowModuleSidePanel = Boolean(modulePanelOpen && SidePanel);
  const effectiveModuleSidePanelWidth = SHELL_LAYOUT.moduleSidePanel.defaultWidth;
  const modulePanelTransition: Transition = reduceMotion
    ? { duration: 0 }
    : {
        duration: modulePanelOpen ? 0.16 : 0.12,
        ease: modulePanelOpen ? PANEL_ENTER_EASE : PANEL_EXIT_EASE,
      };
```

Replace the `<main>` opening style with right-panel-only columns:

```tsx
    <main
      className="relative grid min-h-0 overflow-hidden rounded-lg border border-[var(--emr-line-default)] bg-card transition-[grid-template-columns] [grid-template-columns:var(--clair-workspace-frame-columns)] max-md:[grid-template-columns:minmax(0,1fr)]"
      style={{
        "--clair-workspace-frame-columns": `minmax(0, 1fr) ${
          RightPanel && rightPanelOpen ? `${effectiveRightPanelWidth}px` : "0px"
        }`,
      } as CSSProperties}
    >
```

Delete the first module side panel `<aside>` block, the block that starts with:

```tsx
      <aside
        className={cn(
          "min-h-0 min-w-0 overflow-hidden bg-[var(--emr-surface-panel)] max-md:hidden",
          shouldShowModuleSidePanel && "border-r border-[var(--emr-line-default)]"
        )}
      >
```

and ends immediately before:

```tsx
      <section className="relative flex min-h-0 min-w-0 flex-col bg-card">
```

Keep the center `<section>` and the right panel `<aside>`.

- [ ] **Step 4: Run TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: pass. If it reports unused imports in `workspace-frame.tsx`, remove the unused import. If it reports a missing `workspace-switcher` or `shell-main` import path, verify both new files live under `src/shell/`.

- [ ] **Step 5: Run the focused shell layout tests**

Run:

```bash
npx playwright test tests/app-shell.spec.ts -g "app shell renders workspace switcher|app shell collapses workspace switcher" --reporter=line
```

Expected: pass.

- [ ] **Step 6: Commit ShellMain ownership move**

```bash
git add src/shell/shell-main.tsx src/shell/app-shell.tsx src/shell/workspace-frame.tsx
git commit -m "refactor: move module panel into shell navigation column"
```

---

### Task 5: Verify Existing Shell Behavior After Restructure

**Files:**
- Modify: `tests/app-shell.spec.ts` only if existing tests fail because selectors moved while behavior stayed the same.

- [ ] **Step 1: Run the full shell test file**

Run:

```bash
npx playwright test tests/app-shell.spec.ts --reporter=line
```

Expected: pass. If a test fails because it expected the workspace selector inside `WorkspaceTabsBar`, update that assertion to look in `shell-navigation-column`. Do not weaken tests for tab history, drawer behavior, module navigation, side panel open/closed URL state, content aside, or right panel behavior.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: pass.

- [ ] **Step 3: Run TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: pass.

- [ ] **Step 4: Browser-check representative routes**

With the local dev server running, open these routes in the browser and verify the visible layout:

```text
http://localhost:3000/w/clair-demo/reception?modulePanel=open
http://localhost:3000/w/clair-demo/reception?modulePanel=closed
http://localhost:3000/w/clair-demo/treatment?modulePanel=open&aside=closed&right=closed
http://localhost:3000/w/clair-demo/imaging?modulePanel=open&aside=history&right=open
```

Expected visual results:

- `WorkspaceTabsBar` remains the top global row.
- The work area below tabs has a navigation column and workspace area separated by 10px.
- The workspace switcher sits at the top of the navigation column.
- In `modulePanel=closed`, the workspace switcher is compact and the navigation column is 48px wide.
- In `modulePanel=open`, `NavRail` and the module side panel are separated by 10px.
- `WorkspaceFrame` still renders content header, content aside, content, right panel, and drawers correctly.

- [ ] **Step 5: Commit final verification adjustments**

If no test files changed during verification:

```bash
git status --short
```

Expected: no uncommitted changes from this task.

If tests or small shell fixes changed during verification:

```bash
git add tests/app-shell.spec.ts src/shell/app-shell.tsx src/shell/shell-main.tsx src/shell/workspace-frame.tsx src/shell/workspace-tabs-bar.tsx src/shell/workspace-switcher.tsx src/shell/layout-contract.ts
git commit -m "test: verify app shell layout contract"
```

---

## Self-Review

Spec coverage:

- Global tabs remain top-level: covered in Task 4 through `AppShell` retaining `WorkspaceTabsBar` above `ShellMain`.
- Figma-like layout below tabs: covered by `ShellMain` in Task 4.
- Existing UI reuse: covered by extracting `WorkspaceSwitcher` from the existing button in Task 2 and reusing `NavRail`, `moduleDefinition.sidePanel`, and `WorkspaceFrame`.
- Collapsed workspace switcher: covered by Task 2 component props and Task 1 collapsed-state test.
- 10px spacing contract: covered by Task 3 tokens, Task 4 layout, and Task 1 geometry tests.
- Preserve module internals: covered by moving only side panel ownership and keeping feature modules untouched.
- Verification: covered by Task 5.

Placeholder scan:

- The plan contains complete task steps, concrete code snippets, exact commands, and expected results.

Type consistency:

- `WorkspaceSwitcher`, `ShellMain`, `ShellNavigationColumn`, `ShellWorkspaceArea`, and `ModulePanelArea` names match the design spec.
- New test IDs match the planned implementation: `workspace-switcher`, `shell-navigation-column`, `module-panel-area`, and `shell-workspace-area`.
