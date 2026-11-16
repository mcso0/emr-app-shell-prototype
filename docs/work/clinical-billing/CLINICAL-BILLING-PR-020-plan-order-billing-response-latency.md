---
id: "CLINICAL-BILLING-PR-020"
status: "done"
area: "clinical-billing"
priority: "P0"
target_pr: "#681"
source_docs:
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-018-plan-order-billing-summary-freshness.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-019-plan-order-billing-summary-integrity.md"
  - "docs/engineering/data-model/order-fulfillment-handoff-contract.md"
dependencies:
  - "CLINICAL-BILLING-PR-019"
updated: "2026-08-31"
---

# Plan/Order Billing Response Latency

## Goal

Remove the mutation-to-Summary GET waterfall so an order edit shows an immediate
local estimate and then adopts the authoritative amount from the same successful
mutation response, without weakening billing, workspace, or permission
boundaries.

## Scope

- Extend the existing draft, atomic confirmation, and execution mutation RPC
  responses with the current encounter `billingSummary` while preserving public
  RPC names and request signatures.
- Keep the renamed mutation bodies private to their authenticated wrappers and
  retain actor, active-membership, action-specific permission checks, and the
  `chart:view` capability required to read the returned Summary.
- Recompute the current Summary after an idempotent base replay rather than
  returning a stored historical Summary.
- Apply one workspace/encounter-scoped authoritative Summary path on the client
  that invalidates earlier GET sequences and updates Summary, ETag, freshness,
  and error state together.
- Replace the normal post-mutation Summary GET with the mutation response.
  Preserve GET recovery for initial load, safe focus/visibility revalidation,
  conflicts, lost-response readback, and explicit retry.
- Show an immediate draft-only amount delta over the last server Summary while
  preserving its discounts, surcharges, tax, payment, invoice, and outstanding
  values.
- Keep fixed/range set-parent and included-order-sum reflection rules aligned
  with the server-owned Summary.
- Save discrete add/delete/set/priority changes after 150ms, continuous input
  after 700ms, and clear an add-delete net-zero change before any request.
- Block `Order 청구` for preview, invalid, failed, conflict, stale, or
  non-authoritative states.

## Out Of Scope

- Remote migration application, fixed staging movement, `main`, or production
  deployment without a separate exact-target approval.
- Server timing, Vercel region placement, or fixed-staging performance
  measurement; those belong to `CLINICAL-BILLING-PR-021`.
- Cross-session Realtime invalidation; that belongs to
  `CLINICAL-BILLING-PR-022`.
- New data-fetching libraries, observability vendors, price policy, invoice
  policy, or permission expansion.
- Real patient, guardian, payment, or invoice data.

## Done When

- Each successful mutation response contains a Summary identical to an
  immediate authorized direct read for the same workspace and encounter.
- Idempotent confirmation and execution replay creates no duplicate write and
  returns the current Summary.
- A normal draft, confirmation, or execution mutation performs one mutation
  request and no trailing Summary GET.
- The next render after a valid edit shows `오더 예상 총액` and
  `예상 · 저장 중`; success switches to `청구 예상 총액`.
- Invalid input and failed/conflicted saves retain the previous server amount,
  show the required `금액 미반영` state, and disable billing.
- Older delayed GET responses cannot overwrite a newer mutation Summary.
- Local SQL apply/reapply, ACL, response equality, idempotent replay, and
  rollback-zero-residue checks pass with synthetic data.
- A custom role that has only the mutation capability but lacks `chart:view`
  is rejected before the database gateway runs.
- Focused Playwright, TypeScript, lint, build, docs, diff, and secret gates pass,
  followed by an independent security-boundary review.

## Verification

- `scripts/test-chart-order-mutation-billing-summary-migration.sh`
- `scripts/test-chart-order-mutation-billing-summary-responses.sh`
- `npx playwright test tests/chart-order-mutation-billing-summary-contract.spec.ts tests/chart-order-billing-summary-freshness.spec.ts tests/chart-order-draft-persistence-server.spec.ts tests/chart-order-action-persistence-server.spec.ts tests/chart-order-revision-attempt-contract.spec.ts tests/chart-order-shared-draft-contract.spec.ts --reporter=line`
- `npm run security:secrets`
- `npm run docs:check`
- `git diff --check`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

