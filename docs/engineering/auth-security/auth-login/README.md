# Auth Login Implementation Docs

이 폴더는 MVP 로그인, workspace membership, permission, live/local persistence, launch-readiness 작업을 단계별로 이어가기 위한 전용 작업 패키지다. 상위 기준 문서는 계속 `docs/engineering/current-status.md`와 `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`이며, 이 README는 GitBook에서 내부 검토자가 길을 잃지 않도록 현재 시작점과 문서 묶음을 안내한다.

## 현재 시작점

현재 상태는 **Product MVP local-first 기반이 다수 구현되었고, remote Supabase staging/live validation과 production launch는 아직 승인/완료되지 않은 상태**다. `work-orders/01-supabase-auth-mapping.md`부터 `work-orders/04-membership-permission-enforcement.md`까지의 기준 작업은 완료되었고, 이후 작업은 별도 승인된 permission resolver, migration/RLS, API/server action enforcement, live persistence, launch-readiness 단위로 독립 진행한다.

최신 진행 상태는 `docs/engineering/auth-security/auth-login/status.md`, 완료 요약은 `docs/engineering/auth-security/auth-login/completed-summary.md`, 상위 auth 전환 기준은 `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`를 우선한다.

## GitBook에서 먼저 볼 문서

| 필요 | 시작 문서 |
|---|---|
| 개인 설정 저장, 비밀번호, 알림 계약 | [Personal settings](personal-settings-contract.md) |
| 현재 auth/login 진행 상태 | `status.md` |
| 완료된 auth/login closeout 요약 | `completed-summary.md` |
| 작업자용 실행 브리핑 | `agent-briefing.md` |
| 초기 4단계 구현 계획 | `plan.md`, `work-orders/01-supabase-auth-mapping.md` through `work-orders/04-membership-permission-enforcement.md` |
| Supabase Auth와 앱 도메인 매핑 | `supabase-auth-mapping.md` |
| env/secret/verification gate | `auth-db-env-secret-verification-gates.md`, `live-persistence-secret-scanning-gate.md` |
| workspace membership and permission foundation | `workspace-membership-data-security-plan.md`, `membership-permission-enforcement.md`, `workspace-member-server-route-contract.md`, `db-backed-permission-adapter.md` |
| invite-only SaaS launch and onboarding | `invite-only-b2b-saas-launch-architecture.md`, `tenant-application-approval-workspace-model.md`, `account-recovery-and-invite-account-policy.md`, `invite-acceptance-account-linking-screen.md` |
| live/local Supabase readiness and RLS gates | `live-supabase-readiness-execution-mode.md`, `docker-local-supabase-rls-execution-gate.md`, `live-auth-db-rls-security-review.md`, `live-auth-db-rls-workspace-threat-model.md` |
| launch/pilot readiness | `saas-launch-approval-gates.md`, `mvp-pilot-readiness-criteria.md`, `product-mvp-live-transition-closeout-report.md` |

## 작업 전 읽는 순서

1. `AGENTS.md`
2. `docs/engineering/current-status.md`
3. `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`
4. `docs/engineering/auth-security/auth-login/README.md`
5. `docs/engineering/auth-security/auth-login/status.md`
6. `docs/engineering/auth-security/auth-login/agent-briefing.md`
7. 현재 작업할 `docs/engineering/auth-security/auth-login/work-orders/*.md`

## 문서 구성

| 문서 | 역할 |
|---|---|
| `status.md` | 로그인 구현 목표, 현상태, 완료 기준, 다음 작업, 검증 기록 |
| `plan.md` | 4단계 master plan과 단계별 gate |
| `agent-briefing.md` | 작업 전 에이전트 운영 규칙과 금지 범위 |
| `completed-summary.md` | 완료된 auth/login closeout 문서 요약 인덱스 |
| `supabase-auth-mapping.md` | Supabase Auth session과 앱 users/user_memberships/permission_policies 매핑 결정 |
| `work-orders/01-supabase-auth-mapping.md` | Supabase Auth와 앱 도메인 사용자/멤버십/권한 매핑 설계 |
| `work-orders/02-supabase-integration-readiness.md` | 실제 연결 전 설치/env/callback/session/helper/middleware 계획 |
| `work-orders/03-supabase-provider-implementation.md` | 승인된 계획 기준 실제 Supabase provider adapter 구현 |
| `work-orders/04-membership-permission-enforcement.md` | membership/permission source와 서버 권한 enforcement/RLS 작업 |

## 문서 묶음 역할

| 묶음 | 역할 |
|---|---|
| `status.md`, `completed-summary.md`, `agent-briefing.md` | 현재 상태, 완료 근거, 작업자 시작 지점 |
| `work-orders/` | 초기 auth/login 패키지의 순차 작업지시서 |
| `workspace-*`, `tenant-*`, `invite-*`, `account-*` | workspace, tenant, invite, account lifecycle contracts |
| `live-*`, `docker-*`, `auth-db-*`, `staging-*` | live/local Supabase, RLS, secret, staging readiness gates |
| `reception-*`, `clinical-*`, `customer-*`, `hospital-admin-*` | auth/security package 안에 보관된 workflow-specific persistence/security handoff records |
| `project-*`, `*-closeout*`, `*-handoff*` | 완료 또는 Human Review 근거. 현재 실행 기준은 `status.md`와 active Linear issue를 우선한다. |

## 진행 원칙

- 초기 work order는 `01 -> 02 -> 03 -> 04` 순서를 따른다.
- 앞 단계 완료와 closeout 없이 다음 단계로 넘어가지 않는다.
- 01-04 완료 이후의 후속 구현은 기존 work order를 반복하지 않고, 승인된 권한/DB/API enforcement/live persistence 범위를 새 독립 작업으로 분리한다.
- 공식 완료 문서는 계속 `docs/completed/auth/YYYY-MM-DD-<slug>.md`에 작성한다.
- 문서 작업만 할 때는 code auth 검증을 요구하지 않는다.
- auth 코드가 바뀌면 `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`의 auth 코드 검증 세트를 따른다.

## GitBook Reader Boundary

- 이 폴더는 private GitBook에서 내부 검토용으로 볼 수 있지만, 보안/권한/DB/RLS/launch 문서가 많으므로 README를 통해 현재 기준 문서부터 읽는다.
- public GitBook, 외부 공유 링크, 고객 공유 자료로 쓰려면 별도 publication review가 필요하다.
- secrets, env values, real user/hospital/patient/customer/payment data, remote credentials, production access details를 추가하지 않는다.
- Linear issue나 project 승인은 remote Supabase, migration push, RLS replay, production deploy, real email, payment, provider integration 승인이 아니다.
