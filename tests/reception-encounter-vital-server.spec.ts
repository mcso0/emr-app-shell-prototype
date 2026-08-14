import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createSupabaseReceptionEncounterVitalGateway,
  readReceptionEncounterVital,
  type SupabaseReceptionEncounterVitalClient,
} from "../src/features/reception/server-encounter-vital";
import type { PermissionId } from "../src/types/emr-domain";

const workspaceId = "workspace-clair-cheongdam";
const encounterId = "3d852df9-080b-4cec-81b5-7b5e98514d3d";
const patientId = "49121000-0000-4000-8000-000000000004";
const actorUserId = "49110000-0000-4000-8000-000000000004";

test("reception encounter vital read requires reception view before calling the gateway", async () => {
  let gatewayCalled = false;
  const result = await readReceptionEncounterVital({
    actorUserId,
    encounterId,
    gateway: {
      async readEncounterVital() {
        gatewayCalled = true;
        return { ok: true, vital: createVital() };
      },
    },
    permissionAdapter: createPermissionAdapter(["patient:view"]),
    workspaceId,
  });

  expect(result).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });
  expect(gatewayCalled).toBe(false);
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
    permissionAdapter: createPermissionAdapter(["reception:view"]),
    workspaceId,
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    enforcedBy: "reception-encounter-vital-read",
    vital: { patientId, encounterId, temperatureC: 38.7 },
  });
  expect(calls).toEqual([{ encounterId, workspaceId }]);
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

function createPermissionAdapter(permissionIds: PermissionId[]) {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: actorUserId, status: "active" }],
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
        status: "active",
      },
    ],
  });
}
