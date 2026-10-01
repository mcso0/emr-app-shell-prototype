import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createSupabaseChartPatientVitalWriteGateway,
  createSupabasePatientLatestVitalGateway,
  createSupabasePatientVitalWriteGateway,
  readPatientLatestVital,
  validatePatientVitalWriteInput,
  writePatientVital,
  type SupabasePatientVitalClient,
} from "../src/features/patient-vitals/server-patient-vital";
import { createDefaultWorkspaceVitalSettingsSnapshot } from "../src/features/patient-vitals/workspace-vital-settings";
import type { PermissionId } from "../src/types/emr-domain";

const workspaceId = "clair-demo";
const encounterId = "19426000-0000-4000-8000-000000000001";
const patientId = "19421000-0000-4000-8000-000000000001";
const actorUserId = "19410000-0000-4000-8000-000000000001";

const validVitals = {
  weightKg: 4.82,
  temperatureC: 38.7,
  heartRateBpm: 88,
  respiratoryRateRpm: 24,
  bloodPressureSystolicMmhg: 132,
  bloodPressureDiastolicMmhg: 86,
};

test("today vital writer rejects front-desk members even when they have vital:write", async () => {
  let gatewayCalled = false;
  const result = await writePatientVital({
    actorUserId,
    encounterId,
    gateway: {
      async writeVital() {
        gatewayCalled = true;
        return { ok: true, vital: createVital() };
      },
    },
    input: validVitals,
    permissionAdapter: createPermissionAdapter({ roles: ["front_desk"], permissionIds: ["vital:write"] }),
    workspaceId,
  });

  expect(result).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "vital_writer_role_required",
  });
  expect(gatewayCalled).toBe(false);
});

test("today vital writer sends one normalized mutable record to the server gateway", async () => {
  const calls: unknown[] = [];
  const result = await writePatientVital({
    actorUserId,
    encounterId,
    gateway: {
      async writeVital(input) {
        calls.push(input);
        return { ok: true, vital: createVital() };
      },
    },
    input: validVitals,
    permissionAdapter: createPermissionAdapter({ roles: ["technician"], permissionIds: ["vital:write"] }),
    workspaceId,
  });

  expect(result).toMatchObject({ ok: true, status: 200, enforcedBy: "patient-vital-write" });
  expect(calls).toEqual([
    {
      actorUserId,
      encounterId,
      values: validVitals,
      workspaceId,
    },
  ]);
});

test("today vital writer allows an active hospital administrator with vital:write", async () => {
  const calls: unknown[] = [];
  const result = await writePatientVital({
    actorUserId,
    encounterId,
    gateway: {
      async writeVital(input) {
        calls.push(input);
        return { ok: true, vital: createVital() };
      },
    },
    input: validVitals,
    permissionAdapter: createPermissionAdapter({
      roles: ["hospital_admin"],
      permissionIds: ["vital:write"],
    }),
    workspaceId,
  });

  expect(result).toMatchObject({ ok: true, status: 200, enforcedBy: "patient-vital-write" });
  expect(calls).toHaveLength(1);
});

test("hospital administrator eligibility never bypasses vital:write", async () => {
  let gatewayCalled = false;
  const result = await writePatientVital({
    actorUserId,
    encounterId,
    gateway: {
      async writeVital() {
        gatewayCalled = true;
        return { ok: true, vital: createVital() };
      },
    },
    input: validVitals,
    permissionAdapter: createPermissionAdapter({
      roles: ["hospital_admin"],
      permissionIds: ["chart:update"],
    }),
    workspaceId,
  });

  expect(result).toMatchObject({ ok: false, status: 403, denialReason: "permission_missing" });
  expect(gatewayCalled).toBe(false);
});

test("today vital validation keeps field clearing possible and allows systolic-only blood pressure", () => {
  expect(validatePatientVitalWriteInput({ weightKg: null })).toEqual({
    valid: true,
    values: {
      weightKg: null,
      temperatureC: null,
      heartRateBpm: null,
      respiratoryRateRpm: null,
      bloodPressureSystolicMmhg: null,
      bloodPressureDiastolicMmhg: null,
    },
  });

  const systolicOnly = validatePatientVitalWriteInput({
    bloodPressureSystolicMmhg: 132,
    bloodPressureDiastolicMmhg: null,
  });
  expect(systolicOnly.valid).toBe(true);

  const invalid = validatePatientVitalWriteInput({
    bloodPressureSystolicMmhg: null,
    bloodPressureDiastolicMmhg: 86,
  });
  expect(invalid.valid).toBe(false);
  if (invalid.valid) return;
  expect(invalid.fieldErrors.bloodPressureDiastolicMmhg).toContain("수축기");
});

