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
