---
title: "Order Sets and Templates V1"
status: "draft"
updated: "2026-05-19"
owner: "product"
source_issue: "DEN-99"
---

# Order Sets and Templates V1

Order sets group individual orders. Templates group one or more order sets with diagnosis, SOAP, owner guide, and billing defaults.

Pricing-specific behavior for set fixed price, included-order sum, range price, and chart-applied snapshots lives in `order-pricing-rules-v1.md`.

Product decision: Order sets are managed in a separate hospital-admin Order 세트 surface. They are not edited inside the individual Order 관리 table, but chart-side order search can still show individual orders, sets, and templates together for applying to an encounter.

## Definitions

| Term | Meaning |
| --- | --- |
| Individual order | Smallest actionable work unit, such as CBC or SQ fluid |
| Order set | A reusable bundle of individual orders |
| Clinical template | A visit-type template that can include diagnosis suggestions, SOAP scaffold, order sets, owner guide, and follow-up |
| Hospital override | Workspace-owned customized copy of a standard preset |
| Admin row type | Order-set management label for set records; individual orders use `order-catalog-v1.md` |

## Order Sets

| Set ID | Set Name | Scenario | Included Orders | Default Behavior |
| --- | --- | --- | --- | --- |
| `set-vomit-basic` | 구토 기본 세트 | 구토/설사 외래 | `ord-lab-cbc`, `ord-lab-cbc-baso`, `ord-imaging-abd-us`, `ord-treatment-sq-fluid`, `ord-treatment-antiemetic-inj`, `ord-med-maropitant` | CBC and medication selected by default; ultrasound optional |
| `set-cat-urinary-basic` | 고양이 배뇨 기본 세트 | 고양이 배뇨 문제 | `ord-consult-cat`, `ord-lab-urinalysis`, `ord-imaging-abd-xray`, `ord-treatment-analgesic-inj`, `ord-treatment-sq-fluid` | Cat room note attached |
| `set-skin-itch-basic` | 피부 가려움 기본 세트 | 피부/알러지 | `ord-lab-skin-cytology`, `ord-treatment-ear-cleaning`, `ord-med-itch-control`, `ord-service-owner-guide` | Owner guide selected by default |
| `set-cat-vaccine-wellness` | 고양이 예방접종 세트 | 예방접종 | `ord-consult-cat`, `ord-consult-wellness`, `ord-vaccine-cat-core`, `ord-service-deworming-counsel`, `ord-service-next-visit` | Next appointment reminder required |
| `set-rehab-stifle-basic` | 슬개골/재활 기본 세트 | 재활 상담 | `ord-imaging-stifle-xray`, `ord-treatment-rehab-eval`, `ord-treatment-laser-warm`, `ord-med-pain-control` | Imaging required before rehab plan |

## Order Set Admin Rows

Order sets should appear as `세트` rows in the separate hospital-admin Order 세트 management surface. They are selectable presets in chart-side search, but invoice lines still come from expanded individual orders unless a future package-billing rule explicitly says otherwise.

| Set ID | Admin Row Type | Set Category | Set Name | Billing Name | Included Sets | Included Orders | Amount Basis | Set Price KRW | Unit | Availability | Target |
| --- | --- | --- | --- | --- | ---: | ---: | --- | ---: | --- | --- | --- |
| `set-vomit-basic` | 세트 | 내복약 조제 세트 | 구토 기본 세트 | 구토 기본 세트 | 0 | 6 | included_order_sum | 0 | per_each | active | dog,cat,other |
| `set-cat-urinary-basic` | 세트 | 검사/처치 세트 | 고양이 배뇨 기본 세트 | 고양이 배뇨 기본 세트 | 0 | 5 | included_order_sum | 0 | per_each | active | cat |
| `set-skin-itch-basic` | 세트 | 피부/귀 세트 | 피부 가려움 기본 세트 | 피부 가려움 기본 세트 | 0 | 4 | included_order_sum | 0 | per_each | active | dog,cat |
| `set-cat-vaccine-wellness` | 세트 | 건강검진 세트 | 고양이 예방접종 세트 | 건강검진 | 0 | 5 | set_fixed_price | 500000 | per_each | active | cat |
| `set-rehab-stifle-basic` | 세트 | 재활 세트 | 슬개골/재활 기본 세트 | 슬개골/재활 기본 세트 | 0 | 4 | range_price | 0 | per_each | active | dog |

