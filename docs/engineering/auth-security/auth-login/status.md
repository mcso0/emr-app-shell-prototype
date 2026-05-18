# Auth Login Status

Updated: 2026-05-18

## 목표

mock auth 기반 `/login`과 app guard를 실제 Supabase Auth 구조로 전환 가능한 제품 로그인 기반으로 끌어올린다.

## 목적

- 사용자가 로그인한 뒤 워크스페이스에 진입하는 제품 흐름을 만든다.
- Supabase Auth session과 앱 도메인 membership/permission source를 분리해 설계한다.
- 현재 mock auth 흐름을 Supabase 전환 중에도 회귀 없이 유지한다.

## 완성 기준

- `/login`, safe `next`, 기본 reception 진입, session hydrate, app guard, top menu role, logout flow가 실제 provider session 기준으로 동작한다.
- 사용자/병원/워크스페이스 membership과 permission source가 앱 도메인 모델로 정의된다.
- 권한 판단은 사용자 수정 가능 metadata가 아니라 서버/DB 통제 source를 기준으로 한다.
- Supabase Auth가 담당해야 할 password, OAuth, email verification, MFA, refresh token 기능을 직접 구현하지 않는다.
- 각 단계 완료 시 기준 문서와 `docs/completed/auth/` closeout이 갱신된다.

## 현상태

