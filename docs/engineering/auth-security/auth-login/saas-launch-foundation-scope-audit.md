# SaaS Launch Foundation Scope Audit

Updated: 2026-05-20
Linear: DEN-148
Initiative: `CLAiR EMR SaaS Launch Foundation`

## Purpose

This audit separates already-built auth/workspace foundation from the new SaaS launch work. The launch foundation must not rebuild existing login, workspace membership, invitation, role, RLS, or local-first persistence contracts.

## Conclusion

The new initiative is not a greenfield auth project. It should reuse the Product MVP live transition foundation and focus on launch-specific gaps:

- CLAiR operator tenant approval.
- First hospital admin invitation after tenant approval.
- Invite-only public onboarding UX and token/account-linking behavior.
- Staging/live approval gates for Supabase, email, deployment, and role policy changes.
- Production-readiness gaps such as shared rate limiting, request id/safe logging helper adoption, Supabase advisor review, and production log redaction.

## Existing Linear Scope To Reuse

| Area | Existing Linear source | Reuse decision |
| --- | --- | --- |
| Workspace auth/permission product model | `워크스페이스 인증·권한 시스템 구축`, DEN-18 through DEN-27 | Reuse as the product role/membership foundation. Do not redefine canonical roles in launch issues except to confirm no policy change is needed. |
| Live auth DB/RLS foundation | `CLAiR EMR 제품 MVP 라이브 전환` Project 01, DEN-29 through DEN-41 | Reuse server session, schema, RLS, DB-backed permission adapter, last-admin guard, and cross-workspace denial foundation. |
| Workspace/member live persistence | `CLAiR EMR 제품 MVP 라이브 전환` Project 02, DEN-94 and DEN-42 through DEN-53 | Reuse local-first workspace creation, workspace selector, invitation lifecycle, role/status persistence, profile persistence, secret scan, API error/telemetry contract, and rate limit boundary. |
| Audit/security readiness foundation | Product MVP live transition Project 05 and auth security docs | Reuse audit/security review patterns. New launch work should extend tenant and invitation coverage, not create a separate audit model. |

## Local Source-Of-Truth Documents

Future SaaS launch work should start from these files:

- `docs/product/domain/workspace-auth-permissions.md`
- `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`
- `docs/engineering/auth-security/auth-login/status.md`
- `docs/engineering/auth-security/auth-login/project-01-live-auth-db-rls-closeout.md`
- `docs/engineering/auth-security/auth-login/project-02-workspace-membership-live-persistence-closeout.md`
- `docs/engineering/auth-security/auth-login/workspace-member-server-route-contract.md`
- `docs/engineering/auth-security/auth-login/workspace-persistence-security-review.md`
- `docs/engineering/auth-security/auth-login/auth-db-env-secret-verification-gates.md`
- `docs/engineering/auth-security/auth-login/live-supabase-readiness-execution-mode.md`
- `docs/engineering/auth-security/auth-login/api-error-telemetry-contract.md`
- `docs/engineering/auth-security/auth-login/workspace-live-api-rate-limiting.md`
- `docs/engineering/auth-security/auth-login/cross-workspace-denial-matrix.md`

## Code And Migration Foundation To Reuse

| Capability | Existing implementation |
| --- | --- |
| Login/auth boundary | `src/features/auth/auth-client.ts`, `src/features/auth/login-form.tsx`, `src/features/auth/auth-gate.tsx`, `src/lib/supabase/**` |
| Server session identity | `src/features/auth/server-session-reader.ts`, `src/features/auth/server-session-contract.ts` |
| Workspace creation | `src/app/api/workspaces/route.ts`, `src/features/auth/server-workspace-creation.ts`, `src/features/auth/workspace-onboarding.tsx`, `supabase/migrations/20260518120000_workspace_creation_transaction.sql` |
| Workspace selector/list | `src/features/auth/server-workspace-list.ts`, `src/features/auth/workspace-display.ts`, `supabase/migrations/20260518121000_workspace_membership_list_reader.sql` |
| Invitation create/lifecycle | `src/app/api/workspaces/[workspaceId]/invitations/**`, `src/features/auth/server-workspace-invitation.ts`, `src/features/auth/server-workspace-invitation-lifecycle.ts`, `supabase/migrations/20260518122000_workspace_invitation_create_transaction.sql`, `supabase/migrations/20260518123000_workspace_invitation_lifecycle_transactions.sql` |
| Membership status and role changes | `src/app/api/workspaces/[workspaceId]/memberships/**`, `src/features/auth/server-workspace-membership-status.ts`, `src/features/auth/server-role-update-enforcement.ts`, `supabase/migrations/20260518124000_workspace_member_status_reader.sql`, `supabase/migrations/20260518125000_workspace_role_status_write_transactions.sql` |
| Permissions and DB adapter | `src/features/auth/permission-resolver.ts`, `src/features/auth/db-workspace-permission-adapter-core.ts`, `src/features/auth/db-workspace-permission-adapter.ts` |
| Profile persistence | `src/app/api/users/me/profile/route.ts`, `src/features/auth/server-personal-profile.ts`, `supabase/migrations/20260518130000_personal_profile_persistence.sql` |
| Security gates | `scripts/scan-secrets.mjs`, `src/lib/security/rate-limit.ts`, `tests/workspace-rate-limit-server.spec.ts` |

