---
id: "RECEPTION-QA-PR-002"
type: "Work Item"
title: "Reception date navigation, list filter, and search UX"
description: "Implements DEN-514 reception QA fixes for selected-date navigation, queue/calendar API readback, side-panel list filters, search behavior, and small visual polish."
status: "human_review"
area: "reception"
priority: "P0"
tags:
  - "reception"
  - "qa"
  - "date-navigation"
  - "queue-search"
target_pr: "Reception QA project / DEN-514"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/reception/RECEPTION-QA-PR-001-db-api-fallback-boundary.md"
dependencies:
  - "RECEPTION-QA-PR-001"
updated: "2026-06-16"
---

# Reception Date Navigation, List Filter, and Search UX

## Goal

Make the reception module's date, queue, and search controls behave like a real operational schedule surface: changing dates must refetch queue/calendar data for that date, the side-panel filters must show useful counts, and search must follow the shared queue search pattern.

## Scope

- Wire day/week/month previous and next controls to update the selected operating date.
- Make the date picker select a specific date and close after selection.
- Disable the today button when the selected operating date is already today.
- Refetch calendar and queue data using the selected operating date.
- Keep reception side-panel summaries filtered to the selected operating date.
- Move the list type segmented control into the list header and show counts for total, waiting, and reserved items.
- Replace the custom side-panel search input with the shared inline queue search UX.
- Extend queue search to include visit purpose, memo, and veterinarian context.
- Add the requested small visual polish:
  - queue card description left padding
  - business-hour time text in sky 600

## Out Of Scope

- Reservation creation and check-in conversion flows.
- Reception detail drawer edit mode.
- Weight persistence and patient profile update contracts.
- Remote Supabase migrations or production-demo deploy.
- Replacing existing Sales Demo fallback behavior.

## Implementation Notes

- `operatingDateByWorkspace` is now stored in the reception store so the calendar, drawer, and side panel can share the same selected operating date.
- `getReceptionPatientSummaries` now filters appointment and encounter summaries by the selected operating date before producing the side-panel list.
- The date control updates selected operating date by:
  - one day in day view
  - one week in week view
  - one month in month view
- Changing the operating date clears any transient calendar drag/draft selection so a stale draft does not follow the user to another date.
- Search remains local over already-read summaries but now covers visit purpose, reception memo, appointment symptom note, and veterinarian name in addition to patient/guardian fields.
- The work intentionally keeps the implementation inside existing reception modules and shared EMR subpanel primitives. No new broad scheduling abstraction was added.

## DB/API Boundary

- Date changes trigger `GET /api/workspaces/[workspaceId]/reception/calendar/day?date=YYYY-MM-DD` for the selected date.
- Queue reads continue through `GET /api/workspaces/[workspaceId]/reception/queue`; the client-side summary is filtered to the selected operating date.
- Acceptance is based on synthetic/demo API readback and Playwright request assertions, not mock-only UI state.
- No DB schema, RPC, or remote Supabase operation was performed in this issue.

## Done When

- Previous/next date controls update the selected operating date.
- Date picker selects a date and data for that date is requested.
- Today button returns to today and is disabled when already on today.
- Side-panel list counts are visible in the filter tabs.
- Side-panel search opens inline like the clinical pathology queue search pattern and closes cleanly.
- Queue card description and business-hour time color polish are applied.
- Existing reception regression coverage remains green.

## Verification

- `npx playwright test tests/reception.spec.ts --reporter=line`: 48 passed
- `npx playwright test tests/reception.spec.ts --grep "reception renders the first-path|reception side panel searches" --reporter=line`: 2 passed
- `npm run lint`: blocked before linting because `eslint-plugin-storybook` is missing from the local install.
- `npx tsc --noEmit --pretty false`: blocked by missing Storybook/Vitest type packages in the local install.

## Handoff Notes

- Follow-up reception issues should reuse the store selected operating date instead of calling `getWorkspaceOperatingDate` directly for user-visible forms or drawers that depend on the active schedule date.
- Follow-up tests that create synthetic queue or calendar responses must align their timestamps with the selected operating date, otherwise the side panel will correctly filter them out.
- Do not reintroduce the removed custom queue search row; extend the shared `EmrListHeader` search path if more list-search behavior is needed.
- 2026-06-25 follow-up: reception queue read responses now include DB-readback summary counts for total, walk-in, and appointment work. Reception and shared queue empty states use centered icon+single-line copy without bordered placeholder panels.

## Result

Ready for Human Review.

DEN-514 implemented the selected-date, filter, search, and small polish fixes with API request verification. Remaining reservation creation, weight persistence, and reception detail editing work stays in later issues.
