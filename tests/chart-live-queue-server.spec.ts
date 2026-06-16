import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createSupabaseChartLiveQueueGateway,
  readChartLiveQueue,
  type SupabaseChartLiveQueueClient,
} from "../src/features/chart/server-chart-live-queue-core";
import type { Encounter, WaitingQueueEntry } from "../src/types/emr-domain";

const workspaceId = "clair-demo";
const firstEncounter: Encounter = {
  id: "19426000-0000-4000-8000-000000000001",
  workspaceId,
  patientId: "19421000-0000-4000-8000-000000000001",
  guardianId: "19420000-0000-4000-8000-000000000001",
  encounterNo: "E-DEN194-0001",
  primaryVeterinarianId: "19410000-0000-4000-8000-000000000001",
  status: "waiting",
  checkedInAt: "2026-05-30T00:00:00.000Z",
  createdAt: "2026-05-30T00:00:00.000Z",
  updatedAt: "2026-05-30T00:00:00.000Z",
};
const secondEncounter: Encounter = {
  ...firstEncounter,
  id: "19426000-0000-4000-8000-000000000002",
  patientId: "19421000-0000-4000-8000-000000000002",
  guardianId: "19420000-0000-4000-8000-000000000002",
  encounterNo: "E-DEN194-0002",
  primaryVeterinarianId: "19410000-0000-4000-8000-000000000002",
};
const billingEncounter: Encounter = {
  ...firstEncounter,
  id: "19426000-0000-4000-8000-000000000099",
  encounterNo: "E-DEN194-BILL",
};
const queueEntry = (encounter: Encounter, queueType: WaitingQueueEntry["queueType"], sortOrder: number) =>
  ({
    id: `queue-${encounter.id}`,
    workspaceId,
    encounterId: encounter.id,
    queueType,
    status: "waiting",
    priority: "normal",
    sortOrder,
    enteredAt: "2026-05-30T01:00:00.000Z",
  }) satisfies WaitingQueueEntry;

test("chart live queue hydrates multiple live encounters without patient-specific bridges", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseChartLiveQueueGateway(
    createFakeChartLiveQueueClient(calls) as unknown as SupabaseChartLiveQueueClient,
  );

  const result = await gateway.listChartQueue({ workspaceId });

  expect(result).toMatchObject({
    ok: true,
    queue: [
      {
        encounter: { id: firstEncounter.id, encounterNo: "E-DEN194-0001" },
        patient: { name: "Kong Synthetic" },
        primaryGuardian: { name: "DEN-194 Guardian 01" },
        veterinarianName: "청담 원장",
      },
      {
        encounter: { id: secondEncounter.id, encounterNo: "E-DEN194-0002" },
        patient: { name: "Nabi Synthetic" },
        primaryGuardian: { name: "DEN-194 Guardian 02" },
        veterinarianName: "김도윤",
      },
    ],
  });
  expect(calls).toEqual([
    "rpc:clair_list_reception_queue:clair-demo",
    "from:patients:clair-demo:19421000-0000-4000-8000-000000000001,19421000-0000-4000-8000-000000000002",
    "from:guardians:clair-demo:19420000-0000-4000-8000-000000000001,19420000-0000-4000-8000-000000000002",
    "from:users::19410000-0000-4000-8000-000000000001,19410000-0000-4000-8000-000000000002",
  ]);
});

test("chart live queue falls back to reception profile lookup when direct profile read is blocked", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseChartLiveQueueGateway(
    createFakeChartLiveQueueClient(calls, { directProfileReadFails: true }) as unknown as SupabaseChartLiveQueueClient,
  );

  const result = await gateway.listChartQueue({ workspaceId });

  expect(result).toMatchObject({
    ok: true,
    queue: [
      {
        encounter: { id: firstEncounter.id },
        patient: { name: "Kong Synthetic" },
        primaryGuardian: { name: "DEN-194 Guardian 01" },
      },
      {
        encounter: { id: secondEncounter.id },
        patient: { name: "Nabi Synthetic" },
        primaryGuardian: { name: "DEN-194 Guardian 02" },
      },
    ],
  });
  expect(calls).toEqual([
    "rpc:clair_list_reception_queue:clair-demo",
    "from:patients:clair-demo:19421000-0000-4000-8000-000000000001,19421000-0000-4000-8000-000000000002",
    "from:guardians:clair-demo:19420000-0000-4000-8000-000000000001,19420000-0000-4000-8000-000000000002",
    "from:users::19410000-0000-4000-8000-000000000001,19410000-0000-4000-8000-000000000002",
    "rpc:clair_search_reception_patient_guardian_lookup:clair-demo",
  ]);
});

test("chart live queue read uses chart view permission and blocks fixture fallback in denied live scope", async () => {
  const denied = await readChartLiveQueue({
    actorUserId: "user-without-chart",
    gateway: {
      async listChartQueue() {
        throw new Error("gateway should not be called");
      },
    },
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-without-chart", status: "active" }],
      memberships: [
        {
          id: "membership-without-chart",
          workspaceId,
          userId: "user-without-chart",
          roles: ["front_desk"],
          status: "active",
        },
      ],
      permissionPolicies: [
        {
          workspaceId,
          role: "front_desk",
          permissionIds: ["reception:view"],
        },
      ],
    }),
    workspaceId,
  });

  expect(denied).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });
});

