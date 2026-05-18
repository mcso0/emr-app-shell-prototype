# AUTH-PR-022 Security Review Live Auth DB/RLS Foundation

Linear: DEN-40
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Review the Project 01 live auth, DB, and RLS foundation before handoff.

## Scope

- Review server session reader, role-update route identity, server permission enforcement, schema migration, last-admin DB guard, RLS baseline, DB-backed permission adapter, and cross-workspace denial coverage.
- Check for secret/service-role exposure, browser/client trust, user metadata authorization, and workspace boundary regressions.
- Classify blockers, follow-ups, and safe handoff evidence.
- Update auth status/current-status references.
- Create a Korean HTML closeout report and Linear handoff comment.

## Out Of Scope

- No remote Supabase project link, SQL execution, migration push, or secret/service-role key usage.
- No production deploy or monitoring.
- No Project 02 work.
- No new feature implementation beyond review documentation.

## Findings

### Blocker Before Pilot/Live Validation

1. Actual Supabase migration/RLS execution is still unverified because this machine has no Docker/local Postgres runtime.
2. Role management UI is still session-only and is not yet routed through the DB-backed write helper or live server persistence.
3. Remote staging/live Supabase project validation is intentionally gated behind representative approval.

### Follow-Up Before Broad Domain Persistence

1. `WorkspacePermissionDbGateway` is a narrow boundary, but no real Supabase gateway implementation is connected yet.
2. RLS currently covers workspace auth tables only. Chart/order/billing/domain table RLS remains Project 04 or later.
3. Keep secret/service-role and `NEXT_PUBLIC_` scans in the pre-live checklist.

### Positive Evidence

1. Server session reader uses verified Supabase claims via `auth.getClaims()` and avoids browser storage/getSession trust.
2. Role update route allows the demo header only in mock fallback mode.
3. Last active `hospital_admin` protection has a private trigger/helper foundation.
4. Workspace auth RLS policies use `to authenticated` and row workspace helpers.
5. Cross-workspace denial is covered at resolver, route, and RLS contract levels.
6. No high npm vulnerabilities were found.

## Verification

- `rg -n "service_role|SUPABASE_SECRET|SECRET|DB_PASSWORD|DATABASE_URL|process\\.env|NEXT_PUBLIC|auth\\.getSession|getSession\\(|user_metadata|raw_user_meta_data|x-clair-demo-session-user-id|create policy|security definer|grant .*anon|to anon|auth\\.uid\\(|readServerSession|server-only|sessionStorage|localStorage|window\\." src/features/auth src/app/api supabase tests docs/engineering/auth-security/auth-login`
- `npx playwright test tests/server-session-reader.spec.ts tests/server-permission-enforcement.spec.ts tests/workspace-membership-rls-migration.spec.ts tests/workspace-last-admin-protection-migration.spec.ts tests/db-workspace-permission-adapter.spec.ts tests/permission-resolver.spec.ts --reporter=line`
- `npm audit --audit-level=high`
- `npm run docs:check`

Result: passed on 2026-05-18.

## Handoff Notes

DEN-41 should close Project 01 by packaging the remaining blockers as explicit handoff gates for the next workspace persistence project.
