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
updated: "2026-07-14"
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

Follow-up verification from DEN-518 cleared the earlier rendered-test caveat:

- `npx playwright test tests/reception-encounter-update-server.spec.ts tests/reception-mutation-permissions-server.spec.ts --reporter=line`: covered the route request test after the fixture was corrected to use an editable encounter.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test tests/reception.spec.ts --reporter=line`: 49 passed, including rendered drawer and shared queue/calendar entry coverage.

Follow-up side-panel implementation on 2026-07-08:

- Reception detail now renders as the workspace right panel instead of the global overlay drawer, so the calendar keeps its own width and is not covered.
- The reception toolbar keeps the more action, adds a divider and right-panel toggle, and hides that toggle while the panel is open because the panel header owns the close/toggle control.
- Side-panel detail/edit mode uses structured field rows with label icons, Figma-aligned visit-purpose textarea height, non-animated panel open/close behavior, and edit-mode footer actions without the extra `수정하기` action.
- Vital fields remain data-driven in the UI: weight is shown by default, additional vitals can be selected from a menu, selected vitals can be removed when more than one is present, and the add action hides once all options are selected.
- This follow-up keeps the existing encounter update boundary intact and does not add a DB/API contract for new vital types.

Focused verification:

- `npm run lint`: passed
- `npx tsc --noEmit --pretty false`: passed
- `git diff --check -- src/features/reception/module.tsx src/shell/workspace-frame.tsx src/shell/app-shell.tsx src/modules/registry.ts src/types/emr.ts`: passed
- Manual Playwright verification against local dev server covered closed/open panel layout, no drawer overlay, toolbar button behavior, detail mode, edit mode, textarea height, add-vital menu width, and vital delete spacing/visibility.

## CDS V2 Figma fidelity follow-up (2026-07-14)

- Verified the direct Figma reference as `sidepanel` (`27682:44199`, 380px wide) in the CDS V2 library. Its header is 56px high, uses the X close action, and its content uses 16px panel padding, 16px group gaps, 108px labels, 12px label/control gaps, and 32px controls.
- Kept the receipt/detail form's existing field-token contract and changed only the reception-encounter header to 56px with the documented X close icon. The shared `--clair-layout-drawer-header` token and reservation/non-reception panels are unchanged.
- Re-grouped `방문목적` with `접수일`, `접수시간`, and `예상소요시간` under `접수 정보`, matching the Figma information hierarchy. `접수 메모` remains after it because it is an existing persisted reception field that is absent from the reference frame.
- Added explicit accessible names for the read-only identity/assignment controls and the visit-purpose/memo textareas. No payload, permission, data model, cancellation, or update behavior changed.

Focused verification:

- `npx eslint src/features/reception/module.tsx tests/reception.spec.ts`: passed
- `npx tsc --noEmit --pretty false --incremental false`: passed
- `git diff --check`: passed
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3101 npx playwright test tests/reception.spec.ts --grep "reception encounter detail header|reception detail keeps visit purpose|reception detail exposes named controls" --reporter=line`: 3 passed
- Local rendered verification at 1280px confirmed the 380px panel, 56px header, `접수 정보` membership for `방문목적`, 76px visit-purpose textarea, zero browser console errors/warnings, and unchanged close behavior. A 1024px visual check kept the panel/footer visible without horizontal escape.

## Edit-save feedback follow-up (2026-07-14)

- Figma CDS V2 input error (`234:70742`) requires the invalid input and its one-line error message to be shown together. `ReceptionSidePanelField` now owns that local field/error pairing so all existing editable reception fields can use it without ad-hoc markup.
- The update flow keeps the current server response contract intact. `invalid_input` maps every returned `fieldErrors` entry to its matching field and to a footer-adjacent summary. Authentication and permission denials show a non-retryable action-adjacent message; encounter/workflow state denials are identified as blocked; only transient or unknown save failures expose retry.
- The footer feedback follows the CDS V2 error info treatment (`16213:26517`: 14px alert icon, 4px gap, 12/14 text). The snackbar reference (`446:104928`) was intentionally not used because this workflow needs the failure to remain adjacent to the editable form and save action.
- Editing any field, re-entering edit mode, cancelling edit mode, and a successful save clear stale failure feedback. This changes only UI state; payload construction, API routing, permission decisions, and existing mutation behavior are unchanged.

Focused verification:

- `npm run lint -- src/features/reception/module.tsx tests/reception.spec.ts`: passed
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3103 npx playwright test tests/reception.spec.ts --grep "reception encounter edit" --reporter=line`: 6 passed. Coverage includes all six editable field errors, multiple simultaneous errors, rate limit, unauthenticated, permission, blocked encounter/link states, database failure and retry, pending-save disablement, long content, 1024×640 footer/overflow behavior, and keyboard focus order.
- `npm run build`: passed; one pre-existing Turbopack warning from `next.config.mjs` / PRD viewer tracing remains
- `git diff --check`: passed
- Local browser verification plus automated 1024×640 geometry checks confirmed field-level error placement, footer summary visibility, fixed footer actions, and no horizontal panel escape.

## Handoff Notes

- Downstream reception QA work should treat `PATCH /reception/encounters/[encounterId]` as the update boundary for editable reception detail fields.
- Patient weight should continue to come from and write back to patient `weightKg`/`weight_kg`, not detail-only state.
- If later issues add reservation detail editing, reuse the same patient weight and audit conventions.
- DEN-518 reran the route request and rendered reception drawer tests; future issues can use those tests as the regression baseline.

## Result

Ready for Human Review.

DEN-517 adds the reception detail edit boundary and aligns the visible drawer hierarchy with QA feedback. DEN-518 follow-up verification cleared the earlier route/rendered test caveat.
