# Neutral Command Semantic Status Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Neutral Command + Semantic Status token direction so CLAiR uses ink for commands, gray for structure, and color for clinical/workflow meaning.

**Architecture:** Keep generated `src/styles/tokens/clair.css` untouched. Use `src/styles/tokens/shadcn.css` as the generated shadcn/Clair bridge, move hand-authored product overrides into `src/styles/tokens/emr-foundation.css`, and keep `src/app/globals.css` responsible for imports, Tailwind `@theme inline`, and base utilities. Apply the new token contract through shared UI and EMR primitives before touching feature screens.

**Tech Stack:** Next.js App Router, Tailwind CSS v4 `@theme inline`, shadcn/base-ui source components, Playwright, TypeScript.

---

## Scope And File Structure

This plan implements a single PR-sized design-system unit. It does not redesign feature screens, add dark mode, or modify generated Clair tokens.

**Files to modify:**

- `src/app/globals.css`: import the EMR foundation layer after `shadcn.css`, remove duplicate hand-authored token definitions from this file, keep Tailwind mappings and base utilities.
- `src/styles/tokens/emr-foundation.css`: become the active hand-authored product theme layer for shadcn overrides, EMR operational aliases, and EMR status aliases.
- `src/components/ui/button.tsx`: use shadcn semantic tokens for color variants instead of direct Clair atomic colors.
- `src/components/ui/input.tsx`: use EMR text and surface aliases for input placeholder and disabled states.
- `src/components/ui/table.tsx`: use EMR hover/selected state aliases for dense row behavior.
- `src/components/emr/side-panel-card.tsx`: use EMR selected state aliases instead of primary blue.
- `src/components/emr/subpanel.tsx`: use EMR state aliases for hover/selected/list behavior.
- `src/components/emr/emr-data-table.tsx`: use EMR state aliases for hover/selected/dirty/resize affordances.
- `tests/design-tokens.spec.ts`: add token contract and primitive behavior coverage.
- `tests/chart.spec.ts`: update selected queue card color expectations away from primary blue.
- `docs/design/system/DESIGN.md`: update active design guidance with the neutral command decision.
- `docs/design/system/light-operational-foundation.md`: update token direction and implementation notes.

**Files not to modify:**

- `src/styles/tokens/clair.css`: generated DTCG token output.
- Live persistence, auth, Supabase, migration, RLS, billing, or server permission files.

---

### Task 1: Add Token Contract Tests

**Files:**
- Create: `tests/design-tokens.spec.ts`

- [ ] **Step 1: Create a failing Playwright token contract test**

Create `tests/design-tokens.spec.ts` with this exact content:

```ts
import { expect, test } from "@playwright/test";

const treatmentUrl = "/w/clair-demo/treatment?modulePanel=open&aside=closed&right=closed";

test("neutral command token contract is exposed on the app shell", async ({ page }) => {
  await page.goto(treatmentUrl);

  const tokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    const read = (name: string) => styles.getPropertyValue(name).trim();

    return {
      primary: read("--primary"),
      brand: read("--brand"),
      ring: read("--ring"),
      emrSurfaceApp: read("--emr-surface-app"),
      emrSurfaceSelected: read("--emr-surface-selected"),
      emrStateSelectedBorder: read("--emr-state-selected-border"),
      emrStatusInfoText: read("--emr-status-info-text"),
    };
  });

  expect(tokens.primary).toBe("oklch(0.21 0.006 285.885)");
  expect(tokens.brand).toBe("var(--clair-color-atomic-sky-500)");
  expect(tokens.ring).toBe("oklch(0.705 0.015 286.067)");
  expect(tokens.emrSurfaceApp).toBe("#FBFCFD");
  expect(tokens.emrSurfaceSelected).toBe("oklch(0.97 0.006 286)");
  expect(tokens.emrStateSelectedBorder).toBe("var(--emr-line-selected)");
  expect(tokens.emrStatusInfoText).toBe("var(--clair-color-atomic-blue-700)");
});

test("primary command button uses primary token instead of brand blue", async ({ page }) => {
  await page.goto(treatmentUrl);

  const chartCompleteButton = page.getByRole("button", { name: "차트 작성완료" });
  await expect(chartCompleteButton).toBeVisible();

  const colors = await chartCompleteButton.evaluate((button) => {
    const primaryProbe = document.createElement("span");
    primaryProbe.style.color = "var(--primary)";
    document.body.appendChild(primaryProbe);

    const brandProbe = document.createElement("span");
    brandProbe.style.color = "var(--brand)";
    document.body.appendChild(brandProbe);

    const result = {
      buttonBackground: getComputedStyle(button).backgroundColor,
      primaryColor: getComputedStyle(primaryProbe).color,
      brandColor: getComputedStyle(brandProbe).color,
    };

    primaryProbe.remove();
    brandProbe.remove();

    return result;
  });

  expect(colors.buttonBackground).toBe(colors.primaryColor);
  expect(colors.buttonBackground).not.toBe(colors.brandColor);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx playwright test tests/design-tokens.spec.ts --reporter=line
```

