# Supabase Auth Mapping

Updated: 2026-05-03

이 문서는 Work Order 01의 결과물이다. 실제 Supabase 연결, package 설치, env 연결, DB migration, RLS policy, auth code 변경 없이 Supabase Auth session과 앱 도메인 사용자/멤버십/권한 source의 관계만 고정한다.

## 공식 문서 확인

확인한 기준:

- [Supabase Auth](https://supabase.com/docs/guides/auth): Supabase Auth는 인증을 담당하고, JWT와 RLS를 통해 database authorization과 연결될 수 있다.
- [Supabase Auth Users](https://supabase.com/docs/guides/auth/users): Supabase 사용자는 `auth` schema의 user id를 가진다. `user_metadata`는 사용자 수정 가능하므로 authorization logic이나 RLS 같은 security-sensitive context에 쓰지 않는다.
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): RLS는 `auth.uid()`와 `auth.jwt()` helper를 제공한다. `raw_user_meta_data`는 권한 source로 부적절하고, JWT claim은 refresh 전까지 최신 membership 상태를 반영하지 않을 수 있다.
- [Supabase SSR client](https://supabase.com/docs/guides/auth/server-side/creating-a-client): Next.js SSR에서는 cookie 기반 server/client Supabase client와 server-side session validation 경계를 둔다. 실제 helper와 proxy/middleware 구성은 Work Order 02에서 별도로 결정한다.

## 핵심 결정

### `auth.users.id`와 앱 `users.id`

- 로그인 가능한 앱 사용자에 대해 앱 도메인 `users.id`는 `auth.users.id`와 같은 UUID를 사용한다.
- 별도 `auth_user_id` column은 만들지 않는다.
- 앱 도메인 테이블의 `created_by_user_id`, `assigned_veterinarian_id`, `performed_by_user_id` 같은 user FK는 앱 `users.id`를 참조하고, 이 값은 Supabase Auth user id와 동일하다.
- Supabase Auth는 identity/session source다. 이메일/전화/OAuth identity, password, refresh token, email verification, MFA는 Supabase Auth에 위임한다.
- 앱 `users`는 EMR 도메인의 직원/사용자 프로필 source다. `display_name`, `initial`, `status`, 앱 표시용 연락처, 감사/업무 FK의 기준을 담당한다.

후속 migration 입력:

| Table | Field | Decision |
|---|---|---|
| `users` | `id` | UUID PK, Supabase `auth.users.id`와 동일 |
| `users` | `display_name`, `initial` | 앱 표시 source |
| `users` | `email`, `phone` | 앱 표시/연락처용 denormalized field. 로그인 identity source로 취급하지 않는다 |
| `users` | `status` | `active`, `inactive`, `invited` 같은 앱 접근 상태 source |

### `user_memberships`

`user_memberships`는 사용자가 어떤 병원/워크스페이스에 어떤 역할로 소속되어 있는지 표현한다. 한 사용자는 여러 workspace에 속할 수 있고, 현재 라우트의 `/w/[workspaceId]/...`가 permission lookup의 workspace scope가 된다.

핵심 필드:

| Field | Purpose |
|---|---|
| `id` | membership row id |
| `workspace_id` | 소속 workspace. workspace는 branch/organization을 통해 병원 운영 단위에 연결된다 |
| `user_id` | 앱 `users.id`, 즉 Supabase `auth.users.id`와 동일한 UUID |
| `role` | workspace 안의 기본 역할 |
| `department`, `title`, `hire_date` | 직원 표시/운영 정보 |
| `status` | `active`, `inactive`, `invited` 같은 membership 상태 |
| `created_at`, `updated_at` | 감사와 운영 추적 |

제약:

- `unique(workspace_id, user_id)`를 유지한다.
- membership이 없거나 `status != active`인 사용자는 해당 workspace의 제품 권한을 가진 것으로 보지 않는다.
- workspace switching은 session만으로 결정하지 않고, 선택한 `workspace_id`에 대한 active membership 조회 결과로 결정한다.

canonical role:

| Canonical role | Label | Current alias/reference |
|---|---|---|
| `front_desk` | 프론트 데스크 | DB spec의 `desk`와 대응 |
| `vet` | 수의사 | DB spec의 `veterinarian`과 대응 |
| `nurse` | 간호/테크니션 | 기존 mock/seed 유지 |
| `billing_admin` | 수납 관리자 | DB spec의 `billing`보다 현재 seed와 맞춘다 |
| `hospital_admin` | 병원 관리자 | 현재 seed와 맞춘다 |

`system_admin`은 전체 SaaS 운영자 역할로 필요할 수 있지만, 현재 MVP auth transition의 workspace role canonical set에는 포함하지 않는다. 후속 병원관리/운영자 계획에서 별도 scope로 추가한다.

### `permission_policies`

`permission_policies`는 제품 권한 판단 source다. Supabase Auth session이나 user metadata에 권한을 싣지 않는다.

핵심 필드:

| Field | Purpose |
|---|---|
| `id` | policy row id |
| `workspace_id` | 정책이 적용되는 workspace |
| `name` | 운영자가 식별하는 정책 이름 |
| `scope` | `role` 또는 `user` |
| `target_role` | `scope = role`일 때 canonical role |
| `target_user_id` | `scope = user`일 때 앱 `users.id` |
| `permissions` | 현재 `PermissionId` vocabulary 기반 JSONB |
| `created_at`, `updated_at` | 감사와 운영 추적 |

기본 형태:

```json
{
  "allowed": ["reception:view", "billing:issue"]
}
```

초기 role permission vocabulary는 현재 seed의 `PermissionId`를 기준으로 한다.

- resource: `reception`, `patient`, `encounter`, `chart`, `order`, `dispensing`, `lab`, `imaging`, `billing`, `service_catalog`, `role_permission`
- action: `view`, `create`, `update`, `request`, `complete`, `issue`, `manage`

정책 책임:

- role-scope policy가 기본 권한 matrix다.
- user-scope policy는 명시적인 개인별 override/exception에만 사용한다.
- client UI gating은 편의 UX일 뿐이다. Work Order 04에서 server-side enforcement와 RLS 계획 또는 구현이 별도로 필요하다.

## Session source와 permission source

Supabase Auth session source:

- 사용자가 누구인지 증명한다.
- server-side auth check 후 `auth.users.id` 또는 `auth.uid()`에 해당하는 UUID를 제공한다.
- password 검증, OAuth callback, refresh token, email verification, MFA는 앱이 직접 구현하지 않는다.

앱 permission source:

- `users`에서 앱 사용자 상태를 확인한다.
- 현재 workspace의 `user_memberships`에서 active membership과 role을 확인한다.
- `permission_policies` 또는 role permission source에서 최종 permission set을 계산한다.
- 업무 데이터 접근은 후속 RLS/server-side enforcement에서 이 source를 기준으로 제한한다.

권한 판단 흐름:

1. Supabase Auth가 session을 검증한다.
2. session user id를 앱 `users.id`로 사용한다.
3. 요청한 `workspace_id`에 대해 active `user_memberships` row를 조회한다.
4. membership role과 `permission_policies`를 사용해 permission set을 계산한다.
5. 서버 API/RLS에서 workspace scope와 permission을 enforce한다. client UI gating만으로 완료 처리하지 않는다.

## Metadata 금지 원칙

- `user_metadata`와 `raw_user_meta_data`는 사용자 수정 가능하므로 권한 판단, workspace membership, role, RLS 조건에 사용하지 않는다.
- `app_metadata`와 `raw_app_meta_data`는 사용자가 직접 수정할 수 없지만 MVP 권한 source of truth로 쓰지 않는다. JWT claim freshness와 cookie size 문제가 있으므로 membership/permission source는 DB 테이블로 둔다.
- JWT claim은 session identity hint로만 사용하고, 제품 권한은 서버/DB가 통제하는 `user_memberships`와 `permission_policies`에서 다시 확인한다.

## 후속 작업 입력

Work Order 02:

- Supabase package 설치 시점, env naming, SSR cookie session helper, proxy/middleware/server guard 범위를 이 문서의 source separation 기준으로 계획한다.
- server-side session validation method는 최신 Supabase SSR 공식 문서를 다시 확인하고 결정한다.
- publishable key와 service role/secret key 노출 경계를 문서화한다.

Work Order 04:

- `users.id = auth.users.id` 기준으로 membership lookup과 permission policy resolver를 연결한다.
- RLS는 exposed schema의 테이블에 기본 활성화하는 방향으로 설계하되, 실제 policy SQL은 별도 승인 후 작성한다.
- RLS helper나 security definer function이 필요하면 exposed schema에 두지 않는 원칙을 유지한다.
- UPDATE에는 필요한 SELECT policy가 함께 있어야 한다는 Supabase/Postgres RLS 제약을 검토한다.
