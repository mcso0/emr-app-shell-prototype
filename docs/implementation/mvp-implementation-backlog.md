# MVP Implementation Backlog

Updated: 2026-05-02

Start with `docs/implementation/mvp-current-status.md` before using this backlog. PR 1-6 are complete; this document now separates completed prototype work from remaining backlog. The immediate working target is the Sales Demo Prototype described in `docs/implementation/demo-sales-strategy.md`.

| | |
|---|---|
| **Product** | 동물병원 전용 EMR SaaS 서비스 |
| **Source Feature Spec** | `docs/features/동물병원 전용 EMR SaaS 서비스_Feature Specification_2026-05-01.md` |
| **Gap Analysis** | `docs/implementation/mvp-gap-analysis.md` |
| **Purpose** | 제품 MVP로 확장하기 위한 Epic, User Story, Implementation Task를 유지하되, 가까운 우선순위는 Sales Demo Prototype 완성에 맞춘다. |

---

## Backlog Rules

- 구현 순서는 `보호자/환자 -> 접수/대기열 -> Encounter/SOAP -> 진단/처방 -> 오더 생성/큐 -> 기본 수납 -> 설정/권한/감사 로그`로 고정한다.
- MVP의 핵심 업무 단위는 `encounter`이며, 접수/check-in 시점에 생성한다.
- 코드 내부 status와 id는 DB spec의 영문 enum을 우선하고, 화면에는 한국어 label을 매핑한다.
- 환자는 내부 `id`와 직원용 `patient_no`를 분리한다.
- 기존 조제/오더 큐 구현은 버리지 않고 공통 order workflow의 재사용 자산으로 일반화한다.
- Post-MVP 항목은 이 백로그에 구현 task로 섞지 않는다.

## Completed Prototype Wave

| Area | Status | Notes |
|---|---|---|
| Domain Baseline | Completed | Connected EMR mock domain, status label mapper, domain baseline tests. |
| Reception | Completed | Calendar/list/detail/check-in/walk-in prototype. |
| Patient/Guardian Drawer | Completed | Read/edit drawers, session-only relationship management, CS history, latest shortcuts. |
| Chart | Completed | Queue, past history, SOAP, Assessment, Assessment History, Order area. |
| Lab/Image | Completed | Lab result entry, equipment receipt history, imaging reading/impression, attachments. |
| Billing | Completed | Waiting/unpaid/closed queues, guardian billing groups, invoice line editing, payment actions. |
| Sales Demo Spine | Completed | `kong-vomit` scenario registry, 김하늘/콩이 linked seed data, guided launcher, query-based continuity. |
| Sales Demo Wave 2 | Completed | Reception, chart, lab/imaging, billing polish plus shell/golden path integration. See `docs/implementation/sales-demo-wave2-closeout.md`. |

## Recommended Next Work

### Sales Demo Closeout & Rehearsal

**Goal:** `김하늘 / 콩이 / 구토 내원` golden path를 실제 세일즈 대화에서 쓸 수 있게 리허설하고, 남은 gap을 데모 전 최소 작업으로 좁힌다.

**Implementation Tasks**

| Task | Priority | Depends on | Suggested UI/module | Done when |
|---|---|---|---|---|
| 7-minute talk track | P0 | Wave 2 complete | docs/demo script | 홈 -> 접수 -> 진료 -> 검사/영상 -> 조제/처치 -> 수납 흐름을 7분 안에 설명할 수 있다. |
| Manual rehearsal | P0 | talk track | browser | 실제 클릭 리허설 중 막히는 지점과 말로 보완해야 하는 gap이 기록된다. |
| Remaining gap triage | P0 | rehearsal | docs/backlog | 외부 데모 전 필수/선택/보류 항목이 분류된다. |
| Reference screenshot decision | P1 | rehearsal | `docs/assets/reference-screens/*` | 필요한 화면만 reference screenshot을 확보하거나 missing으로 유지한다. |
| Demo reset decision | P1 | rehearsal | home/shell or docs | one-click reset을 구현할지, 말로 안내할지 결정한다. |

**Acceptance Criteria**

- Wave 2 golden path를 실제 브라우저에서 처음부터 끝까지 시연할 수 있다.
- 남은 gap이 첫 외부 데모 blocking 여부 기준으로 정리된다.
- 새 implementation을 시작한다면 Sales Demo Prototype 범위와 product MVP 범위를 분리한다.

