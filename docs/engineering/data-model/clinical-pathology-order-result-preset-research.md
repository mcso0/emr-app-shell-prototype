---
type: "Research Report"
title: "임상병리 오더 결과 프리셋 조사 보고서"
description: "Airtable 임상병리 오더의 결과 항목, 단위, 참고구간, 판정 맥락을 실제 수의 임상검사 관행과 대조한 조사 보고서"
tags: [clinical-master, laboratory, order-preset, reference-interval, veterinary]
status: research_complete
last_updated: 2026-09-02
clinical_release_status: not_approved
---

# 임상병리 오더 결과 프리셋 조사 보고서

## 0. 결론

현재 임상병리 프리셋은 오더와 일부 결과 항목을 연결하는 구조까지는 갖췄지만, 실제 검사 결과지로 사용하기에는 불완전하다.

1. Airtable `CLAiR Clinical Master`에는 검사 72개, 패널 18개, 패널-항목 연결 120개, 오더-검사 프로필 85개가 있다.
2. 72개 검사 모두 작성 상태는 `approved`, 생명주기는 `published`지만, 유일한 근거 레코드는 `synthetic`이며 “임상 사용 불가”로 명시되어 있다. 이 상태는 임상 승인과 다르다.
3. 검사 결과 타입과 일부 단위는 있지만 참고구간(reference interval), 종·연령·장비·검체·방법별 분기, 임상 결정한계(decision limit), 출처와 검토 revision이 없다.
4. 숫자형 검사 48개 중 8개는 단위가 비어 있다. 이 중 `AG_RATIO`, `UA_PH`, `UPC`는 무차원 값이므로 단위 없음이 타당하지만, `CORTISOL`, `FT4`, `TBA`, `TSH`, `TT4`는 검사법별 단위가 필요하다.
5. `FRUCTOSAMINE`, `SDMA`, `SAA`는 현재 단위가 실제 장비·검사실 관행과 맞지 않거나 비표준적이다.
6. CBC 패널은 Airtable에서 WBC·HCT·PLT 3개뿐이다. 런타임 데모 seed는 WBC·RBC·HCT·PLT 4개다. ProCyte Dx는 개·고양이에서 최대 27개 전혈 항목을 보고하므로 현재 패널은 결과지 기준으로 명백히 부족하다.
7. 현재 UI는 `12.3-45.6` 형태의 양측 숫자 범위만 해석한다. 단측 상한, 양성/음성, 등급, 검출/미검출, 시간대별 결과, 서술형 판독은 자동 판정할 수 없다.

따라서 “검사마다 하나의 정상값”을 추가하는 방식이 아니라, **결과 정의 + 단위 + 참고구간/결정한계 규칙 + 적용 맥락 + 출처·revision + 결과 시점 스냅샷**을 분리해야 한다.

> 이 문서의 수치는 제품·데이터 모델 설계를 위한 조사 예시다. 병원에 배포할 임상 기준값이 아니다. 실제 배포는 병원에서 사용하는 장비, 시약, 검사실, 검체, 소프트웨어 버전과 임상병리 검토를 고정한 뒤 별도로 승인해야 한다.

## 1. 조사 범위와 방법

### 1.1 범위

- Airtable 현재 레코드의 검사, 패널, 단위, 입력 타입, 검체, 오더 연결 상태
- 저장소의 현재 `lab_test_items`, 결과 저장, 결과 화면 판정 구조
- 개·고양이 병원에서 흔히 사용하는 CBC, 화학, 전해질, 내분비, 응고, 요검사, 감염, 분변, 세포검사 사례
- 숫자형, 단측 한계, 비율, 코드형, 순서형, 서술형, 다중 시점 검사
- 종·연령·품종·성별·체중·검체·채취법·장비·검사법이 참고구간에 미치는 영향

### 1.2 조사량

- Airtable: 1개 base, 8개 관련 테이블을 읽기 전용으로 확인
- 외부 조사: 4개 검색 갈래에서 Exa 반환 결과 205건 검토
- 심층 확인: 제조사, 수의과대학·진단검사실, 전문학회·가이드라인 16개 고유 원문
- 채택 우선순위: 공식 제조사/장비 문서 → 수의과대학·진단검사실 → 전문학회/동료평가 논문 → 임상 해설

일반 블로그, 출처가 없는 “정상 수치 표”, 사람 검사 기준을 수의 검사에 그대로 옮긴 자료는 채택하지 않았다.

### 1.3 근거 표기와 제안 판정 규칙

이 보고서의 제안은 아래 네 종류로 구분한다. 같은 문장 안에서도 관찰과 제안을 섞지 않는다.

| 표기 | 의미 | 제품에서 허용되는 사용 |
| --- | --- | --- |
| `A` 현재 관찰 | 2026-09-02 Airtable을 읽기 전용으로 직접 확인한 값 | 현 상태 진단 |
| `R` 저장소 관찰 | 현재 migration, API, UI 코드를 직접 확인한 구현 사실 | 구현 차이 분석 |
| `S` 외부 임상 근거 | 제조사, 진단검사실, 전문지침 원문의 명시 내용 | 해당 장비·방법·조건이 일치할 때만 후보 기준 |
| `D` 설계 추론 | `A/R/S`를 제품 구조로 번역한 제안 | 임상·개발 검토 후 구현 가능 |
| `H` 현실적 가설 | 직접 일치하는 원문을 확보하지 못해 검사 관행으로 추정한 제안 | 검색·병원 확인 전 임상 배포 금지 |

신뢰도는 다음처럼 해석한다.

- **높음**: 현재 데이터/코드의 직접 관찰이거나, 명시된 장비·검사실 원문과 정확히 일치한다.
- **중간**: 임상 문서에서 결과 형태는 확인했지만 CLAiR 대상 장비·검사법이 아직 정해지지 않았다.
- **낮음**: 합리적 가설이지만 assay/kit 원문 또는 병원 확인이 더 필요하다.

중요하게, `S` 근거도 CLAiR의 전역 기본값을 뜻하지 않는다. 출처의 장비·검체·종·연령·검사법이 병원 설정과 일치하고 임상 검토가 끝난 경우에만 자동 판정 후보가 된다.

## 2. Airtable 현재 상태

확인일: 2026-09-02

### 2.1 레코드 수

