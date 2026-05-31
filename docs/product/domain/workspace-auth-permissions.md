# Workspace Auth and Permission Domain

Updated: 2026-05-27

This document is the product source of truth for workspace-based auth, membership, roles, and permission behavior. It captures the requirements from Linear `DEN-18` before implementation work begins.

## Product Goal

Hospital owners or hospital admins can subscribe to the EMR, create a workspace, invite employees, assign one or more roles, and control access by role. Users can edit their personal profile, but personal profile data is never an authorization source.

This is not a rewrite of the existing `/login` flow. Existing mock auth, Supabase adapter, and `tests/auth.spec.ts` remain the regression baseline.

## Terms

| Term | Meaning |
| --- | --- |
| Workspace | The hospital operating space behind `/w/[workspaceId]/...`. A workspace owns members, permissions, and EMR data scope. |
| Workspace creator | The first user who creates the workspace after subscribing or starting onboarding. The creator receives `hospital_admin` authority. |
| Hospital admin | A user with full workspace administration rights. This includes the creator while they retain the role. |
| Member | A user with an active membership in a workspace. |
| Invitation | A pending invite for an email address to join a workspace with preselected role(s). |
| Membership | The workspace-scoped relationship between user, status, role(s), department/title, and permission source. |
| Personal profile | User-editable display profile. It can include display name, initials/avatar, phone, and preferences, but not editable roles or permissions. |

## Canonical Roles

| Role ID | Label | Product meaning |
| --- | --- | --- |
| `hospital_admin` | 병원관리자 | Full workspace administration. The creator starts here. |
| `vet` | 수의사 | Clinical user with broad operational access, excluding hospital/admin settings. |
| `technician` | 테크니션 | Clinical support user. Can view charts but cannot mutate chart records. |
| `front_desk` | 데스크 | Reception/customer-facing user. Can view charts but cannot mutate chart records. |

Implementation notes:

- Current code uses `nurse` for the technician-like mock role. Future implementation should either rename to `technician` or add an explicit alias from `nurse` to `technician` before changing user-facing labels.
- Current code also has `billing_admin`. It is not part of the representative's requested canonical MVP role set. Billing privileges should be assigned through `hospital_admin`, `vet`, `technician`, or `front_desk` until a separate billing role is approved.

## Multi-Role Policy

Users may have more than one role in the same workspace.

Decision:

- Effective permissions are the additive union of all active roles.
- If `hospital_admin` is present, the user has full workspace/admin permissions.
- Do not introduce deny rules in MVP. Additive allow-only roles are easier to explain, test, and enforce.
- The permission resolver must return both assigned roles and effective permissions so admin UI can explain why a user has access.

Example:

| Assigned roles | Effective result |
| --- | --- |
| `vet` | Vet permissions only |
| `front_desk`, `technician` | Union of desk and technician permissions |
| `hospital_admin`, `vet` | Hospital admin permissions |

## Safety Rules

- Every active workspace must always have at least one active `hospital_admin`.
- The workspace creator must not accidentally lose all admin access unless another active hospital admin already exists and the action is explicit.
- Removing, deactivating, or demoting the last active hospital admin must be blocked.
- A user cannot self-grant admin rights from personal profile settings.
- Client UI gating is a convenience only. Security completion requires server-side checks and, later, DB/RLS enforcement.

## Permission Matrix

Legend:

- `View`: read-only access.
- `Edit`: create/update/complete/issue access where the module supports it.
- `Admin`: settings, member, or permission management.
- `No`: no intended access.

| Area | Hospital admin | Vet | Technician | Front desk |
| --- | --- | --- | --- | --- |
| Home/work dashboard | View/Edit/Admin | View/Edit | View/Edit | View/Edit |
| Reception/appointment | View/Edit/Admin | View | View | View/Edit |
| Customer/patient profile | View/Edit/Admin | View/Edit | View/Edit | View/Edit |
| Chart/medical record | View/Edit/Admin | View/Edit | View only | View only |
| Diagnosis/SOAP mutation | View/Edit/Admin | View/Edit | No | No |
| Order request/update | View/Edit/Admin | View/Edit | View/complete assigned work | View |
| Lab/imaging | View/Edit/Admin | View/Edit/review | View/Edit/complete | View |
| Dispensing/treatment | View/Edit/Admin | View/Edit | View/Edit/complete | View |
| Billing/payment | View/Edit/Admin | View | View/Edit support actions | View/Edit front-desk actions |
| Inpatient | View/Edit/Admin | View/Edit | View/Edit/complete care tasks | View |
| Service catalog | View/Edit/Admin | View | View | View |
| Hospital settings | Admin | No | No | No |
| Member/admin settings | Admin | No | No | No |
| Role/permission settings | Admin | No | No | No |
| Personal profile | Own profile edit | Own profile edit | Own profile edit | Own profile edit |

Open product detail for later implementation:

- Billing actions need a separate exact matrix before live payment integration. MVP may allow front desk billing actions, but refund approval should remain hospital admin only.
- Technician treatment/lab/imaging mutation means operational completion/status work, not chart diagnosis/SOAP authoring.
- Vet access to billing is view-only unless a later product decision grants billing mutation.
- DEN-301 phase-1 policy: treatment fulfillment and dispensing fulfillment intentionally share the same permission boundary. A user with `dispensing:view` and `dispensing:complete` can read and complete both dispensing and treatment queue work in phase 1.
- 마약류 are explicitly out of the phase-1 shared treatment/dispensing policy. Narcotic or controlled-substance workflows require a separate security and permission scope later, expected to be veterinarian-only or limited to users with explicit controlled-substance authority.

## Invitation and Membership Requirements

- Hospital admins can invite staff by email.
- Invitations should carry one or more roles selected at invite time.
- Membership states should include at least `pending`, `active`, and `inactive`.
- Pending invitations can be resent or canceled.
- Duplicate active memberships in the same workspace are not allowed.
- Duplicate pending invitations for the same email/workspace should be blocked or resolved by resend.
- Real email delivery, public invite links, SSO/SCIM, and domain auto-join are out of MVP scope unless separately approved.

## Personal Profile Requirements

Users can edit personal profile fields such as:

- display name
- initials/avatar placeholder
- phone
- notification preference placeholder, if useful

Users cannot edit these from personal profile:

- workspace role(s)
- permissions
- membership status
- billing/subscription authority

## Implementation Gates

The following require separate explicit scope before implementation:

- live Supabase project validation
- migration SQL
- RLS policy SQL
- broad backend conversion
- real subscription/payment provider integration
- real email invite delivery
- OAuth, MFA, password reset, email identity change, SSO/SCIM

## External Product References

- Slack separates role types and permissions, with owners/admins controlling administration and invitation behavior.
- Linear uses workspace roles, member suspension, invitations, and team/workspace admin boundaries.
- Google Workspace supports delegated admin roles with different privilege sets.
- Supabase docs require authorization to avoid user-editable metadata and recommend RLS/server-side controls for protected data.
