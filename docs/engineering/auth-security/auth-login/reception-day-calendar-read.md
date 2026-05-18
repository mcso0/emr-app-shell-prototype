---
title: "Reception Day Calendar Read"
status: "human_review"
updated: "2026-05-19"
source:
  - "DEN-63"
  - "docs/work/reception/RECEPTION-LIVE-PR-010-reception-day-calendar-read.md"
---

# Reception Day Calendar Read

Linear: DEN-63

## Summary

DEN-63 adds a persisted read boundary for the reception day calendar.

The calendar now has a server-owned read path that can return appointment-only rows, checked-in appointment encounters, and walk-in encounters. The UI keeps existing mock fixtures by default, then overlays successful persisted-shaped responses into schedule state.

## Routes And Files

- `GET /api/workspaces/[workspaceId]/reception/calendar/day?date=YYYY-MM-DD`
- `src/app/api/workspaces/[workspaceId]/reception/calendar/day/route.ts`
- `src/features/reception/server-reception-calendar-read.ts`
- `src/features/reception/server-reception-calendar-read-core.ts`
- `src/features/reception/reception-calendar-read.ts`
- `supabase/migrations/20260519150000_reception_day_calendar_reader.sql`
- `src/features/reception/store.ts`
- `src/features/reception/data.ts`
- `src/features/reception/module.tsx`
- `tests/reception-calendar-read-server.spec.ts`
- `tests/reception.spec.ts`

## Permission Boundary

The calendar read path requires:

- authenticated actor identity or mock-mode demo actor header;
- active workspace membership;
- `reception:view`.

The route does not accept client-provided role claims as authority. Supabase mode uses the server client and RPC gateway; mock mode uses an empty persisted overlay so demo fixtures remain intact.

## Calendar Read Model

Each record may include:

- `appointment`: scheduled appointment row;
- `encounter`: linked appointment encounter or walk-in encounter;
- `queueEntry`: consultation/billing queue state when the encounter is in an operational queue.

The UI maps:

- appointment-only records to appointment cards;
- checked-in appointment records to checked-in appointment cards plus encounter-backed draft state;
- walk-in records to walk-in schedule cards.

## Supabase Boundary

`public.clair_list_reception_day_calendar(p_workspace_id text, p_day date)`:

- checks `private.clair_is_active_workspace_member(p_workspace_id)`;
- reads appointments by workspace and scheduled day;
- left joins linked encounters and active queue rows;
- includes walk-in encounters checked in on the same day;
- returns camelCase JSON shaped for the TypeScript domain model.

This SQL was added local-first only. It was not pushed or applied to remote Supabase.

## Out Of Scope

- Appointment CRUD.
- Drag/drop scheduling.
- No-show automation.
- Queue status mutation.
- Chart/order/billing persistence.
- Final domain RLS policy SQL.
- Remote Supabase, production deploy, or real patient, guardian, hospital, clinic, or staff data.

## Verification

- `npx playwright test tests/reception-calendar-read-server.spec.ts --reporter=line`: 5 passed
- `npx playwright test tests/reception.spec.ts -g "server-backed reception day calendar read" --reporter=line`: 1 passed
- `npx tsc --noEmit`: passed
- `npm run build`: passed
- `npx playwright test tests/reception.spec.ts --reporter=line`: 27 passed
- `npm run security:secrets`: passed
- `npm run docs:check`: passed

Broader final verification is recorded in the DEN-63 report:

- `docs/completed/reception/2026-05-19-den-63-reception-day-calendar-read-report.html`
