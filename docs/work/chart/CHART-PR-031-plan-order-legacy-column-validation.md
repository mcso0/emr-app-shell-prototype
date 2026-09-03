---
id: "CHART-PR-031-VALIDATION"
type: "Validation Record"
title: "Plan/Order Legacy Column Phase A Validation"
description: "Records the evidence-backed current-state gap analysis required before Plan/Order legacy-column implementation."
status: "approved"
area: "chart"
priority: "P0"
source_docs:
  - "docs/product/domain/plan-order-all-tab-legacy-column-contract.md"
  - "docs/product/roadmap/plan-order-all-tab-legacy-column-delivery-plan.md"
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/engineering/data-model/order-fulfillment-handoff-contract.md"
related_work:
  - "CHART-PR-031"
  - "CLINICAL-MASTER-PR-023"
  - "CLINICAL-FULFILLMENT-PR-010"
  - "CLINICAL-BILLING-PR-023"
  - "CHART-PR-032"
updated: "2026-09-02"
---

# Plan/Order Legacy Column Phase A Validation

## Boundary

This record closes the read-only current-state investigation required by
`CHART-PR-031`. It is evidence for implementation planning, not proof that the
target behavior is already implemented.

- Repository inspection used clean branch
  `codex/plan-order-legacy-full-delivery-20260902` at
  `3090e59a9222687a62dca2cf545d51f8ea20c02f`; current `origin/main` was
  `7b0cb0a378717ef4527602bf7980999020f8d307`.
- GitHub's latest Production deployment record pointed to `7b0cb0a3` and was
  `success` at the time of inspection.
- Authenticated browser inspection used the production alias, the Cheongdam
  synthetic workspace, and read-only navigation on 2026-09-02 KST. No chart,
  fulfillment, or billing mutation was executed.
- Remote database inspection used read-only SQL against production-bound
  Supabase project `qmerxgzrwaaahpkhjqlc`, PostgreSQL 17.6, on 2026-09-02 KST.
- Airtable inspection used read-only schema and record queries against the
  existing `CLAiR Clinical Master` base. No schema or record write was made.

No evidence in this record authorizes invented clinical, fee, tax, or
dispensing values. Missing source-approved values remain missing and must fail
closed at the applicable confirmation or billing boundary.

## Current Evidence Summary

### Repository and API

- Atomic confirmation, ETag/CAS, idempotency, immutable confirmation snapshots,
  universal task attempts, queue projection, billing candidates, revisions,
  audit, and outbox foundations are reusable.
- The current table is a dynamic union of all order-type fields. It is not the
  target fixed 25-column projection.
- The chart `상태` substitutes `청구됨` and collapses paused/partial work into a
  generic state. This conflicts with the approved operational-only status cell.
- `청구서명` is editable in the client but excluded from the strict draft PATCH
  contract, so its draft persistence is not authoritative.
- Assignment is conflated with `accepted`; current downstream clients can send
  the non-UUID placeholder `user-tech`, which the server normalizes to null.
- Pause, resume, explicit handoff, assignment history, returned task state, and
  type-specific phase persistence are missing or incomplete.
- Returned work currently projects to task `paused` and order `re_requested`,
  allowing billing after a warning instead of enforcing the target block.

### Authenticated production UI

- The `전체` table rendered 50 total columns: one selection control, 48 labeled
  headers, and one trailing action control.
- `Task`, `메모`, and `청구서` were already absent. `부위` appeared twice.
- Draft cells exposed raw codes such as `patient`, `topical`, `any_time`, and
  `room_temp`; confirmed rows could expose a raw assignee UUID.
- A draft with invalid required dispensing inputs correctly disabled
  confirmation, but the exact new calculation and actual-dispense contracts do
  not exist.
- A historical sample showed one dispensing request in the sidebar while the
  detail surface said no fulfillment work item was available. The remote DB had
  one work item for that encounter, so this is a client selection/readback
  inconsistency rather than a missing database row.
- `Order 청구` was enabled with zero selected rows while four eligible lines
  remained, matching the current encounter-scoped bulk billing API.
- Moving from chart to a downstream queue did not preserve the historical
  operating date.

### Remote database and security boundary

- Remote migration history reached `20260901135451`.
- Current counts were task `complete 16`, `in_progress 4`, `pending 28`;
  fulfillment `requested 28`, `in_progress 4`, `completed 5`; billing candidate
  `candidate_created 31`, `invoice_linked 15`.
- There were no live `accepted` or `returned` queue rows at inspection time. One
  dispensing order was `re_requested`; its billing candidate remained
  `candidate_created`.
- Four legacy rows remained `ready_for_billing` while
  `order_confirmation_status=draft`, one per routed type. They are preserved
  historical compatibility rows and must not be silently reclassified.
- `clair_get_chart_order_draft`, `clair_get_chart_order_actions`, and
  `clair_list_billing_invoice_candidates` were executable by `authenticated`
  but lacked their matching DB-level capability check.
- Legacy `clair_save_chart_order_action` remained directly executable and still
  contained `confirm`/`bill`, so a direct RPC caller could bypass the atomic
  confirmation artifact bundle.