- mock auth shell은 완료되어 있다.
- `/login`은 제품형 폼과 `MVP 테스트 옵션` 패널로 분리되어 있다.
- `useAuthClient()` boundary가 추가되어 auth UI가 mock store를 직접 import하지 않는다.
- login pending/disabled 상태와 provider error 영역이 있다.
- Supabase Auth mapping은 `docs/engineering/auth-security/auth-login/supabase-auth-mapping.md`에 문서화되어 있다.
- Supabase integration readiness는 `docs/engineering/auth-security/auth-login/supabase-integration-readiness.md`에 문서화되어 있다.
- `users.id`는 로그인 가능한 앱 사용자에 대해 `auth.users.id`와 같은 UUID를 사용한다.
- `user_memberships`와 `permission_policies`가 workspace membership과 권한 source이며, session source와 permission source는 분리한다.
- Work Order 03의 package 설치 대상은 `@supabase/supabase-js`와 `@supabase/ssr`로 승인되어 있다.
- Supabase env naming은 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_AUTH_MODE`로 결정되어 있다.
- Supabase provider adapter가 `useAuthClient()` boundary 뒤에 구현되어 있다.
- `NEXT_PUBLIC_AUTH_MODE=auto` 기본값은 Supabase env가 있으면 provider를 쓰고, env가 없으면 mock/local demo fallback을 유지한다.
- Membership/permission enforcement plan은 `docs/engineering/auth-security/auth-login/membership-permission-enforcement.md`에 문서화되어 있다.
- Supabase project API live validation, callback route, DB migration, RLS, server permission enforcement code는 아직 연결하지 않았다.
- 2026-05-14 기준 `/login`, auth gate loading state, top menu workspace selector, auth profile trigger/menu의 직접 Clair/local color usage는 DESIGN-SYSTEM-PR-015에서 shadcn semantic token과 EMR alias token으로 정리했다. Auth behavior, Supabase adapter boundary, mock session storage, safe `next`, and logout flow were not changed.
- 2026-05-17 기준 workspace auth product scope는 `docs/product/domain/workspace-auth-permissions.md`에 고정했다. Canonical MVP roles are `hospital_admin`, `vet`, `technician`, and `front_desk`; current seed roles `nurse` and `billing_admin` are compatibility/legacy implementation details until follow-up implementation reconciles them.
- 2026-05-17 기준 workspace membership data/security plan은 `docs/engineering/auth-security/auth-login/workspace-membership-data-security-plan.md`에 고정했다. MVP membership roles are additive `roles text[]`; personal profile data is separated from authorization source; last active `hospital_admin` protection requires a server transaction or private RPC; migration SQL, RLS SQL, and live Supabase validation remain out of scope.
- 2026-05-17 기준 DEN-28에서 Next.js 보안 패치를 별도 적용했다. `next`와 `eslint-config-next`는 `16.2.6`으로 exact pin 되었고, workspace creation/server enforcement work는 이 패치 검증 이후 진행한다.
- 2026-05-17 기준 DEN-23에서 `/workspace/new` session-only workspace creation foundation을 추가했다. 병원관리자 mock user는 workspace name, representative/admin name, contact email/phone을 입력해 workspace를 만들 수 있고, 생성자는 active `hospital_admin` membership을 받으며 새 workspace home으로 이동한다. Supabase persistence, migration/RLS, payment integration, server enforcement는 아직 범위 밖이다.
- 2026-05-17 기준 DEN-24에서 병원관리 `병원구성원 관리` 화면에 session-only member invitation flow를 추가했다. 병원관리자는 이메일 초대, 다중 역할 지정, pending invite 재발송/취소/수락 시뮬레이션을 할 수 있고, active/pending/inactive member state count를 확인할 수 있다. 비관리자 mock role은 초대 및 멤버십 변경 UI가 차단된다. Real email delivery, public invite links, Supabase persistence, migration/RLS, seat billing, server enforcement는 아직 범위 밖이다.
- 2026-05-17 기준 DEN-19에서 server-only workspace permission resolver contract를 추가했다. Resolver는 앱 멤버십/역할 데이터를 기준으로 effective permission을 계산하고, unauthenticated, inactive user, missing membership, inactive membership, permission missing, last admin protected denial을 typed result로 반환한다. Live Supabase DB adapter, migration/RLS, API route/server action enforcement는 아직 범위 밖이다.
- 2026-05-17 기준 DEN-25에서 병원관리 `병원구성원 관리` 화면에 session-only role management UI를 추가했다. 병원관리자는 활성 구성원의 다중 역할을 수정하고 effective permission summary를 확인할 수 있으며, 역할 변경과 비활성화는 확인 dialog를 거친다. 마지막 active `hospital_admin` 강등/비활성화는 session contract와 UI 모두에서 차단된다. Live DB writes, audit persistence, server action/API enforcement, DB-level transaction protection은 아직 범위 밖이다.
- 2026-05-17 기준 DEN-26에서 `/profile` 개인 프로필 설정 화면을 추가했다. 사용자는 이름, 이니셜, 연락처, 운영 알림 placeholder를 session-only로 저장할 수 있고, 저장된 표시 정보는 shell profile menu에 반영된다. 역할/권한 정보는 읽기 전용으로만 표시되며 profile storage에는 role, role label, permission field를 저장하지 않는다. Supabase identity profile, email change, password/MFA, live persistence는 아직 범위 밖이다.
- 2026-05-17 기준 DEN-21에서 첫 server-side permission enforcement slice를 추가했다. `POST /api/workspaces/[workspaceId]/memberships/[membershipId]/roles` route는 server-only enforcement module을 통해 active membership, `role_permission:manage`, canonical roles, and last active `hospital_admin` protection을 확인한다. 당시 actor identity는 demo-only `x-clair-demo-session-user-id` header였고, DEN-32에서 verified server session seam으로 교체했다. DB writes, migration/RLS는 아직 범위 밖이다.
- 2026-05-17 기준 DEN-27 CSO 보안 리뷰를 완료했다. 개인 프로필은 권한 source로 쓰이지 않고, multi-role additive resolver, desk/technician chart mutation restriction, last-admin guard는 현재 계약/테스트로 확인된다. 운영 전 필수 보완점은 demo identity header 제거, role management UI의 server route handoff, DB transaction/private RPC 기반 last-admin protection이다.
- 2026-05-18 기준 DEN-29에서 Project 01의 live Supabase readiness 실행 모드를 local-first로 고정했다. Remote Supabase staging/live 변경은 별도 대표 승인 없이는 하지 않으며, Project 01은 로컬 Supabase 검증을 기본 전제로 verified session, migration/RLS, DB-backed permission foundation을 순서대로 진행한다. 기준 문서는 `docs/engineering/auth-security/auth-login/live-supabase-readiness-execution-mode.md`이다.
- 2026-05-18 기준 DEN-30에서 auth/DB/RLS 작업의 env matrix, secret handling rule, verification gate를 고정했다. Browser-safe env는 `NEXT_PUBLIC_AUTH_MODE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`로 제한하고, secret/service-role/DB password/connection string/JWT/CLI token은 server/admin secret으로 분리한다. 기준 문서는 `docs/engineering/auth-security/auth-login/auth-db-env-secret-verification-gates.md`이다.
- 2026-05-18 기준 DEN-31에서 server-only Supabase session reader contract를 추가했다. `readServerSession()`은 Supabase server client의 `auth.getClaims()`를 사용해 verified user claims를 읽고, mock fallback, unauthenticated, misconfigured, error 상태를 typed result로 반환한다. Route 전환, DB write, migration/RLS는 아직 범위 밖이며, DEN-32에서 demo identity header를 이 session seam으로 교체한다.
- 2026-05-18 기준 DEN-32에서 role update Route Handler의 actor identity source를 verified server session seam으로 전환했다. Authenticated Supabase session은 `sessionUserId`를 사용하고, demo header는 `mock_mode` fallback에서만 허용한다. Missing/invalid Supabase session은 demo header가 있어도 401로 거절된다.
- 2026-05-18 기준 DEN-33에서 auth guard/server session regression을 보강했다. Client `AuthGate`는 계속 `useAuthClient()` 경계에 머물고, role update route identity는 `readServerSession()` 경계에 머무는 것을 테스트로 고정했다. Mock fallback과 Supabase missing-session denial matrix도 auth regression에 추가했다.
- 2026-05-18 기준 DEN-34에서 workspace auth schema foundation migration을 작성했다. Migration은 `users`, `workspaces`, `user_profiles`, `user_memberships`, `workspace_invitations`, `permission_policies`를 만들고 canonical role/status constraint, workspace index, RLS enablement를 포함한다. RLS policy SQL, domain tables, billing/payment schema, remote Supabase 적용은 아직 범위 밖이다. 기준 문서는 `docs/engineering/auth-security/auth-login/workspace-auth-schema-migration.md`이다.
- 2026-05-18 기준 DEN-35에서 local migration validation 절차와 auth seed contract를 추가했다. `supabase/seed.sql`은 `clair-demo` workspace, deterministic auth users, canonical role memberships, role-scope permission policies를 제공한다. Legacy role compatibility는 `nurse -> technician`, `billing_admin -> hospital_admin`으로 문서화했다. 현재 환경은 Docker가 없어 실제 local DB apply는 실행하지 못했다.
- 2026-05-18 기준 DEN-36에서 마지막 active `hospital_admin` 보호를 위한 DB-level foundation을 추가했다. `private.clair_assert_not_last_active_hospital_admin()` trigger가 direct update/delete를 막고, `private.update_workspace_membership_roles(...)` helper skeleton은 후속 trusted server write 경계로 남긴다. 실제 DB apply는 Docker/local Supabase Postgres가 있는 환경에서 재검증해야 한다.
- 2026-05-18 기준 DEN-37에서 workspace auth table RLS baseline을 추가했다. Private helper `private.clair_is_active_workspace_member()`와 `private.clair_is_workspace_admin()`을 사용해 active member read boundary와 hospital admin write boundary를 분리했다. Clinical/business domain table RLS와 실제 local DB execution test는 아직 후속 범위다. 기준 문서는 `docs/engineering/auth-security/auth-login/workspace-membership-rls-baseline.md`이다.
- 2026-05-18 기준 DEN-38에서 DB-backed permission adapter boundary를 추가했다. DB users/memberships/role permission policy rows를 기존 `WorkspacePermissionAdapter` shape로 변환하고, resolver interface는 유지한다. Server-only wrapper와 testable core를 분리했다. 기준 문서는 `docs/engineering/auth-security/auth-login/db-backed-permission-adapter.md`이다.
- 2026-05-18 기준 DEN-39에서 server/RLS cross-workspace denial regression을 추가했다. Server route는 다른 workspace role mutation을 `403 workspace_membership_missing`으로 막고, resolver/RLS tests는 row workspace 기준 active membership만 허용하도록 고정했다. Denial matrix는 `docs/engineering/auth-security/auth-login/cross-workspace-denial-matrix.md`이다.
- 2026-05-18 기준 DEN-40에서 Project 01 live auth DB/RLS foundation 보안 리뷰를 완료했다. Server session, route identity, migration/RLS, last-admin guard, DB adapter, cross-workspace denial coverage는 handoff 가능하지만, 실제 Supabase migration/RLS execution, role management live DB write, remote staging/live validation은 pilot/live 전 blocker로 남는다. 기준 문서는 `docs/engineering/auth-security/auth-login/live-auth-db-rls-security-review.md`이다.
- 2026-05-18 기준 DEN-41에서 Project 01 handoff와 closeout을 작성했다. Project 02의 추천 첫 작업은 실제 Docker-backed local Supabase DB에 Project 01 migrations/seed를 적용하고 admin/member/non-member RLS behavior를 실행 검증하는 DB execution gate다. 기준 문서는 `docs/engineering/auth-security/auth-login/project-01-live-auth-db-rls-closeout.md`이다.
- 2026-05-18 기준 DEN-94에서 Project 02 Docker local Supabase DB/RLS execution gate를 완료했다. Docker-backed local Supabase가 실행됐고 Project 01 migrations/seed가 실제 DB에 적용됐다. 첫 RLS 실행에서 private helper execution grant 누락을 발견해 `supabase/migrations/20260518113052_workspace_rls_helper_function_grants.sql`로 수정했고, admin/member/unknown user read boundary와 last-admin DB guard를 실제 SQL로 검증했다. 기준 문서는 `docs/engineering/auth-security/auth-login/docker-local-supabase-rls-execution-gate.md`이다.
- 2026-05-18 기준 DEN-42에서 Project 02 workspace live persistence scope/dependency를 확정했다. Included scope는 workspace creation, persisted membership-backed workspace selector, invitations, invitation lifecycle, membership status reads, role management server handoff/persistence, and personal profile persistence다. Remote Supabase, real data, email delivery, subscription/payment, and Project 03+ clinical persistence remain approval-gated. 기준 문서는 `docs/engineering/auth-security/auth-login/workspace-live-persistence-scope.md`이다.
- 2026-05-18 기준 DEN-43에서 Project 02 workspace/member mutation server route contract를 확정했다. Protected routes use `readServerSession()` for actor identity, demo actor headers are mock-mode only, workspace/member admin mutations require active membership plus `role_permission:manage`, and profile writes reject authority fields. 기준 문서는 `docs/engineering/auth-security/auth-login/workspace-member-server-route-contract.md`이다.
- 2026-05-18 기준 DEN-44에서 `/workspace/new` workspace creation을 route-backed live persistence boundary로 전환했다. `POST /api/workspaces` preserves mock fallback and calls `public.clair_create_workspace_with_creator(...)` in Supabase mode to create workspace plus creator active `hospital_admin` membership. 기준 문서는 `docs/engineering/auth-security/auth-login/workspace-creation-live-persistence.md`이다.

## 완료된 작업

- `docs/completed/auth/2026-05-03-auth-roadmap-baseline.md`
- `docs/completed/auth/2026-05-03-auth-boundary.md`
- `docs/completed/auth/2026-05-03-login-ux-state.md`
- `docs/completed/auth/2026-05-03-supabase-auth-mapping.md`
- `docs/completed/auth/2026-05-03-supabase-integration-readiness.md`
- `docs/completed/auth/2026-05-03-supabase-provider-implementation.md`
- `docs/completed/auth/2026-05-03-membership-permission-enforcement.md`
- `docs/completed/design/2026-05-14-auth-login-token-cleanup.md`
- `docs/completed/auth/2026-05-17-den-18-workspace-auth-scope-report.html`
- `docs/completed/auth/2026-05-17-den-20-workspace-membership-data-security-report.html`
- `docs/completed/auth/2026-05-17-den-28-next-security-patch-report.html`
- `docs/completed/auth/2026-05-17-den-23-workspace-creation-foundation-report.html`
- `docs/completed/auth/2026-05-17-den-24-member-invitation-status-flow-report.html`
- `docs/completed/auth/2026-05-17-den-19-server-permission-resolver-contract-report.html`
- `docs/completed/auth/2026-05-17-den-25-role-management-admin-ui-report.html`
- `docs/completed/auth/2026-05-17-den-26-personal-profile-settings-report.html`
- `docs/completed/auth/2026-05-17-den-21-first-server-permission-enforcement-report.html`
- `docs/completed/auth/2026-05-18-den-29-live-supabase-readiness-report.html`
- `docs/completed/auth/2026-05-18-den-30-auth-db-env-secret-verification-gates-report.html`
- `docs/completed/auth/2026-05-18-den-31-server-session-reader-contract-report.html`
- `docs/completed/auth/2026-05-18-den-32-role-update-verified-session-seam-report.html`
- `docs/completed/auth/2026-05-18-den-33-auth-guard-server-session-regression-report.html`
- `docs/completed/auth/2026-05-18-den-34-workspace-auth-schema-migration-report.html`
- `docs/completed/auth/2026-05-18-den-35-local-migration-validation-auth-seed-report.html`
- `docs/completed/auth/2026-05-18-den-36-db-level-last-admin-protection-report.html`
- `docs/completed/auth/2026-05-18-den-37-workspace-membership-rls-baseline-report.html`
- `docs/completed/auth/2026-05-18-den-38-db-backed-permission-adapter-report.html`
- `docs/completed/auth/2026-05-18-den-39-cross-workspace-denial-regression-report.html`
- `docs/completed/auth/2026-05-18-den-40-live-auth-db-rls-security-review-report.html`
- `docs/completed/auth/2026-05-18-den-41-workspace-persistence-handoff-project-closeout-report.html`
- `docs/completed/auth/2026-05-18-den-94-docker-local-supabase-rls-execution-gate-report.html`
- `docs/completed/auth/2026-05-18-den-42-workspace-live-persistence-scope-report.html`
- `docs/completed/auth/2026-05-18-den-43-workspace-member-server-route-contract-report.html`
- `docs/completed/auth/2026-05-18-den-44-workspace-creation-live-persistence-report.html`
- GitHub PR #10: `feat: add auth transition boundary`

## 다음 작업

1. Continue Project 02 with DEN-45 persisted membership-backed workspace selector and shell context.
2. Keep remote Supabase operations approval-gated.
3. Use the Docker local Supabase DB/RLS gate as the baseline before live workspace/member persistence implementation.
4. Do not use real clinic, guardian, patient, or staff data.

## 금지 범위

- Supabase 실제 연결 전 package 설치, env 연결, API 호출을 하지 않는다.
- DB migration, RLS policy, server permission enforcement를 앞당겨 구현하지 않는다.
- password 검증, OAuth callback, MFA, refresh token, email verification을 직접 구현하지 않는다.
- auth 작업 명목으로 관련 없는 업무 화면을 수정하지 않는다.
- remote Supabase project link/push/SQL 실행은 별도 대표 승인 전까지 하지 않는다.

## 최근 검증

2026-05-03 MVP Auth transition sequence:

- `npm run lint`
- `rg "mvp-auth-transition-roadmap" docs/implementation`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/auth.spec.ts --reporter=line` (`9 passed`)
- `npx playwright test tests/app-shell.spec.ts tests/reception.spec.ts tests/billing.spec.ts tests/chart.spec.ts tests/lab-imaging.spec.ts tests/sales-demo-flow.spec.ts --reporter=line` (`44 passed`)

