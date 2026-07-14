# Walk-In Reception Vital History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture optional weight, temperature, respiration, and dual-value blood pressure during walk-in reception as one atomic patient vital-history measurement, while removing all vital input and payload fields from reservation creation.

**Architecture:** Keep the existing Next.js route, permission, gateway, and `SECURITY DEFINER` transaction boundary. Add one forward-only migration that creates `public.patient_vital_measurements` and replaces the latest walk-in RPC with a combined encounter + queue + optional measurement + weight-snapshot transaction. Keep interactive draft state in the existing reception client module, but send only a normalized nested `vitals` DTO through the server-owned route; reservation creation no longer has a vital contract.

**Tech Stack:** Next.js 16.2.6 App Router, React 19.2.4, TypeScript, Base UI-backed CLAiR primitives, Supabase/PostgreSQL migrations and RLS, Playwright 1.59.1, ESLint, local Supabase CLI, `psql`.

## Global Constraints

- Reservation creation contains no vital section, weight state, weight validation, or `weightKg` application payload.
- Appointment check-in weight capture is a separate existing flow and remains unchanged.
- Walk-in creation starts with `체중`; available additions are exactly `체중 kg`, `체온 °C`, `호흡 rpm`, and `혈압 mmHg`. Heart rate is excluded.
- Blood pressure is one row with separate `수축기 혈압` and `이완기 혈압` inputs.
- Vital rows use an exact `10px` gap. When two or more rows exist every row is removable; the last row is never removable.
- Removing a row keeps its current form-draft value in memory. Re-adding the row restores that value. Changing patient resets the draft and reinitializes weight from the selected patient.
- A fully empty visible draft sends no `vitals` object and creates no measurement row. Empty non-blood-pressure rows are allowed.
- A one-sided blood-pressure draft blocks submission and identifies the missing side.
- The add trigger is hidden when all four rows exist. Menu icon tiles use CLAiR Neutral/50 (`#FAFAFA`).
- Trigger focus, menu keyboard navigation, Escape/outside-click dismissal, inserted-input focus, labelled remove actions, and `aria-live` announcements are required.
- `patient_vital_measurements` is the history source of truth. Only submitted weight is also copied to `patients.weight_kg`; temperature, respiration, and blood pressure are not duplicated.
- `measured_at` uses the server submission time (`now()`), not the optional planned reception time.
- Encounter, consultation queue row, optional vital measurement, and compatibility weight update are one PostgreSQL function transaction. A measurement insert failure rolls back all writes.
- Add a new migration. Do not edit any applied migration, including `20260519120000_reception_walk_in_encounter_writer.sql` or `20260616090822_den_512_reception_walkin_event_time_writer.sql`.
- No new dependency is allowed.
- No remote Supabase migration, staging/production DB change, real-data access, deployment, or provider side effect is authorized by this plan.
- Before UI implementation, start local Storybook and query `clair_storybook` for Popover, Input, and Button props. Before route/client implementation, reread the repository-local Next.js guides `15-route-handlers.md`, `05-server-and-client-components.md`, and `data-security.md` from `node_modules/next/dist/docs/`.

---

## File Structure

- Create: `tests/reception-vital-measurement-migration.spec.ts`
  - Static RED/GREEN contract for table columns, checks, tenant foreign keys, RLS posture, indexes, nested-vitals RPC parsing, actor binding, and transaction ordering.
- Create: `supabase/migrations/20260714113000_reception_vital_measurement_history.sql`
  - Forward-only table/RLS/index migration and the complete latest definition of `clair_create_reception_walk_in_encounter`.
- Create: `supabase/snippets/reception_vital_measurement_transaction_replay.sql`
  - Local-only authenticated RPC readback, direct-write denial, and forced vital-insert rollback proof.
- Modify: `src/features/reception/walk-in-encounter.ts`
  - Public nested vital DTO and walk-in request contract.
- Modify: `src/features/reception/server-walk-in-encounter-core.ts`
  - Runtime shape validation, numeric normalization, mock/Supabase gateway payloads, and compatibility weight update.
- Modify: `tests/reception-walk-in-encounter-server.spec.ts`
  - Route/core/gateway tests for nested vitals, empty omission, invalid values, dual blood pressure, and safe DB failure mapping.
- Modify: `src/features/reception/appointment-create.ts`
  - Remove reservation `weightKg` from the application input type.
- Modify: `src/features/reception/server-appointment-create-core.ts`
  - Remove reservation weight normalization, validation, and mock patient mutation.
- Modify: `tests/reception-appointment-create-server.spec.ts`
  - Prove reservation API/RPC payloads omit weight while existing scheduling and permission behavior stays green.
- Modify: `src/features/reception/module.tsx`
  - Remove reservation vital UI in both drawer presentations; add controlled walk-in vital draft rows, menu, validation, focus, and nested payload.
- Modify: `tests/reception.spec.ts`
  - Browser coverage for add/remove/restore, all-options-hidden trigger, blood-pressure pairing, accessibility, styling, nested payload, and reservation non-exposure.
- Modify after verification: `docs/work/reception/RECEPTION-QA-PR-011-create-vital-add-dropdown.md`
- Modify after verification: `docs/work/index.md`
- Modify after verification: `docs/superpowers/specs/2026-07-14-reception-vital-add-dropdown-design.md`
- Modify after verification: `docs/engineering/current-status.md`
- Create after verification: `docs/completed/reception/YYYY-MM-DD-reception-vital-measurement-history-closeout.html` using the actual verification date.

---

### Task 1: Lock the Migration Contract in RED

