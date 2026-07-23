---
id: "HOSPITAL-ADMIN-LIVE-PR-022"
status: "implemented"
area: "hospital-admin"
priority: "P0"
target_pr: "User request / private workspace hospital logo persistence"
completion_report: "docs/completed/hospital-admin/2026-07-23-private-hospital-logo-storage-report.html"
source_docs:
  - "docs/product/domain/workspace-hospital-profile.md"
  - "docs/engineering/data-model/workspace-hospital-settings.md"
  - "docs/engineering/data-model/private-profile-avatars.md"
  - "docs/superpowers/plans/2026-07-23-hospital-settings-live-implementation.md"
dependencies:
  - "HOSPITAL-ADMIN-PR-007"
  - "HOSPITAL-ADMIN-LIVE-PR-021"
updated: "2026-07-23"
---

# Private Hospital Logo Storage

## Goal

Make the approved hospital-logo editor durable with a private,
workspace-scoped, validated Storage flow and safe pointer replacement/removal.

## Scope

- Add the private `hospital-logos` bucket, workspace-admin Storage policies,
  and a constrained logo pointer on `workspace_hospital_profiles`.
- Use server-generated quarantine/final paths and signed direct upload so image
  bytes do not cross the Next.js route.
- Accept PNG/JPEG up to 5MB, validate decoded content, and normalize a static
  512×512 WebP with `contain` fit and metadata removal.
- Add prepare/finalize/discard and remove route operations with mutation rate
  limits, compare-and-set pointer updates, compensation, and explicit cleanup
  results.
- Resolve the current pointer to a short-lived signed read URL for authorized
  same-workspace members.
- Connect the hover/focus edit button, modal preview, default-image action,
  dirty state, save, and Sonner feedback to the live boundary.
- Reuse the proven private profile-avatar upload sequence where its ownership
  and cleanup semantics apply, while keeping user-avatar and workspace-logo
  policies separate.

## Out Of Scope

- Public marketing assets, CDN publishing, multiple logo variants, SVG, GIF,
  animated WebP, or freeform cropping.
- Replacing the existing staff profile-avatar bucket or pointer.
- Applying a logo to external email/PDF templates not already reading the
  hospital profile.
- Remote bucket/migration/deployment without explicit approval.

## Done When

- Valid logo upload survives reload and is visible only to authorized
  same-workspace readers through a signed URL.
- Invalid type, size, pixels, animation, MIME mismatch, cross-workspace path,
  non-admin write, stale pointer, and cleanup failures have focused coverage.
- Replacing/removing a logo never leaves the DB pointing at a missing new
  object; handled orphan cleanup is explicit.
- Upload tokens, signed URLs, image bytes, and raw field values do not appear in
  audit or logs.
- Keyboard hover/focus parity, Dialog focus return, object-URL revocation,
  toasts, and responsive preview are verified.

## Verification

- `npx playwright test tests/hospital-logo-image.spec.ts tests/hospital-logo-server.spec.ts tests/hospital-logo-storage-migration.spec.ts tests/staff-profile-avatar-image.spec.ts tests/staff-profile-avatar-persistence.spec.ts tests/staff-profile-avatar-route.spec.ts --project=chromium --reporter=line`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/hospital-admin.spec.ts --project=chromium --grep "hospital logo" --reporter=line`
- `npx supabase db reset --local`
- `node scripts/check-private-hospital-logo-storage.mjs`
- `npx tsc --noEmit`
- `npm run lint -- src/features/hospital-admin/settings 'src/app/api/workspaces/[workspaceId]/hospital-admin/settings/logo' tests/hospital-logo-*.spec.ts`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Handoff Notes

- The final bucket must allow WebP because normalization produces WebP even
  though customer source selection accepts only PNG/JPEG.
- Keep signed-read lifetime and cleanup evidence separate from UI preview
  success; a local object URL is not persistence proof.

## Implementation Result

Implemented and locally verified on 2026-07-23.

- The private bucket, workspace-scoped Storage policies, guarded pointer RPC,
  signed direct upload, server normalization, compare-and-set replacement,
  removal compensation, and cleanup paths are present.
- Source validation accepts only decoded PNG/JPEG within the size/dimension
  limits and writes a metadata-stripped static 512×512 WebP.
- Transactional SQL replay passed for pointer/RLS/audit rules. The Storage API
  QA passed signed upload, quarantine isolation, current-member read, pointer
  restore, cross-owner admin delete, and object cleanup against local Supabase.
- The browser editor uses the approved hover/focus trigger and reports every
  explicit validation, upload, apply, remove, and failure outcome by toast.
- No remote bucket, migration, or deployment was changed.
