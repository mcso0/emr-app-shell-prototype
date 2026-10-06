---
id: APP-SHELL-PR-003
status: human_review
area: app-shell
priority: P1
target_pr: codex/sidebar-hover-preview -> main; Production delivery approved
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
4. Retain a preview while its focus, IME input, drag or owned popup is active. Escape closes a child popup first, then preview and restores trigger focus. Outside click closes preview and continues the original click. Navigation, workspace/tab/session change, active drawer, global modal, blur and hidden document cancel it.
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
