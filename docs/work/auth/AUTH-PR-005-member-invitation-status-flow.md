# AUTH-PR-005 Member Invitation Status Flow

Status: human_review
Linear: DEN-24
Priority: P0

## Goal

Add a session-only workspace member invitation flow where a hospital admin can invite staff by email, assign one or more canonical roles, and manage pending invitation lifecycle states.

## Source Docs

- `docs/agent-start-here.md`
- `docs/engineering/current-status.md`
- `docs/product/domain/workspace-auth-permissions.md`
- `docs/engineering/auth-security/auth-login/workspace-membership-data-security-plan.md`
- `docs/engineering/auth-security/auth-login/status.md`
- Linear `DEN-24`

## Scope

- Extend the session workspace state contract with `workspace_invitations`-like data.
- Support invitation fields: email, workspace, invited roles, status, invited by, expiry, accepted/canceled/resend metadata.
- Add member list visibility for active, pending, inactive/suspended states.
- Add a member invite form in the hospital admin module.
- Support one or more canonical roles: `hospital_admin`, `vet`, `technician`, `front_desk`.
- Block duplicate pending invitations by workspace/email.
- Block invitations for already active workspace member emails.
- Allow pending invite resend, cancel, and accept simulation in session-only state.
- Gate invite/member mutations to the `hospital_admin` mock role or Supabase placeholder session.
- Add regression coverage for invite creation, duplicate handling, role selection, cancel/resend, accept simulation, and admin-only gating.

## Out of Scope

- Real email delivery.
- Public invite links.
- SSO, SCIM, or domain auto-join.
- Live Supabase persistence, migration SQL, or RLS SQL.
- Billing seat charging.
- Server-side permission enforcement.

## Done Criteria

- Hospital admins can create and manage pending invitations in the prototype.
- Pending, active, and inactive/suspended member states are visible in the member management view.
- Non-admin roles cannot create or mutate invitations.
- Linear `DEN-24` can move to Human Review.

## Verification

```bash
npx playwright test tests/auth.spec.ts --reporter=line
npm run lint -- --ignore-pattern '.worktrees/**'
npx tsc --noEmit
npm run build
npx playwright test tests/auth.spec.ts tests/app-shell.spec.ts --reporter=line
npm run docs:check
```

Results:

- Red: `npx playwright test tests/auth.spec.ts --reporter=line` failed because `병원구성원 관리` was disabled and invitation contract functions did not exist.
- `npx playwright test tests/auth.spec.ts --reporter=line`: passed, `20 passed`.
- `npm run lint -- --ignore-pattern '.worktrees/**'`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `npx playwright test tests/auth.spec.ts tests/app-shell.spec.ts --reporter=line`: passed, `50 passed`.
- `npm run docs:check`: passed, `545 docs/agent markdown files` checked.

## Notes

- This remains a session-only prototype. Invitations and accepted memberships are stored in browser storage, not Supabase.
- Accepting an invite is a local simulation that creates an active membership for `invitee:<email>`.
- Last active `hospital_admin` protection, server-side authorization, and RLS enforcement remain future server work.