| 데이터 | 수량 | 관찰 |
| --- | ---: | --- |
| Lab tests | 72 | 숫자 48, 코드 16, 서술 8 |
| Lab panels | 18 | CBC, 기본/확장 화학, 요검사, 응고, 내분비, 감염 등 |
| Lab panel items | 120 | 확인된 120개가 모두 `required=true` |
| Lab order profiles | 85 | 단일 검사 56, 패널 29 |
| Specimen types | 8 | 혈청, EDTA 전혈, 구연산 혈장, 소변, 분변, 면봉, 세포 슬라이드, 관절액 |
| Units | 9 | 전체 결과 유형을 수용하기에는 부족 |
| Result input types | 3 | 숫자, 코드, 서술 |
| Sources | 1 | `synthetic` fixture, 임상 사용 불가 |

### 2.2 현재 단위 분포

| 단위 | 검사 수 | 비고 |
| --- | ---: | --- |
| 없음 | 32 | 코드·서술 24개 + 숫자 8개 |
| mg/dL | 15 | 일부는 단위 교정 필요 |
| U/L | 8 | 효소 검사 중심 |
| mmol/L | 6 | 전해질·젖산 |
| g/dL | 4 | 단백질·혈색소 |
| s | 2 | PT, aPTT |
| 10^3/µL | 2 | WBC, PLT |
| % | 2 | HCT, RETIC |
| 10^6/µL | 1 | RBC |

현재 unit vocabulary에는 CBC 전체를 위한 `fL`, `pg`, 내분비·신장 표지자를 위한 `µg/dL`, `ng/mL`, `pmol/L`, 화학 항목의 `µmol/L`, 염증 표지자의 `mg/L`, 현미경 검사의 `/HPF`·`/LPF`가 없다.

### 2.3 핵심 품질 문제

| 문제 | 현재 예 | 영향 |
| --- | --- | --- |
| 임상 출처 없음 | 72개 모두 synthetic scope | 실제 판정값으로 배포할 수 없음 |
| 참고구간 모델 없음 | lower/upper, 조건, 출처 필드 부재 | 정상/미달/초과 자동 판정 불가 |
| CBC 불완전 | 패널 3개 항목 | 실제 장비 결과 대부분 유실 |
| 단위 오류 | SDMA `mg/dL` | 실제 관행 `µg/dL`과 1,000배 차이 가능 |
| 단위 오류 | Fructosamine `mg/dL` | 통상 `µmol/L` |
| 단위 미정 | T4, TSH, cortisol, bile acids | 값만 보면 해석 불가 |
| 결과 타입 과단순화 | UA specific gravity가 coded | 1.035 같은 숫자와 추세를 잃음 |
| 복합 검사를 한 행으로 표현 | UA_STRIP | glucose, ketone, bilirubin 등 개별 결과가 필요 |
| 다중 시점 부재 | cortisol, bile acids | baseline/post 또는 fasting/postprandial 구분 불가 |
| 패널-검체 불일치 가능 | 감염 패널이 EDTA 전혈 1개 검체로 분변 검사까지 포함 | 패널 실행 자체가 현실과 맞지 않음 |
| 패널 선택성 부재 | 120개 항목 모두 required | 장비·상황별 선택 결과를 표현하기 어려움 |

### 2.4 첨부 과거 시안 판독

시안의 방향 중 유지할 부분:

- 검사 항목, 결과값, 판정, 참고구간, 담당자를 한 행에서 연결
- 결과 이탈을 색과 텍스트로 동시에 표시
- 패널/장비 단위로 묶고 항목별 코멘트를 확장

수정할 부분:

- BASO 결과 단위 `mL`는 부적절하다. ProCyte의 BASO 절대수는 `K/µL`, 백분율은 `%`가 일반적이다.
- `8.8-18.8` 같은 범위는 종·장비·검사법 출처 없이 표시하면 안 된다.
- `BASO-1`~`BASO-4` 같은 반복 항목은 실제 analyte가 아니라면 샘플 식별자 또는 반복 측정으로 분리해야 한다.
- `ProCyte 4 order`는 “오더 4개”보다 “결과 항목 4개” 또는 “검체 4건”인지 의미를 명확히 해야 한다.
- 장비 미지원, 참고구간 미보고, 검체 간섭, 혈소판 응집처럼 “숫자가 있어도 판정 불가”인 상태가 필요하다.

## 3. 실제 검사 결과의 일곱 가지 형태

| 결과 형태 | 예 | 단위 | 참고/판정 방식 | UI 요구 |
| --- | --- | --- | --- | --- |
| 양측 숫자 참고구간 | RBC, HCT, Na, albumin | 있음 또는 무차원 | lower ≤ value ≤ upper | 숫자 입력 + 범위 막대 |
| 단측 한계 | SDMA, CRP 일부 방법 | 있음 | value ≤ upper 또는 value < threshold | 한쪽 경계 그래프 |
| 임상 결정구간 | UPC, endocrine protocol | 무차원 또는 있음 | 구간별 의미와 행동 | 구간 라벨 + 해석 |
| 순서형/반정량 | urine protein, ketone | 없음 또는 환산값 | negative/trace/1+/2+/3+ | 선택형 + 원자료 |
| 정성형 | antigen/antibody, PCR | 없음 | detected/not detected/indeterminate/invalid | 상태형 결과 |
| 서술형/구조화 판독 | cytology, smear | 항목별 다름 | 참고구간이 아닌 description/interpretation | 섹션형 결과지 |
| 다중 시점/자극 검사 | bile acids, ACTH stimulation | 있음 | fasting/postprandial, pre/post ACTH별 규칙 | 시간점 그룹 |

“정상범위 없음”은 누락과 다르다. 정성형·서술형 검사에는 숫자 참고구간이 **적용되지 않음**을 명시해야 한다.

## 4. 대표 근거값: 설계 검증용 예시

아래 값은 출처별 결과 구조를 검증하기 위한 예시다. CLAiR 공통 임상 preset으로 바로 배포하지 않는다.

### 4.1 CBC: IDEXX ProCyte Dx, all life stages `[S5]`

| 항목 | 단위 | 개 | 고양이 |
| --- | --- | ---: | ---: |
| RBC | M/µL | 5.65-8.87 | 6.54-12.20 |
| HCT | % | 37.3-61.7 | 30.3-52.3 |
| HGB | g/dL | 13.1-20.5 | 9.8-16.2 |
| WBC | K/µL | 5.05-16.76 | 2.87-17.02 |
| BASO # | K/µL | 0.00-0.10 | 0.01-0.26 |
| PLT | K/µL | 148-484 | 151-600 |
| MPV | fL | 8.7-13.2 | 11.4-21.6 |

