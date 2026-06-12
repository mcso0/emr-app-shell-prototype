# Member Role Management Spec

Status: draft  
Updated: 2026-06-12

This document defines the product target for CLAiR EMR workspace member invitation, role assignment, admin promotion, membership status, and last-admin protection. It should be read with [Workspace Auth and Permission Domain](../../domain/workspace-auth-permissions.md), [Login Invite Onboarding Spec](login-invite-onboarding-spec.md), and [Role Screen Access Current State](../../current-state/role-screen-access-current-state.md).

## Product Goal

Hospital admins should be able to invite staff, assign one or more roles, update staff access, and deactivate workspace membership without risking accidental workspace lockout or mixing demo-only role behavior into the real product.

## Scope

In scope:

- Hospital-admin staff invitation.
- Pending invite resend and cancellation.
- Workspace membership activation through invite acceptance.
- Member profile fields needed for workspace administration.
- Multi-role assignment.
- Admin promotion.
- Member deactivation as workspace membership status change.
- Last active hospital-admin protection.
- Audit requirements for sensitive member and role changes.
- CLAiR internal operator recovery as a separate support/admin concept.

Out of scope for this spec:

- Open self-service hospital signup.
- Demo/mock role selector.
- Real external email delivery implementation.
- DB schema, migration, RLS, and server/API implementation details.
- Full CLAiR internal operator console design.
- SSO, SCIM, MFA, delegated manager/team-lead permissions, and domain auto-join.
- Real hospital/customer/patient/guardian/payment data.
- Production launch or public access.

## Primary Actors

| Actor | Meaning |
| --- | --- |
| Hospital admin | Customer-side workspace admin who can invite staff, edit roles/status, and maintain hospital settings. |
| Staff invitee | Vet, technician, or front-desk user invited into an existing workspace. |
| Active member | User with active workspace membership and one or more roles. |
| Last active hospital admin | The only remaining active workspace member with `hospital_admin`. This user is protected from demotion, deactivation, removal, or leave actions that would leave the workspace without an admin. |
| CLAiR internal operator | CLAiR-side support/operations user who can recover or intervene through a separate internal permission surface. This is not the same as customer-facing hospital admin. |

## MVP Policy Decisions

- Only `hospital_admin` can invite and manage staff in MVP.
- Larger-hospital manager or team-lead permissions are deferred.
- A hospital admin can promote another active or invited employee to `hospital_admin`.
- The last active `hospital_admin` cannot be disabled, demoted, removed, or allowed to leave if that would leave zero admins.
- Employee removal is membership deactivation, not account deletion.
- Deactivation blocks that user's access to the workspace while preserving the account and historical audit trail.
- Multi-role assignment is allowed because real hospital teams often have concurrent duties.
- Invitation links expire after 7 days.
- Pending invitations can be resent or canceled.
- Canceled invitation links cannot be reused.
- CLAiR internal operator recovery is allowed, but it must use a separate CLAiR-side authority model rather than the hospital-admin UI.

## Canonical Roles

MVP customer-facing roles remain:

| Role ID | Label | Product meaning |
| --- | --- | --- |
| `hospital_admin` | 병원관리자 | Full workspace administration. Can manage members, roles, hospital settings, and audit access. |
| `vet` | 수의사 | Clinical user with broad operational access, excluding hospital/admin settings. |
| `technician` | 테크니션 | Clinical support user. Can complete operational support tasks but cannot author core chart records. |
| `front_desk` | 데스크 | Reception, appointment, customer-facing, and checkout/front-office work. |

MVP does not include `billing_admin` / `수납 관리자` as a separate canonical role. Billing/front-office access is handled through `front_desk` and `hospital_admin` until a larger-hospital billing role is explicitly approved.

## Member Data Fields

The member-management surface should expose and store at least:

| Field | Purpose |
| --- | --- |
| Email | Login identity and invite target. |
| Name | Staff display and administrative identification. |
| Phone number | Operational contact and staff profile reference. |
| Roles | One or more canonical workspace roles. |
| Department | Hospital-defined department or team grouping. |
| Title | Staff title or position. |
| Status | `pending`, `active`, or `inactive` membership state. |
| Invited at | Invite creation timestamp for pending or historical audit context. |
| Last accessed at | Last workspace access timestamp for admin review. |

Implementation detail such as account IDs, membership IDs, and audit IDs belong in engineering/data-model docs, not this product feature spec.

## Invite Lifecycle

| State | Meaning | Allowed admin actions |
| --- | --- | --- |
| `pending` | Invite was created but not accepted. | Resend, cancel, edit planned roles before acceptance if implementation supports it. |
| `active` | Invitee accepted and workspace membership is active. | Edit roles, promote to admin, deactivate, update department/title. |
| `canceled` | Invite was intentionally canceled. | No reuse. Create a new invite if needed. |
| `expired` | Invite passed the 7-day expiry window. | Resend by creating or regenerating a valid invite. |
| `inactive` | Membership is disabled for this workspace. | Review history; possible reactivation is an open product decision. |

