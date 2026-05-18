---
title: "Staff Roles and Workflow V1"
status: "draft"
updated: "2026-05-19"
owner: "product"
source_issue: "DEN-99"
---

# Staff Roles and Workflow V1

## Role Matrix

| Role | Korean Label | Core Screens | Can Do In Demo | Should Not Do |
| --- | --- | --- | --- | --- |
| `front_desk` | 데스크 | Reception, Customer | 예약 확인, 현장접수, 보호자/환자 등록, 다음 예약 안내 | 차트 확정, 오더 확정, 수납 완료 |
| `vet` | 수의사 | Chart, Imaging review | SOAP 작성, 진단명 선택, 오더 발행, 차트 작성완료 | 병원 전체 권한 관리 |
| `technician` | 테크니션 | Lab, Imaging, Dispensing, Treatment | 검사/영상/조제/처치 업무 시작/완료, 결과 초안 입력 | 진단 확정, 결제 처리 |
| `billing_admin` | 수납 담당 | Billing | 청구 항목 확인, 수량/할인 조정, 미납/완료 처리 | 의료 판단 변경 |
| `hospital_admin` | 병원관리자 | Hospital Admin, Home | 직원/역할/오더 카탈로그 관리, 운영 현황 확인 | 단독 의료 판단 자동화 |

## Workflow Ownership

| Step | Owner | Input | Output |
| --- | --- | --- | --- |
| Appointment or walk-in reception | `front_desk` | Guardian/patient, visit reason | Appointment checked in or encounter created |
| Initial chart | `vet` | Encounter, patient context | SOAP draft, diagnosis rows |
| Order selection | `vet` | Diagnosis/template/order catalog | Draft orders |
| Order confirmation | `vet` | Selected draft orders | Confirmed orders and destination work items |
| Lab execution | `technician` | Lab queue work item | Lab result draft |
| Imaging execution | `technician` + `vet` | Imaging queue work item | Imaging finding and vet interpretation |
| Dispensing | `technician` | Medication order | Dispensing completed state |
| Treatment | `technician` | Injection/fluid/rehab order | Treatment completed state |
| Chart completion | `vet` | Results and completed work | Signed/completed chart state |
| Billing confirmation | `billing_admin` | Invoice candidates | Invoice issued/unpaid/completed |
| Catalog management | `hospital_admin` | Standard presets | Workspace custom orders/sets/templates |

## Activity Events To Demonstrate

| Event | Actor | Why It Matters |
| --- | --- | --- |
| `encounter_created` | front_desk | Outpatient workflow starts |
| `chart_saved` | vet | Medical note continuity |
| `diagnosis_added` | vet | Diagnosis-driven workflow |
| `order_added` | vet | Order catalog usage |
| `order_confirmed` | vet | Operational handoff |
| `lab_result_entered` | technician | Result returns to chart |
| `treatment_completed` | technician | Task completion |
| `invoice_line_created` | system | Billing sync from order |
| `payment_completed` | billing_admin | Visit closes financially |
| `catalog_item_updated` | hospital_admin | Hospital customization trace |

## UX Proof Points

- Multiple roles see different next actions.
- Work does not disappear on module navigation.
- A task card carries patient, encounter, order, status, and owner.
- The same encounter appears in chart, lab, imaging, treatment, dispensing, and billing.
- Catalog changes are admin-owned and traceable.
