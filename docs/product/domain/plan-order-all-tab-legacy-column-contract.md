---
id: PRODUCT-DOMAIN-PLAN-ORDER-ALL-TAB-LEGACY-COLUMN-CONTRACT
type: Domain Contract
title: Plan/Order All Tab Legacy Column Contract
description: Defines the approved target semantics and fail-closed implementation boundaries for the Plan/Order `전체` legacy column set.
status: approved
area: product
doc_type: domain
related_work:
  - CHART-PR-031
  - CLINICAL-MASTER-PR-023
  - CLINICAL-FULFILLMENT-PR-010
  - CLINICAL-BILLING-PR-023
  - CHART-PR-032
supersedes: []
superseded_by: []
tags:
  - chart
  - plan-order
  - order-table
  - dispensing
  - billing
last_updated: 2026-09-02
---

# Plan/Order `전체` Tab Legacy Column Contract

This document records the target product decisions made while comparing the
legacy CLAiR chart Order table with the currently deployed Plan/Order `전체` tab.
The current owner-approved delivery goal authorizes the named local and
synthetic/demo implementation slices. Production database mutation and
production merge/deployment remain subject to their exact-candidate gates.

## Goal

Replace only the column composition of the current Plan/Order `전체` tab with the legacy CLAiR column order and approved labels, including the explicit `직원` to `담당자` replacement, while preserving the current UI system unless a later decision explicitly changes it.

## Contract Precedence And State Objects

For the Plan/Order flow covered here, this later owner-approved contract takes
precedence over older sections that require `accepted`, allow billing of a
returned attempt after acknowledgement, or describe checkbox-selected
`Order 청구`. The unaffected parts of those source documents remain valid.

Keep these authorities separate:

| Authority | Owner | Meaning |
| --- | --- | --- |
| Order confirmation | Chart order | Draft, confirmed, billed, or cancelled authoring boundary |
| Order lineage projection | Chart order | Current summary across immutable work attempts |
| Work attempt state | Universal task | `requested`, `in_progress`, `paused`, `completed`, `returned`, or `cancelled` |
| Work detailed phase | Owning work module | Type-specific phase such as `입력중`, `판독중`, or `조제중` |
| Billing state | Billing candidate/invoice | Pre-billing candidate, invoice-linked line, correction, or cancellation |

`Order 확정` freezes the clinical/master/calculation snapshot, including unit
price, price basis, billing unit, tax class, and set billing ownership/amount
strategy. Billing name, reflection, billing quantity override, and row
adjustment belong to a separate versioned pre-billing override state. `Order
청구` freezes the final billing snapshot and invoice-line inputs. A work attempt
never owns billing identity.

## Scope Boundary

### In scope

- The Plan/Order `전체` tab table header.
- The row data contract required by the target columns.
- Column-specific calculation, editability, validation, persistence, and lifecycle rules.
- The exact target column names and order recorded below.
- The authoritative lifecycle, DB/RPC, RLS, master-data, billing, and downstream
  prerequisites required for those cells to be truthful and durable.

### Out of scope

- Visual redesign, styling, spacing, density, table chrome, or interaction redesign.
- Toolbar, category tabs, footer, dialogs, or surrounding chart layout changes.
- `Task`, `메모`, and `청구서` columns, plus the legacy `직원` label that is replaced by `담당자`.
- Invented clinical values, fee policy, tax-law determination, or assignee
  eligibility that lacks an approved source.
- Production database/Airtable mutation or production merge/deployment before
  the separately reviewed exact candidate.

## End-to-End Requirement and Pre-Implementation Validation Scope

The future visible UI change remains limited to the Plan/Order `전체` table column composition. However, implementation feasibility cannot be judged from the table header alone. Before implementation, the current repository, deployed service, remote database, and Airtable order master must be checked against the full order lifecycle that supplies, freezes, routes, changes, and bills the column values.

```text
오더 추가
→ 확정 전 입력·수정·삭제
→ Order 확정
→ 업무 화면 전달
→ 담당·시작·진행·완료
→ 반려·수정·재요청 또는 취소
→ Order 청구
```

The current owner-approved goal authorizes the local and scoped synthetic/demo
implementation prerequisites recorded in the delivery plan. Missing source
values remain fail-closed; this authorization does not permit fabricating them.

### 1. Draft order authoring before confirmation

- Verify that every target-column input applicable to the selected order type can be entered and edited before confirmation.
- Verify which values are user inputs and which are calculated, derived, or read-only.
- Verify order deletion or cancellation before confirmation, including that no downstream work or billing residue remains.
- Verify required fields, dimensional compatibility, ranges, increments, manual-override reasons, and other confirmation-blocking validation.
- Verify that a set order and its children preserve the intended values when added, edited, removed, or reapplied.

### 2. Confirmation and downstream routing

- Verify that `Order 확정` freezes the required clinical, dispensing, assignee, and billing snapshots.
- Verify that each work-producing order is routed once to the correct downstream screen for its order type.
- Verify that orders without downstream work do not create artificial work items.
- Verify that intended assignee, instructions, request actor, request time, and required order context reach the generated work item.
- Verify that retrying confirmation cannot create duplicate work requests.

### 3. Work progress and chart synchronization

- Verify assignment, self-claim, start, pause, resume, detailed progress, completion, and explicit handoff behavior in each owning work screen.
- Verify that the chart `상태` and `담당자` cells reflect the current authoritative work item without becoming direct state controls.
- Verify the agreed common-state mapping, work-type detailed phases, parent-set aggregation, and request-cycle display.
- Verify that work events preserve actor, assignee, timestamp, before/after state, and attempt history.

### 4. Return, correction, and re-request

- Verify that a downstream worker can return an invalid or unexecutable request with a required reason.
- Verify that the chart supports correction and reconfirmation without rewriting the returned attempt.
- Verify that a veterinarian can re-request completed work after reviewing an abnormal or questionable result.
- Verify that a new request cycle preserves the prior completed or returned attempt and its result while preventing duplicate active attempts.
- Verify that changes to clinical parameters follow correction and reconfirmation, while a same-condition re-request can reuse the preserved confirmed order snapshot.

### 5. Cancellation

- Verify the distinction between removing or cancelling an unconfirmed draft and cancelling a confirmed order.
- Verify how confirmed cancellation propagates to waiting, active, paused, completed, returned, or re-requested work.
- Verify required cancellation reason, authority, event history, and the chart and downstream-screen result.
- Verify billing behavior before and after `Order 청구`, including when billing cancellation or correction is required instead of clinical cancellation.
- Verify that cancelled orders do not recur through retry, set reapplication, work synchronization, or billing-candidate regeneration.

### 6. Billing confirmed orders

- Verify that an unconfirmed order cannot be billed.
- Verify billing eligibility and warning or blocking behavior for each agreed work state.
- Verify `청구서명`, `청구반영`, `단가`, `수량`, `합계`, adjustments, `사유`, `청구금액`, and `과세` from the applied order through the billing snapshot and invoice line.
- Verify parent-versus-child billing ownership for set orders and prevent double billing.
- Verify that return and re-request cycles cannot create duplicate billing candidates for the same billable order intent.
- Verify that repeated billing requests are idempotent and that post-billing changes use cancellation or correction history rather than silently mutating the billed snapshot.

### Validation result classification

Record one evidence-backed result for every validation item and relevant order type.

| Result | Meaning |
| --- | --- |
| `정상` | The current implementation and data contract satisfy the requirement end to end. |
| `부분 구현` | Some required behavior exists, but one or more paths, order types, persistence fields, or safeguards are missing. |
| `미구현` | No usable implementation was found for the required behavior. |
| `충돌` | The current implementation or source data contradicts this approved contract. |
| `추가 정책 필요` | Implementation cannot be judged safely until an unresolved business, clinical, billing, or permission decision is made. |

## Compared Baselines

### Legacy CLAiR reference

The owner-provided legacy chart Order table is the target reference for column
naming and order. The exact 25-name sequence is versioned below; implementation
does not depend on an untracked image after this contract is approved.

### Current deployed service

The authenticated production treatment screen was inspected on 2026-09-02 KST
with the `전체` tab selected. GitHub's current Production deployment record
pointed to source `7b0cb0a3` and reported success.

- The current table is a dynamic union field matrix across multiple order types.
- It exposes 50 total columns: one selection control, 48 labeled columns, and
  one trailing action control.
- Restoring the legacy fixed header is structurally possible.
- Full functional parity requires explicit field mapping and lifecycle rules; changing header labels alone is insufficient.
- Detailed repository, remote database, Airtable, and authenticated browser
  evidence is recorded in
  `docs/work/chart/CHART-PR-031-plan-order-legacy-column-validation.md`.

## Target Column Order

The selection checkbox remains as the first unlabeled control column. The following 25 named columns must keep this exact order and spelling.

| Position | Display label | Decision status |
| ---: | --- | --- |
| control | selection checkbox | Retain; unlabeled |
| 1 | `분류` | Source and fallback mapped |
| 2 | `상태` | Downstream work-progress and order/billing lifecycle agreed; detailed persistence gap remains |
| 3 | `Order 명` | Retain |
| 4 | `청구서명` | Definition and billing-lock lifecycle agreed |
| 5 | `청구반영` | Billing-inclusion contract agreed |
| 6 | `일수` | Conditional source mapped |
| 7 | `횟수` | Frequency-rule contract agreed |
| 8 | `총횟수` | Derived/manual scheduling contract agreed |
| 9 | `head/kg당` | Dose-basis semantics and source mapping agreed |
| 10 | `1회당` | Per-administration dose input contract agreed |
| 11 | `성분량` | Product-strength contract agreed |
| 12 | `조제량` | Definition and calculation contract agreed |
| 13 | `실조제량` | Definition and edit lifecycle agreed |
| 14 | `보관` | Conditional dispensing source mapped |
| 15 | `투여/복약` | Combined route/instruction contract agreed |
| 16 | `담당자` | Current downstream-work assignee contract agreed |
| 17 | `단가` | Order-master price-basis ownership and compatibility mapping agreed |
| 18 | `수량` | Billing-quantity contract agreed; separate from `실조제량` |
| 19 | `합계` | Pre-adjustment amount contract agreed |
| 20 | `할인할증(금액)` | Row-level adjustment and whole-KRW rounding contract agreed |
| 21 | `(%)` | Row-level adjustment and whole-KRW rounding contract agreed |
| 22 | `청구금액` | Final billing-amount contract agreed |
| 23 | `사유` | Billing-adjustment reason contract agreed |
| 24 | `과세` | Order-master tax-classification contract agreed |
| 25 | `수의사` | Requesting/confirming veterinarian source mapped |

