# AUTH-PR-044 Workspace Permission Role Model MVP

Linear: TBD
Status: in_progress
Area: auth
Priority: P0
Date: 2026-07-02

## Implementation State (2026-07-11)

- Local implementation, repository publish, and requested staging migration replay are complete; this item remains `in_progress` until representative review and acceptance.
- `workspace_permission_roles` and `workspace_job_positions` now persist through checked local Supabase RPCs. Authenticated clients do not receive direct catalog-table write grants.
- Existing `hospital_admin` assignments are reconciled creator-first to explicit `owner`/`admin` assignments. Creator-less fallback owners are marked `legacy_fallback` and the UI asks a manager to confirm them.
- Supabase-mode role management and member invitation selectors read the server catalog. Mock mode retains the existing browser-session catalog behavior.
- The approved staging replay applied `workspace_role_catalog_server_enforcement` and `workspace_role_catalog_audit_event_type`. Remote migration history is aligned to source versions `20260711123806` and `20260711160000`.
- Production deployment, real-data operations, and a security-complete claim remain outside this item.

## Goal

Implement the MVP workspace permission-role model across docs, DB/RLS, server enforcement, member/invite UI, and synthetic seeds.

## Source Docs

- `docs/product/domain/workspace-auth-permissions.md`
- `docs/product/domain/role-permission-source-map.md`
- `docs/engineering/auth-security/auth-login/supabase-auth-mapping.md`
- `docs/engineering/auth-security/auth-login/db-backed-permission-adapter.md`

## Scope

- Separate permission roles from job positions.
- Use permission roles: `소유자`, `관리자`, `일반`, `커스텀 역할`.
- Exclude `게스트` from MVP.
- Use default job positions: `병원장`, `수의사`, `테크니션`, `데스크`.
- Allow hospital-created custom job positions.
- Keep `CS`, `마케터`, and `디자이너` out of the default job-position set.
- Add additive DB/RLS foundations while preserving legacy columns during rollout.
- Update resolver/API paths for dual-read compatibility.
- Update member and invitation UI to show Korean permission role separately from job position.
- Realize Cheongdam/demo seed users with realistic names and separate permission role/job position assignment.

## Out Of Scope

- `게스트` role implementation.
- Production Supabase migration push or real-data mutation.
- Real invite email delivery.
- Payment/provider side effects.
- Destructive removal of `user_memberships.roles`, `workspace_invitations.invited_roles`, or existing `permission_policies` in the first foundation.
- Default `CS`, `마케터`, or `디자이너` job positions.

## Done When

- Product source docs define the approved role/job model.
- Supabase migration/static tests cover additive role/job schema and RLS boundaries.
- Resolver/API tests cover new model reads and legacy compatibility.
- Member/invite UI tests cover role/job separation and custom-role management.
- Seed contract tests reject role-like display names for Cheongdam/demo staff.
- Security/QA evidence is recorded under `.omo/`.
- Branch is committed, pushed, opened as a PR, merged into `origin/main`, and local `main` is synced.
- The explicitly approved staging migration replay is recorded with source-aligned history and read-only boundary verification.

## Verification

- `npm run docs:check`
- `npx playwright test tests/workspace-auth-schema-migration.spec.ts tests/workspace-membership-rls-migration.spec.ts tests/workspace-last-admin-protection-migration.spec.ts --reporter=line`
- `npx playwright test tests/permission-resolver.spec.ts tests/db-workspace-permission-adapter.spec.ts tests/server-permission-enforcement.spec.ts --reporter=line`
- `npx playwright test tests/workspace-membership-status-server.spec.ts tests/workspace-role-status-write-server.spec.ts tests/workspace-role-management-regression.spec.ts --reporter=line`
- Focused browser/manual QA for the hospital member-management surface.
- Staging replay: migration history, direct catalog DML denial, anonymous RPC denial, RPC search path, owner continuity, and audit-event constraint checks.

## Notes

- Client-only UI gating is not a security-complete claim.
- Last protected authority moves from last active `hospital_admin` compatibility to last active `소유자` authority.
- Custom-role editing must deny owner-only escalation, wildcard permission grants, and cross-workspace assignment.
- The local migration reset also repairs the historical reception migration order by defining `patients.weight_kg` in the foundation migration before the reader that uses it. The later compatibility delta remains additive.
- The staging advisor still emits generic `SECURITY DEFINER` execution warnings for the two authenticated RPCs. They are intentionally authenticated-only and perform in-function membership/admin checks; this is not a blanket clearance of all advisor findings.
