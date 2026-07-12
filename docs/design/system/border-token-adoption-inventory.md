---
status: "active"
area: "design-system"
doc_type: "audit"
title: "Border Token Adoption Inventory"
description: "Inventory of component-level border usages that should be reviewed against the EMR subtle, default, and strong border tokens."
updated: "2026-07-12"
scan_commit: "d78193b4"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/border-shadow-depth-contract.md"
  - "docs/design/system/arbitrary-value-token-audit.md"
  - "docs/design/system/component-ownership-rules.md"
---

# Border Token Adoption Inventory

This is an audit and migration inventory for the EMR border semantic tokens. It is not permission to replace every border class mechanically. Each candidate must be classified by its visual role and checked in the affected screen.

## Snapshot

Scan baseline: `origin/main` at `d78193b4`, 2026-07-12.

The current semantic border scale is:

| Role | Token | Value | Intended use |
| --- | --- | --- | --- |
| Subtle | `--emr-border-subtle` | `neutral/100` | Small elements and low-emphasis internal separators |
| Default | `--emr-border-default` | `neutral/200` | Ordinary card, list, table, control, and panel-internal boundaries |
| Strong | `--emr-border-strong` | `neutral/300` | Layout-level boundaries and large component outer edges |

Current adoption on `origin/main`:

- The three semantic tokens are defined in `src/styles/tokens/emr-foundation.css`.
- The left module side panel uses `border-strong` in `src/shell/shell-main.tsx`.
- The central workspace frame and right panel use `border-strong` in `src/shell/workspace-frame.tsx`.
- `border-strong` has four direct runtime references across `shell-main.tsx` and `workspace-frame.tsx`.
- `border-default` has no direct TS/TSX reference yet, but existing hand-authored aliases for workspace buttons, top-bar borders, side-panel cards, context dividers, page dividers, document info, and content history resolve through it.
- `border-subtle` has no runtime consumer yet; the registration summary item is the first high-confidence candidate.
- Legacy `--emr-line-*` tokens remain in 34 source files with 164 usages outside the token file. They require role-based migration, not global replacement.
- Four direct component-level `clair-color-atomic-neutral-100/200/300` border declarations remain outside token definitions.
- The generic shadcn bridge remains separate: `border-border` appears in 37 runtime source files and `border-input` in 11 runtime source files. Do not migrate these until the bridge policy is decided.

First migration batch in this working tree:

- Migrated 34 legacy structural references across 15 runtime source files.
- Reduced legacy `--emr-line-*` usage from 34 files / 164 references to 21 files / 130 references.
- Reduced direct `neutral/100/200/300` component border declarations from four to three by moving `EmrRegistrationSummaryItem` to `border-subtle`.
- Direct runtime adoption is now `border-subtle` 7 references, `border-default` 23 references, and `border-strong` 8 references.
- Updated `DESIGN.md` and `border-shadow-depth-contract.md` so the new hierarchy is canonical while legacy `--emr-line-*` remains migration compatibility.

## Classification rules

Use the semantic token that describes the boundary, not the component name alone.

| Boundary role | Use | First-pass mapping | Examples |
| --- | --- | --- | --- |
| Small or quiet internal element | The line supports scanning but should recede | `border-subtle` | metadata chip, timeline guide, small registration summary |
| Ordinary component boundary | The line separates content inside a screen or component | `border-default` | card, table row/header, list item, dialog header/footer, panel-internal divider |
| Structural component boundary | The line defines a large region or layout split | `border-strong` | module side panel, workspace frame, right panel, split-pane edge, large drawer edge |

Keep these out of the structural migration unless a separate semantic mapping is approved:

- selected, focus, drag, hover-strengthening, and active-state borders
- info, success, warning, danger, and neutral status borders
- brand or clinician/calendar accent borders
- `border-border` and `border-input` from the shadcn semantic bridge
- generated token files such as `src/styles/tokens/clair.css` and `src/styles/tokens/shadcn.css`

## Contract alignment

`docs/design/system/DESIGN.md` and `docs/design/system/border-shadow-depth-contract.md` now define `--emr-border-subtle`, `--emr-border-default`, and `--emr-border-strong` as the neutral structural border hierarchy.