**Files:**
- Create: `tests/reception-vital-measurement-migration.spec.ts`
- Test: `tests/reception-vital-measurement-migration.spec.ts`

**Interfaces:**
- Consumes: approved table/RPC contract from `docs/superpowers/specs/2026-07-14-reception-vital-add-dropdown-design.md`.
- Produces: exact migration filename and SQL source expectations used by Task 2.

- [ ] **Step 1: Write the failing migration test**

Create the test with these assertions:

```ts
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const migrationPath =
  "supabase/migrations/20260714113000_reception_vital_measurement_history.sql";
const migration = readFileSync(migrationPath, "utf8");

test("vital history migration defines a tenant-bound measurement set", () => {
  expect(migration).toContain("create table public.patient_vital_measurements");
  for (const column of [
    "workspace_id text not null",
    "patient_id uuid not null",
    "encounter_id uuid not null",
    "measured_at timestamptz not null",
    "recorded_by_user_id uuid not null",
    "weight_kg numeric(6,2)",
    "temperature_c numeric(4,1)",
    "respiratory_rate_rpm integer",
    "blood_pressure_systolic_mmhg integer",
    "blood_pressure_diastolic_mmhg integer",
  ]) expect(migration).toContain(column);

  expect(migration).toContain(
    "foreign key (workspace_id, patient_id) references public.patients(workspace_id, id)",
  );
  expect(migration).toContain(
    "foreign key (workspace_id, encounter_id) references public.encounters(workspace_id, id)",
  );
  expect(migration).toContain("patient_vital_measurements_has_value_check");
  expect(migration).toContain("patient_vital_measurements_positive_values_check");
  expect(migration).toContain("patient_vital_measurements_blood_pressure_pair_check");
});

test("vital history migration denies direct browser writes and adds history indexes", () => {
  expect(migration).toContain(
    "alter table public.patient_vital_measurements enable row level security",
  );
  expect(migration).toContain(
    "revoke all privileges on table public.patient_vital_measurements from public, anon, authenticated",
  );
  expect(migration).not.toMatch(/grant\s+(insert|update|delete|all).*patient_vital_measurements/i);
  expect(migration).toContain("patient_vital_measurements_workspace_patient_measured_idx");
  expect(migration).toContain("patient_vital_measurements_workspace_encounter_idx");
});

test("walk-in RPC binds the actor and writes nested vitals in the same function", () => {
  expect(migration).toContain(
    "create or replace function public.clair_create_reception_walk_in_encounter",
  );
  expect(migration).toContain("v_vitals := p_walk_in -> 'vitals'");
  expect(migration).toContain("v_actor_user_id <> auth.uid()");
  expect(migration).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(migration).toContain("insert into public.encounters");
  expect(migration).toContain("insert into public.waiting_queue_entries");
  expect(migration).toContain("insert into public.patient_vital_measurements");
  expect(migration).toContain("weight_kg = v_weight_kg");
  expect(migration.indexOf("insert into public.encounters")).toBeLessThan(
    migration.indexOf("insert into public.patient_vital_measurements"),
  );
  expect(migration).toContain(
    "grant execute on function public.clair_create_reception_walk_in_encounter(text, text, jsonb) to authenticated",
  );
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx playwright test tests/reception-vital-measurement-migration.spec.ts --reporter=line
```

Expected: FAIL while loading the test because `20260714113000_reception_vital_measurement_history.sql` does not exist. A failure from another test or dependency is not the intended RED state.

- [ ] **Step 3: Commit the RED contract**

```bash
git add tests/reception-vital-measurement-migration.spec.ts
git commit -m "test: define reception vital history migration contract"
```

---

### Task 2: Implement the Forward Migration and Atomic RPC

**Files:**
- Create: `supabase/migrations/20260714113000_reception_vital_measurement_history.sql`
- Test: `tests/reception-vital-measurement-migration.spec.ts`

**Interfaces:**
- Consumes: `p_walk_in->'vitals'` with camelCase API fields and the existing RPC signature `(text, text, jsonb)`.
- Produces: `public.patient_vital_measurements` and the latest `public.clair_create_reception_walk_in_encounter` transaction.

- [ ] **Step 1: Create the measurement table, checks, tenant foreign keys, indexes, and deny-by-default RLS posture**

Use these exact schema decisions in the new migration:

```sql
create table public.patient_vital_measurements (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  patient_id uuid not null,
  encounter_id uuid not null,
  measured_at timestamptz not null,
  recorded_by_user_id uuid not null references public.users(id) on delete restrict,
  weight_kg numeric(6,2),
  temperature_c numeric(4,1),
  respiratory_rate_rpm integer,
  blood_pressure_systolic_mmhg integer,
  blood_pressure_diastolic_mmhg integer,
  created_at timestamptz not null default now(),
  constraint patient_vital_measurements_has_value_check check (
    num_nonnulls(
      weight_kg,
      temperature_c,
      respiratory_rate_rpm,
      blood_pressure_systolic_mmhg,
      blood_pressure_diastolic_mmhg
    ) > 0
  ),
  constraint patient_vital_measurements_positive_values_check check (
    (weight_kg is null or weight_kg > 0)
    and (temperature_c is null or temperature_c > 0)
    and (respiratory_rate_rpm is null or respiratory_rate_rpm > 0)
    and (blood_pressure_systolic_mmhg is null or blood_pressure_systolic_mmhg > 0)
    and (blood_pressure_diastolic_mmhg is null or blood_pressure_diastolic_mmhg > 0)
  ),
  constraint patient_vital_measurements_blood_pressure_pair_check check (
    (blood_pressure_systolic_mmhg is null) =
    (blood_pressure_diastolic_mmhg is null)
  )
);

alter table public.patient_vital_measurements
  add constraint patient_vital_measurements_patient_workspace_fk
  foreign key (workspace_id, patient_id)
  references public.patients(workspace_id, id)
  on delete cascade;

alter table public.patient_vital_measurements
  add constraint patient_vital_measurements_encounter_workspace_fk
  foreign key (workspace_id, encounter_id)
  references public.encounters(workspace_id, id)
  on delete cascade;

create index patient_vital_measurements_workspace_patient_measured_idx
  on public.patient_vital_measurements (workspace_id, patient_id, measured_at desc);

create index patient_vital_measurements_workspace_encounter_idx
  on public.patient_vital_measurements (workspace_id, encounter_id);

alter table public.patient_vital_measurements enable row level security;
revoke all privileges on table public.patient_vital_measurements
  from public, anon, authenticated;
```

