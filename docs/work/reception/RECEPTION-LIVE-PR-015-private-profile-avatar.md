---
id: "RECEPTION-LIVE-PR-015"
status: "implemented"
area: "reception"
priority: "P0"
target_pr: "Private self-service profile avatar pipeline"
source_docs:
  - "docs/design/system/staff-operational-profile-drawer.md"
  - "docs/engineering/auth-security/persistence-data-security-checklist.md"
  - "docs/engineering/data-model/private-profile-avatars.md"
dependencies:
  - "RECEPTION-LIVE-PR-014"
updated: "2026-07-16"
---

# Private Self-Service Profile Avatar

## Goal

Allow a user to upload or remove only their own avatar through a private,
server-validated image pipeline and short-lived signed reads.

## Scope

- Add the minimal avatar object metadata/pointer migration and a private Storage
  bucket/policy contract derived from authenticated ownership.
- Add `POST /api/users/me/avatar` and `DELETE /api/users/me/avatar`.
- Enforce JPEG/PNG/static WebP, 5MB object limit, minimum 256px side, bounded
  pixel count, magic/MIME/decode/dimension/animation verification, metadata
  stripping, and normalized re-encoding before storage.
- Never trust client object paths. Return signed URLs and redact bytes, tokens,
  object signatures, and unnecessary personal data from logs/errors.
- Wire reset-on-open upload, preview, validation, progress, success, error,
  remove, retry, and keyboard/focus behavior into the panel.

## Alternatives And Impact

| Option | Benefit | Cost / Risk | Decision |
| --- | --- | --- | --- |
| Convert the existing public `avatars` seed bucket in place | One bucket and one pointer | Breaks existing public seed consumers and requires an all-at-once object/pointer migration | Rejected |
| Add a separate private `profile-avatars` bucket and prefer a new pointer | Preserves existing synthetic seed avatars while new self-service objects use private reads | Read models must resolve a short-lived signed URL and retain a legacy fallback | Selected |
| Send the raw image through the Next.js Route Handler | Simple server validation flow | Vercel Functions cap request bodies at 4.5MB, below the approved 5MB product contract | Rejected |
| Prepare a server-derived signed upload, upload directly to private quarantine, then finalize through the same API | Keeps the 5MB contract, never accepts a client object path for persistence, and still performs server decode/re-encode before publishing | Adds prepare/finalize states and transient-object cleanup | Selected |

Implementation boundary:

- Add `user_profiles.avatar_storage_path` plus the explicit
  `avatar_legacy_hidden` fallback state; keep `avatar_url` unchanged as the
  legacy public seed pointer. New reads prefer the private pointer and otherwise
  use the legacy pointer only while it is not hidden. Removing an avatar clears
  the private pointer and hides the legacy fallback so initials become visible.
- Derive quarantine and normalized object paths from the authenticated user plus
  server-generated UUIDs. Finalization accepts an upload ID, never an object path.
- Bound input at 5MB and 25 megapixels, require a 256px minimum side, reject
  unsupported/mismatched/animated inputs, and normalize to a static 512px WebP.
  Sharp's default metadata stripping remains enabled.
- Keep the route on the Node.js runtime. Use the existing Next-provided Sharp
  version as an explicit direct dependency because application code imports it.
- Create five-minute signed read URLs. Signed upload tokens and signed read URLs
  are response-only capabilities and must never enter logs, audit payloads, or
  durable documentation.
- Upload finalization deletes quarantine in all handled outcomes. Pointer writes
  use optimistic compare-and-set; failed pointer writes delete the new object.
  Remove clears the pointers first and compensates them if private-object deletion
  fails, returning a recoverable error instead of claiming success.
- The migration is additive. Rollback drops the pointer/RPC/policies/private
  bucket only after private objects are removed; the legacy public seed bucket is
  not changed.
- A global 84px Avatar variant remains rejected until a second stable consumer
  exists; the profile composes the size locally.

