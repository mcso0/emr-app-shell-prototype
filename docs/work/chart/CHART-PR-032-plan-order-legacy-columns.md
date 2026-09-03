---
id: "CHART-PR-032"
type: "Work Item"
title: "Plan/Order Exact Legacy Columns"
description: "Replaces the dynamic union matrix with the approved fixed 25-column projection after authoritative lifecycle and billing data are available."
status: "completed"
area: "chart"
priority: "P0"
tags: [chart, plan-order, table, legacy-columns]
target_pr: "GitHub PR #698"
source_docs:
  - "docs/product/domain/plan-order-all-tab-legacy-column-contract.md"
  - "docs/work/chart/CHART-PR-031-plan-order-legacy-column-validation.md"
  - "docs/completed/chart/2026-09-03-plan-order-legacy-workflow-report.html"
dependencies:
  - "CLINICAL-MASTER-PR-023"
  - "CLINICAL-FULFILLMENT-PR-010"
  - "CLINICAL-BILLING-PR-023"
updated: "2026-09-03"
---

# Plan/Order Exact Legacy Columns

## Goal

Render the exact approved 25 named columns in the current Plan/Order `전체`
table system with durable inputs, derived values, blank/error states, and
authoritative work/billing readback.

## Scope

- Preserve the unlabeled selection control and trailing row-action control.
- Render exactly: `분류`, `상태`, `Order 명`, `청구서명`, `청구반영`, `일수`,
  `횟수`, `총횟수`, `head/kg당`, `1회당`, `성분량`, `조제량`, `실조제량`,
  `보관`, `투여/복약`, `담당자`, `단가`, `수량`, `합계`,
  `할인할증(금액)`, `(%)`, `청구금액`, `사유`, `과세`, `수의사`.
- Remove the dynamic union projection and keep non-applicable cells blank.
- Localize raw enum values and resolve staff IDs to minimal avatar/name DTOs.
- Implement pre-confirm inputs, calculation explanation, actual-dispense
  override/reset/reconfirmation states, assignee selector, and billing editors
  only where the authoritative APIs permit them.
- Preserve current table chrome, density, scrolling, sorting, selection,
  category tabs, toolbar, footer, dialogs, and row actions.

## Out Of Scope

- A visual redesign or new table abstraction.
- Client-owned clinical, permission, work-state, or billing authority.
- Inventing display fallbacks that disguise missing configuration as zero.

## Done When

- The exact named header sequence is covered by a focused test and no removed or
  dynamic legacy header is visible in `전체`.
- Every order type renders the approved applicable, blank, unavailable, and
  historical `미기록` states.
- Draft reload, reset, copy, set reapply, confirm, downstream readback,
  correction/reconfirm, cancellation, and billing lock work across routes.
- Authenticated desktop-width browser smoke proves the complete target flow on
  synthetic data without raw enum or UUID leakage.

## Verification

- Exact column-order and cell contract tests.
- Chart server/API/UI and cross-route fulfillment/billing E2E regressions.
- TypeScript, focused lint, production build, docs check, secret scan, and diff
  check.
- Authenticated preview smoke before production candidate approval.

## Delivery Completion — 2026-09-03

- The fixed 25-column `전체` projection, applicable/blank/historical display
  states, assignee controls, actual-dispense controls, pre-billing editors, and
  scoped downstream navigation are implemented on the candidate branch.
- Focused chart UI regression passed `73/73`; the broader changed/new
  Plan/Order server, API, domain, fulfillment, billing, and catalog suite passed
  `238/238`.
- TypeScript, repository lint, production build, diff check, and the local SQL
  migration/smoke transaction with unconditional rollback passed.
- PR #698's exact staging project replay exposed and repaired two
  legacy Task metadata shapes, then passed the full migration/smoke transaction
  with unconditional rollback and zero schema, fixture, or history residue.
- 승욱 approved the exact candidate and persistent migration. Supabase applied
  migration `20260903003949_plan_order_work_lifecycle_and_rpc_boundary`; the
  post-apply readback found zero lifecycle-shape violations, all 14 target
  constraints validated, RLS enabled on all four new authority tables, and the
  five target `SECURITY DEFINER` RPCs restricted to `authenticated` callers.
- The migration filename matches the history version assigned by Supabase; its
  SQL SHA-256 remained unchanged.
- PR #698 merged as `f86ff1c31c6c288b5ba9697e5ad3902bd17f48ee`.
  Production deployment `dpl_BekLknn1zHvZexMs2eniy4aSz5fG` is `Ready` and
  owns the production alias.
- Authenticated production smoke confirmed the exact 25 business-header order,
  with zero raw UUID/enum exposure, Next error overlays, or console errors.

## Handoff Notes

Implement this after the three data-authority prerequisites. A header-first
change would expose misleading values and is not acceptable.
