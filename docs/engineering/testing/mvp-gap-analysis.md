# MVP Gap Analysis

Updated: 2026-05-02

Start with `docs/engineering/current-status.md` for the current MVP state. This gap analysis keeps the original baseline and adds post-PR 1-6 reclassification notes below.

| | |
|---|---|
| **Product** | 동물병원 전용 EMR SaaS 서비스 |
| **Source Feature Spec** | `docs/product/features/legacy-mvp-feature-spec.md` |
| **Source DB Spec** | `docs/engineering/data-model/emr-saas-db-structure-spec.ko.md` |
| **Purpose** | MVP feature spec과 현재 코드 상태를 연결해 구현 우선순위를 정한다. |

---

## Status Legend

| Status | Meaning |
|---|---|
| Implemented | MVP 요구를 현재 코드가 대부분 충족한다. |
| Partial | 재사용 가능한 구현이 있으나 MVP 요구를 충족하려면 확장 또는 일반화가 필요하다. |
| Placeholder | 모듈/라우팅/셸 자리는 있으나 실제 업무 기능은 없다. |
| Missing | 현재 코드에 대응 구현이 없다. |

---

## Current Code Baseline

> Historical note: the table below describes the pre-PR 1-6 baseline. See "2026-05-02 Post-PR 1-6 Status" for the current implemented state.

| Area | Current State |
|---|---|
| App shell | `src/shell/*`, `src/modules/registry.ts`, `docs/engineering/architecture/app-shell-layout-contract.md`로 모듈형 레이아웃과 URL 기반 패널 상태가 잡혀 있다. |
| Module registry | `home`, `reception`, `treatment`, `lab`, `imaging`, `dispensing`, `orders`, `billing`, `inpatient` 모듈이 등록되어 있다. |
| Real module | `dispensing`은 조제 업무 화면, 오더 그룹, 우측 패널, drawer, content aside가 실제 구현되어 있다. |
| Shared order queue | `src/features/order-queue/data.ts`, `src/components/emr/order-queue-side-panel.tsx`, `src/components/emr/order-queue-summary.tsx`가 조제/처치 오더 큐 UI의 재사용 기반이다. |
| Placeholder modules | 접수, 검사, 영상, 오더, 수납, 병동 등은 대부분 `Placeholder*` 컴포넌트를 사용한다. |
| Domain types | `src/types/emr.ts`는 shell, order queue, dispensing order 중심 타입만 있다. guardian, patient, encounter, SOAP, invoice, audit log 타입은 없다. |
| Tests | `tests/app-shell.spec.ts`는 shell, 조제, 오더 큐 패널 동작을 검증한다. MVP 핵심 업무 플로우 테스트는 아직 없다. |

---

## MVP Feature Gap Matrix

> Historical note: the matrix below drove the PR 1-6 implementation wave. Several items that were Placeholder or Missing are now implemented as frontend prototype screens.

