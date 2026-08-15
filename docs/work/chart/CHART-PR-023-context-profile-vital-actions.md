---
id: "CHART-PR-023"
status: "implemented"
area: "chart"
priority: "P0"
target_pr: "Browser comments / chart context profile previews and active-encounter vital action"
source_docs:
  - "docs/engineering/current-status.md"
  - "docs/product/domain/workspace-auth-permissions.md"
  - "docs/engineering/data-model/patient-vital-measurements.md"
dependencies:
  - "CHART-PR-015"
  - "CHART-PR-022"
  - "DESIGN-SYSTEM-PR-091"
result_report: "docs/completed/chart/2026-08-15-chart-pr-023-context-profile-vital-actions-report.html"
updated: "2026-08-15"
---

# Chart Context Profile And Vital Actions

## Goal

Turn the chart patient context bar into a safe work entry point: preview the selected encounter's patient and guardian, open the existing URL-backed profile drawers, and reuse one vital dialog for authorized waiting or active consultations.

## Scope

- Add opt-in patient, guardian, and vital interaction contracts to the shared `EmrPatientContextBar`; keep dispensing, lab, and imaging display-only by default.
- Render patient and guardian previews from the already-selected live encounter bundle without a new hover API request.
- Open the existing patient and guardian drawers after hydrating their shared profile stores.
- Extract the waiting-chart vital editor into `ChartVitalDialog` and reuse it from the active chart header.
- Extend the latest-vital read result with the raw measurement, server-computed write eligibility, refresh, and optimistic replacement helpers.
- Add an authenticated chart encounter-vital route and additive RPC that allow only `waiting` + `waiting` or `in_consultation` + `in_progress`.
- Align the legacy DB permission policy used by vital RPCs with the newer workspace permission-role assignment for hospital administrators, veterinarians, and technicians; keep front desk excluded.
- Reset preview/dialog state when the selected encounter changes and keep a missing guardian non-interactive.

## Out Of Scope

- Changing profile drawer content, creating another profile endpoint, or showing address, birth date, identity numbers, or consent tokens in previews.
- Adding vital write actions to dispensing, lab, imaging, or treatment context bars.
- Extending the existing waiting-only RPC, changing historical vital records, or adding device ingestion and clinical interpretation.
- Saving any vital value during production smoke verification.

## Interaction Contract

1. Pointer hover opens a preview after 250 ms and closes it after 150 ms; keyboard focus opens immediately and Escape closes it.
2. Click, Enter, Space, and touch activation open the existing URL-backed profile drawer.
3. A missing guardian renders `보호자 미지정` without a chevron, trigger, or drawer action.
4. The vital plus is a real focusable button. An unavailable action remains visible on hover/focus, exposes `aria-disabled`, and explains the server or encounter-state reason.
5. Profile previews and the vital editor are scoped to the current encounter; a selection change cannot retain the prior encounter's content.

## Authorization And Data Contract

- The client enables the action only when the latest-vital reader reports write eligibility and the selected encounter pair is one of the two supported active states.
- The route repeats workspace authentication and effective permission checks before invoking the database writer.
- `public.clair_upsert_chart_encounter_vitals` repeats actor, active membership, `vital:write`, clinical/admin eligibility, workspace, encounter, and consultation-queue checks in the transaction.
- The new function uses an empty fixed `search_path`, schema-qualified relations, no `PUBLIC` or `anon` execution, and authenticated-only execution.
- `public.clair_upsert_waiting_encounter_vitals` remains waiting-only and is still used by the compatibility preconsultation endpoint.

## Done Criteria

1. Actual selected patient and guardian data appear in pointer and keyboard previews, and activation opens the matching drawer URL.
2. Missing guardians and denied or stale vital actions are accessible and cannot open an invalid workflow.
3. Waiting and active-consultation vital values prefill, save, clear, and refresh the header without a page reload.
4. Other shared context-bar consumers retain their display-only behavior and geometry.
5. Focused browser/server coverage, lint, typecheck, build, docs, copy, secret, and diff checks pass.
6. The additive migration is applied only after the connected target is confirmed as synthetic/demo and its grants, fixed search path, state denials, and old-RPC boundary are verified.

## Verification Result

- Focused server/RPC contract tests: passed (11/11).
- Full chart browser suite: passed (50/50), including patient/guardian preview and drawer activation, active-consultation vital save, missing guardian, denied vital action, waiting vital save/clear, date transitions, SOAP, diagnosis, and orders.
- Date-transition fixtures derive their boundary dates from the current Seoul operating date so the suite does not deadlock when the calendar reaches an old hard-coded date.
- Full lint, TypeScript, production build, docs, copy, secret, and diff checks passed.
- Canonical writer migration `20260815100223` was applied to the confirmed synthetic/demo project as remote version `20260815102642`.
- The first rollback probe found legacy/new permission-source drift. Forward compatibility migration `20260815102956` was applied as remote version `20260815103052` for hospital administrators, veterinarians, and technicians only; front desk and both RPC state boundaries remain unchanged.
- Catalog checks passed: empty fixed `search_path`, `SECURITY DEFINER`, authenticated-only execution, no anonymous execution, and no authenticated direct table insert/update.
- The repeated rollback-only probe passed waiting and active writes, front-desk/cross-workspace/completed-state denials, old waiting-RPC active-state denial, and zero retained probe rows.
- Supabase advisors reported only the intentional authenticated `SECURITY DEFINER` RPC warning plus pre-existing vital-table RLS/index notices; no unexpected migration-specific finding was introduced.