같은 CBC라도 Cornell Advia 2120 `[S8]`의 개 WBC는 5.7-14.2 ×10^3/µL, 고양이는 5.1-16.2 ×10^3/µL다. 이 차이는 “종만 고르면 되는 전역 정상값”이 아니라 **장비·방법별 참고구간**이 필요하다는 직접 근거다.

ProCyte가 제공할 수 있는 CBC 결과군:

- RBC, HCT, HGB, MCV, MCH, MCHC, RDW
- RETIC %, RETIC #, RETIC-HGB
- WBC, NEU #, LYM #, MONO #, EOS #, BASO #
- PLT, MPV, PDW, PCT
- 종과 장비 상태에 따른 nRBC, dot plot, morphology/flag

현재 Airtable CBC에는 HGB와 RETIC 단일 정의가 있더라도 `CBC_BASIC` 연결에는 WBC·HCT·PLT만 있다. 장비 결과 능력과 패널 구성이 분리되어야 한다.

### 4.2 화학·전해질: IDEXX Catalyst, adult `[S6]`

| 항목 | 단위 | 성견 | 성묘 |
| --- | --- | ---: | ---: |
| ALB | g/dL | 2.3-4.0 | 2.2-4.0 |
| ALT | U/L | 10-125 | 12-130 |
| BUN | mg/dL | 7-27 | 16-36 |
| CREA | mg/dL | 0.5-1.8 | 0.8-2.4 |
| GLU | mg/dL | 74-143 | 74-159 |
| Na | mmol/L | 144-160 | 150-165 |
| K | mmol/L | 3.5-5.8 | 3.5-5.8 |
| Cl | mmol/L | 109-122 | 112-129 |
| SDMA | µg/dL | 0-14 | 0-14 |
| TT4 | µg/dL | 1.0-4.0 | 0.8-4.7 |

같은 제조사 문서에서도 puppy/kitten, adult, geriatric 구간이 분리된다. 문서 자체가 장비에 표시되는 최신 범위가 우선이며, 검사실 방법 차이로 reference laboratory 구간과 다를 수 있다고 명시한다.

### 4.3 응고: Cornell Comparative Coagulation `[S10]`

| 항목 | 단위 | 개 | 고양이 | 필수 맥락 |
| --- | --- | ---: | ---: | --- |
| aPTT | s | 11.0-17.5 | 13.3-20.2 | 3분 활성, ellagic acid reagent |
| PT | s | 11.0-15.5 | 15.0-20.0 | rabbit brain thromboplastin reagent |

응고 값은 시약과 장비에 민감하므로 “PT 정상 11-15.5초”만 저장하면 안 된다. 방법 식별자가 필수다.

### 4.4 요검사 `[S7]` `[S15]` `[S16]`

IDEXX complete urinalysis guide의 예:

- specific gravity: 개 1.015-1.045, 고양이 1.035-1.060
- pH: 신선한 개·고양이 소변 5.5-8.5
- WBC: 자연배뇨 0-8/HPF, 카테터 0-5/HPF, 방광천자 0-3/HPF
- protein dipstick: negative/trace/1+/2+/3+ 형태이며 specific gravity와 함께 해석

IRIS UPC는 일반 참고구간이라기보다 CKD substaging 결정구간이다.

| 종 | 비단백뇨 | 경계성 단백뇨 | 단백뇨 |
| --- | ---: | ---: | ---: |
| 개 | <0.2 | 0.2-0.5 | >0.5 |
| 고양이 | <0.2 | 0.2-0.4 | >0.4 |

지속성, 침사 활성, 신전성·신후성 원인 배제를 확인하지 않은 단일 UPC 값만으로 진단하면 안 된다.

### 4.5 내분비·다중 시점 `[S11]` `[S14]`

- TT4·FT4·TSH는 한 수치로 갑상선 질환을 확정하지 않고 종, 임상상, 동반 질환, 약물과 조합해 해석한다.
- canine TSH는 단독 판정용이 아니다.
- baseline cortisol은 개·고양이에서 2 µg/dL 초과가 hypoadrenocorticism과 맞지 않는다는 배제 기준으로 쓰일 수 있지만, 낮은 값은 ACTH stimulation으로 이어져야 한다.
- canine ACTH stimulation은 pre와 post 결과를 별도 시간점으로 저장해야 한다.
- bile acids는 fasting과 postprandial 결과를 한 결과 그룹 안의 두 시간점으로 관리해야 한다. IDEXX Catalyst는 결과 유형을 preprandial/postprandial/other로 식별하고, Cornell은 fasting과 2시간 post-prandial 채혈 프로토콜을 명시한다. `[S17]` `[S18]`

### 4.6 세포검사 `[S4]` `[S12]`

ECVCP 보고 지침은 숫자 정상범위보다 다음 구조를 요구한다.

1. 환자 종·연령, 필요 시 품종
2. 검체 유형과 채취법
3. 첨가제, 준비법, 슬라이드 수
4. Clinical Summary
5. Microscopic Description
6. Interpretation
7. Comment, 신뢰도, 감별진단, 추가 검사
8. 판독자 식별

관절액·체강액·CSF는 서술형 판독에 더해 nucleated cell concentration, total protein, PCV, viscosity, turbidity 등 구조화 수치가 함께 올 수 있다.

## 5. Airtable 72개 검사 전수 권장안

상태 의미:

- **유지**: 현재 결과 형태와 단위 방향이 타당. 참고구간 모델은 별도 필요.
- **교정**: 단위 또는 입력 타입을 수정.
- **분리**: 한 검사 정의를 여러 analyte/시간점/방법으로 분리.
- **구조화**: 자유 텍스트만으로는 부족하며 구조화 판독을 추가.

이 표의 `권장 결과 정의`는 곧바로 임상값으로 등록하라는 뜻이 아니다. 항목별 근거 강도와 미확정 조건은 5.2의 추적표에 묶어서 명시했다. 직접 일치하는 assay/kit 원문이 없는 감염·일부 특수화학 항목은 의도적으로 `H`로 남겼다.