## Core User Journeys

### 1. Invite Staff

1. Hospital admin opens member management.
2. Admin enters email, name if available, phone if available, department, title, and one or more roles.
3. System creates a pending invite.
4. Invitee receives or is given the invite link.
5. Invitee accepts within 7 days and creates or signs into an account.
6. System activates workspace membership with the assigned roles.

Acceptance criteria:

- Only hospital admins can create invitations.
- Duplicate active membership for the same email/workspace is blocked.
- Duplicate pending invitation for the same email/workspace is blocked or handled through resend.
- Invite context shows the workspace/hospital name, invited email, and selected role(s).
- Staff cannot self-assign roles.

### 2. Resend or Cancel Pending Invite

1. Hospital admin opens pending invitations.
2. Admin chooses resend or cancel.
3. Resend updates invite delivery state and keeps a valid invitation path.
4. Cancel invalidates the invitation link.

Acceptance criteria:

- Resent invites remain tied to the same workspace and invited email.
- Canceled invite links cannot be reused.
- Invite resend and cancellation create audit events.
- UI clearly distinguishes pending, expired, and canceled invites.

### 3. Edit Member Roles

1. Hospital admin opens an active member.
2. Admin changes one or more assigned roles.
3. System calculates effective permissions from the additive union of active roles.
4. System records the role change.

Acceptance criteria:

- Multi-role assignment is allowed.
- If `hospital_admin` is present, admin-level workspace permissions apply.
- Role changes are blocked if they would remove the last active hospital admin.
- Role changes create audit events.
- Personal profile editing cannot change roles or permissions.

### 4. Promote to Hospital Admin

1. Hospital admin opens an active member or invite flow.
2. Admin assigns `hospital_admin`.
3. System confirms the high-impact change.
4. Member becomes a hospital admin for that workspace.

Acceptance criteria:

- Admin promotion can be performed by an existing hospital admin.
- The product should make admin authority clear before save.
- Admin promotion creates an audit event.
- Later implementation may require recent re-authentication for this action.

### 5. Deactivate Member

1. Hospital admin opens an active member.
2. Admin chooses deactivate.
3. System blocks the action if the member is the last active hospital admin.
4. If allowed, membership becomes `inactive`.
5. User loses access to that workspace but their account and audit history remain.

Acceptance criteria:

- Deactivation does not delete the account.
- Deactivation is workspace-scoped.
- Inactive members cannot enter workspace routes.
- Deactivation creates an audit event.
- Last active hospital admin cannot be deactivated.

### 6. CLAiR Internal Operator Recovery

1. A workspace access or admin-recovery issue is escalated to CLAiR operations.
2. CLAiR internal operator uses a separate internal authority model.
3. Operator restores a valid admin path or performs controlled recovery.

Acceptance criteria:

- CLAiR operator authority is not exposed as customer-facing hospital admin.
- Recovery actions create audit events.
- Operator intervention should be rare and traceable.
- Full internal operator console design is separate follow-up scope.

## Audit Requirements

The system should produce audit events for:

- Role change.
- Hospital-admin promotion.
- Member deactivation.
- Pending invite cancellation.
- Pending invite resend.
- Last-admin blocked action, when useful for security review.
- CLAiR internal operator recovery action.

Audit records should support who performed the action, which workspace was affected, target member or invite, before/after role or status where applicable, and timestamp. Final schema belongs in engineering docs.

## Error And Recovery States

Required states:

- Invite already pending for this email.
- Active member already exists.
- Invite expired.
- Invite canceled.
- Invite already accepted.
- User is inactive for this workspace.
- Last active hospital admin action blocked.
- User lacks permission to manage members.
- CLAiR operator recovery required.

## Current Implementation Relationship

Current implementation already has related foundations:

- Hospital-admin membership/invitation management surfaces.
- Local-first workspace/member invitation foundations.
- Role management surfaces and permission gating foundations.
- Existing auth/workspace work items for invitation lifecycle, membership reads, role edit enforcement, and last-admin protection.

Known mismatch:

- Current code may still include demo or development-only role affordances.
- Customer-facing role management must follow the canonical MVP roles in this spec and [Workspace Auth and Permission Domain](../../domain/workspace-auth-permissions.md).
- Client-only gating is not complete security. Server-side and later DB/RLS enforcement remain required for production security claims.

## CLAiR Docs Viewer Placement

This spec should appear in CLAiR Docs under `Features`.

Display intent:

- Feature specs answer "what should the product do?"
- Current-state docs answer "what is implemented now?"
- Domain docs answer "what concepts, roles, and permission boundaries are canonical?"

## Open Questions

- Should phone number be required for every staff member or optional in MVP?
- Should hospital admins be able to reactivate inactive members, or should reactivation require CLAiR operator support?
- Should admin promotion, role removal, and member deactivation require recent re-authentication?

## Follow-Up Planning

Recommended next specs:

1. Session and logout security policy.
2. Invite email delivery and recovery policy.
3. CLAiR internal operator recovery and audit policy.
