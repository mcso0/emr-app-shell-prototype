---
id: "RECEPTION-QA-PR-007"
type: "Work Item"
title: "Reception cancelled queue visibility and restore"
description: "Make cancelled reception/appointment items disappear from calendar while remaining visible and restorable in the reception side queue."
status: "implemented"
area: "reception"
priority: "P0"
tags:
  - "reception"
  - "queue"
  - "cancel-restore"
updated: "2026-06-18"
---

# Reception Cancelled Queue Visibility And Restore

## Scope

- Queue route is date-scoped with `date=YYYY-MM-DD`.
- Queue read returns encounter-backed rows and appointment-only rows.
- Cancelled rows are excluded from calendar reads and calendar rendering.
- Cancelled rows remain visible in the reception side queue under a cancelled group.
- Side queue tabs are `전체`, `외래`, `예약`.
- Cancelled encounter and appointment rows can be restored through server-owned routes.
- Day/week calendar initial entry centers the current-time marker after initial layout settles, without overriding later user scroll.

## Changed Contracts

- `GET /api/workspaces/[workspaceId]/reception/queue?date=YYYY-MM-DD`
- `POST /api/workspaces/[workspaceId]/reception/encounters/[encounterId]/restore`
- `POST /api/workspaces/[workspaceId]/reception/appointments/[appointmentId]/restore`
- `clair_list_reception_queue(p_workspace_id, p_day, p_limit)`
- `clair_restore_reception_encounter(p_workspace_id, p_actor_user_id, p_encounter_id)`
- `clair_restore_reception_appointment(p_workspace_id, p_actor_user_id, p_appointment_id)`

## Verification

- `npx tsc --noEmit`: passed
- `npx playwright test tests/reception-queue-read-server.spec.ts tests/reception-encounter-restore-server.spec.ts tests/reception-appointment-restore-server.spec.ts tests/reception-mutation-permissions-server.spec.ts --reporter=line`: 53 passed
- `npx playwright test tests/reception.spec.ts -g "reception renders the first-path workspace" --reporter=line`: passed
- `npx playwright test tests/reception.spec.ts -g "walk-in persistence regression reloads from queue and calendar reads" --reporter=line`: passed
- `npx playwright test tests/reception.spec.ts -g "initially centers the current-time marker" --reporter=line`: 2 passed
- Manual local Playwright coordinate check at 1440x640: day/week current-time marker distance from viewport center 0.5px
- `npm run lint`: passed with existing warnings
