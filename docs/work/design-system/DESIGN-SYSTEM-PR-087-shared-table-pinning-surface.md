---
id: "DESIGN-SYSTEM-PR-087"
status: "human_review"
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

## Result

- Shared `Table`, `TableHead`, and `TableCell` now own typed left/right pinning attributes, offsets, stacking, edge shadows, and opaque semantic surfaces.
- `getEmrPinnedColumnProps` adapts TanStack column state without coupling the low-level table primitive to TanStack.
- The customer animal table no longer calculates sticky styles locally or uses `bg-inherit`; loading rows use the same shared pinned-cell contract.
- The animal header uses the existing 28px avatar plus 8px gap as a metadata-driven 36px leading offset.
- At 1900px, title/search measured at x=419 and animal header/row text both measured at x=417. The previous 38px header-to-row mismatch is now 0px.
- At 1900px, 1280px, and 1024px, the pinned header stayed within 1px of the scroll container and document overflow remained 0px.
- The guardian table remains unpinned; the shared header padding changed from 8px to 10px to align header labels with its existing 10px row-content inset.

Verification completed on 2026-07-28:

- Secret scan: passed, 3480 tracked files checked.
- Docs check: passed, 886 docs checked.
- ESLint and TypeScript: passed.
- Shared Table Storybook test: 5/5 passed.
- Customer Playwright suite: 15/15 passed.
- Storybook build: passed with existing missing-MDX, Pretendard resolution, lottie eval, and chunk-size warnings.
- Next build: passed with the existing NFT tracing warning.
- Local visual QA: default, hover, selected, loading, guardian, 1900px, 1280px, and 1024px states passed.

No dependency, data, API, permission, Supabase, push, PR, merge, deployment, or production-state change was made.

Result report:

- `docs/completed/design/2026-07-28-shared-table-pinning-surface-report.html`
