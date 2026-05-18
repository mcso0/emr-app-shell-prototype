# AUTH-PR-025 Workspace Live Persistence Scope and Dependencies

Linear: DEN-42
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Confirm the scope, dependency order, approval gates, and out-of-scope boundaries for Project 02 workspace and membership live persistence.

## Scope

- Confirm Project 01 and DEN-94 handoff dependencies.
- Define which workspace, membership, invitation, role-management, and profile flows Project 02 may move to live persistence.
- Keep remote Supabase, real data, email delivery, payment/subscription, and Project 03+ clinical persistence out of scope.
- Record the follow-up issue order and approval gates.
- Create a Korean HTML closeout report and Linear handoff comment.

## Out Of Scope

- No application code implementation.
- No live DB writes.
- No local or remote migration changes.
- No remote Supabase project link, SQL execution, migration push, or secret/service-role key usage.
- No email, subscription, payment, or Project 03+ clinical persistence work.

## Decisions

Project 02 includes local-first live persistence planning and implementation for:

1. Workspace creation and creator `hospital_admin` membership.
2. Workspace selector and shell context from persisted memberships.
3. Member invitations and invitation lifecycle state.
4. Membership status reads.
5. Role-management server handoff and persisted mutation.
6. Personal profile persistence outside authorization source.

DEN-43 should be next because the server route contract must be explicit before DEN-44 workspace creation writes begin.

## Verification

- `npm run docs:check`

Result: passed on 2026-05-18.

## Handoff Notes

Keep Project 02 within local-first Supabase validation. Remote Supabase staging/live changes, real email delivery, payment/subscription integration, and Project 03+ clinical persistence require separate representative approval.
