# PR-017 Completion Audit

Status: `persistent authoring/publish/adoption verified; Git and production app smoke pending`

This audit maps the Goal's exact Phase 8–10 requirements to direct evidence.
`Proven` means an executable local check covers the stated behavior. `Partial`
means only part of the requirement or an indirect contract check exists.
`Missing` means no adequate evidence exists yet. `Approval-bound` means the
check cannot truthfully run before the separately approved remote action.

## Phase 8: Chart and execution screens

| Requirement                                                            | Status  | Current evidence or gap                                                                                                                                               |
| ---------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dispensing search and 100+ scale                                       | Proven  | A browser test loads the reviewed 108-row dispensing catalog in the chart dialog and verifies exact search reduction without activating clinical use.                |
| Candidate add with zero downstream artifacts                           | Proven  | Shared-draft and atomic-confirmation contract tests keep Task, Queue, Billing, and dispense artifacts at zero before confirmation.                                    |
| Inline edit and required validation                                    | Proven  | The versioned dispensing detail schema and chart interaction tests cover required clinician-entered fields without defaults.                                          |
| Explicit and partial confirmation                                      | Proven  | Atomic confirmation accepts selected roots only and preserves unselected draft rows.                                                                                  |
| Immutable snapshot and stale ETag                                      | Proven  | Confirmation/revision tests cover the frozen snapshot and reject stale draft writes.                                                                                  |
| Set aggregate/child contract                                           | Proven  | Existing universal Task and atomic confirmation tests preserve aggregate versus execution children.                                                                   |
| Amendment, cancellation, priority, re-request                          | Proven  | Revision-attempt tests cover immutable actor/reason/before/after history and linked attempts.                                                                         |
| Queue projection and destination separation                            | Proven  | Approved product contract and UI tests keep `dispensing` and `treatment` as separate `queueType` projections on one shared screen.                                    |
| Patient/encounter/order/task ID reconciliation                         | Partial | The local candidate exposes patient, encounter, order, Task, and attempt IDs; production aggregates are reconciled, while an authenticated migrated-DB browser run is still required. |
| Fulfillment and universal Task status alignment                        | Partial | The queue read model exposes Task state separately and the live history panel renders persisted fulfillment transitions; every Task/queue state pairing is not browser-covered. |
| Prescription and billing quantity/unit                                 | Partial | Confirmed prescription total and server-frozen billing quantity/unit are shown only when present. An actual dispense-event quantity/unit contract is not implemented. |
| Form and route                                                         | Proven  | Reviewed immutable medication facts are displayed only when the clinical gate and named review lineage are valid.                                                     |
| Label and preparation instructions                                     | Partial | Existing immutable instruction and compound-note paths exist; a dedicated label/preparation execution UI is not implemented.                                          |
| Lot/expiry requirement                                                 | Missing | Lot, manufacturer expiry, opening time, and BUD belong to a later dispense event; no approved event/UI contract exists yet.                                           |
| High-alert/controlled/antimicrobial flags                              | Missing | The source dataset has review-routing signals, not approved clinical flags. They must not be presented as clinical facts.                                             |
| Detail/history and correction/cancel/re-request                        | Partial | The dispensing panel now reads actor/reason/previous/next status from workspace-scoped persisted events and is browser-verified; correction/cancel/re-request UI paths are not all covered. |
| Waiting-count reconciliation                                           | Proven  | A browser test sums the two server queue summaries to 5 and reconciles the visible `전체 5` / `조제 3` / `처치 2` counts across filtering and selection.               |
| 13–20 mixed continuous add/edit                                        | Proven  | A synthetic browser scenario loads 20 mixed authoritative order-row templates, edits all quantities continuously, and verifies the complete 20-row autosave payload. |
| Horizontal scroll, pinned identity, row overlay, contextual action bar | Proven  | The 20-row browser scenario verifies the horizontal scrollbar and pinned Order identity; shared chart interaction tests cover overlays and contextual actions.         |
| Keyboard, focus, touch fallback                                        | Proven  | The 20-row scenario verifies Tab keeps focus on an interactive control after a controlled edit; the shared chart action surface is separately exercised with touch.   |
| Sheet, DropdownMenu, urgent Switch                                     | Proven  | Focused chart browser tests exercise detail/history sheets, the Order action menu, structured selectors, and the urgent Switch with persisted values.                 |
| Loading, empty, error, conflict                                        | Partial | Dispensing queue and history loading/error/permission states plus chart stale conflicts exist; the combined large-data flow is not covered.                            |
| Performance and unnecessary rerenders                                  | Proven  | The 20-row browser scenario completes the full edit sequence under a 10-second interaction budget and proves the first row/input DOM identities are not remounted.    |

