---
id: "DESIGN-SYSTEM-SIDE-PANEL-HEADER-CONTRACT"
status: active
area: design-system
doc_type: contract
updated: 2026-10-06
---

# Shared Side-Panel Header Contract

`EmrSubpanelTitle` is the shared title and collapse header for module side panels.

## Layout

- Frame height: `56px`
- Horizontal padding: `16px` on both sides
- Vertical padding: `0px` on both sides
- Vertical alignment: center the title, tabs, actions, and collapse control inside the fixed frame

The contract applies to every surface that uses `EmrSubpanelTitle`, including the Lab, Imaging, Dispensing, Chart, Billing, Customer, and Hospital Admin module side panels. A module-list shell title that reuses `EmrSubpanelTitle` also inherits this frame; the separate module-list item/group header contract is unchanged. This contract does not redefine the separate content-aside header, queue list header, text-navigation header, or workspace right-panel header contracts. The latter is owned by `EmrRightPanelHeader` and documented in `right-panel-header-contract.md`.

## Ownership

The shared token contract lives in `src/styles/tokens/emr-foundation.css`:

- `--emr-sidepanel-header-height`
- `--emr-sidepanel-header-padding-x`
- `--emr-sidepanel-header-padding-y`

Feature modules should reuse `EmrSubpanelTitle` and should not add local height or vertical-padding overrides for this header.

## Floating presentation

The collapsed rail preview reuses the same sidebar component and header. Preserve the title, existing right-side 24px control, 16px SVG size, neutral-400 color, padding and frame. Do not add a left control or move the existing control. Only while floating, use the shared pin icon rotated -20 degrees and the accessible label `사이드 패널 고정`. Clicking it explicitly docks the panel. The docked panel retains its existing sidebar SVG and collapse action. Rail menu activation navigates without pinning. The outer shell owns transient hover presentation and portal/focus boundaries.

See [APP-SHELL-PR-003](../../work/app-shell/APP-SHELL-PR-003-sidebar-hover-preview.md) for the interaction rules and verification boundary.

Date selection retains the floating panel and reads the selected date. Current-module date selection updates its existing route; a foreign preview changes only its scoped date. Other page navigation closes the preview. Single-choice filter/sort menus dismiss after selection and allow subsequent hover switching.

## Revision history

- 2026-10-06: approved floating-only pin glyph; preserved button geometry and docked icon; retained floating date selection.
- 2026-07-12: established the shared `52px` frame and horizontal-only inset contract.
- 2026-07-14: updated the shared frame to `56px` for the follow-up module side-panel header request; the separate content-aside and right-drawer header contracts remain unchanged.
- 2026-07-14: clarified that workspace right-panel headers use their own shared component and contract.

## Verification

The geometry contract is covered by the shared app-shell Playwright assertion in `tests/app-shell.spec.ts`.
