---
id: "HOSPITAL-ADMIN-LIVE-PR-015"
status: "human_review"
area: "hospital-admin"
priority: "P0"
target_pr: "Staff scheduling v2 draft and publication workflow"
source_docs:
  - "docs/product/features/hospital-admin/staff-scheduling-mvp-plan.md"
dependencies:
  - "HOSPITAL-ADMIN-LIVE-PR-014"
updated: "2026-07-21"
---

# Staff Scheduling v2 Draft and Publication Workflow

## Goal

Make all draft edits server-authoritative and safely publish a fully validated revision.

## Scope

- Create/restore draft, copy prior published week, save/delete work and non-work entries, validate, discard, and publish through idempotent RPCs.
- Require revision lock versions and return server readback after each mutation.
- Reject stale, overlap, inactive, cross-workspace, outside-operating-hours, closed-day, and invalid-range writes before data changes.
- Publish in one transaction: revalidate, supersede prior published revision, publish draft, update pointer, and append an ID-only audit event.

## Done When

- `409 stale_schedule_revision`, idempotency conflict, and `422 publication_blocked`/invalid write paths are distinguishable at the API boundary.
- Source roster/calendar drift remains blocking until explicit validation.
- Audit records contain actor, workspace, revision, operation, and timestamp but not leave reasons or private notes.
