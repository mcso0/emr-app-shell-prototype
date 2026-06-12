# CLAiR Internal Operator Recovery Audit Policy Spec

Status: draft  
Updated: 2026-06-12

This document defines the product policy for CLAiR-side operator recovery actions, support intervention, and audit expectations. It should be read with [Member Role Management Spec](member-role-management-spec.md), [Invite Email Delivery Recovery Policy Spec](invite-email-delivery-recovery-policy-spec.md), and [Workspace Auth and Permission Domain](../../domain/workspace-auth-permissions.md).

## Product Goal

CLAiR EMR needs a safe internal recovery path for cases a hospital cannot solve alone, such as first-admin invite failure, last-admin lockout, wrong-email first-admin invite, or support-assisted workspace access recovery. This authority must be separate from customer-facing `hospital_admin`.

## Scope

In scope:

- CLAiR internal operator authority boundaries.
- First hospital admin invite recovery.
- Last-admin lockout recovery.
- Wrong-email invite recovery.
- Inactive or inaccessible admin recovery.
- Required audit events and review trail.
- Customer-facing communication expectations.

Out of scope:

- Full internal operator console UI.
- Live support workflow staffing, SLA, or pricing.
- DB schema, RLS, migration, and server/API implementation.
- Production launch or public access.
- Real customer data operations.

## Baseline Policy

- CLAiR internal operator is a separate authority, not a hospital workspace member role.
- CLAiR operator recovery should be rare, traceable, and reason-backed.
- Operator actions must not bypass audit requirements.
- Customer-facing hospital admins cannot grant themselves CLAiR operator authority.
- Recovery should prefer restoring a valid hospital admin path over directly changing clinical or billing records.
- Operator access should never become a general hidden backdoor for routine hospital operations.
- Earliest MVP operator recovery is limited to approved CLAiR operations/admin-support staff.
- Before admin recovery, CLAiR should verify the hospital owner email, business registration information, and a phone call through the hospital representative number or existing registered contact.
- MVP does not require an external support ticket ID, but every recovery must create an internal `operator_recovery_log_id`.

## Allowed Recovery Cases

| Case | Preferred recovery |
| --- | --- |
| First admin invite expired | CLAiR operator resends/regenerates first-admin invite. |
| First admin invite sent to wrong email | CLAiR operator cancels bad invite and creates a corrected invite. |
| All admins inactive or inaccessible | CLAiR operator restores one verified admin path after identity/business verification. |
| Last-admin demotion/deactivation blocked | Hospital admin should promote another admin first; CLAiR operator only intervenes if no admin can act. |
| Support confirms ownership transfer | CLAiR operator can start a controlled admin transfer workflow after separate verification. |

## Not Allowed Without Separate Approval

- Editing clinical records.
- Editing billing/payment records.
- Viewing or exporting real patient/guardian/payment data outside support scope.
- Disabling audit logs.
- Bypassing production security gates.
- Applying remote Supabase migrations or RLS changes.

## Audit Requirements

Operator recovery actions should record:

- operator identity
- workspace
- target invite/member/admin
- action type
- reason category
- before/after state
- timestamp
- internal `operator_recovery_log_id`
- supporting ticket or approval reference when available
- verification method used: owner email, business information, and phone confirmation

Required audit events:

- first-admin invite resend
- first-admin invite cancellation
- admin recovery
- admin transfer
- operator-initiated member reactivation or role correction
- rejected or blocked recovery attempt when useful for security review

## Customer Communication

When recovery affects workspace access:

- Hospital contact should know what changed.
- The product should avoid exposing internal-only details.
- Recovery completion should direct the hospital admin to verify members and roles.
- If a wrong-email invite was canceled, the corrected invite should make the invited email explicit.

## CLAiR Docs Viewer Placement

This spec should appear in CLAiR Docs under `Features`.

## MVP Decisions

- Admin recovery verification requires hospital owner email confirmation, business information confirmation, and phone confirmation.
- The phone check should use the hospital representative number or an existing registered representative contact.
- External ticket/reference ID is not required in MVP.
- The system should automatically create an internal `operator_recovery_log_id`.
- Hospital admins should be notified after operator recovery when the recovery affects workspace access.
- Operator recovery is limited to approved CLAiR operations/admin-support staff in the earliest model.