| 그룹 | 코드 | 현재 | 권장 결과 정의 | 참고·판정 방식 | 조치 |
| --- | --- | --- | --- | --- | --- |
| CBC | RBC | 숫자 · 10^6/µL | 숫자 · M/µL | 장비·종별 양측 RI | 유지 |
| CBC | HCT | 숫자 · % | 숫자 · % | 장비·종별 양측 RI | 유지 |
| CBC | HGB | 숫자 · g/dL | 숫자 · g/dL | 장비·종별 양측 RI | 유지 |
| CBC | WBC | 숫자 · 10^3/µL | 숫자 · K/µL | 장비·종별 양측 RI | 유지 |
| CBC | PLT | 숫자 · 10^3/µL | 숫자 · K/µL + 응집 flag | 장비·종별 RI, smear 확인 | 구조화 |
| CBC | RETIC | 숫자 · % | RETIC %와 RETIC # 분리 | 장비·종별 양측 RI | 분리 |
| CBC | SMEAR | 서술 · 없음 | 형태·감별·혈소판 추정 구조 | 참고구간 미적용 | 구조화 |
| 화학 | AG_RATIO | 숫자 · 없음 | 숫자 · ratio | 종·방법별 양측 RI | 유지 |
| 화학 | ALB | 숫자 · g/dL | 숫자 · g/dL | 종·연령·검체·방법별 RI | 유지 |
| 화학 | ALP | 숫자 · U/L | 숫자 · U/L | 종·성장단계·방법별 RI | 유지 |
| 화학 | ALT | 숫자 · U/L | 숫자 · U/L | 종·방법별 RI | 유지 |
| 화학 | AMYL | 숫자 · U/L | 숫자 · U/L | 종·방법별 RI | 유지 |
| 화학 | AST | 숫자 · U/L | 숫자 · U/L | 종·방법별 RI | 유지 |
| 화학 | BUN | 숫자 · mg/dL | 숫자 · mg/dL | 종·연령·방법별 RI | 유지 |
| 화학 | CA | 숫자 · mg/dL | 숫자 · mg/dL | 종·방법별 RI | 유지 |
| 화학 | CHOL | 숫자 · mg/dL | 숫자 · mg/dL | 종·방법별 RI | 유지 |
| 화학 | CK | 숫자 · U/L | 숫자 · U/L | 종·방법별 RI | 유지 |
| 화학 | CREA | 숫자 · mg/dL | 숫자 · mg/dL | RI + 신장 결정구간/추세 | 구조화 |
| 화학 | CRP | 숫자 · mg/dL | mg/L 우선, 원단위 보존 | 주로 개, 방법별 상한 | 교정 |
| 화학 | DBIL | 숫자 · mg/dL | 숫자 · mg/dL | 종·방법별 RI | 유지 |
| 화학 | FRUCTOSAMINE | 숫자 · mg/dL | 숫자 · µmol/L | 종·방법별 RI | 교정 |
| 화학 | GGT | 숫자 · U/L | 숫자 · U/L | 종·방법별 RI | 유지 |
| 화학 | GLOB | 숫자 · g/dL | 숫자 · g/dL | 종·검체·방법별 RI | 유지 |
| 화학 | GLU | 숫자 · mg/dL | 숫자 · mg/dL | 종·연령·공복/스트레스 맥락 | 구조화 |
| 화학 | LDH | 숫자 · U/L | 숫자 · U/L | 종·방법별 RI | 유지 |
| 화학 | LIPA | 숫자 · U/L | 방법 코드 포함 숫자 · U/L | DGGR/일반 lipase 구분 | 교정 |
| 화학 | PHOS | 숫자 · mg/dL | 숫자 · mg/dL | 종·성장단계별 RI | 유지 |
| 화학 | SAA | 숫자 · mg/dL | mg/L 또는 µg/mL | 종·assay별 상한/RI | 교정 |
| 화학 | SDMA | 숫자 · mg/dL | 숫자 · µg/dL | RI + 신장 결정구간/추세 | 교정 |
| 화학 | TBA | 숫자 · 없음 | 숫자 · µmol/L, fasting/post | 시간점별 RI/결정구간 | 분리 |
| 화학 | TBIL | 숫자 · mg/dL | 숫자 · mg/dL | 종·방법별 RI | 유지 |
| 화학 | TG | 숫자 · mg/dL | 숫자 · mg/dL | 종·공복·방법별 RI | 구조화 |
| 화학 | TP | 숫자 · g/dL | 숫자 · g/dL | 종·검체·방법별 RI | 유지 |
| 전해질 | NA | 숫자 · mmol/L | 숫자 · mmol/L | 종·검체·방법별 RI | 유지 |
| 전해질 | K | 숫자 · mmol/L | 숫자 · mmol/L | 종·검체·용혈·방법별 RI | 구조화 |
| 전해질 | CL | 숫자 · mmol/L | 숫자 · mmol/L | 종·방법별 RI | 유지 |
| 전해질 | HCO3 | 숫자 · mmol/L | 숫자 · mmol/L | 종·방법·처리시간별 RI | 구조화 |
| 전해질 | MG | 숫자 · mmol/L | 숫자 · mmol/L 또는 mg/dL | 원단위·방법별 RI | 유지 |
| 대사 | LACTATE | 숫자 · mmol/L | 숫자 · mmol/L | 채혈·처리시간·방법별 상한 | 구조화 |
| 내분비 | CORTISOL | 숫자 · 없음 | 숫자 · µg/dL, protocol/timepoint | baseline/pre/post 결정구간 | 분리 |
| 내분비 | FT4 | 숫자 · 없음 | pmol/L 또는 ng/dL | assay·종별 RI, TT4와 조합 | 교정 |
| 내분비 | TSH | 숫자 · 없음 | ng/mL 또는 µU/mL | assay·종별 상한, T4와 조합 | 교정 |
| 내분비 | TT4 | 숫자 · 없음 | 숫자 · µg/dL | 종·연령·assay별 RI | 교정 |
| 응고 | APTT | 숫자 · s | 숫자 · s + reagent/method | 종·장비·시약별 RI | 구조화 |
| 응고 | PT | 숫자 · s | 숫자 · s + reagent/method | 종·장비·시약별 RI | 구조화 |
| 수혈 | BLOOD_TYPE | 코드 · 없음 | 종별 혈액형 코드 + typing method | 참고구간 미적용 | 구조화 |
| 요검사 | UA_SG | 코드 · 없음 | 숫자 · 무차원 | 종·수분·채취/측정법 맥락 | 교정 |
| 요검사 | UA_PH | 숫자 · 없음 | 숫자 · pH | 신선도·식이·방법별 RI | 유지 |
| 요검사 | UA_PROTEIN | 숫자 · mg/dL | 정량 농도와 dipstick grade 분리 | USG와 함께 해석 | 분리 |
| 요검사 | UA_GLUCOSE | 코드 · 없음 | 순서형 negative~grade | 종·strip 방법별 expected set | 교정 |
| 요검사 | UA_KETONE | 코드 · 없음 | 순서형 negative~grade | strip 방법별 expected set | 교정 |
| 요검사 | UA_BILIRUBIN | 코드 · 없음 | 순서형 negative~grade | 종·농축도·방법 맥락 | 교정 |
| 요검사 | UA_STRIP | 코드 · 없음 | 패널 정의로 이동 | 개별 analyte 결과를 묶음 | 분리 |
| 요검사 | UA_SED | 서술 · 없음 | RBC/WBC/세포/원주/결정/세균 구조 | /HPF·/LPF, 채취법별 RI | 구조화 |
| 요검사 | UCREA | 숫자 · mg/dL | 숫자 · mg/dL | 단독 RI보다 ratio 계산 원자료 | 구조화 |
| 요검사 | UPC | 숫자 · 없음 | 숫자 · ratio | 종별 IRIS 결정구간 | 구조화 |
| 감염 | BABESIA_PCR | 코드 · 없음 | detected/not detected/indeterminate/invalid + Ct optional | 숫자 RI 미적용 | 구조화 |
| 감염 | CDV_AG | 코드 · 없음 | positive/negative/invalid | kit·검체별 해석 | 구조화 |
| 감염 | CHW_AG | 코드 · 없음 | positive/negative/invalid | kit·검체별 해석 | 구조화 |
| 감염 | CPV_AG | 코드 · 없음 | positive/negative/invalid | kit·검체별 해석 | 구조화 |
| 감염 | FCOV_AB | 코드 · 없음 | positive/negative/indeterminate + titer optional | assay별 결정한계 | 구조화 |
| 감염 | FELV_AG | 코드 · 없음 | positive/negative/invalid | kit·검체별 해석 | 구조화 |
| 감염 | FIV_AB | 코드 · 없음 | positive/negative/invalid | kit·연령·예방접종 맥락 | 구조화 |
| 감염 | FPV_AG | 코드 · 없음 | positive/negative/invalid | kit·검체별 해석 | 구조화 |
| 기생충 | GIARDIA_AG | 코드 · 없음 | positive/negative/invalid | kit·검체별 해석 | 구조화 |
| 기생충 | FECAL_OB | 코드 · 없음 | positive/negative/invalid | kit별 해석 | 구조화 |
| 기생충 | FECAL_FLOAT | 서술 · 없음 | organism + count/grade + comment | 숫자 RI 미적용 | 구조화 |
| 기생충 | FECAL_MICRO | 서술 · 없음 | organism + count/grade + comment | 숫자 RI 미적용 | 구조화 |
| 세포검사 | EAR_CYTOLOGY | 서술 · 없음 | adequacy/description/interpretation/comment | 숫자 RI 미적용 | 구조화 |
| 세포검사 | SKIN_CYTOLOGY | 서술 · 없음 | adequacy/description/interpretation/comment | 숫자 RI 미적용 | 구조화 |
| 세포검사 | MASS_CYTOLOGY | 서술 · 없음 | adequacy/description/interpretation/comment | 숫자 RI 미적용 | 구조화 |
| 세포검사 | JOINT_FLUID_CYTOLOGY | 서술 · 없음 | 서술 + 세포수/TP/점도/혼탁도 | 항목별 RI 또는 판독 | 분리 |

