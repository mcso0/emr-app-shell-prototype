---
id: "RECEPTION-PR-018"
status: "done"
area: "reception"
priority: "P0"
target_pr: "Role-agnostic truthful current-work status in staff profile"
source_docs:
  - "docs/design/system/staff-operational-profile-drawer.md"
  - "docs/engineering/data-model/hospital-schedule-operations.md"
dependencies:
  - "RECEPTION-PR-013"
  - "RECEPTION-PR-017"
updated: "2026-07-20"
---

# Role-Agnostic Current Work Status In Staff Profile

## Goal

Show truthful current work information for every active workspace member while
keeping assigned reception work exclusively in `업무현황`.

## Scope

- Provision a schedule profile for every active membership without restricting
  the contract to veterinarians.
- Derive the current state from published shifts, time clock, workspace closure,
  leave subtype, and active consultation room.
- Render the CDS V2 card variants for work, clock-out/end, leave, off, and
  hospital closure.
- Keep reservations and walk-ins out of `오늘 근무 정보` and retain them in
  `업무현황`.
- Seed the synthetic Cheongdam scenario date with published 09:00-19:00 shifts
  for all active members.

## Out Of Scope

- Implementing or redesigning the `일정` tab.
- Inferring a shift from a calendar lane, role, reservation, or walk-in.
- Exposing patient labels or leave reasons in the current-work response.

## Done When

- Veterinarian, technician, reception, and other active roles receive the same
  workspace-scoped current-work response contract.
- `진료중 · {room}` appears only for an active consultation with a recorded room.
- `퇴근`, `업무 종료`, `연차`, `당일 연차`, `휴무일`, and `병원 휴무일`
  render from their authoritative facts.
- Focused server, browser, TypeScript, docs, and migration readback checks pass.

## Verification

- Remote migration `20260720132051_role_agnostic_staff_current_work_status`
  applied after a rollback-only preflight. Follow-up migration
  `20260720132846_staff_current_work_status_indexes` covers the new schedule and
  active-consultation lookup paths.
- Remote readback returned 15 active Cheongdam members across veterinarian,
  technician, reception, and other roles with the 09:00-19:00 published shift
  and current `shift_ended` state at verification time.
- Focused current-work server tests and profile browser tests cover role-agnostic
  workload separation and CDS V2 state labels.
