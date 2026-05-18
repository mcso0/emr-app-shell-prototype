---
title: "Virtual Hospital Profile"
status: "draft"
updated: "2026-05-19"
owner: "product"
source_issue: "DEN-99"
---

# Virtual Hospital Profile

## Hospital

| Field | Value |
| --- | --- |
| Workspace ID | `vip-cheongdam-demo` |
| Hospital name | VIP동물의료센터 청담점 |
| Positioning | 고급형 중형 동물의료센터 |
| Species focus | Dogs and cats |
| Operating model | 한 건물 안에 개, 고양이, 재활, 한방/통증관리, 검사/영상, 조제/처치, 수납 부서가 함께 운영되는 구조 |
| Portfolio signal | 여러 환자와 여러 업무가 동시에 흘러도 끊기지 않는 EMR command center |

## Hospital Layout

| Area | Purpose | Screens That Should Reflect It |
| --- | --- | --- |
| Reception desk | 예약, 현장접수, 보호자/환자 확인 | Reception, Home |
| Dog outpatient room | 일반 외래, 예방, 피부, 소화기 | Chart, Treatment |
| Cat-friendly room | 고양이 전용 또는 우선 진료 | Reception, Chart, Lab, Imaging |
| Lab room | CBC, chemistry, urinalysis, cytology | Lab |
| Imaging room | X-ray, ultrasound | Imaging |
| Dispensing room | Oral medication, owner medication guide | Dispensing |
| Treatment room | Injection, fluids, wound care, nursing procedures | Treatment |
| Rehab/acupuncture room | Rehab consult, pain care, acupuncture-style demo orders | Treatment, Future Rehab |
| Billing desk | Invoice review, unpaid/completed payment states | Billing |
| Hospital admin | Order catalog and workspace/team settings | Hospital Admin |

## Demo Staff

| Staff ID | Name | Role | Primary Screens | Notes |
| --- | --- | --- | --- | --- |
| `staff-admin-minjae` | 송민재 | hospital_admin | Hospital Admin, Home | 병원 운영/오더 카탈로그 관리 |
| `staff-vet-yuji` | 이유지 | vet | Chart, Imaging review | 소화기/고양이 케이스 담당 |
| `staff-vet-doyun` | 김도윤 | vet | Chart, Rehab/Pain | 피부/재활/통증 케이스 담당 |
| `staff-tech-hayoon` | 송하윤 | technician | Lab, Treatment, Dispensing | 검사/처치/조제 실행 |
| `staff-tech-jieun` | 박지은 | technician | Imaging, Treatment | 영상 촬영/처치 보조 |
| `staff-desk-seoyeon` | 한서연 | front_desk | Reception, Customer | 예약/접수/보호자 안내 |
| `staff-billing-arin` | 정아린 | billing_admin | Billing | 청구/미납/수납 마감 |

## Demo Principles

- The hospital should feel busy but controlled.
- Dog and cat cases should have different handling and room signals.
- Premium positioning should appear through clear handoffs, staff ownership, and rich but not noisy documentation.
- The dataset should include normal, delayed, unpaid, completed, and rework states.
- Hospital-admin catalog changes should be able to affect later chart order selection in the future.
