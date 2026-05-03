# Supabase Provider Implementation Closeout

완료 날짜: 2026-05-03

## 최종 목표와 실제 결과물

- Work Order 02 readiness 기준에 따라 Supabase provider adapter를 `useAuthClient()` boundary 뒤에 연결했다.
- `@supabase/supabase-js`와 `@supabase/ssr`를 설치했다.
- `NEXT_PUBLIC_AUTH_MODE=mock|supabase|auto` 정책을 구현했다. 기본 `auto` mode는 Supabase public env가 있으면 provider를 쓰고, env가 없으면 mock/local demo fallback을 유지한다.
- Supabase browser helper, server helper, proxy helper, Next `src/proxy.ts`를 추가했다.
- Supabase mode에서는 email/password submit이 `supabase.auth.signInWithPassword()`를 호출한다.
- logout은 mock storage를 지우고, Supabase mode에서는 `supabase.auth.signOut({ scope: "local" })`도 호출한다.
- 기존 `/login`, safe `next`, app guard, top menu role, logout, mock permission helper 회귀를 유지했다.
- 실제 password 검증, OAuth callback, MFA, refresh token, email verification, DB migration/RLS policy, server-side permission enforcement는 구현하지 않았다.

## 변경한 주요 파일

- `package.json`
- `package-lock.json`
- `src/features/auth/auth-client.ts`
- `src/features/auth/login-form.tsx`
- `src/shell/top-menu.tsx`
- `src/lib/supabase/config.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/proxy.ts`
- `src/proxy.ts`
- `tests/auth.spec.ts`
- `playwright.config.ts`
- `docs/engineering/auth-security/auth-login/status.md`
- `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`
- `docs/engineering/current-status.md`
- `docs/engineering/auth-security/auth-login/completed-summary.md`
- `docs/completed/auth/2026-05-03-supabase-provider-implementation.md`

## 사용한 스킬과 문서

- `build-web-apps:react-best-practices`: client boundary와 React hook state를 `useAuthClient()` 안에 유지
- `supabase:supabase`: SSR client, browser/server helper, Proxy token refresh, password sign-in 기준 확인
- `security-best-practices`: `NEXT_PUBLIC_*` public boundary와 key 노출 금지 확인
- `superpowers:test-driven-development`: adapter boundary regression을 먼저 추가하고 실패를 확인한 뒤 구현
- `superpowers:verification-before-completion`: 완료 주장 전 lint/type/build/test 검증 수행

확인한 공식/로컬 문서:

- [Supabase SSR client](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase SSR advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Supabase Password-based Auth](https://supabase.com/docs/guides/auth/passwords)
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`
- `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`

## TDD 기록

- Red: `npx playwright test tests/auth.spec.ts --reporter=line` failed because `src/lib/supabase/config.ts` did not exist.
- Red: `npx playwright test tests/auth.spec.ts:168 --reporter=line` failed because `playwright.config.ts` did not pin `NEXT_PUBLIC_AUTH_MODE=mock`.
- Green: Supabase helper files and auth boundary implementation were added; `tests/auth.spec.ts` passed.

## 통과한 검증 명령

- `npx playwright test tests/auth.spec.ts --reporter=line` (`10 passed`)
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/auth.spec.ts --reporter=line` (`11 passed`)
- `npx playwright test tests/app-shell.spec.ts tests/reception.spec.ts tests/billing.spec.ts tests/chart.spec.ts tests/lab-imaging.spec.ts tests/sales-demo-flow.spec.ts --reporter=line` (`44 passed`)

## 참고

- `npm install` reported 2 moderate audit findings in the dependency tree. No `npm audit fix --force` was run because it may introduce breaking dependency changes outside this work order.

## 남은 후속 작업

- Work Order 04에서 membership/permission source와 server-side enforcement/RLS/migration 범위를 plan-only로 확정한다.
- 실제 Supabase project URL/key를 사용하는 live login 검증은 env가 제공되는 별도 단계에서 진행한다.