### Explicitly removed from the legacy reference

- `Task`
- `직원` as the legacy ambiguous label; its position is reused by the approved `담당자` column
- `메모`
- `청구서`

These removed labels are not part of the target header. Their removal or replacement must not silently delete any underlying task, actor, audit, note, or billing-link data that remains necessary elsewhere in the service.

## Confirmed Contract: `상태`

### Meaning and source

`상태` displays the current progress of the downstream work item generated from an order. It does not display order confirmation state, billing candidate state, invoice state, or payment state.

- Task state belongs to the generated work item, not to the catalog row or every applied order row.
- A row that does not create downstream work has no work state and leaves the `상태` cell blank.
- Before a downstream work item exists, do not substitute `미확정` or `확정` into this column.
- `Task` remains excluded as a separate column. Its underlying work-item identity and routing data are preserved outside the visible header.
- Billing state remains independent. `Order 청구` must not change the displayed operational work state.
- Keep the `상태` cell display-only in the chart table. Work-state actions occur in the owning downstream work screen.

### Order confirmation and billing lifecycle

The order, downstream work, and billing lifecycle must follow this sequence:

```text
오더 추가(확정 전) -> Order 확정 -> 필요 시 업무 요청 생성 -> Order 청구
```

- An added but unconfirmed order is a draft. It has no downstream work state.
- `Order 확정` freezes the applicable clinical order snapshot and creates a downstream work request when that order type requires operational work.
- `Order 청구` is not allowed before `Order 확정`.
- A confirmed order that does not create downstream work can be billed immediately when its billing data is valid.
- A downstream work item starts recording operational state only after confirmation creates the request.
- Operational work completion is not a universal prerequisite for billing; the billing gate depends on the current work state as defined below.
- `Order 청구` is encounter-scoped. One idempotent request links every currently
  eligible, billing-reflected, not-yet-linked order in the encounter. Table-row
  selection remains an authoring control and does not narrow billing scope.

| Work state | Billing behavior |
| --- | --- |
| `대기` or `재요청` | Allow after an explicit warning |
| Active or partial progress such as `입력중`, `부분완`, `촬영준비`, `판독중`, `조제중`, `처치중`, or `수술중` | Allow after an explicit warning |
| `일시중지` | Allow after an explicit warning |
| `완료` | Allow without a work-state warning |
| `반려` | Block until the order is corrected and reconfirmed |
| `취소` | Block |
| No downstream work item | Allow immediately after order confirmation when billing data is valid |

Billing does not complete, cancel, return, or otherwise mutate the operational work state.

### Previously defined detailed display states

The earlier chart-order contract defined type-specific work-state labels:

| Task code | Work type | Detailed display states |
| --- | --- | --- |
| `NT01` / `NT02` | 임상병리 / 계통검사 | `대기`, `입력중`, `부분완`, `완료`, `취소`, `재요청`, `일시중지` |
| `NT04` | 영상검사 | `대기`, `촬영준비`, `촬영종료`, `판독중`, `판독완`, `취소`, `재요청`, `일시중지` |
| `NT05` / `NT06` | 경구제 / 경구제-기타 | `대기`, `조제중`, `완료`, `취소`, `재요청`, `일시중지` |
| `NT07` / `NT08` | 주사제 / 주사제-기타 | `대기`, `처치중`, `완료`, `취소`, `재요청`, `일시중지` |
| `NT09` | 차팅 / 수술 | `대기`, `수술중`, `수술완`, `완료`, `취소`, `재요청`, `일시중지` |

These labels are the target reference for the `상태` column because they communicate work-specific progress more precisely than one generic `진행중` label.

### Current implemented common state model

The current fulfillment work-item contract persists six generic operational states:

| Current state | Meaning |
| --- | --- |
| `requested` | Work was created from a confirmed order |
| `accepted` | A team or assignee acknowledged the work |
| `in_progress` | Work started |
| `completed` | Operational work completed |
| `cancelled` | Work will not proceed |
| `returned` | Work was returned to the chart for correction |

The current normal transition path is:

```text
requested -> accepted -> in_progress -> completed
    |           |             |
    +---------->+-------------+-> cancelled
    +---------->+-------------+-> returned -> requested or cancelled
```

This six-state model describes the current implementation baseline, not the approved target lifecycle. The target contract removes `accepted` as a distinct work state.

### Confirmed target common state model

The target common work states are:

| Target state | Meaning |
| --- | --- |
| `requested` | The confirmed order created a work request that has not started |
| `in_progress` | Operational work has started and is actively progressing |
| `paused` | Started work is temporarily stopped and can be resumed |
| `completed` | The downstream deliverable is finalized and available to the requester |
| `returned` | The current request attempt was returned to the chart for review or correction |
| `cancelled` | The request attempt will not proceed |

Type-specific detailed phases are stored separately from the common state. Examples include `입력중`, `부분완`, `촬영준비`, `촬영종료`, `판독중`, `조제중`, `처치중`, `수술중`, and `수술완`.

### Confirmed target start transition

There is no separate operational acceptance step in the approved workflow.

- After order confirmation, a required work item enters `requested` and displays as `대기`.
- A role-appropriate user opens the owning dispensing, clinical, imaging, treatment, or other work screen and selects `시작하기`.
- `시작하기` atomically changes the common state from `requested` to `in_progress` and records the work-start event.
- The target model does not represent “assigned but not yet started” as a separate common state.
- Do not preserve `accepted` merely to store actor or timing metadata.

### Assignment is separate from work state

Assigning a responsible user does not itself change the work state.

```text
requested + 담당자 미지정
  -> requested + 담당자 지정
  -> 시작하기
  -> in_progress + 시작 사용자/시각 기록
```

- For example, assigning `이명희` to a dispensing request keeps the work item in `requested` and displays it as `대기` until work actually starts.
- Store the responsible user as assignment metadata rather than representing assignment with `accepted`.
- Preserve at least `assignedToUserId`, `assignedByUserId`, and `assignedAt`, together with assignment-change history.
- The assigned user selecting `시작하기` transitions the item to `in_progress` and records the start event separately from the assignment event.
- While the item is still `requested`, another user who is eligible for that work type can select `담당하기` in the owning work screen and take responsibility without changing the work state.
- If an eligible user starts an unassigned waiting item, assign that user and start the work in one authoritative operation.
- Once another user has already started the item, require an explicit handoff rather than allowing a second user to silently take it over.
- The model can therefore distinguish unassigned waiting work, assigned-but-not-started work, and work that is actually in progress without adding another common state.
- Introduce an acceptance state only if a future approved workflow adds an explicit `업무 수락` action between assignment and start. Assignment by itself is not acceptance.

The start event must preserve at least:

- `startedByUserId`: the user who started the work;
- `startedAt`: the authoritative start timestamp;
- `requestedAt`: the authoritative request timestamp created from order confirmation.

The request-to-start waiting duration is derived as:

```text
업무 시작 대기시간 = startedAt - requestedAt
```

When assignment timing is available, the service can additionally derive:

```text
담당자 지정 대기시간 = assignedAt - requestedAt
지정 후 시작 대기시간 = startedAt - assignedAt
```

Type-specific detailed progress begins from `in_progress`. For example, the visible label may be `조제중`, `처치중`, `촬영준비`, or another authoritative phase owned by that work type.

### Pause and resume

`일시중지` is the display of the independent common state `paused`, not merely another `in_progress` label.

```text
in_progress + current phase -> paused -> in_progress + resumed phase
```

- Preserve who paused and resumed the work and when each event occurred.
- Preserve the detailed phase that was active immediately before the pause.
- On resume, return to that preserved phase unless an authorized workflow explicitly selects another valid phase.
- Keep paused duration distinguishable from active processing duration.
- Billing a paused work item requires the same explicit warning as billing other unfinished work.

### Return and re-request attempts

`반려` and `재요청` both participate in a multi-attempt work history, but their initiator and timing differ.

- `반려` means the downstream operator returned the current request attempt because the work could not proceed or the order requires review or correction. The current attempt becomes `returned`.
- If the returned order is corrected and reconfirmed, create a new request attempt. Do not overwrite the returned attempt or its reason.
- `재요청` can also be initiated by the requesting veterinarian after a completed result is reviewed and found questionable or unreliable.
- A same-condition repeat request does not require changing the completed order snapshot; it creates a new work attempt linked to the same order lineage.
- If the requested item, parameters, or instruction changes, correct the order and reconfirm it before creating the next work attempt.
- Preserve the completed or returned prior attempt, result, actor, timestamps, and reason.
- Increase `requestCycle` for each new attempt. A waiting first attempt displays `대기`; a waiting attempt with `requestCycle > 1` displays `재요청` while its common state remains `requested`.
- Distinguish at least an operator-returned retry from a veterinarian result-review repeat in the re-request reason or source metadata.

### Billing identity across attempts

