---
id: "HOME-PR-014"
status: in_progress
area: home
priority: P0
target_pr: "User-approved Home implementation and production delivery"
source_docs:
  - "docs/product/features/home/home-operations-work-status-contract-v0.md"
  - "docs/engineering/data-model/home-operations-work-status-read-model.md"
dependencies:
  - "HOME-PR-012"
updated: "2026-09-08"
---

# Home Workspace And Personal Work

## Goal

Implement the approved Home prototype using existing EMR components: hospital board/list and independent personal assigned/requested views with correct source identity, dates, navigation and user/workspace-scoped UI preferences.

## Approval And Boundaries

승욱 approved implementation, commit, push, PR, merge to origin/main and deployment on 2026-09-07 in this task. Scope is this Home work bundle, existing synthetic/demo source integration, scoped shared-component extension and destination selection. Preserve server permissions and workspace isolation. No real data, source business writes, new reviewer/approval workflow, fixed staging alias/settings changes or external messages are implied. On 2026-09-08 승욱 additionally approved the Home read-only RPC migration on the existing demo Supabase target after authenticated Preview exposed revoked source-table SELECT grants. Follow release preflight and exact-candidate gates; this record does not independently grant permission.

Base: origin/main d6ad0664; isolated codex/home-workspace-delivery checkout. Primary checkout and its unrelated WIP are preserved.

## Scope

- Reuse existing header, module sidebar, task card, row menu, data table overlay, date navigator, filter/button/input, state icon and feedback components.
- Home sidebar: 원내 현황, 내 업무; 인박스/메시지 disabled 예정. Rail tooltip 홈 화면.
- Hospital board/list, multiselect owners/work types, reset only owner/type, hidden column restoration, collapsible columns/groups and independent personal queries.
- Card body has no action; overflow source action. Lists show a token-based hover surface and existing gradient action overlay.
- Date by scheduled processing time, fallback requested time, previous unfinished, latest state, opt-in completed.
- Personal assignment uses actor identity; team unassigned excluded. Actor-requested work includes unassigned. Include supported personally assigned review/approval work without inventing source tasks.
- Exact source navigation and return state. Browser-local persistent display preferences keyed by user/workspace, per-session query state.
- Read contract/source parity and error/partial/permission/empty distinctions. Current patient count must not be inferred from work item counts.

## Out Of Scope

Home business actions, inbox/messages, SLA policy, real external integrations/data, general task assignment/approval authoring, cross-device preferences, unrelated clinical defaults WIP, new UI library.

## Done Criteria And Verification

- Shared components render the accepted interaction; card body noninteractive and existing card consumers unchanged.
- Server tests cover dates, personal/request identity, team unassigned, read failures, source permissions and exact source identifiers.
- Browser tests cover both views, filters, hide/collapse/restore, independent queries, keyboard actions, correct task navigation, return/new-session state and workspace/user isolation.
- Existing Home source parity checks remain meaningful; obsolete detail-panel expectations are replaced with new contract checks.
- Production candidate passes focused checks, local lint/typecheck/build/docs/secrets, exact Release Check, preview readiness and scoped smoke. Record PR/candidate/merge/deployment/smoke/rollback separately.

## Implementation Evidence

- Uses shared header/sidebar, queue cards, multiselect controls and table action overlay. Shared card selection is optional; existing selected/unselected consumers retain behavior. Disabled sidebar labels can show 예정.
- Hospital board/list and independent assigned/requested lists use per-user/workspace display preferences and per-session queries; sign-out clears transient Home state.
- Server computes per-source permissions before reads and rechecks source/workspace before counts. The new permission-gated, paginated Home source snapshot and existing guarded fulfillment reader replace the application's legacy aggregate call.
- Reception is projected from the authoritative encounter when its queue already points to consultation. Operational staff assignments remain separate from the primary veterinarian; multiple assignees are supported. The snapshot includes authoritative assignment arrays, including cancelled sources.
- Scheduled/requested dates remain distinct. Carry-over links use the work's own effective date and exact source ID. Billing requires a real billing candidate anchor.
- Current patient statistics are distinct current encounters, independent of selected work date. No inpatient persistence is invented.

## Local Verification — 2026-09-08

