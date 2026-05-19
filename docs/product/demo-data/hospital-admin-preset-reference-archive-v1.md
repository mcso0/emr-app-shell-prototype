---
title: "Hospital Admin Preset Reference Archive V1"
status: "draft"
updated: "2026-05-19"
owner: "product"
source_issue: "DEN-99"
---

# Hospital Admin Preset Reference Archive V1

This document archives observations from the hospital-admin preset reference screens so future data modeling work can separate persistent data from UX and operational rules.

It describes synthetic portfolio demo data only. It must not be treated as medical guidance, production billing policy, or real hospital import material.

## How To Use This Archive

When a new reference screen is reviewed, split the observation into two buckets:

| Bucket | Use It For | Example |
| --- | --- | --- |
| Data structure candidate | Future mock, seed, schema, or fixture fields | `billingName`, `salesUnit`, `targetSpecies`, `sourcePresetVersion` |
| UX or operational rule | Screen behavior, validation, disabled states, confirmations, display policy | Save button stays disabled until required fields are complete |

If a detail affects both buckets, record it in both places. For example, chart-applied orders need `appliedSnapshot` as data and also need a UX rule that later preset edits do not mutate already-applied chart rows.

## Reference Surface Map

| Surface | Current Product Doc | Data Structure Focus | UX / Rule Focus |
| --- | --- | --- | --- |
| Order management table | `order-catalog-v1.md` | individual order names, category, price, unit, status, target species | sorting, filtering, detail drawer entry, row availability |
| Order detail drawer | `order-catalog-v1.md`, `medication-order-details-v1.md` | routing, billing reflection, care guide, internal instruction, result item links, medication metadata | initial use toggle, dirty exit confirmation, field-specific validation |
| Lab test item management | `lab-test-items-v1.md` | result item category, result input type, unit, sort order, delete lock | drag order, locked delete tooltip, category grouping |
| Order set table and drawer | `order-sets-and-templates-v1.md` | set category, set name, amount basis, included orders, scheduler, change history | empty set save, included order reorder, nested set expansion, save enablement |
| Pricing and billing display | `order-pricing-rules-v1.md` | price basis, sales unit, range rows, tax, rounding, applied snapshot | child billing toggle behavior, range validation, already-applied order immutability |
| Chart Order expanded modal | `chart-order-application-v1.md` | applied order rows, set hierarchy, status, billing totals, selected rows, confirmation state | category tabs, row grouping, footer actions, batch billing, Order scheduler |
| Preventive / vaccine schedule | future preventive order doc | vaccine target, vaccine category, dose sequence, schedule interval | target-change confirmation, booster default, interval toggle validation |

## Data Inventory Candidates

| Candidate | Why It Matters |
| --- | --- |
| `standardPresetId` | Keeps the shared preset identity stable |
| `workspacePresetId` | Allows each hospital to rename or price a copied preset |
| `presetVersion` | Explains which version produced a chart-applied order |
| `appliedSnapshot` | Preserves the exact order/set values used in a chart even if the admin preset changes later |
| `orderRowType` | Distinguishes individual order rows from set rows |
| `billingReflectionEnabled` | Controls whether billing-facing name and amount appear on invoice behavior |
| `careGuideDeliveryEnabled` | Keeps written care guide separate from whether it is shared |
| `internalInstructionDeliveryEnabled` | Keeps staff instruction separate from whether it is sent to destination work |
| `amountBasis` | Explains whether a set uses fixed price, included-order sum, or range price |
| `rangePriceRows` | Supports kg or other bracketed pricing examples |
| `includedOrderSortOrder` | Makes set row order reproducible when expanded into chart orders |
| `deleteLocked` | Prevents removing items already used by orders or result sheets |
| `vaccineTargetSpecies` | Supports preventive order schedule variations without implying clinical advice |
| `doseSequenceRules` | Supports 1st to 6th dose and booster display in a workflow demo |
| `chartOrderLine` | Encounter-owned applied order row created from a catalog or set preset |
| `footerBillingSummary` | Derived totals used by Order 청구 and Order 확정 actions |
| `tCodeLabel` | Keeps chart category badge display deterministic across catalog, set, and applied rows |
| `taskStateActionPolicy` | Separates visible task status from click behavior such as result-page navigation or re-request |
| `deviceTransmissionStatus` | Supports device send error, resend modal, and urgent/error indicator examples |

## UX And Operational Rule Archive

| Rule | Demo Meaning |
| --- | --- |
| New use toggles can start off | Newly created order or set presets may require explicit activation before staff can select them |
| Save is disabled until meaningful changes exist | Required fields and changed state should control the save action |
| Cancel after edits opens a confirmation | Unsaved changes should show a modal before leaving the drawer |
| Already chart-applied orders keep their snapshot | Editing a preset later changes future additions, not historical chart rows |
| Care guide and internal instruction are separate | Owner-facing communication and staff-only execution notes should not be mixed |
| Delivery toggles control propagation | A text field can exist even when delivery is off |
| Delete can be locked by usage | Items used under orders, result sheets, or chart records should not be silently removed |
| Empty order sets are allowed | A set can be created first and populated later |
| Order sets are separately managed | Individual Order 관리 and Order 세트 management should remain separate admin surfaces; chart-side search can combine both for application |
| Included order rows can be reordered | Row order affects future expansion order, not already-created chart orders |
| Moving an order outside its set should revert | Reorder is limited to rows inside the same set |
| Nested set expansion must stay traceable | Expanded rows should keep source set metadata |
| Field labels should use business wording | For example, `전달여부` should be treated as `청구반영` when the toggle affects billing |
| Chart order confirmation is row-based | `Order 청구` and `Order 확정` operate on selected applied rows, not the whole master catalog |
| T-code labels are display metadata | Category badges such as 경구, 주사, 임상, and 세트 should be stored separately from medical meaning |
| Long order names are truncated | Chart rows show about 20 characters and expose the full name through tooltip behavior |
| Task state buttons are contextual | Lab, imaging, and surgery rows can open different action menus from the same visible status cell |
| Device send errors are retryable | Failed device transmission can show a resend action and an Order 재전송 modal in the demo |

## Open Reference Questions

| Question | Why It Needs 승욱 Decision |
| --- | --- |
| Should set drawers keep an internal `+ Order 추가` area or remove it in favor of chart-side inclusion? | The screenshots show both directions; this affects admin workflow scope |
| Should preventive vaccine schedule become its own v1 doc now or wait until chart scheduler implementation? | The field set is large enough to deserve a separate document |
| Should range pricing support only kg for MVP or a generic measurement basis? | The current reference centers on kg, but future items may use other bases |
| Should order-set scheduler override child order schedules or only provide a default? | This affects how chart-applied order rows inherit schedule metadata |

## Archiving Rules

- Keep observations short and structured.
- Do not paste full Figma text dumps into this repository.
- Do not store screenshots, real hospital data, real patient data, or credentials here.
- When a rule becomes stable enough for implementation, move it into the focused product doc and keep this archive as the reference trace.

## Changelog

- 2026-05-19: Created the first archive split for hospital-admin preset reference screens.
