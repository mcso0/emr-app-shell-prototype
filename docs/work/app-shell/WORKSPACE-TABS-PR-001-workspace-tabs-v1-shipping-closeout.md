---
id: "WORKSPACE-TABS-PR-001"
status: "human_review"
area: "app-shell"
priority: "P0"
target_pr: "Workspace Tabs v1 shipping closeout"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/app-shell/APP-SHELL-PR-001-workspace-tabs.md"
dependencies: []
updated: "2026-10-11"
---

# Workspace Tabs V1 Shipping Closeout

## Goal

Prepare the first workspace-tabs implementation for review by separating shipping evidence from new feature work.

## Context

The original `APP-SHELL-PR-001` covered session-only workspace tabs. The current implementation now also includes server-backed tab restore, duplicate work-surface warnings, mobile tablist hiding, and SOAP stale-save conflict protection.

This closeout records the shipped scope and verification evidence instead of adding another product feature.

## Checkout Finding

- Actual checkout: `/Users/iseung-ug/project/emr-app-shell-prototype`
- Uppercase path `/Users/iseung-ug/Projects/emr-app-shell-prototype`: not present in this environment.
- Current branch before closeout work: `main`
- `main` and `origin/main` were aligned and clean before this docs-only closeout branch.

## Shipped Scope Classification

Workspace tabs:

- `WorkspaceTab` identity fields: `surfaceType`, `surfaceId`, `dedupeKey`, `lastRoute`, `updatedAt`.
- Server tab session route: `GET` and `PUT /api/workspaces/:workspaceId/app-shell/workspace-tabs`.
- Server session core and Supabase gateway.
- Duplicate work-surface warning dialog with existing-tab navigation, continue-current-tab, and hide-warning preference.
- Mobile tablist hidden while preserving tab history controls.
- App Shell route normalization race guard and server-restore race guard.

SOAP conflict guard:

- `expectedUpdatedAt` passed into SOAP note save.
- RPC conflict parameter `p_expected_updated_at`.
- Stale save response: `409 soap_note_conflict`.
- Chart UI preserves current input and shows conflict guidance.

Tests and migrations:

- Workspace tabs server-session Playwright coverage.
- SOAP note persistence conflict coverage.
- App Shell focused workspace-tab regression coverage.
- Workspace tab session migration.

## PR Unit Decision

Safest review unit: keep this as one shipped capability review named **Workspace Tabs v1 + SOAP conflict guard**.

Rationale:

- The duplicate-tab warning and SOAP conflict guard are coupled by the same user risk: opening the same clinical surface in multiple logical tabs.
- Splitting after landing would create artificial review boundaries without lowering runtime risk.
- Future conflict handling outside SOAP remains a follow-up, not a reason to block this first shipping closeout.

## Explicit Non-Goals

- No mobile workspace tab UX beyond hiding the desktop tablist.
- Duplicate access is not blocked; users can switch to the existing tab or continue in the current tab.
- SOAP conflict guard does not yet cover every chart/order/billing mutation.
- This closeout does not claim full launch readiness, remote Supabase replay, or production monitoring.

## Verification Evidence

Latest local verification recorded during closeout:

- Passed: `npx tsc --noEmit`
- Passed: `npm run docs:check`
- Passed: `npx eslint src/stores/workspace-tabs-store.ts tests/app-shell.spec.ts`
- Passed: `npm run lint` with 0 errors and 11 warnings
- Passed: `npx playwright test tests/app-shell.spec.ts --grep "workspace tabs keep navigation history per active tab" --timeout=90000 --reporter=line`
- Passed: `npx playwright test tests/app-shell.spec.ts --grep "workspace tabs|workspace tab chrome" --timeout=90000 --reporter=line`
- Passed: `npx playwright test tests/workspace-tabs-session-server.spec.ts --reporter=line`
- Passed: `npx playwright test tests/chart-soap-note-persistence-server.spec.ts --reporter=line`

## Remaining Risks

- Full App Shell Playwright suite was not re-run as part of this closeout.
- Production browser smoke against the Cheongdam Vercel deployment remains recommended after merge.
- SOAP conflict protection should be extended to other high-risk clinical/billing mutations in later scoped work.

## Closeout Report

- `docs/completed/app-shell/2026-06-25-workspace-tabs-v1-shipping-closeout-report.html`


