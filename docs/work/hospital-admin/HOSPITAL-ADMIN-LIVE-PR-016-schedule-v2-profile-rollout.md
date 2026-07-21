---
id: "HOSPITAL-ADMIN-LIVE-PR-016"
status: "human_review"
area: "hospital-admin"
priority: "P0"
target_pr: "Staff scheduling v2 profile consumer and rollout"
source_docs:
  - "docs/product/features/hospital-admin/staff-scheduling-mvp-plan.md"
dependencies:
  - "HOSPITAL-ADMIN-LIVE-PR-015"
updated: "2026-07-21"
---

# Staff Scheduling v2 Profile Consumer and Rollout

## Goal

Switch profile and current-work consumers to the latest published v2 revision only when a workspace rollout reaches `v2`.

## Scope

- Return a minimal target-staff published schedule projection instead of the full roster.
- Preserve separate missing-assignment, off, leave, and hospital-closure results.
- Keep v1 profile consumption until the rollout mode is `v2`.
- Restrict broad schedule access to managers; permit only the minimum profile projection for the target employee and operational reception readers.

## Done When

- The staff profile source has no access to private leave reasons or notes.
- A local rollout rehearsal confirms v2 profile projection and current-work state against a published v2 revision.
- Production rollout remains pending the documented compare gate and explicit production approval.