### 5.1 Airtable에 없는 CBC 필수 후보

장비 능력 프로필에 따라 다음 analyte를 추가할 수 있어야 한다.

`MCV`, `MCH`, `MCHC`, `RDW`, `NEU#`, `LYM#`, `MONO#`, `EOS#`, `BASO#`, `RETIC#`, `RETIC-HGB`, `MPV`, `PDW`, `PCT`, `NRBC`, analyzer flag, morphology comment, dot plot/raw artifact.

각 장비가 보고하지 않는 항목은 `N/A` 또는 `NR`로 저장하고 0으로 대체하지 않는다.

### 5.2 전수 권장안 근거 추적표

| 적용 항목/제안 | 현재 근거 | 외부 근거 | 판단 | 신뢰도 | 확정 전 필요한 것 |
| --- | --- | --- | --- | --- | --- |
| CBC 단위·종별 RI, 누락 analyte 후보 | `[A1]` CBC_BASIC 3항목, unit vocabulary 9개 | ProCyte 결과항목·단위·RI `[S5]`, 다른 장비 RI `[S8]` | `[D1]` 장비 capability와 패널 구성을 분리 | 높음 | 병원 사용 장비와 보고항목 선택 |
| PLT 응집 flag, smear 보조 | `[A1]` PLT는 숫자 1개 | platelet clumping이 자동 계수에 영향을 줌 `[S13]` | `[D2]` 숫자 외 flag와 확인 상태 보존 | 중간 | 장비 flag 코드와 smear workflow |
| 일반 화학·전해질의 종/연령/방법별 RI | `[A1]` 단위만 있고 RI 없음 | Catalyst 종·life stage별 표 `[S6]`, Cornell 방법별 표 `[S9]` | `[D3]` 전역 RI 대신 interval set revision | 높음 | 설치 장비 또는 계약 검사실 확정 |
| SDMA, fructosamine, TT4 단위 교정 | `[A1]` 각각 mg/dL, mg/dL, 단위 없음 | Catalyst 표의 µg/dL, µmol/L, µg/dL `[S6]` | `[D4]` 원단위 보존 후 승인 단위로 교정 | 높음 | 실제 assay와 장비 확인 |
| CRP, SAA, lipase 결과 단위·방법 분기 | `[A1]` 단일 단위/정의 | Cornell Cobas 표는 CRP mg/L, SAA µg/mL, DGGR lipase U/L로 명시 `[S9]` | `[D14]` assay별 원단위와 방법 코드를 분리. Cornell 값을 CLAiR 기본값으로 복사하지 않음 | 중간 | 병원 kit/장비 IFU 원문과 실제 결과지 |
| TSH, FT4, cortisol 단위와 해석 | `[A1]` 숫자지만 단위/프로토콜 없음 | 갑상선 조합해석·cortisol 결정기준 `[S11]` `[S14]` | `[D5]` 단일 정상범위 대신 assay와 protocol 저장 | 중간 | 병원 assay 단위, 채혈 시점, stimulation protocol |
| bile acids fasting/postprandial 분리 | `[A1]` TBA 한 행, 단위 없음 | Catalyst의 pre/post 결과 유형과 µmol/L `[S17]`, Cornell의 fasting/2시간 post protocol `[S18]` | `[D6]` 시간점 두 개를 한 protocol result로 묶음 | 높음 | 병원 채혈 시간창과 assay RI |
| PT/aPTT에 장비·시약 식별 | `[A1]` 숫자와 초 단위만 존재 | 종별 값과 reagent가 함께 명시됨 `[S10]` | `[D7]` method 없는 자동판정 금지 | 높음 | 병원 coagulation 장비·시약 |
| UA specific gravity 숫자화 | `[A1]` coded 타입 | 연속 숫자 RI와 해석 `[S7]` | `[D8]` 무차원 numeric으로 저장 | 높음 | refractometer/장비 측정법 |
| UA sediment 채취법별 기준 | `[A1]` 서술 한 행 | voided/catheter/cystocentesis별 WBC 차이 `[S7]` | `[D9]` collection method를 rule 조건으로 사용 | 높음 | 병원 채취법 기록 workflow |
| UPC 결정구간 | `[A1]` 무단위 숫자 | 종별 proteinuria band와 지속성 조건 `[S15]` `[S16]` | `[D10]` 일반 RI가 아닌 decision bands | 높음 | 활성 침사·지속성·신전/신후성 배제 정보 |
| 감염/기생충 코드형 결과 구조 | `[A1]` 대부분 단일 coded 값 | CLAiR 대상 kit IFU 미확보 | `[H2]` positive/negative 외 invalid/indeterminate 필요 가능성 | 낮음 | 병원별 kit, 검체, Ct/titer 제공 여부, 확인검사 규칙 |
| cytology 구조화 보고 | `[A1]` 자유 서술만 존재 | description/interpretation/comment 및 검체 정보 `[S4]`, fluid 수치 병행 `[S12]` | `[D11]` 서술 섹션과 구조화 수치를 함께 지원 | 높음 | 병원 판독 양식과 서명 정책 |
| reference rule revision과 결과 snapshot | `[R1]` 문자열 범위, source/revision 없음; `[R2]` 기존 임상 마스터 문서도 출처·검토·맥락 전 배포 금지 | 검사실·방법별 RI 원칙 `[S1]` `[S2]` `[S3]` | `[D12]` 당시 적용 규칙과 맥락을 결과에 고정 | 높음 | revision 승인·폐기 운영 정책 |
| 종 필수, 연령/품종/성별/체중 조건부 | `[A1]` 환자 분기 없음 | 분할 기준은 통계·임상 근거가 있을 때 설정 `[S2]` `[S3]`; life stage 예 `[S6]` | `[D13]` 모든 속성을 무조건 범위 분기에 쓰지 않음 | 높음 | 항목별 partition 근거; 없으면 분기 금지 |