Do not create an authenticated table policy in this slice. The table remains inaccessible directly to browser roles; the security-definer writer is the only write entry.

- [ ] **Step 2: Replace the walk-in RPC with the complete latest behavior**

Copy the current event-time function body from `20260616090822_den_512_reception_walkin_event_time_writer.sql`, then make these exact changes in the new definition:

```sql
declare
  v_actor_user_id uuid;
  v_patient_id uuid := nullif(p_walk_in->>'patientId', '')::uuid;
  v_guardian_id uuid := nullif(p_walk_in->>'guardianId', '')::uuid;
  v_primary_veterinarian_id uuid := nullif(p_walk_in->>'primaryVeterinarianId', '')::uuid;
  v_planned_start_at timestamptz := nullif(p_walk_in->>'plannedStartAt', '')::timestamptz;
  v_vitals jsonb := p_walk_in -> 'vitals';
  v_weight_kg numeric(6,2);
  v_temperature_c numeric(4,1);
  v_respiratory_rate_rpm integer;
  v_blood_pressure_systolic_mmhg integer;
  v_blood_pressure_diastolic_mmhg integer;
  v_has_measurement boolean := false;
  v_encounter_id uuid;
  v_queue_entry_id uuid;
  v_now timestamptz := now();
  v_event_time timestamptz := coalesce(v_planned_start_at, v_now);
  v_encounter_no text := 'E-' || to_char(v_event_time at time zone 'Asia/Seoul', 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_duration_minutes integer := nullif(p_walk_in->>'durationMinutes', '')::integer;
  v_visit_purpose text := nullif(btrim(p_walk_in->>'visitPurpose'), '');
  v_encounter_row jsonb;
  v_queue_row jsonb;
begin
  begin
    v_actor_user_id := nullif(p_actor_user_id, '')::uuid;
  exception when invalid_text_representation then
    raise exception 'actor_mismatch';
  end;

  if v_actor_user_id is null or v_actor_user_id <> auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if p_walk_in ? 'vitals' then
    if jsonb_typeof(v_vitals) <> 'object' then
      raise exception 'invalid_vitals';
    end if;

    if (v_vitals ? 'weightKg' and jsonb_typeof(v_vitals->'weightKg') <> 'number')
      or (v_vitals ? 'temperatureC' and jsonb_typeof(v_vitals->'temperatureC') <> 'number')
      or (v_vitals ? 'respiratoryRateRpm' and jsonb_typeof(v_vitals->'respiratoryRateRpm') <> 'number')
      or (v_vitals ? 'bloodPressure' and jsonb_typeof(v_vitals->'bloodPressure') <> 'object') then
      raise exception 'invalid_vitals';
    end if;

    begin
      v_weight_kg := nullif(v_vitals->>'weightKg', '')::numeric(6,2);
      v_temperature_c := nullif(v_vitals->>'temperatureC', '')::numeric(4,1);
      v_respiratory_rate_rpm := nullif(v_vitals->>'respiratoryRateRpm', '')::integer;

      if v_vitals ? 'bloodPressure' then
        if jsonb_typeof(v_vitals->'bloodPressure'->'systolicMmhg') <> 'number'
          or jsonb_typeof(v_vitals->'bloodPressure'->'diastolicMmhg') <> 'number' then
          raise exception 'invalid_vitals';
        end if;
        v_blood_pressure_systolic_mmhg :=
          nullif(v_vitals #>> '{bloodPressure,systolicMmhg}', '')::integer;
        v_blood_pressure_diastolic_mmhg :=
          nullif(v_vitals #>> '{bloodPressure,diastolicMmhg}', '')::integer;
      end if;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'invalid_vitals';
    end;
  end if;

  if (v_weight_kg is not null and v_weight_kg <= 0)
    or (v_temperature_c is not null and v_temperature_c <= 0)
    or (v_respiratory_rate_rpm is not null and v_respiratory_rate_rpm <= 0)
    or (v_blood_pressure_systolic_mmhg is not null and v_blood_pressure_systolic_mmhg <= 0)
    or (v_blood_pressure_diastolic_mmhg is not null and v_blood_pressure_diastolic_mmhg <= 0)
    or ((v_blood_pressure_systolic_mmhg is null) <>
        (v_blood_pressure_diastolic_mmhg is null)) then
    raise exception 'invalid_vitals';
  end if;

  v_has_measurement := num_nonnulls(
    v_weight_kg,
    v_temperature_c,
    v_respiratory_rate_rpm,
    v_blood_pressure_systolic_mmhg,
    v_blood_pressure_diastolic_mmhg
  ) > 0;
```

