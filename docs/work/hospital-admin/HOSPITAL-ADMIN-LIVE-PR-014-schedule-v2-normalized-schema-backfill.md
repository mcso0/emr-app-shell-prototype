---
id: "HOSPITAL-ADMIN-LIVE-PR-014"
status: "human_review"
area: "hospital-admin"
priority: "P0"
target_pr: "Staff scheduling v2 normalized schema and backfill"
source_docs:
  - "docs/product/features/hospital-admin/staff-scheduling-mvp-plan.md"
dependencies:
  - "HOSPITAL-ADMIN-LIVE-PR-013"
updated: "2026-07-21"
---

# Staff Scheduling v2 Normalized Schema and Backfill

## Goal

Add revision, validation, work-block, non-work, policy, idempotency, and rollout tables while preserving all v1 tables and rows.

## Scope

- Enforce same-workspace composite FKs, FK indexes, one draft per week, latest-published pointer validity, entry-week dates, and immutable published revisions.
- Backfill v1 draft/published/changed weeks without rewriting v1 rows.
- Store deterministic roster and operating-calendar hashes instead of a mutable revalidation flag.
- Keep direct table access closed with RLS and RPC-only access.

## Done When

- The additive migration applies in order after the role-agnostic profile migration and is safe to replay.
- A rollback-transaction rehearsal proves backfill, draft create, publication, profile v2 read, and audit append without modifying the shared local database.
- Rollout remains `v1` by default.
