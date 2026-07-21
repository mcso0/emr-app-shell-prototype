# Shared Workspace Right-Panel Layout Implementation Plan

## Boundary

Implement the shared interior layout for standard workspace right panels only. Do not
change `WorkspaceFrame`, responsive behavior, overlay drawers, content asides, or the
staff operational profile panel.

## Tasks

- [x] Add the `DESIGN-SYSTEM-PR-081` research/proposal work item.
- [x] Add `EmrRightPanel`, `EmrRightPanelBody`, and `EmrRightPanelFooter` with exact
  footer-size tokens and Storybook examples.
- [x] Move Reception create/detail panels to Body and Footer siblings while preserving
  the existing overlay drawer path.
- [x] Move Lab, Imaging, and Billing workspace panels to the same composition.
- [x] Add browser coverage for no-footer, compact, single, stacked, and long-body
  scroll containment.
- [x] Run focused and broad verification, then update the contract/work item/closeout.

## Test contract

- Standard header: `56px`
- Compact footer: `53px`
- Single footer: `65px`
- Stacked footer: `105px`
- Long form: the body scrolls; the footer remains within the right-panel frame.