The new migration must contain the complete function body; do not leave an ellipsis or a "keep existing code" placeholder in SQL. Starting from the exact body in `20260616090822_den_512_reception_walkin_event_time_writer.sql`, preserve these verified operations and predicates in their current order:

1. active patient lookup by `workspace_id`, `patient_id`, and `status = 'active'`;
2. optional guardian lookup plus patient-guardian link lookup in the same workspace;
3. optional active veterinarian membership lookup requiring the `vet` role;
4. encounter insert with `checked_in_at = v_event_time`, `created_at = v_now`, and `updated_at = v_event_time`;
5. consultation queue insert with `entered_at = v_event_time`;
6. encounter and queue JSON projections followed by the same `{ encounter, queueEntry }` return object.

Immediately after the queue insert and before either JSON projection, add:

```sql
  if v_has_measurement then
    if not exists (
      select 1
      from public.encounters e
      where e.workspace_id = p_workspace_id
        and e.patient_id = v_patient_id
        and e.id = v_encounter_id
    ) then
      raise exception 'encounter_unavailable';
    end if;

    insert into public.patient_vital_measurements (
      workspace_id,
      patient_id,
      encounter_id,
      measured_at,
      recorded_by_user_id,
      weight_kg,
      temperature_c,
      respiratory_rate_rpm,
      blood_pressure_systolic_mmhg,
      blood_pressure_diastolic_mmhg
    ) values (
      p_workspace_id,
      v_patient_id,
      v_encounter_id,
      v_now,
      v_actor_user_id,
      v_weight_kg,
      v_temperature_c,
      v_respiratory_rate_rpm,
      v_blood_pressure_systolic_mmhg,
      v_blood_pressure_diastolic_mmhg
    );

    if v_weight_kg is not null then
      update public.patients
      set weight_kg = v_weight_kg,
          updated_at = v_now
      where workspace_id = p_workspace_id
        and id = v_patient_id;
    end if;
  end if;
```

Declare the function with `security definer` and `set search_path = public, private, extensions, pg_temp`. Finish the migration with these exact access statements and update the function comment to describe the atomic optional vital-history write:

```sql
revoke all on function public.clair_create_reception_walk_in_encounter(text, text, jsonb)
  from public;
grant execute on function public.clair_create_reception_walk_in_encounter(text, text, jsonb)
  to authenticated;
```

- [ ] **Step 3: Run the migration contract and verify GREEN**

```bash
npx playwright test tests/reception-vital-measurement-migration.spec.ts --reporter=line
git diff --check
```

Expected: 3 tests pass and the diff has no whitespace errors.

- [ ] **Step 4: Commit the database contract**

```bash
git add supabase/migrations/20260714113000_reception_vital_measurement_history.sql tests/reception-vital-measurement-migration.spec.ts
git commit -m "feat: add atomic walk-in vital history writer"
```

---

### Task 3: Move Walk-In API and Server Validation to Nested Vitals

**Files:**
- Modify: `src/features/reception/walk-in-encounter.ts`
- Modify: `src/features/reception/server-walk-in-encounter-core.ts`
- Modify: `tests/reception-walk-in-encounter-server.spec.ts`

**Interfaces:**
- Consumes: `ReceptionWalkInEncounterInput.vitals` from the route body.
- Produces: normalized `p_walk_in.vitals` for the RPC, or field-specific `400 invalid_input` without calling the gateway.

- [ ] **Step 1: Write failing server tests for the nested contract**

Add tests that pass this complete valid payload through the core and Supabase gateway:

```ts
const validVitals = {
  weightKg: 4.35,
  temperatureC: 38.6,
  respiratoryRateRpm: 24,
  bloodPressure: { systolicMmhg: 132, diastolicMmhg: 84 },
};
```

Assert:

```ts
expect(createPayload?.vitals).toEqual(validVitals);
expect(createPayload).not.toHaveProperty("weightKg");
```

Add table-driven invalid cases for zero/negative/non-finite weight, temperature, respiration, non-integer respiration, non-positive pressure, and one-sided pressure. Use exact error keys:

```ts
type ReceptionVitalFieldErrorKey =
  | "vitals"
  | "vitals.weightKg"
  | "vitals.temperatureC"
  | "vitals.respiratoryRateRpm"
  | "vitals.bloodPressure"
  | "vitals.bloodPressure.systolicMmhg"
  | "vitals.bloodPressure.diastolicMmhg";
```

Also prove `{ vitals: {} }` is normalized to no `vitals` property and still returns 201 through the mock route.

- [ ] **Step 2: Run the new server cases and verify RED**

```bash
npx playwright test tests/reception-walk-in-encounter-server.spec.ts --grep "nested vitals|empty vitals|blood pressure" --reporter=line
```

Expected: FAIL because the current type and gateway still use top-level `weightKg` and do not validate the new fields.

- [ ] **Step 3: Replace the public request type**

Use this exact contract in `walk-in-encounter.ts`:

```ts
export type ReceptionVitalMeasurementInput = {
  weightKg?: number;
  temperatureC?: number;
  respiratoryRateRpm?: number;
  bloodPressure?: {
    systolicMmhg: number;
    diastolicMmhg: number;
  };
};

export type ReceptionWalkInEncounterInput = {
  department?: string;
  durationMinutes?: number;
  guardianId?: string;
  memo?: string;
  patientId: string;
  plannedStartAt?: string;
  primaryVeterinarianId?: string;
  visitPurpose?: string;
  vitals?: ReceptionVitalMeasurementInput;
};
```

- [ ] **Step 4: Validate runtime JSON before normalization and gateway access**

