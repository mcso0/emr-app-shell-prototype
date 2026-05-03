# Supabase Integration Readiness Closeout

완료 날짜: 2026-05-03

## 최종 목표와 실제 결과물

- 실제 Supabase provider 구현 전에 package, env, callback, SSR cookie session, helper, proxy/server guard, local demo fallback 결정을 문서로 고정했다.
- Work Order 03의 package 설치 대상은 `@supabase/supabase-js`와 `@supabase/ssr`로 승인했다.
- public env는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_AUTH_MODE`로 정했다.
- `NEXT_PUBLIC_AUTH_MODE=mock|supabase|auto` 정책을 정했고, 기본값은 `auto`로 둔다.
- email/password login은 callback route 없이 Supabase browser client에 위임하고, OAuth/magic link/OTP/password reset callback은 후속 별도 work order로 분리했다.
- server/proxy code는 `auth.getClaims()` 기반 validation을 우선하고, server code에서 `auth.getSession()`만 신뢰하지 않는 원칙을 남겼다.
- Work Order 02에서는 package 설치, Supabase project/env/API 연결, callback route 구현, DB migration/RLS policy, auth code 변경을 하지 않았다.

## 변경한 주요 파일

- `docs/engineering/auth-security/auth-login/supabase-integration-readiness.md`
- `docs/engineering/auth-security/auth-login/status.md`
- `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`
- `docs/engineering/auth-security/auth-login/completed-summary.md`
- `docs/completed/auth/2026-05-03-supabase-integration-readiness.md`

## 사용한 스킬과 문서

- `supabase:supabase`: SSR client, Auth users, RLS, password sign-in 흐름의 최신 공식 기준 확인
- `security-best-practices`: `NEXT_PUBLIC_*` public boundary, secret 노출 금지, user metadata 권한 source 금지 확인
- `superpowers:writing-plans`: 구현 전 decision record와 후속 Work Order 입력값 정리
- `superpowers:verification-before-completion`: 완료 전 검증 명령 실행 기준 확인

확인한 공식 문서:

- [Supabase SSR client](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase SSR advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Supabase Users](https://supabase.com/docs/guides/auth/users)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Password-based Auth](https://supabase.com/docs/guides/auth/passwords)

확인한 로컬 문서:

- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`
- `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`

## 통과한 검증 명령

- `npm run lint`
- `rg "supabase-integration-readiness|@supabase/ssr|callback route|cookie session" docs/implementation`

## 남은 후속 작업

- Work Order 03에서 승인된 package를 설치하고 Supabase provider adapter를 구현한다.
- env가 없거나 `NEXT_PUBLIC_AUTH_MODE=mock`이면 mock/local demo fallback을 유지한다.
- Work Order 04는 plan-only로 membership/permission server-side enforcement와 RLS/migration 범위를 문서화한다.
