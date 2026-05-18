# Personal Profile Live Persistence

Updated: 2026-05-18
Linear: DEN-52
Project: `02 Workspace & Membership Live Persistence`

## Summary

DEN-52 connects personal profile settings to a server route and local-first Supabase persistence while keeping editable profile data out of authorization decisions.

## What Changed

- Added `PATCH /api/users/me/profile`.
- Added `src/features/auth/server-personal-profile.ts`.
- Added local-first profile persistence RPC migration `20260518130000_personal_profile_persistence.sql`.
- Updated `PersonalProfileSettings` to save through the server route before updating browser display state.
- Added `tests/personal-profile-server.spec.ts`.

## Data Boundary

Editable profile fields are limited to display name, initials, phone, and notification opt-in.

Role, permission, and workspace membership authority still comes from membership and permission sources only. The profile route rejects authority-shaped request fields before persistence.

## Verification

- `npx playwright test tests/personal-profile-server.spec.ts tests/auth.spec.ts -g "personal profile" --reporter=line`
- `npx playwright test tests/personal-profile-server.spec.ts tests/auth.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- Focused local SQL execution for `public.clair_save_personal_profile(...)`

Remote Supabase, real user data, email/account security settings, password/MFA, and role or permission policy changes remain out of scope.