`H2`는 사용자가 요청한 “현실성 있는 추측” 영역이다. 보고서에는 남기되, kit 원문을 확보하기 전 단위·임계값·자동 판정 데이터로 등록하는 것은 차단한다. `D14`도 구조 제안은 근거가 있지만 Cornell 수치를 CLAiR 기본값으로 채택하는 것은 금지한다.

## 6. 권장 데이터 모델

### 6.1 원칙

1. **측정값은 preset이 아니다.** preset에는 입력 스키마, 단위, 참고 규칙만 있고 측정값은 encounter 결과에 저장한다.
2. **reference interval과 decision limit를 분리한다.** 건강 개체 분포와 진단/치료 결정을 위한 임계값은 의미가 다르다.
3. **범위는 revision 객체다.** 숫자 두 개를 검사 행에 직접 넣지 않는다.
4. **결과 시점에 스냅샷한다.** 나중에 기준이 바뀌어도 과거 판정의 근거가 유지되어야 한다.
5. **장비·방법 없는 자동 판정을 금지한다.** 매칭되는 검증 범위가 없으면 `not_judged`다.
6. **환자 조건은 근거가 있을 때만 분기한다.** 종은 필수, 연령·품종·성별·체중은 rule이 선언할 때만 사용한다.

### 6.2 제안 엔터티

| 엔터티 | 핵심 필드 | 목적 |
| --- | --- | --- |
| `master.lab_result_definitions` | analyte code, value kind, canonical unit, precision, allowed coded values | 결과 항목의 안정적 정의 |
| `master.lab_reference_interval_sets` | source, lab/analyzer, model, software, method, reagent, specimen, valid dates, reviewer, status | 한 출처·방법의 버전 묶음 |
| `master.lab_reference_interval_rules` | species, age band, breed, sex, reproductive state, collection method, lower/upper/comparator, coded normal set, decision text, priority | 적용 조건과 판정 |
| `master.lab_protocol_definitions` | protocol code, timepoints, collection windows | ACTH, bile acids 같은 다중 시점 검사 |
| `public.workspace_lab_profile_revisions` | workspace, analyzer/source lab, selected interval set, activation status | 병원별 실제 사용 기준 |
| `public.lab_result_entry_rows` 확장 | raw value, normalized value, original/canonical unit, reference snapshot, decision snapshot, flags, context snapshot | 결과와 당시 판정 근거 보존 |

### 6.3 참고구간 rule 최소 필드

