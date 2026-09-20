---
type: "screen-spec"
title: "Plan/Order table unit display abbreviations"
description: "Display-only unit abbreviation, casing, fallback, and TDD contract for Plan/Order table value cells."
tags: ["chart", "plan-order", "units", "medication-safety", "tdd"]
status: "approved"
related_work:
  - "CHART-PR-038"
last_updated: "2026-09-20"
---

# Plan/Order Table Unit Display Abbreviations

## Decision

Plan/Order table value cells use compact unit labels. This is a presentation-only
contract: stored domain values, API payloads, snapshots, calculation inputs and
outputs, validation, billing units, prescription text, labels, guardian guidance,
and downstream records keep their current values and semantics.

Use SI/UCUM casing for measurement units, FDA dosage-form codes where an exact
code exists, and an explicitly approved CLAiR table-only extension where no exact
code exists. `PIP` is the approved CLAiR display code for `pipette`.

Research basis:

- [FDA Potency terminology](https://www.fda.gov/drugs/data-standards-manual-monographs/potency)
- [FDA Units of Measure](https://www.fda.gov/industry/structured-product-labeling-resources/units-measure)
- [NIST SI unit style](https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-6-rules-and-style-conventions-printing-and-using)
- [UCUM specification](https://unitsofmeasure.org/ucum)
- [ISMP safe electronic medication communication](https://www.ismp.org/system/files/resources/2019-03/Electronic-Guidelines-2019.pdf)
- [VMD veterinary product label example using the full word pipette](https://www.vmd.defra.gov.uk/productinformationdatabase/files/QRD_Documents/QRD-Auth_2485741.PDF)

## Approved Table Mapping

| Stored or incoming value | Plan/Order table display | Authority | Notes |
| --- | --- | --- | --- |
| `mg` | `mg` | SI/UCUM | Do not use `MG` or `Mg`. |
| `mg/kg` | `mg/kg` | UCUM | Preserve the slash and case. |
| `ml`, `mL` | `mL` | SI/UCUM | Do not use `ml`, `Ml`, or `ML`. |
| `ml/kg`, `mL/kg` | `mL/kg` | UCUM | Lowercase `m`, uppercase `L`. |
| `g` | `g` | SI/UCUM | Do not use `G` or `GM` in the table. |
| `kg` | `kg` | SI/UCUM | Do not use `Kg` or `KG`. |
| `tablet`, legacy `T` | `TAB` | FDA | Compact dosage-form code. |
| `capsule` | `CAP` | FDA | Compact dosage-form code. |
| `drop` | `DROPS` | FDA | Prefer this to an ambiguous Latin abbreviation. |
| `spray` | `SPRAY` | FDA | The FDA code is already compact. |
| `pipette` | `PIP` | CLAiR extension | Approved for this internal table; not an FDA/VMD standard code. |
| `application` | `APPL` | CLAiR extension | Do not use `AP`; FDA uses `AP` for `APPLICATOR`. |
| `vial` | `VIAL` | FDA | Supported when present in table data. |
| `sachet` | `PKT` | Conditional FDA mapping | Use only when the domain meaning is equivalent to `PACKET`. |
| `bottle` | `BOT` | FDA | Supported when present in table data. |
| `applicator` | `AP` | FDA | Keep distinct from `application`. |
| `syringe` | `SYR` | FDA | Supported when present in table data. |
| `tube` | `TUBE` | FDA | Supported when present in table data. |

## Formatting Rules

- Keep one space between a number and its unit: `5 mL`, `0.25 TAB`, `1 PIP`.
- Unit symbols and display codes do not take a plural suffix or terminal period.
- SI/UCUM casing is semantic and must be preserved: `kg`, `mg`, `mL`, not title
  case or all uppercase.
- FDA dosage-form codes and approved CLAiR extensions use uppercase.
- Do not alter numbers, precision, calculation scope markers, or unavailable
  states while replacing the unit token.
- Unknown non-empty values remain visible as their trimmed original text. Do not
  invent a new abbreviation, hide the value, or fail the row because the table
  does not recognize a unit.
- Full medication orders, external prescriptions, product labels, and guardian
  instructions remain outside this compact-display contract and should retain
  their established full wording and medication-safety rules.

Examples:

| Before | Table display |
| --- | --- |
| `0.2 ml` | `0.2 mL` |
| `1 tablet` | `1 TAB` |
| `0.25 tablet` | `0.25 TAB` |
| `1 capsule` | `1 CAP` |
| `1 pipette` | `1 PIP` |
| `1 application` | `1 APPL` |
| `2 mg/kg` | `2 mg/kg` |

## Inspected Code Ownership

The current Plan/Order table constructs display strings directly in
`src/features/chart/module.tsx`:

- `dosePerAdministration` combines `detailInputs.dose` and
  `detailInputs.doseUnit` for `1회당`.
- `getChartOrderIngredientStrength` combines product-strength numerator and
  denominator units for `성분량`.
- `getChartOrderCalculatedDispense` combines calculated quantity and
  `planOrderAuthority.dispenseUnit` for `조제량`.
- `getChartOrderActualDispense` and `ChartOrderActualDispenseCell` also compose
  quantity/unit strings for the historical or conditionally visible preparation
  quantity cell.

The values originate from `order-execution-domain.ts`, persisted defaults,
applied snapshots, and calculation outputs. Those sources are not display owners
and must not be rewritten for this change.

`src/features/chart/chart-order-table-presentation.ts` already owns pure table
presentation derivation and has a focused test file. It is therefore the intended
owner for one small exported unit-display formatter and its mapping table.

## TDD Implementation Plan

### 1. RED: pure presentation contract

Extend `tests/chart-order-table-presentation.spec.ts` before implementation.

- Table-drive every approved mapping, including the `ml`/`mL` and `ml/kg`/`mL/kg`
  aliases.
- Assert exact case for `kg`, `mg`, `mL`, `TAB`, `CAP`, `DROPS`, `PIP`, `APPL`,
  and `SPRAY`.
- Assert that null/empty input produces no unit label.
- Assert that an unknown trimmed unit is preserved verbatim.
- Assert that formatting is deterministic and does not mutate input values.

Expected first result: the focused test fails because the formatter does not yet
exist or returns raw values.

### 2. GREEN: smallest display helper

Add one pure formatter to
`src/features/chart/chart-order-table-presentation.ts`. Keep the mapping local to
Plan/Order presentation; do not change shared domain enums or introduce a new
dependency. Recognize only the approved aliases and preserve unknown values.

### 3. RED to GREEN: table integration

Apply the formatter only where `src/features/chart/module.tsx` composes table
value strings:

1. `1회당` dose unit.
2. `성분량` numerator and denominator units.
3. `조제량` dispense unit.
4. Preparation/actual-dispense table-cell text and its unit-bearing table-cell
   affordances if that column is enabled.

Add a focused browser assertion in `tests/chart-order-table-contract.spec.ts`
using the synthetic demo row. Cover at least one SI normalization and the two
local extensions, and assert that raw `tablet`, `pipette`, and `application`
tokens are not exposed in the affected cell.

### 4. Regression checks

- Run the focused pure presentation test.
- Run the focused Plan/Order table contract browser test.
- Run the existing chart table/header regression that owns the 26-column contract.
- Run TypeScript and focused lint for the touched files.
- Confirm request payloads and persisted snapshots still contain their original
  unit values; no API, DB, RPC, migration, or billing change is expected.

## Out of Scope

- Changing the unit choices or validation in `order-execution-domain.ts`.
- Rewriting Hospital Admin labels, order-master data, snapshots, or Supabase rows.
- Applying compact codes to dialogs, prescriptions, product labels, guardian
  instructions, dispensing output, or other screens.
- Inferring abbreviations for unknown units without a separately approved mapping.
