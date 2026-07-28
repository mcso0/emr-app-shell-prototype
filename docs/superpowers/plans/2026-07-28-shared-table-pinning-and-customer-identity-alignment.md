# Shared Table Pinning And Customer Identity Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every shared EMR table with pinned columns render an opaque, correctly layered fixed surface, then migrate the customer animal table and align its title, search, pinned header label, and row identity text to the guardian-table baseline.

**Architecture:** The low-level shared `Table`, `TableHead`, and `TableCell` primitives own pinning attributes, offsets, stacking, edge shadows, and opaque row-state surfaces. A small TanStack adapter converts `Column` state into those primitive props without coupling the HTML table primitive to TanStack. `CustomerDataTable` becomes a consumer of that shared contract, while customer-only identity-header indentation remains column metadata because the shared table cannot infer avatar geometry.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, global CSS tokens, TanStack React Table, Storybook 10 with addon-vitest, Playwright.

## Global Constraints

- Start from fresh `origin/main` at or after `8d988505`; do not implement on the stale local `main`.
- Do not add dependencies or change customer data, search, sorting, filtering, selection, drawer, routing, permissions, or persistence behavior.
- Do not expand `src/components/emr/emr-data-table.tsx`; it remains order/dispensing-specific.
- Keep `Table` as the single horizontal-overflow owner and preserve `layout="scroll"`.
- Keep the animal identity column at `size: 184`, `minSize: 160`, and `maxSize: 220`.
- Support both `left` and `right` shared pinning props, but migrate only the already-approved animal-name left pin in this work.
- Pinned header and body cells must own opaque backgrounds for default, hover, selected, and loading surfaces; never use `background: inherit` for a pinned cell.
- Use `--emr-surface-panel`, `--emr-surface-hover`, `--emr-surface-selected`, and `--emr-surface-muted`; do not add palette literals.
- Keep the guardian table unpinned; limit its geometry change to the shared 2px header-label alignment correction.
- Align animal header label text to animal row-name text within 2px, and keep animal row-name text within 8px of the page title/search left baseline at the 1900px verification viewport.
- Keep the avatar as the leading visual slot; do not move the entire row identity text to compensate for the header.
- Use test-first red/green cycles for each behavior change.
- Do not push, open a PR, merge, deploy, or change production state in this plan.

---

### Task 1: Record The Shared Pinning Work Item

**Files:**
- Create: `docs/work/design-system/DESIGN-SYSTEM-PR-087-shared-table-pinning-surface.md`
- Modify: `docs/work/index.md`

**Interfaces:**
- Consumes: the shipped customer-only pinning contract in `DESIGN-SYSTEM-PR-086`.
- Produces: an active PR-sized scope for shared pinning surfaces and customer identity alignment.

- [x] **Step 1: Create the work item**

Create the work item with this contract:

