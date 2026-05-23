# Invite Acceptance Account Onboarding Flow

Status: review
Updated: 2026-05-23
Related Linear: DEN-187
Related initiative: CLAiR EMR Staging Pilot Enablement

## Purpose

Define the invite acceptance UX flow before implementation and verification.

This is the product/design test basis for the staging invite flow where a hospital administrator sends an email invitation and the invited person either creates a new account or signs in with an existing account before the app activates workspace membership.

## Product Principle

An invitation link is not enough to activate workspace access.

CLAiR EMR must activate membership only after both are true:

1. The invitation is valid, pending, unexpired, and belongs to the requested workspace.
2. The authenticated Supabase identity email matches the invitation email.

Supabase Auth owns account creation, password sign-in, session cookies, password reset, and future MFA. CLAiR app routes own invite validity, membership activation, workspace routing, and safe denial UX.

## Primary Actors

| Actor | Goal |
| --- | --- |
| Hospital admin | Invite a staff member into an approved hospital workspace. |
| New invited staff user | Create an account for the invited email, accept the invite, and enter the workspace. |
| Existing invited staff user | Sign in with the invited email, accept the invite, and enter the workspace. |
| Wrong signed-in user | Must be blocked from claiming another email's invite. |

## Happy Path Overview

1. Hospital admin sends an invitation email from the workspace member-management surface.
2. Invited person opens the email and clicks `Open invitation`.
3. Invite page loads with workspace, role, invited email, and expiration details.
4. User chooses one account path:
   - `신규 계정으로 시작`
   - `기존 계정에 연결`
5. User authenticates as the invited email.
6. App returns to the invite page.
7. App accepts the pending invitation through the server accept route.
8. App routes to the invited workspace.

## Screen Flow

```mermaid
flowchart TD
  A["Email: workspace invitation"] --> B["Invite page: /invite/[invitationId]"]
  B --> C{"Invite valid and pending?"}
  C -- "No" --> D["Safe blocked state"]
  C -- "Yes" --> E{"User account path"}
  E -- "New user" --> F["Account creation page"]
  E -- "Existing user" --> G["Login page"]
  F --> H["Authenticated as invited email"]
  G --> H
  H --> I{"Session email matches invite email?"}
  I -- "No" --> J["Wrong-account denial"]
  I -- "Yes" --> K["Accept invitation"]
  K --> L["Workspace entry"]
```

## Invite Page Requirements

For a pending invite, the page must show:

- Product mark: `CLAiR EMR`
- Heading: `초대 수락`
- Invited email
- Invited role label
- Workspace display name
- Expiration time
- Two account path actions:
  - `신규 계정으로 시작`
  - `기존 계정에 연결`

The page must not imply that selecting a card alone creates or links an account. Selecting a path should navigate to the corresponding account screen.

The primary accept action is available only when the user is already authenticated as the invited email. If unauthenticated, the primary action should route to the chosen account path instead of failing first.

## New User Path

Trigger: user selects `신규 계정으로 시작`.

Expected UX:

1. Navigate to an account creation page with invite context preserved in `next`.
2. Pre-fill or lock the email to the invited email when possible.
3. Show workspace context so the user understands why the account is being created.
4. After account creation and session establishment, return to the original invite URL.
5. Auto-attempt or clearly offer invitation acceptance.
6. On success, route to `/w/[workspaceId]/reception?modulePanel=open&aside=closed`.

Initial staging implementation may use password-based Supabase signup only if explicitly approved. If signup is not implemented yet, the UX should show a clear `계정 생성은 아직 준비 중입니다` blocked state, not silently route to generic login.

## Existing User Path

Trigger: user selects `기존 계정에 연결`.

Expected UX:

1. Navigate to `/login?reason=invite_existing_account&next=[safe invite path]`.
2. Pre-fill the email with the invited email when possible.
3. Show invite-aware copy: `초대받은 이메일 계정으로 로그인하세요.`
4. Hide or de-emphasize development-only controls in staging Preview when Supabase Auth is active.
5. After login, return to the invite URL.
6. Accept the invitation if the authenticated email matches the invited email.
7. On success, route to the invited workspace.

## Already Authenticated Path

If the user opens a valid invite while already authenticated:

