---
id: "CLINICAL-MASTER-OED-LAB-01-REPORT"
type: "Research Report"
title: "Clinical Laboratory 86-Order Landscape Research"
description: "임상병리 마스터 오더 86건의 현재 구조, 외부 근거, 목표 계층, 수행 경로, 장비 종류, 결과 모양과 다음 작업 인계를 정리한 AI용 조사 원문이다."
status: "draft"
area: "clinical-master"
tags: [clinical-master, laboratory, deep-research, order-set, atomic-result]
updated: "2026-09-06"
---

# OED-LAB-01 임상병리 검사 86개 외부 전체 구조 조사

## 결론

86개를 로컬 고정 목록·V4 표본·기존 비적용 후보와 대조했다. 검사군별 외부 자료는 구조를 정리하는 데 사용했으며 개별 검사법·수치까지 검증한 것은 아니다. 로컬 표본에는 검사 세트와 개별 결과 정의가 일부 있지만 **세트 → 독립 하위 오더 → 결과값** 구조는 보완이 필요하다.

로컬 V4 표본의 CBC에는 WBC·HCT·PLT 세 항목만 연결돼 있다. 72개 검사 정의 중 16개는 독립 order profile이 없다. 건강검진·노령·응급 검사 조합은 기존 패널 하나를 가리키며, 종·검체·검사법·장비별 정상범위와 판별 규칙을 담은 버전 프로필도 이 표본에서 확인되지 않는다. 실제 DB와 앱의 지원 범위는 OED-LAB-03에서 별도로 확인한다.

이번 조사는 구조를 정리한 단계다. 앱, DB, Airtable, Supabase, 마스터 오더에는 아무것도 적용하지 않았다. 정확한 CBC 항목과 프로토타입용 대표 값을 고정하는 다음 작업은 `OED-LAB-02`다.

## 2026-09-06 보정 결과

86건의 분류와 검체 표기, 근거 연결을 다시 대조했다. 범백혈구감소증 항원 검사는 CBC에서 감염성 검사로, 마취 전 확장 검사 조합은 혈액화학에서 복합 검사 조합으로 바로잡았다. 미등록 ID를 혈액화학으로 자동 분류하던 처리도 제거했다.

이전 WP-01A 비적용 후보의 검체와 로컬 V4 표본의 검체 표기가 충돌하는 항목은 5건이다. 요단백 평가 패널, 감염성 선별 패널, 개 파보 항원, 개 디스템퍼 항원, 고양이 범백혈구감소증 항원 검사다. 두 자료를 비교한 결과이며 특정 제품에서 허용하는 검체를 확정한 것은 아니다. 패널은 하위 검사마다 검체가 다를 수 있다.

나머지는 같은 검체 표기 27건, 혈액 채취·처리 조건 미지정 38건, 후보 검체 없음 12건, 채취 검체와 표본 제작 형태의 구분 필요 2건, 후보가 other로만 지정된 항목 1건, 로컬 검사 연결 없음 1건이다. 검체가 일치해도 임상 검증 완료를 뜻하지 않는다. 원본 후보와 표본은 수정하지 않았다.

기존 currentDefaultSummary라는 이름 때문에 이전 후보가 현재 기본값처럼 보였다. 이를 priorCandidateDefaults로 바꾸고 비적용 후보라는 출처를 명시했다. 실제 원격 마스터·병원관리 값을 읽은 결과는 아니다.

검사군 자료가 있다는 이유로 개별 검사까지 확인 완료로 표시하던 처리도 수정했다. 85건은 source_partial, 레거시 예외 1건은 functional_fixture_required다. 이 상태는 조사 근거를 어디까지 확보했는지만 나타낸다. 오더 사용 가능 상태나 검수 대기 상태는 바꾸지 않는다. 검사별 정확한 방법과 정상범위 숫자는 이번 단계에서 추출하지 않았다.

수행 경로와 장비는 검사군 후보로만 표시한다. 개별 검사에 대한 지원 여부는 후속 조사에서 확인한다. 개별 오더에 검사군 전체 하위 목록을 붙이던 추천도 제거했다.

다음은 OED-LAB-02에서 CBC의 하위 항목, 대표 프로필, 단위·정상범위·판별, 단일 항목 재검 후보를 완성하는 일이다. 이번 보정은 조사 파일과 보고서에만 반영했다. 앱·DB·마스터에는 적용하지 않았다.

보정 검증은 로컬 회귀 테스트 7개 통과, 생성 원문과 최종 보고서 표 일치, 입력 파일·산출물 해시 일치까지 확인했다. HTML은 전체 86건, CBC 검색 4건, 범백 검색 1건이며 데스크톱·모바일 너비에서 가로 넘침과 브라우저 오류가 없었다. 실제 앱 화면 검증은 이번 범위에 포함하지 않았다. 전체 문서 검사는 기존 persona 안내서 링크 오류 1건으로 실패했고 해당 파일은 수정하지 않았다.

## 조사 범위와 경계

