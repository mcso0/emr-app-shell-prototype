---
status: "approved"
area: "design-system"
updated: "2026-07-12"
linear_issue: "DEN-433"
linear_project: "공통 UX/UI 기준 정리 및 화면 적용"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/design/system/arbitrary-value-token-audit.md"
  - "docs/design/system/component-ownership-rules.md"
---

# Border And Shadow Depth Contract

This contract defines how CLAiR EMR uses border lines, radii, and shadow depth across common workspace UI. It turns the existing Light Operational Foundation into implementation-ready rules for follow-up screen issues.

## Intent

CLAiR EMR should read as a precise, bright operational workspace. Borders carry most structural separation. Action-capable surfaces use the lowest shadow depth to signal that they can be clicked before the user has to inspect the copy. Stronger shadows remain reserved for actual depth: sticky or floating surfaces, popovers, drawers, dialogs, and command overlays.

Do not use shadow as generic decoration or as the main way to make every card feel important. If a surface opens, moves, adds, creates, deletes, searches, submits, or triggers a menu, it should normally carry E1 affordance. If a surface only presents information, first use surface level, spacing, typography, line strength, and selected or status state.

## Border Roles

| Role | Token or class | Use for | Avoid |
| --- | --- | --- | --- |
| None | no border | page bands, unframed layout groups, dense form groups already separated by spacing or background | adding boxes around every subsection |
| Subtle border | `--emr-border-subtle` (`neutral/100`) | small elements, low-emphasis internal separators, metadata chips, timeline guides | selected, focused, status-critical, or layout boundaries |
| Default border | `--emr-border-default` (`neutral/200`) | ordinary card/list/table/control borders, row/header lines, and panel-internal dividers | replacing semantic status borders or major layout edges |
| Strong border | `--emr-border-strong` (`neutral/300`) | module side panels, workspace/content frames, right panels, large drawer edges, and split-pane boundaries | routine row dividers or nested card outlines |
| Selected/focus line | `--emr-line-selected`, `--emr-line-focus`, `--emr-state-selected-border`, `--ring` | selected rows/cards/tabs, drag handles, keyboard focus, active workspace affordances | default structure or always-on decoration |
| Status line | `--emr-status-*-border` | info, success, warning, danger, and neutral status panels or badges | structural panels with no status meaning |

Default border thickness is `1px`. Use thicker lines only for a scoped drag handle or explicit status indicator. Do not use a side rail or inset stripe as the default selected or active state.

Legacy `--emr-line-subtle`, `--emr-line-hairline`, `--emr-line-default`, and `--emr-line-strong` usages remain as migration compatibility only. Do not introduce new structural uses of those tokens. Selected, focus, drag, and state-specific line tokens remain valid because they describe interaction state rather than neutral structural hierarchy.

## Radius Roles

| Role | Token | Use for |
| --- | --- | --- |
| Control radius | `--emr-radius-control` | buttons, inputs, selects, chips, compact menus, dense table controls |
| Panel radius | `--emr-radius-panel` | workspace panels, repeated work cards, dialog shells, popovers, table wrappers |
| Local compact radius | existing component-local values | narrow badges, timeline markers, and CDS V2 component details when an existing component owns the shape |

Keep radii compact. Most controls should stay around 8px. Panels and repeated cards can use 8-12px. Do not introduce large decorative rounding for operational surfaces.

## Shadow Depth Roles

| Depth | Allowed expression | Use for | Notes |
| --- | --- | --- | --- |
| E0 flat | no shadow | app canvas, workspace panels, table wrappers, form sections, info boxes, empty states, ordinary queue/list cards | This is the default for in-flow UI. Use border and surface contrast instead. |
| E1 action | `shadow-xs`, `shadow-sm`, or `shadow-[var(--clair-shadow-xs)]` | buttons, icon buttons, dropdown triggers, search/query controls, add/create/delete/submit actions, clickable cards or tiles that open or navigate, active topbar tabs, workspace switcher | Pair with `border-default` unless a smaller internal element calls for `border-subtle`. Disabled actions should drop the shadow. Do not use E1 on every dense data row when the row is primarily read-only information. |
| E2 floating | `shadow-md`, `shadow-[var(--clair-shadow-md)]`, plus border/ring | dropdown menus, popovers, inline tool palettes, autocomplete results, small floating action surfaces | The surface should float above other content and have open/close behavior. |
| E3 overlay | `shadow-lg`, `shadow-xl`, existing Sheet/Dialog/Command palette defaults | drawers, sheets, dialogs, command palette, large overlays that must obscure or sit above workflow content | Prefer existing shadcn/ui or EMR shell primitives before custom shadow values. |
| E4 prohibited decorative depth | broad custom rgba stacks, repeated `shadow-2xl`, shadows on every panel | not allowed for routine EMR screen hierarchy | Create a scoped token proposal only when a shell overlay cannot be expressed by current primitives. |

