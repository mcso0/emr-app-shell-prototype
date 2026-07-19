---
id: "CHART-PR-012"
status: "done"
area: "chart"
priority: "P0"
target_pr: "User request / live preconsultation context"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/chart/CHART-PR-008-consultation-call-start-flow.md"
  - "docs/work/chart/CHART-PR-009-consultation-room-lock-ux.md"
dependencies:
  - "CHART-PR-008"
  - "CHART-PR-009"
updated: "2026-07-16"
---

# Live Preconsultation Context

## Goal

Replace the legacy pre-call chart lock surface with the approved veterinarian-oriented preconsultation view and connect every visible field to the existing reception, appointment, patient, guardian, vital, and chart domains.

## Scope

- Reuse the existing chart queue, consultation-flow API, CLAiR components, shadcn primitives, and EMR design tokens.
- Add a permission-gated DB read model for the selected encounter's patient, guardian, reception/appointment context, vitals, and chart history.
- Keep missing clinical information explicit; do not insert UI fixture values or synthetic production fallbacks.
- Keep the current patient call transition from `waiting/waiting` to `in_consultation/in_progress` and verify it for multiple queue patients.
- Harden direct queue and call RPC execution with workspace permissions and `auth.uid()` actor matching.
- Provide loading, error/retry, empty-vital, and empty-history states.

## Out Of Scope

- Patient profile-image storage or upload. The header uses the existing pet icon as the avatar fallback because no patient photo field exists.
- New clinical interpretation or abnormal-vital thresholds.
- New patient, guardian, appointment, encounter, vital, SOAP, or diagnosis tables.
- Any production migration or deployment outside the approved release packet.

## Data Contract

- `appointments` links to `encounters.appointment_id` when the visit began from a reservation.
- `encounters` remains the current visit source for purpose, complaint, reception memo, veterinarian, and check-in time.
- `waiting_queue_entries` remains the call-state source.
- `patients`, `guardians`, and `patient_guardians` remain identity/relationship sources.
- `patient_vital_measurements` supplies the selected encounter's latest measurement and the latest measurement from its immediately preceding non-cancelled encounter; a missing measurement remains explicit rather than falling back to an older visit.
- `soap_notes` and `diagnoses` enrich prior encounter summaries when records exist.
- `clair_get_chart_preconsultation_context` is the only new read boundary; it requires active membership and `chart:view`.

## Done When

- The selected waiting patient renders the approved preconsultation hierarchy at a 1440px maximum content width.
- Patient information opens in a shadcn Sheet and calling opens the existing room-selection flow.
- Two distinct queue patients can be selected and called into the chart without fixture fallbacks.
- Missing vitals/history are shown as honest empty states.
- Direct queue readers require `reception:view` or `chart:view`; direct call/return writers require `chart:update` and actor/session equality.
- Focused server, component-flow, type, lint, docs, and secret checks pass.

## Verification

- Local type, focused server, focused multi-patient Playwright, lint, docs, secret, and production-build checks passed.
- The remote Supabase migration is recorded as `20260716054716_chart_preconsultation_context` in the linked staging project.
- An authenticated remote read probe resolved the encounter, queue, one eligible vital measurement, and two prior encounters without returning or persisting probe data.
- Function ACL inspection confirmed `anon` cannot execute the new read RPC or direct queue/call wrappers. The read RPC keeps the intentional `authenticated` grant behind active-membership and `chart:view` checks; call/return writers require `chart:update` and actor/session equality.
- Supabase security advisor reports the expected authenticated `SECURITY DEFINER` warning for the read RPC. This is intentional because the table layer remains closed to direct authenticated reads; the function uses a fixed safe `search_path` and explicit membership/permission checks. No advisor finding references a new table, RLS gap, or anonymous execution grant.
- PR #423 merged the implementation into `staging`; PR #424 was included in the promoted staging head.
- PR #425 promoted `staging` to `main` at `81f85ecbbd7362c12016c7fa7a04a3f7d23adf16` after every required GitHub check passed.
- Vercel production deployment `dpl_28kF14zBZRdppum45wtfRR6C5Fav` is `Ready` and serves the production alias `https://emr-app-shell-prototype.vercel.app`.
- Authenticated production browser verification passed for both waiting patients: live preconsultation data, patient-information Sheet, consultation-room selection, call-to-chart transition, and return-to-waiting. Both queue entries were restored and the final browser error log was empty.
- Product Design QA is recorded in `design-qa.md` with `final result: passed`.
- Rollback candidate: production commit `bf342350a62eafbdecd3febc89b0a85fb0227fc7`, deployment `dpl_8sseUgGSbibJ1S32bw52JLUvf6FW`.
