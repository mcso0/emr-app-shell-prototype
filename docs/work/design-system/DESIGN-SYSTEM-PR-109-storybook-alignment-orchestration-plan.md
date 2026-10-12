---
doc_type: execution_plan
status: human_review
area: design-system
related_work: DESIGN-SYSTEM-PR-109
created: "2026-10-11"
updated: "2026-10-11"
source_docs:
  - docs/design/system/storybook-operating-rules.md
  - docs/_meta/coding-discipline.md
  - docs/_meta/result-review-rules.md
---

# Origin Main / Storybook Alignment — Orchestration Plan

## 1. Purpose and current authorization

Make Storybook accurately describe the implementation on a verified `origin/main`:
component APIs, meaningful states, interactions, app compositions, human Docs, and
MCP documentation. Cover all UI areas; do not limit the audit to tables or examples
that already have stories.

Execution authorized by 승욱 on 2026-10-11. The parent coordinates three execution chats and bounded workers. The initial scope was local Storybook alignment. A later explicit request authorizes local fixes for the five reported product issues; see the [work item follow-up](./DESIGN-SYSTEM-PR-109-origin-main-storybook-full-audit.md#approved-five-issue-follow-up--2026-10-11). No commit, push or deployment.

The following paragraphs preserve the original planning checkpoint, not the current execution state.

This document is the requested plan, not an implementation or delivery result.
The current turn creates this plan and uses two read-only subagents to review the
work split and validation sequence. It does not create execution chats, modify
runtime or Storybook code/configuration, start servers, or run application tests.
The execution arrangement below starts after the user instructs execution.

Reuse DESIGN-SYSTEM-PR-109; this is a planning companion, not a duplicate work item.
The existing PR-109 record and report currently live in the preserved
`table-storybook-mcp-pr` worktree. Resolve that checkout through `git worktree list`
at execution time. Consolidate the companion and existing record in the integration
checkout without overwriting either history.

No commit, push, PR creation, merge, deployment, public endpoint, remote data write,
or new paid service is part of this plan. Preserve the user-selected models and
reasoning settings. Do not change runtime APIs or product behavior to make stories pass.

## 2. Evidence available before execution

These are historical checkpoints, not refreshed execution results:

| Evidence | Checkpoint | Limit |
| --- | --- | --- |
| Last fetched main in this chat | `66c1b4c8cba72d342657839425d627c4cbc7bc1e`, PR #955 | Fetch again at execution start. |
| Previous audit base | `b5a02d79ad977c4c192831df4ac6115d3aa03284`, PR #954 | Uncommitted audit and product changes are layered on top. |
| MCP | Configured port 6006; actual server 6017; direct initialize/list/docs calls succeeded | Registered tools in this chat were not verified. |
| Existing catalog | 88 story files, 384 stories, 81 Docs pages | Counts do not prove UI coverage or visual parity. |
| Local story tests | 384/384 passed on the previous candidate | Not a result for a new baseline or integration candidate. |
| Shared browser audit | 465/465 initial renders; 12 repeated Interactions failures | Initial rendering does not prove completed play functions. |
| MCP documentation repair | 16 Props groups; 384 compiled examples | Revalidate retained corrections on the new source. |
| App regression | 445 distinct passing cases across a full run and affected reruns | Not one uninterrupted run, and not production-data evidence. |

Existing evidence to reuse from the prior worktree:

- Work record: `DESIGN-SYSTEM-PR-109-origin-main-storybook-full-audit.md` in the
  prior checkout's design-system work directory.
- HTML report: `2026-10-11-ui-storybook-audit-report.html` in that checkout's
  completed design-system directory.
- Adjacent audit assets, including `inventory.json`, `app-regression-summary.json`,
  and MCP/Props evidence.
- The existing `full-browser-audit-report.md`, `full-browser-audit.json`,
  `full-browser-rechecks.json`, and `manual-checks.json` from the temporary share audit.

The previous public URL is a static snapshot and had an expiry. Do not depend on
its continued availability, renew it, or copy its credentials into reports.

## 3. Team structure and ownership

Use this orchestration chat plus three execution chats. Chats are stable subject
boundaries, not one chat per component. Each execution chat coordinates one bounded
implementation worker; the lead and its worker must not edit the same files at once.
Use the fourth subagent slot for independent review, or rotate a completed worker
slot into review. Across the effort, keep at most four spawned subagents active.
No child starts further agents without a capacity assignment from the orchestrator.

| Chat / role | Write ownership during execution | Read-only scope / exclusions | Required output |
| --- | --- | --- | --- |
| **O — this chat / 루멘** | Integration workspace; `.storybook/**`; project MCP config; common scripts, fixtures, inventory, report, work record; `src/stories/design-system-overview.stories.tsx` | Packages/lockfile remain unchanged unless a separately explained need is approved. | Frozen baseline, ownership ledger, accepted patches, integrated checks, Korean report. |
| **A — UI primitives** | Explicit allowlist derived from `src/components/ui/**/*.stories.*`; lane evidence | UI runtime, CSS, providers, and app code are read-only. | API/state/docs comparison and focused story corrections. |
| **B — EMR shared UI** | Explicit allowlist derived from `src/components/emr/**/*.stories.*`; lane evidence | Feature usage and runtime shared components are read-only. | Primitive-versus-composition comparison, EMR story corrections. |
| **C — Feature and app compositions** | Explicit allowlist derived from `src/features/**/*.stories.*`; approved lane-local synthetic fixtures; lane evidence | Investigate all features, app routes, shell, and remaining UI; no runtime edits. | Coverage of actual callers and feature states, missing meaningful examples, four feature failure diagnoses. |
| **R — Independent reviewer** | Review findings only | Read-only candidate and evidence; no fixes or server changes. | File/line findings, scope and WIP checks, evidence gaps, completion recommendation. |

The listed globs define routing, not permission to rewrite whole folders. Freeze
concrete file lists before dispatch. The parent owns any new shared fixture and
assigns newly discovered files before anyone edits them. A shared dependency
request pauses only the affected item; independent work continues.

The feature lane has fewer existing story files but more actual callers. After
inventory reconciliation, split it into chart and non-chart batches if needed.
Reuse a finished lane's capacity; do not add uncontrolled nested workers.

Each dispatch states: exact baseline, checkout, allowed files, forbidden effects,
story IDs, prerequisites, expected evidence, and who owns tests. Every worker is
told that others are active and that it must preserve their changes.

## 4. Workspace and integration strategy

1. Record tracked and untracked WIP paths, hashes, base commits, and bounded diffs
   in both existing checkouts. Keep those checkouts intact; no reset, stash, bulk
   checkout, clean, or branch switch in them.
2. Fetch `origin/main`, record its full SHA, and create/reuse a suitable isolated
   integration checkout at that SHA. Freeze it as the audit baseline.
3. Classify old changes by hunk: story/docs, test/synthetic infrastructure, runtime
   product behavior, or unrelated work. Record dependencies between them.
4. Parent selects necessary infrastructure and safe story corrections. Product
   changes stay separate. An example requiring an unmerged runtime change receives
   `depends_on_unmerged_product_change`; do not silently import that change.
5. Give implementation lanes isolated checkouts of the same baseline plus the
   accepted preparation patch. Keep lane changes uncommitted under the current
   no-commit boundary. Use source hashes and a patch manifest as candidate identity.
6. Integrate approved, allowlisted patches sequentially after applicability checks.
   No blind folder copy or unrelated cherry-pick. Only the parent resolves shared
   conflicts. Return out-of-scope hunks to the owner for correction.
7. Freeze the integrated candidate before full validation. Later source changes
   invalidate affected evidence; record and rerun the necessary checks.
8. Before closeout, fetch main again. If it advanced, report and inspect the delta.
   Apply relevant updates once, then repeat affected checks. Report the final SHA
   and timestamp; do not claim perpetual alignment with a moving branch.

## 5. Work breakdown and dependencies

| ID | Work package | Detailed work | Owner / dependency | Exit evidence |
| --- | --- | --- | --- | --- |
| P0 | Preserve and freeze | WIP hashes; latest main SHA; old patch classification; baseline/integration checkout identity. | O; first | Baseline and preservation ledger; no unexplained WIP changes. |
| P1 | Establish MCP and test environment | Verify server cwd/port/source; installed tool schemas; registered Codex connection; synthetic boundaries; baseline index/manifest. | O; P0 | Connection proof and source identity, or an explicit native-tool limitation. |
| P2 | Reconcile all UI elements | Update existing source inventory against baseline; map exports/internal UI/callers to stories or owning compositions; retain uncovered rows. | A/B/C in parallel; P0 and ownership lists | No unassigned area; all elements classified, with evidence level. |
| P3 | Baseline failure diagnosis | First classify each of the 12 IDs as retained, corrected-and-retained, or excluded with source/coverage reasons. Reproduce applicable failures using one source candidate in dev and local static modes; distinguish events/timing, fixture, configuration, and product defects. | A/B/C analyze; O schedules runs; P1 and relevant P2 mapping | Per-failure applicability and cause/evidence, or explicit unresolved hypothesis. |
| P4 | Correct stories and documentation | Align args/Controls/types/states/descriptions/MCP examples; add meaningful composition coverage; preserve existing stable IDs. | A/B/C in parallel; P2; relevant P3 result | Lane patch, updated matrix rows, focused passing evidence. |
| P5 | Review and integrate | Parent screens scope and dependencies; R reviews changes against main and actual callers; owners fix findings; O applies accepted patches. | O/R; rolling after P4 batches | Reviewed integrated candidate; no unresolved required findings. |
| P6 | Validate one candidate | Full story suite, static build/browser checks, explicit completion of known failing plays, type/lint/docs/MCP checks; app checks only where affected. | O; P5 freeze | Results tied to the same candidate and source hashes. |
| P7 | Final review and handoff | Reconcile every matrix row; check newest-main delta and WIP preservation; update Korean HTML/report checklist; record acceptance separately; reconcile task-owned resources. | O/R; P6 | Reviewable result with all remaining limits, exact completion state, and retained-resource ledger. |

Execution order:

```text
P0 -> P1 -> baseline checks
 |      |
 +----> P2 [A | B | C] -> P3/P4 by ready batch
                            |
                         P5 review/integrate
                            |
                         P6 candidate freeze + full validation
                            |
                         P7 final review + Korean handoff
```

Parallelize source analysis and disjoint edits. A reviewer may inspect a completed
batch while another lane works. Serialize shared configuration, integration, and
tests that share a server or synthetic state. Do not run the full suite per lane.

## 6. Detailed alignment checklist

For every UI element or explicitly grouped internal composition, inspect:

- **Implementation:** source file and symbol, actual call sites, supported API,
  CSS/tokens, providers, and parent-owned layout constraints.
- **Props:** required/optional inputs, unions/defaults, event callbacks, accessible
  names, and whether Controls represent a fixture wrapper rather than the real API.
- **States:** relevant default/selected/disabled/loading/empty/error states,
  overflow and narrow layouts, long labels, keyboard/focus behavior, and meaningful
  domain states. Mark unsupported or irrelevant states with a reason.
- **Composition:** actual app usage versus intentionally simplified examples.
  Keep a primitive example when valid; add an app composition example only when
  it communicates a meaningful contract. Use synthetic data and inert callbacks.
- **Human Docs:** purpose, when to use/not use, caller responsibilities, examples,
  and separation of demo controls from production props.
- **MCP:** correct component identity, Props metadata, resolvable imports/helpers,
  accurate args/render, and compilable examples. Initial-state fixtures must not
  claim post-interaction behavior or production drop-in compatibility.
- **Evidence:** distinguish static source matching, story reachability, rendering,
  completed play assertions, app behavior, and visual review.

Do not create a standalone story for every internal JSX callback. Keep its inventory
row and link the owning composition. Source-only evidence must remain labeled as
source-only; it cannot stand in for a browser state or visual comparison.

## 7. Known failures and assignment

| Lane | Story IDs to diagnose | Required distinction |
| --- | --- | --- |
| A | `design-system-ui-dialog--default`; `design-system-ui-dropdownmenu--default`; `design-system-ui-popover--default`; `design-system-ui-sheet--default` | Event sequence, portal scope, readiness/transition conditions, actual user behavior. |
| B | `design-system-emr-emrdialogshell--confirm`; `design-system-emr-emrpopovershell--default`; `design-system-emr-emrrowactionmenu--default`; `design-system-emr-emrtabledensityselector--default` | Same shared-event concerns; verify selection/callback outcomes as well as opening. |
| C | `features-chart-soap-live-blocknote-figma-prototype--toolbar-roving-keyboard`; `features-chart-soap-live-blocknote-figma-prototype--formatting-and-history` | Editor readiness, keyboard focus, formatting/history state, fixture isolation, product behavior. |
| C | `features-customer-patient-guardian-profile-side-panel--today-patient-states`; `features-staff-profile-side-panel-v2-content--work-status-ready-and-navigation` | Initial state, expansion/menu conditions, action/navigation callback, possible product defect. |

The earlier eight common-UI failures used `HTMLElement.click()` and a zero-delay
wait. This is a diagnostic lead, not a proven universal fix. Use real completion
conditions with bounded waits; do not add arbitrary long sleeps, retries that hide
failures, weaker assertions, or skip/fixme/only markers.

Some IDs may belong to prior unmerged additions. Determine applicability against
the frozen main and the retained story scope before reproduction. An excluded
addition needs a source-based reason and an explanation of how its applicable UI
behavior remains covered. Do not delete a story merely to avoid its failure.

The existing operating rules restrict new `storybook/test` helpers until MCP and
addon-vitest compatibility is verified. Do not promise a bulk userEvent/waitFor
conversion. First prove a narrow compatible approach under the installed versions.

## 8. MCP and test resource coordination

- O owns the server ledger: checkout, baseline SHA, patch/source digest, port, PID,
  index/manifest identity, and start time. A responding server alone is insufficient.
- Prefer the project-scoped registered `clair_storybook` tools. Verify initialization,
  listing, and a real component read. Direct HTTP protocol success is separate
  evidence, not proof of a registered chat connection.
- Read the catalog once per candidate, then query only owned components and variants.
  Cache evidence with candidate identity. Invalidate it after relevant changes.
  Avoid repeated full-catalog payloads and type extraction across every chat.
- Use installed tools: `list-all-documentation`, `get-documentation`,
  `get-documentation-for-story`, and `get-storybook-story-instructions` before edits;
  `preview-stories` and focused `run-story-tests` after changes. Verify schemas rather
  than assuming the latest web documentation matches the installed version.
- Focused test input is `{"stories":[{"storyId":"verified-id-from-catalog"}]}`.
  Do not send only a top-level `storyId`, which can accidentally trigger a broad run.
- Workers submit their candidate/patch, story IDs, expected behavior, and test request.
  O schedules focused batches against the source they actually modify. A test on the
  shared baseline is not evidence for an unintegrated worker patch.
- Use one writer/test owner per mutable environment. Current app tests reuse a server
  with one worker; concurrent processes must not share that mock server/state.
  Separate output folders prevent one run overwriting another's evidence.
- Keep dev and static preview loopback-only. A new external share is not needed for
  diagnosis. Any later publication follows the user's explicit sharing scope.
- Do not add an MCP cache layer, framework upgrade, new dependency, or global config
  change solely to accelerate this audit.

## 9. Review and verification gates

| Gate | Checks | Pass condition |
| --- | --- | --- |
| G0 — safe start | Baseline SHA, source identity, WIP snapshot, ownership, synthetic boundaries | All lanes know exactly what they may change and what they are testing. |
| G1 — lane submission | Allowlisted diff; source/API comparison; matrix rows; focused story and manifest checks | Patch fulfills main's contract without product changes or weakened tests. |
| G2 — independent review | Reviewer checks every changed file; high-risk fixture/Props/interaction paths in depth; inventory omission scan | Required findings fixed; remaining product decisions explicitly separated. |
| G3 — integrated candidate | TypeScript, lint, docs check, diff check, Storybook build, existing MCP example checkers, full story suite | Required checks pass on one identified candidate; warnings and limits recorded. |
| G4 — browser parity | Final candidate's indexed pages render; every retained previously failing play completes and passes in both the dev server and local static build; excluded additions have source/coverage reasons; changed meaningful states/layouts are visually reviewed | Same candidate in both modes; no deletion to evade failures and no inference of completed interaction or visual parity from initial rendering alone. |
| G5 — closeout | Matrix completeness, newest-main delta, WIP preservation, report links, independent verdict | No unclassified scope, no unresolved in-scope discrepancy, explicit acceptance status. |

Run narrow checks while editing, then one full integration pass. Repeat broadly only
after changes to shared settings/fixtures/runtime, unexplained failures, or another
documented impact. Do not rerun unrelated app suites solely to increase test counts.
If any runtime fix is separately included, add the actual affected app/API/data
contract regressions; old 445-case results do not validate the new candidate.

Product defects discovered on main are reported with source, reproduction, and
impact. Do not copy an old fix into the candidate or hide the defect in a fixture.
If such a defect prevents a required outcome, record the task as blocked/partial
for that outcome rather than claiming alignment complete.

## 10. Deliverables and element matrix

Each lane submits a patch plus a compact structured result:

```text
baseline_sha; candidate_digest; lane; owned_paths; changed_paths
element_id; source_path; symbol; caller_paths; story_ids_or_parent_composition
props; states; interactions; human_docs; mcp_docs; visual_parity
intentional_difference_reason; evidence_paths; remaining_issue; requested_tests
```

For each dimension use `match`, `intentional_difference`, `mismatch`, `unverified`,
or `not_applicable`, with a reason and evidence. Record the covered states explicitly;
one passing state does not imply all states passed. A lane returns `ready_for_review`,
`needs_shared_change`, or `blocked_product_decision`, never a bare "done".

O produces:

1. A complete element matrix with no silently dropped uncovered/internal UI.
2. A classified change list: reused old work, new story fixes, intentional differences,
   excluded product changes, and remaining unverified/decision items.
3. Verification results tied to baseline, candidate, environment, and exact scope.
4. An updated readable Korean HTML report and a user checklist for representative
   changed states, all 12 failure resolutions, and any proposed product decisions.
5. A concise Korean handoff distinguishing local implementation, validation, human
   acceptance, and remote delivery. Only the first two are execution outcomes here.

At handoff, stop only task-owned test servers that are no longer needed; identify
them by recorded PID, cwd, and port. Preserve pre-existing servers and all original
WIP. Keep the integration checkout, uncommitted candidate, matrix, and required
evidence available through user review. Record any preview server deliberately
left running. Retain worker patches and provenance until integration is verified;
archive disposable managed worker checkouts only when their results are recoverable
and no review still depends on them. Do not discard unique temporary failure evidence.

## 11. Definition of completion and reporting cadence

Completion requires all enumerated UI scope classified, all confirmed in-scope
differences resolved, required checks passed, and all required visual/behavioral
evidence supplied. Non-applicable dimensions need reasons. Unverified required
states prevent a complete claim; separately deferred/out-of-scope items remain
visible and must not be counted as verified.

The previous 384-story/465-page counts are reconciliation checkpoints, not quotas
or acceptance criteria. Preserve existing main story IDs unless a taxonomy change
is explicitly requested; classify any previous unmerged additions before retaining them.

Report at four checkpoints: baseline and ownership ready; inventory and failure
causes known; reviewed candidate ready; final validation and remaining decisions.
During active work, keep user updates concise and state what changed or became
clear. Use compact task status retrieval rather than repeated full chat reads.

Re-estimate remaining work after P2/P3. Parallel work reduces independent analysis
time, but integration, shared test resources, and product decisions remain sequential.
Do not promise a speedup proportional to agent count.

Planning review: two read-only agents reviewed ownership/coverage and MCP/testing
coordination. Their recommendations are incorporated above. No execution chat or
implementation worker has been started as part of this plan-writing turn.

## Execution handoff — 2026-10-11

The three authorized execution chats and their bounded workers delivered reviewed patches. The parent integrated them in a dedicated origin/main checkout and completed the local verification/reporting pass. See [the work item](./DESIGN-SYSTEM-PR-109-origin-main-storybook-full-audit.md) and [HTML report](../../completed/design-system/2026-10-11-storybook-main-alignment-report.html) for the exact candidate and evidence.

All enumerated source rows are classified. Confirmed story/MCP discrepancies in this candidate are resolved. Remaining app composition/state coverage and main product constraints are explicit partial outcomes, not silently waived complete criteria. Human acceptance is pending. No commit, push, merge, deployment or public sharing occurred. The three lane checkouts and the integration checkout remain available for review.


## 2026-10-11 approved Home runtime follow-up

The earlier Storybook alignment report remains a historical snapshot before runtime changes. The user subsequently approved four actual Home empty-state alignment fixes without commit, push, or deployment. See [HOME-PR-014 local follow-up](../home/HOME-PR-014-home-workspace-and-personal-work.md). This follow-up adds three Home stories; the earlier 489-story report is not the current story count or evidence for these runtime changes.


### 2026-10-11 Guided visual acceptance

- 승욱 accepted the corrected customer table ("고객 테이블은 이대로 하고 다음 검토할 화면 보여줘"). See PR-088 for its approved spacing correction and verification.
- 승욱 accepted the chart amount summary/details representative ("차트 금액 상세도 이대로 하고 다음 검토할 화면 보여줘"). This covers the synthetic `features-chart-order-finance--summary-and-details` screen reviewed together.
- Next displayed representative: patient context bar memo states. Remaining screens and known product constraints are not implicitly accepted. These decisions are local visual acceptance, not authorization for commit, push, or deployment.

### 2026-10-11 Representative caller-composition correction

승욱 requested that EmrPatientContextBar follow the actual `origin/main` chart composition, that other representative screens be checked for the same omission, and that existing app code remain unchanged. Commit, push, and deployment remain prohibited. The fresh baseline is `66c1b4c8cba72d342657839425d627c4cbc7bc1e`.

| Representative | Source comparison and result |
| --- | --- |
| Patient context bar | The earlier generic fixture omitted the actual chart wrapper, full patient/guardian metadata, full default vitals and 주치의, and added history/device actions absent from the caller. New `ChartComposition`, `ChartReadOnly`, and `ChartNarrow` stories reuse `ChartPatientContextBar`, its header and profile cards, the workspace vital formatter, and the caller's four memo entries. Existing generic stories remain documented as API examples. |
| Customer lists | The earlier two-column fixture was a table interaction example. New `PatientList` and `GuardianList` use the actual row mappers and column factories, with all 10 patient and 7 guardian data columns. Synthetic rows and local row activation replace data loading and profile navigation. Previously accepted table spacing remains unchanged. |
| Chart finance | The representative now includes caller-equivalent detail toggle, Escape close and accessibility summary. The saved summary is scoped to the saved representative so `SaveError` cannot inherit contradictory text. Stale/refreshing/requesting remain explicitly documented API-only examples. |
| Home | Existing populated board/list/mine representatives reuse the actual component and relevant props. This inspection found no equivalent composition omission in that bounded set. Prior approved Home runtime changes are preserved. |
| Queue continuity | `PatientQueueContinuity` remains a generic unit fixture; grouped examples use simplified order content. A complete `OrderQueue` patient-grouping/selected-patient composition is not covered. This is a remaining app-composition coverage gap, not verified parity. |

Only the three story files and this execution record changed in this follow-up. App runtime files, previous WIP and prior visual acceptance remain preserved. No live patient, guardian, billing, persistence or remote-provider operation was used. The new representative compositions await visual acceptance.

Validation: the broad native Storybook run passed 496 of 497 stories initially; the existing SOAP `responsive-narrow-320` story failed transiently and passed its focused retry. The changed patient/customer/finance stories passed focused checks; both finance summary and error examples passed again after the final summary correction. TypeScript, scoped ESLint, documentation links and whitespace checks passed. Native story checks ran with accessibility scanning disabled; these results do not constitute a full accessibility audit. Browser evidence covers the standard-width chart context and actual patient/guardian lists, not all responsive widths, profile-hover states or server workflows.

Evidence is retained locally in `/private/tmp/clair-representative-parity-20261011/`: before-file hashes, native test JSON, typecheck logs, screenshots and `preservation.json`. The earlier HTML report remains the pre-follow-up snapshot; its 489-story results do not validate this follow-up. The local review server remains available on port 6006.

### 2026-10-11 All patient-context stories aligned to the chart caller

This supersedes the patient-context generic-fixture exception above. 승욱 authorized all eight EmrPatientContextBar stories, Narrow Overflow and Docs Controls to follow the actual `origin/main` chart composition, with hover/keyboard verification and no app-code changes or remote delivery. A fresh fetch still resolves main to `66c1b4c8cba72d342657839425d627c4cbc7bc1e`.

All eight existing story IDs now render one `ChartContextExample` using the actual chart wrapper, fixed main header, profile cards and default vital formatter. The old history/device controls and simplified generic fixture are removed. `ChartReadOnly` uses the historical-chart disabled reason; `UnavailableActions` uses the inactive-encounter reason. `MemoStates` shows the caller's empty memo fallbacks, with the same empty patient notes used in the hover card. `PatientOnly` retains its ID but now represents an unassigned guardian with the caller's fallback labels; vitals, memos and doctor remain present.

The narrow wrapper uses one shrinkable grid column. Browser measurement confirms the former 1,132px bar now stays at 420px, with a 332px scroll viewport and 1,806px long-name content. Keyboard end/start actions reach the edges, update the disabled controls, and expose the doctor at the end. Docs now exposes only five consumed scenario controls: `vitalState`, `narrow`, `guardianMissing`, `longPatientName`, and `emptyMemos`. Their descriptions match their behavior; the obsolete `minimal`/`unavailable` controls are removed. Browser changes to all five controls updated the primary example, and Reset controls restored the default state.

Verification:

- All 8 affected native story tests passed. Tests cover patient/guardian hover card content and closure without activation, empty notes in the empty-memo hover card, Tab/Shift+Tab ordering, Enter/Space activation, disabled vital guards, keyboard memo open/close, and narrow scrolling/doctor visibility.
- The final full native Storybook run passed **497/497** in one run. The initial hover assertion raced the opening transition; waiting for visibility fixed the test without changing the component or weakening the assertion.
- TypeScript, scoped ESLint, documentation-link and whitespace checks passed.
- A read-only review caught inconsistent empty patient notes between the card and memo. The fixture now shares the same notes value, as the app caller does.
- Native tests ran without automated accessibility scanning. The existing runtime custom memo trigger still drops injected ARIA/ref props; focus return and a complete accessibility pass are not claimed. No story-only wrapper repairs or conceals that app defect.

Only `patient-context-bar.stories.tsx` and this record changed in this follow-up. A before/after hash inventory preserves app runtime, other stories and previous WIP. Local evidence remains in `/private/tmp/clair-patient-context-fix-20261011/`; the previous HTML report is a historical snapshot. The preview server remains available on port 6006 for acceptance. No commit, push, merge, deployment or public sharing occurred.

### 2026-10-11 Patient-context acceptance and next-screen preflight

승욱 accepted the corrected EmrPatientContextBar family ("EmrPatientContextBar는 이대로 하고 다음 검토할 화면 보여줘") and requested a complete child-story comparison before showing the next representative. This is local visual acceptance, not delivery authorization.

The next report representative is PatientQueue. Fresh `origin/main` is still `66c1b4c8cba72d342657839425d627c4cbc7bc1e`. Both children, `Continuity` and `Grouped`, were inspected against their source and the actual dispensing and lab/imaging callers. The runtime files match main; the fixtures do not reproduce a full app panel. `Continuity` uses synthetic add/hide/revoke controls and a local selected-id output without the app's title/date/search/sort/filter header. `Grouped` uses the shared patient content/toggle, but its order-mode child is only "기존 오더 보기", not the caller's actual order queue. Docs describes local synthetic examples and has no configurable props. These differences remain open; neither story is accepted as full app-composition parity.

Both focused native story tests pass (accessibility scanning disabled). They verify their bounded continuity/grouping contracts only. No story or app implementation changed during this preflight; the grouped representative is displayed for review.

### 2026-10-11 Queue retained; dialog-shell review next

승욱 subsequently said "두 예시는 잘 맞는 거 같아서 넘어가자". The pending PatientQueue implementation was stopped before any story or app edit. Both existing queue examples are retained by that decision; the previously documented full-panel composition gaps remain facts and are not reclassified as verified parity.

The next existing-failure representative is EmrDialogShell Confirm. All five child variants were checked against the current main shell: confirm, form, wide-form, registration-form and registration-confirm are existing runtime variants, and `dialog-shell.tsx` has no difference from origin/main. All five focused native story tests pass; only Confirm has a play test for opening and cancel closure. Bodies and the save button remain synthetic shell examples, not complete feature forms or save workflows. This review does not claim feature-call-site parity for those synthetic contents. No story/app changes or remote delivery occurred.

### 2026-10-11 Dialog-shell acceptance and popover preflight

승욱 accepted EmrDialogShell as shown and requested the next representative after inspecting all child examples. This records local visual acceptance only.

Next is EmrPopoverShell: `Default` and `CompactFields` both use the unchanged origin/main runtime shell and supported widths/densities. Fresh main remains `66c1b4c8cba72d342657839425d627c4cbc7bc1e`. These are synthetic selection/input examples, not complete chart quick-order search or patient-memo compositions. `CompactFields` inherits the `bodyScroll` control but does not pass it to its shell, so that control does not affect that example. This remains an explicit story discrepancy; no implementation change was authorized in this review turn. Both native story checks pass; Default covers selection/closure/reopen persistence, while CompactFields has no play and its pass is render-only. No app/story code or remote state changed.

Browser follow-up: CompactFields' trigger did not produce a visible popup through click or Enter, including after reload. No error explaining the cause was captured. Its render-only pass is not evidence of successful opening; the cause remains unverified. Default is displayed for review. These observations do not authorize an app or story fix.


### 2026-10-11 Popover stories aligned to real callers

승욱 authorized correcting both EmrPopoverShell examples, CompactFields opening and its missing bodyScroll wiring, while preserving app code and prohibiting commit/push/deployment. Fresh origin/main remains `66c1b4c8cba72d342657839425d627c4cbc7bc1e`.

- `Default` now renders the actual `ChartPatientContextBar` in the fixed main header, including synthetic patient/guardian details, profile previews, all default vitals, doctor and the caller's four memo entries. The actual private PatientMemoPopover renders its own shell; all memo rows remain read-only as in main, with 수납메모 disabled. Profile/vital activation only records local receipts.
- `CompactFields` now renders the actual `EmrHistoryFilterPopover` with the billing caller's 직접 trigger, required date range, draft/reset/cancel/apply ownership and applied-period removal chip. It starts from a fixed synthetic custom range. It does not invoke billing queries or payment/persistence operations.
- The history component owns `bodyScroll=true`, compact density, md width and end alignment. Browser computed styles confirm overflow-y auto, max-height 288px and width 280px. The short date form does not require a visible scrollbar. Obsolete generic title/width/density/bodyScroll Controls were removed; Docs describes both fixed caller compositions.
- These two examples cover the named popover surfaces, not complete chart/billing workflows or the workspace-switcher and quick-order-search callers.

Opening investigation: the old CompactFields raw-click opening probe passed in a native focused test, despite the earlier manual-browser failure. Source inspection confirms Base UI supports uncontrolled Popover; neither missing controlled state nor the side-panel close hook was proven to cause the earlier failure. The replacement follows the real caller's controlled state and has verified mouse, Enter and Space opening. No underlying app defect is claimed fixed. The existing chart memo trigger's ARIA/ref limitation also remains unchanged.

Verification: both changed stories passed focused native and direct Vitest browser checks (2/2). Tests cover memo content/read-only rows and mouse/Enter/Space opening, Escape and close-button dismissal; billing required/invalid-date guards, draft cancellation, Escape rollback, apply persistence, reopening, removal and computed body-scroll styles. The final native suite passed 497/497 with automated accessibility scanning disabled. TypeScript, scoped ESLint, documentation links and whitespace checks passed. Browser Docs shows accurate descriptions and no unused Controls; manual CompactFields close/reopen succeeds.

Only `src/components/emr/popover-shell.stories.tsx` and this record changed in the follow-up; before/after file hashes preserve app runtime and all earlier WIP. Evidence is local in `/private/tmp/clair-popover-parity-20261011/`. The earlier HTML report remains a historical snapshot. Visual acceptance is pending. No commit, push, merge, deployment or public exposure occurred.


### 2026-10-11 Popover acceptance and row-action preflight

승욱 accepted the corrected EmrPopoverShell examples as-is and requested the next screen after checking every child story against actual main callers. This is local visual acceptance only. The next entry in the original twelve-failure review sequence is EmrRowActionMenu. Fresh origin/main remains `66c1b4c8cba72d342657839425d627c4cbc7bc1e`.

Both children (`Default`, `NonDestructiveOnly`) use the unchanged main runtime component, but their contents are generic synthetic actions. Default includes 상세 보기, 샘플 복사, an unavailable entry and 샘플 제거. NonDestructiveOnly removes only the destructive-looking entry. Neither recreates a complete actual app caller. All three Controls are consumed; no analogous missing-prop wiring was found.

Actual callers differ: customer rows provide 상세 보기/차트 보러가기/카카오톡 발송, with the latter two showing unavailable-feature feedback; chart queues provide status-dependent 호출하기, 차트 열기, 담당하기/담당자 보기 and disabled patient/guardian actions; staff work cards use compact density and 업무 보러가기; hospital schedules use compact 복제/휴무 전환 or 해제/삭제. Hospital Order and Order-set tables provide actual detail/duplicate actions. Membership menus vary by row and permission. These source files and the shared runtime component match main. Both current stories use default density and do not cover the compact presentation or these caller-specific states.

Both focused native tests pass with accessibility scanning disabled. Default verifies opening and a local action receipt; NonDestructiveOnly has no play test, so its automated pass is render-only. Manual browser inspection opened NonDestructiveOnly and confirmed its three entries, disabled state and absence of a remove entry. Default is displayed for review. No story/app code or remote state was changed; only this acceptance/preflight record was updated.


### 2026-10-11 All row-action stories aligned, including compact

승욱 authorized aligning every EmrRowActionMenu child to actual origin/main callers, adding compact examples and preserving app code without commit/push/deployment. Fresh main remains `66c1b4c8cba72d342657839425d627c4cbc7bc1e`.

The two original IDs are retained. `Default` now renders the actual customer patient table with its ten data columns; `NonDestructiveOnly` renders the guardian table with its seven data columns. Both use the real row mappers and column factories with synthetic records, and the private CustomerRowActionMenu is reached through CustomerDataTable. The actual 상세 보기/차트 보러가기/카카오톡 발송 labels, descriptions, 24px trigger, 224px menu and unavailable-feature alerts are preserved. Opening the menu or requesting an unavailable action does not open the row. 상세 보기 records a local active-row result instead of mounting a profile drawer.

New `CompactWork` and `CompactUnavailable` render the actual ProfileAssignedWorkCard. The enabled menu uses the real WorkNavigationDialog for cancel/confirm; final navigation records a local receipt. The unavailable example supplies navigationAvailable=false and href=null. Its menu entry remains disabled, blocks pointer interaction and cannot open the dialog through keyboard activation. Both preserve the actual 160px compact menu, 32px menu item and absence of separators/descriptions. Generic synthetic copy/remove items and unused Controls were removed. Docs names each actual caller and clarifies that other hospital/queue/membership menus and full server workflows are not covered.

The customer fixture includes the existing Next app-directory context, synthetic registration-lookup/write failure responses, and query/layout/fetch restoration. An initial missing context caused useParams to be null; the story parameter fixed it without touching app code. The initial disabled-item test attempted a pointer interaction blocked by the real CSS; it now verifies pointer blocking plus keyboard non-activation instead of bypassing that behavior.

Verification: direct Vitest browser execution passed all four changed/new stories. The final native Storybook run passed **499/499 unique stories** with accessibility scanning disabled. Coverage includes actual menu entries and dimensions, local detail activation, real unavailable alerts, mouse/Enter/Space opening, Escape focus return, work-dialog cancel/confirm and unavailable-action guards. TypeScript, scoped ESLint, documentation references and whitespace checks passed. Read-only review found no actionable parity or side-effect issues. Browser inspection covers all four examples. This does not claim a full accessibility audit or live-data workflow validation.

Only `src/components/emr/row-action-menu.stories.tsx` and this record changed in the follow-up. A before/after hash inventory preserves runtime and earlier WIP; evidence remains in `/private/tmp/clair-row-action-fix-20261011/`. No commit, push, merge, deployment, remote data change or public exposure occurred. Local visual acceptance remains pending.


### 2026-10-11 Row-action acceptance and density-selector preflight

승욱 accepted all four corrected EmrRowActionMenu examples as-is and requested the next screen after comparing every child example with actual origin/main callers. This records local visual acceptance only. The next original review entry is EmrTableDensitySelector, with one child: `Default`. Fresh main remains `66c1b4c8cba72d342657839425d627c4cbc7bc1e`.

The story uses the unchanged main selector and its three actual choices: 좁은 간격, 기본 간격 and 넓은 간격. Both Controls are consumed; changing initialValue remounts its local state. However, the composition contains only the selector and a local current-value receipt. Actual CustomerDataTable connects the same density state to both its header selector and EmrDataTable. The story has no table, so it cannot demonstrate row-height changes. Actual lab-result and chart callers also supply smaller trigger styles that this example does not cover. Runtime, shared density definitions and the inspected customer/chart/dispensing/lab caller files match main.

The focused native story test passes. Its play covers opening and selecting compact with a visible local-value check; it does not verify all three row heights, keyboard flows or a complete app composition. Default is the next review screen. No story/app code or remote state changed; only this acceptance/preflight record was updated.


### 2026-10-11 Density selector with real table and caller-size comparison

승욱 authorized actual-table density examples and the lab/chart small buttons, preserving app code and prohibiting commit/push/deployment. Fresh origin/main remains `66c1b4c8cba72d342657839425d627c4cbc7bc1e`.

`Default` now mounts the actual CustomerDataTable with its real customer row mappers, column factories, header, pinned identity, selection and footer. Synthetic data and the existing registration request guards keep this local. The density state is owned by the actual component and reaches its actual EmrDataTable.

`LabCompact` and `ChartCompact` preserve the exact main caller trigger className and connect it to the shared EmrDataTable with the same synthetic customer rows and actual column definitions. These are explicitly labeled trigger-size/density comparisons, not the complete private lab-result or chart-order tables. The latter renderers and columns are private and coupled to feature state; no runtime export or Storybook-only compiler transform was added. `ImagingStandard` preserves the actual imaging caller's default 32px trigger and initial comfortable density; imaging does not use the lab compact trigger. Obsolete initialValue/label Controls were removed in favor of caller-owned settings.

All four play tests measure actual DOM row heights at compact 36px, standard 40px and comfortable 52px, with two rendered rows each. They verify the selected radio state, mouse/Enter/Space opening and selection, Escape dismissal and focus return. Lab additionally verifies its 82×28px trigger and 12px icon; chart verifies the actual control-height token, 12px text and 8px horizontal padding. An initial test assumed selection closes the menu; the real radio menu remains open, so the test now checks selection/height first and dismisses with Escape. This preserved runtime behavior.

Verification: a fresh direct Vitest browser run passed 4/4. The final native suite passed 502/502 stories with no failures and accessibility scanning disabled. TypeScript and scoped ESLint passed. No full accessibility or live feature workflow validation is claimed. Evidence is local in `/private/tmp/clair-density-fix-20261011/`. App code and earlier WIP remain preserved; only this story file and this record are in the follow-up scope. Visual acceptance is pending. No commit, push, merge, deployment or external data action occurred.

Final browser review confirmed all four renders, lab row heights at 52px after selection, chart trigger height 28px with 12px text/8px padding, and imaging trigger height 32px. Read-only review found no actionable issues. A before/after hash inventory found exactly the density story and this record changed, with no unexpected paths. Documentation references and whitespace checks passed.


### 2026-10-11 Density acceptance and base Dialog preflight

승욱 accepted all four EmrTableDensitySelector examples as-is and requested the next review with every child compared against actual origin/main. This is local visual acceptance only. The four original EMR shared-component failure representatives have now been reviewed; the next base-UI representative is Dialog. Fresh main remains `66c1b4c8cba72d342657839425d627c4cbc7bc1e`.

All three children (`Default`, `ConfirmAction`, `WithoutCloseButton`) use the actual unchanged Dialog primitives. All four Controls are consumed. Their title, description and body are synthetic, and the confirm button has no callback. Actual WorkNavigationDialog uses a selected item, controlled state, a guarded confirm handler and an 이동 label; EmrConfirmDialogContent/EmrDialogShell override width, spacing, custom close action and feature-owned footer callbacks. The global command palette hides the stock close button for its search composition. These actual caller files and the base Dialog match main, but the three stories are primitive API examples, not those complete feature compositions.

All three native focused checks pass; only Default has a play that verifies opening. ConfirmAction and WithoutCloseButton have render-only automated checks. Manual WithoutCloseButton inspection confirms the X is absent and Escape closes the dialog with focus returning to its trigger. Therefore its footer-only explanatory copy is incomplete: hiding the X does not require a footer choice. This discrepancy is recorded without modifying the story or app. Default is the next review screen. No code or remote state changed in this preflight.


## 2026-10-11 Caller-parity wave 2 — GPT-6.1 Max parallel execution

승욱 requested multiple execution chats using GPT-6.1 Max, with 루멘 integrating/reviewing all work and presenting only necessary human decisions. This supersedes one-screen-at-a-time review as the operating approach. Existing local-only and no-runtime-edit boundaries remain.

| Lane | Chat | Ownership |
| --- | --- | --- |
| A | Storybook 정렬 A — UI 기본 컴포넌트 | 33 UI story files and every child; all UI primitive sources |
| B | Storybook 정렬 B — EMR 공통 컴포넌트 | 45 EMR story files and every child; shared EMR caller compositions |
| C | Storybook 정렬 C — 기능별 화면과 앱 조합 | 27 feature TSX story files and companion fixtures; feature/app/shell source coverage |
| Coordinator | 루멘 | Freeze, WIP preservation, integration, harness, all candidate tests, independent review and human-decision packet |

After A completed its 125 original children, A also audited the 42 app/core/shell source files and took disjoint implementation ownership of `src/stories/app-shell-caller-parity.stories.tsx` and its adjacent story-only fixture. A additionally owns the new `src/stories/auth-caller-parity.stories.tsx` and adjacent fixture for AuthGate, invite acceptance, workspace onboarding and the tenant approval surface. C retains its existing feature-story paths and consolidates the cross-source evidence. Existing feature coverage from A/B must be included; a file absent from C's own story roots is not automatically uncovered. Server route wrappers, registries and icon exports receive explicit source/usage classifications rather than invented browser execution claims.

After B completed its 200 shared EMR examples, B also received reconciliation of 12 hospital-admin source rows and disjoint implementation ownership of `src/stories/hospital-admin-caller-parity.stories.tsx` and its adjacent story-only fixture. C retains its feature paths and consolidates the source evidence. This distributes feasible missing ancestor fixtures across the same three execution chats without introducing runtime writers.

Each existing isolated lane is seeded from the current 502-story candidate after preserving its previous WIP. The baseline is fresh main `66c1b4c8cba72d342657839425d627c4cbc7bc1e`, plus explicitly accepted local Home/table runtime overlays that must not be reverted. Model is set through the chat tool to `gpt-6.1-sol` with `thinking=max`, not repository configuration. Parent model remains unchanged. Lanes execute directly without extra subagents.

Execution: (1) enumerate every indexed child and owned runtime source; (2) compare actual APIs/callers, full fields/actions/layout/states and Controls/Docs; (3) fix source-backed story discrepancies with deterministic local fixtures; (4) integrate only allowlisted changes against seeded hashes; (5) run focused then full native/browser/type/lint/docs/MCP checks and review meaningful states; (6) produce a short Korean decision packet only for genuine product/visual ambiguities or app-code dependencies. Passing rendering alone does not prove parity; generic-description disclaimers do not replace feasible fixes. Existing accepted families remain preserved and receive regression inspection rather than redesign.

No commit, push, PR, merge, deployment, real data action or public sharing is authorized. No runtime product file changes are included. If faithful coverage requires a product API change, finish the concrete proposal and independent work before surfacing that decision. Exact execution brief, per-lane snapshots and matrices are retained locally at `/private/tmp/clair-storybook-parity-wave2-20261011/`. Completion requires all 502 initial IDs retained/classified, every new ID verified, source coverage with explicit bounded exceptions, zero unresolved change-induced failures, and a preserved-runtime/WIP proof.


### Caller-parity wave 2 completion

The three existing GPT-6.1 Max lanes completed their assigned local work. Coordinator integration and independent review are complete. Final evidence is 699/699 native passing examples,502 retained seeded IDs,231 required runtime UI source classifications without pending rows,531 Props checks,clean type/lint/docs/build checks and12/12 dev plus12/12 static targeted browser cases. The reboot recovery boundary and initial failures are retained. See the [final decision report](../../completed/design-system/2026-10-11-storybook-caller-parity-report.html) and current work item for exact candidate hashes and limits. Only five product choices and user acceptance remain; no remote delivery is authorized or performed.
