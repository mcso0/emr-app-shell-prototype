---
id: PRODUCT-DOMAIN-WORKSPACE-AUTH-PERMISSIONS
type: Domain Contract
title: "Workspace Auth and Permission Domain"
description: "Defines workspace-based auth, membership, roles, permission behavior, and profile authorization boundaries."
status: approved
area: product
doc_type: domain-contract
tags: [domain, workspace-auth, roles, permissions, onboarding]
related_work:
  - DEN-18
supersedes: []
superseded_by: []
last_updated: 2026-06-12
---

# Workspace Auth and Permission Domain

Updated: 2026-06-12

This document is the product source of truth for workspace-based auth, membership, roles, and permission behavior. It captures the requirements from Linear `DEN-18` before implementation work begins.

## Product Goal

Hospital owners or hospital admins enter a CLAiR-created hospital workspace, invite employees, assign one or more roles, and control access by role. Users can edit their personal profile, but personal profile data is never an authorization source.

This is not a rewrite of the existing `/login` flow. Existing mock auth, Supabase adapter, and `tests/auth.spec.ts` remain the regression baseline.

## Product Login And Onboarding Baseline

CLAiR EMR is a B2B workspace product. Users do not freely self-register into a new hospital workspace.

Baseline:

- CLAiR operations creates the hospital workspace after sales/implementation agreement.
- CLAiR sends the first hospital owner or hospital admin an invitation link by email.
- The first hospital admin accepts the invitation, creates or signs into an account, and enters the workspace.
- Initial onboarding should help confirm or complete the workspace hospital profile defined in [Workspace Hospital Profile](workspace-hospital-profile.md).
- Hospital admins invite additional staff by email from inside the workspace.
- Invited staff can create or connect their account only through the workspace invitation flow.
- Returning users sign in with email and password.
- Session persistence and automatic sign-in should be defined as an explicit security/session policy before production use.

Product planning excludes demo-only mock role selection from the real login experience. Mock roles and mock data belong in demo/development documentation, not the product login PRD.

## Terms

| Term | Meaning |
| --- | --- |
| Workspace | The hospital operating space behind `/w/[workspaceId]/...`. A workspace owns members, permissions, and EMR data scope. |
| Workspace creator | CLAiR operations or an approved implementation operator that creates the hospital workspace after sales/implementation agreement. |
| First hospital admin | The first hospital owner or admin invited into the workspace. This user receives `hospital_admin` authority. |
| Hospital admin | A user with full workspace administration rights. This includes the creator while they retain the role. |
| Member | A user with an active membership in a workspace. |
| Invitation | A pending invite for an email address to join a workspace with preselected role(s). |
| Membership | The workspace-scoped relationship between user, status, role(s), department/title, and permission source. |
| Personal profile | User-editable display profile. It can include display name, initials/avatar, phone, and preferences, but not editable roles or permissions. |

## Canonical Roles

| Role ID | Label | Product meaning |
| --- | --- | --- |
| `hospital_admin` | 병원관리자 | Full workspace administration. The first hospital admin starts here. |
| `vet` | 수의사 | Clinical user with broad operational access, excluding hospital/admin settings. |
| `technician` | 테크니션 | Clinical support user. Can view charts but cannot mutate chart records. |
| `front_desk` | 데스크 | Reception/customer-facing user. Can view charts but cannot mutate chart records. |

Implementation notes:

- Current code uses `nurse` for the technician-like mock role. Future implementation should either rename to `technician` or add an explicit alias from `nurse` to `technician` before changing user-facing labels.
- Current code also has `billing_admin`. It is not part of the canonical MVP role set. Billing authority should be assigned through `hospital_admin` or the `front_desk` reception/billing permission area until a separate billing role is approved for larger hospital teams.
- `front_desk` is the phase-1 role for reception, appointment, customer-facing work, and billing/front-office actions. Do not model "수납 관리자" as a separate canonical role in MVP.

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

## Permission Matrix V1

Legend:

- `View`: read-only access.
- `Create/Edit`: create or update access where the module supports it.
- `Complete`: operational completion/status update access.
- `Admin`: settings, member, or permission management.
- `No`: no intended access.

| Screen / area | Hospital admin | Vet | Technician | Front desk |
| --- | --- | --- | --- | --- |
| Home / 원내 현황 | View / Admin | View | View | View |
| Reception / 접수 | View / Create/Edit / Admin | View | View | View / Create/Edit |
| Appointment / 예약 | View / Create/Edit / Admin | View | View | View / Create/Edit |
| Customer / 보호자 관리 | View / Create/Edit / Admin | View | View / Create/Edit support | View / Create/Edit |
| Patient / 환자 관리 | View / Create/Edit / Admin | View / Create/Edit clinical profile | View / Create/Edit support | View / Create/Edit front-desk profile |
| Chart / 진료 차트 | View / Create/Edit / Admin | View / Create/Edit | View | View |
| SOAP / diagnosis | View / Create/Edit / Admin | View / Create/Edit | No | No |
| Order request | View / Create/Edit / Admin | View / Create/Edit | View | View |
| Lab / 임상병리 검사 | View / Create/Edit / Admin | View / Create/Edit / Review | View / Complete | View |
| Imaging / 영상 검사 | View / Create/Edit / Admin | View / Create/Edit / Review | View / Complete | View |
| Dispensing / 조제 | View / Create/Edit / Admin | View / Create/Edit / Review | View / Complete | View |
| Treatment fulfillment / 처치 | View / Create/Edit / Admin | View / Create/Edit / Review | View / Complete | View |
| Billing / 수납 | View / Create/Edit / Admin | View | View support context | View / Create/Edit front-desk checkout |
| Billing refund/adjustment approval | Admin | No | No | No |
| Inpatient / 입원 | View / Create/Edit / Admin | View / Create/Edit | View / Complete care tasks | View |
| Hospital profile / 병원 기본정보 | Admin | No | No | No |
| Order catalog / 병원관리 Order 관리 | Admin | View | View | View |
| Member invitation / 구성원 초대 | Admin | No | No | No |
| Member role/status management | Admin | No | No | No |
| Audit log / 감사 로그 | Admin | No | No | No |
| Personal profile | Own profile edit | Own profile edit | Own profile edit | Own profile edit |

Open product detail for later implementation:

- Billing front-desk checkout means reception/payment desk actions. Refund approval, destructive adjustment, settlement, accounting, and provider payment integrations require separate scope.
- Technician treatment/lab/imaging mutation means operational completion/status work, not chart diagnosis/SOAP authoring or final clinical approval.
- Vet access to billing is view-only unless a later product decision grants billing mutation.
- Hospital admin can configure and administer modules, but final clinical authorship/approval should still be represented clearly in audit trails.
- `billing_admin` / `수납 관리자` is not a canonical MVP role. It may become a later large-hospital extension only after a separate product decision.
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