- 기준 목록은 WP-00의 `clinical_lab` 86건이다.
- 레포의 V4 authoring fixture에 있는 72개 검사 정의, 18개 패널, 120개 연결, 85개 오더 프로필을 함께 대조했다.
- 외부 근거는 표준기관, 수의임상병리 전문단체, 수의과대학 검사실, 제조사 공식 메뉴·설명서만 사용했다.
- 숫자 정상범위를 마스터 후보로 옮기지 않았다. 이 조사에서 확인한 것은 구조, 값의 형태, 자료 확보 가능성과 대표 수행 경로다.
- 실제 병원의 장비 보유나 시스템 연동을 가정하지 않았다. 장비 결과 입력은 현재 모두 `not_integrated + manual_entry`다.
- 찾지 못한 값은 런타임 fallback으로 채우지 않는다. 필요한 경우 후속 단계에서 CLAiR 데모 프로필의 `synthetic_functional_fixture`로 명시한다.

## 현재 구조를 숫자로 보면

| 항목 | 현재 확인값 | 의미 |
| --- | ---: | --- |
| 임상병리 오더 | 86 | 이번 조사 전체 범위 |
| 검사 결과 정의 | 72 | 수치·정성·서술 결과를 정의한 현재 lab_test 수 |
| 검사 패널 정의 | 18 | 현재 lab_panel 수 |
| 패널-검사 연결 | 120 | 평면 panel → lab_test 연결 수 |
| 오더-검사 프로필 | 85 | 86개 중 1개가 연결되지 않음 |
| 직접 주문 가능한 검사 정의 | 56 | lab_test와 직접 연결된 order profile 수 |
| 독립 주문 연결이 없는 검사 정의 | 16 | 로컬 V4 표본에 독립 order profile이 없음 |
| 중첩 검사 패널 | 0 | 로컬 V4 검사 연결 기준; 실제 DB 지원 여부는 별도 조사 |
| 앱·DB 적용 | 0 | 전부 비적용 조사 자료 |

## 외부 조사에서 확인한 공통 구조

### 1. 주문 세트와 결과를 분리해야 한다

LOINC는 패널을 여러 child 결과를 열거하는 주문 묶음으로 설명한다. FHIR도 검사 요청은 ServiceRequest, 최종 값은 Observation, 묶인 보고서는 DiagnosticReport로 나눈다. 따라서 CBC 부모에 결과값 하나를 넣는 방식보다, CBC를 주문하면 WBC·RBC·HGB 같은 독립 결과가 생성되는 방식이 맞다.

하위 항목이 독립 재검 대상이면 단순 component가 아니라 별도 order/result identity가 필요하다. 기존 결과를 덮어쓰지 않고 새 주문을 만들고, 최초 세트와 직전 결과를 연결해야 한다.

### 2. 정상범위는 검사명 하나에 붙는 값이 아니다

ASVCP와 대학 검사실 자료를 보면 정상범위는 동물종, 연령과 필요한 경우 품종·성별, 검체, 전처리, 검사법, 분석 장비와 시약에 따라 달라진다. 그래서 `WBC 정상범위` 하나를 전 병원 공통값으로 저장하면 안 된다.

마스터에는 버전 있는 결과 프로필 후보를 두고, 워크스페이스는 실제 사용하는 장비·수기·외부검사실 프로필을 선택해야 한다. 결과를 저장할 때 당시 단위, 정상범위, 판별 규칙, 프로필 버전을 함께 스냅샷으로 남겨야 한다.

### 3. 검사마다 결과 모양이 다르다

- CBC·화학·응고: 주로 수치, 단위, 미달·정상·초과, 장비 플래그
- 신속 항원·항체와 PCR: 양성·음성·검출·미검출·무효·판정 불가
- 요시험지: 항목별 반정량 코드와 일부 수치
- 요침사·분변 현미경: 반복 관찰값, 개수나 등급, 이미지, 소견
- 혈액도말·세포검사: 형태, 등급, 서술, 이미지와 종합 해석
- 코르티솔 동적검사: 프로토콜과 채혈 시간점별 여러 수치

하나의 `numeric/text/coded` 칸만으로는 이 결과들을 안전하게 표현할 수 없다.

## 검사군별 전체 지도

