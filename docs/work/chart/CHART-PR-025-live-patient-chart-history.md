---
id: "CHART-PR-025"
status: "implemented"
area: "chart"
priority: "P0"
target_pr: "Browser comment / live patient chart history"
source_docs:
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/clinical-billing-persistence-scope.md"
dependencies:
  - "CHART-PR-023"
  - "CHART-PR-024"
updated: "2026-10-01"
---

# Live Patient Chart History

## Goal

Replace the patient chart-history mock lookup with a workspace-scoped live read model so every encounter for the selected patient is visible, while keeping queue selection and historical chart viewing unambiguous.

## Approved Scope

- Add a server-owned Supabase RPC that pages all encounters for one patient in one workspace.
- Require an authenticated active workspace member with `chart:view` inside the RPC and at the route permission boundary.
- Return encounter, primary guardian, veterinarian, diagnosis summary, latest non-voided SOAP assessment, total count, and a stable cursor.
- Use the live result in both the chart-history aside and inline History panel.
- Keep the current live queue encounter selected in the URL and queue while a prior encounter is displayed.
- Render a prior encounter as read-only and disable SOAP, Assessment, Order, lifecycle, completion, and vital mutations until the user returns to the current encounter.
- Refresh history after successful current-encounter chart mutations.

## Root Cause

The chart-history panels read `getChartHistoryRows(patientId)`, which only searched the static chart fixtures. A live patient such as 초코 was absent from those fixtures, so the UI prepended only the currently selected live encounter and reported one item. Selecting a historical encounter through the queue selection store would also have lost the active queue/date context because the live queue only contains current work.

## Ownership Decision

- Supabase owns the patient-wide history projection and total count.
- The existing live queue remains the owner of the current writable encounter.
- `historyViewEncounterId` is a presentation-only selection for a prior encounter; it does not rewrite the route or queue selection.
- The legacy `clair-demo` scenario retains its fixture fallback so existing deterministic product demonstrations remain intact.

## Out Of Scope

- Automatically completing or cancelling the existing open encounters.
- Changing encounter lifecycle semantics, queue membership, or historical clinical data.
- Editing a prior encounter from the history view.
- Adding a new dependency, generic cache layer, or client-side database credential.

## Done Criteria

1. The aside and inline History panel show the same live patient encounter set and authoritative count.
2. Paging cannot skip the first row of a subsequent page or cross patient/workspace boundaries.
3. A historical selection preserves the current encounter URL and queue selection.
4. Historical charts are visibly read-only and every existing mutation surface is disabled or guarded.
5. Permission denial occurs before the database gateway and is enforced again in the RPC.
6. Focused server, browser, type, lint, build, docs, secret, and diff checks pass.

## Verification

- `npx playwright test tests/chart-patient-history-server.spec.ts --reporter=line`
- `npx playwright test tests/chart.spec.ts --grep "live patient chart history" --reporter=line`
- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Remote Boundary

The additive function migration is intended only for the linked synthetic/demo Supabase project. It creates no table, changes no clinical row, and grants execution only to `authenticated`; remote application and deployment evidence remain release-time facts.

## Remote Verification — 2026-08-30

- Applied the additive function to the linked synthetic/demo Supabase project as remote migration `20260830084301` (`chart_patient_history_read_model`).
- Catalog verification confirmed owner `postgres`, `SECURITY DEFINER`, empty `search_path`, no `anon`/`public` execute privilege, and `authenticated` execute privilege.
- An authenticated active member with `chart:view` read 초코's authoritative total of 27 encounters. Consecutive one-row pages returned distinct encounter IDs and non-null cursors, proving the first page boundary does not skip or duplicate the next row.
- A non-member was denied with `workspace_membership_missing`; a patient outside the requested workspace/patient scope was denied with `patient_unavailable`; an invalid cursor was denied with `invalid_cursor`.
- The security advisor reports the intentional authenticated `SECURITY DEFINER` RPC. This is accepted because the function independently checks `auth.uid()`, active workspace membership, `chart:view`, and patient/workspace scope before any projection; the performance advisor reported no notice for this function.


## Request Cancellation Follow-up — 2026-10-01 (Local Candidate)

- User approved efficiency item 2 only: cancel obsolete patient-history reads. Base: verified `origin/main` `dfc9b2ba` (#891–#893 included). Existing checkout WIP remains untouched; implementation is in a detached clean worktree.
- Reproduction: 125 synthetic records across 50/50/25 pages. Before the change, abort during pages 1/2 still completed old history; pre-aborted requests and count-mismatch retry also continued. Eight cancellation/signal checks failed; the existing real-error contract passed.
- `chart-patient-history-client.ts` accepts an optional `AbortSignal`, passes it to fetch and every page loader, and checks it before fetch, after body/page completion, and before each page/retry. Abort rejects with the signal reason; real read errors retain their existing response contract.
- `ChartContent` owns an AbortController per history effect. Patient, selected queue encounter, workspace, actor/account, refresh, auth eligibility changes, and unmount abort the old load. Cleanup clears only a matching in-progress history spinner. Historical encounter/chart display selection remains independent, preserving complete history, deep links, and SOAP source selection.
- Passed: 19 cancellation/server contracts (`chart-patient-history-cancellation.spec.ts` and `chart-patient-history-server.spec.ts`, server-free Playwright config); 6 Chromium tests (`chart.spec.ts --grep "live history cancellation|live patient chart history shows every chart"`) covering page-1/page-2 patient switch with late responses, same-patient queue-encounter switch, chart exit, logout, and historical read-only/deep-link/SOAP-source regression. Both the signal-aware fetch abort and a delayed mock that ignores abort are covered.
- Passed: `npx tsc --noEmit --pretty false`, `npm run lint` (0 errors, 5 existing warnings in WP10 scripts), `npm run build` (existing Turbopack dynamic-path warning), `npm run docs:check`, `npm run security:secrets`, and `git diff --check`. Local browser port/build process sandbox restrictions were resolved through the tool approval path; no approval rejection remains.
- Existing failure: `live patient chart history keeps loading, error, and empty states distinct` cannot find `chart-history-empty-state` after retry. The same assertion fails with both client/module restored temporarily to pristine `dfc9b2ba`; modified sources were restored in `finally`. This unrelated baseline behavior remains unchanged.
- Limits: workspace and live-account identity cancellation are enforced by effect dependencies and inspected locally; logout is browser-tested. No hosted environment was exercised. Fetch abort stops the client request/body and further pages/retries; it does not guarantee cancellation of a DB operation already started by the server.
- Initial local checkpoint performed no commit, push, PR, merge, deployment, DB/schema/RLS/billing change, or hosted clinical read/write. The subsequent user approval authorizes commit, push, PR Preview, and exact-candidate release preparation only. Main merge/Production deployment and hosted clinical/financial writes remain gated.
