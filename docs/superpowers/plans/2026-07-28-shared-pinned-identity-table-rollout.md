# Shared Pinned Identity Table Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Keep the RED → GREEN evidence for every behavior change.

**Goal:** Give every in-scope customer and hospital-admin Order table one opaque pinned identity column, one horizontal scroll owner, and one exact identity text axis shared by the page header and table.

**Architecture:** Keep `Table` as the low-level scroll and sticky-cell owner. Add an EMR-level pinned workspace wrapper and identity-content primitives so feature code supplies only its local inset and identity content. Customer patient, guardian, and archive screens opt into the same customer inset; hospital-admin Order uses `표준 Order명` as the first pinned data column through its single shared renderer. Archive UI consumes the existing workspace archive GET/PATCH routes and preserves server permission enforcement.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, TanStack Table, Zustand, Playwright, Vitest/Storybook.

## Approved Decisions

- The hospital-admin pinned identity column is `표준 Order명`.
- Customer archive includes restore, mutation permission, and failure-state handling.
- Completion covers all 15 Order leaf screens rendered by the shared Order table.
- Horizontal overflow belongs only to `data-slot="table-container"`.
- Work is split into three review/commit units: shared contract, customer rollout, hospital-admin Order rollout.
- This implementation run does not push, create a PR, merge, or deploy.

## Scope Boundary

In scope:

- Shared pinned workspace, identity-axis, opaque sticky-cell, and header-top-padding contracts.
- Customer patient, guardian, and deleted guardian/patient screens.
- Existing customer archive list and restore API wiring, including read/mutation permission and failure states.
- Hospital-admin Order table used by all 15 Order leaf screens.
- Focused tests, docs, closeout report, lint, typecheck, builds, and responsive browser verification.

Intentionally out of scope:

- Hospital-admin audit, membership, role, space, vital, schedule, drawer-summary, or concept tables.
- New data-grid dependencies or replacement of TanStack Table.
- New archive schema, migration, destructive delete, or real customer data.
- Remote push, PR, merge, Vercel deployment, or remote Supabase mutation.

## Task 1: Register the follow-up work item and shared contract test

**Files:**

- Create: `docs/work/design-system/DESIGN-SYSTEM-PR-088-pinned-identity-table-rollout.md`
- Modify: `docs/work/index.md`
- Modify: `src/components/ui/table.stories.tsx`

1. Add a focused Storybook interaction assertion that uses a shared identity axis, scrolls the table, and proves:
   - the pinned identity cell stays at the container edge;
   - its surface is opaque;
   - the header and row identity text share the same x coordinate;
   - the table container is the horizontal overflow owner.
2. Run:
   - `npx vitest run --project storybook src/components/ui/table.stories.tsx`
3. Confirm the new assertion fails because the shared pinned workspace/identity API does not exist.

## Task 2: Implement the shared pinned workspace and identity axis

**Files:**

- Modify: `src/components/emr/table-primitives.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/components/ui/table.stories.tsx`
- Modify: `docs/design/system/table-density-and-grid-ergonomics.md`
- Modify: `docs/design/system/component-ownership-rules.md`

1. Add `EmrPinnedTableWorkspace` with a typed `identityTextInset` prop that sets the inherited CSS custom property and the shared inspection attribute.
2. Add an identity mode to `EmrTableHeaderCell`.
3. Add `EmrTableIdentityCellContent`, including an optional leading visual slot whose width and gap do not move the identity text axis.
4. Add shared CSS for:
   - exact header/body identity text positioning;
   - 0px top padding on opted-in pinned workspace headers;
   - inherited footer/header alignment;
   - existing opaque pinned-cell surfaces in normal, hover, selected, and loading states.
5. Run the Storybook test and confirm GREEN.
6. Run focused lint/typecheck for the touched shared files.
7. Commit as the shared-contract review unit.

## Task 3: Add failing customer patient/guardian alignment and pinning tests

**Files:**

- Modify: `tests/customer.spec.ts`

1. Replace the old guardian-unpinned assertion with a guardian pinned-identity assertion.
2. Assert patient and guardian:
   - use the shared pinned workspace contract;
   - have 0px header padding-top;
   - align title, search outer edge, pinned header text, pinned row identity text, and footer total on the same x axis;
   - keep the pinned header/body opaque while horizontally scrolled at 1900, 1440, 1280, and 1024px;
   - expose only the table container as horizontal overflow owner.
3. Run the focused tests and confirm RED against the current guardian and alignment behavior.

## Task 4: Migrate patient and guardian to the shared contract

**Files:**

- Modify: `src/features/customer/components/customer-data-table.tsx`
- Modify: `src/features/customer/components/customer-data-table-column-header.tsx`
- Modify: `src/features/customer/components/customer-table-columns.tsx`
- Modify: `src/features/customer/components/customer-table-cell-content.tsx`
- Modify: `src/features/customer/components/customer-list-header.tsx`
- Modify: `src/features/customer/components/customer-data-table-footer.tsx`
- Modify: `src/features/customer/module.tsx`

