# Reception Feature Token Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `src/features/reception/module.tsx` from direct local color tokens to shadcn semantic tokens and EMR alias tokens without changing reception behavior.

**Architecture:** Keep the implementation as a single feature-screen cleanup. Add a source audit test in `tests/design-tokens.spec.ts` to guard the reception module, then replace direct screen-level colors with existing semantic tokens from `src/styles/tokens/emr-foundation.css` and shadcn variables already imported globally.

**Tech Stack:** Next.js App Router client component, React, Tailwind CSS v4 arbitrary values, shadcn semantic variables, EMR alias CSS tokens, Playwright test runner.

---

### Task 1: Work Item And Source Audit Test

**Files:**
- Modify: `tests/design-tokens.spec.ts`
- Create: `docs/work/design-system/DESIGN-SYSTEM-PR-005-reception-feature-token-cleanup.md`
- Modify: `docs/work/index.md`

- [ ] **Step 1: Add the failing reception source audit test**

Add this test to `tests/design-tokens.spec.ts`:

```ts
test("reception module uses semantic color tokens instead of direct local colors", async () => {
  const source = await fs.promises.readFile("src/features/reception/module.tsx", "utf8");
  const directColorPattern =
    /(clair-color-(?:atomic|background|primary|label|line|static)-|#[0-9A-Fa-f]{3,8}\\b|rgba?\\(|\\b(?:bg|text|border|ring|hover:bg|hover:border|hover:text|focus:border|disabled:bg|shadow)-\\[(?:[^\\]]*(?:clair-color-|rgba?|#[0-9A-Fa-f])[^\\]]*)\\]|\\b(?:bg|text|border|ring)-(?:white|black|red|green|blue|orange|yellow|sky|gray|slate|zinc|neutral|stone|cyan|purple|pink|rose|emerald|amber)-)/g;

  const matches = source.match(directColorPattern) ?? [];

  expect(matches).toEqual([]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx playwright test tests/design-tokens.spec.ts -g "reception module uses semantic color tokens" --reporter=line
```

Expected: FAIL because `src/features/reception/module.tsx` still contains direct Clair/local color usage.

- [ ] **Step 3: Register the work item**

Add `DESIGN-SYSTEM-PR-005` to `docs/work/index.md` after `DESIGN-SYSTEM-PR-004` with status `in_progress`, area `design-system`, priority `P1`, target `PR 5`, and work item path `docs/work/design-system/DESIGN-SYSTEM-PR-005-reception-feature-token-cleanup.md`.

### Task 2: Reception Module Semantic Token Replacement

**Files:**
- Modify: `src/features/reception/module.tsx`
- Test: `tests/design-tokens.spec.ts`
- Test: `tests/reception.spec.ts`

- [ ] **Step 1: Replace clinician/event color helpers**

Change `veterinarianPalette` and `calendarDotPalette` from direct Clair atomic colors to semantic/EMR alias classes. Use neutral/status variables such as `--emr-status-info-text`, `--emr-status-success-text`, `--emr-status-warning-text`, `--emr-status-danger-text`, `--emr-state-selected-border`, `--emr-line-strong`, `--emr-text-secondary`, and `--emr-text-tertiary`.

- [ ] **Step 2: Replace wait/status tone helpers**

Change wait-time and status tone classes so success, warning, danger, info, and neutral states use `--emr-status-*-bg`, `--emr-status-*-border`, `--emr-status-*-text`, `text-muted-foreground`, `text-foreground`, or `text-destructive`.

- [ ] **Step 3: Replace calendar/card local surfaces**

Change selected, hover, active day, current-time, and card surface classes from direct sky/gray/red/green colors, `bg-white`, `text-white`, and rgba shadows to `--emr-state-selected`, `--emr-state-hover`, `--emr-line-hairline`, `--emr-line-default`, `--emr-surface-panel`, `--emr-surface-muted`, `--emr-text-inverse`, `shadow-sm`, or `shadow-xs`.

- [ ] **Step 4: Replace dialog/form local colors**

Change reception dialog label, icon, selected option, footer, and required marker classes from direct Clair label/primary/background tokens to `text-foreground`, `text-muted-foreground`, `text-primary`, `bg-card`, `bg-muted`, `--emr-surface-panel`, `--emr-state-selected`, and `--emr-state-hover`.

- [ ] **Step 5: Run the focused audit test to verify green**

Run:

```bash
npx playwright test tests/design-tokens.spec.ts -g "reception module uses semantic color tokens" --reporter=line
```

Expected: PASS.

### Task 3: Documentation Closeout And Verification

**Files:**
- Create: `docs/completed/design/2026-05-14-reception-feature-token-cleanup.md`
- Modify: `docs/engineering/current-status.md`
- Modify: `docs/work/design-system/DESIGN-SYSTEM-PR-005-reception-feature-token-cleanup.md`

- [ ] **Step 1: Add closeout**

Create `docs/completed/design/2026-05-14-reception-feature-token-cleanup.md` summarizing direct color categories found, token replacements, deferred feature screens, changed files, and verification commands.

- [ ] **Step 2: Update current status**

Add one bullet to `docs/engineering/current-status.md` noting that reception module screen-level direct color cleanup is complete, while `profile-drawer.tsx`, lab/imaging, home kanban, and other feature screens remain follow-up scope.

- [ ] **Step 3: Mark work item done**

Update `DESIGN-SYSTEM-PR-005` status to `done`, add the closeout path to handoff notes, and keep verification commands listed.

- [ ] **Step 4: Run verification**

Run:

```bash
npm run lint
npx tsc --noEmit
npm run docs:check
npx playwright test tests/design-tokens.spec.ts tests/reception.spec.ts --reporter=line
```

Expected: all commands exit 0. If a Playwright test flakes, rerun the failing test once and report both outputs.