Generated Clair shadow tokens remain available through `src/styles/tokens/clair.css`, but generated files must not be edited by hand. New EMR elevation aliases should be added only in a scoped implementation issue after the repeated role is proven.

## Surface Application

| Surface | Border | Shadow | Guidance |
| --- | --- | --- | --- |
| App shell frame | `border-strong` | E0-E1 | Use the surface ladder and shell layout before adding depth. |
| Module side panel | `border-strong` outer boundary | E0-E1 | Selected queue state should use selected surface and border, not a heavy shadow. |
| Feature panel | `border-default`; `border-strong` only when it owns a layout region | E0 | Use panel background and title hierarchy; avoid nested decorative cards. |
| Repeated queue/list card | `border-default` | E0 when read-only, E1 when the card itself opens or navigates | Hover and selected state must be distinct without relying on shadow alone. |
| Table wrapper and rows | `border-default` row/header dividers | E0 | Headers may use muted surfaces; tables should not look like stacked cards. |
| Table row actions | `border-default` action border | E1 on the action control, not the whole read-only row | Keep dense rows readable; put affordance on buttons, menus, links, or explicit row-open controls. |
| Tabs and segmented controls | transparent/default border plus selected line or selected surface | E1 for clickable controls | Use selected surface/border for active value; keep the click affordance quiet. |
| Inputs and textareas | `border-input` bridge or `border-default` | E0 | Focus is shown with neutral ring; do not add shadow for validation. |
| Info box and empty state | `border-subtle`, `border-default`, or status border as needed | E0 | The state meaning comes from copy, icon, tone, and action hierarchy. |
| Popover/dropdown/menu | `border-default` plus ring | E2 | Use existing primitives and preserve accessible labels and close behavior. |
| Drawer/dialog/command overlay | `border-strong` when the edge defines a large reading layer; otherwise component border/ring | E3 | Overlay depth is acceptable because it changes reading layer. |

## Prohibited Patterns

- Do not use both a loud border and a large shadow for ordinary in-flow cards.
- Do not use shadow to represent selected, focused, dirty, warning, or destructive state; use state or status tokens.
- Do not use a left or side stripe for default selected or active rows/cards. It reads like a status rail and adds visual noise in dense EMR workspaces.
- Do not make read-only data rows look actionable with shadow. If only a small control inside the row acts, the small control gets E1 and the row stays flat.
- Do not remove E1 affordance from enabled action surfaces just because the surrounding screen is dense. Dense medical workflows need clear click targets.
- Do not add decorative card shells around page sections. Cards are for repeated items, modals, and genuinely framed tools.
- Do not introduce raw `rgba(...)` shadow stacks in feature code without a scoped shell or EMR elevation decision.
- Do not edit `src/styles/tokens/clair.css` or `src/styles/tokens/shadcn.css` for this contract.
- Do not claim security, persistence, live Supabase, RLS, or server enforcement from visual border or disabled-state changes.

## Implementation Acceptance Criteria

Follow-up implementation issues should satisfy these checks:

- Existing `src/components/ui/*` or `src/components/emr/*` primitives are reused before adding local styling.
- New border or shadow usage maps to one role in this contract.
- In-flow panels, tables, info boxes, and empty states default to E0 flat.
- Enabled action surfaces use E1 affordance when they open, move, add, create, delete, search, submit, or trigger a menu.
- Floating surfaces use existing popover, dropdown, sheet, dialog, or command primitives when possible.
- Selected, hover, focus, disabled, dirty, and status states remain visually distinct.
- Dense screens are checked for nested-card noise, text clipping, overflow, and sticky surface overlap.
- Any intentional exception is recorded in the issue report with the component, reason, and follow-up decision if needed.

## Follow-Up Candidates

- Evaluate whether `src/shell/global-command-palette.tsx` should keep its current `--clair-shadow-xl` usage or move to a shell-local elevation alias in a scoped shell issue.
- Replace direct feature-level selected side rails, inset stripe shadows, or generic selected shadows with selected surface, full border, status borders, or existing EMR component variants when touching those screens.
- During queue card and SOAP section work, prefer this contract over one-off visual balancing.