Expected: FAIL. The current implementation does not expose all new `--emr-state-*` and `--emr-status-*` tokens, and the primary button may still depend on direct Clair atomic classes.

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/design-tokens.spec.ts
git commit -m "test: add neutral command token contract"
```

---

### Task 2: Establish Active Token Source Ownership

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/styles/tokens/emr-foundation.css`

- [ ] **Step 1: Import the EMR foundation layer from globals**

In `src/app/globals.css`, change the import section to:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "pretendard/dist/web/variable/pretendardvariable.css";
@import "../styles/tokens/shadcn.css";
@import "../styles/tokens/emr-foundation.css";
```

- [ ] **Step 2: Remove hand-authored token values from globals**

In `src/app/globals.css`, delete the current `:root` block that starts with:

```css
:root {
  --chart-1: var(--clair-color-atomic-blue-500);
```

and ends with:

```css
  --emr-radius-panel: var(--clair-radius-lg);
}
```

Keep the `@theme inline`, `.dark`, `@layer base`, and `@layer utilities` sections in `globals.css`.

- [ ] **Step 3: Replace the EMR foundation file**

Replace `src/styles/tokens/emr-foundation.css` with this exact content:

```css
/*
 * Hand-authored CLAiR EMR operational theme layer.
 * Keep generated Clair tokens in clair.css untouched. Keep shadcn.css as the
 * bridge from generated Clair tokens to shadcn semantic variables. This file
 * owns product-specific shadcn overrides plus EMR surface, line, text, state,
 * status, chart, sidebar, and radius aliases.
 */

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.141 0.005 285.823);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.141 0.005 285.823);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.141 0.005 285.823);
  --primary: oklch(0.21 0.006 285.885);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.967 0.001 286.375);
  --secondary-foreground: oklch(0.21 0.006 285.885);
  --muted: oklch(0.967 0.001 286.375);
  --muted-foreground: oklch(0.552 0.016 285.938);
  --accent: oklch(0.967 0.001 286.375);
  --accent-foreground: oklch(0.21 0.006 285.885);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.92 0.004 286.32);
  --input: oklch(0.92 0.004 286.32);
  --ring: oklch(0.705 0.015 286.067);

  --brand: var(--clair-color-atomic-sky-500);
  --brand-foreground: #FFFFFF;
  --selection: oklch(0.97 0.006 286);
  --selection-border: oklch(0.58 0.014 286);

  --chart-1: oklch(0.828 0.111 230.318);
  --chart-2: oklch(0.685 0.169 237.323);
  --chart-3: oklch(0.588 0.158 241.966);
  --chart-4: oklch(0.5 0.134 242.749);
  --chart-5: oklch(0.443 0.11 240.79);

  --sidebar: var(--clair-color-atomic-gray-900);
  --sidebar-foreground: var(--clair-color-atomic-gray-50);
  --sidebar-primary: var(--clair-color-atomic-gray-800);
  --sidebar-primary-foreground: var(--clair-color-atomic-common-100);
  --sidebar-accent: var(--clair-color-atomic-gray-800);
  --sidebar-accent-foreground: var(--clair-color-atomic-gray-50);
  --sidebar-border: var(--clair-color-atomic-gray-700);
  --sidebar-ring: oklch(0.705 0.015 286.067);

  --clair-color-service-background: #FBFCFD;

  --emr-surface-app: #FBFCFD;
  --emr-surface-panel: oklch(1 0 0);
  --emr-surface-subpanel: oklch(0.985 0.001 286);
  --emr-surface-muted: oklch(0.967 0.001 286.375);
  --emr-surface-hover: oklch(0.977 0.001 286.3);
  --emr-surface-selected: oklch(0.97 0.006 286);
  --emr-surface-disabled: oklch(0.955 0.001 286);
  --emr-surface-floating: oklch(1 0 0);

  --emr-line-subtle: oklch(0.945 0.003 286);
  --emr-line-hairline: oklch(0.92 0.004 286.32);
  --emr-line-default: oklch(0.885 0.006 286);
  --emr-line-strong: oklch(0.78 0.012 286);
  --emr-line-selected: oklch(0.58 0.014 286);
  --emr-line-focus: var(--ring);

  --emr-text-primary: oklch(0.141 0.005 285.823);
  --emr-text-secondary: oklch(0.32 0.01 286);
  --emr-text-tertiary: oklch(0.552 0.016 285.938);
  --emr-text-placeholder: oklch(0.64 0.014 286);
  --emr-text-disabled: oklch(0.72 0.01 286);
  --emr-text-inverse: oklch(0.985 0 0);
  --emr-text-link: oklch(0.52 0.13 240);
  --emr-text-danger: oklch(0.577 0.245 27.325);

  --emr-state-hover: var(--emr-surface-hover);
  --emr-state-active: oklch(0.94 0.004 286);
  --emr-state-selected: var(--emr-surface-selected);
  --emr-state-selected-border: var(--emr-line-selected);
  --emr-state-focus-ring: var(--ring);
  --emr-state-drag: oklch(0.78 0.012 286);
  --emr-state-dirty: oklch(0.97 0.035 85);

  --emr-status-info-bg: var(--clair-color-atomic-blue-50);
  --emr-status-info-border: var(--clair-color-atomic-blue-200);
  --emr-status-info-text: var(--clair-color-atomic-blue-700);
  --emr-status-success-bg: var(--clair-color-atomic-green-50);
  --emr-status-success-border: var(--clair-color-atomic-green-200);
  --emr-status-success-text: var(--clair-color-atomic-green-700);
  --emr-status-warning-bg: var(--clair-color-atomic-orange-50);
  --emr-status-warning-border: var(--clair-color-atomic-orange-200);
  --emr-status-warning-text: var(--clair-color-atomic-orange-700);
  --emr-status-danger-bg: var(--clair-color-atomic-red-50);
  --emr-status-danger-border: var(--clair-color-atomic-red-200);
  --emr-status-danger-text: var(--clair-color-atomic-red-700);
  --emr-status-neutral-bg: var(--clair-color-atomic-gray-50);
  --emr-status-neutral-border: var(--clair-color-atomic-gray-200);
  --emr-status-neutral-text: var(--clair-color-atomic-gray-700);

  --emr-accent: var(--emr-line-selected);
  --emr-accent-subtle: var(--emr-state-selected);
  --emr-radius-control: var(--radius-md);
  --emr-radius-panel: var(--radius-lg);
}
```

- [ ] **Step 4: Run the token contract test**

Run:

```bash
npx playwright test tests/design-tokens.spec.ts --reporter=line
```

Expected: The first test passes. The second test may still fail until Task 3 updates `Button`.

- [ ] **Step 5: Run static checks**

Run:

```bash
npm run lint
npx tsc --noEmit
```

Expected: both commands pass.

- [ ] **Step 6: Commit token ownership changes**

```bash
git add src/app/globals.css src/styles/tokens/emr-foundation.css
git commit -m "feat: establish neutral command token layer"
```

---

### Task 3: Align shadcn UI Primitives To Semantic Tokens

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/table.tsx`
- Test: `tests/design-tokens.spec.ts`

