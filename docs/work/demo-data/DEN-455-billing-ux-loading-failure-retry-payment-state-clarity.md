---
id: "DEN-455"
status: "human_review"
area: "demo-data"
priority: "P0"
target_pr: "Linear DEN-455"
source_docs:
  - "docs/design/flows/guardian-centered-billing-checkout-flow.md"
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/index.md"
  - "docs/work/demo-data/DEN-454-billing-api-primary-invoice-payment-checkout-state.md"
dependencies:
  - "DEN-454"
updated: "2026-11-03"
---

# Billing UX Loading, Failure, Retry, and Payment State Clarity

## Approved Page Loading Follow-up — 2026-11-03

승욱 approved local implementation of the cross-page loading investigation.
Baseline: `5455106e61885109e724763c92e099957654ac84`; isolated clean branch
`codex/page-loading-boundary`. Reuse the current worktree and preserve unrelated
WIP. No push, PR, merge, deployment, remote data, migration, or provider operation
is authorized by this follow-up.

Outcome: during initial entry and page/selected-entity transitions, show only the
loading surface within the page-owned area. Patient/work information bars,
document tools, internal tabs, body and page-owned supporting panels appear
together after required reads resolve. Include queue → 담당하기, 담당하기 A → B,
and 담당하기 → 업무 지시서. App navigation and workspace tabs remain outside the
page-owned content boundary. Keep same-page background refresh and save states
separate; preserve drafts, authorization, command semantics and checkout timing.

Scope: shared page readiness/presentation contract; chart, dispensing/treatment,
lab, imaging, billing, home, reception, customer lists/profile panels, hospital
settings and personal settings. Static/local pages need no artificial requests.
Separate loading, ready, empty, denied and failed outcomes. Keep reads mounted
while masking presentation; avoid a load/unmount deadlock and stale completions.

Verification: local mocked/synthetic API responses only, deferred first and
subsequent reads, cold/cached selection changes, entry transitions, failures,
rapid A/B changes, hidden/inert page chrome and draft-preserving refresh. Update
the affected Storybook stories and previous partial-loading expectations. Run
focused behavior checks, type/lint/docs checks and build. Record actual results
below after verification. Human acceptance and delivery remain separate.


### Local result — 2026-11-03

Implemented a shared page boundary that masks page-owned bars, tabs, document
controls, body, supporting panels and portals until required readers settle.
Readers remain mounted and masked content is inert. Scope changes re-enter
loading; same-scope background refreshes preserve drafts and the visible page.
Module navigation, queue navigation and workspace tabs remain available.
Customer and catalog re-entry now await this mount's read even when a shared
store still contains an older ready result. Schedule week reads reject stale
completions. Assignment and payment command semantics remain unchanged.

Local synthetic verification:

- The 45 focused entry/general-page cases passed across the main run and the
  targeted requester-completion rerun. The additional prework A-B-A navigation
  case passed, including rejection of the late B response. Coverage includes
  first instruction/assignee/profile reads, entry-to-instruction reads, billing
  checkout preparation, retry, ownership cases, and 12 delayed-page/403 cases.
- Customer initial/re-entry, catalog initial/re-entry, and home loading checks
  passed. Customer and catalog delayed-denial cases were rerun after the cached
  readiness correction and passed. Screenshots show only the centered loading
  surface inside the page-owned area.
- Core boundary and prework Storybook: 10 passed with the repository runner.
  The installed Storybook provider lacks Next 16.4's parentRenderTree context;
  the normal runner failed before rendering 19 schedule/personal-profile cases.
  An external test-only context adapter supplied that missing field: 18 passed,
  then the new schedule loading case passed after correcting its button label.
  These 19 are adapted-harness evidence, not a passing unmodified runner.
  No dependency, application router, or repository test-runner config changed.
- TypeScript, full lint, focused final lint, build, docs links, Korean copy,
  secret scan and diff whitespace passed. Build retains the docs filesystem
  tracing warning. Secret scan covers tracked files; new files contain only
  generic UI/readiness code and synthetic test fixtures and were reviewed too.

Initial checkpoint (superseded by the regression follow-up below): the 75-case
run had 62 passes and 13 failures.
Three failed cases passed targeted reruns (requester completion, lab date change,
collapsed billing queue). Ten older queue cases remain failing. Nine reproduced
the same assertions on unchanged `5455106e`: six late-response fixture cases,
two collapsed-panel request counts, and one billing case that expects the invoice
before the entry gate. The other old billing-selection case timed out navigating
on the baseline, so an identical baseline assertion was not established. New
billing selection/entry tests passed, but this legacy case is not counted green.
Five pre-existing source-text contract tests also fail on unchanged baseline.
These findings are recorded without expanding this local page-loading change.

