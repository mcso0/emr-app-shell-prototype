# Project 02 Workspace Membership Live Persistence Closeout

Updated: 2026-05-18
Linear: DEN-53
Project: `02 Workspace & Membership Live Persistence`

## Executive Summary

Project 02 moved workspace, membership, invitation, role/status, and personal profile flows from browser-only prototype behavior toward local-first server/DB persistence.

The work is ready for Human Review. Remote Supabase, real data, production deploy, email delivery, payment/subscription, and Project 03 clinical persistence remain approval-gated.

## Completed Scope

- Docker local Supabase DB/RLS execution gate passed.
- Workspace creation persists through a server route and local transaction RPC.
- Workspace selector reads persisted active memberships.
- Invitation create/resend/cancel/accept use server routes and local transaction RPCs.
- Membership status read UI can load persisted active/pending/inactive rows.
- Role edit UI calls server enforcement before local state update.
- Role/status mutation persists through DB wrappers with last-admin protection.
- Role-management regression coverage locks admin success, non-admin denial, cross-workspace denial, and last-admin protection.
- Personal profile settings persist display fields outside authorization source.
- Secret scan, API error/telemetry contract, route-level rate limiting, and security review handoff are in place.

## Verification Summary

Representative verification across Project 02 included:

- `npx supabase db reset --local`
- Focused local SQL execution for workspace, invitation, role/status, profile, RLS, and last-admin paths.
- `npx playwright test tests/auth.spec.ts --reporter=line`
- `npx playwright test tests/workspace-rate-limit-server.spec.ts tests/workspace-membership-rls-migration.spec.ts tests/workspace-last-admin-protection-migration.spec.ts tests/workspace-role-status-write-server.spec.ts tests/server-permission-enforcement.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run build`
- `npm run security:secrets`
- `npm audit --audit-level=high`
- `npm run docs:check`

## Remaining Risks

- Production rate limiting needs a shared store before multi-instance deployment.
- DEN-96 request id and safe logging helper should be implemented route-wide before remote/staging live.
- Supabase advisors and a security-definer RPC review should run before any remote migration push/link.
- Production logging must include secret redaction before external monitoring is enabled.
- Email delivery, public invite links, subscription/payment, and Project 03 clinical persistence are still out of scope.

## Review Recommendation

Move Project 02 issues to Done only after 승욱 review. Do not start Project 03 until explicit approval.

Reference handoff for the next project: `docs/engineering/auth-security/auth-login/reception-persistence-workspace-context-handoff.md`.