- 19 focused Playwright tests passed: Home UI/session isolation (7), source creation-to-Home parity (1), server identity/date/permission/pagination/current-patient tests (8), and exact overdue lab/imaging/dispensing navigation among work sharing an encounter (3).
- Three shared queue-card Storybook stories passed with accessibility checks, including menu-only navigation and original selected/unselected modes.
- TypeScript, ESLint, production build, docs links, UX copy and secret scan passed. Build retains the existing docs-reader/Turbopack tracing warning; compilation and type validation succeeded.
- Desktop visual inspection confirmed shared controls, removed empty shell header, 예정 labels, card/menu behavior and column scrolling. Browser integration uses synthetic API fixtures; it is not production DB verification.
- Independent read-only boundary review found no remaining blockers in the corrected source mappings. Reviewer did not inspect remote runtime or independently rerun tests.

## Release And Remaining Boundary

Implementation and local checks are complete. PR Preview, exact Release Check, Production approval packet, merge and Production smoke are tracked separately in the delivery record/PR; do not infer their completion from local tests.

The historical `clair_list_home_operations_work_items` SECURITY DEFINER RPC still exists remotely and has a previously identified membership-only permission boundary. Home no longer invokes it. Revocation/replacement requires separate scoped DB authorization; this change does not claim to remediate that remote function.

The additive read-only RPC migration is now explicitly authorized and prepared; remote installation and readback are recorded below. No business mutations, external messages, real data use or private asset publication were performed. Primary checkout WIP remains preserved.

## Authenticated Preview Correction And Demo DB Readback — 2026-09-08

Authenticated Preview revealed that source-table SELECT is revoked for authenticated users. Replaced those reads with `20260907152249_home_source_rows_permission_reader.sql`, applied to the existing demo Supabase after explicit user approval. No table privileges or business rows changed. The public invoker wrapper calls a private permission-checked implementation; operational assignment arrays are now part of the source snapshot, removing calendar fan-out.

- Authorized authenticated RPC read succeeded; anonymous execution is revoked and a nonmember invocation failed with `home_permission_denied`.
- All eight original source tables still deny authenticated SELECT. Before/after counts and semantic hashes match for all eleven checked demo source/assignment tables.
- SQL source predicates with chart/billing permission false return no consultation, invoice, invoice-line or order rows. Existing active demo members all have these view permissions, so a real restricted-member session was not available for this branch of the check; no permission policy was altered to manufacture one.
- Security advisor returned no finding naming the new reader. Project-wide existing advisories remain outside this scope; this is not a clean-project security certification.
- Ten focused server tests pass, adding missing fulfillment names, incomplete-RPC fail-closed behavior and invoice-only guardian fallback. Original UI/navigation/creation parity checks remain applicable.
- Paging is complete for static source data; source changes between offset pages are reflected on refresh. No artificial date cutoff is used for earlier unfinished work.
- Rollback: restore the previous application deployment. The additive read-only RPC can remain unused without affecting the previous app; no source-data rollback is needed.

## Header Appearance Follow-up — 2026-09-08

승욱 requested Customer-page visual consistency for both 원내 현황 and 내 업무 while retaining Home's existing filters, views and behavior, then requested commit/push/PR/main delivery. The follow-up uses the same adaptive top spacer, 24px title, count badge, 48px side inset and 32px controls. The date trigger and its calendar icon align with the title; previous/next controls follow the date. Overrides are confined to Home and do not change the shared date picker for other modules.

Seven existing Home UI tests passed. Additional temporary browser geometry checks verified title/date-icon alignment in both views with the calendar open and closed, 24px title text, 32px controls and calendar open/close behavior. TypeScript and targeted ESLint passed. Synthetic screenshots were inspected; final candidate/release evidence is recorded in the follow-up PR.

## Section Menu Ghost Follow-up — 2026-09-08

승욱 requested the Kanban section overflow button match its adjacent collapse chevron, then explicitly requested commit/push/PR/main delivery and approved deployment. Replaced the card-oriented outlined row-menu trigger locally in Home with the same ghost/icon-xs Button used by the chevron. The menu retains its compact content, event propagation handling, accessible label and hide-column action; task-card controls are unchanged.

Seven existing Home UI tests passed, including column hiding/restoration. A temporary browser check verified matching button dimensions, radius, border, shadow and icon width, no hover/open shadow, and menu open/dismiss behavior; its synthetic screenshot was inspected. Release candidate, preflight and deployment evidence are recorded in the follow-up PR.


