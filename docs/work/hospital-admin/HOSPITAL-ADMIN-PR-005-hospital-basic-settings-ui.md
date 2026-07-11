---
id: "HOSPITAL-ADMIN-PR-005"
status: "implemented"
area: "hospital-admin"
priority: "P0"
target_pr: "User goal / dedicated hospital basic settings UI"
source_docs:
  - "docs/product/features/hospital-admin/hospital-admin-settings-hub-plan.md"
  - "docs/design/screens/hospital-admin/hospital-admin-settings-hub-ux.md"
  - "docs/engineering/current-status.md"
dependencies:
  - "HOSPITAL-ADMIN-PR-002"
updated: "2026-07-11"
---

# Hospital Basic Settings UI

## Goal

Replace the generic `병원기본설정` concept page with a focused, minimal, session-local settings interface that explains what can be edited, saved, reverted, or requested.

## Implemented Scope

- Read-only hospital name, director, and address with address copy feedback.
- Local-only hospital information change-request dialog. It confirms that the content was reviewed; it does not submit an external request.
- Editable contact fields with required-phone and optional HTTP(S) homepage validation.
- Independent daily operating/closed switch, 30-minute time values, and one-day/all-open-days propagation choice.
- Holiday policy and date-sorted exception CRUD with custom hours, duplicate-date prevention, calendar icon, edit, and destructive delete.
- Fixed dirty-state bar, save/revert confirmation, schedule-specific toast, in-module navigation guard, and browser unload warning.
- Workspace-scoped in-memory session store that survives hospital-admin menu navigation but resets on refresh or tab close.

## Out Of Scope

- DB/API persistence, schema, RLS, server authorization, and audit events.
- Delivery to customer support or any external party.
- Global navigation guard outside the hospital-admin module.
- Changes to order management, other concept screens, or shared side-panel primitives.

## Done When

- Customer-facing basic settings surface hides development metadata and initial save actions.
- Reviewed CRUD, validation, feedback, revert, and navigation flows work using keyboard-accessible existing UI primitives.
- Focused model and browser regression coverage passes, including compact layout behavior.
- TypeScript, ESLint, build, and docs checks are recorded in the completion report.

## Verification

- See `docs/completed/hospital-admin/2026-07-11-hospital-basic-settings-ui-report.html` for the current command results and scope boundary.