Evidence is retained locally in the chat's `page-loading-implementation` artifact
folder (screenshots, run logs and the test-only adapter). No commit, push, PR,
merge, remote write, migration, or deployment was performed. Local implementation
and scoped verification are ready for human review; the broader suite is not
reported as fully passing.

### Regression follow-up authorization — 2026-11-03

승욱 requested diagnosis of the remaining ten failures and correction of issues
related to the page-loading change, with local verification only. Preserve the
existing local implementation and unrelated WIP. Reuse synthetic browser reads;
no remote mutation, deployment, dependency upgrade or workflow-policy change.
Check current queue labels, shared pending-request behavior, billing prework
identity/entry contracts and required-read completion. Keep the original
late-response, selection, URL cleanup, loading isolation and no-write assertions.

### Regression follow-up result — 2026-11-03

All ten remaining cases are resolved locally. The unchanged pre-follow-up build
reproduced all ten failures (14 selected cases: ten failed, four passed).

| Cases | Confirmed cause | Correction |
| --- | --- | --- |
| Six lab/imaging/dispensing A-B-C/A-B-A cases | Patient-view group labels now combine patient and guardian names; exact standalone patient text no longer exists in the queue. The correct current patient was visible in the failed snapshots. | Assert the accessible patient-group name. Preserve current identity, late response rejection across the whole page, and completed loading assertions. |
| Two lab/imaging panel-collapse cases | Opening the panel reuses the content's in-flight request. The old test incorrectly required another network request. | Assert loading with the panel closed, opened and closed again; release the pending read and require the correct empty outcome. |
| Two billing selection cases | Old assertions expected the invoice work table and combined heading before the new prework entry gate. Required assignment/profile/vitals/history mocks were missing, and two distinct patient names shared one ID. | Assert current prework patient/guardian/claim information, distinct patient identities, invoice selection, query cleanup and domain write exclusion. |

Strengthening the billing cases exposed one actual page-loading omission:
`BillingPreworkHistory` did not register its initial ledger read with the page
boundary. Even with all other required reads settled, the page appeared before
history completed. Three delayed-ledger cases (200/403/500) failed before the
fix. The runtime correction adds only the history readiness registration.
Missing guardian and failed reads release loading; same-page retry keeps the
page visible and recovers to the existing empty-history view.

Verification after correction:

- `queue-content-loading.spec.ts` (32 cases) and `order-work-entry.spec.ts`
  (15 cases): all 47 distinct scenarios passed across the integrated run and
  focused rerun. The integrated run was 46/47; its only failure was the newly
  broadened no-write assertion catching the normal shell tab-preference PUT.
  After explicitly excluding only that preference endpoint, all four affected
  billing cases passed. Clinical/billing changes, assignment PATCH and checkout
  POST remain prohibited by the test assertion and were not observed.
- Late-response rejection, cached dates, initial reads, 403/500 and retry,
  collapsed queues, ownership entry and delayed checkout preparation passed.
  Ledger-only delay screenshots confirm the information bar, tabs and body stay
  hidden and inert. Ledger failures release the page; deferred retries preserve
  the ready page, then resolve successfully.
- Build, TypeScript, focused ESLint, documentation links and diff whitespace
  passed. Build retains the unrelated docs filesystem tracing warning.
- Browser APIs were intercepted with synthetic responses. Unhandled workspace
  APIs return synthetic 404 and external browser traffic is blocked. Tab
  preference persistence is also intercepted; no remote data was changed.

Evidence: local `page-loading-implementation/regression-followup` screenshots
and logs. Only billing readiness, this regression spec and this work record
changed in the follow-up. Prior implementation/WIP is preserved. No commit,
push, PR, merge or deployment. The unrelated source-text test and stock
Storybook-provider limitations from the earlier checkpoint were not included
in this ten-case follow-up and are not newly claimed as passing.

### Page loading delivery authorization — 2026-11-03

승욱 explicitly authorized a PR containing only this page-loading implementation
and its regression corrections, followed by main merge and Production deployment
once checks pass. Preserve unrelated WIP. This supersedes the prior local-only
hold for this bounded task; it does not authorize DB, migration, role-policy,
provider, payment, email, environment, protection or subscription changes.

Synchronize with current main, inspect the final diff, and record exact candidate,
Release Check provenance, Ready Preview, focused verification and expected-head
merge protection in the PR. Hosted smoke is limited to login and anonymous route
protection for the affected modules; behavioral verification uses intercepted
synthetic local APIs. Preview and Production share the demo backend, so no live
patient/guardian/financial rows or mutation are included. Current rollback
candidate is Ready deployment `dpl_H3t59E8FyYiJJvPbxSRUVAcfg9Va`, source
`11ed230d1029290ec0ae627ade20e0663c250fc5`. Refresh this comparison if main moves.
The existing one-off Preview path does not enable project-wide automation.