Change `createReceptionWalkInEncounter` to call `validateWalkInInput(input)` before `normalizeWalkInInput(input)`. Validation must treat route JSON as untrusted at runtime, require finite positive numbers, require integer respiration/pressure, and require both pressure values when `bloodPressure` exists.

After validation, normalize weight to two decimals, temperature to one decimal, keep integer fields unchanged, and omit an empty object:

```ts
function normalizeVitals(
  vitals: ReceptionVitalMeasurementInput | undefined,
): ReceptionVitalMeasurementInput | undefined {
  if (!vitals) return undefined;
  const normalized: ReceptionVitalMeasurementInput = {};

  if (vitals.weightKg !== undefined) {
    normalized.weightKg = Math.round(vitals.weightKg * 100) / 100;
  }
  if (vitals.temperatureC !== undefined) {
    normalized.temperatureC = Math.round(vitals.temperatureC * 10) / 10;
  }
  if (vitals.respiratoryRateRpm !== undefined) {
    normalized.respiratoryRateRpm = vitals.respiratoryRateRpm;
  }
  if (vitals.bloodPressure) {
    normalized.bloodPressure = {
      systolicMmhg: vitals.bloodPressure.systolicMmhg,
      diastolicMmhg: vitals.bloodPressure.diastolicMmhg,
    };
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
```

Update the mock compatibility write to `input.vitals?.weightKg`. Keep the Supabase gateway function name and arguments unchanged; only `p_walk_in` changes shape.

- [ ] **Step 5: Run focused and neighboring server tests**

```bash
npx playwright test tests/reception-walk-in-encounter-server.spec.ts tests/reception-mutation-permissions-server.spec.ts tests/live-audit-mutation-emission.spec.ts --reporter=line
npx eslint src/features/reception/walk-in-encounter.ts src/features/reception/server-walk-in-encounter-core.ts tests/reception-walk-in-encounter-server.spec.ts
npx tsc --noEmit --pretty false
```

Expected: all focused tests pass, ESLint has no new errors, and TypeScript passes.

- [ ] **Step 6: Commit the server/API slice**

```bash
git add src/features/reception/walk-in-encounter.ts src/features/reception/server-walk-in-encounter-core.ts tests/reception-walk-in-encounter-server.spec.ts
git commit -m "feat: validate nested walk-in vital input"
```

---

### Task 4: Remove Vitals from Reservation Creation

**Files:**
- Modify: `src/features/reception/appointment-create.ts`
- Modify: `src/features/reception/server-appointment-create-core.ts`
- Modify: `src/features/reception/module.tsx`
- Modify: `tests/reception-appointment-create-server.spec.ts`
- Modify: `tests/reception.spec.ts`

**Interfaces:**
- Consumes: existing reservation scheduling fields only.
- Produces: reservation create payloads that cannot express `weightKg` through the current application type or UI.

- [ ] **Step 1: Change reservation tests to the approved absence contract and verify RED**

Remove `weightKg` from `validInput` in `tests/reception-appointment-create-server.spec.ts`, delete the invalid-weight case, and assert the RPC payload does not own the property:

```ts
expect(rpcPayloads[0]).not.toHaveProperty("weightKg");
```

In `tests/reception.spec.ts`, update `reception creates a reservation through the unified check-in menu` and `reception creates a future dragged calendar range as a reservation` to assert:

```ts
await expect(drawer.getByText("바이탈", { exact: true })).toHaveCount(0);
await expect(drawer.getByLabel("체중")).toHaveCount(0);
await expect(drawer.getByRole("button", { name: "바이탈 추가" })).toHaveCount(0);
expect(latestBody).not.toHaveProperty("weightKg");
```

Run:

```bash
npx playwright test tests/reception-appointment-create-server.spec.ts --reporter=line
npx playwright test tests/reception.spec.ts --grep "creates a reservation through|future dragged calendar range" --reporter=line
```

Expected: RED because the current type/server/UI still retain reservation weight.

- [ ] **Step 2: Remove the reservation application contract**

Delete `weightKg` from `ReceptionAppointmentCreateInput`, `ReceptionAppointmentCreateFieldErrors`, `normalizeAppointmentCreateInput`, `validateAppointmentCreateInput`, and the mock patient update. Do not edit the historical appointment RPC migration; it remains backward compatible with older callers.

- [ ] **Step 3: Remove both reservation UI render paths and payload wiring**

Inside `ReceptionReservationFormDrawer`, remove:

- `weightKg` state;
- `parsedWeightKg` and `weightInvalid`;
- the selected-patient weight reset effect;
- weight from `canCreate`;
- `weightKg` from `ReceptionAppointmentCreateInput`;
- the side-panel `ReceptionSidePanelSection title="바이탈"` block and its following divider;
- the default-drawer `RegistrationFormField label="체중"` block;
- weight clearing from reservation patient-selection reset handlers.

Keep every `ReceptionAppointmentCheckInFormDrawer` weight field and `ReceptionAppointmentCheckInInput.weightKg` unchanged.

- [ ] **Step 4: Run the reservation suite and source scan**

```bash
npx playwright test tests/reception-appointment-create-server.spec.ts --reporter=line
npx playwright test tests/reception.spec.ts --grep "creates a reservation through|future dragged calendar range|reservation drawer disables|reservation create drawer uses DB-backed" --reporter=line
rg -n "weightKg|바이탈 추가|label=\"체중\"" src/features/reception/appointment-create.ts src/features/reception/server-appointment-create-core.ts
```

Expected: focused tests pass and the `rg` command prints no matches. Weight matches may remain in appointment check-in files and walk-in files.

- [ ] **Step 5: Commit the reservation removal**

