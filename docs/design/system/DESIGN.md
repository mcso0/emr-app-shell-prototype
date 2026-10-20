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
updated: "2026-10-20"
last_updated: "2026-10-20"
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
- `--emr-surface-workspace`: near-white work canvas
- `--emr-surface-panel`: primary panel surface
- `--emr-surface-muted`: low-emphasis headers and nested surfaces
- `--emr-state-hover`: black 4% interaction overlay
- `--emr-state-selected`: black 6% selection overlay
- `--emr-state-active`: black 8% pressed or stronger active overlay
- `--emr-border-subtle`: neutral/100 for small elements and low-emphasis internal separators
- `--emr-border-default`: neutral/200 for ordinary cards, rows, controls, and panel-internal boundaries
- `--emr-border-strong`: neutral/300 for layout-level boundaries and large component outer edges
- Structural borders must use this three-token hierarchy. The removed
  `--emr-line-subtle`, `--emr-line-hairline`, `--emr-line-default`, and
  `--emr-line-strong` aliases must not be reintroduced.
- `--emr-accent`: sparse information, link, and limited brand identity accent
- `--emr-accent-subtle`: subtle information or brand accent fill, not default selected state
- `--emr-radius-control`: compact controls
- `--emr-radius-panel`: panels and repeated cards

Generated files such as `src/styles/tokens/clair.css` should not be edited by hand.

### Operation-result toasts

Operation-result Sonner toasts use the application's light palette and sit
16px from the viewport top and right on desktop and mobile. Their position is
independent of shell headers and the separately owned live-notification stack.
Keep the existing maximum of three visible operation toasts.

The 24px close button is transparent at rest, uses `--emr-state-hover` (black
4%) on hover, and `--emr-state-selected` (black 6%) while pressed. This quiet
dismiss command has no persistent selection; the 6% press is a scoped exception
to the general 8% active token. Preserve its accessible label, keyboard
dismissal, and visible focus ring. Scope these styles to the toaster and make
them independent of Sonner's runtime stylesheet insertion order.

## Color

CLAiR uses a bright clinical surface ladder:

CLAiR follows the Neutral Command + Semantic Status direction:

- primary is command ink, not brand blue
- equal-channel Neutral surfaces carry app, workspace, panel, header, nested,
  and disabled structure
- black-alpha overlays carry interaction state: hover 4%, selected 6%, and
  active 8%
- blue is reserved for information, links, and limited brand identity moments
- success, warning, danger, info, and neutral status colors stay semantically distinct

- app canvas: white operational background
- workspace: Neutral `#FCFCFC` work canvas
- panel: white surface
- muted surface: Neutral 50 (`#FAFAFA`) for table headers and quiet nesting
- disabled surface: Neutral 100 (`#F5F5F5`)
- interaction state: black 4% hover, black 6% selected, black 8% active
- border ladder: neutral/100, neutral/200, and neutral/300 mapped by structural hierarchy
- accent: sparse information, link, and limited brand identity signal
- focus: neutral gray ring through the shared `--ring` token by default

Do not collapse the product into one brand color. Medical, billing, warning, danger, success, pending, and completed states keep their semantic colors.

`--emr-surface-hover` and `--emr-surface-selected` remain compatibility aliases
only. New implementation must use `--emr-state-hover`,
`--emr-state-selected`, or `--emr-state-active` so a static surface role is not
confused with an interaction state. Pinned table cells must compose the state
overlay over their opaque base surface so scrolling content cannot show through.

## Scroll Boundaries

All app scroll containers stop at their boundaries without rubber-band bounce
or scroll chaining to an ancestor. `src/app/globals.css` covers the document,
textareas, shared scroll viewports, and scroll utilities; CSS modules apply
`overscroll-behavior: none` on their scroll owners. Do not apply this rule to
clipping-only children: their wheel input must reach the scroll owner.
Keep native scrolling, wheel handlers,
horizontal scrolling, and scrollbar interactions unchanged within bounds.

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

## Icon Stroke

Approved on 2026-10-20: stroke-based UI icons use a nominal `strokeWidth` of
`1.5` by default. This value is in SVG coordinates, not a fixed screen-pixel
width. Preserve normal viewBox scaling: a `1.5` stroke in a 24px viewBox renders
as 1 CSS px at a 16px display size.

- Apply the default through the shared Obra adapter and the separately owned
  direct Lucide/Obra usages. Respect explicit `strokeWidth` overrides.
- Preserve icon paths, viewBox, display size, button targets, spacing, meaning,
  and interaction states. A stroke-default change does not authorize replacing
  the icon shape or changing its behavior.
