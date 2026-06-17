# Auth Login And Onboarding Current State

Updated: 2026-06-12

This document records the current implemented state for login, invite onboarding, workspace creation, and auth guard behavior. It is not the product target. Product target rules live in [Workspace Auth and Permission Domain](../domain/workspace-auth-permissions.md) and [Workspace Hospital Profile](../domain/workspace-hospital-profile.md).

## Current Implementation Summary

| Area | Current state | Product planning note |
| --- | --- | --- |
| `/login` email/password entry | Present. The default product-facing card asks for email and password. Supabase mode uses password sign-in. Mock mode keeps local demo fallback. | Real product login baseline is email/password for returning invited workspace users. |
| Mock role login | Present in non-production mock mode as development controls. Roles include legacy/demo labels such as `nurse` and `billing_admin`. | Demo/development only. Excluded from real product login planning. |
| Session persistence selector | Present for mock mode: current tab only or browser-local persistence. Supabase mode uses cookie session. | Real automatic sign-in/session duration needs a separate security/session policy. |
| Safe redirect | Present. `next` is preserved for workspace routes and unsafe external redirects fall back to the default workspace route. | Keep this as product/security behavior. |
| Session-required and unauthorized notices | Present through login `reason` query values. | Useful product behavior. Copy can be refined later. |
| `/signup` | Present as a placeholder/account setup notice. It does not represent open self-service workspace signup. | Product should treat account creation as invite-based onboarding, not free workspace self-registration. |
| `/invite/[invitationId]` | Present. Invite context can render password setup, existing-account login, accepted/blocked states, and workspace entry. | This is the closest implementation to the target staff invite onboarding flow. |
| Workspace creation | Present as a session/local-first flow at `/workspace/new`, including hospital/workspace name, representative/admin name, contact email, and contact phone. | Product baseline now says CLAiR operations creates the workspace first; this screen is not the final B2B onboarding model without further review. |
| Workspace member invitation | Present in hospital admin surfaces with email, roles, title, department, pending/active/inactive state, resend/cancel/accept behavior. | Matches the direction that hospital admins invite staff, but final production email delivery and security enforcement remain separate scope. |
| Auth gate | Present. Workspace routes redirect unauthenticated users to `/login` with `next` and block inactive/missing workspace membership. | Keep as a required product/security boundary, with server/DB/RLS enforcement still needed for full security. |

## Product Baseline Already Agreed

- CLAiR EMR is B2B workspace software.
- CLAiR operations creates the hospital workspace after sales/implementation agreement.
- The first hospital owner/admin receives an invitation link by email.
- The first hospital admin accepts the invitation, creates or signs into an account, and enters the workspace.
- Hospital admins invite additional staff by email.
- Invited staff create or connect accounts through the workspace invitation flow.
- Returning users sign in with email and password.
- Demo mock role selection is not part of the real product login experience.

## Important Gaps To Resolve

| Gap | Why it matters | Suggested next planning step |
| --- | --- | --- |
| Workspace creation ownership mismatch | Current `/workspace/new` lets a hospital admin create a workspace in the prototype, but the agreed product baseline is CLAiR-operations-created B2B onboarding. | Decide whether `/workspace/new` becomes internal CLAiR operator tooling, admin onboarding confirmation, or is removed from the customer flow. |
| First admin onboarding detail | Current invite flow focuses on account/password and workspace entry, not hospital profile confirmation. | Design the first admin onboarding sequence against [Workspace Hospital Profile](../domain/workspace-hospital-profile.md). |
| Session policy | Mock mode has visible persistence controls; real product needs a policy for automatic sign-in, expiration, logout, and shared-device risk. | Create a small session policy draft before implementing production persistence defaults. |
| Role labels and legacy aliases | Code still contains `nurse` and `billing_admin` in demo/mock contexts. | Keep demo aliases documented as compatibility only; do not expose them as canonical product roles. |
| Production email delivery | Invite UI and routes exist, but real external email delivery is out of scope. | Plan email delivery separately with approval gates for real external communication. |

## Verification Evidence In Current Repo

Relevant regression coverage exists in:

- `tests/auth.spec.ts`
- `tests/invite-acceptance.spec.ts`
- `tests/invite-onboarding-regression-handoff.spec.ts`
- `tests/invite-otp-handoff.spec.ts`

This inventory did not rerun the full auth/invite suite. It records implementation by reading the current source and existing work-item verification.
