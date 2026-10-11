# App Shell Layout Contract v1

This document defines the reusable layout contract for the CLAiR EMR prototype. It is a layout contract, not a component pattern.

## Layout Slots

```txt
TopMenu
NavRail
WorkspaceFrame
  ModuleSidePanel
  ContentHost
    PatientContextBar / ContentHeader
    ContentWorkspace
      ContentAside optional
      PrimaryContent
    DrawerLayer overlay
  RightPanel optional
```

## Slot Rules

- `ModuleSidePanel` is the module navigation/filter/group panel next to the navigation rail.
- `ContentAside` is an optional content-scoped left aside, such as history or prior records. Only some screens use it.
- `RightPanel` is optional and screen-specific. It is not a shared semantic panel. A screen may use it for detail, supporting information, or actions later.
- `DrawerLayer` is an overlay, not a layout slot. Only one drawer can be open at a time.
- If `RightPanel` is open and a drawer opens, the drawer covers the right panel.
- Mobile rules are excluded from v1.

## Widths

```ts
moduleSidePanel: {
  minWidth: 320,
  defaultWidth: 320,
}

contentAside: {
  minWidth: 280,
  defaultWidth: 280,
}

rightPanel: {
  defaultWidth: 316,
}

drawer: {
  defaultWidth: 460,
}
```

Panel resizing is out of scope for v1, but the min/default values are named so resizing can be introduced later.

## State Rules

- Panel open/closed state persists across module navigation.
- Module navigation closes any open drawer.
- A module that does not provide `ContentAside` or `RightPanel` simply does not render that slot.
- Opening a shared URL can override local persisted state.
- User-entered form values, scroll position, table sort/filter, and panel widths are not shared in the URL in v1.

## URL Share State

URL state is for sharing a reviewable screen arrangement with another person.

```txt
/w/clair-demo/dispensing?modulePanel=open&aside=closed&drawer=order:o-10023
```

Recommended URL fields:

- `modulePanel=open|closed`
- `aside=history|closed`
- `right=open|closed`
- `drawer=<type>:<id>`

Local-only state:

- panel widths
- scroll position
- selected tabs
- table sort/filter
- draft form values

## Design System Placement

```txt
Foundations
Components
Layouts
  AppShell
  ModuleLayout
  ContentWorkspace
  DrawerLayer
Patterns
  PatientHeader
  OrderTableWorkflow
  HistoryAsideWorkflow
Screens
```

## Workspace Tab Lifecycle

- Tab activation, new-tab creation, active-tab close, tab history, and shell module navigation wait for registered chart editors to finish saving. A failed save keeps the current surface open. Closing an inactive tab only changes tab metadata.
- Tab content and its cached module panels reset when the destination route is committed. Navigation chrome stays mounted within the same workspace and user session.
- Hidden module panels retain local filter state within a tab but pause their operating-date timer and fulfillment queue subscription. The last queue consumer cancels its pending read and releases its cache. Queue reads are shared only within the same workspace, date, queue type, and optional selected item.
- A selected lab result outside the current date uses the permission-checked exact `workItemId` lookup. It does not trigger an unbounded historical queue read.
- Browser session tab state is the immediate restore source. Server saves are debounced and serialized per workspace; server restore cannot overwrite newer local navigation. Tab metadata persistence does not replace clinical draft persistence.
