---
id: "RECEPTION-QA-PR-005"
type: "Work Item"
title: "Reception detail drawer hierarchy and editable encounter update"
description: "Implements DEN-517 reception QA work for reception detail drawer hierarchy, edit mode, calendar/queue shared detail entry, and server-owned encounter update persistence."
status: "human_review"
area: "reception"
priority: "P0"
tags:
  - "reception"
  - "qa"
  - "detail-drawer"
  - "db-api"
target_pr: "Reception QA project / DEN-517"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/reception/RECEPTION-QA-PR-001-db-api-fallback-boundary.md"
  - "docs/work/reception/RECEPTION-QA-PR-004-reservation-create-flow.md"
dependencies:
  - "RECEPTION-QA-PR-001"
  - "RECEPTION-QA-PR-004"
updated: "2026-06-16"
---

# Reception Detail Drawer Hierarchy and Editable Encounter Update

## Goal

Refine the reception detail drawer so it presents patient/guardian information first, removes internal or duplicate UI, and lets staff update editable reception details through a server-owned API/DB boundary.

## Scope

- Keep the drawer shell title as `접수 상세`.
- Rework the top detail card around patient and guardian information.
- Remove duplicate `오늘 내원` text from the summary card.
- Remove internal encounter/patient code exposure from the shell summary area.
- Remove the `차트보기` button from Assessment History.
- Change the footer layout to left `접수 취소`, right `닫기`, `수정하기`.
- Add a confirmation dialog before entering edit mode.
- Keep patient and reception date read-only.
- Make weight, visit purpose, duration, department, veterinarian, and reception memo editable.
- Fix department display so it uses `encounter.department`, not symptom/visit text.
- Increase visit purpose textarea height to match memo fields.
- Use `접수 메모` for reception detail and `예약 메모` for reservation detail.
- Add `PATCH /api/workspaces/[workspaceId]/reception/encounters/[encounterId]`.
- Add `public.clair_update_reception_encounter(text, text, text, jsonb)` to update editable encounter fields and patient `weight_kg`.
- Add permission/audit coverage for `encounter_update` and `reception.encounter_updated`.
- Keep calendar card and queue card entry on the same `reception-encounter` detail drawer.

## Out Of Scope

- Reservation creation and reservation-to-reception creation, already handled in DEN-516.
- Full chart screen navigation or chart UI changes.
- Remote Supabase migration execution.
- Fixing unrelated PRD/docs viewer dependency gaps in the current worktree.

## DB/API Boundary

- New route: `PATCH /api/workspaces/[workspaceId]/reception/encounters/[encounterId]`.
- New core: `createReceptionEncounterUpdate(...)`.
- New RPC contract: `public.clair_update_reception_encounter(text, text, text, jsonb)`.
- Permission contract: `encounter_update` requires `reception:update`.
- Audit event: `reception.encounter_updated` with target type `encounter`.
- The edit flow is not UI-only: a Supabase session uses the RPC gateway and local/demo fallback is separately covered.

## Done When

- Detail drawer summary emphasizes patient/guardian identity.
- Internal codes, duplicate visit-purpose summary text, and `차트보기` are absent.
- Footer actions are positioned as requested.
- `수정하기` shows confirmation before edit mode.
- Edit mode only exposes the requested editable fields.
- Save writes through the API/core/RPC boundary and updates local reception/patient state.
- Calendar and queue cards open the same detail drawer.

## Verification

- `npx playwright test tests/reception-encounter-update-server.spec.ts tests/reception-mutation-permissions-server.spec.ts --grep-invert "route requires an actor" --reporter=line`: 32 passed
- `npm run lint`: passed with 5 pre-existing warnings outside DEN-517 changes
- `git diff --check`: passed

Blocked by unrelated current worktree changes:

- `npx tsc --noEmit --pretty false --incremental false` fails because unrelated PRD/docs viewer changes reference missing `@/components/ui/command` and `mermaid`.
- The full route request test and rendered UI tests are blocked by the same dev-server compile failure. The route/core/static contract remains covered in the focused test file.

## Handoff Notes

- Downstream reception QA work should treat `PATCH /reception/encounters/[encounterId]` as the update boundary for editable reception detail fields.
- Patient weight should continue to come from and write back to patient `weightKg`/`weight_kg`, not detail-only state.
- If later issues add reservation detail editing, reuse the same patient weight and audit conventions.
- When the unrelated PRD/docs dependency gap is resolved, rerun the route request and rendered reception drawer tests.

## Result

Ready for Human Review.

DEN-517 adds the reception detail edit boundary and aligns the visible drawer hierarchy with QA feedback. The only incomplete verification is caused by unrelated PRD/docs viewer changes already present in the worktree.