---

## Milestone 0. Domain Baseline

**Goal:** MVP feature를 화면별 mock으로 흩어 만들지 않고, 하나의 연결된 EMR 도메인 mock으로 구현할 기반을 만든다.

### User Story

개발자로서 guardian, patient, encounter, order, invoice가 서로 연결된 mock domain을 사용해 각 모듈을 일관되게 구현하고 싶다.

### Implementation Tasks

| Task | Priority | Depends on | Suggested UI/module | Done when |
|---|---|---|---|---|
| MVP domain type 정의 | P0 | 없음 | `src/types/emr.ts` 또는 별도 domain type 파일 | guardian, patient(`id` + `patient_no`, 잠금 주의사항 메모), consent, appointment, encounter, SOAP, diagnosis, prescription, order, invoice, message delivery, audit log 타입이 DB spec 용어와 맞는다. |
| 연결형 mock dataset 작성 | P0 | domain type | shared mock data module | 한 환자의 `guardian -> patient -> appointment/reception -> encounter -> SOAP/prescription/order -> invoice` 흐름을 mock으로 추적할 수 있다. |
| status label mapper 작성 | P0 | domain type | shared domain utility | `encounter.status`, `order.status`, `invoice.status` 영문 enum을 한국어 label로 표시할 수 있다. |
| 기존 조제 mock data 매핑 계획 정리 | P1 | 연결형 mock dataset | dispensing/order queue | 현재 `dispensing` mock order가 공통 `order` 모델의 어떤 필드로 이동하는지 문서화 또는 코드 주석으로 확인 가능하다. |

### Acceptance Criteria

- 모든 MVP 모듈이 같은 patient/encounter/order mock 데이터를 참조할 수 있다.
- UI 표시 label과 내부 enum 값이 분리된다.
- 기존 조제 화면 테스트가 깨지지 않는 전제로 공통화 방향이 정리된다.

---

## Epic 1. 보호자 및 환자 관리

**Goal:** 데스크 직원이 보호자와 환자를 등록/조회하고, 이후 접수와 진료 화면에서 동일한 정보를 재사용한다.

### User Stories

- 데스크 직원으로서 신규 보호자와 환자를 등록해 접수에 사용할 수 있다.
- 수의사와 간호사로서 환자 컨텍스트에서 보호자, 품종, 나이, 주요 메모를 확인할 수 있다.
- 병원 관리자로서 개인정보 동의 여부와 변경 이력을 확인할 수 있다.

### Implementation Tasks

| Task | Priority | Depends on | Suggested UI/module | Done when |
|---|---|---|---|---|
| guardian/patient 목록 및 검색 UI | P0 | Milestone 0 | reception side panel 또는 patient search component | 이름/전화번호/환자명으로 mock 데이터를 검색하고 선택할 수 있다. |
| 보호자 등록/수정 form | P0 | guardian/patient 목록 | reception module | 보호자 이름, 연락처, 주소, 메모를 등록/수정할 수 있다. |
| 환자 등록/수정 form | P0 | 보호자 form | reception module | 환자번호, 이름, 종, 품종, 성별, 나이/생일, 체중, 특이사항을 등록/수정할 수 있다. |
| 잠금 주의사항 메모 | P1 | 환자 form | reception/patient detail | 물림/할큄/예민함 등 내부 직원용 메모가 기본 잠금 상태로 표시되고 보호자-facing 문구에는 포함되지 않는다. |
| 보호자-환자 관계 연결 | P0 | 보호자/환자 form | reception module | 한 보호자에게 여러 환자를 연결하고 환자 상세에서 관계를 확인할 수 있다. |
| 개인정보 동의 표시 | P1 | 보호자 form | reception module | 동의 여부, 동의 시각, 동의 문서 파일 링크가 환자/보호자 상세에 표시된다. |
| PatientContextBar domain 연결 | P1 | 연결형 mock dataset | `patient-context-bar.tsx` | 조제 mock 전용 데이터 대신 선택된 patient/guardian 정보를 표시한다. |

### Acceptance Criteria

- 신규 보호자/환자를 등록한 뒤 바로 접수 대상자로 선택할 수 있다.
- 환자 상세에서 보호자, 최근 내원, 최근 처방, 주요 메모가 보인다.
- 변경/동의 정보는 audit log task와 연결 가능한 이벤트 형태로 남길 수 있다.

