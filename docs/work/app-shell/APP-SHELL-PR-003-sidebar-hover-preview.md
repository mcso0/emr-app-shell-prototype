---
id: APP-SHELL-PR-003
status: human_review
area: app-shell
priority: P1
target_pr: codex/sidebar-panel-interactions-fix -> main; exact candidate preparation
updated: 2026-10-06
source_docs:
  - docs/design/system/side-panel-header-contract.md
---

# Collapsed navigation rail sidebar preview

## Approval and baseline

승욱 approved the interactive HTML and requested origin/main research, a plan, then implementation on 2026-10-06. Preserve every existing module sidebar element, structure, icon position, spacing and style. Menu activation must not pin. The approved requirement also covers moving between a rail trigger and its floating panel, switching previews, existing tooltips and explicit navigation.

Implementation uses origin/main `9ef8e51d9ae8eedaadf2c01c688349d1f648c7c2` (#940) in the attached `codex/sidebar-hover-preview` worktree. The initial #939 baseline advanced during validation; the isolated worktree was rebased to #940 and the existing patient grouping controls were preserved. Primary checkout WIP stays untouched. APP-SHELL-PR-001 concerns tabs and APP-SHELL-PR-002 concerns internal document panels; neither owns this change.

## Existing-code research

- The original module page remounts AppShell on foreign-module navigation, which resets local sidebar state on explicit pin. Move the existing AuthGate and AppShell into the workspace layout; AppShell reads the current module from its existing pathname hook. Preserve access checks and reset the sidebar scope on workspace/session/tab changes.
- `ShellMain` owns the navigation column and 288px outer sidebar host. `ModuleDefinition.sidePanel` already owns each module's sidebar JSX. Reuse that component; change its outer presentation only.
- `EmrSubpanelTitle` already puts the 24px collapse button to the right inside the 56px header with 16px horizontal padding. Preserve this structure and styling; vary the callback and accessible label in a floating presentation.
- AppShell synchronizes `modulePanel` with the existing layout store. NavRail links already preserve modifier-click and navigation context. Remove the implicit pin normalization on sidebar-less destinations; keep explicit `open`/`closed` state across navigation.
- Some panel hooks assume the current URL or auto-select the first record. Supply a scoped route for foreign previews and suppress automatic selection while hidden or foreign. A deliberate row action still follows the existing route/action flow and preserves pin preference, including Reception’s legacy chart route that otherwise requests `modulePanel=open`.
- Reception/Chart read coordinators and Customer/Hospital Admin bootstrap reads originally belong to main content. Use their existing workspace-scoped GET paths for visible foreign previews. Preserve server permission enforcement, error UI and late-result guards. Refresh foreign queues on each preview entry; visible Chart previews use the existing queue subscription and Reception previews use the existing 60s visible refresh. Stop both when hidden and invalidate pending reads on exit.
- Base UI Popover/Menu/Dialog portal outside the host. Identify their owning panel so focus and Escape work correctly; close owned popups when a cached panel hides.

## Implementation plan and behavior

1. Keep persisted layout state separate from a transient preview module. Desktop mouse hover opens after 120ms; exit closes after 220ms. A 20px hit bridge covers the existing rail inset/gap. Do not resize main content for a preview.
2. Preserve each visited sidebar instance within one workspace/session/tab scope. Float-to-pin retains local input, group and scroll state. Hidden instances are inert; workspace/session/tab changes clear this cache.
3. Hover another available sidebar menu changes preview only. Clicking or pressing Enter on a menu navigates and preserves pin state. Rail top expand pins the current page. The existing right header button pins the previewed module; a foreign preview's explicit pin navigates with `modulePanel=open`. A canceled duplicate-tab dialog must leave the current page unpinned.
4. Retain a preview while focused editing, keyboard interaction, IME input, drag or an owned popup is active. Residual focus on a mouse-clicked button must not block switching or closing. Deliberate mouse movement resumes hover behavior while editing/IME and open-popup protection remain active. Escape closes a child popup first, then preview and restores trigger focus. Outside click closes preview and continues the original click. Navigation, workspace/tab/session change, active drawer, global modal, blur and hidden document cancel it.
5. Keep existing search/unavailable-menu tooltips. ArrowRight opens a keyboard preview; Enter remains navigation. Disable automatic preview for touch/compact screens. At widths below 768px, explicit expand uses the same unchanged sidebar in a 288px modal sheet with focus containment and Escape/backdrop dismissal. Reduced motion disables movement.

## Boundaries

No sidebar JSX redesign, new visual tokens/dependencies, DB/API/RLS/policy changes, data mutations on hover, real-data actions or public publication. Existing authorized data actions inside a sidebar retain their own current gates. 승욱 explicitly requested commit, push, PR, origin/main merge and approved deployment on 2026-10-06. This authorizes delivery of this reviewed feature through the release gates; the work item records that approval and grants no additional data/settings scope.

## Verification

Completed local verification on the final implementation:

- 40 selected Playwright cases passed: 20 new preview cases, 8 existing patient queue cases, 7 existing shell/navigation cases and 5 existing auth/access cases. Coverage includes unchanged content geometry and URL on hover, all nine available sidebars, menu navigation without pin, explicit current/foreign pin, stable DOM/input/patient view across pin, popup Escape order, focus return, disabled/search tooltips, tab cancellation, touch/compact layout, drag suppression, operating-date changes, same-date refresh, late responses, workspace switching, login/logout and access denial.
- `NEXT_PUBLIC_AUTH_MODE=mock npm run build -- --webpack` passed, including TypeScript. Changed tracked and untracked TypeScript/TSX files passed ESLint.
- TypeScript AST comparison against `9ef8e51d9ae8eedaadf2c01c688349d1f648c7c2` confirmed unchanged sidebar JSX structure, text and non-event props for all nine module sidebar entry components and EmrSubpanelTitle. The intentional floating accessible label and action are excluded. Stylesheets and visual tokens have no diff. Browser geometry checks confirm 288px width, the 56px header and the existing right-side 24px button with 16px inset.
- Existing test fixtures were corrected without changing product visuals: the header expectation now uses origin/main's existing neutral-400 color; Home navigation now expects the approved collapsed preference; the inactive-workspace auth case explicitly requests its test workspace rather than assuming the independently changed login default.
- Documentation links, Korean UX copy, tracked/untracked secret scan and whitespace checks passed.

Focused preview/queue browser fixtures intercept API calls and do not write a database. Additional auth/shell cases use local mock-auth and session/demo state. Native browser inspection confirmed the existing Reception sidebar in a floating host. The mock screen retains its existing server-read permission feedback because no production credentials or DB connection were copied. At the implementation checkpoint, Production/Supabase UI and realtime service delivery were not exercised. Release evidence follows below. No migration, provider action or environment/alias setting change belongs to this release.

## Review and recovery

The attached `codex/sidebar-hover-preview` worktree contains only this local implementation; the primary checkout remains untouched. Review the existing sidebar in collapsed, floating and docked states. 승욱 accepted the local result and requested delivery. Before merge, the branch can be discarded without changing Production. After merge, use the recorded prior deployment or a reviewed revert PR.


## Approved release preparation

- User authorization: "다했으면 커밋, 푸시, 피알, 오리진-메인에 머지. 배포 승인" on 2026-10-06. Target is this feature's PR to main and the automatic Vercel Production deployment. No unrelated WIP is included.
- Current main: `9ef8e51d9ae8eedaadf2c01c688349d1f648c7c2`.
- Current Ready Production and rollback candidate: `dpl_FChrXHYQanZ5aQS8KHrfq7qccXYp`, source `9ef8e51d9ae8eedaadf2c01c688349d1f648c7c2`; official alias `emr-app-shell-prototype.vercel.app`.
- Environment source: existing Vercel project settings; no environment variable or credential changes.
- Completed release preflight: default `npm run build`, `npx tsc --noEmit`, full `npm run lint` (0 errors; 5 pre-existing warnings in unrelated WP10 scripts), secrets, documentation links, Korean UX copy, whitespace and sidebar-preservation checks passed. The final runtime content also passed the 40 focused cases above. Exact-head manual Release Check and Ready Preview remain required before merge; their final evidence is recorded in the PR.
- Production action: squash merge the scoped PR with expected-head protection.
- Smoke: `/login`, workspace access redirect and browser console/network; if an existing authenticated session is available, inspect Reception preview, navigation and explicit pin using read-only synthetic-workspace UI. No clinical/data mutation is requested.
- Stop conditions: candidate changes, failed/unknown required checks, Preview not Ready, unexpected Production source, missing rollback evidence, secret exposure or required route smoke failure.


## Follow-up: mouse button focus regression (2026-10-06)

PR #941 shipped the initial hover feature at main `455e55071c257b3e167da71370b158ef3b4f9eb0`, Ready Production `dpl_GbBPhEw96yQNoHCHSHjcLT7EUK3V`. The user reported that filtering or another sidebar action prevents subsequent menu previews. 승욱 explicitly authorized "수정 하고 배포해" for this regression on 2026-10-06.

Reproduction on that deployed source used an isolated mock-auth browser with every API request intercepted. Selecting and closing a filter, or toggling an ordinary queue group, leaves focus on its trigger. ShellMain treated any owned focus as an active interaction. Other menu hover kept the old sidebar and pointer exit could not close it. Two focused regression cases fail on the pre-fix code. No DB action was sent by the reproduction.

The correction is confined to ShellMain: distinguish pointer-button focus from keyboard interaction and focused editable controls. Existing popup ownership, IME, drag, Escape ordering and focus restoration remain in place. No sidebar JSX, visual prop, stylesheet, component, API, permission, environment or dependency changes belong to this correction. Add coverage for filter/group actions, repeat hover, state retention, keyboard-to-mouse switching and focused search/IME.

Release path: `codex/sidebar-hover-focus-fix` -> exact-head Release Check and Ready Preview -> expected-head squash merge to main -> Ready Production and official-alias source verification. The current Ready deployment above is the rollback candidate. Smoke is `/login` plus read-only synthetic Cheongdam filter/group-menu dismissal and preview/navigation inspection if the existing authenticated browser remains available. No clinical workflow action, payment/checkout action, remote settings or DB change is authorized. Final candidate/check/deployment/smoke evidence is recorded in the follow-up PR.


Follow-up local validation: all 24 sidebar Playwright cases passed (20 existing and 4 added). The two reported mouse paths failed before the correction and pass afterward, including switching to a different sidebar, closing outside, reopening and retained filter/group state. Keyboard-to-mouse handoff, focused search/IME and the existing search Escape sequence also pass. Full local lint passes with 0 errors and 5 pre-existing WP10 script warnings. A TypeScript AST extraction confirms the full ShellMain return JSX is byte-identical to `455e5507`; module/sidebar/components/styles/framework/dependency files have no diff. Secrets, docs, UX copy and whitespace checks pass. Default build, standalone types, exact-head remote check and final deployment evidence are recorded in the follow-up PR.


## Follow-up: date, controls and failure states (2026-10-06)

승욱 approved implementation after the deployed-sidebar audit, then requested resume. Scope: retain floating date navigation; restore functional filter/sort choices; keep repeat hover working after actions; distinguish queue errors/denials from empty results; replace only the floating header glyph with a tilted pin. Existing sidebar structure, header position, card elements, size, colors, tokens and initial row order remain the visual contract. No database, API/RLS, provider, payment, environment or dependency change is included.

Baseline research used main `24485eeae2c971868b2fb6eac0736f7edf6fa802` (#943). The isolated worktree preserves primary-checkout WIP. Main advanced to `9a16bf0d3e29cff17bdf1ea900db88f8ecea9deb` (#936) during validation; that commit adds four unrelated chart-save test files and changes no product code. The final rebase also includes main `475d69136fb6179c7fa4cda353383b369d6d154f` (#944), whose approved task-card status badge/footer changes are retained without modification.

Confirmed causes and corrections:

- ShellMain treated every query update as an exit; queue date callbacks also used the ordinary navigation/close path. Separate panel-date changes from explicit navigation. Current dates retain existing URL/store behavior; foreign dates use the cached panel route only, with no current operating-date mutation. Cached preview dates persist when reopening under the same main navigation context.
- Reception/Billing and Lab/Imaging order-mode filter/sort buttons were placeholders. Reuse the existing radio menus and apply filters/sorting to projected rows inside the unchanged status groups. Preserve source order until explicit sort selection. Parse timestamps numerically. Lab/Imaging unresolved live assignee labels sort by existing assigned user identity, without injecting mock names or displaying IDs; known labels still sort by name. Billing assignee sorting uses only its existing local display-name map; the queue API has no assigned-user field, so it does not offer the unassigned filter.
- Radio selections kept the owned portal open. Close only the queue single-choice items on selection. Retain multi-select and generic menu behavior.
- Raw-zero queues disabled active filters. Keep controls available until the existing active condition can be cleared. Reception distinguishes filter-zero from raw-zero with an existing empty-state clear action.
- Failed/denied queue reads previously fell through to empty/cached presentation. Use existing shared failure feedback before grouped/normal cards; retry the scoped selected date for retryable reads. HTTP401/403 is denial even when the body is HTML. Existing workspace/date request guards remain in place.
- Only floating header glyph/accessible label changes to pin/-20 degrees/`사이드 패널 고정`. Docked glyph, 56px header, right-side 24px button, 16px SVG/inset and neutral-400 color remain unchanged.

Verification uses synthetic browser API fixtures only. The pre-fix current and foreign date cases failed; both pass after separation. Shared Storybook tests cover floating-to-docked glyph/geometry, cached-card suppression on failures, retry, denial without retry and popup closure. Final local and exact-candidate release evidence is recorded below or in the follow-up PR. Production remains subject to the existing exact-candidate release gate.


Local validation: the 92-case sidebar/queue suite passed. After the controlled-menu value correction and fixture hardening, the four affected functional-control cases pass individually; a new date-picker portal/reopen/foreign-pin case also passes. Nine shared Storybook browser cases pass. Numeric timestamp ordering, initial source order, identity-based unassigned filtering, filter clearing on an empty date, HTML denial, retry, retained pin/input DOM and late A-B-C/A-B-A reads are covered. Final integrated candidate secrets/docs/UX-copy/whitespace checks, full lint (0 errors; five pre-existing WP10 warnings), standalone TypeScript and default build passed. Exact candidate and remote Release Check are recorded in the PR. Stylesheets, tokens and dependencies have no diff. Local mock browser images contain only synthetic fixtures. Production/browser authentication and provider delivery are separate release checks.