## Review And Release Policy

- Implement and verify only in the clean worktree created from the inspected
  `origin/main` SHA; preserve the dirty primary checkout.
- Run an independent security-boundary review after the exact migration and
  local SQL evidence are stable.
- A pull request may provide a Preview candidate, but remote DB migration,
  fixed staging, `main`, and production remain blocked until the exact source
  SHA, target, migration, smoke path, and rollback candidate receive approval.

## Release Evidence

- GitHub PR `#681` merged to `staging` as
  `e230d2db56283e913da32c2c737cf7df48db214e`; Release Check run
  `33363968392` passed.
- Approved migration
  `20260831053359_chart_order_mutation_billing_summary.sql` was applied to the
  inspected `ap-southeast-2` shared staging project. Remote wrapper/base ACL,
  synthetic atomic-confirmation and revision replay, and rollback residue
  checks passed.
- Fixed staging alias run `33364502104` passed for Vercel deployment
  `dpl_CXPRbT2rhYgKQgToa5kcnifbVY2o` built from the same merge SHA.
- Authenticated synthetic smoke showed the estimate in 64ms on the measured
  restore edit, changed the authoritative amount from 201,000원 to 402,000원,
  and restored it to 201,000원. The two normal saves produced two mutation
  PATCH requests and zero trailing Summary GET requests.
- The `main`/`staging` reconciliation candidate removed blur-triggered writes
  from continuous fields, kept table column instances stable while draft rows
  change, disabled confirmation during a revision conflict, and skips the
  redundant draft PATCH when autosave already persisted the selected rows.
  Focused chart integration passed `9/9`; billing, Realtime, Server-Timing, and
  SOAP contracts passed `55/55`; PR-020, PR-022, and SOAP migration
  apply/reapply/permission/rollback contracts passed against local Supabase.
- `origin/main` and the production deployment remained unchanged. Region and
  request-stage performance work continues in `CLINICAL-BILLING-PR-021`.

## 2026-11-07 approved local latency follow-up (locally verified)

- 승욱 approved local implementation and before/after measurement against
  origin/main `81e4146c`. Remove redundant catalog/context/set-preview reads
  before draft save; preserve service_catalog:view, chart permissions, server
  quantity calculation, consultation normalization, CAS, and confirmation guards.
- Use only synthetic fixtures in a new loopback Supabase stack and baseline/
  candidate local production builds. Prior local stacks and source WIP stay intact.
- Profile projection entry counts and inclusive calculation time separately from
  catalog reads and full saves. Repeated calls alone do not prove a bottleneck.
- Complete when focused regressions pass and measured median/p95, data size,
  correctness, and limitations are recorded. No remote writes or release authorized.
- Reuse PR-021 Server-Timing; benchmark evidence stays in .artifacts/dispense-latency.
- Compatibility found during implementation: the former API supplied missing
  consultation detail inputs. A bounded migration moves that default into the
  existing DB consultation normalizer. Other omitted details retain their original
  meaning. Apply/reapply and authenticated readback will be checked locally.

### Measured API and DB evidence

- Base: `81e4146cfff87d9cfb1e2cac582c7a2f347cfe05`. Two Next production
  builds use the same isolated local Supabase stack. Auth is real local Supabase
  Auth; no request mocking or artificial query delays. Synthetic catalog: 1,000
  dispensing items plus one consultation and one three-child mixed set. The local
  PostgREST row limit returns 1,000 catalog rows. No production data was copied.
- 33 alternating paired rounds per scenario; first three rounds excluded. Each
  measured request starts from equivalent synthetic state. All 198 responses
  contain the expected ready quantities (3.75, edited 4.5) and canonical set vet.

| Scenario | Before median / p95 | After median / p95 | Median reduction |
| --- | --- | --- | --- |
| Individual add | 523 / 1,593 ms | 52 / 191 ms | 90.1% |
| Prescription edit | 554 / 1,341 ms | 41 / 160 ms | 92.6% |
| Mixed set add | 637 / 1,976 ms | 75 / 304 ms | 88.2% |