- Billing identity belongs to the confirmed order lineage, not a work attempt.
- A returned or completed attempt and its re-request never create another
  billing candidate for the same order lineage.
- `returned` blocks the existing candidate until correction and reconfirmation.
- A same-condition veterinarian re-request preserves the existing billing
  candidate; when its new attempt is waiting or active, billing uses the normal
  unfinished-work warning.
- A changed item, parameter, instruction, billing owner, or clinical quantity
  requires an explicit order revision and reconfirmation. The server reconciles
  that revision to one current candidate without erasing prior snapshots.

### Confirmed cancellation

| Current boundary | Chart cancellation behavior |
| --- | --- |
| Draft/unconfirmed | Remove through the existing draft-removal CAS path; create no downstream or billing residue. |
| Confirmed + requested | Require `chart:update` and a reason; cancel the active attempt and unlinked candidate. |
| Confirmed + in progress/paused | Require `chart:update` and a reason; cancel the active attempt and preserve all work events/results already recorded. |
| Confirmed + returned | Require `chart:update` and a reason; cancel the returned lineage instead of creating another attempt. |
| Confirmed + completed | Preserve the completed attempt/result; cancel only when no invoice line is linked and retain immutable history. |
| Invoice linked or paid | Block chart cancellation. Use the billing correction/reversal flow with its own authority and audit history. |

Downstream workers return invalid work; they do not own clinical order
cancellation. Repeating the same cancellation command is idempotent and cannot
regenerate tasks, queue rows, or billing candidates.

### Type-specific completion boundaries

#### Laboratory and system tests

- `입력중`: result entry has started, but no requested result subset has been finalized.
- `부분완`: at least one requested result subset is finalized while another required result remains pending.
- `완료`: every required requested result is finalized and available to the veterinarian.
- The veterinarian opening or acknowledging the results is not a condition for work completion.
- A repeat requested after result review follows the new-attempt `재요청` contract above.

#### Imaging

For imaging that requires interpretation, use:

```text
대기 -> 촬영준비 -> 촬영종료 -> 판독중 -> 판독완
```

- `촬영종료` means image acquisition and registration are complete but interpretation remains.
- `판독완` means the interpretation result is finalized and available to the veterinarian; it maps to common state `completed`.
- Do not add another generic `완료` step after `판독완`.
- For imaging that does not require interpretation, `촬영종료` maps directly to common state `completed`.
- The veterinarian opening or acknowledging the image or report is not a condition for work completion.

#### Surgery

Use:

```text
대기 -> 수술중 -> 수술완 -> 완료
```

- `수술중` means the surgical procedure is actively underway.
- `수술완` means the procedure has ended but required surgical records or recovery handoff remain; the common state is still `in_progress`.
- `완료` means the required surgical records and recovery or inpatient handoff are complete; it maps to common state `completed`.

### Existing `accepted` compatibility

The target model removes `accepted`, but existing history must not be discarded.

- If an existing `accepted` item has authoritative evidence that work started, migrate or project it as `in_progress`.
- If it has no start evidence, migrate or project it as `requested` while preserving the current assignee.
- Preserve the original acceptance event as legacy history rather than pretending it never occurred.
- The exact migration mechanism and start-evidence predicate require implementation-time verification against persisted data.

### Parent-set status

- A parent set row does not own an independent work state when work is generated by its child orders.
- Derive the parent set's visible status from the authoritative child work states.
- Do not let the derived parent value overwrite or hide the individual child histories.

Use the following display precedence for mixed child states:

1. If any child is `returned`, display `반려`.
2. Otherwise, if any child is actively `in_progress`, display `진행중`.
3. Otherwise, if any child is `paused`, display `일시중지`.
4. Otherwise, if any child is `completed` while any other child is nonterminal, display `부분완`.
5. If every child is `cancelled`, display `취소`.
6. If at least one non-cancelled child exists and every non-cancelled child is
   `requested`, display `대기`; display `재요청` when a re-request cycle is
   present.
7. If every child is `completed`, display `완료`.
8. If only `completed` and `cancelled` children remain, display `부분완`.

This is a display-only aggregation rule. Each child keeps its own authoritative state and history.

### Implementation requirement

After removing `accepted` and adding `paused`, the target common model can support `대기`, `진행중`, `일시중지`, `완료`, `취소`, and `반려`-level presentation. It still cannot by itself persist all type-specific detailed progress states.

The following require an additional type-specific substate or an equivalent existing domain source:

- `입력중` and `부분완`;
- `촬영준비`, `촬영종료`, `판독중`, and `판독완`;
- `조제중` and `처치중` as distinct operational labels rather than a generic `진행중`;
- `수술중` and `수술완`.

Do not infer these detailed states only from elapsed time, screen location, or order type. The `상태` column must read an authoritative work-state value.

### Status implementation mapping

1. Persist common state, validated detailed phase, request cycle, assignment,
   and events as separate fields/records; expose them through minimal read DTOs.
2. Historical `accepted` with an authoritative `started_at` or `started` task
   event maps to `in_progress`; without either it maps to `requested`. Preserve a
   legacy migration event in both cases. Never use names or UI labels as evidence.
3. Use type-owned allowlists for detailed phases. A routed type without an
   approved phase uses its common-state label and cannot accept arbitrary text.
4. Route-specific existing completion capability owns assign, claim, start,
   phase, pause, resume, return, and handoff. `chart:update` owns correction,
   reconfirmation, re-request, and clinical cancellation.

## Confirmed Contract: `담당자`

`담당자` displays the user currently responsible for performing the downstream work. It is distinct from the `수의사` column, which identifies the ordering or owning veterinarian.

### Placement and presentation

- Replace the legacy ambiguous `직원` label with `담당자` in the same column position: `투여/복약 -> 담당자 -> 단가`.
- Default applicable rows to `미지정`.
- Display an assigned user's avatar in the compact table cell.
- Selecting the cell opens a dropdown of active users eligible for that work type, displaying each candidate's avatar and name.
- Leave the cell blank or disabled for orders that do not generate downstream work.

### Source and synchronization

- Before `Order 확정`, display and store the optionally selected intended assignee on the applied order draft.
- Do not require an assignee in order to confirm the order.
- At confirmation, initialize the generated work request with the intended assignee when one was selected.
- After the work request exists, its current assignee is authoritative for the chart's `담당자` column.
- While a confirmed work request is still `requested`, selecting a user from the chart column updates that work request's current assignee.
- While a work request is `in_progress`, the ordinary chart dropdown cannot silently replace its assignee; use the explicit handoff flow.
- If another eligible user selects `담당하기` in the downstream work screen, update the current assignee while leaving a waiting item in `requested`.
- Reflect that current assignee back in the chart. The column must show the person who currently owns the work, not the person originally selected in the draft.
- `시작하기` changes the work state to `in_progress`; it is separate from `담당하기`.
- Starting an unassigned item can assign the starting user and transition the work atomically.
- An eligible assignee is an active workspace member who currently holds the
  route-specific completion capability for the owning work module. Job-title
  text, a historical membership, or possession of `chart:update` alone is not
  sufficient evidence of eligibility.
- The chart read DTO exposes only the assignee identifier needed for commands
  and the compact avatar/name projection needed for display. Never render a raw
  UUID as a user-facing fallback; unresolved historical identities display
  `미기록`.

### Reassignment and history

- Before work starts, an eligible user can take a waiting item from another intended assignee through `담당하기`.
- Once work is `in_progress`, changing the assignee requires an explicit handoff flow rather than an ordinary dropdown replacement.
- Preserve at least `assignedToUserId`, `assignedByUserId`, `assignedAt`, the previous assignee, and assignment-change history.
- Preserve `startedByUserId` and `startedAt` separately because assignment and work start are different events.
- Do not use `accepted` to represent either assignment or work start.

## Confirmed Contract: `성분량`

`성분량` is the amount or concentration of the reference ingredient contained in one configured order unit of the product.

- Display both the numeric value and ratio unit, such as `5 mg/mL`, `20 mg/T`, `50 mg/cap`, `100 mg/g`, or `1,000 IU/vial`.
- It is a product attribute, not the patient-specific prescribed dose.
- Source it from the order master and preserve the applied value in the order snapshot.
- Keep it read-only in the chart table.
- For a combination product, display the reference ingredient used by the `조제량` calculation; expose remaining ingredients as detail rather than competing values in the cell.
- In fixed-product calculation mode, show ingredient information only when available as useful reference; otherwise leave the cell blank.
- If ingredient-based calculation applies but the required strength, concentration, or compatible unit is missing, show `계산 불가` and block confirmation under the `조제량` contract.

## Confirmed Contract: `횟수` and `총횟수`

### `횟수`

`횟수` stores and displays the administration frequency rule, not a completed-task count.

- Examples include `sid`, `bid`, `tid`, `qid`, `q6h`, and `eod`.
- The frequency rule is independent from the total number of administrations across the course.

### `총횟수`

`총횟수` is the total number of scheduled or authorized administrations for the complete order course.

- For a regular daily schedule, derive it from `일수 × 일일 횟수`.
- For interval schedules, derive it from the concrete occurrences generated from the start time and interval.
- For a custom schedule, use the count of generated schedule occurrences.
- For PRN orders, do not estimate. Require an explicitly entered maximum authorized count before confirmation.
- Keep automatically derived values read-only and recalculate them when the underlying schedule changes.
- Allow direct entry only when the schedule cannot determine a count, such as the PRN maximum.
- Require a valid `총횟수` before confirmation when the order depends on it.
- Generate interval and custom occurrences in the encounter workspace's
  persisted timezone and freeze the occurrence list plus timezone at
  confirmation. A missing timezone or an interval/custom rule that cannot
  produce a concrete occurrence list blocks confirmation; the client must not
  estimate the count.

