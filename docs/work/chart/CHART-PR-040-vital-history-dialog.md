---
id: CHART-PR-040
status: in_progress
area: chart
priority: P0
target_pr: User-approved Figma vital history dialog implementation
source_docs:
  - docs/engineering/data-model/patient-vital-measurements.md
dependencies:
  - CHART-PR-023
updated: 2026-10-01
---

# Vital History Dialog

## Approval and scope

승욱 approved local implementation from the reviewed HTML and Figma node
`UkfxgituFcU2rhYFriAErJ / 28546:215622` on 2026-09-29. This item records that
approval. On 2026-09-29, 승욱 additionally authorized commit, push, PR creation,
and origin/main merge for this slice. Remote DB migration remains separately gated.
Work includes the dialog, patient-scoped history API, an additive local migration,
and the existing context-bar latest-vital projection. Preserve unrelated WIP.

## Decisions

- Match the approved desktop HTML: 519×496, history 196, editor 320; header 56,
  body 374, footer 64. Panel padding 10 vertically / 16 horizontally. Group-title
  padding 4 top/bottom, 4 left, 2 right. Same top typography alignment on both sides.
- History scrolls vertically only. Scrollbar thumb 8, 4 between item and scrollbar,
  4 between scrollbar and divider. Conditional top/bottom fade of 44.
- Reuse Dialog, EmrDialogShell, ScrollArea, Button, Badge, Label, Input, FieldError,
  and EmrConfirmDialogContent with feature-local sizing. No shared token changes
  or new dependencies. Existing CDS icons; exact Figma blood SVG for both BP fields.
- Select individual measurement records grouped by Seoul date; newest first.
  Multiple records per day. + 바이탈 starts an empty record at the click time.
- Editing a past-date measurement requires confirmation before save. Update that
  record ID, preserving original measurement time and author; record before/after.
- Confirm discarding unsaved edits before selection, new measurement, or closing.
  Show all-clear guidance only when saving a record with all values cleared.
- Context bar uses the most recent non-null value independently for each field,
  with its measurement timestamp. The editor never copies these values into a record.
- Reuse numeric, positive, precision, integer, and BP-dependency validation.
  No invented clinical range thresholds. Current `inputRequired` configuration
  governs required fields for every new record and historical correction. Optional
  fields may be left empty for partial repeat measurements.
- Desktop first. No new mobile stacking/shrinking layout.

## Data and permission boundary

Read: authenticated membership + patient:view, patient resolved from workspace-scoped
selected encounter. Write: existing vital:write and clinical/admin eligibility,
active selected consultation state, target measurement matching workspace AND patient.
Create inserts a new row; PATCH requires an exact measurement ID and expected updatedAt.
Existing latest-encounter compatibility writers remain unchanged. A past encounter may
be corrected only through an eligible active encounter for that same patient.

## Done criteria and verification

Local implementation, focused lint/typecheck/build and visual/manual review where
available. Automated tests are not requested and will not be added or executed.
Record unverified DB execution explicitly; source compilation does not prove remote
persistence. The baseline TypeScript check passed before editing. The release candidate also
limits the two new audit event names to the measurement writer; the public audit
helper rejects those names and retains all other existing behavior and grants.

## Local implementation result

- Actual shared-component dialog, history GET/POST/PATCH route, exact-record RPC,
  per-field latest projection, and conditional measurement tooltips implemented.
- `npx tsc --noEmit --pretty false`: pass on the changed checkout.
- Targeted ESLint: pass, no warnings. `npm run build`: pass, history route emitted.
- `npm run docs:check`: pass (1070 markdown files). Scoped `git diff --check`: pass.
- Standalone actual-component preview (synthetic memory adapter only) visually
  inspected: dialog 519×496, left 196 / right 320, body 374, first input 36,
  matching title-row positions, clientWidth = scrollWidth = 195. Original blood SVG
  loads twice at 14×14. Scrollbar item/bar/divider gaps measured exactly 4 / 8 / 4,
  with track top/bottom 10 and conditional top/bottom fade.
- The report builds and its contract validator passes (46 records / 11 checks).
- Source SQL was reviewed for actor, permission, state, same-patient/workspace,
  exact-row revision, audit, and original-attribution preservation. No SQL execution,
  automated test, remote migration, deployment, or persistence proof is claimed.
- Existing user WIP remains; the small context-bar/hook/callback additions are
  layered onto it. No dependency or global design-token change.
