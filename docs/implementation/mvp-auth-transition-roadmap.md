# MVP Auth Transition Roadmap

Updated: 2026-05-03

이 문서는 이 채팅과 후속 채팅에서 MVP auth 작업을 이어가기 위한 기준 문서다. 새 auth 작업을 시작할 때는 `docs/implementation/mvp-current-status.md`를 먼저 읽고, 바로 이어서 이 문서를 읽는다.

## 현재 기준

현재 제품 MVP auth는 실제 Supabase Auth 연결 전 단계다.

- `/`는 `/login`으로 시작한다.
- `/login`은 실제 제품 로그인처럼 보이는 폼과 `MVP 테스트 옵션` 패널로 분리되어 있다.
- `/w/:workspaceId/:module`은 mock session 없이는 `/login?next=<원래 URL>`로 이동한다.
- 로그인 성공 후 안전한 내부 `next` URL로 복귀하고, `next`가 없으면 `/w/clair-demo/reception?modulePanel=open&aside=closed`로 진입한다.
- mock session은 `sessionStorage` 또는 `localStorage`에 저장된다.
- auth UI는 `src/features/auth/auth-client.ts`의 `useAuthClient()` 경계를 통해 mock session을 사용한다.
- 로그인 submit은 async pending/disabled 상태와 provider error 표시 영역을 가진다.
- Supabase 미연결 상태의 error UI 회귀는 development/test 전용 `mockProviderError=1` query mode로만 확인한다. production에서는 이 query mode가 provider error를 강제하지 않는다.
- top menu는 현재 mock role을 표시하고 logout은 mock session을 지운 뒤 `/login`으로 이동한다.
- 실제 API route, DB client, migration, Supabase env, OAuth callback, refresh token, MFA, server-side permission enforcement는 아직 연결하지 않았다.

## 2026-05-03 진행 기록

완료된 auth 전환 sequence:

- 현재 상태 고정: roadmap/current status/implementation README 연결을 확인하고 closeout 규칙을 auth 작업 기준으로 재확인했다.
- Auth Boundary 정리: `useAuthClient()`를 추가하고 login form, app guard, top menu가 `useMockAuthStore`를 직접 import하지 않게 했다.
- 로그인 UX 상태 추가: submit 중 `로그인 중` disabled 상태와 form 내부 `role="alert"` provider error 영역을 추가했다.
- Supabase Auth 매핑 설계: `auth.users.id`와 앱 `users.id`를 같은 UUID로 고정하고, `user_memberships`와 `permission_policies`를 membership/permission source로 분리했다.

완료 문서:

- `docs/completed/auth/2026-05-03-auth-roadmap-baseline.md`
- `docs/completed/auth/2026-05-03-auth-boundary.md`
- `docs/completed/auth/2026-05-03-login-ux-state.md`
- `docs/completed/auth/2026-05-03-supabase-auth-mapping.md`

다음 추천 단계:

- Supabase 실제 연결 전 `### 5. Supabase 실제 연동 준비`를 문서로 먼저 진행한다.
- 로그인 구현 작업 패키지는 `docs/implementation/auth-login/README.md`를 시작점으로 사용한다.
- 실제 Supabase package/env/API 연결, callback route, DB migration, RLS, server-side permission enforcement는 계속 금지 범위로 유지한다.

## 최종 목표와 결과물

최종 목표는 mock auth 기반 `/login`과 app guard를 실제 Supabase Auth 구조로 전환 가능한 제품 auth 기반으로 끌어올리는 것이다.

단기 결과물:

- Supabase 실제 연결 전 auth boundary와 session interface를 명확히 한다.
- 로그인 UX 상태를 실제 제품 흐름에 맞게 정리한다.
- `auth.users`와 앱 도메인 `users`, `user_memberships`, `permission_policies` 매핑 계획을 문서화한다.
- 현재 mock auth 회귀 테스트를 유지해 Supabase 전환 중에도 `/login`, `next`, logout, role display 동작을 잃지 않게 한다.

장기 결과물:

- Supabase Auth session과 앱 domain membership/permission이 일관된 제품 흐름으로 동작한다.
- app shell guard, role display, logout flow가 mock session 대신 provider session을 사용할 수 있다.
- 권한 판단은 사용자 수정 가능 metadata가 아니라 서버/DB에서 통제하는 membership/permission source를 기준으로 한다.

## 단계별 진행 과정

### 1. 현재 상태 고정

목표:

- 현재 `/login` UI, mock session, auth guard, logout, role display 동작을 유지할 회귀 기준으로 고정한다.

