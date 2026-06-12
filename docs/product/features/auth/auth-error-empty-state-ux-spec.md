# Auth Error Empty State UX Spec

Status: draft  
Updated: 2026-06-12

This document defines product UX expectations for auth, invite, permission, and session error/empty states. It should be read with [Login Invite Onboarding Spec](login-invite-onboarding-spec.md), [Session Logout Policy Spec](session-logout-policy-spec.md), and [Workspace Access Guard Policy Spec](workspace-access-guard-policy-spec.md).

## Product Goal

Auth-related failures should be understandable, recoverable, and safe. Users should know what happened and what to do next without exposing sensitive account, workspace, or permission details.

## Scope

In scope:

- Login error states.
- Session expired state.
- Invite expired/canceled/invalid states.
- Workspace access denied states.
- Inactive membership states.
- Permission denied states.
- Empty states for member/invite lists.
- UX copy principles and action buttons.

Out of scope:

- Final Korean copy deck.
- Visual design implementation.
- Toast/dialog component implementation.
- Provider-level error mapping.
- Production support playbooks.

## UX Principles

- State what happened in plain language.
- Provide one primary recovery action.
- Avoid exposing whether an email or account exists when unsafe.
- Separate "not signed in", "not a member", "inactive member", and "not permitted".
- Keep admin/support escalation visible only when useful.
- Do not blame the user for security blocks.
- Use short, plain, professional Korean copy for MVP.
- Show CLAiR support contact only when the user cannot recover alone, such as invite expiry, inactive membership, or admin recovery.
- Do not expose raw permission IDs in permission denied states.

## Required States

| State | Primary message intent | Primary action |
| --- | --- | --- |
| Login failed | Email/password could not be verified. | Try again. |
| Session expired | Sign in again to continue. | Go to login. |
| Invite expired | This invite is no longer valid. | Ask admin to resend. |
| Invite canceled | This invite was canceled. | Ask admin if access is still needed. |
| Invite invalid | This link cannot be used. | Ask admin or CLAiR support. |
| Email mismatch | Use the invited email. | Sign in with invited email. |
| Workspace membership inactive | Access to this workspace is inactive. | Contact hospital admin. |
| Workspace not found or inaccessible | Workspace cannot be opened. | Return to login or workspace list. |
| Permission denied | You do not have enough permission for this action. | Return to previous screen or first allowed module. |
| Recent auth required | Confirm identity before continuing. | Re-authenticate. |

## Empty States

| Surface | Empty state |
| --- | --- |
| Pending invites | No pending invitations. Show invite CTA for hospital admins. |
| Active members | No active members should be impossible after setup; show support state if reached. |
| Audit events | No audit events yet. Explain events appear after admin/security actions. |
| Workspace list | No active workspace membership. Ask for invite or support. |

## Action Priority

Use one primary action and optional secondary action:

- Primary: retry, sign in, request resend, contact admin, return to workspace.
- Secondary: change account, go back, contact CLAiR support.
- Avoid multiple equivalent buttons.

## CLAiR Docs Viewer Placement

This spec should appear in CLAiR Docs under `Features`.

## MVP Decisions

- Copy tone should be short, plain, and professional.
- CLAiR support contact is not shown on every blocked state.
- CLAiR support contact appears when the user cannot recover alone, such as expired invite, inactive membership without admin path, or admin recovery.
- Inactive members should see hospital admin contact when available.
- Permission denied states should not show raw permission IDs or sensitive access-policy details.
