# AUTH-PR-010 Security Review Workspace Auth Permission Boundary

Linear: DEN-27  
Status: human_review  
Area: auth  
Priority: P0  
Date: 2026-05-17

## Goal

Review the workspace auth and permission implementation sequence from a CSO perspective and identify concrete security gaps before live persistence, Supabase session enforcement, migration, or RLS work begins.

## Scope

- Workspace creation and creator `hospital_admin` assignment.
- Member invitation and session-only membership status flow.
- Role management UI and last active `hospital_admin` protection.
- Personal profile settings separation from authorization.
- Server-only permission resolver contract.
- First role-update Route Handler enforcement slice.

## Non-Goals

- No product source code changes.
- No live exploit attempts.
- No migration, RLS, or live Supabase project changes.
- No production deploy.

## Findings

### High: Demo header identity must not reach live role mutation

Verified in `src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/roles/route.ts`.

The first server enforcement slice reads actor identity from `x-clair-demo-session-user-id`. This is acceptable only as a demo/test seam. If persistence is added before replacing this with a verified Supabase server session, a caller could spoof `user-admin` and pass the role update authorization path.

Recommended follow-up issue:

- `05-03 Replace demo role-update identity header with verified Supabase server session`

### High: Role management UI still mutates session storage directly

Verified in `src/features/auth/workspace-membership-management.tsx` and `src/features/auth/workspace-session.ts`.

The UI uses session-only helpers and browser storage for role edits/deactivation. The DEN-21 server route exists as an authorization boundary, but the UI is not yet wired through it. This is acceptable for the prototype, but not for live role management.

Recommended follow-up issue:

- `05-04 Route-backed role mutation UI handoff`

### Medium: Last-admin protection needs transactional DB/RPC enforcement later

Verified in `src/features/auth/permission-resolver.ts`, `src/features/auth/workspace-session.ts`, and tests.

The last active `hospital_admin` guard is implemented in session and server resolver contracts. Once live DB writes exist, this protection must move into a single server transaction or private RPC with appropriate locking to avoid concurrent demotion/deactivation races.

Recommended follow-up issue:

- `05-05 DB transaction/RPC for last active hospital admin guard`

## Positive Controls Verified

- Personal profile storage does not save role, role label, or permission fields.
- User-editable profile data is not used by the permission resolver or first server route.
- Multi-role permission resolution is additive, deterministic, and tested.
- `hospital_admin` dominates the effective permission union.
- `technician` and `front_desk` can view charts but do not receive `chart:update`.
- Server role-update enforcement imports `server-only` and does not use browser storage APIs.

## Verification

- Source/docs review only; no product source code changed for this review.
- `npm run docs:check` passed.

## Report

- `docs/completed/auth/2026-05-17-den-27-workspace-auth-security-review-report.html`
