# Invite Email Delivery Recovery Policy Spec

Status: draft  
Updated: 2026-06-12

This document defines the product target for CLAiR EMR invitation email delivery expectations, invite-link lifecycle, resend/cancel behavior, and recovery states. It should be read with [Login Invite Onboarding Spec](login-invite-onboarding-spec.md), [Member Role Management Spec](member-role-management-spec.md), and [Session Logout Policy Spec](session-logout-policy-spec.md).

## Product Goal

CLAiR EMR should make workspace invitations reliable and recoverable without allowing canceled, expired, or wrongly addressed invites to become uncontrolled access paths. Hospital admins need clear actions for resend, cancel, and correction, while invitees need clear states when a link is expired, canceled, already accepted, or tied to a different email.

## Scope

In scope:

- First hospital-admin invite delivery policy.
- Staff invite delivery policy.
- Invite link expiry and reuse rules.
- Pending invite resend.
- Pending invite cancellation.
- Wrong-email correction flow.
- Existing-account and new-account invite recovery states.
- Expired, canceled, accepted, and invalid invite user-facing states.
- Audit expectations for resend and cancellation.

Out of scope for this spec:

- Real email provider selection or integration.
- Email template implementation.
- DKIM, SPF, DMARC, bounce webhooks, and deliverability engineering.
- Password reset implementation.
- OAuth, SSO, SCIM, MFA, and domain auto-join.
- DB schema, migration, RLS, server/API implementation, and rate limiting.
- Real hospital/customer/patient/guardian/payment data.
- Production launch or public access.

## Baseline Decisions

- CLAiR operations sends the first hospital owner/admin invite after creating the workspace.
- Hospital admins send staff invites from inside the workspace.
- Invite links expire after 7 days.
- Pending invites can be resent.
- Pending invites can be canceled.
- Canceled invite links cannot be reused.
- Invite acceptance must remain tied to the invited email.
- Staff cannot self-join a workspace without a valid invitation.
- Real external email delivery is a later implementation scope and must not be claimed as complete from this planning document.

## Invite Types

| Invite type | Sender | Recipient | Purpose |
| --- | --- | --- | --- |
| First hospital admin invite | CLAiR operations | Hospital owner/director/admin | Initial workspace entry and hospital profile onboarding. |
| Staff invite | Hospital admin | Vet, technician, front desk, or another admin | Staff account creation or workspace membership activation. |
| Recovery invite | Hospital admin or CLAiR internal operator, depending on case | Original or corrected recipient | Restores access after expiration, cancellation, wrong email, or admin lockout. |

## Invite Lifecycle

| State | Meaning | Allowed action |
| --- | --- | --- |
| `pending` | Invite was created and has not been accepted. | Resend or cancel. |
| `delivered_unconfirmed` | Delivery was attempted, but invite has not been accepted. | Resend if recipient did not receive it. |
| `accepted` | Invitee accepted and membership activation completed. | No reuse. Member management handles later access changes. |
| `expired` | Invite passed the 7-day expiry window. | Resend/regenerate invite when still appropriate. |
| `canceled` | Admin intentionally canceled the invite. | No reuse. Create a new invite if needed. |
| `invalid` | Link is malformed, deleted, or not recognized. | Show recovery guidance. |

Implementation may not store every display state exactly as listed. The product must still support these user-facing states.

## Delivery Policy

### First Hospital Admin Invite

1. CLAiR operations creates a workspace after sales/implementation agreement.
2. CLAiR sends an invite to the first hospital owner/admin email.
3. Invite shows the hospital/workspace name and invited email.
4. Invite acceptance creates or connects the account for that email.
5. First admin receives `hospital_admin`.

Acceptance criteria:

- The invite cannot be used by a different email.
- The first admin invite must expire after 7 days.
- Expired first-admin invites require CLAiR operations recovery or resend.
- First-admin recovery must preserve last-admin protection and auditability.

### Staff Invite

1. Hospital admin opens member management.
2. Admin enters recipient email and role(s).
3. System creates a pending invite.
4. Email delivery is attempted when implementation supports real email.
5. Invitee accepts within 7 days.

Acceptance criteria:

- Only hospital admins can send staff invites in MVP.
- Duplicate active membership for the same email/workspace is blocked.
- Duplicate pending invite for the same email/workspace should be resolved by resend rather than creating confusing duplicates.
- Staff invite acceptance must activate only the intended workspace membership.

## Resend Policy

Resend is used when the invite is still conceptually valid but the recipient did not receive it, lost it, or the link expired and the admin still wants the same person to join.

Product rules:

- Resend should be available for pending or expired invites.
- Resend should keep the invited email and workspace fixed.
- Resend may regenerate the invite link.
- Resend should refresh the 7-day validity window when a new link is generated.
- Resend should create an audit event.
- Resend should not create a duplicate pending invite row that confuses admins.