| MVP Feature | Status | Current Implementation | Reusable Assets | Gap | Priority | Dependency | Next Action |
|---|---|---|---|---|---|---|---|
| 3.1 보호자 및 환자 관리 | Partial | `PatientContextBar`와 mock 환자 표시 데이터는 있으나 guardian/patient CRUD는 없다. | `patient-context-bar.tsx`, `src/features/dispensing/data.ts`, shell right panel 패턴 | guardian, patient, consent 타입/데이터, `id + patient_no`, 잠금 주의사항 메모, 목록/상세/등록 화면, 변경 이력 표시가 필요하다. | P0 | 조직/워크스페이스 기본 context | guardian/patient mock domain 모델과 접수 전 공통 검색/등록 UI를 먼저 만든다. |
| 3.2 접수, 예약 및 대기열 관리 | Placeholder | `reception` 모듈은 registry에 있으나 placeholder 화면이다. | module registry, app shell, shared side panel 구조 | appointment, encounter, waiting queue 타입과 접수/예약 화면, encounter 생성 액션이 없다. | P0 | 3.1 보호자/환자 | `reception` 모듈을 실제 MVP 모듈로 교체하고 접수 시 encounter를 생성하는 흐름을 정의한다. |
| 3.3 진료 Encounter 및 SOAP 차트 | Missing | 진료 encounter 또는 SOAP 작성 UI가 없다. | shell content/header slots, patient context bar | encounter 상세 화면, SOAP form, 임시 저장/최종 저장/수정 이력, 과거 차트 조회가 필요하다. | P0 | 3.1, 3.2 | `treatment` 또는 신규 clinical content를 encounter 중심 화면으로 재정의한다. |
| 3.4 진단 및 처방 관리 | Missing | 처방 데이터는 조제 mock order로만 간접 표현된다. | dispensing order table fields, drawer pattern | diagnosis, prescription, prescription item 타입과 encounter 내 작성/취소/이력 UI가 없다. | P1 | 3.3 SOAP | encounter 화면 안에 진단/처방 섹션을 추가하고 조제 오더 생성의 입력원으로 연결한다. |
| 3.5 업무 오더 생성 및 관리 | Partial | 조제 화면과 공용 오더 큐가 있으며 처치 큐 일부도 데이터상 지원한다. | `DispensingContent`, `EmrOrderQueueSidePanel`, `OrderQueueSelectionSummary`, `OrderGroupSection`, app-shell tests | 오더 생성 UI, lab/imaging 세부 오더, 수동 결과 입력, 공통 order lifecycle 타입 정렬이 필요하다. | P1 | 3.3, 3.4 | 기존 조제 구현을 공통 order module 패턴으로 일반화하고 orders 모듈과 연결한다. |
| 3.6 기본 수납 관리 | Placeholder | `billing` 모듈은 registry에 있으나 placeholder 화면이다. | module registry, table/button/ui primitives | invoice, invoice line, payment/refund 타입과 encounter 기준 청구 후보 생성, 할인, 환불 요청/관리자 확정, 결제 상태 UI가 없다. | P2 | 3.4, 3.5, 3.7 수가 | `billing` 모듈을 encounter invoice summary 중심으로 만들고 수납완료 상태 전이를 추가한다. |
| 3.7 병원 설정, 직원 및 권한 관리 | Missing | 설정/권한 전용 모듈이 없고 registry에도 settings 모듈이 없다. | module registry, shell navigation pattern | clinic settings, service item price history, user membership, role permission, message template/delivery history, audit log UI가 없다. | P0 for seed/roles, P2 for UI | 전체 MVP 기반 | 초기에는 mock 역할/권한 매트릭스와 service item seed를 코드에 두고, UI는 후순위로 만든다. |

---

## Cross-Cutting Gaps

| Gap | Impact | Recommended Handling |
|---|---|---|
| 용어 불일치 | 코드의 한국어 status와 DB spec의 영문 enum이 섞여 있다. | domain type에는 영문 enum을 쓰고 UI label 매핑으로 한국어를 표시한다. |
| Mock data 분산 | 조제 mock data가 실제 업무 도메인 모델을 대신하고 있다. | MVP용 `mock-emr-domain` 계층을 만들고 guardian/patient/encounter/order/invoice를 한 곳에서 연결한다. |
| 오더 상태 범위 | UI는 `재요청`, `조제중`, `대기중` 등을 쓰고 DB spec은 `requested`, `re_requested`, `in_progress`를 쓴다. | `order.status`는 DB spec 값을 기준으로 정리하고 module별 label/status extension은 presentation layer로 둔다. |
| Encounter 생성 시점 | DB spec과 feature spec 모두 접수/check-in 시 생성으로 정리되었다. | MVP 기본값은 “예약 확정 때는 appointment만 생성, 접수/check-in 때 encounter 생성”으로 고정한다. |
| 권한/감사 로그 | 보안 요구가 MVP에 포함되지만 실제 auth/backend는 없다. | 프론트 프로토타입에서는 역할별 UI gating과 audit log mock event stream으로 검증한다. |
| 수납 범위 | DB spec과 feature spec은 기본 수납, 할인, 환불까지 포함하고 부분수납/세금/정산은 제외한다. | MVP는 청구 후보 생성, 청구 확정, 수납 완료, 환불 요청, 병원 관리자 환불 확정까지 포함한다. |
| 메시징 범위 | 기존 MVP 문서는 카카오 알림톡을 Post-MVP로 두었으나 DB spec은 템플릿/발송 이력 기반을 MVP 기본값으로 둔다. | provider 자동 연동과 카카오 승인/버전 관리는 Post-MVP로 두고, 메시지 템플릿과 발송 이력 mock은 MVP 기반에 포함한다. |
| 검사 결과 확정 | 기존 MVP 문서는 수동 결과 입력만 명시하고 수의사 확인 상태가 약하다. | 검사 담당자 완료/전달 상태와 수의사 확인 상태를 분리하고, 차트의 오더/처방 테이블에서 상태와 결과를 확인하게 한다. |

---

## Recommended Implementation Order

