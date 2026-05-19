---
title: "Seed Handoff V1"
status: "draft"
updated: "2026-05-19"
owner: "product"
source_issue: "DEN-99"
---

# Seed Handoff V1

This document maps the product demo-data docs to future app mock, seed, and persistence work.

## Target Data Families

| Product Doc | Future Mock/Seed Target | Notes |
| --- | --- | --- |
| `virtual-hospital-profile.md` | workspace, staff, rooms, role memberships | Use `vip-cheongdam-demo` as portfolio workspace |
| `demo-scenarios-v1.md` | guardians, patients, appointments, encounters, queue rows | Each scenario must have deterministic IDs |
| `order-catalog-v1.md` | service categories, service items, prices, order catalog | Separate standard preset from workspace override |
| `order-sets-and-templates-v1.md` | order sets, set items, clinical templates | Template expansion should create draft orders only |
| `chart-order-application-v1.md` | chart order lines, applied snapshots, confirmation state, billing footer summaries | Encounter-owned applied data created from catalog or set presets |
| `lab-test-items-v1.md` | lab result item categories, lab result item presets, order-to-result-item links | Result item rows are not billable order rows |
| `medication-order-details-v1.md` | medication detail presets, species prescription rules, dispensing calculation metadata | Synthetic workflow metadata only; not dosage guidance |
| `order-pricing-rules-v1.md` | pricing rules, range price rows, billing reflection policy, applied snapshots | Pricing is portfolio workflow data, not a real fee schedule |
| `hospital-admin-preset-reference-archive-v1.md` | product/reference trace only | Archive observations before promoting them to seed fields |
| `diagnosis-catalog-v1.md` | diagnosis systems, diagnosis catalog, diagnosis aliases | Free-text diagnosis remains allowed |
| `staff-roles-workflow-v1.md` | role permissions, task ownership, audit seed | Existing role model should remain source of auth truth |

## Order Management Seed Fields

The hospital admin order-management UI needs enough data to render realistic rows before live catalog editing exists.

| Seed Field | Source Doc | Target Shape |
| --- | --- | --- |
| `order_row_type` | `order-catalog-v1.md`, `order-sets-and-templates-v1.md` | `individual` for Order 관리 rows; `set` for separate Order 세트 rows |
| `category_group` | `order-catalog-v1.md` | broad module category, such as `lab` |
| `category_label` | `order-catalog-v1.md` | visible admin category, such as `CBC검사` |
| `standard_order_name` | `order-catalog-v1.md` | stable preset display name |
| `in_hospital_order_name` | `order-catalog-v1.md` | workspace-custom display name |
| `billing_name` | `order-catalog-v1.md` | invoice-line display name |
| `availability_status` | `order-catalog-v1.md` | `active`, `paused`, or `inactive` |
| `price_krw` | `order-catalog-v1.md` | workspace price for billable individual rows |
| `sales_unit` | `order-catalog-v1.md` | `per_each`, `per_visit`, `per_course`, `per_tablet`, or `per_document` |
| `target_species` | `order-catalog-v1.md` | `dog`, `cat`, `other` list |
| `standard_order_id` | `order-catalog-v1.md` | shared synthetic preset identity |
| `workspace_order_id` | `order-catalog-v1.md` | workspace-owned customized order identity |
| `default_destination_module` | `order-catalog-v1.md` | downstream module target when confirmed |
| `default_task_required` | `order-catalog-v1.md` | whether confirmation creates downstream work by default |
| `minimum_lab_item_count` | `order-catalog-v1.md`, `lab-test-items-v1.md` | minimum linked result items required for active lab/result orders |
| `vaccine_metadata` | `order-catalog-v1.md` | target, classification, and 차수 fields for preventive rows |
| `source_set_id` | `order-sets-and-templates-v1.md` | set expansion trace on draft orders |
| `set_item_id` | `order-sets-and-templates-v1.md` | stable included-order row identity inside a set |
| `included_order_sort_order` | `order-sets-and-templates-v1.md` | expansion order copied into chart order rows |
| `set_category` | `order-sets-and-templates-v1.md` | visible Order 세트 table category |
| `included_set_count` | `order-sets-and-templates-v1.md` | count shown in set management table |
| `included_order_count` | `order-sets-and-templates-v1.md` | count shown in set management table |
| `amount_basis` | `order-sets-and-templates-v1.md` | `set_fixed_price`, `included_order_sum`, or `range_price` |
| `set_price_krw` | `order-sets-and-templates-v1.md` | set-level price when amount basis requires it |
| `tax_type` | `order-sets-and-templates-v1.md` | `taxable` or `non_taxable` demo marker |
| `billing_reflection_enabled` | `order-sets-and-templates-v1.md` | whether set billing name affects invoice behavior |
| `care_guide` | `order-sets-and-templates-v1.md` | owner-facing workflow text, not medical advice |
| `care_guide_delivery_enabled` | `order-sets-and-templates-v1.md` | whether guide sharing is shown in demo |
| `internal_instruction` | `order-sets-and-templates-v1.md` | staff-only workflow note |
| `scheduler_rule` | `order-sets-and-templates-v1.md` | repeat/follow-up schedule text |
| `scheduler_enabled` | `order-sets-and-templates-v1.md` | set-level scheduler toggle |
| `change_history_summary` | `order-sets-and-templates-v1.md` | last changed timestamp/actor display |
| `source_preset_version` | `order-pricing-rules-v1.md` | preset version used when an order or set is applied to a chart |
| `applied_snapshot_json` | `order-pricing-rules-v1.md` | frozen names, price, unit, tax, and amount basis used by a chart row |

