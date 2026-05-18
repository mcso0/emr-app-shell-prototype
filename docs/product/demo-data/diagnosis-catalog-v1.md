---
title: "Diagnosis Catalog V1"
status: "draft"
updated: "2026-05-19"
owner: "product"
source_issue: "DEN-99"
---

# Diagnosis Catalog V1

This is a synthetic diagnosis catalog for product workflow design. It is not a clinical terminology import.

## Diagnosis Rules

- Use diagnosis systems to group chart SOAP sections and search results.
- Support catalog-linked and free-text diagnosis rows.
- Track suspected, differential, and confirmed states.
- Use terminology-code placeholders only; do not import licensed terminology without future review.
- Diagnosis selection may suggest order templates but must not automatically claim clinical correctness.

## Sample Diagnosis Systems

| System ID | Korean Label | Portfolio Use |
| --- | --- | --- |
| `dxsys-gi` | 소화기 | Vomiting/diarrhea scenario |
| `dxsys-urinary` | 비뇨기 | Cat urinary scenario |
| `dxsys-derm` | 피부 | Allergy/itch scenario |
| `dxsys-preventive` | 예방/건강검진 | Vaccine/wellness scenario |
| `dxsys-msk` | 근골격/재활 | Stifle/rehab scenario |
| `dxsys-dental` | 치과 | Future dental workflow |
| `dxsys-eye` | 안과 | Future eye workflow |
| `dxsys-respiratory` | 호흡기 | Future cough workflow |
| `dxsys-pain` | 통증관리 | Rehab/pain management |

## Sample Diagnoses

| Diagnosis ID | System | Diagnosis Name | Default Status | Search Terms | Suggested Template |
| --- | --- | --- | --- | --- | --- |
| `dx-acute-gi-suspect` | 소화기 | 급성 위장관염 의심 | suspected | 구토, 설사, 위장염, GI | `tpl-gi-vomit` |
| `dx-dehydration-suspect` | 소화기 | 탈수 의심 | suspected | 탈수, 수액, 구토 | `tpl-gi-vomit` |
| `dx-foreign-body-ddx` | 소화기 | 이물 가능성 감별 | differential | 이물, 장폐색, 초음파 | `tpl-gi-vomit` |
| `dx-cystitis-suspect` | 비뇨기 | 방광염 의심 | suspected | 혈뇨, 빈뇨, 소변 | `tpl-cat-urinary` |
| `dx-flutd-ddx` | 비뇨기 | 하부요로질환 감별 | differential | FLUTD, 배뇨, 고양이 | `tpl-cat-urinary` |
| `dx-urethral-risk` | 비뇨기 | 요도폐색 위험 확인 | differential | 폐색, 응급, 배뇨곤란 | `tpl-cat-urinary` |
| `dx-allergic-dermatitis` | 피부 | 알러지성 피부염 의심 | suspected | 가려움, 피부염, 알러지 | `tpl-skin-itch` |
| `dx-otitis-suspect` | 피부 | 외이염 의심 | suspected | 귀, 냄새, 긁음 | `tpl-skin-itch` |
| `dx-yeast-skin-ddx` | 피부 | 효모성 피부염 감별 | differential | yeast, 도말, 피부 | `tpl-skin-itch` |
| `dx-wellness-normal` | 예방/건강검진 | 건강검진 정상 | confirmed | 건강검진, 정상, wellness | `tpl-cat-vaccine` |
| `dx-vaccine-counsel` | 예방/건강검진 | 예방접종 상담 | confirmed | 백신, 접종, 예방 | `tpl-cat-vaccine` |
| `dx-stifle-luxation` | 근골격/재활 | 슬개골 탈구 의심 | suspected | 슬개골, 파행, 후지 | `tpl-rehab-stifle` |
| `dx-chronic-pain` | 통증관리 | 만성 통증 관리 상담 | suspected | 통증, 재활, 노령 | `tpl-rehab-stifle` |
| `dx-dental-tartar` | 치과 | 치석/치은염 상담 | suspected | 치석, 구취, 치과 | future |
| `dx-conjunctivitis` | 안과 | 결막염 의심 | suspected | 눈곱, 충혈, 안과 | future |
| `dx-cough-ddx` | 호흡기 | 기침 원인 감별 | differential | 기침, 호흡기, 기관 | future |

## Search Behavior

- Search should match Korean labels, English shorthand, synonyms, and scenario terms.
- Free-text diagnosis rows should be allowed but marked as catalog-unlinked.
- Diagnosis system tabs can create SOAP sections.
- Deleting a diagnosis should not delete the chart note automatically.

## Future Product Questions

- Should diagnosis catalog be global, workspace-owned, or mixed?
- Should VetSCT/SNOMED identifiers be optional references?
- Which roles can create hospital-local diagnosis aliases?
- Should diagnosis selection suggest order sets automatically or only show a recommendation panel?
