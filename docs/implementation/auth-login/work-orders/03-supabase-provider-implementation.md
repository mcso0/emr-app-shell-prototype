# Work Order 03: Supabase Provider Implementation

## 세부 목표

승인된 readiness 계획에 따라 `useAuthClient()` 뒤에 Supabase provider adapter를 연결한다.

## 목적

현재 mock auth shell을 실제 provider session 기반 로그인 흐름으로 전환하되, 기존 로그인 회귀 동작을 잃지 않는다.

## 범위

- Supabase package 설치와 env 연결은 Work Order 02에서 명시 승인된 경우에만 수행한다.
- email/password sign in 호출을 provider adapter에 연결한다.
- session hydrate, logout, safe `next`, app guard, top menu role 흐름을 유지한다.
- mock auth fallback 또는 local demo mode는 Work Order 02 결정에 따른다.

## 완성 기준

- `/login`에서 실제 Supabase Auth sign in 흐름이 동작한다.
- 로그인 성공 후 safe `next` 또는 기본 reception으로 이동한다.
- app guard가 provider session 기준으로 보호한다.
- logout이 provider session을 종료하고 `/login`으로 이동한다.
- 기존 `tests/auth.spec.ts` 회귀가 provider 전환 후에도 통과하거나 명확히 갱신된다.

## 선행 조건

- Work Order 01 완료.
- Work Order 02 완료.
- Supabase project/env/API 연결 승인이 있어야 한다.
- package 설치 승인이 있어야 한다.

## 작업 순서

1. Work Order 01/02 산출물과 closeout을 읽는다.
2. Supabase Auth/SSR 공식 문서를 다시 확인한다.
3. Next.js 관련 local docs를 확인한다.
4. 실패하는 auth 회귀 테스트를 먼저 작성하거나 갱신한다.
5. 승인된 범위에서 provider adapter를 구현한다.
6. login form, auth gate, top menu 흐름을 검증한다.
7. status와 closeout을 갱신한다.

## 검증/테스트 명령

```bash
npm run lint
npx tsc --noEmit
npm run build
npx playwright test tests/auth.spec.ts --reporter=line
```

workspace 회귀 영향이 있으면:

```bash
npx playwright test tests/app-shell.spec.ts tests/reception.spec.ts tests/billing.spec.ts tests/chart.spec.ts tests/lab-imaging.spec.ts tests/sales-demo-flow.spec.ts --reporter=line
```

## 사용해야 할 스킬

- `build-web-apps:react-best-practices`
- `supabase:supabase`
- `security-best-practices`
- `superpowers:test-driven-development`
- `superpowers:verification-before-completion`

## 확인해야 할 공식/로컬 문서

- Supabase Auth 공식 문서
- Supabase SSR 공식 문서
- `node_modules/next/dist/docs/`
- `docs/implementation/auth-login/work-orders/01-supabase-auth-mapping.md`
- `docs/implementation/auth-login/work-orders/02-supabase-integration-readiness.md`

## 하지 말아야 할 것

- password 검증 직접 구현 금지.
- OAuth callback, MFA, refresh token, email verification 직접 구현 금지.
- server permission enforcement를 이 단계에서 구현 완료로 취급하지 않는다.
- 업무 화면 수정 금지.

## 건드리지 말아야 할 파일/영역

- `src/features/dispensing/**`
- `src/features/reception/**`
- `src/features/chart/**`
- `src/features/lab-imaging/**`
- `src/features/billing/**`
- sales demo fixture와 golden path는 auth 회귀 보정 목적 외에는 수정하지 않는다.

## 작업 완료 시 해야 할 일

- `docs/implementation/auth-login/status.md` 갱신.
- `docs/implementation/mvp-auth-transition-roadmap.md` 갱신.
- `docs/implementation/mvp-current-status.md` 갱신 여부 판단.
- `docs/completed/auth/YYYY-MM-DD-supabase-provider-implementation.md` 작성.
- 검증 명령 실행.
- 사용자 요청 시 커밋, PR, 머지까지 진행.