## Phase 9: Data quality and safety

| Requirement group                                                     | Status         | Current evidence or gap                                                                                                                                            |
| --------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Counts, uniqueness, required identity/product fields                  | Proven         | Deterministic validator: 140 candidates, 108 final, zero duplicate stable IDs/canonical keys/source products, and required names/ingredients/forms/routes present. |
| Units, null preservation, provenance, species, destination/type/enums | Proven         | Validator and DB gates reject invalid units/enums/species/routes and preserve unknown clinical defaults, BUD, and expiry as null.                                  |
| Broken source URL validation                                          | Proven         | The opt-in source-link validator checked all 108 distinct official VMD SPC URLs by HEAD/range fallback and reported zero broken links.                              |
| Unreviewed clinical activation                                        | Proven locally and remotely | Dataset count and remote computed gate are zero; all 324 workspace projections remain pending/inactive and the DB predicate/trigger reject false-gate activation. |
| Airtable/private master/workspace fingerprints                        | Proven remotely | Airtable 1,549 rows/2,400 links and Supabase release 13 plus three 108-row pending projections were read back with exact counts, zero active rows, and unchanged foreign control. |
| Chart/Task/Queue/Billing/event reconciliation                         | Partial        | Local contract and rollback tests cover cardinality/linkage; remote aggregate controls stayed 38/38/31/38 with zero PR-017 runtime artifacts, while authenticated browser ID reconciliation remains. |

## Phase 10: Required scenarios

|   # | Scenario                                               | Status         |
| --: | ------------------------------------------------------ | -------------- |
|   1 | Candidate selection leaves Task/Queue/Billing at zero  | Proven         |
|   2 | Shared draft and second-device readback                | Proven         |
|   3 | Stale ETag causes zero overwrite                       | Proven         |
|   4 | Only selected dispensing candidates confirm            | Proven         |
|   5 | Confirmed atomic dispensing order creates Task 1       | Proven         |
|   6 | Routed dispensing order creates Queue 1                | Proven         |
|   7 | Priced eligible order creates Billing candidate 1      | Proven         |
|   8 | Double-click/retry creates zero duplicates             | Proven         |
|   9 | Mid-transaction failure rolls back all artifacts       | Proven         |
|  10 | Re-request creates a linked attempt                    | Proven         |
|  11 | Cancel/amend event preserves actor/reason/before/after | Proven         |
|  12 | Cross-workspace read/write is denied                   | Proven locally |
|  13 | 100+ chart search and filtering                        | Proven         |
|  14 | Continuous editing of 20 mixed orders                  | Proven         |
|  15 | Keyboard/touch action access                           | Proven         |
|  16 | Queue waiting-count reconciliation                     | Proven         |
|  17 | Chart/Task/Queue/Billing ID reconciliation             | Partial        |
|  18 | Unreviewed activation is denied                        | Proven locally |
|  19 | Production duplicate counts are zero                   | Proven remotely |
|  20 | Production orphan counts are zero                      | Proven remotely |

Dispense-event lot/expiry/actual-quantity capture is explicitly deferred rather
than guessed. Authenticated migrated-DB browser reconciliation, Git delivery,
and production synthetic smoke remain open; the overall Goal is not complete
until those release gates finish.