- Do not add strokes to filled CDS/GNB paths, crop their viewBox, or use a
  global CSS override to normalize their visual weight.
- Keep existing custom `1.8`, `1.4`, and `1.6` strokes as separate exceptions.
  Review them within an explicitly scoped change rather than changing them
  automatically with the default.
- Verify affected small icons and states in their actual callers and relevant
  Storybook stories. Local checks do not establish deployment or user acceptance.

## Icon And Label Spacing

Approved on 2026-10-20: a directly adjacent horizontal semantic icon and label
use 4 CSS px between a 12px SVG box and the label, or 6 CSS px for a 16px SVG box.
Measure the displayed SVG box, not painted paths or the text glyph outline.
Preserve icon dimensions, typography, control height, outer padding, stroke,
viewBox, states, and interaction. The 14px, 20px and 24px cases remain undecided.

- Apply the rule to the actual icon-label pair, not every gap in its parent.
  Keep counts, actions, keyboard hints and other sibling spacing independently
  owned. Group the pair only where that separation is necessary.
- Button density does not decide this gap when its icon has an explicit size:
  a compact Button with an explicit 16px icon still uses 6px. The normal compact
  Button 12px icon keeps 4px. Existing undecided-size overrides remain unchanged.
- Keep independent trailing dropdown arrows, selection checks and sort
  indicators outside this semantic-pair rule. Preserve their reserved slots.
  Tile, illustration and card identity slots are also separate structures.
- Input adornments use text insets rather than flex gaps. Include input border,
  padding and any icon-slot inset when checking the SVG-box-to-content distance.
- A 16px default inline-alert glyph remains centered in its existing 20px slot;
  the slot's 2px trailing inset plus 4px content gap gives the required 6px.
  The icon-box and caller-supplied custom-icon layouts retain separate contracts.
- Validate real callers and existing Storybook stories. Source-class arithmetic
  does not prove browser geometry; list unresolved dynamic/custom cases explicitly.

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
- chart is the visual and identity-composition baseline for dispensing/treatment,
  lab, and imaging patient context bars: patient name, breed, sex/neuter, age;
  then guardian relationship and contact. Work-specific trailing metadata may
  differ. Reuse the shared bar rather than duplicating screen-local geometry.
- billing keeps guardian-first ordering, multiple patient identities, masked
  contact, and billing summaries, but follows the same context-bar surface,
  spacing, icon treatment, typography, profile interaction, and overflow controls.
  Visual alignment must not change billing data or calculations.
- pending patient-context values use shared skeletons rather than visible loading
  sentences. Keep resolved values, explicit failure/denial/missing states,
  accessible busy descriptions, and reduced-motion behavior. Chart shows the same
  skeleton while its first selected-record read is pending; keep loaded context
  visible during refresh and never add an artificial loading delay.
- central workspaces for forms, tables, charting, and result entry
- right panels for summary, history, or focused auxiliary work
- every top-level module exposes exactly one effective main-content header at
  its existing shell or feature ownership boundary
- home, treatment, lab, imaging, dispensing, billing, and inpatient use the
  fixed 56px shared-header mode; clinical features keep their selected patient
  context inside this frame and preserve an empty frame before selection
- reception uses its feature-owned 56px `ScheduleToolbar` as the effective
  main-content header and does not register an additional shared header
- hospital-admin and customer use the adaptive mode: 44px only when the
  browser viewport matches `(min-width: 1024px) and (max-height: 1279px)`,
  otherwise 56px
- the shared frame centralizes height only. It does not move feature state,
  patient content, back actions, routes, menus, or side-panel ownership into
  the shell
- table workspaces use `#FCFCFC` for the content frame and keep the table
  header directly adjacent to the first row with no added gap

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

Patient context bars keep patient and encounter facts visible near clinical work. The shared CDS.V2 patient bar uses patient, guardian, vital, and memo sections in that order. Its standard memo set is shown as four compact inline actions (`방문목적`, `보호자메모`, `환자메모`, `수납메모`) while one shared popover retains summaries, locked states, and unavailable reasons. Do not create screen-local patient-bar or memo-layout variants.

Tabs and density controls have a stricter UX contract:

- workspace tabs are shell navigation, not filters
- section tabs switch peer panels in one screen context
- segmented controls and filter buttons narrow or mode-switch data without pretending to be navigation
- table density is presentation-only and uses `compact`, `standard`, and `comfortable`
- table density uses one compact outline selected-value dropdown button with Korean interval copy and a downward chevron; the menu exposes `좁은 간격`, `기본 간격`, and `넓은 간격`

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