```markdown
---
id: "DESIGN-SYSTEM-PR-087"
status: "active"
area: "design-system"
priority: "P0"
target_pr: "User request / shared pinned-table surface and customer identity alignment"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-086-customer-animal-pinned-table.md"
updated: "2026-07-28"
---

# Shared Table Pinning Surface

## Goal

Move pinned-column painting and stacking into shared table primitives, remove customer-local `bg-inherit`, and align the animal identity header label with the title, search, and row identity baseline.

## In Scope

- Shared left/right pinning props on `TableHead` and `TableCell`.
- Shared opaque default, hover, selected, header, and loading surfaces.
- Shared pinned-edge separator and stacking rules.
- TanStack column-to-table-props adapter.
- Customer animal-table migration.
- Animal identity header leading offset matching the 28px avatar plus 8px gap.
- Storybook and customer Playwright regression coverage.

## Out Of Scope

- A new data-grid dependency.
- Broad migration of tables that do not currently pin columns.
- Changes to the order/dispensing-specific `EmrDataTable`.
- Customer data, search, filtering, sorting, selection, drawers, API, Supabase, RLS, permissions, or production deployment.

## Done Criteria

- Scrolled content never appears through a pinned cell in default, hover, selected, or loading states.
- Shared primitives support typed left and right pinning offsets.
- Customer code no longer calculates sticky position, z-index, or edge shadow locally.
- Animal header label and row-name text differ by at most 2px at 1900px.
- Animal row-name text remains within 8px of the title/search baseline.
- Guardian table remains unpinned and its focused regressions pass.

## Verification

- `npx vitest run --project storybook src/components/ui/table.stories.tsx`
- `npx playwright test tests/customer.spec.ts --grep "customer patient table" --reporter=line`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run build-storybook`
- `npm run build`
```

- [x] **Step 2: Add PR-087 to the work index**

Add one design-system row immediately after PR-086:

```markdown
| DESIGN-SYSTEM-PR-087        | active       | design-system        | P0       | User request / shared pinned-table surface and customer identity alignment | `docs/work/design-system/DESIGN-SYSTEM-PR-087-shared-table-pinning-surface.md` |
```

- [x] **Step 3: Verify the documentation routes**

Run:

```bash
npm run docs:check
```

Expected: PASS with no broken link or duplicate work-item identifier.

- [x] **Step 4: Commit the planning contract**

```bash
git add docs/work/index.md docs/work/design-system/DESIGN-SYSTEM-PR-087-shared-table-pinning-surface.md docs/superpowers/plans/2026-07-28-shared-table-pinning-and-customer-identity-alignment.md
git commit -m "docs: plan shared table pinning fix"
```

---

### Task 2: Add Shared Pinned-Cell Primitives

**Files:**
- Modify: `src/components/ui/table.stories.tsx`
- Modify: `src/components/ui/table.tsx`
- Modify: `src/app/globals.css`
- Create: `src/components/emr/table-pinning.ts`

**Interfaces:**
- Consumes: existing `Table`, `TableHead`, `TableCell`, semantic surface tokens, and TanStack `Column`.
- Produces:
  - `TablePinningMode = "none" | "columns"`
  - `TablePinnedSide = "left" | "right"`
  - `TablePinnedCellOptions`
  - `getEmrPinnedColumnProps<TRow>(column: Column<TRow, unknown>): TablePinnedCellOptions`
  - `Table` prop `pinning?: TablePinningMode`
  - `TableHead` and `TableCell` props `pinned`, `pinnedOffset`, and `pinnedEdge`

- [x] **Step 1: Write the failing shared-table story**

Extend `TableStoryArgs` with `pinning: "none" | "columns"` and add a `PinnedColumns` story that:

```tsx
<Table
  data-testid="pinned-table"
  layout="scroll"
  minWidth={840}
  pinning="columns"
>
  <TableHeader>
    <TableRow>
      <TableHead pinned="left" pinnedOffset={0} pinnedEdge>
        대상
      </TableHead>
      <TableHead>상태</TableHead>
      <TableHead>담당</TableHead>
      <TableHead pinned="right" pinnedOffset={0} pinnedEdge>
        작업
      </TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell pinned="left" pinnedOffset={0} pinnedEdge>
        합성 환자 A
      </TableCell>
      <TableCell>대기</TableCell>
      <TableCell>샘플 담당</TableCell>
      <TableCell pinned="right" pinnedOffset={0} pinnedEdge>
        보기
      </TableCell>
    </TableRow>
    <TableRow data-state="selected">
      <TableCell pinned="left" pinnedOffset={0} pinnedEdge>
        합성 환자 B
      </TableCell>
      <TableCell>진행</TableCell>
      <TableCell>샘플 담당</TableCell>
      <TableCell pinned="right" pinnedOffset={0} pinnedEdge>
        보기
      </TableCell>
    </TableRow>
  </TableBody>