- Existing `order_tasks` has no assignee, assignment actor/time, returned state,
  or detailed phase. `order_task_events` has no assignment, handoff, or returned
  event type.
- Current catalog rows had explicit compatibility fields:
  `tax_included=true 1591 / false 6`, `rounding_rule=as_is 1596 / round 1`.
  The application currently treats that legacy boolean as tax classification,
  despite its misleading name. No workspace VAT arithmetic policy exists.
- Supabase security advisors reported broad project-level existing notices. The
  scoped implementation must close the three identified read/legacy-action RPC
  boundaries and prove direct-RPC denial; it must not claim to clear unrelated
  advisor findings.

### Airtable clinical master

- The base contained 17 tables and 175 fields. `Master Records` had 579
  physical records, 578 valid records, and one entirely blank drift record.
- Direct Airtable order sources were 400 generic orders plus 108 dispensing
  orders. The runtime 522-order set also includes two frozen legacy rows and 12
  system-exam rows outside Airtable, so Airtable is not a 1:1 runtime source.
- All 108 dispensing orders remained `clinical_review_pending` and
  `synthetic_unreviewed`; no row was approved for clinical use.
- Route, basic product unit, route/instruction, product-level strength, and the
  generic billing-reflection default are partially available.
- Calculation mode, reference ingredient, unit conversion, increment,
  rounding/tolerance/range policy, price basis, tax classification, set billing
  ownership, eligible assignee rules, and operational/billing reason vocabularies
  are not authoritative Airtable fields.
- Seven of 132 ingredient links had no ingredient-level strength and required
  manual review. No implementation may choose the first ingredient as a dose
  basis.
- Two dispensing presets differed from naive dose-times-frequency-times-days,
  but that difference is not evidence for an approved rounding rule.

## Column Classification

| # | Column | Result | Current evidence and required closure |
|---:|---|---|---|
| 1 | `분류` | `부분 구현` | Canonical clinical type and category labels exist; fixed target projection and exact fallback need implementation. |
| 2 | `상태` | `충돌` | Current UI mixes billing and collapses work state; returned/phase/paused semantics are incomplete. |
| 3 | `Order 명` | `정상` | Applied display name is already snapshotted; only exact label/order changes. |
| 4 | `청구서명` | `충돌` | UI and confirmed correction exist, but draft persistence and billing-revision authority are incomplete. |
| 5 | `청구반영` | `부분 구현` | Master/runtime flag exists; target draft edit, audited override, and billing lock are missing. |
| 6 | `일수` | `부분 구현` | Dispensing and hospitalization fields exist; non-applicable and legacy mapping are not projected. |
| 7 | `횟수` | `부분 구현` | Frequency inputs exist with inconsistent shapes; one normalized schedule rule is needed. |
| 8 | `총횟수` | `미구현` | No dedicated derived/manual occurrence authority exists. |
| 9 | `head/kg당` | `부분 구현` | Patient/kg inputs exist; master calculation mode and exact basis mapping do not. |
| 10 | `1회당` | `부분 구현` | Dose and dose unit exist for dispensing; normalized per-administration contract is missing. |
| 11 | `성분량` | `추가 정책 필요` | Product strength is partial, but reference ingredient and compatible conversion are absent. |
| 12 | `조제량` | `추가 정책 필요` | Quantity-source enum reserves the concept, but no authoritative producer exists. |
| 13 | `실조제량` | `미구현` | No editable/persisted per-administration practical quantity or override history exists. |
| 14 | `보관` | `부분 구현` | Dispensing storage default exists and needs normalized display/snapshot mapping. |
| 15 | `투여/복약` | `부분 구현` | Route and instruction exist separately; fixed compact projection is missing. |
| 16 | `담당자` | `충돌` | Queue assignee is incomplete, raw IDs leak, and assignment/start/handoff are conflated. |
| 17 | `단가` | `부분 구현` | Price snapshot exists; canonical price basis and billing unit need explicit mapping. |
| 18 | `수량` | `충돌` | Generic quantity persists, but target price-basis derivation and billing-only override do not. |
| 19 | `합계` | `부분 구현` | Server base amount exists; row-adjustment and full set strategy integration are missing. |
| 20 | `할인할증(금액)` | `미구현` | No order-row adjustment authority or snapshot exists. |
| 21 | `(%)` | `미구현` | No authoritative amount-or-percent source and symmetric KRW rounding exists. |
| 22 | `청구금액` | `충돌` | Current cell is unadjusted line total and cannot represent target final amount. |
| 23 | `사유` | `미구현` | Existing mutation reasons are not a row billing-adjustment reason. |
| 24 | `과세` | `충돌` | Legacy `tax_included` is used as classification; explicit classification and VAT policy are separate target authorities. |
| 25 | `수의사` | `부분 구현` | Request/confirm actors exist, but chart readback still falls back to mock identity values. |

## Lifecycle Classification