## Goal

Make the API-primary billing screen show understandable loading, failure, retry, and permission states for invoice lines, payment status, and checkout session preparation.

## Scope

- Track invoice-line and payment-status read states in the billing workspace data hook.
- Surface loading, retryable failure, permission denial, and empty API response states in the central billing workspace.
- Track checkout session preparation state and expose retry for checkout preparation failures.
- Keep existing fixture fallback visible only with an explicit API-state notice when readback fails or is empty.
- Add focused Playwright coverage for:
  - retryable invoice-line API read failure and recovery
  - permission denial distinct from retryable failure
  - checkout session failure and retry recovery

## Out Of Scope

- Real PG/Stripe or receipt/refund/settlement/accounting integration.
- DB schema, migration, seed, or RLS changes.
- Billing UX redesign beyond state clarity and retry affordances.
- Full removal of Sales Demo or unconfigured local fallback behavior.

## Done Criteria

- Billing staff can see whether billing API data is loading, blocked by permission, retryable after failure, or empty.
- Retryable failures expose visible retry actions.
- Permission errors do not look like normal network retries.
- Checkout session failure has its own visible retry path.
- Focused UI/E2E assertions cover the new states.

## Verification

- `npx playwright test tests/ui-demo-api-wiring-e2e.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`

## Result

DEN-455 adds visible API state handling for the billing demo path. Invoice/payment reads now expose loading, permission, retryable failure, and empty states, while checkout preparation has its own status and retry affordance. Mock fallback remains available but is no longer silent when the API readback path fails.

## Approved Follow-up — 2026-09-29

This follow-up supersedes the earlier migration exclusion only for the
function-only queue reader; table, role-policy, seed, and financial mutations
remain out of scope.

The user approved a TDD implementation for date-transition loading in lab,
imaging, dispensing/treatment, and billing after a code investigation. Local
scope includes centered chart-style loading, scoped request/cache handling,
read failure/permission states, and a date-scoped billing queue API plus a
function-only `billing:view` RPC. Use synthetic fixtures only. Local SQL proof
may run in a transaction against the named synthetic Docker database
`supabase_db_clinical-preset-perf-seeded-20260831` and must roll back. No remote
DB apply, data import, production deployment, alias change, or new release is
approved by this follow-up.

Billing queue date semantics: waiting/unpaid invoices remain visible from their
request date onward; terminal invoices appear on their request date. Existing
billing lifecycle classification owns status. Queue discovery is read-only and
must not synchronize candidates or initiate payment/checkout mutations.


### Local Follow-up Result

Human Review. Candidate branch: `codex/queue-content-loading`, based on
`f3d9c647b84336dac863c42f2ad83cdf609a8fa4`. No commit/release for this follow-up.
Baseline comparisons temporarily restored the affected source files and restored
all implementation bytes afterward, verified by SHA256. Those source files are
identical at candidate HEAD and the inspected `origin/main`; the surrounding
checkout is the candidate base.

Lab/imaging/dispensing/billing now show a centered `md` spinner
until the selected operating date resolves. Dispensing uses this surface instead
of the blue loading notice. Errors and permission denials cannot become no-work
states. Re-entering a date still shows pending state, and late A-B-C/A-B-A
responses cannot replace the current scope. Scoped completion can notify remaining
consumers after the requesting panel unmounts.

Billing discovers minimal live queue cards without fixture-ID joins. Selecting a
card carries invoice/encounter/date, clears inherited order filters, and keeps
pending feedback until matching encounter context arrives. Invoice and summary
workspace/encounter relationships are checked before composing patient and
financial details. Existing detail/checkout permission gates and behavior remain
in place. Queue discovery itself is GET-only.

TDD evidence:

- Red: all four date-transition cases failed before implementation. Three modules
  showed missing loading; billing did not issue a date-scoped queue request.
- Additional Red cases: failed reads mistaken for empty, missing SQL reader,
  status-only deleted subject name exposure, RPC permission denial becoming 500,
  missing encounter selection context, and stale patient context on A-B selection.
- Green: all 38 new tests passed in the final focused run. They cover datepicker
  transitions and cached dates, initial read, 403/500/retry, rapid date changes,
  panel collapse, billing selection, API boundaries, and pagination. Geometry
  checks verify center offsets within 1px, `role=status`, and `data-size=md`.
- Final focused run: 42/43 passed, including those 38, dispensing permission state,
  and three chart date/error baselines. The remaining chart loading geometry
  case fails at `scrollWidth=480` vs `clientWidth+1=444` on the unchanged baseline
  source too. See `/tmp/queue-loading-final-focused.log` and
  `/tmp/queue-loading-chart-baseline.log`.
