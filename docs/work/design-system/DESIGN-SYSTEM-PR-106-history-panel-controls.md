---
id: DESIGN-SYSTEM-PR-106
status: human_review
area: design-system
priority: P1
updated: 2026-10-05
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

## Approved header search revision — 2026-10-05

승욱 accepted the updated interactive HTML and requested product implementation.
Use `codex/history-header-search` from inspected `origin/main` (`c66f81c4`),
in the existing isolated checkout. Preserve the primary checkout and the HTML
artifacts. The initial request covered local implementation and verification.

- `EmrContentAsideHeader.search` replaces only the title/action frame. Keep its
  layout footprint, and hide/inert the default title, count, collapse, sort and
  filter controls while searching. No extra search row or result-count row.
- Use existing Input with `sm` height 28px and `키워드 입력`. Preserve each
  screen's accessible search name and the 250ms/IME search contract.
- Keep one always-visible filled circle X: populated input clears the pending
  and effective query and keeps the input focused; empty input closes search
  and restores trigger focus. Non-composing Escape still cancels and closes.
- Keep chart 진료일/작성일 tabs visible and operable during search. The initial
  implementation incorrectly shrank the chart frame to 28px and used 24px `xs`
  tabs. The fixed-48px correction below supersedes those dimensions.
  PatientHistoryAside keeps its existing 48px frame and 16px panel inset.
- Remove chart and patient-history applied-condition chips. Indicate applied
  conditions with a decorative 6px sky/500 dot at the filter button's upper
  right, using existing spacing/color tokens. Tooltip describes the applied
  conditions; draft edits/cancel do not change the dot. Clear via the existing
  filter reset/apply flow or filter-empty action. Filters keep selected history.
- Both sort directions keep the existing icon without a dot. Show current
  order through dropdown radio check, Tooltip and the accessible button name.
- Preserve billing's period/status quick controls and checkout selections,
  combined 조제/처치 category tabs, patient-wide history reads, loading/error/
  permission/empty feedback, historical read-only state and navigation.
- No API, DB, auth, financial, dependency, shared-token or remote release change.
  Synthetic HTML facets/presets remain proposal-only.

Local verification completed:

- Focused screen/helper checks: **11/11 passed** across two runs (10 state/
  boundary checks, then the updated four-route geometry check). Covers billing
  selections, chart read-only/loading/error/empty state and searchable date-mode
  tabs, lab/imaging selected history, combined category navigation, dates and
  search matching. The previous all-48px geometry assertion was incorrectly
  changed to chart 28px row + 24px tabs; measure inside the aside to exclude shell
  entrance motion and overall panel height. Header frame and list-start metrics
  remain equal before opening search, while open and after closing it.
- Shared stories: **5/5 passed** (four history-control stories and the existing
  content-aside default). Checks two-stage X, input focus, pending debounce,
  Korean composition, applied filter indicator, and draft dismissal.
- TypeScript, scoped ESLint, docs references, production build and diff checks
  passed. Existing build warning: `/docs` tracing in `doc-reader.ts`. Existing
  story-runner React `act` warning remains; all assertions pass.
- Visual evidence: `output/playwright/history-header-search/treatment-search.png`
  and `lab-search.png`. These use local synthetic demo fixtures. Storybook MCP
  endpoints 6006/6007 were unavailable; source inspection and the local Vitest
  story runner supplied component verification.
- Full repository suite, authenticated live data and remote release were not
  run. Product source and verification live on `codex/history-header-search`;
  the primary checkout, standalone HTML, API and financial contracts are intact.

### Delivery authorization — 2026-10-05

After reviewing the completed local implementation, 승욱 explicitly requested
commit, push, PR, merge to `origin/main`, and approved deployment of this same
header-search revision. Deliver only the 12 tracked files in this slice.
Keep prototype bundles, screenshots, local logs and unrelated primary-checkout
work out of the commit. Preserve the current API, DB, auth and financial scope.

Run the full local release preflight and one manual Release Check for the exact
PR head. Confirm its Ready Preview before an exact-head-protected squash merge.
Record candidate, checks, previous Production deployment, merge and final Ready
Production evidence in the local release packet. Verify `/login` and the scoped
history controls when an authenticated synthetic session is available. If no
such session is available, report that limit separately from HTTP/build proof.
Stop on failed gates, unexpected source/deployment, secrets or scope expansion.

## Fixed 48px history headers — 2026-10-05

승욱 corrected the prior release: every history-sidepanel header is fixed at
48px, including chart, lab, imaging, combined dispensing/treatment and billing.
He requested per-screen verification, then commit, push, PR and origin/main merge
only after those checks pass. The initial chart shrink was an implementation
error, not a user-approved change in the header size.

- Use the existing `--clair-layout-panel-header` (48px) in
  `EmrContentAsideHeader`; its previous 24px default also made billing too short.
- Remove chart's 28px override and restore its original date-basis `sm` tabs
  and `py-2` spacing. The separate date-basis toolbar is 44px; it is not part of
  the 48px header and remains visible/operable during search.
- Keep the approved search input at 28px inside the 48px header frame. Keep
  keyword copy, two-stage X, filter indicator, sort checks and focus contracts.
- Production callers: ChartHistoryAside; PatientHistoryAside for lab, imaging
  and combined dispensing/treatment; BillingHistoryAside. No other production
  callers of EmrContentAsideHeader exist in the inspected source.
- Preserve API/DB/auth, selections, permissions, financial behavior, unrelated
  primary-checkout work and standalone HTML. No new dependency or token.
- Update the existing geometry check to cover all five routes and require 48px
  before, during and after search. Verify original chart date-basis spacing and
  unchanged list start while searching; save each route's search screenshot.

Verification completed in the isolated `codex/history-header-height-restore`
checkout from `origin/main` (`5e41e333`):

| Route / history kind | Before search | During search | After search |
| --- | --- | --- | --- |
| treatment / chart | 48px | 48px | 48px |
| lab | 48px | 48px | 48px |
| imaging | 48px | 48px | 48px |
| dispensing / dispensing and treatment | 48px | 48px | 48px |
| billing | 48px | 48px | 48px |

The per-route geometry check passed (8.0s), together with six focused state
checks and five shared stories. Search input stays 28px; panel width stays
280px. Clinical insets stay 16px and billing's existing inset stays 12px.
The first expanded geometry run assumed billing also had a 16px inset; its
48px header already passed. Correcting that test-only assumption preserved the
billing layout. The final five-route check passes without product changes.
Screenshots are in `output/playwright/history-header-height-restore/`.

Exact candidate, local release gates, Preview, Release Check, merge and
Production evidence are recorded in that directory's release packet once fixed.
