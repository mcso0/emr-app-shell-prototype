# Shadcn Alert Inline Alert Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compose the EMR persistent-alert contract on shadcn Alert and replace the chart unavailable-action acknowledgement with an accessible dismiss icon.

**Architecture:** Keep `EmrInlineAlert` as the stable EMR API. Add shadcn Alert as its generic structural primitive, then use its top-end action slot for an optional dismiss control while preserving below-copy recovery actions.

**Tech Stack:** Next.js 16, React, shadcn `base-nova`, `@base-ui/react`, Tailwind CSS v4, Playwright.

## Global Constraints

- Preserve existing `EmrInlineAlert` severity and recovery-action behavior.
- Add no runtime dependency.
- Use semantic CLAiR/EMR tokens.
- Make only the chart unavailable-action notice dismissible with an icon-only `안내 닫기` control.
- Do not include unrelated reception worktree changes.

---

### Task 1: Capture the chart dismiss interaction

**Files:**
- Modify: `tests/chart.spec.ts:1627-1639`

**Interfaces:**
- Consumes: `data-testid="chart-unavailable-action-alert"`.
- Produces: browser coverage for the dismiss button and hidden alert.

- [x] **Step 1: Write the failing test**

```ts
const dismissButton = unavailableAlert.getByRole("button", {
  name: "안내 닫기",
});
await expect(dismissButton).toBeVisible();
await expect(
  unavailableAlert.getByRole("button", { name: "확인" }),
).toHaveCount(0);
await dismissButton.click();
await expect(unavailableAlert).toBeHidden();
```

- [x] **Step 2: Verify RED**

Run: `npx playwright test tests/chart.spec.ts -g "chart unavailable order actions" --reporter=line`

Expected: FAIL because no button named `안내 닫기` exists.

### Task 2: Add shadcn Alert and adapt the EMR alert API

**Files:**
- Create: `src/components/ui/alert.tsx`
- Modify: `src/components/emr/inline-alert.tsx:1-150`
- Modify: `src/components/emr/inline-alert.stories.tsx:20-54`

**Interfaces:**
- Consumes: shadcn `Alert`, `AlertTitle`, `AlertDescription`, and `AlertAction`.
- Produces: optional `dismissAction?: ReactNode` top-end slot; existing `action` and `secondaryAction` remain below the copy.

- [x] **Step 1: Add the generated shadcn structural primitive**

```tsx
export { Alert, AlertTitle, AlertDescription, AlertAction }
```

- [x] **Step 2: Implement the minimal adapter**

```tsx
export type EmrInlineAlertProps = Omit<ComponentPropsWithoutRef<"section">, "title"> & {
  dismissAction?: ReactNode;
  // existing props remain unchanged
};

{dismissAction ? <AlertAction>{dismissAction}</AlertAction> : null}
```

Pass the existing severity token class and resolved role to `Alert`; keep recovery actions in the below-copy group.

- [x] **Step 3: Add Storybook control metadata**

```ts
dismissAction: { table: { disable: true } },
```

- [x] **Step 4: Verify component linting**

Run: `npx eslint src/components/ui/alert.tsx src/components/emr/inline-alert.tsx src/components/emr/inline-alert.stories.tsx`

Expected: PASS.

### Task 3: Adopt the dismiss slot in chart unavailable-action feedback

**Files:**
- Modify: `src/features/chart/module.tsx:1-25`
- Modify: `src/features/chart/module.tsx:4207-4235`

**Interfaces:**
- Consumes: `EmrInlineAlert.dismissAction` and `CdsActionsXIcon`.
- Produces: an icon-only button labelled `안내 닫기` that calls existing `onDismiss`.

- [x] **Step 1: Replace the text acknowledgement**

```tsx
dismissAction={
  <Button type="button" variant="ghost" size="icon-xs" aria-label="안내 닫기" onClick={onDismiss}>
    <CdsActionsXIcon data-icon="inline-start" />
  </Button>
}
```

- [x] **Step 2: Verify GREEN**

Run: `npx playwright test tests/chart.spec.ts -g "chart unavailable order actions" --reporter=line`

Expected: PASS with current explanatory copy, no `확인`, and a working X dismiss control.

### Task 4: Record the contract and verify the scoped change

**Files:**
- Modify: `docs/design/system/inline-alert-feedback-rules.md:48-79`
- Create: `docs/work/design-system/DESIGN-SYSTEM-PR-075-shadcn-alert-inline-alert-adoption.md`
- Modify: `docs/work/index.md`

- [x] **Step 1: Document the distinction between top-end dismiss controls and below-copy recovery actions.**

- [x] **Step 2: Record scope, exclusions, done criteria, and verification commands in the work item.**

- [x] **Step 3: Verify the completed scope**

```bash
npx playwright test tests/chart.spec.ts -g "chart unavailable order actions" --reporter=line
npx tsc --noEmit
npm run lint -- --ignore-pattern '.worktrees/**'
npm run docs:check
npm run security:secrets
git diff --check
```

Expected: all commands pass; report unrelated pre-existing warnings separately.
