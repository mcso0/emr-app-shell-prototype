---
id: "CHART-PR-015"
status: "implemented"
area: "chart"
priority: "P0"
target_pr: "Browser comment / today-only vital entry and latest-vital read model"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/product/domain/workspace-auth-permissions.md"
  - "docs/engineering/data-model/patient-vital-measurements.md"
dependencies:
  - "CHART-PR-014"
  - "RECEPTION-QA-PR-011"
updated: "2026-07-20"
---

# Waiting Vital Entry And Latest Summary

## Goal

Let an authorized veterinarian or technician enter, revise, or clear only the selected waiting encounter's today vital values. Reuse the server-backed latest patient vital on later chart, lab, imaging, dispensing, and treatment screen loads.

## Scope

- Add a right-side `오늘 바이탈 입력` or `오늘 바이탈 수정` action in the preconsultation vital section.
- Use one dialog with weight, temperature, blood pressure pair, and respiratory rate.
- Preserve the current/immediate-prior comparison contract from `CHART-PR-014`.
- Update the most recent selected-encounter record rather than append a repeated-measurement timeline row.
- Keep a cleared current row for audit; clear values to null rather than deleting the row.
- Add `vital:write` and enforce active membership, effective permission, clinical job position (veterinarian or technician), selected workspace, and `waiting` encounter plus consultation-queue status in the server writer.
- Add a workspace-scoped patient latest-vital reader using the selected encounter only to resolve its patient.
- Remove the local-only vital editor from `EmrPatientContextBar`; the context bar is display-only.

## Out Of Scope

- Hospital-specific vital option settings, heart rate, device integration, thresholds, or clinical interpretation.
- Historical vital mutation, multiple same-encounter measurement timestamps, real-time push, remote Supabase apply, or deployment.
- Clearing the patient compatibility weight snapshot when a current vital weight is cleared.

## Data Contract

1. A write targets only the selected encounter while both `encounters.status` and its `consultation` queue entry are `waiting`.
2. A new record requires at least one value. An existing record may contain all-null values only when `cleared_at` and `cleared_by_user_id` record the clearing action.
3. Blood pressure is an all-or-nothing systolic/diastolic pair. All numeric values are positive; weight is precise to two decimals, temperature to one, and respiratory rate/blood pressure values are integers.
4. The latest summary selects the patient's latest measurement record even when it is cleared, so a cleared value remains intentionally unshown rather than falling back to an older visit.
5. Existing historical rows stay read-only. The immediate-prior comparison remains the prior encounter's latest record only.

## Done When

- The dialog saves a populated current record, reloads the table, and then can save an all-null cleared state without deleting that row.
- The writer rejects a missing permission, non-clinical job position, stale queue state, cross-workspace encounter, malformed input, and incomplete blood pressure pair.
- Chart, lab, imaging, dispensing, and treatment context bars fetch the latest server value on their next selection/load; none exposes a local-only vital save action.
- Focused lint, type generation/typecheck, server tests, dialog browser test, and docs checks pass. Remote apply remains unperformed.

## Verification

- Focused ESLint, `npx next typegen`, `npx tsc --noEmit --pretty false`, and `npm run docs:check` passed.
- `tests/patient-vital-server.spec.ts` and `tests/chart-preconsultation-context-server.spec.ts` passed (13 tests); the waiting-chart input → save → clear browser flow passed.
- The final implementation closeout records the complete command set and the remaining local/remote Supabase replay boundary.
