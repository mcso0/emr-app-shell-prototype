---
id: "RECEPTION-LIVE-PR-017"
type: "Work Item"
title: "Reception encounter vital detail read"
description: "Show only the patient vital values stored for the selected reception encounter."
status: "implemented"
area: "reception"
priority: "P0"
tags:
  - "reception"
  - "vitals"
  - "supabase"
  - "detail-panel"
target_pr: "Browser comment / reception encounter vital detail"
source_docs:
  - "docs/engineering/data-model/patient-vital-measurements.md"
dependencies:
  - "RECEPTION-QA-PR-011"
  - "HOSPITAL-ADMIN-LIVE-PR-018"
updated: "2026-07-24"
---

# Reception Encounter Vital Detail Read

## Goal

Make the reception detail panel show only values stored on the selected
encounter's `patient_vital_measurements` row instead of rendering only the
patient weight compatibility snapshot.

## Scope

- Add an exact selected-encounter vital read RPC guarded by active membership
  and `reception:view`.
- Add the server route and client resource states for loading, denial, failure,
  no measurement, and success.
- Respect workspace vital visibility and display-unit settings.
- Render only non-null stored values.
- Verify the reported Cheongdam encounter and the patient's date-based history
  in the linked synthetic/demo Supabase project.

## Out Of Scope

- Changing the existing atomic walk-in write transaction.
- Editing or deleting historical measurements.
- Changing chart waiting-vital write eligibility or central audit policy.
- Backfilling, rewriting, or deleting existing measurement rows.

## Done When

- The selected encounter cannot fall through to a different visit's latest
  patient measurement.
- Weight, temperature, heart rate, respiratory rate, and blood pressure appear
  only when their stored value is present and enabled for the workspace.
- Missing values do not render placeholder fields.
- Direct table access remains closed and the new function is authenticated-only.
- Focused server and browser regression coverage passes.

## Verification

- Focused exact-read server tests: 4 passed.
- Focused reception browser test: 1 passed.
- Existing patient vital/migration baseline: 14 passed.
- TypeScript and changed-file ESLint: passed.
- Remote migrations `20260724021247_reception_encounter_vital_read` and
  `20260724023220_reception_encounter_vital_patient_link_hardening`: applied.
- Remote catalog: `SECURITY DEFINER`, stable, fixed `search_path`, anonymous
  execute denied, authenticated execute granted.
- Reported synthetic encounter: one linked 2026-07-24 measurement row with
  weight, temperature, and heart rate; absent respiratory rate and blood
  pressure remain unrendered.
- Patient history: date-grouped rows remain present across multiple visit dates;
  no remote data mutation or backfill was performed.

## Result

Implemented and ready for release verification.
