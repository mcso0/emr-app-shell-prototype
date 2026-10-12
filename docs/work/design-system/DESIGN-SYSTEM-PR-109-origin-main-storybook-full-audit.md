---
id: DESIGN-SYSTEM-PR-109
status: human_review
area: design-system
priority: P1
target_pr: User-approved local full UI and Storybook audit
created: "2026-10-11"
updated: "2026-10-12"
source_docs:
  - docs/design/system/storybook-operating-rules.md
  - docs/design/system/component-ownership-rules.md
  - docs/design/system/ui-refactor-dod.md
  - docs/engineering/current-status.md
dependencies: []
---

# Origin Main and Storybook Full UI Audit

## Release preparation — 2026-10-12

승욱 accepted the local closeout and requested commit, push and deployment. The release includes the completed Storybook alignment, explicitly approved runtime/test/script follow-ups, accessibility findings report, and two Storybook maintenance/scope rules in AGENTS.md. Preserve unrelated primary-checkout work. New accessibility remediation, remote data operations, and public Storybook hosting remain excluded.

Reconcile the candidate with current origin/main and rerun release gates. Production merge remains subject to the exact-candidate approval packet required by the release runbook. Earlier no-delivery statements below describe their historical checkpoints.

- [Local closeout summary](../../completed/design-system/2026-10-12-storybook-closeout.html)

Release reconciliation keeps the latest main profile-preview API, billing stories and tab-store behavior. Story-only callers now provide `onOpenProfile`, billing examples hide unrelated chart controls, and the save-drain story creates then closes a tab to produce a genuine save generation. Customer geometry assertions use actual text bounds and the approved 8px header-button padding / transparent pinned boundary.

- Reconciled catalog: 711 static index entries and 711 MCP manifest stories; zero missing or unexpected IDs. Latest full Storybook run: 706/711 passed; the five failures pass in bounded follow-ups, including all 26 updated profile/popover/shell cases. Across the full run and follow-ups, all 711 distinct file/story pairs have passing evidence. This is not a single clean full-suite run.
- App regression run: initially 71/94 passed, including Home and inpatient 36/36. Both affected customer geometry tests pass after expectation alignment. The legacy chart-route case passes on focused rerun. The column-resize test now locates the approved Korean button name instead of the former raw column ID and passes. Combined evidence covers 75/94 cases; the other 19 also fail on unmodified main at 247d21dd. They concern stale dispensing/order fixtures, navigation roles, narrow popovers, header sizing and cached-panel removal expectations. Do not treat the broad suite as clean or expand this release to fix those baseline failures.
- Final local typecheck, full lint (zero warnings), secret scan and static Storybook build pass. The production build passed after the latest-main runtime merge; subsequent changes only affect stories, tests and this record. The exact pushed candidate must also pass the complete remote Release Check.
- The previous accessibility report covers 705 initial states plus five intermediate states before main reconciliation. Six upstream stories are additional catalog entries; no claim of a new 711-story accessibility sweep or accessibility remediation is made.


## Chart stability and accessibility audit — 2026-10-12

승욱 authorized fixing the first-run chart test failure, running the missing automatic accessibility checks, and reporting findings while preserving prior changes. No commit, push or deployment.

- Reproduced `ClearHistoricalMeasurementPreservesOrigin` failing at the immediate confirmation-description visibility assertion. The dialog portal exists before its opening fade becomes visible. Replace only that assertion with `waitFor` around the same visibility expectation. Preserve all no-write-before-confirmation, PATCH identity/version, cleared values and historical origin assertions. Product code and animations are unchanged.
- Ten fresh CLI runs of all seven vital-dialog stories pass70/70 with no retries. Native focused test, TypeScript and affected-file ESLint pass. Static Storybook builds successfully.
- `run_story_tests({a11y:true})` alone does not execute axe in this candidate: `addon-a11y` is neither installed nor configured. Run the already-installed `axe-core4.11.3` in isolated Chromium against actual Storybook Canvas documents, including body portals, without adding application dependencies.
- Initial-render scans suppress play through a scanner-only hook verified against installed Storybook source. They retain story args, decorators, loaders and beforeEach, require matching successful `storyFinished` events, wait for fonts/finite animation settlement, and reject failed/blank renders. Explicit intermediate-state scans cover historical confirmation, post-save close, filtered global search, pending schedule save and a390px date.
- Final axe coverage:705/705 initial Canvas states plus5 intermediate/narrow states scanned; zero unresolved render errors or page exceptions. Initial states produce22 violation rule types across629 stories; after excluding the three general page-context rules,242 stories retain component/fixture findings. These are repeated story occurrences, not242 distinct bugs.
- [Accessibility report](../../completed/design-system/2026-10-12-storybook-accessibility-audit.md) and [complete rule/story summary](../../completed/design-system/2026-10-12-storybook-accessibility-audit.json) distinguish source-confirmed runtime issues, standalone-page context and incomplete/manual checks. Accessibility findings are reported, not changed under the chart-test fix.
- A static-preview scan attempt encountered dynamic-import failures. Failed renders were excluded, and every final initial scan has successful development-Canvas evidence. Static build success is not a claim of static runtime accessibility success.

