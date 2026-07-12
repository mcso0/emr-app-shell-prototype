# Table Density Dropdown Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared table-density icon toggle group with a selected-value dropdown button while preserving every existing density behavior.

**Architecture:** Keep all density state in existing callers and use the existing `emrTableDensityOptions` values. Compose the selector from the existing `Button` and `DropdownMenuRadioGroup`; update its Storybook interaction test and the source-of-truth density contract in the same PR.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Base UI dropdown primitives, Storybook, Playwright.

## Global Constraints

- Keep `compact`, `standard`, and `comfortable` values and existing CSS density tokens unchanged.
- Do not add dependencies, persistence, URL state, API work, or caller-specific props.
- Preserve visible Korean labels and supply an accessible trigger name with the active value.
- Keep the changes limited to the shared selector, its Storybook coverage, and density design/work documentation.

---

### Task 1: Specify the Shared Dropdown Interaction

**Files:**

- Modify: `src/components/emr/table-density-selector.stories.tsx:57-68`
- Test: `src/components/emr/table-density-selector.stories.tsx:57-68`

**Interfaces:**

- Consumes: `EmrTableDensitySelector` with `value`, `label`, and `onValueChange`.
- Produces: a Storybook play interaction proving that the current-value trigger opens a radio menu and selecting `compact` updates caller state.

- [x] **Step 1: Write the failing Storybook interaction**

Replace the existing direct compact-button lookup with a trigger lookup and a
radio-menu-item lookup:

```ts
const trigger = canvasElement.querySelector(
  "button[aria-label='샘플 테이블 보기 밀도: 기본']",
);
if (!(trigger instanceof HTMLElement)) {
  throw new Error("Expected table density dropdown trigger.");
}
trigger.click();

const compactOption = Array.from(
  canvasElement.ownerDocument.querySelectorAll("[role='menuitemradio']"),
).find((option) => option.textContent?.trim() === "좁게");
if (!(compactOption instanceof HTMLElement)) {
  throw new Error("Expected compact density menu option.");
}
compactOption.click();
```

- [x] **Step 2: Run the focused interaction and verify it fails**

Run:

```bash
npx vitest run --project storybook src/components/emr/table-density-selector.stories.tsx
```

Expected: FAIL with `Expected table density dropdown trigger.` before
implementation.

- [x] **Step 3: Implement the minimal selector UI**

In `src/components/emr/table-density-selector.tsx`, import `ChevronDownIcon`,
`Button`, `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuRadioGroup`,
`DropdownMenuRadioItem`, and `DropdownMenuTrigger`. Render this composition:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger
    render={
      <Button
        type="button"
        variant="outline"
        size="xs"
        aria-label={`${label}: ${selectedOption.label}`}
        className="shrink-0 bg-card"
      >
        <TableDensityIcon density={value} />
        {selectedOption.label}
        <ChevronDownIcon data-icon="inline-end" />
      </Button>
    }
  />
  <DropdownMenuContent align="end" className="min-w-28">
    <DropdownMenuRadioGroup
      value={value}
      onValueChange={(nextValue) => onValueChange(nextValue as EmrTableDensity)}
    >
      {emrTableDensityOptions.map((option) => (
        <DropdownMenuRadioItem key={option.value} value={option.value}>
          <TableDensityIcon density={option.value} />
          {option.label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  </DropdownMenuContent>
</DropdownMenu>
```

- [x] **Step 4: Run the Storybook interaction and build checks**

Run:

```bash
npx vitest run --project storybook src/components/emr/table-density-selector.stories.tsx
npm run build-storybook
```

Expected: the selector interaction opens the menu, chooses `좁게`, and reports
`현재 선택: compact`; the Storybook build completes without TypeScript errors.

### Task 2: Record the New Shared Default and Verify a Consumer

**Files:**

- Modify: `docs/design/system/DESIGN.md:148-153`
- Modify: `docs/design/system/table-density-and-grid-ergonomics.md:64-139`
- Modify: `docs/design/system/tab-table-density-contract.md:12-124`
- Create: `docs/work/design-system/DESIGN-SYSTEM-PR-074-table-density-dropdown-selector.md`
- Modify: `docs/work/index.md`
- Test: `tests/chart-order-table-density.spec.ts`

**Interfaces:**

- Consumes: shared selector public props and chart order table local density state.
- Produces: durable dropdown-default contract plus focused browser coverage for
  a visible chart consumer.

- [x] **Step 1: Write the failing chart/order browser check**

Create `tests/chart-order-table-density.spec.ts` that opens the chart route,
locates `button[aria-label='테이블 보기 밀도: 좁게']`, chooses `넓게` from the
radio menu, and asserts the chart order table has
`data-emr-density='comfortable'`.

- [x] **Step 2: Run the focused test and verify it fails before the selector implementation**

Run:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3111 npx playwright test tests/chart-order-table-density.spec.ts --reporter=line
```

Expected: FAIL because the current three-button selector has no selected-value
dropdown trigger.

- [x] **Step 3: Update the canonical contract and work item**

Make the selected-value dropdown the default shared density selector. Keep the
three modes and local presentation-only state contract. Prohibit adding saved
views, URL state, persistence, or data behavior to the selector.

- [x] **Step 4: Run focused and broad verification**

Run:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3111 npx playwright test tests/chart-order-table-density.spec.ts --reporter=line
npm run lint
npx tsc --noEmit
npm run docs:check
npm run build-storybook
```

Expected: each command exits with status `0`.
