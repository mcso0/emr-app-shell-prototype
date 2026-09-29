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
updated: "2026-09-29"
---

# Billing UX Loading, Failure, Retry, and Payment State Clarity

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
