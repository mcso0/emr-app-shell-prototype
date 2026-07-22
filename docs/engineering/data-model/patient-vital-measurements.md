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
  - HOSPITAL-ADMIN-LIVE-PR-018
  - HOSPITAL-ADMIN-LIVE-PR-019
last_updated: 2026-07-22
tags: [data-model, patient, vital, chart, permissions]
---

# Patient Vital Measurements

## Purpose

`patient_vital_measurements` keeps measured patient values separate from the compatibility snapshot `patients.weight_kg`. It is the source for the waiting-chart comparison and the display-only latest-vital summary used by patient context bars.

## Stored Values

Each row is workspace-, patient-, and encounter-scoped and contains:

- `weight_kg`, `temperature_c`, `heart_rate_bpm`, `respiratory_rate_rpm`
- `blood_pressure_systolic_mmhg`, `blood_pressure_diastolic_mmhg`
- original measurement attribution: `measured_at`, `recorded_by_user_id`, `created_at`
- mutable current-record attribution: `updated_at`, `updated_by_user_id`
- whole-row value-clear attribution: `cleared_at`, `cleared_by_user_id`

Values must be positive. Weight accepts up to two decimal places, temperature up to one, and heart rate/respiratory rate/blood pressure are integers. Blood pressure accepts systolic alone; diastolic is optional and cannot exist without systolic. A new measurement needs at least one value. When every value on an existing current record is cleared, the row remains with all values null and both clearing fields set; it is not deleted.

## Write Boundary

`public.clair_upsert_waiting_encounter_vitals` is the only approved writer for this flow.

It rechecks all of the following in the database transaction:

1. `auth.uid()` matches the supplied actor and the actor has active workspace membership.
2. The actor has effective `vital:write` and is either an active hospital administrator or clinically eligible through a veterinarian or technician job position. The legacy `vet` and `technician` membership strings remain a migration compatibility fallback only.
3. The encounter belongs to the requested workspace and both the encounter and `consultation` queue row are `waiting`.
4. The write updates only the selected encounter's latest existing vital record; it inserts one record only when that encounter has no vital yet.

The direct table remains RLS-protected with direct authenticated table privileges revoked. The RPC is authenticated-only and uses a fixed `search_path`.

## Read Models

- `clair_get_chart_preconsultation_context` returns one latest current-encounter vital and, at most, the immediate prior non-cancelled encounter's latest vital. It never falls through an empty prior visit to an older visit.
- `clair_get_patient_latest_vital_for_encounter` uses the selected encounter only to identify the patient, then returns that patient's latest measurement row. A cleared row is still latest and therefore returns null values rather than older measurements.

The context bar has no vital write UI. It requests the shared latest read model on a later screen selection/load, not through real-time push.

Workspace display and entry visibility comes from `vital_presets` plus `workspace_vital_settings`. The measurement table keeps canonical `kg` and `°C` values; changing a workspace display unit, disabling an optional preset, or removing an optional preset from the workspace list never rewrites or deletes historical rows. Re-adding the preset makes the same stored values visible again. `required_in_workspace` means the preset must remain configured and enabled; it does not make a patient measurement mandatory.

## Compatibility Snapshot

When a submitted vital includes weight, the writer updates `patients.weight_kg` for existing reception/profile compatibility. Clearing a current vital weight does not erase that patient snapshot; the latest-vital read model still renders the cleared value as unshown.

## Rollout Boundary

The workspace-settings migration passed local full replay and was applied to the linked synthetic/demo Supabase project as remote version `20260722112553_workspace_vital_settings`. Catalog checks confirmed both settings tables, the heart-rate column, RLS, denied anonymous/direct writes, and authenticated reader/writer execution. An authenticated administrator replacement/readback probe ran inside a rollback-only transaction; the persisted workspace configuration remained the four approved defaults with no probe audit event retained.

The required-vitals follow-up was applied as remote version `20260722130209_required_workspace_vitals`. Catalog checks confirmed required weight/temperature metadata and updated reader/writer contracts. A rollback-only authenticated replay verified missing/disabled required rejection, optional removal/re-add, front-desk denial, and unchanged `patient_vital_measurements` rows.
