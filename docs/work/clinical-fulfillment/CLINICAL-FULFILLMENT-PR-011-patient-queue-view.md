---
id: CLINICAL-FULFILLMENT-PR-011
status: in_progress
area: clinical-fulfillment
priority: P1
source_docs:
  - docs/product/domain/encounter-multi-chart-contract.md
  - docs/engineering/data-model/order-fulfillment-handoff-contract.md
  - docs/work/lab/LAB-PR-001-result-workspace-structure.md
updated: 2026-10-10
---

# Patient View For Execution Queues

## Goal and authorization

승욱 approved the interactive patient-queue prototype, deployment-based preflight,
and implementation on 2026-10-06. Commit/push/PR/main delivery was requested.
Base Production: ce7a2e94d13521c1b54ba9c39c88ea3d3aa3a1d7.
Hosted SQL apply and exact-candidate release gates remain separate preparation steps.
Only synthetic local fixtures are authorized for database verification.

## Scope

- Add 오더별/환자별 view switching to lab, imaging, combined dispensing/treatment sidebars.
- Preserve existing order UI, type counts/search, exact task selection and detail/actions.
- Group by authorized workspace/day/patient identity across visits and source charts.
- Keep raw urgency/status/request timestamps; priority/latest group sorting and existing
  order sort within equal urgency/status ranks. Missing patient identity stays separate.
- Preserve selection/scroll during mode switching and realtime API refresh; show hidden
  selection and new-work notices. No fake scenario controls or business writes.
- Add nullable originChartId/originChartCreatedAt to existing scoped v2 read RPC/DTO.
  Use orders.origin_chart_id and exact scoped SOAP identity, never encounter as chart.
  Preserve actual chart creation metadata; no fabricated chart numbers, avatars, or origin backfill.
  The approved visual follow-up removes chart labels from patient queue cards.
- Preserve server permissions, workspace/date scopes, immutable snapshots and mutations.

## Out of scope

Other modules, full sidebar replacement, detail/table/navigation redesign,
new statuses/permissions/settings, provider integration, real patient data, DB row writes.

## Done criteria / verification

Same-name patients remain separate; one patient can have multiple visits/charts; legacy
origin stays null; source joins preserve every row and sourceSnapshot. Existing date,
permission and private realtime boundaries remain. Toggle never changes task selection
or sends mutations. New rows do not steal the reading position.

Focused grouping/API/browser/SQL fixture checks; typecheck, lint, build, docs/UX/secrets,
diff check; private review and exact-candidate Release Check/Ready Preview before release.
SQL must pass on isolated local synthetic database before hosted migration approval.

## Implementation evidence

- Implemented opt-in shared patient grouping for all three execution sidebars.
  Existing order cards/detail/actions and initial module-selection policies remain.
  Patient wait sort uses raw creation time; known assigned IDs with unresolved
  names show 확인 불가 in the new view rather than imply unassignment.
- Raw identity/priority/status/assignment/time metadata survives adapters. The v2
  reader adds scoped nullable origin metadata without modifying sourceSnapshot.
- Reviewed denial, paused filtering, assigned-without-display-name, simultaneous
  source chart, and existing-result-ID mapping boundaries. View tooltip follows
  the approved prototype. Mixed dispensing/
  treatment HTTP denial takes precedence over network/non-JSON/general failures.
- Local SQL clone `queue_patient_20261006` of the existing synthetic fixture only:
  1202 lab / 1200 dispensing / 1200 treatment selected-day rows; all original
  fields, payload/order/status/date/history equivalence, actor/role/workspace/
  inactive-member denial, grants and no work writes passed. Exact/missing/
  foreign/legacy chart projection proof passed. Original fixture DB unchanged.
  Rollback/reapply rehearsal passed; the restored reader exactly matched the
  hosted baseline definition fingerprint.
- New model/API/browser checks: 16 tests passed; Storybook continuity and existing
  card checks: 4 passed. Existing fulfillment API/assignee/realtime checks: 31 passed.
  Existing lab/imaging/dispensing checks: 35 passed, one baseline vital-setting
  fixture failure reproduced against deployed source ce7a2e94 at the same
  disabled vital action (missing vital-settings mock; unrelated to queue UI).
- Local typecheck/build/docs/UX/secrets passed. Lint has no errors and five existing
  unused-variable warnings in unrelated scripts. Exact remote Release Check and Ready Preview remain delivery gates.
- Hosted read-only schema inspection found origin/chart timestamp columns present.
  Current v2 body exactly matches the repository baseline. Its definition MD5 is
  `54fffd02a769d97a4a807d8be6a9e104`; authenticated-only execution and scoped
  security-definer settings are retained. No hosted DDL or clinical data read.

## Hosted apply and release preparation

Target: connected CLAiR Supabase project `clair-emr-staging` used by this app,
not a retired fixed Vercel staging alias. Before apply, reconfirm the reader
MD5 above and origin schema; stop on drift. Apply only
`20261006052000_fulfillment_queue_origin_chart.sql` under explicit hosted approval.
No row/backfill/RLS/permission change. Apply before the app merge. Old app callers
ignore the extra fields. Use the adjacent rollback snippet to restore the baseline
projection if required; it changes no business data.

