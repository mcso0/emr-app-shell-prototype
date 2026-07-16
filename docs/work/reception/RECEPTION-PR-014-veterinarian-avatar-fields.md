---
id: "RECEPTION-PR-014"
status: "implemented"
area: "reception"
priority: "P1"
target_pr: "Reception and reservation veterinarian avatar fields"
source_docs:
  - "docs/work/reception/RECEPTION-LIVE-PR-015-private-profile-avatar.md"
  - "docs/engineering/data-model/private-profile-avatars.md"
dependencies:
  - "RECEPTION-LIVE-PR-015"
updated: "2026-07-16"
---

# Reception And Reservation Veterinarian Avatar Fields

## Goal

Show the assigned veterinarian's avatar before their name across reception and
reservation fields while preserving the existing Select and private-avatar read
contracts.

## Scope

- Reuse the existing shadcn/Base UI `Select` and shared `Avatar` components.
- Render the server-provided `avatarUrl` in assigned options, selected triggers,
  appointment check-in, and encounter detail/edit fields.
- Use Avatar initials when an assigned veterinarian has no image or image loading
  fails, and a neutral user-minus icon for the explicit unassigned state.
- Refresh prepared-workspace staff reads every 60 seconds and on window focus in
  the drawer so five-minute signed URLs do not become stale during long sessions.
- Keep avatar sizing, spacing, and fallback colors in reception semantic tokens.

## Out Of Scope

- Storage bucket, RLS, schema, upload, or signed-URL generation changes.
- Migrating or removing the public synthetic seed avatar bucket.
- Adding a new shared Select or Avatar component API.

## Done Criteria

- Walk-in and reservation create fields show an avatar in options and after
  selection.
- Appointment check-in and encounter detail/edit fields use the same identity
  treatment.
- Assigned users without images show initials; `수의사 미지정` shows the neutral
  user-minus icon.
- Prepared-workspace fields consume the existing workspace staff `avatarUrl`
  response without storing or reconstructing signed URLs on the client.
- Focused UI, workspace staff/private avatar, lint, typecheck, and build
  verification pass.

## Verification

- `npx playwright test tests/reception.spec.ts --grep 'reception and reservation veterinarian fields render avatars with an unassigned fallback'`
- `npx playwright test tests/workspace-staff-server.spec.ts tests/staff-profile-avatar-persistence.spec.ts tests/staff-profile-avatar-route.spec.ts`
- `npx eslint src/features/reception/module.tsx tests/reception.spec.ts`
- `npx tsc --noEmit`
- `npm run build`
- `git diff --check`

## Result Report

- `docs/completed/reception/2026-07-16-reception-veterinarian-avatar-fields-report.html`
