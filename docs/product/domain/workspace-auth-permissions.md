---
id: PRODUCT-DOMAIN-WORKSPACE-AUTH-PERMISSIONS
type: Domain Contract
title: Workspace Auth and Permission Domain
status: approved
area: product
doc_type: domain-contract
related_work:
  - DEN-18
  - AUTH-PR-044
  - CHART-PR-015
supersedes: []
superseded_by: []
last_updated: 2026-07-20T00:00:00.000Z
description: >-
  Defines workspace-based auth, membership, roles, permission behavior, and
  profile authorization boundaries.
tags:
  - domain
  - workspace-auth
  - roles
  - permissions
  - onboarding
---

# Workspace Auth and Permissions

Updated: 2026-07-20

This document is the product source of truth for workspace-based auth, membership, roles, and permission behavior. It captures the requirements from Linear `DEN-18` before implementation work begins.

## Product Goal

Hospital owners or workspace admins enter a CLAiR-created hospital workspace, invite employees, assign a permission role and a job position, and control access by work permission. Users can edit their personal profile, but personal profile data is never an authorization source.

This is not a rewrite of the existing `/login` flow. Existing mock auth, Supabase adapter, and `tests/auth.spec.ts` remain the regression baseline.

## Product Login And Onboarding Baseline

CLAiR EMR is a B2B workspace product. Users do not freely self-register into a new hospital workspace.

Baseline:

