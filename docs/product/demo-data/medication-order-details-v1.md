---
title: "Medication Order Details V1"
status: "draft"
updated: "2026-05-19"
owner: "product"
source_issue: "DEN-99"
---

# Medication Order Details V1

Medication order details are synthetic workflow metadata for the portfolio demo. They are not dosage guidance, drug safety rules, or clinical recommendations.

## Why This Is Separate From The Basic Order Catalog

Basic order catalog rows explain how an order is selected, displayed, billed, and routed. Medication, injection, controlled-drug, and dispensing orders need extra fields because the chart may change days, frequency, route, and quantity before sending work to dispensing or treatment.

This document defines product-data shape only. It must not be used as medical advice.

## Medication Detail Drawer Contract

| Field | Demo Meaning | Example |
| --- | --- | --- |
| `isMedication` | Whether medication-specific fields are shown | `true` |
| `controlledDrugLabel` | Label for narcotic/psychotropic display when applicable | `마약`, `향정` |
| `autoDispenseQuantityEnabled` | Whether chart prescription values recalculate dispensing quantity | `true` |
| `speciesPrescriptionRules` | Species tabs and rule visibility | `dog`, `cat`, `other` |
| `administrationDays` | Number of days; natural numbers only | `3` |
| `dailyFrequencyCode` | Frequency shorthand | `sid`, `bid`, `tid`, `qid`, `q12h` |
| `frequencyDailyCount` | Numeric count used by synthetic total-count calculation | `2` |
| `doseBasis` | Whether quantity is based on kg, head, ingredient amount, total amount, or pill count | `kg`, `head`, `ingredient_amount`, `total_amount`, `prescribed_quantity` |
| `doseAmount` | Numeric prescription basis value | `1` |
| `doseAmountUnit` | Unit displayed with dose amount | `EA`, `mg`, `mL` |
| `administrationRoute` | Route shown in prescription rule | `PO`, `IV`, `CRI`, `SC` |
| `dispenseUnit` | Unit used for actual dispensing quantity | `EA`, `T`, `mL` |
| `dispenseUnitDisplay` | Read-only display when a dispense unit is selected | `T` |
| `dispenseRoundingRule` | How actual dispensing quantity is rounded | `as_is`, `ceil`, `floor`, `round`, `ceil_0_25`, `floor_0_25`, `ceil_0_5`, `floor_0_5` |
| `medicationInstruction` | Default owner-facing administration guide | `식후` |
| `storageMethod` | Storage method display | `room_temp`, `refrigerated`, `frozen` |
| `ingredientKoreanName` | Korean ingredient or product label | 구충제/경구제 |
| `ingredientEnglishName` | English ingredient or product label | Anthelmintic/Oral Medicine |
| `prescriptionPurpose` | Demo-purpose label for why this medication appears | 항바이러스제 |
| `ingredientAmount` | Numeric active ingredient amount | `7.5` |
| `ingredientUnit` | Display unit for ingredient amount | `mg` |
| `totalAmount` | Numeric total content amount | `5000.0` |
| `totalAmountUnit` | Display unit for total amount | `g` |
| `packageUnitDisplay` | How package unit appears in inventory/dispensing | `튜브`, `정`, `캡슐`, `앰플`, `바이알`, `병`, `개`, `포` |
| `dispenseQuantitySource` | Calculation source for planned dispensing quantity | `days_frequency`, `preset_base_quantity`, `manual` |

## Frequency Codes

| Code | Display Meaning |
| --- | --- |
| `sid` | 1일에 1번 |
| `bid` | 1일에 2번 |
| `tid` | 1일에 3번 |
| `qid` | 1일에 4번 |
| `eod` | 2일에 1번 |
| `q3d` | 3일에 1번 |
| `q4d` | 4일에 1번 |
| `q5d` | 5일에 1번 |
| `q6d` | 6일에 1번 |
| `q7d` | 7일에 1번 |
| `q14d` | 14일에 1번 |
| `q21d` | 21일에 1번 |
| `q30d` | 30일에 1번 |
| `q4h` | 4시간에 1번 |
| `q6h` | 6시간에 1번 |
| `q8h` | 8시간에 1번 |
| `q12h` | 12시간에 1번 |

