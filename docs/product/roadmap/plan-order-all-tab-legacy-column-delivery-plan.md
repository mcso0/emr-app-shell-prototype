---
id: PRODUCT-ROADMAP-PLAN-ORDER-ALL-TAB-LEGACY-COLUMN-DELIVERY
type: Delivery Plan
title: Plan/Order All Tab Legacy Column Delivery Plan
description: Defines the gated path from contract review and current-state validation through implementation, merge, production release, and final evidence for the Plan/Order legacy column restoration.
status: draft
area: product
doc_type: roadmap
related_work:
  - CHART-PR-031
supersedes: []
superseded_by: []
tags:
  - chart
  - plan-order
  - order-table
  - fulfillment
  - billing
  - release
last_updated: 2026-09-02
---

# Plan/Order `전체` Tab Legacy Column Delivery Plan

## Goal

Preserve the current Plan/Order `전체` tab UI system while applying the approved legacy CLAiR column composition, exact order, and labels, then ensure those columns remain consistent with real order authoring, confirmation, downstream work, return, re-request, cancellation, and billing behavior through verified `origin/main` delivery and production smoke.

## Relationship To The Product Contract

The [Plan/Order `전체` Tab Legacy Column Contract](../domain/plan-order-all-tab-legacy-column-contract.md) defines what the product must mean and how each target column behaves. This delivery plan defines how to review, investigate, implement, verify, and release that contract.

- The product contract owns column meaning, order, calculation, lifecycle, and accepted product decisions.
- This plan owns phase order, required outputs, approval gates, and completion evidence.
- PR-sized execution must be split into linked `docs/work/` items after the feasibility review establishes the actual implementation boundary.
- GitHub PRs and release records own detailed execution and CI history; this document must not become a duplicate step-by-step log.
- Recording this plan is not authorization to implement, mutate remote data, merge to `main`, or deploy production.

## Scope Boundary

### Intended product change

- Keep the current table UI system and surrounding chart layout.
- Replace the visible `전체` tab column composition with the approved legacy order and labels.
- Connect every included column to an authoritative, validated domain value across its lifecycle.
- Preserve required underlying work, audit, note, billing-link, and history data even when a legacy visible column is removed.

### Validation boundary

Although the visible UI change is column composition, feasibility validation covers the complete order lifecycle:

```text
오더 추가
→ 확정 전 입력·수정·삭제
→ Order 확정
→ 업무 화면 전달
→ 담당·시작·진행·완료
→ 반려·수정·재요청 또는 취소
→ Order 청구
```

### Scope control

- Preserve behavior already proven correct; do not reimplement it.
- Implement only missing or conflicting behavior required for the approved column contract.
- Treat broader domain, DB, master-data, or workflow gaps as prerequisites or separately approved work when they cannot fit one coherent PR.
- Correct the contract before implementation when source-backed investigation disproves an assumption.
- Do not invent clinical configuration, tax policy, pricing policy, permission policy, or existing remote state.

## Full Delivery Procedure

### Phase A: Contract readiness and feasibility

#### 1. First requirements-document review

- Check the product contract for omissions, contradictions, duplication, undefined terms, and ambiguous requirements.
- Cross-check column definitions, calculations, editability, permissions, empty states, snapshots, lifecycle rules, and exception paths for internal consistency.
- Separate decisions that can follow an existing approved source from decisions that require 승욱.

Required output:

- Reviewed contract with a bounded unresolved-decision list.
- Review notes that distinguish confirmed product truth from assumptions.

Exit condition:

- The document is internally coherent enough to test against the current system without implementation guesswork.

#### 2. Current-system investigation

- Inspect the authenticated deployed service rather than relying on a local-only screen.
- Inspect the repository UI, state owners, APIs, persistence gateways, fulfillment screens, billing paths, and focused tests.
- Inspect the current remote database schema, RPCs, policies, state values, relationships, snapshots, and history records with read-only operations first.
- Inspect the Airtable order master for unit, dispensing, price, tax, set, routing, and configuration ownership.
- Record the exact environment, date, source location, and evidence for every current-state claim.

Required output:

- Evidence-backed current-state inventory for deployed UI, repository, remote DB, and Airtable.

Exit condition:

- No feasibility conclusion depends only on stale documentation, mock data, or an unverified local assumption.

#### 3. End-to-end order-flow validation