2026-05-03 Work Order 01 Supabase Auth Mapping:

- `npm run lint`
- `rg "Supabase Auth|user_memberships|permission_policies" docs/implementation`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-03-supabase-auth-mapping.md`에 남긴다.

2026-05-03 Work Order 02 Supabase Integration Readiness:

- `npm run lint`
- `rg "supabase-integration-readiness|@supabase/ssr|callback route|cookie session" docs/implementation`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-03-supabase-integration-readiness.md`에 남긴다.

2026-05-03 Work Order 03 Supabase Provider Implementation:

- Red: `npx playwright test tests/auth.spec.ts --reporter=line` failed on missing `src/lib/supabase/config.ts`
- Red: `npx playwright test tests/auth.spec.ts:168 --reporter=line` failed on missing `NEXT_PUBLIC_AUTH_MODE=mock` Playwright pin
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/auth.spec.ts --reporter=line` (`11 passed`)
- `npx playwright test tests/app-shell.spec.ts tests/reception.spec.ts tests/billing.spec.ts tests/chart.spec.ts tests/lab-imaging.spec.ts tests/sales-demo-flow.spec.ts --reporter=line` (`44 passed`)

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-03-supabase-provider-implementation.md`에 남긴다.

2026-05-03 Work Order 04 Membership Permission Enforcement:

- `npm run lint`
- `rg "membership|permission|RLS|server-side enforcement" docs/implementation`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-03-membership-permission-enforcement.md`에 남긴다.

2026-05-17 DEN-28 Next.js Security Patch:

- `npm audit --audit-level=high` (`found 0 vulnerabilities`)
- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/auth.spec.ts tests/app-shell.spec.ts --reporter=line` (`41 passed`)
- `npm run docs:check`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-17-den-28-next-security-patch-report.html`에 남긴다.

2026-05-17 DEN-23 Workspace Creation Foundation:

- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/auth.spec.ts --reporter=line` (`16 passed`)
- `npx playwright test tests/auth.spec.ts tests/app-shell.spec.ts --reporter=line` (`46 passed`)
- `npm run docs:check`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-17-den-23-workspace-creation-foundation-report.html`에 남긴다.

2026-05-17 DEN-24 Member Invitation Status Flow:

- Red: `npx playwright test tests/auth.spec.ts --reporter=line` failed because member management navigation and invitation contract functions were missing.
- `npx playwright test tests/auth.spec.ts --reporter=line` (`20 passed`)
- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/auth.spec.ts tests/app-shell.spec.ts --reporter=line` (`50 passed`)
- `npm run docs:check`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-17-den-24-member-invitation-status-flow-report.html`에 남긴다.

2026-05-17 DEN-19 Server Permission Resolver Contract:

- Red: `npx playwright test tests/permission-resolver.spec.ts --reporter=line` failed because the resolver module did not exist.
- `npx playwright test tests/permission-resolver.spec.ts --reporter=line` (`6 passed`)
- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/auth.spec.ts tests/permission-resolver.spec.ts --reporter=line` (`26 passed`)
- `npm run docs:check`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-17-den-19-server-permission-resolver-contract-report.html`에 남긴다.

2026-05-17 DEN-25 Role Management Admin UI:

- Red: `npx playwright test tests/auth.spec.ts --reporter=line` failed because role edit UI actions and session membership mutation helpers did not exist.
- `npx playwright test tests/auth.spec.ts --reporter=line` (`23 passed`)
- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/auth.spec.ts tests/permission-resolver.spec.ts tests/app-shell.spec.ts --reporter=line` (`59 passed`)
- `npm run docs:check`
- Local browser smoke via Playwright against `http://localhost:3000`: role summary rendered and last-admin guard message was visible.

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-17-den-25-role-management-admin-ui-report.html`에 남긴다.

2026-05-17 DEN-26 Personal Profile Settings:

- Red: `npx playwright test tests/auth.spec.ts --reporter=line` failed because profile settings session contract and UI did not exist.
- `npx playwright test tests/auth.spec.ts -g "profile" --reporter=line` (`3 passed`)
- `npx playwright test tests/auth.spec.ts --reporter=line` (`26 passed`)
- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/auth.spec.ts tests/permission-resolver.spec.ts tests/app-shell.spec.ts --reporter=line` (`62 passed`)
- `npm run docs:check`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-17-den-26-personal-profile-settings-report.html`에 남긴다.

2026-05-17 DEN-21 First Server Permission Enforcement Slice:

- Red: `npx playwright test tests/server-permission-enforcement.spec.ts --reporter=line` failed with 404 because the route did not exist.
- `npx playwright test tests/server-permission-enforcement.spec.ts --reporter=line` (`4 passed`)
- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/auth.spec.ts tests/permission-resolver.spec.ts tests/server-permission-enforcement.spec.ts --reporter=line` (`36 passed`)
- `npm run docs:check`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-17-den-21-first-server-permission-enforcement-report.html`에 남긴다.

2026-05-17 DEN-27 Security Review Workspace Auth Permission Boundary:

- CSO review checked workspace creation, invitation, role management, profile settings, permission resolver, and first server enforcement slice.
- Verified no user-editable profile field is used as an authorization source.
- Verified additive multi-role behavior and desk/technician chart update denial are covered by resolver tests.
- Verified the server role-update boundary is `server-only` and does not use browser storage APIs.
- Identified three live-readiness follow-ups: replace demo identity header with verified Supabase server session, route role management UI through server enforcement, and implement transactional DB/RPC last-admin protection before live writes.
- `npm run docs:check`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-17-den-27-workspace-auth-security-review-report.html`에 남긴다.

