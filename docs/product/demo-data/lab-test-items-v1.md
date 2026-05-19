---
title: "Lab Test Items V1"
status: "draft"
updated: "2026-05-19"
owner: "product"
source_issue: "DEN-99"
---

# Lab Test Items V1

Lab test items are synthetic result-sheet fields for the portfolio demo. They are not medical reference ranges, diagnostic rules, or clinical recommendations.

## Why This Is Separate From Orders

An order is the billable or operational request, such as CBC 검사 or 소변검사. A lab test item is one row inside the result sheet for that order, such as WBC, RBC, HGB, ALT, or pH.

Keeping them separate helps the demo explain three different layers:

1. Hospital admin manages which lab orders can be selected and billed.
2. Hospital admin manages which result items appear inside each lab result sheet.
3. Lab staff enter results using each item's input type and unit.

## Management Page Contract

The 검사 항목 page should support category grouping, item ordering, and safe deletion rules.

| Field | Demo Meaning | Example |
| --- | --- | --- |
| `categoryId` | Result item category group | `labcat-cbc` |
| `categoryName` | Visible category row label | CBC검사 |
| `categorySortOrder` | Drag-and-drop order for category groups | `10` |
| `testItemId` | Stable item identity | `labitem-cbc-wbc` |
| `testItemName` | Visible result item name | WBC |
| `resultInputType` | How staff enter the result | `number`, `text`, `select`, `positive_negative` |
| `resultUnit` | Unit shown beside entered value | `10^3/uL`, `g/dL`, `%`, `mg/dL` |
| `itemSortOrder` | Drag-and-drop order inside a category | `10` |
| `availabilityStatus` | Whether the item is used for new result sheets | `active`, `inactive` |
| `deleteLocked` | Whether deletion is blocked because the item is used by an order or prior result | `true`, `false` |
| `lockReason` | Human-readable delete restriction | Order 하위에 포함되어 삭제할 수 없음 |
| `linkedOrderCount` | Number of order presets using this item or category | `2` |
| `savedResultUsageCount` | Number of saved synthetic result rows using this item | `5` |

## Add Dialog Contract

The 검사 항목 추가 dialog should create result-sheet item metadata only. It should not create billable orders.

| Dialog Field | Required | Demo Meaning |
| --- | --- | --- |
| `categoryId` | yes | Category where the item will appear; can be 미설정 until organized |
| `testItemName` | yes | Result item label shown on the lab result sheet |
| `resultInputType` | yes | Staff input method for the result |
| `resultUnit` | no | Unit displayed with numeric or text result values |
| `defaultResultOptions` | conditional | Select choices when input type uses options |
| `sortOrder` | no | Initial display position; can later be changed by drag-and-drop |
| `availabilityStatus` | no | Defaults to active for new demo items |

## Input Types

| Input Type | Use In Demo | Example |
| --- | --- | --- |
| `number` | Numeric lab value entry | WBC, RBC, ALT, BUN |
| `text` | Free-text observation | 현미경 소견 |
| `select` | Controlled option list | 색상, 혼탁도 |
| `positive_negative` | Binary test result | 키트 양성/음성 |
| `grade` | Simple semi-quantitative result | trace, 1+, 2+, 3+ |

## Sample Categories And Items

