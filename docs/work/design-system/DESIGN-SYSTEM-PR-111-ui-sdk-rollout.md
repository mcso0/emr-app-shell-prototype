---
id: DESIGN-SYSTEM-PR-111
status: human_review
area: design-system
priority: P1
target_pr: "Local reservation/calendar filter preparation; notify owner before deployment"
created: 2026-11-16
source_docs:
  - docs/design/system/DESIGN.md
  - docs/engineering/current-status.md
dependencies: []
---

# UI SDK Behavior Adoption

## Goal And Boundaries

Adopt UI SDK where it removes repeated behavior or adds useful accessible
interaction in actual screens. Preserve CLAiR design, domain state, data reads,
validation, permissions, server enforcement, existing workflows and static UI.
This is not a wholesale library replacement or a claim that every control now
uses UI SDK.

Work starts in an isolated worktree at `c9754c4`. The primary checkout's WIP is
untouched. Local implementation, synthetic fixtures and verification are in
scope. Remote data/migrations, provider calls, merge, deploy and release
configuration changes are excluded. Reconcile the latest main before handing
off the candidate; upstream progressed through `ca3222a8` and `2cb16b4d` to `185f9013` during implementation.

## Foundation And Sources

- Exact npm `latest` versions: `@ui-sdk/react` and `@ui-sdk/core`
  `0.1.0-beta.3`. The separate `beta` tag is not silently adopted.
- React 19 is already installed. No default UI SDK theme or global provider is
  added. Only the documented `ui-sdk` cascade layer precedes existing CSS.
- Read the version-matched `node_modules/@ui-sdk/react/docs/llms.txt`, relevant
  component docs, `core.md` headings and `rendering.md` before extending these
  adapters. The package remains beta, so future upgrades require focused checks.