test("chart live queue route stays server-owned and separate from demo encounter bridge", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/chart/live-queue/route.ts",
    "utf8",
  );
  const serverSource = readFileSync("src/features/chart/server-chart-live-queue.ts", "utf8");
  const coreSource = readFileSync(
    "src/features/chart/server-chart-live-queue-core.ts",
    "utf8",
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(routeSource).toContain("createSupabaseChartLiveQueueGateway");
  expect(serverSource).toContain('import "server-only"');
  expect(coreSource).toContain('from("patients")');
  expect(coreSource).toContain('from("guardians")');
  expect(coreSource).toContain('from("users")');
  expect(coreSource).not.toContain("stagingDemoEncounterNoCandidates");
  expect(`${routeSource}\n${serverSource}\n${coreSource}`).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET/i,
  );
});

test("Cheongdam prepared-empty mode keeps live chart queue records visible", () => {
  const moduleSource = readFileSync("src/features/chart/module.tsx", "utf8");

  expect(moduleSource).toContain("const items = useMemo(");
  expect(moduleSource).toContain("liveMode\n        ? liveItems");
  expect(moduleSource).toContain(
    "preparedEmptyClinic\n          ? emptyChartQueueItems\n          : mockItems",
  );
  expect(moduleSource).not.toContain(
    "const items = preparedEmptyClinic ? [] : liveMode ? liveItems : mockItems;",
  );
});

test("Cheongdam live chart selection recovers live encounters without legacy fixture overwrite", () => {
  const storeSource = readFileSync("src/features/chart/store.ts", "utf8");
  const moduleSource = readFileSync("src/features/chart/module.tsx", "utf8");

  expect(storeSource).toContain('selectedEncounterId: ""');
  expect(moduleSource).toContain("chooseRecoverableLiveEncounterId");
  expect(moduleSource).toContain(
    "saveSelectedChartEncounterId(workspaceId, nextSelectedEncounterId)",
  );
  expect(moduleSource).toContain(
    "if (options.allowMockFallback === false) return null;",
  );
  expect(moduleSource).toContain(
    "selectedEncounterId === demoScenarioEncounterId",
  );
  expect(moduleSource).not.toContain(
    "selectedEncounterId === explicitQueryEncounterId",
  );
});

function createFakeChartLiveQueueClient(
  calls: string[],
  options: { directProfileReadFails?: boolean } = {},
) {
  return {
    async rpc(functionName: string, args: { p_workspace_id: string }) {
      calls.push(`rpc:${functionName}:${args.p_workspace_id}`);
      if (functionName === "clair_search_reception_patient_guardian_lookup") {
        return {
          data: [
            { patient: patientRows[0], primaryGuardian: guardianRows[0] },
            { patient: patientRows[1], primaryGuardian: guardianRows[1] },
          ],
          error: null,
        };
      }

      return {
        data: [
          { encounter: firstEncounter, queueEntry: queueEntry(firstEncounter, "consultation", 1) },
          { encounter: secondEncounter, queueEntry: queueEntry(secondEncounter, "consultation", 2) },
          { encounter: billingEncounter, queueEntry: queueEntry(billingEncounter, "billing", 3) },
        ],
        error: null,
      };
    },
    from(tableName: "patients" | "guardians" | "users") {
      return {
        select() {
          let scopedWorkspaceId = "";
          let selectedIds: string[] = [];
          const builder = {
            eq(column: string, value: string) {
              if (column === "workspace_id") scopedWorkspaceId = value;
              return builder;
            },
            in(column: string, values: string[]) {
              if (column === "id") selectedIds = values;
              return builder;
            },
            then(resolve: (value: { data: unknown[]; error: null }) => void) {
              calls.push(`from:${tableName}:${scopedWorkspaceId}:${selectedIds.join(",")}`);
              if (options.directProfileReadFails) {
                resolve({
                  data: [],
                  error: { message: "permission denied" },
                } as unknown as { data: unknown[]; error: null });
                return;
              }

              resolve({
                data:
                  tableName === "patients"
                    ? patientRows.filter((row) => selectedIds.includes(row.id))
                    : tableName === "guardians"
                      ? guardianRows.filter((row) => selectedIds.includes(row.id))
                      : staffRows.filter((row) => selectedIds.includes(row.id)),
                error: null,
              });
            },
          };
          return builder;
        },
      };
    },
  };
}

const patientRows = [
  {
    id: "19421000-0000-4000-8000-000000000001",
    workspace_id: workspaceId,
    patient_no: "P-DEN194-01",
    name: "Kong Synthetic",
    species: "dog",
    sex: "male",
    status: "active",
    created_at: "2026-05-30T00:00:00.000Z",
    updated_at: "2026-05-30T00:00:00.000Z",
  },
  {
    id: "19421000-0000-4000-8000-000000000002",
    workspace_id: workspaceId,
    patient_no: "P-DEN194-02",
    name: "Nabi Synthetic",
    species: "cat",
    sex: "female",
    status: "active",
    created_at: "2026-05-30T00:00:00.000Z",
    updated_at: "2026-05-30T00:00:00.000Z",
  },
];

const guardianRows = [
  {
    id: "19420000-0000-4000-8000-000000000001",
    workspace_id: workspaceId,
    name: "DEN-194 Guardian 01",
    created_at: "2026-05-30T00:00:00.000Z",
    updated_at: "2026-05-30T00:00:00.000Z",
  },
  {
    id: "19420000-0000-4000-8000-000000000002",
    workspace_id: workspaceId,
    name: "DEN-194 Guardian 02",
    created_at: "2026-05-30T00:00:00.000Z",
    updated_at: "2026-05-30T00:00:00.000Z",
  },
];

const staffRows = [
  {
    id: "19410000-0000-4000-8000-000000000001",
    display_name: "청담 원장",
  },
  {
    id: "19410000-0000-4000-8000-000000000002",
    display_name: "김도윤",
  },
];
