---
id: "CLINICAL-BILLING-PR-024"
type: "Work Item"
title: "Plan/Order Amount Detail Figma Alignment"
description: "Aligns the chart amount-detail drawer to the supplied Figma and CDS.V2 presentation while preserving billing data and navigation contracts."
status: "human_review"
area: "clinical-billing"
priority: "P1"
tags: [plan-order, billing, figma, empty-state, design-system]
target_pr: "Current delivery"
source_docs:
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-017-plan-order-billing-summary-handoff.md"
dependencies:
  - "CLINICAL-BILLING-PR-017"
updated: "2026-09-22"
---

# Plan/Order Amount Detail Figma Alignment

## Goal

Present the current-chart billing summary with the supplied amount-composition
spec and existing CDS.V2 components instead of the previous explanatory card.

## Scope

- Keep the existing chart-scoped billing summary, freshness, retry, and billing
  navigation behavior unchanged.
- Use the compact title `금액 상세` and order the visible sections as
  `오더 합계`, `오더 상세`, then `금액 구성`.
- Show discount with the Red/600 semantic token. Following the approved
  2026-09-22 scope, show surcharge as a positive effective percentage plus its
  KRW amount in the normal amount color.
- Use `EmrEmptyState` for a chart with no orders and for initial read failure or
  pending states.
- Remove explanatory and implementation-oriented helper copy from the default
  drawer view.
- Match Figma node `28414:124997`: 48px tokenized header, icon close action,
  16px/8px body insets, 16px card gaps, card-contained labels, status badges,
  compact amount rows, and the 52px two-action footer.
- Keep drawer geometry and adjustment color behind feature semantic tokens;
  reuse shared Card, Badge, Button, typography, spacing, border, radius, and
  shadow contracts.

## Boundaries

- No API, billing arithmetic, persistence, permission, RLS, or invoice behavior
  changes.
- The exact implementation source is CDS.V2 Figma file
  `UkfxgituFcU2rhYFriAErJ`, node `28414:124997` (`draw`). Runtime amounts and
  counts replace only the node's placeholder values.

## Verification

- Focused browser coverage for title/section order, Red/600 adjustment values,
  percentage-plus-amount display, non-modal behavior, and shared drawer empty
  state.
- Geometry coverage for the 360px drawer, 48px header, 52px footer, 16px body
  gap, 8px card radius, and 100/119/152px populated-card heights.
- Source contract coverage prevents a return to the prior literal drawer width
  and verifies the feature semantic token mapping.
- TypeScript, lint, build, docs, secret scan, and diff checks before delivery.

## Local Implementation Checkpoint — 2026-09-19

- The implementation was rechecked against exact node `28414:124997`, including
  the 360px overlay canvas, 48px header, 16px card gaps, 100/119/152px card
  heights, 52px footer, typography hierarchy, status badges, and Red/600 rows.
- The normal drawer, shared no-order Empty State, chart-scoped amount/navigation
  behavior, and existing non-modal selection behavior passed six focused
  Chromium regressions. A 1920x1080 visual check also confirmed that the fixed
  360px drawer overlays the table without shrinking into its narrower sibling
  column; shorter panels retain body-only scrolling and a fixed footer.
- TypeScript, repository lint, production build, docs links, secret scan, and
  diff whitespace passed. Repository lint retains five pre-existing
  unused-variable warnings in WP10 scripts and no errors; the build retains the
  existing broad NFT trace warning for the docs reader.


## Approved Scope Follow-up — 2026-09-22

The user approved the interactive HTML proposal and requested Sol implementation,
parent supervision, option-by-option verification, then commit/push/PR/main and
Production delivery on passing checks. This follow-up replaces the total-card
`청구 가능 오더만` badge with a shared Select:

- `전체` (default): `amounts.confirmed + amounts.draft`, with both counts.
- `확정 오더`: `amounts.confirmed` and `orderCounts.confirmed`.
- `미확정 오더`: `amounts.draft` and `orderCounts.draft`.

The total card now compares order amounts on the same basis, rather than using
`estimatedTotal` (which includes invoice adjustments and tax). Existing server
aggregation remains authoritative: confirmed includes billed orders; cancelled
and billing-excluded amounts remain excluded; counts retain their existing
root-order definition. No API, SQL, persistence, or billing-target change is in scope.

Keep both status-detail rows visible. Mark the composition card `전체 청구 기준`;
do not allocate invoice adjustments between confirmation states. Display surcharge
with a positive sign. Do not add a separate overlapping `미청구` bucket or invent
a discount reason absent from the response. Preserve the selected scope across
summary refresh and drawer reopen, and reset it on chart/context change.

Verification must cover all three totals/counts, a zero matching bucket,
context reset, keyboard selection, existing loading/error/empty states, and
independence from the billing handoff. Release checks and exact candidate evidence
are recorded in the delivery PR. Rollback baseline at intake: `origin/main`
`a94e5683d83cb2f05a2ba3c1eb47218f3cf51389`, Ready Production
`dpl_KifEJAvuzMHWbg9FRK7sJTHXucm3`. Stop on failed required checks, unrelated
candidate changes, or missing Ready Preview.

### Follow-up Local Verification

- Sol implementation and parent source/visual review completed. Six focused
  Chromium tests passed, including `39,500 / 4,500 / 35,000` mixed-scope totals,
  counts, a zero confirmed bucket, reopen retention, active-chart reset,
  focus-refresh retention, composition stability, Escape, and billing navigation.
- Existing set aggregation, empty-state, billing-only navigation, and 360px
  drawer geometry regressions passed in that focused run.
- Repository lint passed with five existing WP10 script warnings; focused lint,
  TypeScript, production build, UX copy, docs links, secret scan, and diff checks
  passed. Build retains the existing docs-reader broad NFT tracing warning.
- No remote data, schema, order status, invoice, or payment mutations are part of
  this follow-up. Production smoke will only switch the read-only amount scope.
