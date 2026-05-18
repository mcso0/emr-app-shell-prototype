# AUTH-PR-023 Workspace Persistence Handoff and Project Closeout

Linear: DEN-41
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Package Project 01 results so Project 02 can start without rediscovering the auth, DB, RLS, and security decisions.

## Scope

- Summarize all Project 01 milestones and completed issue outputs.
- Identify the exact handoff assets for workspace/membership live persistence.
- Record blockers, follow-ups, and do-not-do gates.
- Recommend the first Project 02 issue, without starting Project 02.
- Create a Korean HTML closeout report and Linear handoff comment.

## Out Of Scope

- No new implementation.
- No Project 02 execution.
- No issue Done transition.
- No remote Supabase project link, SQL execution, migration push, or secret/service-role key usage.

## Completed Foundation

Project 01 produced:

1. Local-first live Supabase execution mode and secret/env handling gates.
2. Server-only Supabase session reader using verified claims.
3. Role update route identity seam using verified session and limiting demo header to mock fallback.
4. Auth guard/server session regression.
5. Workspace auth schema migration.
6. Local seed contract and validation plan.
7. DB-level last active `hospital_admin` protection foundation.
8. Workspace auth table RLS baseline.
9. DB-backed permission adapter boundary.
10. Server/RLS cross-workspace denial regression.
11. Security review and live-readiness blocker classification.

## Handoff Blockers

1. Actual Supabase migration/RLS execution still needs a Docker-backed local Supabase runtime or explicitly approved staging project.
2. Role management UI is still session-only and is not connected to live DB writes.
3. Real Supabase gateway implementation is not yet connected behind `WorkspacePermissionDbGateway`.
4. Clinical/domain table RLS is not part of Project 01 and must not be assumed complete.

## Recommended First Project 02 Issue

Start Project 02 with an environment and DB execution gate:

> Run the Project 01 migrations and seed in Docker-backed local Supabase, verify actual RLS behavior with authenticated admin/member/non-member sessions, and capture any SQL/RLS rework before wiring UI persistence.

This should come before live membership reads/writes because static SQL tests are not a substitute for executed RLS behavior.

## Verification

- `npm run docs:check`

Result: passed on 2026-05-18.

## Handoff Notes

Project 01 is ready for Human Review. Do not mark the Linear issues Done until 승욱 accepts the handoff.
