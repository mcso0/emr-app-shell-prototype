---
id: "WORKSPACE-TABS-PR-003"
status: "human_review"
area: "app-shell"
priority: "P1"
updated: "2026-10-12"
source_docs:
  - "docs/completed/design/2026-10-11-workspace-tab-reorder-proposal.html"
  - "docs/engineering/architecture/app-shell-layout-contract.md"
  - "docs/work/app-shell/WORKSPACE-TABS-PR-002-workspace-surface-independence.md"
dependencies: []
---

# Workspace Tab Drag Reorder

## Authorization And Scope

승욱 approved the proposal direction, reuse of existing dnd-kit, and local implementation on 2026-10-11, explicitly preserving tab selection, closing and persistence. Parent orchestrates; implementation workers use GPT-6.1 Sol with max reasoning as requested. On 2026-10-12, 승욱 explicitly excluded the tab organizer. Remove its button, panel, movement controls and in-panel undo; keep drag sorting. 승욱 then requested Chrome/Codex-style equal tab shrink to available width with a minimum. Use component-local 80px minimum and existing 148px preferred/maximum; overflow only beyond minimum capacity. On 2026-10-12, 승욱 requested investigation and correction of the remaining runtime/test failures and re-verification of both chart navigation cases for release preparation. This item records that request; it does not grant new permission for remote delivery, external issue writes or data changes.

Duplicate search: PR-001 records shipped tabs, PR-002 owns work-surface independence, and DESIGN-SYSTEM-PR-040 owns topbar chrome. None covers drag reorder; keep those scopes intact.

## Plan

1. Update the Korean HTML proposal with the approved library direction and scope before editing app code.
2. Add dnd-kit sorting to WorkspaceChromeTabs, with mouse threshold, cancellation and scroll containment. Exclude the organizer and undo per the revised scope.
3. Pass ordered IDs through WorkspaceTabsBar and AppShell to a guarded reorderTabs(workspaceId, orderedTabIds) store action.
4. Preserve tab objects, active ID, route history, close fallback, sessionStorage and debounced server persistence. Never navigate or save editors on reorder.
5. Validate store invariants, app-shell regressions, interactive stories, TypeScript, lint and docs links.

## Non-Goals

No tab organizer, button-based reorder, undo, new dependencies, common Button/Tabs changes, DB/API/auth policy changes, patient data mutation, inactive-screen keep-alive, pinning/grouping, cross-window dragging, mobile tabbar redesign, real-time cross-device synchronization, release or merge.

## Local Verification Boundary

Use synthetic fixtures only. Unit tests mock fetch; dedicated browser reorder tests intercept tab-session GET/PUT. Existing app-shell checks use the local mock-auth session and synthetic clair-demo workspace. No live Supabase write or production browser action is part of verification. Existing account-switch/session cleanup policy is preserved, not redesigned or certified by this change.

## Acceptance

- Valid drops reorder only the full current tab ID set within the current workspace.
- Same-order, foreign-workspace, missing, duplicate or stale IDs are no-ops with no writes.
- Active tab, URL, draft input and per-tab histories survive reorder.
- Click/select, close/new, per-tab back/forward and reload restore retain their behavior.
- Escape, pointer cancellation, window blur and outside drop do not commit an order.
- The organizer and undo are absent. Keyboard focus navigation and selection remain; keyboard and touch reordering are outside this revised scope.
- Moderate tab counts shrink equally from 148px toward a local 80px minimum without overflow. Larger counts overflow only after the minimum is reached; add and right-side chrome stay visible. Existing mobile hiding remains.

## Implementation

WorkspaceChromeTabs uses the installed dnd-kit packages for mouse drag, insertion feedback, bounded autoscroll and cancellation. Tabs shrink with available width from 148px to a local 80px minimum; titles truncate and close controls remain visible. New or restored active tabs scroll into view without changing focus. Reorder does not trigger editor saves or navigation.

WorkspaceTabsBar and AppShell pass the ordered IDs to the guarded store action. No dependencies, shared component APIs, auth, DB or remote persistence endpoints changed. Five existing test queries now find the new-tab button outside the tablist, consistent with its semantics.

## Verification

Local checks on 2026-10-12 for the revised drag-only scope:

- `npx vitest run --config vitest.frontend-refresh.config.ts tests/workspace-tabs-store.test.ts`: 20 passed. Covers identity/history preservation, one write, invalid/stale/no-op rejection, reordered close fallback, save serialization, session restore and HTTP failure fallback. The store did not change when the organizer was removed.
- Storybook MCP `run-story-tests` on port 6139: Default, ModerateTabs, ManyTabs and SingleTab passed through a fresh Storybook MCP session after both scope changes. All four Vitest story tests also passed. Default verifies actual pointer drag, retained memo value/focus and no removed controls; ModerateTabs verifies equal shrink without overflow; ManyTabs verifies the 80px minimum, internal overflow, keyboard selection and active new-tab visibility; SingleTab preserves the final-tab boundary. No exhaustive accessibility certification is claimed.
- Playwright drag/width suite: **8 passed** against the clean production-mode mock build. Pointer reorder, retained DOM/input/URL/history, exactly one local and debounced server write, browser/mock-server restore, four cancellation paths, reordered close, equal shrink, 80px minimum/internal overflow and control visibility passed. All page-error assertions remained enabled and passed; the earlier `Invalid or unexpected token` did not reproduce. Its original development-server cause was not established, so no claim of a specific production source fix is made. Error collection now retains stack traces for future diagnosis.
- Existing workspace-tab Playwright regressions: **8 passed**, including both chart navigation cases. After correcting the stale 148px CSS minimum assertion to the approved 80px minimum, while also asserting the roomy two-tab rendered width remains 148px, the final default Turbopack production-build run passed **all 16 browser tests together in 34.6s**. No assertions were removed and timeouts were not increased.
- Both isolated production builds passed: `NEXT_PUBLIC_AUTH_MODE=mock NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack` and the default `npm run build` with the same synthetic auth environment. The default build and its 16-test browser run are the final evidence. The disposable copy needed physical dependency files because Turbopack rejects a node_modules symlink outside its project root; application configuration was unchanged. One unrelated file-tracing warning points from the existing docs viewer to next.config.mjs; compilation, type checking and all 23 static pages succeeded.
- Chart tests now await the selected `chartId` URL normalization before navigation and await active tab/route completion between successive clicks. Inspection confirmed the existing save guard rejects navigation if chart initialization changes the route during the awaited editor flush. Preserve that production guard; synchronize the test with observable readiness.
- Validation-harness diagnosis: adding the omitted PostCSS config after an initial build left cached CSS without utilities. A clean rebuild generated `.flex`, `.size-4` and the 80px rule, resolving the harness-only invisible-checkbox and geometry failures. These are not product source fixes.
- `npx tsc --noEmit`: passed after the final test corrections. Full `npm run lint`: 0 errors, five existing warnings in unrelated wp10 scripts; changed tests also passed focused ESLint. `npm run ux-copy:check` and `npm run security:secrets` passed.
- HTML demo script syntax, removed-control absence, new-tab creation, six-tab shrink, ten-tab minimum overflow and actual pointer reorder: passed after the final scope changes; updated screenshot reviewed.
- `npm run docs:check`: passed, 1107 docs/agent Markdown files checked. `git diff --check` also passed.
- Actual app screenshots reviewed: `output/playwright/workspace-tabs-reorder.png` and `output/playwright/workspace-tabs-reorder-shrink.png`.

The existing real-auth server on port 3000 was preserved. App browser verification used a disposable mock-auth source copy on port 6138 without live env files. That server and its disposable build files/configuration were removed after verification; `next-env.d.ts` remained unchanged. Storybook on port 6139 and the standalone proposal on port 6137 remain available for local review.

## Review Links

