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

## Original delivery gate (historical)

Remote `staging` is absent at inspection. A direct main release therefore needs
승욱's explicit approval of the candidate and a fixed-staging exception. Prepare
the same candidate's PR preview, source/check evidence, production smoke paths,
rollback commit/deployment, and stop conditions before asking for that gate.
No alias, secret, provider, financial, or real-data operation is included.


## Approved controls simplification — 2026-10-04

승욱 accepted the revised interactive HTML and approved implementation, commit,
push, PR, and preparation for main/Production delivery. The exact-candidate
Production approval still follows the active release-deployment-ops gate.

Reuse the existing isolated checkout; preserve the primary checkout and the
HTML proposal outside the release diff. Base: `origin/main` at `dc79ef89`.
The old search-close-only WIP is included in this complete behavior correction.

- Use existing DropdownMenu radio items for 최신순/오래된순. No visible title,
  date-basis description, or menu divider; keep a hidden accessible name.
- Replace EmrHistoryFilterDialog with EmrHistoryFilterPopover. Anchor it to the
  existing trigger, use nonmodal Popover plus EmrPopoverShell, hide the title,
  and keep compact scrolling fields and the apply/cancel/reset footer.
- Search has one always-visible, in-input CircleCloseFillIcon (16 px), named
  검색 취소. X and non-composing Escape cancel the pending query, remove the
  effective query, close the input, and restore focus after the trigger remounts.
  Remove external/native reset buttons and hide the header search button while open.
- Hide the visible result/total line while retaining screen-reader feedback and
  header counts. Keep applied filter chips. Remove the generic reset row; empty
  results expose 필터 해제 only when filters are applied. That action clears
  filters while preserving search, selection, and 조제/처치 category tabs.
- Apply these controls to ChartHistoryAside, PatientHistoryAside (lab, imaging,
  and combined 조제/처치), and BillingHistoryAside. Keep chart date modes,
  current/historical read-only selection, patient-wide fulfillment reads,
  billing period/status quick buttons, guardian scope, and checkout eligibility.
- Keep current real filter metadata. The HTML's synthetic classifications,
  7/30/90-day presets, event-only fulfillment examples, and pagination fixtures
  do not introduce new product data contracts, filters, routes, or pagination.
- No DB, API, permissions, shared-token, dependency, or financial mutation.

Follow-up verification passed in the isolated release checkout:

- Focused Playwright **12/12** (33.3 s): chart history/read-only and state
  boundaries, lab/imaging controls, combined 조제/처치 category navigation,
  billing search/date drafts/hidden selections, and history matching/date rules.
- Shared control stories **4/4** (5.06 s): dropdown sorting, blank and populated
  search cancellation, pending debounce cancellation, Korean composition,
  preserved applied filters, and outside-click/Escape draft dismissal.
- Secrets, docs, UX copy, full lint, TypeScript, production build, and diff
  checks passed. Full lint retains five existing script warnings. The build
  retains the existing `/docs` file-tracing warning. The story harness emits an
  existing React `act` warning; all four story assertions pass.
- Local synthetic lab-screen review confirms the anchored nonmodal filter,
  hidden title/result line, compact fields, and one always-visible 16 px filled
  circle X inside the input. No real patient or payment data was changed.

The Storybook connector cannot resolve the isolated checkout's stories; its
local Vitest story runner provides the recorded results. The full repository
test suite was not run. Exact remote Release Check, Preview, candidate and
rollback evidence belong in the release packet after the commit is fixed.
The active release model is PR Preview → exact Release Check → explicit
Production approval → main. The original staging exception above is historical.