## Test Foundation To Reuse

- `tests/auth.spec.ts`
- `tests/server-session-reader.spec.ts`
- `tests/permission-resolver.spec.ts`
- `tests/server-permission-enforcement.spec.ts`
- `tests/db-workspace-permission-adapter.spec.ts`
- `tests/workspace-auth-schema-migration.spec.ts`
- `tests/workspace-auth-seed-contract.spec.ts`
- `tests/workspace-membership-rls-migration.spec.ts`
- `tests/workspace-last-admin-protection-migration.spec.ts`
- `tests/workspace-creation-server.spec.ts`
- `tests/workspace-list-server.spec.ts`
- `tests/workspace-invitation-server.spec.ts`
- `tests/workspace-invitation-lifecycle-server.spec.ts`
- `tests/workspace-membership-status-server.spec.ts`
- `tests/workspace-role-status-write-server.spec.ts`
- `tests/workspace-role-management-regression.spec.ts`
- `tests/personal-profile-server.spec.ts`
- `tests/workspace-rate-limit-server.spec.ts`

## Duplicate-Scope Findings

| New SaaS launch area | Duplicate risk | Required adjustment |
| --- | --- | --- |
| `01 Auth & Workspace Runtime Readiness` | Rebuilding auth/session/provider code already implemented. | Treat as runtime validation and hardening. Only change code if tests expose a gap. |
| `02 CLAiR Ops Admin Tenant Approval` | Low duplicate risk. This is the largest genuinely new product surface. | Build on existing workspace creation/invitation routes, but add a CLAiR operator/tenant approval layer. |
| `03 Invite-Based Member Onboarding` | Invitation create/resend/cancel/accept server persistence already exists. | Reuse server lifecycle. Focus new work on invite token/link UX, account creation/linking, email delivery gate, and public acceptance experience. |
| `04 Role Permission & Tenant Data Isolation` | Role matrix, last-admin guard, server enforcement, and cross-workspace regression already exist. | Freeze/verify existing matrix first. Expand only for launch-specific routes and tenant approval boundaries. |
| `05 Security Audit & Pilot Launch Readiness` | Secret scan, API error contract, rate limit boundary, and security review patterns already exist. | Extend to tenant approval and public invite surfaces. Do not duplicate generic security reports. |

## New Launch Gaps

| Gap | Why it matters | Suggested owner project |
| --- | --- | --- |
| CLAiR operator access model | The internal CLAiR admin has stronger power than hospital admins and needs a separate guard. | Project 02 |
| Tenant application/approval model | Approved-hospital-only SaaS cannot rely on ordinary workspace creation. | Project 02 |
| First hospital admin invitation after approval | The initial admin should be created/invited by CLAiR operator flow, not by public signup. | Project 02 |
| Public invite token/link contract | Existing invitation lifecycle is route-backed but not a complete public email-link onboarding flow. | Project 03 |
| Account creation/linking from invite | Staff need a clear path for new accounts and existing accounts. | Project 03 |
| Email delivery provider gate | Real invitation delivery is intentionally out of current scope and needs separate approval. | Project 03 / Project 05 |
| Password reset/account recovery policy | Operating SaaS needs account recovery before pilot. | Project 01 |
| Shared production rate limit store | Current rate limit is local-first and insufficient for multi-instance production. | Project 05 |
| Route-wide request id/safe logging helper | DEN-96 defines the contract, but broad helper adoption remains follow-up. | Project 05 |
| Supabase advisor/RPC review before remote | Required before remote staging/live validation. | Project 05 |
| Production log redaction | Required before external monitoring/logging. | Project 05 |

## Approval Gates

The following remain representative-gated and must not be executed silently:

- Remote Supabase link, migration push, SQL execution, dashboard mutation, or live/staging project secret use.
- Real email delivery provider setup or outbound invite email sending.
- Production deployment.
- Payment/subscription provider integration.
- Role/permission product policy changes beyond confirming the current source of truth.
- Real clinic, guardian, patient, or staff data import.

## Recommended Next Sequence

1. DEN-149 should define the invite-only B2B SaaS architecture using this audit as input.
2. DEN-150 should turn the approval gates above into explicit launch criteria.
3. Before starting Project 01 implementation issues, review whether their descriptions need narrowing from "build" to "validate/reuse/harden".
4. Before Project 03, update invitation onboarding issues to reuse the existing route-backed invitation lifecycle instead of rebuilding it.

## Verification

- Linear search checked existing initiatives, projects, issues, and documents for workspace auth, permission, membership, invitations, Supabase, and RLS.
- Local docs were reviewed under `docs/engineering/auth-security/auth-login/**`, `docs/work/auth/**`, and `docs/product/domain/workspace-auth-permissions.md`.
- Code paths were scanned with `rg` and `rg --files` across `src/features/auth`, `src/app/api`, `src/lib/supabase`, `tests`, and `supabase/migrations`.
- No implementation, DB migration, remote Supabase operation, email provider setup, or production deploy was performed.