The full-course operational product requirement remains:

```text
총 필요 조제량 = 실조제량 × 총횟수
```

## Confirmed Contract: `투여/복약`

`투여/복약` is one compact cell that combines the clinically relevant administration route with a short timing or method instruction.

- Examples: `PO · 식후`, `IV`, `IM`, `SC`, `외용 · 환부 도포`, or `점안`.
- Do not repeat frequency values such as `bid`; those belong to `횟수`.
- Start from the order master's default route and instruction.
- Allow a user with chart-order edit permission to change the applied value before confirmation.
- Freeze the applied route and instruction at `Order 확정`; later correction follows the order return and reconfirmation flow.
- Keep long instructions outside the compact cell and expose them through row detail.
- Leave the cell blank for non-applicable orders.

## Confirmed Billing Column Contract

### `청구서명`

`청구서명` is the patient-order-specific display name used on the billing line, separate from `Order 명`.

- Default to the order master's billing name; if absent, use `Order 명` as the initial value.
- Editing changes only the applied patient order and does not rename the order master.
- A billing-reflected row requires a non-empty value before `Order 청구`.
- A user with chart-order edit permission can edit it until `Order 청구`, even when clinical `Order 확정` happened earlier.
- Freeze the value in the billing candidate and invoice-line snapshot at `Order 청구`.
- Later changes use the billing correction flow and preserve history rather than silently replacing the billed label.
- A non-billing row can be clinically confirmed without a billing name.

### `청구반영`

`청구반영` is the applied-row decision to include the order in billing calculations and candidate creation. It is not a billing status.

- Default to the order master's billing-reflection setting.
- Allow a user with chart-order edit permission to toggle it before `Order 청구` when the order is billable.
- When disabled, exclude the row from the billed total and do not create a billing candidate; clinical confirmation and downstream work can still proceed.
- When enabled, require valid `청구서명`, `단가`, `수량`, and `과세` data before `Order 청구`.
- Keep permanently non-billable orders disabled.
- Lock the applied value at `Order 청구`; later exclusion requires a billing cancellation or correction flow with history.
- Each set-order master must explicitly choose parent billing or child billing so both are never charged simultaneously.

### `수량`

`수량` is the billing quantity multiplied by price. It is separate from clinical dose and `실조제량`.

| Price basis | Default billing quantity |
| --- | --- |
| Per order | `1 건` |
| Per day | `일수` |
| Per administration | `총횟수` |
| Per product unit such as mL, tablet, or capsule | `실조제량 × 총횟수` |
| Per kg | Calculation weight snapshot |
| Fixed-price set | `1 세트` |

- Use the order's billing unit, which can differ from its dispensing unit.
- Configure one explicit price basis on each billable order master; do not infer it from the visible category label alone.
- Derive the default from the price basis.
- Allow an authorized user to adjust the billing quantity before `Order 청구` without changing the clinical prescription quantity.
- A manual difference records billing-adjustment history and reason.
- Exclude the value from billing calculations when `청구반영` is disabled.
- Freeze the price basis, unit price, and billing unit at `Order 확정`; freeze
  the latest authorized billing-quantity override at `Order 청구`.
- If a billing-reflected order has no valid price basis, block `Order 청구` until the owning order configuration is corrected.

### `단가`

`단가` is the source-approved unit price copied from the applied order master
into the confirmation snapshot under the snapshotted price basis and billing
unit.

- A draft may refresh to a newer master revision only through its normal CAS
  update before confirmation.
- After confirmation, a master price change does not silently refresh the row
  or its candidate. Changing price, price basis, billing unit, tax class, or set
  pricing requires an explicit chart correction, new order revision, and
  reconfirmation by a user with `chart:update`.
- Preserve actor, timestamp, previous snapshot identity, new snapshot identity,
  and reason in revision history. A stale draft or stale revision is rejected.
- `Order 청구` copies the already confirmed value into the immutable billing
  snapshot; it is not a second price-selection moment.

### `합계` and `청구금액`

```text
합계 = 단가 × 수량, or the applicable set-pricing result
청구금액 = 합계 + 할인할증 조정금액
```

- `합계` is the pre-adjustment base amount.
- `청구금액` is the final row amount sent to billing.
- Both are system-calculated and not directly editable.
- Keep `합계` as a price reference when `청구반영` is disabled, but set `청구금액` to zero and exclude it from the billed total.
- Block an adjustment that would make `청구금액` negative.
- Freeze the calculation inputs and results at `Order 청구`.

### `할인할증(금액)`, `(%)`, and `사유`

- A negative adjustment is a discount, a positive adjustment is a surcharge, and zero means no adjustment.
- Let the user enter either an amount or a percentage as the authoritative adjustment source, not both independently.
- Show the other column as an automatically derived equivalent.
- When percentage is authoritative, recalculate the amount if `합계` changes.
- When amount is authoritative, preserve the amount if `합계` changes and recalculate the displayed percentage.
- Round a percentage-derived adjustment amount to the nearest whole KRW, resolving half-KRW ties away from zero so discounts and surcharges are symmetric; do not persist fractional KRW.
- Require `사유` whenever the adjustment is non-zero; use a selectable reason with free text when needed.
- Source the selectable standard reason list from hospital billing configuration rather than hard-coding one universal vocabulary.
- Always provide `기타`; selecting it requires free-text detail.
- `사유` is the billing-adjustment reason and must not be reused for a `실조제량` override reason.
- Lock the adjustment source, values, and reason at `Order 청구`; later changes follow the billing correction flow and preserve history.

### `과세`

`과세` is the tax-classification value configured for the order master, not a patient-specific clinical input and not the calculated tax amount.

- Display the approved configured classification such as `과세` or `면세`.
- Keep it read-only in the chart table.
- Do not infer a missing classification from order type or clinical meaning.
- Show `미설정` when missing and block `Order 청구` for a billing-reflected row until corrected in the owning configuration.
- Freeze the tax classification at `Order 확정`, then copy it unchanged into
  the billing snapshot at `Order 청구`.
- A later master change does not change a confirmed order, billing candidate,
  or existing billing line. A pre-invoice correction requires a new order
  revision and reconfirmation; after invoice linkage, use billing correction or
  reversal.
- VAT-included or VAT-added arithmetic belongs to an explicit hospital billing policy, not to this classification cell.
- Do not infer a missing VAT arithmetic policy. A billing-reflected taxable row remains blocked until the owning hospital configuration defines whether VAT is included or added.

### Set parent/child billing ownership

Each set-order master selects exactly one billing owner mode:

| Mode | Parent behavior | Child behavior |
| --- | --- | --- |
| Parent billing | The parent set owns the billable price and quantity | Child rows are not billing-reflected |
| Child billing | The parent is not billing-reflected | Each billable child uses its own price basis and quantity |

- Do not allow both modes at the same time.
- Block `Order 청구` when a billable set has no valid ownership mode or contradictory parent and child reflection settings.
- Preserve the selected ownership mode in the applied order and billing snapshot.
- Migrating an existing set whose price meaning is ambiguous requires current catalog or hospital-policy review rather than inference.

### Removed `청구서` column

`청구서` is no longer part of the target table header. Invoice-line identity, billing candidate linkage, cancellation state, and navigation remain underlying billing data or billing-workspace behavior and must not be deleted merely because the column is hidden.

### Billing implementation mapping

The canonical price-basis keys are:

| Canonical key | Meaning | Existing-source compatibility |
| --- | --- | --- |
| `per_order` | One price per confirmed order | Existing unit price with order count as quantity |
| `per_day` | One price per treatment day | Existing per-day source when explicitly configured |
| `per_administration` | One price per scheduled administration | Existing `per_frequency` source |
| `per_product_unit` | One price per billable mL, tablet, capsule, vial, or other explicit product unit | Existing `per_each` or `per_ml` source only when its billing unit is preserved |
| `per_kg` | One price per confirmed kg snapshot | Existing per-kg source |
| `fixed_set` | One fixed price for the set parent | Existing `set_fixed_price` source |

`included_order_sum` and `range_price` are set amount strategies, not price
bases. Preserve them in a separate `setAmountStrategy` snapshot and require an
exclusive parent/child billing owner. An existing source that cannot be mapped
without guessing remains unmapped and blocks billing.

The current legacy `tax_included` boolean is interpreted only as its deployed
tax-classification behavior: `true` maps to `taxable` and `false` maps to
`non_taxable`. It is not evidence that VAT is already included in the price.
Persist tax class and the workspace VAT arithmetic policy separately. A taxable
row requires an explicit workspace policy of `vat_included` or `vat_added`;
missing policy blocks billing. This contract does not choose a tax-law result.

Billing-adjustment reason options come from workspace billing configuration.
An empty configured list is valid; the UI still provides built-in `기타`, which
requires detail. Order-row adjustments are stored on the versioned pre-billing
override and frozen in the billing snapshot. Checkout- or invoice-level
adjustments are separate records and never rewrite an order-row adjustment.

`chart:update` owns applied billing-name, reflection, quantity, and row-
adjustment edits before billing. Billing candidate creation additionally
requires the existing billing-create capability. The server enforces both
workspace membership and capability; UI gating is not an authorization check.

### Snapshot layers and edit lock

1. The mutable draft stores current authoring inputs and optional intended
   assignee.
2. `Order 확정` creates an immutable clinical/master/calculation snapshot and a
   numbered order revision. Unit price, price basis, billing unit, tax class,
   and set billing owner/amount strategy are part of this layer.
3. Billing-only fields remain in a versioned pre-billing override linked to that
   revision; each change records actor, timestamp, previous value, new value,
   and reason where required.
4. `Order 청구` validates the latest confirmed revision plus latest pre-billing
   override and freezes one immutable billing snapshot.