---

## Epic 2. 접수, 예약 및 대기열 관리

**Goal:** 예약 또는 현장 접수를 통해 encounter를 생성하고, 진료 대기열에서 상태를 추적한다.

### User Stories

- 데스크 직원으로서 예약 환자를 접수 처리해 진료 대기열에 올릴 수 있다.
- 데스크 직원으로서 예약 없이 방문한 환자를 즉시 접수할 수 있다.
- 수의사로서 담당 환자 대기열에서 다음 진료 대상을 선택할 수 있다.

### Implementation Tasks

| Task | Priority | Depends on | Suggested UI/module | Done when |
|---|---|---|---|---|
| `reception` placeholder를 실제 모듈로 교체 | P0 | Epic 1 검색/선택 | `src/features/reception/*` | 접수 모듈이 placeholder 대신 예약/접수/대기열 UI를 렌더링한다. |
| 예약 등록/수정/취소 UI | P1 | Epic 1 | reception content | 예약 일시, 내원 목적, 담당 수의사, 환자를 입력하고 상태를 변경할 수 있다. |
| 노쇼 상태 및 이력 | P1 | 예약 UI | reception content, patient detail | 예약을 no_show로 표시하고 보호자/환자 이력에서 노쇼 기록을 확인할 수 있다. |
| 현장 접수 flow | P0 | Epic 1 | reception content | 환자 선택 후 check-in하면 `encounter.status=waiting`인 encounter가 생성된다. |
| 대기열 table/list | P0 | 현장 접수 flow | reception content or side panel | 환자명, 보호자명, 담당 수의사, 접수 시각, 상태가 표시된다. |
| encounter 상태 전이 | P0 | 대기열 | reception/treatment | `waiting -> in_consultation -> ready_for_billing -> completed/cancelled` 전이를 UI에서 수행할 수 있다. |
| 상태 변경 audit event 연결 | P1 | audit baseline | reception/treatment | 상태 변경자, 변경 시각, 이전/현재 상태가 event로 남는다. |

### Acceptance Criteria

- 예약 환자와 현장 방문 환자가 모두 같은 대기열로 들어온다.
- 접수 시점에 encounter가 생성된다.
- 대기열에서 환자를 선택하면 진료 encounter 화면으로 이동할 수 있다.

---

## Epic 3. Encounter 및 SOAP 차트

**Goal:** 수의사가 encounter 안에서 SOAP 차트를 작성하고 과거 이력을 조회한다.

### User Stories

- 수의사로서 대기열에서 환자를 선택해 진료 화면으로 들어갈 수 있다.
- 수의사로서 S/O/A/P 필드를 나누어 차트를 작성하고 임시 저장할 수 있다.
- 수의사로서 과거 차트와 현재 오더 상태를 같은 맥락에서 볼 수 있다.

### Implementation Tasks

| Task | Priority | Depends on | Suggested UI/module | Done when |
|---|---|---|---|---|
| encounter workspace route/module 구성 | P0 | Epic 2 encounter | treatment module or clinical module | 선택된 encounter의 환자 컨텍스트, 상태, SOAP 영역이 보인다. |
| SOAP form | P0 | encounter workspace | treatment content | Subjective, Objective, Assessment, Plan 필드 입력과 저장이 가능하다. |
| 임시 저장/최종 저장 상태 | P1 | SOAP form | treatment content | `draft`와 final saved 상태가 구분되어 표시된다. |
| SOAP 수정 이력 | P1 | SOAP 저장 | audit log | 저장 후 24시간 이후 수정 시 사유와 revision event가 남는다. |
| 과거 진료 이력 timeline/filter | P1 | mock encounter history | right panel or content aside | 이전 encounter, SOAP, 처방, 검사 결과, 오더 이력을 날짜순 타임라인과 항목별 필터로 볼 수 있다. |
| 현재 encounter summary | P0 | order/invoice mock | encounter workspace | 현재 처방/오더/수납 상태 요약이 진료 화면에서 보인다. |

### Acceptance Criteria

- encounter 화면만 보고 환자 정보, SOAP, 현재 업무 상태를 이해할 수 있다.
- SOAP 저장 후 새로 선택해도 같은 mock domain에서 내용이 유지된다.
- 완료된 encounter의 SOAP 수정은 사유 기록 없이는 불가능하다.

