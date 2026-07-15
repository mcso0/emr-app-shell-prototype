---
id: "RECEPTION-PR-013"
status: "planned"
area: "reception"
priority: "P0"
target_pr: "Staff profile side panel V2 panel and read-model integration"
source_docs:
  - "docs/design/system/staff-operational-profile-drawer.md"
  - "docs/engineering/data-model/hospital-schedule-operations.md"
  - "docs/engineering/data-model/order-fulfillment-handoff.md"
dependencies:
  - "RECEPTION-PR-012"
updated: "2026-07-16"
---

# Staff Profile Side Panel V2 Read Model And Integration

## Goal

Integrate the approved UI into the reception shell and expose truthful,
minimal operational-profile, availability, Presence, and assigned-work reads.

## Scope

- Move the detached panel to 380px with 10px gap and preserve non-modal mobile,
  Escape, focus entry, and focus return behavior.
- Extend the profile read with role/department/contact, published-or-changed
  current shift, safe 14-day availability, and `online|offline|unknown` Presence.
- Add a same-workspace staff work-items endpoint with opaque cursor,
  `requestedAt DESC, id DESC`, limit 20, hospital-timezone grouping, current
  active assignee, and retained terminal assignee semantics.
- Return destination URLs only when the actor has the detailed permission.
- Add menu-to-dialog navigation and all loading/empty/error/pagination states.

## Data, API, And Permission Boundary

- Reuse hospital schedule snapshots and fulfillment work items; no new history
  table or duplicate operational data.
- `GET /api/workspaces/{workspaceId}/staff/{userId}/operational-profile`
- `GET /api/workspaces/{workspaceId}/staff/{userId}/work-items`
- Require authenticated active same-workspace membership. Filter response fields
  and navigation capability server-side; never expose private notes/reasons or
  full fulfillment source snapshots.

## Out Of Scope

- Status-message and avatar mutation persistence.
- New fulfillment mutation behavior or schedule editing.

## Done When

- The rendered panel has exactly two usable tabs and no disabled placeholders.
- All reads use real configured data sources and distinguish partial errors from
  confirmed empty states without runtime fallback values.
- Server permission/cursor/timezone tests and desktop/mobile/keyboard browser
  tests pass with lint, typecheck, build, and docs checks.
