# MVP Current Status

Updated: 2026-05-04

이 문서는 EMR SaaS 작업의 현재 상태를 설명하는 단일 시작점이다. 새 작업을 시작하는 Codex나 개발자는 먼저 이 문서를 읽고, 필요한 세부 문서로 이동한다.

## Current Working Target

초기 문서들은 MVP라는 표현을 사용했고 한동안 Sales Demo Prototype을 우선했지만, 2026-05-02 기준 당장의 작업 목표는 다시 **Product MVP 제작**으로 전환한다.

현재 구현물은 Sales Demo Prototype으로 검증한 외래 흐름을 제품 MVP로 끌어올리는 단계로 본다. 데모 전략 문서는 세일즈 시나리오와 화면 품질 기준으로 유지하되, 가까운 작업 우선순위는 로그인/권한, API/DB boundary 통합, persistence, audit/service catalog 통합처럼 실제 운영 제품으로 가는 기반 작업을 우선한다.

MVP 전환 목표:

- 사용자가 로그인한 뒤 워크스페이스에 진입한다.
- 역할/권한 기반 UX를 mock foundation에서 시작해 실제 auth provider와 DB/API session으로 교체 가능한 경계로 만든다.
- 접수부터 수납까지 이어지는 외래 흐름은 유지하되, demo-only 설명보다 제품 동작과 데이터 경계를 우선한다.
- Sales Demo golden path는 회귀 테스트와 대표 fixture로 보존한다.

2026-05-02 기준 **Sales Demo Wave 2는 완료되어 `main`에 병합**되어 있다. 완료 범위와 검증 결과는 `docs/archive/sales-demo/sales-demo-wave2-closeout.md`를 기준으로 확인한다.

## Foundation 진행 현황

PR7 UI 정렬과 별도로 진행한 A/B/C/D foundation 작업이 `main`에 통합되어 있다.

- API boundary selectors는 mock domain을 나중에 API/DB로 교체하기 위한 read repository와 selector layer를 제공한다.
- Service catalog/role seed는 수가/서비스 항목과 `front_desk`, `vet`, `nurse`, `billing_admin`, `hospital_admin` 역할 seed를 제공한다.
- Audit log foundation은 status transition, profile edit, SOAP save, order status change, billing action event builder와 fixture를 제공한다.
- Auth mock foundation은 `/login` 역할 선택, sessionStorage/localStorage mock session, logout utility, shell 역할 표시, permission helper를 제공한다.
- 2026-05-03 기준 auth UI는 `useAuthClient()` boundary를 통해 mock session을 사용하며, 로그인 pending/error 상태가 회귀 테스트에 추가되었다.
- 2026-05-03 기준 Supabase provider adapter가 `useAuthClient()` boundary 뒤에 추가되었다. env 미설정 또는 `NEXT_PUBLIC_AUTH_MODE=mock`에서는 mock/local demo fallback을 유지한다.
- 2026-05-03 기준 접수/예약 Product MVP 보강 첫 단위로 현장 접수 form 입력값이 session-only encounter/queue 생성에 반영되며, 담당의 미지정 현장 접수도 진료대기 상태로 사이드 패널과 day calendar에서 확인된다.
- 2026-05-04 기준 접수/예약 운영 UI가 조제/처치 side panel 기준에 맞춰 보강되었고, 신규 동물/보호자 등록 dialog는 같은 작은 shadcn 기반 modal 구조로 정리되었다.
- membership/permission enforcement 범위 계획은 완료되었지만 실제 API route, DB client, migration, live Supabase project validation, 서버 권한 enforcement code는 아직 연결하지 않았다.
- MVP 전환 첫 단계로 `/login` 진입과 app shell auth guard를 제품형 mock auth 흐름으로 통합했고, Supabase 연결 전 auth boundary를 추가했다.
- Auth 후속 작업은 `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`를 기준으로 진행한다.

## Sales Demo 진행 현황

Sales Demo Prototype 작업은 spine-first 방식으로 진행되었고, Wave 2까지 `main`에 통합되어 있다.

