---
id: "RECEPTION-PR-009"
status: "done"
area: "reception"
priority: "P1"
target_pr: "User goal / staff operational profile side panel and presence"
source_docs:
  - "docs/design/system/staff-operational-profile-drawer.md"
  - "docs/product/domain/workspace-auth-permissions.md"
  - "docs/engineering/data-model/emr-saas-db-structure-spec.ko.md"
dependencies:
  - "RECEPTION-PR-007"
  - "RECEPTION-PR-008"
updated: "2026-07-15"
---

# Staff Operational Profile Side Panel And Presence

## Goal

Replace the modal staff profile Sheet with the approved Figma-aligned detached
side panel and add truthful workspace-scoped contact, online presence, and
last-seen data without exposing auth internals or cross-workspace identities.

## Scope

- Render a 336px desktop right-panel column with a 10px gap and no backdrop or
  blur; use a full-width, backdrop-free panel on narrow screens.
- Match Figma node `27682:46426` for the profile header, tabs, shift card,
  account rows, typography, spacing, border, radius, and shadow.
- Remove the reception appointment-count summary and its unused props.
- Add reusable Base UI-backed `Tab`/`TabGroup` primitives, Storybook coverage,
  and keyboard/disabled regression tests.
- Read `email` and `phone` from `public.users` through the existing profile API.
- Authorize the profile read for any active same-workspace member without a
  `reception:view` dependency; preserve cross-workspace non-disclosure.
- Add a private workspace Presence channel and a throttled, workspace-scoped
  `last_seen_at` persistence contract with RLS.
- Preserve base loading/error, shift partial-error, no-shift, responsive, and
  focus-return behavior.

## Out Of Scope

- Editing staff profiles, contact details, schedules, roles, or permissions.
- Treating Auth sessions or refresh tokens as online presence.
- Persisting an `is_online` boolean.
- Implementing content for the placeholder `tab2` and `tab3` tabs.
- Applying unrelated remote migration drift fixes, using real employee data, or
  publishing/deploying the application.

## Done When

- The desktop panel measures 336px and is separated from the content by 10px;
  no Sheet backdrop, blur, or modal inert state remains.
- Mobile uses one full-width panel with Escape, close, focus entry, and focus
  return behavior.
- Email and phone are nullable, copyable, and sourced only from `public.users`.
- Presence supports multiple tabs/devices and is restricted to active members
  of the same workspace through `realtime.messages` RLS.
- `last_seen_at` is workspace-scoped, self-written, same-workspace-readable,
  and write-throttled; absent history renders `접속 기록 없음`.
- Focused server, migration/RLS, component, and Playwright tests pass together
  with lint, typecheck, build, docs checks, and browser/Figma measurements.

## Verification

- Figma source checked through the Figma tool: file `UkfxgituFcU2rhYFriAErJ`,
  node `27682:46426`, including design context, screenshot, metadata, and
  variable values.
- Browser desktop measurement: panel `336px`, content gap `10px`,
  `backdrop-filter: none`, no overlay, and background content not inert.
- Browser mobile measurement: panel `390px` in a `390px` viewport, full height,
  no backdrop; Escape, close control, and trigger focus return passed.
- `npx tsc --noEmit --pretty false`: pass.
- focused ESLint for all touched source/test files: pass.
- server/migration/Presence Playwright: 15 passed, including the shared-channel
  late-listener regression.
- staff panel Playwright: 5 passed.
- Storybook Vitest for tabs: 4 passed.
- `npm run build-storybook`: pass with existing font resolution, Lottie eval,
  and chunk-size warnings.
- `npm run build`: pass with the existing broad NFT trace warning from
  `src/lib/prd-viewer/doc-reader.ts`.
- Remote migration intentionally not applied: remote/local migration drift was
  verified and Supabase CLI is unavailable in this environment. The profile
  degrades by omitting `lastSeenAt` if the activity relation is unavailable.

## Files

- `src/features/staff/staff-operational-profile-drawer.tsx`
- `src/features/staff/server-operational-profile-core.ts`
- `src/features/staff/workspace-staff-presence.ts`
- `src/features/reception/module.tsx`
- `src/shell/app-shell.tsx`, `src/shell/workspace-frame.tsx`
- `src/components/ui/tabs.tsx`, `src/components/ui/tabs.stories.tsx`
- `supabase/migrations/20260714213000_workspace_member_activity_presence.sql`
- `supabase/migrations/20260715014500_staff_presence_broadcast_read_hotfix.sql`
- focused server, migration, Presence, tab, and browser tests
- design, data-contract, current-status, and closeout docs

## Deployment Follow-Up

1. `20260714213000_workspace_member_activity_presence.sql` was applied to the
   remote synthetic/demo target on 2026-07-15.
2. The first production rollout passed authenticated UI/profile API smoke but
   failed private Presence join: hosted Realtime requires `broadcast.read`
   during a private channel join even when the channel is Presence-only.
3. Production aliases were restored to the approved stable deployment while
   the additive activity migration remained applied.
4. `20260715014500_staff_presence_broadcast_read_hotfix.sql` was applied after
   approval. Synthetic replay passed same-workspace subscribe/track, heartbeat
   readback, and cross-workspace denial while Broadcast INSERT stayed denied.
5. The next application rollout exposed a separate Supabase-js channel reuse
   contract: the app-shell reporter had already subscribed when the profile hook
   tried to add Presence callbacks to the same topic, so opening the panel
   crashed. Production aliases were restored to the approved stable deployment.
6. The app-shell reporter now owns the single Realtime channel and publishes a
   workspace snapshot. Profile consumers subscribe to that snapshot and never
   bind callbacks to an already-subscribed channel. Authenticated production UI
   smoke must pass before availability is claimed.

## Closeout

- [Korean result report](../../completed/reception/2026-07-14-staff-operational-profile-side-panel-presence-report.html)
