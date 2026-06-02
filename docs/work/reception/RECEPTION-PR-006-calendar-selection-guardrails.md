---
id: "RECEPTION-PR-006"
status: "human_review"
area: "reception"
priority: "P1"
target_pr: "Project 19 / DEN-388-DEN-394"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/reception/RECEPTION-PR-005-calendar-task-creation-ux.md"
  - "docs/product/features/reception-appointment-spec.md"
  - "docs/design/ux-flows/reception-appointment-flow.md"
dependencies:
  - "RECEPTION-PR-005"
updated: "2026-06-02"
---

# Reception Calendar Selection Guardrails

## Goal

Harden the reception calendar's 15-minute click and drag task creation so invalid selections do not open the draft drawer or leave a temporary schedule card.

## PR Creation Gate

- Goal: prevent invalid reception task creation from unavailable time, outside business hours, overlapping cards, and unstable lane/date/duration boundaries.
- PR size: one reception calendar UX and validation PR, plus focused Playwright coverage and closeout.
- Scope: `src/features/reception/module.tsx`, `tests/reception.spec.ts`, this work item, and Korean closeout reports.
- Out of scope: live Supabase validation, DB migrations, RLS, production deploy, real appointment persistence, calendar card drag-resize/move editing, and hospital schedule management CRUD.
- Done criteria: invalid selections are visibly blocked and never create a drawer or draft card; valid selections keep the Project 18 behavior.
- Verification: focused lint/typecheck and reception Playwright scenarios for valid and invalid selection paths.
- Status/dependencies: active follow-up to completed Project 18 / `RECEPTION-PR-005`.
- Duplicate check: Project 18 created the happy-path interaction; it did not implement selection guardrails.

## Selection Contract

- The day calendar remains the source interaction surface for this project.
- Click creation creates a 15-minute draft only when the clicked quarter slot is valid.
- Drag creation creates a draft only when the whole snapped range is valid.
- Start and end times must normalize to exact quarter-hour boundaries: `HH:00`, `HH:15`, `HH:30`, `HH:45`.
- Minimum duration is 15 minutes.
- Reverse drag is allowed when it can normalize into a valid range.
- A draft drawer and temporary draft schedule card must share the same selection id, start time, duration, and veterinarian lane.
- Only one temporary draft schedule card can exist at a time.
- Drag selection previews are transient and must never accumulate across multiple cells.
- Calendar selection is not a completed reception task. Completion happens only after the draft drawer `생성` submit succeeds through the reception walk-in API.

## Invalid Reasons

Use explicit invalid reasons so UI and tests do not depend on ad hoc booleans:

- `outside-business-hours`: any selected slot falls before opening or at/after closing.
- `unavailable-time`: any selected slot intersects lunch, hospital closure, veterinarian unavailable time, or a blocked demo interval.
- `overlap`: any selected slot overlaps an existing appointment or session-only walk-in task in the same veterinarian lane.
- `too-short`: normalized duration is less than 15 minutes.
- `too-long`: normalized duration exceeds the allowed draft duration for this workflow.
- `lane-boundary`: pointer movement cannot be safely associated with the starting veterinarian lane.
- `date-boundary`: pointer movement crosses out of the active day view date/column.

## UX Behavior Matrix

| Case | Expected behavior |
| --- | --- |
| Valid 15-minute click | Open `reception-draft-task` drawer and show one temporary draft card. |
| Valid multi-slot drag | Open drawer with snapped start and duration; show temporary draft card for the selected range. |
| Reverse valid drag | Normalize to earlier start and later end, then follow valid drag behavior. |
| Business-hours violation | Do not open drawer; do not show temporary draft card; show disabled or warning feedback. |
| Unavailable-time violation | Do not open drawer; do not show temporary draft card; show disabled or warning feedback. |
| Existing-card overlap | Do not open drawer; do not show temporary draft card; keep the existing card selectable. |
| Partial invalid range | Treat the whole selection as invalid instead of silently trimming it. |
| Drawer cancel | Remove the temporary draft card and close the draft drawer. |
| Drawer create | Remove the temporary draft card and replace it with the committed session-only schedule card. |
| Another calendar selection | Clear the previous temporary draft card before opening/selecting the next item. |
| External calendar click | Clear the temporary draft card. |
| New drag while another preview exists | Clear the old preview immediately and keep only the active preview. |
| Drawer create API failure | Keep the temporary state, do not create a committed schedule card, and show an error. |

## Implementation Plan

1. Add a shared validation and normalization function for calendar selections.
2. Route both click and drag creation through that function.
3. Add unavailable and overlap inputs from the existing session-only calendar data.
4. Render invalid drag/hover feedback without creating a draft.
5. Preserve the existing valid draft lifecycle from Project 18.
6. Add focused Playwright coverage for valid and invalid paths.

## Linear Issues

- `DEN-388`: define this contract and edge-case matrix.
- `DEN-389`: build the 15-minute validation foundation.
- `DEN-390`: enforce invalid selection feedback and drawer gating.
- `DEN-391`: handle lane, date, duration, and draft lifecycle edge cases.
- `DEN-392`: verify guardrails and produce the final report.
- `DEN-393`: rework calendar drag previews so only one active preview can exist.
- `DEN-394`: clarify draft versus committed schedule creation semantics.

## Verification Plan

- `npm run lint -- src/features/reception/module.tsx tests/reception.spec.ts`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:<port> npx playwright test tests/reception.spec.ts --grep "15-minute calendar click|dragged calendar range|draft schedule card|invalid selection|overlap"`

## Closeout

- Status: ready for Human Review.
- Implemented validation foundation, invalid slot/drag feedback, draft lifecycle replacement, max duration blocking, and reverse drag normalization coverage.
- Rework added a global drag-preview clear event so stale local `ScheduleSelectionCell` previews cannot stack.
- Rework changed draft drawer creation so committed walk-in cards appear only after the walk-in API returns success.
- Final report: `docs/completed/reception/2026-06-02-den-392-calendar-selection-guardrails-closeout-report.html`.
- Rework reports:
  - `docs/completed/reception/2026-06-02-den-393-calendar-drag-preview-singleton-report.html`
  - `docs/completed/reception/2026-06-02-den-394-draft-versus-committed-schedule-creation-report.html`
