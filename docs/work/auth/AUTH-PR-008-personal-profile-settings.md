# AUTH-PR-008 Personal Profile Settings

Status: human_review
Linear: DEN-26
Priority: P0

## Goal

Add session-only personal profile settings while keeping user-editable profile data separate from workspace membership and authorization sources.

## Source Docs

- `docs/agent-start-here.md`
- `docs/engineering/current-status.md`
- `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`
- `docs/engineering/auth-security/auth-login/README.md`
- `docs/engineering/auth-security/auth-login/status.md`
- `docs/work/auth/AUTH-PR-007-role-management-admin-ui.md`
- Linear `DEN-26`
- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`

## Scope

- Add `/profile` behind the existing auth gate.
- Add a personal profile settings entry from the auth profile menu.
- Support editable display name, initials, phone, and notification preference placeholder.
- Persist editable profile fields to a dedicated session-only personal profile storage contract.
- Keep role and authorization information read-only in the profile screen.
- Ensure the personal profile storage contract does not store roles, role labels, or permission fields.
- Update shell profile display to use saved personal profile data when available.
- Add Playwright coverage for profile navigation, validation, save behavior, and authorization-source separation.

## Out of Scope

- Password change.
- MFA.
- OAuth identity management.
- Email identity change.
- Permission or role self-service.
- Live Supabase persistence.

## Done Criteria

- Users can open personal profile settings from the profile menu.
- Users can edit allowed personal profile fields with validation.
- Saved profile data updates the shell profile display.
- Role and permission fields cannot be edited from the personal profile screen.
- Profile data remains separate from workspace membership and permission source.
- Linear `DEN-26` can move to Human Review.

## Verification

```bash
npx playwright test tests/auth.spec.ts -g "profile" --reporter=line
npx playwright test tests/auth.spec.ts --reporter=line
npm run lint -- --ignore-pattern '.worktrees/**'
npx tsc --noEmit
npm run build
npx playwright test tests/auth.spec.ts tests/permission-resolver.spec.ts tests/app-shell.spec.ts --reporter=line
npm run docs:check
```

Results:

- Red: `npx playwright test tests/auth.spec.ts --reporter=line` failed because `src/features/auth/personal-profile-session` and profile settings UI did not exist.
- `npx playwright test tests/auth.spec.ts -g "profile" --reporter=line`: passed, `3 passed`.
- `npx playwright test tests/auth.spec.ts --reporter=line`: passed, `26 passed`.
- `npm run lint -- --ignore-pattern '.worktrees/**'`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `npx playwright test tests/auth.spec.ts tests/permission-resolver.spec.ts tests/app-shell.spec.ts --reporter=line`: passed, `62 passed`.
- `npm run docs:check`: passed, `548 docs/agent markdown files` checked.

## Notes

- This remains session-only. Personal profile data is stored in `clair.personalProfiles.v1`.
- Authorization still comes from workspace membership and permission policies, not profile storage.
- Supabase identity profile, email change, password, MFA, and live persistence remain future work.