## Final-review regression follow-up — 2026-10-11

승욱 authorized the two confirmed regressions and two Home test failures to be fixed locally after cause/scope review, with missing regression coverage and WIP preservation. No commit, push or deployment.

- Schedule: a pending save previously allowed editing the draft while the request held an older value; success then closed the sheet and lost the later edit. Disable draft inputs, selects and dismiss actions while saving/deleting. Failed save unlocks the retained draft for editing and retry. Preserve successful close, dirty guards and command contracts.
- Inpatient: disabled buttons use `pointer-events:none`, so physical clicks reached the row and opened details. Wrap the two controls with the existing `data-row-interactive` marker. The table's existing row guard ignores those hits; ordinary row selection remains available. Shared Button and table code are unchanged.
- Home date: fixed desktop width could truncate longer date labels next to the 오늘 badge. Use intrinsic desktop width and preserve the compact breakpoint reset, text size, control height and compact badge visibility. Add long-date geometry checks with/without 오늘 at1440,1024,900,801,800,768,767 and390px.
- Home mobile test: at390px, the existing Home panel intentionally becomes a modal sheet and makes the background inert. Assert that contract, close via Escape, wait for the background to become interactive, then test kanban. Product panel behavior is unchanged.
- Add delayed save success/failure, physical disabled-button clicks, long dates, and global-search reversed query/filter responses plus close/abort tests. Search product code is unchanged; the synthetic transport deliberately returns even after abort to verify the stale-response guard.
- Verification: the31 focused story cases pass across the initial30-pass run and targeted search recheck. Home/Inpatient36 app cases pass across the35-pass run and corrected same-frame date-geometry recheck. Native full705 run passes704; the existing chart vital confirmation visibility case passes a targeted rerun. Preserve the initial failures; this is not a one-shot all-green claim or a repair of that unrelated timing issue. Accessibility scanning is disabled.
- TypeScript, full ESLint with zero errors/warnings, documentation links, diff and static Storybook build pass. A final shell-story cleanup follow-up uses registered, idempotent teardown before restoring the outer fixture; final12 shell cases and checks are recorded in local evidence.
- Initial red cases and test-authoring failures are retained. Verification is synthetic/local and does not prove production or live-data behavior. Before/after hashes confirm exactly13 scoped candidate files changed, no files were added, all other candidate files and its Git head are unchanged. This task made no writes to the primary checkout; concurrent file changes and a Git-head move there were observed and preserved. No primary hash-equality claim is made.

## WP10 unused-variable warning cleanup — 2026-10-11

승욱 authorized cleanup of the five remaining warnings, behavior/WIP preservation, and full lint with zero errors/warnings. No commit, push or deployment.

- The two offline WP10 scripts intentionally omitted three planning-only input fields and two historical record fields through rest destructuring. Replace unused bindings with shallow copies and explicit deletion of the same keys. Original input objects remain unchanged; ESLint configuration and application code are unchanged.
- Execute before/after copies against copied local input artifacts in isolated directories. Both generated JSON artifacts are byte-identical, and stdout/exit status match. Both validators pass1976 atomic checks; both generators retain166 changed presets,524 selectable keys,51 retired keys and3 changed compositions. `applied:false` remains explicit. No original artifact overwrite or remote data operation.
- Full `npm run lint -- --max-warnings=0` exits0: zero errors and zero warnings. TypeScript, documentation links and diff checks pass. Previous lint counts below are historical checkpoints.
- File hashes confirm only the two scripts and this work record changed. All other candidate files, the primary checkout and both Git heads remain unchanged.

## Archived generator lint follow-up — 2026-10-11

승욱 authorized removal of the six archived-script lint errors, preservation of behavior/WIP, and full-repository lint verification. No commit, push or deployment.

