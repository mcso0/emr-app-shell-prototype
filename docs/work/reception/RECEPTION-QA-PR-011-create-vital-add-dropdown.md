---
id: "RECEPTION-QA-PR-011"
type: "Work Item"
title: "Reception creation vital add dropdown"
description: "Implement the approved add, remove, and restore interaction for optional vital rows in walk-in and reservation creation."
status: "in_progress"
area: "reception"
priority: "P1"
tags:
  - "reception"
  - "reservation"
  - "vitals"
  - "dropdown"
target_pr: "Approved reception vital dropdown prototype"
source_docs:
  - "docs/superpowers/specs/2026-07-14-reception-vital-add-dropdown-design.md"
  - "docs/design/screens/reception/planning/reception-vital-add-dropdown-prototype.html"
dependencies:
  - "RECEPTION-QA-PR-003"
  - "RECEPTION-QA-PR-004"
updated: "2026-07-14"
---

# Reception Creation Vital Add Dropdown

## User Request Understanding

The existing `바이탈 추가` action in reception and reservation creation is a follow-up placeholder. Replace it with the approved dropdown and inline-row interaction from the reviewed wireframe.

## Scope

- Apply one shared interaction to walk-in reception creation and reservation creation.
- Keep `체중` as the initial row.
- Offer `체중 kg`, `체온 °C`, `호흡 rpm`, and `혈압 mmHg` in the creation flow.
- Add one selected option as a new row, preserve selection order, and focus the new input.
- Keep `10px` spacing between rows.
- Allow every row to be removed when at least two rows exist.
- Hide all remove actions when only one row remains.
- Return removed options to the dropdown and restore their current draft value when re-added.
- Hide `바이탈 추가` when all four rows are present.
- Use CLAiR Neutral/50 for dropdown icon tiles.
- Preserve the current patient-weight validation and submission path.

## Out Of Scope

- Adding temperature, respiration, or blood-pressure fields to create API payloads.
- Supabase schema, migration, RLS, or remote persistence changes.
- Clinical thresholds, normal-range warnings, measurement timestamps, or vital history.
- Adding `심박수` to this creation flow.
- Changing the existing detail/edit vital interaction.

## Done When

- Both creation surfaces use the same component and interaction rules.
- The approved add, remove, one-row minimum, value restoration, spacing, unit, and icon-tile rules pass focused browser tests.
- Removing weight prevents a stale weight value from being submitted; re-adding weight restores the current draft.
- Existing patient selection, weight validation, and create submission behavior does not regress.
- Documentation clearly distinguishes implemented UI behavior from non-weight persistence that remains out of scope.

## Verification

- Implementation pending.

