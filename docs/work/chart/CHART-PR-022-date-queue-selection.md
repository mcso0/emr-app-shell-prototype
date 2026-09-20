---
id: "CHART-PR-022"
status: "implemented"
area: "chart"
priority: "P0"
target_pr: "User request / chart operating-date and queue selection synchronization"
source_docs:
  - "docs/engineering/current-status.md"
  - "docs/design/screens/chart/specs/date-queue-selection.md"
dependencies:
  - "CHART-PR-021"
result_report: "docs/completed/chart/2026-08-14-chart-pr-022-date-queue-selection-report.html"
updated: "2026-09-20"
---

# Chart Operating-Date and Queue Selection Synchronization

## Goal

Make the selected operating date the single chart-screen scope so the queue, selected encounter, URL, header, and content cannot represent different dates.

## Scope

- Own live-queue loading and selection recovery in the always-mounted chart slot provider.
- Store the selected operating date and queue scope per workspace.
- Treat a valid URL `date` as the initial/reload source, write user date changes
  back to URL and store, and normalize invalid dates to today.
- Select a valid direct-link encounter, otherwise the still-valid current encounter on same-date refresh, otherwise the first server-sorted queue record.
- Clear the previous selection, scoped records, and chart URL parameters immediately on date changes.
- Show an accessible loading state during initial/date-transition reads, a date-specific empty state for successful empty reads, and distinct error/permission states.
- Preserve manual queue selection and legacy Sales Demo chart scenarios.
- Add browser regression coverage for initial selection, direct links, stale links, empty dates, loading, rapid date changes, and read denials/failures.

## Out of Scope

- Live-queue API response changes, DB schema, Supabase, RLS, or permission changes.
- SOAP, diagnosis, Order, consultation, or chart-completion save semantics.
- New draft-loss confirmation or navigation blocking.
- Fixed staging alias or `origin/staging` changes.

## Selection Contract

1. A URL `encounterId` that exists in the selected-date queue.
2. The current selection when it remains valid during a same-date refresh.
3. The first queue record in server `sortOrder` order.
4. No selection when the selected-date queue is empty.

Session-storage encounter values are not recovery candidates. Automatic URL normalization uses replace navigation; explicit user queue-card selection keeps the existing workspace navigation behavior.

## Done Criteria

1. Initial entry with queue records automatically renders the first chart without an empty-state flash.
2. Valid direct links are retained and stale links normalize to the first selected-date task.
3. Changing to an empty date removes the old chart header/content/actions and shows the selected date in the empty-state copy.
4. Changing back to a populated date automatically renders its first task.
5. Late responses from an earlier date cannot replace the current date state.
6. Read errors and permission denials remain distinct from a successful empty queue.
7. Focused and full chart checks, TypeScript, lint, build, docs, copy, secret, and diff checks pass before release.

## 2026-09-20 URL-Date Follow-up

- Added RED/GREEN coverage proving a valid URL date owns the first live-queue
  request, date controls replace the URL while clearing encounter parameters,
  reload retains the selected date, invalid dates normalize to today, and late
  responses still cannot replace the latest scope.
- Kept the existing explicit encounter guard: a same-date valid direct link is
  retained, while a date change clears the prior encounter before recovery.
- RED evidence: the boundary check resolved a stale stored date instead of the
  valid URL date or today's missing-URL fallback.
- GREEN evidence: the isolated date-transition, valid URL, invalid URL, late
  response, and date-navigator cases passed 5/5 on a fresh server; the combined
  profile-entry, Chart boundary, and shared-header run passed 26/26.
- TypeScript, changed-file ESLint, production build, docs links, Korean UX copy,
  secret scan, and `git diff --check` passed. A 94-case broad Chart run reached
  73 passed and 21 unrelated failures while its persistent development server
  repeatedly emitted `MaxListenersExceededWarning`; the focused date/queue
  cases passed after the server was restarted.

## Verification Result

- Focused and full ESLint: passed.
- TypeScript (`npx tsc --noEmit`): passed.
- Focused date/selection Playwright regression: 7/7 passed on a fresh development server.
- Latest-main integration regression (including the empty-state queue entry): 11/11 passed.
- Full `tests/chart.spec.ts`: exit 0 on a fresh development server; 45 passed on the first attempt and 3 existing SOAP interaction cases passed on retry after the long-running dev server emitted `MaxListenersExceededWarning`.
- Live-queue server contract: 7/7 passed.
- Production build, docs link check, Korean UX copy check, secret scan, and `git diff --check`: passed.
- Release Check, Preview readiness, candidate smoke, and rollback evidence are recorded before the PR is offered for production approval.
