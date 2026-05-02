# Work Order 02: Supabase Integration Readiness

## 세부 목표

실제 Supabase 연결 전에 설치, env, callback, SSR session, helper, middleware/server guard 적용 범위를 결정한다.

## 목적

provider 구현자가 package 설치와 env 연결을 시작하기 전에 필요한 결정을 빠짐없이 알 수 있게 한다.

## 범위

- 구현 계획과 decision record.
- `@supabase/ssr` 설치 시점 결정.
- Supabase URL/key env naming 결정.
- callback route, cookie session refresh, server/client helper 위치 결정.
- mock auth fallback 또는 local demo mode 유지 여부 결정.

## 완성 기준

- 실제 구현자가 package 설치 전에 해야 할 작업과 금지 범위를 안다.
- callback/session/helper/middleware 적용 범위가 명확하다.
- 03 provider implementation을 시작할 수 있는 승인 가능한 계획이 있다.

## 선행 조건

- Work Order 01 완료.
- Supabase Auth 매핑 closeout 작성 완료.
- `status.md`가 02 시작 가능 상태로 갱신되어 있어야 한다.

## 작업 순서

1. Work Order 01 산출물을 읽는다.
2. Supabase Auth/SSR 공식 문서를 확인한다.
3. local Next docs에서 route handler, middleware/proxy, cookies/session 관련 문서를 확인한다.
4. 설치/env/callback/helper/middleware 적용 범위를 문서화한다.
5. mock fallback 또는 local demo mode 정책을 문서화한다.
6. `status.md`와 필요한 상위 문서를 갱신한다.
7. `docs/completed/auth/YYYY-MM-DD-supabase-integration-readiness.md` closeout을 작성한다.

## 검증/테스트 명령

```bash
npm run lint
rg "supabase-integration-readiness|@supabase/ssr|callback route|cookie session" docs/implementation
```

## 사용해야 할 스킬

- `supabase:supabase`
- `security-best-practices`
- `superpowers:writing-plans`
- `superpowers:verification-before-completion`

## 확인해야 할 공식/로컬 문서

- Supabase Auth 공식 문서
- Supabase SSR 공식 문서
- `node_modules/next/dist/docs/`
- `docs/implementation/auth-login/work-orders/01-supabase-auth-mapping.md`

## 하지 말아야 할 것

- 명시 승인 전 Supabase package 설치 금지.
- Supabase project/env/API 연결 금지.
- callback route 구현 금지.
- DB migration/RLS 구현 금지.

## 건드리지 말아야 할 파일/영역

- 업무 화면 전체.
- auth 코드 파일은 계획 문서 범위를 넘어 수정하지 않는다.
- `package.json`과 lockfile은 이 단계에서 수정하지 않는다.

## 작업 완료 시 해야 할 일

- `docs/implementation/auth-login/status.md` 갱신.
- 필요하면 `docs/implementation/mvp-auth-transition-roadmap.md` 갱신.
- `docs/completed/auth/YYYY-MM-DD-supabase-integration-readiness.md` 작성.
- 검증 명령 실행.
- 사용자 요청 시 커밋, PR, 머지까지 진행.
