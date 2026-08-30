# AUTH-PR-046 Profile Menu Avatar Sync

Status: implemented
Area: auth
Priority: P1
Date: 2026-08-30
Source: Browser comment / approved implementation and production release request

## Goal

Render the signed-in user's uploaded profile image in the App Shell profile menu while keeping a compact, readable initials fallback.

## Scope

- Add an authenticated own-user `GET /api/users/me/profile` read.
- Reuse the private-pointer-first, hidden-legacy-aware avatar resolver across current staff reads.
- Keep signed URLs response-only with `private, no-store` API caching.
- Refresh the in-memory current-user read before the five-minute signed URL expires.
- Render the existing shadcn/Base UI Avatar primitive in the topbar and dropdown.
- Show exactly one character in the compact fallback, regardless of language.
- Refresh the current-user profile after personal-profile save, avatar upload, or avatar removal.
- Preserve browser profile fallback in mock mode.

## Out Of Scope

- No schema, migration, RLS, Storage policy, or avatar upload validation change.
- No target-user profile lookup, workspace policy change, or authorization-field exposure.
- No signed URL persistence in browser storage, logs, docs, or audit records.
- No redesign of the personal profile settings screen or staff profile drawer.

## Source Docs

- `docs/engineering/data-model/private-profile-avatars.md`
- `docs/work/auth/AUTH-PR-035-personal-profile-live-persistence.md`
- `docs/work/reception/RECEPTION-LIVE-PR-015-private-profile-avatar.md`
- `docs/engineering/operations/release-environment-policy.md`

## Dependencies

- Existing verified Supabase server session reader and self-read RLS.
- Existing private `profile-avatars` pointer and five-minute signed read contract.
- Existing shadcn/Base UI `Avatar` component.

## Done When

- A signed-in Supabase user with an uploaded image sees it in the topbar and profile dropdown.
- Missing, removed, or failed images fall back to exactly one character without changing the 48px trigger geometry.
- Mock/browser profile behavior remains available without calling the live-only GET.
- Upload, remove, and personal profile save refresh the App Shell identity display.
- Focused route, initials, UI, and shared avatar resolver tests pass with lint, typecheck, docs, secret, diff, and production build gates.

## Verification

- Focused profile/API/UI tests: passed locally.
- Shared staff avatar resolver regression tests: passed locally.
- `npx tsc --noEmit`: passed locally.
- Full release preflight, PR, merge, and production evidence are recorded in the PR and release result.

## Handoff

- Korean closeout: `docs/completed/auth/2026-08-30-auth-pr-046-profile-menu-avatar-report.html`
- Application release only; no remote Supabase data, migration, RLS, Storage policy, or environment mutation is included.
