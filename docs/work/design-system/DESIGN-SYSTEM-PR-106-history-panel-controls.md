---
id: DESIGN-SYSTEM-PR-106
status: human_review
area: design-system
priority: P1
updated: 2026-10-04
source_docs:
  - docs/work/chart/CHART-PR-025-live-patient-chart-history.md
  - docs/work/chart/CHART-PR-028-history-information-hierarchy.md
---

# History panel controls

## Goal and approval

승욱 approved the reused-component interactive proposal, local implementation,
and continuation screen by screen. He then requested commit, push, PR, main
merge, and deployment preparation. The production gate still requires approval
of the exact candidate, verification, and rollback path.

Preserve unrelated WIP, patient/workspace isolation, selection, permissions,
read-only history, navigation, and financial behavior. No DB or external-data
mutation is included.

## Candidate scope

The original dirty checkout was implemented against older sources. The release
candidate is rebased on `origin/main` (eca2f35f), including PR #922. Its original
port base (cbd15d72) already has
patient-wide fulfillment history and a shared `PatientHistoryAside`. Port the
controls to that component; preserve its history API and navigation. Do not
restore the older provided-record or selected-event-only panels.

- 차트: filter and sort the loaded patient's rows, including multiple charts per
  encounter. Date operations follow the existing 진료일/작성일 display mode.
  Search encounter, diagnosis, assessment, status, and veterinarian metadata.
  Keep new-chart actions, historical read-only state, same-minute ordering,
  current-chart selection, and existing loading/error states.
- 수납: keep the guardian ledger and quick status/date filters. Add real inclusive
  direct dates, newest/oldest sorting, metadata search, and hidden invoice-selection
  feedback. Existing checkout rules continue to own amounts and eligibility.
  Presets use the existing workspace operating-today helper.
- 검사/영상/조제/처치: attach controls to the existing patient-history entries.
  Keep patient-wide reads, assignee display names, task grouping, selection,
  and cross-date navigation. Search names/status/staff, filter status/staff/dates,
  plus 검사명 for lab and supplied modality for imaging. Keep 조제/처치 category
  tabs. No inferred live clinical fields or new API are introduced.
- Reset controls on workspace/patient/guardian scope change. Filters preserve
  selection and show a hidden-selection notice. Distinguish no source data,
  loading, failure, permission denial, search-empty, and filter-empty.
- Compose existing EMR shells and project shadcn with semantic tokens. No
  dependency or shared-token change. Search pauses during Korean composition,
  applies after 250 ms, and uses NFKC/case-folded multiword AND matching.
- Date ranges use Asia/Seoul, include both bounds, and reject incomplete,
  reversed, or invalid date pairs. Filter dialogs use draft apply/cancel/reset.

These are five routes and six history kinds. `/treatment` is the chart route;
조제/처치 share `/dispensing` and its existing combined history panel.

The local predecessor used ID 099, which is already occupied on latest main.
This release uses 106. The old bundled HTML snapshot contains unrelated WIP and
is excluded from this code delivery. The original working directory is preserved.

## Verification

Clean release worktree checks passed:

- Focused Playwright **22/22** (48.6 s): controls, checkout/hidden selections,
  patient/guardian resets, category tabs, history date mode, same-minute and
  historical chart selection, loading/error/empty states, and permission denial.
- Shared control stories **2/2** through Vitest, including Korean IME.
- Local secrets, docs, UX copy, full lint, TypeScript, production build, and diff
  checks passed. Latest test-only edits also passed scoped ESLint.
- The build retains the existing `/docs` file-tracing warning.

Broader tests exposed stale fixture/assertion assumptions. A clean main snapshot
reproduced the chart no-data fixture and duplicate lab attachment selector failures.
The chart test now provides no local charts for its no-data case and follows the
shared content empty-state size. The lab assertion targets its HCT detail region.
The dispensing regression explicitly distinguishes the patient-history aside from
its separately opened 실제 수행기록 dialog. Existing lifecycle checks remain.
The revised set passes; the full repository test suite was not run.

The predecessor's 20 browser checks and two stories are historical local proof,
not a substitute for these clean-candidate checks. Its older baseline failures
are not reported as current main failures.

One manual GitHub Release Check for the exact commit and Ready PR Preview remain
part of delivery preparation. Final remote evidence is recorded in the release
packet after the commit is fixed, avoiding a self-referential commit hash here.

## Delivery gate

Remote `staging` is absent at inspection. A direct main release therefore needs
승욱's explicit approval of the candidate and a fixed-staging exception. Prepare
the same candidate's PR preview, source/check evidence, production smoke paths,
rollback commit/deployment, and stop conditions before asking for that gate.
No alias, secret, provider, financial, or real-data operation is included.