* CLAiR operations creates the hospital workspace after sales/implementation agreement.
* CLAiR sends the first workspace owner or workspace admin an invitation link by email.
* The first workspace owner accepts the invitation, creates or signs into an account, and enters the workspace.
* Initial onboarding should help confirm or complete the workspace hospital profile defined in [Workspace Hospital Profile](https://github.com/mcso0/emr-app-shell-prototype/blob/main/docs/product/domain/workspace-hospital-profile.md).
* Workspace owners and authorized admins invite additional staff by email from inside the workspace.
* Invited staff can create or connect their account only through the workspace invitation flow.
* Returning users sign in with email and password.
* Session persistence and automatic sign-in should be defined as an explicit security/session policy before production use.

Product planning excludes demo-only mock role selection from the real login experience. Mock roles and mock data belong in demo/development documentation, not the product login PRD.

## Terms

| Term                    | Meaning                                                                                                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace               | The hospital operating space behind `/w/[workspaceId]/...`. A workspace owns members, permissions, and EMR data scope.                                                                                                        |
| Workspace creator       | CLAiR operations or an approved implementation operator that creates the hospital workspace after sales/implementation agreement.                                                                                             |
| Workspace owner / 소유자   | The protected workspace authority. Owners can transfer ownership and access owner-only workspace, contract, billing, and dangerous data operations. At least one active owner must remain.                                    |
| Workspace admin / 관리자   | A high-permission workspace operator. Admins can manage most hospital operations and member settings, but cannot delete the workspace, transfer ownership, change billing/contract authority, or run dangerous data deletion. |
| Permission role / 권한 역할 | A workspace-scoped authorization role that answers "what can this person do?" Permission roles are separate from job positions.                                                                                               |
| Job position / 직무       | A workspace-scoped display/filter field that answers "what is this person's clinic job?" It is not a general authorization source; the approved clinical `vital:write` eligibility check is the explicit exception. |
| Member                  | A user with an active membership in a workspace.                                                                                                                                                                              |
| Invitation              | A pending invite for an email address to join a workspace with a preselected permission role and job position.                                                                                                                |
| Membership              | The workspace-scoped relationship between user, status, permission role assignment, job position, and permission source.                                                                                                      |
| Personal profile        | User-editable display profile. It can include display name, initials/avatar, phone, and preferences, but not editable roles or permissions.                                                                                   |

## Permission Roles

Permission roles are the authorization source. User-facing labels are Korean; implementation IDs may stay English where useful.

| Permission role | Product meaning                                                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `소유자`           | Protected owner authority. Includes owner-only operations such as workspace deletion, ownership transfer, billing/contract authority, and dangerous data deletion.          |
| `관리자`           | Broad hospital workspace management and operation authority. Includes chart writing by default, but excludes owner-only authority.                                          |
| `일반`            | Default operational member role for clinic staff who need broad day-to-day access but not member/role/owner administration.                                                 |
| `커스텀 역할`        | Hospital-defined role with an allow-only permission set selected from the approved permission catalog. Custom roles cannot grant owner-only powers or bypass safety guards. |

MVP excludes `게스트`. Guest-style limited read access can be reconsidered later only with a separate privacy and chart-scope design.

## Job Positions

Job positions are display/filter metadata, not general permission sources.

Default MVP job positions:

* `병원장`
* `수의사`
* `테크니션`
* `데스크`

Hospitals can add custom job positions. `CS`, `마케터`, `디자이너`, and similar non-default positions must be created as custom positions by the hospital; they are not default CLAiR job positions.

Product rule:

* `병원장` is a job position.
* `소유자` is a permission role.
* Many hospitals may assign both to the same person, but the system must not assume they are identical.
* `수의사`, `테크니션`, and `데스크` are job positions. The actual authorization question is whether the user's permission role allows chart writing, order mutation, billing processing, role management, or other work actions.

### Clinical Vital Write Exception

`vital:write` is a clinical permission for entering or revising the selected waiting encounter's today vital values. It requires both an active effective `vital:write` permission and active clinical eligibility as `수의사` or `테크니션`. This is intentionally narrower than general chart writing; `데스크`, owner, or admin titles alone do not authorize vital entry. The server enforces the conjunction and accepts the legacy `vet`/`technician` membership strings only while the job-position migration remains in compatibility mode.

## Permission Role Policy

Users have one effective permission role assignment for MVP. Custom roles are workspace-scoped and allow-only. The permission resolver must return assigned permission role, job position, effective permissions, and owner/admin safety flags so admin UI can explain why a user has access.

Compatibility rule:

* Existing legacy role arrays (`hospital_admin`, `vet`, `technician`, `front_desk`) must be preserved during the additive migration and mapped into the new permission-role model through backfill or dual-read adapters.
* Legacy role strings must not become arbitrary custom roles automatically.
* `nurse` remains a compatibility alias for `technician`-like legacy data only.
* `billing_admin` remains non-canonical and must not be reintroduced as a default role.

## Safety Rules

* Every active workspace must always have at least one active `소유자`.
* The workspace creator must not accidentally lose all owner authority unless another active owner already exists and the action is explicit.
* Removing, deactivating, demoting, editing away, or deleting the last active owner authority must be blocked.
* A user cannot self-grant owner/admin rights from personal profile settings.
* A custom role manager cannot use custom-role editing to grant owner-only permissions, wildcard permissions, or cross-workspace access.
* Client UI gating is a convenience only. Security completion requires server-side checks and, later, DB/RLS enforcement.

## Permission Matrix V2

Legend:

* `View`: read-only access.
* `Create/Edit`: create or update access where the module supports it.
* `Complete`: operational completion/status update access.
* `Admin`: settings, member, or permission management.
* `No`: no intended access.
* `Owner`: owner-only authority.

| Screen / area                           | 소유자                                                       | 관리자                          | 일반                            | 커스텀 역할                                              |
| --------------------------------------- | --------------------------------------------------------- | ---------------------------- | ----------------------------- | --------------------------------------------------- |
| Home / 원내 현황                            | View / Admin / Owner                                      | View / Admin                 | View                          | Configured                                          |
| Reception / 접수                          | View / Create/Edit / Admin                                | View / Create/Edit / Admin   | View / Create/Edit            | Configured                                          |
| Appointment / 예약                        | View / Create/Edit / Admin                                | View / Create/Edit / Admin   | View / Create/Edit            | Configured                                          |
| Customer / 보호자 관리                       | View / Create/Edit / Admin                                | View / Create/Edit / Admin   | View                          | Configured                                          |
| Patient / 환자 관리                         | View / Create/Edit / Admin                                | View / Create/Edit / Admin   | View                          | Configured                                          |
| Chart / 진료 차트                           | View / Create/Edit / Admin                                | View / Create/Edit / Admin   | View / Create/Edit            | Configured                                          |
| Waiting-chart today vital entry             | `vital:write` + veterinarian/technician eligibility      | `vital:write` + veterinarian/technician eligibility | `vital:write` + veterinarian/technician eligibility | Same clinical eligibility required                 |
| SOAP / diagnosis                        | View / Create/Edit / Admin                                | View / Create/Edit / Admin   | View / Create/Edit            | Configured                                          |
| Order request/status                    | View / Create/Edit / Admin                                | View / Create/Edit / Admin   | View / Create/Edit / Complete | Configured                                          |
| Lab / 임상병리 검사                           | View / Create/Edit / Admin                                | View / Create/Edit / Admin   | View / Create/Edit / Complete | Configured                                          |
| Imaging / 영상 검사                         | View / Create/Edit / Admin                                | View / Create/Edit / Admin   | View / Create/Edit / Complete | Configured                                          |
| Dispensing / 조제                         | View / Create/Edit / Admin                                | View / Create/Edit / Admin   | View / Complete               | Configured                                          |
| Treatment fulfillment / 처치              | View / Create/Edit / Admin                                | View / Create/Edit / Admin   | View / Create/Edit / Complete | Configured                                          |
| Billing / 수납                            | View / Create/Edit / Admin / Owner for contract authority | View / Create/Edit / Admin   | View / Create/Edit            | Configured                                          |
| Billing refund/adjustment approval      | Owner / Admin by approved permission                      | Admin by approved permission | No                            | Configured, excluding owner-only powers             |
| Inpatient / 입원                          | View / Create/Edit / Admin                                | View / Create/Edit / Admin   | View / Create/Edit / Complete | Configured                                          |
| Hospital profile / 병원 기본정보              | Owner / Admin                                             | Admin                        | No                            | Configured                                          |
| Order catalog / 병원관리 Order 관리           | Owner / Admin                                             | Admin                        | View                          | Configured                                          |
| Member invitation / 구성원 초대              | Owner / Admin                                             | Admin                        | No                            | Configured if role-management permission is granted |
| Member role/status management           | Owner / Admin                                             | Admin                        | No                            | Configured if role-management permission is granted |
| Custom role management                  | Owner / Admin with grant ceiling                          | Admin with grant ceiling     | No                            | No self-escalation                                  |
| Audit log / 감사 로그                       | Owner / Admin                                             | Admin                        | No                            | Configured                                          |
| Workspace deletion / ownership transfer | Owner                                                     | No                           | No                            | No                                                  |
| Billing/contract authority              | Owner                                                     | No by default                | No                            | No                                                  |
| Dangerous data deletion                 | Owner / separately approved ops                           | No by default                | No                            | No                                                  |
| Personal profile                        | Own profile edit                                          | Own profile edit             | Own profile edit              | Own profile edit                                    |

Open product detail for later implementation:

* Billing processing means reception/payment desk actions. Refund approval, destructive adjustment, settlement, accounting, and provider payment integrations require separate scope.
* Admin can configure and administer modules, and can write charts by default, but final clinical authorship/approval should still be represented clearly in audit trails.
* `billing_admin` / `수납 관리자` is not a canonical MVP role. It may become a later custom role or large-hospital extension only after a separate product decision.
* DEN-301 phase-1 policy: treatment fulfillment and dispensing fulfillment intentionally share the same permission boundary. A user with `dispensing:view` and `dispensing:complete` can read and complete both dispensing and treatment queue work in phase 1.
* 마약류 are explicitly out of the phase-1 shared treatment/dispensing policy. Narcotic or controlled-substance workflows require a separate security and permission scope later, expected to be veterinarian-only or limited to users with explicit controlled-substance authority.

## Invitation and Membership Requirements

* Owners and authorized admins can invite staff by email.
* Invitations should carry one permission role and one job position selected at invite time.
* Invitations can use default job positions or a hospital-created custom job position.
* Invitations can use default permission roles or a hospital-created custom permission role when the inviter has permission to assign it.
* Membership states are `active`, `inactive`, and `archived`; invitation status owns the pre-membership `pending` state.
* `inactive` means workspace access is disabled while the membership record remains operationally visible and can be reactivated.
* `archived` means workspace access is disabled and an ended hospital relationship is excluded from the default directory while its history remains available in the `보관됨` tab.
* Restoring an archived membership must return it to `inactive`, never directly to active access.
* Archival requires a reason, must be server-authorized, and must not be available for the acting user's own membership or the last active owner.
* Permanent membership deletion, an automatic purge schedule, and platform user-account removal require separate approval and scope.
* Pending invitations can be resent or canceled.
* Duplicate active memberships in the same workspace are not allowed.
* Duplicate pending invitations for the same email/workspace should be blocked or resolved by resend.
* Real email delivery, public invite links, SSO/SCIM, and domain auto-join are out of MVP scope unless separately approved.

The detailed state transitions, role replacement, job-position deactivation, rehire, authorization, audit, and compatibility rules are defined in [Membership, Permission Role, and Job Position Lifecycle](membership-role-job-lifecycle.md).

## Personal Profile Requirements

Users can edit personal profile fields such as:

* display name
* initials/avatar placeholder
* phone
* notification preference placeholder, if useful
* workspace-scoped status message; active colleagues may read it, but only the
  owning member may edit it

Users cannot edit these from personal profile:

* workspace permission role(s)
* job position assignment
* permissions
* membership status
* billing/subscription authority

## Implementation Gates

The following require separate explicit scope before implementation:

* live Supabase project validation
* broad backend conversion
* real subscription/payment provider integration
* real email invite delivery
* OAuth, MFA, password reset, email identity change, SSO/SCIM
* production/staging data mutation or remote Supabase migration push

## External Product References

* Slack separates role types and permissions, with owners/admins controlling administration and invitation behavior.
* Linear uses workspace roles, member suspension, invitations, and team/workspace admin boundaries.
* Google Workspace supports delegated admin roles with different privilege sets.
* Supabase docs require authorization to avoid user-editable metadata and recommend RLS/server-side controls for protected data.
