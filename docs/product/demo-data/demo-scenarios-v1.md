---
title: "Demo Scenarios V1"
status: "draft"
updated: "2026-05-19"
owner: "product"
source_issue: "DEN-99"
---

# Demo Scenarios V1

These scenarios are synthetic. They are designed to show workflow continuity, not medical correctness.

## Scenario Summary

| Scenario ID | Name | Patient | Visit Type | Core Flow | Portfolio Moment |
| --- | --- | --- | --- | --- | --- |
| `scenario-kong-vomit` | 구토/설사 강아지 외래 | 콩이, dog, 4y | 예약 접수 | Reception -> Chart -> Lab/Imaging/Treatment/Dispensing -> Billing | Order set fans out to multiple departments |
| `scenario-nabi-urinary` | 고양이 배뇨 문제 | 나비, cat, 5y | 현장 접수 | Reception -> Cat room chart -> Lab/Imaging -> Treatment -> Billing | Cat-friendly workflow and urinary workup |
| `scenario-bori-skin` | 피부 가려움/알러지 | 보리, dog, 7y | 예약 접수 | Reception -> Chart -> Skin test/Treatment/Dispensing -> Billing | Diagnosis-driven order template |
| `scenario-haru-vaccine` | 예방접종/건강검진 | 하루, cat, 1y | 예약 접수 | Reception -> Wellness chart -> Vaccine/Treatment -> Next appointment -> Billing | Preventive care and next visit scheduling |
| `scenario-moka-rehab` | 슬개골/재활 상담 | 모카, dog, 8y | 현장 접수 | Reception -> Chart -> Imaging -> Rehab treatment plan -> Billing | Premium rehab/pain management lane |

## Scenario Details

### 1. 구토/설사 강아지 외래

| Field | Value |
| --- | --- |
| Guardian | 김하늘 |
| Patient | 콩이, 말티즈, 4세, 2.3kg |
| Reason | 새벽부터 반복 구토, 식욕 저하 |
| Reception | 예약 접수, 담당 수의사 이유지 |
| Chart focus | Vitals, abdominal discomfort note, acute GI differential |
| Diagnosis samples | 급성 위장관염 의심, 탈수 의심 |
| Orders | CBC 검사, 복부 초음파, 피하 수액 처치, 항구토 주사, 항구토제 조제 |
| Results | CBC mild stress pattern, ultrasound no obstruction mock finding |
| Billing | Consultation, lab, imaging, treatment, medication lines |

### 2. 고양이 배뇨 문제

| Field | Value |
| --- | --- |
| Guardian | 오지민 |
| Patient | 나비, 러시안블루, 5세, 4.1kg |
| Reason | 화장실을 자주 가고 소변량이 적음 |
| Reception | 현장 접수, cat-friendly room 배정 |
| Chart focus | Stress-aware handling, urinary signs, pain score |
| Diagnosis samples | 방광염 의심, 하부요로질환 감별 |
| Orders | 소변검사, 복부 방사선, 진통 주사, 수액 처치 |
| Results | Urinalysis mock abnormal specific gravity, imaging no stone note |
| Billing | Cat consult, urinalysis, imaging, injection, treatment |

### 3. 피부 가려움/알러지

| Field | Value |
| --- | --- |
| Guardian | 박서준 |
| Patient | 보리, 푸들, 7세, 5.8kg |
| Reason | 귀와 발을 반복적으로 긁음 |
| Reception | 예약 접수 |
| Chart focus | Skin lesion distribution, owner history, itch score |
| Diagnosis samples | 알러지성 피부염 의심, 외이염 의심 |
| Orders | 피부 도말검사, 귀 세정 처치, 항소양제 조제, 보호자 피부관리 안내 |
| Results | Cytology mock yeast-like finding |
| Billing | Skin test, treatment, medication, care guide |

### 4. 예방접종/건강검진

| Field | Value |
| --- | --- |
| Guardian | 윤소미 |
| Patient | 하루, 코리안숏헤어, 1세, 3.4kg |
| Reason | 1년차 예방접종과 기본 건강검진 |
| Reception | 예약 접수 |
| Chart focus | Wellness exam, vaccine history, next reminder |
| Diagnosis samples | 예방접종 상담, 건강검진 정상 |
| Orders | 기본 신체검사, 고양이 종합백신, 구충 상담, 다음 예약 |
| Results | No lab required in MVP scenario |
| Billing | Wellness consult, vaccine line, reminder note |

### 5. 슬개골/재활 상담

| Field | Value |
| --- | --- |
| Guardian | 최민호 |
| Patient | 모카, 포메라니안, 8세, 3.1kg |
| Reason | 산책 후 우측 후지 파행 |
| Reception | 현장 접수 |
| Chart focus | Gait observation, orthopedic exam, pain score |
| Diagnosis samples | 슬개골 탈구 의심, 만성 통증 관리 상담 |
| Orders | 슬개골 방사선, 재활 평가, 레이저/온열 처치, 통증관리 상담 |
| Results | Imaging mock grade note, rehab plan draft |
| Billing | Imaging, rehab consult, treatment package candidate |

## Scenario Acceptance Criteria

- Each scenario has one `encounterId`.
- Each order line has a source order catalog ID.
- Each confirmed order can create a queue work item or invoice candidate.
- Each billing line traces back to an order or a consult/service item.
- Each scenario can be reset to initial demo state.
