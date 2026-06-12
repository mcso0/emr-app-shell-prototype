# Hospital Profile Onboarding Spec

Status: draft  
Updated: 2026-06-12

This document defines the product target for first hospital admin onboarding and `병원관리 > 병원기본설정` hospital profile management. It should be read with [Workspace Hospital Profile](../../domain/workspace-hospital-profile.md), [Login Invite Onboarding Spec](../auth/login-invite-onboarding-spec.md), and [Workspace Auth and Permission Domain](../../domain/workspace-auth-permissions.md).

## Product Goal

CLAiR EMR should let the first hospital admin confirm the hospital's basic profile during onboarding and later maintain the same information from hospital settings. The hospital profile belongs to the workspace, not to a personal user profile.

## Scope

In scope:

- First hospital admin hospital profile confirmation during onboarding.
- Hospital profile edit/read behavior under `병원관리 > 병원기본설정`.
- Required and optional field groups for phase 1.
- CLAiR-operator-prefilled data review and correction.
- Hospital-admin-only edit authority.
- Basic validation and save states.

Out of scope:

- Referral workflow and referral account creation.
- Public marketing page or public hospital landing page.
- Logo/image upload storage implementation.
- DB schema, migration, RLS, and API implementation details.
- Real hospital data import.
- External provider integrations.

## Users

| User | Need |
| --- | --- |
| First hospital admin | Confirm the workspace is set up with the correct hospital identity and contact information before operational use. |
| Hospital admin | Update hospital profile and operational settings later from hospital management. |
| CLAiR operator | Prefill known hospital information during implementation so hospital admins only need to verify or complete missing values. |
| Staff user | Read consistent hospital identity and contact context where needed, but not edit it. |

## Entry Points

| Entry point | Purpose |
| --- | --- |
| First admin onboarding | Confirm or complete hospital profile after first invite acceptance. |
| `병원관리 > 병원기본설정` | Edit and review hospital profile after onboarding. |
| Future CLAiR operator workspace setup | Prefill hospital profile before first admin invite. |

## Field Requirements

| Group | Field | Phase 1 requirement | Notes |
| --- | --- | --- | --- |
| Identity | Hospital name | Required | Primary workspace-facing hospital name. |
| Identity | Workspace ID | Required | Stable workspace identifier. Usually not edited by hospital admin after setup. |
| Location | Hospital address | Required | Address parts can be implementation-specific later. |
| Brand | Symbol | Optional | Recommended for app identity and documents. |
| Brand | Logo | Optional | Recommended for app identity and documents. |
| Contact | Representative phone number | Required | Main customer-facing hospital number. |
| Contact | Representative contact number | Required | Operational contact number; may match representative phone. |
| Contact | Fax number | Optional | Keep optional because not every hospital uses fax actively. |
| Representative | Owner/director or business representative name | Required | Label can vary by legal/business setup. |
| Business | Business registration number | Required when legal/business setup is in scope | Validation format can be defined later. |
| Public links | Hospital URL/homepage | Optional | Allow blank. |
| Public links | Instagram and other social/profile URLs | Optional | Multiple links can be supported later. |
| Operations | Operating hours | Required | Needed for scheduling and customer-facing context. |
| Operations | Basic operational settings | Required where used by current workflows | Exact subfields should be split into follow-up specs when needed. |

## First Admin Onboarding Flow

1. First hospital admin accepts the invite and enters onboarding.
2. System loads CLAiR-prefilled workspace hospital profile values when available.
3. System highlights missing required fields.
4. Admin reviews and edits hospital identity, contact, representative, business, public-link, and operating-hour fields.
5. Admin saves the profile.
6. System confirms save success and opens the workspace.

Acceptance criteria:

- Onboarding cannot silently skip missing required fields.
- Saved values update the workspace hospital profile, not the personal profile.
- Only `hospital_admin` can edit these values.
- Non-admin users should not see edit controls for hospital profile.
- The flow must not expose real hospital data in demo fixtures or docs.

## Hospital Settings Flow

1. Hospital admin opens `병원관리 > 병원기본설정`.
2. System shows current hospital profile values.
3. Admin edits allowed fields.
4. System validates required fields and URL/contact formats where applicable.
5. Admin saves.
6. System shows success, failure, and unsaved-change states.

Acceptance criteria:

- `hospital_admin` can view and edit.
- `vet`, `technician`, and `front_desk` cannot edit.
- Workspace ID is visible but should be protected from casual edits after setup.
- Optional fields can remain blank.
- Validation errors identify the field that needs correction.
- Save failure keeps user-entered values on screen.

## Referral Settings Deferral

Referral settings are intentionally deferred.

Future referral settings may include:

- Whether the hospital accepts referral requests.
- Referral intake URL.
- Referral account creation URL.
- Referral 담당자 assignment.
- Referral specialty/department configuration.
- Hospital introduction text for referrals.
- Referral 안내 text.

Do not include referral settings in phase-1 required onboarding. Add a separate referral workflow spec before implementing them.

## Permissions

Canonical permission source: [Workspace Auth and Permission Domain](../../domain/workspace-auth-permissions.md).

Phase-1 policy:

- `hospital_admin`: View and edit hospital profile.
- `vet`: No edit. Read only where product surfaces need hospital identity context.
- `technician`: No edit. Read only where product surfaces need hospital identity context.
- `front_desk`: No edit. Read only where product surfaces need hospital identity context.

## CLAiR Docs Viewer Placement

This spec should appear in CLAiR Docs under `Features`.

Display intent:

- Pair this spec with [Workspace Hospital Profile](../../domain/workspace-hospital-profile.md).
- Keep domain requirements and feature workflow separate.
- Later CLAiR Docs UI polish should make `Domain`, `Features`, and `Current State` easier to scan as distinct document types.

## Open Questions

- Should workspace ID ever be editable by hospital admins after initial setup?
- Which operating-hour model is needed first: simple weekly hours, holiday exceptions, lunch breaks, or doctor-specific schedules?
- Should representative phone and operational contact be separate required fields or one required field with optional secondary contact?
- Should business registration number validation be added before MVP pilot or deferred until billing/accounting scope?

## Follow-Up Work

Recommended next planning:

1. Member and role management spec.
2. Session and logout security policy.
3. Invite email delivery and recovery policy.
4. Referral workflow spec when referral intake becomes a priority.
