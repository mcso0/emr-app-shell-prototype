---
id: "RECEPTION-PR-010"
status: "human_review"
area: "reception"
priority: "P0"
target_pr: "User request / CDS V2 profile side panel research"
source_docs:
  - "docs/design/system/staff-operational-profile-drawer.md"
  - "docs/design/system/ux-ui-research-before-implementation.md"
  - "docs/engineering/data-model/workspace-member-activity-presence.md"
dependencies:
  - "RECEPTION-PR-009"
updated: "2026-07-15"
---

# Profile Side Panel V2 Research

## Goal

Translate the approved CDS V2 Figma profile references into an implementation-ready
proposal for the reception staff profile side panel, including editable self-profile
states, status message behavior, avatar upload/removal, reusable Presence UI, and
meaningful profile tabs.

## Scope

- Compare the current production panel with Figma nodes `27709:108270`,
  `27709:109593`, `27709:108541`, `27709:110143`, `27709:109998`, and the
  saved-status hover instance `27709:109729`.
- Define the revised panel layout, information order, tabs, responsive behavior,
  loading/error/empty states, and keyboard behavior.
- Separate self-editable controls from other-member read-only viewing.
- Propose component boundaries for the profile header, editable avatar, status
  message editor, Presence badge, tabs, and avatar upload dialog.
- Replace the proposed `최근활동` tab with an approved `업무 현황` timeline for
  fulfillment work assigned to the viewed staff member.
- Define the profile work-status read contract, cursor pagination, permission-aware
  navigation, date grouping, loading, empty, and error states.
- Define the no-dummy-data implementation boundary: profile, today's schedule,
  upcoming absence, and assigned work must come from their real application read
  paths, with no UI-local fixture rows or silent mock fallback.
- Identify API, storage, schema, RLS, permission, and audit impacts before
  implementation.
- Provide a Korean HTML report and interactive visual mockup.
- Provide pre-implementation component specimens for avatar, status message,
  Presence badge, avatar action menu, header action menu, availability summary,
  and upload dialog states.
- Audit component dimensions, spacing, colors, radius, shadows, typography, and
  controls against the referenced Figma variables and map them to repository tokens.

## Out Of Scope

- Production component, API, migration, RLS, or Supabase Storage changes.
- Remote migration application or deployment.
- Administrator editing of another member's status message or avatar.
- Production work-status implementation or a new profile-calendar data source.

## Recommendation

- Use the Figma `380px` panel and `150px` header only for the staff profile panel;
  do not widen every workspace right panel.
- Compose the profile UI from the installed shadcn/Base UI primitives. Keep visual
  fidelity in CLAiR/EMR tokens and feature wrappers instead of forking primitives.
- Keep the shared `Avatar` primitive unchanged initially. Compose it inside an
  `EditableProfileAvatar` wrapper for the 84px profile size, hover edit affordance,
  dropdown actions, fallback, and upload dialog. Promote a shared size variant only
  if another stable consumer needs the same 84px contract.
- Allow avatar and status-message editing only when `actorUserId === userId`.
- Keep other-member profiles read-only unless a later permission and audit contract
  explicitly authorizes delegated editing.
- Extract a reusable Presence badge with `online`, `offline`, and `unknown` states;
  do not map subscription failure to offline.
- Keep only `프로필` and `업무 현황` as content tabs. The profile tab answers
  whether the staff member is available today or this week through account, today
  schedule, upcoming absence, and next-return summaries. Remove `캘린더` and
  `더보기` tabs; place full-schedule navigation, contact copy, and permission-gated
  member administration in the header overflow menu.
- Do not duplicate a weekly calendar inside the profile panel. Full-schedule
  navigation deep-links to the existing hospital schedule for the viewed staff
  member and reference week.
- Order profile work by order request time descending, group by hospital-local
  date, load 20 items at a time, and merge a continued date across cursors.
- Show active work only for the current assignee and terminal work for the assignee
  retained at completion/cancellation. Reassigned active work leaves the former
  assignee's list; exact historical assignment audit remains a later data-model item.
- Allow same-workspace members to read work summaries, but return a navigation href
  only when the actor may read the linked patient/order. Navigation uses the card
  overflow menu and a confirmation dialog; the information card itself is not a
  button.
- Split implementation into UI contract, status-message persistence, avatar
  persistence, and work-status data-source slices.