Legacy `--emr-line-*` tokens remain in code for unmigrated surfaces and interaction-specific uses. Treat structural usages as migration evidence; keep selected, focus, drag, status, and other interaction/state tokens under their existing semantic contracts.

## Priority migration list

### P0 — shared shell and layout boundaries

| File | Element | Current usage | Proposed token | Reason / verification |
| --- | --- | --- | --- | --- |
| `src/shell/workspace-frame.tsx` | Detached main section border | `emr-line-hairline` | `border-strong` | Migrated; detached right-panel visual QA remains |
| `src/shell/workspace-frame.tsx` | Content aside split | `emr-line-default` | `emr-content-aside-border` | Migrated through the existing alias; content-aside visual QA remains |
| `src/shell/workspace-frame.tsx` | Workspace drawer edge | `emr-line-default` | `border-strong` | Migrated; drawer and narrow-width visual QA remains |
| `src/features/home/components/home-kanban-workspace.tsx` | Right detail panel edge | `emr-line-hairline` | `border-strong` | Migrated; Home detail-panel visual QA remains |
| `src/features/auth/personal-profile-settings.tsx` | Settings aside split | `emr-line-hairline` | `border-strong` | Migrated; desktop/narrow settings layout QA remains |

### P1 — shared shell and compatibility surfaces

| File | Element | Initial disposition |
| --- | --- | --- |
| `src/shell/global-command-palette.tsx` | Large command overlay outer border and internal info surface | Review the outer border as `border-default` versus `border-strong` with an overlay screenshot; internal surfaces use `border-default` |
| `src/shell/top-menu.tsx` | Hover strengthening with `emr-line-strong` | Keep outside the structural migration until the interaction-state border policy is reviewed |
| `src/app/globals.css` | `.emr-panel` and `.emr-hairline` compatibility aliases | No runtime callers were found. Defer removal or remapping until the shared alias contract is intentionally cleaned up |

### P1 — shared EMR components

The high-confidence structural usages below were migrated in the first batch. Focused source-contract coverage passes; rendered component and screen QA remains before removing them from the inventory.

| File | Elements | Proposed token | Notes |
| --- | --- | --- | --- |
| `src/components/emr/side-panel-card.tsx` | Fallback card outline | `border-default` | The selected variant must continue using `emr-state-selected-border` |
| `src/components/emr/subpanel.tsx` | Date-picker footer, list header dividers, item footer, outline list item | `border-subtle` or `border-default` by role | Split quiet separators from repeated card/list outlines; do not replace selected/transparent states |
| `src/components/emr/emr-data-table.tsx` | Empty wrapper, table rows, floating table action surface | `border-default` | Preserve selected-row and status-specific tokens |
| `src/components/emr/dialog-shell.tsx` | Dialog header separators | `border-default` | Footer borders are structural within a dialog, not layout-shell borders |
| `src/components/emr/order-queue-summary.tsx` | Summary outline and compact chips | `border-default` / `border-subtle` | Outer summary is default; small metadata chips are subtle |
| `src/components/emr/popover-shell.tsx` | Popover footer and compact keycap borders | `border-default` / `border-subtle` | Keep focus and option-state borders separate |
| `src/components/emr/instruction-filter-tabs.tsx` | Filter-row separator | `border-default` | Selected tab line remains an interaction token |
| `src/components/emr/table-checkbox.tsx` | Default and disabled checkbox borders | `border-default` / `border-subtle` | Confirm disabled contrast before changing |
| `src/components/ui/segmented-control.tsx` | Unselected control border | `border-default` | Keep selected primary and focus states unchanged |

### P2 — interaction, decorative, and story usages

| File | Element | Initial disposition |
| --- | --- | --- |
| `src/components/emr/instruction-header-stack.tsx` | Quiet horizontal divider | Migrated to `border-subtle`; rendered QA remains |
| `src/components/emr/order-group-section.tsx` | Group section outline | Migrated to `border-default`; rendered QA remains |
| `src/components/emr/side-panel-mini-calendar.tsx` | Hover inset outline | Treat as an interaction state; do not migrate mechanically |
| `src/components/emr/table-primitives.tsx` | Column resize guide | Treat as an interaction affordance; preserve until table interaction QA |
| `src/components/emr/workspace-entry-loading-screen.tsx` | Decorative loading orbit | Review as `border-subtle` or retain as an intentional decorative exception |
| `src/components/emr/empty-state.stories.tsx` | Story-only wrappers and separators | Update after the corresponding runtime component contract is migrated |