- [ ] **Step 1: Update Button variant colors**

In `src/components/ui/button.tsx`, replace the `variant` object inside `buttonVariants` with:

```ts
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[oklch(0.28_0.006_285.885)] aria-expanded:bg-[oklch(0.28_0.006_285.885)]",
        outline:
          "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[var(--emr-state-active)] aria-expanded:bg-[var(--emr-state-active)]",
        ghost:
          "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-[var(--emr-status-danger-text)] focus-visible:ring-destructive/20",
      },
```

- [ ] **Step 2: Update Input token usage**

In `src/components/ui/input.tsx`, replace the `className={cn(` string with:

```tsx
        "h-[var(--clair-control-height-md)] w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base text-foreground transition-colors outline-none file:inline-flex file:h-[var(--clair-control-height-xs)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[var(--emr-text-placeholder)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[var(--emr-surface-disabled)] disabled:text-[var(--emr-text-disabled)] disabled:opacity-100 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
```

- [ ] **Step 3: Update Table interaction defaults**

In `src/components/ui/table.tsx`, replace the `TableFooter` class string with:

```tsx
        "border-t bg-[var(--emr-surface-muted)] font-medium [&>tr]:last:border-b-0",
```

Then replace the `TableRow` class string with:

```tsx
        "border-b transition-colors hover:bg-[var(--emr-state-hover)] has-aria-expanded:bg-[var(--emr-state-hover)] data-[state=selected]:bg-[var(--emr-state-selected)]",
```

