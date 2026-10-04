---
id: "LAB-PR-004"
type: "Work Item"
title: "Lab result sheet Figma alignment: implementation plan"
description: "Code-backed execution plan for the accepted V5 result sheet, including unresolved data and upload transport contracts."
status: "human_review"
area: "lab"
priority: "P1"
tags: [lab, figma, result-sheet, attachments]
target_pr: "Scoped V5 alignment candidate"
source_docs:
  - "docs/design/screens/lab/specs/result-sheet.md"
dependencies: ["LAB-PR-003 baseline", "Narrative and instruction mapping", "Measured upload transport proof"]
updated: "2026-10-03"
---

# LAB-PR-004 — Result Sheet Figma Alignment

## Goal And Authorization

Implement the [accepted visual contract](../../design/screens/lab/specs/result-sheet.md) while preserving result editing and attachment lifecycle behavior. The earlier checkpoint completed investigation and documentation only. On 2026-09-29 the user explicitly authorized GPT-6 Luna at maximum reasoning to implement, the parent to verify against the plan/spec, then commit, push, create a PR, merge to origin/main, and deploy after passing verification. This authorization covers the scoped code delivery; it does not add DB/RLS/migration, real-data, video, or bulk-download work.

Duplicate check found LAB-PR-001/002/003 and no existing owner for the accepted V5 alignment. This is a visual follow-up to LAB-PR-003, not a rewrite of its completed history. The scoped implementation is verified and awaits human acceptance; authorized delivery continues under that subsequent authorization.

## Investigation Baseline

