---
title: "Order Catalog V1"
status: "draft"
updated: "2026-05-19"
owner: "product"
source_issue: "DEN-99"
---

# Order Catalog V1

Order catalog items are synthetic demo service items. They are not clinical recommendations.

## Catalog Rules

- An order is the smallest operational work unit.
- Each order should know its clinical category, destination module, billing behavior, and staff instruction.
- Hospital-level customization should copy a standard item into a workspace-owned item instead of editing the global preset directly.
- Future persistence should separate `standardOrderId` from `workspaceOrderId`.
- The hospital admin Order 관리 table should manage individual order rows only. Order sets are managed in the separate Order 세트 surface.
- The hospital admin order-management table should show operational fields that matter to staff: category, standard order name, in-hospital order name, billing name, availability status, price, sales unit, and target species.
- Billing should use the billing-facing fields, while chart/order search may use the standard or in-hospital names.
- Lab orders may reference `docs/product/demo-data/lab-test-items-v1.md` categories or item IDs so result sheets know which fields, units, and input types to render.
- Medication and injection orders may reference `docs/product/demo-data/medication-order-details-v1.md` for dispensing quantity, prescription-rule, storage, and unit-display metadata.

## Hospital Admin Table Field Contract

This contract is based on the Order 관리 preset reference screen. It describes portfolio demo data only.

| Field | Demo Meaning | Example |
| --- | --- | --- |
| `orderRowType` | Record type for this surface; Order 관리 stores individual orders only | `individual` |
| `standardOrderId` | Shared synthetic preset identity | `std-ord-lab-cbc-baso` |
| `workspaceOrderId` | Workspace-owned customized order identity | `ord-lab-cbc-baso` |
| `sourcePresetVersion` | Version copied into chart-applied rows | `v3` |
| `categoryGroup` | Top-level catalog lane shown as a tab or filter | `lab` |
| `categoryLabel` | More specific hospital-facing category | `CBC검사`, `전해질검사/정맥혈` |
| `tCode` | Chart display category code copied to applied rows | `T04` |
| `tCodeLabel` | Short chart label for the order | 임상 |
| `standardOrderName` | Shared preset name that should remain stable | `[CBC 검사] #BASO` |
| `inHospitalOrderName` | Workspace-customized name used by staff | `[CBC 검사] #BASO` or `CBC BASO` |
| `billingName` | Name that appears on invoice lines | `CBC 검사 BASO` |
| `availabilityStatus` | Whether staff can select the order | `active`, `paused`, `inactive` |
| `priceKrw` | Billing price for the workspace item | `12000` |
| `salesUnit` | Unit shown with the price | `per_each` |
| `targetSpecies` | Species the item applies to in the demo | `dog`, `cat`, `other` |
| `defaultDestinationModule` | Downstream queue target when confirmed | `lab`, `imaging`, `dispensing`, `treatment`, `billing_only`, `chart_only` |
| `defaultTaskRequired` | Whether confirmation creates downstream work by default | `true` |
| `detailMode` | Whether the row opens detailed settings | `basic-detail` |

## Order Detail Drawer Contract

The order detail drawer defines how a selected order behaves after it is added from the chart. These fields are workflow metadata for the synthetic demo.