| Session state | Expected behavior |
| --- | --- |
| Authenticated email matches invited email | Show invite details and allow direct accept. |
| Authenticated email differs from invited email | Show safe denial and offer sign out / switch account. Do not call accept. |
| Authenticated user is already an active member | Show `이미 워크스페이스 구성원입니다` and route to workspace. |

## Blocked And Error States

| State | UX copy intent | Membership effect |
| --- | --- | --- |
| Missing invite | The link cannot be verified. Ask for a new invitation. | No membership mutation. |
| Expired invite | The invitation expired. Ask admin to resend. | No membership mutation. |
| Canceled invite | The invitation was canceled. Ask admin for a new invite. | No membership mutation. |
| Accepted invite | Already accepted. Route to workspace only if current user has active membership. | No duplicate membership. |
| Unauthenticated | Ask user to create account or log in first. | No membership mutation. |
| Email mismatch | Ask user to switch to invited email. | No membership mutation. |
| Server failure | Show retry-safe error without raw provider details. | No membership mutation unless server returned success. |

## Staging UX Rules

- Do not show raw invite token, service role, API key, OTP, magic link, or provider error.
- Do not expose production wording, production domains, or production send behavior in staging Preview.
- Development controls may remain for local/mock mode, but staging Supabase invite flows should keep them visually secondary or hidden.
- The user should never have to guess whether they are creating a new account or signing into an existing account.
- The user should never see a generic login screen without invite context after coming from an invite.

## Scenario Test Matrix

| ID | Scenario | Given | Action | Expected result |
| --- | --- | --- | --- | --- |
| INV-UX-01 | Pending invite renders account paths | Valid pending invite | Open email link | Invite page shows email, role, workspace, expiry, `신규 계정으로 시작`, `기존 계정에 연결`. |
| INV-UX-02 | Existing user path preserves next | Valid pending invite, no session | Click `기존 계정에 연결` | Login URL contains safe `next` back to invite and invite-aware reason. |
| INV-UX-03 | New user path preserves next | Valid pending invite, no session | Click `신규 계정으로 시작` | Account creation route or explicit not-ready state preserves safe `next` back to invite. |
| INV-UX-04 | Login returns to invite | User logs in from existing path | Submit valid credentials | Browser returns to invite URL. |
| INV-UX-05 | Matching email can accept | Authenticated as invited email | Accept invite | Server accept route succeeds; workspace opens. |
| INV-UX-06 | Wrong email cannot accept | Authenticated as another email | Open invite / accept | Safe denial; no membership mutation. |
| INV-UX-07 | Invalid invite is blocked | Missing/expired/canceled/accepted invite | Open link | No account actions that imply successful joining. |
| INV-UX-08 | Staging email link points to latest Preview | Resend-approved staging email | Open latest email | Link host is the current staging Preview domain. |
| INV-UX-09 | Development controls do not dominate staging | Supabase staging Preview login | Navigate from invite to login | Login screen prioritizes invite login context over mock role controls. |

## Implementation Slice Recommendation

Implement in two slices if needed:

1. UX routing and copy hardening:
   - Pending invite page routes account-path buttons to login/signup-intent destinations.
   - Login page reads invite reason/email context and shows invite-aware copy.
   - Staging Supabase mode hides or minimizes mock development controls.
   - Playwright coverage for INV-UX-01 through INV-UX-03 and INV-UX-09.

2. Account creation and auto-accept:
   - Add approved Supabase signup/password setup route or explicit not-ready page.
   - Return to invite after auth.
   - Accept invite only when authenticated email matches.
   - Server/browser coverage for INV-UX-04 through INV-UX-07.

## Out Of Scope

- Production deploy.
- New email provider work.
- Additional real email sends.
- Direct SQL mutation.
- Remote Supabase migration push without explicit approval.
- MFA, SSO, SCIM, or enterprise domain auto-join.
- Public workspace self-signup.

## Verification Plan

Before implementation:

- Review this flow with 승욱.

After implementation:

- Add or update Playwright tests using the scenario matrix above.
- Run focused invite acceptance tests.
- Run focused login tests if login copy/routing changes.
- Run `npm run docs:check`.
- Run `npm run security:secrets`.
- For staging Preview, verify with the latest invite email only after explicit send/deploy approval.
