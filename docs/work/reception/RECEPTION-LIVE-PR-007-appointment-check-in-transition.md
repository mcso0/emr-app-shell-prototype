---
id: "RECEPTION-LIVE-PR-007"
status: "human_review"
area: "reception"
priority: "P0"
target_pr: "Project 03 / DEN-59"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/reception-persistence-workspace-context-handoff.md"
  - "docs/engineering/auth-security/auth-login/reception-encounter-persistence-contract.md"
  - "docs/engineering/auth-security/auth-login/reception-domain-schema-migration.md"
  - "docs/engineering/auth-security/auth-login/reception-walk-in-encounter-create.md"
dependencies:
  - "RECEPTION-LIVE-PR-006"
updated: "2026-05-19"
---

# Reception Appointment Check-In Transition

## Goal

Persist appointment check-in through a server-owned transaction boundary.

## Scope

- Add a server-owned appointment check-in route under the workspace reception scope.
- Add writer gateway boundaries for mock fallback and Supabase mode.
- Add local-first DB writer SQL for appointment status update, linked encounter creation, consultation queue row creation, and appointment change log.
- Connect the appointment `접수 처리` path to the route while preserving immediate local demo UX.
- Validate workspace, appointment status, duplicate check-in, and `reception:create`.

## Out Of Scope

- Appointment CRUD.
- No-show automation.
- Reminder, Kakao, SMS, email, or storage provider integration.
- Persisted queue/calendar read replacement.
- Chart, order, billing, audit project, file storage, or payment persistence.
- Final domain RLS policy SQL.
- Remote Supabase link/push, production deploy, or real data access.

## Done When

- `POST /api/workspaces/[workspaceId]/reception/appointments/[appointmentId]/check-in` exists and returns a typed appointment, encounter, and queue row.
- Mock fallback and Supabase writer are separated.
- Workspace membership and `reception:create` are enforced before transition.
- Duplicate check-in cannot create a second encounter.
- The appointment card calls the server route and commits local UI state from a successful route response.
- Korean HTML report exists for DEN-59.
- Linear DEN-59 is commented and moved to Human Review.

## Verification

- `npx playwright test tests/reception-appointment-check-in-server.spec.ts --reporter=line`: 6 passed
- `npx playwright test tests/reception.spec.ts -g "server-backed appointment check-in|reception check-in converts" --reporter=line`: 2 passed
- `npx playwright test tests/reception.spec.ts --reporter=line`: 25 passed
- `npx playwright test tests/workspace-rate-limit-server.spec.ts -g "shared rate limit boundary" --reporter=line`: 1 passed
- `npx tsc --noEmit`: passed
- `npm run security:secrets`: Secret scan passed, 1160 tracked files checked
- `npm run docs:check`: Checked 356 docs/agent markdown files.
- `npx supabase db reset --local`: blocked because Docker daemon was unavailable.

## Result

Ready for Human Review.

DEN-59 added a server-owned appointment check-in transition boundary and connected the appointment `접수 처리` action to the new route. Remote Supabase, production deploy, and real clinic/patient data were not touched.
