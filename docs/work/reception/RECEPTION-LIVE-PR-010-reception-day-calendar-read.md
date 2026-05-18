---
id: "RECEPTION-LIVE-PR-010"
status: "human_review"
area: "reception"
priority: "P0"
target_pr: "Project 03 / DEN-63"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/reception-queue-read.md"
  - "docs/engineering/auth-security/auth-login/reception-mutation-permission-hardening.md"
  - "docs/engineering/auth-security/auth-login/reception-appointment-check-in-transition.md"
  - "docs/engineering/auth-security/auth-login/reception-walk-in-encounter-create.md"
  - "docs/engineering/auth-security/auth-login/reception-domain-schema-migration.md"
dependencies:
  - "RECEPTION-LIVE-PR-009"
updated: "2026-05-19"
---

# Reception Day Calendar Read

## Goal

Read persisted appointments and encounters into the reception day calendar.

## Scope

- Add a server-owned reception day calendar read route.
- Add mock fallback and Supabase reader gateway boundaries.
- Add local-first DB reader SQL for workspace-scoped appointment and walk-in rows.
- Connect reception content to hydrate appointment cards and walk-in cards from successful calendar responses.
- Preserve existing mock demo fixture behavior.

## Out Of Scope

- Appointment CRUD.
- Drag/drop scheduling.
- No-show automation.
- Queue status mutation.
- Chart/order/billing persistence.
- Final domain RLS policy SQL.
- Remote Supabase link/push, production deploy, or real data access.

## Done When

- `GET /api/workspaces/[workspaceId]/reception/calendar/day?date=YYYY-MM-DD` returns typed calendar records.
- Workspace membership and `reception:view` are enforced before calendar read.
- Day calendar can hydrate appointment-only and walk-in encounter rows from a persisted-shaped response.
- Korean HTML report exists for DEN-63.
- Linear DEN-63 is commented and moved to Human Review.

## Verification

- `npx playwright test tests/reception-calendar-read-server.spec.ts --reporter=line`: 5 passed
- `npx playwright test tests/reception.spec.ts -g "server-backed reception day calendar read" --reporter=line`: 1 passed
- `npx tsc --noEmit`: passed
- `npm run build`: passed
- `npx playwright test tests/reception.spec.ts --reporter=line`: 27 passed
- `npm run security:secrets`: passed
- `npm run docs:check`: passed

## Result

Ready for Human Review.

DEN-63 added the first persisted day calendar read boundary and connected successful calendar responses to the schedule state. Remote Supabase, production deploy, and real clinic/patient data were not touched.
