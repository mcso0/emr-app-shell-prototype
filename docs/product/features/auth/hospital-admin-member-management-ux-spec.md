# Hospital Admin Member Management UX Spec

Status: draft  
Updated: 2026-06-12

This document defines the product UX target for the hospital-admin member management surface. It should be read with [Member Role Management Spec](member-role-management-spec.md), [Invite Email Delivery Recovery Policy Spec](invite-email-delivery-recovery-policy-spec.md), and [Role Permission Detail Spec](role-permission-detail-spec.md).

## Product Goal

Hospital admins should be able to understand who has access, invite staff, assign roles, resend or cancel pending invites, deactivate members, and protect the last admin without needing to understand implementation details.

## Scope

In scope:

- Member list structure.
- Invite flow UX.
- Pending invite management.
- Role edit UX.
- Deactivation UX.
- Last-admin protection UX.
- Audit affordances.

Out of scope:

- Final visual design.
- Table component implementation.
- Live email provider integration.
- Server/API implementation.
- Custom enterprise role builder.

## Main Surfaces

| Surface | Purpose |
| --- | --- |
| Members list | Show active/inactive members and key admin fields. |
| Pending invites section | Show invites that need action or may expire, separate from the member table. |
| Invite staff form | Create a pending invitation with roles and staff metadata. |
| Member detail/edit drawer | Edit roles, department, title, status, and review safety warnings. |
| Audit/history link | Give admins traceability for sensitive changes. |

## List Fields

Member list should show:

- name
- email
- phone number when available
- roles
- department
- title
- status
- invited at
- last accessed at

Pending invite list should show:

- invited email
- selected roles
- department/title if entered
- invite status
- invited at
- expiry indication
- resend/cancel actions

## Key UX Rules

- Use canonical roles only: `hospital_admin`, `vet`, `technician`, `front_desk`.
- Do not expose demo-only `nurse` or `billing_admin` as product roles.
- Role changes should explain effective permission impact.
- Role editing should use visible role chips with a popover role picker.
- Last-admin blocking should be explicit and actionable.
- Deactivation should say workspace access is disabled, not account deleted.
- Deactivation requires a reason.
- Pending invite cancellation should warn that the link cannot be reused.
- Last accessed at should be visible for staff in MVP when available.

## Core Flows

### Invite Staff

1. Admin clicks invite.
2. Admin enters email, optional name/phone, department, title.
3. Admin selects one or more roles.
4. Admin confirms.
5. Pending invite appears in the invite list.

### Edit Roles

1. Admin opens member detail.
2. Admin changes roles.
3. System shows safety warning for admin role changes.
4. Save creates audit event.

### Deactivate Member

1. Admin opens active member.
2. Admin chooses deactivate.
3. System blocks if this is the last active hospital admin.
4. Otherwise membership becomes inactive.

## CLAiR Docs Viewer Placement

This spec should appear in CLAiR Docs under `Features`.

## MVP Decisions

- Pending invites should appear in a separate section from active/inactive members.
- Role editing should use role chips plus a popover role picker.
- Member deactivation requires a reason field.
- Admins should see last accessed at for staff when available.