### P1 — feature surfaces with repeated structural borders

| File | Current pattern | First-pass recommendation |
| --- | --- | --- |
| `src/features/chart/module.tsx` | 42 legacy line usages across chart panels, headers, result sections, tables, and editor groups | Migrate ordinary panel/card/header/table boundaries to `border-default`; identify true split-pane or outer layout edges for `border-strong` in a focused chart pass |
| `src/features/hospital-admin/module.tsx` | Settings sections, cards, headers, and audit/table surfaces | Use `border-default` for cards and internal headers; review page-level split edges separately |
| `src/features/home/components/home-kanban-workspace.tsx` | Detail panel, toolbar labels, cards, header, and footer | Use `border-strong` only for the detail-panel edge; use `border-default` for cards and internal bands |
| `src/features/auth/workspace-membership-management.tsx` | Membership cards, sheet headers/footers, and row surfaces | Use `border-default`; review sheet outer edge as a shared Sheet/overlay concern |
| `src/features/billing/module.tsx` | Invoice, checkout, and payment surfaces | Use `border-default` for ordinary cards/rows; retain payment/status borders and selected invoice accents |
| `src/features/lab-imaging/module.tsx` | Low-emphasis queue and result separators | Prefer `border-subtle` for quiet guides; use `border-default` for actual card boundaries |
| `src/features/dispensing/module.tsx` | Result/document separators and empty surfaces | Use `border-default` for cards; keep status/result-specific borders separate |
| `src/features/notifications/global-notification-drawer.tsx` | Drawer rows, headers, and warning/status sections | Use `border-default` for structural drawer rows; retain status border tokens for warning/danger content |
| `src/features/notifications/notification-toast.tsx` | Toast boundary | Review with global feedback contract; do not replace status-specific borders mechanically |
| `src/features/reception/module.tsx` | Calendar/event tone classes and queue/detail surfaces | Calendar tone borders are semantic status/owner accents; only ordinary structural surfaces are candidates |
| `src/features/reception/reception-list-search.tsx` | Quiet search/list separator | Review as `border-subtle` or `border-default` based on the rendered grouping |
| `src/features/auth/login-form.tsx` | Login card and inline separators | Card outer edge is a component boundary; internal separators are default/subtle by role |
| `src/features/auth/auth-gate.tsx` | Auth shell card | Review outer card as `border-default`; do not treat it as the application layout frame |

## Direct atomic neutral usages

These are not all structural border migrations. The scan found four `neutral/100/200/300` declarations and one separate `neutral/500` clinician accent border. The accent border is outside this structural hierarchy.

| File | Current usage | Initial disposition |
| --- | --- | --- |
| `src/components/emr/registration-dialog.tsx` | Baseline `neutral/100` on `EmrRegistrationSummaryItem` | Migrated to `border-subtle`; registration-dialog visual QA remains |
| `src/features/reception/module.tsx` | `neutral/300` calendar neutral tone and badge tone | Keep as a review candidate; this is calendar/status styling, not a generic structural border |
| `src/features/hospital-admin/schedule/hospital-schedule-screen.tsx` | `neutral/200` border for the `off` shift tone | Keep or introduce a status-specific alias; do not silently map to structural `border-default` |

## Generic shadcn bridge inventory

The following classes are not part of the first structural migration because they resolve through `src/styles/tokens/shadcn.css`:

- `border-border`: 37 runtime source files, 102 occurrences
- `border-input`: 11 runtime source files, 13 occurrences
- bare `border` classes: used by generic primitives and feature markup where the color comes from the global `--border` bridge

The next decision for this group is whether `--border` and `--input` should alias `--emr-border-default`. That decision affects all shadcn primitives and must be verified through input, dialog, popover, table, and form screenshots before implementation.