- [ ] **Step 4: Run primitive token test**

Run:

```bash
npx playwright test tests/design-tokens.spec.ts --reporter=line
```

Expected: both tests pass.

- [ ] **Step 5: Run component regression tests**

Run:

```bash
npx playwright test tests/chart.spec.ts tests/app-shell.spec.ts --reporter=line
```

Expected: tests may fail only where they assert the old primary-blue selected queue card. If that happens, leave the failure for Task 4, where the selected card contract is updated.

- [ ] **Step 6: Run static checks**

Run:

```bash
npm run lint
npx tsc --noEmit
```

Expected: both commands pass.

- [ ] **Step 7: Commit primitive token alignment**

```bash
git add src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/table.tsx tests/design-tokens.spec.ts
git commit -m "feat: align ui primitives with neutral command tokens"
```

---

### Task 4: Apply EMR State Tokens To Shared EMR Primitives

**Files:**
- Modify: `src/components/emr/side-panel-card.tsx`
- Modify: `src/components/emr/subpanel.tsx`
- Modify: `src/components/emr/emr-data-table.tsx`
- Modify: `tests/chart.spec.ts`
- Test: `tests/design-tokens.spec.ts`

- [ ] **Step 1: Update selected side-panel card styling**

In `src/components/emr/side-panel-card.tsx`, replace the selected and hover branches in `className={cn(...)` with:

```tsx
        selected &&
          "border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected)] pl-3.5",
        !selected && "hover:bg-[var(--emr-state-hover)]",
```

Then replace the selected leading stripe class with:

```tsx
          className="absolute inset-y-0 left-0 w-1 bg-[var(--emr-state-selected-border)]"
```

- [ ] **Step 2: Update subpanel list state aliases**

In `src/components/emr/subpanel.tsx`, replace:

```tsx
hover:bg-[var(--emr-surface-muted)]
```

with:

```tsx
hover:bg-[var(--emr-state-hover)]
```

Replace this selected outline branch:

```tsx
"border-[var(--emr-accent)] bg-[var(--emr-surface-selected)]"
```

with:

```tsx
"border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected)]"
```

Replace this selected subtle branch:

```tsx
"border-transparent bg-[var(--emr-accent-subtle)]"
```

with:

```tsx
"border-transparent bg-[var(--emr-state-selected)]"
```

- [ ] **Step 3: Update EMR data table state aliases**

In `src/components/emr/emr-data-table.tsx`, replace:

```tsx
hover:bg-[var(--emr-accent-subtle)]
```

with:

```tsx
hover:bg-[var(--emr-state-selected)]
```

Replace:

```tsx
header.column.getIsResizing() && "bg-[var(--emr-accent-subtle)]"
```

with:

```tsx
header.column.getIsResizing() && "bg-[var(--emr-state-drag)]"
```

Replace the order row class string with:

```tsx
className="group/order-row h-11 cursor-pointer border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] text-[var(--emr-text-secondary)] hover:!bg-[var(--emr-state-hover)] data-[state=selected]:!bg-[var(--emr-state-selected)]"
```

- [ ] **Step 4: Update chart selected queue card assertion**

In `tests/chart.spec.ts`, replace the `selectedQueueCardColors` evaluation block in the first test with:

```ts
  const selectedQueueCardColors = await selectedQueueCard.evaluate((element) => {
    const selectedBorderProbe = document.createElement("span");
    selectedBorderProbe.style.color = "var(--emr-state-selected-border)";
    document.body.appendChild(selectedBorderProbe);

    return {
      borderColor: getComputedStyle(element).borderTopColor,
      selectedBorderColor: getComputedStyle(selectedBorderProbe).color,
      stripeColor: getComputedStyle(element.firstElementChild ?? element).backgroundColor,
    };
  });
  expect(selectedQueueCardColors.borderColor).toBe(selectedQueueCardColors.selectedBorderColor);
  expect(selectedQueueCardColors.stripeColor).toBe(selectedQueueCardColors.selectedBorderColor);
```

- [ ] **Step 5: Run focused regression tests**

Run:

```bash
npx playwright test tests/design-tokens.spec.ts tests/chart.spec.ts tests/app-shell.spec.ts --reporter=line
```

Expected: all tests pass.

