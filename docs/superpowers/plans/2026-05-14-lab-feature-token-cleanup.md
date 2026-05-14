# Lab Feature Token Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the 임상병리 ranges in `src/features/lab-imaging/module.tsx` from direct local color tokens to shadcn semantic tokens and EMR alias tokens without changing lab behavior.

**Architecture:** Keep this as a scoped feature-screen cleanup inside the existing combined lab/imaging file. The source audit test extracts lab-only ranges and the shared attachment strip used by lab; imaging-only ranges stay out of the test and out of this PR.

**Tech Stack:** Next.js App Router client component, React, Tailwind CSS v4 arbitrary values, shadcn semantic variables, EMR alias CSS tokens, Playwright test runner.

---

### Task 1: Work Item And Failing Lab Audit

**Files:**
- Modify: `tests/design-tokens.spec.ts`
- Create: `docs/work/design-system/DESIGN-SYSTEM-PR-006-lab-feature-token-cleanup.md`
- Modify: `docs/work/index.md`

- [x] **Step 1: Add the lab source audit test**

Add a test named `lab workspace source uses semantic color tokens instead of direct local colors` that reads `src/features/lab-imaging/module.tsx`, extracts the lab helper, queue, side panel, result content, attachment strip, right panel, and lab content ranges, and asserts no direct local color pattern matches.

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
npx playwright test tests/design-tokens.spec.ts -g "lab workspace source uses semantic color tokens" --reporter=line
```

Expected: FAIL because the scoped lab ranges still contain direct Clair/local color usage.

### Task 2: Lab Semantic Token Replacement

**Files:**
- Modify: `src/features/lab-imaging/module.tsx`
- Test: `tests/design-tokens.spec.ts`
- Test: `tests/lab-imaging.spec.ts`

- [x] **Step 1: Replace judgment and status helper colors**

Change lab result markers, judgment badges, and lab status group color tokens to `--emr-status-danger-*`, `--emr-status-warning-*`, `--emr-status-info-*`, `--emr-status-success-*`, and `--emr-status-neutral-*`.

- [x] **Step 2: Replace lab queue and table neutral colors**

Change lab queue metadata, dividers, table headers, row hover states, and secondary text to `text-muted-foreground`, `text-foreground`, `--emr-text-secondary`, `--emr-line-subtle`, `--emr-surface-muted`, and `--emr-state-hover`.

- [x] **Step 3: Replace lab chart and attachment colors**

Change normal range chart segments, attachment preview surfaces, and file/icon treatments to EMR status/surface/text aliases.

- [x] **Step 4: Replace equipment receipt and lab action colors**

Change lab equipment receipt hover, text, badge border, preview table, and lab status action buttons to EMR/shadcn semantic tokens.

- [x] **Step 5: Run the focused audit test**

Run:

```bash
npx playwright test tests/design-tokens.spec.ts -g "lab workspace source uses semantic color tokens" --reporter=line
```

Expected: PASS.

### Task 3: Documentation Closeout And Verification

**Files:**
- Create: `docs/completed/design/2026-05-14-lab-feature-token-cleanup.md`
- Modify: `docs/engineering/current-status.md`
- Modify: `docs/work/design-system/DESIGN-SYSTEM-PR-006-lab-feature-token-cleanup.md`
- Modify: `docs/work/index.md`

- [x] **Step 1: Add closeout**

Create a closeout summarizing direct color categories found, token replacements, deferred imaging scope, changed files, and verification commands.

- [x] **Step 2: Update current status and work board**

Add one current-status bullet for lab cleanup completion, mark `DESIGN-SYSTEM-PR-006` done, and leave imaging as the next feature-screen cleanup.

- [x] **Step 3: Run verification**

Run:

```bash
npm run lint
npx tsc --noEmit
npm run docs:check
npx playwright test tests/design-tokens.spec.ts tests/lab-imaging.spec.ts --reporter=line
```

Expected: all commands exit 0. If a Playwright test flakes, rerun the failing test once and report both outputs.