1. **Domain model baseline**: guardian, patient, consent, appointment, encounter, SOAP, prescription, order, invoice, audit log 타입과 mock dataset을 만든다.
2. **Reception first path**: guardian/patient 검색/등록, 예약/현장 접수, encounter 생성, 대기열을 만든다.
3. **Encounter workspace**: 환자 컨텍스트, SOAP, 진단, 처방, 오더 생성이 한 화면에서 이어지게 한다.
4. **Order generalization**: 기존 조제 화면과 공용 오더 큐를 lab/imaging/treatment까지 확장 가능한 구조로 정리한다.
5. **Billing closure**: encounter의 처방/오더/수가 항목을 invoice로 모아 수납완료 상태 전이를 만든다.
6. **Admin foundation**: 역할/권한, 진료 항목/수가 seed, audit log 조회를 최소 UI로 붙인다.

---

## Post-MVP Items Kept Out

| Area | Reason |
|---|---|
| 장비 자동 연동 | MVP는 수동 결과 입력과 파일 첨부로 검증한다. |
| 입원 대시보드 | 외래 중심 encounter 흐름 안정화 후 확장한다. |
| 카카오 알림톡 provider 연동 | MVP는 템플릿/발송 이력 mock 기반까지만 포함하고, 실제 provider 연동과 승인/버전 관리는 별도 구현 범위다. |
| 운영 분석 | 원천 데이터가 쌓인 뒤 대시보드와 집계 전략을 정한다. |
| 마이그레이션 | 기존 EMR별 데이터 구조 분석이 필요하다. |
| AI/약물 안전 | 검증된 데이터와 임상 책임 정책이 필요하다. |
---

## 2026-05-02 Gap Reclassification

### Scope Decision

- 입원과 병원관리 전체 화면은 이번 PR 1-6 범위에서 제외한다.
- 병원관리 Order 관리 / Order 세트는 도메인과 공통 패턴 참고로만 사용한다.
- 조제/처치 화면은 현재 디자인과 동작을 보존한다.

### PR별 남은 갭

| PR | Gap | Resolution |
| --- | --- | --- |
| PR 1 | 최신 화면 요구에 맞는 CS 이력, 최신내역, 검사/영상/수납 mock 연결 부족 가능성 | 도메인 타입과 mock selector를 점검하고 보강 |
| PR 2 | 접수/예약 상세 UI 피드백 미반영 | 접수 화면 closeout으로 정리 |
| PR 3 | 환자/보호자 정보 확인과 수정 진입점 없음 | 드로어와 신규 환자 등록 레이어 추가 |
| PR 4 | 진료 차트 화면 없음 | SOAP/Assessment/Order 기반 차트 화면 추가 |
| PR 5 | 검사/영상 업무 화면 없음 | 검사 결과 입력, 영상 판독, 첨부 UI mock 추가 |
| PR 6 | 수납 업무 화면 없음 | 청구 묶음, 금액 계산, 수납 액션 mock 추가 |

### Regression Guard

- 조제/처치 관련 파일은 필요한 경우가 아니면 수정하지 않는다.
- 조제/처치 관련 파일을 건드리면 shell/nav와 해당 화면 회귀 테스트를 추가로 실행한다.

---

## 2026-05-02 Post-PR 1-6 Status

| MVP Feature | Current Status | Notes |
|---|---|---|
| 보호자 및 환자 관리 | Implemented prototype | 환자/보호자 드로어, read/edit, 신규 환자 등록, 관계 관리, CS 이력, 최신내역이 mock/session 상태로 구현됨. |
| 접수, 예약 및 대기열 관리 | Implemented prototype | 접수/예약 calendar/list/detail/check-in/walk-in flow 구현됨. |
| 진료 Encounter 및 SOAP 차트 | Implemented prototype | 진료 대기열, 과거 이력, SOAP, Assessment, Order 영역 구현됨. |
| 진단 및 처방 관리 | Partial | 진단/처방 domain mock과 차트 표시 기반은 있으나, 완전한 처방 작성/취소 UI는 남은 백로그. |
| 업무 오더 생성 및 오더 큐 | Partial | 검사/영상/수납/차트가 order mock을 소비하지만, 전체 orders dashboard와 오더 생성 UI는 남은 백로그. |
| 기본 수납 관리 | Implemented prototype | 수납 대기/미납/종료 목록, 보호자 청구 묶음, invoice line edit, payment action mock 구현됨. |
| 병원 설정, 직원 및 권한 관리 | Missing/Deferred | PR 1-6 범위 밖. 역할/권한, 병원관리 UI, audit 조회는 후속 작업. |

Remaining high-impact gaps:

- Figma/reference image 기반 화면 정렬과 QA.
- 실제 DB/API/auth/persistence 연결.
- 권한/감사 로그 UI와 정책.
- 처방 작성/오더 생성/전체 orders dashboard.
- 입원과 병원관리 전체 화면.