## Order Set List Field Contract

The Order 세트 management page should support a table-oriented admin workflow.

| Field | Demo Meaning | Example |
| --- | --- | --- |
| `setCategory` | Group shown in the first table column | 내복약 조제 세트 |
| `setName` | Staff-facing set name | 감기약 세트 |
| `billingName` | Owner invoice-facing set name when billing reflection is enabled | 감기약 |
| `memo` | Short admin note | texttext |
| `availabilityStatus` | Toggle-backed use status | active, inactive |
| `includedOrderSummary` | Visible summary of included orders | 아스피린, 기침약 |
| `includedSetCount` | Number of nested sets included for portfolio realism | 2 |
| `includedOrderCount` | Number of individual orders included | 4 |
| `amountBasis` | How the set amount is calculated | set_fixed_price, included_order_sum, range_price |
| `setPriceKrw` | Set-level price when applicable | 500000 |
| `salesUnit` | Sales unit shown with set price | per_each |
| `detailAction` | Opens the set drawer | 자세히 |

## Order Set Drawer Field Contract

The Order세트 추가/detail drawer should make the set usable for both chart ordering and billing handoff.

| Drawer Field | Required | Demo Meaning |
| --- | --- | --- |
| `category` | no | Set category dropdown; default can be 전체 |
| `setName` | yes | Staff-facing set name |
| `billingName` | yes | Invoice-facing name; can be separately toggled for billing reflection |
| `billingReflectionEnabled` | no | Whether the set billing name is reflected on owner-facing invoice behavior |
| `memo` | no | Internal admin memo, max 500 characters in the reference UI |
| `careGuide` | no | Owner-facing care guide text, max 500 characters in the reference UI |
| `careGuideDeliveryEnabled` | no | Whether care guide content is sent/shared in the demo workflow |
| `internalInstruction` | no | Staff-only execution note, max 500 characters in the reference UI |
| `amountBasis` | yes | Set-only amount, included-order sum, or range price |
| `setPriceKrw` | conditional | Required when amount basis uses a set-only price |
| `taxType` | yes | Demo tax marker such as taxable or non-taxable |
| `schedulerRule` | no | Repeat/follow-up schedule text, such as next-cycle interval |
| `schedulerEnabled` | no | Whether scheduler behavior is used |
| `changeHistory` | no | Last changed timestamp and actor display |
| `includedOrders` | no | Table rows for included order category, order name, billing name, billing reflection, unit price, quantity, amount, and tax marker |
| `sourceSetVersion` | no | Version used when a set is expanded into chart rows |
| `appliedSnapshot` | no | Frozen names, prices, tax, amount basis, and included-order order used by a chart-applied set |

Empty order sets are allowed in the admin drawer. They should save set metadata first, then let chart or admin workflows add included orders later.

## Included Order Row Contract

Included order rows are set-composition data. They are not separate chart rows until the set is applied to an encounter.

| Field | Demo Meaning | Example |
| --- | --- | --- |
| `setItemId` | Stable row identity inside the set | `setitem-vomit-cbc` |
| `parentSetId` | Set that owns this row | `set-vomit-basic` |
| `childPresetId` | Included order or nested set preset | `ord-lab-cbc` |
| `childRowType` | Whether the child is an individual order or nested set | `individual`, `set` |
| `sortOrder` | Expansion order copied into chart rows | `10` |
| `rowDepth` | Nested depth for future expansion | `1` |
| `defaultSelected` | Whether the child starts selected when the set is added | `true` |
| `billingReflectionDefault` | Whether the child contributes to billing after set expansion | `true`, `false` |
| `defaultQuantity` | Quantity copied when the set creates chart rows | `1` |
| `quantitySource` | Why the quantity starts that way | `fixed_one`, `preset_quantity`, `manual_at_apply` |
| `unitPriceSnapshotKrw` | Price copied from the child preset for deterministic demo fixtures | `35000` |
| `taxTypeSnapshot` | Tax marker copied from the child preset | `taxable` |
| `childAmountSnapshotKrw` | Initial child amount before chart edits | `35000` |