5. After invoice linkage, neither snapshot is overwritten. Clinical correction
   creates a new revision; billing correction/reversal creates separate billing
   history.

### Already-billed unfinished work that is later returned

Operational safety takes precedence over billing convenience. A route-eligible
worker may return requested, active, or paused work with a reason even when its
candidate or invoice line already exists; the return never edits billing data
silently.

| Billing boundary at return | Required behavior |
| --- | --- |
| Candidate exists but is not invoice-linked | Mark the candidate `billing_review_required` and block linking/payment until correction and reconfirmation or explicit clinical cancellation reconciles the lineage. |
| Invoice-linked and unpaid | Preserve the line, place the invoice/line on billing-review hold, and block checkout. Billing staff must reverse/correct the line before a changed clinical revision can be reconfirmed or paid. |
| Paid or partially paid | Preserve payment and line history, create a billing-review hold, and require the authorized reversal/refund/correction flow before a changed clinical revision can be billed. |

The return itself remains recorded immediately and does not wait for billing
staff. A same-condition re-request after review may reuse the confirmed order
revision only after the billing hold is explicitly resolved. A changed item,
instruction, clinical quantity, price, price basis, tax class, or set ownership
requires a new order revision; reconfirmation is blocked while an affected
invoice line lacks the required correction/reversal record.

## Confirmed Contract: `조제량`

### Definition

`조제량` is the theoretical amount of the ordered product required for one administration after converting the prescribed active dose into the order's product unit and before practical rounding, splitting, or measurement.

It is:

- a per-administration value;
- calculated by the system and read-only in the chart table;
- the unrounded source used to propose `실조제량`.

It is not:

- the total product amount for the full treatment course;
- a manually entered correction value;
- the confirmed practical `실조제량`;
- the billing `수량`.

### Dose basis and ingredient calculation

`head/kg당` selects how the `1회당` prescribed ingredient dose is interpreted.

```text
head basis:
1회 필요 성분량 = 1회당 입력값

kg basis:
1회 필요 성분량 = 현재 진료의 확인된 체중 × 1회당 입력값

성분 기준 조제량:
조제량 = 1회 필요 성분량 ÷ 오더 단위당 제품 성분량 또는 농도
```

Example:

```text
체중 10 kg
처방량 2 mg/kg
제품 농도 5 mg/mL

1회 필요 성분량 = 10 kg × 2 mg/kg = 20 mg
조제량 = 20 mg ÷ 5 mg/mL = 4 mL
```

### Calculation modes

An applicable order uses one explicit calculation mode.

| Mode | Meaning | Calculation |
| --- | --- | --- |
| Ingredient-based | Convert the prescribed active dose through the product strength or concentration | `1회 필요 성분량 ÷ 오더 단위당 성분량` |
| Fixed product quantity | Use a configured product amount without requiring ingredient-dose conversion | Configured quantity for the order's dose basis |

For example, a vaccine configured as `1 vial/head` produces a `조제량` of `1 vial`. Ingredient strength may remain visible as reference information but is not a required calculation input in fixed-product mode.

Do not silently fall back from ingredient-based calculation to a fixed value. If the selected mode lacks its required inputs, the result is `계산 불가`.

### Product unit conversion

The same ingredient-based formula applies across formulations; the product strength determines the resulting order unit.

| Product representation | Example strength | Example `조제량` unit |
| --- | --- | --- |
| Liquid | `5 mg/mL` | `mL` |
| Tablet | `20 mg/T` | `T` |
| Capsule | `50 mg/cap` | `cap` |
| Powder | `100 mg/g` | `g` |
| Vial | `1,000 IU/vial` | `vial` |

- The prescribed ingredient unit and product ingredient unit must be dimensionally compatible.
- Use only explicit conversion factors owned by the order configuration.
- Do not infer a conversion between incompatible units such as `mg` and `IU`.
- Missing or incompatible conversion data produces `계산 불가`.

### Weight source and lifecycle

- A kg-based calculation uses the latest confirmed weight in the same encounter
  whose measurement timestamp is at or before confirmation.
- Preserve the exact weight value and measurement timestamp used by the calculation in the applied order snapshot.
- If that weight changes before `Order 확정`, recalculate `조제량` automatically.
- A manually overridden `실조제량` then becomes `재확인 필요` under its own confirmed lifecycle rule.
- If no valid current weight exists, a kg-based `조제량` is `계산 불가`.
- Do not fall back to a weight from another encounter, even when it is the most
  recent patient weight overall.
- A weight recorded after `Order 확정` must not silently change the confirmed order. A correction requires the order return and reconfirmation flow.

### Combination products

- A combination product must identify one ingredient as the dose-calculation basis.
- Calculate `조제량` from that reference ingredient only.
- Keep the remaining ingredients as product composition information rather than independent competing calculations.
- If no single reference ingredient is configured, show `계산 불가`.
- The chart table does not allow the user to switch the reference ingredient ad hoc.

### Dilution boundary

For a diluted injection or fluid order, `조제량` means the theoretical amount of the source product or stock solution, not the final diluted administration volume.

```text
필요 성분량 10 mg
원액 농도 20 mg/mL
조제량 0.5 mL
희석액 4.5 mL
최종 투여량 5.0 mL
```

- In this example, `조제량` remains `0.5 mL`.
- Diluent amount and final administration volume are separate dilution or administration data.
- `실조제량` remains comparable to the source-product `조제량`; it must not be overloaded with the final diluted volume.

### Precision and rounding

- Preserve the calculation's original numeric precision and do not apply intermediate rounding to `조제량`.
- The screen may format the visible value for readability, but later calculations must use the original unrounded value rather than the shortened display string.
- Practical measurement, split, or rounding rules apply only when proposing `실조제량`.
- The exact visible precision follows order-unit configuration rather than one global decimal-place rule.

### Range and PRN orders

- A clinical guide may preserve a dose range as reference, but an executable order must select one numeric `1회당` dose before confirmation.
- `조제량` is therefore one numeric per-administration value rather than a range.
- A PRN order still requires one confirmed per-administration dose and `조제량`.
- PRN variability belongs to `총횟수` and total-required-quantity rules, not to the one-time `조제량`.
- Block `Order 확정` until an applicable order has one valid calculable value.

### Display and error states

| State | Table value | Meaning |
| --- | --- | --- |
| Non-applicable order | Blank | This order has no dispensing calculation |
| Applicable but missing or invalid inputs | `계산 불가` | Order configuration or required patient/prescription input must be corrected |
| Valid calculation | Numeric value plus order unit | Read-only theoretical amount per administration |

Do not use zero as a substitute for either blank or `계산 불가`. Do not allow direct `조제량` entry to bypass missing calculation inputs.

### Calculation explainability

- A user can inspect the read-only cell to see the inputs and formula behind the current result without adding another table column.
- Show the calculation weight, `head/kg당` basis, `1회당` dose, reference ingredient, product strength, units, and result when applicable.
- A fixed-product order can show a formula such as `1 head × 1 vial = 1 vial`.
- A `계산 불가` explanation identifies the missing or incompatible input.
- The exact hover, click, or popover presentation remains an implementation design detail.

### Recalculation and snapshot rules

- Recalculate before confirmation when the dose basis, `1회당` value, weight, selected product, reference ingredient, strength, concentration, unit, calculation mode, or fixed quantity changes.
- Recalculate from current patient and prescription inputs when an order is copied or a set order is reapplied.
- At `Order 확정`, freeze the calculation inputs, calculation mode, formula result, and source timestamps in the applied order snapshot.
- Do not silently recalculate an already confirmed order from later catalog, patient, or encounter changes.

## `조제량` Implementation Mapping and Data Gates

The versioned snapshot uses explicit structured fields rather than a rendered
formula string: `calculationMode`, `doseBasis`, `dosePerAdministration`,
`doseUnit`, `referenceIngredientId`, product-strength numerator and denominator
values/units, explicit unit-conversion inputs, `weightSnapshot`,
`theoreticalDispenseQuantity`, `dispenseUnit`, and calculation source metadata.
Exact storage column names may follow repository conventions, but the API must
preserve these meanings one-to-one.

- Supported conversions are the dimensionally compatible conversions explicitly
  authored in the order master. An empty conversion table is valid but causes an
  otherwise applicable row to remain `계산 불가`; implementation does not invent
  factors.
- Stored calculation precision remains lossless numeric data. Display precision
  comes from the order-unit configuration; missing display precision uses the
  lossless value without adding a clinical rounding rule.
- Combination products require an authored reference ingredient. Diluent and
  final administration volume remain separate optional fulfillment fields.
- Fixed-product quantity belongs to the order master and is validated for the
  selected head/kg basis. Missing configuration blocks confirmation.
- Historical confirmed orders without this snapshot display `미기록`; they are
  not backfilled from current master data.
- The calculation explanation is row detail/popover behavior and does not alter
  the persistence contract.

## Confirmed Contract: `실조제량`

### Definition

`실조제량` is the actual measurable or divisible quantity prepared **per administration** after practical rounding, splitting, or measurement is applied to the theoretical `조제량`.

It is not:

- the total quantity prepared for the full course;
- the billing `수량`;
- an actual fulfillment result entered after a downstream task is completed.

It belongs to order authoring and confirmation. It represents the operationally usable amount that the prescriber confirms before the order is handed off.

### Applicability

`실조제량` is a conditional dispensing field rather than a meaningful value for every order row.

- Enable it for medication rows that require actual measurement, splitting, dilution, preparation, or administration, including `경구제`, `주사제`, `수액`, and `기타 의약품` when dispensing attributes are available.
- For injection and fluid rows, interpret the field broadly as the actual product amount prepared and administered per administration, even when the workflow is closer to administration than pharmacy-style dispensing.
- Leave it blank and non-editable for non-dispensing rows such as consultation fees, tests, procedures, surgery, hospitalization, goods, grooming, and hotel/boarding.
- Do not use `0` to represent non-applicability. A blank value means the field does not apply to that row.
- Column visibility remains fixed in the `전체` tab; applicability is controlled at the cell level.