</Table>
```

Add a DOM-only `play` function. It must:

```ts
play: async ({ canvasElement }) => {
  const table = canvasElement.querySelector(
    '[data-testid="pinned-table"]',
  ) as HTMLTableElement | null;
  const container = table?.parentElement;
  const leftCell = table?.querySelector(
    'tbody [data-emr-column-pinned="left"]',
  ) as HTMLTableCellElement | null;
  const rightCell = table?.querySelector(
    'tbody [data-emr-column-pinned="right"]',
  ) as HTMLTableCellElement | null;
  const selectedCell = table?.querySelector(
    'tbody tr[data-state="selected"] [data-emr-column-pinned="left"]',
  ) as HTMLTableCellElement | null;

  if (!table || !container || !leftCell || !rightCell || !selectedCell) {
    throw new Error("Pinned table story did not render the required cells.");
  }

  const initialLeft = leftCell.getBoundingClientRect().left;
  container.scrollLeft = 240;
  await new Promise((resolve) => requestAnimationFrame(resolve));

  if (table.dataset.emrPinning !== "columns") {
    throw new Error("Table did not expose the shared pinning mode.");
  }
  if (getComputedStyle(leftCell).position !== "sticky") {
    throw new Error("Left pinned cell is not sticky.");
  }
  if (getComputedStyle(rightCell).position !== "sticky") {
    throw new Error("Right pinned cell is not sticky.");
  }
  if (Math.abs(leftCell.getBoundingClientRect().left - initialLeft) > 1) {
    throw new Error("Left pinned cell moved during horizontal scroll.");
  }
  if (
    getComputedStyle(selectedCell).backgroundColor ===
    "rgba(0, 0, 0, 0)"
  ) {
    throw new Error("Selected pinned cell has a transparent surface.");
  }
}
```

- [x] **Step 2: Run the story test and verify RED**

Run:

```bash
npx vitest run --project storybook src/components/ui/table.stories.tsx
```

Expected: FAIL because `pinning`, `pinned`, `pinnedOffset`, and `pinnedEdge` do not exist on the shared table primitives.

- [x] **Step 3: Add typed shared pinning props**

In `src/components/ui/table.tsx`, export:

```ts
export type TablePinningMode = "none" | "columns"
export type TablePinnedSide = "left" | "right"

export type TablePinnedCellOptions = {
  pinned?: TablePinnedSide
  pinnedEdge?: boolean
  pinnedOffset?: number | string
}
```

Extend `TableProps` with:

```ts
pinning?: TablePinningMode
```

Extend the head and cell props:

```ts
type TableHeadProps = React.ComponentProps<"th"> & TablePinnedCellOptions
type TableCellProps = React.ComponentProps<"td"> & TablePinnedCellOptions
```

Add a helper that preserves caller style while making the typed pin offset authoritative:

```ts
function getPinnedCellStyle(
  pinned: TablePinnedSide | undefined,
  pinnedOffset: number | string | undefined,
  style: React.CSSProperties | undefined,
) {
  if (!pinned) return style

  const offset = toTableWidth(pinnedOffset ?? 0)

  return {
    ...style,
    ...(pinned === "left" ? { left: offset } : { right: offset }),
  }
}
```

Render shared attributes from `Table`, `TableHead`, and `TableCell`:

```tsx
<table data-emr-pinning={pinning} ... />

<th
  data-emr-column-pinned={pinned}
  data-emr-pinned-edge={pinnedEdge ? "true" : undefined}
  style={getPinnedCellStyle(pinned, pinnedOffset, style)}
  ...
/>
```

Use the equivalent attributes and style call for `<td>`.

- [x] **Step 4: Add shared pinned surface CSS**

Add the following contract next to `.emr-table-surface` in `src/app/globals.css`:

```css
.emr-table-surface[data-emr-pinning="columns"] {
  border-collapse: separate;
  border-spacing: 0;
}

.emr-table-surface[data-emr-pinning="columns"]
  [data-emr-column-pinned] {
  position: sticky;
  isolation: isolate;
  background-clip: padding-box;
}

.emr-table-surface[data-emr-pinning="columns"]
  thead
  [data-emr-column-pinned] {
  z-index: 12;
  background-color: var(--emr-surface-muted);
}

.emr-table-surface[data-emr-pinning="columns"]
  tbody
  [data-emr-column-pinned] {
  z-index: 2;
  background-color: var(--emr-surface-panel);
}

.emr-table-surface[data-emr-pinning="columns"]
  tbody
  tr:hover
  > [data-emr-column-pinned],
.emr-table-surface[data-emr-pinning="columns"]
  tbody
  tr:has([aria-expanded="true"])
  > [data-emr-column-pinned] {
  background-color: var(--emr-surface-hover);
}

.emr-table-surface[data-emr-pinning="columns"]
  tbody
  tr[data-state="selected"]
  > [data-emr-column-pinned] {
  background-color: var(--emr-surface-selected);
}

.emr-table-surface[data-emr-pinning="columns"]
  [data-emr-column-pinned="left"][data-emr-pinned-edge="true"] {
  box-shadow:
    1px 0 0 var(--emr-border-default),
    10px 0 16px -16px
      color-mix(in srgb, var(--emr-text-primary) 55%, transparent);
}

