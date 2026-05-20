# Auth Login Status

Updated: 2026-05-20

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

2026-05-20 DEN-148 SaaS Launch Foundation Scope Audit:

- Audited existing Linear initiatives/projects/issues and local auth/workspace docs/code before starting SaaS launch implementation.
- Confirmed the new `CLAiR EMR SaaS Launch Foundation` should reuse existing login, workspace membership, invitation lifecycle, RLS, permission resolver, and local-first persistence foundation instead of rebuilding it.
- Identified new launch gaps: CLAiR operator tenant approval, first admin invite, public invite-link onboarding, account creation/linking, staging/email/deploy approval gates, shared production rate limit store, route-wide request id/safe logging helper adoption, Supabase advisor/RPC review, and production log redaction.
- Did not implement code, DB migration, remote Supabase operations, email delivery, or production deploy.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-148-saas-launch-scope-audit-report.html`에 남긴다.

2026-05-20 DEN-149 Invite-Only B2B SaaS Launch Architecture:

- Fixed the launch architecture as an approved-hospital-only B2B SaaS flow rather than public self-service signup.
- Defined the actor boundaries for CLAiR operator, hospital admin, invited staff, Supabase Auth user, and app membership records.
- Documented the launch flow: CLAiR hospital approval, workspace creation/approval, first `hospital_admin` invitation, admin account setup, staff invitation, staff acceptance, workspace entry, and audit/safety coverage.
- Split responsibility between Supabase Auth identity/session, app DB membership/permission source, server route/RPC enforcement, client UX, and CLAiR operations.
- Defined first vertical slice acceptance criteria and confirmed public signup may later become request-access only, not active workspace creation.
- Did not implement UI, DB migration, remote Supabase operations, real email delivery, production deploy, payment/subscription, or role-policy changes.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-149-invite-only-b2b-saas-launch-architecture-report.html`에 남긴다.

2026-05-20 DEN-150 SaaS Launch Approval Gates:

- Defined explicit representative approval gates for remote Supabase staging/live, DB/RLS execution, real email delivery, production deploy, role/permission policy changes, real data, and payment/subscription work.
- Clarified that project or issue approval does not implicitly approve high-risk execution.
- Added required approval inputs: target environment, operation, affected files/settings/routes, secret/input source, preflight verification, post-change verification, rollback/stop condition, user/data impact, and explicit non-touched scope.
- Split launch blockers from non-blockers for local-first implementation.
- Reused DEN-29/DEN-30 local-first Supabase and secret-handling rules, DEN-96 API error/telemetry, DEN-97 rate limiting, and DEN-98 remote/staging blockers.
- Did not execute remote Supabase, DB/RLS changes, email delivery, production deploy, role-policy changes, payment/subscription work, or real data operations.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-150-saas-launch-approval-gates-report.html`에 남긴다.

2026-05-20 DEN-151 Auth Runtime Mode And Session Contract:

- Added `getAuthRuntimeMode()` to make auth mode, provider selection, client session source, server session source, and missing-config behavior explicit.
- Updated `useAuthClient()` to consume the shared runtime mode helper instead of recomputing provider/config state locally.
- Added regression coverage for `mock`, `auto` without Supabase env, `auto` with Supabase env, explicit `supabase` without env, explicit `supabase` with env, and invalid mode fallback.
- Documented the runtime mode table, client contract, server contract, verified coverage, and remaining staging/live blockers.
- Confirmed Next.js `NEXT_PUBLIC_` values are browser-bundled at build time, so staging/live builds need target-correct public env values.
- Red: `npx playwright test tests/auth.spec.ts -g "auth runtime mode matrix" --reporter=line` failed before `getAuthRuntimeMode()` existed.
- `npx playwright test tests/auth.spec.ts -g "auth runtime mode matrix" --reporter=line`
- `npm run lint` (passed with existing warnings only)
- `npx tsc --noEmit`
- `npx playwright test tests/auth.spec.ts tests/server-session-reader.spec.ts --reporter=line` (`34 passed`)
- `npm run docs:check`
- `npm run build`
- `npm run security:secrets`
- Did not perform remote Supabase work, DB/RLS changes, email delivery, production deploy, role-policy changes, or real data operations.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-151-auth-runtime-session-contract-report.html`에 남긴다.

2026-05-20 DEN-152 Login Logout And Stale Session UX:

- Added login-screen contextual auth state notices for `session_required`, `signed_out`, and `unauthorized`.
- Updated `AuthGate` to redirect unauthenticated protected workspace access with `reason=session_required` while preserving safe `next`.
- Updated shell logout redirects in `TopMenu` and `WorkspaceTabsBar` to `/login?reason=signed_out`.
- Added regression coverage for session-required redirect copy, signed-out copy, and unsafe external `next` fallback.
- Preserved mock/local demo auth behavior and DEN-151 runtime provider selection.
- Red: `npx playwright test tests/auth.spec.ts -g "workspace routes require login|login ignores unsafe next|logout clears mock session" --reporter=line` failed before session reason UX existed.
- `npx playwright test tests/auth.spec.ts -g "workspace routes require login|login ignores unsafe next|logout clears mock session" --reporter=line` (`3 passed`)
- `npx playwright test tests/auth.spec.ts tests/app-shell.spec.ts --reporter=line` (`60 passed`)
- `npm run lint` (passed with existing warnings only)
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run build`
- `npm run security:secrets`
- `git diff --check`
- Did not implement a new auth provider, MFA, password reset, remote Supabase work, DB/RLS changes, email delivery, production deploy, role-policy changes, or real data operations.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-152-login-logout-stale-session-ux-report.html`에 남긴다.

2026-05-20 DEN-153 Workspace Selector Active Membership Runtime:

- Added active-membership runtime guarding to protected workspace entry by passing `workspaceId` into `AuthGate`.
- Session-only workspace access now checks the current session id against the requested workspace membership and allows only `active`.
- Added `pending` to the session workspace membership status contract so pending/inactive/suspended/missing states are explicit.
- Split persisted workspace list row mapping into `server-workspace-list-core.ts` and defensively filters non-active rows out of the selector path.
- Added regression coverage for inactive session workspace denial, active-only session access contract, and active-only persisted list mapping.
- Membership access table: `active` is listed/allowed; `pending`, `inactive`, `suspended`, and missing membership are excluded/blocked; missing session redirects with `reason=session_required`.
- Remaining route/server hardening: page shell entry guard does not replace server-side active membership checks on reception, clinical, billing, admin, or audit data routes.
- Red: `npx playwright test tests/workspace-list-server.spec.ts -g "active memberships only" --reporter=line` failed before the active-only mapper existed.
- Red: `npx playwright test tests/auth.spec.ts -g "workspace route blocks session workspaces|session workspace access contract" --reporter=line` failed before workspace entry checked active membership.
- Green: both focused test commands passed after implementation.
- `npx playwright test tests/auth.spec.ts tests/app-shell.spec.ts tests/workspace-list-server.spec.ts tests/permission-resolver.spec.ts --reporter=line` (`72 passed`)
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run lint` (passed with existing warnings only)
- `npm run build`
- `npm run security:secrets`
- `git diff --check`
- Did not implement hospital approval admin, invite acceptance screen, clinical data RLS validation, remote Supabase work, email delivery, production deploy, role-policy changes, or real data operations.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-153-workspace-selector-active-membership-runtime-report.html`에 남긴다.