- Preserve the `.cjs` path and `node <script>` entry point. Import Node built-ins with `import()` inside `main`; load the generated CommonJS bundle through the existing `createRequire` resolver. Preserve generation logic, network guard, output paths and failure exit status. No ESLint rule suppression, global configuration or runtime product change.
- Execute before/after copies in isolated evidence directories. Generated HTML, regeneration JSON and CommonJS bundle are byte-identical. HTML remains2384 bytes with SHA256 `20d8bad8ade5784a3a7daea97d38fcb54f919e2a6f6bdf07a442b8922b300de4`; both copies exit0 and exactly match the current embedded fixture. Existing generated report assets are not overwritten.
- The changed script passes ESLint with `--max-warnings=0`. Full `npm run lint` exits0 with zero errors and five unchanged unused-variable warnings in the two WP10 scripts. Documentation links and diff checks pass.
- Candidate before/after hashes show changes only to this generator and this work record; all other candidate files and both Git heads are unchanged. This task made no writes to the primary checkout. Concurrent changes to its `tests/app-shell.spec.ts` were observed and preserved.
- Earlier report manifests and the six-error checkpoint below remain historical evidence; this approved follow-up changes the generator only.

## Approved five-issue follow-up — 2026-10-11

승욱 explicitly authorized local fixes for the five remaining product issues, after cause/scope review, preserving existing behavior and WIP. No commit or deployment. This section supersedes the five pending product decisions in the historical report; the report and its evidence remain unchanged.

- Schedule: the dirty flag is an event-time ref because save clears it and closes in the same asynchronous continuation. Successful save closes without a false discard warning. Failed save retains the draft and dirty guard; retry and intentional discard remain available.
- Dispensing: all 15 data columns provide Korean `meta.label` values. Shared table sorting, filtering, resizing, selection and the accepted table overlay are preserved.
- Unconnected actions: dispensing history/filter, customer support/help, and inpatient admission/room/chart/discharge controls are disabled with `준비 중` information. No new workflow, backend or permission policy is introduced.
- SOAP: Enter/Space on the actual BlockNote disclosure button toggles child visibility without reaching the document-editing keymap. Document content and focus remain unchanged; normal editing and clicks are preserved. Implementation was checked against installed BlockNote0.54.0 source.
- Global search: dynamic results use the server's query/filter decision; quick actions retain local filtering. Query/filter changes clear old results, and selecting the active filter preserves current results. Server workspace/permission checks are unchanged.
- Verification: focused53 cases pass after correcting test scope/transition waits. Full701 run passed699; the two existing chart/result cases pass in a23-case targeted rerun, which also verifies the final active-filter guard. Eight existing local command-search/schedule contracts pass. Initial failures are retained, and no claim is made that unrelated timing behavior was repaired.
- Native Storybook verification resolves all701 indexed cases after targeted reruns (accessibility scanning disabled); all699 prior story IDs are preserved. TypeScript, changed-file lint15 (zero warnings), documentation links, diff and static Storybook build pass. Desktop and420px checks cover the updated dispensing labels; narrow controls retain original text width and expose preparation status through accessible names/title. Existing dense group-header crowding at420px is outside this five-issue fix.
- At the five-issue checkpoint, repository-wide lint was blocked by six pre-existing `no-require-imports` errors in the immutable prior report’s `render-markdown-server-fixture.cjs`, plus five unrelated script warnings. That evidence file matches the before snapshot; it was preserved.
- [Follow-up evidence](../../completed/design-system/2026-10-11-storybook-caller-parity-assets/five-issue-follow-up.json) records the exact scope, reruns and preservation check.
- Scope: isolated `storybook-main-alignment` checkout. Primary checkout is preserved. Local synthetic verification only; no live data, commit, push, PR, merge or deployment.

## Caller-parity wave 2 — completed locally; Human Review

승욱 approved GPT-6.1 Max parallel execution across the three existing lanes, with coordinator integration/review and only necessary human decisions returned. See the latest section of the [orchestration plan](./DESIGN-SYSTEM-PR-109-storybook-alignment-orchestration-plan.md). The starting candidate has 502 stories after the individually accepted follow-ups. App code, accepted local overlays and prior WIP are preserved. The earlier 489-story report below remains historical evidence.

### Final wave 2 evidence — 2026-10-11