| Field | Demo Meaning | Example |
| --- | --- | --- |
| `drawerTitle` | Order detail title; label text should not duplicate the word Order unnecessarily | `[심전도 검사] 기록 및 판독` |
| `orderRowType` | Individual label shown near the title; sets use `order-sets-and-templates-v1.md` | `개별` |
| `availabilityStatus` | Toggle-backed use status; new records can start off by default | `active`, `inactive` |
| `categoryLabel` | Admin-facing category | 심전도 검사 |
| `standardOrderName` | Shared preset name | `[심전도 검사] 기록 및 판독` |
| `inHospitalOrderName` | Required workspace display name | `[심전도 검사] 기록 및 판독` |
| `sendToExternalEnabled` | Whether confirmed orders are sent to an external device/lab solution | `true` for selected lab orders |
| `externalDestination` | External destination or integration label | IDEXX-style solution placeholder |
| `billingName` | Required invoice-facing name | 심전도 검사 기록 및 판독 |
| `billingReflectionEnabled` | Whether billing name is reflected on owner invoice behavior | `true` |
| `aliases` | Search aliases separated by commas | vitamin, vita |
| `batchDeliveryMode` | Whether order is delivered to destination modules at once | `deliver`, `do_not_deliver` |
| `targetSpecies` | Target species list | dog, cat, other |
| `careGuide` | Owner-facing workflow text | Synthetic care guide text |
| `careGuideDeliveryEnabled` | Whether care guide is delivered/shared | `true` |
| `internalInstruction` | Staff-only instruction shown when order is added | Synthetic instruction text |
| `internalInstructionDeliveryEnabled` | Whether instruction is sent to destination work | `true` |
| `memo` | Admin note | copied from product master |
| `salesUnit` | Sales unit used by billing | per_each |
| `priceKrw` | Sales amount | 8000 |
| `roundingRule` | Price/quantity rounding marker where applicable | as_is |
| `taxIncluded` | Whether VAT is included | true |
| `resultInputType` | Result value type for simple result orders | number |
| `standardResultUnit` | Standard result unit for simple result orders | mmHg |
| `minimumLabItemCount` | Minimum linked result items required before activating lab/result orders | `1` for 임상병리/계통/영상 result-style orders |
| `autoCalculationEnabled` | Medication/dispensing calculation toggle | true |
| `vaccineTarget` | Preventive/vaccine target grouping when applicable | dog, cat, other |
| `vaccineClassification` | Synthetic vaccine category for workflow grouping | core, non_core, rabies, other |
| `doseSequenceEnabled` | Whether dose-sequence data replaces normal dispensing attributes | true |
| `doseSequenceLabel` | Display label for dose order | `1차`, `2차`, `추가접종` |
| `doseSequenceNumber` | Numeric sequence when applicable | `1` |
| `changeHistorySummary` | Last changed timestamp and actor | 2022-09-21 09:00:32 박민수 |

## Catalog-To-Chart Snapshot Rules

Catalog rows are master data. Chart order rows are encounter-owned applied records.

When an order is added to a chart, copy these values into the chart row snapshot:

| Snapshot Field | Why It Matters |
| --- | --- |
| `sourcePresetId`, `sourcePresetVersion` | Keeps historical chart rows traceable after admin edits |
| `standardOrderId`, `workspaceOrderId` | Separates shared preset identity from hospital-specific customization |
| `categoryGroup`, `categoryLabel`, `tCode`, `tCodeLabel` | Preserves chart grouping and category badge display |
| `inHospitalOrderName`, `billingName`, `aliases` | Preserves chart search/display and invoice wording |
| `defaultDestinationModule`, `defaultTaskRequired` | Explains whether confirmation creates lab, imaging, dispensing, treatment, or billing-only work |
| `billingReflectionEnabled`, `priceKrw`, `salesUnit`, `taxIncluded`, `roundingRule` | Drives chart and billing calculations without re-reading mutable admin data |
| `targetSpecies` | Supports demo filtering; it is not medical eligibility guidance |
| `careGuide`, `internalInstruction`, delivery toggles | Carries workflow communication text into downstream work |
| `minimumLabItemCount`, result item links | Prevents active lab/result orders from creating empty result sheets |
| `vaccineTarget`, `vaccineClassification`, dose sequence fields | Supports preventive workflow display without using medication dose fields |

Historical applied rows should remain readable even if a catalog row becomes paused, inactive, renamed, or repriced later.

### Lab-Specific Detail Fields

Lab/detail orders can include result item rows. These rows should reference `lab-test-items-v1.md` where possible.

| Field | Demo Meaning |
| --- | --- |
| `includedLabItems` | Included result-sheet item rows |
| `includedLabItems.testItemName` | Result item label |
| `includedLabItems.resultInputType` | Result input method |
| `includedLabItems.resultUnit` | Result unit |
| `includedLabItems.deleteLocked` | Whether the item can be removed from this order |

### Medication-Specific Detail Fields

Medication, injection, narcotic, and psychotropic orders should keep additional metadata in `medication-order-details-v1.md`.

### Preventive/Vaccine Detail Fields

Preventive and vaccine-style orders need workflow grouping fields, not medical recommendations.

