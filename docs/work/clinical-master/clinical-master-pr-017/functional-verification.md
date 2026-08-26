# PR-017 Functional Verification Matrix

Status: `local contract and remote persistence verification pass; production app smoke pending`

This matrix separates executable local evidence from the production-bound checks
that cannot run before the explicit Supabase publish/adoption and release gates.
All scenarios use synthetic data. No real patient or prescription data was read or
written.

This file records supporting checks. The Goal's exact pass/partial/missing map is
the adjacent `completion-audit.md`; an indirect schema or report check is not
treated as a completed browser scenario.

## Local supporting scenario matrix

|   # | Scenario                                            | Local result | Evidence                                                                                                                                                        |
| --: | --------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Search at target scale                              | Pass         | The contract suite retains exactly 108 unique rows and a chart browser test loads and searches the same reviewed 108-row catalog.                               |
|   2 | Category filtering and coverage                     | Report-only  | Standalone report browser check plus dataset category coverage in the generated summary.                                                                        |
|   3 | Route filtering                                     | Report-only  | Standalone report browser check; validator requires at least one route for all 108 rows.                                                                        |
|   4 | Species filtering                                   | Report-only  | Standalone report browser check; validator requires a non-empty target species set for every row.                                                               |
|   5 | Inactive exclusion                                  | Pass         | Chart search excludes false-gate rows; release replay keeps all 108 pending rows hidden.                                                                        |
|   6 | Review reason display                               | Report-only  | Report detail exposes pending review and activation-block reasons; the chart reviewer view is not implemented.                                                  |
|   7 | Draft and cancel safety                             | Pass         | Shared-draft tests prove zero execution artifacts; revision-attempt tests preserve reasoned immutable history.                                                  |
|   8 | Required prescription fields                        | Pass         | Dispensing schema requires dose basis/value/unit, route, frequency, duration, and total quantity.                                                               |
|   9 | Unit validation and no defaults                     | Pass         | Domain validation checks typed units; dataset and pricing snapshot tests prove no clinical prescription defaults.                                               |
|  10 | Invalid patient species                             | Pass         | The DB lineage trigger compares encounter patient species with the server-owned catalog target set and rejects mismatch.                                        |
|  11 | Invalid route                                       | Pass         | Foundation rollback replay rejects `IV` for an oral-only product and accepts the reviewed `PO` to `oral` mapping.                                               |
|  12 | Stale or superseded review                          | Pass         | Server-computed predicate rejects an approval superseded by a later review.                                                                                     |
|  13 | Safety/regulatory block                             | Pass         | Predicate requires normal master safety, approved Korean regulatory review, non-controlled status, and approved evidence assertions.                            |
|  14 | Atomic confirmation                                 | Pass         | Atomic-confirmation suite verifies one server-owned command boundary and immutable snapshots.                                                                   |
|  15 | Confirmation retry                                  | Pass         | Stable idempotency key returns the persisted result; changed payload conflicts.                                                                                 |
|  16 | Task and queue handoff                              | Partial      | Execution read model preserves Order to Task to Queue trace; migrated DB/browser ID reconciliation is still pending.                                            |
|  17 | Billing separation                                  | Pass         | Confirmation and `Order 청구` remain separate; operational work status is not used as the default billing gate.                                                 |
|  18 | Billing retry                                       | Pass         | Existing candidates and candidate sync retries are idempotent.                                                                                                  |
|  19 | Dispensing completion                               | Partial      | Fulfillment transition completes the work item and aligns the universal Task; dispense-event lot/expiry/actual-quantity history is not implemented.             |
|  20 | Return/re-request                                   | Pass         | Transition tests cover return paths, preserve actor/reason/before/after history, and reject terminal-state mutation.                                             |
|  21 | Permission and workspace isolation                  | Pass         | Chart, fulfillment, and dispensing tests reject missing capability and wrong workspace scope; the dedicated history RPC repeats membership and actual-queue permission checks. |
|  22 | Audit attribution                                   | Pass         | Confirmation, fulfillment, billing, publish, and adoption replays retain actor and request identity.                                                            |
|  23 | Historical snapshot preservation                    | Pass         | Confirmation, revision, and lineage tests preserve frozen product/profile/review/evidence revisions; the live panel reads immutable fulfillment actor/reason/status events. |
|  24 | Dispensing readback without guessed execution facts | Partial      | The screen shows reviewed product facts, frozen ID/quantity information, and persisted status history only when present; required execution flags and lot/expiry event fields remain open. |
|  25 | Foreign-workspace and runtime non-exposure          | Local replay | Release rollback replay keeps `clair-foreign-demo` unchanged and creates zero runtime order/task/queue/billing rows.                                            |

## Executed local evidence

- 35 focused publisher/schema/execution/fulfillment/history Playwright contract tests
  passed in the current verification run.
- Eight dispensing browser tests and five chart scale/interaction regression
  tests passed, including the 108-row search, 20-row continuous-edit, stable
  row/input identity, interaction budget, and server/visible queue-count cases.
- Foundation rollback replay emitted
  `clinical_master_dispensing_order_foundation_replay_ok`, including the
  fulfillment-history scope check, and rolled back.
- Release rollback replay emitted
  `clinical_master_dispensing_release_replay_ok` and rolled back.
- Dataset validator passed with 140 candidates, 108 final rows, zero duplicate
  IDs/keys/products, zero clinically active rows, 1,657 normalized rows, and zero
  errors.
- The opt-in source-link validator checked all 108 distinct official source
  URLs and reported zero broken links.

These results do not cover migrated-DB browser ID reconciliation,
dispense-event lot/expiry/actual-quantity history, or production
duplicate/orphan checks.

## Remote persistence verification

The approved production-bound persistence run established:

- exact remote migration versions `20260826011738`, `20260826011742`, and
  `20260826011745`;
- private release 13 with exact 1,657 normalized rows and computed clinical-use
  count zero;
- 108 pending projections in each approved workspace, zero duplicate/orphan
  lineage, and unchanged empty foreign control;
- unchanged runtime aggregate controls 38 confirmed atomic orders, 38 Tasks,
  31 fulfillment work items, and 38 billing candidates;
- publish/adoption retry idempotency and three immutable actor-attributed
  adoption events.

Authenticated production route/UI smoke remains part of the Git/deployment
gate. Because all 108 records are intentionally unreviewed and inactive, a
successful smoke must prove non-exposure rather than make them searchable for
real clinical use.
