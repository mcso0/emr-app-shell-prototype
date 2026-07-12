---
id: PRODUCT-DOMAIN-MEMBERSHIP-ROLE-JOB-LIFECYCLE
type: Domain Contract
title: Membership, Permission Role, and Job Position Lifecycle
description: Defines the approved lifecycle, authorization, restoration, and history-preservation rules for hospital members, permission roles, job positions, and invitations.
status: approved
area: product
doc_type: domain-contract
related_work:
  - HOSPITAL-ADMIN-PR-004
tags:
  - hospital-admin
  - membership
  - permission-role
  - job-position
  - lifecycle
last_updated: 2026-07-11
---

# Membership, Permission Role, and Job Position Lifecycle

Updated: 2026-07-11

## Purpose

This document is the product source of truth for hospital member, permission-role, job-position, and invitation lifecycle behavior. It distinguishes temporary access suspension from an ended hospital relationship, preserves audit history, and prevents role-definition changes from creating permission gaps.

The approved product model uses domain-specific lifecycle rules rather than applying one generic delete model to every entity.

## Product Language

| Concept | User-facing term | Meaning |
| --- | --- | --- |
| Active membership | `활성` | The user may access the workspace according to the assigned permission role. |
| Inactive membership | `비활성` | Workspace access is disabled temporarily. The membership stays in the operational directory and may be reactivated. |
| Archived membership | `보관됨` | The hospital relationship ended, usually because of resignation or contract termination. The membership is hidden from the default directory but remains available for history and restoration. |
| Permission-role deactivation | `역할 비활성화` | The role cannot be assigned again. Existing non-archived references must move to a selected replacement role in the same transaction. |
| Job-position deactivation | `직무 비활성화` | The position cannot be newly assigned. Existing member history may retain the inactive position. |

The product must not label archived membership as `삭제됨` or the action as `구성원 삭제`. Technical implementations may use archive metadata, but the user-facing concept is relationship termination with preserved history.

## Lifecycle Model

| Entity | States | Permanent deletion in MVP |
| --- | --- | --- |
| Membership | `active`, `inactive`, `archived` | Not available |
| Permission role definition | `active`, `inactive` | Not available |
| Job position definition | `active`, `inactive` | Not available |
| Invitation | `pending`, `accepted`, `canceled`, `expired` | Not needed; cancellation preserves history |
| Platform user account | Separate identity lifecycle | Out of scope |

Hard delete, automatic deletion schedules, and a 90-day permanent-deletion review are not part of this MVP contract. A later legal, privacy, or retention policy may define account-level erasure without changing historical clinical or audit attribution silently.

## Membership State Transitions

| From | Action | To | Product rule |
| --- | --- | --- | --- |
| `active` | Deactivate | `inactive` | Access is disabled immediately; the member remains visible in the operational directory. |
| `inactive` | Reactivate | `active` | Permission role and job position must still be valid for activation. |
| `active` | Archive | `archived` | Access revocation and archival occur atomically. A reason is required. |
| `inactive` | Archive | `archived` | A reason is required. |
| `archived` | Restore | `inactive` | Restoration never grants immediate workspace access. |
| `archived` | Invite same email | `inactive` through restore | The product routes the operator to restoration instead of creating a duplicate membership. |

Repeated requests for the current state must not apply duplicate mutations. They return a conflict or current-state result that the UI can explain.

## Archived Membership Rules

* Archived members are excluded from the default member directory and workspace authentication membership checks.
* Archived members appear only in the `보관됨` tab and in audit/history views.
* The archive action requires an explicit reason.
* The membership keeps its historical permission-role and job-position references for display and audit.
* Restoration returns the membership to `inactive` and preserves archive/restore history.
* The operator must review the restored member's role and job position before separate activation.
* A matching email in the same workspace resolves to the existing archived membership. The system must not create a second membership for the same user/workspace relationship.

## Permission Role Lifecycle

Permission roles are authorization sources. Deactivation therefore requires a replacement plan rather than leaving active users with an invalid or missing role.

* Default system roles `소유자`, `관리자`, and `일반` cannot be deactivated or deleted in MVP.
* A custom role may be deactivated only with an active replacement role from the same workspace.
* Active and inactive memberships using the role move to the replacement role.
* Pending invitations using the role move to the replacement role.
* Archived memberships retain the historical role and are not rewritten.
* Role reassignment and role deactivation must occur in one transaction.
* Reactivating a role makes it selectable again but never restores prior assignments automatically.
* A custom role cannot be used as a replacement if it is inactive, belongs to another workspace, or exceeds the acting user's grant ceiling.

## Job Position Lifecycle

Job positions are display and filtering metadata, not authorization sources.

* Default and custom job positions may be deactivated, but they are not permanently deleted.
* Active and inactive members keep the existing position assignment after deactivation.
* The directory and member detail identify retained assignments as `비활성 직무`.
* Pending invitations cannot retain an inactive position. If pending invitations reference the position, an active replacement position is required during deactivation.
* Archived memberships retain the historical job position.
* Inactive positions are excluded from new invitation and member-edit selection lists.
* Reactivating a position makes it selectable again without changing existing assignments.

## Invitation Lifecycle

* Invitations carry one active permission role and one active job position.
* Pending invitations may be edited, resent, canceled, or expire.
* Accepted, canceled, and expired invitations remain historical records.
* Permission-role deactivation transactionally replaces the role on pending invitations.
* Job-position deactivation requires a replacement only when pending invitations reference that position.
* A pending invitation for an archived member's email must resolve to the restore flow before a new invitation is created.