Supported aliases:

| Alias | Canonical Code | Meaning |
| --- | --- | --- |
| `e3d` | `q3d` | 3일에 1번 |
| `e4d` | `q4d` | 4일에 1번 |
| `e5d` | `q5d` | 5일에 1번 |

## Unit Display Rules

Medication package/unit display can use compact symbols in order and dispensing UIs.

| Source Unit | Display |
| --- | --- |
| 정 | T |
| 캡슐 | C |
| 앰플 | A |
| 바이알 | V |
| 병, 백, 통 | B |
| 튜브, 개, 매, 포 | 개 |
| 관 | 개 or V, depending on product master setting |
| mL당 | mL |
| kg당, kg별, Order당 | 건 |

## Storage, Route, And Instruction Values

Keep these as controlled demo values so fixtures can render consistent rows.

| Data Group | Values |
| --- | --- |
| `storageMethod` | `room_temp`, `room_temp_light_protected`, `refrigerated`, `refrigerated_light_protected` |
| `administrationRoute` | `PO`, `IV`, `CRI`, `SC` |
| `medicationInstruction` | `after_meal`, `before_meal`, `with_meal`, `any_time` |

## Sales And Tax Rules

- Sales amount defaults to `0` before the admin enters a value.
- Sales amount accepts natural numbers only in the admin preset workflow.
- Sales unit can be shown as daily, per frequency, per mL, per each, per order, or per kg depending on the product base unit.
- Tax checked means VAT is included in the sales amount.
- Tax unchecked means VAT is not included in the sales amount.
- Rounding options are workflow examples only and do not define medical safety.

## Auto Dispense Quantity Rules

When `autoDispenseQuantityEnabled` is on, chart changes to days, frequency, or prescription quantity can recalculate dispensing quantity for the workflow demo.

When it is off:

- The order does not provide an automatic dispense quantity.
- Changing days, frequency, or prescription quantity does not change actual dispensing quantity.

Quantity display should allow up to three decimal places. If a user enters more than the allowed precision, the UI should show an error and keep the saved master data readable.

Synthetic calculation fields:

| Field | Data Rule |
| --- | --- |
| `frequencyDailyCount` | Numeric interpretation of the selected frequency code |
| `totalCount` | `administrationDays * frequencyDailyCount` for portfolio fixtures |
| `plannedDoseQuantity` | Stored numeric source before rounding or manual edit |
| `dispenseQuantity` | Planned amount derived from the selected dispense source |
| `actualDispenseQuantity` | Final amount after rounding or manual override |
| `actualDispenseQuantitySource` | `auto_calculated`, `rounded`, or `manual` |
| `dispenseRoundingRule` | Copied from the preset snapshot so chart edits remain reproducible |

These formulas are workflow math only. They do not validate whether a medication choice, amount, route, or duration is clinically appropriate.

## Species Rule Tabs

Medication detail settings may show separate prescription-rule tabs for `dog`, `cat`, and `other`. The visible tabs should follow the order target species selected in the basic order detail.

| Target Species On Order | Visible Prescription Tabs |
| --- | --- |
| dog | 개 |
| cat | 고양이 |
| other | 기타 |
| dog,cat,other | 개, 고양이, 기타 |

## Out Of Scope For V1

- Dose safety engine.
- Drug interaction checks.
- Real controlled-substance compliance.
- Real medication inventory integration.
- Real prescription label printing.
- Species, age, weight, or disease-specific clinical recommendations.

## Deferred Screen-Implementation Notes

- Species tab layout, validation message copy, route dropdown grouping, and disabled-field behavior should be specified with the medication detail screen.
- Prescription-label printing and inventory deductions are future product areas, not required for this portfolio seed contract.
