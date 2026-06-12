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
- supporting ticket or approval reference when available

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

## Open Questions

- What level of business/identity verification is required before CLAiR operator admin recovery?
- Should every CLAiR operator recovery require a ticket/reference ID in MVP?
- Should hospital admins receive an in-app notification after CLAiR operator recovery?
- Who at CLAiR is allowed to perform recovery in the earliest operating model?
