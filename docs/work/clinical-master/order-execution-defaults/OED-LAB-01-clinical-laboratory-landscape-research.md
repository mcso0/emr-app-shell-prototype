---
id: "CLINICAL-MASTER-OED-LAB-01"
type: "Work Item"
title: "Clinical Laboratory Landscape Research"
description: "임상병리 검사 86건의 세트·하위 항목, 수행 방식, 장비 종류, 결과 구조와 외부 자료 확보 가능성을 전체적으로 조사한다."
status: "done"
area: "clinical-master"
priority: "P0"
tags:
  [
    clinical-master,
    laboratory,
    landscape-research,
    order-set,
    equipment-profile,
    deep-research,
  ]
target_pr: "Research and non-applied artifacts only"
source_docs:
  - "CLINICAL-MASTER-OED-LAB-00"
  - "CLINICAL-MASTER-ORDER-EXECUTION-DEFAULTS-REMEDIATION"
dependencies:
  - "CLINICAL-MASTER-OED-LAB-00"
baseline_commit: "f564a493b52be6f5592bda6484dd0bcf9a8a2c4b"
updated: "2026-09-06"
---

# OED-LAB-01: 임상병리 검사 외부 전체 구조 조사

## 목표

현재 마스터의 임상병리 검사 86건을 한 번에 깊게 조사하지 않는다. 먼저 각
오더가 어떤 검사 세트와 최종 하위 검사 항목으로 구성되는지, 어떤 방식과 장비로
수행되는지, 어떤 결과 형식이 필요한지, 신뢰할 만한 외부 자료를 어디까지 확보할
수 있는지 전체 지도를 만든다.

이 조사는 CBC 기능 표본을 선택하고 설계하기 위한 선행 작업이다. 조사 결과를
앱, 마스터, 워크스페이스, Airtable 또는 Supabase에 적용하지 않는다.

## 확정된 기준

세부 제품 결정과 합성 데이터 원칙은
[OED-LAB-00: 임상병리 요구사항 및 조사 계약](./OED-LAB-00-requirements-and-research-contract.md)을 따른다.

- 검사 세트는 다른 세트와 독립 실행 가능한 하위 검사 오더를 포함할 수 있다.
- 하위 오더는 단독 요청과 재검이 가능해야 한다.
- 결과 형식, 단위, 판별과 정상범위 정책은 하위 오더에 정의한다.
- 워크스페이스 사용 장비, 수동 입력과 실제 연동 상태를 분리한다.
- 임상 정확성보다 프로토타입 기능 완결성을 우선한다.
- 정확한 공개 값이 없으면 기능용 합성값 후보를 만들 수 있다.
- 합성값은 마스터 후보에 명시적으로 저장하며 런타임 fallback으로 만들지 않는다.

## 조사 범위

### 1. 현재 86개 목록 고정

현재 `clinical_lab` 오더의 ID, 이름, 종 적용 범위, 검사·패널 연결, 검체와 기존
기본값을 추출한다. 기존 72개 검사 정의, 18개 패널과 120개 패널 연결을 함께
대조한다.

### 2. 검사 계층과 독립 하위 오더 조사

각 오더를 상위 종합 세트, 검사 세트, 최종 하위 검사 오더로 분류한다. 세트
구성, 하위 항목, 표시 순서, 단독 요청과 재검 가능성을 기록한다. 이 단계에서는
정확한 수치를 모두 채우지 않는다.

### 3. 수행 방식과 장비 종류 조사

각 검사를 원내 장비, 수기 검사 또는 외부 검사실 의뢰로 분류한다. 장비 검사는
필요한 장비 종류, 대표 모델, 지원하는 세트와 하위 항목을 조사한다. 장비 결과
자동 수신 가능성은 이번 완료 조건이 아니다.

### 4. 결과 구조와 자료 확보 가능성 조사

각 최종 하위 오더에 필요한 결과 유형, 단위 정책, 정상범위 차원, 판별 방식,
검체와 검사법을 분류한다. 외부 자료 상태는 다음 중 하나로 기록한다.

| 조사 상태 | 의미 |
| --- | --- |
| `source_found` | 공식 또는 우선 출처에서 필요한 구조와 값을 확인할 수 있음 |
| `source_partial` | 일부 구조나 값만 확인할 수 있음 |
| `functional_fixture_required` | 정확한 공개 값이 없어 기능용 합성값이 필요함 |
| `not_applicable` | 정상범위나 장비 프로필이 검사 특성상 필요하지 않음 |

