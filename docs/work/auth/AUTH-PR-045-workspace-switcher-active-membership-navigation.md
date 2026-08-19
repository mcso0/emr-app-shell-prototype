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