- [Korean decision report](../../completed/design-system/2026-10-11-storybook-caller-parity-report.html) and [final evidence](../../completed/design-system/2026-10-11-storybook-caller-parity-assets/closeout.json).
- Candidate SHA256: `80d1b2b3d19a04f26deab6fdc8078f2a2fc4ea9887e10768157828ede5d6847d`. Frozen and freshly checked origin/main remains `66c1b4c8cba72d342657839425d627c4cbc7bc1e`.
- All 502 seeded IDs retained; final 699 indexed examples have unique ownership (A161, B236, C285, coordinator17). All 231 runtime UI source files have explicit classifications; two auxiliary rows are separate. This is not all-state or all-live-workflow coverage.
- Fresh final native Chromium run: 699/699 pass, accessibility scanning disabled. Final TypeScript, ESLint154 files, docs links, diff and static Storybook build pass. The exact 699 examples compile; 531 Props checks across79 regression groups pass. Dev/static component content and index match, excluding only generation duration metadata.
- Known12 browser play cases pass in both dev and static after targeted rechecks. Initial dynamic-import/load failures remain recorded; no claim that their browser-loading root cause is fixed. Actual MarkdownRenderer Node output was regenerated:2384 bytes, exactly matching the embedded synthetic HTML. No hydration/live document claim.
- Temporary logs were lost during a machine reboot. Fresh final evidence is persisted in the report assets; recovered lane packets distinguish historical observations from new verification. Initial full-suite failures, focused reruns and the final native pass are retained.
- Comparing981 tracked runtime files against frozen main finds only the four already-approved Home/table overlays. This wave adds no product runtime edits. The primary checkout was not edited by this work; concurrent profile work changed its status and tests independently, and was preserved. Pre-reboot WIP hash verification is labeled historical where original snapshots were lost.
- Independent source review accepted the final Login cleanup idempotence and three readiness-only story repairs without weakening assertions. Product choices are limited to schedule dirty state, dispensing headers, unconnected active actions, SOAP Enter behavior and global-search filtering.
- Human Review means pending user acceptance. No commit, push, PR, merge, deployment, external data action or public exposure occurred.

## Historical alignment execution — 2026-10-11


This checkout uses frozen origin/main `66c1b4c8cba72d342657839425d627c4cbc7bc1e`.
승욱 approved the [orchestration plan](./DESIGN-SYSTEM-PR-109-storybook-alignment-orchestration-plan.md), three execution chats, subagents, MCP use, verification and final reporting. Preserve both existing dirty checkouts. No commits, pushes, merges, deployments, public endpoints or runtime product fixes are part of this execution.

The sections below retain the previous audit history from a different checkout and baseline. Prior product-fix approvals and test counts are historical evidence; they do not expand this alignment candidate's scope or validate it.

Current local candidate is handed off for review with explicit coverage gaps. This is not a claim that every app state or live workflow is verified. No user acceptance or remote delivery is recorded.

- Report: [Korean HTML](../../completed/design-system/2026-10-11-storybook-main-alignment-report.html).
- Candidate digest: `bada754465b94d4bb461d85c66bb337b87c68557949ba6f47ac5ca4387914241`; see [file hashes](../../completed/design-system/2026-10-11-storybook-main-alignment-assets/candidate-manifest.json).
- Inventory: 231 runtime UI files, 1,703 component/render-function candidates; 45 documented, 72 composed in stories, 20 dependency-only, 94 without a static story link. Every candidate remains in the [matrix](../../completed/design-system/2026-10-11-storybook-main-alignment-assets/coverage-matrix.json), including internal render callbacks.
- Catalog: 106 story files, 489 indexed stories, 99 Docs pages. Retained all 346 baseline story IDs and added 143 stories in 31 files.
- Tests: final native Storybook MCP suite 489/489 passed (`a11y: false`). Final known-12 browser plays passed 12/12 in dev and 12/12 in static. TypeScript and affected lint passed; full lint had zero errors and five pre-existing unused warnings.
- Initial-render sweep: 586/588 on first pass, two Docs import errors passed same-candidate targeted rechecks. Last isolated change touched only PatientQueue Continuity play; its final dev/static completion passed. Initial rendering is not completed play, state completeness, or visual parity.
- MCP: 106 source-fixture groups and 489 examples compile; structural/compiler errors zero. Source comparison covers 63 Props regression groups / 511 Props / six zero-argument components. Dev/static component manifests match. Snippets require this Storybook preview and omit play intentionally.
- Preserved primary WIP 29 files and old audit WIP 86 files with identical status/head/hashes. All 981 tracked non-story src files match baseline. Added two Storybook-only mock modules; no product runtime fixes.
- Independent reviewer inspected every submitted patch and parent infrastructure; final assertion review retained tolerance and state assertions. The last font-ready and queue tests cover settled/font-loaded states only.

