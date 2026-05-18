---
id: ENGINEERING-AUTH-RECEPTION-APPOINTMENT-CHECK-IN-TRANSITION
status: implemented
area: engineering
doc_type: api_boundary
related_work:
  - "DEN-59"
  - "docs/work/reception/RECEPTION-LIVE-PR-007-appointment-check-in-transition.md"
supersedes: []
superseded_by: []
last_updated: 2026-05-19
---

# Reception Appointment Check-In Transition

Updated: 2026-05-19
Linear: DEN-59
Project: `03 Reception & Encounter Persistence`

## Summary

DEN-59 connects appointment check-in to a server-owned transaction boundary.

The scope is intentionally narrow. It transitions a confirmed appointment into `checked_in`, creates one linked `appointment` encounter, creates one consultation waiting queue row, and records an appointment change log. It does not implement appointment CRUD, no-show automation, reminder provider integration, or final domain RLS policy SQL.

## Boundary

Route:

- `POST /api/workspaces/[workspaceId]/reception/appointments/[appointmentId]/check-in`

Server modules:

- `src/features/reception/server-appointment-check-in.ts`
- `src/features/reception/server-appointment-check-in-core.ts`
- `src/features/reception/appointment-check-in.ts`

The route follows the Project 02/03 mutation pattern:

1. Resolve actor identity with `readServerSession()`.
2. Allow demo actor headers only in mock fallback mode.
3. Apply `enforceWorkspaceMutationRateLimit(...)`.
4. Validate active workspace membership and `reception:create`.
5. Validate appointment workspace scope, status, and duplicate check-in.
6. In mock mode, use the local fallback writer.
7. In Supabase mode, call the local-first writer function.
8. Return typed `{ ok, status, checkIn, enforcedBy }` or stable denial/error values.

## DB Writer

Migration:

- `supabase/migrations/20260519130000_reception_appointment_check_in_writer.sql`

Function:

- `public.clair_check_in_reception_appointment(p_workspace_id, p_actor_user_id, p_appointment_id)`

The writer:

- requires `private.clair_is_active_workspace_member(p_workspace_id)`
- locks the appointment row with `for update`
- rejects missing, non-confirmed, or already checked-in appointments
- updates `appointments.status` to `checked_in`
- inserts one `encounters` row with `reception_type = 'appointment'`
- inserts one `waiting_queue_entries` row with `queue_type = 'consultation'`
- inserts one `appointment_change_logs` row with non-secret before/after snapshots
- returns camelCase JSON for the Next.js route adapter

## UI Connection

The appointment `접수 처리` action now submits through the server route.

On success, the returned appointment, encounter, and queue entry are merged into the local reception store. This preserves the existing immediate demo UX while moving the transition decision behind the server boundary.

## Out Of Scope

- Appointment CRUD
- No-show automation
- Reminder, Kakao, SMS, email, or storage provider integration
- Persisted queue/calendar read replacement
- Chart, SOAP, order, billing, audit project, file storage, or payment persistence
- Final domain RLS policy SQL
- Remote Supabase link/push
- Real patient, guardian, hospital, clinic, or staff data

## Verification

- `npx playwright test tests/reception-appointment-check-in-server.spec.ts --reporter=line`: 6 passed
- `npx playwright test tests/reception.spec.ts -g "server-backed appointment check-in|reception check-in converts" --reporter=line`: 2 passed
- `npx playwright test tests/reception.spec.ts --reporter=line`: 25 passed
- `npx playwright test tests/workspace-rate-limit-server.spec.ts -g "shared rate limit boundary" --reporter=line`: 1 passed
- `npx tsc --noEmit`: passed
- `npm run security:secrets`: Secret scan passed, 1160 tracked files checked
- `npm run docs:check`: Checked 356 docs/agent markdown files

`npx supabase db reset --local` could not run because the Docker daemon was unavailable. Remote Supabase was not linked, pushed, queried, or modified.

Full final verification is recorded in the DEN-59 report:

- `docs/completed/reception/2026-05-19-den-59-reception-appointment-check-in-transition-report.html`
