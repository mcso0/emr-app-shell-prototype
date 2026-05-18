# AUTH-PR-026 Workspace and Member Server Route Contract

Linear: DEN-43
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Design the server route contract for Project 02 workspace and member mutations before implementing live persistence.

## Scope

- Define candidate routes/server actions for workspace creation, workspace selector read, invitation create/lifecycle, membership reads, role/status mutation, and personal profile save.
- Define actor identity source, workspace scope, required permission, denial reasons, and response envelope.
- Define mock fallback and live route handoff rules.
- Define route-level test strategy for follow-up implementation issues.
- Create a Korean HTML closeout report and Linear handoff comment.

## Out Of Scope

- No route implementation.
- No UI changes.
- No DB migration changes.
- No remote Supabase project link, SQL execution, migration push, or secret/service-role key usage.
- No real email delivery, public invite link launch, subscription/payment provider integration, or Project 03+ clinical persistence.

## Decisions

- Protected routes use `readServerSession()` for actor identity.
- Demo actor header is allowed only in `mock_mode` fallback.
- Workspace/member admin mutations require active workspace membership and `role_permission:manage`.
- Personal profile save is an own-user route and rejects role, permission, and membership authority fields.
- DEN-44 through DEN-52 should implement against `docs/engineering/auth-security/auth-login/workspace-member-server-route-contract.md`.

## Verification

- `npm run docs:check`

Result: passed on 2026-05-18.

## Handoff Notes

Proceed to DEN-44 after Human Review. Keep route implementation local-first and approval-gated for remote Supabase, elevated secrets, real email delivery, payment/subscription, and Project 03+ clinical persistence.
