# Membership Permission Enforcement Plan

Updated: 2026-05-03

이 문서는 Work Order 04의 결과물이다. 이번 범위는 plan-only이며 migration, RLS policy, server-side enforcement code를 작성하지 않는다.

## 공식/로컬 문서 확인

확인한 기준:

- [Supabase Auth](https://supabase.com/docs/guides/auth): Auth는 사용자가 누구인지 증명하고 JWT/RLS와 연결될 수 있지만, authorization은 별도 source와 policy가 필요하다.
- [Supabase Users](https://supabase.com/docs/guides/auth/users): `user_metadata`는 사용자 수정 가능하므로 authorization logic에 쓰지 않는다.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): exposed schema table은 RLS를 활성화해야 한다. `auth.uid()`는 로그인 사용자 id를 제공하고, `auth.jwt()`의 `raw_user_meta_data`는 권한 source로 쓰지 않는다.
- `docs/emr-saas-db-structure-spec.ko.md`: `users`, `user_memberships`, `permission_policies`가 인증/권한 도메인 테이블 초안이다.
- `docs/implementation/auth-login/supabase-auth-mapping.md`: `users.id = auth.users.id`, active membership, permission policy source separation을 기준으로 한다.
- `docs/implementation/auth-login/supabase-integration-readiness.md`: Supabase provider session과 local demo fallback 경계를 기준으로 한다.

## Source of truth

Session source:

- Supabase Auth session은 identity source다.
- server/proxy validation은 `auth.getClaims()` 또는 verified user lookup을 우선한다.
- client `useAuthClient()` session은 UX state이고 보안 source가 아니다.

Domain permission source:

- `users.id`는 로그인 가능한 앱 사용자에 대해 Supabase `auth.users.id`와 같은 UUID다.
- `users.status = active`인 앱 사용자만 제품 접근 대상이다.
- `user_memberships`는 workspace scope의 active membership과 canonical role source다.
- `permission_policies`는 role/user scope permission source다.
- `user_metadata`, `raw_user_meta_data`, client storage, query string은 membership/permission source로 쓰지 않는다.

## Server-side enforcement contract

후속 구현의 공통 contract:

1. 서버가 Supabase session을 검증한다.
2. session subject를 앱 `users.id`로 사용한다.
3. 요청 route의 `workspace_id`에 대해 active `user_memberships` row를 조회한다.
4. membership role과 `permission_policies`를 merge해 permission set을 계산한다.
5. 서버 Route Handler/Server Function/Data Access Layer가 필요한 permission을 확인한 뒤 업무 데이터를 읽거나 변경한다.
6. client UI gating은 편의 기능으로만 둔다. 서버 권한 확인 없이 보안 완료로 처리하지 않는다.

초기 permission vocabulary는 `src/types/emr-domain.ts`의 `PermissionId`와 `src/mocks/emr-domain.ts`의 role seed를 기준으로 유지한다.

## Future implementation units

### Unit A: Permission resolver without migration

목표:

- DB migration 없이 현재 seed와 Supabase session user id를 연결할 server-side resolver interface를 정의한다.
- local demo/mock adapter와 future Supabase DB adapter가 같은 contract를 공유하게 한다.

예상 산출물:

- server-only permission resolver type
- active membership not found, inactive user, missing permission error model
- unit/contract tests

검증:

- `npm run lint`
- `npx tsc --noEmit`
- 관련 unit/Playwright tests

### Unit B: Membership/profile migration

목표:

- `users`, `user_memberships`, `permission_policies` migration을 별도 승인 후 작성한다.
- `users.id = auth.users.id` FK 관계와 `unique(workspace_id, user_id)`를 적용한다.
- exposed schema table에는 RLS를 활성화한다.

주의:

- Supabase migration은 `supabase migration new <name>` 또는 project-approved migration workflow로 생성한다.
- `service_role`/secret key는 browser/client env에 노출하지 않는다.
- 기존 mock fixture와 sales demo data를 무리하게 실제 DB seed로 변환하지 않는다.

검증:

- migration lint/review
- Supabase advisor 또는 project-approved SQL verification
- RLS policy tests

### Unit C: RLS policies

목표:

- workspace-scoped business tables가 active membership을 기준으로 rows를 제한하게 한다.
- permission-sensitive mutation은 permission policy 또는 server-side RPC/helper를 별도 검토한다.

정책 기준:

- `auth.uid() IS NOT NULL`을 명시한다.
- policy에는 `TO authenticated`를 명시한다.
- UPDATE에는 필요한 SELECT policy가 있어야 한다.
- `security definer` function이 필요하면 exposed schema에 두지 않는다.
- JWT `user_metadata`나 stale app metadata를 membership/permission source로 쓰지 않는다.

검증:

- authenticated/unauthenticated access matrix
- workspace mismatch denial
- inactive membership denial
- permission missing denial
- allowed role success path

### Unit D: App route/server action enforcement

목표:

- future API Route Handler, Server Function, Data Access Layer가 permission resolver를 호출한다.
- UI module gating은 resolver 결과를 표시 최적화에만 사용한다.

초기 적용 후보:

- reception read/update endpoints
- chart/SOAP save endpoints
- order request/update endpoints
- billing issue/payment endpoints
- service catalog/role permission admin endpoints

현재 repo에는 실제 backend endpoint가 없으므로 이번 Work Order에서는 구현하지 않는다.

## Non-goals for this work order

- migration file 작성 없음
- RLS SQL policy 작성 없음
- Supabase project에 SQL 적용 없음
- server-side permission resolver code 작성 없음
- business screen UI 수정 없음
- client UI gating 추가로 보안 완료 처리 없음

## Acceptance criteria for future approval

후속 구현을 시작하려면 아래가 먼저 승인되어야 한다.

- migration 포함 여부와 대상 table 목록
- RLS policy를 먼저 작성할 table 우선순위
- server-side resolver를 둘 위치와 API/DAL 적용 첫 대상
- local demo/mock permissions와 Supabase DB permissions의 전환 전략
- live Supabase project 또는 local Supabase verification 방식
