---
title: "마스터 오더 현실성 조사 보고서"
status: "review-proposal"
updated: "2026-09-02"
workspace: "workspace-clair-cheongdam"
scope: "마스터 오더 카탈로그·프리셋·업무 라우팅 읽기 전용 조사"
---

# 마스터 오더 현실성 조사 보고서

> 조사일: 2026-09-02 · 대상: `workspace-clair-cheongdam` · 작성 목적: 임상 배포가 아니라 카탈로그 개선 의사결정

## 1. 결론

현재 마스터 오더는 **“구조와 수량을 검증하기 위한 합성 데이터”로는 충분하지만, 실제 동물병원에서 바로 선택·실행할 임상 프리셋으로는 부족하다.** 조제 오더는 다른 군보다 상세하지만 아직 임상 검토 전이며, 검사 오더를 제외한 진찰·예방·처치·수술·입원·응급 오더는 특히 아래 문제가 크다.

1. **분류가 보존되지 않는다.** 마스터의 `CG_*` 코드가 한글 키워드 기반 화면 분류기에 들어가면서 예방은 기본 진료비로, 수술·치료는 처치로, 기타 검사는 의료물품으로 합쳐질 수 있다.
2. **프리셋이 이름만 다르고 실행 정보는 같다.** 진찰·예방 55건은 같은 3개 필드, 입원 30건은 같은 4개 필드, 처치·치과·수술 111건은 거의 같은 4~5개 필드를 반복한다.
3. **단일 오더와 진료 프로토콜의 경계가 없다.** 치과·마취·수술·응급·입원처럼 여러 단계와 담당자가 필요한 업무를 한 줄짜리 즉시 완료 또는 단일 처치 오더로 표현한다.
4. **청구 단위와 가격이 임상 운영을 반영하지 않는다.** 실제 마스터 521건이 `per_order`이고, 입원도 일당이 아닌 회당이다. 반면 CLAiR 설계 계약은 마스터 가격을 권위값으로 두지 않고 병원이 가격을 의도적으로 설정하도록 정한다.
5. **명백한 검수 오류가 남아 있다.** `Initial Consultation Changed`, 고양이 전용 예방접종의 개·고양이 공용 적용, `대형견 입원 관리`의 고양이 적용 같은 항목이 활성 카탈로그에 존재한다.

따라서 지금 필요한 것은 오더명을 더 늘리는 일이 아니라, **분류 투영을 먼저 고치고 → 임상 행위군별 스키마를 분리하고 → 복합 업무를 Order Set으로 재구성하고 → 수의사 검토를 거쳐 승인하는 작업**이다.

### 준비도 판정

| 평가 축 | 현재 판정 | 근거 |
| --- | --- | --- |
| 수량·구조 검증 | 보통 | Cheongdam 534건 중 마스터 복사본 522건, 기존 로컬 12건이 존재한다. |
| 화면 분류 정확성 | 낮음 | `CG_*` 코드를 한글 문자열 포함 여부로 분류하며 `t_code`는 마스터 복사본 522건 모두 비어 있다. |
| 비조제 프리셋 구체성 | 낮음 | 주요 군마다 1~3개의 키 조합만 반복한다. |
| 실행·라우팅 현실성 | 낮음 | 응급·입원·예방이 `immediate_complete`이거나 수행 모듈 없이 끝난다. |
| 청구 현실성 | 낮음 | 521건이 `per_order`; 병원별 가격이어야 할 값이 마스터 복사 시 채워져 있다. |
| 임상 사용 가능성 | 차단 유지 | 마스터 복사본 522건 모두 `clinical_use_allowed=false`이다. |
| 조제 상대 완성도 | 상대적으로 높음 | 161건 중 108건은 13개 입력값을 가지지만, 전 건 임상 검토 전이다. |

## 2. 조사 범위와 근거 규칙

### 2.1 조사 범위

- 현재 연결된 Cheongdam 워크스페이스의 `order_catalog_items`를 읽기 전용으로 조사했다.
- 환자·보호자·진료기록은 조회하지 않았다.
- 조제와 임상병리는 비교 기준으로만 간단히 다뤘고, 사용자 문제 제기와 직접 연결되는 비조제 카테고리를 깊게 조사했다.
- 데이터 수정, 임상 활성화, 가격 변경, 배포는 수행하지 않았다.
- 이번 세션에서는 로그인된 브라우저 화면을 다시 열 수 없어, 화면의 시각적 배치 자체는 재검증하지 못했다. 화면 건수는 현재 DB 분해와 기존 관찰값이 일치하는 경우에만 사용했다.

### 2.2 근거 등급

| 표기 | 의미 | 사용 원칙 |
| --- | --- | --- |
| **D — Current data** | 2026-09-02 현재 카탈로그·코드에서 직접 확인 | “현재 무엇이 들어 있는가”의 근거 |
| **R — Repo contract** | CLAiR 저장소의 승인된 아키텍처·제품 계약 | “어떤 책임 분리가 합의됐는가”의 근거 |
| **C — Clinical source** | AAHA·AAFP·ACVR·Cornell·RECOVER 등 공식/1차 임상 자료 | “실제 진료에서 어떤 정보가 필요한가”의 근거 |
| **I — Product inference** | D/R/C를 연결한 제품 설계 제안 | 임상 프로토콜 자체가 아니라 구현 방향으로만 사용 |