이 값은 조사 상태이며 마스터 오더의 검수 상태가 아니다.

## 외부 조사 원칙

Deep Research로 주장과 출처를 연결한다. 장비 관련 정보는 제조사의 공식 검사
메뉴, 사용 설명서와 기준범위 문서를 우선한다. 검사 세트와 수기·외부 검사는
수의과대학 검사실, 수의임상병리 전문단체와 표준기관 자료로 교차 확인한다.
검색 결과 요약, 일반 블로그와 판매처 설명은 단독 근거로 쓰지 않는다.

시중의 모든 장비를 전수 조사하지 않는다. 각 검사 유형을 기능적으로 대표하고
공식 자료를 확보할 수 있는 장비를 우선 찾는다. 공개 자료가 부족하면 상용 장비
이름에 임의 값을 붙이지 않고 후속 단계에서 CLAiR 데모 장비 프로필을 사용한다.

## 산출물

모든 산출물은 앱에서 import하지 않는 비적용 조사 자료다.

1. [86개 오더 고정 목록](./artifacts/oed-lab-01/oed-lab-01-order-inventory.v1.json)
2. [세트·하위 오더 구조 지도](./artifacts/oed-lab-01/oed-lab-01-set-atomic-map.v1.json)
3. [수행 경로 매트릭스](./artifacts/oed-lab-01/oed-lab-01-execution-route-matrix.v1.json)
4. [장비 유형·대표 모델 지도](./artifacts/oed-lab-01/oed-lab-01-equipment-landscape.v1.json)
5. [결과 모양 매트릭스](./artifacts/oed-lab-01/oed-lab-01-result-shape-matrix.v1.json)
6. [외부 출처 원장](./artifacts/oed-lab-01/oed-lab-01-source-ledger.v1.json)
7. [현재 구조 갭 매트릭스](./artifacts/oed-lab-01/oed-lab-01-gap-matrix.v1.json)
8. [AI용 전체 조사 보고서](./artifacts/oed-lab-01/report-source.md)
9. [사람이 읽는 HTML 보고서](../../../completed/clinical-master/2026-09-04-oed-lab-01-clinical-laboratory-landscape-report.html)

## 수행 결과

- 고정된 `clinical_lab` 86건을 빠짐없이 분류했다.
- 현재 V4 fixture에는 검사 결과 정의 72개, 검사 패널 18개, 패널 연결 120개,
  오더 프로필 85개가 있다.
- 로컬 V4 표본의 72개 검사 정의 중 16개에는 독립 order profile이 없다.
  실제 앱·DB의 주문 가능 범위는 OED-LAB-03에서 확인한다.
- CBC 패널은 WBC·HCT·PLT 3개만 연결돼 있고, 중첩 검사 패널은 0개다.
- 86건 중 1건은 검사 프로필과 연결되지 않은 레거시 예외다. 이를 새 fallback
  오더나 화면 임시값으로 보완하지 않는다.
- 검사군을 18개 family로 나누고, 각 오더의 목표 구조, 수행 경로, 결과 모양,
  장비 유형과 외부 근거 상태를 기록했다.
- 구조 변경을 막는 blocker 6개와 high gap 5개를 구분했다.
- 정상범위 숫자는 이번 후보에 복사하지 않았다. 종·검체·검사법·장비·시약별
  결과 프로필과 버전이 먼저 필요하다는 근거를 확인했다.

## 검증 기록

- 최초 2026-09-04 검증은 2/2 통과했지만 개수·출처 ID 연결만 검사해 오분류를
  잡지 못했다. 당시 `CBC` 검색 5건에는 감염성 항원 검사가 잘못 포함돼 있었다.
- 2026-09-06 보정 검증은 아래 보정 기록을 따른다.
- 생성 스크립트가 `clinical_lab` 86건이 아니면 실패하도록 고정했다.
- 모든 JSON은 `research_only_non_applied`, `applicationAllowed: false`다.
- 86개 ID의 중복 여부, 모든 오더의 구조·수행 경로·결과 모양 분류, 출처 ID
  연결을 로컬에서 점검한다.
- 조사 보고서의 166개 표 행, 코드 식별자, 수치와 URL은 한국어 윤문 전후가
  같음을 별도로 확인했다.