## Authorization And Safety

| Actor | Allowed lifecycle scope |
| --- | --- |
| Owner | All non-self membership lifecycle operations, custom-role lifecycle, job-position lifecycle, and owner-safe reassignment. |
| Admin | Non-owner member lifecycle, custom-role lifecycle within the grant ceiling, and job-position lifecycle. |
| Authorized custom role | Non-owner actions explicitly allowed by `role_permission:manage`, within the same grant ceiling as admin delegation. |
| General member | No membership, role-definition, or job-definition lifecycle mutations. |

Mandatory safeguards:

* Self-deactivation and self-archival are blocked.
* An admin or delegated role manager cannot deactivate, archive, demote, or reassign an owner.
* The last active owner cannot be deactivated, archived, or moved away from the owner role.
* All targets and replacement definitions must belong to the same workspace.
* Client-side disabled states are explanatory only. The server and database boundary must enforce the same rules.
* Archived membership must never satisfy active-membership authorization or RLS helper checks.

## Directory And Detail UX Contract

The member directory provides `전체 / 초대 대기 / 비활성 / 보관됨` tabs with search and job-position/department filters.

State-specific actions:

| State | Actions |
| --- | --- |
| Active | `권한·직무 수정`, `비활성화`, `구성원 보관` |
| Inactive | `다시 활성화`, `구성원 보관` |
| Pending invitation | `초대 정보 수정`, `초대 재발송`, `초대 취소` |
| Archived | `정보 보기`, `구성원 복구` |

The archive confirmation dialog explains immediate access loss, removal from the default directory, preserved history, and restoration to inactive. It requires a reason.

The detail Sheet shows profile, organization data, role and job position, latest reliable login, and a chronological lifecycle history. Disabled actions remain visible when useful and explain self-action or last-owner protection.

Role and job-position deactivation dialogs show affected-member and pending-invitation counts before confirmation. Role deactivation requires a replacement role. Job-position deactivation requests a replacement position only when pending invitations require one.

## Product Data Requirements

Membership requires:

* `status`: `active`, `inactive`, or `archived`
* archive timestamp, actor, and required reason
* restore timestamp and actor
* one effective permission-role assignment
* one job-position assignment when the hospital requires it
* immutable or append-only lifecycle audit events

Role and job-position definitions require active/inactive state and deactivation metadata sufficient to identify the actor and time. Historical membership attribution must remain readable even after a definition is inactive.

## API Behavior Contract

* Default directory reads exclude archived memberships.
* `includeArchived=true` includes archived memberships for authorized management views.
* Membership activation/deactivation stays separate from archive/restore mutation.
* Archive input contains `action: "archive"` and a non-empty `reason`.
* Restore input contains `action: "restore"`; the result is always `inactive`.
* Permission-role deactivation requires `replacementRoleId`.
* Job-position deactivation requires `pendingInvitationReplacementPositionId` only when affected pending invitations exist.
* Responses distinguish unauthenticated, permission denied, cross-workspace, self-protected, last-owner-protected, invalid replacement, missing target, and state-conflict outcomes.

## Audit Contract

At minimum, audit events distinguish:

* `workspace.membership_deactivated`
* `workspace.membership_reactivated`
* `workspace.membership_archived`
* `workspace.membership_restored`
* `workspace.permission_role_deactivated`
* `workspace.permission_role_reactivated`
* `workspace.job_position_deactivated`
* `workspace.job_position_reactivated`

Events capture workspace, actor, target, reason when required, before/after state, replacement definition when relevant, request identifier, and timestamp.

## Compatibility And Rollout Contract

The repository may contain an earlier `soft_deleted` implementation draft. It is not the approved product language or final lifecycle contract.

* Do not rewrite a migration version already recorded in any environment's migration history.
* Add a forward migration that introduces `archived` behavior and can migrate any existing `soft_deleted` rows safely.
* Treat a legacy membership `pending` value as transition-only compatibility. New product writes use invitation `pending` and do not create a pending membership that could authorize workspace access.
* Keep legacy read compatibility for one rollout window when an environment may still return the earlier status or metadata.
* New writes use only the approved archive contract.
* Remove legacy state and columns only in a later migration after local and remote environment verification.
* Reconcile remote migration history before any remote schema push.
* Apply backward-compatible schema first, then server/API behavior, then UI terminology and actions.

## Out Of Scope

* Permanent membership deletion
* Platform user-account deletion or identity-provider deletion
* Automatic retention or purge scheduler
* Real email delivery, SCIM, SSO, or external HR integration
* Legal or compliance retention certification
* Bulk offboarding beyond role-replacement operations defined above

## Acceptance Criteria

* Users can distinguish temporary `비활성` from ended-relationship `보관됨` without deletion language.
* Archived members cannot access the workspace and do not appear in default directory reads.
* Restore returns archived membership to inactive and never grants access automatically.
* Same-workspace duplicate membership is prevented during rehire.
* Custom-role deactivation replaces all non-archived member and pending-invitation references atomically.
* Job-position deactivation preserves member history and replaces only affected pending invitations.
* Self-action, owner scope, last-owner, workspace boundary, and replacement validity are enforced by server and DB boundaries.
* Audit history explains every lifecycle mutation.
* Existing data remains readable through the compatibility rollout.
