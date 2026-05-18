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

## Individual Orders

| Order ID | Category | In-hospital Name | Billing Name | Destination | Price KRW | Billable | Default Staff | Notes |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `ord-consult-basic` | consultation | 외래 진찰 | 외래 진찰료 | Chart/Billing | 22000 | yes | vet | 기본 외래 진료비 |
| `ord-consult-cat` | consultation | 고양이 친화 진찰 | 고양이 진찰료 | Chart/Billing | 28000 | yes | vet | Cat-friendly room signal |
| `ord-lab-cbc` | lab | CBC 검사 | CBC 검사 | Lab | 35000 | yes | technician | 혈구검사 mock |
| `ord-lab-chem-basic` | lab | 기본 혈액화학 | 혈액화학 기본패널 | Lab | 55000 | yes | technician | 간/신장 기본 패널 |
| `ord-lab-urinalysis` | lab | 소변검사 | 소변검사 | Lab | 30000 | yes | technician | 고양이 배뇨 케이스 |
| `ord-lab-skin-cytology` | lab | 피부 도말검사 | 피부 도말검사 | Lab | 25000 | yes | technician | 피부/귀 케이스 |
| `ord-imaging-abd-us` | imaging | 복부 초음파 | 복부 초음파 | Imaging | 77000 | yes | vet/technician | 구토 케이스 |
| `ord-imaging-abd-xray` | imaging | 복부 방사선 | 복부 방사선 | Imaging | 55000 | yes | technician | urinary/foreign body check |
| `ord-imaging-stifle-xray` | imaging | 슬개골 방사선 | 슬개골 방사선 | Imaging | 65000 | yes | technician | rehab scenario |
| `ord-treatment-sq-fluid` | treatment | 피하 수액 | 피하 수액 처치 | Treatment | 18000 | yes | technician | hydration demo |
| `ord-treatment-antiemetic-inj` | treatment | 항구토 주사 | 항구토 주사 | Treatment | 22000 | yes | technician | synthetic medication action |
| `ord-treatment-ear-cleaning` | treatment | 귀 세정 처치 | 귀 세정 처치 | Treatment | 18000 | yes | technician | skin scenario |
| `ord-treatment-rehab-eval` | treatment | 재활 평가 | 재활 평가 | Treatment | 45000 | yes | vet/technician | premium rehab lane |
| `ord-treatment-laser-warm` | treatment | 레이저/온열 처치 | 레이저/온열 처치 | Treatment | 32000 | yes | technician | rehab demo |
| `ord-med-maropitant` | medication | Maropitant 16mg T | 항구토제 | Dispensing | 4500 | yes | technician | UI realism only |
| `ord-med-itch-control` | medication | 항소양제 3일분 | 피부 가려움 약 | Dispensing | 18000 | yes | technician | synthetic prescription |
| `ord-med-pain-control` | medication | 통증관리 약 3일분 | 통증관리 약 | Dispensing | 21000 | yes | technician | rehab scenario |
| `ord-vaccine-cat-core` | vaccine | 고양이 종합백신 | 고양이 종합백신 | Treatment | 45000 | yes | technician | preventive scenario |
| `ord-service-owner-guide` | misc | 보호자 안내문 | 보호자 안내 | Chart | 0 | no | vet | care guide only |
| `ord-service-next-visit` | misc | 다음 예약 안내 | 다음 예약 안내 | Reception | 0 | no | front_desk | reminder workflow |

## Future Fields

| Field | Why It Matters |
| --- | --- |
| `standardOrderId` | vendor/default preset identity |
| `workspaceOrderId` | hospital-customized identity |
| `version` | price/instruction/history management |
| `defaultQuantity` | set/template expansion |
| `defaultPerformerRole` | queue routing |
| `billingCode` | invoice and accounting export candidate |
| `ownerGuideTemplateId` | owner communication |
| `internalInstruction` | technician execution detail |