## Pricing Rule Seed Fields

Pricing fixture data should stay synthetic and deterministic.

| Seed Field | Source Doc | Target Shape |
| --- | --- | --- |
| `price_rule_id` | `order-pricing-rules-v1.md` | deterministic pricing rule ID |
| `price_basis` | `order-pricing-rules-v1.md` | `unit_price`, `fixed_order_price`, `set_fixed_price`, `included_order_sum`, or `range_price` |
| `sales_unit` | `order-pricing-rules-v1.md` | `per_order`, `per_kg`, `per_day`, `per_frequency`, or `per_each` |
| `price_krw` | `order-pricing-rules-v1.md` | integer KRW amount |
| `tax_included` | `order-pricing-rules-v1.md` | boolean demo tax marker |
| `rounding_rule` | `order-pricing-rules-v1.md`, `medication-order-details-v1.md` | quantity or billing rounding marker |
| `range_price_rows` | `order-pricing-rules-v1.md` | ordered bracket rows for range pricing |
| `child_billing_reflection_policy` | `order-pricing-rules-v1.md` | default child billing behavior for order sets |
| `extra_child_amount_krw` | `order-pricing-rules-v1.md` | additional amount from included child rows |
| `applied_price_snapshot` | `order-pricing-rules-v1.md` | frozen applied chart-row pricing values |

## Chart Order Application Seed Fields

The expanded 진료/차트 Order section needs encounter-owned applied rows, not just master catalog rows.

