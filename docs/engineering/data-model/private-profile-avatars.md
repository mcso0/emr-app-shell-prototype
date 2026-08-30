---
id: ENGINEERING-DATA-MODEL-PRIVATE-PROFILE-AVATARS
type: Data Contract
title: Private Profile Avatars
description: Defines the private self-service avatar pointer, Storage ownership, validation, signed-read, cleanup, and legacy-fallback boundaries.
status: active
area: engineering
doc_type: data-contract
tags: [staff, profile, avatar, storage, rls, image-security]
related_work:
  - RECEPTION-LIVE-PR-015
  - AUTH-PR-046
last_updated: 2026-08-30
---

# Private Profile Avatars

## Decision

New self-service staff avatars use a separate private `profile-avatars` Storage
bucket. The existing public `avatars` bucket and `user_profiles.avatar_url`
remain unchanged for synthetic seed compatibility. Application reads prefer the
private pointer and use the legacy public pointer only when the legacy fallback
has not been explicitly hidden.

## Profile State

| Field | Contract |
| --- | --- |
| `user_profiles.avatar_storage_path` | Nullable private object path. It must equal `{user_id}/avatars/{server UUID}.webp`. |
| `user_profiles.avatar_legacy_hidden` | Non-null boolean, default `false`. When `true`, `avatar_url` is not an application fallback. |
| `user_profiles.avatar_url` | Unchanged legacy public seed path. New self-service writes never replace or delete it. |

The two new fields form one compare-and-set state. Upload sets a new private
path and hides the legacy fallback. Remove clears the private path and keeps the
legacy fallback hidden. Compensating restore reinstates the exact prior state if
owned-object deletion fails.

## Object Layout And Bucket

| Surface | Contract |
| --- | --- |
| bucket | `profile-avatars`, private, 5MB maximum, JPEG/PNG/WebP upload MIME allowlist |
| quarantine | `{auth.uid()}/incoming/{server UUID}` |
| normalized object | `{auth.uid()}/avatars/{server UUID}.webp` |
| signed read | 5-minute expiry; normalized object cache control is also 5 minutes |
| legacy bucket | `avatars`, public synthetic seed storage; unchanged by this migration |

The API generates both UUIDs. A client can submit an upload ID returned by
`prepare`; it cannot submit an object path, final avatar ID, or target user ID.

## Mutation Sequence

1. `prepare` authenticates the actor, resolves an active workspace permission
   adapter, derives a quarantine path, and returns a signed upload token.
2. The browser uploads directly to the private quarantine object. The Next.js
   route receives no raw file body.
3. `finalize` derives both paths from `auth.uid()` and server UUIDs, downloads
   quarantine, validates and normalizes the image, then uploads an immutable
   private WebP.
4. The active owner creates a five-minute signed read for the new normalized
   object while the old pointer remains authoritative.
5. `clair_set_my_profile_avatar_state` locks the actor's profile row, compares
   the expected two-field state, updates it atomically, and appends only boolean
   before/after state plus the operation to the audit log.
6. After pointer success, the server removes the old private object and
   quarantine. Cleanup failure is explicit and never rewrites the new pointer.
7. Remove swaps the pointer to the initials fallback before Storage deletion. A
   deletion failure attempts an exact CAS restore and returns a recoverable
   failure rather than success.

## Authorization

- The RPC has no target-user argument and derives the actor from `auth.uid()`.
- The actor's `public.users` row and current workspace membership must both be
  active.
- Authenticated users may insert/delete only owner-derived paths under their own
  first folder.
- An owner may read their quarantine and normalized objects while active.
- Another active workspace member may read only an object that is the exact
  current `avatar_storage_path` of an active member in the same workspace.
- Anonymous, inactive, cross-workspace, other-user mutation, foreign-path, and
  direct authenticated avatar-column writes are denied.
- A transaction-local RPC marker lets the guarded self RPC update the two
  columns without allowing ordinary authenticated table updates to bypass it.

## Read Consumers

- Staff operational reads and the current-user personal profile read use one
  private-pointer-first resolver and preserve the explicit hidden-legacy rule.
- `GET /api/users/me/profile` accepts no target user or workspace identifier.
  It derives the current user from the verified Supabase session and returns a
  five-minute signed avatar URL only for that user.
- The current-user response is `private, no-store`. Signed URLs remain in
  response/UI memory only, are refreshed before their five-minute expiry, and
  are not written to browser profile storage.
- Successful self-service upload or removal emits the existing personal-profile
  change event so App Shell consumers request a fresh current-user profile.

## Image Validation

Finalization accepts only JPEG, PNG, or static WebP and enforces all of the
following before the profile pointer can change:

- raw size at most 5MB
- file magic, declared MIME, stored MIME, and decoded format agreement
- successful decode with warnings treated as failures
- minimum width and height of 256px
- at most 25 megapixels
- exactly one decoded page/frame; animated WebP is rejected
- orientation normalization, center cover-crop to 512px square, and static WebP
  re-encoding
- no source EXIF, ICC, XMP, or other metadata copied to the output

## Failure And Cleanup Semantics

- Invalid finalization removes quarantine and leaves the pointer unchanged.
- A normalized-object upload, signed-read, or pointer failure removes the new
  object when possible and leaves the old pointer authoritative.
- A handled browser upload/finalize failure calls `discard` with the upload ID.
  It is best effort; no target or object path is accepted.
- Signed URLs already issued before removal may remain valid until their
  five-minute expiry. Clearing the pointer denies new same-workspace signing,
  and Storage deletion removes the source object.
- Logs, API errors, audit events, and docs must not contain image bytes, upload
  tokens, signed URLs, auth tokens, or object signatures.

## Migration And Verification

- Executable migration: `20260716020000_private_profile_avatars.sql`
- Approved remote history version: `20260715172425`
- Local history alias:
  `20260715172425_remote_history_alias_private_profile_avatars.sql`
- Transactional DB replay:
  `supabase/snippets/private_profile_avatar_replay.sql`
- Local/approved-remote Storage API replay:
  `scripts/check-private-profile-avatar-storage.mjs`

Rollback is additive but ordered: stop avatar mutations, remove private objects
through the Storage API, clear/restore profile pointers as approved, then remove
the private policies/RPC/bucket and finally the two new columns. The public
legacy bucket is outside this rollback.
