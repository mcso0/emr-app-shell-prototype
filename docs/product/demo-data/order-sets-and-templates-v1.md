---
title: "Order Sets and Templates V1"
status: "draft"
updated: "2026-05-19"
owner: "product"
source_issue: "DEN-99"
---

# Order Sets and Templates V1

Order sets group individual orders. Templates group one or more order sets with diagnosis, SOAP, owner guide, and billing defaults.

## Definitions

| Term | Meaning |
| --- | --- |
| Individual order | Smallest actionable work unit, such as CBC or SQ fluid |
| Order set | A reusable bundle of individual orders |
| Clinical template | A visit-type template that can include diagnosis suggestions, SOAP scaffold, order sets, owner guide, and follow-up |
| Hospital override | Workspace-owned customized copy of a standard preset |

## Order Sets

| Set ID | Set Name | Scenario | Included Orders | Default Behavior |
| --- | --- | --- | --- | --- |
| `set-vomit-basic` | 구토 기본 세트 | 구토/설사 외래 | CBC, 복부 초음파, 피하 수액, 항구토 주사, 항구토제 | CBC and medication selected by default; ultrasound optional |
| `set-cat-urinary-basic` | 고양이 배뇨 기본 세트 | 고양이 배뇨 문제 | 고양이 진찰, 소변검사, 복부 방사선, 진통 주사, 피하 수액 | Cat room note attached |
| `set-skin-itch-basic` | 피부 가려움 기본 세트 | 피부/알러지 | 피부 도말검사, 귀 세정 처치, 항소양제, 보호자 안내문 | Owner guide selected by default |
| `set-cat-vaccine-wellness` | 고양이 예방접종 세트 | 예방접종 | 고양이 진찰, 고양이 종합백신, 다음 예약 안내 | Next appointment reminder required |
| `set-rehab-stifle-basic` | 슬개골/재활 기본 세트 | 재활 상담 | 슬개골 방사선, 재활 평가, 레이저/온열 처치, 통증관리 약 | Imaging required before rehab plan |

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

## Out Of Scope For V1

- Drug safety engine.
- Full dosage calculator.
- AI order recommendation.
- Marketplace or cross-hospital sharing.
- Real clinical guideline enforcement.