- Inspected local `origin/main` snapshot: **`84721187beb400a97ae74f7a63c963435212acde`**. This is local Git evidence, not a fresh remote or deployment verification.
- Primary checkout HEAD at investigation start: `f564a493`; substantial unrelated WIP, including docs and earlier lab work. Do not reset, merge over, or use it as the phase2 implementation baseline.
- Existing phase2 checkout at `76c2360de5f25a4ec23c35c92c5ac432a2896e0a` provided historical context. Compared with the pinned snapshot, phase2 attachment owners were unchanged; `module.tsx` had later changes. Use symbols and the pinned source, not old HTML line numbers.
- Read [LAB-PR-003 at the pinned baseline](https://github.com/mcso0/emr-app-shell-prototype/blob/84721187beb400a97ae74f7a63c963435212acde/docs/work/lab/LAB-PR-003-result-sheet-phase-2.md). It records prior attachment fixes and synthetic lifecycle evidence. That evidence is historical, not a current smoke result.
- LAB-PR-003 also records a retest `chart_id_required` issue and a later local migration candidate. Recheck its current disposition before retest smoke; do not silently bundle that migration into visual alignment.
- Current V5 prototype is a design reference with synthetic states, not reusable production upload/persistence code. Legacy report `proposed` flags and line numbers are superseded by the accepted design ledger plus this plan's unresolved contracts.

Refresh the baseline before implementation. If another task advances main, compare touched owners and preserve intervening changes. Inspect attached worktrees before creating a new one; reuse a suitable free checkout when available.

## Code Ownership And Planned Edits

Paths below refer to the pinned baseline; some phase2 files are absent from the older primary checkout.

| Owner | Confirmed current behavior | Planned change |
| --- | --- | --- |
| `src/features/lab-imaging/module.tsx` → `LabResultInputSection` | Shared order group, density selector, history, save/reload, disabled chart-copy action. | Align local toolbar and group geometry; integrate table-target link after checking URL restoration. Preserve save and error recovery. |
| Same → `LabResultDataTable` | Six columns, disclosure inside name cell, single `expandedRowId`, `renderAfterRow`. | Leading 24px disclosure column; consistent sizes and colspan; retain stable IDs, focus, retest action and single-open behavior. |
| Same → `LabResultValueControl` | Coded select or value input with result-presence/qualifier/device metadata. | Local control typography; eligible narrative ghost entry only after mapping is resolved. |
| `src/features/lab-imaging/components/lab-result-phase2.tsx` → `LabResultRowDetail` | Controlled `row.note`, 144px textarea; attachment filtering by row ID. | 76px finding, approved spacing/divider, optional authoritative staff notice without shadow. |
| Same → `LabResultAttachmentArea` | Card/list state, tasks, concurrency two, delayed loading indicator, fixed 144px viewport and count-based fade. | Content-bounded viewport; actual scroll metrics; icon toolbar; list header; measured-progress state after transport proof. |
| Same → `AttachmentCard`, `UploadCard`, `UploadStatus`, `AttachmentActionMenu` | Preview/download/delete, filename, actor fallback, hover timestamp, retry/cancel. | Card/list visuals, fallback images, nonoverlapping metadata, separate upload presentation; preserve existing actions. |
| `src/features/lab-imaging/use-lab-result-phase2.ts` | Scoped fetch, abort on context change, `canEdit`; attachment time/actor already available. | Reuse fields for list. Change response types only if authoritative instruction mapping actually needs it. |
| `src/features/lab-imaging/result-profile-contract.ts` and `src/types/emr-domain.ts` | `value`, `note`, `resultValueKind` are distinct. | Inspect eligibility source; no ad hoc `text → narrative-only` conversion or schema change. |
| `src/features/lab-imaging/lab-result-attachment-core.ts` | MIME, size, filename, byte validation and immutable scoped path. | Preserve; no change expected for visual work. |
| `src/features/lab-imaging/server-lab-result-phase2-context.ts` and attachment API routes | Server permission checks, RPC scope resolution, signed upload, finalize validation, discard/tombstone. | Regression boundary; no planned permission or storage policy rewrite. |
| `src/features/lab-imaging/components/lab-attachment-viewer.tsx` | Existing protected viewer/download/delete flow. | Preserve behavior; change only if a demonstrated presentation regression requires it. |

Reuse existing Button, Textarea/Input, Avatar, CDS icons, `EmrDataTable`, `EmrOrderGroupSection`, and `EmrCopyLinkButton`. Check supported APIs, including `icon-xs`, locally before use; query project-scoped Storybook docs if Storybook is running. No new shared variant, dependency, or generic attachment framework is planned. Feature-local extraction is optional only if needed to keep lifecycle logic separate from presentation.

## Dependency Resolution Before Dependent Code

| Key | Concrete next investigation | Exit criterion / fallback |
| --- | --- | --- |
| D1 narrative entry | Follow canonical profile/order metadata through result mapping and `LabResultRow`. | Explicit predicate and fixtures distinguish narrative-only orders from numeric/coded/text-value orders. If missing, retain inputs and mark CHG-002 pending rather than guessing. |
| D2 staff notice | Trace `workItem.sourceSnapshot?.instruction` to the selected result/order and verify authority, empty behavior, and multi-row placement. | Confirmed source + scope + permission contract. Missing data hides the block; no placeholder text or copied `note`. New data contracts require separately scoped work. |
| D3 upload percentage | Inspect installed Supabase storage implementation and official docs; prove measured progress and cancellation compatibility using synthetic files. | Verified signed-upload transport, byte events, supported headers/body, and cleanup races. Do not invent an endpoint or replace server permission checks. Unavailable progress is an explicit unresolved fidelity gap. |
| D4 table deep link | Trace existing `EmrCopyLinkButton` (`moduleId="lab"`, `labResultId`, operating date) and URL restoration. | Opening from a different selection restores the intended result and focuses/scrolls its order table after data renders. Add only the smallest necessary target contract; preserve back/forward behavior. |
| D5 bulk download / video | Determine whether a separate feature is wanted and define scope. | Keep these unresolved in this slice. Do not enable mock buttons, fake ZIP download, or video accept-only support. |

The designer-approved visuals do not resolve these data/API questions automatically. Implement independent visual changes first after authorization; resolve dependent portions before claiming full alignment.

## Implementation Sequence

### 0. Establish The Implementation Candidate

- Refresh relevant Git/work-item evidence and use a suitable isolated checkout containing phase2 fixes; preserve primary WIP.
- Re-read current design spec and owning code. Check applicable coding discipline and external SDK documentation routing before changes.
- Record baseline screenshots with synthetic data: collapsed/expanded row, empty attachments, card/list, editable/read-only, loading/error. Use 1246px component width for Figma comparison and current full-workspace sizes for integration.
- Resolve D1/D2/D4 through code tracing; time-box D3 as a transport proof before selecting an implementation. No migration or remote operation is implied.

### 1. Result Table And Detail Shell

- Apply CHG-001/004/005/014: leading disclosure, column geometry, 76px finding, empty 78px surface, spacing/divider and control typography.
- Wire a single disclosure state from both chevron and eligible ghost button; use `aria-expanded`, `aria-controls`, descriptive accessible names and correct expanded-row colspan.
- Apply CHG-002/003 only after D1/D2. Staff notice stays plain read-only content with `box-shadow: none`; preserve the input shadow on actual editable fields.
- Apply CHG-013 after D4. Preserve save/reload/history/retest and disabled chart-copy behavior.

### 2. Attachment Presentation And Bounded Scrolling

- Apply CHG-006–010/012 for existing supported types: icon tools, consistent card geometry, filename/actor spacing, single menu, list metadata and type/image fallbacks.
- Keep labels/tools and list header outside the file scroller. Card height grows to two actual rows; list to six rows. Include visible upload/failure tasks in sizing.
- Replace `count > 4` fade with actual `scrollHeight`, `clientHeight`, and `scrollTop` checks; account for resize, file/task changes and view switching. Remove listeners/observers on cleanup.
- Preserve action visibility on keyboard focus/touch, deletion confirmation and protected preview/download URLs. Keep unimplemented bulk-download semantics visibly unavailable rather than pretending to work.

### 3. Measured Upload State And Cancellation

- After D3, add explicit transfer progress and finalization state to task ownership. Preserve queue concurrency two, validation, retry and delayed loading presentation.
- Keep the existing lifecycle: prepare → signed upload → finalize → authoritative refresh. A byte-transfer 100% event does not mean finalize succeeded.
- Render a 16px spinner in card thumbnail with percent beside filename; list spinner/filename plus percent/cancel and full-width progress background. No card horizontal gauge.
- List fill uses actual clamped percentage, with fading tail opacity decreasing to zero at 100%. Maintain solid full fill while server verification is pending; proposed label `파일 확인 중` distinguishes this phase.
- Preserve cancellation after prepare, during transfer and during finalize. Pending discard remains necessary; if finalize wins, use existing ready-file deletion/tombstone handling. Any new network abort must still account for an in-flight signed upload and possible residual object.
- Preserve cleanup failures as actionable notices. Reset progress on retry and prevent late callbacks from restoring a cancelled or superseded task.

### 4. Verify And Prepare Review

- Complete the focused matrix below, fix regressions caused by the change and record screenshots plus test evidence against the candidate SHA.
- Record unresolved D1–D5 honestly. Full design completion cannot be claimed while an approved behavior is missing.
- Update this work item with the exact implementation scope and validation. The user has now authorized commit/PR/main merge/deployment after verification; apply the existing release checks and record the exact candidate, rollback path and smoke boundary.

## Verification Plan

| Area | Required evidence |
| --- | --- |
| Visual reference | 1246px component comparison for spacing, columns, row/control text, divider, staff shadow, card/list states. Also full desktop, narrow layout, both density options. Avoid comparing an entire browser width to component width. |
| Height boundaries | Cards 0/1/4/5/8/9 files at four columns and equivalent two-column boundaries; list 0/1/6/7; mixed ready/upload/failed items; cancel/delete shrink; switch views. Only file region scrolls. |
| Fade | No overflow, overflow at top/middle/bottom, resize and shrink. Fade absent at bottom; progress gradient and scroll-edge fade are separate effects. |
| Progress | Deterministic synthetic events at 0/25/50/88/100; full inner-row fill/no tail at 100; finalization pending/failure; unknown total; card has no fill. |
| Lifecycle | Queued cancel, prepare cancel, transfer cancel/failure, finalize race, retry, cleanup failure, concurrency two, result/workspace change and stale callbacks. |
| Data/editing | Numeric, coded and text values; note distinct from value and overall finding; blank/no-result/qualifier/device flag; save/reload/revision conflicts; history/retest preservation. |
| Permissions | Read-only controls, permission denied/load retry, unavailable metadata, protected preview/download/delete and result/row ownership. No permission expansion. |
| Accessibility | Keyboard disclosure/menu/cancel/retry, focus retention, names for icon-only controls, selected view state, progress semantics, no staff tab stop, long filenames, touch and reduced motion. |
| Deep link | Copy, open from another result/date, delayed data restoration, correct order-table target, back/forward and missing/unauthorized target handling. |

Existing focused checks on the pinned baseline:

```sh
node --test tests/lab-attachment-storage-context.test.mjs tests/lab-attachment-lifecycle.test.mjs
npx playwright test tests/lab-result-phase2-attachment.spec.ts tests/lab-result-profile-contract.spec.ts tests/lab-result-entry-persistence-contract.spec.ts --project=chromium
npx playwright test tests/lab-imaging.spec.ts --project=chromium
```

The attachment spec currently tests metadata and byte/path validation, **not visual upload states**. The Node tests use route/context harnesses, not a live storage service. Add focused UI coverage for the new height/progress/state boundaries; do not duplicate CSS declarations as tests. Scope browser fixtures to synthetic data and the relevant lab cases. Use an isolated local mock-auth server: Playwright defaults to port 3000 with `reuseExistingServer`, so verify that server before running or choose a dedicated `PLAYWRIGHT_BASE_URL`.

Run required repository lint/type/build checks appropriate to the eventual change. Broaden only when failures or changed boundaries justify it. Live authenticated storage/retest smoke is separate evidence and requires its authorized scope; do not infer it from harness passes.

## Done When

- All implemented CHG items match the accepted visual contract and the synthetic visual/state matrix passes.
- D1/D2/D3/D4 are resolved for claimed features; bulk download/video are explicitly scoped or remain recorded omissions.
- Save/history/retest, permission boundaries and attachment cleanup remain intact.
- Candidate evidence distinguishes local checks, remote delivery and human acceptance.

## Documentation Checkpoint — 2026-09-29

Completed: source-code investigation, canonical design reference, implementation sequence, dependency ledger and verification plan. Application implementation has not started in this task.

Documentation validation: `npm run docs:check` passed (1072 Markdown files); focused relative-link and whitespace checks passed; the V5 artifact hash matched. Navigation changes are limited to the screen index, design changelog, and one LAB-PR-004 row in the already-modified work index. No app tests or live-data checks are claimed for this documentation-only checkpoint.


## Active Implementation And Delivery Record

### Approved AS-IS → TO-BE Follow-Up

- On 2026-09-29 승욱 approved the detailed HTML comparison, requested TDD, and authorized commit, push, PR, origin/main merge and production deployment after checks pass.
- Follow-up baseline: freshly fetched `origin/main` `9aad7a92e2e71adda9cc1cb07b624627fbba1bbd`; isolated branch `codex/lab-result-layout-tdd`. The earlier V5 implementation is already in that baseline. Primary checkout WIP is preserved.
- Scope: three 28px toolbar actions and 8px gaps; save/retry/status below the group with reset/reload in overflow; fixed result columns with only normal range growing; 220px result inputs; metadata menu in the item cell; group title/count spacing; feature-scoped gutter and padding; row-group dividers; 76px transparent-default upload and matching finding typography/padding/shadow.
- The [canonical spec](../../design/screens/lab/specs/result-sheet.md) captures the approved Figma geometry. Approved report-contract SHA-256: `97503cde8b7b25ccf04aa7f92c412c0265251ec6e52dab1852cb7a54cc551070`. Existing numeric/coded/text values, save/revision, history, retest, instruction source, upload lifecycle and permissions remain authoritative.
- TDD RED: all four new layout scenarios failed before implementation (toolbar count, table geometry, default upload background, expanded-parent border); the CBC metadata placement assertion also failed before implementation.
- Initial GREEN: all four layout scenarios passed. The CBC assertion needed visibility synchronization before measuring the animated group; its persistence/retest scenario then passed in the full run.
- Broader initial run: 59/61 passed. The lab smoke still expected six columns, old disclosure labels/144px detail, and the removed chart-copy placeholder. Updated that scenario to the accepted contract while retaining its existing demo attachment assertions. Final focused matrix: 59 scenarios passed together, and the corrected lab smoke passed separately (60 passing scenarios in total).
- The unrelated imaging status-button assertion failed identically with all three application owners restored from untouched baseline `9aad7a92`. It is excluded from this lab-focused release gate; no imaging application behavior was changed.
- Node attachment context/lifecycle/transport: 14/14 passed. Secret scan passed (4491 tracked files), UX-copy check passed, lint passed with five existing script warnings, typecheck passed.
- Documentation links passed (1054 files), diff check passed, and production build passed. Existing Turbopack documentation-reader warnings did not block the build. Remaining release gates: exact-candidate Release Check, Ready Preview, protected main merge, Ready Production and read-only lab smoke; delivery evidence will be recorded on the PR. No remote data writes or live attachment lifecycle tests are claimed.

### Earlier V5 Implementation

- Worker: GPT-6 Luna, reasoning effort `max`, scoped application code and focused tests. Parent owns integration, specification review, final validation and delivery.
- Isolated branch: `codex/lab-figma-alignment`, created from fetched `origin/main` `84721187beb400a97ae74f7a63c963435212acde`. Primary checkout WIP is preserved.
- Initial baseline checks: 11/11 Node attachment context/lifecycle tests passed; documentation links passed (1054 files in the clean checkout).
- User authorized direct PR delivery to `main` and production after verification. Fixed staging alias, project settings, environment values and DB migrations are outside this change.
- Existing production before implementation: Ready deployment `dpl_98ZQvjxHKkmi2oaED5NPKAGv2TAr`, verified through the production alias. Refresh before merge to identify the then-current rollback target.
- Planned preflight: scoped UI/lifecycle tests, secret scan, docs, UX copy, lint, typecheck, build, clean diff review, exact-candidate GitHub `Release Check`, Ready preview and production smoke.
- Stop on failed required checks, unexpected scope, secret exposure or failed scoped smoke. No remote test data mutation is authorized by this code-only delivery.
- Parent confirmed the existing authenticated production lab route is accessible for read-only post-release smoke. This is not evidence for the new implementation yet.

### Investigation Resolutions

- D1 remains unavailable: no canonical narrative-only eligibility field exists in current profile or persisted-row contracts. Keep numeric/coded/text inputs. CHG-002 is explicitly deferred; no speculative enum or dead branch is introduced.
- D2 resolved without a schema change: the selected `LabDetail.order` is tied to the result order; its instruction is mapped from the fulfillment work item's source snapshot. Display nonblank order-scoped instructions above the expanded row detail, never `row.note` or overall finding.
- D3 source proof: installed Supabase storage-js 2.105.1 returns `signedUrl` from `createSignedUploadUrl`; its upload uses PUT, FormData with `cacheControl=0` and the file under the empty key, and `x-upsert=false`. A synthetic SDK custom-fetch probe confirmed that request shape. Add the already-generated signed URL to prepare and use a feature-local XHR transport for measured progress; preserve token/path fields and all existing guards. Normalize the uploaded File MIME for CSV/TXT with absent browser MIME.
- Browser upload events are documented by [MDN](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload); cross-origin progress listeners require CORS preflight. Real transport compatibility remains a separate verification boundary from deterministic UI event tests.
- D4 implementation direction: retain `labResultId`/date URL restoration and add only the feature-owned table hash target with focus after rendering.
- D5 remains outside the approved implementation slice: no bulk download or video capability.
- Additional baseline: 24/24 attachment metadata, profile and persistence contract checks passed. Existing lab/imaging browser suite: 13 passed, 2 failed before application edits (legacy Kong CBC row-name assertion and an imaging row-name assertion). Do not attribute these failures to this change or expand unrelated imaging scope.


### Implemented Scope And Review Evidence

- Result sheet: leading accessible disclosure, local 12/16 control type, accepted detail spacing, plain authoritative staff instruction, stable input handlers, and a table link that preserves the queue selection ID separately from the persisted result ID.
- Attachments: protected existing file actions, localized Figma file/view icons, actual two-row card height, six-row list cap, fixed list labels, responsive container sizing, and overflow fade that disappears at the bottom or after removal.
- Uploads: native measured progress with an honest indeterminate state, separate card/list designs, full fill/no tail at 100%, pending server-finalization semantics, queue concurrency two, abort and cleanup on cancellation/unmount, retry progress reset, and visible failure context.
- Figma asset provenance: six static SVGs from result-sheet nodes `28532:202785` and `28532:203029`, copied from the approved reconstruction into the feature asset directory. No specimen patient images, avatars or external asset URLs are shipped.
- Parent verification: 42 focused Playwright tests passed (18 new rendered UI checks plus 24 existing attachment/profile/persistence checks). Coverage includes 1246px reference geometry, card counts 1/4/5/8/9, list counts 1/6/7, empty/read-only states, container resize to two columns, deletion shrink, measured 25/50/99/100% progress, transfer-finalization distinction, copy/reopen/focus, queue cancellation, prepare cancellation, transfer abort/retry and unmount cleanup.
- Worker verification: 14 Node transport/storage/lifecycle tests passed, including signed PUT multipart shape, MIME normalization, unknown total, clamp, transfer failure and abort. TypeScript and focused lint passed.
- Parent preflight: full lint passed with five pre-existing unrelated script warnings; production build passed with the existing docs-reader tracing warning; docs/UX-copy checks passed. Final candidate secret/diff checks and remote Release Check are delivery gates, recorded with the PR.
- Scope limit: CHG-002 remains deferred because no authoritative narrative-only predicate exists. Existing typed result values remain available. Bulk download and video remain unavailable. This is the completed scoped slice, not a claim that these unresolved capabilities were implemented.
- Evidence boundary: browser upload tests intercept synthetic routes and transport events locally. They prove rendering/lifecycle behavior, not a live Supabase write. Post-release production smoke is read-only; no real data uploads, saves, deletions or retest mutations are performed.
- Delivery evidence (exact candidate, PR, remote check, merge/deployment, smoke and rollback) belongs in the PR and final handoff. Human acceptance remains separate from passing automated and parent checks.

- Final visual correction: the shared table intentionally renders semantic column labels. A feature-local screen-reader-only treatment hides the disclosure header visually while retaining its accessible label; the parent reference-width test also checks the 12px toolbar gap.

### Local Autosave Follow-up — 2026-10-03

- Authorization: 승욱 approved local implementation after code investigation.
  Remove the annotated `더보기 / 저장` footer and use automatic saving for
  result values, item findings and overall finding. This follow-up has no new
  commit/push/merge/deployment or remote-data authorization.
- Scope: feature-local queue shared by result rows and overall finding, existing
  POST/PUT APIs, visible status/retry, in-flight edits, readback and failed-draft
  restoration during SPA navigation. No schema, RLS, dependencies or attachment
  transport changes. Primary-checkout WIP is preserved in a managed worktree
  based on `origin/main` `f3e2566ed09c854cb2da0779e425bf183f471df1`.
- Done criteria: no manual save/reset footer; result and finding readback after
  autosave; no writes on mount or in read-only controls; serialization, retry,
  conflicts and navigation preserve edits. Keep role/server/audit contracts.
- Verification: focused autosave coordinator/browser checks, existing CBC
  persisted-result and API retry regressions, TypeScript, scoped lint, docs and
  secret checks. All browser mutations use intercepted synthetic local APIs.
- Result: local implementation complete and ready for human acceptance. The
  annotated footer and overall save button are removed. Status/retry appears only
  after edits; no idle footer space remains. Stable table cell renderers preserve
  keyboard focus and open result metadata popovers during server acknowledgements.
- Verification: 21 distinct focused tests passed across the combined run and the
  final CBC/toolbar rerun. Coverage includes 6 queue contracts, 10 autosave browser
  cases, toolbar absence/geometry, CBC value/qualifier reload and retest revision,
  and 3 existing API boundary/loading/retry/permission regressions. TypeScript,
  scoped ESLint, docs links, secret scan, UX copy and diff checks passed.
- Wider scenario limit: `visible day-in-clinic demo links reception, chart,
  fulfillment, lab, billing, and audit surfaces` stops at the reception
  `patient-card-patient-ui-api-kong` precondition, before reaching lab. No broader
  suite or production smoke pass is claimed. Production build was not required
  or run for this local follow-up.
- Browser tests use intercepted synthetic local APIs. No production autosave,
  authenticated remote writes, merge, deployment or user acceptance claimed.
  Visual evidence is retained locally at `output/lab-autosave/result-sheet.png`.


### Autosave Release Authorization And Candidate Verification — 2026-10-03

- 승욱 explicitly authorized commit, push, PR, `origin/main` merge and Production
  delivery after the removal and autosave verification pass. This authorizes the
  same autosave follow-up scope; no remote data mutation, migration, RLS or env
  change is included.
- The managed worktree was fast-forwarded to `origin/main`
  `e0e81f8f5d8888af3e7d44b68ec145553385d34f` before release verification. Only
  the feature's source, focused tests and owning docs are staged; primary WIP
  and local screenshot artifacts remain excluded.
- Fresh focused run: all 21 tests passed together. The screenshot confirms the
  annotated footer and overall save button are absent. Coverage includes result,
  item finding and overall finding autosave, readback, serialization, invalid
  input, ambiguous retry, conflict/permission blocking and navigation recovery.
- Local secret, docs, UX copy, full lint and TypeScript gates passed. Full lint
  has five existing warnings in unrelated WP10 generator scripts. Release build,
  exact-candidate Release Check and Ready Preview are required before merge.
- Before-release rollback target: Ready Production deployment
  `dpl_9vAcSXcKZSZMVhFyeHoZzNTzCp4p`, alias target
  `emr-app-shell-prototype-4ogzswbbq-mcso0s-projects.vercel.app`.
- Post-release smoke: `/login` HTTP probe and authenticated read-only inspection
  of the originally annotated lab route, footer absence and automatic-save
  placeholders. Autosave write verification uses intercepted synthetic local
  APIs; no Production result values or findings are changed by the smoke.
- Stop before merge if required gates fail, candidate scope changes, secrets
  appear or Preview/source is unexpected. Stop and report after merge if
  Production is not Ready, its source is unexpected or scoped smoke fails.
- Exact candidate, PR, Release Check, merge, Production and final rollback
  evidence are recorded in the PR and delivery handoff.

## Responsive Follow-Up — 2026-10-03

- User reviewed the standalone HTML proposal, restricted implementation to responsive behavior with the existing design preserved, and requested commit/push/PR/main merge with deployment approval.
- Scope: `LabResultDataTable` observes its viewport content width and supplies controlled column sizing using existing preferred/minimum widths (1198px / 904px totals). Preserve the shared renderer, default wide layout, reference geometry, all style classes, and result/finding/attachment/persistence contracts.
- Rebased on the separately approved autosave release #897. Its stable cell renderers already retain input focus; the responsive slice changes no persistence hook, result projection, or autosave behavior.
- No shared component, dependency, API contract, permission, schema, remote data, typography, spacing, wrapping, toolbar, or detail-design change.
- Regression evidence: before implementation, narrow mode overflowed by 126px in the synthetic browser fixture. The follow-up checks narrow/wide modes, right-panel changes, window resizing, minimum-width table scrolling, header/body alignment, unchanged input appearance, draft/finding/disclosure preservation, and focus retention.
- Existing wide-geometry checks now wait for the resize result; the CBC fixed-width assertion explicitly uses a wide viewport. Final focused checks and preflight are rerun after rebasing. Browser writes use intercepted synthetic fixtures, not remote records.
- Exact candidate checks, Preview, Release Check, main/Production delivery, scoped read-only smoke, and rollback evidence are recorded in the PR and final handoff. Human acceptance remains separate from delivery verification.

## Row Group Divider Correction — 2026-10-03

- User approved the investigated divider correction, commit/push/PR, main merge and Production delivery. A result row includes its expanded finding and attachments; dividers separate complete row groups, and a single order has no divider.
- Cause: the expanded parent suppressed its `tr` border, but the shared table CSS also adds borders to its direct `td` cells. Opening the detail makes the parent cease to be the final DOM row, leaving its cell borders visible.
- Fix: extend only the expanded parent's feature-local class to suppress direct cell borders. Preserve the existing detail/final-row border rules, shared renderer/styles, autosave, permissions and attachment lifecycle.
- Regression: the single-order browser test failed before the fix with a cell border of `1px` instead of `0px`. After the fix, four focused browser scenarios passed: single-order expanded/collapsed, first/middle/last groups with keyboard and single-open disclosure, result/finding autosave, and read-only attachments.
- Local browser checks use intercepted synthetic APIs. Production smoke inspects the annotated lab route without editing values, findings or files. Exact-candidate Release Check, Ready Preview, merge/source, Production alias and rollback evidence are recorded in the PR and final handoff.

## Detail Horizontal Padding — 2026-10-04

- User requested code investigation and a plan before completion, then explicitly authorized commit/push/PR, direct `origin/main` merge and Production deployment for the annotated detail padding change.
- Owner: `LabResultRowDetail` in `lab-result-phase2.tsx`. Its parent detail table cell has zero padding. Change the wrapper from `px-2.5` (10px) to `px-6` (24px) at every viewport width; retain inner 10px content padding, vertical spacing, `md` stacking and attachment container queries.
- Scope: one feature-local class change, the existing reference-card geometry expectations and this screen's owning specification. At the 1246px reference component, the wider inset reduces each content field by 14px and each four-column attachment card by 3.5px; preserve aspect ratio and the measured two-row viewport cap.
- Existing responsive test baseline: before this change, the 1366px open-panel scenario also failed its expectation of horizontal overflow (`0` instead of `> 0`). Do not alter unrelated shell behavior or weaken that expectation as part of this padding correction.
- Local verification passed: eight focused synthetic browser scenarios, secret scan, internal docs links, Korean UX copy, full lint (five existing script warnings), TypeScript and the webpack Production build. Shared installed dependencies match the candidate lockfile; CI verifies the default build separately.
- Verification uses intercepted synthetic local APIs. Production smoke is read-only. Exact-candidate preflight, Release Check, Preview, merge/deployment/alias and rollback evidence are recorded in the PR and final handoff. Human acceptance remains separate from delivery.

## Overall Finding Columns And Attachments — 2026-10-04

- Authorization: 승욱 accepted the standalone HTML proposal, requested removal
  of the prototype explanatory subtext, and authorized implementation plus
  commit/push/PR/main merge and Production delivery for this scope.
- Goal: equal text/upload columns in `검사결과 종합소견`, matching the item
  detail's responsive grid and divider. Preserve autosave and read-only states.
- Dependency found during inspection: current local and remote attachment
  contracts require a result row. Real overall uploads need nullable `row_id`
  and an updated existing prepare RPC; an arbitrary item row is not a valid
  substitute. New remote schema application needs separate authorization.
- Local scope: reuse the attachment area with explicit `rowId: null`; render
  only result-level files there. Keep item files, API permissions, result locks,
  canonical/editable-result checks, owner assignment, signed private paths,
  byte/type/size checks, cancellation, cleanup, delete and audit contracts.
- Schema candidate:
  `supabase/migrations/20261004050013_lab_overall_result_attachments.sql`.
  It drops only attachment `row_id` NOT NULL and replaces the same-signature
  prepare function. Existing workspace/result and non-null item FKs, RLS,
  grants and triggers remain. No existing record is changed or deleted.
- Done criteria: matching desktop heights/widths, narrow stacking, no prototype
  footer, item/overall isolation, explicit null prepare, reload/delete lifecycle,
  autosave regression, denied invalid selectors and cross-workspace access.
- Verification boundary: browser and server mutations use intercepted synthetic
  fixtures. SQL executes in an empty disposable local database and rolls back.
  Remote inspection is read-only; no remote migration or file upload is applied.
- Release dependency: do not merge/deploy the application until the exact schema
  candidate is separately authorized, applied and verified remotely. The user
  already authorized application delivery; do not request that scope again.
- Rollback: revert the application merge while retaining the additive nullable
  schema so result-level files remain safe. Strict schema rollback may restore
  the previous prepare function immediately, but restore NOT NULL only after
  verifying that no null-scoped records exist; never delete files to force it.
- Exact PR candidate, local/remote gates, Preview, read-only Production smoke,
  previous Ready deployment, and final delivery status belong in the PR and
  handoff. Stop if schema verification, required checks, source or smoke fails.
- Local evidence: 13 Node server/lifecycle tests, 12 focused browser scenarios,
  isolated RPC/FK SQL fixture, TypeScript, lint, build, docs, secret and UX-copy
  gates passed. Lint has five pre-existing unrelated script warnings; build has
  the existing docs-reader tracing warning. The SQL fixture is a reduced model,
  not a full RLS/audit/storage replay. A read-only security review found no new
  actionable boundary defect and confirmed the separate remote-schema gate.