2026-05-18 DEN-40 Security Review Live Auth DB/RLS Foundation:

- Source/security `rg` scan reviewed server session, role route, migration/RLS, DB adapter, metadata, secret, and client-storage patterns.
- `npx playwright test tests/server-session-reader.spec.ts tests/server-permission-enforcement.spec.ts tests/workspace-membership-rls-migration.spec.ts tests/workspace-last-admin-protection-migration.spec.ts tests/db-workspace-permission-adapter.spec.ts tests/permission-resolver.spec.ts --reporter=line` (`26 passed`)
- `npm audit --audit-level=high` (`found 0 vulnerabilities`)
- `npm run docs:check`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-40-live-auth-db-rls-security-review-report.html`에 남긴다.

2026-05-18 DEN-41 Workspace Persistence Handoff and Project Closeout:

- Packaged Project 01 milestones, handoff assets, blockers, do-not-do gates, and the recommended first Project 02 issue.
- `npm run docs:check`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-41-workspace-persistence-handoff-project-closeout-report.html`에 남긴다.

2026-05-18 DEN-94 Docker Local Supabase RLS Execution Gate:

- Docker local Supabase started successfully.
- `npx supabase db reset --local` applied Project 01 migrations/seed plus the DEN-94 RLS helper grant migration.
- Focused SQL verified admin/member read visibility, unknown user denial, and DB last-admin protection.
- `npx playwright test tests/workspace-membership-rls-migration.spec.ts tests/workspace-last-admin-protection-migration.spec.ts --reporter=line` (`6 passed`)

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-94-docker-local-supabase-rls-execution-gate-report.html`에 남긴다.

2026-05-18 DEN-42 Workspace Live Persistence Scope:

- Confirmed Project 02 scope and dependency order after the Docker local Supabase DB/RLS gate.
- Excluded remote Supabase, real data, email delivery, subscription/payment, and Project 03+ clinical persistence unless separately approved.
- Recommended DEN-43 as the next issue before workspace/member mutation implementation.
- `npm run docs:check`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-42-workspace-live-persistence-scope-report.html`에 남긴다.