.emr-table-surface[data-emr-pinning="columns"]
  [data-emr-column-pinned="right"][data-emr-pinned-edge="true"] {
  box-shadow:
    -1px 0 0 var(--emr-border-default),
    -10px 0 16px -16px
      color-mix(in srgb, var(--emr-text-primary) 55%, transparent);
}
```

The selected rule must remain after the hover rule so selection stays opaque while hovered.

- [x] **Step 5: Add the TanStack adapter**

Create `src/components/emr/table-pinning.ts`:

```ts
import type { Column } from "@tanstack/react-table"

import type { TablePinnedCellOptions } from "@/components/ui/table"

export function getEmrPinnedColumnProps<TRow>(
  column: Column<TRow, unknown>,
): TablePinnedCellOptions {
  const pinned = column.getIsPinned()

  if (!pinned) return {}

  return {
    pinned,
    pinnedEdge:
      pinned === "left"
        ? column.getIsLastColumn("left")
        : column.getIsFirstColumn("right"),
    pinnedOffset:
      pinned === "left"
        ? column.getStart("left")
        : column.getAfter("right"),
  }
}
```

- [x] **Step 6: Run focused shared verification and verify GREEN**

Run:

```bash
npx vitest run --project storybook src/components/ui/table.stories.tsx
npx eslint src/components/ui/table.tsx src/components/ui/table.stories.tsx src/components/emr/table-pinning.ts src/app/globals.css
npx tsc --noEmit
```

Expected: the story test, lint, and TypeScript all pass. If ESLint reports that CSS is outside its supported file set, rerun the command without `src/app/globals.css` and record that CSS was covered by Storybook/build verification.

- [x] **Step 7: Commit the shared primitive**

```bash
git add src/components/ui/table.tsx src/components/ui/table.stories.tsx src/components/emr/table-pinning.ts src/app/globals.css
git commit -m "fix(ui): centralize pinned table surfaces"
```

---

### Task 3: Migrate Customer Pinning And Align Animal Identity Text

**Files:**
- Modify: `tests/customer.spec.ts`
- Modify: `src/features/customer/components/customer-data-table.tsx`
- Modify: `src/features/customer/components/customer-data-table-column-header.tsx`
- Modify: `src/features/customer/components/customer-table-columns.tsx`

**Interfaces:**
- Consumes:
  - `getEmrPinnedColumnProps`
  - `Table pinning="columns"`
  - `TableHead`/`TableCell` pinned props
- Produces:
  - `CustomerTableColumnMeta.headerLeadingOffset?: number`
  - `CustomerDataTableColumnHeader.leadingOffset?: number`
  - stable `data-customer-column-header-label` measurement hook

- [x] **Step 1: Write the failing opacity and alignment regression**

Extend the existing test named `customer patient table keeps animal identity pinned while data columns scroll`.

Before horizontal scrolling, capture:

```ts
const patientSection = page.getByTestId("customer-patient-table");
const pageHeading = patientSection.getByRole("heading", { name: "동물" });
const searchInput = patientSection.getByPlaceholder("동물 검색");
const animalHeaderLabel = animalHeader.locator(
  '[data-customer-column-header-label="true"]',
);
const animalNameText = animalCell.locator(
  '[data-emr-cell-text-mode="one-line"]',
);
```

Assert the 1900px alignment contract:

```ts
await page.setViewportSize({ width: 1900, height: 1024 });

const [headingBox, searchBox, headerLabelBox, animalNameBox] =
  await Promise.all([
    pageHeading.boundingBox(),
    searchInput.boundingBox(),
    animalHeaderLabel.boundingBox(),
    animalNameText.boundingBox(),
  ]);

expect(headingBox).not.toBeNull();
expect(searchBox).not.toBeNull();
expect(headerLabelBox).not.toBeNull();
expect(animalNameBox).not.toBeNull();
expect(Math.abs(searchBox!.x - headingBox!.x)).toBeLessThanOrEqual(1);
expect(Math.abs(headerLabelBox!.x - animalNameBox!.x)).toBeLessThanOrEqual(2);
expect(Math.abs(animalNameBox!.x - headingBox!.x)).toBeLessThanOrEqual(8);
```

After scrolling `scrollLeft` to 600, hover a non-active row and compare the pinned background with an opaque semantic probe:

```ts
const hoverRow = page.getByTestId("customer-patient-row-patient-mango");
const hoverPinnedCell = hoverRow.locator(
  'td[data-customer-column-key="name"]',
);

await hoverRow.hover();