### Remaining product and coverage decisions

- Main Tabs/ToggleGroup wrappers do not forward orientation; no runtime fix copied.
- Memo custom trigger opens by keyboard but omits expanded/controls ARIA and ref forwarding; no position defect claimed.
- Handoff select shows synthetic ID rather than display name; callbacks and reason still verified.
- Profile font-loading measurement race remains; font-ready stories do not prove its repair.
- Table viewport global overscroll policy remains `none` on both axes.
- App/shell/auth/workspace/store/module-slot composition, writable vitals and lab XHR/signed-asset lifecycle need separate local fixture work. Source-only rows are not accepted as visual/live verification.
- Static fast-navigation import errors were individually cleared on recheck; their root cause is not proven. Failure evidence is retained outside the final pass records.

No active execution dependency requires new permission for this local handoff. Broader product fixes, real-data validation, acceptance and remote release remain separate operations.

## Previous audit — Approval and Goal

승욱 explicitly approved investigation of **all UI elements**, bounded local corrections,
verification, parent supervision, and parallel subagents with disjoint file ownership.
Preserve existing WIP. Do not commit, push, merge, deploy, publish endpoints, or create
remote work items. Human acceptance is reserved for the user's next review.

Prepare a readable Korean HTML report with the complete inventory, evidence levels,
changes, remaining limitations, and concrete user review actions.

Follow-up approval (2026-10-11): diagnose and fix the remaining app regression
failures and all 16 Props documentation errors. Preserve the existing local WIP;
the no-commit/push/merge/deploy boundary remains in effect. The prior results below
are the first audit checkpoint; final follow-up evidence below supersedes them.

Confirmed follow-up defect scope: the local synthetic mock order-draft gateway
loses omitted line price snapshots across delta saves and emits the legacy
`treatment` type for imaging rows. Correct only the mock gateway and its focused
regression coverage, preserving explicit removals, ETag/revision checks, chart
ownership and real Supabase/RPC behavior. This is within the approved remaining
app regression repair. No remote data operation or production delivery is authorized.


Confirmed follow-up defect scope (catalog deselection): the existing chart catalog
selection handler removes unselected draft groups only from local rows and omits
the explicit `removedOrderIds` delta. A normal save can restore those rows. Prepare
a narrow local correction using the existing deletion path's persisted/inflight vs
local-only distinction, pending-removal bookkeeping and confirmed/locked-row gates.
Validate the exact deletion request, real local mock readback and reload. This fixes
an already requested remove operation; it adds no remote action or deletion approval.

## Baseline and Coverage

- Frozen source: `origin/main` at `b5a02d79ad977c4c192831df4ac6115d3aa03284`.
- Reuse the clean attached table delivery worktree on local branch
  `codex/ui-storybook-full-audit-20261011`; the primary checkout remains untouched.
- Initial source census: 309 TSX files, 499 TS files, 23 CSS files, 225 SVG assets,
  and one ICO asset. Stories, internal JSX, inline render callbacks, app routes,
  feature composition, shared components, shell, and document viewer UI are included.
- Separate source enumeration, static story reachability, actual browser rendering,
  interaction assertions, and human acceptance. None proves the others.
- Dedicated loopback Storybook: port 6017. Initial index: 346 stories, 66 Docs pages;
  initial components manifest: 75 groups. Existing user servers remain unchanged.

## Execution Plan

1. Reconcile a machine-generated source/JSX inventory with three independent audits:
   UI primitives; shared EMR; features/shell/routes/other UI.
2. Classify every source row and record supported states, callers, story relationships,
   confirmed defects, intentional differences, integration-only coverage, and limitations.
3. Correct stale examples, API/docs mismatches, meaningful missing stories, and narrow
   violations of existing UI contracts. Parent owns shared Storybook configuration.
4. Validate meaningful behavior in stories and impacted app screens. An independent
   reviewer checks source changes and evidence before parent integration closeout.
5. Produce the HTML review report and preserve the full inventory for search/filtering.

## Boundaries

- No new design direction, dependency, broad public API redesign, product-policy change,
  DB/RLS/migration, remote data mutation, external communication, or real personal data.
- Only synthetic local fixtures. Do not mask unavailable live integrations with invented
  proof; record exactly which state could not be exercised and why.
