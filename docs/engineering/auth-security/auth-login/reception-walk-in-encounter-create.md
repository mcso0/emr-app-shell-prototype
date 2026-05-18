---
id: ENGINEERING-AUTH-RECEPTION-WALK-IN-ENCOUNTER-CREATE
status: implemented
area: engineering
doc_type: api_boundary
related_work:
  - "DEN-60"
  - "docs/work/reception/RECEPTION-LIVE-PR-006-walk-in-encounter-create.md"
supersedes: []
superseded_by: []
last_updated: 2026-05-19
---

# Reception Walk-In Encounter Create

Updated: 2026-05-19
Linear: DEN-60
Project: `03 Reception & Encounter Persistence`

## Summary

DEN-60 connects walk-in reception creation to a server-owned write boundary.

The scope is intentionally narrow. It creates one `walk_in` encounter and one consultation waiting queue row after the route verifies actor identity, workspace membership, and `reception:create`. It does not implement appointment check-in, queue read replacement, chart/order/billing writes, or remote Supabase application.

## Boundary

Route:

- `POST /api/workspaces/[workspaceId]/reception/walk-in-encounters`

Server modules:

- `src/features/reception/server-walk-in-encounter.ts`
- `src/features/reception/server-walk-in-encounter-core.ts`
- `src/features/reception/walk-in-encounter.ts`

The route follows the Project 02/03 mutation pattern:

1. Resolve actor identity with `readServerSession()`.
2. Allow demo actor headers only in mock fallback mode.
3. Apply `enforceWorkspaceMutationRateLimit(...)`.
4. Validate patient, duration, and optional guardian context.
5. Check active workspace membership and `reception:create`.
6. In mock mode, use the local fallback writer.
7. In Supabase mode, call the local-first writer function.
8. Return typed `{ ok, status, walkIn, enforcedBy }` or stable denial/error values.

## DB Writer

Migration:

- `supabase/migrations/20260519120000_reception_walk_in_encounter_writer.sql`

Function:

- `public.clair_create_reception_walk_in_encounter(p_workspace_id, p_actor_user_id, p_walk_in)`

The writer:

- requires `private.clair_is_active_workspace_member(p_workspace_id)`
- validates active patient workspace scope
- validates optional guardian workspace scope and patient-guardian link
- inserts one `encounters` row with `reception_type = 'walk_in'`
- inserts one `waiting_queue_entries` row with `queue_type = 'consultation'` and `status = 'waiting'`
- returns camelCase JSON for the Next.js route adapter

## UI Connection

The reception walk-in dialog now submits through the server route on final `생성`.

On success, the returned encounter and queue entry are merged into the local reception store. This keeps the immediate demo UX while ensuring the write decision is owned by the server boundary.

## Out Of Scope

- Appointment check-in mutation
- Persisted queue/calendar read replacement
- Chart, SOAP, order, billing, audit, messaging provider, file storage, or payment persistence
- Final domain RLS policy SQL
- Remote Supabase link/push
- Real patient, guardian, hospital, clinic, or staff data

## Verification

- `npx playwright test tests/reception-walk-in-encounter-server.spec.ts --reporter=line`: 6 passed
- `npx playwright test tests/reception.spec.ts -g "reception creates a walk-in waiting row|reception walk-in keeps selected veterinarian|server-backed walk-in encounter" --reporter=line`: 3 passed
- `npx playwright test tests/reception.spec.ts --reporter=line`: 24 passed
- `npx playwright test tests/workspace-rate-limit-server.spec.ts -g "shared rate limit boundary" --reporter=line`: 1 passed
- `npx tsc --noEmit`: passed
- `npm run security:secrets`: Secret scan passed, 1160 tracked files checked
- `npm run docs:check`: Checked 354 docs/agent markdown files

`npx supabase db reset --local` could not run because the Docker daemon was unavailable. Remote Supabase was not linked, pushed, queried, or modified.

Full final verification is recorded in the DEN-60 report:

- `docs/completed/reception/2026-05-19-den-60-reception-walk-in-encounter-create-report.html`
