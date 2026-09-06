---
id: "CLINICAL-MASTER-OED-LAB-02"
type: "Work Item"
title: "CBC Functional Specimen Research"
description: "CBC 하나를 표본으로 세트, 독립 하위 오더, 결과 프로필, 수동 입력, 판별과 단일 항목 재검 계약을 끝까지 확정한다."
status: "done"
area: "clinical-master"
priority: "P0"
tags:
  [
    clinical-master,
    laboratory,
    cbc,
    atomic-order,
    result-profile,
    reference-range,
    functional-specimen,
  ]
target_pr: "Research and non-applied functional-specimen artifacts only"
source_docs:
  - "CLINICAL-MASTER-OED-LAB-00"
  - "CLINICAL-MASTER-OED-LAB-01"
dependencies:
  - "CLINICAL-MASTER-OED-LAB-01"
baseline_commit: "f564a493b52be6f5592bda6484dd0bcf9a8a2c4b"
updated: "2026-09-06"
---

# OED-LAB-02: CBC 기능 표본 조사

## 목표

CBC 하나를 임상병리 전체 구조의 기능 표본으로 만든다. CBC 세트를 주문하면
안정적인 하위 오더와 결과 항목이 생성되고, WBC처럼 필요한 항목 하나만 다시
주문할 수 있어야 한다. 결과 화면에는 적용한 수행 프로필, `수동 입력`,
`연동 안 됨`, 단위, 정상범위, 판별과 결과 정의 버전이 함께 보여야 한다.

이 단계는 정확한 구조와 합성 데이터 후보를 정하는 조사 작업이다. 앱, 마스터,
워크스페이스, Airtable, Supabase 또는 원격 DB에는 적용하지 않는다.

## 시작 근거

`OED-LAB-01`에서 로컬 V4 표본을 기준으로 다음을 확인했다. 실제 원격 DB의
지원 범위는 아직 조사하지 않았다.

- 현재 CBC 패널에는 WBC·HCT·PLT 3개만 연결돼 있다.
- RBC와 HGB 정의는 있지만 CBC 연결과 독립 order profile이 없다.
- 버전이 있는 동물종·검체·검사법·장비별 결과 프로필이 없다.
- 현재 프로토타입은 장비 결과를 자동 수신하지 않는다.
- 정상범위는 검사명 하나의 공통 숫자가 아니라 적용 조건이 있는 프로필이다.

근거와 전체 갭은 [OED-LAB-01 AI용 보고서](./artifacts/oed-lab-01/report-source.md)와
[갭 매트릭스](./artifacts/oed-lab-01/oed-lab-01-gap-matrix.v1.json)를 사용한다.

### Corrected input boundary — 2026-09-06

Use the corrected LAB-01 manifest and
[correction audit](./artifacts/oed-lab-01/oed-lab-01-correction-audit.v1.json).
The four CBC-family order IDs are `cm.order.lab.panel.cbc-basic`,
`cm.order.lab.test.cbc-wbc`, `cm.order.lab.test.cbc-hct`, and
`cm.order.lab.test.cbc-plt`; feline panleukopenia antigen is not CBC.
RBC/HGB are existing result definitions, not additional current order IDs.
Prior WP-01A `blood` values omit processing/additive detail; do not use them as
verified CBC collection instructions. Extract the exact chosen profile's unit,
species, method, specimen and reference interval together. No numeric interval
was extracted by LAB-01. Family equipment/source lists are discovery candidates,
not compatibility evidence for every assay. Keep public-source and CLAiR synthetic
profile values distinct; do not introduce a clinical-review waiting gate.

## 조사 범위

### Execution plan — 2026-09-06

Scope: dog/cat CBC candidate data and offline contract verification only. Preserve
existing inputs; no app/API, master, workspace, local DB or remote writes.
Representative profile assumption: ProCyte Dx, with exact public document revision
and separate CLAiR synthetic profiles. No claim of current installed hardware or
clinical validation. Source classes: manufacturer manual/interval table, Cornell
clinical pathology, UCUM and FHIR structural references.

1. Complete: source discovery and cross-check of parameters, units, intervals,
   specimen and measured/calculated distinctions. Primary range table visually
   checked against its PDF. Pin 2019 range revision; do not imply latest firmware.
2. Complete: reconcile missing/unsupported values; create stable-ID non-applied
   candidates, profile snapshots and single-item retest fixtures. Ten focused
   tests pass, including 837 generated branches and coherent dog/cat samples.
