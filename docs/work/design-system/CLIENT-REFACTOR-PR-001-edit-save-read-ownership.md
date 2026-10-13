---
id: "CLIENT-REFACTOR-PR-001"
type: "Work Item"
title: "Client edit, save and read ownership"
status: "human_review"
area: "design-system"
priority: "P1"
source_docs:
  - "docs/design/system/ui-refactor-operating-model.md"
  - "docs/design/system/ui-refactor-dod.md"
  - "docs/work/chart/CHART-REFACTOR-PR-001-order-catalog-read-boundary.md"
updated: "2026-10-13"
---

# Client Edit, Save And Read Ownership

## Scope and authorization

Separate feature-local owners for Chart editing, save execution and status
projection; reception lookup and profile projection; and persisted Lab result
reads. Preserve UI, API contracts, save/flush/confirmation semantics, workspace
and patient isolation, authoritative money checks and existing permissions.

The user approved local work, then push, Draft PR and exact-candidate CI. Merge,
Production, force push, direct main push, CI/security-policy changes, real data,
DB/RPC/migrations and permission/payment policy changes remain outside scope.
Original and separate UI WIP are excluded. Lab main/Phase2 WIP is held.

The preserved local checkpoint is
`153be7851276d75564b1ca1fa9279ee19fc7024e`, based on main `3d3920b`.
A separate integration branch merges main
`7fe8421d6d4f5e259a65740d112cb27848d30115` without conflicts. It retains PR #983's
provisional billing assignment read/poll/realtime guard byte for byte. This PR
contains only the approved refactor, fixture updates and this owning record;
#983 is upstream scope, not a new billing or authorization change here.

Review: [Draft PR for the integration branch](https://github.com/mcso0/emr-app-shell-prototype/pulls?q=head%3Acodex%2Frefactor-cycle2-integration-20261013).
Exact final head, local command results and CI URL belong in that PR and the
verification packet. Older Draft PRs #951, #959 and #965 are not changed.

Vercel remains **Only build production**. The user explicitly excludes a forced
Preview; the older automatic-Preview/Ready gate does not authorize changing this
setting. No Production action or hosted clinical smoke is performed in this stage.

## Owners and preserved behavior

| Area | Owner | Boundary |
| --- | --- | --- |
| Chart edits and acknowledgements | `use-chart-order-draft-session.ts` | Rows, dirty/edit versions, ETag and stable refs/setters |
| Draft save execution | `chart-order-draft-save-executor.ts` | Shared Promise, admission, request drain and response reconciliation |
| Draft status | `chart-order-draft-presentation.ts` | Read-only display projection |
| Confirmation display | Existing table presentation/status components | Kept with their existing owners |
| Reception lookup | `use-reception-patient-lookup.ts`, lookup model | Requests, selection and view values; JSX retained |
| Profile projection | Live side-panel model and format helpers | DTO to display values; commands/permissions remain with current owners |
| Persisted Lab read | Client, state projection and React hook | Request I/O, exact-scope parsing and cancellation/lifecycle |

Save callbacks, edit markers, flush/unload registration, confirmation commands,
billing acceptance and load/timer bodies retain their prior behavior. Twelve
Chart and thirty reception/profile/Lab comparisons match. Existing source
characterization assertions remain unchanged after locating the actual memo
function and moved callback owners.

The Lab consumer checks abort after its awaited read as well as inside the client.
The actual effect callback is exercised with a synthetic lifecycle to cover a read
that settles immediately before cleanup; it must preserve the next owner's state.
This does not claim a React mount or live-device verification.

Fixture changes preserve their intended assertions: search uses an exact heading
and selected tab; narrow profile checks start with navigation closed; dirty
workspace confirmation uses the existing complete synthetic Chart fixture rather
than unready default-demo reads. No tests are deleted/skipped and no timeout,
assertion, authorization or save protection is weakened.

## Criteria and evidence map

| Criterion | Evidence and acceptance |
| --- | --- |
| C1 | Feature owners above; 12 identical Chart callback/effect bodies; save-operation and ownership characterization |
| C2 | Save22 and tab7: patient/tab/workspace pending-save, failure, explicit retry, cancel and preserved edits |
| C3 | Deferred-response/merge/ETag tests and Lab actual-effect cleanup regression |
| C4 | Selected feature-local read/model split; 30 unchanged projection/JSX/state/dependency comparisons; WIP areas held |
| C5 | Reception lookup/edit and profile loading/empty/error/retry/refresh; Lab persisted-result and API-wiring cases |
| C6 | Existing assignee/denial guards and synthetic authority cases; server/API/DB/RLS/payment policy unchanged |
| C7 | Legacy search6 plus native semantics8; exact heading and selected information tab |
| C8 | Native accessible names and keyboard search/filter/tab/profile actions; named Chart inputs/buttons; preserved JSX. Actual VoiceOver/full WCAG are limitations, not added acceptance obligations |
| C9 | Navigation, search, selection, query/reset/focus, cancellation and tab lifecycle cases |
| C10 | Per-case source/test/result mapping; reproducible manual procedures below; unexecuted manual work is not counted as passed |
| C11 | Final source-matched focused tests, lint/type/build/docs/secrets/UX, exact-head Release Check and WIP preservation |
| C12 | Changed scope, remaining issues, unverified work and rollback packet; merge/Production and source/deployment/alias/minimal read proof only after separate exact-candidate approval |

The original checkpoint's one-pass evidence covers 112 browser/API cases,
197 unit cases and 22 identical-source reused cases (331 unique case ids).
Search14 and switcher14 are explicitly mapped. The integration retains all
refactor source/test bytes; only upstream billing assignment and owning docs
advance. Reverify #983's provisional-to-persisted path and related billing browser
cases, then rerun required final-candidate quality gates. Reused cases require
source/test/dependency identity proof; a green unrelated test is not completion.

### Reproducible manual procedures

- In owned localhost mock/synthetic setup, edit A and select another patient, tab
  or workspace. Hold/fail the save, retry explicitly and cancel pending selection;
  release old A responses after B edits and verify B values and ETag stay intact.
- Exercise scoped lookup/profile/result loading, empty, denial and retry/refresh;
  select/edit a synthetic subject and verify readback and ownership restrictions.
- Use keyboard search, filtering, Enter/Escape/Tab and native profile tab navigation;
  activate named primary controls and verify focus after close. Inspect accessible
  names on touched inputs/buttons. Actual VoiceOver speech/cursor is unverified
  when no supported inspection path exists; do not change global tool settings.

These procedures supplement specific automated results. They are not recorded as
manually passed unless executed and evidenced.

## Limits and handoff

Historical concurrent-dev initial SyntaxError and unscoped default-demo loading
remain independently recorded observations; the successful scoped fixture does
not establish their root cause. Existing SVG attribute console warnings remain.
No real-data or full DB/RLS/device/provider/compliance acceptance is claimed.

The local checkpoint and candidate refs stay reachable. For any later approved
release, preserve the current production source/deployment or a reviewed revert
of the eventual merge as rollback evidence. Reconfirm live main and exact PR head
before approval; this work item does not authorize merge or deployment.