| Requirement | Result | Required closure |
|---|---|---|
| Draft add/edit/reset/remove | `부분 구현` | Preserve current CAS/removal; add every new field to strict draft DTO and reset/copy rules. |
| Confirmation and snapshot | `부분 구현` | Reuse atomic transaction; separate immutable clinical snapshot from audited pre-billing overrides. |
| One-time downstream routing | `부분 구현` | Four current queues work; external lab/hospitalization clients and intended assignee handoff are incomplete. |
| Assignment/claim/start/handoff | `충돌` | Remove accepted-as-assignment and add actor/time/history plus explicit handoff. |
| Pause/resume and duration | `미구현` | Add authoritative actions/events and preserve the pre-pause phase. |
| Detailed phases | `부분 구현` | UI labels exist in places; separate validated phase persistence/readback is missing. |
| Return/correct/reconfirm/re-request | `충돌` | Preserve returned terminal attempt and block duplicate active attempts/candidates. |
| Confirmed cancellation | `부분 구현` | Unlinked cancellation exists; state/invoice matrix and role ownership need enforcement. |
| Encounter billing request | `부분 구현` | Current request is idempotent and encounter-scoped; returned gate and new billing fields are missing. |
| Set expansion/status/billing | `부분 구현` | Expansion and amount strategies exist; target status precedence and explicit owner mode need mapping. |
| Workspace/RLS/RPC boundary | `충돌` | Table isolation is mostly present, but direct RPC capability and legacy-action gaps must be closed. |

## Resolved Implementation Decisions

These are source-backed resolutions for implementation. They do not supply
clinical values that are absent from the master.

1. The current user-approved legacy-column contract supersedes older
   `accepted` and returned-billing wording for this flow.
2. Keep `Order 청구` encounter-scoped: one request links every currently
   eligible, billing-reflected, not-yet-linked order. Row selection remains an
   authoring control and does not narrow this command.
3. A work attempt never creates another billing candidate. Billing identity is
   the order lineage, not the task attempt. `returned` blocks billing;
   re-requested waiting/active work uses the existing warning.
4. Confirmation freezes clinical/master/calculation data, including unit price,
   price basis, billing unit, tax class, and set pricing/ownership. Billing name,
   reflection, billing quantity override, and row adjustment live in a separate
   versioned pre-billing override. `Order 청구` freezes the final billing
   snapshot and locks those fields.
5. Chart-order `chart:update` owns order correction, reconfirmation, re-request,
   cancellation, and pre-billing overrides. Route-specific existing completion
   permissions own assign, claim, start, phase, pause, resume, return, and
   handoff; every target assignee must be an active member with that capability.
6. Confirmed cancellation requires a reason. Before invoice linking it cancels
   waiting/active/paused/returned attempts and unlinked candidates; completed
   attempts remain immutable history. After invoice linking, chart cancellation
   is blocked and the billing correction/reversal flow owns the change.
7. Canonical price basis and set calculation are separate dimensions. Existing
   order behavior maps to per-order or per-product-unit by its persisted
   quantity source; set owner and set amount strategy are separately snapshotted.
   Ambiguous rows remain unconfigured and billing-blocked.
8. Map the current legacy catalog boolean to explicit tax classification for
   compatibility (`true -> taxable`, `false -> non_taxable`) because that is how
   the application already interprets it. VAT arithmetic becomes an explicit
   workspace policy; current synthetic workspaces may be migrated to
   `vat_included` only with evidence that their stored prices are the current
   VAT-included prices. Missing policy blocks taxable billing.
9. Order-row adjustment freezes into the invoice line. Later checkout/session
   adjustment remains a separate audited layer and applies to the remaining
   invoice balance; neither layer overwrites the other.
10. Interval/custom counts use persisted concrete occurrences and the
    encounter/workspace timezone. If no timezone or occurrence list exists,
    confirmation fails instead of guessing. A kg calculation uses the latest
    confirmed weight from the same encounter at or before order confirmation.
11. With no preparation increment, the system may copy the exact theoretical
    quantity as the proposed actual quantity, but manual divergence is disabled
    until an explicit increment is configured. Approved product-specific
    increments, limits, tolerances, reference ingredients, and conversions are
    never inferred.
12. Hospital-configured reason lists may be empty; `기타` remains the built-in
    safe option and requires detail.
13. If unfinished work is returned after candidate or invoice linkage, record
    the return immediately and place billing on review hold. Never rewrite the
    candidate, line, or payment; correction/reversal/refund history must resolve
    the hold before changed clinical reconfirmation or checkout.

## Delivery Dependency Order

1. `CLINICAL-MASTER-PR-023`: source/schema normalization and fail-closed
   configuration transport without invented clinical values.
2. `CLINICAL-FULFILLMENT-PR-010`: RPC hardening, accepted retirement,
   assignment/start/pause/resume/return/handoff, detailed phase, and attempts.
3. `CLINICAL-BILLING-PR-023`: versioned pre-billing overrides, adjustment/tax
   snapshots, returned gate, set ownership mapping, and invoice handoff.
4. `CHART-PR-032`: exact 25-column projection and current-UI-system cells after
   all authoritative data is available.

The exact-candidate production merge/deploy gate remains separate. No Phase A
read-only evidence authorizes a production database or Airtable write.