---

## Epic 4. 진단 및 처방 관리

**Goal:** 수의사가 encounter 안에서 진단과 처방을 작성하고, 처방으로 조제 오더를 생성한다.

### User Stories

- 수의사로서 진단명을 직접 입력하거나 기본 목록에서 선택할 수 있다.
- 수의사로서 약물명, 용량, 용법, 기간, 주의사항을 포함한 처방을 작성할 수 있다.
- 수의사로서 처방에서 조제 오더를 생성할 수 있다.

### Implementation Tasks

| Task | Priority | Depends on | Suggested UI/module | Done when |
|---|---|---|---|---|
| diagnosis 입력 UI | P1 | Epic 3 | encounter workspace | 진단명 입력/선택 값이 encounter에 저장된다. |
| prescription form | P1 | diagnosis UI | encounter workspace | 약품 사전 기반 약물명, 용량, 단위, 경로, 횟수, 기간, 수량, 복약 안내를 입력할 수 있다. |
| 처방 목록 및 변경 액션 | P1 | prescription form | encounter workspace | 수의사 권한으로 처방 추가, 수정, 취소와 변경/취소 사유 입력이 가능하다. |
| 처방 이력 조회 | P2 | prescription data | patient history panel | 환자별 과거 처방 이력을 볼 수 있다. |
| 조제 오더 생성 연결 | P1 | Epic 5 order model | encounter workspace -> order queue | 처방 item에서 dispensing order가 생성되고 오더 큐에 나타난다. |

### Acceptance Criteria

- 처방은 encounter와 patient history 양쪽에서 조회 가능하다.
- 처방 취소는 사유와 audit event를 남긴다.
- 처방 기반 조제 오더가 기존 조제/오더 큐 UI와 연결된다.

---

## Epic 5. 업무 오더 생성 및 오더 큐

**Goal:** 조제, 처치, 임상병리 검사, 영상 검사 오더를 생성하고 공용 오더 큐에서 수행 상태를 관리한다.

### User Stories

- 수의사로서 encounter에서 업무 오더를 생성하고 우선순위와 담당자를 지정할 수 있다.
- 간호사로서 본인 또는 팀에 할당된 오더를 필터링하고 완료 처리할 수 있다.
- 간호사로서 검사/영상 결과를 수동 입력하거나 파일을 첨부할 수 있다.

### Implementation Tasks

| Task | Priority | Depends on | Suggested UI/module | Done when |
|---|---|---|---|---|
| 공통 order type 정리 | P0 | Milestone 0 | `src/types/emr.ts` | dispensing/treatment/lab/imaging이 같은 lifecycle을 공유한다. |
| 기존 조제 큐를 공통 order queue로 일반화 | P1 | 공통 order type | `order-queue-side-panel.tsx`, `order-queue-summary.tsx` | 조제/처치 외 lab/imaging 타입도 표시할 수 있다. |
| 오더 생성 UI | P1 | Epic 3 | encounter workspace | order type, priority, assignee, request note를 입력해 오더를 생성한다. |
| `orders` 모듈 실제 dashboard | P1 | 공통 order queue | `src/features/orders/*` | 전체 오더를 타입/상태/우선순위/담당자 기준으로 필터링한다. |
| 오더 수행/완료 기록 | P1 | orders dashboard | order detail drawer | 수행 메모, 수행자, 수행 시각, 완료 상태가 기록된다. |
| 담당하기/지정 배정 | P1 | orders dashboard | order detail drawer | 담당자가 직접 담당하기를 누르거나 권한자가 담당자를 지정/변경할 수 있고 이력이 남는다. |
| lab/imaging 결과 수동 입력 | P2 | order detail drawer | lab/imaging module or drawer | 검사 결과값, 판독 메모, 첨부 파일 placeholder를 저장하고 완료/전달 상태로 전환할 수 있다. |
| 수의사 결과 확인 상태 | P2 | lab/imaging 결과 | encounter workspace | 차트의 오더/처방 테이블에서 결과를 보고 reviewed 상태로 확인 처리할 수 있다. |
| 오더 변경/취소 이력 | P1 | audit log | order detail drawer | 변경 사유와 이전/현재 값이 order event로 남는다. |

### Acceptance Criteria

