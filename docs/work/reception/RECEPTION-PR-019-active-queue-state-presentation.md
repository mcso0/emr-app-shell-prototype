---
id: "RECEPTION-PR-019"
type: "Work Item"
title: "Reception active queue state presentation"
description: "Keep the reception side queue focused on active desk work while preserving billing handoff and same-day exception visibility."
status: "implemented"
area: "reception"
priority: "P0"
tags:
  - "reception"
  - "queue"
  - "workflow-state"
source_docs:
  - "docs/product/features/reception-appointment-spec.md"
  - "docs/product/domain/outpatient-workflow-state-model.md"
  - "docs/design/ux-flows/reception-appointment-flow.md"
dependencies:
  - "RECEPTION-LIVE-PR-009"
  - "RECEPTION-QA-PR-007"
updated: "2026-08-30"
---

# Reception Active Queue State Presentation

## Goal

Make the reception side panel represent the desk user's current operational
work instead of presenting every non-cancelled encounter as `대기`.

## Scope

- Keep only consultation-waiting encounters in the active `접수` group and
  label them `진료대기`.
- Keep requested, confirmed, and changed appointments in the active `예약`
  group with their truthful appointment status.
- Remove in-consultation and ordered encounters from the active side queue
  while keeping a high-level progress label on the calendar.
- Keep ready-for-billing encounters in a collapsed `수납대기` handoff group
  until the non-legacy billing queue owns that work.
- Keep cancelled encounters/appointments and no-show appointments in a
  collapsed `취소·노쇼` exception group for the selected operating date.
- Exclude handoff and exception groups from the active tab counts while
  preserving search and detail access.
- Preserve the existing checked-in/entered timestamp order when an encounter
  returns to waiting.

## Out Of Scope

- Database, RPC, RLS, permission, or queue-reader contract changes.
- A new manual no-show mutation or recovery writer.
- Billing module queue implementation or ownership migration.
- Consultation call/return state-transition changes.
- Correcting the waiting-duration alert after an encounter returns from
  consultation.
- Realtime invalidation beyond the existing refresh/polling behavior.

## Done When

- Active reception and appointment counts include only actionable desk work.
- In-consultation and ordered encounters do not remain mislabeled as `대기`.
- Billing handoff and same-day exceptions remain discoverable without
  competing with the active queue.
- No-show items are labeled `노쇼` and do not expose a cancel-restore action.
- The selected encounter detail remains available after the side-queue card
  leaves the active list.
- Focused Playwright coverage, lint, typecheck, build, docs, and secret gates
  pass for the exact release candidate.

## Verification

- `npx playwright test tests/reception.spec.ts --grep "reception prioritizes the Kong|reception side panel cards keep order|reception side panel searches|reception card action menu exposes chart|reception side panel groups|reception side-panel card action|server-backed reception queue read|reception creates a walk-in waiting|walk-in persistence regression" --reporter=line` — 9 passed.
- `npx playwright test tests/chart.spec.ts --grep "chart consultation CTA moves from call to start before chart completion" --reporter=line` — 1 passed.
- Playwright CLI visual review at 1327×880 — active groups, collapsed
  handoff/exception groups, expanded labels, and calendar progress labels checked.
- `npm run lint`, `npx tsc --noEmit --pretty false`, `npm run build`,
  `npm run docs:check`, `npm run security:secrets`, and `git diff --check` —
  passed. The build retains the existing project-wide NFT trace warning.
- Release Check, preview, staging, and production evidence are tracked by the
  release operation for the exact committed candidate.

## 2026-09-30 Detail Panel Cleanup

- User approved removal of the redundant status badge row from the right detail
  panel, including commit, push, PR, main merge, and production delivery.
- Keep queue/calendar status labels, status data, appointment check-in notice,
  detail actions, and the separate modal presentation unchanged.
- Existing focused browser checks assert that the right-panel badge is absent
  while queue/calendar status and selected patient context remain available.
