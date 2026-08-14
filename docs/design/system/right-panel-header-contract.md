---
id: "DESIGN-SYSTEM-RIGHT-PANEL-HEADER-CONTRACT"
status: active
area: design-system
doc_type: contract
updated: 2026-07-21
---

# Shared Right-Panel Layout Contract

`EmrRightPanel` is the shared layout for the auxiliary panel rendered in the workspace
content area's right-panel slot. Its header uses `EmrRightPanelHeader`.

## Composition

Every standard workspace right panel uses this order:

1. required `EmrRightPanelHeader`
2. required fluid `EmrRightPanelBody`
3. optional fixed `EmrRightPanelFooter`

The body is the only flexible row and keeps `min-h-0`. Feature-owned fixed body chrome
may sit above a nested `ScrollArea`, but long content must scroll within the body.
The footer is a non-shrinking sibling of the body, so it is never inside the body scroll
region.

## Layout

- Frame height: `56px`
- Horizontal padding: `16px` on both sides
- Vertical alignment: centered
- Frame behavior: fixed-height and non-shrinking

The contract applies to Reception, Lab, Imaging, and Billing right panels registered through the workspace module registry. Feature modules may add border and alignment classes, but they must not override the shared height.

## Footer variants

| Variant | Outer height | Current adopter |
| --- | ---: | --- |
| `compact` | `53px` | Imaging |
| `single` | `65px` | Reception |
| `stacked` | `105px` | Billing |
| omitted | none | Lab |

Footer height includes its top divider. It must not use browser-level `position: fixed`
or `position: sticky`; the panel's flex layout reserves its space.

## Ownership

- Component: `src/components/emr/right-panel-header.tsx`
- Token: `--emr-rightpanel-header-height` in `src/styles/tokens/emr-foundation.css`
- Layout component: `src/components/emr/right-panel.tsx`
- Footer tokens: `--emr-rightpanel-footer-*-height` in
  `src/styles/tokens/emr-foundation.css`

The separate module side-panel header remains owned by `EmrSubpanelTitle` and `--emr-sidepanel-header-height`. Workspace overlay drawers, content asides, dialogs, and top toolbars do not use this contract.

## Responsive behavior

The workspace shell hides the right-panel slot at the existing `max-md` breakpoint. There is no separate narrow-viewport header implementation, so this change does not add or alter breakpoints.

## Verification

Playwright coverage asserts the shared slot, computed `56px` header, optional footer
variants, and Reception's narrow viewport scroll containment. Storybook documents the
no-footer, compact, single, stacked, and long-body compositions.
