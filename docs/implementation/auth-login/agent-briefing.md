# Auth Login Agent Briefing

이 문서는 로그인 구현 작업 전 에이전트가 따라야 할 운영 규칙이다.

## 작업 순서

1. `AGENTS.md`를 읽는다.
2. `docs/implementation/mvp-current-status.md`를 읽는다.
3. `docs/implementation/mvp-auth-transition-roadmap.md`를 읽는다.
4. `docs/implementation/auth-login/README.md`를 읽는다.
5. `docs/implementation/auth-login/status.md`를 읽는다.
6. 이 문서를 읽는다.
7. 현재 작업할 work order를 읽는다.
8. work order에 적힌 스킬과 공식 문서를 확인한다.
9. 구현 또는 문서화를 진행한다.
10. 검증, status 갱신, closeout 작성, git 절차를 수행한다.

## 구조 파악 방식

- auth UI와 session boundary는 `src/features/auth/**`에서 확인한다.
- login route는 `src/app/login/page.tsx`에서 확인한다.
- workspace guard는 `src/app/w/[workspaceId]/[module]/page.tsx`와 `src/features/auth/auth-gate.tsx`에서 확인한다.
- role display와 logout은 `src/shell/top-menu.tsx`에서 확인한다.
- 기준 회귀 테스트는 `tests/auth.spec.ts`에서 확인한다.
- workspace 회귀 영향은 app shell/reception/billing/chart/lab-imaging/sales demo tests로 확인한다.

## 사용해야 할 스킬

- 문서/계획: `superpowers:writing-plans`
- React/Next 구현: `build-web-apps:react-best-practices`
- 보안 검토: `security-best-practices`
- Supabase 설계: `supabase:supabase`
- Postgres/RLS 설계: `supabase:supabase-postgres-best-practices`
- 구현: `superpowers:test-driven-development`
- 완료 전: `superpowers:verification-before-completion`

## 공식 문서 확인 규칙

- Next.js app code를 변경하기 전 `node_modules/next/dist/docs/`의 관련 문서를 확인한다.
- Supabase 관련 설계/구현 전 Supabase 공식 문서 또는 Supabase MCP 문서를 확인한다.
- auth/security 관련 판단은 기억에 의존하지 않는다.

## 해야 할 것

- 현재 mock auth 회귀를 유지한다.
- `/login`, safe `next`, 기본 reception 진입, mock/provider session, app guard, top menu role, logout flow를 테스트로 보호한다.
- 권한 source와 session source를 분리한다.
- 문서에는 보장 동작과 후속 변경 예정 동작을 구분해 적는다.
- 완료 시 검증 명령과 결과를 closeout에 남긴다.

## 하지 말아야 할 것

- 명시 승인 없이 Supabase package를 설치하지 않는다.
- 명시 승인 없이 Supabase project/env/API를 연결하지 않는다.
- DB migration, RLS policy, server permission enforcement를 앞당겨 구현하지 않는다.
- password 검증, OAuth callback, MFA, refresh token, email verification을 직접 구현하지 않는다.
- 사용자 수정 가능 metadata를 권한 판단 source로 쓰지 않는다.
- client UI gating만으로 서버 권한 구현이 끝난 것처럼 문서화하지 않는다.

## 건드리지 말아야 할 영역

- `src/features/dispensing/**`
- `src/features/reception/**`
- `src/features/chart/**`
- `src/features/lab-imaging/**`
- `src/features/billing/**`
- sales demo fixture와 golden path는 auth 회귀 보정 목적 외에는 수정하지 않는다.

## 완료 시 해야 할 일

- 해당 work order의 완료 기준을 확인한다.
- `docs/implementation/auth-login/status.md`를 갱신한다.
- 필요한 경우 `docs/implementation/mvp-auth-transition-roadmap.md`와 `docs/implementation/mvp-current-status.md`를 갱신한다.
- `docs/completed/auth/YYYY-MM-DD-<work-slug>.md` closeout을 작성한다.
- 지정된 검증 명령을 실행한다.
- 사용자 요청이 있으면 커밋, push, PR 생성, merge까지 진행한다.