Acceptance criteria:

- Admin can see that the invite was resent.
- Recipient can use only the latest valid invite link when implementation invalidates older links.
- Expired links show a recovery state instead of silently failing.
- Resend does not bypass role/permission checks.

## Cancellation Policy

Cancel is used when the invite should no longer grant access.

Product rules:

- Hospital admins can cancel pending staff invites.
- CLAiR operations can cancel or recover first-admin invites through a separate internal process.
- Canceled links cannot be reused.
- Canceling an invite does not delete historical audit context.
- Canceling an invite does not affect an already active member.

Acceptance criteria:

- Invitee opening a canceled link sees a clear canceled/recovery state.
- Admin can distinguish canceled from expired.
- Cancellation creates an audit event.
- A new invite is required if the person should be invited again.

## Wrong-Email Correction

Wrong-email correction should be handled by canceling the bad invite and creating a new invite for the correct email.

Product rules:

- Do not allow the invitee to change the invited email during acceptance.
- Do not transfer an invite from one email to another after the link has been issued.
- If an admin entered the wrong email, cancel the invite and create a new one.
- If the email typo is found after acceptance, handle it as an account/profile or support case, not invite reuse.

Acceptance criteria:

- Wrong-email invite cannot be accepted by a different email.
- Admin has a clear cancel-and-reinvite path.
- The canceled wrong-email link cannot be reused.
- Audit trail keeps the canceled invite action.

## Existing Account Recovery

When the invited email already has an account:

1. Invitee opens the link.
2. System recognizes that the invited email may already have an account.
3. Invitee signs in with that email.
4. System activates workspace membership when the invite is valid.

Acceptance criteria:

- Invite acceptance requires the invited email account.
- Signing in as a different account cannot accept the invite.
- If the account is already an active member, show an already-member state and route appropriately.
- If membership is inactive, show a recovery or admin-contact state rather than silently reactivating unless reactivation is explicitly approved.

## New Account Recovery

When the invited email has no account:

1. Invitee opens the link.
2. System shows account creation tied to the invited email.
3. Invitee sets password and creates the account.
4. System activates workspace membership when the invite is valid.

Acceptance criteria:

- The invited email should be fixed and visible.
- Account creation cannot change the invite target email.
- Expired or canceled invites cannot create workspace access.
- Account creation errors should not leak unnecessary identity details.

## User-Facing Invite States

Required states:

- Invite valid: continue to sign in or create account.
- Invite expired: ask admin or CLAiR operations for resend.
- Invite canceled: ask admin if access is still needed.
- Invite already accepted: route to login or workspace when authorized.
- Invite email mismatch: sign in with the invited email or request a new invite.
- Invite invalid/not found: ask admin or CLAiR operations for help.
- Already active member: route to workspace when authorized.
- Inactive membership: ask hospital admin or CLAiR support.

## Audit Requirements

The system should produce audit events for:

- Invite created.
- Invite resent.
- Invite canceled.
- Invite accepted.
- Invite expired if expiration is materialized as an event.
- Wrong-email cancellation.
- CLAiR operator recovery or first-admin resend.

Audit records should support who performed the action, workspace, invite target email, selected roles where applicable, before/after state, and timestamp. Final schema belongs in engineering docs.

## Current Implementation Relationship

Current implementation already has related foundations:

- Invite acceptance screens.
- Invite password setup and existing-account login states.
- Local-first workspace/member invitation foundations.
- Invitation cancel, resend, and reinvite-request API surfaces.

Known mismatch:

- Real external email delivery is not complete.
- Provider-level deliverability, bounce handling, and domain authentication are not product-complete claims.
- Client-only checks are not sufficient security. Server-side checks and later DB/RLS enforcement remain required for production security claims.

## CLAiR Docs Viewer Placement

This spec should appear in CLAiR Docs under `Features`.

Display intent:

- This document explains product invite delivery and recovery behavior.
- Engineering auth docs should own provider, email infrastructure, token, DB, RLS, and rate-limit implementation details.
- Current-state docs should continue to record what is implemented now.

## Open Questions

- Should expired invite resend be available directly to hospital admins, or should first-admin expired invites always go through CLAiR operations?
- Should invite email copy be Korean-only in MVP, or support English/Korean templates from the start?
- Should a pending invite expose delivery status beyond "sent" before real email provider integration exists?
- Should invite resend be rate-limited per invite, per admin, or per workspace in the first implementation slice?

## Follow-Up Planning

Recommended next specs:

1. CLAiR internal operator recovery and audit policy.
2. Password reset and account recovery policy.
3. Email template and notification copy spec.