| 필드 | 필수 여부 | 설명 |
| --- | --- | --- |
| `analyte_definition_id` | 필수 | 어떤 결과 항목인지 |
| `interval_set_revision_id` | 필수 | 출처·장비·방법 revision |
| `species_code` | 자동 판정 시 필수 | dog, cat 등 |
| `specimen_type` | 대부분 필수 | serum, plasma, EDTA whole blood 등 |
| `analyzer_model / method_code` | 자동 판정 시 필수 | 장비 또는 외부 검사법 |
| `age_min_days / age_max_days` | 선택 | 근거가 있는 성장단계 |
| `breed_include/exclude` | 선택 | 검증된 품종 분기만 |
| `sex / reproductive_status` | 선택 | 유의한 근거가 있을 때만 |
| `weight_min/max_kg` | 선택 | 체중 기반 RI가 검증된 검사만 |
| `collection_method` | 선택/요검사 필수 | voided, catheter, cystocentesis |
| `fasting_state` | 선택 | glucose, TG, bile acids 등 |
| `timepoint_code` | protocol 검사 필수 | baseline, post_1h, fasting, postprandial |
| `bound_kind` | 필수 | two_sided, upper_only, lower_only, decision_bands, coded_set, none |
| `lower_value / upper_value` | 조건부 | 숫자 한계 |
| `coded_normal_values` | 조건부 | negative 등 |
| `display_text` | 필수 | 결과지에 보일 참고 기준 |
| `source_locator` | 필수 | 문서, 페이지, 표, 버전 |
| `clinical_review_status` | 필수 | draft, in_review, approved, rejected |
| `valid_from / valid_to` | 필수/선택 | 시간 유효성 |

### 6.4 적용 우선순위

1. 병원에서 검증·승인한 장비/외부 검사실별 rule
2. 설치된 장비 모델·소프트웨어 버전의 제조사 rule
3. 계약된 외부 검사실의 공식 rule
4. 교육/조사용 일반 수의 reference: 화면에 참고 표시만, 자동 판정 금지
5. 매칭 없음: `참고구간 없음 · 미판정`

동률이면 더 구체적인 rule을 우선하고, 여전히 둘 이상이면 자동 선택하지 않고 구성 오류로 처리한다.

## 7. 현재 저장소와의 차이

### 7.1 현재 가능한 것

- [`lab_test_items`](../../../supabase/migrations/20260520152000_hospital_admin_order_catalog_persistence.sql): 이름, 입력 타입, 단위 (`R1`, 생성부 86행부터)
- [`lab_result_entry_rows`](../../../supabase/migrations/20260609112000_lab_result_entry_persistence.sql): 결과값, 단위, 문자열 reference range, judgment, note (`R1`, 생성부 26행부터)
- UI: `low`, `normal`, `high`, `critical`, `not_judged` 표시
- [`parseReferenceRange()`](../../../src/features/lab-imaging/module.tsx): 숫자 `min-max` 문자열의 클라이언트 파싱과 단순 범위 막대 (`R1`, 235행부터)

### 7.2 현재 불가능한 것

- [result-sheet catalog API](../../../src/app/api/workspaces/%5BworkspaceId%5D/lab-imaging/result-sheet-catalog/route.ts)가 참고구간을 반환하지 않음 (`R1`)
- 종·연령·장비·검체·방법별 rule 선택
- 단측 상한/하한, 결정구간, 코드형 정상 집합
- ACTH/bile acids 다중 시점
- cytology의 description/interpretation/comment 구조
- 원단위와 canonical unit 동시 보존
- 범위 출처와 revision 스냅샷
- 임상 승인과 synthetic 작성 승인의 구분
- 서버의 값 기반 독립 판정; 현재 서버는 전달된 `judgment`를 집계할 뿐임

기존 Phase 1 명세도 source, reviewer, context, publication rule이 승인되기 전에는 사용자용 reference range를 만들거나 seed하지 않는다고 명시한다. `[R2]` 이번 제안은 이 안전선을 바꾸는 것이 아니라, 이후에 필요한 구조와 승인 단계를 구체화한 것이다.

## 8. UX 권장안

### 8.1 결과 행

기본 열:

`검사항목 | 결과 | 단위 | 참고 기준 | 판정 | 담당자`

추가 상태:

- 참고구간 없음
- 해당 없음
- 미판정
- 장비 flag
- 검체 간섭/응집
- 재검 필요
- 장비 미지원(N/A)
- 기준 미보고(NR)
- 임상병리 확인 대기

### 8.2 참고 기준 표시

- 양측 RI: 범위 막대
- 단측 상한: 0부터 상한까지가 아니라 “≤14”처럼 comparator를 직접 표시
- 결정구간: “비단백뇨 / 경계 / 단백뇨” band
- 코드형: “정상 기대값: 음성” 또는 “수치 범위 적용 안 됨”
- 서술형: 범위 칸 대신 “판독형”과 판독 상태
- 출처 툴팁: 장비/검사실, 종, 검체, 방법, 버전, 적용일

### 8.3 환자 조건

결과 화면은 “현재 환자에 적용된 조건”을 짧게 보여줘야 한다.

예: `고양이 · 성묘 · EDTA 전혈 · ProCyte Dx v5.01`

체중·성별·품종은 무조건 노출하지 않고, 선택된 rule이 실제로 사용했을 때만 “판정 조건”에 표시한다.

## 9. 실행 제안

### Phase A — 임상 안전 기반

- Airtable에 외부 source와 clinical review 상태를 추가
- unit vocabulary 확장 및 SDMA/Fructosamine/SAA/T4/TSH/Cortisol/TBA 교정
- CBC analyte set 확장
- 참고구간 set/rule authoring table 설계
- synthetic 승인과 clinical 승인 분리

### Phase B — 병원별 활성화

- 병원 장비/외부 검사실 프로필 등록
- 제조사/검사실 범위 revision 선택
- dog/cat + age band + specimen + method 규칙 검증
- 범위가 없는 검사는 `not_judged` 유지

### Phase C — 런타임

- result-sheet catalog API가 result definition과 적용된 reference rule을 반환
- 서버가 raw value를 파싱·정규화하고 judgment를 계산
- result row에 rule revision과 context snapshot 저장
- UI가 결과 형태별 셀을 사용

### Phase D — 임상 검토

- 대표 병원 장비와 외부 검사실별 샘플 결과지 대조
- 임상병리 수의사 검토
- synthetic 값 없이 승인된 subset부터 배포
- 과거 결과는 기존 snapshot으로 유지

## 10. 승인 전 차단 조건

다음 중 하나라도 없으면 자동 판정용 clinical preset을 배포하지 않는다.

- 공식 출처와 locator
- analyzer/method/specimen 식별
- species 적용 범위
- 단위와 환산 규칙
- 참고구간 또는 결정한계의 의미
- 임상 검토자와 승인일
- revision과 유효기간
- 병원별 활성화 기록

