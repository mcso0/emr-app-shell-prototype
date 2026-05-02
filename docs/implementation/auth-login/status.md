# Auth Login Status

Updated: 2026-05-03

## 목표

mock auth 기반 `/login`과 app guard를 실제 Supabase Auth 구조로 전환 가능한 제품 로그인 기반으로 끌어올린다.

## 목적

- 사용자가 로그인한 뒤 워크스페이스에 진입하는 제품 흐름을 만든다.
- Supabase Auth session과 앱 도메인 membership/permission source를 분리해 설계한다.
- 현재 mock auth 흐름을 Supabase 전환 중에도 회귀 없이 유지한다.

## 완성 기준

- `/login`, safe `next`, 기본 reception 진입, session hydrate, app guard, top menu role, logout flow가 실제 provider session 기준으로 동작한다.
- 사용자/병원/워크스페이스 membership과 permission source가 앱 도메인 모델로 정의된다.
- 권한 판단은 사용자 수정 가능 metadata가 아니라 서버/DB 통제 source를 기준으로 한다.
- Supabase Auth가 담당해야 할 password, OAuth, email verification, MFA, refresh token 기능을 직접 구현하지 않는다.
- 각 단계 완료 시 기준 문서와 `docs/completed/auth/` closeout이 갱신된다.

## 현상태

- mock auth shell은 완료되어 있다.
- `/login`은 제품형 폼과 `MVP 테스트 옵션` 패널로 분리되어 있다.
- `useAuthClient()` boundary가 추가되어 auth UI가 mock store를 직접 import하지 않는다.
- login pending/disabled 상태와 provider error 영역이 있다.
- Supabase package, env, project API, callback route, DB migration, RLS, server permission enforcement는 아직 연결하지 않았다.

## 완료된 작업

- `docs/completed/auth/2026-05-03-auth-roadmap-baseline.md`
- `docs/completed/auth/2026-05-03-auth-boundary.md`
- `docs/completed/auth/2026-05-03-login-ux-state.md`
- GitHub PR #10: `feat: add auth transition boundary`

## 다음 작업

1. `work-orders/01-supabase-auth-mapping.md`
2. `work-orders/02-supabase-integration-readiness.md`
3. `work-orders/03-supabase-provider-implementation.md`
4. `work-orders/04-membership-permission-enforcement.md`

## 금지 범위

- Supabase 실제 연결 전 package 설치, env 연결, API 호출을 하지 않는다.
- DB migration, RLS policy, server permission enforcement를 앞당겨 구현하지 않는다.
- password 검증, OAuth callback, MFA, refresh token, email verification을 직접 구현하지 않는다.
- auth 작업 명목으로 조제/처치, 접수, 차트, 검사/영상, 수납 업무 화면을 수정하지 않는다.

## 최근 검증

2026-05-03 MVP Auth transition sequence:

- `npm run lint`
- `rg "mvp-auth-transition-roadmap" docs/implementation`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/auth.spec.ts --reporter=line` (`9 passed`)
- `npx playwright test tests/app-shell.spec.ts tests/reception.spec.ts tests/billing.spec.ts tests/chart.spec.ts tests/lab-imaging.spec.ts tests/sales-demo-flow.spec.ts --reporter=line` (`44 passed`)
