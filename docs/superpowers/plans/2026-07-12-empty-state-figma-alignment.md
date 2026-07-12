# Empty State Figma Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the shared `EmrEmptyState` runtime component and Storybook examples with Figma node `27540:70134` without changing the queue-specific empty-state component.

**Architecture:** Keep the existing semantic API (`kind`, `surface`, `priority`, action slots) and add an explicit visual `size` contract with `lg`, `md`, and `sm`. Preserve `density` as a compatibility input that resolves to a size, use existing CLAiR alpha/color tokens instead of local rgba/hex values, and keep feature behavior/actions owned by callers. The component will expose stable `data-size` and slot attributes so Storybook tests can verify geometry and typography without depending on generated utility-class details.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4 utility classes, Storybook 10 with Vitest/Playwright browser tests.

## Global Constraints

- Figma `md` is the implementation name for the requested `mg` tier.
- `lg` is for content areas; `md` is for side panels and large tables; `sm` is for modals and small tables.
- Figma icon artwork is a slot reference only; reuse the existing motion icon content inside the size-specific slot.
- Use existing `--clair-color-atomic-black-alpha-*`, `--clair-color-atomic-white-alpha-*`, neutral, common, and shadow tokens; do not add local rgba/hex colors for the component or its stories.
- Do not change `EmrQueueEmptyState`, feature routing, permission logic, persistence, analytics, or logging.
- Keep the existing client boundary and serializable props behavior described by `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`.
- Verify with focused Storybook interaction tests, TypeScript, lint, Storybook build/smoke, docs check, and production build where available.

---

### Task 1: Add failing Figma contract coverage

**Files:**
- Modify: `src/components/emr/empty-state.stories.tsx`
- Test: `src/components/emr/empty-state.stories.tsx` Storybook `play` assertions

**Interfaces:**
- Consumes: the intended `EmrEmptyState` `size?: "lg" | "md" | "sm"` prop and `data-size`/slot attributes.
- Produces: a Storybook `FigmaSizeContract` story that fails against the current one-size implementation.

- [ ] **Step 1: Write the failing story test**

Add a story that renders one default, one-action, and two-action state for each size. The play function must assert:

```ts
const expected = {
  lg: { icon: 48, titleSize: "16px", rootGap: "16px" },
  md: { icon: 32, titleSize: "14px", rootGap: "8px" },
  sm: { icon: 0, titleSize: "14px", rootGap: "8px" },
};
```

It must also assert the title color resolves from `--clair-color-atomic-black-alpha-48`, the description color resolves from `--clair-color-atomic-black-alpha-36`, and the icon background resolves from `--clair-color-atomic-black-alpha-4`.

- [ ] **Step 2: Run the focused Storybook test and confirm RED**

Run:

```bash
npx vitest --project storybook run src/components/emr/empty-state.stories.tsx
```

Expected: failure because `EmrEmptyState` does not yet accept `size`, does not expose `data-size`, and always renders a 64px icon area with a 16px title.

---

### Task 2: Implement the size and token contract

**Files:**
- Modify: `src/components/emr/empty-state.tsx`

**Interfaces:**
- Consumes: the failing Storybook contract from Task 1.
- Produces: `EmrEmptyStateSize`, explicit `size` prop, compatibility resolution from existing `density`, and Figma-aligned size-specific slots.

- [ ] **Step 1: Add the visual size type and compatibility resolver**

```ts
export type EmrEmptyStateSize = "lg" | "md" | "sm";

function resolveSize(
  surface: EmrEmptyStateSurface,
  density?: EmrEmptyStateDensity,
  size?: EmrEmptyStateSize,
): EmrEmptyStateSize {
  if (size) return size;
  if (density === "table-row") return "md";
  if (density === "compact") return "sm";
  if (surface === "content" || surface === "global-shell") return "lg";
  return "sm";
}
```

- [ ] **Step 2: Implement size-specific layout classes**

Use these structural values:

```ts
lg: root gap 16px, iconArea 48px/radius14, icon 24px, title 16/24, spacer 28px
md: root gap 8px, icon wrapper bottom padding 4px, iconArea 32px/radius10, icon 16px, title 14/20, spacer 24px
sm: root gap 8px, no icon slot, title 14/20, spacer 24px
```