## Implemented Result

- The browser sends only bounded action JSON through the Node.js Route Handler.
  It uploads the raw file with an authenticated signed upload token to a
  server-derived quarantine path, then requests finalization by upload ID.
- Finalization downloads the quarantine object, verifies magic/declared/stored
  MIME, decodes under a 25-megapixel limit, rejects animation and dimensions
  below 256px, rotates, crops, strips metadata, and writes a 512px static WebP.
- Pointer changes use a self-only CAS RPC and content-free audit metadata. Direct
  authenticated avatar-column updates, other-user updates, inactive users, and
  cross-workspace calls are denied by DB/RLS boundaries.
- The existing public `avatars` bucket remains unchanged. New objects live in
  private `profile-avatars`. An active owner can read their own quarantine and
  normalized objects so finalization can sign before the pointer swap; another
  same-workspace member requires the exact current pointer. Reads use five-minute
  signed URLs with five-minute object cache control.
- Upload failure performs best-effort quarantine discard. Finalization cleans
  quarantine on every handled result. Remove clears the pointer first and
  restores it if Storage deletion fails, so the UI never claims a partial delete.
- The upload dialog renders as a viewport-centered fixed surface with a real
  square cover preview, icon-only close/reset controls, and trigger focus return.

## Remote Application And Verification

- Approved project identity: `clair-emr-staging`
  (`qmerxgzrwaaahpkhjqlc`, healthy at application time).
- Remote migration version: `20260715172425` (`private_profile_avatars`). The
  no-op local history alias preserves remote/local migration lineage; executable
  source remains `20260716020000_private_profile_avatars.sql`.
- Remote catalog confirmed both pointer columns, private 5MB bucket, unchanged
  public legacy bucket, authenticated-only SELECT/INSERT/DELETE policies, guard
  trigger, authenticated RPC grant, and denied anonymous RPC grant.
- Local and approved-remote synthetic QA confirmed signed direct upload,
  owner-only quarantine, owner pre-pointer final signing, peer pre-pointer denial,
  pointer-scoped same-workspace read/sign, Storage API cleanup, pointer restoration,
  direct/other-user/inactive/cross-workspace denial, and rollback. The final
  remote probe confirmed zero remaining actor objects and the original null/false
  pointer state.
- Supabase security advisor reports the authenticated `SECURITY DEFINER` RPC as
  an intentional warning. The function is intentionally exposed to
  `authenticated`, owns no target-user argument, derives `auth.uid()`, checks an
  active user/membership/workspace, validates owner paths, uses CAS, and grants
  neither `anon` nor `public` execution.

## Verification Evidence

- Clean `supabase db reset --local --yes --no-seed` replayed the complete local
  history through both the comment-only alias and canonical avatar migration.
- Local and approved-remote transaction replays passed all RPC/RLS allow-deny
  assertions and rolled back. Local and remote Storage API probes passed all six
  upload/read/pointer/cleanup assertions; the remote residual-object count is `0`.
- Focused Playwright suite: `49 passed`. Storybook interaction suite: `15 passed`.
  The avatar story additionally asserts fixed viewport placement, square cover
  preview, icon-only controls, reset-on-open, and focus return.
- `npm run lint`, `npx tsc --noEmit`, `npm run docs:check`,
  `npm run security:secrets`, `git diff --check`, and `npm run build` passed.
  Build retained the pre-existing dynamic docs-reader NFT trace warning only.

## Done When

- Valid formats upload; oversized, undersized, malformed, mismatched, animated,
  cross-user, and cross-path inputs are denied by server and storage boundaries.
- Delete and pointer cleanup do not claim success on partial failure.
- Scoped synthetic/demo upload, signed read, cross-user denial, remove, and
  cleanup pass on the approved remote target; migration/storage drift is clean.
- UI, server, RLS/Storage, lint, typecheck, build, docs, and browser tests pass.
