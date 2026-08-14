---
id: CHART-PR-015-CLOSEOUT
type: Implementation Closeout
title: Waiting Vital Entry And Latest Summary
status: implemented
area: chart
related_work:
  - CHART-PR-015
last_updated: 2026-07-20
---

# Waiting Vital Entry And Latest Summary Closeout

## Result

Authorized veterinarians and technicians can now enter, revise, or clear the selected waiting encounter's today vital values in the chart. Patient context bars are display-only and request the latest server value on a later screen load or selection.

## Delivered

- Added the chart-side `오늘 바이탈 입력/수정` dialog for weight, temperature, systolic/diastolic blood pressure, and respiratory rate.
- Added server-owned API/RPC boundaries with active workspace membership, `vital:write`, veterinarian/technician eligibility, actor binding, selected-workspace ownership, and waiting encounter/consultation queue checks.
- Added auditable value clearing: an existing current vital row is retained with null values plus `cleared_at` and `cleared_by_user_id`; no historical vital row is changed or deleted.
- Added a patient latest-vital read model and connected chart, lab/imaging, dispensing, and treatment context bars. Removed their prior local-only vital editor.
- Added source data/permission documentation and the interactive implementation report.

## Verification

- `git diff --check`
- Focused ESLint for the affected source and test files
- `npx next typegen` and `npx tsc --noEmit --pretty false`
- `npx playwright test tests/patient-vital-server.spec.ts tests/chart-preconsultation-context-server.spec.ts --reporter=line`
- `npx playwright test tests/chart.spec.ts --grep "waiting chart saves and clears only today's vital values" --reporter=line`
- `npm run docs:check`

## Remaining Boundary

The additive migration is present in source only. The Supabase CLI is not installed in this checkout, and no local reset, remote migration apply, deployment, or live patient data operation was run.