2026-05-20 DEN-154 Password Reset And Account Recovery Policy:

- Added `docs/engineering/auth-security/auth-login/account-recovery-and-invite-account-policy.md`.
- Defined the launch policy that Supabase Auth owns password reset, recovery redirect, authenticated password update, session, email verification, and future MFA, while CLAiR app DB/server owns tenant approval, invitation, app users, membership, roles, permission, duplicate handling, and audit.
- Confirmed public self-signup remains excluded from launch account creation and workspace membership activation.
- Defined existing-account invitation behavior: verified email links to a pending invitation; active same-workspace membership blocks duplicate membership; other-workspace membership can receive another valid workspace membership.
- Defined inactive/suspended/reinvite policy: inactive can be explicitly reactivated while preserving membership history; suspended cannot self-reactivate through invite acceptance.
- Proposed follow-up issues for forgot/reset password UX, public invite acceptance account linking, account recovery regression, and audited reactivation route.
- Checked Supabase changelog and current Supabase Auth docs for password reset, passwordless email, Auth Admin secret-key boundary, invite links, and generated links.
- `npm run docs:check`
- `npm run security:secrets`
- Did not implement password reset UI, email provider setup, MFA, remote Supabase work, DB/RLS changes, real email delivery, production deploy, or real data operations.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-154-account-recovery-policy-report.html`에 남긴다.

2026-05-20 DEN-155 CLAiR Operator Access Model And Admin Guard:

- Added `docs/engineering/auth-security/auth-login/clair-operator-access-model-and-admin-guard.md`.
- Defined CLAiR operator authority as a separate server-owned source, not a normal hospital workspace role.
- Kept canonical MVP hospital roles unchanged: `hospital_admin`, `vet`, `technician`, and `front_desk`.
- Defined the operator guard sequence: `readServerSession()`, server-owned operator allowlist/table, active operator status, required operator permission, tenant state validation, duplicate/safety guards, safe audit event, and safe response envelope.
- Added recommended ops route families, denial reasons, audit event requirements, break-glass exclusions, and implementation blockers for DEN-156 through DEN-158.
- Recorded MFA/strong-auth as a staging/live readiness requirement for CLAiR operators, without implementing MFA in DEN-155.
- Checked existing permission resolver contracts and confirmed CLAiR operator guard does not replace workspace-scoped membership/permission enforcement.
- Checked Supabase changelog, MFA docs, and product security docs.
- Did not implement ops admin UI, DB/RLS migration, remote Supabase work, real email delivery, production deploy, role-policy changes, or real data operations.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-155-clair-operator-access-model-report.html`에 남긴다.

2026-05-20 DEN-156 Tenant Application Approval Workspace Model:

- Added `src/features/ops/tenant-application-model.ts` with tenant application statuses `pending_review`, `on_hold`, `approved`, and `rejected`.
- Added workspace gate logic so unapproved applications are blocked with `tenant_not_approved`, rejected applications are blocked with `tenant_rejected`, approved applications without a workspace are eligible, and existing workspaces are blocked with `tenant_workspace_exists`.
- Added synthetic local seed data in `src/features/ops/tenant-approval-data.ts`.
- Added `/ops/tenant-approvals` as a local/mock read-only CLAiR ops surface wrapped by the existing `AuthGate`.
- The surface shows pending/held/approved/workspace-connected tenants, workspace readiness, first admin invite placeholder, state machine, and audit hook points.
- Kept mock fallback intentionally. DEN-157 must connect server operator guard, persistence action, workspace creation, and first `hospital_admin` invitation before mutation behavior is considered secure.
- Added `tests/ops-tenant-approval.spec.ts`.
- Added `docs/engineering/auth-security/auth-login/tenant-application-approval-workspace-model.md`.
- Red: `npx playwright test tests/ops-tenant-approval.spec.ts --reporter=line` failed before the tenant model and ops route existed.
- Green: `npx playwright test tests/ops-tenant-approval.spec.ts --reporter=line` (`2 passed`)
- `npx playwright test tests/ops-tenant-approval.spec.ts tests/auth.spec.ts --reporter=line` (`33 passed`)
- `npx tsc --noEmit`
- `npm run lint` (passed with existing warnings only)
- `npm run docs:check`
- `npm run build`
- `npm run security:secrets`
- `git diff --check`
- Local Playwright browser smoke confirmed the `/ops/tenant-approvals` heading and pending row workspace gate.
- Did not implement public application form, DB/RLS migration, remote Supabase work, real email delivery, payment/subscription integration, production data import, or live operator mutation.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-156-tenant-application-approval-surface-report.html`에 남긴다.

2026-05-20 DEN-157 Approved Workspace Creation And First Admin Invite Action:

- Added `POST /api/ops/tenant-applications/[applicationId]/workspace`.
- Added `src/features/ops/server-tenant-workspace-action-core.ts` and server-only wrapper `src/features/ops/server-tenant-workspace-action.ts`.
- The route resolves actor identity through `readServerSession()` and accepts demo actor header only in mock fallback.
- Added a server-owned mock operator adapter requiring active CLAiR operator status and `tenant_approval:manage`.
- Approved tenant applications without an existing workspace can now return a local-first workspace record and first pending `hospital_admin` invitation record.
- Denial scenarios include `unauthenticated`, `operator_missing`, `operator_inactive`, `operator_permission_missing`, `invalid_input`, `target_tenant_application_missing`, `tenant_not_approved`, `tenant_rejected`, `tenant_workspace_exists`, and `first_admin_invitation_exists`.
- Added audit hook events `ops.workspace_created_for_tenant` and `ops.first_admin_invitation_created`.
- Email delivery remains `not_sent_approval_gated`; no real email provider or outbound email was enabled.
- Added `tests/ops-tenant-workspace-action.spec.ts`.
- Added `docs/engineering/auth-security/auth-login/approved-tenant-workspace-first-admin-invite-action.md`.
- Checked Supabase changelog, product security docs, and Auth users docs for relevant security guidance.
- Red: `npx playwright test tests/ops-tenant-workspace-action.spec.ts --reporter=line` failed before the action module and route existed.
- Green: `npx playwright test tests/ops-tenant-workspace-action.spec.ts --reporter=line` (`4 passed`)
- `npx playwright test tests/ops-tenant-workspace-action.spec.ts tests/ops-tenant-approval.spec.ts tests/auth.spec.ts --reporter=line` (`37 passed`)
- `npx tsc --noEmit`
- `npm run lint` (passed with existing warnings only)
- `npm run docs:check`
- `npm run build`
- `npm run security:secrets`
- `git diff --check`
- Did not implement remote Supabase persistence, DB/RLS migration, real email delivery, full staff invite flow, production Supabase execution, role-policy changes, payment/subscription integration, or real data operations.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-157-approved-workspace-first-admin-invite-report.html`에 남긴다.

