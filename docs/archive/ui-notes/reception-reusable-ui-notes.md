# Reception Reusable UI Notes

Date: 2026-05-02

This note captures reusable UI candidates observed while adapting the reception screen from the Figma reference and Google Calendar-like calendar UX. These are intentionally not extracted into shared components in PR 2. Code extraction can happen later in one pass after the reception flow stabilizes.

## Reference Patterns

- Reception side list: fixed-width operational task rail with title, department/team filter, task tabs, sort/filter controls, dense task cards, and a sticky create action.
- Calendar workspace: Google Calendar-style toolbar with date navigator, today action, practitioner filter, day/week/month switcher, and more menu.
- Day schedule: time rail on the left, all-day/top pinned area, hourly grid rows, appointment cards inside the grid, and a current-time indicator.
- Week schedule: seven-day grid with per-day header, active day emphasis, and compact event cards.
- Month schedule: large date cells with summarized counts such as treatment, reservation, event, and closed-day counts.
- Reception form panel: right-side sheet with department, assignee, guardian/patient search, weight, visit type, visit purpose, date/time/duration, memo, clinical history, and bottom actions.

## Reusable Candidates

### `ReceptionTaskCard`

Use for side-panel work items such as waiting reception, reserved appointments, follow-up tasks, and future message tasks.

Expected props: status label, patient name, guardian name, breed/species, symptom or purpose text, timestamp, selected state, menu action.

Notes: Keep this dense. It should fit many items in a 320px rail and avoid large decorative spacing.

### `ReceptionTaskRail`

Use for the left reception/appointment queue area.

Expected parts: title, team selector, segmented tabs, search field, sort/filter/search icon buttons, scroll body, sticky primary action.

Notes: This is close to the existing `EmrSubpanel` pattern and should likely compose existing subpanel primitives instead of replacing them.

### `CalendarWorkspaceToolbar`

Use for reception calendar, future appointment calendar, hospitalization schedule, and staff schedule screens.

Expected props: date label, today action, practitioner/team filter, view mode, secondary actions.

Notes: The view switch should stay visually stable across day/week/month. Date navigation and filters should not shift the calendar grid.

### `TimeGrid`

Use for day/week calendar views that need a time rail and hourly rows.

Expected props: start hour, end hour, slot height, current time marker, children rendered into time slots.

Notes: Follow Google Calendar interaction expectations: clear time rail, faint grid lines, event cards that sit inside slots, and minimal surrounding chrome.

### `ScheduleEventCard`

Use for appointment, treatment, surgery, hospitalization, or clinic event blocks.

Expected props: status, title, patient/guardian label, time range, assignee, compact/expanded variant, selected state, action slot.

Notes: Color should encode type/status but remain readable in dense grids. Avoid introducing too many unrelated hues.

### `QueueDock`

Use for compact operational queues placed beside a main workspace.

Expected props: queue title, count, rows, selected row, row action.

Notes: Useful for reception and treatment. It should remain secondary to the main calendar and avoid table-level density unless the panel is wide.

### `ReceptionFormDrawer`

Use for the right-side reception/create form shown in the reference.

Expected sections: visit department, assignee, guardian/patient search, patient weight, reception type, visit purpose, date/time/duration, memo, assessment history, footer actions.

Notes: This should use the shell drawer slot rather than the persistent right panel. The persistent right panel remains best for read-only patient context, while the drawer is better for reusable create/edit workflows.

### `AssessmentHistoryTable`

Use inside the reception form and patient detail contexts.

Expected columns: diagnosis date, end date, category, diagnosis name, end status, diagnosis status, veterinarian.

Notes: This should likely read from encounter, diagnosis, SOAP, and prescription bundles rather than inventing a separate mock shape.

## Extraction Guidance

- Keep PR 2 implementation local to `src/features/reception` until workflows settle.
- Extract only after at least two modules need the same UI shape.
- Prefer composition over a broad "calendar component" abstraction at first: toolbar, time grid, event card, and queue dock are cleaner boundaries.
- Keep domain labels sourced from `getStatusLabel()` and pass module-specific wording as presentation overrides later.
