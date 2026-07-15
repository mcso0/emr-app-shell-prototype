---
id: "RECEPTION-LIVE-PR-015"
status: "planned"
area: "reception"
priority: "P0"
target_pr: "Private self-service profile avatar pipeline"
source_docs:
  - "docs/design/system/staff-operational-profile-drawer.md"
  - "docs/engineering/auth-security/persistence-data-security-checklist.md"
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
- Enforce JPEG/PNG/static WebP, 5MB request limit, minimum 256px side, bounded
  pixel count, magic/MIME/decode/dimension/animation verification, metadata
  stripping, and normalized re-encoding before storage.
- Never trust client object paths. Return signed URLs and redact bytes, tokens,
  object signatures, and unnecessary personal data from logs/errors.
- Wire reset-on-open upload, preview, validation, progress, success, error,
  remove, retry, and keyboard/focus behavior into the panel.

## Alternatives And Impact

- A public bucket is rejected because profile images are workspace-private.
- Direct browser upload without server validation is rejected because declared
  MIME and dimensions are untrusted.
- A global 84px Avatar variant is rejected until a second stable consumer
  exists; the profile composes the size locally.

## Done When

- Valid formats upload; oversized, undersized, malformed, mismatched, animated,
  cross-user, and cross-path inputs are denied by server and storage boundaries.
- Delete and pointer cleanup do not claim success on partial failure.
- Scoped synthetic/demo upload, signed read, cross-user denial, remove, and
  cleanup pass on the approved remote target; migration/storage drift is clean.
- UI, server, RLS/Storage, lint, typecheck, build, docs, and browser tests pass.