```bash
git add src/features/reception/appointment-create.ts src/features/reception/server-appointment-create-core.ts src/features/reception/module.tsx tests/reception-appointment-create-server.spec.ts tests/reception.spec.ts
git commit -m "feat: remove vitals from reservation creation"
```

---

### Task 5: Implement the Walk-In Vital Draft UI and Nested Submission

**Files:**
- Modify: `src/features/reception/module.tsx`
- Modify: `tests/reception.spec.ts`

**Interfaces:**
- Consumes: selected patient identity/weight and `ReceptionVitalMeasurementInput` from Task 3.
- Produces: `WalkInReceptionInput.vitals`, controlled draft state, and accessible interactive rows in both walk-in drawer presentations.

- [ ] **Step 1: Start Storybook and query component docs before using props**

Run Storybook in a separate terminal:

```bash
npm run storybook
```

Expected: local Storybook listens on `http://127.0.0.1:6006`. Query `clair_storybook` for `Popover`, `PopoverTrigger`, `PopoverContent`, `Input`, and `Button`. Confirm `render`, `initialFocus`, controlled `open`, and `onOpenChange` against the running docs before editing JSX. If Storybook fails to start, stop this task and report the exact startup error instead of inventing props.

- [ ] **Step 2: Add focused browser tests and verify RED**

Add `walk-in vitals add remove restore and submit as one nested measurement` covering:

1. no vital section before patient selection;
2. patient selection shows only prefilled `체중` and no remove action;
3. keyboard-opened menu focuses its first item;
4. Escape closes and returns focus to `바이탈 추가`;
5. adding temperature yields a `10px` row gap and remove buttons for both rows;
6. the menu icon tile computes to `rgb(250, 250, 250)`;
7. removing temperature, then re-adding it restores the draft value;
8. blood pressure exposes separate systolic/diastolic inputs and one-sided entry blocks create;
9. adding all four rows hides the add trigger;
10. submission sends `vitals`, not top-level `weightKg`.

Add a second test `walk-in empty vital draft creates without a measurement payload` that removes weight after adding an empty temperature row, submits, and asserts the request owns neither `vitals` nor `weightKg`.

Run:

```bash
npx playwright test tests/reception.spec.ts --grep "walk-in vitals|empty vital draft" --reporter=line
```

Expected: RED because the current add button only shows a toast and the request uses top-level weight.

- [ ] **Step 3: Add controlled draft types and the pure payload builder**

Add these module-local contracts near `WalkInReceptionInput`:

```ts
type ReceptionCreateVitalId =
  | "weight"
  | "temperature"
  | "respiration"
  | "bloodPressure";

type ReceptionCreateVitalDraft = {
  selectedIds: ReceptionCreateVitalId[];
  values: {
    weightKg: string;
    temperatureC: string;
    respiratoryRateRpm: string;
    bloodPressureSystolicMmhg: string;
    bloodPressureDiastolicMmhg: string;
  };
};

type ReceptionCreateVitalFieldErrors = Partial<
  Record<
    | "weightKg"
    | "temperatureC"
    | "respiratoryRateRpm"
    | "bloodPressureSystolicMmhg"
    | "bloodPressureDiastolicMmhg",
    string
  >
>;

type WalkInReceptionInput = Omit<ReceptionWalkInEncounterInput, "vitals"> & {
  guardianMobilePhone?: string;
  patientName?: string;
  sendKakaoMessage?: boolean;
  vitals?: ReceptionVitalMeasurementInput;
};
```

Implement a pure builder that only reads selected rows. Empty selected weight/temperature/respiration values are omitted; non-empty invalid values receive field errors; blood pressure is omitted when both sides are empty and errors when only one side is present. Return `{ input: undefined, fieldErrors: {} }` for a fully empty selected draft.

- [ ] **Step 4: Implement the controlled vital rows and menu**

Add `ReceptionCreateVitalFields` in `module.tsx` so it can reuse the existing local `ReceptionSidePanelField`, `ReceptionSidePanelInput`, `RegistrationFormField`, Button, Popover, and CDS icons without exporting or restructuring unrelated primitives.

Use exact option metadata:

```ts
const receptionCreateVitalOptions = [
  { id: "weight", label: "체중", unit: "kg", inputMode: "decimal" },
  { id: "temperature", label: "체온", unit: "°C", inputMode: "decimal" },
  { id: "respiration", label: "호흡", unit: "rpm", inputMode: "numeric" },
  { id: "bloodPressure", label: "혈압", unit: "mmHg", inputMode: "numeric" },
] as const;
```

Implementation rules:

- rows render inside `data-testid="walk-in-vital-rows"` with `className="grid gap-[10px]"`;
- the remove button uses `CdsActionsTrash2Icon` and `aria-label={`${label} 삭제`}`;
- the trigger sets `aria-expanded`, `aria-controls="walk-in-vital-menu"`, and is hidden when no option remains;
- menu content uses `id="walk-in-vital-menu"`, `role="menu"`, and `aria-label="추가할 바이탈 선택"`;
- each option is `role="menuitem"`; its icon wrapper uses `bg-[var(--clair-color-atomic-neutral-50)]`;
- blood pressure uses two numeric Inputs labelled `수축기 혈압` and `이완기 혈압`, separated visually by `/`, with one `mmHg` suffix;
- addition appends without clearing cached values, closes the menu, focuses the first input, and announces `${label} 입력 행이 추가되었습니다.`;
- removal is ignored at one row, otherwise removes only the selected ID, retains values, focuses the add trigger, and announces `${label} 입력 행이 삭제되었습니다.`;
- the live region is visually hidden with `aria-live="polite"` and `aria-atomic="true"`;
- Popover owns outside-click and Escape dismissal; verify focus return in the test.

