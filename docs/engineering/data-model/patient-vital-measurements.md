---
id: ENGINEERING-DATA-MODEL-PATIENT-VITAL-MEASUREMENTS
type: Data Contract
title: Patient Vital Measurements
description: Defines the auditable selected-encounter vital write model and shared latest patient-vital read model.
status: implemented
area: engineering
doc_type: data-contract
related_work:
  - RECEPTION-QA-PR-011
  - CHART-PR-014
  - CHART-PR-015
  - CHART-PR-016
  - CHART-PR-023
  - CHART-PR-040
  - HOSPITAL-ADMIN-LIVE-PR-018
  - HOSPITAL-ADMIN-LIVE-PR-019
  - HOSPITAL-ADMIN-LIVE-PR-024
  - RECEPTION-LIVE-PR-017
last_updated: 2026-09-30
tags: [data-model, patient, vital, chart, permissions]
---

# Patient Vital Measurements

## Purpose

`patient_vital_measurements` keeps measured patient values separate from the compatibility snapshot `patients.weight_kg`. It is the source for the waiting-chart comparison and the shared latest-vital summary used by patient context bars.

## Stored Values

Each row is workspace-, patient-, and encounter-scoped and contains:

- `weight_kg`, `temperature_c`, `heart_rate_bpm`, `respiratory_rate_rpm`
- `blood_pressure_systolic_mmhg`, `blood_pressure_diastolic_mmhg`
- original measurement attribution: `measured_at`, `recorded_by_user_id`, `created_at`
- mutable current-record attribution: `updated_at`, `updated_by_user_id`
- whole-row value-clear attribution: `cleared_at`, `cleared_by_user_id`

Values must be positive. Weight accepts up to two decimal places, temperature up to one, and heart rate/respiratory rate/blood pressure are integers. Blood pressure accepts systolic alone while its workspace setting is optional; diastolic cannot exist without systolic. If blood pressure is required, both values are mandatory. A new measurement needs at least one value. When every value on an existing current record is cleared, the row remains with all values null and both clearing fields set only when current workspace requirements permit it; it is not deleted.

## Write Boundary

Two narrowly scoped RPCs own chart vital writes:

- `public.clair_upsert_waiting_encounter_vitals` remains the compatibility writer for preconsultation and accepts only encounter `waiting` plus consultation queue `waiting`.
- `public.clair_upsert_chart_encounter_vitals` accepts that same waiting pair and the active-chart pair encounter `in_consultation` plus consultation queue `in_progress`.

It rechecks all of the following in the database transaction:

1. `auth.uid()` matches the supplied actor and the actor has active workspace membership.
2. The actor has effective `vital:write` and is either an active hospital administrator or clinically eligible through a veterinarian or technician job position. The legacy `vet` and `technician` membership strings remain a migration compatibility fallback only.
3. The encounter belongs to the requested workspace and its encounter/consultation state pair is allowed by the selected RPC.
4. The write updates only the selected encounter's latest existing vital record; it inserts one record only when that encounter has no vital yet.

The direct table remains RLS-protected with direct authenticated table privileges revoked. Both RPCs are authenticated-only and use a fixed empty `search_path` with schema-qualified relations. The chart RPC does not broaden or replace the waiting-only RPC.

## Read Models

- `clair_get_chart_preconsultation_context` returns one latest current-encounter vital and, at most, the immediate prior non-cancelled encounter's latest vital. It never falls through an empty prior visit to an older visit.
- `clair_get_patient_latest_vital_for_encounter` uses the selected encounter only to identify the patient, then returns that patient's latest measurement row. A cleared row is still latest and therefore returns null values rather than older measurements.
- `clair_get_reception_encounter_vital` returns only the latest measurement row linked to the selected reception encounter. It requires active workspace membership plus `reception:view`; it never substitutes another encounter's patient-latest row. The reception detail renders only non-null values that remain enabled by workspace settings. The reception API also reads display settings through the existing workspace-scoped settings RPC after that exact encounter succeeds and returns `vitalSettings` with `canManage: false`. Reception display therefore does not require `hospital_settings:view`; hospital administration settings GET/PUT retain `hospital_settings:view` / `hospital_settings:manage`. Settings read failures return `vital_settings_read_failed`, separately from measurement failures and missing measurements.

The chart context bar can opt into a vital write action for its selected waiting or active consultation. Dispensing, lab, imaging, and treatment consumers remain display-only because they omit the shared component's opt-in action. A successful chart save replaces the current latest-vital result immediately; later screen selection/load still uses the shared server read model rather than real-time push.

Workspace display and entry visibility comes from `vital_presets` plus `workspace_vital_settings`. The measurement table keeps canonical `kg` and `°C` values; changing a workspace display unit, disabling a preset, or removing it from the workspace list never rewrites or deletes historical rows. Re-adding the preset makes the same stored values visible again. The workspace setting `input_required` governs entry validation for enabled fields. All five product presets have `required_in_workspace = false`, and new workspaces start with all five enabled and `input_required = false`. The reception and chart server boundaries read current workspace settings before writes. The reception RPC validates required fields even if no measurement row would otherwise be created; a deferred measurement trigger validates final row values for chart writes and reception upserts. Historical rows remain readable, and an edit is checked against current requirements.

## Vital history dialog candidate (CHART-PR-040)

The approved desktop dialog is implemented locally. Migration
`20260929103000_patient_vital_history_dialog.sql` is a local candidate, **not an
applied remote migration**. Existing live readers/writers retain the contracts
above until this migration is applied through a separately authorized rollout.