1. Wrap the customer table workspace in `EmrPinnedTableWorkspace` with the existing 48px page inset.
2. Remove customer-local `headerLeadingOffset`.
3. Render patient avatar/name and guardian name through `EmrTableIdentityCellContent`.
4. Mark the first data header as the shared identity header and keep the custom customer sort control keyboard behavior.
5. Explicitly pin guardian `name` as the first data column.
6. Apply the shared 0px header-top contract and shared footer axis without viewport-specific CSS.
7. Run the focused customer tests and confirm GREEN.

## Task 5: Add failing archive list, permission, failure, and restore tests

**Files:**

- Modify: `tests/customer.spec.ts`
- Modify: `tests/customer-soft-delete-restore-server.spec.ts`

1. Add UI route fixtures for:
   - successful soft-deleted record list;
   - empty list;
   - list permission denial;
   - list server failure and retry;
   - restore success;
   - restore permission denial;
   - restore server failure.
2. Assert the archive table uses the shared pinned identity and alignment contract.
3. Assert restore sends `PATCH` with `{ "action": "restore" }` to the target-specific existing archive route.
4. Add a server permission regression proving the prepared Cheongdam demo workspace is covered by the archive permission adapter while unknown/cross-workspace access remains denied.
5. Run the focused tests and confirm RED because the deleted screen is still a local empty state.

## Task 6: Implement archive table and restore state

**Files:**

- Create: `src/features/customer/components/customer-archive-table.tsx`
- Modify: `src/features/customer/module.tsx`
- Modify: `src/features/customer/store.ts`
- Modify: `src/features/customer/server-customer-archive-core.ts`

1. Load `/api/workspaces/:workspaceId/customer/archive?status=soft_deleted` with the existing demo actor header when available.
2. Keep archive state workspace-scoped and expose the loaded count to the customer side panel.
3. Render loading, ready rows, empty, filtered empty, no-permission, and retryable read-error states.
4. Render `displayName` as the first opaque pinned identity column, followed by target, deleted time, actor, and restore action.
5. Restore through the existing guardian/patient archive `PATCH` route, disable only the pending row action, remove the restored record after success, and update the side count.
6. Surface mutation denial and retryable failure without discarding the loaded archive list.
7. Extend only the demo archive permission adapter for the prepared Cheongdam demo workspace; do not weaken `patient:view`/`patient:update` enforcement.
8. Run customer UI and server archive tests and confirm GREEN.
9. Commit as the customer review unit.

## Task 7: Add failing Order pinning and single-scroll-owner tests

**Files:**

- Modify: `tests/hospital-admin.spec.ts`

1. Assert `표준 Order명` is the first data column and is pinned left.
2. Assert selection and `유형` scroll beneath the opaque pinned identity cell.
3. Assert title, pinned header text, and pinned row identity text share the 20px Order workspace axis.
4. Assert the Order title section uses 0px padding-top.
5. Assert `data-slot="table-container"` is the only horizontal overflow owner.
6. Exercise every one of the 15 Order leaf navigation items and assert the same pinned renderer remains active.
7. Cover default, hover, selected, loading, keyboard focus, and 1900/1440/1280/1024px behavior.
8. Run the focused tests and confirm RED against the unpinned current table.

## Task 8: Migrate the shared hospital-admin Order renderer

**Files:**

- Modify: `src/features/hospital-admin/module.tsx`

1. Wrap only the Order content in `EmrPinnedTableWorkspace` with the existing 20px page inset.
2. Reorder the rendered columns to:
   - pinned `표준 Order명`;
   - selection;
   - 유형;
   - remaining existing columns;
   - actions.
3. Apply typed pinned props to the standard-name header, rows, and loading skeletons.
4. Remove the outer `ScrollArea`; give the shared `Table` container the sole horizontal/vertical overflow responsibility.
5. Apply the shared identity header and row-content primitives.
6. Preserve search, filters, sorting, density, selection, drawer, create, duplicate, pause, empty, fallback, and permission behavior.
7. Run the focused hospital-admin tests and confirm GREEN.
8. Commit as the hospital-admin review unit.

## Task 9: Documentation, closeout, and final verification

**Files:**

- Modify: `docs/design/system/table-density-and-grid-ergonomics.md`
- Modify: `docs/work/design-system/DESIGN-SYSTEM-PR-088-pinned-identity-table-rollout.md`
- Create: `docs/completed/design-system/2026-07-28-pinned-identity-table-rollout-report.html`

1. Record the final shared contract, customer archive boundary, Order leaf coverage, and explicit exclusions.
2. Run focused verification:
   - `npx vitest run --project storybook src/components/ui/table.stories.tsx`
   - `npx playwright test tests/customer.spec.ts --reporter=line`
   - `npx playwright test tests/customer-soft-delete-restore-server.spec.ts --reporter=line`
   - `npx playwright test tests/hospital-admin.spec.ts --reporter=line`
3. Run repository verification:
   - `npm run lint`
   - `npx tsc --noEmit --pretty false`
   - `npm run docs:check`
   - `npm run security:secrets`
   - `npm run build-storybook`
   - `npm run build`
4. Perform responsive visual QA at 1900, 1440, 1280, and 1024px for customer patient, guardian, archive, and representative Order states.
5. Re-read this plan line by line, inspect `git diff --check`, and record any remaining caveat.
6. Do not push, open a PR, merge, or deploy in this run.
