# Design System Docs

Design system docs describe reusable UI foundations, tokens, components, density rules, and interaction conventions.

Do not extract new shared UI rules here until a repeated pattern is stable.

Current files:

- `DESIGN.md`: canonical CLAiR EMR design direction.
- `light-operational-foundation.md`: first implemented foundation pass and Linear reference translation.
- `border-shadow-depth-contract.md`: border line, radius, and shadow depth usage contract for common EMR surfaces.
- `empty-info-state-contract.md`: empty state and info box contract for missing data, guidance, boundaries, and alert separation.
- `ui-refactor-operating-model.md`: Linear UI/UX refactor initiative operating model and scope guardrails.
- `ui-debt-inventory.md`: evidence-based UI hardcoding, duplicate pattern, and extraction candidate inventory.
- `component-ownership-rules.md`: rules for shadcn/ui, EMR shared, feature-local, and inline UI ownership.
- `ui-refactor-dod.md`: Definition of Done and verification levels for UI refactor issues.
- `arbitrary-value-token-audit.md`: arbitrary Tailwind value audit and EMR token promotion candidate guidance.
- `border-token-adoption-inventory.md`: component-level inventory for adopting the EMR subtle/default/strong border token hierarchy.
- `global-feedback-ui-audit.md`: loading, empty, error, toast, and confirmation UI baseline for remaining refactors.
- `inline-alert-feedback-rules.md`: `EmrInlineAlert` severity, placement, and recovery-action rules for persistent workflow feedback.
- `dialog-shell-rules.md`: `EmrDialogShell` variants, action order, width, scroll, and migration rules for product dialogs.
- `cta-risk-taxonomy.md`: CTA risk levels, confirmation, financial preflight, destructive, and unavailable-action rules.
- `row-action-menu-rules.md`: `EmrRowActionMenu` trigger, item copy, unavailable feedback, and close behavior rules.
- `storybook-operating-rules.md`: Storybook story structure, docs ownership, AI-friendly guidance, and verification rules.
- `tab-table-density-contract.md`: workspace tabs, section tabs, segmented/filter-like controls, and density dropdown conditions.
- `table-density-and-grid-ergonomics.md`: table density, scroll width, header role, resize, and cell text policy.
- `table-sort-filter-behavior.md`: real table sort/filter behavior contract for selected EMR data grids.
- `side-panel-header-contract.md`: shared `EmrSubpanelTitle` height and padding contract for module side panels.

## Current Storybook State

Storybook is the executable component catalog for CLAiR EMR. Use `storybook-operating-rules.md` as the operating contract before adding or changing stories.

Current Storybook coverage from PR-048 through PR-070:

| Area | Storybook title | Coverage |
| --- | --- | --- |
| UI primitives | `Design System/UI/Button` | command variants, sizes, icon usage, disabled/invalid states |
| UI primitives | `Design System/UI/Badge` | generic labels/chips and non-domain status metadata |
| UI primitives | `Design System/UI/Input` | compact text entry, placeholder, disabled, invalid, file input |
| UI primitives | `Design System/UI/Card` | bounded repeated content surfaces, compact item summaries, card slots |
| UI primitives | `Design System/UI/SegmentedControl` | compact filters, counts, tabs variant, abbreviated labels |
| UI primitives | `Design System/UI/Tabs` | peer content switching, default/line variants, vertical layout |
| UI primitives | `Design System/UI/Textarea` | multi-line note entry, invalid, disabled, existing content |
| UI primitives | `Design System/UI/Select` | bounded single-choice fields, toolbar sizing, invalid state, grouped options |
| UI primitives | `Design System/UI/Field` | label/help/error field structure, horizontal toggle, fieldset grouping |
| UI primitives | `Design System/UI/Checkbox` | independent binary selections, checked, invalid, disabled states |
| UI primitives | `Design System/UI/RadioGroup` | visible mutually exclusive option sets, invalid and disabled states |
| UI primitives | `Design System/UI/Switch` | immediate on/off settings, checked, small, disabled states |
| UI primitives | `Design System/UI/Toggle` | independent pressed state, CDS.V2 variants, sizes, icons, disabled state |
| UI primitives | `Design System/UI/ToggleGroup` | single/multiple pressed sets, CDS.V2 group variants, orientation, disabled state |
| UI primitives | `Design System/UI/Tooltip` | short helper text, icon-button hints, placement, disabled-trigger caveat |
| UI primitives | `Design System/UI/Skeleton` | loading placeholders, compact/list loading shapes |
| UI primitives | `Design System/UI/Table` | structured row/column data, density, scroll layout, empty rows |
| UI primitives | `Design System/UI/Separator` | subtle horizontal/vertical dividers inside one surface |
| UI primitives | `Design System/UI/InputOTP` | short code input slots, filled, invalid, disabled display states |
| UI primitives | `Design System/UI/Dialog` | modal decisions, confirmation/form surfaces, DOM API open interaction |
| UI primitives | `Design System/UI/Popover` | anchored non-modal controls, filter/details surfaces, DOM API open interaction |
| UI primitives | `Design System/UI/DropdownMenu` | contextual command menus, row actions, checkbox/radio items, submenu structure |
| UI primitives | `Design System/UI/Sheet` | side-attached supporting workflows, contextual details, DOM API open interaction |
| EMR shared | `Design System/EMR/EmrStatusBadge` | supported workflow statuses and fallback behavior |
| EMR shared | `Design System/EMR/EmrInlineAlert` | persistent workflow feedback severities and recovery actions |
| EMR shared | `Design System/EMR/EmrDialogShell` | confirm/form/wide-form product dialog shell variants |
| EMR shared | `Design System/EMR/EmrRowActionMenu` | dense row/card overflow actions, disabled/destructive item examples |
| EMR shared | `Design System/EMR/EmrPageHeader` | page title, badge, icon, and action chrome |
| EMR shared | `Design System/EMR/EmrIconButton` | dense icon-only EMR controls with accessible labels |
| EMR shared | `Design System/EMR/EmrPopoverShell` | anchored EMR popover shell, options, and compact field rows |
| EMR shared | `Design System/EMR/EmrSubpanel` | fixed-width side panel chrome, date navigator, list header, list groups, and list items |
| EMR shared | `Design System/EMR/EmrTableFilterBuilder` | advanced table filter builder with synthetic field/operator/value rules |
| EMR shared | `Design System/EMR/EmrTableDensitySelector` | compact/standard/comfortable table density switching |
| EMR shared | `Design System/EMR/EmrTableCheckbox` | table row/header selection checkbox styling |
| EMR shared | `Design System/EMR/EmrTablePrimitives` | table header interaction affordances and cell text modes |
| EMR shared | `Design System/EMR/EmrSidePanelStateIcon` | compact workflow state icon set for side-panel rows and groups |
| EMR shared | `Design System/EMR/EmrSidePanelCollapsibleGroup` | status-grouped side-panel queue disclosure with counts and state markers |
| EMR shared | `Design System/EMR/EmrSidePanelCard` | selectable side-panel card identity, metadata, badges, and overflow action chrome |
| EMR shared | `Design System/EMR/EmrTaskQueueCard` | repeated task/order queue card composition for side panels |
| EMR shared | `Design System/EMR/EmrContentAsidePanel` | content-adjacent aside panel surface for secondary context |
| EMR shared | `Design System/EMR/EmrContentHistoryList` | date-grouped content history groups and selectable history cards |
| EMR shared | `Design System/EMR/EmrTextSidePanel` | text-heavy module side navigation buttons and expandable sections |
| EMR shared | `Design System/EMR/EmrModuleListSidePanel` | module-local list side panel with buttons, sections, leaves, and badges |
| EMR shared | `Design System/EMR/EmrEmptyState` | shared empty-state component with state kind, surface, and CTA ownership variants |
| EMR shared | `Design System/EMR/OrderQueueSelectionSummary` | selected synthetic order queue item summary |
| EMR shared | `Design System/EMR/EmrOrderQueueSidePanel` | synthetic order queue side panel with filters, groups, and task cards |
| EMR patterns | `Design System/EMR/Table Queue Patterns` | status cell, action cell, filter toolbar, empty table, sortable/filterable header, row selection, density selector, long text cell |
| EMR patterns | `Design System/EMR/Empty Info Feedback Patterns` | empty state, info box, and inline alert boundary examples without new runtime APIs |
| Recipes | `Design System/Recipes/Storybook MCP Dogfood` | synthetic MCP documentation workflow recipe |

## Storybook Usage

Run Storybook locally:

```bash
npm run storybook
```

Build the static catalog:

```bash
npm run build-storybook
```

Smoke-test local startup:

```bash
npm run storybook -- --ci --smoke-test
```

For story additions, keep stories co-located with the component or Storybook-only helper:

- `src/components/ui/*` for generic UI primitives.
- `src/components/emr/*` for EMR shared patterns.
- `Design System/Recipes/*` only for small synthetic compositions that dogfood documented primitives.

Each design-system story should include autodocs, default args, argTypes, component description, and short story descriptions that state when to use and when not to use the component or pattern.

## Storybook MCP Usage

Local MCP endpoint:

```text
http://127.0.0.1:6006/mcp
```

The repo-scoped Codex config registers this endpoint as optional `clair_storybook`. The endpoint is local-only by default; do not publish, tunnel, or share it without an explicit request.

Expected MCP workflow:

1. Start local Storybook.
2. Use `list-all-documentation` to find documented components and patterns.
3. Use `get-documentation` or `get-documentation-for-story` before composing existing primitives.
4. Use `get-storybook-story-instructions` before adding or changing stories.
5. Use focused `run-story-tests` after story changes.

Focused `run-story-tests` should use the `stories` array shape:

```json
{
  "stories": [{ "storyId": "design-system-ui-textarea--default" }]
}
```

Do not pass a top-level `storyId`; the MCP schema ignores that shape and may run a broad pass.

## Interaction Test Policy

Default to rendering-only stories unless interaction behavior is meaningful. When a `play` function is needed, use DOM APIs and plain thrown errors for now. Do not import `storybook/test` helpers in new play functions until a dedicated follow-up proves the current MCP runner and addon-vitest setup initialize them consistently.

If a Storybook MCP test fails once because Vite optimized dependencies and reloaded the browser test environment, rerun before treating it as a story failure. Repeated failures need a scoped config/debug work item.

## Next Storybook Expansion Order

Recommended sequence after the current PR-048 through PR-069 foundation:

1. Feature workflow stories only when stable mock data, providers, and visual QA scope exist.
2. Revisit Storybook/Vitest optimizer include list when new Base UI primitive packages are added.
3. Add targeted visual QA/browser screenshots for dense EMR side-panel states if layout regressions appear.
