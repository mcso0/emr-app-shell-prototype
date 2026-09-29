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
updated: 2026-09-29
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