| Seed Field | Source Doc | Target Shape |
| --- | --- | --- |
| `chart_order_line_id` | `chart-order-application-v1.md` | deterministic applied row ID |
| `encounter_id` | `chart-order-application-v1.md` | encounter that owns the row |
| `source_preset_id` | `chart-order-application-v1.md`, `order-catalog-v1.md` | catalog order or set preset origin |
| `source_set_id` | `chart-order-application-v1.md`, `order-sets-and-templates-v1.md` | parent set when expanded from a set |
| `parent_chart_order_line_id` | `chart-order-application-v1.md` | nested set or child order parent |
| `set_item_id` | `chart-order-application-v1.md`, `order-sets-and-templates-v1.md` | source row inside an order set when applicable |
| `row_depth` | `chart-order-application-v1.md` | tree indentation depth |
| `row_type` | `chart-order-application-v1.md` | `individual`, `set`, `set_child`, or `temporary` |
| `t_code` | `chart-order-application-v1.md` | product T-code such as `T16`, with special row types for set and bundle rows |
| `t_code_label` | `chart-order-application-v1.md` | visible category badge label such as 경구, 주사, 임상, 세트 |
| `t_code_group` | `chart-order-application-v1.md` | chart tab group such as 원내 검사, 치료, 경구제 |
| `label_color_token` | `chart-order-application-v1.md` | stable display color token for category badge rendering |
| `order_name_tooltip` | `chart-order-application-v1.md` | full name shown when the 20-character display name is truncated |
| `controlled_drug_badge` | `chart-order-application-v1.md`, `medication-order-details-v1.md` | `none`, `narcotic`, or `psychotropic` compact marker |
| `order_status` | `chart-order-application-v1.md` | `draft`, `pending`, `confirmed`, `billed`, or `cancelled` |
| `billing_status` | `chart-order-application-v1.md` | `not_requested`, `candidate_created`, `invoice_linked`, or `billing_cancelled` |
| `task_required` | `chart-order-application-v1.md` | whether the row creates downstream work |
| `task_code` | `chart-order-application-v1.md` | generated workflow code such as `NT01`, `NT04`, or `NT09` |
| `generated_task_id` | `chart-order-application-v1.md` | downstream work item created by confirmation |
| `task_state` | `chart-order-application-v1.md` | generated work status such as `pending`, `complete`, or `re_requested` |
| `task_state_action_policy` | `chart-order-application-v1.md` | click behavior for task state buttons, such as lab navigation and re-request |
| `billing_candidate_id` | `chart-order-application-v1.md` | invoice candidate created by Order 청구 |
| `invoice_line_id` | `chart-order-application-v1.md` | invoice line linked after billing accepts or finalizes the candidate |
| `billing_reflection_enabled` | `chart-order-application-v1.md` | whether the row contributes to billing |
| `urgent_flag` | `chart-order-application-v1.md` | whether urgent icon display is active |
| `device_transmission_status` | `chart-order-application-v1.md` | `not_applicable`, `pending`, `sent`, or `failed` |
| `device_error_code` | `chart-order-application-v1.md` | synthetic error marker for demo resend behavior |
| `resend_available` | `chart-order-application-v1.md` | whether the chart should show the resend control |
| `medication_values` | `chart-order-application-v1.md`, `medication-order-details-v1.md` | days, frequency, dose basis, route, storage, and quantity values |
| `line_subtotal_krw` | `chart-order-application-v1.md`, `order-pricing-rules-v1.md` | line subtotal before discount/adjustment |
| `discount_adjustment_krw` | `chart-order-application-v1.md` | line discount or surcharge amount |
| `billing_amount_krw` | `chart-order-application-v1.md` | final line billing amount |
| `attending_vet_id` | `chart-order-application-v1.md`, `staff-roles-workflow-v1.md` | responsible vet |
| `applied_snapshot_json` | `chart-order-application-v1.md`, `order-pricing-rules-v1.md` | frozen preset values used by the applied row |
| `footer_billing_summary` | `chart-order-application-v1.md` | derived order counts, discount totals, and billing grand total |
| `lifecycle_staff_and_timestamps` | `chart-order-application-v1.md` | created/confirmed/billed staff IDs and timestamps for replay |

## Lab Test Item Seed Fields

The 검사 항목 UI needs result-sheet metadata that is separate from billable order catalog rows.

| Seed Field | Source Doc | Target Shape |
| --- | --- | --- |
| `lab_category_id` | `lab-test-items-v1.md` | deterministic category ID, such as `labcat-cbc` |
| `lab_category_name` | `lab-test-items-v1.md` | visible category label, such as `CBC검사` |
| `lab_category_sort_order` | `lab-test-items-v1.md` | drag-and-drop category order |
| `lab_test_item_id` | `lab-test-items-v1.md` | deterministic item ID, such as `labitem-cbc-wbc` |
| `lab_test_item_name` | `lab-test-items-v1.md` | visible result item name |
| `result_input_type` | `lab-test-items-v1.md` | `number`, `text`, `select`, `positive_negative`, or `grade` |
| `result_unit` | `lab-test-items-v1.md` | display unit; can be `none` |
| `lab_item_sort_order` | `lab-test-items-v1.md` | item order inside category |
| `lab_item_status` | `lab-test-items-v1.md` | `active` or `inactive` |
| `delete_locked` | `lab-test-items-v1.md` | whether delete is disabled |
| `lock_reason` | `lab-test-items-v1.md` | visible reason for delete restriction |
| `linked_order_ids` | `lab-test-items-v1.md`, `order-catalog-v1.md` | orders that use this category or item |
| `linked_order_count` | `lab-test-items-v1.md` | count used to derive delete lock state |
| `saved_result_usage_count` | `lab-test-items-v1.md` | historical result usage count used to protect snapshots |

