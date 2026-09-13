---
id: "RECEPTION-QA-PR-013"
type: "Work Item"
title: "Walk-in reception vital validation feedback"
description: "Preserve optional vital input and explain invalid values without treating empty fields as errors."
status: "human_review"
area: "reception"
priority: "P1"
tags:
  - "reception"
  - "walk-in"
  - "vitals"
  - "validation"
  - "accessibility"
target_pr: "User-approved reception vital validation UX"
source_docs:
  - "docs/product/features/hospital-admin/workspace-vital-settings.md"
dependencies:
  - "RECEPTION-QA-PR-011"
updated: "2026-09-13"
---

# Walk-In Reception Vital Validation Feedback

## Goal

Make optional walk-in vital entry understandable and recoverable when a user
types an invalid value, while keeping every empty vital field neutral.

## Scope

- Preserve the raw text entered into each vital field instead of silently
  deleting or rewriting unsupported characters.
- Keep blank optional vital fields free of error borders, messages, and
  `aria-invalid` state.
- Show concise inline errors after blur or a create attempt, then update the
  visible validation as the user edits or clears the field.
- Keep systolic-only blood pressure valid and explain diastolic-only entry on
  the diastolic field.
- Replace verbose placeholders with measurement-oriented prompts while keeping
  `수축기` and `이완기` for blood pressure.
- Keep the create action visually disabled when required reception data is
  missing or a non-empty vital is invalid, with the single mouse and keyboard
  tooltip `필수 입력 정보를 확인해주세요` for input-related blocking.
- Add focused browser regression coverage for neutral empty state, preserved
  invalid values, precision and integer errors, blood-pressure pairing,
  tooltip access, and a valid nested vital submission.

## Out Of Scope

- Clinical normal ranges, species-aware outlier warnings, or maximum values.
- Changes to the walk-in API, Supabase schema, RLS, or persistence contract.
- Reservation vital capture, vital-history editing, or new dependencies.

## Done When

- Empty vital fields remain optional and visually neutral.
- Invalid non-empty values remain visible and receive a linked concise error.
- Clearing an invalid field returns it to neutral state.
- Systolic-only submission succeeds; diastolic-only entry is blocked with the
  agreed message.
- The create-button tooltip appears on pointer hover and keyboard focus only
  for input-related blocking.
- Focused reception tests, lint, TypeScript, production build, docs checks, and
  the exact-candidate Release Check pass before Production approval.

## Verification Evidence

- Focused walk-in vital browser coverage: 3 passed, including optional empty
  submission, configured nested measurement submission, and the new validation
  and tooltip regression.
- Reception vital and walk-in server/migration coverage: 23 passed.
- `npx eslint src/features/reception/module.tsx tests/reception.spec.ts`: passed.
- `npx tsc --noEmit --pretty false`: passed.
- `npm run lint`: passed with five pre-existing unused-variable warnings in
  unrelated WP10 helper scripts and zero errors.
- `npm run build`: passed with the existing broad docs tracing warning.
- `npm run docs:check`, `npm run security:secrets`,
  `npm run ux-copy:check`, and `git diff --check`: passed.
- Exact PR preview, Release Check, and Production deployment evidence remain at
  the release gate.

## Release Gate

Production follows the current PR-preview workflow: create the exact PR head,
verify its Ready preview and manual Release Check, then obtain explicit approval
for that exact PR and SHA before merging to `main` and verifying the resulting
Production deployment.