| family ID | 검사군 | 목표 구조 | 검사군 수행 경로 후보 | 구조 근거 | 검사군 수준 값 자료 상태 |
| --- | --- | --- | --- | --- | --- |
| `hematology_cbc` | 혈구검사·CBC | test_panel | in_house_device, in_house_manual, external_lab | `source_found` | `source_found` |
| `clinical_chemistry` | 임상화학 | test_panel_or_atomic | in_house_device, external_lab | `source_found` | `source_found` |
| `electrolytes` | 전해질 | test_panel | in_house_device, external_lab | `source_found` | `source_found` |
| `coagulation` | 응고 | test_panel | in_house_device, external_lab | `source_found` | `source_found` |
| `urinalysis` | 요검사 | panel_of_subpanels | in_house_manual, in_house_device, external_lab | `source_found` | `source_partial` |
| `fecal_parasitology` | 분변·기생충 | test_panel_or_repeatable_observation | in_house_manual, point_of_care_rapid_test, external_lab | `source_found` | `not_applicable` |
| `infectious_disease` | 감염성 질환 | species_and_method_specific_panel | point_of_care_rapid_test, external_lab | `source_found` | `not_applicable` |
| `blood_typing` | 혈액형 | atomic_coded_result | in_house_manual, external_lab | `source_found` | `not_applicable` |
| `reticulocyte` | 망상적혈구 | atomic_numeric_pair | in_house_device, in_house_manual, external_lab | `source_found` | `source_found` |
| `blood_smear` | 혈액도말 | complex_report | in_house_manual, in_house_device, external_lab | `source_found` | `not_applicable` |
| `cytology` | 세포검사 | complex_report | in_house_manual, in_house_device, external_lab | `source_found` | `not_applicable` |
| `thyroid` | 갑상선 | test_panel | in_house_device, external_lab | `source_found` | `source_partial` |
| `adrenal` | 부신·코르티솔 | protocol_panel | in_house_device, external_lab | `source_found` | `source_partial` |
| `inflammation` | 염증 표지 | species_conditional_panel | in_house_device, external_lab | `source_found` | `source_partial` |
| `pancreatic` | 췌장 평가 | test_panel | in_house_device, point_of_care_rapid_test, external_lab | `source_found` | `source_partial` |
| `organ_or_metabolic_panel` | 장기·대사 평가 | test_panel_or_panel_of_panels | in_house_device, in_house_manual, external_lab | `source_found` | `source_partial` |
| `composite_diagnostic_plan` | 종합 검사 조합 | panel_of_panels | mixed | `source_found` | `source_partial` |
| `legacy_exception` | 레거시 예외 | retire_or_redefine | 결정 필요 | `source_partial` | `functional_fixture_required` |

### 대표 구조 예시

#### CBC

외부 자료에서 확인되는 CBC는 적혈구계, 백혈구계, 혈소판계와 형태 검토를 함께 가진다. 최소한 WBC, 백혈구 감별 절대수·비율, RBC, HGB, HCT, MCV, MCH, MCHC, RDW, PLT, MPV를 개별 결과로 다룰 수 있어야 한다. 망상적혈구와 혈액도말은 조건부 또는 별도 검사로 연결할 수 있다.

로컬 CBC 표본에는 WBC·HCT·PLT 세 항목만 연결돼 있다. RBC와 HGB 정의는 이미 fixture에 있지만 독립 order profile과 CBC 패널 연결이 없다. 먼저 이 부분을 기능 표본으로 바로잡는 것이 `OED-LAB-02`다.

#### 요검사

요검사는 물리적 관찰, 비중, 시험지, 침사, 필요 시 UPC가 합쳐진 세트다. 시험지 한 줄과 침사 한 줄만 두면 pH·단백·당·케톤·빌리루빈·혈액, RBC·WBC·세균·상피·원주·결정, 이미지와 소견을 각각 기록할 수 없다. 시험지·비중·침사·UPC를 하위 세트로 나누고 최종 관찰값을 독립 결과로 둬야 한다.

#### 감염성 검사

항원, 항체와 PCR은 같은 질환 이름을 쓰더라도 다른 검사다. 현재 감염성 질환 선별 패널은 개·고양이, 분변 검사, 신속키트와 PCR을 한 번에 묶는다. 실제 제품에서는 종·검사법·패널 버전을 나누고, 각 항목의 양성·음성·무효·판정 불가 상태를 따로 저장해야 한다.

#### 세포검사와 혈액도말

이 검사들은 보편적인 low/high 숫자 범위를 억지로 만들 대상이 아니다. 검체 부위와 채취법, 적합성, 세포·미생물·염증 소견, 진단과 감별, 이미지와 판독자 의견을 보존한다. 관절액은 여기에 단백, 점도, 세포수와 감별계수 같은 수치 결과가 더해지는 복합 패널이다.

## 현재 구조의 핵심 문제

| 갭 | 심각도 | 내용 | 영향 수 | 다음 작업 |
| --- | --- | --- | ---: | --- |
| `LAB-GAP-01` | blocker | 86개 중 1개 오더에 검사 프로필 연결이 없다 | 1 | `OED-LAB-03` |
| `LAB-GAP-02` | blocker | 로컬 V4 검사 정의 16개에 독립 주문 연결이 없다 | 16 | `OED-LAB-03` |
| `LAB-GAP-03` | blocker | CBC 패널이 3개 항목으로 축소돼 있다 | 1 | `OED-LAB-02` |
| `LAB-GAP-04` | blocker | 요시험지·요침사가 복합 결과를 한 필드로 축소한다 | 11 | `OED-LAB-03` |
| `LAB-GAP-05` | blocker | 로컬 V4 검사 패널 연결에 중첩 구성이 없다 | 12 | `OED-LAB-03` |
| `LAB-GAP-06` | blocker | 버전 있는 정상범위·판별 프로필이 없다 | 86 | `OED-LAB-03` |
| `LAB-GAP-07` | high | 워크스페이스 수행 장비·수기·외부검사실 선택 계약이 없다 | 86 | `OED-LAB-03` |
| `LAB-GAP-08` | high | 감염성 선별 패널이 종과 검사법을 혼합한다 | 2 | `later_family_research` |
| `LAB-GAP-09` | high | 부신 검사가 시간점이 있는 프로토콜을 표현하지 못한다 | 2 | `later_family_research` |
| `LAB-GAP-10` | high | 췌장 평가에 pancreas-specific lipase 항목이 없다 | 2 | `later_family_research` |
| `LAB-GAP-11` | high | 정확한 상용 장비값이 없는 경우의 기능용 프로필이 아직 없다 | 37 | `OED-LAB-02_and_later_family_research` |