- Broader workflow run: 82/85 passed. The dispensing permission test expected an
  obsolete selection prompt; its assertion was updated and the targeted case
  passed. The other two failures (Kong CBC fixture value and imaging completed
  state) were reproduced by the full lab/imaging spec on the unchanged baseline:
  13/15 passed with the same two failures. They remain outside this follow-up.
  See `/tmp/queue-loading-regression.log` and
  `/tmp/queue-loading-lab-baseline.log`.
- `tests/billing-security-regression.spec.ts`: 3/3 passed.
- `npx tsc --noEmit`, changed-file ESLint, full lint, build, docs links, Korean
  UX copy, and secret scan passed. Full lint retains five warnings in untouched
  WP10 scripts; build retains one docs-viewer tracing warning. The same secret
  scanner also checked untracked new files (4466 files total).
- `node scripts/test-billing-queue-local.mjs`: passed against only the named
  synthetic local Docker database, inside BEGIN/ROLLBACK. Billing-only access,
  reception-only denial, workspace/actor/date boundaries, carryover/terminal
  dates, pagination, archived names, inactive membership, and no invoice mutation
  were verified. Post-run proof: zero synthetic workspaces and no new public RPC
  persisted. See `/tmp/billing-queue-sql-green.log`.
- The security specialist's final read-only review found no remaining findings
  in the new reader and selection guards. No remote DB or release was performed.

Reproduce the focused implementation checks:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3117 npx playwright test tests/queue-content-loading.spec.ts tests/billing-queue-server.spec.ts --reporter=line
node scripts/test-billing-queue-local.mjs
```

Production remains unchanged. The function-only migration
`20260929090000_billing_operating_date_queue_reader.sql` must be applied as part
of a separately authorized release before live billing queue discovery works.
Local screenshots are `/tmp/emr-{lab,imaging,dispensing,billing}-queue-loading.png`.


### Delivery Authorization — 2026-09-29

The user requested commit, push, PR, origin/main merge, and approved deployment
for this follow-up. Prepare the latest-main candidate, exact Release Check,
Ready Preview, scoped smoke, and rollback evidence. Remote application of the
function-only billing queue migration requires its separately scoped approval
before merge; no customer, financial, role-policy, or seed writes are included.

### Approved Delivery and Membership Schema Correction — 2026-09-29

The user approved the separately scoped remote billing reader application and
continued commit/push/PR/main/Production delivery. PR #856's candidate
`833cd27d197b09fa52b4f5de0ee735866c176357` passed Release Check 36537371933
and merged as `b191765d7350bd67819aa16ca883a41acd608e6b`, verified on live
`origin/main`. Production `dpl_FtHdSuozkpx8gjWg2u3anxteJvyA` reached Ready
at the canonical alias; `/login` returned HTTP 200.

The first authenticated billing smoke exposed a schema mismatch: the local
synthetic database has `user_memberships.deleted_at`, while the linked remote
schema does not. The reader's requester-name join raised PostgreSQL 42703.
The forward migration `20260929093000_billing_queue_membership_status.sql`
removes only that unavailable display-join predicate. Active membership status,
canonical `billing:view` authorization, workspace joins, subject soft-deletion
filters, search path, and function execution grants remain enforced. No table,
role policy, financial row, or fixture was modified remotely.

TDD: `node scripts/test-billing-queue-local.mjs --remote-membership-shape`
first failed with the same missing-column error. With the forward migration,
both remote-shaped and original local schemas passed the full SQL proof. The
schema change, fixtures, and migrations rolled back: zero proof workspaces, no
persisted reader RPC, and the original local membership column restored. Remote
EXPLAIN (without ANALYZE or row reads) verified all referenced columns. Catalog
readback confirmed authenticated-only execution, stable functions, and fixed
`pg_catalog` search paths.

After the approved same-function correction, authenticated Production smoke
verified all four central pending states and subsequent no-work views on
2026-01-01 through 2026-01-06. Dispensing had no fulfillment warning in pending
or completed-empty state. Live dispensing/billing center offsets were below
0.01px; both used `role=status` and `data-size=md`. No clinical/order/payment
mutation was performed. Screenshots are in `/tmp/queue-production-evidence/`.
The correction's repository delivery continues in a separate narrow PR; app
source is unchanged from the already checked and deployed PR #856.

Rollback evidence: original pre-release Ready deployment
`dpl_9LBhyCKpo2YVz7PEpsux32XSfych`. The additive reader functions can be removed
by dropping the public wrapper then the private reader only, with separate
rollback authorization. Do not restore the defective missing-column predicate.
