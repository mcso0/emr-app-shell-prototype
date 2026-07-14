---
type: "Design Spec"
title: "Reception creation vital add dropdown"
description: "Defines the dropdown and inline-row UX for adding optional vitals during reception or reservation creation."
tags: [reception, reservation, vitals, dropdown, side-panel]
status: draft
area: reception
updated: 2026-07-14
---

# Reception Creation Vital Add Dropdown

## Decision

Use a single-select anchored dropdown. `체중` remains the default visible vital. Selecting an available option immediately closes the dropdown and inserts a new input row above the `바이탈 추가` trigger.

## Goal

Let reception staff add only the vital fields needed for the current reception or reservation without making the narrow creation panel permanently dense.

## Options

| Vital | Unit | Default state |
| --- | --- | --- |
| 체중 | kg | Always visible |
| 체온 | °C | Optional |
| 호흡 | rpm | Optional |
| 혈압 | mmHg | Optional |

`심박수` is not part of this planning slice.

## Interaction Contract

1. `바이탈 추가` opens a dropdown anchored to the full-width trigger.
2. The dropdown lists only optional vitals that are not currently present.
3. Selecting an option closes the dropdown, inserts its row below the existing vital rows, and moves focus to the new input.
4. Added rows keep their selection order.
5. Each optional row has a clearly labelled remove action.
6. Removing a row returns its option to the dropdown.
7. When every optional vital is present, the add trigger is hidden.
8. If a row is removed, the add trigger returns below the remaining rows.
9. New vital fields start empty. The UI must not insert synthetic normal values.

## Dropdown Design

- Width follows the trigger width.
- Each option shows a domain icon, Korean label, and unit.
- One click adds one row; no checkbox or separate apply action.
- `Escape` and outside click close the dropdown without changing fields.
- Keyboard focus enters the first option when opened and returns to the trigger when dismissed.

## Input And Validation States

- Added values are optional until the product data contract says otherwise.
- Numeric fields use decimal-friendly input behavior.
- Invalid values use field-level feedback; unrelated form submission should not silently erase entered values.
- Units are fixed suffixes and are not editable.
- The mockup demonstrates interaction only and does not define DB/API persistence.

## Accessibility

- Trigger exposes `aria-expanded` and `aria-controls`.
- Dropdown uses menu semantics and options are keyboard reachable.
- Remove buttons include the vital name, such as `체온 삭제`.
- Addition and removal are announced through an `aria-live` status region.

## Out Of Scope

- Patient vital-history persistence and measurement timestamps.
- Encounter or appointment DB/API changes.
- Normal-range alerts or clinical validation thresholds.
- Changes to the production reception module.

## Review Artifact

- `docs/design/screens/reception/planning/reception-vital-add-dropdown-prototype.html`

