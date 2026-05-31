# Design Pattern Checklist

Use after approval for workflow consistency, screen architecture, or operational UX review.

## Navigation Pattern

- Current location is clear.
- Parent/child structure is understandable.
- Switching work areas does not destroy important context.
- Back, close, and return behavior preserve the user's prior state.

## List / Detail Pattern

- Lists preserve filters, sort, selection, and scroll when detail opens and closes.
- Master-detail, drawer, side panel, or full-page routing matches task complexity.
- Row click, checkbox, menu, and inline action targets do not conflict.

## Drawer / Modal / Full Page

- Drawer: contextual detail or secondary task while preserving list context.
- Modal: short independent confirmation, choice, or warning.
- Full page: complex task or large save unit.
- Inline edit: fast status/value changes.
- Popover: short auxiliary info or lightweight choice.

## Form / Save Pattern

- Save/cancel/delete placement is consistent.
- Loading, success, failure, duplicate-submit, and unsaved-change behavior is defined.
- The save unit is clear: draft, confirm, complete, pay, restore, archive, etc.

## Search / Filter / Sort

- Filter state persists across detail views.
- Default sort matches workflow priority, not database column order.
- Important EMR filters are considered when relevant: patient, guardian, chart number, visit date, reception status, clinical status, billing status, assignee, test type.

## Table / List Pattern

- Important columns come first.
- Empty/loading states exist.
- Pagination or scroll behavior is explicit.
- Dense columns have wrapping/truncation rules.
- Fixed columns or horizontal scroll are deliberate when column count is high.

## Status Pattern

- Status names, colors, priority, transition rules, permissions, next actions, and display locations are coherent.
- Status badges are not only visual decoration; they reflect workflow rules.

## Permission Pattern

- Role-specific menus and actions are consistent.
- Decide whether unavailable actions are hidden, disabled, or shown with reason.
- Permission UX must not be mistaken for security; server/API/DB enforcement remains the boundary.

## Accessibility / Responsive

- Keyboard navigation, focus, ESC close, Enter submit, tooltip labels, aria labels, and small-laptop usability are checked when the touched surface includes controls or overlays.
