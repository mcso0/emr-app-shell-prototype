---
id: "RECEPTION-PR-013"
status: "done"
area: "reception"
priority: "P0"
target_pr: "Staff profile side panel V2 panel and read-model integration"
source_docs:
  - "docs/design/system/staff-operational-profile-drawer.md"
  - "docs/engineering/data-model/hospital-schedule-operations.md"
  - "docs/product/domain/order-fulfillment-handoff.md"
dependencies:
  - "RECEPTION-PR-012"
updated: "2026-07-16"
---

# Staff Profile Side Panel V2 Read Model And Integration

Merged as [PR #419](https://github.com/mcso0/emr-app-shell-prototype/pull/419)
at `c7723b666c93cb6d1674038677690be52200e3e8`.

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

## Implemented Decisions

- The live panel is `380px` wide with a `10px` detached gap on desktop and
  full-width on narrow screens. It keeps exactly `프로필` and `업무` tabs.
- Operational-profile and work-item routes require an authenticated Supabase
  source. Unconfigured runtime requests return an explicit error instead of
  falling back to demo staff or fulfillment fixtures.
- Profile reads use the workspace timezone and only `published` or `changed`
  schedule weeks. They expose today's shift, the nearest leave/off period in a
  14-day window, and the first following work shift without returning request
  reasons or schedule notes.
- Presence is `unknown` until an authoritative Realtime workspace snapshot has
  arrived, then `online` or `offline`. Channel errors clear it back to
  `unknown`; persisted last-seen activity is not treated as proof of online.
- Assigned work is read from `order_fulfillment_work_items` for the current
  assignee. Terminal rows keep their last assignee, pages are ordered by
  `created_at DESC, id DESC`, and the opaque cursor carries only that boundary.
- The endpoint maps a minimal display projection and never returns the full
  fulfillment source snapshot or internal instructions. Detail links are
  returned only when the caller has the relevant destination permission.
- Header links deep-link to the requested schedule week/staff or membership
  record. The destination screens still enforce their existing permissions.

## Focused Verification

- `npx playwright test tests/staff-profile-v2-read-model.spec.ts tests/staff-operational-profile-server.spec.ts tests/reception-staff-operational-profile.spec.ts --workers=1`: 23 passed.
- The browser coverage includes non-modal keyboard focus return, `380px`
  desktop and full-width narrow layouts, two-tab rendering, permission-filtered
  header actions, cursor append/grouping, and dialog-confirmed navigation.
- Switching staff remounts the panel, resets the active tab, and never reuses a
  previous staff member's assigned-work state.
- The server coverage includes configured-source enforcement, same-workspace
  membership, invalid-cursor rejection before the gateway, 20-row pagination,
  approved source-snapshot projection, 14-day published-schedule availability,
  nullable contacts, partial schedule failure, and three-state Presence.
- `npx vitest --project=storybook run src/features/staff/profile-side-panel-v2-content.stories.tsx src/features/staff/profile-side-panel-v2-header.stories.tsx`: 15 passed.
- `npm run lint`, `npx tsc --noEmit --pretty false`, `npm run docs:check`, and
  `npm run security:secrets`: pass.
- `npm run build`: pass with the existing docs-reader NFT trace warning.
