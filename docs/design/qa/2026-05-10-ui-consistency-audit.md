---
status: "active"
area: "design-system"
work_item: "DESIGN-SYSTEM-PR-002"
created: "2026-05-11"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/engineering/current-status.md"
---

# UI Consistency Audit

This audit records system-level UI inconsistencies across representative CLAiR EMR screens. It is intentionally audit-only: it does not change tokens, components, app code, screenshots, or the canonical `DESIGN.md`.

## Representative Screens

- Home: `/w/clair-demo/home?modulePanel=open`
- Chart: `/w/clair-demo/treatment?modulePanel=open&aside=history&right=open`
- Billing: `/w/clair-demo/billing?modulePanel=open&right=open`
- Lab: `/w/clair-demo/lab?modulePanel=open&aside=history&right=open`
- Imaging: `/w/clair-demo/imaging?modulePanel=open&aside=history&right=open`
- Dispensing: `/w/clair-demo/dispensing?modulePanel=open&aside=closed`
- Hospital Admin: `/w/clair-demo/orders?modulePanel=open&aside=closed`

## Priority Model

- S1: repeated across several representative screens or shared components.
- S2: repeated within a screen family or major shell pattern.
- S3: local cleanup candidate after foundation work lands.

## Findings

### S1. Typography Roles Are Not Encoded As A System

Problem: Screens use many raw Tailwind text sizes and weights for similar roles. Compact panel titles, page titles, table headers, helper text, chips, and metric values are visually close but not governed by role tokens or reusable text styles.

Affected screens: Home, Chart, Billing, Lab, Imaging, Hospital Admin, shared EMR side panels.

Representative code references: `src/features/chart/module.tsx`, `src/features/home/components/compact-flow-summary.tsx`, `src/features/home/components/home-widget-card.tsx`, `src/features/lab-imaging/module.tsx`, `src/features/hospital-admin/module.tsx`, `src/components/emr/page-header.tsx`, `src/components/emr/subpanel.tsx`.

Design-system implication: CLAiR needs explicit typography roles before more screen polish: app/page title, workspace title, section title, card title, table header, table body, helper text, metadata, chip text, and numeric metric.

Recommended next PR type: `foundation`.

### S1. Button Size And Variant Do Not Express Action Hierarchy Reliably

Problem: `Button` supports variants and sizes, but product usage does not define which size/variant belongs to toolbar actions, primary workflow actions, secondary actions, row actions, icon actions, destructive actions, or footer actions. Similar intent appears as `sm outline`, `xs outline`, `ghost sm`, default `sm`, and custom class overrides.

Affected screens: Chart, Billing, Lab, Imaging, Dispensing, Hospital Admin, shared dialogs and side panels.

Representative code references: `src/components/ui/button.tsx`, `src/features/chart/module.tsx`, `src/features/billing/module.tsx`, `src/features/lab-imaging/module.tsx`, `src/features/dispensing/module.tsx`, `src/features/hospital-admin/module.tsx`, `src/components/emr/confirm-dialog-content.tsx`, `src/components/emr/patient-context-bar.tsx`.

Design-system implication: The next action foundation should map product intent to component usage, not only add sizes. For example: page primary, section primary, toolbar secondary, row action, icon utility, destructive secondary, and sticky footer primary.

Recommended next PR type: `foundation`.

### S1. Spacing And Density Are Repeated As Local Utilities

Problem: Representative screens rely heavily on local `px-*`, `py-*`, `p-*`, `gap-*`, `mt-*`, and grid sizing decisions. This makes similar panels and work areas feel uneven, especially between Home dashboard cards, Chart workspace panels, Billing summary sections, Lab/Imaging panels, and Hospital Admin tables.

Affected screens: Home, Chart, Billing, Lab, Imaging, Dispensing, Hospital Admin.

Representative code references: `src/features/home/components/home-kanban-workspace.tsx`, `src/features/chart/module.tsx`, `src/features/billing/module.tsx`, `src/features/lab-imaging/module.tsx`, `src/features/hospital-admin/module.tsx`, `src/components/emr/emr-data-table.tsx`, `src/components/emr/subpanel.tsx`.

Design-system implication: CLAiR needs a small density scale for operational app layouts: page padding, panel padding, compact header height, table row height, side-panel item gap, card inner gap, and footer action spacing.

Recommended next PR type: `foundation`.

### S1. Surface Semantics Are Still Mixed

Problem: `DESIGN-SYSTEM-PR-001` introduced `--emr-*` aliases, but representative screens still mix `bg-white`, `bg-card`, Clair atomic/background tokens, shadcn tokens, and EMR aliases for equivalent surfaces. The same visual role can be authored several ways.

Affected screens: Home, Chart, Billing, Lab, Imaging, Hospital Admin, shared EMR primitives.

Representative code references: `src/styles/tokens/emr-foundation.css`, `src/app/globals.css`, `src/features/home/demo-launcher.tsx`, `src/features/home/components/compact-flow-summary.tsx`, `src/features/chart/module.tsx`, `src/features/billing/module.tsx`, `src/features/lab-imaging/module.tsx`, `src/features/hospital-admin/module.tsx`.

Design-system implication: Surface naming needs to move beyond the first alias layer into usage policy: app canvas, workspace panel, nested panel, table header, selected row/card, hover row/card, sticky footer, modal body, and right-panel surface.

Recommended next PR type: `foundation`.

### S1. Dense Table Patterns Are Split Across Local Tables And Shared Tables