## Order Detail Seed Fields

The order detail drawer needs shared metadata that applies across lab, imaging, treatment, dispensing, and billing handoff.

| Seed Field | Source Doc | Target Shape |
| --- | --- | --- |
| `send_to_external_enabled` | `order-catalog-v1.md` | whether confirmed order sends to an external placeholder |
| `external_destination` | `order-catalog-v1.md` | external/device/lab destination label |
| `billing_reflection_enabled` | `order-catalog-v1.md` | whether billing name is reflected |
| `aliases` | `order-catalog-v1.md` | searchable aliases |
| `batch_delivery_mode` | `order-catalog-v1.md` | `deliver` or `do_not_deliver` |
| `care_guide` | `order-catalog-v1.md` | owner-facing workflow text |
| `care_guide_delivery_enabled` | `order-catalog-v1.md` | whether care guide is delivered |
| `internal_instruction` | `order-catalog-v1.md` | staff-only workflow text |
| `internal_instruction_delivery_enabled` | `order-catalog-v1.md` | whether instruction is delivered |
| `result_item_category_ids` | `order-catalog-v1.md`, `lab-test-items-v1.md` | linked lab result item categories |
| `result_item_ids` | `order-catalog-v1.md`, `lab-test-items-v1.md` | linked explicit lab result items |
| `standard_result_unit` | `order-catalog-v1.md` | simple result-unit display |
| `change_history_summary` | `order-catalog-v1.md` | last changed timestamp/actor display |

## Medication Detail Seed Fields

| Seed Field | Source Doc | Target Shape |
| --- | --- | --- |
| `is_medication` | `medication-order-details-v1.md` | medication-specific detail visibility |
| `controlled_drug_label` | `medication-order-details-v1.md` | `none`, `narcotic`, or `psychotropic` display marker |
| `auto_dispense_quantity_enabled` | `medication-order-details-v1.md` | whether chart prescription changes recalculate quantity |
| `species_prescription_rules` | `medication-order-details-v1.md` | dog/cat/other rule blocks |
| `administration_days` | `medication-order-details-v1.md` | natural number |
| `daily_frequency_code` | `medication-order-details-v1.md` | `sid`, `bid`, `tid`, `qid`, `q12h`, etc. |
| `frequency_code_alias` | `medication-order-details-v1.md`, `chart-order-application-v1.md` | optional alias such as `e3d` normalized to `q3d` |
| `frequency_daily_count` | `medication-order-details-v1.md` | numeric interpretation used for total-count calculation |
| `dose_basis` | `medication-order-details-v1.md` | kg, head, ingredient amount, total amount, or prescribed quantity |
| `administration_route` | `medication-order-details-v1.md` | PO, IV, CRI, SC |
| `dispense_unit` | `medication-order-details-v1.md` | EA, T, mL, etc. |
| `dispense_rounding_rule` | `medication-order-details-v1.md` | as-is, ceil, floor, round, 0.25/0.5 step rules |
| `medication_instruction` | `medication-order-details-v1.md` | default owner-facing administration guide |
| `storage_method` | `medication-order-details-v1.md` | room temp, refrigerated, frozen |
| `ingredient_metadata` | `medication-order-details-v1.md` | synthetic ingredient/product display fields |
| `dispense_quantity_source` | `medication-order-details-v1.md` | `days_frequency`, `preset_base_quantity`, or `manual` |
| `actual_dispense_quantity_source` | `medication-order-details-v1.md` | `auto_calculated`, `rounded`, or `manual` |
| `storage_route_instruction_codes` | `medication-order-details-v1.md` | controlled demo values for storage, route, and medication instruction |