### Unit source

- `실조제량` inherits the existing unit assigned to the applied dispensing order.
- `실조제량` does not introduce a separate unit selector or independently editable unit.
- `조제량` and `실조제량` use the same order unit for the row.
- Ingredient units such as `mg` are converted as part of the upstream `조제량` calculation; users edit only the numeric `실조제량` expressed in the order unit.
- The inherited order unit is distinct from the billing quantity unit unless a later pricing rule explicitly maps them.

### Initial proposed value

- If the applied order has an order-specific measurement, rounding, or split rule, apply that rule to `조제량` and propose the result as `실조제량`.
- If the applied order has no such rule, copy the exact `조제량` value into `실조제량` without adding an implicit rounding rule.
- Do not apply one global rounding rule to every dispensing order.
- Preserve whether the proposed value was derived by an order-specific rule or copied without rounding.
- The proposed value remains editable before `Order 확정` under the confirmed override rules.

### Order-master preparation policy

Manage practical preparation rules per medication in the hospital order master rather than applying one global medication policy.

Configure, when applicable:

- the allowed measurement or split increment, such as `0.1 mL`, `0.5 T`, or `0.25 T`;
- the default adjustment mode: nearest increment, round up, or round down;
- display precision derived from the configured increment;
- an order-specific minimum or maximum allowed preparation amount;
- the no-reason deviation tolerance expressed in the same order unit.

Examples:

```text
Liquid A
increment: 0.1 mL
mode: nearest increment
조제량 4.08 mL -> proposed 실조제량 4.1 mL
```

```text
Tablet B
increment: 0.5 T
mode: nearest increment
조제량 0.43 T -> proposed 실조제량 0.5 T
```

- The chart user cannot change the applied preparation policy from the table; the user can edit only the proposed `실조제량` under the confirmed constraints.
- When no preparation rule exists, copy the exact `조제량` as the proposed value without applying an implicit rounding mode.
- When no increment exists, the copied lossless value is display-only and manual
  divergence is disabled because the server has no authoritative input step. A
  user must correct the master preparation policy before entering a different
  value.
- Clinical values for increments, ranges, and tolerances must come from approved hospital configuration. Do not invent them during implementation.

### Calculation chain

```text
head/kg당
  -> 1회당 처방 성분량
  -> 제품 성분량/농도
  -> 조제량 (이론 계산값, 1회 기준)
  -> 실조제량 (계량/분할/반올림을 적용한 1회 기준값)
```

The total required preparation amount is a separate derived value:

```text
총 필요 조제량 = 실조제량 × 총횟수
```

The billing `수량` may use the total required amount under a later pricing rule, but it must remain a distinct billing field rather than an alias of `실조제량`.

### Examples

#### Liquid medication

- Required active amount per administration: `12.24 mg`
- Product concentration: `3 mg/mL`
- Theoretical `조제량`: `4.08 mL`
- If the order has a `0.1 mL` measurement increment, proposed `실조제량`: `4.1 mL`
- A later manual value such as `5.0 mL` is an override and must satisfy the confirmed validation and reason rules.

#### Tablet medication

- Theoretical `조제량`: `0.43 T` per administration
- If the order has a `0.5 T` split rule, proposed `실조제량`: `0.5 T`

The examples explain the field relationship and configured policy behavior only. They do not define clinically appropriate values for a specific medication.

### Field distinction

| Field | Product meaning | Edit policy |
| --- | --- | --- |
| `1회당` | Prescribed active dose for one administration | Upstream numeric dose plus snapshotted dose unit under the selected head/kg basis |
| `성분량` | Product strength or concentration used to convert dose into a measurable product amount | Snapshotted reference-ingredient numerator/denominator value and units |
| `조제량` | Theoretical product quantity required for one administration | Formula-derived and read-only |
| `실조제량` | Practically measurable product quantity for one administration | System-proposed, editable before confirmation under the rules below |
| `총 필요 조제량` | Full-course operational amount derived from `실조제량 × 총횟수` | Derived value; not currently a target header |
| `수량` | Quantity used by the billing price calculation | Separate billing field and rule |

## Confirmed Edit Lifecycle for `실조제량`

### Required state and edit authority

- `실조제량` is required before `Order 확정` for every row where the field applies.
- A blank value, zero, or an invalid value blocks confirmation for an applicable row.
- If the calculation inputs are incomplete, show a `계산 필요` state and block confirmation until a valid value exists.
- Non-applicable rows remain blank and do not participate in this confirmation gate.
- Edit authority follows permission to edit that chart order; it is not hard-coded to a job-title label.
- The normal editor is the responsible veterinarian or another user with the same chart-order edit capability.
- A dispensing or treatment operator does not directly change a confirmed value. The operator returns the order for correction instead.

### Before `Order 확정`

- The system proposes a default `실조제량` derived from `조제량` and the applicable measurement or split rule.
- A user with permission to edit the chart order can change the proposed value.
- The field is a constrained numeric override, not free text.
- The value must be greater than zero.
- The value must use the same measurement dimension as `조제량`.
- The value must satisfy the allowed measurement increment or division rule for the product.
- If the order defines a minimum or maximum allowed value, input outside that range is blocked even when a user could provide a reason.
- Do not impose a shared maximum value or deviation percentage across all medications.
- Compare a manual value with the system-proposed `실조제량` using the configured no-reason deviation tolerance.
- A manual value within that tolerance and the allowed range can be saved without a reason as a routine adjustment.
- A manual value outside that tolerance but still within the allowed range requires a reason.
- If no no-reason tolerance is configured, require a reason for every manual difference from the system-proposed value.

### Display precision

- The order-specific minimum measurement or split unit determines both the input step and displayed decimal precision.
- Examples: `0.1 mL` displays `5.0 mL`; `0.01 mL` displays `5.00 mL`; `0.5 T` displays `0.5 T`; `0.25 T` displays `0.50 T`.
- Reject input that uses a smaller increment than the order allows.
- Do not force one fixed decimal precision across every order unit.

### Manual override reason

- Capture a required reason in a small popover anchored to the edited `실조제량` cell when the manual change exceeds the allowed no-reason deviation.
- Suggested reasons are `계량 단위 보정`, `제형·분할 제한`, `희석 또는 조제 편의`, `환자 상태에 따른 조정`, and `기타`.
- Selecting `기타` requires free-text detail.
- Show a compact change indicator in the cell after saving; opening it reveals the reason and change history.
- Routine allowed edits do not require a text reason, but still record actor, timestamp, previous value, and new value.
- The target table's separate `사유` column remains the billing adjustment reason for `할인할증(금액)` or `(%)`. It must not store a `실조제량` override reason.

### Recalculation behavior

When an upstream input such as `head/kg당`, `1회당`, or `성분량` changes:

- If `실조제량` is still system-derived, recalculate it automatically.
- If a user has manually overridden it, do not silently replace the value.
- Mark the manual value as requiring reconfirmation and block `Order 확정` until the user resolves it.
- Provide an `자동 계산값으로 되돌리기` action that clears the manual override and resumes automatic recalculation.

### Copy and set-order reuse

- When copying an order or reapplying a set order, carry forward the order unit and its measurement, rounding, or split rules.
- Recalculate `조제량` from the current patient and current prescription inputs, then generate a new proposed `실조제량`.
- Do not copy the prior row's manual `실조제량`, override reason, or override history.
- A duplicated row must derive or reconfirm its own `실조제량`; a previous patient's or previous order instance's value is not authoritative.

### At and after `Order 확정`

- Freeze the confirmed `실조제량` in the applied order snapshot.
- Do not allow inline editing after confirmation.
- A later change requires an explicit return, correction, and reconfirmation flow.
- Keep one active visible order row rather than adding a duplicate row to the table.
- Show the latest reconfirmed value as the current value, while preserving every previous confirmed value in order history.
- Preserve actor, timestamp, previous value, new value, and reason for each correction.
- Send only the latest confirmed value as the active dispensing or treatment instruction.
- If the correction affects existing fulfillment or billing state, mark those records for the appropriate return, recalculation, or relinking flow rather than silently replacing their snapshots.
- Do not repurpose a downstream fulfillment result as the confirmed order value.

### Downstream handoff

- Send the confirmed `실조제량` as the per-administration preparation or administration instruction.
- Also send the derived full-course amount calculated as `실조제량 × 총횟수` when downstream work needs the total required amount.
- Dispensing and treatment operators can read these confirmed values but cannot edit them in place.
- If a value is incorrect, the operator returns the order to the chart workflow with a reason.
- If the service later records what was actually prepared or administered, store that as a separate execution result. Do not overwrite the confirmed `실조제량` instruction.

### Existing confirmed orders

- Do not retroactively infer or backfill `실조제량` for historical confirmed orders that did not store it.
- Display those historical values as `미기록`, not as zero and not as a newly calculated value.
- Apply the required-value rule to new orders and currently unconfirmed orders.
- When a historical order is returned for correction or re-requested, require a valid `실조제량` before it can be reconfirmed.

## `실조제량` Data Requirements

The implementation will need to preserve at least:

- whether `실조제량` applies to the row;
- the confirmed per-administration actual dispense value;
- the unit inherited from the applied dispensing order;
- whether the current value is system-derived or manually overridden;
- the rounding, splitting, or measurement policy copied into the applied order snapshot;
- the allowed increment, display precision, and any order-specific minimum or maximum;
- whether a manual value requires reconfirmation after an upstream change;
- override reason and change-history information;
- previous confirmed values and the latest active confirmed value;
- a separate downstream execution result when actual fulfillment must be recorded.