3. Complete: Korean MD/HTML, contract/data boundary tests, sampled rendered-report
   review and LAB-03 handoff. Done means candidate research complete, not app/DB
   implementation or approval of all proposed product grouping/billing choices.

The skill's update_plan tool is unavailable in this environment; this record
tracks the same scope/discovery/follow-up/synthesis/verification plan locally.

### 1. CBC 세트와 독립 하위 오더

공식 자료를 대조해 CBC 항목을 `core`, `optional`, `manual review`로 구분한다.
WBC, RBC, HGB, HCT, 적혈구 지수, 백혈구 감별, PLT와 혈소판 지수처럼 결과로
기록할 항목마다 안정적인 후보 ID를 만든다.

각 하위 항목에는 다음을 기록한다.

- CBC 세트 포함 여부와 표시 순서
- 직접 주문 가능 여부
- 단일 항목 재검 가능 여부
- 측정값, 계산값, 파생값 또는 수기 판독값 구분
- 필수, 선택, 조건부 또는 장비 전용 여부

### 2. 결과 계약

각 하위 항목에 결과 입력형, UCUM 단위, 소수점 정책, 결과 누락·오류 상태와
판별 규칙을 둔다. 수치 결과는 최소한 정상·미달·초과를 확인할 수 있어야 하며,
형태 소견과 장비 플래그는 수치 범위에 억지로 합치지 않는다.

### 3. 정상범위 프로필

정상범위 후보는 동물종, 검체, 검사법, 장비 또는 수기 방식, 단위, 출처, 버전과
적용 상태를 함께 가진다. 공식 공개값을 사용할 수 있으면
`synthetic_research_informed`, 기능 확인을 위해 만든 값이면
`synthetic_functional_fixture`로 명시한다.

상용 장비 이름에는 임의 값을 붙이지 않는다. 정확한 공개값을 사용할 수 없으면
별도의 CLAiR 데모 프로필을 만든다.

### 4. 워크스페이스 수행 프로필

프로토타입에서는 실제 장비 연동을 주장하지 않는다. 대표 장비 또는 CLAiR 데모
프로필을 기능 후보로 두고, 워크스페이스가 사용할 프로필을 명시적으로 선택하는
계약을 정한다. 선택하지 않은 프로필로 자동 대체하지 않는다.

### 5. 주문부터 재검까지의 기능 흐름

다음 두 흐름을 나란히 정의한다.

1. CBC 전체 주문 → 최종 하위 오더 생성 → 수동 결과 입력 → 판별 → 결과 확정
2. 기존 CBC의 WBC 선택 → 새 WBC 재검 주문 → 새 결과 입력 → 최초 세트와 직전
   결과 연결

기존 결과를 덮어쓰지 않는다. 주문 시점에 사용한 결과 정의와 정상범위 프로필을
스냅샷으로 남긴다.

### 6. 결과 화면 계약

기존 시안의 구조를 참고하되 다음 정보가 함께 보이는 화면 계약을 작성한다.

- CBC 세트와 하위 항목 계층
- 검사 결과 입력칸과 단위
- 정상범위와 판별값
- 수행 장비 또는 수행 프로필
- `수동 입력`과 `연동 안 됨`
- 형태 소견, 이미지, 검사자와 검토자
- 단일 항목 재검 동작과 이전 결과 연결

## 산출물

1. CBC 세트·독립 하위 오더 후보 JSON
2. 하위 오더별 결과 정의 후보 JSON
3. 개·고양이 대표 결과 프로필과 CLAiR 데모 프로필 후보 JSON
4. 정상·미달·초과·오류 분기 기능 fixture
5. CBC 전체 주문과 단일 WBC 재검 시퀀스
6. 결과 화면 정보·상태 계약
7. 기존 ID 재사용, 신규 ID와 후속 backfill 후보표
8. AI용 Markdown 및 사람이 읽는 HTML 검토 보고서

모든 산출물은 `research_only_non_applied`, `applicationAllowed: false`로 둔다.

## 완료 기준

- CBC의 `core`, `optional`, `manual review` 항목이 공식 근거와 함께 구분된다.
- 최종 하위 항목마다 안정적인 후보 ID와 독립 주문·재검 정책이 있다.
- 각 항목의 결과 유형, 단위, 소수점, 판별, 누락·오류 상태가 정의된다.
- 개·고양이 결과 프로필의 적용 조건, 출처, 버전과 합성 상태가 기록된다.
- 상용 장비 공식값과 CLAiR 데모값을 혼동할 수 없게 분리한다.
- 워크스페이스가 수행 프로필을 선택하지 않으면 자동 대체하지 않는다.
- 화면에서 장비, 수동 입력, 연동 안 됨, 단위, 정상범위와 판별을 확인할 수 있다.
- CBC 전체 주문과 WBC 단일 재검이 기존 결과를 덮어쓰지 않고 연결된다.
- 다음 `OED-LAB-03`이 필요한 엔터티와 관계를 필드 수준으로 감사할 수 있다.
- 앱, 마스터, 워크스페이스와 로컬·원격 DB에 아무 후보도 적용되지 않는다.