## 86개 오더 전수 분류표

`panel · N`과 `atomic test`는 로컬 V4 표본의 연결이다. 조사 상태는 검사군 근거 확보 범위이며 개별 제품·검사법·정상범위 검증이나 오더 검수·사용 가능 상태가 아니다. 검사군 공통 자료로 개별 검사를 확인 완료 처리하지 않는다.

| # | order ID | 표시명 | 검사군 | 현재 연결 | 조사 상태 |
| ---: | --- | --- | --- | --- | --- |
| 1 | `cm.order.lab.panel.cbc-basic` | 전혈구 기본 패널 | 혈구검사·CBC | panel · 3 | `source_partial` |
| 2 | `cm.order.lab.panel.chemistry-basic` | 기본 혈청화학 패널 | 임상화학 | panel · 6 | `source_partial` |
| 3 | `cm.order.lab.panel.fecal` | 분변 검사 패널 | 분변·기생충 | panel · 2 | `source_partial` |
| 4 | `cm.order.lab.panel.urinalysis` | 요검사 패널 | 요검사 | panel · 2 | `source_partial` |
| 5 | `cm.order.lab.test.cbc-hct` | 헤마토크릿 검사 | 혈구검사·CBC | atomic test | `source_partial` |
| 6 | `cm.order.lab.test.cbc-plt` | 혈소판 수 검사 | 혈구검사·CBC | atomic test | `source_partial` |
| 7 | `cm.order.lab.test.cbc-wbc` | 백혈구 수 검사 | 혈구검사·CBC | atomic test | `source_partial` |
| 8 | `cm.order.lab.test.chem-alp` | ALP 검사 | 임상화학 | atomic test | `source_partial` |
| 9 | `cm.order.lab.test.chem-alt` | ALT 검사 | 임상화학 | atomic test | `source_partial` |
| 10 | `cm.order.lab.test.chem-bun` | BUN 검사 | 임상화학 | atomic test | `source_partial` |
| 11 | `cm.order.lab.test.chem-creatinine` | 크레아티닌 검사 | 임상화학 | atomic test | `source_partial` |
| 12 | `cm.order.lab.test.chem-glucose` | 혈당 검사 | 임상화학 | atomic test | `source_partial` |
| 13 | `cm.order.lab.test.chem-total-protein` | 총단백 검사 | 임상화학 | atomic test | `source_partial` |
| 14 | `cm.order.lab.test.fecal-microscopy` | 분변 현미경 검사 | 분변·기생충 | atomic test | `source_partial` |
| 15 | `cm.order.lab.test.giardia-antigen` | 지아르디아 항원 검사 | 분변·기생충 | atomic test | `source_partial` |
| 16 | `cm.order.lab.test.ua-sediment` | 요침사 검사 | 요검사 | atomic test | `source_partial` |
| 17 | `cm.order.lab.test.ua-strip` | 요시험지 검사 | 요검사 | atomic test | `source_partial` |
| 18 | `cm.order.synthetic.lab-01` | 전해질 검사 | 전해질 | panel · 7 | `source_partial` |
| 19 | `cm.order.synthetic.lab-02` | 응고 검사 | 응고 | panel · 2 | `source_partial` |
| 20 | `cm.order.synthetic.lab-03` | 수술 전 검사 | 장기·대사 평가 | panel · 8 | `source_partial` |
| 21 | `cm.order.synthetic.lab-04` | 간 검사 | 장기·대사 평가 | panel · 8 | `source_partial` |
| 22 | `cm.order.synthetic.lab-05` | 신장 검사 | 장기·대사 평가 | panel · 8 | `source_partial` |
| 23 | `cm.order.synthetic.lab-06` | 당대사 패널 | 장기·대사 평가 | panel · 14 | `source_partial` |
| 24 | `cm.order.synthetic.lab-07` | 혈액형 검사 서비스 | 혈액형 | atomic test | `source_partial` |
| 25 | `cm.order.synthetic.lab-08` | 망상적혈구 검사 서비스 | 망상적혈구 | atomic test | `source_partial` |
| 26 | `cm.order.synthetic.lab-09` | 혈액도말 검사 서비스 | 혈액도말 | atomic test | `source_partial` |
| 27 | `cm.order.synthetic.lab-10` | 피부 세포검사 | 세포검사 | atomic test | `source_partial` |
| 28 | `cm.order.synthetic.lab-11` | 귀 분비물 세포검사 | 세포검사 | atomic test | `source_partial` |
| 29 | `cm.order.synthetic.lab-12` | 종괴 세포검사 | 세포검사 | atomic test | `source_partial` |
| 30 | `cm.order.synthetic.lab-13` | 관절액 세포검사 | 세포검사 | atomic test | `source_partial` |
| 31 | `cm.order.v4.lab-panel.01` | 확장 혈청화학 패널 | 임상화학 | panel · 12 | `source_partial` |
| 32 | `cm.order.v4.lab-panel.02` | 지질 검사 패널 | 임상화학 | panel · 4 | `source_partial` |
| 33 | `cm.order.v4.lab-panel.03` | 췌장 평가 패널 | 췌장 평가 | panel · 6 | `source_partial` |
| 34 | `cm.order.v4.lab-panel.04` | 염증 표지 패널 | 염증 표지 | panel · 6 | `source_partial` |
| 35 | `cm.order.v4.lab-panel.05` | 갑상선 검사 패널 | 갑상선 | panel · 5 | `source_partial` |
| 36 | `cm.order.v4.lab-panel.06` | 부신 검사 패널 | 부신·코르티솔 | panel · 5 | `source_partial` |
| 37 | `cm.order.v4.lab-panel.07` | 요단백 평가 패널 | 요검사 | panel · 10 | `source_partial` |
| 38 | `cm.order.v4.lab-panel.08` | 감염성 질환 선별 패널 | 감염성 질환 | panel · 12 | `source_partial` |
| 39 | `cm.order.v4.lab-service.basic-checkup` | 기본 건강검진 검사 조합 | 종합 검사 조합 | panel · 12 | `source_partial` |
| 40 | `cm.order.v4.lab-service.emergency-initial` | 응급 초기 검사 조합 | 종합 검사 조합 | panel · 6 | `source_partial` |
| 41 | `cm.order.v4.lab-service.hepatobiliary` | 간담도 평가 검사 조합 | 장기·대사 평가 | panel · 12 | `source_partial` |
| 42 | `cm.order.v4.lab-service.infectious-workup` | 감염성 질환 검사 조합 | 감염성 질환 | panel · 12 | `source_partial` |
| 43 | `cm.order.v4.lab-service.preanesthetic-expanded` | 마취 전 확장 검사 조합 | 종합 검사 조합 | panel · 12 | `source_partial` |
| 44 | `cm.order.v4.lab-service.pu-pd` | 다뇨·다갈 검사 조합 | 요검사 | panel · 10 | `source_partial` |
| 45 | `cm.order.v4.lab-service.renal` | 신장 평가 검사 조합 | 장기·대사 평가 | panel · 10 | `source_partial` |
| 46 | `cm.order.v4.lab-service.senior-cat` | 노령묘 검사 조합 | 종합 검사 조합 | panel · 5 | `source_partial` |
| 47 | `cm.order.v4.lab-service.senior-dog` | 노령견 검사 조합 | 종합 검사 조합 | panel · 12 | `source_partial` |
| 48 | `cm.order.v4.lab-service.vomiting-diarrhea` | 구토·설사 검사 조합 | 종합 검사 조합 | panel · 6 | `source_partial` |
| 49 | `cm.order.v4.lab-service.weight-loss` | 체중감소 검사 조합 | 종합 검사 조합 | panel · 5 | `source_partial` |
| 50 | `cm.order.v4.lab-test.01` | 혈청 글로불린 검사 | 임상화학 | atomic test | `source_partial` |
| 51 | `cm.order.v4.lab-test.02` | 알부민·글로불린 비율 검사 | 임상화학 | atomic test | `source_partial` |
| 52 | `cm.order.v4.lab-test.03` | 직접 빌리루빈 검사 | 임상화학 | atomic test | `source_partial` |
| 53 | `cm.order.v4.lab-test.04` | 감마글루타밀전이효소 검사 | 임상화학 | atomic test | `source_partial` |
| 54 | `cm.order.v4.lab-test.05` | 젖산탈수소효소 검사 | 임상화학 | atomic test | `source_partial` |
| 55 | `cm.order.v4.lab-test.06` | 크레아틴키나아제 검사 | 임상화학 | atomic test | `source_partial` |
| 56 | `cm.order.v4.lab-test.07` | 총콜레스테롤 검사 | 임상화학 | atomic test | `source_partial` |
| 57 | `cm.order.v4.lab-test.08` | 중성지방 검사 | 임상화학 | atomic test | `source_partial` |
| 58 | `cm.order.v4.lab-test.09` | 아밀라아제 검사 | 췌장 평가 | atomic test | `source_partial` |
| 59 | `cm.order.v4.lab-test.10` | 리파아제 검사 | 췌장 평가 | atomic test | `source_partial` |
| 60 | `cm.order.v4.lab-test.11` | SDMA 검사 | 임상화학 | atomic test | `source_partial` |
| 61 | `cm.order.v4.lab-test.12` | 프럭토사민 검사 | 임상화학 | atomic test | `source_partial` |
| 62 | `cm.order.v4.lab-test.13` | 총담즙산 검사 | 임상화학 | atomic test | `source_partial` |
| 63 | `cm.order.v4.lab-test.14` | 젖산 검사 | 임상화학 | atomic test | `source_partial` |
| 64 | `cm.order.v4.lab-test.15` | C-반응단백 검사 | 염증 표지 | atomic test | `source_partial` |
| 65 | `cm.order.v4.lab-test.16` | 혈청 아밀로이드 A 검사 | 염증 표지 | atomic test | `source_partial` |
| 66 | `cm.order.v4.lab-test.17` | 총 T4 검사 | 갑상선 | atomic test | `source_partial` |
| 67 | `cm.order.v4.lab-test.18` | 유리 T4 검사 | 갑상선 | atomic test | `source_partial` |
| 68 | `cm.order.v4.lab-test.19` | 갑상선자극호르몬 검사 | 갑상선 | atomic test | `source_partial` |
| 69 | `cm.order.v4.lab-test.20` | 코르티솔 검사 | 부신·코르티솔 | atomic test | `source_partial` |
| 70 | `cm.order.v4.lab-test.21` | 요 크레아티닌 검사 | 요검사 | atomic test | `source_partial` |
| 71 | `cm.order.v4.lab-test.22` | 요단백·크레아티닌 비율 검사 | 요검사 | atomic test | `source_partial` |
| 72 | `cm.order.v4.lab-test.23` | 요 pH 검사 | 요검사 | atomic test | `source_partial` |
| 73 | `cm.order.v4.lab-test.24` | 요당 검사 | 요검사 | atomic test | `source_partial` |
| 74 | `cm.order.v4.lab-test.25` | 요케톤 검사 | 요검사 | atomic test | `source_partial` |
| 75 | `cm.order.v4.lab-test.26` | 요빌리루빈 검사 | 요검사 | atomic test | `source_partial` |
| 76 | `cm.order.v4.lab-test.27` | 분변 부유 검사 | 분변·기생충 | atomic test | `source_partial` |
| 77 | `cm.order.v4.lab-test.28` | 분변 잠혈 검사 | 분변·기생충 | atomic test | `source_partial` |
| 78 | `cm.order.v4.lab-test.29` | 개 파보바이러스 항원 검사 | 감염성 질환 | atomic test | `source_partial` |
| 79 | `cm.order.v4.lab-test.30` | 개 디스템퍼바이러스 항원 검사 | 감염성 질환 | atomic test | `source_partial` |
| 80 | `cm.order.v4.lab-test.31` | 개 심장사상충 항원 검사 | 감염성 질환 | atomic test | `source_partial` |
| 81 | `cm.order.v4.lab-test.32` | 고양이 범백혈구감소증 항원 검사 | 감염성 질환 | atomic test | `source_partial` |
| 82 | `cm.order.v4.lab-test.33` | 고양이 백혈병바이러스 항원 검사 | 감염성 질환 | atomic test | `source_partial` |
| 83 | `cm.order.v4.lab-test.34` | 고양이 면역결핍바이러스 항체 검사 | 감염성 질환 | atomic test | `source_partial` |
| 84 | `cm.order.v4.lab-test.35` | 고양이 코로나바이러스 항체 검사 | 감염성 질환 | atomic test | `source_partial` |
| 85 | `cm.order.v4.lab-test.36` | 바베시아 PCR 검사 | 감염성 질환 | atomic test | `source_partial` |
| 86 | `phase1.optionb.v1.order.metabolic` | 합성 기초 혈액검사 | 레거시 예외 | 연결 없음 | `functional_fixture_required` |

