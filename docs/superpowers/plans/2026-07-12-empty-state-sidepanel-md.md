# Empty State Side Panel MD Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align every shared EMR side-panel empty state to the CDS.V2 `md` visual contract, while preserving queue-specific placement, loading behavior, search behavior, and feature ownership.

**Architecture:** Keep `EmrQueueEmptyState` as the queue-specific placement wrapper, but render the shared `EmrEmptyState` inside it with `size="md"` and `surface="queue"`. This centralizes the Figma icon slot, alpha tokens, typography, spacing, and action-space contract for reception, chart, lab, imaging, dispensing, billing, and Home side-panel states. Content-area `EmrEmptyState` consumers remain on their existing `lg` contract.

**Tech Stack:** React, TypeScript, Next.js, Tailwind utility classes, Storybook/Vitest, Playwright.

## Global Constraints

- Keep queue placement and feature behavior in callers; the shared component must not own routing, selection, refresh, permission, or persistence.
- Use existing CLAiR tokens: `black-alpha-4` icon-area background, `black-alpha-48` icon/title, and `black-alpha-36` descriptions.
- Treat the product label `mg` as the implementation value `md`.
- Do not change content `lg`, table contracts, or `EmrQueueLoadingState` semantics beyond the shared visual slot.
- Preserve unrelated root-checkout changes by working only in this dedicated worktree.

### Task 1: Lock the side-panel inventory and contract

**Files:**
- Read: `src/components/emr/subpanel.tsx`
- Read: `src/components/emr/order-queue-side-panel.tsx`
- Read: `src/features/reception/reception-list-search.tsx`
- Read: `src/features/lab-imaging/module.tsx`
- Read: `src/features/billing/module.tsx`
- Read: `src/features/home/components/home-kanban-workspace.tsx`

- [x] Confirmed that `EmrQueueEmptyState` is the shared side-panel wrapper for reception, chart, lab, imaging, dispensing, billing, and Home side-panel empty states.
- [x] Confirmed that content-area `EmrEmptyState` consumers are separate and remain on `lg`.

### Task 2: Write and run the failing visual regression tests

**Files:**
- Modify: `tests/queue-loading-state.spec.ts`
- Create: `tests/side-panel-empty-state-contract.spec.ts`

The test contract must assert these values for queue empty states:

```ts
{
  size: "md",
  iconArea: { width: 32, height: 32 },
  rootGap: "8px",
  iconAreaBackground: blackAlpha4,
  titleColor: blackAlpha48,
  titleFontSize: "14px",
}
```

The cross-module test must visit `home`, `reception`, `treatment`, `lab`, `imaging`, `dispensing`, and `billing` in the prepared empty workspace and assert that each side-panel empty state exposes `section[data-surface="queue"][data-size="md"]`. Run the focused tests before production changes and record the expected failure against the current 40px queue slot. **Completed:** RED observed against the previous implementation.

### Task 3: Implement the shared `md` queue state

**Files:**
- Modify: `src/components/emr/subpanel.tsx`

Change `EmrQueueEmptyState` to accept:

```ts
{
  description?: ReactNode;
  kind?: EmrEmptyStateKind;
  reserveActionSpace?: boolean;
}
```

Render the shared contract:

```tsx
<EmrEmptyState
  description={description}
  icon={icon}
  kind={kind ?? "no-data"}
  priority="supporting"
  reserveActionSpace={reserveActionSpace}
  size="md"
  surface="queue"
  title={title ?? children}
/>
```

Keep the existing outer `min-h-[220px]`, `panel-center` translation, custom `className`, and passthrough test attributes. Set custom search/loading motion icons to the `md` 16px icon slot. Use `reserveActionSpace={false}` for loading; semantic empty/search states retain the Figma reserved-action-row behavior.

**Completed:** shared queue rendering now delegates to `EmrEmptyState size="md"`; focused GREEN verification passed.

### Task 4: Add `md` descriptions to all semantic side-panel empty states

**Files:**
- Modify: `src/components/emr/order-queue-side-panel.tsx`
- Modify: `src/features/reception/reception-list-search.tsx`
- Modify: `src/features/reception/module.tsx`
- Modify: `src/features/lab-imaging/module.tsx`
- Modify: `src/features/billing/module.tsx`
- Modify: `src/features/home/components/home-kanban-workspace.tsx`

- Add shared order-queue descriptions for no-source and filtered states.
- Add date-aware empty descriptions for lab and imaging queues.
- Add the prepared empty-state description for reception and billing.
- Add the empty description for Home’s next-action side panel.
- Keep loading descriptions and error/permission messages semantically separate from passive empty-state copy.

**Completed:** all seven supported side-panel surfaces now provide `md` empty-state descriptions; content-area `lg` states remain unchanged.

### Task 5: Document and verify

**Files:**
- Modify: `docs/design/system/empty-info-state-contract.md`
- Modify: `docs/work/design-system/DESIGN-SYSTEM-PR-070-emr-empty-state-component-storybook.md`
- Create: `docs/completed/design/2026-07-12-empty-state-sidepanel-md.md`

Run:

```bash
npx playwright test tests/queue-loading-state.spec.ts tests/side-panel-empty-state-contract.spec.ts --reporter=line
npm run lint
npx tsc --noEmit --pretty false --incremental false
npm run docs:check
git diff --check
npm run build-storybook
npm run storybook -- --ci --smoke-test
npm run build
```

Record exact pass counts and any existing non-blocking warnings in the closeout before commit, push, PR, and merge.

**Completed:** focused and repository-wide local gates passed; closeout records the exact results.