> 외부 자료는 예방, 진찰, 영상, 검체, 처치, 마취·수술, 치과, 수액, 응급의 네 갈래 검색에서 총 138개 검색 결과를 검토한 뒤 공식 기관과 동료평가 자료를 우선 선별했다. 가이드는 병원별 수의사의 판단을 대체하지 않는다.

## 3. 현재 데이터의 정량 진단

### 3.1 카탈로그 구성

| 마스터 의미 단위 | 건수 | 현재 투영 상태 | 현실성 판정 |
| --- | ---: | --- | --- |
| 진찰·상담 | 31 | `consultation / CG_CONSULTATION` | 입력이 너무 단순함 |
| 증명서·기타 | 13 | `misc / CG_CONSULTATION` | 임상 오더와 행정 수수료가 섞임 |
| 예방 | 24 | `consultation / CG_PREVENTION` | 기본 진료비로 합쳐질 위험 |
| 계통검사 | 12 | `misc / CG_EXAM` | 독립 오더보다 차트 템플릿에 가까움 |
| 응급 | 24 | `misc / CG_EXAM` | 실행 라우팅이 없는 청구성 항목 |
| 임상병리 | 86 | `lab / CG_EXAM` | 의뢰검사 구분 없음 |
| 영상 | 30 | `imaging / CG_PROCEDURE` | 방사선·초음파·CT 의미가 한 틀에 섞임 |
| 기본 처치 | 45 | `treatment / CG_THERAPY` | 처치 유형별 필드 부족 |
| 치과 처치 | 24 | `treatment / CG_PROCEDURE` | 단계형 치과 프로토콜 부재 |
| 수술·마취 | 42 | `treatment / CG_SURGERY` | 수술, 준비, 마취, 회복이 한 군에 섞임 |
| 입원 | 30 | `hospitalization / CG_INPATIENT` | 회당·즉시완료로 처리 |
| 조제·조제물품 | 161 | `medication / CG_MEDICATION_SUPPLY` | 상대적으로 상세하나 전 건 검토 전 |
| **합계** | **522** | 마스터 복사본 | 임상 사용 차단 상태 |

Cheongdam 전체 534건은 마스터 522건과 기존 로컬 12건의 합이다. 화면에서 관찰된 `기본 진료비 57`은 진찰 31 + 예방 24 + 기존 진찰 2로 정확히 분해된다. `임상병리 검사 89`도 마스터 검사 86 + 기존 검사 3으로 분해된다. 즉, 수치 차이는 우연이 아니라 **분류 투영 결과**다.

### 3.2 프리셋 반복 정도

| 데이터 군 | 건수 | 서로 다른 입력 키 조합 | 가장 많이 반복된 입력 |
| --- | ---: | ---: | --- |
| 진찰 | 31 | 1 | `instructionSummary`, `occurrenceCount`, `timing` |
| 예방 | 24 | 1 | 진찰과 동일한 3개 키 |
| 입원 | 30 | 1 | `careLevel`, `durationDays`, `monitoringInterval`, `nursingPlan` |
| 영상 | 30 | 3 | 26건이 같은 6개 키 |
| 임상병리 | 86 | 2 | 74건이 같은 3개 키 |
| 기본 처치 | 45 | 2 | `method`, `schedule`, `frequency`, `stagedInstructions` + 선택적 `site` |
| 치과 | 24 | 1 | 기본 처치와 같은 4개 키 |
| 수술·마취 | 42 | 2 | 기본 처치와 같은 4~5개 키 |
| 계통검사 | 12 | 1 | `bodySystem`, `examMethod`, `examScope` |
| 응급 | 24 | 1 | `description`, `structuredValue` |
| 증명서·기타 | 13 | 1 | 응급과 같은 2개 키 |
| 조제 | 161 | 4 | 108건은 용량·빈도·기간·총량 등 13개 키 |

이 표는 “프리셋이 일관적이고 단편적이다”라는 인상을 직접 확인한다. **같은 필드가 있다는 점이 문제가 아니라, 임상적으로 다른 행위군 사이에서 필드·기본값·완료 방식까지 동일하다는 점**이 문제다.

### 3.3 구조적 결함

#### A. 코드 기반 분류를 문자열 추측으로 다시 분류한다

현재 화면 투영은 `categoryGroup`과 `categoryLabel`의 한글 포함 여부로 하위 카테고리를 정한다.

- `consultation`은 라벨에 `기타`가 없으면 모두 기본 진료비다.
- `lab`은 `화학`·`의뢰`라는 한글이 없으면 모두 임상병리다.
- `imaging`은 `초음파`라는 한글이 없으면 모두 방사선이다.
- `treatment`은 `마취`·`수술`·`치료`라는 한글이 없으면 모두 기본 처치다.
- 그 외는 모두 의료물품으로 내려간다.

