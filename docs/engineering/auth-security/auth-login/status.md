# Auth Login Status

Updated: 2026-05-17

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
- 2026-05-17 기준 DEN-21에서 첫 server-side permission enforcement slice를 추가했다. `POST /api/workspaces/[workspaceId]/memberships/[membershipId]/roles` route는 server-only enforcement module을 통해 active membership, `role_permission:manage`, canonical roles, and last active `hospital_admin` protection을 확인한다. 현재 actor identity는 demo-only `x-clair-demo-session-user-id` header로 받으며, Supabase verified session, DB writes, migration/RLS는 아직 범위 밖이다.
- 2026-05-17 기준 DEN-27 CSO 보안 리뷰를 완료했다. 개인 프로필은 권한 source로 쓰이지 않고, multi-role additive resolver, desk/technician chart mutation restriction, last-admin guard는 현재 계약/테스트로 확인된다. 운영 전 필수 보완점은 demo identity header 제거, role management UI의 server route handoff, DB transaction/private RPC 기반 last-admin protection이다.

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
- GitHub PR #10: `feat: add auth transition boundary`

## 다음 작업

1. Complete `AUTH-PR-002` / Linear `DEN-20` Human Review.
2. Complete `AUTH-PR-003` / Linear `DEN-28` Human Review.
3. Complete `AUTH-PR-004` / Linear `DEN-23` Human Review.
4. Complete `AUTH-PR-005` / Linear `DEN-24` Human Review.
5. Complete `AUTH-PR-006` / Linear `DEN-19` Human Review.
6. Complete `AUTH-PR-007` / Linear `DEN-25` Human Review.
7. Complete `AUTH-PR-008` / Linear `DEN-26` Human Review.
8. Complete `AUTH-PR-009` / Linear `DEN-21` Human Review.
9. Complete `AUTH-PR-010` / Linear `DEN-27` Human Review.
9. Then proceed through Supabase session validation, migration/RLS, or route-backed persistence.

## 금지 범위

- Supabase 실제 연결 전 package 설치, env 연결, API 호출을 하지 않는다.
- DB migration, RLS policy, server permission enforcement를 앞당겨 구현하지 않는다.
- password 검증, OAuth callback, MFA, refresh token, email verification을 직접 구현하지 않는다.
- auth 작업 명목으로 관련 없는 업무 화면을 수정하지 않는다.

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
