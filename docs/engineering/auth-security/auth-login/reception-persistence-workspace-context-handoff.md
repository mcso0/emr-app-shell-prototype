# Reception Persistence Workspace Context Handoff

Updated: 2026-05-18
Linear: DEN-53
Project: `02 Workspace & Membership Live Persistence`

## Purpose

This document defines what a future `03 Reception & Encounter Persistence` project may rely on from Project 02. It does not start reception implementation.

## Context Contract For Future Domain Persistence

Future reception/encounter persistence should use these assumptions:

- Actor identity comes from `readServerSession()` on the server.
- Demo actor headers are allowed only in mock fallback mode.
- `workspaceId` must be treated as a scoped server boundary, not a trusted client claim.
- Active workspace membership is the minimum read boundary for workspace-scoped domain data.
- Admin workspace mutations require active membership and `role_permission:manage`.
- Role and permission authority comes from membership and permission policy sources, not personal profile data.
- Personal profile fields may be used for display, not authorization.
- Last active `hospital_admin` protection exists at server/DB boundaries for membership role/status changes.
- Workspace mutation routes are rate limited and should return typed errors.
- Clinical/domain data must get its own RLS and server route contract before live persistence begins.

## Suggested Route Pattern

Future Project 03 routes should follow the Project 02 shape:

1. Resolve server session.
2. Resolve actor identity.
3. Enforce route-level rate limit for mutations.
4. Validate `workspaceId` and input.
5. Check active membership and domain permission.
6. Execute a local-first DB/RLS-backed path.
7. Return typed `{ ok, requestId, error, denialReason, fieldErrors }` responses once the shared helper exists.

## Explicit Non-Assumptions

- Do not assume client-only permission UI is security.
- Do not use profile display fields as role or permission source.
- Do not assume remote Supabase has been linked, migrated, or validated.
- Do not assume patient, guardian, appointment, encounter, SOAP, order, billing, or audit domain tables have live RLS.
- Do not use real patient or hospital data without separate approval.

## Before Starting Project 03

Required gates:

- 승욱 approval to start Project 03.
- Confirm Project 02 Human Review outcome.
- Decide whether Project 03 stays local-first or targets an approved staging Supabase.
- If remote/staging is approved, run Supabase advisors and remote-specific migration review first.
- Implement or explicitly carry forward DEN-96 request id/safe logging helper.
- Decide production-grade rate limit store if testing beyond local single-instance.
