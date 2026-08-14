---
id: "HOSPITAL-ADMIN-LIVE-PR-020"
status: "human_review"
area: "hospital-admin"
priority: "P0"
target_pr: "User-approved persisted workspace space management"
source_docs:
  - "docs/product/features/hospital-admin/hospital-admin-settings-hub-plan.md"
  - "docs/design/screens/hospital-admin/hospital-admin-settings-hub-ux.md"
dependencies:
  - "HOSPITAL-ADMIN-PR-002"
updated: "2026-07-25"
---

# Persisted Workspace Space Management

## Goal

Replace the static `공간/시간 관리` concept with a live `공간 관리` screen that lets authorized hospital administrators manage workspace-scoped space categories and spaces.

## Scope

- Rename all visible navigation and screen copy to `공간 관리`.
- Category overview with distinct semantic icons, count badges, and navigation chevrons.
- Header `카테고리 설정` dialog with inline category add/rename and protected deletion.
- One category detail depth with direct space add/rename/move/delete actions.
- Sonner feedback for every successful or rejected mutation; cancel has no toast.
- Workspace API, Supabase tables, archive-based deletion, atomic RPC commands, RLS, explicit grants, seeds, and audit events.
- Session-scoped mock gateway for demo-header mode and Supabase gateway for authenticated sessions.
- Existing shadcn/Base UI, EMR, CDS icon, and token contracts only; no new dependency.

## Out Of Scope

- Operating hours, appointment intervals, blocked times, emergency slots, and any other time setting.
- Capacity, allocation mode, active/inactive status, equipment, department, and scheduling policy.
- Drag ordering or downstream chart/reception/appointment/inpatient space-selector adoption.
- Hard deletion, real customer data, remote migration application, deployment, or release actions.

## Product And UX Contract

- The top-level screen shows categories only; spaces appear after entering one category.
- `카테고리 설정` is the only category-management entry.
- Category add and rename replace the active row with an inline input and actions.
- Category deletion with spaces requires a target category. All spaces move and the source category archives atomically.
- Space rows are terminal and use labeled edit/trash icon actions instead of chevrons.
- Loading, read error/retry, category/space empty, read-only, pending, and conflict states remain explicit.

## Data And Permission Contract

- `workspace_space_categories` and `workspace_spaces` are tenant-bound and archive-aware.
- Active category names are case-insensitively unique per workspace; active space names are unique per category.
- `hospital_settings:view` permits reads and `hospital_settings:manage` permits commands.
- The route verifies session identity, loads live workspace permissions, rate-limits commands, and never accepts workspace/actor ownership from the request body.
- Direct authenticated table writes are not granted; the security-definer command RPC rechecks membership and manage permission.
- Audit snapshots contain identifiers and space/category metadata only.

## Done When

- Category and space create/update/move/delete return an authoritative workspace snapshot.
- Non-empty category deletion moves every active space or changes nothing.
- Cross-workspace access is rejected or isolated by the permission and RPC boundaries.
- Focused model, migration, server/API, and browser interaction tests pass.
- ESLint, TypeScript, build, docs, secret scan, and diff checks pass or expose a precisely documented environment blocker.

## Verification

- `npx playwright test tests/hospital-space-management-model.spec.ts tests/hospital-space-management-server.spec.ts tests/hospital-space-management-migration.spec.ts --project=chromium --reporter=line`
- `npx playwright test tests/hospital-admin.spec.ts --project=chromium -g "space management|settings hub opens" --reporter=line`
- `npx eslint src/features/hospital-admin/space-management 'src/app/api/workspaces/[workspaceId]/hospital-admin/space-management/route.ts' src/features/hospital-admin/module.tsx tests/hospital-space-management-*.spec.ts tests/hospital-admin.spec.ts`
- `npx tsc --noEmit`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Implementation Result

- Added strict snapshot/command parsing and a scoped mock/Supabase gateway boundary.
- Added category/space tables, active-name indexes, default data, member-read RLS, server-owned writes, atomic command RPCs, archive behavior, and six audit event types.
- Replaced the static concept with the approved category overview, settings dialog, terminal detail actions, confirmations, and result toasts.
- Added browser coverage for successful CRUD, rejected duplicates, populated-category moves, read error recovery, empty read-only state, and compact-screen use.
- Removed the former space/time concept entry and every visible time-management label and control.
- Matched the CDS V2 category overview, category detail, and zero-category
  states from Figma nodes `27804:32814`, `27804:116703`, and `27804:117918`.
- Preserved the existing workspace-scoped CRUD contract while changing the
  screen to a `920px` summary surface with `85px` headers/rows, `44px` category
  icons, labeled detail actions, and the direct empty-state add CTA.

## Verification Result

- 14 focused model, migration, server, and route tests passed.
- 5 focused browser flows passed, including complete category/space CRUD, result toasts, protected category deletion, error recovery, and a `720px` compact layout.
- TypeScript, targeted ESLint, production build, docs links, secret scan, and `git diff --check` passed.
- The migration applied to local Supabase. An admin read/write probe succeeded and rolled back, while a front-desk write, cross-workspace read, and direct authenticated table insert were rejected.
- Local database lint no longer reports findings for the new space-management function. It still reports existing findings in unrelated chart, reception, and lab functions.
- A broader hospital-admin run completed with 46 of 47 tests passing. The remaining existing basic-settings test still waits for the obsolete `대표 전화 *` accessible label; the same known mismatch is documented in the 2026-07-22 role-permission closeout and is outside this change.
- The 2026-07-25 CDS V2 follow-up passed 20 focused UI, model, server, route,
  migration, permission, and responsive tests. Targeted ESLint, TypeScript, and
  `git diff --check` also passed.

## Current Boundary

- The persisted space-management base is present on `origin/main`; the CDS V2
  follow-up is implemented in the isolated
  `codex/hospital-space-management-cds-v2` worktree.
- No API, schema, RPC, RLS, seed, audit, dependency, or shared component API
  change was required for the Figma follow-up.
- Commit, pull-request, and merge evidence for the CDS V2 follow-up is tracked
  in the associated GitHub history. No remote migration, environment, alias, or
  manual deployment action is part of this follow-up.
