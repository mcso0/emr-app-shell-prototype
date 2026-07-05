---
id: "RECEPTION-QA-PR-010"
type: "Work Item"
title: "Reception toolbar today shortcut placement"
description: "Move the reception calendar today shortcut out of the date label cluster and next to the veterinarian filter so it reads as a shortcut/filter action."
status: "implemented"
area: "reception"
priority: "P1"
tags:
  - "reception"
  - "appointment-calendar"
  - "toolbar"
  - "date-navigation"
target_pr: "Browser Comment 1 / codex/reception-today-shortcut"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/reception/RECEPTION-QA-PR-002-date-filter-search.md"
dependencies:
  - "RECEPTION-QA-PR-002"
updated: "2026-07-05"
---

# Reception Toolbar Today Shortcut Placement

## User Request Understanding

Browser Comment 1 points at the reception calendar top toolbar. The `오늘` button sat next to the date label, which made it easy to read as a "today" status marker instead of a "go to today" shortcut.

The requested layout is to place that shortcut next to the veterinarian selector, where filter-like controls and shortcuts are grouped.

## Scope

- Move the `오늘` shortcut from `ReceptionScheduleDateControl` to the right-side `ScheduleToolbar` action cluster.
- Place it immediately after the veterinarian filter and before the `일/주/월` segmented view control.
- Keep the existing disabled state when the selected operating date is already today.
- Keep the existing `onOperatingDateChange(todayDate)` behavior.
- Add focused Playwright coverage for the toolbar order.

## Out Of Scope

- Global command palette behavior.
- Date picker, previous/next controls, or calendar read API behavior.
- Reservation creation, appointment check-in, cancellation, or restore behavior.
- DB schema, Supabase migration, RLS, remote Supabase replay, or production-demo deploy.
- Real patient, guardian, hospital, staff, payment, identity, or provider data.

## Done When

- The date label cluster no longer contains the `오늘` shortcut.
- The top toolbar orders controls as veterinarian filter, `오늘`, `일/주/월`, registration and reception actions.
- Clicking `오늘` still calls the existing today date navigation path.
- Focused UI regression coverage verifies the placement next to the veterinarian selector.

## Implementation Notes

- Updated `src/features/reception/module.tsx` so `ReceptionScheduleDateControl` only renders date controls and no longer owns the today shortcut.
- Moved the `오늘 일자로 이동` button into `ScheduleToolbar` after the veterinarian filter dropdown.
- Updated `tests/reception.spec.ts` to assert the `오늘` shortcut sits between the veterinarian filter and the calendar view segmented control.

## Verification

- `npx playwright test tests/reception.spec.ts -g "veterinarian selector controls visible schedule lanes" --reporter=line`: passed
- `npx eslint src/features/reception/module.tsx tests/reception.spec.ts`: passed with existing reception-module unused-code warnings
- `npx tsc --noEmit --pretty false`: passed
- `npm run docs:check`: passed

## Result

Implemented and ready for review. The `오늘` shortcut is now grouped with reception toolbar filters/shortcuts instead of the date display.