## 장비와 수행 경로 결론

대표 장비 후보는 기능 구조를 확인하기 위해 골랐다. 혈구분석기, 화학분석기, 응고분석기, 요시험지 분석기, 요침사 분석기, 세포 분석기, 신속키트 판독기와 수기 현미경·원심분리기·굴절계를 구분했다.

이름을 적어 둔 장비가 청담점이나 다른 워크스페이스에 있다는 뜻은 아니다. 프로토타입에서는 워크스페이스가 사용할 수행 프로필을 명시적으로 선택하고, 화면에는 `수동 입력`과 `연동 안 됨`을 그대로 보여줘야 한다. 선택하지 않은 장비 프로필이나 화면 목업값으로 자동 대체하지 않는다.

## 출처 원장

| source ID | 기관 | 문서 | 직접 뒷받침하는 범위 |
| --- | --- | --- | --- |
| `ASVCP-QALS` | American Society for Veterinary Clinical Pathology | [Quality Assurance and Laboratory Standards Guidelines](https://www.asvcp.org/page/QALS_Guidelines) | quality_governance, reference_interval_governance, cytology_reporting |
| `ASVCP-RI-GUIDELINE` | ASVCP QALS | [Reference interval guidelines](https://onlinelibrary.wiley.com/doi/full/10.1111/vcp.12006) | reference_interval_dimensions, method_device_dependence, interval_transference |
| `ASVCP-RI-TRANSFER` | ASVCP QALS | [Reference Interval Transference Verification Checklist](https://www.asvcp.org/resource/resmgr/qals/ref_interval_transference/transferenceverification-upd.pdf) | reference_interval_verification, local_validation_required |
| `CORNELL-HEMATOLOGY` | Cornell University AHDC | [Hematology testing protocols and interpretations](https://www.vet.cornell.edu/animal-health-diagnostic-center/testing/testing-protocols-interpretations/hematology) | cbc_children, reticulocyte, blood_smear, fecal_occult_blood |
| `CORNELL-HEMATOLOGY-RI` | Cornell University AHDC | [Hematology reference intervals - ADVIA 2120](https://www.vet.cornell.edu/animal-health-diagnostic-center/laboratories/clinical-pathology/reference-intervals/hematology-advia-2120) | cbc_units, species_reference_intervals, device_specific_profile |
| `IDEXX-PROCYTE-RI` | IDEXX Laboratories | [ProCyte Dx reference intervals](https://www.idexx.com/files/procyte-dx-reference-ranges-en.pdf) | cbc_device_profile, species_reference_intervals, cbc_units |
| `ZOETIS-HM5-MANUAL` | Zoetis Diagnostics | [VETSCAN HM5 Operator's Manual](https://www.zoetisdiagnostics.com/assets/Resources/PDF/VETSCAN-HM5-Blue-Version-Operators-Manual.pdf) | cbc_device_parameters, hematology_equipment_class |
| `CORNELL-CHEMISTRY` | Cornell University AHDC | [Clinical Chemistry](https://www.vet.cornell.edu/animal-health-diagnostic-center/veterinary-resources/testing-guidelines/clinical-chemistry) | chemistry_panels, electrolytes, organ_panels, specimens |
| `CORNELL-CHEMISTRY-RI` | Cornell University AHDC | [Chemistry reference intervals - Cobas](https://www.vet.cornell.edu/animal-health-diagnostic-center/laboratories/clinical-pathology/reference-intervals/chemistry-cobas) | chemistry_units, species_reference_intervals, method_device_dependence |
| `IDEXX-CATALYST-MENU` | IDEXX Laboratories | [Catalyst One test menu](https://www.idexx.com/en/veterinary/analyzers/catalyst-one-chemistry-analyzer/test-menu/) | chemistry_device_menu, single_analyte_recheck, upc, endocrine_poc |
| `ZOETIS-VS2-PROFILES` | Zoetis Diagnostics | [VETSCAN VS2 testing profiles](https://www.zoetisdiagnostics.com/IE/assets/pdf/Zoetis-Vetscan-VS2-Testing-Profiles-VTS-01169A-NOV2123.pdf) | chemistry_device_menu, panel_composition, species_scope |
| `IDEXX-COAG-DX` | IDEXX Laboratories | [Coag Dx Analyzer](https://www.idexx.com/en/veterinary/analyzers/coag-dx-analyzer/) | pt, aptt, coagulation_equipment, species_scope |
| `CORNELL-COAG-PANEL` | Cornell University AHDC | [Canine diagnostic plans and coagulation panels](https://www.vet.cornell.edu/animal-health-diagnostic-center/diagnostic-services/diagnostic-plans-and-panels/canine-diagnostic-plans-and-panels) | coagulation_panel, panel_of_panels, specimens |
| `CORNELL-URINALYSIS` | Cornell University AHDC | [Urinalysis](https://www.vet.cornell.edu/animal-health-diagnostic-center/testing/testing-protocols-interpretations/urinalysis) | urinalysis_children, upc, urine_specimen |
| `IDEXX-VETLAB-UA` | IDEXX Laboratories | [VetLab UA Analyzer](https://www.idexx.com/en/veterinary/analyzers/vetlab-ua-analyzer/) | urine_strip_device, semiquantitative_results, species_scope |
| `IDEXX-SEDIVUE` | IDEXX Laboratories | [SediVue Dx Urine Sediment Analyzer](https://www.idexx.com/en/veterinary/analyzers/sedivue-dx-analyzer/) | urine_sediment_children, images, sediment_device |
| `CORNELL-PARASITOLOGY` | Cornell University AHDC | [Parasitology](https://www.vet.cornell.edu/animal-health-diagnostic-center/testing/testing-protocols-interpretations/parasitology) | fecal_flotation, organism_observations, qualitative_quantitative_results |
| `IDEXX-SNAP-GIARDIA` | IDEXX Laboratories | [SNAP Giardia Test](https://www.idexx.com/en/veterinary/snap-tests/snap-giardia-test/) | giardia_antigen, point_of_care_rapid_test, qualitative_result |
| `IDEXX-SNAP-INFECTIOUS` | IDEXX Laboratories | [SNAP rapid assay product inserts](https://www.idexx.com/en/veterinary/support/rapid-assay-snap-product-inserts/) | parvo_antigen, heartworm_antigen, felv_antigen, fiv_antibody, panel_status |
| `UC-DAVIS-PCR` | UC Davis Veterinary Genetics and Molecular Diagnostics | [Veterinary PCR tests and panels](https://pcrlab.vetmed.ucdavis.edu/veterinary-diagnostics/veterinary-submission-formsdiagnostic-tests-and-panels) | infectious_pcr, babesia, species_specific_panels, external_lab_route |
| `CORNELL-PCR-INTERPRETATION` | Cornell University AHDC | [Interpretation of PCR results](https://www.vet.cornell.edu/animal-health-diagnostic-center/testing-laboratories/molecular-diagnostics/interpretation-pcr-results) | pcr_result_shape, assay_specific_interpretation, inconclusive_results |
| `CORNELL-BLOOD-TYPE` | Cornell University AHDC | [Canine and Feline Blood Typing](https://www.vet.cornell.edu/animal-health-diagnostic-center/laboratories/comparative-coagulation/clinical-topics/canine-feline-blood-typing) | blood_type, species_specific_codes, edta_specimen |
| `CORNELL-CYTOLOGY` | Cornell University AHDC | [Cytology - fluid samples](https://www.vet.cornell.edu/animal-health-diagnostic-center/veterinary-resources/testing-guidelines/cytology-fluid-samples-only) | joint_fluid, cytology_specimen, manual_external_route |
| `IDEXX-INVUE` | IDEXX Laboratories | [inVue Dx Cellular Analyzer](https://www.idexx.com/en/veterinary/analyzers/invue-dx-analyzer/) | ear_cytology, blood_morphology, images, semiquantitative_results |
| `UC-DAVIS-ENDOCRINOLOGY` | UC Davis Veterinary Medical Teaching Hospital | [Clinical chemistry and endocrinology services](https://www.vetmed.ucdavis.edu/hospital/support-services/lab-services/clinical-laboratory-services/clinical-chemistry) | thyroid_tests, cortisol, crp, endocrine_equipment |
| `IDEXX-CORTISOL` | IDEXX Laboratories | [Catalyst Cortisol Test](https://www.idexx.com/en/veterinary/analyzers/catalyst-one-chemistry-analyzer/test-menu/cortisol/) | cortisol_protocol, timed_results, canine_device_profile |
| `LOINC-PANELS` | Regenstrief Institute | [LOINC Panels (Batteries)](https://loinc.org/kb/users-guide/panels) | panel_children, nested_panels, conditionality |
| `LOINC-RESULT-TYPES` | Regenstrief Institute | [Types of results found in panels](https://loinc.org/kb/users-guide/panels/types-of-results) | primary_observation, derived_observation, panel_interpretation |
| `UCUM-2.2` | UCUM Organization | [Unified Code for Units of Measure v2.2](https://ucum.org/ucum) | machine_readable_units |
| `FHIR-SERVICE-REQUEST` | HL7 International | [FHIR R5 ServiceRequest](https://hl7.org/fhir/servicerequest.html) | order_instance, panel_request, requisition |
| `FHIR-OBSERVATION` | HL7 International | [FHIR R5 Observation](https://hl7.org/fhir/observation.html) | atomic_result, has_member, value_types, reference_range |
| `FHIR-DIAGNOSTIC-REPORT` | HL7 International | [FHIR R5 DiagnosticReport](https://hl7.org/fhir/diagnosticreport.html) | report_grouping, atomic_results, images, interpretation |

## 다음 작업 인계: OED-LAB-02

다음 작업은 CBC 하나를 끝까지 완성하는 기능 표본 조사다. 아래 순서로 진행한다.

1. CBC 하위 결과 항목을 core, optional, manual review로 나누고 각 항목의 안정적인 후보 ID를 만든다.
2. 개·고양이용 대표 장비 프로필 하나와 CLAiR 데모 프로필 사용 조건을 정한다.
3. 각 결과의 입력형, UCUM 단위, 소수점, 정상범위 차원, 판별과 장비 플래그를 확정한다.
4. CBC 전체 주문과 WBC 같은 단일 하위 오더 재검 흐름을 함께 그린다.
5. 결과 화면에 장비, 수동 입력, 연동 안 됨, 단위, 정상범위, 판별, 형태 소견과 이미지를 어떻게 보여줄지 정의한다.
6. 이 단계에서도 앱·DB·마스터에는 적용하지 않는다. 제품 검토 뒤 `OED-LAB-03`에서 목표 저장 구조와 전환 계획을 만든다.

### 다음 에이전트가 먼저 읽을 파일

1. `OED-LAB-00-requirements-and-research-contract.md`
2. `OED-LAB-01-clinical-laboratory-landscape-research.md`
3. 이 `report-source.md`
4. `oed-lab-01-gap-matrix.v1.json`
5. `oed-lab-01-set-atomic-map.v1.json`
6. `oed-lab-01-result-shape-matrix.v1.json`
7. `oed-lab-01-source-ledger.v1.json`

### 다음 작업에서 지켜야 할 금지선

- 실제 병원 데이터나 임상 검증값이라고 표현하지 않는다.
- 상용 장비 이름에 임의 정상범위를 붙이지 않는다.
- 값이 없을 때 런타임 fallback 또는 가라 오더를 만들지 않는다.
- 연구 후보를 앱, Airtable, Supabase, 마스터 또는 워크스페이스에 적용하지 않는다.
- 원격 DB 조사와 변경은 `OED-LAB-03`의 별도 범위와 승인 기준을 따른다.

## 산출물 목록

- `artifact-manifest.v1.json`
- `oed-lab-01-order-inventory.v1.json`
- `oed-lab-01-set-atomic-map.v1.json`
- `oed-lab-01-execution-route-matrix.v1.json`
- `oed-lab-01-equipment-landscape.v1.json`
- `oed-lab-01-result-shape-matrix.v1.json`
- `oed-lab-01-source-ledger.v1.json`
- `oed-lab-01-gap-matrix.v1.json`
- `oed-lab-01-correction-audit.v1.json`

모든 JSON은 `research_only_non_applied`, `applicationAllowed: false`다.
