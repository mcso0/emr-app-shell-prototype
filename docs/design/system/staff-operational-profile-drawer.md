---
id: DESIGN-SYSTEM-STAFF-OPERATIONAL-PROFILE-DRAWER
type: Design Contract
title: Staff Operational Profile Side Panel V2
description: Defines the non-modal staff profile side panel, truthful workspace data, self-service status/avatar controls, and assigned-work timeline.
status: active
area: design-system
doc_type: design-contract
tags:
  - staff
  - operational-profile
  - side-panel
  - presence
  - workspace-membership
  - fulfillment
created: 2026-07-14
last_updated: 2026-07-16
---

# Staff Operational Profile Side Panel V2

## Decision

The staff operational profile is a detached, non-modal workspace side panel. V2
replaces the 336px read-only panel and disabled placeholder tabs with the
approved Figma contract and exactly two usable tabs: `프로필` and `업무 현황`.

The panel may summarize only verified workspace data. It must not manufacture
runtime profile, schedule, availability, presence, or work-item values when a
read is missing or fails.

Approved source material:

- Figma file `UkfxgituFcU2rhYFriAErJ`, nodes `27709:108270`,
  `27709:108435`, `27709:108541`, `27709:109593`, `27709:109729`,
  `27709:109998`, and `27709:110143`
- [V2 research](../../work/reception/RECEPTION-PR-010-profile-side-panel-v2-research.md)
- [V2 analysis report](../../completed/design/2026-07-15-profile-side-panel-v2-analysis-report.html)

## User Goal And Information Architecture

A workspace member can inspect a colleague without leaving the current task,
understand the colleague's operational availability, and navigate to permitted
assigned work. A user can edit only their own status message and avatar.

The visible order is:

1. header: avatar, Presence, name, editable-or-read-only status message, and
   member-management menu when permitted
2. tabs: `프로필`, `업무 현황`
3. profile account information: role, department, email, phone
4. today's published/changed shift
5. next availability event within 14 days and the following return-to-work date

Do not show private schedule notes, absence reasons, internal IDs, auth/session
metadata, or inferred clinical competence.

## Layout Contract

| Area | Contract |
| --- | --- |
| desktop panel | width `380px`, content gap `10px`, independent right-side layout column |
| mobile/narrow | full viewport width and height, no backdrop, no modal focus trap, no background `inert` |
| panel surface | workspace side-panel semantic surface, 1px semantic border, 12px radius on desktop, shell-owned shadow |
| header | height `150px`, 16px horizontal padding, bottom border |
| avatar | `84px` square, 6px radius, cover crop; compose locally instead of adding a global Avatar size |
| presence | `20px` badge with dot and text for online, offline, or unknown |
| status message | `28px` high; default/hover max width `217px`; input/result width `217px` |
| tabs | exactly two Base UI tabs using the shared line variant |
| content | 16px horizontal padding, internal vertical scroll, section spacing from approved design tokens |
| avatar action menu | `180px` wide; upload group, separator, remove group |
| header action menu | `196px` wide; permission-gated member-management entries |
| upload dialog | `382px` wide shell, `350px` content square, `64px` footer |

Use existing `--clair-*` tokens and semantic `--emr-*` aliases. Profile-specific
aliases, when needed, belong in `emr-foundation.css`; never edit generated
`clair.css`. Raw color values are not part of the component contract.

## Open, Close, Focus, And Responsive Behavior

- Reception opens the panel as transient shell state and does not persist the
  target user ID to the URL.
- Only one right-side panel is active at a time.
- Opening focuses the close control. Close and `Escape` return focus to the
  exact opener when it still exists.
- The panel is non-modal at every viewport. No Sheet overlay, backdrop, blur,
  `aria-hidden`, or background `inert` is allowed.
- Background workspace content remains reachable on desktop. On narrow screens
  the panel fills the viewport but still uses the non-modal shell contract.
- 200% zoom and long names, contact values, status messages, and labels must not
  cover the close or overflow actions.

## Header, Presence, And Status Message

### Presence

Presence has three explicit states:

- `online`: one or more Presence metas exist for the target user in the current
  private workspace channel.
- `offline`: the private channel is subscribed and the target has no Presence
  meta.
- `unknown`: subscription has not resolved, is unavailable, or failed.

Realtime Presence is the only live online source. Do not persist `is_online`,
infer it from Auth sessions, or treat `last_seen_at` as online state. Persisted
workspace-scoped `last_seen_at` supplies only the relative last-seen label.

### Workspace Status Message

- The message is workspace-scoped and may contain at most 60 Unicode
  characters after trimming.
- Only the current user can edit their own message. Other members see the same
  value read-only.
- `Enter` and blur save; `Escape` cancels and restores the last confirmed value.
- Empty trimmed input removes the message.
- Save is optimistic, but failure rolls back to the confirmed value, exposes an
  accessible error, and offers retry.
- The API and RLS policy enforce self-only mutation; hiding the editor in the
  client is not a security boundary.

## Avatar Self-Service

- Only the current user sees the avatar action trigger for their own profile.
- The menu order is upload, separator, remove. Remove is disabled when no avatar
  exists.
- Opening the upload dialog always resets prior file, preview, validation, and
  request state.
- The selected file renders as a real square cover preview. Icon-only close and
  preview-reset controls have explicit Korean accessible names; there is no
  separate text close button. Closing returns focus to the avatar menu trigger.
- Progress distinguishes upload preparation, direct file upload, and server
  image processing. Failure keeps the current avatar and exposes retryable
  feedback without moving focus.
- Accepted input: JPEG, PNG, or static WebP; maximum 5MB; minimum side 256px.
- The server verifies file magic, declared MIME, successful decode, dimensions,
  pixel count, and WebP animation state. It strips metadata and re-encodes a
  normalized image before storage.