## Approved Prototype Controls Reconciliation — 2026-09-08

승욱 confirmed that the deployed 52px collapsed column with vertical title and menu-only card navigation must remain. This supersedes the separate prototype's 280px header-only collapse and non-modal card detail. The newer Home source reader, requester identity, per-view queries and scoped display preferences are retained; the older aggregate requester migration from the prototype work is not part of this release.

The remaining approved presentation changes are scoped to Home: a Search button reveals the shared Input, Escape clears the query then closes/refocuses the trigger; completed inclusion uses an outlined toggle button; personal tabs have a white selected surface and existing task/request labels; work-type headings use 14px module icons. Saved non-empty searches reopen as inputs, while hospital and personal queries remain independent. Card/source navigation and current personal grouping are unchanged.

User authorization covers scoped commit, push, PR, origin/main merge and Production deployment after passing verification. Delivery uses a clean worktree based on main `2e095d5576b5f916640f7b7df720454280c83609`; original WIP is preserved. No DB migration, permission policy, secret/env or fixed staging change is included.

Preflight: focused Home UI/server/source parity, TypeScript, lint, build, docs, UX copy, secret scan and diff check; exact manual Release Check and Ready Preview before merge. Production smoke: login and Home route plus the scoped Home interaction where authenticated access is available. Stop on candidate drift, failed checks, non-Ready/unexpected deployment or scoped smoke failure. Rollback candidate: existing Ready Production `dpl_5QULkzRQANswyFYdcCQ9N4kkaKPA`; revert only this control change if later unrelated releases have landed. Final hashes/check/deployment evidence will be recorded in the PR.

## Full Approved Layout Correction — 2026-09-08

The PR #721 controls-only release did not fulfill the approved overall prototype. 승욱 reported that omission against Production. Only two prototype exceptions remain authorized: a 52px collapsed column with vertical title, and inert task-card bodies with source navigation through the card menu. The previous paragraph narrowing remaining work to controls is superseded by this correction.

The Home-owned layout now uses a 56px top spacer, 48px title/body inset, 34px toolbar, 230px shared date navigator, fixed 280px white Kanban columns separated by 16px, 44px inset-divider group headers, and a persistent 220px hidden-work area. Status groups display 진행 중, 대기, then opt-in 완료. Group hide/restore controls use the prototype's eye actions. Column collapse still uses the approved 52px vertical form. Queue-card content and source menus continue to use the existing shared component.

Hospital lists and both personal tabs use 36px rows with status, patient/guardian, visit type, work type, source description, request time and assignees; column headings remain accessible without a visible generic table header. Personal tabs group selected-day and previous unfinished work by source type. Each personal tab has independent session-only hidden groups, separate from hospital preferences. Row click/Enter/Space and the hover action preserve the existing source URL. Personal date selection remains available beside the title; source dates, authorized identity filters, patient statistics, queries, permissions and server readers are unchanged. No source-data, migration, auth, policy or dependency change is included.

A new 1920×1084 browser check covers column/header/row/toolbar dimensions, the hidden area, calendar, collapse-divider behavior, personal grouping/hide isolation and exact requested-work navigation. Synthetic screenshots compare the local approved prototype with board/list/assigned/requested views. Existing shared shell geometry and data-derived card text/counts remain distinct from static example content. Final preflight and exact candidate/Ready deployment evidence belong to the corrective PR; passing local geometry is not a claim of Production completion or human acceptance.

The existing authorization covers delivery of this omitted approved scope. Base/rollback source: `f35f9a347c0ec9dcdc46c95802b55e048780aa7e`; previous Ready Production: `dpl_JDT4WYPsMccbUBD855pywjHuUFev`. Smoke scope: authenticated synthetic Home board/list/personal tabs, search, completion, hide/restore, collapsed column and card menu. Preserve existing user view preferences after smoke and perform no business mutation.


## Personal Work Today-only Follow-up — 2026-09-08

승욱 approved the investigated plan, implementation, commit/push/PR, origin/main merge and Production deployment. Remove the personal header date navigator and use the workspace operating day for both API requests and personal grouping, ignoring legacy saved personal dates. Hospital date selection remains independent. This supersedes the earlier personal-date-control requirement. No DB, permission, environment or shared-component change.