| Field | Demo Meaning |
| --- | --- |
| `vaccineTarget` | Target species or workflow audience for the vaccine row |
| `vaccineClassification` | Synthetic grouping such as core, non-core, rabies, or other |
| `doseSequenceEnabled` | Whether 차수 information is shown instead of normal dispensing attributes |
| `doseSequenceNumber` | Numeric sequence for deterministic sorting |
| `doseSequenceLabel` | Human-readable sequence label such as 1차, 2차, or 추가접종 |

## Lab Category Tabs

The lab catalog should be more granular than a generic `lab` category so the hospital admin screen can feel realistic.

| Tab Key | Korean Label | Portfolio Use |
| --- | --- | --- |
| `all` | 전체 | Shows all workspace orders |
| `in_house_blood` | 원내 혈액 검사 | Common internal lab lane |
| `microbiology` | 임상미생물검사 | Future culture/microbiology lane |
| `electrolyte_arterial` | 전해질검사/동맥혈 | Future blood gas/electrolyte lane |
| `electrolyte_venous` | 전해질검사/정맥혈 | CBC/electrolyte reference lane |
| `coagulation` | 응고계검사 | Future coagulation lane |
| `chemistry` | 혈액화학검사 | Basic chemistry panel |
| `cbc` | CBC검사 | CBC individual rows and CBC set |
| `csf` | CSF검사 | Future neurology sample lane |
| `cytology` | 세포 검사 | Skin/ear cytology scenario |
| `body_fluid` | 체액 검사 | Future fluid analysis lane |
| `kit` | 키트 검사 | Snap/rapid-kit style lane |
| `urinalysis` | 요검사 | Cat urinary scenario |
| `pathology_misc` | 기타 병리 검사 | Catch-all pathology lane |
| `sample_collection` | 검체 채취 | Collection service lane |

## Individual Orders