그러나 현재 마스터 라벨은 `CG_PREVENTION`, `CG_SURGERY`, `CG_THERAPY` 같은 코드형 문자열이다. 저장소 아키텍처는 CG를 별도 표현 그룹으로 보존하고 `categoryGroup`에 덮어쓰지 말라고 명시한다. **따라서 UI 분류는 이름 추측이 아니라 `classification_path_id → CG/T/A` 코드 투영을 사용해야 한다.**

근거: [현재 분류 구현](../../../src/features/hospital-admin/data.ts#L750-L797) **[D]**, [필드 책임 계약](../../engineering/data-model/clair-clinical-master-data-target-architecture.md#L608-L623) **[R]**

#### B. 이름·별칭·설명이 실제 검색과 업무 언어를 만들지 못한다

- 비조제 361건은 표준명, 병원명, 청구명이 모두 같다.
- 검색 별칭, 진료 가이드, 내부 지시가 비어 있다.
- 영문 QA 흔적인 `Initial Consultation Changed`가 활성 데이터에 남아 있다.

제안: 표준명은 고정하되 병원 표시명과 청구명은 용도에 맞게 분리하고, 약어·동의어·기존명은 별칭에 넣는다. “처치 1” 같은 이름 확장이 아니라 **행위 + 부위/목적 + 구분자**로 검색 가능한 이름을 만든다. **[D][R][I]**

#### C. 가격과 판매 단위가 합성 값으로 임상 의미를 흉내 낸다

- 522건 중 510건에 가격이 들어 있고, 실사용형 521건의 판매 단위가 모두 `per_order`다.
- 입원 30건도 일당이 아니라 회당이다.
- CLAiR 계약은 “마스터의 권위 있는 가격 없음, 병원이 명시적으로 가격 설정, 미설정과 0원은 구분”을 확정했다.

제안: 마스터 배포 시 가격은 `unset / needs_workspace_review`로 두고 병원에서 `per_each`, `per_session`, `per_day`, `per_minute`, `per_ml` 등 행위군에 맞게 설정한다. 임상 오더와 청구 항목의 관계는 1:1을 강제하지 않는다. **[D][R][I]**

근거: [가격 책임 계약](../../engineering/data-model/clair-clinical-master-data-target-architecture.md#L618) **[R]**

#### D. 현재 데이터는 임상 가이드가 아니라 시스템 검증 자료다

마스터 522건은 모두 `clinical_use_allowed=false`다. 이는 오류가 아니라 현재 계약과 일치한다. Phase 1 명세도 합성 구조 데이터가 시스템을 검증할 수는 있지만 임상적으로 검증된 안내처럼 노출하면 안 된다고 명시한다.

제안: 수정 전까지 임상 사용 차단을 유지하고, 카테고리별 검토 게이트를 통과한 revision만 별도로 활성화한다. **[D][R]**

근거: [Phase 1 임상 검증 경계](../../engineering/data-model/clair-clinical-master-data-phase-1-db-spec.md#L48-L68) **[R]**

## 4. 카테고리별 현실성 진단과 수정 제안

### 4.1 진찰·상담

**현재 문제 [D]**

- 진찰 31건 전체가 `timing=now`, `occurrenceCount=1`, “`<오더명> 진행`”의 같은 틀이다.
- 초진·재진·전문상담·전화상담처럼 소요 시간, 진료 범위, 담당자, 후속 조치가 다른 업무를 구분하지 못한다.
- 기본 진료비와 상담 행위, 증명서·행정 수수료가 같은 “오더” 층위에 놓여 있다.

**왜 부족한가 [C]**

AAHA/AAFP life-stage 가이드는 진료를 단순 1회 행위가 아니라 생활 단계, 위험, 병력, 신체검사, 예방·진단 권고를 함께 기록하는 개별화된 방문으로 본다. 따라서 모든 진찰이 “지금 1회 진행”만 갖는 것은 실행과 기록에 필요한 맥락을 남기지 못한다.

**수정안 [I]**

- `encounter_type`: 초진 / 재진 / 전문상담 / 응급 / 비대면
- `scope`: 문제 중심 / 예방 / 수술 전 / 만성질환 추적
- `planned_duration_minutes`, `performer_role`, `follow_up_window`
- `included_components`: 병력, 신체검사, 상담, 문서 제공
- 증명서·복사·행정 수수료는 `administrative_service`로 분리하고 임상 수행 태스크를 만들지 않는다.

**권장 예시**

`재진 — 만성질환 추적` → 20분, 담당 수의사, 최근 검사·복약 확인, 추적기간 필수. 가격은 병원 설정.

근거: [2021 AAHA/AAFP Feline Life Stage Guidelines](https://www.aaha.org/wp-content/uploads/globalassets/02-guidelines/feline-life-stage-2021/2021-aaha-aafp-feline-life-stage-guidelines.pdf) **[C]**

### 4.2 예방·백신

**현재 문제 [D]**

- 예방 24건이 `consultation / CG_PREVENTION`으로 저장되어 기본 진료비에 합쳐진다.
- 24건 전체가 “예방 상담 진행”이라는 같은 3개 입력만 가진다.
- `고양이 백혈병 예방접종`과 `강아지 예방접종 관리`가 모두 `{cat,dog}` 대상으로 설정돼 있다.
- 백신 제품, 항원, 차수, 예정일, 투여 경로·부위, lot/유효기간, 이상반응 기록이 없다.

**왜 부족한가 [C]**

AAHA 개 예방접종 가이드는 core/noncore 구분뿐 아니라 개별 환자의 생활 방식과 위험 요인에 따라 접종 권고가 달라진다고 설명한다. 고양이 life-stage 가이드도 생활 단계와 위험에 따른 개별 예방 계획을 전제로 한다. 따라서 종과 위험을 구분하지 않는 고정 1회 프리셋은 현실적이지 않다.

**수정안 [I]**

- `preventive_consultation`, `vaccination_administration`, `parasite_prevention`을 분리한다.
- `species`, `life_stage`, `risk_profile`, `vaccine_antigen/product`, `dose_sequence`, `due_window`를 처방 단계에 둔다.
- 실행 단계에서 `lot_number`, `expiry_date`, `route`, `site`, `administrator`, `adverse_event`를 기록한다.
- “고양이 백혈병 예방접종”은 canonical species를 cat으로 고치고, 병원은 임상 적응 대상만 추가 제한할 수 있게 한다.

**권장 예시**

`고양이 FeLV 예방접종 — 위험평가 기반` → cat 전용, 차수·이전 접종일·제품·lot·부위·이상반응 필수, 다음 접종일 자동 제안은 수의사 승인 후 확정.

근거: [2022 AAHA Canine Vaccination Guidelines](https://www.aaha.org/resources/2022-aaha-canine-vaccination-guidelines/) **[C]**, [2021 AAHA/AAFP Feline Life Stage Guidelines](https://www.aaha.org/wp-content/uploads/globalassets/02-guidelines/feline-life-stage-2021/2021-aaha-aafp-feline-life-stage-guidelines.pdf) **[C]**

### 4.3 계통검사

**현재 문제 [D]**

- 12건이 모두 `bodySystem`, `examMethod`, `examScope`만 가지며 `chart_only / immediate_complete / 비청구`다.
- 이 특성은 오더보다는 SOAP 신체검사 기록 블록에 가깝다.
- 선택 시 별도 수행 태스크나 결과 수신이 없고, 정상/이상/미검 여부도 구조화되지 않는다.

**수정안 [I]**

- 12개 계통검사를 독립 오더 목록에서 빼고 `physical_exam_template`의 반복 블록으로 전환한다.
- 각 계통에 `not_examined / normal / abnormal`, 관찰값, 병변 위치, 중증도, 후속 오더 연결을 둔다.
- 독립 검사·검체·영상이 필요한 경우에만 실제 atomic order를 생성한다.

**권장 예시**

`심혈관계 신체검사 블록` → 심박수, 리듬, 심잡음 grade, 맥박, CRT, 이상 소견. 이상 시 심전도·흉부영상 오더를 제안하되 자동 확정하지 않는다.

근거: [2021 AAHA/AAFP Feline Life Stage Guidelines](https://www.aaha.org/wp-content/uploads/globalassets/02-guidelines/feline-life-stage-2021/2021-aaha-aafp-feline-life-stage-guidelines.pdf) **[C]**

### 4.4 임상병리·의뢰검사

**현재 문제 [D]**

- 마스터 검사 86건이 모두 `CG_EXAM`이고 `is_external_lab=true`는 0건이다.
- 74건이 `specimenType`, `testPanel`, `collectionCondition`의 같은 3개 키를 사용한다.
- 검사별 튜브, 최소 검체량, 안정성, 보관·운송, 검사실, TAT, 결과 단위·참고구간 연결이 없다.
- 화면의 임상병리·혈액화학·의뢰검사 분리는 데이터로 보존되지 않는다.

**왜 부족한가 [C]**

Cornell 진단검사실은 올바른 라벨, 검체 종류, 보관·운송, 채취 부위와 임상정보가 결과 정확성과 안전에 직접 영향을 준다고 명시한다. 일부 분석물은 즉시 취급해야 하며 튜브 선택도 검사에 따라 다르다.

**수정안 [I]**

- `lab_test`, `lab_panel`, `external_lab_service`를 분리한다.
- 검사 프로필에 `specimen_type`, `container/tube`, `minimum_volume`, `handling`, `stability`, `external_lab`, `turnaround_time`, `result_definition`을 둔다.
- 패널은 구성 검사를 참조하고, 단일 검사를 이름 복사로 중복 생성하지 않는다.

근거: [Cornell Clinical Pathology Samples & Submissions](https://www.vet.cornell.edu/animal-health-diagnostic-center/laboratories/clinical-pathology/samples-submissions) **[C]**

### 4.5 영상검사

**현재 문제 [D]**

- 영상 30건이 모두 `CG_PROCEDURE`다. 화면 분류기는 “초음파” 한글이 없으면 방사선으로 본다.
- `흉부 방사선 정면 검사`와 `측면 검사`가 각각 `viewCount=2`라 이름의 1방향 개념과 수량이 충돌한다.
- `CT 영상자료 판독 상담`도 촬영 오더처럼 자세와 view 수를 요구한다.
- 환자 크기, 투사 방향, 좌우, 진정/마취 계획, 조영제, 촬영 대 프로토콜, 판독 주체가 충분히 분리되지 않는다.

**왜 부족한가 [C]**

Merck는 방사선, 초음파, CT, MRI를 서로 다른 영상 방식으로 설명한다. ACVR는 방사선·CT 프로토콜이 환자 크기·체중·체형을 고려해야 하고, 진정·보정·안전 SOP까지 포함해야 한다고 권고한다.

**수정안 [I]**

- `modality`, `body_region`, `laterality`, `projection/view_set`, `contrast`, `sedation_or_anesthesia`, `fasting`, `priority`, `report_required`, `reader`를 구조화한다.
- 촬영과 판독 의뢰를 별도 atomic order로 분리한다.
- 흉부 X-ray는 `2-view`, `3-view` 세트를 하나의 오더로 만들고 실제 projection을 child 또는 실행값으로 기록한다.
- 초음파·CT·MRI는 동일한 view-count UI를 재사용하지 않는다.

**권장 예시**

`흉부 방사선 3-view` → VD/DV + 우측 + 좌측, 환자 체중·보정 방식·진정 여부·촬영자·판독 요청을 기록.

근거: [Merck Veterinary Manual — Diagnostic Imaging](https://www.merckvetmanual.com/clinical-pathology-and-procedures/diagnostic-imaging/overview-of-diagnostic-imaging-of-animals) **[C]**, [ACVR Radiation Safety Statement](https://acvr.org/how-we-do-it/types-of-imaging-therapy/radiology/acvrs-radiation-safety-statement/) **[C]**

### 4.6 기본 처치·수액·상처·카테터

**현재 문제 [D]**

- 기본 처치 45건은 부위 유무를 제외하면 같은 `method/schedule/frequency/stagedInstructions` 틀이다.
- 수액, 상처, 드레싱, 도관, 천자·배액처럼 용량·속도·장치·관찰 기준이 다른 행위가 한 스키마를 공유한다.
- 기본값이 대부분 `schedule=now`, `frequency=once`여서 반복 처치와 재평가를 표현하지 못한다.

**왜 부족한가 [C]**

AAHA 수액 가이드는 모든 환자에 같은 속도를 쓰면 위해가 생길 수 있고, 상태·경로·목표에 맞춘 처방과 반복 모니터링이 필요하다고 명시한다. 즉, “수액 진행”은 실행 가능한 처방이 아니다.

**수정안 [I]**

- 행위군별 프로필을 분리한다.
  - 수액: fluid type, route, bolus/maintenance, volume, rate, duration, additives, reassessment interval, stop criteria
  - 상처: site, grade, cleansing, debridement, dressing, change frequency, recheck
  - 카테터·튜브: device, site, size, placement time, maintenance, removal criteria
  - 천자·배액: site, guidance, volume, specimen destination, complications
- 반복 수행은 오더 1개와 예약된 task 인스턴스를 구분한다.

근거: [2024 AAHA Fluid Therapy Guidelines](https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/) **[C]**, [Fluid Administration and Monitoring](https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/section-8-fluid-administration-and-monitoring/) **[C]**

### 4.7 치과 처치

**현재 문제 [D]**

- 치과 24건 전체가 기본 처치와 같은 4개 키다.
- 구강평가, 마취, 전악 방사선, 스케일링, 치주 탐침, 발치, 회복이 서로 독립된 평면 오더로만 존재한다.
- 치아 번호, 치주 pocket, mobility, 병변, 발치 동의, 국소마취, 수술 후 기록을 표현하지 못한다.

**왜 부족한가 [C]**

AAHA 치과 가이드는 의식 상태의 평가부터 마취 후 전악 방사선, 스케일링, 치주 탐침, 치료·발치와 회복까지 단계적 흐름을 제시한다. 한 줄 처치로는 선후관계와 안전 확인을 보장할 수 없다.

**수정안 [I]**

- `Dental Procedure Plan` Order Set으로 구성한다.
- 사전평가 → 마취계획 → 전악 방사선 → charting → 처치/발치 → 통증관리 → 회복/퇴원 단계를 둔다.
- 실행 중 발견된 치아별 처치는 환자 작업복사본에 추가하고 보호자 동의와 비용 변경을 기록한다.

근거: [AAHA Essential Steps of Dental Cleaning & Therapy](https://www.aaha.org/resources/2019-aaha-dental-care-guidelines-for-dogs-and-cats/essential-steps/) **[C]**

### 4.8 마취·수술

**현재 문제 [D]**

- 42건이 준비, 마취, 수술, 회복을 같은 처치 스키마에 담는다.
- `CG_SURGERY`지만 한글 “수술”이 없는 항목은 현재 화면 분류기에서 기본 처치로 내려갈 수 있다.
- ASA 상태, 수술 부위·좌우, 수술자, 동의, 금식, 진통, 마취 단계, 모니터링, 회복 기준이 없다.

**왜 부족한가 [C]**

AAHA는 마취를 수술대 위 한 순간이 아니라 preanesthesia, induction, maintenance, recovery의 연속 과정으로 정의하며, 개별 환자 계획과 지속 모니터링을 강조한다.

**수정안 [I]**

- `surgical_procedure`, `anesthesia_plan`, `perioperative_monitoring`, `recovery_plan`을 분리한다.
- 실제 사용 UX는 하나의 수술 Order Set으로 묶되 각 단계의 담당자·완료 조건·기록을 분리한다.
- 최소 필드: procedure/site/laterality, surgeon, schedule, consent, pre-op assessment, ASA, fasting, analgesia, airway, monitoring plan, implant/specimen, recovery criteria.

근거: [2020 AAHA Anesthesia and Monitoring Guidelines](https://www.aaha.org/resources/2020-aaha-anesthesia-and-monitoring-guidelines-for-dogs-and-cats/) **[C]**

### 4.9 입원

**현재 문제 [D]**

- 입원 30건은 모두 duration 1일, care level, 15/30/60분 모니터링, 한 줄 nursing plan의 같은 틀이다.
- 모두 `per_order / immediate_complete`이며 수행 모듈이 없다.
- `대형견 입원 관리`가 `{cat,dog}`로 지정돼 있다.
- 병상료, 간호 행위, 모니터링 계획, 소모품 사용이 같은 층위에 섞여 있다.

**수정안 [I]**

- `bed_and_care_day`: 시작·종료, care level, 병상, `per_day`
- `nursing_task`: 측정·투약·급여·배설·라인 관리, 시간/빈도/담당 역할
- `monitoring_plan`: 측정 항목, 간격, 경고·보고 기준, 재평가
- `consumable_event`: 실제 사용 시 수량과 lot를 별도 기록
- 종·체중별 입원 제약은 canonical applicability와 병원 운영 제한을 구분한다.

**권장 예시**

`중환자 입원 관리 — 1일` → 병상/간호등급/모니터링 계획을 만들고, 4시간마다 재평가하여 다음 날 연장 여부를 결정. 개별 간호 태스크는 입원 모듈로 라우팅.

근거: [AAHA Fluid Administration and Monitoring](https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/section-8-fluid-administration-and-monitoring/) **[C]**, [ISFM Cat Friendly Principles](https://pmc.ncbi.nlm.nih.gov/articles/PMC10845435/) **[C]**

### 4.10 치료·재활 프로그램

**현재 문제 [D]**

- 별도 `T-THERAPY` 마스터 군이 없고, 기본 처치 45건이 `CG_THERAPY`로 투영된다.
- 레이저, 재활, 물리치료, 침치료처럼 여러 회차와 결과 평가가 필요한 치료 프로그램을 표현하는 구조가 없다.

**수정안 [I]**

- `therapy_plan`과 `therapy_session`을 구분한다.
- 계획에 목표, 금기, 대상 부위, modality, 세션 수, 빈도, 재평가일, outcome measure를 둔다.
- 세션에는 실제 시간·강도·반응·이상반응·다음 회차 변경을 기록한다.
- 프로그램 가격과 개별 회차 청구 방식을 Order Set 가격 규칙으로 분리한다.

### 4.11 응급

**현재 문제 [D]**

- 응급 24건이 `misc / CG_EXAM`, `billing_eligible=true / immediate_complete`이며 목적 모듈 없이 같은 2개 자유입력 필드를 사용한다.
- CPR 준비·모니터링처럼 시간과 팀 수행이 핵심인 항목도 태스크 라우팅이 없다.

**왜 부족한가 [C]**

RECOVER는 CPR을 BLS, ALS, 모니터링의 연결된 알고리즘과 팀 수행으로 다룬다. 응급 오더는 청구행만 만드는 것이 아니라 우선순위, 시작 시각, 역할, 반복 평가를 즉시 만들어야 한다.

**수정안 [I]**

- `emergency_episode` 또는 Order Set을 생성하고 `triage_level`, `activation_time`, `team_roles`, `BLS/ALS tasks`, `monitoring`, `reassessment`를 연결한다.
- 청구는 실제 수행 이벤트에서 파생하거나 검토 후 확정한다.
- 자유입력 2개만으로 목적 모듈 없이 완료되는 기본값을 제거한다.

근거: [2024 RECOVER Veterinary CPR Guidelines](https://recoverinitiative.org/2024-guidelines/) **[C]**

### 4.12 의료물품

**현재 문제 [D]**

- 마스터에서 의료물품에 가까운 항목은 조제 군의 2건뿐이다.
- 분류기에 매칭되지 않는 `misc` 항목은 모두 의료물품으로 떨어질 수 있어 카테고리가 오염된다.
- SKU, 포장단위, 재고단위, lot/유효기간, 실제 사용 수량이 없다.

**수정안 [I]**

- 임상 행위 마스터와 `inventory_item`을 분리한다.
- 물품에는 SKU, 기본단위·포장단위, 변환율, lot/유효기간, 재고/청구 단위를 둔다.
- 오더가 필요한 물품만 임상 행위와 연결하고, 대부분은 실제 사용 이벤트로 차감·청구한다.
- 미분류 항목의 fallback은 의료물품이 아니라 `unclassified / review_required`로 보낸다.

### 4.13 조제 — 비교 기준

**현재 상대적 강점 [D]**

- 161건 중 108건은 dose, unit, frequency, duration, total quantity, route 등 13개 입력값을 가진다.
- 다른 행위군보다 처방과 실행에 필요한 정보가 훨씬 구체적이다.

**남은 위험 [D][R]**

- 마스터 161건 모두 `clinical_use_allowed=false`다.
- 47건은 용량·횟수·총량 대신 지시·보관 중심의 5개 필드만 가진다.
- 제품·농도·적용 종·허가 범위·의약품 정보와 처방 프리셋의 검토 책임을 분리해야 한다.

제안: 조제의 상세도를 다른 카테고리의 **형식적 복사 대상**으로 삼지 말고, “행위군마다 필요한 실행 변수를 구조화한다”는 원칙만 기준으로 삼는다.

## 5. 권장 목표 구조

### 5.1 네 층으로 분리

| 층 | 책임 | 예시 |
| --- | --- | --- |
| 1. Atomic clinical action | 한 번의 명확한 행위 | 흉부 방사선 촬영, IV catheter placement |
| 2. Family execution profile | 행위군별 필수 입력·결과 | 영상 protocol, 수액 처방, 백신 실행 기록 |
| 3. Order Set / workflow | 여러 행위의 순서·선택·역할 | 치과 처치, 수술, CPR, 입원 계획 |
| 4. Workspace policy | 병원별 이름·가격·담당·장비·운영 제한 | 1일 입원료, 외부검사실, 로컬 별칭 |

핵심 원칙은 **오더명, 실행 프리셋, 청구, 업무 라우팅을 한 행에 억지로 합치지 않는 것**이다.

### 5.2 임상 활성화 게이트

각 revision은 아래를 모두 통과하기 전까지 `clinical_use_allowed=false`를 유지한다.

1. X/T/A/CG/NT 코드 투영 확인
2. 표준명·병원명·청구명·별칭 검수
3. 종·생활단계·행위 대상 검수
4. 행위군별 필수 필드와 기본값 검수
5. 목적 모듈, 태스크 필요 여부, 완료 조건 확인
6. 청구 여부·판매 단위·가격 설정 책임 확인
7. 결과 또는 수행기록 저장 위치 확인
8. 수의사 clinical reviewer 승인과 revision 기록
9. 대표 환자 시나리오로 chart → fulfillment → billing 검증

## 6. 우선순위별 실행안

### P0 — 임상 오해 방지와 분류 복구

1. 522건의 임상 사용 차단을 유지한다.
2. `Initial Consultation Changed`와 종 적용 오류 3건 이상을 수정하거나 비활성화한다.
3. 한글 키워드 분류를 제거하고 `classification_path_id`의 CG/T/A 코드로 메뉴를 투영한다.
4. 미분류 fallback을 의료물품이 아닌 검토 대기로 바꾼다.
5. 마스터 가격을 병원 가격으로 자동 투영하지 않고 `needs_workspace_review`로 전환한다.

### P1 — 자주 쓰는 행위군부터 프리셋 재설계

1. 진찰·예방·영상·기본 처치·입원 5개 군의 family schema를 먼저 만든다.
2. 치과·수술·응급을 Order Set과 단계형 task로 재구성한다.
3. 계통검사는 차트 신체검사 블록으로 이동한다.
4. 의뢰검사, 판독의뢰, 의료물품을 독립 책임으로 분리한다.

### P2 — 임상 검토와 제한적 활성화

1. 실제 빈도가 높은 대표 10~20개 오더만 임상 검토한다.
2. 각 오더를 정상, 예외, 수정, 취소, 반복 수행 시나리오로 검증한다.
3. 승인된 소수 revision만 pilot workspace에서 활성화한다.
4. 사용 로그와 현장 피드백 후 다음 군을 확장한다.

## 7. 대표 수정 전/후 예시

| 현재 항목 | 현재 기본값 | 권장 형태 |
| --- | --- | --- |
| 고양이 백혈병 예방접종 | 개·고양이, 지금 1회, 예방 상담 진행 | cat 전용 vaccination; 위험평가·차수·제품·lot·부위·다음 일정 |
| 흉부 방사선 정면 검사 | 정면인데 viewCount 2 | 흉부 2-view/3-view 세트; projection·체중·보정·진정·판독 |
| CT 영상자료 판독 상담 | 촬영 자세와 viewCount 요구 | external/internal imaging interpretation; 영상 원본·판독자·우선순위·보고서 |
| 대형견 입원 관리 | 개·고양이, 1일, 회당, 즉시 완료 | dog/weight 제한; bed-day + nursing tasks + monitoring + 연장결정 |
| CPR 준비/모니터링 | 자유입력 2개, 청구만 즉시 완료 | emergency episode; BLS/ALS/monitoring task, 시작시각·역할·재평가 |
| 치과 스케일링/발치 | method·schedule·frequency | dental Order Set; 평가·전악영상·charting·처치·통증·회복 |

## 8. 의사결정이 필요한 항목

| 결정 | 권장안 | 이유 |
| --- | --- | --- |
| 계통검사를 오더에 남길지 | 차트 템플릿으로 이동 | 현재 비청구·차트 전용 성격과 일치 |
| 예방상담과 백신투여를 합칠지 | 분리 후 Order Set으로 조합 | 상담, 처방, 실제 투여의 기록 책임이 다름 |
| 수술/치과/응급 표현 | atomic order + Order Set | 단계·역할·조건·청구를 함께 추적 가능 |
| 마스터 가격 배포 | 가격 없음 + 병원 검토 상태 | 승인된 아키텍처 계약과 일치 |
| 미분류 fallback | review_required | 의료물품 오염과 조용한 오분류 방지 |
| 임상 검토 범위 | 대표 고빈도 오더부터 | 522건 일괄 검토보다 위험·효율 균형이 좋음 |

## 9. 한계와 주의사항

- 이 문서는 마스터 데이터·코드·공식 가이드를 대조한 제품/데이터 감사다. 개별 환자의 진료 지침이나 처방을 제시하지 않는다.
- 외부 가이드는 주로 AAHA/AAFP 등 북미 자료다. 국내 법규, 동물병원 운영 관행, 품목 허가, 수가·세무 기준은 별도 검토가 필요하다.
- 이번 세션에서는 로그인된 화면을 재현하지 못했다. 분류 결함은 현재 DB와 소스 코드로 확인했지만, 실제 배포 버전의 메뉴별 최종 노출은 브라우저 QA가 추가로 필요하다.
- 522건 전체의 문구를 개별 임상 검수하지 않았다. 본 보고서는 구조적 반복, 명백한 모순, 대표 항목을 찾아 수정 체계를 제안한 것이다.
- 가격은 실제 시장가격 조사를 하지 않았다. 가격 숫자의 적절성이 아니라 “마스터가 권위 가격을 소유하지 않는다”는 책임 경계를 평가했다.

## 10. 근거 자료

### 내부 데이터·계약

- 현재 Cheongdam `order_catalog_items` 읽기 전용 스냅샷, 2026-09-02 **[D]**
- [병원관리 오더 분류 구현](../../../src/features/hospital-admin/data.ts#L750-L797) **[D]**
- [CLAiR Clinical Master Data Target Architecture](../../engineering/data-model/clair-clinical-master-data-target-architecture.md#L606-L623) **[R]**
- [Phase 1 DB Specification — clinical completeness boundary](../../engineering/data-model/clair-clinical-master-data-phase-1-db-spec.md#L48-L68) **[R]**
- [Order Catalog product contract](../../product/demo-data/order-catalog-v1.md) **[R]**
- [Order Sets and Templates product contract](../../product/demo-data/order-sets-and-templates-v1.md) **[R]**

### 임상·운영 자료

- [2022 AAHA Canine Vaccination Guidelines](https://www.aaha.org/resources/2022-aaha-canine-vaccination-guidelines/) **[C]**
- [2021 AAHA/AAFP Feline Life Stage Guidelines](https://www.aaha.org/wp-content/uploads/globalassets/02-guidelines/feline-life-stage-2021/2021-aaha-aafp-feline-life-stage-guidelines.pdf) **[C]**
- [2020 AAHA Anesthesia and Monitoring Guidelines](https://www.aaha.org/resources/2020-aaha-anesthesia-and-monitoring-guidelines-for-dogs-and-cats/) **[C]**
- [2019 AAHA Dental Care — Essential Steps](https://www.aaha.org/resources/2019-aaha-dental-care-guidelines-for-dogs-and-cats/essential-steps/) **[C]**
- [2024 AAHA Fluid Therapy Guidelines](https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/) **[C]**
- [AAHA Fluid Administration and Monitoring](https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/section-8-fluid-administration-and-monitoring/) **[C]**
- [Cornell Clinical Pathology Samples & Submissions](https://www.vet.cornell.edu/animal-health-diagnostic-center/laboratories/clinical-pathology/samples-submissions) **[C]**
- [Merck Veterinary Manual — Diagnostic Imaging](https://www.merckvetmanual.com/clinical-pathology-and-procedures/diagnostic-imaging/overview-of-diagnostic-imaging-of-animals) **[C]**
- [ACVR Radiation Safety Statement](https://acvr.org/how-we-do-it/types-of-imaging-therapy/radiology/acvrs-radiation-safety-statement/) **[C]**
- [2024 RECOVER Veterinary CPR Guidelines](https://recoverinitiative.org/2024-guidelines/) **[C]**
- [ISFM Cat Friendly Principles](https://pmc.ncbi.nlm.nih.gov/articles/PMC10845435/) **[C]**