- 앱, 마스터, 워크스페이스, Airtable, Supabase와 원격 DB는 변경하지 않았다.

## 2026-09-06 correction and continuation record

- Scope: local research generator, JSON artifacts, MD/HTML reports and regression tests only.
- Replaced label regex/default-chemistry classification with a reviewed 86-ID mapping.
  Unknown, duplicate or substituted IDs fail closed. Corrected feline panleukopenia
  antigen to infectious disease and preanesthetic-expanded to composite diagnostics.
- Renamed `currentDefaultSummary` to `priorCandidateDefaults`; it came from the
  non-applied WP-01A candidate, not live master/workspace defaults.
- Recorded all 86 specimen comparisons in
  [correction audit](./artifacts/oed-lab-01/oed-lab-01-correction-audit.v1.json):
  5 conflicting labels, 38 unspecified blood-processing cases, 27 matching labels,
  12 missing candidates, 2 collection/preparation distinctions, 1 underspecified
  candidate and 1 unbound fixture. No specimen was selected or applied.
- Per-order evidence is 85 `source_partial` plus one legacy
  `functional_fixture_required`. Family literature does not verify exact methods,
  values or device support. These statuses do not control order availability.
- Atomic orders no longer inherit the family's complete child blueprint. Routes
  and equipment are explicitly family candidates, never automatic selections.
- Source fingerprints now include all three input files' actual contents. Original
  source access dates remain 2026-09-04; regeneration is not a new literature search.
- Broad landscape deliverable remains done; per-order clinical content, candidate
  specimen repair, runtime behavior and remote schema verification are not done.
- Next: OED-LAB-02 CBC exact candidate research, then OED-LAB-03 actual schema audit.
  Do not apply old WP-01A lab candidates unchanged; resolve flagged values against
  the chosen assay/profile during family-level candidate generation.
- Verification: focused Node tests 7/7; generated/final Markdown tables agree;
  input and artifact content hashes match; `git diff --check` passed. Headless HTML:
  86/86 rows, CBC 4/86, panleukopenia 1/86, no page/console errors, no horizontal
  overflow at 1440px or 390px. These are local report checks, not live app smoke.
- `npm run docs:check` still fails on the pre-existing unrelated
  `_workspace/2026-08-01-002/summary.md` link to the missing persona guide HTML.
  No unrelated repair attempted. Humanize fast run: `_workspace/2026-09-06-001/`;
  bundled metric helper was absent, so quick-rules/manual fidelity checks were used.

## 완료 기준

- 임상병리 검사 86건의 현재 ID와 관계가 고정된다.
- 모든 오더가 상위 세트, 검사 세트, 최종 하위 오더 또는 예외로 분류된다.
- 모든 최종 하위 오더가 원내 장비, 수기 또는 외부 검사실 수행 방식으로 분류된다.
- 장비 검사는 필요한 장비 종류와 대표 모델 후보를 가진다.
- 모든 최종 하위 오더에 결과 유형과 외부 자료 상태가 기록된다.
- 정확한 값이 부족한 항목은 기능용 합성값 필요 대상으로 명시된다.
- CBC를 `OED-LAB-02` 정밀 조사 대상으로 사용할 수 있는 근거와 범위가 마련된다.
- 어떤 후보도 앱, 마스터, 워크스페이스 또는 DB에 적용되지 않는다.

## 이번 단계에서 하지 않는 일

- 86개 모든 검사값과 정상범위를 정밀하게 완성하는 일
- CBC 화면이나 결과 입력 기능 구현
- 실제 병원의 장비 보유·연동 상태를 가정하는 일
- 장비 통신 또는 결과 자동 수신 구현
- migration, master publish, workspace adoption 또는 원격 데이터 변경
- 런타임 fallback이나 가라 오더 생성

## 다음 단계

다음 작업은
[OED-LAB-02: CBC 기능 표본 조사](./OED-LAB-02-cbc-functional-specimen-research.md)다.
CBC 세트와 독립 하위 오더, 대표 또는 CLAiR 데모 장비, 수동 결과 입력,
단위·정상범위, 판별, 개별 재검과 결과 스냅샷을 하나의 기능 표본으로 확정한다.
제품 검토 전에는 앱·DB·마스터에 적용하지 않는다.