| Area | Status | Result |
|---|---|---|
| Sales Demo Strategy | 완료 | 데모 목표, 대상, 7분 대표 외래 시나리오, 제외 범위 정리 |
| Sales Demo Spine | 완료 | `kong-vomit` scenario registry, 김하늘/콩이 seed data, home launcher, query-based continuity 추가 |
| Wave 2 Reception/Patient | 완료 | 접수 화면과 환자/보호자 drawer에서 김하늘/콩이/구토 내원 맥락 우선 노출 |
| Wave 2 Chart/SOAP/Order | 완료 | 콩이 SOAP, Assessment, order 흐름을 데모 설명 기준으로 강화 |
| Wave 2 Lab/Imaging | 완료 | 콩이 CBC 결과와 복부 영상 판독/종합소견 흐름 강화 |
| Wave 2 Billing | 완료 | 콩이 invoice, 금액, 수납 완료 상태를 sales demo 관점으로 polish |
| Wave 2 Integration | 완료 | shell query 보존, nav rail demo context propagation, golden path Playwright coverage 추가 |

통합 PR:

- [GitHub PR #6](https://github.com/mcso0/emr-app-shell-prototype/pull/6): `feat: add sales demo spine`
- [GitHub PR #7](https://github.com/mcso0/emr-app-shell-prototype/pull/7): `Integrate Wave 2 demo flow`

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
- `김하늘 / 콩이 / 구토 내원` sales demo golden path
- `/w/clair-demo/home` demo launcher와 역할/모듈 quick start
- 주요 화면의 demo query context preservation
- 연결형 EMR mock domain, status label mapper, Playwright 회귀 테스트
- Service catalog, role seed, permission seed foundation
- Audit log event model foundation
- API boundary selectors foundation
- `/login` mock role/session foundation

현재 `main`에는 PR 1-6 구현, A/B/C/D foundation, Sales Demo Spine, Wave 2 demo flow integration이 병합되어 있다. 대표 PR 1-6 병합 PR은 [GitHub PR #2](https://github.com/mcso0/emr-app-shell-prototype/pull/2)이고, 최신 Sales Demo integration PR은 [GitHub PR #7](https://github.com/mcso0/emr-app-shell-prototype/pull/7)이다.

## 목적과 목표

이 MVP의 목적은 동물병원 외래 진료 운영 흐름을 하나의 encounter 중심 프로토타입으로 검증하는 것이다.

MVP 목표:

- 접수/check-in 시 encounter가 만들어지고 이후 업무가 같은 환자/보호자/encounter 맥락을 공유한다.
- 수의사는 차트 화면에서 과거 이력, SOAP, Assessment, Order를 확인할 수 있다.
- 검사/영상/조제/수납은 독립 화면처럼 보이지만 같은 mock 도메인 데이터를 기반으로 연결된다.
- 비개발자도 주요 화면을 열어 업무 흐름과 정보 배치를 검토할 수 있다.

아직 목표가 아닌 것:

- 실제 backend, DB, auth provider, 파일 저장, 외부 연동 완성
- 서버 권한 enforcement 또는 역할별 데이터 제한
- service catalog/role/permission 설정 화면
- 실제 KakaoTalk, Excel, PACS, 장비 수신, 결제 연동
- 병원관리 전체 화면과 입원 화면
- Figma 기준의 정밀 UI QA 완료

## 현재 결과물

구현된 화면:

| 메뉴 | 상태 | 주요 내용 |
|---|---|---|
| 접수/예약 | 구현됨 | 캘린더, 접수/예약 목록, 상세 드로어, check-in, 현장 접수 form 입력값 반영과 진료대기 표시 |
| 환자/보호자 | 구현됨 | 환자/보호자 read/edit 드로어, 관계 관리, CS 이력, 최신내역, 신규 환자 등록 |
| 진료(차트) | 구현됨 | 진료 대기열, 과거 진료 이력, SOAP, Assessment, Assessment History, Order |
| 임상병리/계통 검사 | 구현됨 | 검사 대기열, 결과 입력, 장비 수신 내역, 첨부자료 |
| 영상검사 | 구현됨 | 영상 대기열, 판독 내용, 종합소견, 첨부자료 |
| 조제/처치 | 기존 구현 보존 | 기존 화면 디자인과 동작을 유지 |
| 수납 | 구현됨 | 대기/미납/종료 목록, 보호자 청구 묶음, 청구 항목 편집, 합산/해제, 결제 수단, 수납 액션 |
| 로그인/auth provider | adapter 추가 | `/login` 역할 선택, sessionStorage/localStorage mock session, auth client boundary, login pending/error UI, logout utility, shell 역할 표시, permission helper, Supabase provider adapter와 env 기반 fallback |

주요 구현 파일은 기능별 `src/features/*`에 있다. 새 작업자는 개별 파일을 보기 전에 이 문서와 관련 implementation 문서를 먼저 확인한다.

비화면/기반 작업:

| 영역 | 상태 | 주요 내용 |
|---|---|---|
| API boundary selectors | 초안 추가 | mock domain을 나중에 API/DB로 교체하기 위한 read repository interface, selector/helper, mock adapter, contract test, 후속 통합 가이드 추가 |
| Service catalog seed | foundation 추가 | 진료, 처방/조제, 처치, 검사, 영상, 수납 invoice line에서 공통 참조할 mock category/item/price seed |
| Role/permission seed | foundation 추가 | `front_desk`, `vet`, `nurse`, `billing_admin`, `hospital_admin` 추천 역할과 권한 seed |
| Catalog lookup helper | foundation 추가 | service item/category/current price/role permission lookup, order/invoice consistency report |
| Audit log foundation | foundation 추가 | status transition, profile edit, SOAP save, order status change, billing action seed와 deterministic append/build helper |
| Auth provider foundation | adapter 추가 | `/login` 역할 선택, sessionStorage/localStorage mock session, `useAuthClient()` boundary, Supabase SSR/browser/server/proxy helper, logout utility, shell 역할 표시, permission helper |

이 foundation들은 아직 feature module에 통합되지 않았다. 실제 API route, DB client, migration, auth/audit/service catalog 연동, 실제 권한 enforcement도 포함하지 않는다.

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

2026-05-02 기준 foundation 통합 후 아래 추가 검증이 통과했다.

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/api-boundary.spec.ts tests/service-catalog.spec.ts tests/audit-log.spec.ts tests/auth.spec.ts --reporter=line`
- `npx playwright test tests/billing.spec.ts tests/lab-imaging.spec.ts tests/chart.spec.ts tests/reception.spec.ts tests/domain-baseline.spec.ts tests/app-shell.spec.ts --reporter=line`

2026-05-02 기준 Sales Demo Wave 2 통합 후 최신 `main`에서 아래 검증이 통과했다.

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test --reporter=line` (`69 passed`)

2026-05-03 기준 MVP Auth transition sequence 후 아래 검증이 통과했다.

- `npm run lint`
- `rg "mvp-auth-transition-roadmap" docs/implementation`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/auth.spec.ts --reporter=line` (`9 passed`)
- `npx playwright test tests/app-shell.spec.ts tests/reception.spec.ts tests/billing.spec.ts tests/chart.spec.ts tests/lab-imaging.spec.ts tests/sales-demo-flow.spec.ts --reporter=line` (`44 passed`)

화면 작업 시 기본적으로 관련 Playwright test를 추가하거나 갱신한다. 조제/처치 관련 파일을 건드리면 `tests/app-shell.spec.ts`의 조제 회귀를 반드시 다시 확인한다.

## 작업 시 주의사항

- 작업 시작 전 이 문서를 먼저 읽는다.
- Next.js application code를 쓰기 전에는 `node_modules/next/dist/docs/`의 관련 문서를 확인한다.
- 조제/처치 화면의 현재 디자인과 동작은 명시 요청 없이는 수정하지 않는다.
- 입원과 병원관리 전체 화면은 현재 PR 1-6 범위 밖이었다.
- 병원관리의 Order 관리 / Order 세트 화면은 참고 자료일 뿐 구현 대상이 아니었다.
- 로그인은 기본 local demo 환경에서 mock session 기반으로 app shell 진입을 보호하고, Supabase env/auth mode가 준비되면 provider session adapter를 사용할 수 있다. 아직 DB/API session과 서버 권한 enforcement는 연결하지 않았다.
- Supabase provider adapter는 추가되었지만 env 미설정 기본값은 mock/local demo fallback이다. live project 검증과 서버 권한 enforcement는 완료된 것으로 보지 않는다.
- Membership/permission enforcement는 plan-only로 완료되었다. migration/RLS/server resolver 구현은 별도 승인 전까지 하지 않는다.
- UI는 Figma나 screenshot을 1:1 복제하지 않고, 프로젝트 foundation, token, 기존 컴포넌트를 우선 사용한다.
- 공통 컴포넌트 추출은 반복 패턴이 안정된 뒤 진행한다. PR7 화면 정렬 전에는 무리하게 공통화하지 않는다.
- prototype 상태는 session-only이다. 새로고침 후 유지되는 persistence를 전제로 만들지 않는다.
- 작업 완료 시에는 이 문서 또는 해당 작업의 기준 문서를 갱신하고, 완료 보고서는 `docs/completed/<workstream>/` 아래에 보관한다.

## Reference Images 상태

현재 `docs/design/assets/reference-screens/*`에는 메뉴별 폴더와 README가 있고, 접수/예약 drawer PNG 캡처 1개가 존재한다. `docs/design/reference-screen-index.md`에는 파일 존재 여부와 용도가 정리되어 있다.

Figma 화면 예시를 기준으로 UI를 정렬하려면 먼저 PR7에서 실제 캡처 파일을 저장해야 한다.

권장 저장 흐름:

1. Figma에서 기능별 화면을 export 또는 screenshot으로 캡처한다.
2. `docs/design/assets/reference-screens/<area>/...png`에 저장한다.
3. `docs/design/reference-screen-index.md`의 파일 존재 여부와 notes를 갱신한다.
4. 구현 화면과 reference image를 비교해 정보 우선순위, 밀도, 간격, 상태 표현을 조정한다.

## 다음 추천 작업

다음 작업은 **permission resolver 또는 migration/RLS 구현 단위 승인**을 추천한다. 기준 문서는 `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`, `docs/engineering/auth-security/auth-login/supabase-auth-mapping.md`, `docs/engineering/auth-security/auth-login/supabase-integration-readiness.md`, `docs/engineering/auth-security/auth-login/membership-permission-enforcement.md`이다.

목표:

- permission resolver, membership/profile migration, RLS policies, app route/server action enforcement 중 하나를 독립적으로 승인한다.
- live Supabase project 또는 local Supabase verification 방식을 먼저 정한다.
- client UI gating만으로 권한 구현 완료처럼 처리하지 않는다.

구현을 시작하기 전에는 auth foundation 파일, `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`, `docs/engineering/auth-security/auth-login/README.md`, `docs/engineering/auth-security/auth-login/supabase-auth-mapping.md`, `docs/engineering/auth-security/auth-login/supabase-integration-readiness.md`, `docs/engineering/data-model/emr-saas-db-structure-spec.ko.md`, Supabase 공식 문서를 함께 확인한다.

## 관련 문서

- 문서 시작점: `docs/agent-start-here.md`
- 엔지니어링 문서 목차: `docs/engineering/README.md`
- MVP Auth 제품화 전환 기준: `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`
- 로그인 구현 작업 패키지: `docs/engineering/auth-security/auth-login/README.md`
- 데모 세일즈 전략: `docs/archive/sales-demo/demo-sales-strategy.md`
- Sales Demo Wave 2 closeout: `docs/archive/sales-demo/sales-demo-wave2-closeout.md`
- 병렬 작업 계획: `docs/archive/implementation-waves/mvp-parallel-workstreams.md`
- PR 1-6 구현 기록: `docs/archive/implementation-waves/pr1-pr6-realigned-plan.md`
- 갭 분석: `docs/engineering/testing/mvp-gap-analysis.md`
- 백로그: `docs/work/legacy-mvp-implementation-backlog.md`
- 확인 필요 항목: `docs/work/open-questions.md`
- 레퍼런스 화면 인덱스: `docs/design/reference-screen-index.md`
- 공통화 후보: `docs/archive/ui-notes/reusable-component-candidates.md`
- API boundary selector 설계: `docs/engineering/api-boundaries/api-boundary-selectors.md`
- API boundary 후속 통합 가이드: `docs/engineering/api-boundaries/api-boundary-integration-guide.md`
- App shell layout contract: `docs/engineering/architecture/app-shell-layout-contract.md`
