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
- Supabase Auth mapping은 `docs/engineering/auth-security/auth-login/supabase-auth-mapping.md`에 문서화되어 있다.
- Supabase integration readiness는 `docs/engineering/auth-security/auth-login/supabase-integration-readiness.md`에 문서화되어 있다.
- `users.id`는 로그인 가능한 앱 사용자에 대해 `auth.users.id`와 같은 UUID를 사용한다.
- `user_memberships`와 `permission_policies`가 workspace membership과 권한 source이며, session source와 permission source는 분리한다.
- Work Order 03의 package 설치 대상은 `@supabase/supabase-js`와 `@supabase/ssr`로 승인되어 있다.
- Supabase env naming은 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_AUTH_MODE`로 결정되어 있다.
- Supabase provider adapter가 `useAuthClient()` boundary 뒤에 구현되어 있다.
- `NEXT_PUBLIC_AUTH_MODE=auto` 기본값은 Supabase env가 있으면 provider를 쓰고, env가 없으면 mock/local demo fallback을 유지한다.
- Membership/permission enforcement plan은 `docs/engineering/auth-security/auth-login/membership-permission-enforcement.md`에 문서화되어 있다.
- Supabase project API live validation, callback route, DB migration, RLS, server permission enforcement code는 아직 연결하지 않았다.

## 완료된 작업

- `docs/completed/auth/2026-05-03-auth-roadmap-baseline.md`
- `docs/completed/auth/2026-05-03-auth-boundary.md`
- `docs/completed/auth/2026-05-03-login-ux-state.md`
- `docs/completed/auth/2026-05-03-supabase-auth-mapping.md`
- `docs/completed/auth/2026-05-03-supabase-integration-readiness.md`
- `docs/completed/auth/2026-05-03-supabase-provider-implementation.md`
- `docs/completed/auth/2026-05-03-membership-permission-enforcement.md`
- GitHub PR #10: `feat: add auth transition boundary`

## 다음 작업

1. 별도 승인 후 permission resolver, migration/RLS, API/server action enforcement 중 하나를 독립 work order로 진행한다.

## 금지 범위

- Supabase 실제 연결 전 package 설치, env 연결, API 호출을 하지 않는다.
- DB migration, RLS policy, server permission enforcement를 앞당겨 구현하지 않는다.
- password 검증, OAuth callback, MFA, refresh token, email verification을 직접 구현하지 않는다.
- auth 작업 명목으로 관련 없는 업무 화면을 수정하지 않는다.

## 최근 검증

2026-05-03 MVP Auth transition sequence:

- `npm run lint`
- `rg "mvp-auth-transition-roadmap" docs/implementation`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/auth.spec.ts --reporter=line` (`9 passed`)
- `npx playwright test tests/app-shell.spec.ts tests/reception.spec.ts tests/billing.spec.ts tests/chart.spec.ts tests/lab-imaging.spec.ts tests/sales-demo-flow.spec.ts --reporter=line` (`44 passed`)

2026-05-03 Work Order 01 Supabase Auth Mapping:

- `npm run lint`
- `rg "Supabase Auth|user_memberships|permission_policies" docs/implementation`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-03-supabase-auth-mapping.md`에 남긴다.

2026-05-03 Work Order 02 Supabase Integration Readiness:

- `npm run lint`
- `rg "supabase-integration-readiness|@supabase/ssr|callback route|cookie session" docs/implementation`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-03-supabase-integration-readiness.md`에 남긴다.

2026-05-03 Work Order 03 Supabase Provider Implementation:

- Red: `npx playwright test tests/auth.spec.ts --reporter=line` failed on missing `src/lib/supabase/config.ts`
- Red: `npx playwright test tests/auth.spec.ts:168 --reporter=line` failed on missing `NEXT_PUBLIC_AUTH_MODE=mock` Playwright pin
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/auth.spec.ts --reporter=line` (`11 passed`)
- `npx playwright test tests/app-shell.spec.ts tests/reception.spec.ts tests/billing.spec.ts tests/chart.spec.ts tests/lab-imaging.spec.ts tests/sales-demo-flow.spec.ts --reporter=line` (`44 passed`)

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-03-supabase-provider-implementation.md`에 남긴다.

2026-05-03 Work Order 04 Membership Permission Enforcement:

- `npm run lint`
- `rg "membership|permission|RLS|server-side enforcement" docs/implementation`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-03-membership-permission-enforcement.md`에 남긴다.