| Category ID | Category Name | Item ID | Item Name | Input Type | Unit | Sort |
| --- | --- | --- | --- | --- | --- | ---: |
| `labcat-cbc` | CBC검사 | `labitem-cbc-wbc` | WBC | number | `10^3/uL` | 10 |
| `labcat-cbc` | CBC검사 | `labitem-cbc-rbc` | RBC | number | `10^6/uL` | 20 |
| `labcat-cbc` | CBC검사 | `labitem-cbc-hgb` | HGB | number | `g/dL` | 30 |
| `labcat-cbc` | CBC검사 | `labitem-cbc-hct` | HCT | number | `%` | 40 |
| `labcat-cbc` | CBC검사 | `labitem-cbc-plt` | PLT | number | `10^3/uL` | 50 |
| `labcat-cbc` | CBC검사 | `labitem-cbc-baso` | BASO | number | `%` | 60 |
| `labcat-chemistry` | 혈액화학검사 | `labitem-chem-alt` | ALT | number | `U/L` | 10 |
| `labcat-chemistry` | 혈액화학검사 | `labitem-chem-bun` | BUN | number | `mg/dL` | 20 |
| `labcat-chemistry` | 혈액화학검사 | `labitem-chem-crea` | CREA | number | `mg/dL` | 30 |
| `labcat-urinalysis` | 요검사 | `labitem-ua-ph` | pH | number | none | 10 |
| `labcat-urinalysis` | 요검사 | `labitem-ua-sg` | Specific Gravity | number | none | 20 |
| `labcat-urinalysis` | 요검사 | `labitem-ua-blood` | Blood | grade | none | 30 |
| `labcat-cytology` | 세포 검사 | `labitem-cyto-finding` | 현미경 소견 | text | none | 10 |
| `labcat-kit` | 키트 검사 | `labitem-kit-result` | 검사 결과 | positive_negative | none | 10 |
| `labcat-uncategorized` | 카테고리 미설정 | `labitem-custom-placeholder` | 사용자 추가 항목 | text | none | 999 |

## Order Linkage

Lab orders can reference item categories or explicit item IDs.

| Order ID | Result Item Source | Portfolio Behavior |
| --- | --- | --- |
| `ord-lab-cbc` | `labcat-cbc` | Result sheet expands CBC items in sort order |
| `ord-lab-cbc-baso` | `labitem-cbc-baso` | Shows a specific CBC sub-item for admin-table realism |
| `ord-lab-chem-basic` | `labcat-chemistry` | Result sheet expands basic chemistry items |
| `ord-lab-urinalysis` | `labcat-urinalysis` | Result sheet expands urinalysis items |
| `ord-lab-skin-cytology` | `labcat-cytology` | Result sheet uses text finding fields |

## Fallback And Result Sheet Generation Rules

| Situation | Data Rule |
| --- | --- |
| Item has no category | Store it under `labcat-uncategorized` / 카테고리 미설정 until the admin assigns a category |
| Order links a category | Expand all active items in that category by `itemSortOrder` |
| Order links explicit items | Expand the listed items in the order's stored sequence |
| Category contains inactive items | Keep inactive items readable in historical results, but do not include them in new result sheets by default |
| Order links both category and explicit items | Use explicit items as an override for deterministic fixture behavior |
| Result sheet is created | Copy item name, input type, unit, sort order, and source item ID into the encounter result snapshot |

## Lab Order Activation Rule

Clinical pathology, system exam, imaging-result, or other result-style orders should not become active for new chart use unless they can create a non-empty result sheet.

| Rule | Data Needed |
| --- | --- |
| Active lab/result order | At least one linked active `categoryId` or explicit `testItemId` |
| Category-only order | Category must contain at least one active item |
| Explicit-item order | At least one explicit item must be active |
| No linked item | Keep order inactive or paused for new chart use; historical rows remain readable |
| Link changes after use | Future result sheets use new links; existing encounter result snapshots keep copied item metadata |

## Deletion And Lock Rules

- Categories and items can be reordered by drag-and-drop in the management screen.
- A category can be deleted only when it has no child items and is not used by a lab order/result template.
- A test item can be deleted only when it is not included under an order and has not been used in saved or confirmed result records.
- Locked delete buttons should explain the reason in plain language.
- Historical result sheets should remain readable even when an item is later inactive.

Derived lock data:

| Field | Rule |
| --- | --- |
| `deleteLocked` | `true` when `linkedOrderCount > 0` or `savedResultUsageCount > 0` |
| `lockReason` | Prefer order-link reason first, then saved-result reason |
| `availabilityStatus` | Controls new result-sheet inclusion only; it does not delete historical result snapshots |

## Deferred Screen-Implementation Notes

- Drag handles, category expand/collapse, confirmation dialog copy, and tooltip wording can wait for the 검사 항목 screen implementation.
- This document only defines the data needed to generate result-sheet rows and protect historical demo records.

## Out Of Scope For V1

- Real reference ranges.
- Clinical interpretation rules.
- Device integration.
- LOINC, VetSCT, or licensed terminology imports.
- Species, age, or weight-specific medical decision support.
