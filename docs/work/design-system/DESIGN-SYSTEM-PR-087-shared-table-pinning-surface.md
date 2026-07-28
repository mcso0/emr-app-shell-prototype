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
