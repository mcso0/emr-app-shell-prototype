# Auth Current Implementation Gap Review

Status: draft  
Updated: 2026-06-12

This document compares the current implemented auth/workspace/member surfaces against the current product planning docs. It is a current-state review, not a product source of truth.

Source docs:

- [Auth Login And Onboarding Current State](auth-login-onboarding-current-state.md)
- [Role Screen Access Current State](role-screen-access-current-state.md)
- [Login Invite Onboarding Spec](../features/auth/login-invite-onboarding-spec.md)
- [Member Role Management Spec](../features/auth/member-role-management-spec.md)
- [Session Logout Policy Spec](../features/auth/session-logout-policy-spec.md)
- [Invite Email Delivery Recovery Policy Spec](../features/auth/invite-email-delivery-recovery-policy-spec.md)
- [Workspace Auth and Permission Domain](../domain/workspace-auth-permissions.md)

## Review Summary

The current prototype already has useful foundations for login, invite acceptance, workspace membership, role management, and hospital-admin member surfaces. The main gap is not screen existence; it is policy completeness, production enforcement, real email delivery, and current implementation mismatch with the agreed B2B onboarding model.

## Gap Matrix

| Area | Current state | Product target | Gap |
| --- | --- | --- | --- |
| Returning login | Email/password login exists. | Email/password for invited active workspace members. | Mostly aligned; final session policy enforcement not complete. |
| Mock role selection | Exists in development/mock contexts. | Excluded from real product login. | Must remain demo-only and not become product UX. |
| Workspace creation | `/workspace/new` prototype exists. | CLAiR operations creates workspace first. | Customer-facing workspace creation needs redesign or internalization. |
| First admin invite | Invite flow foundations exist. | CLAiR sends first admin invite and guides onboarding. | Hospital profile confirmation and operator recovery need more design. |
| Staff invite | Member invitation surfaces exist. | Hospital admin invites staff, resend/cancel allowed. | Real email delivery and final recovery states not complete. |
| Session/logout | Some persistence behavior exists. | Explicit idle/absolute/recent-auth policy. | Policy drafted, implementation gap remains. |
| Role management | Surfaces and role foundations exist. | Canonical MVP roles and additive multi-role policy. | Legacy/demo role aliases must not leak into product UX. |
| Permission enforcement | Client and route foundations exist. | Server-side and later DB/RLS enforcement required. | Do not claim production security completion. |
| Error states | Some reason/query states exist. | Clear state-specific UX. | Needs UX copy/state implementation pass. |

## Implementation Work Not Yet Claimed

- Real external email delivery.
- Final password reset implementation.
- Production session expiration enforcement.
- Recent-auth enforcement for high-impact actions.
- Full server-side permission enforcement for every mutation.
- Final DB/RLS replay.
- CLAiR internal operator console.
- Final auth error-state UX polish.

## Recommended Next Review

After the remaining auth planning docs are approved, review current screens in a fixed-stage flow and create implementation work items for:

1. customer-facing login/invite UX cleanup
2. hospital-admin member management UX alignment
3. workspace access guard enforcement
4. invite delivery/recovery implementation
5. password reset/account recovery implementation

## Questions For 승욱

Questions that require product-owner answers should be collected from the auth planning specs after this review, not answered in this current-state document.