2026-05-18 DEN-43 Workspace and Member Server Route Contract:

- Defined route candidates for workspace creation, workspace selector read, invitations, membership reads, role/status mutation, and personal profile save.
- Fixed actor identity, permission requirements, denial reasons, mock fallback behavior, and route-level test strategy.
- Preserved approval gates for remote Supabase, elevated secrets, real email delivery, payment/subscription, and Project 03+ clinical persistence.
- `npm run docs:check`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-43-workspace-member-server-route-contract-report.html`에 남긴다.

2026-05-18 DEN-44 Workspace Creation Live Persistence:

- Added `POST /api/workspaces` and `src/features/auth/server-workspace-creation.ts`.
- Added local-first transaction RPC migration `20260518120000_workspace_creation_transaction.sql`.
- Updated `/workspace/new` to call the server route before browser-side temporary workspace state update and navigation.
- Verified local Supabase migration apply plus focused SQL RPC execution and duplicate guard.
- `npx playwright test tests/workspace-creation-server.spec.ts tests/auth.spec.ts -g "route-backed workspace|workspace creation server" --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- `npm run build`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-44-workspace-creation-live-persistence-report.html`에 남긴다.

2026-05-18 DEN-45 Workspace Membership List Live Read:

- Added `GET /api/workspaces` and `src/features/auth/server-workspace-list.ts`.
- Added local-first reader RPC migration `20260518121000_workspace_membership_list_reader.sql`.
- Updated shell workspace display lookup to prefer persisted active membership data when available.
- Preserved browser-state fallback for mock/demo workspace flows.
- Verified local Supabase migration apply plus focused SQL reader execution.
- `npx playwright test tests/workspace-list-server.spec.ts tests/app-shell.spec.ts -g "workspace list|persisted workspace display" --reporter=line`
- `npx playwright test tests/workspace-list-server.spec.ts tests/app-shell.spec.ts tests/auth.spec.ts -g "workspace list|persisted workspace display|route-backed workspace" --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- `npm run build`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-45-workspace-membership-list-live-read-report.html`에 남긴다.

2026-05-18 DEN-46 Workspace Invitation Create Live Persistence:

- Added `POST /api/workspaces/[workspaceId]/invitations` and `src/features/auth/server-workspace-invitation.ts`.
- Added local-first transaction RPC migration `20260518122000_workspace_invitation_create_transaction.sql`.
- Updated `WorkspaceMembershipManagement` to call the server route for invitation creation before updating mock/browser fallback state.
- Verified local Supabase migration apply plus focused SQL create, duplicate, non-admin, and active-member guard execution.
- `npx playwright test tests/workspace-invitation-server.spec.ts tests/auth.spec.ts -g "workspace invitation|route-backed member invitations" --reporter=line`
- `npx playwright test tests/workspace-invitation-server.spec.ts tests/auth.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- `npm run build`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-46-workspace-invitation-create-live-persistence-report.html`에 남긴다.

2026-05-18 DEN-47 Workspace Invitation Lifecycle Live Persistence:

- Added invitation resend, cancel, and accept Route Handlers.
- Added `src/features/auth/server-workspace-invitation-lifecycle.ts`.
- Added local-first lifecycle transaction RPC migration `20260518123000_workspace_invitation_lifecycle_transactions.sql`.
- Updated invitation action buttons to call server routes before applying mock/browser fallback state.
- Verified local Supabase migration apply plus focused SQL resend, cancel, not-pending guard, and accept-to-membership execution.
- `npx playwright test tests/workspace-invitation-lifecycle-server.spec.ts tests/auth.spec.ts -g "invitation lifecycle|route-backed member invitations|pending invitations can be canceled" --reporter=line`
- `npx playwright test tests/workspace-invitation-lifecycle-server.spec.ts tests/workspace-invitation-server.spec.ts tests/auth.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- `npm run build`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-47-workspace-invitation-lifecycle-live-persistence-report.html`에 남긴다.

2026-05-18 DEN-48 Workspace Membership Status Live Read:

- Added `GET /api/workspaces/[workspaceId]/memberships`.
- Added `src/features/auth/server-workspace-membership-status.ts`.
- Added local-first status reader RPC migration `20260518124000_workspace_member_status_reader.sql`.
- Updated hospital admin membership UI to fetch persisted memberships and invitations for list/count display.
- Verified local Supabase migration apply plus focused SQL admin read and non-admin denial.
- `npx playwright test tests/workspace-membership-status-server.spec.ts --reporter=line`
- `npx playwright test tests/workspace-membership-status-server.spec.ts tests/auth.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- `npm run build`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-48-workspace-membership-status-live-read-report.html`에 남긴다.

2026-05-18 DEN-49 Workspace Role Edit Server Enforcement UI:

- Routed role edit confirm path through `POST /api/workspaces/[workspaceId]/memberships/[membershipId]/roles`.
- Added route pending/error handling before applying local fallback state.
- Adjusted demo permission adapter to support dynamic UI workspace/member ids while preserving cross-workspace denial regression.
- `npx playwright test tests/auth.spec.ts tests/server-permission-enforcement.spec.ts -g "edit active member roles|role update server" --reporter=line`
- `npx tsc --noEmit`
- `npm run build`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-49-workspace-role-edit-server-enforcement-ui-report.html`에 남긴다.

