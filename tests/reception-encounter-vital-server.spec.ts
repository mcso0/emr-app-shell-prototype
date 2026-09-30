import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createSupabaseReceptionEncounterVitalGateway,
  readReceptionEncounterVital,
  type SupabaseReceptionEncounterVitalClient,
} from "../src/features/reception/server-encounter-vital";
import { createDefaultWorkspaceVitalSettingsSnapshot } from "../src/features/patient-vitals/workspace-vital-settings";
import type { PermissionId } from "../src/types/emr-domain";

const workspaceId = "workspace-clair-cheongdam";
const encounterId = "3d852df9-080b-4cec-81b5-7b5e98514d3d";
const patientId = "49121000-0000-4000-8000-000000000004";
const actorUserId = "49110000-0000-4000-8000-000000000004";

test("reception encounter vital read requires reception view before calling the gateway", async () => {
  let gatewayCalled = false;
  let settingsCalled = false;
  const result = await readReceptionEncounterVital({
    actorUserId,
    encounterId,
    gateway: {
      async readEncounterVital() {
        gatewayCalled = true;
        return { ok: true, vital: createVital() };
      },
    },
    settingsGateway: { async get() { settingsCalled = true; return { ok: true, snapshot: createDefaultWorkspaceVitalSettingsSnapshot() }; } },
    permissionAdapter: createPermissionAdapter(["patient:view"]),
    workspaceId,
  });

  expect(result).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });
  expect(gatewayCalled).toBe(false);
  expect(settingsCalled).toBe(false);
});

test("reception encounter vital read returns only the selected encounter measurement", async () => {
  const calls: unknown[] = [];
  const result = await readReceptionEncounterVital({
    actorUserId,
    encounterId,
    gateway: {
      async readEncounterVital(input) {
        calls.push(input);
        return { ok: true, vital: createVital() };
      },
    },
    settingsGateway: { async get(id) { calls.push({ workspaceId: id }); return { ok: true, snapshot: createDefaultWorkspaceVitalSettingsSnapshot() }; } },
    permissionAdapter: createPermissionAdapter(["reception:view"]),
    workspaceId,
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    enforcedBy: "reception-encounter-vital-read",
    vital: { patientId, encounterId, temperatureC: 38.7 },
    vitalSettings: { canManage: false, items: createDefaultWorkspaceVitalSettingsSnapshot().items },
  });
  expect(calls).toEqual([{ encounterId, workspaceId }, { workspaceId }]);
});

test("reception read denies unauthenticated and foreign workspace callers before either gateway", async () => {
  for (const input of [
    { actorUserId: null, workspaceId, status: 401 },
    { actorUserId, workspaceId: "foreign-workspace", status: 403 },
    { actorUserId, workspaceId, status: 403, inactiveUser: true },
    { actorUserId, workspaceId, status: 403, inactiveMember: true },
  ]) {
    let calls = 0;
    const result = await readReceptionEncounterVital({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      encounterId,
      permissionAdapter: createPermissionAdapter(["reception:view"], input),
      gateway: { async readEncounterVital() { calls += 1; return { ok: true, vital: createVital() }; } },
      settingsGateway: { async get() { calls += 1; return { ok: true, snapshot: createDefaultWorkspaceVitalSettingsSnapshot() }; } },
    });
    expect(result).toMatchObject({ ok: false, status: input.status });
    expect(calls).toBe(0);
  }
});

test("reception read reports settings failure separately and never reads settings for an unavailable encounter", async () => {
  let settingsCalls = 0;
  for (const unavailable of [true, false]) {
    const result = await readReceptionEncounterVital({
      actorUserId, workspaceId, encounterId,
      permissionAdapter: createPermissionAdapter(["reception:view"]),
      gateway: { async readEncounterVital() {
        return unavailable ? { ok: false, error: "encounter_unavailable" } : { ok: true, vital: createVital() };
      } },
      settingsGateway: { async get() { settingsCalls += 1; return { ok: false, error: "db_read_failed" }; } },
    });
    expect(result).toMatchObject(unavailable
      ? { ok: false, status: 404, error: "encounter_unavailable" }
      : { ok: false, status: 500, error: "vital_settings_read_failed" });
    expect(settingsCalls).toBe(unavailable ? 0 : 1);
  }
});

test("Supabase reception encounter vital gateway calls the exact encounter RPC", async () => {
  const calls: unknown[] = [];
  const client = {
    async rpc(functionName: string, args: unknown) {
      calls.push([functionName, args]);
      return {
        data: { patientId, vital: { ...createVital(), heartRateBpm: null } },
        error: null,
      };
    },
  } as SupabaseReceptionEncounterVitalClient;

  const result =
    await createSupabaseReceptionEncounterVitalGateway(client).readEncounterVital({
      encounterId,
      workspaceId,
    });

  expect(result.ok).toBe(true);
  if (result.ok && result.vital) {
    expect(result.vital).not.toHaveProperty("heartRateBpm");
  }
  expect(calls).toEqual([
    [
      "clair_get_reception_encounter_vital",
      { p_encounter_id: encounterId, p_workspace_id: workspaceId },
    ],
  ]);
});

test("reception encounter vital route and migration keep the read server-owned and encounter-scoped", () => {
  const route = readFileSync(
    "src/app/api/workspaces/[workspaceId]/reception/encounters/[encounterId]/vital/route.ts",
    "utf8",
  );
  const migration = [
    "supabase/migrations/20260724021247_reception_encounter_vital_read.sql",
    "supabase/migrations/20260724023220_reception_encounter_vital_patient_link_hardening.sql",
  ]
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  expect(route).toContain("readServerSession");
  expect(route).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(route).toContain("readReceptionEncounterVital");
  expect(migration).toContain("clair_get_reception_encounter_vital");
  expect(migration).toContain("'reception:view'");
  expect(migration).toContain("measurement.encounter_id = p_encounter_id");
  expect(migration).toContain("measurement.patient_id = v_patient_id");
  expect(migration).toContain(
    "revoke all on function public.clair_get_reception_encounter_vital(text, uuid) from public, anon",
  );
  expect(migration).toContain(
    "grant execute on function public.clair_get_reception_encounter_vital(text, uuid) to authenticated",
  );
  expect(`${route}\n${migration}`).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET/i,
  );
});

function createVital() {
  return {
    id: "vital-reception",
    patientId,
    encounterId,
    measuredAt: "2026-07-24T10:07:00+09:00",
    weightKg: 8,
    temperatureC: 38.7,
    respiratoryRateRpm: 24,
    bloodPressureSystolicMmhg: 132,
    bloodPressureDiastolicMmhg: 84,
  };
}

function createPermissionAdapter(
  permissionIds: PermissionId[],
  options: { inactiveUser?: boolean; inactiveMember?: boolean } = {},
) {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: actorUserId, status: options.inactiveUser ? "inactive" : "active" }],
    memberships: [
      {
        id: "membership-reception-vital",
        workspaceId,
        userId: actorUserId,
        roles: ["front_desk"],
        permissionRole: {
          key: "reception-vital-reader",
          label: "Reception vital reader",
          roleType: "custom",
          permissionIds,
        },
        status: options.inactiveMember ? "inactive" : "active",
      },
    ],
  });
}