For `included_order_sum`, only child rows with billing reflection enabled should contribute to the set's derived amount. For `set_fixed_price` and `range_price`, child rows stay traceable but do not control the set amount unless the user explicitly enables extra child billing.

## Set Expansion Data Rules

- Applying a set creates one parent `chartOrderLine` and child `chartOrderLine` rows for included orders.
- Each expanded child row keeps `sourceSetId`, `parentChartOrderLineId`, `setItemId`, `sortOrder`, and copied pricing fields.
- Nested sets should preserve both their own parent row and each individual child row so billing, queue routing, and traceability remain explainable.
- Admin changes to set composition affect future set applications only; existing chart rows keep their applied snapshot.

## Deferred Screen-Implementation Notes

Set drawer UX rules from the reference should be finalized during screen implementation:

- New set availability can start off until the set is intentionally activated.
- Save should stay disabled until required fields are complete or meaningful edits exist.
- Cancel after editing should warn that unsaved input will be lost.
- Included order row order affects future chart expansion order only.
- Already chart-applied orders should keep their applied snapshot even if the set preset changes later.
- Included order rows can be reordered within the same set, but moving rows outside the set should revert.

## Clinical Templates

| Template ID | Name | Diagnosis Suggestions | SOAP Scaffold | Included Sets | Portfolio Use |
| --- | --- | --- | --- | --- | --- |
| `tpl-gi-vomit` | 구토/설사 외래 템플릿 | 급성 위장관염 의심, 탈수 의심, 이물 가능성 감별 | 보호자 진술, 활력, 복부 촉진, 검사/처치 계획 | `set-vomit-basic` | Shows one-click order expansion |
| `tpl-cat-urinary` | 고양이 배뇨 문제 템플릿 | 방광염 의심, 하부요로질환 감별, 요도폐색 위험 확인 | Cat-friendly handling, pain score, urination history | `set-cat-urinary-basic` | Shows cat-specific workflow |
| `tpl-skin-itch` | 피부 소양감 템플릿 | 알러지성 피부염 의심, 외이염 의심, 세균/효모 감염 감별 | Itch score, lesion map, owner home care | `set-skin-itch-basic` | Shows diagnosis-driven care guide |
| `tpl-cat-vaccine` | 고양이 예방접종 템플릿 | 예방접종 상담, 건강검진 정상 | Wellness exam, vaccine history, next reminder | `set-cat-vaccine-wellness` | Shows preventive flow |
| `tpl-rehab-stifle` | 슬개골/재활 템플릿 | 슬개골 탈구 의심, 만성 통증 관리 상담 | Gait, orthopedic exam, pain score, rehab plan | `set-rehab-stifle-basic` | Shows premium lane |

## MVP Interaction Rules

- Chart order add should search individual orders, sets, and templates.
- Expanding a set creates draft order rows with source set metadata.
- Confirmed orders generate destination queue work items and invoice candidates.
- Templates should not auto-finalize clinical judgment; they only prefill drafts.
- Hospital admins can duplicate a standard set or template into a workspace custom copy in a future iteration.
- If a set is paused or inactive in the admin catalog, chart search should not offer it as a new preset, but historical orders should remain readable.
- Set expansion should preserve `sourceSetId` on each draft order so the portfolio demo can explain why several department tasks appeared at once.
- Set-level billing should not hide expanded order traceability; the portfolio demo must still show which individual orders produced downstream queues and invoice candidates.
- Set pricing and child billing reflection rules should follow `order-pricing-rules-v1.md`.
- Care guide and internal instruction are workflow communication fields, not medical advice.

## Out Of Scope For V1

- Drug safety engine.
- Full dosage calculator.
- AI order recommendation.
- Marketplace or cross-hospital sharing.
- Real clinical guideline enforcement.