- Missing standalone stories are candidates, not automatically defects. Small local
  markup and feature adapters may be correctly reviewed through owning compositions.
- Decision-dependent work is recorded with options; independent approved work continues.
- Do not weaken assertions to make failing tests pass.

## Initial Evidence

The complete baseline Storybook suite ran 346 tests: 344 passed and two PDF attachment
viewer stories failed. The failures precede this task's edits and are being investigated.
Local evidence: `/tmp/ui-audit-baseline-stories.json` and its adjacent log.

## Completion Criteria

- Every source/UI inventory row has a classification and explicit evidence level.
- Approved in-scope confirmed defects are fixed and relevant checks pass.
- Remaining blockers and decision items state impact and next action.
- Existing primary WIP matches its starting byte hashes.
- HTML report links review examples and identifies the user's remaining work.
- Mark ready for Human Review only after implementation and applicable verification;
  never record human acceptance, remote delivery, or universal visual coverage by inference.

## Verification and Results

The following records the first audit checkpoint. The final follow-up section below
supersedes its app regression and Props results; failed diagnostic runs are retained.

### Initial audit inventory

- 1,071 source paths: 322 TSX, 500 TS, 23 CSS, 225 SVG, one ICO.
- 822 parsed source files; 231 runtime UI files. Seven Storybook infrastructure
  files and 30 public assets are counted separately.
- 11,639 JSX occurrences and 15 React.createElement calls with source locations;
  1,709 runtime component/render-function candidates, including internal callbacks
  and aliases. These are not unique reusable component counts.
- 88 story files, 384 indexed stories (all 346 previous IDs preserved), 81 Docs pages.
- Static runtime UI classifications: 30 documented, 66 composed in stories,
  13 dependency-only, 122 without a standalone story. No visual acceptance is
  inferred from these relationships.
- Full inventory path/hash parity and an independent JSX AST walk matched.
  The compact report data includes every source path and omits raw source/import
  literals and machine-specific absolute paths.

### Implemented changes

- Runtime: forward Base UI orientation in Tabs and ToggleGroup; merge caller
  object/function style with ToggleGroup's spacing variable; route six SOAP toolbar
  icons through the existing shared SVG normalization adapter. Four runtime files.
- Stories: correct Controls state, ISO date control types, input accessible names,
  OTP input, Select label resolution, table header/body cell parity, missing Docs,
  and usage/API explanations. Add 13 story files and 38 story exports.
- Synthetic boundaries: replace browser Supabase initialization in Storybook only;
  recovery email and SOAP attachment examples assert bounded synthetic callbacks.
- PDF readiness: the first actual local worker took 6,251 ms in diagnosis. Await
  worker readiness in story fixture setup, always destroy that setup worker, and
  retain real PDF document/page/canvas/error assertions. Product viewer unchanged.
- MCP: preserve four existing focused manifest groups and supply source-backed
  project-only CSF fixtures for 84 other groups. Keep imports, helpers, args,
  render, decorators and lifecycle cleanup; omit play/post-interaction state.
  Remove only 40 superseded known snippet-generation errors. Preserve separate
  component docgen errors and unknown error metadata.
- Add reproducible source inventory and real-type/source-identity MCP checkers.
  No dependency, canonical permission/data policy, API, DB/RLS or remote change.

### Verification

| Check | Result and scope |
| --- | --- |
| Full Storybook browser suite | 88 files, 384/384 stories PASS on final PDF source. Original run 344/346; intermediate 382/384 and 383/384 retained as diagnosis, not final result. |
| Focused actual MCP tests | 4/4 PASS: vertical Tabs, vertical ToggleGroup, OTP, synthetic password recovery. Accessibility addon checks not run. |
| Built MCP manifest | 88 groups, 384/384 examples compile with zero structural/type failures. Existing four groups byte-preserved. No retained story errors. |
| Negative checker validation | Invalid real Button prop, undefined helper, and omitted auth fixture hook each rejected. Unknown story errors remain visible. |
| TypeScript | `npx tsc --noEmit` PASS after final source changes. |
| Lint | Full `npm run lint`: zero errors, five existing script warnings. Final PDF scoped lint PASS. |
| Build/start | `npm run build-storybook` PASS after final source changes; local `--ci --smoke-test` PASS on dedicated port 6018. |
| Human Controls surface | Filter False → True → False; calendar selectedDate/todayDate ISO changes update today/selected state, then defaults restored. |
| Broad app regression | 433 selected; 55 passed, 20 failed, 358 not run after configured max-failures. Not a passing full app suite. |
| Bounded app follow-up | 21 selected; 19 passed, 2 failed due missing/outdated API fixtures. Home 6, customer 5, lab/imaging 4, reception 3, chart empty state 1 passed. |
| Duplicate-work guard reproduction | Existing app-shell test 1977 fails alone at queue interaction because its duplicate-work dialog is already open. Guard was not removed or bypassed. |
| Report and docs | Offline HTML local links resolve; search, file detail, asset filters, checklist persistence/reset, and 1920px/390px layouts verified with no overflow or console errors. `docs:check` PASS (1,087 Markdown files). |
| Secret checks | Standard tracked scan PASS; same rules additionally applied to untracked files and large report/JSON artifacts, PASS (4,709 paths at scan time). |
| Primary WIP | All original 15 paths and byte hashes unchanged; original HEAD remains c9f82f6. |
| Remote main | Read-only `ls-remote` remains b5a02d79. No commit, push, PR, merge, deployment or published endpoint. |