- [Updated interactive proposal](../../completed/design/2026-10-11-workspace-tab-reorder-proposal.html)
- [Default story](http://localhost:6139/?path=/story/shell-workspace-chrome-tabs--default)
- [Moderate tabs story](http://localhost:6139/?path=/story/shell-workspace-chrome-tabs--moderate-tabs)
- [Many tabs story](http://localhost:6139/?path=/story/shell-workspace-chrome-tabs--many-tabs)
- [Single tab story](http://localhost:6139/?path=/story/shell-workspace-chrome-tabs--single-tab)

## Release Preparation

Local implementation and relevant browser checks are ready for human acceptance. The final investigation changed tests only; the approved production tab implementation remains intact. Keep this local preparation distinct from an exact remote release candidate.

- Included scope: four production files (`workspace-chrome-tabs`, `workspace-tabs-bar`, `app-shell`, `workspace-tabs-store`), their story and three test files, the app-shell layout contract, this work item, its index row and the requested HTML proposal. Keep unrelated `.codex/config.toml`, `AGENTS.md`, DESIGN-SYSTEM-PR-109 and other pre-existing index edits outside the release slice.
- Current checkout: `codex/design-system-main-baseline-20261006`, base HEAD `247d21dde86547c4c2ac3c7941af49b29df09a42`. These uncommitted changes are not an exact PR candidate. Remote `main` was read directly as `3f814f4c59d488e4d51c8a01eb44543e29a387f7` on 2026-10-12. It is one commit ahead, containing PR #961 migration/docs only; none of this change’s production/test files differ upstream. Before authorized delivery, create a scoped candidate against fresh `origin/main`, preserve that migration and WIP, and recheck integration.
- Remaining remote gates: scoped commit/PR head SHA, Ready Vercel Preview and the manually dispatched combined `Release Check` for that exact SHA. Local passing checks do not substitute for them.
- Preview/production smoke plan: `/login`, authorized synthetic workspace tab selection/close/new, inactive drag preserving URL/input, reorder refresh restore, shrink/overflow and visible add/notification controls. Authenticated production smoke requires an approved synthetic session; no real patient data mutation is included.
- Rollback plan: record the current Ready Production deployment and `origin/main` SHA immediately before the exact-candidate approval. Revert the scoped merge or redeploy that recorded prior deployment within rollback authorization. There is no data migration to reverse; persisted sessions keep the existing shape.
- Stop if candidate SHA changes, Preview or Release Check fails/is unknown, unrelated WIP enters the slice, or smoke requires unapproved real-data writes.

The local-verification stage performed no remote delivery. 승욱 then explicitly approved committing/pushing only this slice, opening a PR and verifying Preview plus Release Check on 2026-10-12. Main merge and Production remain pending exact-candidate approval. After Preview and exact-candidate checks exist, the release skill requires 승욱's explicit approval of that candidate, production action, smoke and rollback. Human acceptance, live account switching and real remote persistence are not claimed.

## PR Preview Preparation

Approved delivery branch: `codex/workspace-tabs-reorder`, isolated from the original dirty checkout and based on `3f814f4c59d488e4d51c8a01eb44543e29a387f7`. Only the approved source/story/test/documentation paths and this item’s index row enter the candidate. Existing configuration, agent guidance, PR-109 planning, other index edits and screenshots stay in the original checkout. The PR description and approval packet record the final commit SHA, exact Release Check, Preview and rollback evidence after candidate creation.

Clean candidate preflight: secret scan (4694 tracked files), docs links (1065 Markdown files), UX copy, full lint (0 errors; the same five unrelated warnings), TypeScript, default Turbopack build, 20 store tests and four Storybook tests passed in the isolated checkout. The build retains the existing docs-viewer file-tracing warning. No application source differs from the previously verified implementation.

Pre-merge baseline checked on 2026-10-12: Production deployment `dpl_DpmWFrmAD6xsCJt5TGZwGZfQhj13` is Ready and its Git source equals current `main`, `3f814f4c59d488e4d51c8a01eb44543e29a387f7`. Use it as the proposed rollback baseline, reconfirm immediately before an approved merge, and obtain authorization before any rollback mutation.

All 16 focused Playwright cases passed together in 38.8s on that isolated default production build, including both chart navigation cases and the unchanged page-error assertions. Synthetic-only fixture and mocked tab-session boundaries were preserved. The local verification server was stopped afterward.

During final remote verification, main advanced to `6e946bab55d624057587df080d5e4bf1349d1b4a` (PR #962 patient-context loading skeletons). The scoped commit was rebased without conflicts to include that upstream behavior before final candidate checks. No upstream file is added to this PR diff; the candidate’s Preview and Release Check must be rerun for its new SHA.

Main subsequently advanced to `7feef5b5df9edd3f4a74c728b974c940c3bc32e1` (PR #963 Storybook caller alignment). Rebase preserved its app changes and stories. The two newly added WorkspaceChromeTabs/WorkspaceTabsBar callers need the required reorder callback, so this PR adds five lines to their existing synthetic fixture: update local tab order and record the callback. This compatibility file brings the final scoped diff to 13 files; no unrelated PR #963 implementation is included in the diff. Verify WorkspaceTabs and WorkspaceControls caller stories along with the four dedicated drag stories and focused app suite before the final remote candidate check.