- Validate order addition, pre-confirmation input and editing, removal, and validation behavior.
- Validate confirmation snapshots, idempotent work creation, correct destination routing, and no-work orders.
- Validate assignment, claim, start, pause, resume, detailed progress, completion, and chart readback.
- Validate return, correction, reconfirmation, result-preserving re-request, request cycles, and duplicate prevention.
- Validate draft and confirmed cancellation, downstream propagation, billing impact, reason, authority, and history.
- Validate billing eligibility, warnings, blocking states, calculations, set ownership, snapshot immutability, and idempotency.

Required output:

- Scenario evidence covering each relevant order type and lifecycle branch.

Exit condition:

- Every required lifecycle path has an observed result or an explicitly recorded evidence gap.

#### 4. Column-by-column data mapping

- Map each visible column to its source entity and field, calculation or derivation, editor, permission, persistence location, empty state, and snapshot boundary.
- Record whether the chart reads a draft, applied order, work item, billing candidate, invoice-line snapshot, or master configuration.
- Define applicability for each order type and the expected behavior of non-applicable cells.
- Identify parent-set versus child ownership where aggregation or billing is involved.

Required output:

- A column contract matrix and an order-type applicability matrix.

Exit condition:

- Every target column has one authoritative current or proposed source and no silent fallback between incompatible meanings.

#### 5. Gap analysis

Classify every validation and mapping item using one result:

| Result | Use when |
| --- | --- |
| `정상` | Current behavior satisfies the approved requirement end to end. |
| `부분 구현` | A usable path exists but required coverage, persistence, or safeguards are incomplete. |
| `미구현` | The required behavior does not exist. |
| `충돌` | Current behavior or source data contradicts the approved contract. |
| `추가 정책 필요` | A product, clinical, billing, permission, or configuration decision is required first. |

Required output:

- Evidence-backed gap matrix with impact, owner, prerequisite, and recommended disposition.

Exit condition:

- Simple column work is separated from prerequisite domain, API, DB, Airtable, and migration work.

#### 6. Required policy and data-enrichment decisions

- Resolve only implementation-blocking decisions such as dispensing unit and increment rules, rounding mode, allowed tolerance, price basis, tax behavior, set billing ownership, eligible assignees, permission keys, and standard reasons.
- Reuse current approved hospital or domain configuration where it exists.
- Ask 승욱 only when verified sources conflict or a required business choice has no authoritative value.
- Never generate clinical values, tax treatment, or billing policy as a convenience default.

Required output:

- Approved decision list and source-owned master-data enrichment requirements.

Exit condition:

- No implementation-critical behavior depends on an invented or implicit policy.

#### 7. Second requirements-document review and contract freeze

- Reconcile the contract with the current-state inventory, scenario evidence, column mapping, gap analysis, and approved decisions.
- Separate confirmed behavior, implementation constraints, prerequisites, deferred work, and intentionally out-of-scope work.
- Add testable acceptance criteria for columns and lifecycle paths.
- Move the contract through its document lifecycle only when 승욱 explicitly approves it.

Required output:

- Source-backed contract candidate ready for implementation approval.

Exit condition:

- The approved implementation no longer requires product decisions to be made inside code review.

### Phase B: Technical preparation and approval

#### 8. Technical and migration plan

- Define affected UI state owners, API boundaries, server validation, DB schema or RPC changes, RLS and workspace scope, audit events, snapshot ownership, and error behavior.
- Define compatibility and migration handling for existing orders, legacy `accepted` events, historical missing values, set orders, work attempts, billing candidates, and invoice lines.
- Define forward migration, verification, rollback or compensating action, and residue checks before any remote mutation.
- Keep real data and destructive remote operations outside scope unless separately and explicitly approved.

Required output:

- Engineering plan, migration plan when needed, rollback plan, and data-boundary review.

Exit condition:

- Every persistent change has a safe execution, verification, and recovery path.

#### 9. Implementation decomposition and test plan

- Split the approved outcome into coherent PR-sized work items for column rendering, authoring and calculations, fulfillment integration, billing integration, master-data enrichment, migration, and regression coverage as required by the gap analysis.
- Name dependencies and the order in which work items can safely land.
- Define focused unit, API, database, integration, browser, permission, idempotency, and rollback checks appropriate to each slice.
- Avoid a single broad PR when the result cannot be reviewed, verified, or rolled back as one coherent change.

