# Workspace Live Persistence Scope and Dependencies

Updated: 2026-05-18
Linear: DEN-42
Project: `02 Workspace & Membership Live Persistence`

## Executive Summary

Project 02 may continue from the Docker local Supabase DB/RLS gate into workspace and membership live persistence, but only inside the local-first boundary.

The project scope is to move the existing session-only workspace, membership, invitation, role-management, and personal-profile flows toward persisted Supabase-backed behavior. It must keep mock fallback behavior and must not use remote Supabase, real clinic data, email delivery, subscription/payment providers, or Project 03 clinical persistence without a separate approval gate.

Closeout status: DEN-53 completed the Project 02 handoff package. Project 02 is ready for 승욱 Human Review, not Done.

## Confirmed Preconditions

| Dependency | Status | Project 02 meaning |
| --- | --- | --- |
| Project 01 auth/DB/RLS foundation | Complete enough for handoff | Verified server session seam, schema migration, RLS baseline, last-admin guard, DB adapter, and cross-workspace denial contracts exist. |
| Docker local Supabase gate | Passed in DEN-94 | Project 01 migrations and seed now execute in a real local Postgres runtime. |
| RLS helper grant blocker | Fixed in DEN-94 | `authenticated` can evaluate private RLS helpers; `anon` remains blocked. |
| Remote Supabase validation | Not approved | No `supabase link`, remote SQL, remote push, or real project mutation. |
| Domain table RLS | Not in scope | Reception, chart, order, billing, and patient data persistence must wait for Project 03+. |

## Project 02 Included Scope

| Area | Live persistence target | First follow-up issue |
| --- | --- | --- |
| Workspace creation | Persist workspace creation and creator `hospital_admin` membership through a server route and DB transaction boundary. | DEN-44 |
| Workspace selector and shell context | Read available workspaces from active persisted memberships instead of browser-only workspace state. | DEN-45 |
| Invitations | Persist pending invitations with invited email, roles, inviter, expiry, and status. | DEN-46 |
| Invitation lifecycle | Persist accept, cancel, and resend intent/status transitions without real email delivery. | DEN-47 |
| Membership status UI | Read active, pending, and inactive member state from persisted workspace data. | DEN-48 |
| Role management UI handoff | Route role edits through server enforcement before DB-backed role writes. | DEN-49 |
| Role/status mutation persistence | Persist role changes and deactivation while preserving DB last-admin protection. | DEN-50 |
| Role management regression | Add admin, non-admin, last-admin, reload, and persisted-summary regression coverage. | DEN-51 |
| Personal profile | Persist user-owned display/profile fields outside authorization source. | DEN-52 |
| Project closeout | Package Project 02 handoff for reception/encounter persistence. | DEN-53 |

DEN-43 should run before DEN-44 because the mutation route contract should be explicit before implementing workspace and member writes.

## Explicit Out Of Scope

- No remote Supabase project link, push, SQL execution, dashboard mutation, or secret use.
- No real clinic, guardian, patient, staff, or hospital production data.
- No real email delivery, public invite link launch, subscription provider, payment provider, or seat billing enforcement.
- No clinical/domain persistence for reception, encounter, chart, order, billing, or audit tables beyond auth/workspace admin boundaries.
- No role-policy expansion beyond canonical MVP roles: `hospital_admin`, `vet`, `technician`, `front_desk`.
- No removal of mock/local demo fallback.

## Approval Gates

Representative approval is required before:

1. Linking this repo to any remote Supabase project.
2. Running SQL against remote Supabase.
3. Applying migrations to staging or production.
4. Using secret, service-role, DB password, connection string, JWT secret, or CLI token material.
5. Enabling real email delivery or public invite links.
6. Enabling subscription/payment provider integration.
7. Starting Project 03+ clinical or reception persistence work.
8. Changing canonical role/permission policy semantics.

## Dependency Matrix

| Follow-up | Depends on | Must verify |
| --- | --- | --- |
| DEN-43 route contract | DEN-42 scope and Project 01 server session/enforcement contracts | Routes define actor, workspace scope, required permission, denial reason, fallback, and tests. |
| DEN-44 workspace creation | DEN-43, local DB schema, server session seam | Transaction creates workspace, app user as needed, and creator active `hospital_admin`; duplicate/invalid input denied. |
| DEN-45 workspace selector | DEN-44 or seeded persisted memberships, DB adapter | Active memberships drive workspace list; inactive/missing membership denied; mock fallback remains. |
| DEN-46 invitations | DEN-43, RLS/admin write boundary | Admin can create pending invite; duplicate pending invite is blocked or routed to resend. |
| DEN-47 invite lifecycle | DEN-46 persisted invite rows | Accept/cancel/resend statuses are saved; accepted invite creates/activates membership through server path. |
| DEN-48 member status UI | DEN-46/DEN-47 persisted member and invite status | Counts/lists read persisted active/pending/inactive state and handle loading/error/empty states. |
| DEN-49 role edit handoff | DEN-43, existing role update route/session seam | UI mutation path uses server enforcement and keeps session-only fallback where appropriate. |
| DEN-50 role/status writes | DEN-49, DB last-admin guard, RLS execution gate | Role/status changes persist; last active `hospital_admin` demotion/deactivation is blocked server/DB side. |
| DEN-51 regression | DEN-49/DEN-50 | Admin success, non-admin denial, last-admin denial, and reload persistence are covered. |
| DEN-52 profile persistence | DEN-43, profile data model | User profile fields persist without storing roles, permissions, or membership authority in profile storage. |
| DEN-53 closeout | DEN-44 through DEN-52 | Project 03 receives a workspace/user context contract and remaining-risk list. |

## Recommended Next Step

승욱 should review Project 02 Human Review issues and closeout documents. Do not start Project 03 or move issues to Done until that review is complete.

Future Project 03 should use `docs/engineering/auth-security/auth-login/reception-persistence-workspace-context-handoff.md` as its workspace/user context contract.

## Verification

- `npm run docs:check`
