---
id: "CLINICAL-MASTER-PR-019"
type: "Work Item"
title: "Dispensing master defaults, Cheongdam activation, pricing, and fulfillment"
description: "Adds hospital-like editable prescription presets to all 108 dispensing masters, adopts them as effectively usable with varied prices in Cheongdam, and carries confirmed chart orders into dispensing/treatment without claiming clinical approval."
status: "in_progress"
area: "clinical-master"
priority: "P0"
tags: ["clinical-master", "dispensing", "service-review", "pricing", "synthetic-demo"]
target_pr: "Cheongdam dispensing service-review activation and pricing"
source_docs:
  - "docs/engineering/data-model/clair-clinical-master-data-target-architecture.md"
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/work/clinical-master/CLINICAL-MASTER-PR-017-evidence-grounded-dispensing-order-master.md"
  - "docs/work/clinical-master/CLINICAL-MASTER-PR-018-dispensing-service-review-visibility.md"
dependencies: ["CLINICAL-MASTER-PR-018"]
updated: "2026-08-26"
remote_writes: 22
---

# Clinical Master PR-019: Dispensing master defaults and service-review fulfillment

## Goal

Store editable hospital-like prescription presets on all 108 PR-017 dispensing
masters, make Cheongdam adopt them as `사용` with varied plausible synthetic
sales prices, and carry confirmed chart orders into dispensing/treatment while
preserving the separate clinically inactive and review-pending state.

## Scope

- Add prescription/dispensing presets to every exact master row in release
  `78a57bf0-10a8-47db-9ae1-8a8cff79b2c4`; do not make Cheongdam the source of
  those defaults.
- Target `workspace-clair-cheongdam` for service-review adoption and pricing.
- Keep every row `pending_activation` and `clinical_use_allowed = false` in the
  canonical workspace catalog. `사용` is an effective service-review state,
  not a clinical-approval label.
- Assign one deterministic workspace-owned price to each of the exact 108
  dispensing order master keys.
- Assign differentiated master defaults for dose, dose unit, route,
  frequency, duration, dispense quantity/unit, medication instruction, and
  storage using product evidence plus explicitly recorded inference rules.
- Auto-fill those master defaults when a veterinarian adds the dispensing
  Order in chart Order/Plan, then allow encounter-owned edits before
  confirmation.
- On confirmation, freeze the edited final values and create the generic Task
  plus dispensing Queue entry consumed by the dispensing/treatment surfaces.
- Base the synthetic range on Korea's 2025 public veterinary medication and
  dispensing fee figures, then vary by category, dosage form, ingredient
  count, and a small deterministic product band.
- Permit server-owned billing snapshots only when the exact service-review row
  has a non-null price and billing reflection remains enabled.
- Keep service-review read and mutation boundaries authenticated,
  workspace-scoped, permission-checked, release-pinned, and independently
  revocable.

## Explicit Non-Claims

- The values are not surveyed prices for the named products and are not a
  CLAiR suggested-price master.
- No clinical review, veterinarian eligibility, Korean regulatory approval, or
  Airtable clinical decision is created or changed.
- Synthetic master presets are not clinical dosing recommendations and cannot
  be presented as clinically approved or promoted to real-hospital operation
  without named-veterinarian review.
- No real patient, guardian, prescription, payment, or hospital operation is
  introduced.
- `clair-demo`, `workspace-clinical-master-pilot-v1`, and
  `clair-foreign-demo` pricing remain unchanged.

## Pricing Contract

- Source artifact:
  `clinical-master-pr-019/dispensing-service-review-prices.v1.json`.
- Nationwide 2025 public medians used as anchors: broad-spectrum deworming
  3,000 KRW, external-parasite prevention 16,000 KRW, and heartworm
  prevention 16,500 KRW.
- The model uses 500 KRW increments and intentionally creates multiple price
  points. Category and dosage-form adjustments make specialty oral,
  ophthalmic/otic, topical, liquid, transdermal, and spot-on products look
  distinct from ordinary tablets/capsules.
- The artifact records the exact model inputs, per-row breakdown, source
  hashes, and final entries hash so remote writes and rollback can use the same
  frozen target set.

## Prescription Preset Contract

- Official source extracts:
  `clinical-master-pr-019/dispensing-default-source-extracts.v1.json`.
  All 108 pinned VMD SPC documents yielded both a posology section and a
  storage section. The frozen entries SHA-256 is
  `37b870559234c47a4b05c241c28d4818494f94290a537347f217fc504bfbb351`.
- Final preset artifact:
  `clinical-master-pr-019/dispensing-master-presets.v1.json`, with 108 records,
  108 unique detail fingerprints, and entries SHA-256
  `f522d39ed024849549987be5768b3be7b89f0e308d4658593e2cc266cffc90ae`.
- Product identity, dosage form, route, species, and the pinned SPC text are
  direct evidence. Product-shaped dose values are synthetic inferences;
  frequency, duration, meal timing, and storage retain per-field direct or
  inferred provenance.
