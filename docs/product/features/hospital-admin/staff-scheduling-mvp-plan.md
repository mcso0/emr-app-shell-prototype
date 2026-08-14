---
type: "product-feature"
title: "Hospital schedule MVP v2"
description: "Revision-based staff scheduling with published-profile consumption and reversible v1 rollout."
tags: ["hospital-admin", "schedule", "supabase", "rollout"]
updated: "2026-07-21"
related_work:
  - "HOSPITAL-ADMIN-LIVE-PR-013"
  - "HOSPITAL-ADMIN-LIVE-PR-014"
  - "HOSPITAL-ADMIN-LIVE-PR-015"
  - "HOSPITAL-ADMIN-LIVE-PR-016"
  - "HOSPITAL-ADMIN-LIVE-PR-017"
---

# Staff Scheduling MVP v2

## Product Decision

The existing mutable v1 schedule remains available as the rollback source. v2 adds a normalized revision model: each week has a single editable draft and a pointer to its latest immutable published revision. A staff profile consumes only the published result.

## MVP Rules

- A workspace starts in rollout mode `v1`; `compare` returns v1 and records safe v1/v2 count, state, and checksum comparison; `v2` enables the new admin schedule screen.
- Only actors with the existing `role_permission:manage` capability can create, edit, validate, publish, discard, or restore a revision.
- Non-manager staff receive only their own published schedule. Reception-profile consumers receive the minimum published shift projection required by the profile surface; private leave reasons and notes never leave the server boundary.
- A work block is one daytime range. Overnight work and work during a closed date are not supported in this MVP.
- A work block cannot overlap another work block, leave, off, inactive staff profile, a different workspace, or effective operating hours. Those writes fail atomically.
- Required job-position completeness blocks publication only when a workspace explicitly opts into the policy; an unconfigured workspace produces no completeness blocker.
- Source roster or operating-calendar changes require an explicit validation before publication.
- Every mutating v2 operation is idempotent, lock-version checked, and audited without private note or leave-reason content.
- An administrator can apply one fixed daytime pattern to selected roles and weekdays in the current draft. Existing work, leave, and off entries are preserved; the batch validates and commits atomically.
- Repetition stays explicit in this MVP: establish a full week with `기본 근무 일괄 입력`, then use `지난주 근무표 가져오기` for the next week and edit only exceptions.
- The schedule owns vertical scrolling inside the workspace frame and exposes visible loading progress, error/retry, empty, published, and editing states.

## State Contract

| Situation | Profile result |
| --- | --- |
| No published assignment | `오늘 게시된 근무가 없어요` |
| Published off | `휴무일` |
| Published leave | `휴가` (subtype/reason hidden) |
| Hospital closed with no assignment | hospital closure state |
| Publish succeeds but consumer check fails | `게시 완료 · 프로필 확인 필요` and read-only retry |

## Deployment Gate

1. Merge code with rollout mode left at `v1`.
2. Apply additive migration and backfill only the Cheongdam synthetic workspace.
3. Record the approved app SHA, prior production SHA, and migration version.
4. Set Cheongdam to `compare`; require zero count/state/checksum mismatch, authorization denials, and successful current-week draft/publish/profile readback.
5. Set only Cheongdam to `v2`. Other workspaces remain `v1`.

Immediately return the rollout mode to `v1` for a backfill mismatch, cross-workspace exposure, unauthorized mutation, published-pointer inconsistency, profile-state distortion, HTTP 5xx, or approved-SHA mismatch. Do not drop additive v2 tables during rollback.