test("today vital validation applies current required settings to both blood pressure values", () => {
  const settings = createDefaultWorkspaceVitalSettingsSnapshot();
  settings.items = settings.items.map((item) => item.key === "blood_pressure"
    ? { ...item, inputRequired: true }
    : item);

  const invalid = validatePatientVitalWriteInput({
    bloodPressureSystolicMmhg: 132,
    bloodPressureDiastolicMmhg: null,
  }, settings);
  expect(invalid.valid).toBe(false);
  if (invalid.valid) return;
  expect(invalid.fieldErrors.bloodPressureDiastolicMmhg).toContain("이완기");

  const valid = validatePatientVitalWriteInput({
    bloodPressureSystolicMmhg: 132,
    bloodPressureDiastolicMmhg: 86,
  }, settings);
  expect(valid.valid).toBe(true);
});

test("today vital validation rejects values that the stored column would round", () => {
  const invalid = validatePatientVitalWriteInput({
    weightKg: 4.825,
    temperatureC: 38.75,
    respiratoryRateRpm: 24.5,
    heartRateBpm: 88.5,
  });

  expect(invalid.valid).toBe(false);
  if (invalid.valid) return;
  expect(invalid.fieldErrors.weightKg).toContain("둘째");
  expect(invalid.fieldErrors.temperatureC).toContain("첫째");
  expect(invalid.fieldErrors.respiratoryRateRpm).toContain("정수");
  expect(invalid.fieldErrors.heartRateBpm).toContain("정수");
});

test("latest vital read uses the selected encounter only to resolve its patient", async () => {
  const calls: unknown[] = [];
  const result = await readPatientLatestVital({
    actorUserId,
    encounterId,
    gateway: {
      async readLatestVital(input) {
        calls.push(input);
        return { ok: true, vital: createVital() };
      },
    },
    permissionAdapter: createPermissionAdapter({ roles: ["vet"], permissionIds: ["patient:view"] }),
    workspaceId,
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    canWriteVitals: false,
    enforcedBy: "patient-latest-vital-read",
    vital: { patientId, encounterId },
  });
  expect(calls).toEqual([{ encounterId, workspaceId }]);
});

test("Supabase vital gateways call only the approved RPCs and preserve cleared null values", async () => {
  const calls: unknown[] = [];
  const client = {
    async rpc(functionName: string, args: unknown) {
      calls.push([functionName, args]);
      if (
        functionName === "clair_upsert_waiting_encounter_vitals" ||
        functionName === "clair_upsert_chart_encounter_vitals"
      ) {
        return { data: { ...createVital(), temperatureC: null }, error: null };
      }
      return { data: { patientId, vital: { ...createVital(), weightKg: null } }, error: null };
    },
  } as SupabasePatientVitalClient;

  const write = await createSupabasePatientVitalWriteGateway(client).writeVital({
    actorUserId,
    encounterId,
    values: validVitals,
    workspaceId,
  });
  const read = await createSupabasePatientLatestVitalGateway(client).readLatestVital({
    encounterId,
    workspaceId,
  });
  const chartWrite = await createSupabaseChartPatientVitalWriteGateway(
    client,
  ).writeVital({
    actorUserId,
    encounterId,
    values: validVitals,
    workspaceId,
  });

  expect(write.ok).toBe(true);
  if (write.ok) expect(write.vital).not.toHaveProperty("temperatureC");
  expect(read.ok).toBe(true);
  expect(chartWrite.ok).toBe(true);
  if (read.ok && read.vital) expect(read.vital).not.toHaveProperty("weightKg");
  expect(calls).toEqual([
    [
      "clair_upsert_waiting_encounter_vitals",
      {
        p_actor_user_id: actorUserId,
        p_encounter_id: encounterId,
        p_vitals: validVitals,
        p_workspace_id: workspaceId,
      },
    ],
    [
      "clair_get_patient_latest_vital_for_encounter",
      { p_encounter_id: encounterId, p_workspace_id: workspaceId },
    ],
    [
      "clair_upsert_chart_encounter_vitals",
      {
        p_actor_user_id: actorUserId,
        p_encounter_id: encounterId,
        p_vitals: validVitals,
        p_workspace_id: workspaceId,
      },
    ],
  ]);
});

test("vital API routes and migration keep writes server-owned and auditable", () => {
  const writerRoute = readFileSync(
    "src/app/api/workspaces/[workspaceId]/chart/preconsultation-vitals/route.ts",
    "utf8",
  );
  const chartWriterRoute = readFileSync(
    "src/app/api/workspaces/[workspaceId]/chart/encounter-vitals/route.ts",
    "utf8",
  );
  const sharedWriterRoute = readFileSync(
    "src/features/patient-vitals/server-patient-vital-route.ts",
    "utf8",
  );
  const readerRoute = readFileSync(
    "src/app/api/workspaces/[workspaceId]/patient-vitals/latest/route.ts",
    "utf8",
  );
  const migration = readdirSync("supabase/migrations")
    .filter((fileName) => fileName.includes("chart_waiting_vital"))
    .sort()
    .map((fileName) => readFileSync(`supabase/migrations/${fileName}`, "utf8"))
    .join("\n");

  expect(writerRoute).toContain('mode: "waiting"');
  expect(chartWriterRoute).toContain('mode: "chart"');
  expect(sharedWriterRoute).toContain("readServerSession");
  expect(sharedWriterRoute).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(sharedWriterRoute).toContain("writePatientVital");
  expect(readerRoute).toContain("readPatientLatestVital");
  expect(migration).toContain("clair_upsert_waiting_encounter_vitals");
  expect(migration).toContain("clair_get_patient_latest_vital_for_encounter");
  expect(migration).toContain("'vital:write'");
  expect(migration).toContain("array['hospital_admin', 'vet', 'technician']");
  expect(migration).toContain("workspace_membership_job_position_assignments");
  expect(migration).toContain("cleared_at");
  expect(migration).toContain("cleared_by_user_id");
  expect(migration).toContain("v_encounter.status <> 'waiting'");
  expect(migration).toContain("v_queue.status <> 'waiting'");
  expect(
    `${writerRoute}\n${chartWriterRoute}\n${sharedWriterRoute}\n${readerRoute}\n${migration}`,
  ).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET/i,
  );
});