- [ ] **Step 5: Wire patient reset, validation, both walk-in render paths, and nested submit**

Replace walk-in `weightKg` state with one `ReceptionCreateVitalDraft`. On selected patient change, reset to `selectedIds: ["weight"]`, clear all non-weight values, and initialize weight with `formatPatientWeightKgInput(patient?.weightKg)`.

Render the complete vital section only when a patient is selected:

- side-panel: `ReceptionSidePanelSection title="바이탈"` plus divider;
- default drawer: a dedicated `RegistrationFormSection title="바이탈"`, separate from patient/guardian fields.

Set `canCreate` to require no vital field errors. Build the request as:

```ts
const input: WalkInReceptionInput = {
  department: department || defaultWalkInDepartment,
  durationMinutes,
  guardianId: guardian?.id,
  guardianMobilePhone: guardian?.mobilePhone,
  memo: memo.trim() || undefined,
  patientId: patient.id,
  patientName: patient.name,
  plannedStartAt,
  primaryVeterinarianId: selectedVeterinarianId,
  sendKakaoMessage: presentation === "side-panel" ? false : sendKakaoMessage,
  visitPurpose: trimmedVisitPurpose,
  vitals: vitalBuild.input,
};
```

Do not reset the draft on submit start or submit failure. The existing error toast remains the form-level failure path.

- [ ] **Step 6: Run focused UI, payload, accessibility, and regression tests**

```bash
npx playwright test tests/reception.spec.ts --grep "walk-in vitals|empty vital draft|creates a walk-in waiting row|server-backed walk-in encounter sends minimal|keeps selected veterinarian|registration and reception create side panels" --reporter=line
npx eslint src/features/reception/module.tsx tests/reception.spec.ts
npx tsc --noEmit --pretty false
git diff --check
```

Expected: focused browser tests pass, nested payload assertions pass, and static checks are green.

- [ ] **Step 7: Commit the walk-in UI slice**

```bash
git add src/features/reception/module.tsx tests/reception.spec.ts
git commit -m "feat: add accessible walk-in vital capture"
```

---

### Task 6: Prove Local Insert, Readback, Direct-Write Denial, and Rollback

**Files:**
- Create: `supabase/snippets/reception_vital_measurement_transaction_replay.sql`
- Modify only when runtime proof finds a contract bug: `supabase/migrations/20260714113000_reception_vital_measurement_history.sql`
- Test: `supabase/snippets/reception_vital_measurement_transaction_replay.sql`

**Interfaces:**
- Consumes: local synthetic `clair-demo` actor `00000000-0000-4000-8000-000000000004` and patient `19421000-0000-4000-8000-000000000005`.
- Produces: transaction-scoped proof; the top-level `rollback` leaves the local seed unchanged.

- [ ] **Step 1: Create the local-only replay SQL**

The snippet must:

1. `begin` and create a temporary result table;
2. set role `authenticated` and `request.jwt.claim.sub` to the synthetic front-desk actor;
3. catch and assert `insufficient_privilege` for direct table insert;
4. call `clair_create_reception_walk_in_encounter` with all four vital kinds and store the returned JSON;
5. reset role and assert one measurement row, exact values, actor, same workspace/patient/encounter, and updated `patients.weight_kg`;
6. install a transaction-local trigger that raises `forced_vital_insert_failure` before measurement insert;
7. call the RPC inside an exception-catching block with a unique visit purpose;
8. assert no encounter, queue row, or measurement from the forced-failure call exists;
9. drop the trigger and finish with `rollback`.

Use only the synthetic IDs named above. The successful payload is:

```sql
jsonb_build_object(
  'patientId', '19421000-0000-4000-8000-000000000005',
  'guardianId', '19420000-0000-4000-8000-000000000005',
  'durationMinutes', 30,
  'plannedStartAt', '2026-07-14T10:00:00+09:00',
  'visitPurpose', 'RECEPTION-QA-PR-011 vital readback',
  'vitals', jsonb_build_object(
    'weightKg', 3.55,
    'temperatureC', 38.6,
    'respiratoryRateRpm', 24,
    'bloodPressure', jsonb_build_object(
      'systolicMmhg', 132,
      'diastolicMmhg', 84
    )
  )
)
```

The forced-failure trigger function must be `pg_temp.clair_fail_vital_insert()` and raise exactly `forced_vital_insert_failure`, so the exception block can reject any other failure.

- [ ] **Step 2: Start/reset local Supabase and replay the migration**

```bash
npx supabase start
npx supabase db reset --local --yes
npx supabase migration list --local
npx supabase db lint --local --schema public
```

Expected: the full ordered migration directory and synthetic seed replay successfully; the new migration appears applied; DB lint reports no new error. If Docker, Supabase CLI, or local Postgres is unavailable, report `environment_gap` and do not substitute a remote project.

- [ ] **Step 3: Run the transaction replay without printing credentials**

Set `SUPABASE_LOCAL_DB_URL` to a localhost-only connection through the existing secure shell environment, then run:

```bash
psql "$SUPABASE_LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/snippets/reception_vital_measurement_transaction_replay.sql
```

Expected: direct write denial, successful measurement readback, compatibility weight update, and forced rollback assertions all pass; the final top-level transaction rolls back.

- [ ] **Step 4: Re-run static and server tests after runtime proof**

```bash
npx playwright test tests/reception-vital-measurement-migration.spec.ts tests/reception-walk-in-encounter-server.spec.ts --reporter=line
git diff --check
```