### Initial checkpoint limits and decisions (superseded below)

1. Sixteen component docgen errors remain. Compiled examples do not prove complete
   Props metadata. Full source fixtures increase MCP response size: about 405 KB
   shared prefixes and 2.41 MB when assembling all examples. Prefer one-story reads.
2. Source-level Base UI className callback mismatch has no known product callback
   caller or browser regression proof. Decide whether to support callback classes
   across adapters or narrow their types; no blanket adapter rewrite was made.
3. Broad app failures include old automatic queue selection, ambiguous accessible
   names, modal sheet expectations, title/geometry assertions, and missing fixture
   endpoints. Related sources are unchanged from the baseline, but no pristine
   browser A/B acceptance is claimed. Duplicate-work timing remains a real follow-up.
4. Static source coverage and story execution do not establish every state, viewport,
   accessibility requirement, role, live integration, persistence or production result.
   `public/panel-motion-options.html` received source review only.
5. New expected invalid-PDF fixture warnings and existing React act warnings are not
   suppressed. No human acceptance is recorded.

### Review artifacts and resume

- [Korean HTML review report](../../completed/design-system/2026-10-11-ui-storybook-audit-report.html)
- [Full compact inventory](../../completed/design-system/2026-10-11-ui-storybook-audit-assets/inventory.json)
- [Verification summary](../../completed/design-system/2026-10-11-ui-storybook-audit-assets/verification.json)
- [App QA diagnosis](../../completed/design-system/2026-10-11-ui-storybook-audit-assets/app-qa-notes.md)
- [PDF readiness diagnosis](../../completed/design-system/2026-10-11-ui-storybook-audit-assets/pdf-readiness-notes.md)
- [Built MCP checker result](../../completed/design-system/2026-10-11-ui-storybook-audit-assets/mcp-compile.json)

Continue in the dedicated local branch `codex/ui-storybook-full-audit-20261011`.
Do not reset or replace the primary checkout. Start the review Storybook with
`npm run storybook -- --ci --host 127.0.0.1 -p 6017` from that worktree if needed.
HTML and its adjacent assets work offline; localhost example links need Storybook.
The report checklist stores review progress only in that browser, not in app data.

Next human action: inspect the six report review items, identify any correction,
and specify the scope of any later delivery. This task carries no delivery approval.


## Follow-up repair — 2026-10-11

### Causes and bounded changes

- Fix all 16 known component-docgen failures by resolving the exact CSF meta
  component symbol through the installed TypeScript/react-docgen-typescript parser.
  Preserve unknown error metadata. Genuine zero-argument scenarios receive source
  descriptions; props-bearing components cannot silently fall back to empty props.
  Select retains all 24 props including children. HomeDateNavigator declares its
  component, forwards Controls args and preserves ISO dates and production labels.
- Correct the synthetic mock draft gateway's omitted price snapshot loss, deleted
  legacy-row price fallback and imaging-to-treatment classification loss. Preserve
  explicit removals, workspace/encounter/order identity, ETag and ownership gates.
  Three regression cases fail before the fix and pass afterward; a foreign-encounter
  boundary case remains passing. Remove the temporary pricing response fixture.
- Add the missing accessible name to reception's read-only expected-duration field.
  Other app repairs align synthetic fixtures, normal UI interactions and assertions
  with existing contracts. No production permissions, RPC, data policy or DB edits.