## Suggested Deterministic IDs

| Entity | Prefix | Example |
| --- | --- | --- |
| Workspace | `workspace-` | `workspace-vip-cheongdam` |
| Staff | `staff-` | `staff-vet-yuji` |
| Guardian | `guardian-` | `guardian-kim-haneul` |
| Patient | `patient-` | `patient-kong` |
| Encounter | `encounter-` | `encounter-kong-260501` |
| Appointment | `appointment-` | `appointment-kong-260501` |
| Order catalog | `ord-` | `ord-lab-cbc` |
| Order set | `set-` | `set-vomit-basic` |
| Lab category | `labcat-` | `labcat-cbc` |
| Lab test item | `labitem-` | `labitem-cbc-wbc` |
| Medication detail | `meddetail-` | `meddetail-maropitant` |
| Template | `tpl-` | `tpl-gi-vomit` |
| Diagnosis | `dx-` | `dx-acute-gi-suspect` |
| Invoice | `invoice-` | `invoice-kong-260501` |

## Implementation Order

1. Add static demo-data seeds to mock domain data.
2. Add order catalog lookup that supports separately managed individual orders, order sets, templates, availability status, and target species.
3. Add hospital admin order-management table fixtures using the field contract above.
4. Add order set drawer fixtures for billing reflection, care guide, internal instruction, scheduler, amount basis, and included order rows.
5. Add lab test item fixtures for categories, input types, units, ordering, delete locks, and order-to-result-item links.
6. Add order detail drawer fixtures for routing, billing reflection, guide/instruction delivery, lab result linkage, and change history.
7. Add medication detail fixtures for species prescription rules, auto-calculation metadata, unit display, rounding, and storage method.
8. Add pricing rule fixtures for price basis, range rows, child billing reflection, and applied snapshots.
9. Add chart order application fixtures for applied rows, set hierarchy, confirmation state, and billing footer totals.
10. Add diagnosis catalog lookup and catalog-linked/free-text distinction.
11. Connect chart order add UI to catalog source.
12. Connect confirmed orders to destination work queues.
13. Connect confirmed orders to billing invoice candidates.
14. Add resettable portfolio scenario launcher.

## Data Safety

- Keep all records synthetic.
- Do not import real clinical records.
- Do not store credentials, secrets, or external API keys in seed files.
- Mark public guideline references as inspiration only.
- Do not represent drug dose, diagnosis, or treatment as authoritative.
- Treat prices and units as portfolio workflow examples, not real fee guidance.

## Follow-Up Linear Candidates

| Suggested Issue | Project Placement | Purpose |
| --- | --- | --- |
| `00-04 Add demo data seed contract to clinical billing schema` | Project 04 / 00 milestone | Align schema with standard/workspace order catalog and diagnosis catalog |
| `00-05 Add hospital admin order catalog fixture coverage` | Project 04 / 00 milestone | Ensure admin table rows include standard name, in-hospital name, billing name, status, price, unit, and target species |
| `00-06 Add order set drawer fixture coverage` | Project 04 / 00 milestone | Cover amount basis, billing reflection, care guide, scheduler, and included order rows |
| `00-07 Add lab test item fixture coverage` | Project 04 / 00 milestone | Cover result item categories, input types, units, ordering, delete locks, and order linkage |
| `00-08 Add order detail and medication fixture coverage` | Project 04 / 00 milestone | Cover routing, billing reflection, guide/instruction delivery, medication calculation metadata, and storage display |
| `02-00 Build catalog-backed chart order add flow` | Project 04 / 02 milestone | Let chart use individual orders, sets, and templates |
| `03-00 Fan out confirmed orders to lab imaging dispensing treatment queues` | Project 04 / 03 milestone | Make order workflow feel like a real hospital program |
| `05-00 Add portfolio scenario reset and QA checklist` | Project 05 | Validate the whole portfolio story |
