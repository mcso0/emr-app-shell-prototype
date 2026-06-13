# Auth Foundation Planning Index

Status: draft
Updated: 2026-06-13

This folder is the product-planning home for CLAiR EMR auth foundation. In this planning phase, Auth means account, workspace entry, access permission, and member-management foundations.

## Scope

Auth foundation includes:

- account login, password reset, session, and logout
- first hospital admin invite and onboarding
- workspace entry and safe redirects
- hospital workspace access guards
- staff invitation and invite recovery
- member list, role edit, and membership deactivation
- canonical roles and action-level permission rules
- auth, invite, and permission error/empty states
- CLAiR internal operator recovery for admin/access-critical cases

Auth foundation does not include:

- full home, reception, chart, billing, lab, imaging, dispensing, inpatient, or customer-management feature planning
- final implementation gap review for non-auth areas
- server/API implementation, DB/RLS, migrations, or live Supabase validation
- real external email provider delivery
- production launch, real customer data, or public access

## Read In This Order

| Order | Document | Purpose |
| --- | --- | --- |
| 1 | [Workspace Auth and Permission Domain](../../domain/workspace-auth-permissions.md) | Canonical roles, membership, workspace, and permission source of truth. |
| 2 | [Login Invite Onboarding Spec](login-invite-onboarding-spec.md) | Returning login, first admin invite, staff invite onboarding, and B2B workspace-entry baseline. |
| 3 | [Hospital Profile Onboarding Spec](../hospital-admin/hospital-profile-onboarding-spec.md) | First admin confirmation of hospital identity/basic settings. |
| 4 | [Member Role Management Spec](member-role-management-spec.md) | Staff invites, roles, deactivation, last-admin protection, and member fields. |
| 5 | [Invite Email Delivery Recovery Policy Spec](invite-email-delivery-recovery-policy-spec.md) | Invite expiry, resend, cancellation, wrong-email recovery, and accepted/expired/canceled states. |
| 6 | [Session Logout Policy Spec](session-logout-policy-spec.md) | Session persistence, idle/absolute timeout, logout, and recent-auth target. |
| 7 | [Password Reset Account Recovery Policy Spec](password-reset-account-recovery-policy-spec.md) | Password reset and account recovery without bypassing workspace membership. |
| 8 | [Workspace Access Guard Policy Spec](workspace-access-guard-policy-spec.md) | Route/action guard order: session, workspace, membership, status, permission, recent-auth. |
| 9 | [Role Permission Detail Spec](role-permission-detail-spec.md) | Action-level role/permission detail for MVP roles. |
| 10 | [Hospital Admin Member Management UX Spec](hospital-admin-member-management-ux-spec.md) | Product UX target for member list, pending invites, role picker, and deactivation. |
| 11 | [Auth Error Empty State UX Spec](auth-error-empty-state-ux-spec.md) | User-facing states for login, invite, session, inactive membership, and permission blocks. |
| 12 | [CLAiR Internal Operator Recovery Audit Policy Spec](clair-internal-operator-recovery-audit-policy-spec.md) | CLAiR-side recovery authority, verification, and audit expectations. |

## Current-State References

Use these only for implemented-state comparison:

- [Auth Login And Onboarding Current State](../../current-state/auth-login-onboarding-current-state.md)
- [Role Screen Access Current State](../../current-state/role-screen-access-current-state.md)
- [Auth Current Implementation Gap Review](../../current-state/auth-current-implementation-gap-review.md)

The gap review is intentionally deferred until the other major feature plans are drafted. It should become useful after home, reception/appointment, customer/patient, chart, fulfillment, billing, and hospital-management planning have comparable product targets.

## MVP Decisions Snapshot

- Product login is email/password for invited workspace users.
- Open self-service hospital signup is out of MVP.
- CLAiR operations creates the hospital workspace before first admin onboarding.
- First hospital admin enters by invite and confirms hospital profile.
- Hospital admins invite staff.
- Canonical MVP roles are `hospital_admin`, `vet`, `technician`, and `front_desk`.
- Users can have multiple roles; effective permissions are additive.
- `billing_admin` / `수납 관리자` is not a canonical MVP role.
- Password reset links expire after 1 hour and log out other sessions after reset.
- Multi-workspace membership for one account is out of MVP.
- Limited-permission users land on the first allowed module.
- Pending invites are shown separately from member lists.
- Role editing uses role chips plus a popover role picker.
- Member deactivation requires a reason.

## Next Planning Boundary

After this Auth foundation set, continue with major product-function planning before doing a broad implementation gap review:

1. Reception / 접수 예약
2. Customer, patient, and guardian management
3. Chart / 진료 차트
4. Lab, imaging, dispensing, and treatment fulfillment
5. Billing / 수납
6. Hospital management beyond auth/member management
7. Home / 원내 현황
8. Cross-feature implementation gap review
