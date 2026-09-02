---
id: "CLINICAL-MASTER-PR-023"
type: "Work Item"
title: "Plan/Order Authority Enrichment"
description: "Adds explicit, fail-closed master fields needed by the legacy Plan/Order column contract without inventing clinical values."
status: "in_progress"
area: "clinical-master"
priority: "P0"
tags: [clinical-master, plan-order, dispensing, billing]
target_pr: "GitHub PR #698"
source_docs:
  - "docs/product/domain/plan-order-all-tab-legacy-column-contract.md"
  - "docs/work/chart/CHART-PR-031-plan-order-legacy-column-validation.md"
dependencies:
  - "CLINICAL-MASTER-PR-022"
updated: "2026-09-03"
---

# Plan/Order Authority Enrichment

## Goal

Add explicit authoring, publish, adoption, and runtime fields for Plan/Order
calculation, preparation, billing, tax, and set ownership while leaving every
unsupported clinical or fee value unconfigured and fail-closed.

## Scope

- Extend the Airtable schema/authoring artifacts and publisher DTO for unit,
  calculation applicability/mode, reference ingredient, strength ratio,
  conversion, fixed product quantity, preparation increment/mode/range/tolerance,
  price basis/billing unit, tax classification, and set billing ownership.
- Preserve `clinical_review_pending` and `clinical_use_allowed=false` for the
  synthetic medication corpus unless a separate clinical review approves it.
- Add validation that rejects partial, dimensionally incompatible, or
  contradictory configuration.
- Transport the exact approved fields through immutable master release,
  workspace adoption, catalog projection, applied snapshot, and semantic hash.
- Treat the blank Airtable master record as a source-data conflict; do not
  silently publish it or delete it without an explicit remote mutation step.

## Out Of Scope

- Inventing medication increments, dose ranges, tolerances, conversions,
  reference ingredients, tax law, prices, or eligible staff.
- Changing chart, fulfillment, billing, or invoice behavior.
- Remote Airtable/Supabase writes before an exact mutation packet is reviewed.

## Done When

- Every new field has one authoritative type, validator, provenance, and
  fail-closed missing state.
- Existing source-approved values map deterministically; ambiguous values stay
  null/unconfigured.
- Publisher/adopter CAS, semantic fingerprint, foreign-workspace negative
  control, rollback rehearsal, and retry idempotency pass.
- Focused fixture and contract tests cover valid, missing, incompatible, and
  contradictory configurations.

## Verification

- Focused clinical-master generator, publisher, adoption, and catalog tests.
- TypeScript, focused lint, docs check, secret scan, and diff check.
- Transactional remote rehearsal with unconditional rollback before any
  persistent mutation candidate.

## Implementation Checkpoint — 2026-09-03

- The strict nested `planOrderAuthority` type, Airtable export validation,
  publisher transport, workspace catalog projection, applied snapshot, and
  fail-closed runtime parser are implemented locally.
- Missing authority remains explicitly unconfigured; publisher and runtime
  code do not generate calculation, preparation, billing, tax, set, or staff
  policy defaults.
- Existing Airtable records still do not provide the complete approved values
  listed in the Phase A validation record. No Airtable or remote Supabase master
  write has been executed. PR #698 transports only approved values and remains
  fail-closed; persistent authoring/adoption remains open.

## Handoff Notes

The read-only Airtable baseline is recorded in
`CHART-PR-031-plan-order-legacy-column-validation.md`. Source-approved
configuration may be transported; absence is a blocking value, not an invitation
to infer one.