- Treat report values as layout-only examples. Implementation verification must
  create and assign source-backed synthetic work through the actual order and
  fulfillment path, assert the profile read-back by stable IDs, and clean up the
  test records. Apply the same source-backed rule to profile, today's schedule,
  and upcoming absence data. Full-schedule navigation uses the existing schedule
  route instead of fabricating or copying calendar rows.

## Done When

- Current and Figma evidence is captured and linked.
- The report covers information architecture, interactions, state matrices,
  component APIs, server/storage boundaries, accessibility, responsive behavior,
  implementation slices, and verification.
- An interactive HTML mockup demonstrates self-edit, read-only, tab, avatar menu,
  status-message edit, upload-dialog states, work date collapse, card menu,
  permission-aware navigation confirmation, incremental history loading, today
  schedule, upcoming absence, and the header overflow menu.
- The revised mockup matches the Figma avatar hover icon, saves status messages on
  Enter or focus-out with a transparent result state, keeps saved-message hover
  feedback fitted to the text and edit icon (capped at 217px), switches image
  removal to fallback initials, resets every upload-dialog open to the empty
  placeholder, and lets the user clear a selected preview back to the empty state
  before upload.
- The avatar action menu composes shadcn/Base UI `DropdownMenuGroup`,
  `DropdownMenuItem`, and a sibling `DropdownMenuSeparator`; the destructive item
  does not draw its own top border.
- Account-information labels now use the repository CDS icons matching Figma:
  15px user, medical cross, mail, and phone icons with an 8px label gap and
  `neutral/500` color.
- Risks requiring product or security approval are explicit.
- Production implementation contains no copied report constants, local dummy rows,
  fixtures, or API-failure mock fallback for profile, work, today schedule, or
  upcoming-absence surfaces.

## Verification

- Figma design context and screenshots inspected for all six scoped nodes.
- Current Vercel panel captured through the in-app browser and visually inspected.
- Current component, route, personal-profile API, Presence hook, avatar storage
  migration, RLS, shell width, tabs, and dialog primitives inspected.
- HTML report opened in the browser and visually checked at desktop and narrow widths.
- Interactive checks cover status save on Enter/focus-out, transparent saved state,
  avatar hover edit affordance, remove-to-fallback behavior, and upload-dialog reset.
- Avatar-menu checks confirm a standalone separator role between the upload and
  destructive remove groups, with no `border-top` on the remove item.
- Upload preview checks cover selected-image clear, file-input reset, placeholder
  restoration, focus return, and upload-button disabling.
- Component specimens cover avatar, status message, Presence badge, avatar action
  menu, header action menu, availability summary, upload dialog, work timeline,
  assigned-work card, category/status badges, and work-tab loading/empty/error
  states before production component extraction.
  Work-tab states reuse `EmrQueueLoadingState` for initial loading,
  `EmrQueueEmptyState`/`EmrEmptyState size="md"` for resolved no-data, and
  `EmrInlineAlert severity="error"` for read failure and retry.
- Work-status mock checks cover request-time ordering, newest-two-date expansion,
  older-date collapse, overflow-only navigation, confirmation dialog focus return,
  `이전 업무 더보기` behavior, and a clean connecting line without circular card
  markers.
- Profile navigation checks confirm only `프로필` and `업무 현황` remain as tabs,
  upcoming absence stays inside the profile summary, and the header overflow owns
  full-schedule, contact-copy, and permission-gated member-admin actions.
- Implementation verification is defined as a source-backed synthetic integration
  check: create an order through the actual application path, assign it to a
  synthetic test staff member, assert the same work-item ID and state through the
  profile read API, then roll back or explicitly clean up. Profile, published
  schedule/time-clock, and upcoming-absence reads follow the same no-fixture rule;
  full-schedule navigation is verified against the existing schedule route.
- Figma-to-repository token mapping covers atomic color, spacing, radius, shadow,
  typography, control-height, and fixed component-dimension contracts.
- Upload guidance is revised for the product flow: square `512×512px` or larger is
  recommended; JPG/JPEG, PNG, and static WebP are accepted; maximum size is 5MB.
  The current PNG-only 2MB storage boundary must be expanded during implementation.
- The upload contract also records a 256px minimum side, client error states, and
  required server-side magic-byte, decode, pixel-count, metadata-removal, and static
  re-encode checks. GIF/APNG, SVG, HEIC/HEIF, and AVIF remain out of MVP scope.
- `npm run docs:check`.

## Report

- [Korean analysis and interactive mockup](../../completed/design/2026-07-15-profile-side-panel-v2-analysis-report.html)