- Storage is private. Object ownership is derived from the authenticated user;
  client-supplied object paths are never trusted. Reads return short-lived
  signed URLs rather than public object URLs.
- A bounded JSON `prepare` call returns a signed direct-upload capability for a
  server-derived quarantine path. A JSON `finalize` call accepts only the upload
  ID and declared MIME; the server downloads, validates, normalizes, publishes,
  swaps the pointer, and cleans quarantine. `discard` is a best-effort cleanup
  action for interrupted browser uploads.
- Delete removes the owned object and clears the profile pointer as one guarded
  operation or reports a recoverable partial failure without claiming success.
- Previously issued signed URLs or already cached responses can remain usable
  until their five-minute lifetime ends. New signing is denied as soon as the
  pointer is cleared, and the owned object is deleted through the Storage API.

## Profile Tab Read Contract

### Account

Show, in order: role, department, email, phone. Nullable values render
`미등록`; copy actions exist only for present email or phone values and announce
success or failure.

### Today's Shift

Use only the current published or changed hospital schedule snapshot. Show the
time, work label, location, and computed status when present. No schedule row is
not an error; read failure is an explicit section error with retry. Do not expose
draft schedules or private notes.

### Availability

Read the next leave/off event in a 14-day window and the first following work
date from the same published/changed schedule source. Show only safe date/type
summaries; never expose notes or reasons. Distinguish loading, no upcoming
event, partial read failure, and confirmed data.

## Work Status Tab

The tab reads actual fulfillment work items assigned to the target member.

- Sort by `requestedAt DESC, id DESC` and page with a stable opaque cursor.
- Return at most 20 items per request.
- The authenticated server-session client has table `SELECT` only; active
  workspace membership RLS limits rows. Direct insert/update/delete table
  privileges are not part of this read contract.
- Group rows by hospital operating date and timezone.
- Active items use the current assignee. Terminal items retain the recorded
  assignee; do not add a new history table solely for this panel.
- Return only the safe summary fields needed for the timeline. Do not expose
  patient/guardian contact details, private instructions, or full source
  snapshots.
- A detailed destination URL is present only when the actor has permission for
  that destination. The more menu opens a confirmation/navigation dialog; the
  card itself is not a hidden navigation shortcut.
- Loading, empty, first-page error, next-page error, and pagination-complete
  states are distinct. The empty state uses `EmrEmptyState`.

Feature-local components own profile workflows. Shared EMR components are
appropriate only for stable cross-screen roles such as timeline structure,
assigned-work cards, category badges, and fulfillment status badges.

## API Boundaries

```http
GET /api/workspaces/{workspaceId}/staff/{userId}/operational-profile?date=YYYY-MM-DD
GET /api/workspaces/{workspaceId}/staff/{userId}/work-items?limit=20&cursor=...
PATCH /api/workspaces/{workspaceId}/members/me/status-message
POST /api/users/me/avatar
DELETE /api/users/me/avatar
```

- Every route resolves an authenticated actor and active same-workspace
  membership before returning workspace data.
- Operational profile reads may be available to active same-workspace members;
  destination navigation and member-management actions require their own
  server-derived permissions.
- Member-management menu items are omitted from the DOM when the actor lacks
  permission. Client omission does not replace API/RLS enforcement.
- Responses are minimal and make partial failures explicit. A failed live read
  never falls back to runtime demo values.
- Mutation routes validate content type, request size, normalized payload, and
  ownership before persistence. Logs and errors must not include uploaded bytes,
  signed URLs, auth tokens, or unnecessary personal data.
- The avatar POST body is JSON-only and capped at 2KB. Raw images never traverse
  the Route Handler request body; the private Storage object is still capped at
  5MB and is never trusted until server finalization succeeds.

## Loading, Empty, Error, And Accessibility States

- Initial profile and work-item loading preserve layout with skeletons.
- Base read failures use an accessible inline alert and retry action.
- Section failures remain section failures; do not translate them into
  `미등록`, offline, no shift, no leave, or empty work.
- Online/offline/unknown and fulfillment states use text in addition to color.
- Icon-only controls have explicit Korean accessible names and visible neutral
  focus rings. Menus, tabs, dialogs, editable text, and file input remain
  keyboard reachable.
- Status save and avatar upload/remove success or failure are announced without
  moving focus unexpectedly.

## Forbidden Patterns

- modal Sheet, backdrop, blur, focus trap, or background inert
- any tab beyond `프로필` and `업무 현황`
- runtime dummy/fallback profile, availability, Presence, or work-item data
- DB `is_online` or Auth session-based online inference
- public avatar bucket or trusting a client object path
- client-only edit, member-management, navigation, or workspace checks
- private schedule notes/reasons or excessive fulfillment source snapshots
- converting read failures into ordinary empty/offline/unregistered states

## Delivery And Verification

Implement this Level 4 change in separately reviewable PRs: canonical/UI
contracts, panel/read models, status-message persistence, and private avatar
pipeline. Each PR starts from the latest `origin/main`, includes focused tests
and affected docs, and is merged before the next PR starts.

Final completion requires desktop and mobile browser QA, keyboard/focus checks,
Storybook interaction tests, server and RLS/storage tests, synthetic live-data
create/readback/cleanup, migration drift review, production deployment, and
post-deploy authenticated smoke against synthetic/demo data only.

The consolidated human and automated release scenario is
[Product MVP QA Scenario 8](../../engineering/testing/product-mvp-qa-scenario-pack.md#scenario-8-staff-profile-side-panel-v2).
The decision-oriented delivery record is the
[V2 release closeout report](../../completed/reception/2026-07-16-staff-profile-side-panel-v2-release-closeout-report.html).
