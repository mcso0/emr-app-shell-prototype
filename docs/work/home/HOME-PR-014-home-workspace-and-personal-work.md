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