- These are HTTP request-to-parsed-response measurements, not CPU calculation
  times or production latency predictions. The existing 150ms discrete-save
  delay and client render time are outside this API measurement. Host-load
  variability remains visible in p95. Warmups are not claimed as cold-start data.
- DB profiling: `SET LOCAL track_functions='all'` and transaction-local function
  stats; 30 measured rollback saves per scenario after one excluded initial run.
  Each profile uses a fresh SQL session, so SQL statement-plan initialization is
  included; pooled HTTP and direct SQL timings are not interchangeable.
- Projection entries / deep arithmetic calls: add 2/1, edit 3/2, two dispensing
  set children 4/2. Inclusive projection median totals: 2.14, 2.91, 2.50ms. Deep
  arithmetic median totals: 0.45, 0.59, 0.49ms. Nested inclusive totals must not be
  summed. Duplication exists, but is not the dominant measured latency source.
  Calculation triggers, intermediate manual-value retention and reconfirmation
  logic are deliberately unchanged.
- The local stack reuses historical synthetic bootstrap adjustments (demo-only
  imports/checks omitted), then applies the current source schema. This is not
  evidence of a pristine historical migration replay or hosted performance.
- Normalization migration apply and reapply pass. The new SQL rehearsal fails
  before the migration for omitted consultation details and passes afterward.
  Real authenticated API checks cover omitted/empty/spoofed consultation details,
  missing veterinarian, mixed set, stale-write rejection, anonymous rejection,
  and catalog permission denial on both builds.
- The existing core contract still requires detailInputs/detailSchemaVersion as a
  pair. The former API happened to repair incomplete consultation pairs; those
  malformed payloads now receive 400. Supported app callers supply the pair.
- Future release must apply the normalization migration before the API change.
  This task authorizes local work only; no remote migration, push, PR, or deploy.

### Final local verification

- Actual browser add: 10 alternating pairs after one excluded pair. Selection
  completion click to ready actual-quantity input (3.75 TAB) median 855 -> 341ms;
  p95 1,381 -> 346ms. This includes the unchanged debounce and browser automation
  overhead. The final field is visible and the row shows 미확정.
- PostgreSQL statement counts for one mixed-set PATCH: catalog/context/preview
  RPCs 1/1/1 -> 0/0/0; canonical save stays exactly 1. Browser catalog search
  remains available and is outside the measured PATCH path.
- Full-schema authenticated confirmation: missing dose/calculation is rejected
  with actual_dispense_confirmation_blocked; ready 3.75 quantity confirms in a
  rollback-only transaction. Incomplete detail/schema input pairs are rejected.
- 30 focused draft/consultation/timing tests passed. The mock-route integration
  case was excluded from the real-auth config and replaced by actual authenticated
  API checks (12 checks), plus the confirmation checks. The isolated existing SQL
  suite passed quantity calculation, manual retention, units, reconfirmation,
  permissions and concurrent stale-write rejection.
- Both production builds passed. Focused lint, TypeScript, docs references,
  tracked-file secret scan, and diff whitespace checks passed. Independent
  read-only review found no quantity/confirmation/CAS/permission regression;
  the incomplete-pair compatibility boundary above remains explicit.
- API timing samples use the origin/main DB calculation chain for both builds.
  The optional-consultation migration was applied afterward and checked via live
  API, SQL rehearsal, statement counts, confirmation, and browser measurements.
  It does not alter the standard measured prescription payload or computation.
- Evidence: .artifacts/dispense-latency/{summary.json,api-samples.json,
  db-profile.json,ui-summary.json,ui-samples.json,rpc-counts.json,live-checks.json,
  confirmation-checks.json}; visible capture: output/playwright/dispense-latency-after.png.
- Local implementation is complete. Production performance and human acceptance
  remain unverified; no remote state changed.
- Cleanup: both task app servers and the owned Supabase stack are stopped; its
  synthetic volume is retained for reproducibility. Preexisting local stacks
  remain running. The temporary baseline checkout is archived; candidate work
  and hashed measurement evidence remain in the attached worktree.

## 2026-11-07 approved delivery and Production verification

