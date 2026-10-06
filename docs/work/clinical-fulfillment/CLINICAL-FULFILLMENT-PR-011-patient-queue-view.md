---
id: CLINICAL-FULFILLMENT-PR-011
status: in_progress
area: clinical-fulfillment
priority: P1
source_docs:
  - docs/product/domain/encounter-multi-chart-contract.md
  - docs/engineering/data-model/order-fulfillment-handoff-contract.md
  - docs/work/lab/LAB-PR-001-result-workspace-structure.md
updated: 2026-10-06
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
  Display actual creation time; no fabricated chart numbers, avatars, or origin backfill.
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
Hosted apply and main/Production remain pending exact approval.
