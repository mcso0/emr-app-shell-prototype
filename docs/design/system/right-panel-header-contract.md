---
id: "DESIGN-SYSTEM-RIGHT-PANEL-HEADER-CONTRACT"
status: active
area: design-system
doc_type: contract
updated: 2026-07-14
---

# Shared Right-Panel Header Contract

`EmrRightPanelHeader` is the shared semantic header for the auxiliary panel rendered in the workspace content area's right-panel slot.

## Layout

- Frame height: `56px`
- Horizontal padding: `16px` on both sides
- Vertical alignment: centered
- Frame behavior: fixed-height and non-shrinking

The contract applies to Reception, Lab, Imaging, and Billing right panels registered through the workspace module registry. Feature modules may add border and alignment classes, but they must not override the shared height.

## Ownership

- Component: `src/components/emr/right-panel-header.tsx`
- Token: `--emr-rightpanel-header-height` in `src/styles/tokens/emr-foundation.css`

The separate module side-panel header remains owned by `EmrSubpanelTitle` and `--emr-sidepanel-header-height`. Workspace overlay drawers, content asides, dialogs, and top toolbars do not use this contract.

## Responsive behavior

The workspace shell hides the right-panel slot at the existing `max-md` breakpoint. There is no separate narrow-viewport header implementation, so this change does not add or alter breakpoints.

## Verification

Reception, Lab, and Imaging Playwright coverage asserts the shared slot and computed `56px` height. Focused source inspection verifies that all registered right-panel headers use the shared component.
