---
id: DESIGN-SYSTEM-CLAIR-EMR
type: Design System
title: "CLAiR EMR Design"
description: "Defines the CLAiR EMR visual, interaction, writing, density, token, and component design standards."
version: "alpha"
name: "CLAiR EMR"
status: "active"
area: design
doc_type: design-system
tags: [design-system, ui, ux-writing, tokens, components, density]
updated: "2026-07-24"
last_updated: "2026-07-24"
source_docs:
  - "docs/design/references/linear-app/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/design/system/border-shadow-depth-contract.md"
  - "docs/design/system/empty-info-state-contract.md"
  - "docs/engineering/current-status.md"
---

# CLAiR EMR Design

CLAiR EMR is a bright operational workspace for veterinary outpatient work. The interface should feel quiet, precise, and durable across long clinical sessions. It is not a marketing canvas, a dark-mode concept, or a decorative dashboard.

## Product Stance

The product is organized around real hospital work: reception, charting, lab, imaging, dispensing, treatment, billing, inpatient care, customer management, and hospital administration. Design decisions should make these workflows easier to scan, compare, and continue.

Keep the screen useful before it is expressive:

- show the patient, guardian, encounter, owner, assignee, status, amount, and due time near the action they affect
- use compact layouts that preserve context instead of forcing navigation
- keep status and medical semantic colors stable
- prefer product data, tables, queues, and forms over explanation text
- make the selected item obvious without making every card visually loud

## Korean UX Writing Baseline

User-facing Korean product copy uses 존댓말. Conversation settings for agents,
internal developer notes, and synthetic user-authored clinical content do not
determine the product voice.

Until a broader UX writing guide is approved:

- use `합니다체` for system facts, status, explanations, restrictions, and errors
- use `~해 주세요` when the user needs to take an action
- use `~하시겠습니까?` for confirmation questions
- keep action labels concise, such as `저장`, `취소`, and `다시 시도`
- preserve the meaning, permission boundary, recovery path, and mock/live
  disclosure when correcting tone
- do not rewrite existing polite `해요체` solely for register normalization in
  the honorific-correction pass
- do not rewrite user-authored notes, clinical records, fixture content that
  represents authored records, machine error codes, or developer-only guidance

## Foundation

The first visual foundation is the Light Operational Foundation.

CLAiR keeps the generated Clair token output as the base layer and adds a small EMR alias layer above it:

- `--emr-surface-app`: app canvas
- `--emr-surface-panel`: primary panel surface
- `--emr-surface-muted`: low-emphasis headers and nested surfaces
- `--emr-surface-selected`: selected list, card, and row surface
- `--emr-border-subtle`: neutral/100 for small elements and low-emphasis internal separators
- `--emr-border-default`: neutral/200 for ordinary cards, rows, controls, and panel-internal boundaries
- `--emr-border-strong`: neutral/300 for layout-level boundaries and large component outer edges
- `--emr-accent`: sparse information, link, and limited brand identity accent
- `--emr-accent-subtle`: subtle information or brand accent fill, not default selected state
- `--emr-radius-control`: compact controls
- `--emr-radius-panel`: panels and repeated cards

Generated files such as `src/styles/tokens/clair.css` should not be edited by hand.

## Color

CLAiR uses a bright clinical surface ladder:

CLAiR follows the Neutral Command + Semantic Status direction:

- primary is command ink, not brand blue
- gray and cool-neutral surfaces carry structure, hover, selected, and focus states
- blue is reserved for information, links, and limited brand identity moments
- success, warning, danger, info, and neutral status colors stay semantically distinct

- app canvas: near-white operational background
- panel: white or Clair normal background
- muted surface: low-contrast header, table, and nested surface
- selected surface: cool-neutral state fill with enough contrast from hover
- border ladder: neutral/100, neutral/200, and neutral/300 mapped by structural hierarchy
- accent: sparse information, link, and limited brand identity signal
- focus: neutral gray ring through the shared `--ring` token by default

Do not collapse the product into one brand color. Medical, billing, warning, danger, success, pending, and completed states keep their semantic colors.

## Typography

The app shell uses the self-hosted Pretendard variable font package as the primary sans stack. This improves Korean UI rhythm while keeping system fallbacks available.

Use typography for scanning, not drama:

- compact panel titles: 14-16px, semibold
- dense table and list body: 12-13px
- page-level titles: restrained, usually 18-24px
- no negative letter spacing
- no viewport-based font scaling

Shared EMR typography roles are available for repeated operational UI rhythm:

- `emr-text-micro`: 11px micro metadata
- `emr-text-metadata` / `emr-text-status`: 12px badges, counters, compact status labels
- `emr-text-dense` / `emr-text-dense-label`: 13px dense lists, queue cards, and side-panel metadata
- `emr-text-body` / `emr-text-section`: 14px compact body and section labels
- `emr-text-compact-title`, `emr-text-panel-title`, `emr-text-dialog-title`: compact title steps for EMR panels and dialogs

## Shape

Most EMR surfaces should be compact:

- controls: 8px radius
- panels and repeated cards: 8-12px radius
- large decorative rounding is avoided
- pills are reserved for status, segmented filters, and short chips

Cards should not be nested inside other decorative cards. Use panels for layout and cards only for repeated work items, dashboard metrics, or modal content.

