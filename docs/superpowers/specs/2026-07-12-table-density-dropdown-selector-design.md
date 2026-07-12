# Table Density Dropdown Selector Design

Date: 2026-07-12
Status: Approved for implementation

## Decision

Replace the shared icon-segmented `EmrTableDensitySelector` with one dropdown
button that exposes the active density. This changes the shared default for all
current selector consumers.

Approval: 승욱 approved the shared-component direction in chat on 2026-07-12 and
requested implementation, commit, push, PR, and merge to `origin/main`.

## User Experience

The closed control renders a density icon, the current Korean option copy, and
a downward chevron. Example: `좁게` plus the row-spacing icon and chevron.

Opening the control shows exactly three radio options:

- `좁게` (`compact`)
- `기본` (`standard`)
- `넓게` (`comfortable`)

Selecting an option immediately calls the existing `onValueChange` callback,
updates the caller-owned table density, and closes the menu through the shared
dropdown primitive. The active menu item remains visibly checked.

## Architecture

Keep `EmrTableDensity` values, option copy, table CSS tokens, and caller-owned
state unchanged. `EmrTableDensitySelector` remains the sole shared UI owner;
call sites do not receive new props and no new dependency is added.

Use the existing `Button` and `DropdownMenuRadioGroup` primitives. Reuse the
current line-spacing icon in both the trigger and each menu option.

## Accessibility

- The trigger has an accessible name that includes the generic label and the
  active value, for example `테이블 보기 밀도: 좁게`.
- The trigger is a native button supplied to the existing dropdown trigger.
- Options retain single-choice radio-menu semantics and an active indicator.
- Keyboard focus, Escape close, and outside-click close remain owned by the
  existing dropdown primitive.

## Scope

In scope:

- shared selector UI and Storybook interaction coverage
- table-density design-system contracts and one PR-sized work item
- focused browser verification of a chart/order table consumer

Out of scope:

- density values, table row/header CSS tokens, persistence, URL state, or
  saved preferences
- changes to table data, selections, filters, sorting, permissions, APIs, or
  mock/live boundaries
- feature-specific toolbar reordering

## Risks And Mitigation

The trigger is wider than an icon-only group. Its compact `xs` button size and
single control reduce the action-cluster footprint, and the visual check covers
the chart/order toolbar at desktop width. The selector is shared, so lint,
typecheck, Storybook build, and a focused visible consumer check are required.
