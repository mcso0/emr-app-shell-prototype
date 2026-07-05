---
id: "RECEPTION-QA-PR-008"
type: "Work Item"
title: "Global command today reception navigation"
description: "Makes the global command palette's today reception action navigate to the reception screen with today's operating date selected."
status: "done"
area: "reception"
priority: "P1"
tags:
  - "reception"
  - "global-command"
  - "date-navigation"
  - "appointment-calendar"
target_pr: "Browser Comment 1 / codex/reception-today-command-navigation"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/reception/RECEPTION-QA-PR-002-date-filter-search.md"
  - "docs/work/reception/RECEPTION-LIVE-PR-010-reception-day-calendar-read.md"
  - "docs/design/screens/reception/planning/cds-v2-reception-screen-alignment-notes.md"
  - "docs/product/demo-data/clinic-start-state-and-demo-operations-v1.md"
dependencies:
  - "RECEPTION-QA-PR-002"
updated: "2026-07-05"
---

# Global Command Today Reception Navigation

## Goal

Make the global command palette's today reception action a deterministic shortcut to today's `접수/예약` screen instead of a generic reception route that can inherit stale selected-date state.

## Scope

- Rename the command palette action from `오늘 예약 보기` to `오늘 접수/예약 보기`.
- Route the command to `/w/{workspaceId}/reception?modulePanel=open&date={todayOperatingDate}`.
- Resolve `todayOperatingDate` with `getWorkspaceOperatingDate(workspaceId)` at command execution time.
- Let the reception screen read, validate, and apply the `date` search param.
- Keep calendar and queue reads on the existing API routes with the selected date.
- Add focused Playwright coverage for command navigation, route-date readback, invalid date fallback, and stale-date reset.

## Out Of Scope

- Reservation creation, appointment check-in, cancellation, or restore behavior.
- New calendar view design, calendar card styling, or CDS V2 visual alignment work.
- DB schema, Supabase migration, RPC, RLS, remote Supabase replay, or production-demo deploy.
- Real patient, guardian, hospital, staff, payment, identity, or provider data.
- Cross-module date persistence for chart, billing, lab, imaging, or fulfillment queues.

## Done When

- The command palette shows `오늘 접수/예약 보기`.
- Clicking the action from another module navigates to `접수/예약` with module panel open and today's operating date in the URL.
- Direct `date=YYYY-MM-DD` reception entry selects that date and reads calendar/queue data for that date.
- Invalid `date` values fall back to the workspace operating date without breaking the screen.
- A stale non-today reception date resets to today when the global command is used.
- Focused verification commands are recorded below.

## Verification

- `npm run lint -- src/shell/global-command-palette.tsx src/features/reception/module.tsx tests/app-shell.spec.ts tests/reception.spec.ts` passed with existing `src/features/reception/module.tsx` unused-symbol warnings only.
- `npx tsc --noEmit --pretty false` passed.
- `npx playwright test tests/app-shell.spec.ts -g "global command palette" --reporter=line` passed.
- `npx playwright test tests/reception.spec.ts -g "route date|selected operating date|topbar refresh" --reporter=line` passed.
- `npm run docs:check` passed.

## Implementation Notes

- The global command resolves the workspace operating date at click time and includes it as `date=YYYY-MM-DD` in the reception URL.
- The reception module validates the route `date` with `isIsoOperatingDate`; invalid values fall back to the workspace operating date.
- Applying a route date clears transient calendar drag/draft selection before syncing the workspace operating date store.
- No backend, migration, RPC, RLS, or new API work was needed. The existing calendar and queue read APIs already accept `date`.

## Handoff Notes

- Backend changes are not expected. Existing reception calendar and queue APIs already accept `date`.
- This issue intentionally excludes the separate `신규 진료 접수` and `환자/보호자 등록` command work visible in other local branches/worktrees.
