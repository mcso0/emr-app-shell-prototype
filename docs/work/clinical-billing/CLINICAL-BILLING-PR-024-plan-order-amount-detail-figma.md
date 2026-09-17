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
updated: "2026-09-17"
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
- Show discount and surcharge values with the Red/600 semantic token. Show the
  surcharge as an effective percentage plus its KRW amount.
- Use `EmrEmptyState` for a chart with no orders and for initial read failure or
  pending states.
- Remove explanatory and implementation-oriented helper copy from the default
  drawer view.
- Keep drawer geometry and adjustment color behind feature semantic tokens;
  reuse shared Card, Button, typography, spacing, border, radius, and shadow
  contracts.

## Boundaries

- No API, billing arithmetic, persistence, permission, RLS, or invoice behavior
  changes.
- The supplied Figma file contains the Plan/Order screen but no separately
  addressable amount-detail drawer node. The explicit attached amount-composition
  visual and existing CDS.V2 component/token contracts are the implementation
  source for this slice.

## Verification

- Focused browser coverage for title/section order, Red/600 adjustment values,
  percentage-plus-amount display, non-modal behavior, and shared drawer empty
  state.
- Source contract coverage prevents a return to the prior literal drawer width
  and verifies the feature semantic token mapping.
- TypeScript, lint, build, docs, secret scan, and diff checks before delivery.

## Local Implementation Checkpoint — 2026-09-17

- The normal drawer, adjustment card, shared no-order Empty State, and existing
  non-modal selection behavior passed six focused Chromium regressions.
- A 1440x900 local mock-auth visual check confirmed the compact drawer title,
  section order, fixed footer, scroll containment, and Red/600 adjustment rows.
- TypeScript, focused and repository lint, production build, docs links, secret
  scan, and diff whitespace passed. Repository lint retains five pre-existing
  unused-variable warnings in WP10 scripts and no errors; the build retains the
  existing broad NFT trace warning for the docs reader.