2026-05-18 DEN-50 Workspace Role Status DB Persistence:

- Added `PATCH /api/workspaces/[workspaceId]/memberships/[membershipId]/status`.
- Extended Supabase-mode role update route to call `public.clair_update_workspace_membership_roles(...)`.
- Added local-first DB wrappers `public.clair_update_workspace_membership_roles(...)` and `public.clair_update_workspace_membership_status(...)`.
- Updated deactivation UI to call the server status route before applying local fallback state.
- Verified DB role/status updates, last-admin guard, and non-admin denial with focused SQL.
- `npx playwright test tests/workspace-role-status-write-server.spec.ts tests/auth.spec.ts tests/server-permission-enforcement.spec.ts tests/permission-resolver.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- `npm run build`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-50-workspace-role-status-db-persistence-report.html`에 남긴다.

2026-05-18 DEN-51 Workspace Role Management Regression Coverage:

- Added `tests/workspace-role-management-regression.spec.ts`.
- Covered hospital admin success, non-admin denial, cross-workspace denial, and last-admin demotion/deactivation guard discoverability.
- `npx playwright test tests/workspace-role-management-regression.spec.ts tests/auth.spec.ts tests/server-permission-enforcement.spec.ts tests/workspace-role-status-write-server.spec.ts --reporter=line` (`37 passed`)

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-51-workspace-role-management-regression-coverage-report.html`에 남긴다.

2026-05-18 DEN-52 Personal Profile Live Persistence:

- Added `PATCH /api/users/me/profile`.
- Added `src/features/auth/server-personal-profile.ts`.
- Added local-first profile persistence RPC migration `20260518130000_personal_profile_persistence.sql`.
- Updated personal profile settings to save through the server route before updating browser display state.
- Verified editable profile fields stay separated from role, permission, and membership authority sources.
- `npx playwright test tests/personal-profile-server.spec.ts tests/auth.spec.ts -g "personal profile" --reporter=line`
- `npx playwright test tests/personal-profile-server.spec.ts tests/auth.spec.ts --reporter=line` (`29 passed`)
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- Focused local SQL execution for `public.clair_save_personal_profile(...)`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-52-personal-profile-live-persistence-report.html`에 남긴다.