- `clair_list_patient_vital_history` resolves the patient from the selected
  workspace-scoped encounter and returns 100 measurement rows per cursor page,
  grouped in the client by Seoul measurement date. Cancelled and mismatched
  encounter/patient links are excluded. Original author and timestamps are returned.
- `clair_write_patient_vital_measurement` creates a new record with a client-generated
  UUID for safe retry, or corrects an exact record ID using `expectedUpdatedAt`.
  Corrections preserve `measured_at`, original author, and encounter linkage.
  A revision mismatch fails with 409; it never silently overwrites another edit.
- Both API and RPC enforce the existing patient:view / vital:write permissions;
  write still requires clinical/admin eligibility and an active same-patient
  waiting or consultation context. Historical completed encounters can be corrected
  through that active context, but arbitrary patients/workspaces cannot be targeted.
- New writes append a transactional `patient.vital_measured` / `patient.vital_corrected`
  audit event with before/after snapshots. The audit constraint extension preserves
  all existing event types. The public audit helper rejects these two new internal
  events; only the checked measurement writer inserts them. Existing public audit
  event behavior and grants remain unchanged. Legacy encounter upsert RPCs remain unchanged.
- The latest reader retains its raw `vital` record and adds `summary`: most recent
  non-null values independently for each stored field, with `measuredAtByField`.
  Only the context-bar display uses the summary. Record editing uses raw values.
  Entirely cleared values fall back to earlier values in the summary only.
- The new writer recomputes the patient's newest non-null weight;
  an old corrected weight cannot replace a newer compatibility snapshot.
- Workspace units/order/visibility remain authoritative. Unrendered disabled fields
  are preserved during correction. No physiological range thresholds are introduced.

Automated tests and DB execution have not been requested for this slice. Local
typecheck/build and compiled-component visual review are distinct from remote
persistence proof. Current workspace `input_required` settings govern mandatory values for both new
and corrected records. Reuse the existing client/server validator and DB deferred
trigger. Only non-required fields may be omitted for partial repeat measurements.

## Existing Compatibility Snapshot

When a submitted vital includes weight, the writer updates `patients.weight_kg` for existing reception/profile compatibility. Clearing a current vital weight does not erase that patient snapshot; the latest-vital read model still renders the cleared value as unshown.

## Rollout Boundary

The workspace-settings migration passed local full replay and was applied to the linked synthetic/demo Supabase project as remote version `20260722112553_workspace_vital_settings`. Catalog checks confirmed both settings tables, the heart-rate column, RLS, denied anonymous/direct writes, and authenticated reader/writer execution. An authenticated administrator replacement/readback probe ran inside a rollback-only transaction; the persisted workspace configuration remained the four approved defaults with no probe audit event retained.

The required-vitals follow-up was applied as remote version `20260722130209_required_workspace_vitals`. Catalog checks confirmed required weight/temperature metadata and updated reader/writer contracts. A rollback-only authenticated replay verified missing/disabled required rejection, optional removal/re-add, front-desk denial, and unchanged `patient_vital_measurements` rows.

The reception exact-encounter reader was applied as remote version
`20260724021247_reception_encounter_vital_read`. Catalog checks confirmed a
stable `SECURITY DEFINER` function with fixed `search_path`, denied anonymous
execution, and authenticated-only execution. Read-only inspection of the
reported synthetic encounter confirmed one encounter-linked 2026-07-24 row
with weight, temperature, and heart rate while the same patient's earlier
measurements remain grouped by their own visit dates. Forward hardening version
`20260724023220_reception_encounter_vital_patient_link_hardening` also requires
the measurement patient to match the selected encounter patient.

The active-chart writer is introduced by canonical additive version
`20260815100223_chart_active_encounter_vitals`. The exact SQL was applied to the
linked synthetic/demo project as remote version
`20260815102642_chart_active_encounter_vitals`; a comment-only history alias
preserves that version. Catalog shape, authenticated-only execution, denied
anonymous/direct writes, the two allowed state pairs, denied mismatches, and the
unchanged waiting-only RPC are release verification gates.

Remote rollback probes found that the legacy DB permission resolver and the
newer workspace permission-role model had drifted: veterinarians and technicians
had `vital:write` only in the latter. Canonical forward migration
`20260815102956_chart_vital_permission_policy_compatibility` (remote version
`20260815103052`) adds that permission to the matching legacy clinical role
policies. It does not add the permission to front desk and does not change either
RPC's encounter-state rules.

The `20260927123000_workspace_vital_input_required` migration is a local forward
candidate. It preserves existing workspace settings and measurement history,
materializes the legacy four-item fallback for pre-existing workspaces without
saved rows, adds the per-workspace requirement flag, and changes the fallback for
new workspaces to five enabled optional presets. Its empty-configuration marker
keeps an intentionally saved empty list distinct from a new workspace. This
migration has not been applied remotely in this work item.

## Vital history feedback follow-up (2026-09-29)

The history DTO includes `patient: { species, weightKg }` for the existing reception
warning rules. The reader derives that patient from the selected workspace-scoped
encounter under membership and `patient:view` enforcement; it does not accept a
caller-selected patient ID. No additional patient identity fields are returned.

Reception and the history editor share positive/format/precision/storage-bound and
blood-pressure validation. Field errors block writes; existing dog/cat unusual-value
warnings remain advisory with explicit confirmation in the save button. Required
fields continue to use current workspace `inputRequired` policy. Enabled BP requires
diastolic below systolic. An unchanged disabled historical BP tuple is retained;
new or changed inverted BP is rejected by the exact-record SQL writer as well.

The additive `20260929180000_patient_vital_validation_feedback.sql` replaces the two
existing functions without changing grants, role policy, audit, revision checks, or
historical attribution. Apply only with separately recorded remote migration approval.
