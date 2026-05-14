# Imaging Feature Token Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the 영상검사 ranges in `src/features/lab-imaging/module.tsx` from direct local color tokens to shadcn semantic tokens and EMR alias tokens without changing imaging behavior.

**Architecture:** Keep this as a scoped feature-screen cleanup inside the existing combined lab/imaging file. The source audit test extracts imaging-only ranges; lab-specific ranges remain covered by the previous lab audit.

**Tech Stack:** Next.js App Router client component, React, Tailwind CSS v4 arbitrary values, shadcn semantic variables, EMR alias CSS tokens, Playwright test runner.

---

### Task 1: Work Item And Failing Imaging Audit

**Files:**
- Modify: `tests/design-tokens.spec.ts`
- Create: `docs/work/design-system/DESIGN-SYSTEM-PR-007-imaging-feature-token-cleanup.md`
- Modify: `docs/work/index.md`

- [x] **Step 1: Add the imaging source audit test**

Add a test named `imaging workspace source uses semantic color tokens instead of direct local colors` that reads `src/features/lab-imaging/module.tsx`, extracts the imaging status, queue, side panel, content, media, and right panel ranges, and asserts no direct local color pattern matches.

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
npx playwright test tests/design-tokens.spec.ts -g "imaging workspace source uses semantic color tokens" --reporter=line
```

Expected: FAIL because the scoped imaging ranges still contain direct Clair/local color usage.

### Task 2: Imaging Semantic Token Replacement

**Files:**
- Modify: `src/features/lab-imaging/module.tsx`
- Test: `tests/design-tokens.spec.ts`
- Test: `tests/lab-imaging.spec.ts`

- [x] **Step 1: Replace imaging status helper colors**

Change imaging status group color tokens to `--emr-status-neutral-text`, `--emr-status-info-text`, `--emr-status-warning-text`, and `--emr-status-success-text`.

- [x] **Step 2: Replace imaging queue and history colors**

Change imaging queue metadata, separators, chart summaries, and history separators to `text-muted-foreground`, `--emr-text-secondary`, `--emr-text-tertiary`, and `--emr-line-subtle`.

- [x] **Step 3: Replace imaging content colors**

Change status action buttons, order detail table headers, reading toolbar surface, and staff note banner to EMR/shadcn semantic tokens.

- [x] **Step 4: Replace imaging media and right panel colors**

Change media thumbnails, summary comment toolbar, file rows, and file links to EMR surface/text/status aliases.

- [x] **Step 5: Run the focused audit test**

Run:

```bash
npx playwright test tests/design-tokens.spec.ts -g "imaging workspace source uses semantic color tokens" --reporter=line
```

Expected: PASS.

### Task 3: Documentation Closeout And Verification

**Files:**
- Create: `docs/completed/design/2026-05-14-imaging-feature-token-cleanup.md`
- Modify: `docs/engineering/current-status.md`
- Modify: `docs/work/design-system/DESIGN-SYSTEM-PR-007-imaging-feature-token-cleanup.md`
- Modify: `docs/work/index.md`

- [x] **Step 1: Add closeout**

Create a closeout summarizing direct color categories found, token replacements, deferred next scope, changed files, and verification commands.

- [x] **Step 2: Update current status and work board**

Add one current-status bullet for imaging cleanup completion, mark `DESIGN-SYSTEM-PR-007` done, and leave dispensing/treatment as the next feature-screen cleanup.

- [x] **Step 3: Run verification**

Run:

```bash
npm run lint
npx tsc --noEmit
npm run docs:check
npx playwright test tests/design-tokens.spec.ts tests/lab-imaging.spec.ts --reporter=line
```

Expected: all commands exit 0.