2026-05-20 DEN-158 Tenant Status Management And Ops Audit Handoff:

- Added `src/features/ops/tenant-status-policy.ts`.
- Defined tenant operational statuses: `trial`, `active`, `suspended`, and `archived`.
- `trial` and `active` allow workspace entry, first admin invite, and staff invites; `suspended` and `archived` block those actions.
- Billing enforcement remains `not_enforced` because subscription enforcement is out of Project 02.
- Added allowed transition rules and safe denial reasons `invalid_tenant_status_transition` and `tenant_status_unchanged`.
- Added `ops.tenant_status_changed` audit event contract.
- Updated `/ops/tenant-approvals` to show tenant status policy and Project 03 invite handoff criteria.
- Added `tests/ops-tenant-status-policy.spec.ts`.
- Added `docs/engineering/auth-security/auth-login/tenant-status-management-ops-audit-handoff.md`.
- Project 03 handoff: staff invite creation should require approved tenant application, tenant status `trial` or `active`, existing workspace, first `hospital_admin` invitation/account path, active hospital admin actor, duplicate checks, and continued real-email approval gate.
- Red: `npx playwright test tests/ops-tenant-status-policy.spec.ts --reporter=line` failed before the tenant status policy module existed.
- Green: `npx playwright test tests/ops-tenant-status-policy.spec.ts --reporter=line` (`4 passed`)
- Regression: `npx playwright test tests/ops-tenant-status-policy.spec.ts tests/ops-tenant-workspace-action.spec.ts tests/ops-tenant-approval.spec.ts tests/auth.spec.ts --reporter=line` (`41 passed`)
- `npx tsc --noEmit`, `npm run docs:check`, `npm run build`, `npm run security:secrets`, and `git diff --check` passed.
- `npm run lint` passed with existing warnings only.
- Did not implement production support console, billing subscription enforcement, customer data mutation, tenant status DB persistence, remote Supabase work, real email delivery, or production deploy.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-158-tenant-status-ops-audit-handoff-report.html`에 남긴다.

2026-05-20 DEN-159 Hospital Admin Staff Invitation Creation Contract:

- Strengthened `POST /api/workspaces/[workspaceId]/invitations` as the Project 03 staff invitation creation contract.
- Success responses now explicitly report `emailDelivery: not_sent_approval_gated` and `inviteLink: not_generated_approval_gated`.
- The route response avoids raw invite tokens, OTPs, magic links, provider payloads, auth headers, and secret keys.
- Added mock fallback server duplicate checks for pending invitation email and active member email.
- Preserved server actor resolution, mutation rate limiting, `role_permission:manage` authorization, role validation, and safe denial categories.
- Added `docs/engineering/auth-security/auth-login/hospital-admin-staff-invitation-creation-contract.md`.
- Red: `npx playwright test tests/workspace-invitation-server.spec.ts --reporter=line` failed before email/link gate and mock duplicate server checks were implemented.
- Green: `npx playwright test tests/workspace-invitation-server.spec.ts --reporter=line` (`4 passed`)
- Focused regression: `npx playwright test tests/workspace-invitation-server.spec.ts tests/auth.spec.ts -g "workspace invitation|route-backed member invitations|pending invitations can be canceled|non-admin roles cannot manage workspace invitations|hospital admin can manage route-backed member invitations" --reporter=line` (`8 passed`)
- Regression: `npx playwright test tests/workspace-invitation-server.spec.ts tests/workspace-invitation-lifecycle-server.spec.ts tests/auth.spec.ts --reporter=line` (`38 passed`)
- `npx tsc --noEmit`, `npm run docs:check`, `npm run build`, `npm run security:secrets`, and `git diff --check` passed.
- `npm run lint` passed with existing warnings only.
- Did not implement invite acceptance UI, real email delivery, raw invite link/token generation, billing seat count, DB/RLS migration, remote Supabase work, production deploy, or real staff data.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-159-hospital-admin-staff-invitation-contract-report.html`에 남긴다.

2026-05-20 DEN-160 Invite Acceptance Account Linking Screen:

- Added public local-first invite acceptance page at `/invite/[invitationId]`.
- Added `src/features/auth/invite-acceptance-model.ts` for deterministic pending/expired/canceled/accepted/missing invite states.
- Added `src/features/auth/invite-acceptance-screen.tsx` with new-account and existing-account linking modes.
- Pending invites call the existing server accept route, persist a local mock session for `invitee:[email]`, store an active membership, and redirect only to the invited workspace reception route.
- Expired, canceled, already accepted, and missing invitations do not expose account creation actions and do not create local session or workspace state.
- Red: `npx playwright test tests/invite-acceptance.spec.ts --reporter=line` failed before the invite acceptance page existed.
- Green: `npx playwright test tests/invite-acceptance.spec.ts --reporter=line` (`3 passed`)
- Regression: `npx playwright test tests/invite-acceptance.spec.ts tests/workspace-invitation-lifecycle-server.spec.ts tests/workspace-invitation-server.spec.ts tests/auth.spec.ts --reporter=line` (`41 passed`)
- `npx tsc --noEmit`, `npm run docs:check`, `npm run build`, `npm run security:secrets`, and `git diff --check` passed.
- `npm run lint` passed with existing warnings only.
- Did not implement real Supabase signup/password/account linking, production invite token verification, email templates/delivery, MFA, DB/RLS migration, remote Supabase work, production deploy, or real staff data.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-160-invite-acceptance-account-linking-screen-report.html`에 남긴다.

2026-05-20 DEN-161 Invitation Resend Cancel And Expiration Lifecycle:

- Strengthened invitation lifecycle state handling in `src/features/auth/server-workspace-invitation-lifecycle.ts`.
- Pending invitations now return safe audit hook events for `workspace.invitation_resent`, `workspace.invitation_canceled`, and `workspace.invitation_accepted`.
- Resend returns `resentAt` and `resendCount`; cancel returns `canceledAt`; accept returns active membership plus `acceptedAt`.
- Expired invitations return `invitation_expired` and do not create membership.
- Canceled and already accepted invitations return `invitation_not_pending` and do not create duplicate membership.
- Unknown invitations return `target_invitation_missing`.
- Dynamic mock invitation ids created by the admin UI remain treated as pending for local-first resend/cancel/accept compatibility.
- Added `docs/engineering/auth-security/auth-login/invitation-resend-cancel-expiration-lifecycle.md`.
- Red: `npx playwright test tests/workspace-invitation-lifecycle-server.spec.ts --reporter=line` failed before audit events and expired/closed invite denial existed.
- Green: `npx playwright test tests/workspace-invitation-lifecycle-server.spec.ts --reporter=line` (`4 passed`)
- Regression: `npx playwright test tests/workspace-invitation-lifecycle-server.spec.ts tests/invite-acceptance.spec.ts tests/workspace-invitation-server.spec.ts tests/auth.spec.ts --reporter=line` (`42 passed`)
- `npx tsc --noEmit`, `npm run docs:check`, `npm run build`, `npm run security:secrets`, and `git diff --check` passed.
- `npm run lint` passed with existing warnings only.
- Did not implement real email delivery, seat billing, full notification center, DB/RLS migration, remote Supabase work, production execution, or real staff/customer data.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-161-invitation-resend-cancel-expiration-lifecycle-report.html`에 남긴다.

