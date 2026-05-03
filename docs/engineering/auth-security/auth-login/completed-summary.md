# Auth Login Completed Summary

이 문서는 로그인 관련 완료 작업의 요약 인덱스다. 공식 closeout 원본은 계속 `docs/completed/auth/` 아래에 둔다.

## 완료된 작업

### Auth Roadmap Baseline

- 문서: `docs/completed/auth/2026-05-03-auth-roadmap-baseline.md`
- 요약: auth roadmap/current status/implementation README 연결과 closeout 규칙을 기준선으로 고정했다.

### Auth Boundary

- 문서: `docs/completed/auth/2026-05-03-auth-boundary.md`
- 요약: `useAuthClient()` boundary를 추가하고 login form, app guard, top menu가 mock store를 직접 import하지 않게 했다.

### Login UX State

- 문서: `docs/completed/auth/2026-05-03-login-ux-state.md`
- 요약: login submit pending/disabled 상태와 provider error 표시 영역을 추가했다.

### Supabase Auth Mapping

- 문서: `docs/completed/auth/2026-05-03-supabase-auth-mapping.md`
- 요약: `auth.users.id`와 앱 `users.id`를 같은 UUID로 고정하고, `user_memberships`와 `permission_policies`를 membership/permission source로 분리했다.

### Supabase Integration Readiness

- 문서: `docs/completed/auth/2026-05-03-supabase-integration-readiness.md`
- 요약: `@supabase/supabase-js`, `@supabase/ssr`, public env naming, auth mode fallback, SSR cookie helper/proxy, callback route 분리 기준을 고정했다.

### Supabase Provider Implementation

- 문서: `docs/completed/auth/2026-05-03-supabase-provider-implementation.md`
- 요약: `useAuthClient()` boundary 뒤에 Supabase provider adapter, browser/server/proxy helper, auth mode fallback, email/password sign-in 위임을 추가했다.

### Membership Permission Enforcement

- 문서: `docs/completed/auth/2026-05-03-membership-permission-enforcement.md`
- 요약: `users.id = auth.users.id`, active `user_memberships`, `permission_policies` 기준으로 server-side enforcement와 RLS/migration 후속 구현 단위를 plan-only로 확정했다.

## 최근 PR

- GitHub PR #10: `feat: add auth transition boundary`

## 다음 완료 문서

다음 완료 문서는 승인된 후속 권한 구현 단위에 맞춰 `docs/completed/auth/YYYY-MM-DD-<slug>.md` 형식으로 작성한다.
