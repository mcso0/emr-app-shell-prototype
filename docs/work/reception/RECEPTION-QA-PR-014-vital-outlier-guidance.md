---
id: "RECEPTION-QA-PR-014"
type: "Work Item"
title: "Walk-in reception vital outlier guidance"
description: "Separate blocking vital errors from review-only outlier warnings and preserve drafts after server failures."
status: "human_review"
area: "reception"
priority: "P1"
tags:
  - "reception"
  - "walk-in"
  - "vitals"
  - "validation"
  - "accessibility"
target_pr: "User-approved vital validation cases prototype"
source_docs:
  - "docs/product/features/hospital-admin/workspace-vital-settings.md"
dependencies:
  - "RECEPTION-QA-PR-013"
updated: "2026-09-14"
---

# Walk-In Reception Vital Outlier Guidance

## Goal

Explain every non-saving vital state, while allowing a user to keep a clinically
possible but highly unusual positive measurement after reviewing it.

## Scope

- Keep empty optional measurements neutral.
- Block malformed, non-positive, unsupported-precision, storage-overflow, and
  invalid blood-pressure relationship values with linked field errors.
- Show non-blocking warnings for broad dog/cat plausibility outliers and large
  differences from the patient's prior weight.
- Change the available create action to `확인하고 생성` while warnings exist.
- Map server-returned vital field errors back to the matching input, preserve
  the draft, and clear each server error when that field changes.
- Preserve the draft and explain retry after an unknown creation failure.
- Add focused browser and server regression coverage.

## Out Of Scope

- Diagnosis, severity classification, or advice about treatment urgency.
- Breed-, age-, stress-, anesthesia-, or inpatient-specific clinical rules.
- Workspace-configurable alert thresholds, schema changes, or new dependencies.
- Reservation vital capture and historical vital editing.

## Done When

- A blocking vital error explains the correction and prevents creation.
- A broad dog/cat outlier shows a unit or measurement warning without
  `aria-invalid`, and `확인하고 생성` submits the value unchanged.
- Storage overflow and invalid blood-pressure relationships are rejected by
  both client and server validation.
- Server vital field errors are attached to their input and clear on edit.
- Focused browser/server tests, TypeScript, lint, copy/docs checks, and diff
  hygiene pass.

## Evidence Basis

- Merck Veterinary Manual dog physiological values and MSD Veterinary Manual
  dog/cat rectal-temperature ranges were used only to place the product
  guardrails far outside ordinary reference ranges.
- The guardrails are deliberately non-blocking and are not clinical reference
  ranges.

## Verification Evidence

- Case matrix:
  1. Blank optional values stay neutral and create without a measurement.
  2. Non-numeric text stays visible and receives `숫자로 입력해 주세요.`.
  3. Zero and negative values receive `0보다 크게 입력해 주세요.`.
  4. Weight and temperature precision violations receive field-level guidance.
  5. Heart and respiratory rates require integers.
  6. Diastolic-only pressure asks for systolic first.
  7. Diastolic pressure greater than or equal to systolic is blocked.
  8. Canonical numeric and PostgreSQL integer storage overflow is blocked.
  9. Broad dog/cat outliers show a non-blocking warning.
  10. Large prior-weight differences include a unit check.
  11. Server vital field errors link back to the matching input and clear on edit.
  12. Unknown creation failures preserve the draft and explain retry.
- Focused browser coverage: 4 passed for optional empty values, blocking errors,
  outlier confirmation, server field-error recovery, and retry preservation.
- Walk-in server coverage: 15 passed, including storage limits and blood-pressure
  ordering.
- TypeScript, focused ESLint, Korean UX copy, docs links, and diff hygiene: passed.
- Production build: passed with the existing broad docs-tracing warning from
  `src/lib/prd-viewer/doc-reader.ts`.

## Release Boundary

This work item covers local implementation and verification only. Commit, PR,
merge, and deployment require a separate user request.