- Fresh origin/main (`62fcd1b9`) already includes the per-workspace `inputRequired`
  policy. Read-only remote catalog inspection confirmed its column, validator, and
  deferred trigger exist. Preserve that policy; no further owner value-policy
  question is required. Client/API reuse the existing settings validation, and DB
  rejects concurrent requirement changes. No mandatory-field bypass is introduced.

Public deliverables (approved synthetic static share only):

- [Decision summary](https://arab-periodically-have-fibre.trycloudflare.com/implementation/decisions.html)
- [Actual component preview](https://arab-periodically-have-fibre.trycloudflare.com/implementation/)

## Release preparation

- Isolated candidate: managed worktree `vital-history-release`, branch
  `codex/vital-history-dialog`, based on fresh `origin/main` `62fcd1b9`.
- Preserve upstream workspace `inputRequired` implementation and all unrelated
  primary-checkout WIP. The former basic-preset assumption was superseded by
  current source and remote catalog evidence.
- Required-settings write rejection returns 400 and offers an explicit settings
  page reload behind unsaved-change confirmation. It does not silently discard edits.
- New measurement audit events are internal to the validated transaction; public
  generic append rejects those two names. Other audit types/privileges are unchanged.
- Existing production rollback candidate: `dpl_9LBhyCKpo2YVz7PEpsux32XSfych`
  (Ready on the official alias before this release).
- Remote migration approval remains required by AGENTS Project Boundaries and
  release runbook Gate 3. Applying app code without the new RPCs is a stop condition.

Clean-candidate local checks on 2026-09-29: secret scan, docs, Korean UX copy,
TypeScript, build and diff checks passed. Full ESLint: 0 errors / 5 existing
warnings in unrelated scripts; focused changed-file lint: no warnings. Compiled
synthetic preview retained 519×496, history client/scroll width both 195, input
height 36 and configured required aria state. No automated tests or remote writes.

## 2026-09-29 feedback follow-up

승욱 authorized implementing the loading/empty/read-error states, missing reception
validation feedback, and removal of backdrop blur, then commit/push/PR/main delivery.
The earlier exact release approval covered the original candidate; this follow-up
prepares a new candidate and a separate forward-only DB migration for review.

- Reuse `EmrContentLoadingState` for the initial load and `EmrEmptyState` for no
  measurements or initial read failure. Keep header/footer and approved 519×496
  geometry. Empty history retains the existing + 바이탈 entry point after permission
  resolves. Partial pagination failure keeps loaded records and provides inline retry.
- Extract existing reception rules into `patient-vital-validation.ts`: finite positive
  values, decimal/integer shape, storage bounds, required settings and BP dependency/
  ordering. Use the same rules in reception, dialog and patient-vital API validation.
- Show field errors while nonempty invalid values are entered; show missing required
  errors after that field loses focus. Errors block save. Reuse reception dog/cat
  warning messages/ranges and the existing warning token; warnings permit deliberate
  `확인하고 저장`. No new medical thresholds (31°C remains inside the existing 30–45 range).
- History returns only species and the existing weight snapshot for warning context,
  after resolving the patient from the workspace-scoped encounter. No client-selected
  patient ID or new permissions. Warnings are advisory, never permission enforcement.
- The local migration replaces only `clair_list_patient_vital_history` and
  `clair_write_patient_vital_measurement`. The writer rejects inverted BP for new or
  changed BP tuples, preserving unchanged historical tuples. UI/API validate enabled
  BP items; unchanged disabled/hidden historical BP remains retained. No row rewrite
  or new global constraint on historical data.
- Feature-local `overlayClassName` removes blur on the main dialog and its nested
  confirmations. Shared Dialog defaults and other product dialogs are unchanged.
- Scope excludes real patient data mutation. Remote migration and exact Production
  approval are pending until the concrete candidate/checks/backout packet is ready.

Follow-up local evidence:

- TypeScript and focused ESLint passed. Full ESLint has 0 errors and the same 5
  unrelated script warnings. App build passed with the existing docs/NFT tracing warning.
  Secret scan, docs, Korean UX copy and diff checks passed; no automated tests ran.
- Manual actual-component synthetic preview: range overflow appears immediately and
  blocks save; BP 123/132 displays the ordering error; temp 46 / heart rate 123123123
  show advisory messages and `확인하고 저장`; historical confirmation still appears.
- Empty history supports new draft entry; missing required field reports after blur;
  initial error retries successfully; initial loading is centered. Dialog remains
  519×496. Main and confirmation overlays both compute `backdrop-filter: none`.
- Manual hidden-BP fixture permits changing temperature while retaining the hidden
  original fields in source. Synthetic in-memory save succeeded; no remote record
  write or persisted-data proof is claimed.
- Read-only security review found no actionable issue within the specified hidden-BP
  policy. The new migration remains required before the new API is deployed.
- Current rollback: Ready Production `dpl_3CgaZDNvUzc87RwesErW5TEDH3W5`, source
  `7ed99f0ee5df7c6a5aa889c376a58371563a3031`. Prior function definitions captured
  privately for an approved rollback; no patient rows included.

## 2026-09-29 disclosure motion follow-up

승욱 requested matching the chart/lab history disclosure interaction and removing
the inline `바이탈을 저장했어요.` success text below the vital inputs.

- Chart history and lab/imaging history both use `EmrContentHistoryGroup`:
  height 240ms on expand / 180ms on collapse, opacity 140ms / 120ms, vertical
  offset −4px to 0 over 200ms / 160ms, and chevron rotation over 200ms.
- Reuse the installed Framer Motion and existing side-panel easing constants
  (`[0.16, 1, 0.3, 1]` enter / `[0.32, 0, 0.67, 0]` exit), which match those
  history groups. Keep the vital-specific approved geometry and markup.
- Animate a persistent clipped wrapper so a rapid reverse starts from its current
  height. Closed contents are immediately inert and hidden from accessibility;
  initial render does not animate. Reduced-motion preference uses duration zero.
- Existing content ResizeObserver updates scroll fades during height changes.
  Selected measurement, editor draft and unsaved-change confirmation are unchanged.
- Successful save clears inline feedback. Save/validation errors and the existing
  post-save refresh failure explanation remain available when needed.
- UI-only scope: no new dependency, shared-component change, API, permissions or
  migration. Base source is merged PR859 at `5e7bc001`.

Local evidence: TypeScript, changed-file ESLint and diff checks passed. Rebuilt
actual-component synthetic preview confirms intermediate collapse height
102→77.17→0px, inert/aria-hidden immediately on collapse, reverse/expand recovery,
unchanged 519×496 dialog and history client/scroll widths both 195px. Synthetic
historical save retains the confirmation, updates the input and disables save
without displaying the former success text. No automated tests or real record write.
App build, secret scan, docs and Korean UX copy checks also passed. Full ESLint:
0 errors / the same 5 unrelated script warnings. Existing docs/NFT tracing and
synthetic preview bundle-size warnings remain. Production approval will apply to
the new exact PR candidate; no new DB migration is needed.

## 2026-09-29 context-bar focus follow-up

승욱 approved fixing the lingering hover appearance after closing the vital dialog,
including commit, push, PR, origin/main merge and Production deployment.

- The vital action regains focus when the Base UI dialog closes. Unconditional
  `focus-within` on its summary previously kept the background, icon and + visible
  even after a pointer dismissal away from the summary.
- The vital summary now highlights on actual hover or descendant `focus-visible`.
  The + uses hover or its own `focus-visible`; its inner control ring follows the
  button's keyboard focus rather than an unfocusable span.
- Preserve dialog focus restoration, keyboard access, disabled-action explanations,
  patient/guardian section styles, data/API contracts and permissions. UI-only;
  no dependency or DB change. Reuse the clean managed release worktree at fresh main.

Local evidence: changed-file ESLint, TypeScript, build, secrets, docs, Korean UX copy
and diff checks passed. Full ESLint has 0 errors / 5 existing unrelated warnings;
the existing docs/NFT build warning remains. Manual local synthetic preview uses
the actual context bar and dialog shell: pointer-close restores focus but yields
`hover=false`, `focusWithin=true`, `focusVisible=false`, transparent background and
+ opacity 0. Actual hover and Tab/Escape both show the action; keyboard return
retains a 2px focus ring. No automated tests or remote patient-data writes ran.


## 2026-10-01 stale SOAP vitals follow-up (local implementation only)

승욱 approved reproducing and fixing audit item 1 using local synthetic/mock data.
This follow-up does **not** inherit earlier release approval: no commit, push, PR,
merge, deployment, hosted clinical write, migration or policy change is authorized.

- Verified GitHub main/base: `e4d382a76e52943193524c0e9a2d944c77b49838`.
  Detached isolated worktree: `/Users/iseung-ug/Documents/Codex/2026-10-01/task/vitals-fix`.
  The dirty primary checkout and its WIP are preserved.
- Before the fix, the actual latest-vitals hook mounted as header and SOAP consumers
  reproduced the defect: header synthetic save/refetch returned 7.00 kg, while
  insertion without navigation still emitted 4.00 kg. This is synthetic runtime
  reproduction, not evidence of a hosted clinical incident.
- A mounted-only resource now shares latest summary, settings and initial requests
  by encounter/workspace/authenticated actor/normalized headers. Header `replaceVital`
  refreshes the server summary for both consumers; no saved-row optimistic overwrite.
- Cookie auth identity comes from the existing Supabase client's auth subscription;
  wait for `INITIAL_SESSION`, isolate account changes/sign-out, and avoid extra
  clinical reads on token refresh. No new auth request or polling is introduced.
- Abort superseded requests and check request generation plus resource identity.
  Release entries after the last subscriber; preserve StrictMode request deduplication.
  Loading/error states suppress stale SOAP insertion and write eligibility.
- No chart/module UI, API, SQL, RLS, schema, canonical permissions, billing or
  notification changes. The existing static test now points at the new resource
  instead of requiring the old settings-hook implementation by name.

Validation command: `npx playwright test -c playwright.vitals.config.ts`.
The synthetic browser harness bundles the actual hook, mocks auth/HTTP, and mirrors
existing header save and SOAP insertion contracts. It does not mount the full chart
editor/dialog and does not claim remote persistence or real-account smoke coverage.
Final local evidence (2026-10-01):

- Focused Playwright: **50 passed** (17 synthetic actual-hook browser regressions,
  33 existing mocked server/model/permission contract tests). Covers save→SOAP,
  old-row correction, per-field fallback, units/order/visibility, pending/failed
  refresh, delayed/out-of-order responses even ignoring abort, rapid patient/
  encounter/workspace/account changes, stale save completion, normalized headers,
  duplicate initial reads, StrictMode, unmount/remount, initial auth wait and
  token-refresh/sign-out behavior.
- TypeScript and changed-file ESLint passed without warnings. Full ESLint passed
  with 0 errors and 5 pre-existing warnings in unrelated WP-10 scripts.
- Default `npm run build` passed with Next 16.2.6/Turbopack. The existing docs/NFT
  tracing warning remains. Initial external-dependency-symlink build failed;
  APFS-cloned worktree-local dependencies resolved that. A sandbox build stalled
  and was interrupted; the approved elevated local build completed successfully.
- Docs references, Korean UX copy, tracked-file and untracked-addition secret scans and diff checks passed.
  Original and final browser logs plus build/lint output are retained locally in
  `_workspace/vitals-validation/` (ignored, not a publication artifact).
- No hosted clinical mutation, full-chart editor smoke, real-account cookie/remote
  persistence test, commit/push/PR/merge/deployment or DB execution. Full suite was
  not run; validation is focused on the changed resource and existing contracts.

Human acceptance and a new publication decision remain pending. The next optional
step is approval for this exact local candidate's commit/PR/release workflow;
PR887 approval does not apply.


## 2026-10-01 PR and release verification preparation

승욱's subsequent reply authorized commit/push, a draft PR and deployment
verification preparation for this vitals fix. Exact-candidate Production approval
is still required: stop before merge, deploy, promote or Production alias changes.
Earlier PR887 approval remains unrelated.

- Refreshed base: `906a118b41e760adf2dc274f1e3df4895a4adc32` (main includes
  separately approved chart-layout PRs #888–#890). No vital-source overlap.
- Branch: `codex/soap-vitals-refresh`. Preserve the primary checkout and all its WIP.
- Prepare a packet for the exact committed PR head containing local checks,
  manually dispatched Release Check, Ready Preview, current main/Production,
  bounded read-only smoke and a verified previous Ready deployment.
- Proposed post-approval action is an exact-head-protected squash merge to main.
  Smoke may check `/login` and mock/synthetic vital synchronization; no hosted
  clinical save is authorized. No schema/RLS/permission/billing or other audit fixes.
- Candidate/run/deployment identifiers belong in the PR and approval packet once
  known; do not change the candidate merely to embed its own commit hash.
