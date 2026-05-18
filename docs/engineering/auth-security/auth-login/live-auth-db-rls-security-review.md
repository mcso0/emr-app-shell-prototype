# Live Auth DB/RLS Security Review

Updated: 2026-05-18
Linear: DEN-40

## Review Scope

Project 01 produced a local-first foundation for verified server session reading, role-update server identity, workspace auth schema, local seed contract, last active `hospital_admin` DB protection, workspace auth RLS, DB-backed permission adapter mapping, and cross-workspace denial regression.

This review classifies what is safe to hand off and what must remain blocked before pilot/live validation.

## Security Posture

The foundation is acceptable for Project 01 handoff, but not yet sufficient for live pilot use.

The implementation has good server-side seams and contract coverage, but the database layer has not been applied to a real local/staging Postgres runtime in this environment. Live use must wait until migrations, RLS, helper functions, seed data, and denial checks are executed against Supabase with real auth sessions.

## Blockers Before Pilot/Live

1. Actual migration and RLS execution is unverified.
   - Static SQL and contract tests pass.
   - `npx supabase migration list --local` and local DB reset were blocked earlier because Docker/local Postgres is unavailable.
   - Required gate: run migrations and seed against Docker-backed local Supabase or an approved staging project, then exercise authenticated/non-member/admin cases.

2. Role management UI is still session-only.
   - The route has a verified server session seam and server permission resolver.
   - The admin UI has not been wired to live DB writes or the private membership helper.
   - Required gate: connect UI/server action/API write flow to trusted DB persistence after DB validation.

3. Remote Supabase project validation is still approval-gated.
   - No remote project link, SQL execution, migration push, service-role key, DB password, or secret key was used.
   - Required gate: explicit representative approval naming the target environment and operation.

## Follow-Ups Before Broader Persistence

1. Implement a real Supabase gateway behind `WorkspacePermissionDbGateway`.
2. Add execution tests for the DB-backed permission adapter with real RLS-authenticated reads.
3. Add domain table RLS for chart, order, billing, and other workspace-scoped business data.
4. Keep secret/service-role and `NEXT_PUBLIC_` scans in CI or the pre-live checklist.
5. Add audit persistence for role/membership changes when live writes begin.

## Positive Evidence

- `readServerSession()` is server-only and calls Supabase `auth.getClaims()` instead of trusting browser storage or `auth.getSession()`.
- The role update route uses the verified session seam. The demo header is accepted only in mock fallback mode.
- The server permission resolver denies unauthenticated, inactive, missing membership, permission missing, last-admin, and cross-workspace cases.
- Last active `hospital_admin` protection has a private trigger/helper foundation.
- Workspace auth RLS uses private helpers based on `auth.uid()` plus active app user and active membership rows.
- RLS policies are scoped to `to authenticated`; no `to anon` grant/policy was introduced for protected workspace auth tables.
- Authorization source remains app-domain membership/permission rows, not user-editable profile/user metadata.
- `npm audit --audit-level=high` found no vulnerabilities.

## Verification

- Source/security scan:
  - `rg -n "service_role|SUPABASE_SECRET|SECRET|DB_PASSWORD|DATABASE_URL|process\\.env|NEXT_PUBLIC|auth\\.getSession|getSession\\(|user_metadata|raw_user_meta_data|x-clair-demo-session-user-id|create policy|security definer|grant .*anon|to anon|auth\\.uid\\(|readServerSession|server-only|sessionStorage|localStorage|window\\." src/features/auth src/app/api supabase tests docs/engineering/auth-security/auth-login`
- Focused security regression:
  - `npx playwright test tests/server-session-reader.spec.ts tests/server-permission-enforcement.spec.ts tests/workspace-membership-rls-migration.spec.ts tests/workspace-last-admin-protection-migration.spec.ts tests/db-workspace-permission-adapter.spec.ts tests/permission-resolver.spec.ts --reporter=line`
  - Result: 26 passed.
- Dependency audit:
  - `npm audit --audit-level=high`
  - Result: found 0 vulnerabilities.
- Docs:
  - `npm run docs:check`
  - Result: checked 571 docs/agent markdown files.

## Do Not Do Without Approval

- Do not use service-role keys, secret keys, DB passwords, remote connection strings, or Supabase CLI tokens in client code, public docs, chat, Linear, logs, or local unapproved commands.
- Do not link/push migrations to a remote Supabase project without explicit representative approval.
- Do not mark this foundation live-ready until actual DB/RLS execution tests pass.
- Do not start Project 02 as part of this review.
