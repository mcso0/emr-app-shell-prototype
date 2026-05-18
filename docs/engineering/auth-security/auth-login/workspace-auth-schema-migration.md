# Workspace Auth Schema Migration

Updated: 2026-05-18
Linear: DEN-34

This document summarizes the local-first schema contract introduced by `supabase/migrations/20260518023715_workspace_auth_schema_foundation.sql`.

## Purpose

Create the first reviewable database migration for workspace auth foundation without applying it to a remote Supabase project.

## Tables

| Table | Purpose |
| --- | --- |
| `public.users` | App-domain user profile. `id` matches `auth.users.id` for loginable users. |
| `public.workspaces` | Route-safe workspace operating scope for `/w/[workspaceId]`. |
| `public.user_profiles` | User-owned profile/settings extension. It must not store role or permission authority. |
| `public.user_memberships` | Workspace-scoped membership and additive canonical role source. |
| `public.workspace_invitations` | Staff invitation lifecycle before or during membership activation. |
| `public.permission_policies` | Allow-only role/user permission source for the resolver. |

## Constraints And Indexes

- Canonical MVP roles are `hospital_admin`, `vet`, `technician`, and `front_desk`.
- `user_memberships.roles` and `workspace_invitations.invited_roles` must be subsets of the canonical role values.
- Active memberships must have at least one role.
- `user_memberships` keeps `unique (workspace_id, user_id)`.
- Pending invitations are unique by `(workspace_id, email)`.
- Permission policies are unique by workspace/role for role scope and workspace/user for user scope.
- Workspace, membership status, invitation status, and permission scope indexes are included for follow-up resolver/RLS work.

## RLS Boundary

The migration enables RLS on all six public auth tables but intentionally does not create policies in DEN-34. Policy SQL belongs to the follow-up RLS issues after local migration validation.

## Supabase Notes

- The migration was created with `npx supabase migration new workspace_auth_schema_foundation`.
- Remote Supabase was not linked or mutated.
- Local Supabase DB validation could not run because local Postgres was not running at `127.0.0.1:54322`.
- Supabase changelog review reaffirmed that Data API grants/exposure are separate from RLS; DEN-37 should explicitly decide table grants together with policies.

## Next Step

DEN-35 should start local migration validation and define seed data for at least one workspace, active `hospital_admin`, and role permission policies.