- [ ] **Step 6: Run static checks**

Run:

```bash
npm run lint
npx tsc --noEmit
```

Expected: both commands pass.

- [ ] **Step 7: Commit EMR primitive state alignment**

```bash
git add src/components/emr/side-panel-card.tsx src/components/emr/subpanel.tsx src/components/emr/emr-data-table.tsx tests/chart.spec.ts
git commit -m "feat: apply emr state tokens to shared primitives"
```

---

### Task 5: Update Design-System Documentation

**Files:**
- Modify: `docs/design/system/DESIGN.md`
- Modify: `docs/design/system/light-operational-foundation.md`
- Modify: `docs/engineering/current-status.md`

- [ ] **Step 1: Update `DESIGN.md` foundation and color guidance**

In `docs/design/system/DESIGN.md`, update the `updated` frontmatter value to `"2026-05-13"`.

Add this bullet group under `## Color` after the opening paragraph:

```md
CLAiR follows the Neutral Command + Semantic Status direction:

- primary is command ink, not brand blue
- gray and cool-neutral surfaces carry structure, hover, selected, and focus states
- blue is reserved for information, links, and limited brand identity moments
- success, warning, danger, info, and neutral status colors stay semantically distinct
```

- [ ] **Step 2: Update `light-operational-foundation.md` token direction**

In `docs/design/system/light-operational-foundation.md`, update the `updated` frontmatter value to `"2026-05-13"`.

Add this paragraph at the end of `## Token Direction`:

```md
The 2026-05-13 token direction clarifies that shadcn `--primary` is command ink rather than brand blue. Brand blue remains available through a limited identity token, while workflow and clinical colors move through explicit EMR status aliases.
```

- [ ] **Step 3: Update current status**

In `docs/engineering/current-status.md`, add this bullet after the 2026-05-10 Light Operational Foundation bullet:

```md
- 2026-05-13 기준 Neutral Command + Semantic Status token direction이 설계 기준으로 추가되었다. shadcn `--primary`는 브랜드 블루가 아니라 command ink로 정의하고, blue는 정보/링크/제한적 브랜드 순간 및 `status-info` 계열로 분리한다. EMR 업무 화면은 surface, line, text, interaction, status alias layer를 통해 고밀도 화면 위계를 관리한다.
```

- [ ] **Step 4: Run docs check**

Run:

```bash
npm run docs:check
```

Expected: PASS.

- [ ] **Step 5: Commit docs updates**

```bash
git add docs/design/system/DESIGN.md docs/design/system/light-operational-foundation.md docs/engineering/current-status.md
git commit -m "docs: document neutral command token system"
```

---

### Task 6: Final Verification

**Files:**
- No code edits.
- Review: all files changed in Tasks 1-5.

- [ ] **Step 1: Run full static verification**

Run:

```bash
npm run lint
npx tsc --noEmit
npm run docs:check
```

Expected: all commands pass.

- [ ] **Step 2: Run focused Playwright verification**

Run:

```bash
npx playwright test tests/design-tokens.spec.ts tests/chart.spec.ts tests/app-shell.spec.ts --reporter=line
```

Expected: all tests pass.

- [ ] **Step 3: Inspect changed files**

Run:

```bash
git diff --stat HEAD~5..HEAD
git status --short
```

Expected: committed changes cover token CSS, shared primitives, tests, and docs. `git status --short` may show pre-existing user changes; do not stage or revert unrelated files.

- [ ] **Step 4: Create final verification commit if needed**

If Task 6 required any small corrections, commit them with:

```bash
git add src/app/globals.css src/styles/tokens/emr-foundation.css src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/table.tsx src/components/emr/side-panel-card.tsx src/components/emr/subpanel.tsx src/components/emr/emr-data-table.tsx tests/design-tokens.spec.ts tests/chart.spec.ts docs/design/system/DESIGN.md docs/design/system/light-operational-foundation.md docs/engineering/current-status.md
git commit -m "fix: complete neutral command token rollout"
```

If no corrections were needed, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage: Tasks cover shadcn base token ownership, EMR operational aliases, status aliases, shared primitives, representative chart/app-shell tests, and design-system docs.
- Scope control: Feature screens are not broadly redesigned. Generated `clair.css` is untouched.
- Verification: Static checks, docs check, a token contract test, chart regression, and app-shell regression are included.
- Known precondition: Current working tree may contain unrelated edits in chart/nav/test files. Implementation workers must inspect `git status --short` before staging and only stage files they changed for the current task.