Production rollback candidate: existing Ready deployment
`dpl_BvCZKtKRSjcXTyVJiCvwu7zv7EDk`, source
`ce7a2e94d13521c1b54ba9c39c88ea3d3aa3a1d7`. Post-merge smoke: `/login`, then
synthetic/demo lab, imaging and dispensing queue view switching, exact selection,
type/search counts and denied/empty behavior without execution mutations.
PR/head SHA, exact Release Check, Ready Preview, and final approval packet are
recorded in the task delivery evidence after the candidate is committed.
The original feature was delivered in PR #940, merged as
`9ef8e51d9ae8eedaadf2c01c688349d1f648c7c2`. Its hosted projection and Production
delivery were approved separately in this task.

## Approved visual follow-up — 2026-10-06

승욱 approved the revised interactive prototype and explicitly requested commit,
push, PR, origin/main merge and Production deployment. The final browser comment
removes chart labels from patient cards. Baseline app/Production source:
`455e55071c257b3e167da71370b158ef3b4f9eb0`.

- Reuse the CDS pet toggle and 18px roundrect avatar with the existing pet fallback.
- Keep avatar left inset; align the tree at 28px and cards at 40px within the panel.
- Apply 4px between patient cards, 12px between patient groups, 2px between request
  and title, 4px before the footer, and 22px metadata/status badges.
- Omit a patient-card type badge only when its text duplicates the title. Retain
  distinct modality and 조제/처치 labels. Keep long text truncation and footer wrapping.
- Position the existing more-menu action at top/right 4px without inflating the
  request row. Preserve its menu, propagation guards, keyboard/focus and selection.
- Remove all patient-card chart label display. Keep origin DTO/API/DB metadata and
  exact work-item selection unchanged. No backend, migration, data or default
  order-card change belongs to this follow-up.

Focused stories and existing three-module browser checks cover duplicate labels,
menu actions, unchanged selection/URL/filter/permission behavior and no writes.
Exact candidate, release verification, preview, smoke and rollback evidence follow
after implementation checks.