2026-05-20 DEN-162 Invite-Based Onboarding Regression And Handoff:

- Added `tests/invite-onboarding-regression-handoff.spec.ts`.
- Added `docs/engineering/auth-security/auth-login/invite-based-onboarding-regression-handoff.md`.
- Verified the accepted invite user can enter the invited workspace but is denied from another workspace by URL mutation.
- Recorded happy path, invalid invite, unauthorized inviter, and workspace isolation regression coverage.
- Recorded remaining launch blockers: production email delivery, invite token/link policy, real Supabase Auth signup/account linking, remote validation, tenant DB/RLS replay, production demo-header disablement proof, real onboarding/legal review, and payment/subscription decisions.
- Project 04 handoff: tenant boundary validation should focus on workspace id isolation, cross-workspace route denial, admin action scope, and audit review scope.
- Red: `npx playwright test tests/invite-onboarding-regression-handoff.spec.ts --reporter=line` failed before handoff coverage existed.
- Green: `npx playwright test tests/invite-onboarding-regression-handoff.spec.ts --reporter=line` (`2 passed`)
- Regression: `npx playwright test tests/invite-onboarding-regression-handoff.spec.ts tests/invite-acceptance.spec.ts tests/workspace-invitation-lifecycle-server.spec.ts tests/workspace-invitation-server.spec.ts tests/auth.spec.ts --reporter=line` (`44 passed`)
- `npx tsc --noEmit`, `npm run docs:check`, `npm run build`, `npm run security:secrets`, and `git diff --check` passed.
- `npm run lint` passed with existing warnings only.
- Did not implement production email delivery, real customer onboarding, payment/subscription, remote Supabase work, production deploy, or real data.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-162-invite-based-onboarding-regression-handoff-report.html`에 남긴다.

2026-05-20 DEN-163 SaaS Launch Role Permission Matrix:

- Added `docs/engineering/auth-security/auth-login/saas-launch-role-permission-matrix.md`.
- Froze SaaS launch canonical roles as `hospital_admin`, `vet`, `technician`, and `front_desk`.
- Confirmed `nurse` is not a canonical SaaS launch role and remains only a legacy/mock compatibility name for `technician`.
- Confirmed `billing_admin` is not a canonical SaaS launch role; billing authority must stay inside approved canonical roles until a separate billing role is approved.
- Linked the launch matrix from `docs/product/domain/role-permission-source-map.md`.
- Added `tests/saas-launch-role-permission-matrix.spec.ts` to keep product source, resolver, DB adapter, and seed role names aligned.
- Recorded follow-up work for mock/demo role label cleanup, seed permission id reconciliation, DEN-164 route inventory, and DEN-165 cross-tenant denial fixtures.
- Red: `npx playwright test tests/saas-launch-role-permission-matrix.spec.ts --reporter=line` failed before the launch role matrix existed.
- Green: `npx playwright test tests/saas-launch-role-permission-matrix.spec.ts --reporter=line` (`2 passed`)
- Regression: `npx playwright test tests/saas-launch-role-permission-matrix.spec.ts tests/permission-resolver.spec.ts tests/db-workspace-permission-adapter.spec.ts tests/server-permission-enforcement.spec.ts tests/workspace-role-status-write-server.spec.ts tests/workspace-role-management-regression.spec.ts tests/workspace-invitation-server.spec.ts --reporter=line` (`25 passed`)
- `npx tsc --noEmit`, `npm run docs:check`, `npm run build`, `npm run security:secrets`, and `git diff --check` passed.
- `npm run lint` passed with existing warnings only.
- Did not change role policy code, add custom roles, run remote Supabase, change migrations/RLS, implement payment/refund policy, or deploy.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-163-saas-launch-role-permission-matrix-report.html`에 남긴다.

2026-05-20 DEN-164 Launch Route Permission Enforcement Inventory:

- Added `docs/engineering/auth-security/auth-login/launch-route-permission-enforcement-inventory.md`.
- Added `tests/launch-route-permission-enforcement.spec.ts`.
- Recorded launch-critical route coverage for CLAiR ops tenant workspace action, workspace create/list, invitation create/resend/cancel/accept, membership list/role/status, personal profile, and audit review events.
- Confirmed those route handlers keep a server session boundary with mock-mode-only demo actor header handling.
- Confirmed launch admin/member mutations require server-owned permission or operator authority checks such as `tenant_approval:manage` or `role_permission:manage`.
- Recorded safe 401/403 response categories and remaining enforcement gaps.
- Remaining gaps: remote/staging Supabase permission replay, production disablement proof for demo actor headers, broad clinical/billing/customer inventory, seed permission id reconciliation, and abuse/rate-limit coverage.
- Red: `npx playwright test tests/launch-route-permission-enforcement.spec.ts --reporter=line` failed before the inventory existed.
- Green: `npx playwright test tests/launch-route-permission-enforcement.spec.ts --reporter=line` (`2 passed`)
- Regression: `npx playwright test tests/launch-route-permission-enforcement.spec.ts tests/ops-tenant-workspace-action.spec.ts tests/workspace-invitation-server.spec.ts tests/workspace-invitation-lifecycle-server.spec.ts tests/workspace-membership-status-server.spec.ts tests/server-permission-enforcement.spec.ts tests/workspace-role-status-write-server.spec.ts tests/personal-profile-server.spec.ts tests/audit-review-surface.spec.ts tests/permission-resolver.spec.ts --reporter=line` (`38 passed`)
- `npx tsc --noEmit`, `npm run docs:check`, `npm run build`, `npm run security:secrets`, and `git diff --check` passed.
- `npm run lint` passed with existing warnings only.
- Did not rewrite production route code, change role policy, run remote Supabase, change migrations/RLS, add provider integrations, or deploy.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-164-launch-route-permission-enforcement-report.html`에 남긴다.

2026-05-20 DEN-165 Cross-Tenant Denial Regression Fixtures:

- Added `tests/cross-tenant-denial-regression.spec.ts`.
- Added `docs/engineering/auth-security/auth-login/cross-tenant-denial-regression-fixtures.md`.
- Fixed mock fallback tenant fixtures so the default `user-admin` fixture can manage `workspace-a` but is denied from `workspace-b` for invitation creation, membership status reads, and invitation lifecycle admin actions.
- Added clinical handoff smoke coverage for `patient:view`, `encounter:view`, and reception patient lookup denial across workspaces.
- Confirmed the existing Korean unauthorized login notice remains the user-facing denial UX for unauthorized workspace entry.
- Remaining gaps: remote/staging Supabase replay, production demo-header disablement proof, full clinical/billing/customer/lab/imaging/dispensing/audit tenant replay, and final live domain RLS replay.
- Red: `npx playwright test tests/cross-tenant-denial-regression.spec.ts --reporter=line` failed because a `workspace-b` invitation create returned 201.
- Green: `npx playwright test tests/cross-tenant-denial-regression.spec.ts --reporter=line` (`3 passed`)
- Regression: `npx playwright test tests/cross-tenant-denial-regression.spec.ts tests/workspace-invitation-server.spec.ts tests/workspace-invitation-lifecycle-server.spec.ts tests/workspace-membership-status-server.spec.ts tests/server-permission-enforcement.spec.ts tests/reception-patient-guardian-lookup-server.spec.ts tests/permission-resolver.spec.ts tests/workspace-membership-rls-migration.spec.ts tests/auth.spec.ts --reporter=line` (`67 passed`)
- `npx tsc --noEmit`, `npm run docs:check`, `npm run build`, `npm run security:secrets`, and `git diff --check` passed.
- `npm run lint` passed with existing warnings only.
- Did not run remote Supabase, change migrations/RLS, use real data, add production deploy work, or implement broad route inventory beyond this fixture slice.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-165-cross-tenant-denial-regression-report.html`에 남긴다.

2026-05-20 DEN-166 Last-Admin Role-Change Launch Safety:

- Added `tests/last-admin-role-change-launch-safety.spec.ts`.
- Added `docs/engineering/auth-security/auth-login/last-admin-role-change-launch-safety.md`.
- Added the local-first `invitation-admin-pending` fixture so hospital-admin invite acceptance creates an active `hospital_admin` membership.
- Confirmed route-level last-admin demotion and deactivation return `409 last_admin_protected`.
- Confirmed the guard permits demoting one admin only after another active `hospital_admin` remains.
- Recorded allowed/denied role-change table and Project 05 operator override follow-up.
- Red: `npx playwright test tests/last-admin-role-change-launch-safety.spec.ts --reporter=line` failed because the admin invite fixture was missing.
- Green: `npx playwright test tests/last-admin-role-change-launch-safety.spec.ts --reporter=line` (`4 passed`)
- Regression: `npx playwright test tests/last-admin-role-change-launch-safety.spec.ts tests/workspace-role-status-write-server.spec.ts tests/server-permission-enforcement.spec.ts tests/workspace-role-management-regression.spec.ts tests/permission-resolver.spec.ts tests/invite-acceptance.spec.ts tests/workspace-invitation-lifecycle-server.spec.ts tests/cross-tenant-denial-regression.spec.ts --reporter=line` (`31 passed`)
- `npx tsc --noEmit`, `npm run docs:check`, `npm run build`, `npm run security:secrets`, and `git diff --check` passed.
- `npm run lint` passed with existing warnings only.
- Did not implement production support override, billing owner policy, custom roles, remote Supabase replay, production deploy, or real staff data.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-166-last-admin-role-change-launch-safety-report.html`에 남긴다.

2026-05-20 DEN-167 Launch Audit Coverage Matrix:

- Added `tests/launch-audit-coverage-matrix.spec.ts`.
- Added `docs/engineering/auth-security/auth-login/launch-audit-coverage-matrix.md`.
- Added safe `workspace.created` audit hooks to workspace creation responses.
- Added safe `workspace.invitation_created` audit hooks to staff invitation creation responses.
- Confirmed tenant workspace action, first admin invite, invitation lifecycle, role/status mutation, and audit review surfaces are represented in launch audit coverage.
- Recorded remaining audit gaps: remote/staging Supabase append replay, production append wiring for workspace/staff invitation hooks, retention/SIEM/alerting/immutable storage, and production demo-header disablement proof.
- Red: `npx playwright test tests/launch-audit-coverage-matrix.spec.ts --reporter=line` failed because workspace creation audit hooks were missing.
- Green: `npx playwright test tests/launch-audit-coverage-matrix.spec.ts --reporter=line` (`4 passed`)
- Regression: `npx playwright test tests/launch-audit-coverage-matrix.spec.ts tests/ops-tenant-workspace-action.spec.ts tests/ops-tenant-approval.spec.ts tests/ops-tenant-status-policy.spec.ts tests/workspace-creation-server.spec.ts tests/workspace-invitation-server.spec.ts tests/workspace-invitation-lifecycle-server.spec.ts tests/live-audit-log-persistence.spec.ts tests/live-audit-mutation-emission.spec.ts tests/audit-review-surface.spec.ts tests/last-admin-role-change-launch-safety.spec.ts --reporter=line` (`40 passed`)
- `npx tsc --noEmit`, `npm run docs:check`, `npm run build`, `npm run security:secrets`, and `git diff --check` passed.
- `npm run lint` passed with existing warnings only.
- Did not implement remote Supabase replay, long-term retention, SIEM export, alerting, immutable storage, production deploy, or real data audit ingestion.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-167-launch-audit-coverage-report.html`에 남긴다.

2026-05-20 DEN-168 Launch Rate Limit And Abuse Handling:

