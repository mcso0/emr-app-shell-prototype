# Auth Login Master Plan

## 요약

로그인 구현은 4개 work order로 나눈다. 각 단계는 이전 단계의 완료 문서와 검증 기록이 있어야 시작할 수 있다.

## 단계와 Gate

| 순서 | 작업 | 성격 | 다음 단계 Gate |
|---|---|---|---|
| 01 | Supabase Auth 매핑 설계 | 문서화-only | 사용자/멤버십/권한 source가 실제 DB 변경 없이 설명 가능 |
| 02 | Supabase 연동 준비 계획 | 문서화/decision record | 설치/env/callback/session/helper/middleware 범위가 승인 가능 |
| 03 | Supabase provider 구현 | 코드 구현 | 기존 mock auth 회귀와 실제 provider session 흐름 검증 통과 |
| 04 | Membership/permission enforcement | 보안/권한 구현 또는 계획 | server-side enforcement와 RLS/migration 범위가 명확 |

## 단계별 목적

### 01. Supabase Auth 매핑 설계

- `auth.users.id`와 앱 도메인 `users` 관계를 정한다.
- `user_memberships`로 사용자의 병원/워크스페이스 소속을 모델링한다.
- `permission_policies` 또는 role permission source를 권한 판단 기준으로 둔다.
- 실제 DB 변경과 Supabase 연결은 하지 않는다.

### 02. Supabase 연동 준비 계획

- `@supabase/ssr` 설치 시점과 env naming을 정한다.
- callback route, cookie session refresh, server/client helper, middleware/server guard 적용 범위를 정한다.
- mock auth fallback 또는 local demo mode 유지 여부를 결정한다.
- 명시 승인 전 package 설치와 프로젝트 연결은 하지 않는다.

### 03. Supabase provider 구현

- 승인된 02 계획에 따라 `useAuthClient()` 뒤에 provider adapter를 연결한다.
- `/login`, safe `next`, app guard, top menu role, logout flow를 유지한다.
- password 검증, OAuth, MFA, refresh token은 Supabase Auth에 위임한다.

### 04. Membership/permission enforcement

- provider session과 앱 domain membership/permission source를 연결한다.
- server-side enforcement, RLS, migration 범위를 별도 구현 단위로 확정한다.
- client UI gating만으로 보안 구현 완료처럼 다루지 않는다.

## 공통 완료 규칙

- 단계 완료 시 `docs/implementation/auth-login/status.md`를 갱신한다.
- 상위 auth 기준이 바뀌면 `docs/implementation/mvp-auth-transition-roadmap.md`도 갱신한다.
- 전체 MVP 상태가 바뀌면 `docs/implementation/mvp-current-status.md`도 갱신한다.
- 완료 문서는 `docs/completed/auth/YYYY-MM-DD-<slug>.md`에 작성한다.
- 검증 명령 결과를 closeout에 남긴다.
- 커밋, PR, 머지는 사용자 요청 또는 해당 work order 지시에 따른다.