`src/styles/tokens/shadcn.css` is generated. Do not hand-edit it during migration; change the owning generator/source contract and regenerate the bridge if this mapping is approved.

## Legacy usage appendix

Counts below are occurrences of `--emr-line-subtle`, `--emr-line-hairline`, `--emr-line-default`, or `--emr-line-strong` in `origin/main`, excluding the token definition file.

| File | Count | Initial owner |
| --- | ---: | --- |
| `src/app/globals.css` | 2 | shared alias contract |
| `src/components/emr/dialog-shell.tsx` | 2 | shared EMR component |
| `src/components/emr/empty-state.stories.tsx` | 5 | Storybook example |
| `src/components/emr/emr-data-table.tsx` | 5 | shared EMR component |
| `src/components/emr/instruction-filter-tabs.tsx` | 1 | shared EMR component |
| `src/components/emr/instruction-header-stack.tsx` | 1 | shared EMR component |
| `src/components/emr/order-group-section.tsx` | 1 | shared EMR component |
| `src/components/emr/order-queue-summary.tsx` | 3 | shared EMR component |
| `src/components/emr/popover-shell.tsx` | 3 | shared EMR component |
| `src/components/emr/side-panel-card.tsx` | 1 | shared EMR component |
| `src/components/emr/side-panel-mini-calendar.tsx` | 1 | shared EMR component |
| `src/components/emr/subpanel.tsx` | 6 | shared EMR component |
| `src/components/emr/table-checkbox.tsx` | 2 | shared EMR component |
| `src/components/emr/table-primitives.tsx` | 1 | shared EMR component |
| `src/components/emr/workspace-entry-loading-screen.tsx` | 1 | shared loading component |
| `src/components/ui/segmented-control.tsx` | 1 | generic UI primitive |
| `src/features/auth/auth-gate.tsx` | 1 | auth surface |
| `src/features/auth/login-form.tsx` | 3 | auth surface |
| `src/features/auth/personal-profile-settings.tsx` | 4 | auth/settings surface |
| `src/features/auth/workspace-membership-management.tsx` | 9 | auth/admin surface |
| `src/features/billing/module.tsx` | 7 | billing workflow |
| `src/features/chart/components/soap-rich-text-editor.tsx` | 1 | chart feature component |
| `src/features/chart/module.tsx` | 42 | chart workflow |
| `src/features/dispensing/module.tsx` | 3 | dispensing workflow |
| `src/features/home/components/home-kanban-workspace.tsx` | 9 | home workspace |
| `src/features/hospital-admin/module.tsx` | 10 | hospital-admin workflow |
| `src/features/lab-imaging/module.tsx` | 4 | lab/imaging workflow |
| `src/features/notifications/global-notification-drawer.tsx` | 8 | shared feedback surface |
| `src/features/notifications/notification-toast.tsx` | 1 | shared feedback surface |
| `src/features/reception/module.tsx` | 16 | reception workflow |
| `src/features/reception/reception-list-search.tsx` | 1 | reception shared feature component |
| `src/shell/global-command-palette.tsx` | 5 | shell overlay |
| `src/shell/top-menu.tsx` | 1 | shell control |
| `src/shell/workspace-frame.tsx` | 3 | shell layout |

## Implementation guardrails

1. Migrate shared shell and shared EMR components before feature-local surfaces.
2. For each file, classify each border by role; do not replace every `line-hairline` with one token.
3. Preserve selected, focus, drag, status, and accent borders.
4. Run the focused screen test and a desktop screenshot check for shell, side panel, right panel, dialog, table, or drawer changes.
5. Update this inventory after each migration batch and remove entries only when the rendered role has been verified.
6. Keep `DESIGN.md`, `border-shadow-depth-contract.md`, and this inventory synchronized as migration batches land.

## Verification commands

The audit baseline was produced with targeted `git grep` scans against `origin/main`. For implementation batches, use the affected screen tests plus:

```bash
npm run lint
npx tsc --noEmit --pretty false --incremental false
npm run docs:check
```

Do not claim the inventory is fully migrated until the legacy usage count is rescanned and the remaining entries are either migrated or explicitly marked as intentional exceptions.