Expected: all tests pass. Correct a runtime contract defect in the new migration only; never edit an applied historical migration.

- [ ] **Step 5: Commit the replay proof**

```bash
git add supabase/snippets/reception_vital_measurement_transaction_replay.sql supabase/migrations/20260714113000_reception_vital_measurement_history.sql tests/reception-vital-measurement-migration.spec.ts
git commit -m "test: prove walk-in vital transaction rollback"
```

---

### Task 7: Complete Verification and Durable Handoff

**Files:**
- Modify: `docs/work/reception/RECEPTION-QA-PR-011-create-vital-add-dropdown.md`
- Modify: `docs/work/index.md`
- Modify: `docs/superpowers/specs/2026-07-14-reception-vital-add-dropdown-design.md`
- Modify: `docs/engineering/current-status.md`
- Create: `docs/completed/reception/YYYY-MM-DD-reception-vital-measurement-history-closeout.html` using the actual verification date.

**Interfaces:**
- Consumes: only commands and evidence actually completed in Tasks 1-6.
- Produces: Human Review status and a truthful local-only implementation record.

- [ ] **Step 1: Run the final focused suite**

```bash
npx playwright test tests/reception-vital-measurement-migration.spec.ts tests/reception-walk-in-encounter-server.spec.ts tests/reception-appointment-create-server.spec.ts tests/reception-mutation-permissions-server.spec.ts tests/live-audit-mutation-emission.spec.ts --reporter=line
npx playwright test tests/reception.spec.ts --grep "walk-in vitals|empty vital draft|creates a walk-in waiting row|server-backed walk-in encounter sends minimal|creates a reservation through|future dragged calendar range|reservation drawer disables|keeps selected veterinarian" --reporter=line
```

Expected: all selected tests pass. Record exact pass counts from the real output.

- [ ] **Step 2: Run repository gates**

```bash
npm run security:secrets
npm run lint
npx tsc --noEmit --pretty false
npm run docs:check
git diff --check
npm run build
```

Expected: every command passes. Do not record a pass for a skipped, timed-out, or blocked command.

- [ ] **Step 3: Update the work item and source status**

After all required local verification passes:

- set `RECEPTION-QA-PR-011` and its index row to `human_review`, not `done`;
- change the design spec status from `approved` to `implemented`;
- add exact verification commands/results and the local-only DB replay result to the work item;
- update the reception row in `current-status.md` with the nested API, atomic RPC, and walk-in-only UI boundary;
- create a concise Korean HTML closeout linking the spec, plan, migration, server type, UI module, tests, and work item;
- state explicitly that remote Supabase migration application, production DB verification, real data, history browsing, and deployment were not performed.

- [ ] **Step 4: Review the complete diff and scope exclusions**

```bash
git status --short
git diff --stat origin/main...HEAD
git diff --name-status origin/main...HEAD
git diff --check origin/main...HEAD
rg -n "weightKg" src/features/reception/appointment-create.ts src/features/reception/server-appointment-create-core.ts
```

Expected: only the files in this plan are changed; appointment create files contain no `weightKg`; appointment check-in remains intact; no `.env*`, remote config, provider file, or previously applied migration changed.

- [ ] **Step 5: Commit verified documentation**

```bash
git add docs/work/reception/RECEPTION-QA-PR-011-create-vital-add-dropdown.md docs/work/index.md docs/superpowers/specs/2026-07-14-reception-vital-add-dropdown-design.md docs/engineering/current-status.md docs/completed/reception/*-reception-vital-measurement-history-closeout.html
git commit -m "docs: record walk-in vital history verification"
```

---

## Final Review Checklist

- [ ] Migration tests were observed RED before the new migration existed.
- [ ] The migration is additive and no applied migration changed.
- [ ] Measurement history stores workspace, patient, encounter, server time, actor, and exactly the approved value columns.
- [ ] Table checks reject empty rows, non-positive values, and one-sided blood pressure.
- [ ] Composite foreign keys and RPC checks prevent cross-workspace patient/encounter links.
- [ ] RLS is enabled and authenticated browser roles have no direct table write privilege.
- [ ] RPC binds `p_actor_user_id` to `auth.uid()` before recording the actor.
- [ ] Encounter, queue, measurement, and weight snapshot writes are one transaction.
- [ ] Forced measurement failure proves encounter and queue rollback in local PostgreSQL.
- [ ] Empty vitals create the walk-in without a measurement row.
- [ ] Weight updates both history and `patients.weight_kg`; other vitals do not update `patients`.
- [ ] Reservation create type, server core, both UI presentations, and payload contain no vitals or weight.
- [ ] Appointment check-in weight behavior remains unchanged.
- [ ] Walk-in UI covers add, remove, last-row protection, restore, all-options hiding, patient reset, and exact units.
- [ ] Blood pressure has separate accessible inputs and pair validation.
- [ ] `10px` row gap, Neutral/50 menu tiles, focus, Escape, outside click, and `aria-live` are verified.
- [ ] Submit failure preserves the unsaved draft.
- [ ] Focused tests, local DB replay, lint, typecheck, docs check, secret scan, diff check, and build are recorded truthfully.
- [ ] Remote Supabase and production DB operations remain unperformed pending separate approval.

## Execution Handoff

Plan execution must start from `codex/walk-in-vital-history-implementation` in the isolated worktree. Use one of these execution modes:

1. **Subagent-Driven** — use `superpowers:subagent-driven-development`, one fresh worker per task with review between tasks.
2. **Inline Execution** — use `superpowers:executing-plans`, execute the seven tasks in this session with review checkpoints.

Do not run either mode until 승욱 selects it.