| Order ID | Type | Category | Standard Order Name | In-hospital Name | Billing Name | Status | Destination | Price KRW | Unit | Target | Billable | Default Staff | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| `ord-consult-basic` | individual | consultation | 외래 진찰 | 외래 진찰 | 외래 진찰료 | active | Chart/Billing | 22000 | per_visit | dog,cat,other | yes | vet | 기본 외래 진료비 |
| `ord-consult-cat` | individual | consultation | 고양이 친화 진찰 | 고양이 친화 진찰 | 고양이 진찰료 | active | Chart/Billing | 28000 | per_visit | cat | yes | vet | Cat-friendly room signal |
| `ord-consult-wellness` | individual | consultation | 기본 신체검사 | 기본 신체검사 | 기본 신체검사 | active | Chart/Billing | 25000 | per_visit | dog,cat,other | yes | vet | Wellness scenario |
| `ord-lab-cbc` | individual | CBC검사 | CBC 검사 | CBC 검사 | CBC 검사 | active | Lab | 35000 | per_each | dog,cat,other | yes | technician | 혈구검사 mock |
| `ord-lab-cbc-baso` | individual | CBC검사 | `[CBC 검사] #BASO` | `[CBC 검사] #BASO` | CBC 검사 BASO | active | Lab | 12000 | per_each | dog,cat,other | yes | technician | Order 관리 table realism sample |
| `ord-lab-chem-basic` | individual | 혈액화학검사 | 기본 혈액화학 | 기본 혈액화학 | 혈액화학 기본패널 | active | Lab | 55000 | per_each | dog,cat,other | yes | technician | 간/신장 기본 패널 |
| `ord-lab-urinalysis` | individual | 요검사 | 소변검사 | 소변검사 | 소변검사 | active | Lab | 30000 | per_each | dog,cat,other | yes | technician | 고양이 배뇨 케이스 |
| `ord-lab-skin-cytology` | individual | 세포 검사 | 피부 도말검사 | 피부 도말검사 | 피부 도말검사 | active | Lab | 25000 | per_each | dog,cat,other | yes | technician | 피부/귀 케이스 |
| `ord-imaging-abd-us` | individual | imaging | 복부 초음파 | 복부 초음파 | 복부 초음파 | active | Imaging | 77000 | per_each | dog,cat,other | yes | vet/technician | 구토 케이스 |
| `ord-imaging-abd-xray` | individual | imaging | 복부 방사선 | 복부 방사선 | 복부 방사선 | active | Imaging | 55000 | per_each | dog,cat,other | yes | technician | Urinary/foreign body check |
| `ord-imaging-stifle-xray` | individual | imaging | 슬개골 방사선 | 슬개골 방사선 | 슬개골 방사선 | active | Imaging | 65000 | per_each | dog | yes | technician | Rehab scenario |
| `ord-treatment-sq-fluid` | individual | treatment | 피하 수액 | 피하 수액 | 피하 수액 처치 | active | Treatment | 18000 | per_each | dog,cat,other | yes | technician | Hydration demo |
| `ord-treatment-antiemetic-inj` | individual | treatment | 항구토 주사 | 항구토 주사 | 항구토 주사 | active | Treatment | 22000 | per_each | dog,cat,other | yes | technician | Synthetic medication action |
| `ord-treatment-analgesic-inj` | individual | treatment | 진통 주사 | 진통 주사 | 진통 주사 | active | Treatment | 22000 | per_each | dog,cat | yes | technician | Urinary and pain demo action |
| `ord-treatment-ear-cleaning` | individual | treatment | 귀 세정 처치 | 귀 세정 처치 | 귀 세정 처치 | active | Treatment | 18000 | per_each | dog,cat,other | yes | technician | Skin scenario |
| `ord-treatment-rehab-eval` | individual | treatment | 재활 평가 | 재활 평가 | 재활 평가 | active | Treatment | 45000 | per_visit | dog | yes | vet/technician | Premium rehab lane |
| `ord-treatment-laser-warm` | individual | treatment | 레이저/온열 처치 | 레이저/온열 처치 | 레이저/온열 처치 | active | Treatment | 32000 | per_each | dog,cat | yes | technician | Rehab demo |
| `ord-med-maropitant` | individual | medication | Maropitant 16mg T | Maropitant 16mg T | 항구토제 | active | Dispensing | 4500 | per_tablet | dog,cat | yes | technician | UI realism only; not dosage guidance |
| `ord-med-itch-control` | individual | medication | 항소양제 3일분 | 항소양제 3일분 | 피부 가려움 약 | active | Dispensing | 18000 | per_course | dog,cat | yes | technician | Synthetic prescription |
| `ord-med-pain-control` | individual | medication | 통증관리 약 3일분 | 통증관리 약 3일분 | 통증관리 약 | active | Dispensing | 21000 | per_course | dog | yes | technician | Rehab scenario |
| `ord-vaccine-cat-core` | individual | vaccine | 고양이 종합백신 | 고양이 종합백신 | 고양이 종합백신 | active | Treatment | 45000 | per_each | cat | yes | technician | Preventive scenario |
| `ord-service-deworming-counsel` | individual | misc | 구충 상담 | 구충 상담 | 구충 상담 | active | Chart | 0 | per_document | dog,cat,other | no | vet | Preventive care note only |
| `ord-service-owner-guide` | individual | misc | 보호자 안내문 | 보호자 안내문 | 보호자 안내 | active | Chart | 0 | per_document | dog,cat,other | no | vet | Care guide only |
| `ord-service-next-visit` | individual | misc | 다음 예약 안내 | 다음 예약 안내 | 다음 예약 안내 | active | Reception | 0 | per_document | dog,cat,other | no | front_desk | Reminder workflow |

## Future Fields

| Field | Why It Matters |
| --- | --- |
| `standardOrderId` | vendor/default preset identity |
| `workspaceOrderId` | hospital-customized identity |
| `version` | price/instruction/history management |
| `orderRowType` | stays `individual` in Order 관리; set records live in the separate Order 세트 data family |
| `availabilityStatus` | controls active, paused, and inactive selection states |
| `salesUnit` | keeps invoice quantity and unit wording consistent |
| `targetSpecies` | supports dog/cat/other filtering without implying medical guidance |
| `resultItemCategoryIds` | links lab orders to result-sheet item groups |
| `resultItemIds` | links a specific lab order to explicit result-sheet items |
| `defaultQuantity` | set/template expansion |
| `defaultPerformerRole` | queue routing |
| `billingCode` | invoice and accounting export candidate |
| `ownerGuideTemplateId` | owner communication |
| `internalInstruction` | technician execution detail |

## Deferred Screen-Implementation Notes

- Admin table sorting, filtering, drawer placement, dirty-state prompts, and field-level validation copy should be specified when the hospital admin screen is implemented.
- Visual category colors should be tokenized in UI work; this document only stores stable label/category data.
- External device names remain placeholders for portfolio workflow reproduction, not real integrations.