승욱 explicitly authorized committing/pushing this bounded change, opening a PR,
merging after verification, applying the necessary migration, deploying, and
checking actual quantity responsiveness in Production. This supersedes the prior
local-only gate for this follow-up. It does not authorize unrelated releases or
real patient/guardian/payment/provider/email actions.

- Target: main and the existing Vercel Production project; existing shared
  Supabase project qmerxgzrwaaahpkhjqlc. Apply only the consultation-normalization
  migration after checking its current function definition and preserving ACLs.
- Smoke: new synthetic Auth account and isolated synthetic workspace/catalog,
  patient, encounter, chart and draft orders; no billing request, clinical work,
  real communications, or real records. Compare authenticated API and browser
  quantity readiness before/after; delete only task-owned fixtures afterward.
- Keep credentials, raw SQL fixture data, snapshots and timing artifacts local.
  Public PR contains only source, regression tests and aggregate evidence.
- Before merge: exact-head Release Check and Ready Preview, full local gates,
  scoped checks, current Production/rollback identity and migration backup.
- Stop on a failed gate, unexpected target/function drift, failed server quantity
  or confirmation guard, or unresolved cleanup. No permission/RLS weakening.

## 2026-11-09 save timing and response follow-up

The local candidate uses origin/main `34379835`. The user approved the
follow-up in this order: distinguish wait stages, remove discarded intermediate
readbacks, then combine permission reads. Verification uses the isolated local
Supabase fixture with 1,001 catalog items and a three-item mixed set.

- The chart PATCH correlates its server-generated request ID with the Supabase
  response request ID when available. Timing records contain allowlisted
  durations and no clinical or request payload fields. The DB reports total
  function time, the chart guard (authorization and chart/encounter lock
  acquisition), and the catalog advisory lock plus encounter relock.
- Supabase upstream and PostgREST transaction times are optional and depend on
  response headers. The difference between RPC time and DB function time can
  include pool wait, transport, and response work. Use pool occupancy and wait
  metrics alongside the correlated logs to classify a production incident.
  Later row locks are included in DB function time.
- The two owner-only intermediate writers no longer construct unused draft
  responses. The final readback follows candidate removals and remains in the
  same transaction. Optimistic version checks, server quantity calculation,
  billing summary, and confirmation validation retain their existing contracts.
- PATCH reads the existing permission inputs through one invoker RPC subject
  to existing RLS. The server uses the same resolver. Only a missing RPC
  triggers the legacy read path during rollout.

With each initial sample excluded, 32 local warm samples per variant measured
mixed-set DB save median 37.31 to 21.76ms and p95 58.55 to 33.18ms.
Full draft readbacks decreased from three to one. An earlier run measured
27.84 to 24.44ms, so these local timings vary across runs.
In 32 alternating pairs, permission reads decreased from five to one and
median lookup time from 3.20 to 1.96ms. Separate controlled probes attributed
about 449ms to each of the chart and catalog lock scenarios. When all ten
local PostgREST slots were occupied, HTTP time was 1,514ms, DB function time
88ms, and initial lock acquisition 0.1ms.

The three migrations applied and reapplied successfully in the isolated
stack. The permission RPC is invoker-only and executable by authenticated
callers, with anonymous and service-role execution denied. The real
authenticated PATCH verified set save and removal, quantities, billing
summary, version conflict, workspace and catalog permission denials, and
confirmation gating. The shared draft and consultation SQL checks and
production build passed. The focused Playwright run passed 52 cases.
Two baseline source-text assertions are stale. Two tests requiring a mock
HTTP server were replaced for this check by authenticated local API probes.

Raw evidence lives in the untracked `.artifacts/chart-draft-save-stages`
directory. These measurements do not establish the cause of the historical
7.53-second production request. Production observation requires the
instrumented candidate and simultaneous connection-pool evidence.

승욱 authorized this follow-up through PR, required checks, exact-candidate
Preview, main merge, the three hosted schema migrations, and Production
verification. The timing log distinguishes a submitted set with a boolean.
Post-release observation uses aggregate timing and connection evidence for the
released route. The Production smoke uses the login route, anonymous denial,
and a transaction-scoped synthetic DB check with rollback. Any real clinical
record, external delivery, or paid telemetry change requires separate scope.