2026-05-18 DEN-95 Live Persistence Secret Scanning Gate:

- Added `scripts/scan-secrets.mjs`.
- Added `npm run security:secrets`.
- Added `.github/workflows/secret-scan.yml`.
- Scanner covers tracked env files, OpenAI/Stripe/Supabase token-like values, JWT-like secrets, DB URLs with passwords, secret env assignments, and unsafe `NEXT_PUBLIC_*` secret naming.
- Safe placeholders and localhost DB examples are allowed.
- `node scripts/scan-secrets.mjs --self-test`
- `npm run security:secrets`
- `git ls-files '.env*' '.vercel/.env*' '**/.env*'` returned no tracked env files.

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-95-live-persistence-secret-scanning-gate-report.html`에 남긴다.

2026-05-18 DEN-96 API Error And Telemetry Contract:

- Added `docs/engineering/auth-security/auth-login/api-error-telemetry-contract.md`.
- Defined success/failure response envelopes with `ok`, `requestId`, stable `error`, `denialReason`, and optional `fieldErrors`.
- Defined status code matrix for validation, authentication, permission, missing target, conflict, rate limit, and server failure paths.
- Defined safe server log context and raw token/password/DB connection/stack trace leak prohibitions.
- Reviewed current workspace/member/profile route shapes.
- `rg -n "Response.json|NextResponse.json|catch|requestId|denialReason|db_write_failed" src/app/api src/features/auth`
- `npm run docs:check`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-96-api-error-telemetry-contract-report.html`에 남긴다.

2026-05-18 DEN-97 Workspace Live API Rate Limiting:

- Added `src/lib/security/rate-limit.ts`.
- Applied `enforceWorkspaceMutationRateLimit(...)` to workspace creation, invitation create/resend/cancel/accept, membership role/status mutation, and personal profile update routes.
- Default local-first policy is actor + workspace/self + operation + client fingerprint, 60 requests per 60 seconds.
- Excess requests return `429`, `Retry-After`, and `{ ok: false, error: "rate_limited" }`.
- Added `tests/workspace-rate-limit-server.spec.ts`.
- `npx playwright test tests/workspace-rate-limit-server.spec.ts --reporter=line` (`2 passed`)
- `npx playwright test tests/workspace-rate-limit-server.spec.ts tests/server-permission-enforcement.spec.ts tests/workspace-invitation-server.spec.ts --reporter=line` (`11 passed`)
- `npx tsc --noEmit`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-97-workspace-live-api-rate-limiting-report.html`에 남긴다.

2026-05-18 DEN-98 Workspace Persistence Security Review:

- Reviewed DEN-95 secret scan, DEN-96 API error/telemetry contract, DEN-97 rate limit boundary, and workspace/RLS regression status.
- No local-first Project 02 Human Review handoff blocker was found.
- Follow-ups before remote/staging live: shared rate limit store, route-wide `requestId`/safe logging helper, Supabase advisors/security-definer RPC review, and production log redaction.
- `git ls-files '.env*' '.vercel/.env*' '**/.env*'` returned no tracked env files.
- `npm run security:secrets`
- `npm audit --audit-level=high` (`found 0 vulnerabilities`)
- `npx playwright test tests/workspace-rate-limit-server.spec.ts tests/workspace-membership-rls-migration.spec.ts tests/workspace-last-admin-protection-migration.spec.ts tests/workspace-role-status-write-server.spec.ts tests/server-permission-enforcement.spec.ts --reporter=line` (`16 passed`)

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-98-workspace-persistence-security-review-report.html`에 남긴다.

2026-05-18 DEN-53 Project 02 Workspace Persistence Closeout:

- Added `docs/engineering/auth-security/auth-login/project-02-workspace-membership-live-persistence-closeout.md`.
- Added `docs/engineering/auth-security/auth-login/reception-persistence-workspace-context-handoff.md`.
- Added closeout work item and Korean HTML report.
- Project 02 is ready for 승욱 Human Review.
- Future Project 03 must start only after explicit approval and should use the handoff context contract.
- `npm run docs:check`

검증 결과와 세부 결정은 `docs/completed/auth/2026-05-18-den-53-project-02-workspace-persistence-closeout-report.html`에 남긴다.
