# Work Order 01: Supabase Auth Mapping

## 세부 목표

Supabase Auth와 앱 도메인 사용자/멤버십/권한 모델의 연결 방식을 구현 전에 문서로 고정한다.

## 목적

실제 Supabase 연결, migration, RLS 구현 전에 로그인 사용자가 어떤 앱 사용자, 병원/워크스페이스 membership, 권한 source와 연결되는지 결정한다.

## 범위

- 문서화-only.
- `auth.users.id`와 앱 도메인 `users` 식별자 관계 정의.
- `user_memberships` 모델의 목적과 핵심 필드 수준 정의.
- `permission_policies` 또는 role permission source의 책임 정의.
- session source와 permission source 분리 원칙 정의.

## 완성 기준

- 실제 DB 변경 없이도 후속 migration 계획을 작성할 수 있을 만큼 매핑이 명확하다.
- 사용자 수정 가능 metadata를 권한 source로 쓰지 않는다는 원칙이 명시되어 있다.
- 후속 `02-supabase-integration-readiness.md`에서 참조할 수 있는 결정 사항이 남아 있다.

## 선행 조건

- `docs/engineering/auth-security/auth-login/README.md`
- `docs/engineering/auth-security/auth-login/status.md`
- `docs/engineering/auth-security/auth-login/agent-briefing.md`
- `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`

## 작업 순서

1. Supabase Auth 공식 문서를 확인한다.
2. Supabase Postgres/RLS 설계 기준을 확인한다.
3. 앱 도메인 DB spec과 현재 role/permission seed를 확인한다.
4. 매핑 문서를 작성하거나 상위 auth-login 문서에 결정 사항을 반영한다.
5. `status.md`와 필요한 상위 문서를 갱신한다.
6. `docs/completed/auth/YYYY-MM-DD-supabase-auth-mapping.md` closeout을 작성한다.

## 검증/테스트 명령

```bash
npm run lint
rg "Supabase Auth|user_memberships|permission_policies" docs/implementation
```

## 사용해야 할 스킬

- `supabase:supabase`
- `supabase:supabase-postgres-best-practices`
- `security-best-practices`
- `superpowers:writing-plans`
- `superpowers:verification-before-completion`

## 확인해야 할 공식/로컬 문서

- Supabase Auth 공식 문서
- Supabase SSR/session 관련 공식 문서
- `docs/engineering/data-model/emr-saas-db-structure-spec.ko.md`
- `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`
- `src/features/auth/permissions.ts`

## 하지 말아야 할 것

- Supabase package 설치 금지.
- Supabase project/env/API 연결 금지.
- DB migration/RLS policy 작성 금지.
- auth 코드 변경 금지.

## 건드리지 말아야 할 파일/영역

- `src/features/dispensing/**`
- `src/features/reception/**`
- `src/features/chart/**`
- `src/features/lab-imaging/**`
- `src/features/billing/**`
- auth 코드 파일은 문서화-only 범위에서는 수정하지 않는다.

## 작업 완료 시 해야 할 일

- `docs/engineering/auth-security/auth-login/status.md` 갱신.
- 필요하면 `docs/engineering/auth-security/mvp-auth-transition-roadmap.md` 갱신.
- 필요하면 `docs/engineering/current-status.md` 갱신.
- `docs/completed/auth/YYYY-MM-DD-supabase-auth-mapping.md` 작성.
- 검증 명령 실행.
- 사용자 요청 시 커밋, PR, 머지까지 진행.