## 이번 단계에서 하지 않는 일

- CBC 외 85개 오더의 정밀 값 완성
- 실제 병원의 보유 장비 등록
- 장비 통신이나 결과 자동 수신 구현
- 화면·API·migration 구현
- Airtable, Supabase, 마스터 또는 워크스페이스 쓰기
- 상용 장비 이름에 임의 정상범위 연결
- 런타임 fallback 또는 가라 오더 생성

## 다음 단계

2026-09-06 후속 갱신: 아래 LAB-03 조사는 완료됐다.
[조사 결과와 구현 순서](./artifacts/oed-lab-03/audit-and-transition-plan.md)를
기준으로 다음은 기존 WP-01B 구현부터 진행한다. 아래 내용은 LAB-02 당시 인계 범위다.

[OED-LAB-03](./OED-LAB-03-master-workspace-db-audit-and-transition-plan.md)에서 CBC 표본을 기준으로 로컬·원격의 마스터,
워크스페이스, 차트, 검사 결과와 재검 구조를 읽기 전용으로 감사한다. 그 결과로
중첩 세트, 독립 하위 오더, 결과 프로필, 스냅샷, migration, backfill과 rollback
계획을 확정한다.

## Execution record — 2026-09-06

- Delivered 26 atomic order candidates: 20 core numeric, 5 optional numeric,
  one manual-smear order; five nested sets including the existing CBC root.
- Prepared dog/cat ProCyte Dx profiles pinned to 2019 document 06-27445-12,
  VetLab Station 5.01: 37 transcribed species/parameter intervals. Separate dog/cat
  CLAiR synthetic numeric profiles and one manual-smear profile preserve no-fallback.
- Six percentage intervals absent in the pinned table remain explicitly absent in
  commercial profiles. Feline PDW is unsupported there, not silently synthetic.
- Reused existing percentage RETIC and smear order IDs plus WBC/HCT/PLT.
  RBC/HGB result identities preserved; 21 order IDs and 19 result IDs are new
  candidates only. Old catalog IDs, definitions, defaults and historical results
  were not changed. No numeric patient result is prefilled by catalog defaults.
- Created 837 branch fixtures, two coherent synthetic CBC examples and an immutable
  WBC-only retest timeline. Supporting measurements are not extra billable orders.
- Source search gap matrix records microtube-volume inconsistency, pinned-vs-latest
  profile limits, missing percentage intervals and no analytical/critical-limit claim.
- Focused candidate tests: 10/10. Local report browser test: 1/1, 25 numeric rows,
  explicit selection, no fallback on example fill, cat PDW disabled, missing interval
  distinguished, zero network requests/page errors and no horizontal page overflow
  at 1440px/390px. Opening, dense table and closing views sampled visually; corrected
  inherited sticky row-heading style. Not live EMR or DB end-to-end verification.
- `git diff --check` passes. Global `npm run docs:check` remains blocked by the
  unrelated pre-existing persona-guide reference in `_workspace/2026-08-01-002/summary.md`.
- Humanize Korean fast run `_workspace/2026-09-06-002/`: source facts and identifiers
  retained; optional metric helper absent, manual quick-rules fidelity review used.
- No app/API, local/remote DB, Airtable, master or workspace writes; no commit/push,
  public publishing or tunnel. Next audit has not been performed.

### Readable deliverables

- [Korean HTML report with profile explorer](../../../completed/clinical-master/2026-09-06-oed-lab-02-cbc-functional-specimen-report.html)
- [Canonical AI-readable MD](./artifacts/oed-lab-02/report-source.md)
- [Artifact manifest and hashes](./artifacts/oed-lab-02/artifact-manifest.v1.json)
- [Sources and remaining gaps](./artifacts/oed-lab-02/source-ledger-and-gaps.v1.json)

### Reproduction

```sh
node scripts/generate-oed-lab-02-candidates.mjs
node scripts/render-oed-lab-02-report.mjs
node --test tests/oed-lab-02-candidates.test.mjs tests/oed-lab-02-report.test.mjs
```