const [hoverPinnedBackground, expectedHoverBackground] = await Promise.all([
  hoverPinnedCell.evaluate(
    (cell) => getComputedStyle(cell).backgroundColor,
  ),
  page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--emr-surface-hover)";
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }),
]);

expect(hoverPinnedBackground).toBe(expectedHoverBackground);
```

Click the row and assert selected opacity using the same probe pattern with `--emr-surface-selected`.

- [x] **Step 2: Run the customer regression and verify RED**

Run:

```bash
npx playwright test tests/customer.spec.ts --grep "customer patient table keeps animal identity pinned while data columns scroll" --reporter=line
```

Expected: FAIL because the header label hook and alignment offset do not exist, and the hovered pinned cell inherits the translucent row background.

- [x] **Step 3: Replace local sticky styling with the shared contract**

In `customer-data-table.tsx`:

- Remove `CSSProperties` and TanStack `Column` imports that were used only by `getPinnedColumnStyle`.
- Import `getEmrPinnedColumnProps`.
- Delete the local `getPinnedColumnStyle` function.
- Render:

```tsx
<Table
  ...
  pinning={pinningMode === "none" ? "none" : "columns"}
>
```

- Remove the customer-local `borderCollapse`/`borderSpacing` inline style.
- Replace header data attributes and `style={getPinnedColumnStyle(...)}` with:

```tsx
<EmrTableHeaderCell
  {...getEmrPinnedColumnProps(header.column)}
  ...
>
```

- Replace body data attributes, `bg-inherit`, and local sticky style with:

```tsx
<TableCell
  {...getEmrPinnedColumnProps(cell.column)}
  ...
>
```

- For loading rows, pass `pinningMode` into `CustomerTableSkeletonRows` and mark the first data skeleton cell with:

```tsx
{...(pinningMode === "first-data-column" && columnIndex === 0
  ? {
      pinned: "left" as const,
      pinnedEdge: true,
      pinnedOffset: 0,
    }
  : {})}
```

This makes loading rows use the same opaque pinned surface.

- [x] **Step 4: Add the customer identity-header offset**

In `customer-table-columns.tsx`, add:

```ts
headerLeadingOffset?: number;
```

to `CustomerTableColumnMeta`.

Set the animal-name column metadata to:

```ts
headerLeadingOffset: 36,
```

The value is the existing leading visual width: `28px` avatar plus `8px` gap. Do not change the 184px column size or the body cell layout.

In `customer-data-table-column-header.tsx`, add:

```ts
leadingOffset?: number;
```

Apply it to the button:

```tsx
style={{
  marginInlineStart: leadingOffset,
}}
```

Change the common customer-header button horizontal padding from `px-2` to `px-2.5`, and add the stable label hook:

```tsx
<span
  className="min-w-0 truncate"
  data-customer-column-header-label="true"
>
  {label}
</span>
```

Pass the metadata from `CustomerDataTable`:

```tsx
<CustomerDataTableColumnHeader
  ...
  leadingOffset={meta?.headerLeadingOffset}
/>
```

This yields the measured target:

- title/search left edge: approximately `root + 48px`
- animal row-name text: approximately `root + 46px`
- animal header label: approximately `root + 46px`
- guardian header/row text remains approximately `root + 54px`

- [x] **Step 5: Run focused customer verification and verify GREEN**

Run:

```bash
npx playwright test tests/customer.spec.ts --grep "customer patient table keeps animal identity pinned while data columns scroll" --reporter=line
npx playwright test tests/customer.spec.ts --grep "guardian list matches|customer table aligns selection" --reporter=line
npx eslint tests/customer.spec.ts src/features/customer/components/customer-data-table.tsx src/features/customer/components/customer-data-table-column-header.tsx src/features/customer/components/customer-table-columns.tsx
npx tsc --noEmit
```

Expected: both customer pinning/alignment and guardian geometry checks pass.

- [x] **Step 6: Commit the customer migration**

```bash
git add tests/customer.spec.ts src/features/customer/components/customer-data-table.tsx src/features/customer/components/customer-data-table-column-header.tsx src/features/customer/components/customer-table-columns.tsx
git commit -m "fix(customer): align pinned animal identity column"
```

---

### Task 4: Update The Canonical Contract And Complete Verification

**Files:**
- Modify: `docs/design/system/table-density-and-grid-ergonomics.md`
- Modify: `docs/design/system/ui-debt-inventory.md`
- Modify: `docs/work/design-system/DESIGN-SYSTEM-PR-087-shared-table-pinning-surface.md`
- Create: `docs/completed/design/2026-07-28-shared-table-pinning-surface-report.html`

**Interfaces:**
- Consumes: verified shared pinning API and customer migration.
- Produces: durable design-system guidance and decision-oriented completion evidence.

- [x] **Step 1: Promote pinning from a customer exception to a shared contract**

Update `table-density-and-grid-ergonomics.md` so the pinning section states:

```markdown
### Shared Pinned Column Contract

