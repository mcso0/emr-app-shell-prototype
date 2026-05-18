# AUTH-PR-035 Personal Profile Live Persistence

Linear: DEN-52
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Persist personal profile settings through a server route and local-first Supabase DB boundary without making profile data an authorization source.

## Scope

- Add an own-user profile save route.
- Persist display name, initials, phone, and notification preference.
- Keep mock/browser fallback display state compatible.
- Reject role, permission, and workspace membership authority fields.
- Verify local Supabase migration apply and focused SQL execution.

## Out Of Scope

- No remote Supabase operations.
- No real patient, hospital, or production user data.
- No email change, password, MFA, or account security workflows.
- No role, permission, or membership policy redesign.

## Result

Personal profile settings now save through `PATCH /api/users/me/profile`; Supabase mode writes to `users` and `user_profiles` through `public.clair_save_personal_profile(...)`, while authorization remains separated from editable profile data.

## Verification

- `npx playwright test tests/personal-profile-server.spec.ts tests/auth.spec.ts -g "personal profile" --reporter=line`
- `npx playwright test tests/personal-profile-server.spec.ts tests/auth.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- Focused local SQL execution for `public.clair_save_personal_profile(...)`

Result: passed on 2026-05-18.