- Added `tests/launch-rate-limit-abuse-handling.spec.ts`.
- Added `docs/engineering/auth-security/auth-login/launch-rate-limit-abuse-handling.md`.
- Added `enforceWorkspaceMutationRateLimit(...)` to `POST /api/ops/tenant-applications/[applicationId]/workspace`.
- Confirmed launch-critical workspace, invite, ops, membership role/status, and profile mutation routes share the rate-limit boundary.
- Confirmed exceeded requests return safe `429`, `Retry-After`, and `{ ok: false, error: "rate_limited" }`.
- Confirmed duplicate invite handling remains safe `409 duplicate_pending_invitation` without raw invite tokens, magic links, secrets, stack traces, or SQL errors.
- Red: `npx playwright test tests/launch-rate-limit-abuse-handling.spec.ts --reporter=line` failed because the ops tenant workspace action was missing the limiter.
- Green: `npx playwright test tests/launch-rate-limit-abuse-handling.spec.ts --reporter=line` (`3 passed`)
- Regression: `npx playwright test tests/launch-rate-limit-abuse-handling.spec.ts tests/workspace-rate-limit-server.spec.ts tests/ops-tenant-workspace-action.spec.ts tests/workspace-invitation-server.spec.ts tests/workspace-invitation-lifecycle-server.spec.ts tests/server-permission-enforcement.spec.ts tests/last-admin-role-change-launch-safety.spec.ts --reporter=line` (`27 passed`)
- `npx tsc --noEmit`, `npm run docs:check`, `npm run build`, `npm run security:secrets`, and `git diff --check` passed.
- `npm run lint` passed with existing warnings only.
- Did not implement external WAF, production shared rate-limit store, enterprise monitoring, production deploy, or real traffic logging.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-168-launch-rate-limit-abuse-handling-report.html`에 남긴다.

2026-05-20 DEN-169 Staging Secret And Deployment Readiness Checklist:

- Added `tests/launch-staging-readiness-checklist.spec.ts`.
- Added `docs/engineering/auth-security/auth-login/staging-secret-deployment-readiness-checklist.md`.
- Created a non-developer READY/BLOCKED summary for staging env, secret handling, Supabase staging validation, email sender readiness, deploy preflight, and rollback stop conditions.
- Separated public browser env (`NEXT_PUBLIC_AUTH_MODE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) from server-only secrets.
- Linked the checklist back to the existing env/secret gates, SaaS launch approval gates, Supabase readiness, and launch rate-limit docs.
- Red: `npx playwright test tests/launch-staging-readiness-checklist.spec.ts --reporter=line` failed because the checklist did not exist.
- Green: `npx playwright test tests/launch-staging-readiness-checklist.spec.ts --reporter=line` (`3 passed`)
- `npm run security:secrets`, `npm run docs:check`, `npx tsc --noEmit`, `npm run build`, and `git diff --check` passed.
- `git ls-files '.env*' '.vercel/.env*' '**/.env*'` returned no tracked env files.
- `npm run lint` passed with existing warnings only.
- Did not create real env files, store secrets, run remote Supabase, change email sender settings, deploy, or use real data.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-169-staging-secret-deployment-readiness-report.html`에 남긴다.

2026-05-20 DEN-170 SaaS Launch Pilot Rehearsal Closeout:

- Added `docs/engineering/auth-security/auth-login/saas-launch-pilot-rehearsal-closeout.md`.
- Wrote the local-first pilot rehearsal closeout for the full SaaS Launch Foundation.
- Selected regression covered CLAiR operator approved workspace action, invite acceptance, staff invitation creation/lifecycle, cross-tenant denial, last-admin protection, audit coverage, rate-limit abuse handling, staging readiness checklist, and base auth regression.
- Decision: representative review is `READY`; local/mock SaaS foundation rehearsal is `READY`; real staging/live pilot remains `BLOCKED` until approval gates and blockers are cleared.
- Remaining blockers: remote Supabase staging approval/replay, real email provider approval, shared production rate-limit store, demo actor header production disablement proof, request id/safe logging and production log redaction, Supabase advisor/security-definer RPC review, real data/legal/compliance approval, and deploy rollback/forward-fix approval.
- Selected regression: `npx playwright test tests/ops-tenant-workspace-action.spec.ts tests/invite-acceptance.spec.ts tests/workspace-invitation-server.spec.ts tests/workspace-invitation-lifecycle-server.spec.ts tests/cross-tenant-denial-regression.spec.ts tests/last-admin-role-change-safety.spec.ts tests/launch-audit-coverage-matrix.spec.ts tests/launch-rate-limit-abuse-handling.spec.ts tests/launch-staging-readiness-checklist.spec.ts tests/auth.spec.ts --reporter=line` (`63 passed`)
- Final gates passed: `npx tsc --noEmit`; `npm run lint` with 5 pre-existing warnings; `npm run docs:check`; `npm run build`; `npm run security:secrets`; `git diff --check`.
- Did not execute staging/manual remote rehearsal, production deploy, real hospital data import, payment/subscription launch, or post-MVP enterprise SSO work.

검증 결과와 세부 결정은 `docs/completed/saas-launch/2026-05-20-den-170-saas-launch-pilot-rehearsal-closeout-report.html`에 남긴다.

2026-05-18 DEN-54 Reception Encounter Persistence Contract:

- Started Project 03 after 승욱 approval, without touching remote Supabase, real data, production deploy, or implementation code.
- Added `docs/engineering/auth-security/auth-login/reception-encounter-persistence-contract.md`.
- Confirmed walk-in check-in creates an encounter without an appointment.
- Confirmed appointment check-in updates the appointment and creates one linked encounter plus queue row in a transaction boundary.
- Defined Project 03 field contract, dependency map, permission boundary, mock fallback strategy, and chart/order/billing handoff fields.
- Recorded 승욱's operating preference that 루멘 may choose direct work, sub-agent delegation, or another better-fit workflow by task.
- `npm run docs:check`

검증 결과와 세부 결정은 `docs/completed/reception/2026-05-18-den-54-reception-encounter-contract-report.html`에 남긴다.

2026-05-19 DEN-55 Reception Domain Schema Extension Plan:

- Added `docs/engineering/auth-security/auth-login/reception-domain-schema-extension-plan.md`.
- Proposed the minimum Project 03 domain tables: `guardians`, `patients`, `patient_guardians`, `consents`, `appointments`, `appointment_change_logs`, `encounters`, and `waiting_queue_entries`.
- Added workspace scope, identifiers, status enum mapping, indexes, duplicate guards, and mock-to-DB mapping for DEN-56.
- Split RLS/server enforcement into follow-up implementation scope instead of implementing policy SQL in DEN-55.
- Recorded privacy/consent open questions around guardian birth date, phone uniqueness, `privacy`/`messaging`/`marketing` consent, document storage, and sensitive memo handling.
- Did not implement migration, UI changes, remote Supabase, production deploy, or real data access.
- `npm run docs:check`

검증 결과와 세부 결정은 `docs/completed/reception/2026-05-19-den-55-reception-schema-extension-plan-report.html`에 남긴다.

2026-05-19 DEN-56 Reception Domain Schema Migration:

- Added `supabase/migrations/20260519090000_reception_domain_schema_foundation.sql`.
- Added local-first Project 03 domain tables for guardians, patients, patient relationships, consents, appointments, appointment change logs, encounters, and waiting queue entries.
- Added workspace scope, status constraints, duplicate guards, lookup indexes, same-workspace composite foreign keys, updated-at triggers, and RLS enablement.
- Added synthetic reception fixture rows to `supabase/seed.sql`.
- Added focused static migration contract coverage in `tests/reception-domain-schema-migration.spec.ts`.
- Verified focused migration contract, typecheck, and secret scan. Docker daemon was unavailable, so actual `npx supabase db reset --local` SQL runtime replay remains a local DB follow-up.
- Did not touch remote Supabase, production deploy, real data, UI route wiring, full customer CRUD, chart/order/billing, or final domain RLS policy SQL.

검증 결과와 세부 결정은 `docs/completed/reception/2026-05-19-den-56-reception-domain-schema-migration-report.html`에 남긴다.

2026-05-19 DEN-57 Reception Patient Guardian Lookup:

- Added `GET /api/workspaces/[workspaceId]/reception/patient-guardian-lookup`.
- Added server-owned lookup core, mock fallback gateway, and Supabase reader gateway.
- Added local-first reader migration `supabase/migrations/20260519100000_reception_patient_guardian_lookup_reader.sql`.
- Connected the walk-in reception dialog to DB-backed patient/guardian lookup states.
- Enforced active workspace membership and `patient:view` before lookup.
- Verified focused server/API route contract, DB reader static contract, reception UI lookup states, full reception regression, typecheck, secret scan, and docs check. Docker daemon was unavailable, so actual `npx supabase db reset --local` SQL runtime replay remains a local DB follow-up.
- Did not implement new patient/guardian live write, encounter creation, full customer CRUD, final domain RLS policy SQL, remote Supabase, production deploy, or real data access.

검증 결과와 세부 결정은 `docs/completed/reception/2026-05-19-den-57-reception-patient-guardian-lookup-report.html`에 남긴다.

2026-05-19 DEN-58 Reception Patient Guardian Registration Write:

- Added `POST /api/workspaces/[workspaceId]/reception/patient-guardian-registration`.
- Added server-owned registration core, mock fallback writer, and Supabase writer gateway.
- Added local-first writer migration `supabase/migrations/20260519110000_reception_patient_guardian_registration_writer.sql`.
- Connected the reception `환자/보호자 등록` dialog final submit to the server route and merged successful persisted-shaped rows back into local demo state.
- Enforced route-level rate limiting, active workspace membership, and `reception:create` before registration.
- Added stable duplicate denial handling for normalized guardian phone, patient microchip number, and patient registration number.
- Verified focused server/API route contract, writer static contract, UI route submit behavior, full reception regression, rate-limit route coverage, typecheck, secret scan, and docs check. Docker daemon was unavailable, so actual `npx supabase db reset --local` SQL runtime replay remains a local DB follow-up.
- Did not implement encounter creation, appointment check-in, full customer CRUD, provider integration, final domain RLS policy SQL, remote Supabase, production deploy, or real data access.

검증 결과와 세부 결정은 `docs/completed/reception/2026-05-19-den-58-reception-patient-guardian-registration-write-report.html`에 남긴다.

2026-05-19 DEN-60 Reception Walk-In Encounter Create:

- Added `POST /api/workspaces/[workspaceId]/reception/walk-in-encounters`.
- Added server-owned walk-in encounter core, mock fallback writer, and Supabase writer gateway.
- Added local-first writer migration `supabase/migrations/20260519120000_reception_walk_in_encounter_writer.sql`.
- Connected the reception walk-in dialog final `생성` submit to the server route and merged successful persisted-shaped encounter/queue rows back into local demo state.
- Enforced route-level rate limiting, active workspace membership, and `reception:create` before walk-in creation.
- Verified focused server/API route contract, writer static contract, UI route submit behavior, full reception regression, rate-limit route coverage, typecheck, and secret scan. Docker daemon was unavailable, so actual `npx supabase db reset --local` SQL runtime replay remains a local DB follow-up.
- Did not implement appointment check-in, persisted queue/calendar read replacement, chart/order/billing/provider persistence, final domain RLS policy SQL, remote Supabase, production deploy, or real data access.

검증 결과와 세부 결정은 `docs/completed/reception/2026-05-19-den-60-reception-walk-in-encounter-create-report.html`에 남긴다.

2026-05-19 DEN-59 Reception Appointment Check-In Transition:

- Added `POST /api/workspaces/[workspaceId]/reception/appointments/[appointmentId]/check-in`.
- Added server-owned appointment check-in core, mock fallback writer, and Supabase writer gateway.
- Added local-first writer migration `supabase/migrations/20260519130000_reception_appointment_check_in_writer.sql`.
- Connected appointment `접수 처리` actions to the server route and merged successful persisted-shaped appointment/encounter/queue rows back into local demo state.
- Enforced route-level rate limiting, active workspace membership, and `reception:create` before appointment transition.
- Added stable denial handling for missing, non-confirmed, and already checked-in appointments.
- Verified focused server/API route contract, writer static contract, UI route submit behavior, full reception regression, rate-limit route coverage, typecheck, secret scan, and docs check. Docker daemon was unavailable, so actual `npx supabase db reset --local` SQL runtime replay remains a local DB follow-up.
- Did not implement appointment CRUD, no-show automation, provider integration, queue/calendar persisted read replacement, chart/order/billing persistence, final domain RLS policy SQL, remote Supabase, production deploy, or real data access.

검증 결과와 세부 결정은 `docs/completed/reception/2026-05-19-den-59-reception-appointment-check-in-transition-report.html`에 남긴다.

2026-05-19 DEN-61 Reception Mutation Permission Hardening:

- Added shared reception mutation permission matrix in `src/features/reception/reception-mutation-permissions.ts`.
- Locked patient/guardian registration, walk-in encounter creation, and appointment check-in to active workspace membership plus `reception:create`.
- Added audit hook point names for the three mutations without implementing audit persistence.
- Added focused denial coverage for unauthenticated actor, inactive app user, cross-workspace membership, inactive workspace membership, and role without `reception:create` across all three mutations.
- Updated reception route error copy so `inactive_user` is treated as a permission/workspace access denial.
- Verified focused DEN-61 permission coverage, existing reception mutation server coverage, full reception regression, typecheck, secret scan, and docs check. Remote Supabase, production deploy, real data, role policy changes, chart/order/billing permission enforcement, and full audit persistence were not touched.

검증 결과와 세부 결정은 `docs/completed/reception/2026-05-19-den-61-reception-mutation-permission-hardening-report.html`에 남긴다.

2026-05-19 DEN-62 Reception Queue Read:

- Added `GET /api/workspaces/[workspaceId]/reception/queue`.
- Added server-owned queue read core, mock fallback reader, and Supabase reader gateway.
- Added local-first reader migration `supabase/migrations/20260519140000_reception_queue_reader.sql`.
- Connected reception content to hydrate side panel state from a successful server queue response.
- Enforced active workspace membership and `reception:view` before queue read.
- Preserved existing mock demo fixture behavior by treating mock mode as an empty persisted overlay.
- Verified focused route/server coverage, UI hydration coverage, full reception regression, typecheck, production build, secret scan, and docs check.
- Did not implement calendar persisted read conversion, queue status mutation, chart/order/billing persistence, final domain RLS policy SQL, remote Supabase, production deploy, or real data access.

검증 결과와 세부 결정은 `docs/completed/reception/2026-05-19-den-62-reception-queue-read-report.html`에 남긴다.

2026-05-19 DEN-63 Reception Day Calendar Read:

- Added `GET /api/workspaces/[workspaceId]/reception/calendar/day?date=YYYY-MM-DD`.
- Added server-owned day calendar read core, mock fallback reader, and Supabase reader gateway.
- Added local-first reader migration `supabase/migrations/20260519150000_reception_day_calendar_reader.sql`.
- Connected reception content to hydrate appointment cards and walk-in cards from a successful server calendar response.
- Enforced active workspace membership and `reception:view` before calendar read.
- Preserved existing mock demo fixture behavior by treating mock mode as an empty persisted overlay.
- Stabilized the nav rail test so cross-module URL state query parameters do not break module path assertions.
- Verified focused route/server coverage, UI hydration coverage, typecheck, production build, full reception regression, secret scan, and docs check.
- Did not implement appointment CRUD, drag/drop scheduling, no-show automation, queue status mutation, chart/order/billing persistence, final domain RLS policy SQL, remote Supabase, production deploy, or real data access.

검증 결과와 세부 결정은 `docs/completed/reception/2026-05-19-den-63-reception-day-calendar-read-report.html`에 남긴다.

2026-05-19 DEN-64 Sales Demo And Mock Fallback Preservation:

- Added sales demo regression coverage for empty queue/calendar live reader mock fallback overlays.
- Confirmed the `kong-vomit` reception context keeps `patient-kong`, `encounter-kong-260501`, the Kong appointment card, and side panel patient context visible.
- Documented mock/local mode versus Supabase mode reader fallback behavior.
- Verified focused sales demo fallback coverage, typecheck, combined reception + sales demo regression, secret scan, and docs check.
- Did not add new demo scenarios, change sales copy, implement billing/chart persistence, touch remote Supabase, deploy production, or access real data.

검증 결과와 세부 결정은 `docs/completed/reception/2026-05-19-den-64-sales-demo-mock-fallback-preservation-report.html`에 남긴다.

2026-05-19 DEN-65 Reception Persistence Regression Coverage:

- Added E2E-style regression coverage for walk-in create -> reload -> queue/calendar read restoration.
- Added E2E-style regression coverage for appointment check-in -> reload -> queue/calendar read restoration.
- Added cross-workspace queue/calendar read denial coverage for the demo actor.
- Used deterministic persisted-shaped Playwright route fixtures rather than remote Supabase or real data.
- Verified focused persistence regression coverage, production build, full reception regression, secret scan, and docs check.
- Did not implement chart/order/billing E2E, performance testing, remote Supabase, production deploy, or real data access.

검증 결과와 세부 결정은 `docs/completed/reception/2026-05-19-den-65-reception-persistence-regression-coverage-report.html`에 남긴다.

2026-05-19 DEN-66 Chart Order Billing Handoff Closeout:

- Updated the encounter persistence contract with completed local-first reception boundaries and chart/order/billing handoff guidance.
- Documented the encounter fields and status meanings that chart/order/billing persistence should depend on.
- Added Korean closeout report for reception persistence and next-project handoff.
- Recommended DEN-67 `00-01 Confirm clinical billing persistence scope and encounter dependency` as the next issue.
- Verified docs check and secret scan.
- Did not start chart/order/billing implementation, move issues to Done, touch remote Supabase, deploy production, or access real data.

검증 결과와 세부 결정은 `docs/completed/reception/2026-05-19-den-66-chart-order-billing-handoff-closeout-report.html`에 남긴다.

2026-05-19 DEN-67 Clinical Billing Persistence Scope:

- Confirmed Project 04 included scope for SOAP/chart notes, diagnosis rows, order draft/confirmation/lifecycle, billing invoice candidates, invoice line/status/payment-state persistence, full outpatient regression, and audit/security handoff.
- Fixed `encounter.id` and `workspaceId` as the clinical/billing persistence dependency contract.
- Documented permission boundaries, server-side amount recalculation expectation, mock fallback strategy, audit event candidates, and explicit out-of-scope areas.
- Recommended DEN-68 `00-02 Implement clinical order billing schema migration` as the next issue.
- Did not implement migration, route/UI persistence, remote Supabase, production deploy, or real data access.

검증 결과와 세부 결정은 `docs/completed/clinical-billing/2026-05-19-den-67-clinical-billing-scope-report.html`에 남긴다.

2026-05-19 DEN-68 Clinical Order Billing Schema Migration:

- Added local-first schema foundation for chart notes, diagnoses, order groups, orders, order events/revisions, invoices, invoice lines, payments, and service catalog rows.
- Added synthetic seed rows linked to the existing DEN-56 reception encounter: SOAP note, diagnosis, ready-for-billing order, issued unpaid invoice, and invoice line.
- Added static schema and seed contract coverage.
- Verified focused clinical billing schema coverage, combined reception schema/server suite, typecheck, production build, secret scan, and docs check.
- Did not implement SOAP/order/billing route writes, UI live persistence wiring, final domain RLS policies, remote Supabase, production deploy, or real data access.

검증 결과와 세부 결정은 `docs/completed/clinical-billing/2026-05-19-den-68-clinical-order-billing-schema-migration-report.html`에 남긴다.

2026-05-19 DEN-99 Portfolio Virtual Hospital Demo Dataset Foundation:

- Added `docs/product/demo-data/` as the portfolio synthetic demo-data foundation.
- Defined VIP동물의료센터 청담점, five outpatient scenarios, base orders, order sets/templates, diagnosis system samples, staff roles, and workflow handoff.
- Used public veterinary/EMR references only as design context; no real patient, guardian, clinic, or medical record data was imported.
- Verified docs check and secret scan.
- Did not implement UI changes, DB migrations, remote Supabase, production deploy, or real data access.

검증 결과와 세부 결정은 `docs/completed/demo-data/2026-05-19-den-99-portfolio-virtual-hospital-demo-dataset-report.html`에 남긴다.