Keep copy gap at 6px and action gap at 8px. Keep center/start alignment and existing motion animation behavior.

- [ ] **Step 3: Replace local colors with existing CLAiR tokens**

Use:

```tsx
bg-[var(--clair-color-atomic-black-alpha-4)]
text-[var(--clair-color-atomic-black-alpha-48)]
text-[var(--clair-color-atomic-black-alpha-36)]
```

The title must use black alpha 48, not the current alpha 64. Preserve semantic `priority` metadata without allowing it to override the Figma typography colors.

- [ ] **Step 4: Run the focused Storybook test and confirm GREEN**

Run the same Vitest command from Task 1. Expected: all Figma size, slot, spacing, and color assertions pass.

---

### Task 3: Update Storybook examples and documentation

**Files:**
- Modify: `src/components/emr/empty-state.stories.tsx`
- Modify: `docs/work/design-system/DESIGN-SYSTEM-PR-070-emr-empty-state-component-storybook.md`
- Modify: `docs/design/system/empty-info-state-contract.md` only if the final `size` compatibility mapping changes the durable contract.

**Interfaces:**
- Consumes: the implemented `size` prop and size-specific action dimensions.
- Produces: stories for the Figma 3×3 matrix and documentation that calls out `md` as the `mg` tier.

- [ ] **Step 1: Update story args and buttons**

Use `size="lg"` for content examples, `size="md"` for large-table examples, and `size="sm"` for modal/small-table examples. Use existing tokens for button background, text, border, and shadow. Use 28px button size for `lg` and 24px for `md/sm`.

- [ ] **Step 2: Make action examples match Figma**

The one-action story must render an outline action. The two-action story must render outline secondary first and dark primary second. The default story must reserve the correct size-specific bottom space.

- [ ] **Step 3: Run focused Storybook tests**

Run:

```bash
npx vitest --project storybook run src/components/emr/empty-state.stories.tsx
```

Expected: all stories and play assertions pass with no unrelated story failures.

---

### Task 4: Full verification and source audit

**Files:**
- Inspect: `src/components/emr/empty-state.tsx`
- Inspect: `src/components/emr/empty-state.stories.tsx`
- Inspect: `src/components/emr/subpanel.tsx`
- Inspect: `src/styles/tokens/clair.css`

- [ ] **Step 1: Run focused checks**

```bash
npx vitest --project storybook run src/components/emr/empty-state.stories.tsx
npx eslint src/components/emr/empty-state.tsx src/components/emr/empty-state.stories.tsx
npx tsc --noEmit --pretty false --incremental false
```

- [ ] **Step 2: Run repository gates**

```bash
npm run lint
npm run build-storybook
npm run storybook -- --ci --smoke-test
npm run build
npm run docs:check
git diff --check
```

- [ ] **Step 3: Audit scope and diff**

Confirm that `EmrQueueEmptyState` is unchanged, no dependency or token-source duplication was added, only intended files are modified, and the final branch is based on `origin/main`.

---

### Task 5: Commit, push, PR, and merge

**Files:**
- Modify: only the files validated in Task 4

- [ ] **Step 1: Stage explicit intended files**

```bash
git add src/components/emr/empty-state.tsx src/components/emr/empty-state.stories.tsx docs/superpowers/plans/2026-07-12-empty-state-figma-alignment.md docs/work/design-system/DESIGN-SYSTEM-PR-070-emr-empty-state-component-storybook.md docs/design/system/empty-info-state-contract.md
```

Only stage files that actually changed.

- [ ] **Step 2: Commit and push**

```bash
git commit -m "Align empty state with Figma size contract"
git push -u origin codex/empty-state-figma
```

- [ ] **Step 3: Open the PR**

Create a draft PR targeting `main` with a real Markdown body covering the Figma source, size/color/layout changes, queue out-of-scope boundary, and all verification commands.

- [ ] **Step 4: Verify PR checks and merge**

Inspect the PR checks and merge only after required checks pass:

```bash
gh pr checks <pr-number>
gh pr merge <pr-number> --merge --delete-branch
git fetch --prune origin
git rev-list --left-right --count main...origin/main
```

Expected final sync evidence: the PR is merged, `origin/main` contains the merge commit, and the branch is no longer ahead of the remote main line.
