---
id: "HOME-FEATURE-PLANNING-001"
status: draft
area: product
doc_type: feature-planning
related_work:
  - "docs/work/home/HOME-PR-001-role-command-home-foundation.md"
related_docs:
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
supersedes: []
superseded_by: []
last_updated: "2026-05-09"
---

# Home Command Entry Planning

## Purpose

홈 화면은 병원 전체 대시보드가 아니라 모든 직원이 업무를 시작하기 위한 진입점이다.

홈이 가장 먼저 답해야 하는 질문은 다음이다.

> 오늘/지금 내가 뭘 해야 하지?

현재 홈 foundation은 역할별 업무, 병원 흐름, 알림/예외, 역할별 위젯을 한 화면에 보여준다. 각 정보는 유용하지만 서로 다른 목적의 정보가 같은 무게로 펼쳐져 있어, 사용자가 다음 행동을 고르기 어렵다.

이 문서는 후속 에픽 기획 문서(에픽, 유저스토리, 완성기준)를 만들기 전의 제품 방향 메모다.

## Product Context

병원 규모에 따라 사용자의 업무 방식이 다르다.

| 병원 유형 | 업무 방식 | 홈 기본 방향 |
|---|---|---|
| 대형 병원 | 한 사용자가 하나의 역할 중심으로 일함 | 역할/담당 업무 중심으로 좁혀 보여줌 |
| 중형 병원 | 한 사용자가 2개 이상 역할을 겸함 | 여러 업무 책임을 하나의 우선순위 흐름으로 통합 |
| 소형 병원 | 원장/매니저가 진료, 접수, 수납, 운영 일부를 함께 봄 | 오늘 해야 할 실무 중심으로 압축 |

다중 역할은 단순히 권한이 많다는 뜻이 아니라, 실제로 여러 업무 요청을 처리한다는 뜻이다. 따라서 홈은 로그인 role 하나에 고정된 대시보드가 아니라, 사용자에게 요청된 업무를 하나의 시작점으로 정리해야 한다.

## Core Principles

- 홈은 모든 직원이 볼 수 있는 업무 시작 화면이다.
- 홈의 기본값은 `내 업무`다.
- 홈은 업무를 직접 처리하는 화면이 아니라, 처리할 업무로 진입하는 화면이다.
- 병원관리성 정보는 기본 홈에서 분리한다.
- 홈은 전역 notification center를 대체하지 않는다.
- 홈에 표시되는 알림성 정보는 처리 가능한 사용자에게 업무 맥락으로 연결한다.
- 홈은 5초 안에 다음 행동을 고를 수 있어야 한다.
- 너무 복잡해서 사용하지 않게 되는 홈은 실패다.

## Scope Direction

### Include

- 오늘/지금 해야 하는 내 업무
- 긴급하거나 오늘 마감인 업무
- 내가 요청받은 업무
- 내가 담당자 또는 담당 role로 지정된 업무
- 업무로 진입할 수 있는 링크
- 병원 흐름의 압축 요약
- 업무 row별 추천 다음 행동

### Exclude From Default Home

- 매출, 방문자 수, 운영 KPI
- 관리자용 재고 리포트
- 병원관리 승인/마감/인력 상세
- 정상 진행 중인 모든 예약/완료 건수
- low priority info
- 역할별 위젯 전체 펼침

운영관리 정보는 차후 `병원관리` 메뉴에서 별도로 다루는 방향이 더 적합하다. 병원관리 담당자는 해당 메뉴에서 매출, 재고, 승인, 마감, 인력, 운영 KPI를 확인한다.

## Information Model

내 업무는 사용자에게 요청된 업무다. 업무의 시작은 환자이고, 실제 홈 업무는 데스크에서 환자 접수를 한 이후 환자의 진료 흐름에서 발생하는 request/event로 만들어진다.

```text
환자 내원
→ 접수
→ 담당 수의사 지정 또는 진료 대기 업무 생성
→ 진료 시작
→ 수의사 오더
→ 검사/조제/처치 업무 발생
→ 진료 마무리
→ 수납 업무 발생
→ 필요 시 입원/수술 업무 발생
```

환자는 업무의 시작점이자 맥락이다. 실제 홈 업무는 encounter, order, status transition, request, assignment에서 생성된다.

Role-based request examples:

| 업무 영역 | 내 업무가 되는 조건 | 예시 |
|---|---|---|
| 진료 수의사 | 내가 담당의로 지정됨 | 담당의로 지정된 진료 대기 환자 |
| 조제/처치 테크니션 | 수의사가 조제/처치 업무를 요청 또는 재요청함 | 투약 준비, 수액 처치, 처치 재확인 |
| 영상/임상병리 검사 담당 | 진료 수의사가 검사 업무를 요청 또는 재요청함 | CBC 결과 입력, 영상 촬영, 검사 재확인 |
| 수납 담당 | 진료 완료 후 수납 요청 또는 중간 정산 요청이 생성됨 | 수납 대기, 중간 정산, 미수 처리 |
| 입원 담당 | 수의사가 입원 등록을 요청하거나 입원 중 케어/퇴원 관리가 필요함 | 입원 등록, 입원 케어, 퇴원 체크 |
| 데스크 | 접수/대기/보호자 응대 업무가 발생함 | 접수 확인, 대기 안내, 서류 확인 |

예시:

```text
수의사가 CBC 오더 생성
→ 검사/테크니션 업무 생성: 샘플 채취, 장비 결과 연결, 또는 수기 결과 입력
→ 검사 담당자가 결과를 입력하고 완료 처리
→ 담당 수의사 업무 생성: 검사 결과 확인
→ 수의사가 필요 시 검사 담당자에게 재확인 또는 재검 요청
```

## Task, Alert, Flow Signal

홈 기획에서 `내 업무`, `알림`, `병원 흐름 신호`는 구분되어야 한다.

| 개념 | 정의 | 홈에서의 역할 |
|---|---|---|
| 내 업무 | 나에게 요청되었거나 내가 담당자로 지정된 action | 기본 timeline에 표시 |
| 알림 | 내가 알아야 하는 signal | 처리 가능 여부에 따라 업무 또는 참고 신호로 변환 |
| 병원 흐름 신호 | 병원 workflow 단계의 상태 | compact summary 또는 flow lens에 표시 |

### Notification Boundary

전역 notification 기능은 별도로 필요하다. 이 기능은 홈 화면 안에서 구현되는 것이 아니라, 앱 오른쪽 상단의 알림 카드/알림 센터로 제공되는 전역 채널이다.

Current notification implementation contract: `docs/product/features/notifications/global-notification-center-v0-contract.md`.

홈과 notification의 책임은 다르다.

| 영역 | 목적 | 노출 방식 |
|---|---|---|
| 홈 | 오늘/지금 해야 하는 업무의 시작점 | 내 업무 timeline, quick status, compact flow |
| Notification | 사용자/역할에 맞는 전역 알림 전달 | 오른쪽 상단 알림 카드 또는 drawer |

Notification은 사용자와 역할에 맞게 알림을 전달해야 한다. 다만 모든 notification이 홈의 내 업무가 되는 것은 아니다.

홈에 올라오는 것은 다음 조건을 만족하는 항목이다.

- 사용자에게 요청되었거나 사용자가 담당자로 지정되었다.
- 관련 업무 화면으로 진입해야 한다.
- 오늘/지금 업무 시작 판단에 필요하다.

반대로, 단순 참고 알림, 시스템 공지, 백그라운드 상태 변화, 운영관리 공지는 notification에는 표시될 수 있지만 기본 홈 timeline에는 올리지 않는다.

같은 사건도 사용자에 따라 다르게 보인다.

예: 대기 30분 초과

| 사용자 | 의미 | 추천 다음 행동 |
|---|---|---|
| 데스크 | 내 업무 | 보호자에게 예상 대기 안내 |
| 수의사 | 개입 신호 | 진료 순서 조정 또는 데스크 전달 메시지 준비 |
| 원장/관리자 | 병목 신호 | 전체 흐름과 인력 배치 확인 |
| 테크니션 | 보통 비노출 또는 참고 | 직접 처리 없음 |

### Waiting Delay Escalation

대기 지연은 단일 기준으로 처리하지 않고 단계형으로 올린다. 이렇게 해야 Critical을 남발하지 않고, 사용자별 개입 강도를 자연스럽게 높일 수 있다.

Initial v0 thresholds:

| 대기 시간 | 단계 | 주요 노출 대상 | 홈 처리 |
|---|---|---|---|
| 20분 이상 | Warning | 데스크 | 약한 warning signal 또는 대기실 강조 |
| 30분 이상 | Desk Task | 데스크 | 보호자 응대 task 생성 |
| 45분 이상 | Vet Intervention | 담당 수의사 | 조건부 task 또는 strong signal 생성 |
| 60분 이상 | Flow Issue 강화 | 원장/관리자, 데스크 | 병원 흐름 병목 신호 강화 |

Recommended behavior:

- 20분 이상: 대기실 row와 quick status에서 주의 신호를 보여준다.
- 30분 이상: 데스크에게 `보호자 대기 안내 필요` task를 생성한다.
- 45분 이상: 담당 수의사가 지정되어 있으면 수의사에게 진료 순서 조정 또는 데스크 전달 메시지 준비 signal/task를 생성한다.
- 60분 이상: 개별 직원 task를 늘리기보다 병원 흐름 summary에서 병목을 강하게 보여준다.