## 11. 출처

### 전문 지침

- `[S1]` [ASVCP Quality Assurance and Laboratory Standard Guidelines](https://www.asvcp.org/page/QALS_Guidelines) — 검사실 품질·표준 운영 지침.
- `[S2]` [ASVCP reference interval guidelines](https://onlinelibrary.wiley.com/doi/full/10.1111/vcp.12006) — RI 설정, 검증, partition 원칙.
- `[S3]` [eClinPath: Reference intervals](https://eclinpath.com/test-basics/reference-intervals/) — 검사실·방법별 RI와 적용 한계.
- `[S4]` [ECVCP Guidelines for Veterinary Clinical Pathology Reporting](https://www.esvcp.org/docman/exam/27-guidelines-for-cytology-reporting/file.html) — cytology 보고 섹션과 판독 요소.

### 장비·검사법

- `[S5]` [IDEXX ProCyte Dx reference intervals](https://www.idexx.com/media/filer_public/e2/16/e216b67b-2da8-4bd2-ad27-f75bafb7ed85/procyte-dx-reference-ranges-en.pdf) — canine/feline 표의 analyte·단위·RI 행.
- `[S6]` [IDEXX Catalyst reference ranges](https://www.idexx.com/files/catalyst-species-reference-ranges.pdf) — species/life stage 표의 chemistry·electrolyte 행.
- `[S7]` [IDEXX complete urinalysis interpretation guide](https://www.idexx.com/media/filer_public/e1/7c/e17ce620-4ebc-4f15-bbfb-cb07b3be16a4/english_comp_urinalysis_mdb-analytes.pdf) — USG, pH, collection method별 sediment 표.
- `[S17]` [IDEXX Catalyst Bile Acids](https://www.idexx.com/en/veterinary/analyzers/catalyst-one-chemistry-analyzer/catalyst-bile-acids/) — pre/post protocol, result type, µmol/L 측정 범위.

### 대학·진단검사실

- `[S8]` [Cornell Hematology, Advia 2120](https://www.vet.cornell.edu/animal-health-diagnostic-center/laboratories/clinical-pathology/reference-intervals/hematology-advia-2120) — analyzer별 canine/feline CBC 표.
- `[S9]` [Cornell Chemistry, Cobas](https://www.vet.cornell.edu/animal-health-diagnostic-center/laboratories/clinical-pathology/reference-intervals/chemistry-cobas) — analyzer별 chemistry 표; fructosamine, CRP, SAA, DGGR lipase 포함.
- `[S10]` [Cornell Comparative Coagulation assay reference intervals](https://www.vet.cornell.edu/animal-health-diagnostic-center/testing-laboratories/comparative-coagulation/assay-reference-intervals) — PT/aPTT 종별 RI와 reagent.
- `[S11]` [Cornell Thyroid Testing Interpretation](https://www.vet.cornell.edu/animal-health-diagnostic-center/testing/testing-protocols-interpretations/thyroid-testing-interpretation) — 갑상선 검사 조합 해석.
- `[S12]` [MSU Veterinary Diagnostic Laboratory Cytology](https://cvm.msu.edu/vdl/laboratory-sections/clinical-pathology/cytology) — fluid cytology의 수치·판독 항목.
- `[S13]` [eClinPath: Platelet count](https://eclinpath.com/hematology/tests/platelet-count/) — platelet clumping과 자동 계수 한계.
- `[S18]` [Cornell Clinical Pathology Panels and Guidelines](https://www.vet.cornell.edu/animal-health-diagnostic-center/veterinary-resources/testing-guidelines/clinical-pathology-panels-and-guidelines) — bile acids fasting/post-prandial 채혈과 해석 조건.

### 임상 결정 지침

- `[S14]` [AAHA thyroid and cortisol interpretation guide](https://www.aaha.org/wp-content/uploads/globalassets/02-guidelines/2023-aaha-selected-endocrinopathies-of-dogs-and-cats-guidelines/resources/interpretive-guidelines-for-thyroid-and-cortisol-testing-for-dogs-and-cats_zoetis.pdf) — thyroid 조합 해석과 cortisol 결정기준.
- `[S15]` [IRIS Staging System](https://www.iris-kidney.com/iris-staging-system) — canine/feline UPC substaging bands.
- `[S16]` [IRIS Guidelines](https://www.iris-kidney.com/iris-guidelines-1) — 지속성·renal origin 확인 조건.

### 현재 시스템 근거

- `[A1]` Airtable `CLAiR Clinical Master` 읽기 전용 조회, 2026-09-02 — Lab tests, panels, panel items, order profiles, units, result input types, sources. 내부 base/table ID는 보고서에서 제외했다.
- `[R1]` 현재 저장소 직접 확인, 2026-09-02 — [`lab_test_items`](../../../supabase/migrations/20260520152000_hospital_admin_order_catalog_persistence.sql), [`lab_result_entry_rows`](../../../supabase/migrations/20260609112000_lab_result_entry_persistence.sql), [result-sheet catalog API](../../../src/app/api/workspaces/%5BworkspaceId%5D/lab-imaging/result-sheet-catalog/route.ts), [`parseReferenceRange()`](../../../src/features/lab-imaging/module.tsx)와 judgment 흐름.
- `[R2]` 기존 저장소 정책 문서 — [Phase 1 DB spec 8.5](./clair-clinical-master-data-phase-1-db-spec.md#85-reference-ranges) 및 [target architecture 12.1](./clair-clinical-master-data-target-architecture.md#121-reference-range-contract). 출처·검토·맥락 없는 임상값의 사용자 배포를 금지한다.

모든 외부 링크의 최종 확인일은 2026-09-02다. PDF는 표/항목명이 locator이며, 웹 문서는 위 설명의 섹션 또는 analyte 행이 locator다. 실제 임상 등록 시에는 문서 버전, 발행일, 페이지/표, 장비 소프트웨어, 시약 lot까지 별도 source record로 고정해야 한다.

## 12. 이 문서가 확정하지 않는 것

- CLAiR 공통 임상 참고구간의 실제 배포값
- 특정 병원의 장비·시약·외부 검사실 선택
- 임상병리 수의사 승인
- DB migration, Airtable write, 앱 구현
- 실제 환자 결과의 판정 또는 의료 조언