- `once daily` is normalized to `sid`; a true `single dose` is normalized to
  `once` with one day. The final artifact and both persistent stores contain
  zero `once` presets with a duration greater than one day.
- Every row remains `synthetic_unreviewed` and
  `clinical_use_allowed = false`. Defaults are editable encounter inputs, not
  named-veterinarian decisions.

## Remote Writes And Readback

- Supabase migrations applied to project `qmerxgzrwaaahpkhjqlc`:
  - `clinical_master_dispensing_service_review_pricing`
  - `clinical_master_dispensing_master_presets`
  - `clinical_master_dispensing_master_presets_release_index`
  - `clinical_master_dispensing_preset_frequency_normalization`
- Master readback: 108 current presets, 108 unique detail fingerprints, 108
  final artifact hashes, zero multi-day `once` rows, and zero named-vet
  approved reviews.
- Workspace projection readback: 108 rows in each of `clair-demo`,
  `workspace-clair-cheongdam`, and `workspace-clinical-master-pilot-v1`;
  all 324 carry schema-v2 default metadata. `clair-foreign-demo` remains zero.
- Cheongdam readback: 108 effective service-review usable rows, 30 distinct
  prices, 7,000 KRW minimum, 12,500 KRW median, and 28,500 KRW maximum. Exact
  artifact-to-DB comparison returned 108 expected, 108 actual, zero mismatch.
- Airtable base `applMtgWwOxwPigB8`, table `Dispensing Orders V1`: 12 explicit
  preset fields were added and all 108 rows were populated in two versioned
  passes. Final readback has 108 complete JSON presets, 108 unique content
  hashes, zero invalid JSON rows, zero multi-day `once` rows, and zero clinical
  use rows. `Clinical Reviews V1` remains 108 pending rows with zero reviewer
  IDs and zero reviewed timestamps.
- Supabase advisors report no new security finding for the preset table or
  helper functions. The release foreign key is covered; the new index is only
  reported as expected `unused_index` INFO immediately after creation.

## Application Flow Evidence

- Chart catalog snapshots now carry `defaultDetailInputs` and
  `medicationMetadata`; adding a dispensing catalog row initializes the draft
  from those values by value copy.
- Playwright proves a veterinarian sees the defaults, can edit dose and
  frequency before confirmation, and the edited draft payload retains the
  remaining preset values.
- Server-owned confirmation continues to freeze the final `detailInputs` into
  the order snapshot and route Task/Queue work to `dispensing`.
- The dispensing/treatment table now prefers live fulfillment over legacy
  fixtures and displays 1회 용량, 투여 빈도, 일수, 복용 시점, 회분, 처방 총량,
  보관 방법, and 보호자 복약지도 from the confirmed snapshot.

## Done Criteria

- The pricing artifact contains exactly 108 unique master keys, non-null
  prices, more than ten distinct price points, and a stable SHA-256.
- The prescription-default artifact and master DB contain exactly 108 unique
  master keys,
  varied product-shaped defaults, provenance and inference labels, and a stable
  SHA-256.
- Cheongdam admin readback shows exactly 108 effective service-review `사용`
  rows with the frozen prices.
- Canonical availability remains `pending_activation`; clinical use remains
  false; clinical and regulatory review records remain pending.
- A hospital admin can edit price or stop/re-enable service-review use without
  converting the row to true clinical `active`.
- A priced row produces a server-owned billable applied snapshot; an unpriced
  or revoked row fails closed.
- Chart Order/Plan auto-fills all required dispensing fields from the selected
  row, permits veterinarian edits, and freezes the edited final values through
  confirmation, Task/Queue, dispensing, and billing readback.
- Confirmed dispensing orders appear in the dispensing/treatment workflow with
  the same final values and source-master lineage; candidate-only rows create
  no Task, Queue, or billing artifact.
- Authenticated non-member, inactive member, cross-workspace, and missing
  permission paths remain denied.
- The other two allowlisted synthetic workspaces and the foreign control have
  unchanged prices and row counts.
- Focused tests, TypeScript, lint, docs check, build, PR checks, origin/main
  merge, Ready deployment, and authenticated production smoke pass.

## Rollback

1. Append a `revoked` service-review event for Cheongdam and release 13 to stop
   new service-review use immediately.
2. Reset only the frozen 108 Cheongdam prices to `NULL`, keep
   `pending_activation` and clinical-use false, and increment catalog
   revisions for audit/readback consistency.
3. Roll back the application to the immediately preceding Ready deployment.
4. Verify Cheongdam chart/admin no longer show effective service-review use,
   the two comparison workspaces remain unchanged, and the foreign control
   remains zero.

## Completion Report

- CEO-facing Korean report:
  `docs/completed/clinical-master/2026-08-26-clinical-master-pr-019-dispensing-service-review-report.html`.
- Focused release-scope Playwright: 19/19 passed. The wider related bundle
  passed 136/141; the five residual failures are the pre-existing Order Set
  autosave race and hospital-admin locator/44px-versus-56px geometry contracts,
  not the dispensing preset, service-review, or fulfillment paths changed here.
