---
id: "HOSPITAL-ADMIN-PR-006"
status: "human_review"
area: "hospital-admin"
priority: "P0"
target_pr: "User goal / local-first role and permission management UI"
source_docs:
  - "docs/product/domain/workspace-auth-permissions.md"
  - "docs/product/features/hospital-admin/hospital-admin-settings-hub-plan.md"
  - "docs/design/screens/hospital-admin/hospital-admin-settings-hub-ux.md"
dependencies:
  - "HOSPITAL-ADMIN-PR-002"
updated: "2026-07-11"
---

# Role and Permission Management UI

## Goal

Replace the static role-work concept with a dedicated, local-first `역할 및 권한` surface. Hospital administrators can inspect system roles, safely manage custom role and job catalogs, and set browser-local work defaults without claiming a server authorization change.

## Delivered Scope

- `권한 역할`, `직무`, and `업무 기본값` tabs in the existing hospital-admin panel.
- Role list/detail split view, grouped permission explanations, locked system roles, and assigned-member sheet.
- Custom role creation/editing limited to the existing safe allow-only permission set.
- Job creation/editing outside the invitation sheet; invitations only assign a person to an existing role and job.
- Workspace-scoped browser storage for work defaults, with save, cancel, reload, and cross-tab synchronization.
- Legacy effective role/job key helpers shared by member detail, editor initialization, mutation payload, and last-owner protection.
- Read-only `role_permission:view` fixture coverage; no API, RPC, resolver, RLS, or remote deployment changes.

## Intentionally Out Of Scope

- Server persistence for role and job catalogs, including migrations, RLS, RPC, and API/resolver changes.
- Claiming that client-side controls are an authorization boundary.
- Connecting work defaults to real work routing or task assignment.
- Resolving the legacy keyless `hospital_admin` ambiguity in durable data. This requires explicit owner metadata and server enforcement in `AUTH-PR-044`.

## Verification

- Passed: focused role, invitation, non-admin, work-default, compact-layout, and keyboard Playwright coverage.
- Passed: role permission view-model and legacy effective-key regression coverage.
- Passed: targeted ESLint and TypeScript checks.
- Passed: `npm run build`, `npm run docs:check`, and `git diff --check`.

## Handoff

- Browser-local state is scoped by workspace ID and may be unavailable after browser storage is cleared.
- System roles remain read-only. Custom roles cannot select owner-only or unknown permissions.
- Result report: `docs/completed/hospital-admin/2026-07-11-role-permission-management-ui-report.html`.