- encounter에서 만든 오더가 공용 오더 큐와 조제/처치/검사/영상 모듈에 같은 데이터로 표시된다.
- 오더 상태는 `requested`, `re_requested`, `in_progress`, `completed`, `cancelled` 중 하나다.
- 완료/취소된 오더는 변경 이력을 확인할 수 있다.

---

## Epic 6. 기본 수납 관리

**Goal:** encounter에 연결된 진료/처방/오더 항목을 invoice로 모아 기본 수납 상태를 관리한다.

### User Stories

- 데스크 직원으로서 진료가 끝난 encounter의 청구 항목을 확인하고 수납 처리할 수 있다.
- 병원 관리자로서 항목별 금액과 결제 상태를 확인할 수 있다.
- 데스크 직원으로서 수납 완료 후 encounter를 완료 상태로 닫을 수 있다.

### Implementation Tasks

| Task | Priority | Depends on | Suggested UI/module | Done when |
|---|---|---|---|---|
| service item/price seed | P0 | Milestone 0 | settings seed/mock domain | 진료, 처치, 검사, 영상, 약품성 항목의 기본 가격이 mock으로 존재한다. |
| invoice 생성 로직 | P2 | Epic 4, Epic 5, service item | billing module | encounter의 처방/오더/진료 항목이 invoice line으로 모인다. |
| `billing` placeholder를 실제 모듈로 교체 | P2 | invoice 생성 | `src/features/billing/*` | 수납 대기 encounter와 invoice summary가 표시된다. |
| 결제 상태 변경 UI | P2 | billing module | billing content | `draft`, `issued`, `paid`, `refund_requested`, `refunded` 상태를 표시/변경할 수 있다. |
| 할인/환불 권한 | P2 | billing module, permission matrix | billing content | 할인은 수납 담당자가 적용하고 환불 확정은 병원 관리자만 처리할 수 있다. |
| 수납 완료 encounter 전이 | P2 | 결제 상태 변경 | billing/reception | invoice paid 시 encounter가 `completed`로 전이된다. |
| 수납 변경 audit event | P2 | audit log | billing module | 금액 조정, 결제 상태 변경 이벤트가 남는다. |

### Acceptance Criteria

- 진료 완료 encounter는 수납 대기 목록에 나타난다.
- invoice line은 처방/오더/수가 항목과 연결되어 출처를 확인할 수 있다.
- 수납 완료 후 encounter가 완료 상태가 된다.

---

## Epic 7. 병원 설정, 직원 및 권한, 감사 로그

**Goal:** MVP 운영에 필요한 병원 설정, 역할 기반 접근, 진료 항목/수가, 감사 로그 기반을 만든다.

### User Stories

- 병원 관리자로서 병원 기본 정보와 진료 시간을 설정할 수 있다.
- 병원 관리자로서 직원 계정과 역할을 관리할 수 있다.
- 병원 관리자로서 진료/오더 항목과 기본 수가를 관리할 수 있다.
- 시스템 관리자로서 민감 정보와 주요 변경 이력을 확인할 수 있다.

### Implementation Tasks

| Task | Priority | Depends on | Suggested UI/module | Done when |
|---|---|---|---|---|
| role permission matrix 구현 | P0 | Milestone 0 | shared auth/permission utility | 수의사, 간호사, 데스크 직원, 병원 관리자, 시스템 관리자 권한을 코드에서 판정할 수 있다. |
| 역할별 UI gating | P1 | permission matrix | shell/modules | 사용자의 role에 따라 주요 액션 버튼이 표시/비활성 처리된다. |
| clinic settings mock | P2 | Milestone 0 | settings module or seed | 병원명, 지점명, 연락처, 주소, 진료 시간이 mock으로 존재한다. |
| 직원 계정 mock 관리 UI | P2 | permission matrix | settings module | 직원 목록, 역할, 활성/비활성 상태를 볼 수 있다. |
| service item/price 관리 UI | P2 | Epic 6 seed | settings module | 진료/오더 항목과 기본 수가를 조회/수정할 수 있다. |
| service item price history | P2 | service item/price 관리 UI | settings module | 수가 변경 시 적용일과 이전/현재 가격 이력이 남는다. |
| message template/delivery mock | P2 | consent, permission matrix | settings/admin or shared message module | 예약/접수/차례/진료결과/복약지도 템플릿과 발송 이력을 mock으로 관리할 수 있다. |
| audit log event model | P0 | Milestone 0 | shared audit utility | 환자 정보, 차트, 처방, 오더, 수납 변경 이벤트를 일관된 구조로 남길 수 있다. |
| audit log 조회 UI | P2 | audit event model | settings/admin module | 주요 변경 이력을 사용자, 시간, 도메인 기준으로 필터링할 수 있다. |