The release candidate is rebased onto current `origin/main`
`fc2894de8057124b3c1c1dc2498df9d190bcd87e` (PR #942's separate hover-preview fix).
Preflight evidence: 12 queue model/browser checks and six focused Storybook stories
pass. The browser checks exercise lab, imaging and dispensing selection/URL,
filters, combined permission precedence and no-write behavior. Story interactions
cover more-menu actions without selecting the card. Actual Storybook DOM measurements
confirm 18px avatars with 6px radius, 4px card/header gaps, 12px group gaps,
8px card radius and 22px metadata badges. Production build, TypeScript, docs,
UX-copy and secret checks pass; lint has zero errors and five existing WP10 warnings.

Production smoke will inspect the synthetic Cheongdam lab, imaging and dispensing
queues and switch the view without executing clinical actions. Stop on an unexpected
candidate, failed exact Release Check, non-Ready Preview/Production or smoke failure.
Rollback candidate is the previous Ready deployment at
`https://emr-app-shell-prototype-hgx4jrcdi-mcso0s-projects.vercel.app`, source
`fc2894de8057124b3c1c1dc2498df9d190bcd87e`. Final PR/check/deployment evidence is
recorded in the task's delivery report.

Storybook 10.4.6's navigation mock omits the `ReadonlyURLSearchParams` export used
by the already-deployed panel context from PR #941. A Storybook-only alias reuses
its existing mocked hooks and Next 16.2.6's readonly params class. The alias runs
after the framework's mock plugin for both the iframe and Vitest. Production
imports/configuration and dependencies remain unchanged.


## Approved task-card badge follow-up — 2026-10-06

승욱 approved the final badge prototype and explicitly authorized implementation,
commit, push, PR, origin/main merge and Production deployment in this task.
Baseline origin/main and Ready Production source:
`24485eeae2c971868b2fb6eac0736f7edf6fa802`.

- Use the existing neutral side-panel status chip in patient view, matching the
  requester/assignee surface, typography, border and radius.
- Restore the existing `EmrSidePanelStateIcon` through the shared status resolver.
  The chip's existing icon wrapper sizes it to 12px. Preserve semantic state colors.
- Set icon-to-text spacing to 4px inside task-card chips in both grouping views.
  Scope the order-view spacing through the existing patient-grouping container;
  reception, billing, home and non-grouping chart cards retain their spacing. Preserve
  the existing 4px patient / 6px order gaps between chips and card geometry.
- App cards already omit chart labels in both views. Retain DTO/API/DB metadata.
  No data, schema, permission, queue behavior or other shared chip changes.

Verification targets: focused task-card/patient-queue Storybook interactions and
computed badge styles; existing lab, imaging and dispensing queue selection,
view switching, filter/permission and no-write browser checks; required release
preflight and exact-candidate Release Check with Ready Preview.

Production smoke uses the existing synthetic Cheongdam workspace. Inspect and
switch queues without executing clinical actions. Stop on candidate/main drift,
failed checks, non-Ready deployments or smoke failure. Rollback target is the
previous Ready deployment `dpl_HZqYjKooAxKsyDYKryFZPKb7dD4h`, source
`24485eeae2c971868b2fb6eac0736f7edf6fa802`. Candidate/PR/check, Ready deployment,
alias, smoke and rollback evidence will be reported after delivery.


Local badge verification: six focused Storybook stories and 12 existing queue
model/browser tests pass. The browser tests cover all three modules, exact
selection/URL, view switching, hidden selection/filter recovery, combined denial
precedence and no fulfillment writes. Actual Storybook DOM confirms chip height
22px, icon 12px, inner gap4, white surface/8%-black border and text `#525252`.
Long names truncate and the footer wraps; menu actions retain selection guards.
A non-grouping card still has its original gap2/outer gap6. Independent read-only
review confirms grouping-container scoping and no other-screen changes.

TypeScript, Production build, secrets, docs and UX copy checks pass. Lint has zero
errors and five pre-existing WP10 script warnings. The build retains the existing
Turbopack tracing warning from the docs reader. No API/DB/data changes are included.


## Approved minimal rule/presentation separation — 2026-10-10

승욱 approved the proposed local-only separation with identical UI/business
behavior, no folder moves or DB changes, and verification of sorting, selection
and scroll continuity. Existing WIP is preserved. This follow-up does not invoke
prior release or hosted DB approvals.

`PatientQueueRow` now contains rule metadata and explicit `assigneeSortName`,
without importing `EmrTaskQueueCardItem`. The shared UI owns
`PatientQueueDisplayRow`, which adds the existing card contract. Lab/imaging
and the common order-panel adapter copy the existing assignee name into the
rule input. Name → assigned ID → "zzzz" fallback, Korean comparison, urgency,
status rank, wait/request time and stable ID ties are unchanged. Generic grouping
retains each original input row and its extra display fields. The shared UI
still calls the existing helper; no new architecture layer or dependency.

Rule tests no longer require a full card fixture. A regression demonstrates
that changing card copy does not change explicit assignee ordering and that
metadata-only rows produce the same order. Existing card rendering, callbacks,
selection/scroll effects, server/API/DB/permissions and folder paths are intact.

Verification with bundled Node24.19.0:

- Temporary before/after comparison: 180 synthetic rows, 12 group/order/direction
  combinations and all sampled status/filter results are identical. Includes
  missing/empty names, unresolved assigned IDs, status aliases, invalid times,
  urgency, missing patient identity and separate workspaces.
- Focused Playwright18/18: six model checks; eight patient-view/denial checks
  for lab, imaging and combined dispensing/treatment; four queue-control checks.
  App runs use mock auth and intercepted synthetic API responses on port3108.
- Storybook PatientQueue2/2: exact selection across view toggles, hidden-selection
  recovery, new-row notice, reading-position drift under3px, and denied display.
- Related common order-panel stories4/4 and updated Overview1/1 also pass;
  total focused Storybook checks7/7. Catalog remains374 stories and passes
  integrity checking; docs check passes1107 files; whitespace checks pass.
- TypeScript and focused ESLint pass.
- AST comparison confirms all JSX subtrees in the three affected product UI
  files are identical to the before-change snapshot. Source hash comparison
  confirms no DB files or unrelated product sources changed in this follow-up.

This is local implementation and synthetic verification, not a new production
release or full design acceptance. Broader queue restructuring remains deferred.


## Isolated PR slice — 2026-10-10

승욱 authorized commit, push and PR creation for the recent documentation,
Storybook classification and minimal queue refactor only. After the dependency
inventory, 승욱 explicitly selected an independent slice excluding the earlier
uncommitted v1 catalog/recipe implementation. No main merge or Production action
is authorized by this follow-up.

Prepared from current origin/main in a separate managed worktree. The primary
checkout and its WIP remain untouched. The representative inventory lives in
component-ownership-rules.md; the standalone Overview contains only role/review
explanations with no v1-scope or recipe imports. Shared/feature profile descriptions
point to that owner and the shared profile title uses Design System/EMR.

Excluded: v1 catalog generator/scope/recipes, tokens, table sorting/spacing work,
other story additions, architecture docs/HTML, package/config changes, screenshots,
DB files and unrelated tests. Earlier local374-story results above describe the
primary checkout; this isolated candidate must use its own verification below.


Isolated candidate verification (base `a2ad386c`, Node24.19.0):

- Playwright18/18 on the clean worktree with mock auth and synthetic API fixtures.
- Focused Storybook31/31 on this worktree's local port6011, including the
  independent Overview, shared/feature profiles, queue continuity and order panel.
  The isolated index contains345 stories; prior local374-story WIP is excluded.
- Storybook build and CLI smoke pass. Browser inspection confirms the independent
  Overview and its link to the renamed shared Profile Panel.
- Full lint passes with five existing unrelated script warnings; typecheck,
  docs links and secret scan pass. No environment or package/config changes.
- Product queue patch is identical to the verified primary-checkout slice;
  original WIP stays in the primary checkout. Only this13-file slice is staged.

PR creation does not authorize merging to main. Automatic Preview verification
and exact remote head are reported in the PR/task delivery result.