Required output:

- Linked `docs/work/` items or Linear issues with goal, scope, non-goals, dependencies, done criteria, verification, and target PR strategy.

Exit condition:

- Each implementation slice is independently reviewable and the combined sequence reaches the full product goal.

#### 10. Implementation approval

- Present the reviewed contract, evidence inventory, gap matrix, policy decisions, technical plan, work-item split, verification plan, migration scope, risks, and rollback approach to 승욱.
- Name any requested remote DB, Airtable, staging, or production operation separately.
- Do not treat approval of this roadmap as approval of an unnamed future mutation or production candidate.

Required output:

- Explicitly approved implementation scope and approved first work item.

Exit condition:

- The exact work to begin, its boundaries, and any approved external mutation are unambiguous.

### Phase C: Implementation and candidate verification

#### 11. Implementation

- Start from the approved branch or clean worktree strategy while preserving unrelated user work.
- Implement only the approved slice using existing components, domain boundaries, and coding conventions.
- Make UI, API, DB, RLS, Airtable, and migration changes only when the active work item and approval include them.
- Keep product, engineering, and work-item documentation aligned with verified behavior.

Required output:

- Scoped implementation with no unrelated refactor or speculative abstraction.

Exit condition:

- The slice meets its acceptance criteria in the intended local or approved remote environment.

#### 12. Implementation verification

- Run narrow static, type, unit, API, DB, integration, and browser checks first, then broaden in proportion to the change risk.
- Validate applicable order types across authoring, confirmation, routing, work progress, return, re-request, cancellation, and billing.
- Validate permissions, workspace isolation, duplicate prevention, idempotency, failed-request recovery, immutable snapshots, history, and migration rollback when affected.
- Record what passed, failed, or could not be verified without overstating mock or local evidence as remote proof.

Required output:

- Exact commands, results, environment, test data boundary, and unresolved risk.

Exit condition:

- All work-item checks pass and remaining limitations are explicitly accepted or removed from the release candidate.

### Phase D: Version control, review, release, and closeout

#### 13. Commit

- Review the diff and stage only approved files.
- Exclude unrelated dirty-worktree changes, secrets, generated noise, and unapproved environment files.
- Commit in a traceable unit linked to the work item and verified behavior.

Required output:

- Candidate commit SHA and scoped file list.

Exit condition:

- The commit can be reviewed and reverted without including unrelated work.

#### 14. Push and pull request

- Push the approved work branch.
- Open or update the PR with requirement links, scope, non-goals, migration and data effects, verification, screenshots or smoke evidence when relevant, risks, and rollback method.
- Use the PR Preview boundary for work-branch review; do not move fixed staging or production aliases from an individual work branch.

Required output:

- PR URL, head SHA, included work items, and Preview deployment evidence when applicable.

Exit condition:

- The exact candidate is available for human and automated review without production exposure.

#### 15. PR review, CI, and merge-candidate freeze

- Review code, domain behavior, permissions, workspace scope, DB and RLS boundaries, money integrity, audit history, and regression risk.
- Run the focused verification plus secret scan, docs check, lint, typecheck, build, and the repository's manual `Release Check` requirements for the exact candidate where applicable.
- Resolve review findings and rerun affected checks after every candidate-changing fix.
- Record the final candidate SHA; do not use earlier green checks as evidence for a changed candidate.

Required output:

- Approved final candidate SHA with passing review, CI, Preview, secret, and focused-test evidence.

Exit condition:

- The exact candidate is ready for the repository's integration and production approval gates.

#### 16. Merge and `origin/main` proof

- Follow the approved environment path: work PR review, fixed-staging integration when required, then a production approval packet for `main`.
- Treat merge or promotion to `main` as a production-release action because `main` is the Vercel Production branch.
- Before the action, name the source commit, included PRs and issues, verification, fixed-staging evidence, smoke path, rollback candidate, and stop condition.
- Merge only after 승욱 explicitly approves the exact production candidate.
- Fetch the remote and prove the merge commit is present on `origin/main`; do not report a local branch or closed PR as merge proof.

Required output:

- PR merge state, merge SHA, `origin/main` SHA or ancestry proof, and approved rollback candidate.

Exit condition:

- The intended candidate, and only that approved work, is verifiably contained in `origin/main`.