Isolated branch `codex/my-work-today-only` starts at `630d3cd02a31c248401615a33811944dff7c4a7a`; primary WIP is preserved. Verification covers stale saved dates, both personal tabs, previous unfinished work, completion and hospital-date isolation, plus required release preflight and exact Release Check. Production smoke checks login/Home and the personal control where authenticated access is available. Rollback: revert this scoped commit, preserving subsequent releases. Stop on failed checks, candidate drift, unexpected deployment or failed scoped smoke. Final candidate/deployment evidence is recorded in the PR.

Ten Home browser tests passed, including saved-date API assertions and existing geometry/navigation tests. Local secret/docs/UX copy/diff checks and lint passed (five existing unrelated lint warnings); TypeScript passed. Production build passed with the existing docs-reader tracing warning. Remote release evidence follows in the PR. Previous Ready Production rollback deployment: `dpl_2edNzaBrBuj79d3z8FyeZ3h6BxP8`.


## Personal Work Balanced Inset — 2026-09-08

승욱 approved matching personal content right padding to the existing 48px left/header inset, followed by commit/push/PR/main and Production delivery. A Home-local class applies only to 내 업무; hospital content retains 16px right padding. No query, data, shared component or dependency change. Base/rollback commit: `077ad7202fb5a2015cceee40869a2190a47dc19e`; previous Ready Production: `dpl_3nAAf7NGL9N6CWXbihza9FjC8Szi`. Verify existing Home tests, personal/hospital inset geometry and release preflight. Stop on failed gates, candidate drift or failed smoke; revert only this change if needed. Exact release evidence belongs to the PR.

Local verification: all 10 existing Home browser tests passed; personal screenshot confirms balanced insets and header alignment. Secrets/docs/UX copy/diff/lint/TypeScript/build passed. Existing five unrelated lint warnings and docs-reader build tracing warning remain. Final remote checks and authenticated Production geometry are recorded in the PR.

## Empty Hidden Work Panel — 2026-09-08

승욱 requested hiding the entire 숨김 업무 panel when no work types are hidden, then authorized commit/push/PR/origin-main merge and Production deployment. Render the panel only when `hiddenTypes.length > 0`; existing hide/restore preferences and panel geometry remain intact. The flex body reclaims the removed panel space.

Isolated branch `codex/home-hidden-work-empty` starts at `077ad7202fb5a2015cceee40869a2190a47dc19e`, preserving primary WIP. Ten Home browser tests passed; focused coverage checks initial absence, board hide/all-restore, and list hide/individual-restore. Required release checks and exact candidate/Preview/Production evidence are recorded in the PR. No DB, permissions, environment or shared-component changes. Smoke: login and Cheongdam Home; authenticated interaction evidence is reported separately. Rollback: previous Ready Production `dpl_3nAAf7NGL9N6CWXbihza9FjC8Szi`, or revert only this scoped change if later releases land. Stop on failed checks, candidate drift, unexpected deployment or scoped smoke failure.

## Hidden Panel Fidelity and Board Edge Fade — 2026-09-08

승욱 approved the Figma 28301:181329 panel corrections and a right-edge fade for horizontally overflowing hospital Kanban, followed by commit/push/PR/main merge and Production deployment. Hidden panel title/count, icon-free rows, eye + 전체 표시, 32px rows/4px gaps, 12px body insets, typography and hover styling now follow that reference. Zero hidden types still remove the panel. Keyboard focus and touch restore visibility are preserved.

The Home-only 32px right-edge gradient appears only when more board content exists to the right, with a 2px edge tolerance. It updates on scroll, resize, hide/restore and collapse/expand, does not intercept pointer input, and excludes the toolbar, hidden panel and list views. Existing scroll persistence is retained. No new dependency, shared component, DB, permission or environment changes.

Clean branch `codex/home-hidden-panel-fade` starts at `bf0f63be013ddb9e4ba4ff835f6c4679d0a63569`; primary WIP is preserved. Checks cover Home regression, design geometry/hover/focus, overflow start/middle/end/resize, and release preflight. Exact candidate, Release Check, Ready Preview and Production smoke evidence are recorded in the PR. Smoke: login and authenticated Cheongdam Home panel/fade. Rollback candidate: current Ready Production `dpl_FoQsNVKxpo8twdQ1nSKjvhW1Yj54` or scoped revert if subsequent releases land. Stop on failed checks, candidate drift or unexpected deployment.
