---
status: "active"
updated: "2026-05-22"
linear_issue: "DEN-210"
linear_project: "CLAiR EMR UI/UX Consistency & Affordance Hardening"
source_docs:
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/cta-risk-taxonomy.md"
  - "docs/design/system/inline-alert-feedback-rules.md"
---

# Row Action Menu Rules

`EmrRowActionMenu` is the shared EMR more-menu shell for dense table rows and
side-panel cards. It standardizes trigger affordance, menu item density, item
description copy, click propagation, and keyboard close behavior while leaving
workflow behavior at the feature call site.

Component path:

- `src/components/emr/row-action-menu.tsx`

Import:

```tsx
import { EmrRowActionMenu } from "@/components/emr/row-action-menu";
```

## Use For

- row-level actions in dense customer, order, and admin tables
- side-panel card secondary actions
- small menus where every item is scoped to the same row/card object

Do not use it for global navigation, column visibility menus, complex grouped
filters, command palettes, or menus that need nested submenus.

## Interaction Rules

- The trigger must have an explicit Korean `ariaLabel` that names the row/card object.
- The trigger stops event propagation so opening a menu does not select the row.
- Escape and outside click should close the menu through the underlying `DropdownMenu`.
- Selecting a route/drawer action should close the menu before or as the next surface opens.
- Destructive actions must still use a confirmation dialog when they commit deletion, archive, reset, or removal.

## Item Copy Rules

Each item should use:

- short action label: `상세 보기`, `복제`, `차트 보러가기`, `카카오톡 발송`
- optional one-line description when the result or limitation is not obvious
- explicit unavailable copy when an item is intentionally disconnected

Unavailable items should not fail silently. Use `EmrInlineAlert severity="info"`
near the table/list surface when the user needs persistent context. Toast is
acceptable only for minor one-off utility actions where the current surface
already remains clear.

## Feature Ownership

`EmrRowActionMenu` owns only the shell. Feature modules own:

- menu item list and ordering
- row/card labels and aria labels
- route, drawer, mutation, or toast behavior
- unavailable feedback text
- destructive confirmation policy

## Current Adopted Surfaces

- Customer management patient/guardian row menus
- Reception side-panel patient card menus
- Hospital admin order row menus

## Verification

For screen adoption:

- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npx tsc --noEmit`
- focused Playwright menu interaction for Escape, item selection, and row click isolation
- screenshot of an opened representative row/card menu or unavailable feedback