대기 지연 이벤트는 기본적으로 데스크 업무다. 담당 수의사에게는 실제 개입 가능성이 있을 때만 task로 올리고, 그 외에는 signal로 둔다. 원장/관리자에게는 개별 task보다 flow issue로 요약한다.

## Clinical Signal Policy

검사, 조제/처치, 입원 처치처럼 임상 판단이 필요한 영역에서 시스템은 의학적 판단을 대신하지 않는다. 시스템의 역할은 사용자가 비정상 신호를 인지하기 쉽게 돕고, 다음 액션을 제안하며, 진행 여부를 사용자에게 묻는 것이다.

핵심 원칙:

- 시스템은 검사 수치만으로 홈에서 `Critical` 업무를 자동 생성하지 않는다.
- 비정상 수치, 장비 flag, 기준 범위 이탈은 검사 결과지 또는 원본 업무 화면에서 인지하기 쉽게 강조한다.
- 담당자 또는 수의사가 명시적으로 완료, 긴급 전달, 재확인, 재검, 처치 변경을 요청할 때 홈 업무를 만든다.
- 긴급 상황에서 전화, 카톡, 구두 전달이 먼저 일어날 수 있음을 전제로 한다. EMR은 그 사실을 기록하고 후속 업무를 정리한다.
- 사용자가 취할 수 있는 다음 액션을 미리 안내하되, 최종 판단과 실행은 사용자가 한다.

검사 결과 workflow v0:

| 이벤트 | 대상 | 홈 처리 |
|---|---|---|
| 검사 담당자가 결과 입력 후 완료 처리 | 담당 수의사 | 검사 결과 확인 task |
| 검사 담당자가 긴급 전달 필요로 표시 | 담당 수의사 | 긴급 확인 요청 task |
| 장비 연동 없이 수기 입력 | 담당 수의사 | 일반 검사 완료 흐름과 동일 |
| 전화/카톡/구두로 이미 전달 | 담당 수의사, 검사 담당자 | EMR memo 또는 외부 전달 완료 기록 |
| 수의사가 결과 이상으로 재확인 요청 | 검사 담당자 | high priority 재확인 task |
| 수의사가 재검 요청 | 검사 담당자 | high priority 재검 task |

예시:

```text
콩이 CBC 결과 확인
결과 입력 완료 · 김하늘 보호자
추천: 결과를 확인하고 진료 기록 또는 보호자 설명에 반영하세요.
[검사 결과 열기]

콩이 CBC 결과 재확인 요청
이상 수치 확인 필요 · 이수지 수의사 요청
추천: 검체/장비 결과를 확인하고 필요 시 재검을 준비하세요.
[검사 화면 열기]
```

이 정책은 조제/처치에도 동일하게 적용한다. 시스템은 처치나 투약 판단을 대신하지 않고, overdue, 요청, 완료, 재확인, 변경 요청 같은 workflow event를 바탕으로 홈 업무를 만든다.

## Recommended Home Structure

### Top Quick Status

상단은 전체 정보를 문장으로 길게 설명하지 않고, 업무 시작에 필요한 상태 chip만 보여준다.

```text
[내 업무 5] [긴급 1] [오늘 마감 2] [지연 3]
```

상태 chip은 클릭 시 해당 필터 또는 lens로 이동한다.

### Main Lens

본문 기본값은 `내 업무`다.

추천 lens:

```text
내 업무 · 긴급/마감 · 전체
```

보조 업무 필터:

```text
전체 · 진료 · 접수 · 검사/처치 · 수납 · 입원
```

`최근 보던 렌즈`는 아직 명확하지 않으므로 후속 검토 항목으로 둔다.

### My Work Timeline

`내 업무`는 role별 위젯이 아니라 하나의 timeline 또는 priority queue로 보여준다.

정렬 기준:

1. 사용자가 명시적으로 요청받은 긴급 업무
2. Overdue
3. 오늘 마감 또는 예정 시간 임박
4. 내가 담당자로 지정된 업무
5. 다른 직원이 요청한 업무

기본 노출은 상위 5-7개로 제한한다. 업무가 많을 때는 필터와 전체 보기로 확장한다.

업무 row는 다음 정보를 가진다.

- 업무 제목
- 환자/보호자/encounter 맥락
- 발생 원인 또는 요청자
- 추천 다음 행동
- 진입 링크
- 마감/지연/긴급 상태

홈에서 직접 처리하지 않고 관련 업무 화면으로 이동한다.

허용 액션:

- 보기
- 열기
- 확인하러 가기

비허용 액션:

- 담당하기/claim
- 수납 완료
- 차트 작성완료
- 문자 발송
- 검사 결과 확정
- 오더 완료 처리

### My Work Empty State

내 업무가 없는 상태는 정상 상태다. 사용자가 요청받은 업무가 없거나, 다른 직원이 이미 처리했거나, 아직 해당 workflow request가 발생하지 않았을 수 있다.

빈 상태에서 병원 전체 정보를 억지로 끌어와 timeline을 채우지 않는다. 대신 해당 사용자가 다음 업무를 시작할 수 있는 기본 진입점을 제공한다.

Principle:

```text
내 업무가 있으면 → 처리할 업무를 보여준다.
내 업무가 없으면 → 역할/책임에 맞는 업무 시작 런처를 보여준다.
```

Empty state copy direction:

```text
현재 요청된 내 업무가 없습니다.
바로 시작할 수 있는 업무를 선택하세요.
```

Role-based empty launchers:

| 사용자/업무 책임 | Empty state 진입점 |
|---|---|
| 데스크 | 예약/접수 열기, 현장 접수, 수납 대기 보기 |
| 진료 수의사 | 진료 대기열, 내 차트, 검사 결과 확인 |
| 조제/처치 테크니션 | 조제/처치 큐, 검사 대기, 입원 케어 |
| 영상/임상병리 검사 담당 | 검사 대기열, 결과 입력, 재확인 요청 |
| 수납 담당 | 수납 대기, 미수 목록, 중간 정산 |
| 입원 담당 | 입원장, 입원 등록 대기, 퇴원 체크리스트 |

Empty UI should be calm and compact. It should not become a second dashboard.

### Hospital Flow Summary

병원 흐름은 기본 화면에서 크게 펼치지 않는다. 필요하면 compact strip 또는 별도 lens로 제공한다.

예시:

```text
예약 24 · 접수 8 · 대기 5(지연 3) · 검사 3(확인 1) · 수납 4
```

병원 흐름의 목적은 모든 단계의 상세 정보를 보여주는 것이 아니라, 지금 업무 시작에 영향을 주는 병목을 알려주는 것이다.

## Example Work Items

```text
09:40 콩이 CBC 결과 확인
추천: 결과 확인 후 보호자 설명 준비
진입: 검사 결과 열기

10:00 토리 대기 31분
추천: 보호자에게 예상 대기 안내
진입: 접수/대기실 열기

11:30 코코 차트 작성 완료
추천: 작성 중인 SOAP와 오더 상태 확인
진입: 차트 열기

13:00 수납 확정 필요
추천: 청구 확정 상태 확인
진입: 수납 화면 열기
```

## Future Epic Seed

후속 에픽은 아래 방향으로 쪼갤 수 있다.

### Epic: Home As Work Entry

모든 직원이 홈에서 오늘/지금 해야 하는 업무를 빠르게 찾고, 관련 업무 화면으로 진입할 수 있게 한다.

Candidate user stories:

- As a staff member, I can see the most urgent work assigned to my responsibilities first.
- As a multi-role staff member, I can see tasks across my actual responsibilities in one prioritized list.
- As a desk staff member, I can see waiting-room exceptions that require owner communication.
- As a veterinarian, I can see clinical items that require my intervention, such as completed lab results, urgent review requests, recheck requests, or delayed consultations.
- As a technician, I can see treatment, sample, inpatient, or surgery tasks that require action.
- As any staff member, I can open the relevant workflow screen from a home task without completing the task on the home screen.

Candidate acceptance criteria:

- Default home view answers "오늘/지금 내가 뭘 해야 하지?" within one screen.
- Default home does not show hospital management KPI cards such as revenue or visitor counts.
- My Work shows a prioritized timeline/queue with no more than 5-7 default visible items.
- If My Work is empty, the home shows a role/responsibility-based launcher instead of filling the space with unrelated hospital data.
- Each task shows patient context, reason/source, recommended next action, due/urgency state, and an entry link.
- Abnormal clinical signals are not converted into home tasks by automatic interpretation alone; home tasks come from workflow completion, explicit urgent review, recheck, retest, or change requests.
- Flow information is compressed into a summary strip or separate lens.
- Home does not provide finalizing actions such as billing completion, chart completion, message send, or result confirmation.

## Open Questions

- What exact source events generate home tasks in the prototype and in the future live product?
- How should tasks be assigned when several roles can respond to the same event?
- Which signals should become tasks, and which should stay as awareness-only alerts?
- Should hospital size directly control home defaults, or should defaults be derived from user role/responsibility count?
- What research examples should inform expected home usage frequency and return behavior?
- Should `recent lens` exist, or should defaults stay deterministic by responsibility?
- How should completion be synchronized when another user completes a task from its source workflow?