## Border And Elevation

Use `docs/design/system/border-shadow-depth-contract.md` as the implementation contract for border line strength, radius roles, and shadow depth.

- Borders carry most structural separation: use `--emr-border-subtle` for small quiet separators, `--emr-border-default` for ordinary panel-internal and component boundaries, and `--emr-border-strong` for major layout-level edges.
- In-flow panels, tables, info boxes, empty states, and read-only rows/cards are flat by default.
- Enabled action surfaces use the lowest shadow depth to signal clickability when they open, move, add, create, delete, search, submit, or trigger a menu.
- Stronger shadows are reserved for real depth: floating popovers/menus, drawers, dialogs, and command overlays.
- Selected, focus, dirty, warning, danger, and disabled states should use state/status tokens rather than generic shadow.
- Do not add raw shadow stacks or new elevation aliases unless a scoped implementation issue proves a repeated role.

## Layout

CLAiR screens favor operational density:

- persistent nav rail and top menu
- module side panels for queues and grouped navigation
- patient context bars near clinical work
- central workspaces for forms, tables, charting, and result entry
- right panels for summary, history, or focused auxiliary work

The first viewport should show real product state. Avoid landing-page composition inside application routes.

## Components

Shared primitives should carry the visual system:

- `EmrSubpanel`: module panels and compact side surfaces
- `EmrListItem`: selected history and queue rows
- `EmrSidePanelCard`: order and work queue cards
- `EmrModuleListSidePanel`: CDS.V2 grouped module navigation. The current
  geometry source is Figma node `27794:28010`. The component fills the shell's
  allocated module-panel width instead of owning a fixed width; rows keep an
  8px horizontal inset, 16px between top-level groups, 2px within groups, 36px
  top-level height, 32px leaf height, 26px child-list offset, and 13/18px item
  typography. Nested group labels and count badges use 12/16px.
- `EmrDataTable` and `Table`: dense operational tables
- `SegmentedControl`: compact filters and mode switching
- `StatusBadge`: stable semantic state labels
- `EmrRequiredIndicator`: shared required-field marker using the dedicated `--emr-form-required-indicator` token; keep native `required` or `aria-required` semantics on the associated control

Patient context bars keep patient and encounter facts visible near clinical work. Secondary patient-context actions such as memo review should collapse into one labeled action with a popover when multiple memo types compete for space; do not spread several low-priority memo buttons across the bar.

Tabs and density controls have a stricter UX contract:

- workspace tabs are shell navigation, not filters
- section tabs switch peer panels in one screen context
- segmented controls and filter buttons narrow or mode-switch data without pretending to be navigation
- table density is presentation-only and uses `compact`, `standard`, and `comfortable`
- table density uses one compact selected-value dropdown button with a row-spacing icon and downward chevron; the menu exposes `좁게`, `기본`, and `넓게`

The CDS.V2 medium segmented control maps to `SegmentedControl` with `variant="tabs"` and `size="md"`: a 32px neutral-alpha group with 2px inset, 12px outer radius, contiguous 28px items with 8px horizontal padding and 10px radius, `body/2/normal` typography, and `shadow-sm` on the selected white item. Compact `xs` and `sm` modes keep their existing denser contracts.

New shared primitives should be added only when a repeated pattern is stable across screens.

## Interaction

Interaction should be predictable and low-friction:

- hover can reveal secondary actions
- selected state must be visible without hover
- destructive or workflow-final actions require confirmation
- filters should keep context visible where possible
- queue header search opens inline in place, keeps the current tab/filter/sort scope, shows a compact `검색 결과 N건` summary only while a query is active, and clears the query when closed
- context-bar memo actions are secondary review actions; they may summarize current state or explain unavailable source screens, but they must not imply live persistence or cross-module editing unless separately scoped
- charts, orders, and billing actions remain session-only until explicitly connected to live persistence

## Empty And Info States

Use `docs/design/system/empty-info-state-contract.md` as the implementation contract for empty states, info boxes, and their boundary with loading, errors, permission/scope messages, and inline alerts.

- Empty states explain the missing object, the likely reason, and the next useful action when one exists.
- Info boxes explain guidance, prerequisites, caution, system boundaries, or unavailable actions without hiding failures.
- Loading, empty, error, permission/scope, and info states must be visually and textually distinct.
- Errors, degraded reads or writes, permission blockers, and recovery paths use `EmrInlineAlert` rather than passive info boxes.
- Empty/info surfaces stay flat; enabled actions inside them use the lowest E1 shadow affordance from the border/shadow contract.

## Accessibility And QA

Every screen should pass a practical operational check:

- text does not overlap or clip in desktop and mobile viewports
- keyboard focus is visible on controls
- default component focus rings use a neutral gray tone, not the brand/accent blue
- selected and hover states are distinguishable
- status colors remain legible and semantically consistent
- dense tables preserve headers, row alignment, and action affordances

Use Playwright screenshots for visual sanity checks after substantial UI changes.

## Non-Goals

- dark mode
- marketing hero treatment inside the app shell
- decorative gradient/orb backgrounds
- replacing semantic status colors with a single accent
- claiming live DB, auth, billing, or server permission behavior from session-only UI
