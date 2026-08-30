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
updated: "2026-08-30"
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
