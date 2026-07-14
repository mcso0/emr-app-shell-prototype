---
type: "Design Spec"
title: "Walk-in reception vital history capture"
description: "Defines walk-in-only vital entry, patient vital measurement persistence, and reservation-form removal."
tags: [reception, walk-in, vitals, dropdown, supabase]
status: implemented
area: reception
updated: 2026-07-14
---

# Walk-In Reception Vital History Capture

## Decision

Capture vitals only when creating a walk-in reception. Remove the vital section from reservation creation because a future reservation is not a valid measurement event.

Persist submitted measurements as patient history in a new `public.patient_vital_measurements` table. A measurement row belongs to a workspace and patient, links to the newly created encounter, records the actor and measurement time, and stores the submitted vital values as one measurement set.

## Verified Current State

Supabase MCP read-only inspection of the connected staging project on 2026-07-14 confirmed:

- `public.patients` contains `weight_kg` but no temperature, respiration, blood-pressure, pulse, or heart-rate columns.
- No public table or column with a vital-history contract exists.
- `public.clair_create_reception_appointment(text, text, jsonb)` currently accepts optional `weightKg` in staging.
- The staging definition of `public.clair_create_reception_walk_in_encounter(text, text, jsonb)` does not currently persist weight, while the repository contains later weight-writer work. The implementation must treat this as schema drift and ship a new additive migration rather than editing an applied migration.

No patient rows or customer data were read during this inspection.

## Implementation Status

Implemented locally on 2026-07-14. Reservation creation no longer renders or sends vitals. Walk-in creation owns the accessible four-option draft and submits a nested optional `vitals` object. The additive migration creates the measurement history table and updates the SECURITY DEFINER walk-in RPC so encounter, queue, optional vital history, and the compatibility weight snapshot commit or roll back together.

Docker local Supabase reset and a transaction-scoped replay verified direct-write denial, exact insert/readback, and forced-failure rollback. Remote Supabase migration application, production DB changes, real-data access, history browsing UI, and production deployment remain outside this implementation result.

## Product Scope

### Walk-In Reception Creation

- Show the vital section after a patient is selected.
- Keep `체중` as the initial visible row.
- `바이탈 추가` offers `체중 kg`, `체온 °C`, `호흡 rpm`, and `혈압 mmHg` when each option is absent.
- Blood pressure uses two numeric inputs in one row: systolic and diastolic, displayed as `수축기 / 이완기 mmHg`.
- Added rows start empty, except weight may be prefilled from the selected patient's latest compatible profile value.
- Submitting the walk-in reception persists every non-empty submitted vital as a measurement at the submission time.

### Reservation Creation

- Remove the entire vital section, including the existing weight field and placeholder `바이탈 추가` action.
- Reservation creation does not create a vital measurement.
- The existing database function may remain backward compatible with older optional weight payloads, but the current reservation UI and validated application input no longer send a vital value.

## Interaction Contract

1. `바이탈 추가` opens a single-select dropdown anchored to the full-width trigger.
2. The menu lists every vital not currently present, including `체중` if it was removed.
3. Selecting an option closes the menu, appends the row, and focuses its first input.
4. Rows keep selection order and use a consistent `10px` vertical gap.
5. With two or more rows, every row shows a labelled remove action.
6. With one row, no remove action is rendered; at least one row always remains visible.
7. Removing a row returns its option to the menu.
8. Re-adding a row restores its value from the current unsaved form draft.
9. When all four rows are present, the add trigger is hidden.
10. Changing the selected patient resets the vital draft and initializes the new patient's latest weight when available.

## Dropdown Design

- Width follows the trigger width.
- Each option shows a domain icon, Korean label, and unit.
- Icon tiles use CLAiR Neutral/50 (`#FAFAFA`); icons retain the domain accent color.
- One click adds one row without a checkbox or apply action.
- Escape and outside click close the menu without changing fields.
- Keyboard focus enters the first option when opened and returns to the trigger when dismissed.

## Data Model

Create `public.patient_vital_measurements` with this contract:

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key, generated in DB |
| `workspace_id` | `text` | Required tenant boundary |
| `patient_id` | `uuid` | Required patient reference |
| `encounter_id` | `uuid` | Required for this walk-in writer |
| `measured_at` | `timestamptz` | Required; submission time owned by the server |
| `recorded_by_user_id` | `uuid` | Required actor reference |
| `weight_kg` | `numeric(6,2)` | Optional, positive when present |
| `temperature_c` | `numeric(4,1)` | Optional, positive when present |
| `respiratory_rate_rpm` | `integer` | Optional, positive when present |
| `blood_pressure_systolic_mmhg` | `integer` | Optional, positive when present |
| `blood_pressure_diastolic_mmhg` | `integer` | Optional, positive when present |
| `created_at` | `timestamptz` | Required, defaults to `now()` |

