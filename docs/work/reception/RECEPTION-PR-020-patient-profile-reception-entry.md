---
id: "RECEPTION-PR-020"
type: "Work Item"
title: "Patient-profile reception and reservation entry"
description: "Start an existing reception or reservation flow from a patient profile without leaving the current workspace module."
status: "implemented"
area: "reception"
priority: "P0"
tags:
  - "reception"
  - "patient-profile"
  - "right-panel"
source_docs:
  - "docs/product/features/reception-appointment-spec.md"
dependencies:
  - "RECEPTION-LIVE-PR-004"
  - "RECEPTION-LIVE-PR-006"
updated: "2026-09-20"
---

# Patient-Profile Reception And Reservation Entry

## Goal

Let staff begin a walk-in reception or reservation from the patient profile
while preserving the current module, patient context, and right-panel task
position.

## Scope

- Replace the patient-profile `접수/예약` action with a patient-only menu for
  `접수하기` and `예약하기`.
- Reuse the existing live reception and reservation forms in the workspace
  right-panel slot, preselected with the patient and primary guardian.
- Return a clean cancellation to the same patient profile tab.
- Confirm before discarding edited form content and retain the draft when the
  employee chooses to continue.
- Show the created reception or reservation detail in the same panel after a
  successful write; preserve the form and draft after a failed write.
- Keep profile-origin panel state transient so it does not replace the
  URL-owned patient drawer or force module navigation.

## Out Of Scope

- A new API, database, RLS, permission, or patient/guardian data contract.
- Calendar-slot round trips or a new scheduling surface.
- Duplicate-reception warnings and persistent notification follow-ups.
- Changing the global command palette or reception-module entry semantics.

## Done When

- Both menu choices open the expected preselected existing form in the same
  right-panel slot without changing the module route.
- Clean and dirty cancellation return behavior matches the profile-origin
  contract.
- Success and failure preserve the expected detail or draft state.
- Guardian profiles do not expose the patient-only reception menu.
- Focused Playwright coverage, relevant regressions, lint, typecheck, build,
  docs, and secret gates pass for the exact release candidate.

## Verification

- `npx playwright test tests/patient-profile-reception-entry.spec.ts --project=chromium` — 8 passed.
- Focused app-shell, customer-profile, and existing reservation-creation
  regression checks — 3 passed.
- Local browser review — dropdown choices, same-slot form replacement,
  patient/guardian preselection, current-module URL retention, and the dirty
  header-close guard were verified; no browser warning or error was recorded.
- `npm run lint`, `npx tsc --noEmit --pretty false`, `npm run build`,
  `npm run docs:check`, `npm run security:secrets`, and `git diff --check` —
  passed. Lint retains five unrelated existing warnings, and the build retains
  the existing project-wide NFT trace warning.
- Release Check, preview, staging, and production evidence are recorded against
  the exact committed candidate.
