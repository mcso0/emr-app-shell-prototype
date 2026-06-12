# Role Permission Detail Spec

Status: draft  
Updated: 2026-06-12

This document refines the product permission model from screen-level access into action-level permission groups. It should be read with [Workspace Auth and Permission Domain](../../domain/workspace-auth-permissions.md), [Role Screen Access Current State](../../current-state/role-screen-access-current-state.md), and [Workspace Access Guard Policy Spec](workspace-access-guard-policy-spec.md).

## Product Goal

CLAiR EMR needs a permission model that can explain and enforce what each role can view, create, edit, complete, approve, refund, delete, and administer. The current role matrix is screen-level; implementation needs action-level permission IDs later.

## Scope

In scope:

- MVP role permission groups.
- Action vocabulary.
- High-risk actions.
- Multi-role effective permission behavior.
- Permission explanation requirements.

Out of scope:

- Final permission ID naming in code.
- Server route implementation.
- DB/RLS policy SQL.
- Large-hospital custom permission builder.
- Separate billing-admin role.

## Action Vocabulary

| Action | Meaning |
| --- | --- |
| `view` | Read screen/data. |
| `create` | Add a new operational record. |
| `edit` | Modify an existing record. |
| `complete` | Mark operational work done. |
| `review` | Clinically or administratively review work. |
| `approve` | High-impact approval such as refund/adjustment. |
| `admin` | Configure workspace, members, roles, catalogs, or settings. |
| `deactivate` | Disable membership or record visibility where allowed. |
| `audit_view` | View audit/security history. |

## MVP Role Detail

| Area | Hospital admin | Vet | Technician | Front desk |
| --- | --- | --- | --- | --- |
| Home | view, admin | view | view | view |
| Reception/appointment | view, create, edit, admin | view | view | view, create, edit |
| Customer/patient | view, create, edit, admin | view, edit clinical context | view, edit support context | view, create, edit |
| Chart/SOAP/diagnosis | view, create, edit, admin | view, create, edit | view | view |
| Lab/imaging | view, create, edit, review, admin | view, create, edit, review | view, complete | view |
| Dispensing/treatment | view, create, edit, review, admin | view, create, edit, review | view, complete | view |
| Billing checkout | view, create, edit, admin | view | view support context | view, create, edit |
| Refund/adjustment approval | approve, admin | no | no | no |
| Hospital profile/settings | admin | no | no | no |
| Members/roles | admin | no | no | no |
| Audit log | audit_view, admin | no | no | no |

## Effective Permission Policy

- Users can have multiple roles.
- Effective permissions are additive.
- `hospital_admin` grants all workspace admin permissions.
- Do not introduce deny rules in MVP.
- Permission UI should explain access by assigned roles.

## High-Risk Actions

High-risk actions should require extra confirmation and may require recent-auth:

- hospital admin promotion
- hospital admin removal
- member deactivation
- refund/adjustment approval
- hospital profile legal/business changes
- catalog changes that affect billing
- audit-sensitive support recovery

## CLAiR Docs Viewer Placement

This spec should appear in CLAiR Docs under `Features`.

## Open Questions

- Should vets be able to edit patient demographic fields, or only clinical profile fields?
- Should technicians be able to create support records, or only complete assigned work?
- Should front desk be able to edit billing lines, or only perform checkout/payment state changes?
- Which catalog changes should require recent-auth or second confirmation?