#### 17. Deployment and remote verification

- Verify that the deployment built from the approved `origin/main` merge SHA reaches `Ready` state and the intended production alias points to it.
- Probe the scoped route separately from deployment readiness.
- Run authenticated production smoke using synthetic or approved demo data for the changed Plan/Order flow.
- Validate the exact affected lifecycle paths and confirm there is no obvious runtime, network, permission, workspace-scope, duplicate, billing, or migration regression.
- Stop and use the approved rollback or forward-fix decision when smoke fails.

Required output:

- Production deployment ID or URL, source SHA, alias target, route result, authenticated smoke result, and rollback status.

Exit condition:

- Deployment identity, route availability, and scoped application behavior are each independently proven.

#### 18. Final documentation and closeout

- Synchronize the product contract, engineering contracts, work items, current status, and closeout records only with verified results.
- Record remaining limitations, deferred items, migrations, rollback evidence, and recommended follow-up.
- Report commit, PR, final candidate SHA, merge SHA, `origin/main` proof, deployment identity, and authenticated smoke without combining them into one unsupported completion claim.
- Move work status to the appropriate review state; mark it done only after 승욱 accepts the result.

Required output:

- Final evidence-backed result review and durable documentation handoff.

Exit condition:

- Product behavior, implementation, verification, repository state, deployment state, and documentation all describe the same released result.

## Approval Gates

| Gate | Required before | Minimum decision or evidence |
| --- | --- | --- |
| Contract gate | Technical implementation planning | First review, current-state evidence, column mapping, gap classification, policy decisions, and second review. |
| Implementation gate | Editing application or persistence behavior | Explicitly approved scope, work-item boundary, tests, data effects, and rollback plan. |
| External-data gate | Remote DB or Airtable mutation | Exact environment, operation, affected synthetic/demo records or schema, dry-run or read-only evidence, verification, rollback, and explicit approval when required. |
| PR integration gate | Merging a work candidate | Exact candidate SHA, scoped diff, required checks, Preview evidence, secret safety, and review completion. |
| Production gate | Merging or promoting to `main` and production | Exact source SHA, included work, fixed-staging evidence when required, production approval packet, smoke path, rollback candidate, stop condition, and 승욱's explicit approval. |

## Final Definition Of Done

The overall goal is complete only when all of the following are true:

- The current table UI system is preserved and the approved 25 named columns appear in the exact order and spelling defined by the product contract.
- Applicable pre-confirmation fields can be safely entered, edited, reset, and removed, with invalid orders blocked before confirmation.
- Confirmation creates correct immutable snapshots and exactly one appropriate downstream request when work is required.
- Work assignment and progress remain authoritative in the owning work screen and accurately read back into chart `상태` and `담당자`.
- Return, correction, reconfirmation, result-preserving re-request, cancellation, and request-cycle history behave according to contract.
- Only confirmed eligible orders can be billed, billing calculations and set ownership are correct, and retry cannot double bill.
- Permissions, workspace isolation, audit history, money integrity, migration behavior, and rollback checks pass for the affected scope.
- Required documentation, focused tests, broad candidate checks, and secret checks pass for the exact released candidate.
- The approved PR is merged, the merge is proven on `origin/main`, and production deployment is proven to use the intended source SHA.
- The production route and authenticated scoped workflow smoke pass, or the approved rollback is completed and reported.
- Remaining limitations and follow-up work are recorded without being presented as completed behavior.

## Source Documents

- [Plan/Order `전체` Tab Legacy Column Contract](../domain/plan-order-all-tab-legacy-column-contract.md)
- [Workspace Order Catalog Platform](../domain/workspace-order-catalog-platform.md)
- [Order Fulfillment Handoff Product Contract](../domain/order-fulfillment-handoff.md)
- [Order Fulfillment Handoff Engineering Contract](../../engineering/data-model/order-fulfillment-handoff-contract.md)
- [MVP Current Status](../../engineering/current-status.md)
- [Coding Discipline](../../_meta/coding-discipline.md)
- [Release Environment Policy](../../engineering/operations/release-environment-policy.md)
- [Manual Merge Gate Runbook](../../engineering/operations/manual-merge-gate-runbook.md)
- [Production Release From `staging` To `main` Runbook](../../engineering/operations/production-release-staging-to-main-runbook.md)