작업:

- `tests/auth.spec.ts`를 기준 테스트로 유지한다.
- `playwright.config.ts`의 기본 storageState mock login session을 기존 workspace 회귀 테스트의 인증 상태 기준으로 유지한다.
- 문서나 테스트를 갱신할 때 현재 보장 동작과 변경 예정 동작을 분리해서 적는다.

사용 스킬:

- `superpowers:writing-plans`: 기준 문서와 후속 구현 계획을 정리할 때 사용한다.
- `build-web-apps:react-best-practices`: 현재 client component, Suspense, UI state boundary를 확인할 때 사용한다.
- `superpowers:verification-before-completion`: 문서 갱신 뒤 링크와 검증 명령 결과를 확인할 때 사용한다.

완료 기준:

- `tests/auth.spec.ts`가 현재 auth 흐름을 설명한다.
- 이 문서와 `mvp-current-status.md`가 다음 auth 작업의 시작점을 가리킨다.

### 2. Auth Boundary 정리

목표:

- UI가 `useMockAuthStore`에 직접 강하게 묶이는 상태를 줄이고, 나중에 Supabase session으로 교체 가능한 auth adapter 경계를 만든다.

작업:

- session shape, hydrate, login, logout, role display를 추상 경계로 분리한다.
- mock 구현은 유지하되, UI와 guard가 mock 저장소 세부사항을 직접 알지 않게 한다.
- 현재 경계는 `src/features/auth/auth-client.ts`의 `AuthSession`과 `useAuthClient()`이다.
- 이 단계에서는 Supabase package, env, callback route, server middleware를 추가하지 않는다.

사용 스킬:

- `build-web-apps:react-best-practices`: client state 구독과 component boundary를 정리할 때 사용한다.
- `superpowers:test-driven-development`: adapter boundary 변경 전 auth 회귀 테스트를 먼저 갱신한다.
- `security-best-practices`: session, storage, permission boundary가 민감 정보나 권한 결정을 잘못 다루지 않는지 점검한다.

완료 기준:

- `/login`, `next`, guard redirect, logout, top menu role 테스트가 기존처럼 통과한다.
- Supabase 연결 없이도 mock auth가 동일하게 동작한다.

### 3. Supabase Auth 매핑 설계

목표:

- Supabase Auth와 앱 도메인 사용자/멤버십/권한 모델의 연결 방식을 구현 전에 문서로 고정한다.

결정 문서:

- `docs/implementation/auth-login/supabase-auth-mapping.md`

작업:

- `auth.users.id`와 앱 도메인 `users`의 식별자 관계를 정한다.
- 사용자가 여러 병원/워크스페이스에 속할 수 있는 `user_memberships` 모델을 정의한다.
- 역할/권한은 `permission_policies` 또는 role permission source에서 관리하도록 계획한다.
- RLS, server-side enforcement, migration은 이 단계에서 설계만 하고 구현하지 않는다.
- `users.id`는 로그인 가능한 앱 사용자에 대해 `auth.users.id`와 같은 UUID를 사용한다.
- Supabase Auth는 session/identity source이고, 앱 `users`, `user_memberships`, `permission_policies`는 domain profile, membership, permission source다.
- 사용자 수정 가능 metadata는 권한 판단 source로 쓰지 않는다.

사용 스킬:

- `supabase:supabase`: Auth, SSR, session, callback 흐름을 현재 Supabase 공식 문서 기준으로 확인한다.
- `supabase:supabase-postgres-best-practices`: schema, index, RLS 설계 전에 사용한다.
- `security-best-practices`: 사용자 수정 가능 metadata를 권한 결정에 쓰지 않는지 점검한다.

완료 기준:

- 실제 DB 변경 없이도 후속 migration 계획을 작성할 수 있을 만큼 매핑 문서가 명확하다.
- 권한 source와 session source가 분리되어 있다.

상태:

- 2026-05-03 완료. 실제 Supabase package/env/API 연결, DB migration, RLS policy, auth code 변경은 하지 않았다.

### 4. 실제 로그인 UX 상태 추가

목표:

- 현재 로그인 폼을 실제 provider 연결 전에도 제품 로그인처럼 보이고 테스트 가능한 상태로 만든다.

작업:

- login submit 중 loading/disabled 상태를 추가한다.
- provider error를 표시할 위치와 문구를 정한다.
- email/password 필드는 Supabase 연결 전까지 최소 UI 상태만 둔다.
- provider error 회귀 확인은 development/test 전용 `mockProviderError=1` query mode로만 수행한다.
- mock role/storage 선택은 `MVP 테스트 옵션` 패널에 남기고 실제 로그인 폼과 섞지 않는다.