test("patient context bars expose opt-in profile and vital actions across clinical modules", () => {
  const contextBar = readFileSync("src/components/emr/patient-context-bar.tsx", "utf8");
  const chart = readFileSync("src/features/chart/module.tsx", "utf8");
  const dispensing = readFileSync("src/features/dispensing/module.tsx", "utf8");
  const labImaging = readFileSync("src/features/lab-imaging/module.tsx", "utf8");
  const latestVitalHook = readFileSync(
    "src/features/patient-vitals/use-patient-latest-vitals.ts",
    "utf8",
  );

  expect(contextBar).not.toContain("PatientVitalPopover");
  expect(contextBar).toContain("CdsActionsPlusIcon");
  expect(contextBar).toContain('data-slot="patient-context-hover-action"');
  expect(contextBar).toContain("ContextBarProfileInteraction");
  expect(contextBar).toContain("ContextBarVitalAction");
  expect(contextBar).toContain('data-slot="patient-context-vital-action"');
  expect(chart).toContain("usePatientLatestVitalItems");
  expect(chart).toContain("patientInteraction");
  expect(chart).toContain("vitalAction");
  expect(dispensing).toContain("usePatientLatestVitalItems");
  expect(dispensing).toContain("vitalAction={vitalAction}");
  expect(dispensing).toContain("patientInteraction={profileInteractions.patientInteraction}");
  expect(labImaging).toContain("usePatientLatestVitalItems");
  expect(labImaging).toContain("vitalAction={vitalAction}");
  expect(labImaging).toContain("patientInteraction={profileInteractions.patientInteraction}");
  expect(latestVitalHook).toContain("createPatientLatestVitalsResource");
  expect(latestVitalHook).toContain("formatPatientVitalDisplayItemsForSettings");
});

test("active chart vital migration preserves waiting-only compatibility and restricts the new RPC", () => {
  const migration = readFileSync(
    "supabase/migrations/20260815100223_chart_active_encounter_vitals.sql",
    "utf8",
  );
  const existingWaitingWriter = readFileSync(
    "supabase/migrations/20260722143000_workspace_vital_settings.sql",
    "utf8",
  );
  const permissionCompatibility = readFileSync(
    "supabase/migrations/20260815102956_chart_vital_permission_policy_compatibility.sql",
    "utf8",
  );

  expect(migration).toContain("clair_upsert_chart_encounter_vitals");
  expect(migration).toContain("set search_path = ''");
  expect(migration).toContain("v_encounter.status = 'waiting'");
  expect(migration).toContain("v_queue.status = 'waiting'");
  expect(migration).toContain("v_encounter.status = 'in_consultation'");
  expect(migration).toContain("v_queue.status = 'in_progress'");
  expect(migration).toContain("from public.user_memberships");
  expect(migration).toContain("'vital:write'");
  expect(migration).toContain("from public, anon");
  expect(migration).toContain("to authenticated");
  expect(existingWaitingWriter).toContain(
    "v_encounter.status <> 'waiting' or v_queue.status <> 'waiting'",
  );
  expect(permissionCompatibility).toContain("public.permission_policies");
  expect(permissionCompatibility).toContain(
    "target_role in ('hospital_admin', 'vet', 'technician')",
  );
  expect(permissionCompatibility).toContain("'[\"vital:write\"]'::jsonb");
  expect(permissionCompatibility).not.toContain("target_role in ('front_desk'");
});

function createVital() {
  return {
    ...validVitals,
    id: "vital-current",
    patientId,
    encounterId,
    measuredAt: "2026-07-20T09:30:00.000Z",
  };
}

function createPermissionAdapter({
  permissionIds,
  roles,
}: {
  permissionIds: PermissionId[];
  roles: Array<"hospital_admin" | "vet" | "technician" | "front_desk">;
}) {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: actorUserId, status: "active" }],
    memberships: [
      {
        id: "membership-vital",
        workspaceId,
        userId: actorUserId,
        roles,
        permissionRole: {
          key: "vital-test-role",
          label: "Vital test role",
          roleType: "custom",
          permissionIds,
        },
        status: "active",
      },
    ],
  });
}