- Use `Table pinning="columns"` whenever one or more header/body cells are fixed.
- Pass typed `pinned`, `pinnedOffset`, and `pinnedEdge` props to shared cells; feature code must not set sticky z-index, edge shadow, or inherited background directly.
- Pinned cells own opaque semantic surfaces for default, hover, selected, header, and loading states.
- Use the single `Table layout="scroll"` overflow owner.
- Keep header labels aligned with the scalar text baseline of their body cells. When a body cell has a leading avatar/icon slot, pass an explicit feature metadata offset rather than shifting the whole column.
- Verify left/right offsets, multiple pinned cells, keyboard focus visibility, loading, hover, selected, and narrow desktop behavior.
```

Keep the customer-specific name width and patient-code ordering below the shared section as an adoption note.

- [x] **Step 2: Update the table debt inventory**

Clarify that:

- shared `Table` now owns typed pinned-cell presentation;
- `EmrDataTable` remains order-specific;
- broad migration is only needed when another table actually adopts pinning.

- [x] **Step 3: Record result evidence**

Set PR-087 to `human_review`, list the exact verification commands/results, and create the Korean HTML report containing:

- request: prevent scrolled text from appearing in pinned cells and align animal identity text;
- shared files changed;
- customer adoption files changed;
- measured alignment before/after;
- tests/build results;
- risks and out-of-scope items;
- no push, PR, merge, deploy, or production change.

- [x] **Step 4: Run the full verification matrix**

Run:

```bash
npm run security:secrets
npm run docs:check
npm run lint
npx tsc --noEmit
npx vitest run --project storybook src/components/ui/table.stories.tsx
npx playwright test tests/customer.spec.ts --reporter=line
npm run build-storybook
npm run build
```

Expected:

- secrets, docs, lint, TypeScript, Storybook story test, customer Playwright, Storybook build, and Next build all pass;
- only already-documented baseline warnings may remain;
- no new browser runtime error is introduced.

- [x] **Step 5: Perform local production-equivalent visual verification**

At the production-equivalent local route and at 1900px, 1280px, and 1024px:

1. Open Customer Management → Animal.
2. Confirm title, search, `동물명` header label, and animal row-name text follow the measured baseline.
3. Scroll horizontally until breed/sex/age values pass underneath the animal-name column.
4. Check default, hover, and selected rows; no scrolled text may appear inside the pinned region.
5. Confirm the pinned separator remains visible.
6. Switch to Guardian; confirm it remains unpinned and visually unchanged.
7. Confirm sort controls, row checkboxes, row actions, and focus rings remain usable.

Capture accepted screenshots for Animal default/hover/selected and Guardian reference.

- [x] **Step 6: Commit the verified documentation**

```bash
git add docs/design/system/table-density-and-grid-ergonomics.md docs/design/system/ui-debt-inventory.md docs/work/design-system/DESIGN-SYSTEM-PR-087-shared-table-pinning-surface.md docs/completed/design/2026-07-28-shared-table-pinning-surface-report.html
git commit -m "docs: close shared table pinning work"
```

## Self-Review Record

- Spec coverage: shared pinning ownership, opaque surfaces, hover/selected/loading behavior, customer migration, identity alignment, guardian preservation, Storybook, Playwright, docs, and browser verification are each assigned to a task.
- Placeholder scan: the plan contains no deferred implementation placeholder.
- Type consistency: `TablePinnedCellOptions`, `getEmrPinnedColumnProps`, `headerLeadingOffset`, `leadingOffset`, and `data-customer-column-header-label` use the same names in all tasks.
- Mutation check:
  - restoring `bg-inherit` fails the hover-surface assertion;
  - removing the header offset fails the 2px header/row alignment assertion;
  - removing sticky offsets fails the shared Storybook scroll assertion;
  - pinning the guardian table fails its existing unpinned assertion.
