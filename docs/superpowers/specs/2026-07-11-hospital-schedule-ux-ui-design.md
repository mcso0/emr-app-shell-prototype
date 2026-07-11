# Hospital Schedule UX/UI Design

## Status

Approved for design artifact creation on 2026-07-11. This document specifies the UX/UI proposal only; it does not authorize production implementation or persistence changes.

## Goal

Turn the current static hospital-admin schedule concept into an operational scheduling surface that clearly supports viewing, creating, editing, deleting, publishing, and reviewing staff schedules. Include employee self-service for personal schedule review and leave or shift-change requests.

## Primary Users

- Hospital administrator or operations manager: builds and publishes the weekly schedule, resolves conflicts, and reviews staffing coverage.
- Staff member: reviews personal shifts, confirms changes, and submits leave or shift-change requests.

## Chosen Direction

Use a Flex-inspired hybrid schedule with contextual editing and an employee detail sheet.

- The default admin view is a staff-by-seven-day weekly matrix modeled on Flex shift management: avatar and staff metadata stay on the left, while compact pastel shift-type blocks occupy the date cells.
- A secondary daily timeline follows Flex's colleague schedule view and shows each staff member's working span across an hourly axis so coverage gaps are visible.
- A shift can be created from an empty cell or the primary `근무 추가` action.
- A shift card opens an edit sheet with duplicate, delete, and absence actions.
- Selecting a staff member opens an employee sheet with weekly hours, availability, personal schedule, and requests.
- Employee self-service uses a personal time-block calendar inspired by Flex's work and leave calendar.
- Draft and published states are explicit. Publishing is a separate action from saving an individual shift.
- Coverage gaps, conflicts, and pending requests appear as an actionable status strip instead of decorative summary cards.

## Information Architecture

### Admin schedule

1. Page title, current schedule state, and publication action.
2. Week navigation, today shortcut, view options, role filter, and staff search.
3. Week/day segmented view control, role filter, and staff search.
4. Actionable status strip for vacancies, conflicts, and pending requests.
5. Staff-by-day weekly matrix with a dedicated unassigned row.
6. Staff-by-hour daily timeline for coverage review.
7. Contextual shift editor sheet and employee detail sheet.
8. Schedule policy settings moved to a secondary settings dialog.

### Employee self-service

1. Next shift and weekly hours summary.
2. Personal weekly time-block calendar.
3. Availability and recurring constraints.
4. Leave and shift-change requests with visible status.

## Interaction Contract

- Empty cell: create shift prefilled with employee and date.
- Shift card: open edit sheet; preserve the grid context behind it.
- Shift menu: duplicate, mark absence, or delete with confirmation for destructive actions.
- Employee name: open employee detail sheet.
- Publish: validate conflicts and coverage before notifying staff.
- Published schedule change: show changed shifts and require a short change note before republishing.
- Staff request: create a pending request; do not change the published schedule until approved.

## States

- Loading: preserve grid geometry with row and cell skeletons.
- Empty: explain that no shifts exist for the week and offer `템플릿 적용` and `첫 근무 추가`.
- Error: keep the last readable schedule when possible and provide retry.
- Permission: read-only grid with edit actions removed and a clear administrator-only message.
- Conflict: mark the affected shift and explain the specific overlap or availability issue in the editor.
- Unsaved draft: show a draft badge and persistent publish action.
- Published: show publication timestamp and changed-since-publish count.

## Visual Direction

- Use the existing CLAiR neutral palette, spacing rhythm, and rounded controls as the base.
- Translate Flex's visual system into CLAiR: bright canvas, subtle gray grid lines, staff avatars, compact metadata, and low-saturation mint, yellow, blue, and lavender schedule blocks.
- Keep Flex's information pattern, not its branding. CLAiR typography, control height, radius, icon source, and accessibility contract remain authoritative.
- Use short text labels with color so schedule meaning never depends on icons or color alone.
- Prefer borders, type weight, whitespace, and one primary action over nested card containers.

## Existing Component Mapping

- CLAiR: `EmrModuleListSidePanel`, `EmrRowActionMenu`, `EmrEmptyState`, table primitives, confirmation dialog content.
- shadcn: `Button`, `Badge`, `Input`, `Select`, `Popover`, `Dialog`, `Sheet` or the existing side-panel equivalent, `Tabs`, `Table`, `ScrollArea`, `Tooltip`, `Switch`, `Checkbox`, `Textarea`.
- Icons: existing `@/components/icons` or the repository's Lucide-backed icon source only.

## Accessibility And Responsive Requirements

- Shift cards must have accessible names containing staff, date, and time.
- Every grid action must be keyboard reachable; editing must not depend on drag and drop.
- Status cannot rely on color alone.
- Sheets and dialogs must manage focus and expose labels and descriptions.
- On narrow screens, switch the admin grid to a day list; employee self-service remains a vertical weekly list.

## Out Of Scope

- Payroll, attendance, time-clock, overtime calculation, or labor-law automation.
- Automatic optimization or AI assignment.
- Database schema, API, RLS, notifications, or production deployment.
- Real staff data.

## Validation Plan For A Future Implementation

- Focused component tests for create, edit, delete, conflict, and publish states.
- Keyboard and screen-reader checks for grid, sheet, and dialogs.
- Desktop weekly grid and mobile day-list visual checks.
- E2E flow for admin publish and employee request approval.