## 2026-10-11 Local Lifecycle Follow-up

### Authorization and scope

The user approved the minimal tab-performance plan: protect pending saves first, remove duplicate tab-transition reads, and release unused resources while preserving existing behavior and WIP. Authorization covers local implementation and validation only. Commit, push, PR, merge, deployment, remote data writes, and production acceptance are excluded.

### Implementation

- Shell navigation flushes registered chart editors before changing the active surface. Failed saves keep the editor mounted; repeated clicks share one pending navigation. Cancelling the duplicate-tab dialog invalidates its pending navigation.
- `ShellMain` remains mounted for the workspace/session. The destination route commits the content/panel reset, preventing an outgoing lab screen from remounting during new-tab navigation. Inactive-tab close does not navigate or flush the current editor.
- Fulfillment consumers share pending reads by workspace/date/queue/item. Explicit refresh supersedes older reads. Final unsubscribe aborts pending reads and evicts cache; hidden panels stop date timers and queue subscriptions while preserving their filters.
- Lab detail slots share their provider. An out-of-date selected result uses the existing exact-item RPC path, with optional `workItemId` forwarded through the API and permission-checked reader. Invalid IDs fail validation rather than broadening the read. No SQL, migration, role, or permission policy change.
- Tab saves skip unchanged state, retain the browser session on HTTP failure, and serialize per workspace. Initial state cannot overwrite a slow server restore; restored tabs are persisted even when their active route is unchanged.

### Verification boundary

Validation uses an isolated local production build and synthetic browser fixtures without environment files or hosted credentials. Clinical writes in browser save tests are intercepted. Measurements are local browser evidence, not production database/load measurements. Existing unrelated WIP remains in the working tree. Human acceptance remains pending.

### Local measurement (before / after)

| Scenario | Before | After |
| --- | --- | --- |
| 10 lab-tab activations, with 5/10/20 restored tabs | 40 fulfillment GETs (20 dated + 20 undated) | 10 dated fulfillment GETs |
| Lab → new home tab | 4 outgoing lab reads started again | 0 outgoing lab reads |
| Leave lab with a deliberately slow read | Outgoing reads completed on home | Shared read cancelled with `net::ERR_ABORTED` |
| Mixed 5-module cycle, then close to 1 tab | Hidden treatment panel retained; 5 minute timers | Only lab panel retained; 4 minute timers |
| 1/5/10/20 tabs idle for 10 seconds | 0 API reads | 0 API reads |

All measured after cases kept one workspace content frame and reported no page errors. The normal lab screen now has four date timers because its shared detail provider also owns a date selection; the count stays constant across tab counts and returns to four after the mixed cycle. Heap totals are not presented as a proven leak fix or production capacity result. Tab metadata still scales with open tabs; this change adds no arbitrary tab/history cap.

The selected-result browser probe made one dated queue read and one exact-item read. Local API probes returned 200 for an unknown valid UUID (empty result), and 400 for invalid/empty `workItemId`.

### Check results

- `vitest.frontend-refresh.config.ts`: 16 passed, including unchanged-route no-op, serialized save, HTTP failure/session restore, workspace separation, and slow server restore.
- Focused Playwright callback/server-contract checks: 49 passed (queue coalescing/abort/eviction/late response, exact-item forwarding/validation, lab receipt loading/denial, order-save characterization, tab-session source boundary).
- Local production browser/API regression: 64 of the 65 selected cases passed across the main run and focused reruns. The remaining existing visual assertion expects a 48px navigation rail, while both HEAD and the current `emr-foundation.css` define 52px. No token or geometry change was made for that mismatch.
- The three initially failing behavioral assertions were corrected in their fixtures: date navigation distinguishes queue reads from scoped result/history reads; paused-clock inactive close uses keyboard activation; duplicate-dialog cancellation asserts tab/URL, saved encounter/quantity, and preference persistence. Focused reruns passed (9 cases plus 1 cancellation case).
- Duplicate cancellation coverage is specifically tab navigation and save ownership. The existing chart sidebar calls `selectEncounter` before the shell duplicate decision; this follow-up does not change that chart selection path or claim to verify its patient-display behavior after cancellation.
- TypeScript passed. Isolated production build passed. Full lint: 0 errors, 5 pre-existing unused-variable warnings in the WP10 scripts; changed-file lint passed. Documentation links and `git diff --check` passed.
- The initial temporary regression configuration omitted the mock login storage state; it was corrected before the results above. No login-related product change was made.

