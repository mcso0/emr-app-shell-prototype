---
title: "Portfolio Demo Data"
status: "draft"
updated: "2026-05-19"
owner: "product"
source_issue: "DEN-99"
---

# Portfolio Demo Data

This folder defines the synthetic demo dataset for the CLAiR EMR portfolio MVP.

## Purpose

승욱의 현재 목표는 production launch가 아니라, 실제 업무 프로그램처럼 작동하는 고완성도 포트폴리오 MVP다. 이 데이터셋은 접수, 차트, 오더, 검사, 영상, 조제, 처치, 수납이 하나의 outpatient workflow로 이어지는 모습을 보여주기 위한 기준이다.

## Ground Rules

- Use synthetic guardians, patients, staff, encounters, orders, diagnoses, results, and invoices.
- Do not use real hospital, client, patient, or identifiable medical data.
- Use public veterinary guidelines and terminology resources only as design references.
- Do not claim medical accuracy, dosage safety, diagnosis correctness, or clinical decision support.
- Keep all demo cases resettable and repeatable.
- Make `encounterId` and `workspaceId` the core linkage for downstream chart/order/billing flows.

## Documents

| Document | Purpose |
| --- | --- |
| `research-notes.md` | Public reference sources and synthesis rules |
| `virtual-hospital-profile.md` | VIP동물의료센터 청담점 synthetic hospital concept |
| `demo-scenarios-v1.md` | Representative outpatient scenarios |
| `patient-guardian-data-v1.md` | Animal patient, guardian relationship, registration, drawer, status label, consent, and soft-delete data |
| `order-catalog-v1.md` | Individual order catalog baseline |
| `order-sets-and-templates-v1.md` | Order sets and clinical templates |
| `chart-order-application-v1.md` | Applied chart order rows, T-code labels, task states, confirmation, billing footer, and order scheduler handoff |
| `lab-test-items-v1.md` | Lab result item categories, input types, units, ordering, and deletion locks |
| `medication-order-details-v1.md` | Medication, injection, dispensing quantity, prescription-rule, and storage metadata |
| `order-pricing-rules-v1.md` | Synthetic order and order-set pricing basis, range price, billing reflection, and snapshot rules |
| `hospital-admin-preset-reference-archive-v1.md` | Running archive that separates reference-screen data candidates from UX and operational rules |
| `diagnosis-catalog-v1.md` | Diagnosis systems and sample diagnoses |
| `staff-roles-workflow-v1.md` | Staff roles and workflow ownership |
| `seed-handoff-v1.md` | Handoff from product docs to app mock/seed data |

## MVP Data Shape

The portfolio demo should show:

1. Login into a workspace.
2. Role-aware access for desk, vet, technician, billing, and admin users.
3. Reception creates or checks in an encounter.
4. Patient and guardian profile drawers show the animal/guardian context, status labels, consent, deletion state, and safe navigation targets.
5. Chart uses diagnosis and order catalogs.
6. Hospital admin can manage workspace order presets with standard name, in-hospital name, billing name, availability status, price, unit, and target species.
7. Chart creates applied order rows from presets and keeps their snapshot separate from master data.
8. Orders fan out into lab, imaging, dispensing, treatment, or billing work.
9. Results and completion states flow back to the chart.
10. Billing receives invoice lines from confirmed orders.
11. Audit-style activity records show who changed what and when.

## Order Data Structure Map

Order-related demo data should be organized into five data families.

| Data Family | What It Stores | Source Docs |
| --- | --- | --- |
| Master order data | Standard order identity, workspace order identity, names, aliases, category/T-code, target species, availability, destination module, guide/instruction text, default task/billing behavior | `order-catalog-v1.md`, `medication-order-details-v1.md` |
| Order set data | Separately managed set identity, set category/name, included order rows, child billing reflection, sort order, set amount basis, set price/range rows, scheduler and guide/instruction defaults | `order-sets-and-templates-v1.md`, `order-pricing-rules-v1.md` |
| Lab test item data | Result-sheet categories, item names, input types, units, item order, fallback category, order linkage, deletion lock derivation | `lab-test-items-v1.md` |
| Chart-applied order data | Encounter-owned order rows, set/child hierarchy, applied snapshots, selected/draft/confirmed state, task links, billing candidate links, staff/timestamp lifecycle | `chart-order-application-v1.md` |
| Billing and calculation data | Quantity source, unit price, subtotal, discount/surcharge, billing amount, tax marker, billing reflection, invoice line link, footer totals | `order-pricing-rules-v1.md`, `chart-order-application-v1.md`, `seed-handoff-v1.md` |

## Data-Affecting Rules

These rules affect storage, calculation, or downstream linkage and should be preserved before detailed UI work:

- Patient/guardian records should be workspace-scoped synthetic master data. Deletion is soft delete and must preserve identifiers and history.
- Animal profile status labels should be derived from appointment, encounter, inpatient, surgery/anesthesia, deceased, and deleted state records.
- Master presets and chart-applied rows are separate. Chart rows keep an applied snapshot so future admin edits do not rewrite past chart/order/billing records.
- Order sets are managed in a separate hospital-admin Order 세트 surface. They can appear together with individual orders only when staff search/apply orders from the chart.
- Lab orders that create result sheets should link at least one lab test item or category before they become active for new chart use.
- Set expansion should create parent and child chart rows with `sourceSetId`, `setItemId`, `parentChartOrderLineId`, and stable sort order.
- `Order 청구` creates billing candidates; `Order 확정` creates downstream tasks. These states can happen separately and should not be collapsed into one boolean.
- Quantity and amount fields should store both the computed value and the source rule, such as days, total count, actual dispense quantity, fixed one, range price, or manual override.
- Demo prices, units, medication metadata, and vaccine/dose sequence data are workflow examples only, not clinical or fee guidance.

## Portfolio Proof Points

- Patient and guardian data should be rich enough to support registration, profile drawer review, status labels, message consent, soft deletion, restoration, and chart/reception navigation without real data.
- Order management should look like real hospital administration data, not only a simple service-name list.
- Individual orders and order sets should be managed in separate hospital-admin surfaces because sets have their own included-order, amount-basis, and child-billing rules.
- Chart order search can still show individual orders, order sets, and templates together so staff can apply them in one workflow.
- Billing should use the order's billing name, price, unit, and target species rules rather than relying on chart display text.
- Order sets should support realistic administration fields such as included order counts, amount basis, set price, billing reflection, care guide, internal instruction, scheduler, and change history.
- Lab test item management should stay separate from billable orders: orders define what is requested and billed, while test items define result-sheet rows, input types, units, ordering, and delete locks.
- Order detail drawers should describe routing, billing reflection, guide/instruction delivery, lab result linkage, and medication-specific calculation metadata without turning demo data into clinical guidance.
- The chart Order section should treat applied rows as encounter-owned records with T-code label display, row hierarchy, independent confirmation/billing state, task links, invoice links, footer totals, device/urgent indicators, and snapshot state.
- Pricing rules should distinguish master presets from chart-applied snapshots so admin edits do not rewrite historical chart rows.
- Data contracts should keep source values, calculated values, and calculation sources separate so future fixtures can explain how quantities, totals, delete locks, and invoice candidates were produced.
- Reference-screen observations should be archived as data candidates and UX/operational rules before they become implementation scope.
- Demo content must stay clearly synthetic and workflow-oriented; it should not read like clinical advice.

## Deferred UX Notes

The following can wait until screen implementation because they do not change the core data contract:

- Exact table sorting/filtering controls, tab placement, drawer width, and modal layout.
- Button copy, tooltip wording, confirmation-dialog microcopy, hover states, and visual truncation behavior.
- Exact patient drawer spacing, profile tab layout, snackbar timing, and modal copy for unsaved navigation.
- Drag handle visuals, row highlight color, icon-only affordances, and detailed empty/loading states.
- Keyboard interaction design for the expanded chart Order table.

## Out Of Scope

- Real patient data.
- Real hospital import.
- Production clinical safety.
- Payment provider integration.
- PACS or device integration.
- Full veterinary terminology licensing and import.
- National-scale diagnosis or drug dictionary.

## Changelog

- 2026-05-19: Added order-management table field guidance from hospital admin preset reference.
- 2026-05-19: Added lab test item management contract from 검사 항목 reference.
- 2026-05-19: Added order detail drawer and medication-order detail contracts from preset reference.
- 2026-05-19: Added pricing rules and reference-archive split for incoming hospital-admin preset screenshots.
- 2026-05-19: Added chart order application contract from the expanded 진료/차트 Order reference.
- 2026-05-19: Added chart order cell guidance for T-code labels, NT task states, order name display, device resend errors, and urgent flags.
- 2026-05-19: Tightened data-first rules for source IDs, applied snapshots, set child rows, lab delete locks, medication quantity sources, pricing calculation order, and chart billing/task lifecycle; moved screen-specific behavior to deferred implementation notes.
- 2026-05-19: Added a five-family order data structure map and data-affecting rule summary for master orders, order sets, lab test items, chart-applied orders, and billing/calculation data.
- 2026-05-19: Recorded the product decision that Order 세트 is managed separately from individual Order 관리, while chart-side search/application can still combine individual orders and sets.
- 2026-05-19: Added patient/guardian data contract from 동물 등록 and 동물 정보 drawer references, including registration fields, breed/species rules, staff assignment, status labels, messaging consent, soft delete, and restoration data.
- 2026-05-19: Created DEN-99 synthetic virtual hospital demo dataset foundation.