The existing synthetic chart-order draft uses `actualDispenseQuantity`,
`actualDispenseQuantitySource`, and `dispenseRoundingPolicy` as compatibility
concepts. The implementation may preserve those wire keys where changing them
would add migration risk, provided their meaning matches the structured mapping
above and no data is collapsed into a rendered string.

## `실조제량` Implementation Mapping and Data Gates

Preserve `dispenseApplicability`, `preparationPolicy`,
`actualDispenseQuantity`, `actualDispenseUnit`, `actualDispenseSource`, optional
`actualDispenseOverride`, and `requiresReconfirmation` as structured snapshot
data. The preparation policy preserves optional increment, rounding mode,
minimum, maximum, no-reason tolerance, and display precision. Override history
is append-only and never embedded as one mutable reason string.

- Applicability comes from the authored clinical calculation mode and dispensing
  attributes, not from a UI category guess. Missing applicability configuration
  is fail-closed for medication rows and non-applicable for known non-dispensing
  rows.
- The same configured product-unit conversion contract used by `조제량` owns
  dimensional validation; no extra UI conversion is permitted.
- `chart:update` is the edit authority. Return uses the route-specific work
  completion capability; correction, reconfirmation, re-request, and clinical
  cancellation use `chart:update`.
- Current technical common states are the confirmed target states in this
  document. Each retry creates a numbered attempt; an order correction creates a
  numbered revision. They are not the same sequence.
- Historical missing data remains null and displays `미기록`. `총 필요 조제량`
  is included in downstream and calculation-detail DTOs but not added as a
  visible table column.
- Approved medication-specific values remain a master-data dependency. Until
  authored and published, affected rows are visibly blocked; no default
  increment, tolerance, range, or conversion is synthesized.

## Final Direct-Column Source Mapping

| Column | Authoritative source |
| --- | --- |
| `분류` | Applied order's snapshotted clinical order type/category group |
| `Order 명` | Applied clinical display name from the confirmed master snapshot |
| `일수` | Applied duration days when the schedule uses duration; otherwise blank |
| `head/kg당` | Snapshotted `doseBasis` (`head` or `kg`) |
| `1회당` | Snapshotted prescribed dose per administration and dose unit |
| `보관` | Applied storage instruction from the master snapshot |
| `단가` | Confirmation-frozen unit price, copied unchanged into the immutable billing snapshot |
| `수의사` | Immutable requesting user; legacy fallback is confirming user, otherwise `미기록` |