No commit or deployment was performed. Runtime performance in an authenticated production workspace and human acceptance remain unverified.

## 2026-10-11 Scoped Release Authorization

The user subsequently authorized committing/pushing only this lifecycle follow-up, creating its PR, merging to `origin/main`, and deploying, with post-deployment tab/save smoke. The release uses a separate worktree; unrelated configuration, work-index, design-system, and Storybook WIP are excluded.

- Base: `6c8503f7b8b19673ac00a8c652def292b6210f59`.
- Pre-release Ready Production rollback candidate: `dpl_46avH3aVpoQrGQkS56WCR9LwZ5Xz`.
- Scope: 16 files covering the shell/queue/store changes, their tests/configuration, and owning documentation. No dependency, SQL, migration, RLS, role, provider, billing, or attachment change.
- Required candidate gates: local secrets/docs/UX-copy/lint/type/build and focused tests, exact-head remote Release Check, Ready Preview, then exact-head-protected squash merge.
- Smoke: `/login`, authenticated prepared synthetic Cheongdam lab, create/switch/close workspace tabs, and a temporary synthetic overall-finding marker followed by restoration of the original value and reload readback. This save-only smoke creates normal immutable edit history; no clinical result values, order status, charges, attachments, or real data are changed. Slow/failed chart-order saves remain covered by isolated intercepted tests.
- Stop for failed/unknown required checks, unexpected candidate changes, non-Ready deployment, or a failed scoped smoke. Rollback promotion or a new corrective release requires a separate decision; the previous Ready deployment is recorded as the rollback candidate.

Release identifiers and final remote evidence are reported after the checked candidate is created. Prior local-only statements above describe the earlier implementation checkpoint, not this subsequent approval.


## 2026-10-12 Hosted tab persistence repair

The user explicitly authorized repairing workspace-tab persistence in the same hosted synthetic/demo Supabase used by Production and validating authenticated save/reload from the local app. Scope is the missing user-owned navigation table, its existing self/member RLS contract, explicit authenticated SELECT/INSERT/UPDATE grants, and focused verification. No clinical data mutation, application deployment, main merge, canonical role changes, or credential exposure is authorized or required.

Preflight: the table and original migration version are absent remotely; the existing timestamp trigger and private active-member helper are present. Current local application GET/PUT return 500. The existing migration omits explicit table grants, while current default privileges do not guarantee authenticated SELECT/INSERT/UPDATE. Use an additive forward repair migration and preserve all existing data.

Repair applied to the shared hosted project with `workspace_tabs_session_remote_repair`, recorded locally in `supabase/migrations/20261012040006_workspace_tabs_session_remote_repair.sql`. The existing schema/self-member policies were reused; explicit authenticated SELECT/INSERT/UPDATE and no anon access remove dependence on default privileges. No application code or production deployment changed.

Verified from the authenticated local app: PUT returned 200; DB readback contained reception/home tabs and a valid selected home tab. Reload retained both tabs/selection. A fresh browser tab, without the first tab's sessionStorage, also restored both tabs and the selected surface. The temporary home tab was closed and reception restored. Catalog checks confirmed RLS, self/member SELECT/INSERT/UPDATE policies, authenticated grants, and denied anon reads. A rollback-only non-member authenticated query confirmed no visible rows.

Focused static route/migration contract passed (1 test). The full 4-test server suite could not start its isolated mock server because Next.js allows only one dev server per checkout; it was not run against the live Supabase. Real authenticated save/readback/refresh/fresh-tab checks supply the hosted behavior evidence. Lint/build are not required for this SQL-only repair; application TypeScript is unchanged. Human review remains pending; no commit/push/merge was performed.


### Repository delivery authorization

After accepting the repair verification, the user requested committing and pushing only the repair migration and this verification record, creating a PR, and merging it into `origin/main`. Delivery runs exact-candidate Release Check and Ready Preview gates. No additional remote DB apply is needed: the hosted repair is already applied. The previous implementation-only statements above describe the earlier checkpoint. Post-merge smoke checks Production `/login` and the unchanged local authenticated tab persistence path; clinical writes remain excluded.
