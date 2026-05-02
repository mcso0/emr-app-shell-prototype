# MVP Current Status

Updated: 2026-05-02

이 문서는 EMR SaaS MVP 작업의 현재 상태를 설명하는 단일 시작점이다. 새 작업을 시작하는 Codex나 개발자는 먼저 이 문서를 읽고, 필요한 세부 문서로 이동한다.

## 한눈에 보기

현재 MVP는 **주요 외래 업무 흐름을 눌러볼 수 있는 프론트엔드 프로토타입 1차 완성본**이다. 아직 실제 DB/API 연동 제품은 아니지만, 접수에서 진료, 검사/영상, 조제, 수납까지 이어지는 핵심 화면과 연결형 mock 데이터가 구현되어 있다.

완료된 핵심 범위:

- 접수/예약
- 환자/보호자 드로어와 신규 환자 등록
- 진료(차트)
- 임상병리/계통 검사
- 영상검사
- 조제/처치 기존 화면 보존
- 수납
- 연결형 EMR mock domain, status label mapper, Playwright 회귀 테스트

현재 `main`에는 PR 1-6 구현이 병합되어 있다. 대표 병합 PR은 [GitHub PR #2](https://github.com/mcso0/emr-app-shell-prototype/pull/2)이다.

## 목적과 목표

이 MVP의 목적은 동물병원 외래 진료 운영 흐름을 하나의 encounter 중심 프로토타입으로 검증하는 것이다.

MVP 목표:

- 접수/check-in 시 encounter가 만들어지고 이후 업무가 같은 환자/보호자/encounter 맥락을 공유한다.
- 수의사는 차트 화면에서 과거 이력, SOAP, Assessment, Order를 확인할 수 있다.
- 검사/영상/조제/수납은 독립 화면처럼 보이지만 같은 mock 도메인 데이터를 기반으로 연결된다.
- 비개발자도 주요 화면을 열어 업무 흐름과 정보 배치를 검토할 수 있다.

아직 목표가 아닌 것:

- 실제 backend, DB, auth, 권한, 파일 저장, 외부 연동 완성
- 실제 KakaoTalk, Excel, PACS, 장비 수신, 결제 연동
- 병원관리 전체 화면과 입원 화면
- Figma 기준의 정밀 UI QA 완료

## 현재 결과물

구현된 화면:

| 메뉴 | 상태 | 주요 내용 |
|---|---|---|
| 접수/예약 | 구현됨 | 캘린더, 접수/예약 목록, 상세 드로어, check-in, 현장 접수 |
| 환자/보호자 | 구현됨 | 환자/보호자 read/edit 드로어, 관계 관리, CS 이력, 최신내역, 신규 환자 등록 |
| 진료(차트) | 구현됨 | 진료 대기열, 과거 진료 이력, SOAP, Assessment, Assessment History, Order |
| 임상병리/계통 검사 | 구현됨 | 검사 대기열, 결과 입력, 장비 수신 내역, 첨부자료 |
| 영상검사 | 구현됨 | 영상 대기열, 판독 내용, 종합소견, 첨부자료 |
| 조제/처치 | 기존 구현 보존 | 기존 화면 디자인과 동작을 유지 |
| 수납 | 구현됨 | 대기/미납/종료 목록, 보호자 청구 묶음, 청구 항목 편집, 합산/해제, 결제 수단, 수납 액션 |

주요 구현 파일은 기능별 `src/features/*`에 있다. 새 작업자는 개별 파일을 보기 전에 이 문서와 관련 implementation 문서를 먼저 확인한다.

## PR 0-6 완료 현황

| PR | 상태 | 결과 |
|---|---|---|
| PR 0 Documentation | 완료 | PRD, Feature Spec, User Flow, DB 구조, backlog, reference index, open questions, reusable candidates 정리 |
| PR 1 Domain Baseline | 완료 | `src/types/emr-domain.ts`, status labels, 연결형 mock dataset, domain baseline test 추가 |
| PR 2 Reception Closeout | 완료 | 접수/예약 실제 화면과 주요 상호작용 구현 |
| PR 3 Patient/Guardian Drawer | 완료 | 환자/보호자 드로어, 신규 환자 등록, session-only 관계 관리 구현 |
| PR 4 Chart | 완료 | 진료(차트) workspace 구현 |
| PR 5 Lab/Image | 완료 | 검사/영상 workspace 구현 |
| PR 6 Billing | 완료 | 수납 workspace 구현 |

## 현재 검증 상태

2026-05-02 기준 `main` 병합 전후로 아래 검증이 통과했다.

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/billing.spec.ts tests/lab-imaging.spec.ts tests/chart.spec.ts tests/reception.spec.ts tests/domain-baseline.spec.ts tests/app-shell.spec.ts --reporter=line`

화면 작업 시 기본적으로 관련 Playwright test를 추가하거나 갱신한다. 조제/처치 관련 파일을 건드리면 `tests/app-shell.spec.ts`의 조제 회귀를 반드시 다시 확인한다.

## 작업 시 주의사항

- 작업 시작 전 이 문서를 먼저 읽는다.
- Next.js application code를 쓰기 전에는 `node_modules/next/dist/docs/`의 관련 문서를 확인한다.
- 조제/처치 화면의 현재 디자인과 동작은 명시 요청 없이는 수정하지 않는다.
- 입원과 병원관리 전체 화면은 현재 PR 1-6 범위 밖이었다.
- 병원관리의 Order 관리 / Order 세트 화면은 참고 자료일 뿐 구현 대상이 아니었다.
- UI는 Figma나 screenshot을 1:1 복제하지 않고, 프로젝트 foundation, token, 기존 컴포넌트를 우선 사용한다.
- 공통 컴포넌트 추출은 반복 패턴이 안정된 뒤 진행한다. PR7 화면 정렬 전에는 무리하게 공통화하지 않는다.
- prototype 상태는 session-only이다. 새로고침 후 유지되는 persistence를 전제로 만들지 않는다.

## Reference Images 상태

현재 `docs/assets/reference-screens/*`에는 메뉴별 폴더와 README만 있고, 실제 PNG 캡처 파일은 없다. `docs/implementation/reference-screen-index.md`에는 파일명과 용도만 정리되어 있다.

Figma 화면 예시를 기준으로 UI를 정렬하려면 먼저 PR7에서 실제 캡처 파일을 저장해야 한다.

권장 저장 흐름:

1. Figma에서 기능별 화면을 export 또는 screenshot으로 캡처한다.
2. `docs/assets/reference-screens/<area>/...png`에 저장한다.
3. `docs/implementation/reference-screen-index.md`의 파일 존재 여부와 notes를 갱신한다.
4. 구현 화면과 reference image를 비교해 정보 우선순위, 밀도, 간격, 상태 표현을 조정한다.

## 다음 추천 작업

다음 작업은 **PR7: Figma Reference Capture & MVP Screen Alignment**를 추천한다.

PR7과 foundation 작업을 여러 채팅에서 병렬로 진행할 때는 `docs/implementation/mvp-parallel-workstreams.md`를 먼저 읽고, 각 작업을 전용 `git worktree`와 브랜치에서 진행한다.

PR7 목표:

- Figma의 기존 화면 예시를 기능별 캡처 이미지로 repo에 저장한다.
- PR 1-6 화면을 실제 reference image와 비교한다.
- 기능과 데이터 흐름은 유지하면서 레이아웃, 정보 우선순위, 텍스트, 상태 표현, 밀도를 정렬한다.
- 새 기능 추가보다 데모 품질과 화면 일관성을 먼저 높인다.

PR7에서 우선 확인할 화면:

- 접수/예약 캘린더와 사이드 목록
- 환자/보호자 드로어
- 진료(차트) queue/history/SOAP/Order 구성
- 검사 결과 입력 테이블
- 영상 판독/첨부 영역
- 수납 대기/미납/종료 목록과 청구 항목 편집

## 관련 문서

- 구현 문서 목차: `docs/implementation/README.md`
- 병렬 작업 계획: `docs/implementation/mvp-parallel-workstreams.md`
- PR 1-6 구현 기록: `docs/implementation/pr1-pr6-realigned-plan.md`
- 갭 분석: `docs/implementation/mvp-gap-analysis.md`
- 백로그: `docs/implementation/mvp-implementation-backlog.md`
- 확인 필요 항목: `docs/implementation/open-questions.md`
- 레퍼런스 화면 인덱스: `docs/implementation/reference-screen-index.md`
- 공통화 후보: `docs/implementation/reusable-component-candidates.md`
- App shell layout contract: `docs/app-shell-layout-contract.md`