- Replace the obsolete diagnosis-table screenshot width after inspecting expected
  and rendered images against the existing panel geometry assertion.
- Isolate the chart completion UI fixture with the real core/gateway and an independent
  encounter. Retain original request and reload-readback assertions; separate server
  tests cover the actual Next HTTP adapter. Shared demo checkout runs after chart tests.

### Verified evidence and limits

- Final Storybook browser suite: 384/384 stories in 88 files, zero failures.
- Final static Storybook build: PASS. The built MCP checker compiles all 384 examples,
  preserves four prior groups, and reports zero component/story extraction errors.
- Props comparison: all 16 target groups, 65 props and six zero-argument components
  match the actual type signatures. Six injected metadata errors are rejected.
- Actual local MCP Docs calls: Select, ProfilePanel, HomeDateNavigator and Overview
  return successful source-backed documentation. Home date Controls were changed
  in the browser and reset to defaults after verification.
- Draft/completion server suites: 32/32 PASS, including HTTP route coverage. Separate
  override suite: 5/5 PASS. These tests use synthetic local data, not production DB.
- TypeScript: PASS. Full ESLint: zero errors, five existing script warnings.
- Independent read-only review: no material blocker; no new skip/fixme/only, no price
  assertion masking, and mixed-cohort action assertions match source contracts.
- App regression: the complete 443-case run finished with 434 passing and nine
  failing. After the remaining fixes, a fresh-server affected run passed all 121
  cases: the complete chart suite (119, including two added regressions), the
  duplicate-work case and the compact hospital role case. The latest result for
  each of 445 unique selected cases is passing, with zero remaining failures or
  skips. This combines the full run and affected rerun; it is not one uninterrupted
  445-case execution. The per-case map and run statistics are preserved.
- Catalog deselection: a focused RED run proved removedOrderIds was empty. After
  the narrow handler repair, all three focused paths pass: normal deletion/cancel,
  injected HTTP 500 plus retry, and local-only candidate removal without a server
  removal ID. Actual mock HTTP GET and reload verify persistence. The 121-case
  rerun also passes all three in the full chart execution order.
- The two intermittent navigation cases were repeated three times each after the
  affected run: 6/6 PASS. They retain exact URL, selection and duplicate-dialog
  assertions while waiting for the initial navigation/selection boundary.
- Final TypeScript and scoped lint after the catalog handler/test changes: PASS.
  The earlier full lint remains zero errors/five existing script warnings.
- The initial report passed 1920px/390px browser checks. The updated HTML keeps its
  layout but changes text and verification rows. Browser URL policy blocked opening
  its file URL for a fresh visual check. Final source, links and metadata are checked;
  a new rendered-screen acceptance is not claimed.
- MCP development requests still synchronously regenerate type information; a
  repeated query measured about 16 seconds. No unsafe partial-invalidation cache
  was introduced. Performance work and the unproven Base UI className callback
  concern remain separate decisions, not unresolved Props extraction errors.

### Follow-up artifacts

- [Per-case app regression results](../../completed/design-system/2026-10-11-ui-storybook-audit-assets/app-regression-summary.json)
- [Catalog deselection repair](../../completed/design-system/2026-10-11-ui-storybook-audit-assets/catalog-deselection-repair-notes.md)

- [Current app regression notes](../../completed/design-system/2026-10-11-ui-storybook-audit-assets/app-qa-notes.md)
- [Mock order repair evidence](../../completed/design-system/2026-10-11-ui-storybook-audit-assets/mock-order-repair-notes.md)
- [Props repair evidence](../../completed/design-system/2026-10-11-ui-storybook-audit-assets/props-repair-notes.md)
- [Props negative checks](../../completed/design-system/2026-10-11-ui-storybook-audit-assets/mcp-props-negative.json)
- [Actual MCP Docs reads](../../completed/design-system/2026-10-11-ui-storybook-audit-assets/mcp-props-live.json)

Human acceptance and any future delivery still require the user's separate decision.


### Local handoff state

Implementation and scoped verification are complete; human acceptance is pending.
The original primary checkout still has its same 15 WIP paths and byte hashes, with
HEAD `c9f82f6`. The dedicated worktree remains at HEAD `b5a02d79`, with all authorized
changes uncommitted. No commit, push, PR, merge, deployment or endpoint publication
was performed. Only newly generated test output directories are moved to a temporary
local evidence directory during cleanup. The local Storybook review server remains
available on port 6017; the task-owned app test server is stopped after verification.