`수의사` never falls back to the current viewer, current assignee, or a guessed
job-title member. Each cell's applicable blank, `미기록`, `미설정`, or `계산
불가` state follows the contracts above.

## Implementation Gate

The read-only validation gate is complete and the owner has approved the named
implementation scope. Implementation now proceeds only in dependency order:
master authority and fail-closed defaults, work lifecycle and permission
boundary, billing authority, then the chart projection and target columns.

Before any production mutation, merge, or deployment, require:

- the current repository, deployed authenticated UI, remote database, and Airtable order master have been cross-checked against this contract;
- every applicable end-to-end validation item has an evidence-backed `정상`, `부분 구현`, `미구현`, `충돌`, or `추가 정책 필요` result;
- gaps, migrations, data enrichment, prerequisite domain work, and intentionally separate implementation scope have been identified;
- every target column has an approved source, calculation, editability, empty-state, persistence, and lifecycle rule where applicable;
- cross-order-type applicability is defined;
- billing and confirmation interactions are consistent with the existing order and billing domain contracts;
- an independent contract and security review of the exact candidate;
- exact candidate SHA, focused test evidence, migration dry-run/rollback proof,
  deployment destination, and remote smoke plan;
- explicit production approval for that exact packet.

## Decision Ledger

The normative rule lives in the linked section above. This ledger records owner
agreement and provenance only; when a summary phrase is less specific than the
body, the body governs. Implementation evidence and current-state
classifications live in `CHART-PR-031-VALIDATION`, not in this ledger.

| Date | Decision | Status |
| --- | --- | --- |
| 2026-09-02 | Use the legacy CLAiR column names and order for the current Plan/Order `전체` tab. | Agreed |
| 2026-09-02 | Keep the current UI; change only table column composition in the future implementation. | Agreed |
| 2026-09-02 | Validate the complete order lifecycle from draft authoring through downstream work, correction, cancellation, and billing before implementing the column-only UI change. | Agreed |
| 2026-09-02 | Classify every pre-implementation validation item as `정상`, `부분 구현`, `미구현`, `충돌`, or `추가 정책 필요`, with evidence and scoped prerequisites for every gap. | Agreed |
| 2026-09-02 | Exclude `Task`, `메모`, and `청구서`; replace the legacy `직원` label with the defined `담당자` column while preserving necessary underlying data. | Agreed |
| 2026-09-02 | Use `상태` only for generated downstream work progress; leave rows without work items blank and keep order/billing states separate. | Agreed |
| 2026-09-02 | Restore the previously defined task-type display vocabulary as the target reference while recording the current six-state persistence gap. | Agreed |
| 2026-09-02 | Require `Order 확정` before `Order 청구`; an unconfirmed draft cannot be billed. | Agreed |
| 2026-09-02 | Create a downstream work request at confirmation only when the order type requires operational work; confirmed orders without work items can be billed immediately when billing data is valid. | Agreed |
| 2026-09-02 | Allow billing from `대기`, `재요청`, active or partial progress, or `일시중지` only after a warning; allow `완료` without that warning and block `반려` or `취소`. | Agreed |
| 2026-09-02 | Remove `accepted` from the target common workflow; `시작하기` transitions `requested` directly to `in_progress` and records `startedByUserId` and `startedAt`. | Agreed |
| 2026-09-02 | Keep responsible-user assignment separate from work state; assignment retains `requested`, while `시작하기` changes the work to `in_progress`. | Agreed |
| 2026-09-02 | Preserve assignment actor, assignee, timestamp, and change history without introducing `accepted`; add that state only if an explicit acceptance action is approved later. | Agreed |
| 2026-09-02 | Use `paused` as an independent common state, preserve the prior detailed phase, and restore that phase when work resumes. | Agreed |
| 2026-09-02 | Preserve each returned or repeated work attempt; use `requestCycle > 1` to display a waiting new attempt as `재요청`. | Agreed |
| 2026-09-02 | Allow a veterinarian to re-request completed work after reviewing a questionable result without altering the preserved completed attempt. | Agreed |
| 2026-09-02 | Treat laboratory work as `입력중`, `부분완`, then `완료` when every required result is finalized; veterinarian viewing is not a completion gate. | Agreed |
| 2026-09-02 | Treat `판독완` as completion for interpreted imaging and `촬영종료` as completion when interpretation is not required; do not add a redundant later `완료` step. | Agreed |
| 2026-09-02 | Keep surgery in progress at `수술완` until required records and recovery or inpatient handoff are complete. | Agreed |
| 2026-09-02 | Keep the chart `상태` cell display-only and perform work-state changes in the owning downstream screen. | Agreed |
| 2026-09-02 | Add `담당자` after `투여/복약`, showing `미지정` or the current assignee avatar with an eligible-user avatar-and-name selector. | Agreed |
| 2026-09-02 | Use the draft's intended assignee before confirmation and the generated work item's current assignee afterward; downstream claims must update the chart. | Agreed |
| 2026-09-02 | Allow an eligible user to claim another assignee's waiting work without changing `requested`; require explicit handoff after work starts. | Agreed |
| 2026-09-02 | Derive parent-set status from child work states without creating an independent parent work state. | Agreed |
| 2026-09-02 | Aggregate parent-set display using the agreed action-priority order: `반려`, active `진행중`, `일시중지`, mixed `부분완`, waiting `대기` or `재요청`, then terminal `완료` or `취소`. | Agreed |
| 2026-09-02 | Map legacy `accepted` records with start evidence to `in_progress` and those without it to `requested`, while preserving the legacy event history. | Agreed |
| 2026-09-02 | Define `성분량` as the read-only product-unit strength or concentration of the configured reference ingredient. | Agreed |
| 2026-09-02 | Use `횟수` for frequency rules and `총횟수` for derived schedule occurrences or an explicit PRN maximum. | Agreed |
| 2026-09-02 | Combine route and short administration instruction in `투여/복약` without repeating frequency. | Agreed |
| 2026-09-02 | Treat `청구서명` as the applied billing display name editable until and frozen at `Order 청구`. | Agreed |
| 2026-09-02 | Treat `청구반영` as billing inclusion, independent from clinical confirmation and work status. | Agreed |
| 2026-09-02 | Derive billing `수량` from the configured price basis and keep it separate from clinical dose and `실조제량`. | Agreed |
| 2026-09-02 | Calculate `합계` before adjustments and `청구금액` after adjustments; neither is directly editable. | Agreed |
| 2026-09-02 | Use one authoritative amount-or-percent adjustment source, derive the other value, and require `사유` for non-zero adjustments. | Agreed |
| 2026-09-02 | Source `과세` from the order master as read-only classification and block billing-reflected rows when it is unset. | Agreed |
| 2026-09-02 | Configure one explicit price basis per billable order master and block billing when it is missing. | Agreed |
| 2026-09-02 | Round percentage-derived adjustments to whole KRW with symmetric half-away-from-zero handling. | Agreed |
| 2026-09-02 | Source billing-adjustment reasons from hospital configuration and always provide `기타` with required detail. | Agreed |
| 2026-09-02 | Read VAT-included or VAT-added arithmetic from explicit hospital billing policy and block taxable billing when that policy is missing. | Agreed |
| 2026-09-02 | Require each set-order master to choose exclusive parent billing or child billing and block missing or contradictory ownership. | Agreed |
| 2026-09-02 | Define `조제량` as the unrounded theoretical product quantity required per administration and keep it read-only. | Agreed |
| 2026-09-02 | Interpret `1회당` through the selected `head/kg당` basis; kg-based calculation uses a confirmed encounter-weight snapshot. | Agreed |
| 2026-09-02 | Support explicit ingredient-based and fixed-product calculation modes without silent fallback between them. | Agreed |
| 2026-09-02 | Use only dimensionally compatible, explicitly configured product-unit conversions; otherwise show `계산 불가`. | Agreed |
| 2026-09-02 | Calculate combination products from one configured reference ingredient. | Agreed |
| 2026-09-02 | Keep source-product `조제량` separate from diluent amount and final administration volume. | Agreed |
| 2026-09-02 | Preserve unrounded calculation precision and apply practical rounding only when proposing `실조제량`. | Agreed |
| 2026-09-02 | Require one executable per-administration value for range and PRN orders before confirmation. | Agreed |
| 2026-09-02 | Distinguish blank non-applicable cells from `계산 불가` applicable cells and expose the read-only calculation basis. | Agreed |
| 2026-09-02 | Freeze calculation inputs and results at confirmation; do not silently recalculate confirmed orders from later changes. | Agreed |
| 2026-09-02 | Define `실조제량` as the practical quantity per administration, separate from total quantity and billing quantity. | Agreed |
| 2026-09-02 | Make `조제량` calculated/read-only and `실조제량` editable before confirmation as a constrained override. | Agreed |
| 2026-09-02 | Freeze `실조제량` at confirmation and require an amendment/re-request path afterward. | Agreed |
| 2026-09-02 | Enable `실조제량` only for applicable medication rows; keep non-dispensing rows blank and non-editable. | Agreed |
| 2026-09-02 | Include injections and fluids by treating `실조제량` as the actual product amount prepared and administered per administration. | Agreed |
| 2026-09-02 | Inherit the existing dispensing-order unit for `실조제량`; do not provide an independent unit selector. | Agreed |
| 2026-09-02 | Propose `실조제량` using the applied order's rounding or split rule; if no rule exists, copy `조제량` exactly. | Agreed |
| 2026-09-02 | Do not impose one global rounding rule across all dispensing orders. | Agreed |
| 2026-09-02 | Configure medication-specific increment, rounding mode, precision, range, and no-reason tolerance in the hospital order master. | Agreed |
| 2026-09-02 | Require a reason for every manual difference when no medication-specific no-reason tolerance is configured. | Agreed |
| 2026-09-02 | Capture material manual-override reasons from a popover attached to the `실조제량` cell; keep the table `사유` column for billing adjustments. | Agreed |
| 2026-09-02 | Base edit authority on chart-order edit permission rather than a hard-coded staff role; downstream operators return confirmed orders for correction. | Agreed |
| 2026-09-02 | Require a valid positive `실조제량` before confirming every applicable row; non-applicable rows remain blank. | Agreed |
| 2026-09-02 | Enforce order-specific increments and ranges, block impossible values, and require a reason only for material but allowable deviations. | Agreed |
| 2026-09-02 | Derive display precision and input step from the order-specific minimum measurement or split unit. | Agreed |
| 2026-09-02 | Recalculate system-derived values after upstream changes; preserve manual values as `재확인 필요` and provide an automatic-value reset action. | Agreed |
| 2026-09-02 | Recalculate `실조제량` for copied orders and reapplied sets; do not copy previous manual values or reasons. | Agreed |
| 2026-09-02 | Handoff confirmed instruction values as read-only; keep actual fulfillment results separate. | Agreed |
| 2026-09-02 | Keep one active visible order row while preserving prior confirmed values and correction reasons in history. | Agreed |
| 2026-09-02 | Preserve historical missing values as `미기록`; require `실조제량` only when new, unconfirmed, or corrected orders are confirmed. | Agreed |

## Related Sources

- [Plan/Order `전체` Tab Legacy Column Delivery Plan](../roadmap/plan-order-all-tab-legacy-column-delivery-plan.md)
- [Chart Order Application V1](../demo-data/chart-order-application-v1.md)
- [Order Fulfillment Handoff](order-fulfillment-handoff.md)
- [Order Fulfillment Handoff Engineering Contract](../../engineering/data-model/order-fulfillment-handoff-contract.md)
- [Workspace Order Catalog Platform](workspace-order-catalog-platform.md)
- [Chart Editable Order Table](../../work/chart/CHART-PR-007-editable-order-table.md)

## Final UI Implementation Criteria — 2026-09-08

Final owner-approved design target, implemented locally in CHART-PR-036.
DB schema and production behavior remain unchanged; delivery is not included.
This section supersedes older header, blank-cell, and visual ordering rules in
this document; underlying lifecycle, authorization, and billing rules remain.

### Columns And Presentation

| Situation | `오더 확정` | `업무 상태` | Row |
| --- | --- | --- | --- |
| Unconfirmed, required input valid | `확정 대기`, neutral badge | Muted `—` | Retained |
| Unconfirmed, input incomplete/invalid | `입력 필요`, orange badge | Muted `—` | Retained |
| Confirmed, task exists | `확정`, green badge | Actual task icon + domain label | Retained |
| Confirmed, no task | `확정`, green badge | `—` | Retained |
| Cancelled after confirmation, with or without a task | `확정`, green badge | Cancel icon + `취소` | Retained |
| Unconfirmed candidate removed | Not rendered | Not rendered | Removed from table |

- `오더 확정` expresses the confirmation history boundary. A cancelled confirmed
  order remains in the confirmed group; its stored cancellation status is not
  rewritten to `confirmed`. Do not give it a separate cancellation badge or
  move it to a special last group.
- Resolve display in this order: unconfirmed candidate → `—`; confirmed order
  cancelled → `취소`; otherwise actual task state → existing label/icon; otherwise
  `—`. Order cancellation takes precedence over a preserved completed, returned,
  re-requested, or absent task. A task cancellation also displays `취소`.
- Preserve completed results, attempts, events, and audit history. This target
  requires a display projection, not overwriting terminal task state or creating
  a task for consultation/no-task orders.
- Use 22px compact text badges, subtle borders, and existing neutral/warning/
  success tokens. Row backgrounds remain neutral; preserve hover, selection,
  focus, and disabled affordances. Scope styling to Plan/Order.
- Reuse `EmrSidePanelStateIcon` with explicit mappings from task state and detailed
  phase. Preserve domain labels (`판독완`, `부분완`, `반려`, etc.). Returned work and
  re-requested work are distinct. Do not infer an icon from an unknown label.
- For unconfirmed `—`, expose `확정 후 업무 상태가 표시됩니다` on hover and keyboard
  focus, with an accessible description.
- Reuse existing confirmation validation. `입력 필요` opens the existing relevant
  detail editor; permission, save conflict, locking, and server failure remain
  distinct explanations and must not be relabeled as missing inputs.

### Ordering And Pinned Columns

- Default group order: `확정 대기` → `입력 필요` → `확정`. Keep stable relative order
  within groups. This is display ordering, not a transition sequence.
- Keep the edited row in place during input. Reorder after editing ends or
  confirmation succeeds, not on each keystroke. Failed confirmation must not
  move a row into the confirmed group.
- Explicit user-selected column sorting takes precedence over the default.
- Keep set parents and children together; sort groups by their parent, retaining
  child order. Excluded children keep existing inclusion semantics and must not
  become independent confirmation targets or spurious input blockers.
- Pin `select`, `분류`, `오더 확정`, `Order 명` in that order. `업무 상태` follows
  `Order 명` and scrolls with subsequent columns.

### Deletion, Cancellation, And Scope

- Unconfirmed candidates may be removed through existing candidate removal.
  The storage marker `draft_candidate_removed` is not a visible cancelled order.
- Confirmed orders cannot be removed from the table. Preserve existing selection,
  history, amendment, re-request, and cancellation actions, including confirmed
  selection and the prohibition on independent set-child cancellation.
- Cancellation keeps the row, confirmation history, and previous clinical results.
  Existing invoice-linked cancellation restrictions and billing correction paths
  remain unchanged. No permission or DB lifecycle change is authorized here.
- The standalone prototype illustrates presentation with sample data. Its sample
  selection/confirmation controls do not replace existing application actions;
  do not copy its disabled confirmed checkboxes, sample search/filter controls,
  or simplified validation into production behavior.
- Keep unrelated WIP and quick-add work intact. Local implementation is recorded
  in [CHART-PR-036](../../work/chart/CHART-PR-036-plan-order-status-presentation.md);
  remote mutation, merge, and deployment require applicable delivery authorization.

### Verification And Handoff

Required checks: unconfirmed `—`/tooltip; input correction without premature task
state; successful/failed confirmation; cancelled completed, re-requested, returned,
and no-task orders all showing `취소`; row retention after cancellation versus
candidate removal; confirmed selection/actions; set grouping and excluded children;
editing stability and explicit sort precedence; pinned-column scrolling; keyboard
access and local row surfaces without shared-table regressions.

Remote read-only evidence inspected on 2026-09-08: the production alias resolved
to Ready deployment `dpl_BdNWGxmEMtyDU4hPszoe4ik1mH6V`, GitHub Production deployment
`6306790982`, SHA `d6ad06646e0a9821e13834bd605d3145185c7111`. The connected remote
Supabase cancellation function preserved terminal task states while cancelling
orders; its definition MD5 was `9a9f92f6a4c22b18dad9928c573a7b8b`. Deployed UI source
read task state without an order-cancellation override. These are inspected
snapshots, not proof of a new cancellation run or permanent current deployment.
No cancellation mutation was executed. No confirmed-cancelled example was returned
by the scoped Cheongdam aggregate query.
