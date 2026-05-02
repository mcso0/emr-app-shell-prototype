# Supabase Auth Mapping Closeout

완료 날짜: 2026-05-03

## 최종 목표와 실제 결과물

- Supabase Auth와 앱 도메인 사용자/멤버십/권한 모델의 연결 방식을 구현 전에 문서로 고정했다.
- `users.id`는 로그인 가능한 앱 사용자에 대해 Supabase `auth.users.id`와 같은 UUID를 사용하기로 결정했다.
- `user_memberships`는 사용자의 다중 병원/워크스페이스 소속과 workspace role source로 정의했다.
- `permission_policies`는 제품 권한 source로 정의했고, session source와 permission source를 분리했다.
- 사용자 수정 가능 metadata인 `user_metadata`/`raw_user_meta_data`는 권한 판단에 쓰지 않는다는 원칙을 명시했다.
- 실제 Supabase package/env/API 연결, DB migration, RLS policy, auth code 변경은 하지 않았다.

## 변경한 주요 파일

- `docs/implementation/auth-login/supabase-auth-mapping.md`
- `docs/implementation/auth-login/README.md`
- `docs/implementation/auth-login/status.md`
- `docs/implementation/mvp-auth-transition-roadmap.md`
- `docs/implementation/mvp-current-status.md`
- `docs/completed/auth/2026-05-03-supabase-auth-mapping.md`

## 사용한 스킬과 문서

- `supabase:supabase`: Auth users, metadata, SSR session, RLS helper의 최신 Supabase 기준 확인
- `supabase:supabase-postgres-best-practices`: schema/RLS 설계 전에 exposed schema, RLS, policy helper 주의사항 확인
- `security-best-practices`: Next.js/React 보안 경계, client secret 노출 금지, client storage trust boundary 확인
- `superpowers:writing-plans`: 문서화-only 범위와 후속 work order 입력값 정리
- `superpowers:verification-before-completion`: 완료 주장 전 검증 명령 실행 기준 확인

확인한 공식 문서:

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase Auth Users](https://supabase.com/docs/guides/auth/users)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase SSR client](https://supabase.com/docs/guides/auth/server-side/creating-a-client)

확인한 로컬 문서/파일:

- `docs/emr-saas-db-structure-spec.ko.md`
- `src/features/auth/permissions.ts`
- `src/features/auth/mock-session.ts`
- `src/mocks/emr-domain.ts`
- `src/types/emr-domain.ts`

## 결정 사항

- `users.id = auth.users.id`를 기준으로 후속 migration/RLS 계획을 작성한다.
- 별도 `auth_user_id`는 만들지 않는다.
- `users`는 앱 도메인 프로필/직원 상태 source이고, Supabase Auth는 session/identity source다.
- `user_memberships`는 `unique(workspace_id, user_id)`를 유지하고, active membership만 workspace 권한 source로 본다.
- canonical role은 현재 mock/seed와 맞춘 `front_desk`, `vet`, `nurse`, `billing_admin`, `hospital_admin`이다.
- `permission_policies.permissions`는 현재 `PermissionId` vocabulary와 맞춘 JSONB `{ "allowed": [...] }` 형태로 계획한다.
- `app_metadata`도 MVP permission source of truth로 쓰지 않고, JWT freshness/cookie size 제약을 고려해 DB membership/policy를 기준으로 한다.

## 통과한 검증 명령

- `npm run lint`
- `rg "Supabase Auth|user_memberships|permission_policies" docs/implementation`

## 남은 후속 작업

- Work Order 02에서 Supabase package 설치 시점, env naming, SSR cookie session helper, proxy/middleware/server guard 적용 범위를 문서로 결정한다.
- Work Order 03 전까지 Supabase 실제 연결과 auth provider adapter 구현은 하지 않는다.
- Work Order 04에서 membership/permission source와 server-side enforcement/RLS 계획 또는 구현을 별도 승인 범위로 진행한다.
