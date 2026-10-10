# AUTH-PR-045 Workspace Switcher Active Membership Navigation

Status: implemented
Area: auth
Priority: P1
Date: 2026-08-19
Source: Browser comment and approved workspace-switcher implementation report

## Goal

Turn the display-only App Shell workspace switcher into an active-membership picker that changes workspace context without carrying tenant-scoped clinical identifiers.

## Scope

- Open an anchored workspace picker from the existing App Shell trigger.
- Read persisted active memberships from `GET /api/workspaces`.
- Preserve browser-state fallback for mock and locally created workspaces.
- Mark the current workspace and show role context.
- Add search when the active workspace list reaches five items.
- Cover loading, read-failure, retry, single-workspace, desktop, and narrow states.
- Switch to the same module with layout-only URL state while removing patient, encounter, order, invoice, and other tenant-scoped identifiers.
- Fall back from hospital administration to home when the target membership is not `hospital_admin`.
- Confirm before switching when an existing App Shell dirty-state contract reports unsaved work.

## Out Of Scope

- No public hospital or workspace directory.
- No self-service join request or membership mutation.
- No new invitation lookup API or pending-invitation inbox.
- No regular-user workspace creation entry point.
- No remote Supabase operation, migration, environment change, or role-policy change.

## Source Docs

- `docs/engineering/auth-security/auth-login/workspace-membership-list-live-read.md`
- `docs/engineering/auth-security/auth-login/invite-only-b2b-saas-launch-architecture.md`
- `docs/product/domain/workspace-auth-permissions.md`
- `docs/design/qa/interaction-accessibility-audit.md`

## Dependencies

- Existing verified-session `GET /api/workspaces` active-membership reader.
- Existing `AuthGate` workspace access verification.
- Existing shared `Popover`, `Command`, `EmrPopoverShell`, and confirmation dialog primitives.

## Done When

- The switcher opens and lists only current-user active workspace memberships.
- Current selection, role context, search, loading, error, retry, and single-workspace states are understandable.
- Workspace navigation cannot carry tenant-scoped entity query parameters.
- Unsupported hospital-admin access falls back to the target workspace home.
- Supported unsaved-state contracts block immediate switching and require confirmation.
- Existing switcher geometry and narrow App Shell behavior remain intact.
- Focused lint, typecheck, Playwright, docs, secret, diff, and build checks pass.

## Verification

- `npm run lint`: passed on the clean `origin/main` release candidate.
- `npx tsc --noEmit --pretty false`: passed.
- `npx playwright test tests/workspace-list-server.spec.ts tests/app-shell.spec.ts -g "workspace list|workspace switcher" --reporter=line`: passed, 14 tests.
- `npm run docs:check`: passed.
- `npm run security:secrets`: passed.
- `git diff --check`: passed.
- `npm run build`: passed. The existing broad project NFT tracing warning from `src/lib/prd-viewer/doc-reader.ts` remains unrelated to this change.
- Baseline note: `tests/auth.spec.ts` test `hospital admin can create and select a route-backed workspace` still reaches the correct onboarding screen but exceeds its 5-second heading assertion. The same failure reproduces on an unmodified `origin/main` worktree, so it is not part of this switcher diff.

## Result

The App Shell switcher now opens an accessible active-membership picker with current selection, role context, conditional search, loading, fallback, retry, and narrow-viewport behavior. Switching keeps only layout state, removes tenant-scoped entity context, revalidates access through the existing route guard, and sends non-admin target memberships from hospital administration to workspace home.

The browser-state `currentWorkspaceId` is updated only when the current mock user has an active membership in the selected locally persisted workspace.

## Handoff

- Korean closeout: `docs/completed/auth/2026-08-19-auth-pr-045-workspace-switcher-report.html`
- 승욱 requested publication through a scoped PR and `origin/main`; the release changes application code only and does not mutate remote data or environment configuration.
- Public discovery, join requests, pending invitation discovery, and regular-user workspace creation remain a separate product/security slice.

## Local Follow-up: Chart Flush Before Switching (2026-10-10)

The initial local verification below used a prepared non-Git snapshot based on `9181430e47b3e269fa9a4b6b30403e324394a809`. Publication is prepared separately on current main `5bfd0bdaa0af6821449165fdb5a0344437968f33`; this record does not claim Production delivery.

- The App Shell picker awaits the existing `useChartStore.flushEditors()` contract before changing the selected workspace in browser storage or pushing the target route. Existing SOAP, diagnosis, and order-save guards remain the owners of save success or failure.
- While that flush is pending, repeated selections share the first request. A failed or conflicted flush leaves the current workspace and chart edits intact. Existing notification/settings dirty flags are cleared only after a successful confirmed switch.
- A workspace, actor, or module change invalidates an old switch request. Request identity also prevents a canceled confirmation or a late old completion from navigating or clearing a newer request.
- Canceling with **Continue Writing**, closing the confirmation, or pressing Escape cancels the pending navigation. It does not roll back a chart save that has already started. A newly confirmed switch can reuse that editor's pending save.
- The final synthetic React/Chromium matrix passes 22 tests, including debounce-before-switch, saves during editing, repeated picks, 503 retry, 409 reload, rapid transitions, late 200/503/409 ownership, dirty confirmation, and cancellation. Each test blocks unexpected browser traffic and reports at most one concurrent save per owner; no unexpected traffic or page errors were observed.
- Related order unit/characterization checks pass 77 tests. Focused lint, full no-emit TypeScript checks, and internal documentation links pass.
- The existing picker/list suite passes 11 of 14 tests. Its target-route, narrow popover click, and outdated narrow navigation-label failures also reproduce before this product diff; those tests and unrelated UI are unchanged.
- A credentials-free mock `next build --webpack` passes, including compilation, TypeScript, and 23 static pages. Webpack accommodates the preserved dependency symlink in this snapshot; this is not hosted verification or a production-environment/Turbopack build.

The picker is the navigation boundary covered by this change. Browser history and direct navigation are not globally intercepted; late-owner regression tests deliberately use real SPA history to exercise the existing save-session protections. Synthetic checks do not establish production/Supabase/RLS behavior or a real patient-data loss incident. Membership, permission, API, database, and canonical role policies are unchanged.

## Publication Scope (2026-10-10)

The publication candidate contains six files: App Shell, the synthetic save-session fixture, workspace save-session and switch-flush browser specs, their Playwright configuration, and this work item. The prior workspace-session test patch is a required test prerequisite and is included in those same six files. Product code and test/configuration files match the verified snapshot byte for byte.

PR #951's confirm/history harness change and the separate atomic-confirmation test patch are excluded. They are not runtime or browser-test dependencies. The earlier 77-test result used both and must not be represented as validation of this publication candidate. The clean candidate's focused unit run covers the four unchanged autosave-boundary, save-failure ownership, draft-save-operation, and draft-response-merge suites (59 tests).

The three existing picker failures remain disclosed above; their prior baseline reproductions are retained. No unrelated picker or UI changes are included. Production delivery still requires the exact candidate Release Check, Ready Preview, and the repository's Production approval gate. Planned post-merge smoke is unauthenticated `/login` only; no clinical writes or remote DB/RLS operations are authorized by this follow-up.

Clean-candidate synthetic Chromium verification: 22/22 passed (no skips or retries). The initial run was 21/22 because an existing late-read test captured `Router action dispatched before initialization`; that same test then passed three isolated repetitions and the full unchanged 22-test rerun passed. The initial error remains recorded; it was not suppressed.