Problem: Dense operational tables appear through both `Table` and `EmrDataTable`, but table wrappers, header fills, row heights, checkbox cells, action cells, selected state, horizontal overflow, and footer treatment are not yet unified.

Affected screens: Chart, Billing, Lab, Imaging, Dispensing, Hospital Admin.

Representative code references: `src/components/emr/emr-data-table.tsx`, `src/features/chart/module.tsx`, `src/features/billing/module.tsx`, `src/features/lab-imaging/module.tsx`, `src/features/hospital-admin/module.tsx`.

Design-system implication: A table pattern guide should define when to use `EmrDataTable` versus local `Table`, and specify wrapper, header, row, action-cell, checkbox, overflow, empty-state, and footer behavior.

Recommended next PR type: `component`.

### S2. Header And Section Title Patterns Compete

Problem: Representative screens use multiple title systems: `EmrPageHeader`, `EmrInstructionHeaderStack`, patient context bars, local section titles, home tab labels, and custom Hospital Admin headers. The visual hierarchy is close but not consistent enough to signal page, workspace, section, and card levels predictably.

Affected screens: Home, Chart, Billing, Lab, Imaging, Dispensing, Hospital Admin.

Representative code references: `src/components/emr/page-header.tsx`, `src/components/emr/instruction-header-stack.tsx`, `src/components/emr/patient-context-bar.tsx`, `src/features/home/module.tsx`, `src/features/chart/module.tsx`, `src/features/hospital-admin/module.tsx`.

Design-system implication: A header hierarchy should define page title, module title, patient context title, section title, card title, and table title roles before per-screen polish.

Recommended next PR type: `component`.

### S2. Side Panel And Content Aside Patterns Are Similar But Not Fully Shared

Problem: Module side panels, content history asides, right panels, and text side navigation share density goals but use different background, padding, title, divider, and action patterns. Some use EMR primitives; others keep local layout decisions.

Affected screens: Chart, Billing, Lab, Imaging, Dispensing, Hospital Admin.

Representative code references: `src/components/emr/subpanel.tsx`, `src/components/emr/content-aside-panel.tsx`, `src/components/emr/order-queue-side-panel.tsx`, `src/components/emr/text-side-panel.tsx`, `src/features/chart/module.tsx`, `src/features/billing/module.tsx`, `src/features/lab-imaging/module.tsx`.

Design-system implication: Side-panel roles should be separated into queue panel, text navigation panel, history aside, and right summary panel, each with explicit density, surface, and action rules.

Recommended next PR type: `component`.

### S2. Elevation Policy Is Underdefined

Problem: `DESIGN.md` prefers hairline borders over heavy shadow, but there is no explicit elevation scale for drawers, sticky footers, popovers, modals, cards, and panels. Current code mostly avoids shadows, but the absence of a policy causes local choices and makes important overlays hard to classify.

Affected screens: Home, Billing, Hospital Admin, shared shell drawer, shared dialogs.

Representative code references: `src/shell/workspace-frame.tsx`, `src/components/emr/confirm-dialog-content.tsx`, `src/features/billing/module.tsx`, `src/features/hospital-admin/module.tsx`, `src/features/home/components/*.tsx`.

Design-system implication: Define elevation as role-based depth, not decoration: flat panel, raised card, sticky footer, modal, drawer, popover. Most operational surfaces should remain flat with hairline borders.

Recommended next PR type: `foundation`.

### S3. Home Dashboard Uses Product-Useful Data But Different Visual Language

Problem: Home has useful operational content, but the dashboard mixes shadcn `Card`, `Table`, `Progress`, `Avatar`, custom cards, and older demo surfaces. It should become the visual proving ground only after shared typography, spacing, action, and surface foundations are set.

Affected screens: Home.

Representative code references: `src/features/home/module.tsx`, `src/features/home/components/home-widget-card.tsx`, `src/features/home/components/home-kanban-workspace.tsx`, `src/features/home/components/compact-flow-summary.tsx`, `src/features/home/demo-launcher.tsx`.

Design-system implication: Home should not be polished in isolation first; it should consume the next foundation and component patterns.

Recommended next PR type: `screen-polish`.

### S3. Hospital Admin Needs Management-Screen Pattern Alignment

Problem: Hospital Admin Order Management is functionally rich, but its management-screen patterns need alignment with the same table, filter toolbar, page action, drawer, and destructive-action rules used elsewhere.

Affected screens: Hospital Admin.

Representative code references: `src/features/hospital-admin/module.tsx`, `src/components/emr/text-side-panel.tsx`, `src/shell/workspace-frame.tsx`.

Design-system implication: Hospital Admin should be used as the management-screen validation target after table/action/drawer foundations are clearer.

Recommended next PR type: `screen-polish`.

## Foundation-First Roadmap

1. `DESIGN-SYSTEM-PR-003`: Typography, spacing, and action hierarchy foundation.
2. `DESIGN-SYSTEM-PR-004`: Surface, elevation, and layout role foundation.
3. `DESIGN-SYSTEM-PR-005`: Shared table, panel, header, and footer pattern adoption plan.
4. Screen polish PRs: Home, Billing, Lab/Imaging, Dispensing, Hospital Admin, then remaining modules.

## Acceptance Criteria For The Next Foundation PR

- New rules must reduce local raw utility decisions instead of adding parallel names.
- Button guidance must map product intent to variant and size.
- Typography guidance must define role names before changing screen code.
- Spacing guidance must define density roles that can be applied consistently across panels, tables, and footers.
- Surface guidance must preserve bright EMR surfaces and semantic status colors.
