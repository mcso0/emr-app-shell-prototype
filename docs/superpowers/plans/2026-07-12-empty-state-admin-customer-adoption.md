# Admin And Customer Empty State Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved CDS.V2 empty-state size contract to missing customer-management and hospital-admin states without changing loading, permission, error, or queue-specific contracts.

**Architecture:** Reuse `EmrEmptyState` at existing table/list boundaries. Use `size="md"` for large table bodies (`mg` in product language), `size="sm"` for nested cards/drawers, and keep the schedule's full-workspace `lg` decision limited to its true empty branch. Feature code owns copy and state classification; the shared component owns visual tokens and geometry.

**Tech Stack:** Next.js client components, React, TypeScript, `EmrEmptyState`, Playwright.

## Global Constraints

- Preserve unrelated user changes in the root checkout.
- Do not replace loading, permission, read-failure, or feature-placeholder states with passive empty states.
- Reuse existing CLAiR alpha/text tokens through `EmrEmptyState`; add no new color tokens or dependencies.
- Keep customer initial-read skeleton behavior unchanged.

---

### Task 1: Add red regression coverage for the affected screen states

**Files:**
- Modify: `tests/customer.spec.ts`
- Modify: `tests/audit-review-surface.spec.ts`
- Modify: `tests/hospital-admin.spec.ts`

- [x] Add assertions for the deleted-customer empty state, including the no-query and search-filter copy branches.
- [x] Add an audit-log empty-row assertion using a route response with zero events.
- [x] Add explicit `data-size="md"` assertions for the existing customer/order table empty states where the seeded/demo route can reach them.
- [x] Run the focused tests and confirm the new assertions fail before implementation.

### Task 2: Adopt the shared state in customer and hospital-admin tables

**Files:**
- Modify: `src/features/customer/module.tsx`
- Modify: `src/features/hospital-admin/module.tsx`
- Modify: `src/features/auth/workspace-membership-management.tsx`

- [x] Replace `DeletedCustomerContent`'s raw centered text with `EmrEmptyState surface="table" size="md"`, switching between `no-data` and `no-filter-results` from `query`.
- [x] Make existing customer and Order table adoption explicit with `size="md"` and stable test IDs where needed.
- [x] Replace the audit-log raw empty table cell with `EmrEmptyState size="md"`, while keeping loading, denied, and error branches unchanged.
- [x] Replace both responsive member-directory empty branches with the same shared `EmrEmptyState size="md"` contract and state classification.

### Task 3: Adopt compact states in nested hospital-admin surfaces

**Files:**
- Modify: `src/features/hospital-admin/settings/hospital-operating-hours-editor.tsx`
- Modify: `src/features/hospital-admin/schedule/hospital-schedule-screen.tsx`
- Modify: `src/features/hospital-admin/role-permission-management/screen.tsx`

- [x] Use `EmrEmptyState size="sm"` without icon/action reservation for empty exception schedules, assigned-role members, personal requests, and staff-detail pending requests.
- [x] Use the approved `lg` content tier only for the schedule `empty` branch if it owns the full schedule workspace; keep loading, error, and read-only branches local.
- [x] Add focused assertions for the compact settings state and schedule-related contracts where the existing routes can reach them.

### Task 4: Update source-of-truth work tracking and verify

**Files:**
- Create: `docs/work/design-system/DESIGN-SYSTEM-PR-073-empty-state-admin-customer-screen-adoption.md`
- Modify: `docs/work/index.md`
- Modify: `docs/design/system/empty-info-state-contract.md`

- [x] Record the adopted screen inventory, size mapping, and intentional exclusions.
- [x] Run focused Playwright tests, TypeScript, lint, docs check, and a production build when dependencies are available.
- [x] Review the diff for unrelated files before commit.

### Task 5: Publish the verified branch

- [ ] Commit only the isolated worktree changes.
- [ ] Push the feature branch.
- [ ] Open a ready pull request with verification evidence.
- [ ] Merge the pull request into `origin/main` only after the PR is created and checks are verified.
