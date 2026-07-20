import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createSupabasePatientLatestVitalGateway,
  createSupabasePatientVitalWriteGateway,
  readPatientLatestVital,
  validatePatientVitalWriteInput,
  writePatientVital,
  type SupabasePatientVitalClient,
} from "../src/features/patient-vitals/server-patient-vital";
import type { PermissionId } from "../src/types/emr-domain";

const workspaceId = "clair-demo";
const encounterId = "19426000-0000-4000-8000-000000000001";
const patientId = "19421000-0000-4000-8000-000000000001";
const actorUserId = "19410000-0000-4000-8000-000000000001";

const validVitals = {
  weightKg: 4.82,
  temperatureC: 38.7,
  respiratoryRateRpm: 24,
  bloodPressureSystolicMmhg: 132,
  bloodPressureDiastolicMmhg: 86,
};

test("today vital writer requires vital:write and a veterinarian or technician role", async () => {
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

test("today vital validation keeps field clearing possible but requires a complete blood-pressure pair", () => {
  expect(validatePatientVitalWriteInput({ weightKg: null })).toEqual({
    valid: true,
    values: {
      weightKg: null,
      temperatureC: null,
      respiratoryRateRpm: null,
      bloodPressureSystolicMmhg: null,
      bloodPressureDiastolicMmhg: null,
    },
  });

  const invalid = validatePatientVitalWriteInput({
    bloodPressureSystolicMmhg: 132,
    bloodPressureDiastolicMmhg: null,
  });
  expect(invalid.valid).toBe(false);
  if (invalid.valid) return;
  expect(invalid.fieldErrors.bloodPressureSystolicMmhg).toContain("함께");
});

test("today vital validation rejects values that the stored column would round", () => {
  const invalid = validatePatientVitalWriteInput({
    weightKg: 4.825,
    temperatureC: 38.75,
    respiratoryRateRpm: 24.5,
  });

  expect(invalid.valid).toBe(false);
  if (invalid.valid) return;
  expect(invalid.fieldErrors.weightKg).toContain("둘째");
  expect(invalid.fieldErrors.temperatureC).toContain("첫째");
  expect(invalid.fieldErrors.respiratoryRateRpm).toContain("정수");
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
      if (functionName === "clair_upsert_waiting_encounter_vitals") {
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

  expect(write.ok).toBe(true);
  if (write.ok) expect(write.vital).not.toHaveProperty("temperatureC");
  expect(read.ok).toBe(true);
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
  ]);
});

test("vital API routes and migration keep writes server-owned and auditable", () => {
  const writerRoute = readFileSync(
    "src/app/api/workspaces/[workspaceId]/chart/preconsultation-vitals/route.ts",
    "utf8",
  );
  const readerRoute = readFileSync(
    "src/app/api/workspaces/[workspaceId]/patient-vitals/latest/route.ts",
    "utf8",
  );
  const migration = readFileSync(
    "supabase/migrations/20260720100000_chart_waiting_vital_entry.sql",
    "utf8",
  );

  expect(writerRoute).toContain("readServerSession");
  expect(writerRoute).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(writerRoute).toContain("writePatientVital");
  expect(readerRoute).toContain("readPatientLatestVital");
  expect(migration).toContain("clair_upsert_waiting_encounter_vitals");
  expect(migration).toContain("clair_get_patient_latest_vital_for_encounter");
  expect(migration).toContain("'vital:write'");
  expect(migration).toContain("array['vet', 'technician']");
  expect(migration).toContain("workspace_membership_job_position_assignments");
  expect(migration).toContain("cleared_at");
  expect(migration).toContain("cleared_by_user_id");
  expect(migration).toContain("v_encounter.status <> 'waiting'");
  expect(migration).toContain("v_queue.status <> 'waiting'");
  expect(`${writerRoute}\n${readerRoute}\n${migration}`).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET/i,
  );
});

test("patient context bars are display-only latest-vital consumers", () => {
  const contextBar = readFileSync("src/components/emr/patient-context-bar.tsx", "utf8");
  const chart = readFileSync("src/features/chart/module.tsx", "utf8");
  const dispensing = readFileSync("src/features/dispensing/module.tsx", "utf8");
  const labImaging = readFileSync("src/features/lab-imaging/module.tsx", "utf8");

  expect(contextBar).not.toContain("PatientVitalPopover");
  expect(contextBar).not.toContain("CdsActionsPlusIcon");
  expect(chart).toContain("usePatientLatestVitalItems");
  expect(dispensing).toContain("usePatientLatestVitalItems");
  expect(labImaging).toContain("usePatientLatestVitalItems");
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
  roles: Array<"vet" | "technician" | "front_desk">;
}) {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: actorUserId, status: "active" }],
    memberships: [
      {
        id: "membership-vital",
        workspaceId,
        userId: actorUserId,
        roles,
        status: "active",
      },
    ],
    permissionPolicies: roles.map((role) => ({ workspaceId, role, permissionIds })),
  });
}