### Acceptance Criteria

- MVP 핵심 액션은 역할 권한에 따라 허용 여부가 결정된다.
- 주요 변경은 audit log event로 남는다.
- 설정 UI가 없어도 service item/role seed는 다른 모듈 구현에 먼저 사용 가능하다.

---

## Suggested First PR Slices

| PR | Scope | Why first |
|---|---|---|
| PR 1 | Domain baseline: MVP types, connected mock dataset, status label mapper | 이후 모든 모듈이 같은 데이터를 쓰게 해 재작업을 줄인다. |
| PR 2 | 보호자/환자 검색/등록 + reception placeholder 교체 시작 | encounter 생성 전 반드시 필요한 사용자 업무 흐름이다. |
| PR 3 | 접수/check-in + encounter 생성 + 대기열 | SOAP, 처방, 오더, 수납의 기준 데이터를 만든다. |
| PR 4 | Encounter workspace + SOAP form | 수의사 핵심 업무 화면을 연다. |
| PR 5 | 처방 작성 + 조제 오더 생성 + 기존 오더 큐 연결 | 기존 구현 자산을 MVP 흐름에 붙인다. |
| PR 6 | 수납 후보 생성 + 결제/환불 권한 + 메시지 이력 mock | encounter를 운영 흐름으로 닫고 보호자 커뮤니케이션 기반을 둔다. |

---

## Post-MVP Parking Lot

| Item | Notes |
|---|---|
| 장비 자동 연동 | MVP에서는 검사/영상 결과 수동 입력과 파일 첨부만 구현한다. |
| 입원 관리 | 외래 encounter, 오더, 수납 흐름 이후 별도 epic으로 연다. |
| 카카오 알림톡 provider 연동 | 개인정보 동의, provider 설정, 템플릿 승인/버전, 발송 실패 재시도 처리가 필요하다. |
| 운영 분석 | MVP 원천 데이터가 안정화된 뒤 대시보드와 집계 전략을 정한다. |
| EMR 마이그레이션 | 원천 시스템별 mapping workshop 이후 진행한다. |
| AI/약물 안전 | 임상 검증 데이터와 책임 정책 수립 후 진행한다. |
---

## 2026-05-02 Backlog Reordering: PR 0-6

| PR | Name | Deliverables | Verification |
| --- | --- | --- | --- |
| PR 0 | Documentation Baseline | PRD/Feature/User Flow/DB/gap/backlog addendum, reusable candidates, open questions, reference screen index | `rg`로 문서 반영 확인 |
| PR 1 | Domain Baseline Review | 도메인 타입, status labels, 연결형 mock dataset 보강 | `npm run lint`, `npx tsc --noEmit`, `npm run build` |
| PR 2 | Reception Closeout | 접수/예약 필터, 캘린더 시간축, 상세 드로어 진입, 불필요 UI 제거 | PR2 Playwright + app-shell regression |
| PR 3 | Patient/Guardian Drawer | 환자/보호자 드로어, read/edit, 신규 환자 등록, 연결 관리 | Drawer interaction tests |
| PR 4 | Chart | 진료 대기열, 과거 이력, SOAP, Assessment, Order 영역 | Chart route/selection tests |
| PR 5 | Lab/Image | 검사/영상 queue, 결과 입력, 영상 판독, 첨부자료 | Lab/Image route/interaction tests |
| PR 6 | Billing | 대기/미납/종료, 청구 묶음, 합산/해제, 결제 액션 | Billing calculation/action tests |

### Component Extraction Rule

- PR 2-6에서는 화면 구현을 우선하고, 공통화 후보는 문서에 기록한다.
- 동일 패턴이 2개 이상 화면에서 반복되고 구조가 안정되면 별도 PR에서 공통 컴포넌트로 추출한다.

### Handoff Reports

- 각 PR 종료 시 변경 파일, 검증 명령, 남은 질문, 다음날 사용자와 함께 볼 수정 포인트를 보고서에 남긴다.