- Official sources: [installation](https://ui-sdk.dev/docs/react/installation),
  [composition](https://ui-sdk.dev/docs/react/parts-and-composition),
  [popups](https://ui-sdk.dev/docs/react/popups),
  [combobox](https://ui-sdk.dev/docs/react/components/combobox),
  [autocomplete](https://ui-sdk.dev/docs/react/components/autocomplete),
  [toggle](https://ui-sdk.dev/docs/react/components/toggle),
  [tabs](https://ui-sdk.dev/docs/react/components/tabs),
  [calendar](https://ui-sdk.dev/docs/react/components/calendar), and
  [listbox](https://ui-sdk.dev/docs/react/components/listbox).

## Implemented Families

| Family | Actual adoption | Ownership preserved |
| --- | --- | --- |
| Combobox | Shared CLAiR input/content/item adapters; four walk-in/reservation drawer/side-panel variants; existing-guardian registration | SDK alone owns list focus, active descendant, selection interaction, placement and dismissal. Features retain lookup/debounce/stale-request handling, selected IDs, vitals, dirty state, validation and workspace permissions. |
| Autocomplete | Shared free-text adapter and reused single breed field in patient forms | Arbitrary typed breeds remain valid. Do not coerce free text into a selected catalog ID. |
| Toggle groups | Shared LineTabs and SegmentedControl, including instruction filters, table/display-mode controls and calendar view controls | Preserve `group`, button `aria-pressed`, single non-deselectable selection, native disabled buttons and existing tokens/geometry. SDK adds grouped keyboard navigation. |
| True tabs | Chart SOAP overflow tab group | SDK owns roving focus and activation. Existing overflow measurement, More menu and one shared SOAP editor panel remain. |
| Calendar | Reception side-panel mini calendar and shared EmrDateNavigator popup used by Home, billing, lab/imaging and order queues | ISO dates, caller-owned operating date, today/selected/range colors, return action and 42-cell/27px geometry remain. SDK owns month/date keyboard navigation and proper grid/gridcell semantics. The shared popup retains 28px chips/244px width and now renders complete six-week months rather than truncating after 35 cells. |
| Listbox | Shared classification single-choice facets, diagnosis systems/disease groups and order catalog categories | SDK owns selection, typeahead and roving focus. Catalog reads/search, draft order/diagnosis selection, locking, reorder and TanStack result virtualization remain feature-owned. |
| Mixed overlay integration | SDK suggestions inside existing Base Dialog and retained module/page boundaries | No Base popup or input behavior wraps an SDK suggestion. SDK controllers close suggestions when their cached panel/page hides; content preserves owner metadata and page visibility. |

Same-value activation remains part of the adapters' callback contract. SDK value
change callbacks alone do not fire for reselecting an active facet/filter. The
wrappers preserve pointer and keyboard reactivation used to reset child filters,
clear catalog search or reopen collapsed history groups, with callback-count
regressions to prevent duplicate notifications.

Patient lookup also preserves selection actions when the same patient is chosen
again. The feature commits once on the SDK's item-press dismissal, separating
selection actions from value changes. SDK composition guards prevent Safari
keyCode 229 from triggering premature keyboard activation.

Existing hooks are deliberately not replaced with SDK async loaders: their
workspace/authentication, cancellation, debounce, error and selected-record
contracts are already implemented and tested. SDK receives their results with
client filtering disabled.

## Family Evaluation And Retained Owners

| Families considered | Decision for this candidate |
| --- | --- |
| Dialog, alert dialog, popover, drawer/sheet, menu, tooltip | Retain working Base shared primitives. They implement page visibility, cached-panel actions, focus return and permission workflows. Verify mixed SDK nesting rather than create a competing global overlay system. |
| Select, checkbox, radio, switch, basic toggle and profile tabs | Retain working Base adapters. Their state/validation contracts are already centralized; replacement has no demonstrated efficiency gain. Profile tabs also intentionally skip disabled tabs, unlike SDK Tabs' discoverable-disabled policy. |
| Field, label, input, textarea, number/password/OTP/time/date input | Retain existing native/Base validation and form contracts. Add SDK behavior only to actual suggestion fields. Do not move domain validation or timezone/min-date rules into a new form layer. |
| Multi-breed chip input | Evaluated and reverted this local conversion. Beta SDK controlled `submitOnSelect` reads the pre-render query for partial-label selection, while value-change alone misses exact-label activation. Compensating refs/event glue make this one-off form less simple. Keep its working native/Base behavior and add preservation regressions; do not force SDK usage. |
| Other date pickers and full scheduling views | Shared simple day picking adopts SDK Calendar. Keep specialized date/range/business-hours behavior and appointment/calendar interaction models; those contracts are not generic day selection. |
| Command and SOAP editor menus/toolbar | Retain cmdk and BlockNote-owned behavior. SOAP toolbar has an explicit initial style tab stop plus overflow More fallback; ready SDK Toolbar starts at the first item and cannot preserve that contract without a second custom focus layer and trigger rewrites. Editor selection/IME, command execution and layered focus stay with their existing owner. |
| Chart diagnosis/order result search | Facet lists adopt SDK. Keep diagnosis draft multi-toggle/reorder and virtualized order result search, locked source keys, set-configuration queues and return focus. SDK Combobox would require synchronization glue rather than remove those feature contracts. Ordinary text filtering remains caller-owned. |
| Table/data grid, pagination, sorting/filter engine and virtualization | Retain TanStack Table/Virtual and server query contracts. Shared segmented/line controls adopt SDK without replacing table state or static table markup. |
| Scroll area and resizable split panels | Retain tested Base ScrollArea and react-resizable-panels/custom chart persistence contracts. No evidence justifies swapping their functioning integrations. |
| Drag/reorder, attachments, image/PDF zoom, editor | Retain dnd-kit, existing attachment/provider boundaries, PDF/zoom and BlockNote implementations. SDK is not a reason to rewrite specialized behavior. |
| Toast, progress/loading, avatar, badge, separator, card, static typography/layout | Retain Sonner and existing primitives/tokens. No speculative SDK wrappers for static or already-efficient elements. |
| Tree, waterfall, carousel, color picker, rating, navigation menu and other catalog families | No corresponding repeated active requirement identified for this candidate. Do not introduce unused component families or new product behavior. |

## Verification Scope And Known Limits

Required: focused interaction stories, actual synthetic reception/chart flows,
changed-file lint, full typecheck, production build, visual geometry review,
doc links, clean diff and latest-main reconciliation. Do not mark full rollout
complete merely because the first adapters compile.

Observed so far:

- Focused shared/feature stories cover keyboard selection, disabled options,
  native disabled filters, query retention/clear, loading/error, page-hidden
  closure, mixed existing dialogs, SOAP overflow, calendar date/month/return
  and diagnosis filtering/reorder/read-only behavior.
- Synthetic actual-screen reception walk-in/reservation creation and all three
  lookup-state flows passed, as did existing-guardian registration and retry.
- Actual SOAP overflow keyboard test and catalog loading/skeleton test passed.
- An unchanged-baseline test expects redundant display-label lookup requests
  (`>=2`) but receives `1`; reproduced at the original module and left outside
  implementation scope.
- One older chart catalog add test depends on an unstubbed catalog and reaches
  permission denial in this isolated environment. Synthetic catalog-specific
  tests are used instead; do not weaken authorization or add live credentials.
- Mac local test startup requires polling to avoid watcher exhaustion and
  browser process permission outside the restricted shell sandbox. The
  original Storybook remains untouched; rollout preview runs locally on 6007.

- Baseline calendar and test files reproduce the existing reception header
  lookup failure for `26.05.08 (금) 표시 중`. The current header has a different
  accessible label. Its behavior is not changed to satisfy obsolete selectors.
  The new actual-calendar regression instead verifies ISO route changes,
  calendar/queue reads, return action, 42 cells, 27px cells and keyboard selection.
- The related 108-row catalog test now disambiguates header vs quick-add triggers
  and checks the unchanged, source-backed 8px result inset rather than expecting
  zero. No result CSS changed.

## First Tranche Local Evidence — 2026-11-16

- Code candidate `ebca45f066c3b638b9aa93b1a8243589018dfe75` is cleanly
  rebased onto verified `origin/main` at `ca3222a8`. Upstream handoff/dispensing
  changes are preserved. The following evidence-only commit does not alter
  runtime source.
- **31/31 focused Chromium stories passed:** 30 across shared suggestion,
  toggle/line controls, calendar, SOAP tabs, diagnosis facets and reception
  lookup; plus the actual editable chart catalog keyboard/reset story.
- **12/12 actual-screen synthetic browser regressions passed:** walk-in and
  reservation creation, three lookup-state paths, guardian registration/retry,
  date return and keyboard/route/calendar/queue synchronization, SOAP overflow,
  catalog loading and 108-row catalog keyboard/search/virtualization.
- **7/7 selected Storybook MCP interaction runs passed**, including mixed
  existing dialogs, selected-facet/filter reactivation, hidden-page closure and
  actual chart category resets. This is not a claim of exhaustive axe coverage.
- Full `npx tsc --noEmit`, `npm run lint`, `npm run build`,
  `npm run docs:check` (1083 docs/agent files) and diff checks passed.
  The existing PRD dynamic-filesystem-tracing build warning remains out of scope.
- Visual review of synthetic calendar/lookup/autocomplete previews preserves
  CLAiR styling. Actual calendar geometry asserts 42 cells, 27px cells and a
  227px panel. Same-value callbacks are tested once per mouse/Enter/Space
  activation; IME tests include both composition flags and Safari keyCode 229.
- Next dev's generated-only AGENTS append is backed up outside the checkout
  and excluded. Primary-checkout WIP and existing Storybook on 6006 are not
  changed. Rollout preview is local on 6007.

Review previews:

- [Actual chart category keyboard/reset](http://localhost:6007/?path=/story/features-chart-actual-workspace--catalog-facet-keyboard)
- [Reception patient keyboard/clear](http://localhost:6007/?path=/story/features-reception-patient-combobox--keyboard-and-clear)

The baseline failures described above are not included in the passing focused
sets. Existing-owner decisions in the family table remain deliberate; this
candidate does not claim a blanket conversion of every screen/control.
No remote delivery or human acceptance is claimed.

## Extension Tranche And Final Reconciliation

The second tranche adds real shared date-popup adoption, not another parallel UI
system. New regressions cover six-week months, selected date reactivation and
dismissal, same-patient reactivation and composition guards. The multi-breed
conversion was reverted after parity review demonstrated extra beta-API glue;
retained behavior is checked for exact-label pointer and keyboard commits,
partial-label pointer selection and custom text/deduplication.
Actual Home checks observe caller-owned local operating date and matching
work-item reads; Home does not own this date in its URL. Existing reception
checks continue to verify reception's separate URL/read contract.

## Final Combined Evidence — 2026-11-16

- Exact code/test candidate `3c48dfa31d0223dd1e9391f210f567413cb020e2`
  is cleanly rebased onto fetched `origin/main` at
  `185f9013d25399ae18201fc52e8abe59750ac123`. The upstream fulfillment,
  dispensing filters and documentation changes are preserved without conflict.
- **40/40 focused Chromium stories passed:** 39 shared/feature stories across
  ten files, plus the actual chart catalog facet keyboard/reset story.
- **15/15 actual-screen synthetic E2Es passed** on that exact candidate,
  including Home caller-owned date/work-item reads and retained multi-breed
  form behavior, in addition to the first tranche's reception/chart paths.
- **9/9 selected official Storybook MCP interaction runs passed** after the
  final reconciliation, including same-patient activation and the shared
  date-popup six-week/keyboard/reselect scenario. No exhaustive axe claim.
- Full typecheck, full lint, production build and docs link check
  (**1083** docs/agent files) passed. The pre-existing PRD dynamic-filesystem
  tracing build warning and unrelated baseline failures above remain explicit.
- The retained form's expanded regression initially reopened suggestions while
  a previous Base popup was still closing. It now waits for that list's removal
  before the next gesture. The isolated pair and final combined run pass;
  no force click, fixed sleep or application workaround was introduced.
- Visual review confirms the shared date popup's CLAiR styling, 244px width,
  28px chips and complete 42-cell month. Existing mini-calendar geometry remains
  separately verified. Same-value activation is tested without duplicate
  callbacks; adopted keyboard paths include Safari composition guards.
- Independent behavior review has no unresolved findings. The one-off
  multi-breed SDK conversion is deliberately reverted, not hidden unfinished
  work. All remaining family dispositions are recorded above.
- The isolated worktree contains only this candidate. Next dev's generated-only
  AGENTS block is backed up outside the checkout and excluded after checking
  that no non-generated instructions changed. Primary-checkout WIP and its
  Storybook on 6006 remain outside this work. Local preview stays on 6007.

Ready for **Human Review** of the authorized local implementation, not `Done`.
No push, PR, merge, deployment, remote-data change or human acceptance is claimed.

## Authorized Release Follow-Up — 2026-11-16

The owner subsequently authorized the remaining PR creation, CI/Preview
verification, main merge, Production deployment and post-deploy verification for
this bounded rollout. This supersedes the initial local-only delivery boundary;
it does not expand application, data, provider, permission or cost scope.
The owner also requested an honest before/after assessment of problems,
performance, appearance and behavior, separating visible user benefits from
internal developer benefits.

The candidate was safely rebased onto main `910512f2`, preserving upstream
fulfillment/dispensing and queue-refresh changes. The original pre-release
checkpoint remains preserved locally. Required checks and exact-head Preview
must be refreshed before merge. Automatic Preview configuration, protection,
plans, credentials, DB state and providers are not to be changed by this release.

Scoped live smoke: public login and available authenticated, read-only controls
in the source-allowlisted synthetic workspace. Do not submit patient/guardian,
clinical/order, invitation, email or payment writes. Compare the same controls
and viewport before/after where available; label local synthetic comparisons
and public-route timing separately. Missing authenticated access is a stated
verification limit, never a passing live-screen check.

Release evidence (PR/head/check/Preview/Production/rollback) is recorded in the
PR as it becomes available. Stop on failed required checks, unexpected scope,
non-Ready Preview, secret findings, source mismatch or failed required smoke.
No additional reservation-picker or Plan/Order redesign is included; those are
separate possible follow-up opportunities, not unfinished release scope.

## Escape Regression Correction Release — 2026-11-16

PR [#1096](https://github.com/mcso0/emr-app-shell-prototype/pull/1096) delivered
main `70704694`. Its Ready Production is `dpl_8ascKGUH6xgj9fi3CXCJ5FfNBx4q`,
served by `emr-app-shell-prototype.vercel.app`. Authenticated read-only smoke in
the source-allowlisted Cheongdam synthetic workspace found a newly introduced
mixed-overlay Escape regression: dismissing guardian suggestions also opened
the enclosing registration discard confirmation. Local actual-screen tests
reproduced it for both guardian Combobox and single-breed Autocomplete.
Independent synthetic source A/B compared pre-rollout `910512f2` with the
current registration code and confirmed the old Base popup preserved the parent.

The original bounded UI SDK deployment/verification approval covers correcting
this rollout regression after fresh PR, CI, Preview and focused verification.
Only this correction is isolated from main: the separate local reservation
calendar and Plan/Order filter follow-ups remain preserved and **excluded**.
No database, provider, permission, dependency or global release-setting change
belongs to this correction.

### Smallest Correction

Base Dialog's Escape handling runs before the SDK popup's document-level
dismissal, and the SDK child is outside Base's popup tree. Mark the shared SDK
search inputs explicitly. For an expanded, marked input only, cancel the parent
Escape close and allow propagation to the child's own dismissal. The next
Escape retains normal parent behavior. This adds no state, refs, event listener,
new overlay stack or focus manager. Existing Base Select and non-SDK fixed-list
combobox behavior remain unchanged and regression-covered.

### Candidate And Verification

- Base re-fetched at `70704694`; current Production and duplicate PR state
  checked before preparation. The earlier local follow-up branch is untouched.
- Scope: three small shared input/Dialog runtime files, related Dialog story,
  registration Escape tests and this release evidence. No feature module or
  reservation/filter adoption is part of the diff.
- Required evidence: actual guardian/breed first-child-then-parent Escape,
  value/focus retention, no registration write, existing registration/search
  flows, controlled dialog state/callback counts, Base Select/fixed-list
  preservation, full local gates, current PR Release Check and Ready Preview.
- Isolated candidate verification passed **5/5 actual-screen E2Es** and **8/8
  focused Dialog/Combobox/Autocomplete stories**. Full typecheck, lint, docs,
  secret scan and UX copy checks passed. Production build and remote release
  gates are still required before merge; final results belong to the PR packet.
- Scoped Production smoke repeats those read-only/draft-cancel interactions
  after the exact-source deployment is Ready. Do not activate registration,
  clinical/order, invitation, email or payment submissions. Navigation may
  retain its existing app-shell preferences; do not claim zero network writes.
- Rollback reference is the prior `70704694` deployment above. It contains the
  Escape regression and is not described as fully known-good. No rollback is
  authorized implicitly; stop and report any failed required smoke.

Earlier live screenshots at 2560×1256 showed no page overflow and the observed
console had no errors/warnings. Patient lookup, breed full-label commits,
calendar and diagnosis/order facet reset behavior passed the scoped smoke.
Only one SOAP tab existed, so multi-tab live testing was not performed. No
authenticated old-version visual/performance baseline was captured; earlier
public login network timings cannot establish SDK-caused speed or INP changes.

PR/check/Preview/merge/Production and final smoke evidence will be recorded in
the correction PR. Human acceptance and exhaustive browser/accessibility
coverage are not claimed by automated checks.

## Pending Reservation And Plan/Order Preparation — 2026-11-16

The Escape-only correction was delivered by
[PR #1097](https://github.com/mcso0/emr-app-shell-prototype/pull/1097) at
`23405610`. Its exact-source Ready Production and authenticated guardian/breed
Escape smoke passed; [delivery evidence](https://github.com/mcso0/emr-app-shell-prototype/pull/1097#issuecomment-6916094520)
records the checks and limits. That correction is not duplicated here.

The owner then requested finishing the pending work and being notified when
deployment is needed. This candidate is **local preparation only**. Do not push,
open a PR, merge, deploy, change release settings or mutate remote records until
the owner separately authorizes that next step. The old local checkpoints and
primary checkout WIP remain preserved.

### Isolated Scope And User Benefit

- Reconcile directly from current main `23405610`, transplanting only the earlier
  calendar/filter source and regressions. Source/tests equal the previously
  verified local implementation, while current-main #1097 remains unchanged.
- Reservation picker: the fixed 35-cell helper omitted January 31 and May 30/31
  in 2027. Compute complete weeks with a five-row minimum and a sixth row only
  when required. Keep the existing picker, 292px width, 32px day buttons, today,
  minimum date and focus return. The shared helper fixes both reservation
  presentations without a widget/library rewrite. Showing a day does not
  bypass Sunday/closed-day/business-hour or server write validation.
- Plan/Order filter: replace nine independent fake tabs with the installed SDK
  ToggleGroup/Toggle. There is one tab stop; arrows/Home/End move focus and
  Enter/Space select. Persistent table filters use group/pressed-button
  semantics, not tab panels. Labels, counts, classes and feature-owned filtering
  remain. No new wrapper, form layer, table engine or domain state is introduced.
- Tests adapt role assertions without weakening counts, filtering, table
  geometry, pinning, sorting, density, permissions or request boundaries.

### Readiness Gate

Refresh focused actual-screen calendar/filter checks, keyboard/IME stories,
current-main Escape preservation, full types/lint/build/docs/secrets/UX copy,
diff review and independent read-only review. Record the final local commit
and latest main. Broader pre-existing router/fixture failures are not silently
fixed or counted as passing; focused readiness is not exhaustive suite/a11y
or production acceptance.

After local checks/review, report what is ready and wait for deployment approval.
Remote Release Check, Ready Preview, exact-head merge and post-deploy smoke are
future release gates, not steps already performed for this candidate.

### Local Result And Deployment Notice

- **11/11 focused actual-screen E2Es passed** on the reconciled candidate:
  January 31, May 30/31 and February 35-cell geometry, operating-today/minimum-date
  and focus return, reservation creation, Plan/Order header/alignment/density,
  pinning/scroll, single sort and both deployed Escape regressions.
- **3/3 focused stories and 3/3 project MCP tests passed:** Order Filters,
  Order Filter Keyboard and retained Nested Search Escape. The first Vitest
  name filter skipped tests and is not counted; corrected displayed names ran
  all three. The MCP cold-start UniversalStore channel error was resolved by
  retrying after the actual preview rendered, without source/config changes.
- Full types, lint, production build, docs (1083 files), secret scan (5101
  tracked files), UX copy and diff checks passed. Existing Node 23 engine/Babel
  size/tracing and synthetic navigation-persistence warnings are not new defects.
- Independent read-only review against `23405610` found no material issue.
  Runtime blobs match the previously verified implementation; a fresh extracted
  calendar helper check covered all 4800 months in 2000–2399. Changed selectors
  and assertions preserve behavior, including corrected `aria-pressed`.
- The prior broader Storybook run had six pre-existing focus/router-fixture
  failures also reproduced in unchanged main `70704694`. Those unrelated fixtures
  were not modified or rerun as a full suite here; exhaustive a11y/browser and
  Production acceptance are not claimed.

Local implementation is ready for human review and deployment preparation is
complete. **Deployment approval is the remaining gate.** Before any delivery,
notify the owner of this scope; obtain approval, then refresh latest-main and
candidate checks, create the PR, verify required remote CI/Ready Preview and
perform the separately approved release/smoke. No remote delivery step has been
performed for this local candidate.

[Local filter keyboard review](http://localhost:6008/?path=/story/features-chart-actual-workspace--order-filter-keyboard)