Database checks enforce:

- At least one measurement value is present.
- Every present numeric value is positive.
- Systolic and diastolic blood pressure are either both present or both absent.
- `workspace_id`, `patient_id`, and `encounter_id` must resolve to the same workspace through the server-owned writer before insertion.

Do not enforce clinical normal ranges in this slice. Clinical thresholds are a separate product and medical-governance decision.

## API Contract

Extend the walk-in create input with a nested optional value:

```ts
type ReceptionVitalMeasurementInput = {
  weightKg?: number;
  temperatureC?: number;
  respiratoryRateRpm?: number;
  bloodPressure?: {
    systolicMmhg: number;
    diastolicMmhg: number;
  };
};

type ReceptionWalkInEncounterInput = {
  // Existing walk-in fields remain unchanged.
  vitals?: ReceptionVitalMeasurementInput;
};
```

The server core validates shape and positive values before calling Supabase. The RPC repeats validation and workspace ownership checks because client and route validation are not security boundaries.

Reservation input no longer exposes `weightKg` from the current application flow.

## Transaction And Write Flow

```text
Walk-in form submit
  -> Next.js walk-in route validates workspace membership and input
  -> clair_create_reception_walk_in_encounter creates encounter and queue entry
  -> same RPC inserts patient_vital_measurements using the new encounter ID
  -> if weight is present, same RPC updates patients.weight_kg for compatibility
  -> RPC returns encounter and queue entry
```

All writes occur in one PostgreSQL function transaction. If vital insertion fails, encounter and queue creation roll back as well; the UI shows the existing create failure path and retains the draft for correction.

## Latest-Value Contract

`patient_vital_measurements` is the source of truth for measurement history. The initial implementation adds an index on `(workspace_id, patient_id, measured_at desc)` so later patient/profile readers can efficiently select the latest measurement.

For compatibility, `patients.weight_kg` remains the latest weight snapshot and is updated whenever a new walk-in measurement includes weight. Temperature, respiration, and blood pressure are not duplicated onto `patients`.

Displaying vital history or a latest-vitals patient-profile card is outside this UI slice, but the new table and index must support that next step without another schema redesign.

## Security And RLS

- Enable RLS on `public.patient_vital_measurements` immediately.
- Do not grant direct browser insert/update/delete access.
- Insert only through the server-owned `SECURITY DEFINER` walk-in RPC.
- Keep `revoke all ... from public` and grant execute only to `authenticated` for the RPC.
- The RPC must call the existing active-workspace-member check and verify patient and encounter ownership inside `p_workspace_id`.
- Use `p_actor_user_id` only after confirming it is the authenticated server actor already enforced by the route/gateway path.
- Add patient/time and encounter indexes; run Supabase security and performance advisors after local schema verification and before any approved remote application.

## Input And Validation States

- Inputs use decimal-friendly numeric input behavior where decimals are valid.
- Empty optional rows are allowed in the form and omitted from the API measurement payload.
- Weight, temperature, and respiration expose field-level positive-number errors.
- Blood pressure requires both values together; one-sided input blocks submission and identifies the missing side.
- Units are fixed suffixes and are not editable.
- A fully empty vital draft creates the walk-in reception without a measurement row.
- Submit failure preserves the current vital draft and exposes the existing form-level error feedback.

## Accessibility

- Trigger exposes `aria-expanded` and `aria-controls`.
- Dropdown uses menu semantics and options are keyboard reachable.
- Remove actions include the vital name, such as `체온 삭제`.
- Blood-pressure inputs have separate accessible names for systolic and diastolic.
- Addition and removal are announced through an `aria-live` status region.

## Migration And Deployment Boundary

- Create a new migration file; do not edit previously applied reception migrations.
- Verify with local Supabase reset or an isolated local database path, migration tests, server-core tests, Playwright, typecheck, lint, and build.
- Updating staging or production remains a separate approval-gated action. This design approval authorizes repository implementation and local verification, not remote migration application.

## Out Of Scope

- Reservation-time vital capture.
- Patient-profile or chart UI for browsing measurement history.
- Editing or deleting historical vital measurements.
- Device integration or automatic measurement import.
- Clinical normal-range alerts or diagnosis support.
- Heart-rate capture.
- Remote Supabase migration application or production deployment without a separate approval.

## Review Artifact

- `docs/design/screens/reception/planning/reception-vital-add-dropdown-prototype.html`

The prototype represents walk-in reception and shows dual systolic/diastolic blood-pressure inputs. Reservation creation intentionally has no vital section.
