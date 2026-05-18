# Project 01 Live Auth DB/RLS Closeout

Updated: 2026-05-18
Linear Project: `01 Live Auth & Supabase DB/RLS Foundation`
Initiative: `CLAiR EMR 제품 MVP 라이브 전환`

## Executive Summary

Project 01 is complete enough for Human Review and handoff. It created the foundational contract for moving from session-only auth toward live Supabase-backed workspace authentication, membership, permissions, DB schema, and RLS.

It is not live-ready yet. The next project must first execute the migrations/RLS against a real Supabase Postgres runtime before connecting live persistence.

## Completed Milestones

### 01 Live Supabase Readiness and Secret Gates

- DEN-29 fixed the Project 01 execution mode as local-first.
- DEN-30 defined public env, secret/server-only env, and verification gates.
- Remote Supabase project mutation remains representative-gated.

### 02 Verified Server Session and Route Identity

- DEN-31 added a server-only Supabase session reader contract based on `auth.getClaims()`.
- DEN-32 routed role-update actor identity through the verified server session seam.
- DEN-33 added regression coverage for client auth guard and server session boundaries.

### 03 Workspace Auth Schema, RLS, and Permission Adapter

- DEN-34 added workspace auth schema migration SQL.
- DEN-35 added local seed contract and validation plan.
- DEN-36 added DB-level last active `hospital_admin` protection foundation.
- DEN-37 added workspace auth table RLS baseline.
- DEN-38 added DB-backed permission adapter boundary.
- DEN-39 added cross-workspace denial regression and matrix.

### 04 Integration Verification and Handoff

- DEN-40 completed security review and blocker classification.
- DEN-41 packaged this closeout and Project 02 handoff.

## Handoff Assets

- Execution mode: `docs/engineering/auth-security/auth-login/live-supabase-readiness-execution-mode.md`
- Env/secret gates: `docs/engineering/auth-security/auth-login/auth-db-env-secret-verification-gates.md`
- Schema migration: `supabase/migrations/20260518023715_workspace_auth_schema_foundation.sql`
- Last-admin DB guard: `supabase/migrations/20260518024425_workspace_last_admin_protection_foundation.sql`
- RLS baseline: `supabase/migrations/20260518024708_workspace_membership_rls_baseline.sql`
- Seed contract: `supabase/seed.sql`
- DB adapter: `src/features/auth/db-workspace-permission-adapter-core.ts`
- Server session reader: `src/features/auth/server-session-reader.ts`
- Role update route: `src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/roles/route.ts`
- Cross-workspace matrix: `docs/engineering/auth-security/auth-login/cross-workspace-denial-matrix.md`
- Security review: `docs/engineering/auth-security/auth-login/live-auth-db-rls-security-review.md`

## Remaining Blockers

1. Actual migration/RLS execution has not run in this environment because Docker/local Postgres is unavailable.
2. Role management UI and membership management are still session-only.
3. The real Supabase gateway behind `WorkspacePermissionDbGateway` is not implemented.
4. Remote Supabase staging/live validation is intentionally approval-gated.
5. Domain table RLS for chart/order/billing persistence remains future work.

## Recommended First Project 02 Issue

Start with a DB execution gate:

> Apply the Project 01 migrations and seed against Docker-backed local Supabase, validate actual RLS behavior for admin/member/non-member sessions, and document any SQL rework before implementing live workspace/membership UI persistence.

This should be first because Project 02 depends on real DB behavior, not only static SQL contract tests.

## Do Not Do

- Do not start Project 02 implementation before 승욱 explicitly asks for it.
- Do not mark Project 01 Linear issues Done until 승욱 accepts the Human Review results.
- Do not use remote Supabase, SQL push, service-role keys, DB passwords, or secret keys without explicit representative approval.
- Do not claim pilot/live readiness until actual DB/RLS execution tests pass.
- Do not assume chart/order/billing data is protected by Project 01 RLS.

## Verification

- DEN-40 focused security regression: 26 Playwright tests passed.
- DEN-40 dependency audit: `npm audit --audit-level=high` found 0 vulnerabilities.
- DEN-41 docs verification: `npm run docs:check` passed.

## Final Status

Project 01 is ready for Human Review. Project 02 remains untouched.