사용 스킬:

- `build-web-apps:react-best-practices`: form state와 client rendering을 점검한다.
- `superpowers:test-driven-development`: loading/error selector를 먼저 테스트로 고정한다.
- `playwright`: desktop/mobile/narrow viewport에서 텍스트 넘침과 flow를 확인한다.
- `browser-use:browser`: 인앱 브라우저에서 사용자가 보는 localhost 화면을 확인한다.

완료 기준:

- 실제 auth 연결 없이도 로그인 폼의 pending/error 상태가 회귀 테스트로 확인된다.
- 테스트 옵션 패널과 로그인 폼이 시각적으로 분리되어 있다.

### 5. Supabase 실제 연동 준비

목표:

- 실제 Supabase 연결 전에 설치, env, callback, SSR session, middleware/server guard 적용 범위를 별도 계획으로 분리한다.

작업:

- `@supabase/ssr` 설치 여부와 시점을 별도 계획에서 결정한다.
- Supabase project URL/key env naming을 계획한다.
- callback route, cookie session refresh, server/client helpers, middleware 적용 범위를 정한다.
- mock auth fallback 또는 local demo mode 유지 여부를 결정한다.

사용 스킬:

- `supabase:supabase`: 최신 Auth/SSR 가이드를 확인한다.
- `supabase:supabase-postgres-best-practices`: RLS와 membership schema 계획을 확인한다.
- `security-best-practices`: service role key, public env, JWT claim 사용을 점검한다.
- `superpowers:writing-plans`: 실제 연결 작업을 별도 구현 계획으로 작성한다.

완료 기준:

- 실제 연결 작업자가 Supabase 프로젝트/env/API 연결 전에 필요한 결정을 모두 알 수 있다.
- 민감 기능을 직접 구현하지 않고 Supabase Auth에 위임할 범위가 분리되어 있다.

## 스킬 사용 규칙

전체 규칙:

- 단계 시작 전에 관련 `SKILL.md`를 먼저 읽는다.
- 사용한 스킬, 사용 이유, 검증 결과를 작업 요약 또는 관련 문서 갱신에 남긴다.
- Supabase, Next.js, auth/security처럼 변경 가능성이 높은 영역은 기억에 의존하지 않는다.
- Supabase 작업은 MCP `search_docs` 또는 공식 문서를 우선한다.
- Next.js app code 변경 전에는 `node_modules/next/dist/docs/`의 관련 문서를 확인한다.

단계별 기본 스킬:

| 단계 | 필수/추천 스킬 | 사용 목적 |
|---|---|---|
| 문서/계획 | `superpowers:writing-plans` | 목표, 금지 범위, 단계, 검증 기준 고정 |
| React/Next 구현 | `build-web-apps:react-best-practices` | client boundary, rendering, form state 점검 |
| 보안 검토 | `security-best-practices` | auth/session/permission 보안 금지 범위 점검 |
| Supabase 설계 | `supabase:supabase` | Auth/SSR/session/callback 최신 기준 확인 |
| Postgres/RLS 설계 | `supabase:supabase-postgres-best-practices` | schema/RLS/index 설계 기준 확인 |
| 구현 | `superpowers:test-driven-development` | 실패 테스트를 먼저 만들고 구현 |
| 계획 실행 | `superpowers:executing-plans` | 이 문서의 단계별 체크리스트 실행 |
| 병렬/분리 작업 | `superpowers:subagent-driven-development` | 문서화, boundary, Supabase 설계를 분리 수행 |
| 회귀 검증 | `playwright` | auth flow와 viewport 회귀 확인 |
| 실제 화면 확인 | `browser-use:browser` | 인앱 브라우저 localhost 확인 |
| 완료 전 | `superpowers:verification-before-completion` | lint/type/build/test 증거 확인 |

## 하지 말아야 할 것

이번 roadmap 문서화 작업에서 하지 않는다:

- 코드 리팩터링
- Supabase package 설치
- Supabase 프로젝트/env/API 연결
- DB migration 또는 RLS policy 작성
- OAuth callback, MFA, refresh token, 이메일 인증 직접 구현

후속 auth 작업에서도 명시 계획 없이 하지 않는다:

- `service_role` 또는 secret key를 client에 노출
- 사용자 수정 가능 metadata를 권한 결정에 사용
- 서버 권한 enforcement를 구현한 척하고 client UI gating만 추가
- 실제 password 저장/검증 직접 구현
- auth 작업 범위를 핑계로 업무 화면 UI를 수정

## 건드리지 말아야 할 파일과 영역

명시 요청 또는 별도 계획 없이는 아래 영역을 수정하지 않는다.

- 조제/처치 화면: `src/features/dispensing/**`
- 접수/예약 업무 화면: `src/features/reception/**`
- 진료 차트 업무 화면: `src/features/chart/**`
- 검사/영상 업무 화면: `src/features/lab-imaging/**`
- 수납 업무 화면: `src/features/billing/**`
- sales demo flow fixture와 기존 golden path는 auth 회귀 보정 목적 외에는 바꾸지 않는다.
- `tests/app-shell.spec.ts`, `tests/reception.spec.ts`, `tests/billing.spec.ts`, `tests/chart.spec.ts`, `tests/lab-imaging.spec.ts`, `tests/sales-demo-flow.spec.ts`는 인증 상태 보정이 필요한 경우에만 수정한다.

Auth 작업에서 주로 다룰 수 있는 영역:

- `src/features/auth/**`
- `src/app/login/page.tsx`
- `src/app/page.tsx`
- `src/app/w/[workspaceId]/[module]/page.tsx`
- `src/shell/top-menu.tsx`
- `tests/auth.spec.ts`
- `playwright.config.ts`

## 테스트와 검증

문서화 단계:

```bash
npm run lint
rg "mvp-auth-transition-roadmap" docs/implementation
```

Auth 관련 코드 작업 단계:

```bash
npm run lint
npx tsc --noEmit
npm run build
npx playwright test tests/auth.spec.ts --reporter=line
```

기존 workspace 회귀가 영향을 받는 경우:

```bash
npx playwright test tests/app-shell.spec.ts tests/reception.spec.ts tests/billing.spec.ts tests/chart.spec.ts tests/lab-imaging.spec.ts tests/sales-demo-flow.spec.ts --reporter=line
```

수동 확인:

- `/login` 직접 열기
- `/w/clair-demo/reception?modulePanel=open` 비로그인 접근 후 `/login?next=...` 확인
- 로그인 후 원래 URL 복귀 확인
- logout 후 `/login` 이동 확인
- 390px 전후 narrow viewport에서 로그인 폼과 테스트 옵션 패널이 겹치지 않는지 확인

## 참고 문서

항상 먼저 읽기:

- `docs/implementation/mvp-current-status.md`
- 이 문서

작업 성격에 따라 함께 읽기:

- `docs/implementation/mvp-implementation-backlog.md`
- `docs/implementation/mvp-gap-analysis.md`
- `docs/emr-saas-db-structure-spec.ko.md`
- `docs/implementation/api-boundary-selectors.md`
- `docs/implementation/api-boundary-integration-guide.md`
- Next.js 관련 작업 전 `node_modules/next/dist/docs/`

## 진행 상태 기록 규칙

각 auth 단계가 끝나면 이 문서 또는 관련 구현 문서에 아래 항목을 갱신한다.

- 완료 날짜
- 사용한 스킬
- 변경한 주요 파일
- 통과한 검증 명령
- 다음 단계에서 유지해야 할 금지 범위

작업 완료 시에는 진행 상황을 반드시 `docs/` 안의 알맞은 기준 문서에 반영한다.

- Product MVP 전체 상태가 바뀌면 `docs/implementation/mvp-current-status.md`를 갱신한다.
- Auth 후속 작업의 기준, 단계, 금지 범위, 검증 기준이 바뀌면 이 문서를 갱신한다.
- 백로그 우선순위나 Epic 범위가 바뀌면 `docs/implementation/mvp-implementation-backlog.md` 또는 관련 gap 문서를 갱신한다.

완료된 작업의 closeout 문서는 진행 중 기준 문서와 분리해서 `docs/completed/` 아래에 보관한다.

- 작업별 하위 폴더를 만든다. Auth 작업은 `docs/completed/auth/`를 사용한다.
- 파일명은 `YYYY-MM-DD-<work-slug>.md` 형식을 사용한다.
- 완료 문서에는 완료 날짜, 최종 결과물, 변경 파일, 사용 스킬, 검증 명령, 남은 후속 작업을 남긴다.
- 진행 중 계획 문서는 `docs/implementation/`에 남기고, 완료된 결과 보고서만 `docs/completed/<workstream>/`에 둔다.
